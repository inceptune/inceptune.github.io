# Inceptune

Counts the blanks, placeholders and duplicate rows in a data sample. Everything runs in the
visitor's browser; the file is never transmitted, because there is no server that could receive it.

Vendor: Septun OÜ (Estonia). Brand reserved as `github.com/inceptune`.

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
- ⟨Pflichtfeld⟩ Die vier Platzhalter `PFLICHTFELD@inceptune.com` durch eine echte Adresse ersetzen
  (zweimal im Tarifblock, zweimal im Fuß).
- ⟨Pflichtfeld⟩ Impressum: Registernummer, Anschrift und USt-IdNr. der Septun OÜ im Fuß.
- ⟨Pflichtfeld⟩ Datenschutzerklärung nach Art. 13 DSGVO und AGB mit Rechtezusicherung des Nutzers.
  Auch eine Seite ohne Verarbeitung braucht beides; eine Auftragsverarbeitung nach Art. 28 braucht
  sie nicht, weil nichts übertragen wird.
- Entscheiden, ob der fünfte Befund (byteidentische Nachdrucke) beworben wird. Gemessen am eigenen
  Bestand feuert er fast nie: 237 Dokumente, 234 distinkte Hashes, und die einzige Dublette war die
  eigene Mockvorlage. Die tragfähige Abgrenzung sind Zeitraum, Dominanz und Abdeckungsanteil.

## Was hier bewusst fehlt

Kein Build, kein npm, keine Abhängigkeit, kein Framework, kein Zustandsspeicher, kein Konto,
kein Teamtarif, keine API, keine Integration, keine Nah-Duplikat-Erkennung, keine
Entitätsauflösung, keine Vertrauenszahl. Alles davon steht in `docs/inceptune-start.md` mit
Begründung.
