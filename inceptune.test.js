/* Prüfung der fünf Zählungen. Läuft mit `node inceptune.test.js`.
 * Kein Framework, keine Fixtures auf der Platte — die Fälle stehen hier, damit
 * sichtbar ist, worauf sich die Behauptungen der Seite stützen.
 */
const assert = require('assert');
const I = require('./inceptune.js');

let n = 0;
function t(name, fn) { n++; try { fn(); } catch (e) { console.error('FEHLER: ' + name + '\n  ' + e.message); process.exitCode = 1; } }

// ---------------------------------------------------------------- Zerlegung
t('CSV: Anführungszeichen, eingebettetes Trennzeichen und Zeilenumbruch', () => {
  const csv = 'id,buyer,note\n1,"Stadt A, Amt 3","Zeile 1\nZeile 2"\n2,"Er sagte ""nein""",ok\n';
  const tb = I.parseDelimited(csv);
  assert.deepStrictEqual(tb.columns, ['id', 'buyer', 'note']);
  assert.strictEqual(tb.rows.length, 2);
  assert.strictEqual(tb.rows[0][1], 'Stadt A, Amt 3');
  assert.strictEqual(tb.rows[0][2], 'Zeile 1\nZeile 2');
  assert.strictEqual(tb.rows[1][1], 'Er sagte "nein"');
});

