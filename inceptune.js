/* Inceptune — die fünf Zählungen über eine Stichprobe.
 *
 * Reine Logik, kein DOM, kein Netz. Läuft im Browser als klassisches Skript
 * (hängt sich an `window.Inceptune`) und in Node über `require` — deshalb der
 * Doppelexport am Ende. Kein ES-Modul, weil ein Modul über `file://` nicht
 * lädt und die Seite ohne Server auskommen soll.
 *
 * Grundregel aus dem Mutterprojekt, hier wörtlich übernommen:
 * geraten wird nicht. Was nicht bestimmt ist, heißt `undetermined` und trägt
 * keine Ziffer. Eine Spaltenrolle, die die Datei nicht deklariert, wird dem
 * Nutzer VORGELEGT, nie unterstellt.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- Belegart
  // Jede ausgegebene Zahl trägt, wie sie entstanden ist. `undetermined` ist
  // ziffernfrei — sonst wäre die Erfindung nur umbenannt.
  const COUNTED = 'counted';         // abgezählt
  const RATIO = 'ratio';             // Quotient aus zwei Zählungen
  const USER = 'user_supplied';      // vom Nutzer eingetippt
  const UNDETERMINED = 'undetermined';

  function counted(value, of) { return { kind: COUNTED, value: value, of: of }; }
  function ratio(num, den) {
    if (!den) return undetermined('no denominator');
    return { kind: RATIO, value: num / den, num: num, den: den };
  }
  function userSupplied(value) { return { kind: USER, value: value }; }
  function undetermined(reason) { return { kind: UNDETERMINED, reason: reason }; }

  // ------------------------------------------------------------- CSV-Zerleger
  // Trennzeichen wird aus der ersten Zeile außerhalb von Anführungszeichen
  // gezählt, nicht erraten: wer gewinnt, gewinnt an Häufigkeit.
  function detectDelimiter(text) {
    const cands = [',', ';', '\t', '|'];
    let line = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') inQuotes = !inQuotes;
      if (!inQuotes && (c === '\n' || c === '\r')) break;
      line += c;
    }
    let best = ',';
    let bestN = -1;
    for (const d of cands) {
      let n = 0;
      let q = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') q = !q;
        else if (!q && line[i] === d) n++;
      }
      if (n > bestN) { bestN = n; best = d; }
    }
    return bestN > 0 ? best : ',';
  }

  // Vollständiger Zustandsautomat: Anführungszeichen, doppelte
  // Anführungszeichen als Escape, Trennzeichen und Zeilenumbruch im Feld, CRLF.
  function parseDelimited(text, delimiter) {
    const d = delimiter || detectDelimiter(text);
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    const n = text.length;

    function endField() { row.push(field); field = ''; }
    function endRow() { endField(); rows.push(row); row = []; }

    while (i < n) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { inQuotes = true; i++; continue; }
      if (c === d) { endField(); i++; continue; }
      if (c === '\r') { if (text[i + 1] === '\n') i++; endRow(); i++; continue; }
      if (c === '\n') { endRow(); i++; continue; }
      field += c; i++;
    }
    // Letzte Zeile nur dann, wenn sie wirklich Inhalt hat — eine
    // Schlusszeilenschaltung soll keine Geisterzeile erzeugen.
    if (field !== '' || row.length > 0) endRow();

    // Vollständig leere Zeilen fallen weg (eine Leerzeile ist keine Beobachtung).
    const kept = rows.filter(r => r.some(v => String(v).trim() !== ''));
    if (kept.length === 0) return { columns: [], rows: [], delimiter: d };

    const columns = kept[0].map((h, k) => {
      const name = String(h).trim();
      return name === '' ? '(column ' + (k + 1) + ')' : name;
    });
    const body = kept.slice(1).map(r => {
      const out = new Array(columns.length);
      for (let k = 0; k < columns.length; k++) out[k] = k < r.length ? r[k] : '';
      return out;
    });
    return { columns: columns, rows: body, delimiter: d };
  }

  // ------------------------------------------------------------ JSON-Zerleger
  // Nimmt das Array, das üblichste Umschlagfeld oder NDJSON. Spalten sind die
  // Vereinigung der Schlüssel in der Reihenfolge ihres ersten Auftretens —
  // nicht alphabetisch, weil die Reihenfolge des Anbieters eine Aussage ist.
  function parseJsonRecords(text) {
    let data = null;
    const trimmed = text.trim();
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      const lines = trimmed.split(/\r?\n/).filter(l => l.trim() !== '');
      const recs = [];
      for (const l of lines) {
        try { recs.push(JSON.parse(l)); } catch (e2) { return null; }
      }
      data = recs;
    }
    let arr = null;
    if (Array.isArray(data)) arr = data;
    else if (data && typeof data === 'object') {
      for (const key of ['data', 'results', 'items', 'records', 'rows', 'notices', 'value']) {
        if (Array.isArray(data[key])) { arr = data[key]; break; }
      }
      if (!arr) {
        const lists = Object.keys(data).filter(k => Array.isArray(data[k]));
        if (lists.length === 1) arr = data[lists[0]];
      }
    }
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const columns = [];
    const seen = Object.create(null);
    for (const rec of arr) {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec)) continue;
      for (const k of Object.keys(rec)) {
        if (!seen[k]) { seen[k] = true; columns.push(k); }
      }
    }
    if (columns.length === 0) return null;

    const rows = arr.map(rec => columns.map(c => {
      if (!rec || typeof rec !== 'object') return '';
      const v = rec[c];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }));
    return { columns: columns, rows: rows, delimiter: null };
  }

  function parseFile(text) {
    const asJson = parseJsonRecords(text);
    if (asJson) return Object.assign(asJson, { format: 'json' });
    const asCsv = parseDelimited(text);
    return Object.assign(asCsv, { format: 'delimited' });
  }

  // ------------------------------------------------------------------- Zahlen
  // Zwei Schreibweisen, und welche gilt, sagt der Nutzer. Raten hieße hier,
  // „1.400" als 1,4 zu lesen oder als 1400 — beides ist eine Behauptung.
  function parseNumber(raw, style) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (s === '') return null;
    s = s.replace(/[\s  ]/g, '');
    // Währungszeichen und Prozent am Rand abtrennen, nicht in der Mitte.
    s = s.replace(/^[€$£¥]/, '').replace(/[€$£¥%]$/, '');
    if (style === 'de') s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  // ------------------------------------------------------------------- Datums
  const DATE_PATTERNS = [
    { re: /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/, y: 1, m: 2, d: 3 },
    { re: /^(\d{2})\.(\d{2})\.(\d{4})(?:[T\s].*)?$/, y: 3, m: 2, d: 1 },
    { re: /^(\d{2})\/(\d{2})\/(\d{4})(?:[T\s].*)?$/, y: 3, m: 1, d: 2 },
    { re: /^(\d{4})\/(\d{2})\/(\d{2})(?:[T\s].*)?$/, y: 1, m: 2, d: 3 }
  ];

  function parseDay(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    for (const p of DATE_PATTERNS) {
      const m = s.match(p.re);
      if (!m) continue;
      const y = Number(m[p.y]), mo = Number(m[p.m]), d = Number(m[p.d]);
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      const t = Date.UTC(y, mo - 1, d);
      if (!Number.isFinite(t)) continue;
      const back = new Date(t);
      if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) continue;
      return { iso: pad4(y) + '-' + pad2(mo) + '-' + pad2(d), t: t };
    }
    return null;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function pad4(n) { return String(n).padStart(4, '0'); }

  // ------------------------------------------------------- Zählung 1: Leerstand
  function blankCounts(table) {
    return table.columns.map((name, k) => {
      let blank = 0;
      for (const r of table.rows) {
        const v = r[k];
        if (v === null || v === undefined || String(v).trim() === '') blank++;
      }
      return {
        column: name,
        index: k,
        blank: counted(blank, table.rows.length),
        filled: counted(table.rows.length - blank, table.rows.length),
        share: ratio(blank, table.rows.length)
      };
    });
  }

  // --------------------------------------------- Zählung 2: Platzhalterzahlen
  // Vorgelegt, nicht entschieden: wir zeigen die kleinen Werte mit ihrer
  // Häufigkeit. Ob `0` in DIESER Spalte ein Wert ist, weiß nur der Nutzer.
  function lowValueCandidates(table, columnIndex, style, threshold) {
    const thr = threshold === undefined ? 1 : threshold;
    const tally = new Map();
    let numeric = 0;
    for (const r of table.rows) {
      const v = parseNumber(r[columnIndex], style);
      if (v === null) continue;
      numeric++;
      if (v <= thr) tally.set(v, (tally.get(v) || 0) + 1);
    }
    const values = Array.from(tally.entries())
      .map(([value, n]) => ({ value: value, count: counted(n, numeric) }))
      .sort((a, b) => a.value - b.value);
    let suspect = 0;
    for (const e of values) suspect += e.count.value;
    return {
      column: table.columns[columnIndex],
      threshold: userSupplied(thr),
      numeric: counted(numeric, table.rows.length),
      suspect: counted(suspect, numeric),
      share: ratio(suspect, numeric),
      values: values
    };
  }

  function numericColumnCandidates(table, style) {
    return table.columns.map((name, k) => {
      let numeric = 0, filled = 0;
      for (const r of table.rows) {
        const raw = r[k];
        if (raw === null || raw === undefined || String(raw).trim() === '') continue;
        filled++;
        if (parseNumber(raw, style) !== null) numeric++;
      }
      return { column: name, index: k, numeric: numeric, filled: filled,
               rate: filled ? numeric / filled : 0 };
    }).filter(c => c.filled > 0 && c.rate >= 0.9).sort((a, b) => b.numeric - a.numeric);
  }

  // ------------------------------------------------- Zählung 3: Zeitraum
  function timeSpan(table, columnIndex) {
    const days = new Set();
    let parsed = 0, filled = 0, min = null, max = null;
    for (const r of table.rows) {
      const raw = r[columnIndex];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;
      filled++;
      const d = parseDay(raw);
      if (!d) continue;
      parsed++;
      days.add(d.iso);
      if (min === null || d.t < min.t) min = d;
      if (max === null || d.t > max.t) max = d;
    }
    if (parsed === 0) {
      return { column: table.columns[columnIndex],
               span: undetermined('no parsable date in this column') };
    }
    const spanDays = Math.round((max.t - min.t) / 86400000) + 1;
    return {
      column: table.columns[columnIndex],
      parsed: counted(parsed, filled),
      first: min.iso,
      last: max.iso,
      calendarDaysSpanned: counted(spanDays, null),
      distinctDays: counted(days.size, spanDays),
      density: ratio(days.size, spanDays)
    };
  }

  function dateColumnCandidates(table) {
    return table.columns.map((name, k) => {
      let parsed = 0, filled = 0;
      for (const r of table.rows) {
        const raw = r[k];
        if (raw === null || raw === undefined || String(raw).trim() === '') continue;
        filled++;
        if (parseDay(raw)) parsed++;
      }
      return { column: name, index: k, parsed: parsed, filled: filled,
               rate: filled ? parsed / filled : 0 };
    }).filter(c => c.filled > 0 && c.rate >= 0.8).sort((a, b) => b.rate - a.rate);
  }

  // ----------------------------------------------- Zählung 4: Dominanz
  function dominance(table, columnIndex, topN) {
    const tally = new Map();
    let filled = 0;
    for (const r of table.rows) {
      const raw = r[columnIndex];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;
      const key = String(raw).trim();
      filled++;
      tally.set(key, (tally.get(key) || 0) + 1);
    }
    if (filled === 0) {
      return { column: table.columns[columnIndex],
               top: undetermined('column is empty on every row') };
    }
    const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const top = sorted.slice(0, topN || 5).map(([value, n]) => ({
      value: value, count: counted(n, filled), share: ratio(n, filled)
    }));
    return {
      column: table.columns[columnIndex],
      filled: counted(filled, table.rows.length),
      distinct: counted(sorted.length, filled),
      top: top,
      topShare: ratio(sorted[0][1], filled)
    };
  }

  function entityColumnCandidates(table) {
    return table.columns.map((name, k) => {
      const set = new Set();
      let filled = 0;
      for (const r of table.rows) {
        const raw = r[k];
        if (raw === null || raw === undefined || String(raw).trim() === '') continue;
        filled++;
        set.add(String(raw).trim());
      }
      return { column: name, index: k, distinct: set.size, filled: filled };
    }).filter(c =>
      // Mehr als ein Wert (sonst ist nichts zu dominieren) und höchstens die
      // Hälfte der gefüllten Zeilen verschieden. Eine nahezu eindeutige Spalte
      // ist ein Schlüssel, keine Entität — als Vorschlag wäre sie Rauschen.
      // Wählbar bleibt sie trotzdem: die Auswahlliste führt ALLE Spalten,
      // dies hier rangiert nur die Vorschläge.
      c.filled > 0 && c.distinct > 1 && c.distinct <= c.filled / 2
    ).sort((a, b) => a.distinct - b.distinct);
  }

  // --------------------------------- Zählung 5: byteidentische Nachdrucke
  // ponytail: Gleichheit, kein Hash. Byteidentisch ist eine Gleichheitsfrage;
  // SHA-256 wäre dieselbe Antwort langsamer und über `crypto.subtle` auch noch
  // asynchron und auf `file://` unzuverlässig. Der kurze FNV-Abdruck dient nur
  // der Anzeige, nie dem Vergleich.
  function fingerprint(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function duplicateRows(table) {
    const groups = new Map();
    table.rows.forEach((r, i) => {
      const key = r.join('\u0000');
      let g = groups.get(key);
      if (!g) { g = { rows: [], key: key }; groups.set(key, g); }
      g.rows.push(i);
    });
    const dupes = Array.from(groups.values()).filter(g => g.rows.length > 1)
      .sort((a, b) => b.rows.length - a.rows.length);
    let redundant = 0;
    for (const g of dupes) redundant += g.rows.length - 1;
    return {
      rows: counted(table.rows.length, null),
      independent: counted(groups.size, table.rows.length),
      redundant: counted(redundant, table.rows.length),
      share: ratio(redundant, table.rows.length),
      groups: dupes.slice(0, 10).map(g => ({
        fingerprint: fingerprint(g.key),
        copies: counted(g.rows.length, null),
        firstRows: g.rows.slice(0, 5).map(i => i + 2) // +2: Kopfzeile und 1-basiert
      }))
    };
  }

  // ------------------------------------------- Abdeckung gegen die Anbieterzahl
  function coverage(table, claimedTotal) {
    if (claimedTotal === null || claimedTotal === undefined || claimedTotal === '') {
      return { claimed: undetermined('no provider total entered') };
    }
    const n = Number(claimedTotal);
    if (!Number.isFinite(n) || n <= 0) {
      return { claimed: undetermined('provider total is not a positive number') };
    }
    return {
      claimed: userSupplied(n),
      held: counted(table.rows.length, n),
      share: ratio(table.rows.length, n),
      missing: counted(Math.max(0, n - table.rows.length), n)
    };
  }

  // ------------------------------------------------------------------ Fassade
  function analyse(table, options) {
    const o = options || {};
    const style = o.numberStyle === 'de' ? 'de' : 'en';
    const out = {
      format: table.format,
      delimiter: table.delimiter,
      numberStyle: userSupplied(style),
      columns: counted(table.columns.length, null),
      rows: counted(table.rows.length, null),
      blanks: blankCounts(table),
      duplicates: duplicateRows(table),
      coverage: coverage(table, o.claimedTotal),
      candidates: {
        date: dateColumnCandidates(table),
        entity: entityColumnCandidates(table),
        numeric: numericColumnCandidates(table, style)
      }
    };
    out.placeholders = (o.numericColumn === undefined || o.numericColumn === null)
      ? { value: undetermined('no numeric column confirmed') }
      : lowValueCandidates(table, o.numericColumn, style, o.threshold);
    out.timeSpan = (o.dateColumn === undefined || o.dateColumn === null)
      ? { value: undetermined('no date column confirmed') }
      : timeSpan(table, o.dateColumn);
    out.dominance = (o.entityColumn === undefined || o.entityColumn === null)
      ? { value: undetermined('no entity column confirmed') }
      : dominance(table, o.entityColumn, o.topN);
    return out;
  }

  const API = {
    COUNTED: COUNTED, RATIO: RATIO, USER: USER, UNDETERMINED: UNDETERMINED,
    detectDelimiter: detectDelimiter,
    parseDelimited: parseDelimited,
    parseJsonRecords: parseJsonRecords,
    parseFile: parseFile,
    parseNumber: parseNumber,
    parseDay: parseDay,
    blankCounts: blankCounts,
    lowValueCandidates: lowValueCandidates,
    timeSpan: timeSpan,
    dominance: dominance,
    duplicateRows: duplicateRows,
    coverage: coverage,
    fingerprint: fingerprint,
    dateColumnCandidates: dateColumnCandidates,
    entityColumnCandidates: entityColumnCandidates,
    numericColumnCandidates: numericColumnCandidates,
    analyse: analyse
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.Inceptune = API;
})();
