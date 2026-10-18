# Inceptune

Counts the blanks, placeholders and duplicate rows in a data sample. Everything runs in the
visitor's browser; the file is never transmitted, because there is no server that could receive it.

Vendor: **Inceptune OÜ**, registry code 17300663, VAT EE102889378, Tartu mnt 67/1-13b,
10115 Tallinn, Estonia — board member Tobias Oberrauch, entered in the register 11.08.2025
(source: Estonian business register via inforegister.ee, read 2026-10-18).
Brand also reserved as `github.com/inceptune` (org created 18.08.2025).

**`inceptune.com` is registered** — 2026-10-18T08:22:06Z, expires 2027-10-18, registrar
Greenmark IT GmbH, nameservers `NS1.MAINNS.DE` / `NS2.MAINNS.EU` / `NS3.MAINNS.NET`.
DNS resolves (`inceptune.com` → 116.202.9.166, `www` → 116.202.21.136) but **nothing is served
yet and there is no certificate** (HTTPS → 000, measured 2026-10-18). Two of the communities in
the launch plan require a production site on an own domain, so this is the remaining blocker
before step 1.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole page: markup, styles, DOM wiring. No build step, no framework. |
| `inceptune.js` | The five counts as pure logic. No DOM, no network. Classic script, so it loads over `file://` and is still `require`-able in Node. |
| `inceptune.test.js` | 19 checks over the logic. `node inceptune.test.js` — no framework, no fixtures on disk. |

## Run it

```bash
node inceptune.test.js        # 19 Prüfungen, muss grün sein
open index.html               # läuft direkt über file://, kein Server nötig
```

## Deploy

Three static files. Cloudflare Pages, Netlify, GitHub Pages or any bucket — no runtime.
Cloudflare states "Requests to static assets are free and unlimited", which is why the free tier
costs 0.00 USD to serve.

Do **not** add an analytics script, a web font from a CDN or a cookie banner. The page promises in
its own footer that it makes no network request after it loads, and that promise is the product.
`grep -c 'https\?://' index.html` must stay at 1 — the GitHub link in the footer.

## Open before launch

- **Die drei Dateien ausliefern und TLS einrichten.** Ohne gültiges Zertifikat bounct das
  Publikum, und die eigene Zusage „nothing leaves this page" ist über reines HTTP nicht haltbar.
- **Postfach einrichten.** `hello@inceptune.com` steht an allen drei Stellen in der Seite, aber
  die Domain trägt heute einen Null-MX (`MX 0 .` nach RFC 7505) und weist damit jede Mail ab.
  Ohne MX des Postfachanbieters prallt jede Antwort auf die Startposts ab.
- ~~Datenschutzerklärung und AGB~~ — **erledigt**, `legal.html`. Die Annahme „eine Seite ohne
  Verarbeitung braucht sie trotzdem" war richtig, aber aus dem falschen Grund: es **gibt** eine
  Verarbeitung. GitHub schreibt in der eigenen Dokumentation, dass die IP jedes Besuchers
  protokolliert wird. Zwei Punkte stehen dort offen und sind als offen ausgewiesen, nicht
  glattgeschrieben: die Aufbewahrungsdauer (GitHub nennt keine) und die Einordnung von GitHub als
  Auftragsverarbeiter oder eigener Verantwortlicher.
- ⟨Pflichtfeld⟩ Haftungsbeschränkung in den AGB — bewusst **leer gelassen** statt erfunden. Solange
  sie nicht geprüft ist, gilt schlicht das Gesetz, und der Absatz sagt das auch so.
- Entscheiden, ob der fünfte Befund (byteidentische Nachdrucke) beworben wird. Gemessen am eigenen
  Bestand feuert er fast nie: 237 Dokumente, 234 distinkte Hashes, und die einzige Dublette war die
  eigene Mockvorlage. Die tragfähige Abgrenzung sind Zeitraum, Dominanz und Abdeckungsanteil.

## Was hier bewusst fehlt

Kein Build, kein npm, keine Abhängigkeit, kein Framework, kein Zustandsspeicher, kein Konto,
kein Teamtarif, keine API, keine Integration, keine Nah-Duplikat-Erkennung, keine
Entitätsauflösung, keine Vertrauenszahl. Alles davon steht in `docs/inceptune-start.md` mit
Begründung.

## Lizenz

Urheberrecht vorbehalten, siehe `LICENSE`. Der Quelltext liegt offen, damit die
Aussage „kein Netzaufruf nach dem Laden" nachprüfbar ist — nicht als Freigabe zur
Weiterverwendung.

## Rechtsseite und die Pflichtangaben

`legal.html` trägt Impressum, Datenschutz und Nutzungsbedingungen auf einer Seite, mit den Ankern
`#imprint`, `#privacy`, `#terms`. Sie lädt selbst nichts nach — fünf externe Verweise, alle
Quellenangaben, null `<script>`, null `<img>`, null Fremd-Stylesheet.

Maßgeblich ist **§ 4 Abs. 1 des estnischen Infoühiskonna teenuse seadus** (Information Society
Services Act), selbst im Volltext gelesen am 18.10.2026 über Riigi Teataja. Er verlangt
„directly and permanently accessible":

| Ziffer | Verlangt | Steht in |
|---|---|---|
| 1 | Name, **Registrikood**, **Name des Registers**, Anschrift, Kontakt **inkl. E-Mail** | `legal.html#imprint` + Fuß beider Seiten |
| 2 | Registrierungs-/Lizenznummer, *soweit das Tätigkeitsfeld eine verlangt* | entfällt — Programmeerimine (62101) verlangt keine |
| 3 | bei Preisnennung: **ob Steuern und Lieferkosten enthalten sind** | Tarifabschnitt in `index.html` + `legal.html#terms` |
| 4 | **USt-Identifikationsnummer**, wenn steuerpflichtig | beide Seiten |

Zwei dieser Angaben fehlten im ersten Auslieferstand: der **Name des Registers** und die
**Steuerangabe am Preis**. Beide sind jetzt in CI festgenagelt (`Pflichtangaben des
Dienstanbieters vollständig`), damit sie nicht beim nächsten Umformulieren des Fußes
verschwinden. Das Tor hat die Steuerangabe beim ersten Lauf prompt als fehlend gemeldet — sie
stand nur am Preis, nicht in den Bedingungen.
