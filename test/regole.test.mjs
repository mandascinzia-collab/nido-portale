// Collaudo delle regole pure (nessun server): node test/regole.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const R = createRequire(import.meta.url)("../pocketbase/pb_hooks/nido_regole.js");
const C = R.CFG_DEFAULT;
let n = 0; const ok = (t) => { n++; console.log("  ✓", t); };

console.log("Regole pure");
// 16/11/2026 è un lunedì
assert.equal(R.dow("2026-11-16"), 1); assert.equal(R.dow("2026-11-21"), 6); assert.equal(R.dow("2026-11-22"), 0); ok("giorni della settimana");
assert.equal(R.lunedi("2026-11-21"), "2026-11-16"); assert.equal(R.lunedi("2026-11-22"), "2026-11-16"); assert.equal(R.lunedi("2026-11-16"), "2026-11-16"); ok("settimana lunedì–sabato");
assert.equal(R.aggiungi("2026-12-31", 1), "2027-01-01"); assert.equal(R.diff("2026-11-16", "2026-12-16"), 30); ok("calcolo date");
const oggi = "2026-11-16";
assert.equal(R.fase(oggi, "2026-11-15", C), "passata");
assert.equal(R.fase(oggi, "2026-11-16", C), "oggi");
assert.equal(R.fase(oggi, "2026-11-17", C), "fase2");
assert.equal(R.fase(oggi, "2026-11-23", C), "fase2");  // 7 giorni prima: limiti sbloccati
assert.equal(R.fase(oggi, "2026-11-24", C), "fase1");  // 8 giorni prima: ancora con i limiti
assert.equal(R.fase(oggi, "2026-12-16", C), "fase1");  // 30 giorni di calendario
assert.equal(R.fase(oggi, "2026-12-17", C), "presto"); ok("fasi 30 / 7 giorni");
assert.equal(R.apreIl("2026-12-17", C), "2026-11-17"); ok("data di apertura");

// settimana: max 3 lun–ven, il sabato è in più
let imp = ["2026-12-01", "2026-12-02", "2026-12-03"];
assert.equal(R.limite(imp, "2026-12-04", C), "settimana");
assert.equal(R.limite(imp, "2026-12-05", C), null);        // sabato: non conta nel tetto settimanale
assert.equal(R.limite(imp, "2026-12-08", C), null);        // settimana dopo
ok("max 3 giornate a settimana, più il sabato");
// sabati consecutivi
imp = ["2026-11-21", "2026-11-28", "2026-12-05"];
assert.equal(R.limite(imp, "2026-12-12", C), "sabati");
assert.equal(R.limite(imp, "2026-12-19", C), null);        // il 12/12 non è prenotato: la serie si interrompe
ok("max 3 sabati consecutivi (caso base)");
assert.equal(R.limite(["2026-11-21", "2026-11-28"], "2026-12-05", C), null);
assert.equal(R.limite(["2026-11-21", "2026-12-05"], "2026-11-28", C), null);   // colmare il buco: 3 di fila, ok
assert.equal(R.limite(["2026-11-21", "2026-11-28", "2026-12-12"], "2026-12-05", C), "sabati"); // 4 di fila
ok("max 3 sabati consecutivi (buchi e serie)");
// mese solare: 8, sabati compresi
imp = ["2026-12-01", "2026-12-02", "2026-12-05", "2026-12-07", "2026-12-08", "2026-12-09", "2026-12-14", "2026-12-15"];
assert.equal(R.limite(imp, "2026-12-16", C), "mese");
assert.equal(R.limite(imp, "2026-11-30", C), null);                            // altro mese
ok("max 8 giornate al mese solare");
// annullamento a 48 ore: lunedì 16/11 ore 10:00
const ora = 10 * 60;
assert.equal(R.eliminabile(oggi, ora, "2026-11-17", C), false); // 30,5 ore
assert.equal(R.eliminabile(oggi, ora, "2026-11-18", C), true);  // 54,5 ore
assert.equal(R.eliminabile(oggi, ora, "2026-11-21", C), true);  // sabato 8:30
assert.equal(R.eliminabile(oggi, 16 * 60 + 30, "2026-11-18", C), true);  // esattamente 48 ore
assert.equal(R.eliminabile(oggi, 16 * 60 + 31, "2026-11-18", C), false);
ok("eliminazione fino a 48 ore prima");
// precedenza lista d'attesa
const l = [{ mese: 3, quando: "a" }, { mese: 0, quando: "c" }, { mese: 0, quando: "b" }, { mese: 1, quando: "d" }].sort(R.precedenza);
assert.deepEqual(l.map((x) => x.quando), ["b", "c", "d", "a"]); ok("precedenza: meno giornate nel mese, poi chi è arrivato prima");
console.log(n + " verifiche superate");
