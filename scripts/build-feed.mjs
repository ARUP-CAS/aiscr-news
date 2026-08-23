#!/usr/bin/env node
/**
 * Feed builder for ARUP-CAS/aiscr-news.
 *
 * Content layout (one folder per item, languages together):
 *
 *   content/<type>/<YYYY-MM-DD-slug>/
 *     item.yaml     shared metadata (sites, published, author, image, time)
 *     cs.md, en.md  per-language title/excerpt/badge + Markdown body
 *     images/       images belonging to this item
 *
 *   authors/authors.yaml + authors/photos/   author registry
 *
 * Output (dist/):
 *
 *   feed/<site>/<locale>.json          full feed, newest first
 *   feed/<site>/<locale>/<slug>.json   single item (SPA article pages)
 *   content/<type>/<folder>/images/    item images (copied as-is)
 *   authors/photos/                    author photos
 *   preview/<site>-<locale>.html       human-readable preview of each feed
 *   index.html, .nojekyll
 *
 * Usage:
 *   node scripts/build-feed.mjs                  build into dist/
 *   node scripts/build-feed.mjs --validate-only  validate content, write nothing
 *
 * Errors fail the build (exit 1). Warnings don't fail it; in GitHub Actions
 * they are emitted as ::warning annotations (visible in the PR checks UI).
 *
 * BASE_URL env var sets the absolute URL prefix for images/links
 * (default: https://arup-cas.github.io/aiscr-news).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as yaml from 'js-yaml';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BASE_URL = (process.env.BASE_URL ?? 'https://arup-cas.github.io/aiscr-news').replace(/\/$/, '');
const VALIDATE_ONLY = process.argv.includes('--validate-only');
const IN_CI = process.env.GITHUB_ACTIONS === 'true';
// Koncepty (published: false) se do náhledů zahrnou jen na výslovné přání
// (INCLUDE_DRAFTS=1) — na veřejném webu nemají co dělat.
const INCLUDE_DRAFTS = process.env.INCLUDE_DRAFTS === '1';

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'config.json'), 'utf8'));
const KNOWN_SITES = Object.keys(config.sites);
const { locales: KNOWN_LOCALES, types: KNOWN_TYPES } = config;
const IMG = config.images;

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const SANITIZE_OPTS = {
  allowedTags: [
    'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'em', 'strong', 's', 'sub', 'sup',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img', 'figure', 'figcaption',
  ],
  allowedAttributes: {
    // no "target" — a target=_blank link without rel=noopener allows tab-nabbing
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
};

// --- error / warning collection ----------------------------------------------
const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push({ file, msg });
const warn = (file, msg) => warnings.push({ file, msg });

function report() {
  for (const w of warnings) {
    if (IN_CI) console.log(`::warning file=${w.file}::${w.msg}`);
    else console.warn(`  ⚠ ${w.file}: ${w.msg}`);
  }
  for (const e of errors) {
    if (IN_CI) console.log(`::error file=${e.file}::${e.msg}`);
    else console.error(`  ✖ ${e.file}: ${e.msg}`);
  }
  if (IN_CI && process.env.GITHUB_STEP_SUMMARY && (errors.length || warnings.length)) {
    const lines = [
      '## Validace obsahu',
      ...errors.map((e) => `- ❌ \`${e.file}\` — ${e.msg}`),
      ...warnings.map((w) => `- ⚠️ \`${w.file}\` — ${w.msg}`),
      '',
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
  }
}

// --- helpers ------------------------------------------------------------------
const isKebab = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
const kb = (bytes) => Math.round(bytes / 1024);

/**
 * Frontmatter parser: strictly YAML between --- markers (js-yaml is safe-by-default;
 * gray-matter was dropped because its `---js` engine eval()s frontmatter).
 */
