---
title: "AMČR and MUSEION: easy recording of finds and an open door for other systems"
excerpt: Museums using MUSEION can now record finds in AMČR-PAS straight from their collection records. The API that makes this possible is open to any integrator – including offline field apps for recording finds.
badge: News
---

*Archaeological finds in the Czech Republic are recorded twice: in museum collection records and in the Archaeological Map of the Czech Republic (AMČR). In a project supported by the PRAK SHAPE programme of the Czech Academy of Sciences, we worked with Axiell to connect AMČR with MUSEION, the most widely used museum collection-management system in the country. Along the way we opened and documented the API that lets other systems connect to AMČR-PAS too.*

## An open API, with MUSEION as its first client

At the core of the integration is the **AMČR-PAS API**: the interface for recording individual finds in AMČR-PAS, updating their registration numbers and attaching photographs.
It is not reserved for a single vendor. **Any integrator** working with an authorised AMČR account can connect, and MUSEION is its first, reference client.

The [developer reference](https://arup-cas.github.io/aiscr-api-home/pas-api/) documents the endpoints, the XML element contract, status codes, rate limits and retries, with worked examples in cURL and Python.
The API is a natural fit for **offline field applications for recording finds**, which collect data without a connection and submit it once one is available.

![A find held in the palm and recorded in AMČR-PAS on a mobile phone, out in the field.](images/007_002.webp)

> *Recording a find in the field. Apps from other developers can write to AMČR-PAS the same way.*

## What the integration does

Both systems number the integration's seven scenarios the same way, S1–S7:

![Integration diagram: MUSEION records finds in AMČR through the AMČR-PAS API (S2, S3) and reads vocabularies and updates through OAI-PMH (S1, S4, S5); the AMČR Digital Archive reads museum objects through SOAP (S6); other systems and field apps can write to the AMČR-PAS API too.](images/007_001_schema_en.png)

> *How AMČR and MUSEION talk to each other – and where other systems can connect to AMČR-PAS. Scenario S7 runs entirely inside MUSEION, so it is not shown.*

- **S1 – vocabulary mapping.** A museum maps its own vocabularies (object, material, dating, find circumstances and others) onto AMČR's controlled vocabularies, which are published machine-readably through OAI-PMH. Every export depends on it; the developer reference explains the step for other integrators.
- **S2 and S3 – exporting finds to AMČR-PAS**, one at a time or in bulk, with a choice of target record state and image attachments. Once a find enters the permanent collection, its registration number can be updated in AMČR as well.
- **S4 and S5 – reading data from AMČR** into an existing catalogue record, from an AMČR-PAS find or from an archaeological event.
- **S6 – museum objects in the AMČR Digital Archive.** Projects, events and individual finds can show the objects that connected museums hold for them, retrieved live from the museums' own records.
- **S7 – bulk import** of finds into MUSEION from a spreadsheet, for example one supplied by a licensed archaeological organisation.

## The museum decides what is shared

At the June 2026 workshop with representatives of five museums, the most discussed topic was sharing collection data.
The result puts **the museum in charge**: for each object record it chooses whether the Digital Archive receives only the registration or inventory number (BASIC) or selected descriptive data as well (FULL).
Storage location and valuation are never shared, and no photographs travel this way.
Providing data to the Digital Archive is covered by a simple, free-of-charge agreement between the museum and the Institute of Archaeology; a [template (Czech)](https://amcr-help.aiscr.cz/metodika/dohody.html#museion) is published in the AMČR help.
The Institute does not copy the object data into AMČR: the Digital Archive retrieves it live and always credits the museum as its source.

Finds exported from MUSEION to AMČR-PAS behave like any other AMČR-PAS record.

![An individual find record in the AMČR Digital Archive, with its map, photograph and persistent DOI link.](images/007_003.webp)

> *Once archived, AMČR-PAS finds are published in the AMČR Digital Archive according to their access level, each with its own persistent link.*

## What comes next

The integration ships with MUSEION 5.6 as part of its standard licence, at no extra charge.
It was verified and handed over in July 2026 and tested end to end in production in August.
This autumn we will present it to museums together with Axiell and support the first institutions as they connect.

Building a collection-management system or a field app and want to connect to AMČR-PAS? Get in touch.

## Summary

- AMČR and MUSEION are connected across seven scenarios, S1–S7, from vocabulary mapping and exporting finds to AMČR-PAS to showing museum objects in the AMČR Digital Archive.
- The AMČR-PAS API is open to any integrator; MUSEION is its reference client.
- The API suits offline field applications for recording finds.
- Each museum decides, record by record, how much collection data it shares.
- The project was supported by the PRAK SHAPE programme of the Czech Academy of Sciences.

## Want to know more?

- [AMČR-PAS API – developer reference](https://arup-cas.github.io/aiscr-api-home/pas-api/)
- [AMČR API – OAI-PMH, File API and authentication](https://arup-cas.github.io/aiscr-api-home/)
- [PAS API – processing in AMČR (technical documentation, Czech)](https://aiscr-webamcr.readthedocs.io/cs/latest/05_integrace/pas_api.html)
- [MUSEION: Integration with AMČR – Axiell manual (Czech)](https://doc.axiell.cz/soubory/prirucky/p33_integrace_amcr.pdf)
