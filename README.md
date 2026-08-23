# aiscr-news

Sdílené **aktuality** a **quick-info** pro weby AIS CR (amcr-info, amcr, digiarchiv).
Jeden zdroj pravdy: novinka se napíše jednou v Markdownu, označí se, kde se má zobrazit,
a GitHub Action ji publikuje jako JSON feed na GitHub Pages. Weby si feed stahují za běhu.

## Struktura repozitáře

```
content/
  news/                          ← plnohodnotné články
    2024-08-04-nova-amcr/        ← jedna složka = jeden článek (datum + slug)
      item.yaml                  ← sdílená metadata (weby, autor, publikováno…)
      cs.md                      ← česká verze (titulek, perex, text)
      en.md                      ← anglická verze
      images/                    ← obrázky TOHOTO článku (úvodní i v textu)
    _template/                   ← šablona na kopírování
  quickinfo/                     ← krátké notifikace do banneru (stejný princip)
authors/
  authors.yaml                   ← registr autorů
  photos/                        ← fotky autorů
config/config.json               ← seznam webů, jazyků, limity obrázků
```

## Jak přidat článek

1. **Zkopírujte složku `content/news/_template/`** a přejmenujte ji na
   `RRRR-MM-DD-slug` (např. `content/news/2026-09-01-nova-funkce/`).
   Datum a slug článku se berou z názvu složky.
2. Vyplňte `item.yaml` — na kterých webech se má článek zobrazit, autor,
   případně úvodní obrázek. Až bude hotovo, přepněte `published: true`.
3. Napište text do `cs.md` (a překlad do `en.md`). Titulek, perex a štítek
   jsou ve frontmatter, tělo je Markdown. Nadpisy začínejte od `##`.
4. **Obrázky dejte do podsložky `images/`** vedle článku a odkazujte relativně:
   `![popis](images/foto.jpg)` — náhled pak funguje i přímo na GitHubu.
5. Otevřete pull request. CI obsah zvaliduje a chyby i varování vypíše přímo
   k běhu. Po merge do `main` se feedy publikují automaticky.

Pro quick-info platí totéž se složkou `content/quickinfo/` — jen bez perexu,
autora a obrázků (je to pár vět do banneru).

## Jak přidat autora

Článek smí odkazovat jen na autora z registru — CI to kontroluje.

1. Přidejte záznam do [`authors/authors.yaml`](authors/authors.yaml):
   ```yaml
   jana-novakova:
     name: Jana Nováková
     photo: photos/jana-novakova.jpg
   ```
2. Nahrajte fotku do `authors/photos/` (čtvercová, ideálně ~400×400 px, do 200 kB).
   Bez fotky validace neprojde.
3. V článku pak stačí `author: jana-novakova` v `item.yaml`.

## Co hlídá CI

- **Chyby (shodí build):** neznámý web nebo jazyk, špatný formát názvu složky,
  chybějící `item.yaml`/titulek/perex/tělo, autor mimo registr, autor bez fotky,
  odkaz na neexistující obrázek, `#` (h1) v těle, obrázek nad 4 MB,
  nepovolený formát obrázku, duplicitní slug.
- **Varování (u PR jako anotace):** obrázek nad 500 kB, fotka autora nad 200 kB,
  nepoužitý obrázek ve složce článku, klíč na špatném místě
  (např. `title` v `item.yaml`), příliš dlouhý perex, článek bez autora.

## Výstupy

```
https://arup-cas.github.io/aiscr-news/                                   # přehled feedů + náhledy
https://arup-cas.github.io/aiscr-news/feed/<web>/<jazyk>.json            # celý feed (od nejnovějších)
https://arup-cas.github.io/aiscr-news/feed/<web>/<jazyk>/<slug>.json     # jedna položka (pro SPA detail)
https://arup-cas.github.io/aiscr-news/preview/<web>-<jazyk>.html         # lidsky čitelný náhled feedu
```

Tvar položky feedu:

```json
{
  "slug": "nova-amcr",
  "type": "news",
  "date": "2024-08-04",
  "time": "12:00",
  "badge": "Novinka",
  "title": "Nová AMČR spuštěna",
  "excerpt": "Byla spuštěna nová webová aplikace AMČR.",
  "image": "https://arup-cas.github.io/aiscr-news/content/news/2024-08-04-nova-amcr/images/cover.svg",
  "author": { "slug": "ronald-harasim", "name": "Ronald Harasim", "photo": "https://…/photos/ronald-harasim.svg" },
  "html": "<p>…sanitizované HTML s absolutními URL…</p>"
}
```

- `html` je renderované a **sanitizované** už při generování — konzumenti ho vkládají přes `{@html}`.
- Položky jsou seřazené od nejnovějších; konzument filtruje podle `type`.
- `generated` + ETag od GitHub Pages = levná detekce „nic nového".

## Kontrola před publikací

GitHub Pages neumí náhled pro jednotlivé pull requesty, takže se článek kontroluje takto:

- **CI u pull requestu** obsah zvaliduje; chyby a varování jsou v souhrnu běhu.
- **Lokálně** si článek prohlédnete vyrenderovaný, včetně rozepsaných konceptů:

  ```bash
  INCLUDE_DRAFTS=1 npm run build   # pak otevřete dist/index.html
  ```

Koncepty (`published: false`) se do feedů ani na veřejný web nikdy nedostanou.

## Provozní omezení

- **Publikace trvá ~1 minutu** (běh Action) a k návštěvníkům, kteří web nedávno
  načetli, se novinka dostane **až do 10 minut** — GitHub Pages posílá pevné
  `Cache-Control: max-age=600` a nejde změnit.
- **Repozitář i vygenerovaný web jsou veřejné.** Nic citlivého sem nepatří —
  nepublikované koncepty sice nejdou na web, ale jejich zdroj je v repu vidět.
- **Obrázky se servírují tak, jak leží v repu** — Pages je nezmenšuje ani
  nekonvertuje. Proto jsou limity velikosti hlídané při buildu.
- **Velká média (video, PDF nad pár MB) sem nedávejte** a jen na ně odkazujte.

## Lokální vývoj

```bash
npm ci
npm run validate   # jen kontroly, nic negeneruje
npm run build      # vygeneruje dist/ — otevřete dist/index.html

INCLUDE_DRAFTS=1 npm run build   # totéž, ale i s koncepty (published: false)
```

Nový web se přidává v [config/config.json](config/config.json) (`sites`).