function parseFrontmatter(raw, file) {
  const m = raw.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    fail(file, 'chybí frontmatter (blok mezi --- na začátku souboru)');
    return null;
  }
  try {
    const fm = yaml.load(m[1]) ?? {};
    if (typeof fm !== 'object' || Array.isArray(fm)) {
      fail(file, 'frontmatter musí být mapa klíč: hodnota');
      return null;
    }
    return { fm, body: m[2] };
  } catch (e) {
    fail(file, `neplatný frontmatter: ${e.message}`);
    return null;
  }
}

/**
 * Resolve a repo-relative path safely: normalize and refuse anything that
 * escapes the repository (".." traversal).
 */
function safeRel(rel, file, original) {
  const norm = path.posix.normalize(rel);
  if (norm.startsWith('..') || path.posix.isAbsolute(norm)) {
    fail(file, `cesta "${original}" vede mimo repozitář — používejte cesty uvnitř složky článku`);
    return null;
  }
  return norm;
}

function checkUnknownKeys(file, obj, known, hint = '') {
  for (const key of Object.keys(obj ?? {})) {
    if (!known.includes(key)) warn(file, `neznámý klíč "${key}"${hint ? ` — ${hint}` : ''}`);
  }
}

function checkImageFile(relPath, { warnKb = IMG.warnKb, maxKb = IMG.maxKb } = {}) {
  const abs = path.join(ROOT, relPath);
  if (fs.lstatSync(abs).isSymbolicLink()) {
    fail(relPath, 'symlinky nejsou povolené — nahrajte skutečný soubor');
    return;
  }
  const ext = path.extname(relPath).toLowerCase();
  if (!IMG.allowedExtensions.includes(ext)) {
    fail(relPath, `nepovolený formát obrázku "${ext}" (povolené: ${IMG.allowedExtensions.join(', ')})`);
    return;
  }
  const size = fs.statSync(abs).size;
  if (kb(size) > maxKb) {
    fail(relPath, `obrázek má ${kb(size)} kB — překračuje tvrdý limit ${maxKb} kB, zmenšete ho`);
  } else if (kb(size) > warnKb) {
    warn(relPath, `obrázek má ${kb(size)} kB (doporučené maximum ${warnKb} kB) — zvažte zmenšení/převod do WebP`);
  }
}