t('CSV: Trennzeichen wird gezählt, nicht geraten (Semikolon gewinnt)', () => {
  assert.strictEqual(I.detectDelimiter('a;b;c\n1;2;3'), ';');
  assert.strictEqual(I.detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.strictEqual(I.detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  // Kommas INNERHALB von Anführungszeichen dürfen nicht mitzählen
  assert.strictEqual(I.detectDelimiter('"a,b,c,d";"x";"y"\n1;2;3'), ';');
});

t('CSV: CRLF und Schlusszeilenschaltung erzeugen keine Geisterzeile', () => {
  const tb = I.parseDelimited('a,b\r\n1,2\r\n3,4\r\n');
  assert.strictEqual(tb.rows.length, 2);
});

t('CSV: fehlende Spalten am Zeilenende werden zu Leerwerten, nicht zu undefined', () => {
  const tb = I.parseDelimited('a,b,c\n1\n2,3,4');
  assert.strictEqual(tb.rows[0][2], '');
  assert.strictEqual(tb.rows.length, 2);
});

t('JSON: Array, Umschlagfeld und NDJSON, Spaltenreihenfolge nach erstem Auftreten', () => {
  const a = I.parseJsonRecords('[{"b":1,"a":2},{"c":3}]');
  assert.deepStrictEqual(a.columns, ['b', 'a', 'c']);
  assert.strictEqual(a.rows.length, 2);
  assert.strictEqual(a.rows[1][0], '');
  const w = I.parseJsonRecords('{"total":9,"data":[{"x":1}]}');
  assert.deepStrictEqual(w.columns, ['x']);
  const nd = I.parseJsonRecords('{"x":1}\n{"x":2}\n');
  assert.strictEqual(nd.rows.length, 2);
  assert.strictEqual(I.parseJsonRecords('kein json'), null);
});

// ------------------------------------------------------------------- Zahlen
t('Zahlen: beide Schreibweisen, und keine wird geraten', () => {
  assert.strictEqual(I.parseNumber('1.000,50', 'de'), 1000.5);
  assert.strictEqual(I.parseNumber('1,000.50', 'en'), 1000.5);
  assert.strictEqual(I.parseNumber('-1', 'en'), -1);
  assert.strictEqual(I.parseNumber('0,01', 'de'), 0.01);
  assert.strictEqual(I.parseNumber('676582091', 'en'), 676582091);
  assert.strictEqual(I.parseNumber('1 234,5', 'de'), 1234.5);
  assert.strictEqual(I.parseNumber('12 €', 'en'), 12);
  assert.strictEqual(I.parseNumber('', 'en'), null);
  assert.strictEqual(I.parseNumber('n/a', 'en'), null);
  assert.strictEqual(I.parseNumber('12-14', 'en'), null);
  // Dieselbe Zeichenkette, zwei Lesarten — deshalb entscheidet der Nutzer
  assert.strictEqual(I.parseNumber('1.400', 'de'), 1400);
  assert.strictEqual(I.parseNumber('1.400', 'en'), 1.4);
});

// ------------------------------------------------------------------- Datums
t('Datum: vier Schreibweisen, Unmögliches wird abgelehnt', () => {
  assert.strictEqual(I.parseDay('2026-10-16').iso, '2026-10-16');
  assert.strictEqual(I.parseDay('16.10.2026').iso, '2026-10-16');
  assert.strictEqual(I.parseDay('10/16/2026').iso, '2026-10-16');
  assert.strictEqual(I.parseDay('2026-10-16T08:00:00Z').iso, '2026-10-16');
  assert.strictEqual(I.parseDay('2026-02-30'), null);
  assert.strictEqual(I.parseDay('nicht belegt'), null);
});

// ------------------------------------------------- Die fünf Zählungen
const TED = I.parseDelimited([
  'notice,buyer,value,deadline',
  '715121,AOK Rheinland-Pfalz/Saarland,639350,2026-10-16',
  '715122,AOK Rheinland-Pfalz/Saarland,1,2026-10-16',
  '715123,AOK Rheinland-Pfalz/Saarland,0,2026-10-16',
  '718545,Stadt Walsrode,-1,',
  '718546,DB InfraGO,676582091,2026-10-15',
  '718547,DB InfraGO,676582091,2026-10-15',   // unterscheidet sich NUR in der Id
  '718546,DB InfraGO,676582091,2026-10-15'    // byteidentisch zu Zeile 6
].join('\n'));

t('Zählung 1: Leerstand ist eine Zählung, kein Mittelwert', () => {
  const b = I.blankCounts(TED);
  const dl = b.find(x => x.column === 'deadline');
  assert.strictEqual(dl.blank.value, 1);
  assert.strictEqual(dl.blank.kind, I.COUNTED);
  assert.strictEqual(dl.filled.value, 6);
  assert.strictEqual(dl.share.kind, I.RATIO);
  assert.ok(Math.abs(dl.share.value - 1 / 7) < 1e-9);
});

t('Zählung 2: kleine Werte werden vorgelegt, nicht verworfen', () => {
  const p = I.lowValueCandidates(TED, 2, 'en', 1);
  assert.strictEqual(p.numeric.value, 7);
  assert.strictEqual(p.suspect.value, 3);                 // 1, 0, -1
  assert.deepStrictEqual(p.values.map(v => v.value), [-1, 0, 1]);
  assert.strictEqual(p.threshold.kind, I.USER);           // die Schwelle ist eine Nutzerangabe
  // Eine andere Schwelle ist eine andere Aussage — und erlaubt
  assert.strictEqual(I.lowValueCandidates(TED, 2, 'en', 0).suspect.value, 2);
});

t('Zählung 3: der Zeitraum, der wirklich umspannt wird', () => {
  const s = I.timeSpan(TED, 3);
  assert.strictEqual(s.first, '2026-10-15');
  assert.strictEqual(s.last, '2026-10-16');
  assert.strictEqual(s.calendarDaysSpanned.value, 2);     // der Befund von TED
  assert.strictEqual(s.distinctDays.value, 2);
  assert.strictEqual(s.parsed.value, 6);
});

t('Zählung 4: Dominanz einer einzelnen Entität', () => {
  const d = I.dominance(TED, 1);
  assert.strictEqual(d.top[0].value, 'AOK Rheinland-Pfalz/Saarland');
  assert.strictEqual(d.top[0].count.value, 3);
  assert.strictEqual(d.distinct.value, 3);
  assert.ok(Math.abs(d.topShare.value - 3 / 7) < 1e-9);
});

t('Zählung 5: Zeilen gegen unabhängige Beobachtungen', () => {
  const dup = I.duplicateRows(TED);
  assert.strictEqual(dup.rows.value, 7);
  assert.strictEqual(dup.independent.value, 6);           // genau ein Paar ist byteidentisch
  assert.strictEqual(dup.redundant.value, 1);
  assert.strictEqual(dup.groups.length, 1);
  assert.strictEqual(dup.groups[0].copies.value, 2);
  assert.deepStrictEqual(dup.groups[0].firstRows, [6, 8]); // 1-basiert, mit Kopfzeile
});

t('Zählung 5: die Grenze der Zählung wird mitgeprüft, nicht verschwiegen', () => {
  // Zeile 6 und 7 sind inhaltlich derselbe Auftrag und unterscheiden sich NUR
  // in der Bekanntmachungsnummer. Sie werden NICHT entdoppelt — „exact
  // duplicates only". Genau deshalb feuert die Zählung auf echten Anbieterdaten
  // fast nie: jeder Anbieter hängt eine Id oder einen Zeitstempel an.
  const dup = I.duplicateRows(TED);
  assert.strictEqual(dup.groups.length, 1, 'nur das wirklich identische Paar');
  const flagged = new Set(dup.groups.flatMap(g => g.firstRows));
  assert.ok(!flagged.has(7), 'die id-verschiedene Zeile darf nicht als Nachdruck gelten');
});

t('Abdeckung: gegen die Zahl, die der Anbieter behauptet', () => {
  const c = I.coverage(TED, 609);
  assert.strictEqual(c.claimed.kind, I.USER);
  assert.strictEqual(c.held.value, 7);
  assert.strictEqual(c.missing.value, 602);
  assert.ok(Math.abs(c.share.value - 7 / 609) < 1e-9);
  assert.strictEqual(I.coverage(TED, '').claimed.kind, I.UNDETERMINED);
  assert.strictEqual(I.coverage(TED, '-5').claimed.kind, I.UNDETERMINED);
});

// ---------------------------------------- Die Regel, die alles zusammenhält
t('Ohne bestätigte Spaltenrolle bleibt der Befund ziffernfrei unbestimmt', () => {
  const a = I.analyse(TED, {});                            // nichts bestätigt
  for (const key of ['placeholders', 'timeSpan', 'dominance']) {
    assert.strictEqual(a[key].value.kind, I.UNDETERMINED, key + ' müsste unbestimmt sein');
    assert.ok(!/\d/.test(a[key].value.reason),
      key + ': die Begründung trägt eine Ziffer — dann ist die Erfindung nur umbenannt');
  }
  // Zählung 1 und 5 brauchen keine Rolle und liefern trotzdem
  assert.strictEqual(a.blanks.length, 4);
  assert.strictEqual(a.duplicates.independent.value, 6);
});

t('Nach Bestätigung liefern alle fünf', () => {
  const a = I.analyse(TED, { numericColumn: 2, dateColumn: 3, entityColumn: 1, claimedTotal: 609, numberStyle: 'en' });
  assert.strictEqual(a.placeholders.suspect.value, 3);
  assert.strictEqual(a.timeSpan.calendarDaysSpanned.value, 2);
  assert.strictEqual(a.dominance.top[0].count.value, 3);
  assert.strictEqual(a.duplicates.redundant.value, 1);
  assert.strictEqual(a.coverage.held.value, 7);
});

t('Kandidaten werden angeboten, nicht angewandt', () => {
  const a = I.analyse(TED, {});
  assert.ok(a.candidates.date.some(c => c.column === 'deadline'));
  assert.ok(a.candidates.entity.some(c => c.column === 'buyer'));
  assert.ok(a.candidates.numeric.some(c => c.column === 'value'));
  // „notice" ist zwar numerisch, aber als Entität untauglich (alle verschieden)
  assert.ok(!a.candidates.entity.some(c => c.column === 'notice'));
});

t('Leere und einspaltige Eingaben stürzen nicht ab', () => {
  const e = I.parseDelimited('');
  assert.strictEqual(e.rows.length, 0);
  const a = I.analyse(e, { claimedTotal: 10 });
  assert.strictEqual(a.rows.value, 0);
  assert.strictEqual(a.duplicates.independent.value, 0);
  const one = I.parseDelimited('only\nx\ny');
  assert.strictEqual(I.analyse(one, { entityColumn: 0 }).dominance.distinct.value, 2);
});


t('Eine nahezu eindeutige Spalte wird nicht als Entität vorgeschlagen', () => {
  // 6 von 7 verschieden: das ist ein Schlüssel. Als Vorschlag wäre er Rauschen
  // und würde den echten Kandidaten nach unten drücken.
  const cand = I.entityColumnCandidates(TED).map(c => c.column);
  assert.ok(!cand.includes('notice'), 'notice ist ein Schluessel, kein Vorschlag');
  assert.ok(cand.includes('buyer'), 'buyer muss vorgeschlagen werden');
  // `deadline` kommt mit und steht sogar vorn (2 verschiedene gegen 3) — das ist
  // richtig: „13 von 25 Zeilen sind ein Kalendertag" ist ein echter
  // Dominanzbefund. Die Rangfolge ist „wenigst-verschieden zuerst", nicht
  // „Textspalte zuerst"; welche Spalte gemeint ist, entscheidet der Nutzer.
  assert.ok(cand.indexOf('buyer') >= 0 && cand.indexOf('buyer') <= 1);
  // Die Dominanz lässt sich trotzdem auf jeder Spalte rechnen, wenn der
  // Nutzer sie ausdrücklich wählt — Vorschlag und Erlaubnis sind zwei Dinge.
  assert.strictEqual(I.dominance(TED, 0).distinct.value, 6);
});

console.log(n + ' Prüfungen gelaufen' + (process.exitCode ? ' — mit Fehlern' : ' — alle grün'));
