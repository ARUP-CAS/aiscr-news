---
title: "AMČR a MUSEION: snadný zápis nálezů a otevřené dveře pro další systémy"
excerpt: Muzea s MUSEIONem mohou zapisovat nálezy do AMČR-PAS přímo ze své sbírkové evidence. Rozhraní, které to umožňuje, je otevřené i dalším systémům a aplikacím – včetně terénních aplikací pro evidenci nálezů.
badge: Novinka
---

*Archeologické nálezy se v Česku evidují dvakrát: v muzejní sbírkové evidenci a v Archeologické mapě ČR. Díky projektu podpořenému programem PRAK SHAPE Akademie věd ČR jsme ve spolupráci se společností Axiell propojili AMČR s nejrozšířenějším muzejním systémem MUSEION. Zároveň jsme otevřeli a zdokumentovali rozhraní, přes které se do AMČR-PAS mohou připojit i další systémy.*

## Otevřené API, MUSEION jako první klient

Srdcem propojení je **AMČR-PAS API** – rozhraní, přes které lze do modulu [AMČR-PAS](https://amcr-help.aiscr.cz/amcr/amcr-pas/) zapisovat samostatné nálezy, aktualizovat jejich evidenční čísla a přikládat k nim fotografie.
Rozhraní není vyhrazeno jedinému dodavateli: připojit se může **kterýkoli integrátor**, který pracuje s oprávněným účtem AMČR.
MUSEION je jeho prvním, referenčním klientem.

Rozhraní je popsané v anglické [referenční dokumentaci pro vývojáře](https://arup-cas.github.io/aiscr-api-home/pas-api/) včetně struktury dat, stavových kódů a ukázek v cURL a Pythonu, takže je lze využít i mimo české prostředí.
Hodí se například pro **terénní aplikace pro evidenci nálezů**, které pracují bez stálého připojení a data do AMČR odešlou, až když je připojení k dispozici.

![Nález v dlani a jeho zápis do AMČR-PAS v mobilním telefonu přímo v terénu.](images/007_002.webp)

> *Zápis nálezu přímo v terénu. Stejnou cestou mohou do AMČR-PAS zapisovat i aplikace dalších vývojářů.*

## Co propojení umí

Propojení pokrývá sedm scénářů, které oba systémy shodně označují S1–S7:

![Schéma propojení: MUSEION zapisuje nálezy do AMČR přes AMČR-PAS API (S2, S3), z AMČR načítá hesláře a aktualizace přes OAI-PMH (S1, S4, S5) a Digitální archiv AMČR čte předměty ze sbírek muzeí přes SOAP (S6); do AMČR-PAS API mohou zapisovat i další systémy a terénní aplikace.](images/007_001_schema_cs.png)

> *Jak spolu AMČR a MUSEION komunikují – a kudy se k AMČR-PAS mohou připojit další systémy. Scénář S7 probíhá jen uvnitř MUSEIONu, proto ve schématu není.*

- **S1 – mapování slovníků.** Muzeum propojí své slovníky (předmět, materiál, datace, nálezové okolnosti ad.) s hesláři AMČR, které jsou strojově dostupné přes rozhraní OAI-PMH. Je to předpoklad všech exportů.
- **S2 a S3 – export nálezu do AMČR-PAS**, jednotlivě i hromadně, včetně volby cílového stavu záznamu a obrazových příloh. Po zařazení nálezu do systematické evidence lze v AMČR aktualizovat i jeho evidenční číslo.
- **S4 a S5 – načtení údajů z AMČR** do existující katalogizační karty, ze samostatného nálezu v AMČR-PAS nebo z archeologické akce.
- **S6 – předměty z muzeí v Digitálním archivu AMČR.** U projektů, akcí a samostatných nálezů si lze zobrazit předměty, které k nim evidují napojená muzea, a to on-line přímo z jejich sbírkové evidence.
- **S7 – hromadný import** nálezů do MUSEIONu z tabulky, například od oprávněné archeologické organizace.

## O sdílení rozhoduje muzeum

Nejvíce diskutovaným tématem červnového workshopu se zástupci pěti muzeí bylo sdílení údajů o sbírkách.
Výsledkem je řešení, ve kterém **rozhoduje muzeum**: pro každý záznam předmětu volí, zda Digitálnímu archivu poskytne jen evidenční či inventární číslo (úroveň BASIC), nebo i vybrané odborné údaje (úroveň FULL).
Místo uložení předmětu ani jeho ocenění se nesdílí nikdy a fotografie se touto cestou nepřenášejí.
Poskytování údajů do Digitálního archivu upravuje jednoduchá bezúplatná dohoda mezi muzeem a ARÚ, jejíž [vzor je ke stažení](https://amcr-help.aiscr.cz/metodika/dohody.html#vzory-dokumentů-ke-stažení) v nápovědě AMČR.
ARÚ přitom údaje o předmětech trvale nepřebírá – Digitální archiv je načítá on-line a vždy s uvedením muzea jako zdroje.

Nálezy zapsané z MUSEIONu do AMČR-PAS se chovají stejně jako jakékoli jiné záznamy AMČR-PAS.
Nově přitom AMČR rozlišuje organizaci projektu a organizaci, které byl nález předán – ta s ním pak může pracovat, i když není původcem projektu.

![Záznam samostatného nálezu v Digitálním archivu AMČR s mapou, fotografií a trvalým odkazem DOI.](images/007_003.webp)

> *Po archivaci se nálezy z AMČR-PAS zpřístupňují v Digitálním archivu AMČR podle nastavené přístupnosti, každý se svým trvalým odkazem.*

## Co bude dál

Integrace je součástí MUSEIONu 5.6 a jeho běžné licence, bez samostatného poplatku.
Obě strany ji ověřily a předaly v červenci 2026 a v produkčním prostředí otestovaly v srpnu.
Na podzim ji budeme společně s Axiellem představovat muzeím – na konferenci Axiell, na regionálních archeologických komisích i na setkáních v jednotlivých krajích – a pomáhat s prvními zapojeními.

Vyvíjíte systém pro správu sbírek nebo terénní aplikaci a chcete se do AMČR-PAS připojit? Ozvěte se nám.

## Shrnutí

- AMČR a MUSEION jsou propojené v sedmi scénářích S1–S7: od mapování slovníků přes export nálezů do AMČR-PAS až po zobrazení muzejních předmětů v Digitálním archivu AMČR.
- AMČR-PAS API je otevřené všem integrátorům; MUSEION je jeho referenčním klientem.
- Rozhraní se hodí i pro terénní aplikace pro evidenci nálezů, které pracují bez stálého připojení.
- O rozsahu sdílení údajů o sbírkách rozhoduje muzeum, a to u každého záznamu zvlášť.
- Projekt byl podpořen programem PRAK SHAPE Akademie věd ČR.

## Chcete vědět víc?

- [AMČR-PAS API – referenční dokumentace pro vývojáře (anglicky)](https://arup-cas.github.io/aiscr-api-home/pas-api/)
- [PAS API – příjem a zpracování záznamů v AMČR (technická dokumentace)](https://aiscr-webamcr.readthedocs.io/cs/latest/05_integrace/pas_api.html)
- [Předměty ve sbírkách muzeí – tutoriál k Digitálnímu archivu AMČR](https://amcr-help.aiscr.cz/digiarchiv/museion.html)
- [Dohody o využívání AMČR – propojení se sbírkovou evidencí muzeí a vzor dohody o sdílení údajů](https://amcr-help.aiscr.cz/metodika/dohody.html#museion)
- [MUSEION: Integrace s AMČR – příručka společnosti Axiell](https://doc.axiell.cz/soubory/prirucky/p33_integrace_amcr.pdf)
- [Blogpost Axiell: Museion a Archeologická mapa ČR](https://www.axiell.com/cz/blog-post/museion-a-archeologicka-mapa-cr-nove-moznosti-integrace-usnadni-spravu-archeologickych-dat)
- [Novák, D., Sýkora, J. (2025): Možnosti propojení AMČR se systémy pro evidenci a správu sbírek muzejní povahy](https://doi.org/10.5281/zenodo.17370634)