/** Absolutize a URL; relative URLs resolve against the item folder. */
function absolutize(url, folderRel, file = folderRel) {
  if (!url || /^(https?:|mailto:|#)/.test(url)) return url;
  const rel = safeRel(url.startsWith('/') ? url.slice(1) : `${folderRel}/${url}`, file, url);
  return rel === null ? url : `${BASE_URL}/${rel}`;
}

/** Rewrite src/href in rendered HTML to absolute URLs; verify local images exist. */
function processHtml(html, folderRel, file) {
  return html.replace(/(src|href)="([^"]+)"/g, (m, attr, url) => {
    if (/^(https?:|mailto:|#)/.test(url)) return m;
    let decoded = url;
    try { decoded = decodeURI(url); } catch { /* malformed %-escape: keep as-is */ }
    const rel = safeRel(url.startsWith('/') ? url.slice(1) : `${folderRel}/${decoded}`, file, url);
    if (rel === null) return m;
    if (attr === 'src' && !fs.existsSync(path.join(ROOT, rel))) {
      fail(file, `odkazovaný obrázek "${url}" v repozitáři neexistuje`);
    }
    return `${attr}="${BASE_URL}/${rel}"`;
  });
}

// --- authors -------------------------------------------------------------------
function loadAuthors() {
  const file = 'authors/authors.yaml';
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    fail(file, 'soubor s registrem autorů chybí');
    return {};
  }
  let data;
  try {
    data = yaml.load(fs.readFileSync(abs, 'utf8')) ?? {};
  } catch (e) {
    fail(file, `neplatné YAML: ${e.message}`);
    return {};
  }
  const authors = {};
  for (const [slug, a] of Object.entries(data)) {
    if (!isKebab(slug)) fail(file, `slug autora "${slug}" musí být malá písmena a pomlčky (kebab-case)`);
    if (!a || typeof a !== 'object') { fail(file, `autor "${slug}" musí být objekt s klíči name a photo`); continue; }
    checkUnknownKeys(file, a, ['name', 'photo', 'role', 'url'], `u autora "${slug}"`);
    if (!a.name) fail(file, `autor "${slug}" nemá vyplněné "name"`);
    if (a.url && !/^https?:\/\//.test(a.url)) fail(file, `"url" autora "${slug}" musí začínat http(s)://`);
    if (!a.photo) {
      fail(file, `autor "${slug}" nemá fotku — přidejte soubor do authors/photos/ a odkaz do "photo"`);
    } else if (!/^photos\/[^/]+$/.test(a.photo)) {
      fail(file, `"photo" autora "${slug}" musí být soubor ve tvaru photos/<jmeno-souboru>`);
    } else {
      const photoRel = `authors/${a.photo}`;
      if (!fs.existsSync(path.join(ROOT, photoRel))) {
        fail(file, `fotka autora "${slug}" (${photoRel}) v repozitáři neexistuje`);
      } else {
        checkImageFile(photoRel, { warnKb: IMG.authorPhotoWarnKb });
      }
    }
    authors[slug] = {
      slug,
      name: a.name,
      photo: a.photo ? `${BASE_URL}/authors/${a.photo}` : null,
      ...(a.role ? { role: a.role } : {}),
      ...(a.url ? { url: a.url } : {}),
    };
  }
  return authors;
}

// --- content items --------------------------------------------------------------
function loadItem(type, folderName, authors) {
  const folderRel = `content/${type}/${folderName}`;
  const folderAbs = path.join(ROOT, folderRel);

  // folder name = date + slug
  const m = folderName.match(/^(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)$/);
  if (!m) {
    fail(folderRel, 'název složky musí mít tvar RRRR-MM-DD-slug (např. 2026-09-01-nova-funkce)');
    return null;
  }
  const [, date, slug] = m;
  if (Number.isNaN(Date.parse(date))) fail(folderRel, `"${date}" není platné datum`);
  if (!isKebab(slug)) fail(folderRel, `slug "${slug}" musí být kebab-case`);

  // item.yaml
  const metaFile = `${folderRel}/item.yaml`;
  if (!fs.existsSync(path.join(ROOT, metaFile))) {
    fail(folderRel, 'chybí item.yaml — zkopírujte šablonu z _template/');
    return null;
  }
  let meta;
  try {
    meta = yaml.load(fs.readFileSync(path.join(ROOT, metaFile), 'utf8')) ?? {};
  } catch (e) {
    fail(metaFile, `neplatné YAML: ${e.message}`);
    return null;
  }
  checkUnknownKeys(metaFile, meta, ['sites', 'time', 'published', 'author', 'image'],
    'title/excerpt/badge patří do jazykových souborů (cs.md, en.md)');

  if (!Array.isArray(meta.sites) || meta.sites.length === 0) {
    fail(metaFile, '"sites" musí být neprázdný seznam');
  } else {
    for (const s of meta.sites) if (!KNOWN_SITES.includes(s)) fail(metaFile, `neznámý web "${s}" (povolené: ${KNOWN_SITES.join(', ')})`);
  }
  if (typeof meta.published !== 'boolean') fail(metaFile, '"published" musí být true nebo false');
  if (meta.time != null && !/^\d{2}:\d{2}$/.test(String(meta.time))) fail(metaFile, `"time" musí být HH:MM (je ${JSON.stringify(meta.time)})`);

  let author = null;
  if (meta.author != null) {
    if (!authors[meta.author]) {
      fail(metaFile, `autor "${meta.author}" není v authors/authors.yaml — nejdřív ho tam přidejte (včetně fotky)`);
    } else {
      author = authors[meta.author];
    }
  } else if (type === 'news') {
    warn(metaFile, 'článek nemá autora ("author") — doplňte ho z authors/authors.yaml');
  }

  let image = null;
  if (meta.image) {
    if (/^https?:\/\//.test(meta.image)) {
      image = meta.image;
    } else {
      const imgRel = meta.image.startsWith('/') ? meta.image.slice(1) : `${folderRel}/${meta.image}`;
      if (!fs.existsSync(path.join(ROOT, imgRel))) fail(metaFile, `úvodní obrázek "${meta.image}" neexistuje (čekám ho v ${folderRel}/images/)`);
      else image = absolutize(meta.image, folderRel, metaFile);
    }
  }
  if (type === 'quickinfo' && meta.image) warn(metaFile, 'quickinfo úvodní obrázek nepoužívá — konzumenti ho v banneru nezobrazí');

  // images folder — validate everything in it (recursively) and track usage
  const imagesRel = `${folderRel}/images`;
  const imageFiles = fs.existsSync(path.join(ROOT, imagesRel))
    ? fs.readdirSync(path.join(ROOT, imagesRel), { recursive: true })
        .map(String)
        .filter((f) => fs.lstatSync(path.join(ROOT, imagesRel, f)).isFile() || fs.lstatSync(path.join(ROOT, imagesRel, f)).isSymbolicLink())
        .map((f) => f.split(path.sep).join('/'))
    : [];
  for (const f of imageFiles) checkImageFile(`${imagesRel}/${f}`);

  // locale files
  const entries = fs.readdirSync(folderAbs);
  const localeFiles = entries.filter((f) => f.endsWith('.md'));
  for (const entry of entries) {
    if (entry === 'item.yaml' || entry === 'images' || entry.endsWith('.md')) continue;
    warn(`${folderRel}/${entry}`, 'neočekávaný soubor ve složce článku — patří sem jen item.yaml, <jazyk>.md a images/');
  }
  if (localeFiles.length === 0) fail(folderRel, `chybí jazykové soubory (${KNOWN_LOCALES.map((l) => l + '.md').join(', ')})`);

  const perLocale = {};
  for (const lf of localeFiles) {
    const locale = lf.replace(/\.md$/, '');
    const file = `${folderRel}/${lf}`;
    if (!KNOWN_LOCALES.includes(locale)) {
      fail(file, `neznámý jazyk "${locale}" — soubor pojmenujte ${KNOWN_LOCALES.map((l) => l + '.md').join(' nebo ')}`);
      continue;
    }
    const parsed = parseFrontmatter(fs.readFileSync(path.join(ROOT, file), 'utf8'), file);
    if (!parsed) continue;
    const { fm, body } = parsed;
    checkUnknownKeys(file, fm, ['title', 'excerpt', 'badge'],
      'sites/published/author/image/time patří do item.yaml');
    if (!fm.title || typeof fm.title !== 'string' || !fm.title.trim()) fail(file, '"title" je povinný');
    if (type === 'news') {
      if (!fm.excerpt || typeof fm.excerpt !== 'string' || !fm.excerpt.trim()) fail(file, '"excerpt" je pro news povinný');
      else if (fm.excerpt.length > config.excerptWarnChars) warn(file, `excerpt má ${fm.excerpt.length} znaků (doporučené maximum ${config.excerptWarnChars})`);
    }
    if (!body.trim()) fail(file, 'tělo článku je prázdné');
    if (/^#\s/m.test(body)) fail(file, 'v těle nepoužívejte nadpis "#" (h1) — ten je rezervovaný pro title; začněte od "##"');

    const html = processHtml(sanitizeHtml(md.render(body), SANITIZE_OPTS), folderRel, file).trim();
    perLocale[locale] = {
      slug,
      type,
      date,
      time: meta.time != null ? String(meta.time) : null,
      badge: fm.badge ?? null,
      title: fm.title,
      excerpt: fm.excerpt ?? null,
      image,
      author,
      html,
    };
  }

  // warn about images that no locale references and the cover doesn't use
  const usedInBodies = Object.values(perLocale).map((i) => i.html).join('\n');
  for (const f of imageFiles) {
    const url = `${BASE_URL}/${imagesRel}/${f}`;
    if (!usedInBodies.includes(url) && image !== url) {
      warn(`${imagesRel}/${f}`, 'obrázek není použit v žádné jazykové verzi ani jako úvodní obrázek');
    }
  }

  return { folderRel, slug, type, sites: meta.sites ?? [], published: meta.published === true, perLocale };
}

function collectItems(authors) {
  const items = [];
  for (const type of KNOWN_TYPES) {
    const dirAbs = path.join(ROOT, 'content', type);
    if (!fs.existsSync(dirAbs)) continue;
    for (const folderName of fs.readdirSync(dirAbs).sort()) {
      if (folderName.startsWith('_') || folderName.startsWith('.')) continue;
      if (!fs.statSync(path.join(dirAbs, folderName)).isDirectory()) {
        warn(`content/${type}/${folderName}`, 'soubory patří do složek článků, ne přímo do content/');
        continue;
      }
      const item = loadItem(type, folderName, authors);
      if (item) items.push(item);
    }
  }
  // duplicate slugs within a type (different date prefixes could collide)
  const seen = new Map();
  for (const it of items) {
    const key = `${it.type}:${it.slug}`;
    if (seen.has(key)) fail(it.folderRel, `duplicitní slug "${it.slug}" (koliduje s ${seen.get(key)})`);
    else seen.set(key, it.folderRel);
  }
  return items;
}

// --- preview pages ---------------------------------------------------------------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PREVIEW_CSS = `
  body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1f2937;background:#fff}
  a{color:#1d4ed8} img{max-width:100%;height:auto}
  .item{border:1px solid #e5e7eb;border-radius:12px;padding:1.5rem;margin:1.5rem 0}
  .meta{display:flex;gap:.75rem;align-items:center;font-size:.875rem;color:#6b7280;flex-wrap:wrap}
  .badge{background:#1d4ed8;color:#fff;border-radius:999px;padding:.1rem .6rem;font-size:.75rem}
  .author{display:flex;gap:.5rem;align-items:center}
  .author img{width:28px;height:28px;border-radius:50%;object-fit:cover}
  .cover{border-radius:8px;margin:.75rem 0}
  .draft{border-style:dashed;border-color:#b45309;background:#fffbeb}
  .excerpt{font-style:italic;color:#4b5563}
  .type{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af}
`;

const DRAFT_NOTE = INCLUDE_DRAFTS
  ? ' — lokální build s koncepty (<code>published: false</code>), ve feedu nejsou.'
  : '';

function previewPage(site, locale, items) {
  const cards = items.map((i) => `
  <article class="item${i.draft ? ' draft' : ''}">
    <div class="meta">
      ${i.draft ? '<span class="badge" style="background:#b45309">KONCEPT — published: false</span>' : ''}
      <span class="type">${esc(i.type)}</span>
      ${i.badge ? `<span class="badge">${esc(i.badge)}</span>` : ''}
      <span>${esc(i.date)}${i.time ? ' ' + esc(i.time) : ''}</span>
      ${i.author ? `<span class="author"><img src="${esc(i.author.photo)}" alt=""> ${esc(i.author.name)}</span>` : ''}
    </div>
    <h2>${esc(i.title)}</h2>
    ${i.image ? `<img class="cover" src="${esc(i.image)}" alt="">` : ''}
    ${i.excerpt ? `<p class="excerpt">${esc(i.excerpt)}</p>` : ''}
    ${i.html}
  </article>`).join('\n');
  return `<!doctype html><html lang="${esc(locale)}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Preview — ${esc(site)} / ${esc(locale)}</title>
<style>${PREVIEW_CSS}</style>
<p><a href="../index.html">← všechny feedy</a></p>
<h1>${esc(site)} / ${esc(locale)} <small>(${items.length})</small></h1>
<p><a href="../feed/${esc(site)}/${esc(locale)}.json">JSON feed</a>
${DRAFT_NOTE}</p>
${cards || '<p>Žádné položky.</p>'}
</html>`;
}

// --- main --------------------------------------------------------------------------
const authors = loadAuthors();
const items = collectItems(authors);
if (items.length === 0 && errors.length === 0) fail('content/', 'nenalezen žádný obsah');

report();
if (errors.length) {
  console.error(`\n✖ Validace selhala: ${errors.length} chyb(a), ${warnings.length} varování.`);
  process.exit(1);
}
console.log(`✓ ${items.length} položek v pořádku (${warnings.length} varování), ${Object.keys(authors).length} autorů.`);
if (VALIDATE_ONLY) process.exit(0);

const generated = new Date().toISOString();
fs.rmSync(DIST, { recursive: true, force: true });

const feedIndex = [];
for (const site of KNOWN_SITES) {
  for (const locale of KNOWN_LOCALES) {
    const byDate = (a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''));
    const relevant = items.filter((it) => it.sites.includes(site) && it.perLocale[locale]);
    const feedItems = relevant.filter((it) => it.published).map((it) => it.perLocale[locale]).sort(byDate);
    const previewItems = relevant
      .filter((it) => it.published || INCLUDE_DRAFTS)
      .map((it) => ({ ...it.perLocale[locale], draft: !it.published }))
      .sort(byDate);

    const dir = path.join(DIST, 'feed', site);
    fs.mkdirSync(path.join(dir, locale), { recursive: true });
    fs.writeFileSync(path.join(dir, `${locale}.json`), JSON.stringify({ generated, site, locale, items: feedItems }, null, 2));
    for (const item of feedItems) {
      fs.writeFileSync(path.join(dir, locale, `${item.slug}.json`), JSON.stringify({ generated, site, locale, item }, null, 2));
    }
    fs.mkdirSync(path.join(DIST, 'preview'), { recursive: true });
    fs.writeFileSync(path.join(DIST, 'preview', `${site}-${locale}.html`), previewPage(site, locale, previewItems));
    feedIndex.push({ site, locale, count: feedItems.length });
  }
}

// copy item images (drafts only in local INCLUDE_DRAFTS builds) + author photos
for (const it of items) {
  const imgDir = path.join(ROOT, it.folderRel, 'images');
  if ((it.published || INCLUDE_DRAFTS) && fs.existsSync(imgDir)) {
    fs.cpSync(imgDir, path.join(DIST, it.folderRel, 'images'), { recursive: true });
  }
}
if (fs.existsSync(path.join(ROOT, 'authors', 'photos'))) {
  fs.cpSync(path.join(ROOT, 'authors', 'photos'), path.join(DIST, 'authors', 'photos'), { recursive: true });
}

// index page
const rows = feedIndex.map((f) => `<tr>
  <td>${esc(f.site)}</td><td>${esc(f.locale)}</td><td>${f.count}</td>
  <td><a href="feed/${esc(f.site)}/${esc(f.locale)}.json">JSON</a></td>
  <td><a href="preview/${esc(f.site)}-${esc(f.locale)}.html">náhled</a></td>
</tr>`).join('\n');
fs.writeFileSync(path.join(DIST, 'index.html'), `<!doctype html><html lang="cs"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>aiscr-news — feedy</title>
<style>${PREVIEW_CSS} table{border-collapse:collapse;width:100%} td,th{border:1px solid #e5e7eb;padding:.5rem .75rem;text-align:left}</style>
<h1>aiscr-news — vygenerované feedy</h1>
<p>Vygenerováno: ${generated}</p>
<table><tr><th>web</th><th>jazyk</th><th>položek</th><th>feed</th><th>náhled</th></tr>
${rows}
</table>
<p>Zdroj: <a href="https://github.com/ARUP-CAS/aiscr-news">github.com/ARUP-CAS/aiscr-news</a></p>
</html>`);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

console.log(`✓ Feed vygenerován do dist/ (${feedIndex.length} feedů, base URL ${BASE_URL}).`);
