// Collaudo end-to-end del server. Richiede un PocketBase di PROVA con NIDO_FINTA_ORA="2026-11-16T10:00" (lunedì).
// Uso: test/run-local.sh   (avvia tutto da solo)
import assert from "node:assert/strict";
import net from "node:net";

const PB = process.env.PB || "http://127.0.0.1:8099";
let nOk = 0;
const ok = (t) => { nOk++; console.log("  ✓", t); };

// ---------- posta finta (SMTP minimale) ----------
const posta = [];
const smtp = net.createServer((s) => {
  let dati = "", inData = false, to = "";
  s.write("220 test\r\n");
  s.on("data", (b) => {
    dati += b.toString();
    let i;
    while ((i = dati.indexOf("\r\n")) >= 0) {
      const riga = dati.slice(0, i); dati = dati.slice(i + 2);
      if (inData) {
        if (riga === ".") { inData = false; posta.push({ to, testo: buf }); s.write("250 ok\r\n"); } else buf += riga + "\n";
        continue;
      }
      const u = riga.toUpperCase();
      if (u.startsWith("EHLO") || u.startsWith("HELO")) s.write("250-test\r\n250 8BITMIME\r\n");
      else if (u.startsWith("MAIL FROM")) s.write("250 ok\r\n");
      else if (u.startsWith("RCPT TO")) { to = riga.slice(riga.indexOf("<") + 1, riga.indexOf(">")); s.write("250 ok\r\n"); }
      else if (u === "DATA") { inData = true; buf = ""; s.write("354 go\r\n"); }
      else if (u === "QUIT") { s.write("221 bye\r\n"); s.end(); }
      else s.write("250 ok\r\n");
    }
  });
});
let buf = "";
await new Promise((r) => smtp.listen(2525, "127.0.0.1", r));
const decodifica = (t) => { // le email di PocketBase sono in quoted-printable UTF-8
  const x = t.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return Buffer.from(x, "latin1").toString("utf8");
};
const attendiPosta = async (n0, ms = 4000) => { const t = Date.now(); while (posta.length <= n0 && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 100)); return posta[posta.length - 1]; };

// ---------- utilità ----------
const api = async (m, p, b, token) => {
  const r = await fetch(PB + p, { method: m, headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) }, body: b ? JSON.stringify(b) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const login = async (email, password) => {
  const r = await api("POST", "/api/collections/users/auth-with-password", { identity: email, password });
  assert.equal(r.s, 200, "login " + email + " → " + r.s + " " + JSON.stringify(r.j));
  return r.j.token;
};
const PASS = "Password-lunga-123";
const registra = async (email, nome, cognome, figli) => api("POST", "/api/nido/registrazione", {
  email, password: PASS, nome, cognome, telefono: "333 1234567", consenso: true, figli });
const kid = (nome, cognome, nascita = "2024-03-10") => ({ nome, cognome, nascita });

// ---------- superuser: crea la Segreteria e attiva la posta finta ----------
const su = await api("POST", "/api/collections/_superusers/auth-with-password", { identity: "admin@test.it", password: "Passw0rd-test-123" });
assert.equal(su.s, 200); const SU = su.j.token;
let r = await api("POST", "/api/collections/users/records", { email: "segreteria@test.it", password: PASS, passwordConfirm: PASS, nome: "Seg", cognome: "Reteria", staff: true, stato: "approvato" }, SU);
assert.equal(r.s, 200, JSON.stringify(r.j));
r = await api("PATCH", "/api/settings", { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" }, meta: { senderAddress: "noreply@test.it", senderName: "Spazio gioco 0/6" } }, SU);
assert.equal(r.s, 200, JSON.stringify(r.j));
const STAFF = await login("segreteria@test.it", PASS);
// i collaudi sono molto più veloci di una persona: il limite alle richieste si prova a parte, alla fine
r = await api("PATCH", "/api/settings", { rateLimits: { enabled: false } }, SU); assert.equal(r.s, 200);

console.log("Registrazione");
r = await registra("corta@test.it", "A", "B", [kid("X", "Y")]); assert.equal(r.s, 200);
r = await api("POST", "/api/nido/registrazione", { email: "x@test.it", password: "corta", nome: "A", cognome: "B", telefono: "3331234567", consenso: true, figli: [kid("X", "Y")] });
assert.equal(r.s, 400); assert.match(r.j.errore, /10 caratteri/); ok("password troppo corta rifiutata");
r = await registra("corta@test.it", "A", "B", [kid("X", "Y")]); assert.equal(r.s, 400); assert.match(r.j.errore, /già un account/); ok("email già registrata rifiutata");
r = await api("POST", "/api/nido/registrazione", { email: "nc@test.it", password: PASS, nome: "A", cognome: "B", telefono: "3331234567", consenso: false, figli: [kid("X", "Y")] });
assert.equal(r.s, 400); ok("senza conferma dell'informativa non si registra");
r = await registra("fut@test.it", "A", "B", [kid("X", "Y", "2030-01-01")]); assert.equal(r.s, 400); ok("data di nascita futura rifiutata");
{
  const dd = (m) => { const d = new Date("2026-11-16T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - m); d.setUTCDate(d.getUTCDate() - 2); return d.toISOString().slice(0, 10); };
  r = await registra("grande@test.it", "A", "B", [kid("Enrico", "Y", "2004-05-10")]); assert.equal(r.s, 400); assert.match(r.j.errore, /7 anni o più/); assert.match(r.j.errore, /18 mesi ai 6 anni/); ok("iscrizione rifiutata dai 7 anni in su (messaggio chiaro)");
  r = await registra("sette@test.it", "A", "B", [kid("Gran", "Y", dd(85))]); assert.equal(r.s, 400); ok("7 anni e 1 mese rifiutato/a");
  r = await registra("neonato@test.it", "A", "B", [kid("Tommaso", "Y", dd(3))]); assert.equal(r.s, 200); assert.equal(r.j.avvisi.length, 1); assert.match(r.j.avvisi[0], /Tommaso non ha ancora 18 mesi e potrà frequentare il servizio a partire dal/); ok("sotto i 18 mesi: iscrizione consentita con avviso e data di inizio");
}

const famiglie = {};
for (const [k, nome, figli] of [["a", "Marta", [kid("Giulia", "Mura", "2024-05-01"), kid("Tommaso", "Mura", "2022-02-01")]], ["b", "Paolo", [kid("Sofia", "Cocco")]], ["c", "Elena", [kid("Leonardo", "Pinna")]]]) {
  r = await registra(k + "@test.it", nome, "Rossi", figli); assert.equal(r.s, 200, JSON.stringify(r.j));
}
ok("tre famiglie registrate");
const T = { a: await login("a@test.it", PASS), b: await login("b@test.it", PASS), c: await login("c@test.it", PASS) };
const me = {};
for (const k of ["a", "b", "c"]) me[k] = (await api("GET", "/api/nido/me", null, T[k])).j;
assert.equal(me.a.figli.length, 2); assert.equal(me.a.utente.stato, "in_attesa"); assert.equal(me.a.oggi, "2026-11-16");
ok("area personale: dati, figli/e e data di oggi");

console.log("Nessun accesso diretto ai dati");
for (const c of ["users", "figli", "prenotazioni", "giornate", "impostazioni"]) {
  const x = await api("GET", `/api/collections/${c}/records`, null, T.a);
  assert.ok(x.s === 403 || x.s === 404, `${c} lettura → ${x.s}`);
  const w = await api("POST", `/api/collections/${c}/records`, { nome: "x" }, T.a);
  assert.ok([400, 403, 404].includes(w.s), `${c} scrittura → ${w.s}`);
  const y = await api("GET", `/api/collections/${c}/records`);
  assert.ok(y.s === 403 || y.s === 404 || y.s === 401, `${c} anonimo → ${y.s}`);
}
r = await api("GET", "/api/nido/staff/riepilogo", null, T.a); assert.equal(r.s, 403); ok("le famiglie non entrano nella Segreteria");
r = await api("GET", "/api/nido/calendario"); assert.ok(r.s === 401 || r.s === 403); ok("senza accesso non si vede nulla");

const D = (mese, g) => `2026-${mese}-${g}`;
const prenota = (tok, richieste) => api("POST", "/api/nido/prenota", { richieste }, tok);
const esito = (res, data, figlio) => res.j.esiti.find((x) => x.data === data && x.figlio === figlio);

console.log("Approvazione della Segreteria");
r = await prenota(T.a, [{ data: D(12, "01"), figli: [me.a.figli[0].id] }]); assert.equal(r.s, 403); ok("account non approvato: non può prenotare");
r = await api("GET", "/api/nido/staff/riepilogo", null, STAFF); assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.kpi.daApprovare, 5);
const elenco = (await api("GET", "/api/nido/staff/famiglie", null, STAFF)).j.famiglie;
assert.equal(elenco.length, 5);
const n0 = posta.length;
for (const f of elenco) {
  if (f.email === "corta@test.it") { r = await api("POST", "/api/nido/staff/famiglia", { id: f.id, stato: "rifiutato" }, STAFF); continue; }
  r = await api("POST", "/api/nido/staff/famiglia", { id: f.id, stato: "approvato" }, STAFF); assert.equal(r.s, 200, JSON.stringify(r.j));
}
const m = await attendiPosta(n0); assert.ok(m, "email di account approvato");
ok("approvazione: email all'account approvato");

console.log("Calendario");
let cal = (await api("GET", "/api/nido/calendario", null, T.a)).j;
assert.equal(cal.approvato, true); assert.equal(cal.ultimoPrenotabile, "2026-12-16");
assert.equal(cal.giorni[0].data, "2026-11-16"); assert.equal(cal.giorni[0].fase, "oggi");
assert.ok(!cal.giorni.some((g) => g.data === "2026-11-22"), "la domenica non c'è");
const gg = (d) => cal.giorni.find((g) => g.data === d);
assert.equal(gg("2026-11-17").fase, "fase2"); assert.equal(gg("2026-11-23").fase, "fase2"); assert.equal(gg("2026-11-24").fase, "fase1");
assert.equal(gg("2026-12-16").fase, "fase1"); assert.equal(gg("2026-12-17").fase, "presto"); assert.equal(gg("2026-12-17").apreIl, "2026-11-17");
assert.equal(gg("2026-11-21").tipo, "sabato"); assert.equal(gg("2026-11-21").inizio, "08:30"); assert.equal(gg("2026-11-17").inizio, "16:30");
assert.equal(gg("2026-11-17").posti, 15); assert.equal(gg("2026-11-17").figli.length, 2);
ok("30 giorni di calendario, domeniche escluse, fasi e orari");

const [G, TOM] = me.a.figli.map((f) => f.id); // Giulia, Tommaso
const SOF = me.b.figli[0].id, LEO = me.c.figli[0].id;

console.log("Limiti per bambino/a (fase 1)");
r = await prenota(T.a, [D(11, 30), D(12, "01"), D(12, "02"), D(12, "03")].map((d) => ({ data: d, figli: [G] })));
assert.equal(r.s, 200);
assert.equal(esito(r, D(11, 30), G).esito, "prenotata"); assert.equal(esito(r, D(12, "02"), G).esito, "prenotata");
assert.deepEqual([esito(r, D(12, "03"), G).esito, esito(r, D(12, "03"), G).motivo], ["limite", "settimana"]); ok("4° giorno feriale nella stessa settimana: rifiutato (max 3 a settimana)");
r = await prenota(T.a, [{ data: D(12, "05"), figli: [G] }]); assert.equal(esito(r, D(12, "05"), G).esito, "prenotata"); ok("il sabato si aggiunge ai 3 giorni feriali");
r = await prenota(T.a, [{ data: D(12, "01"), figli: [G] }]); assert.equal(esito(r, D(12, "01"), G).esito, "gia"); ok("doppia prenotazione stessa data rifiutata");
r = await prenota(T.a, [D(12, "07"), D(12, "08"), D(12, "09"), D(12, 14), D(12, 15), D(12, 16)].map((d) => ({ data: d, figli: [G] })));
assert.equal(esito(r, D(12, 15), G).esito, "prenotata");
assert.deepEqual([esito(r, D(12, 16), G).esito, esito(r, D(12, 16), G).motivo], ["limite", "mese"]); ok("9ª giornata del mese solare: rifiutata (max 8 al mese)");
// il limite è per bambino/a, non per famiglia
r = await prenota(T.a, [{ data: D(12, "03"), figli: [TOM] }, { data: D(12, 16), figli: [TOM] }]);
assert.equal(esito(r, D(12, "03"), TOM).esito, "prenotata"); assert.equal(esito(r, D(12, 16), TOM).esito, "prenotata"); ok("i limiti sono separati per ciascun/a figlio/a");
// sabati consecutivi (il 21/11 è in fase 2 ma conta nella serie)
r = await prenota(T.b, [D(11, 21), D(11, 28), D(12, "05"), D(12, 12)].map((d) => ({ data: d, figli: [SOF] })));
assert.equal(esito(r, D(11, 21), SOF).esito, "prenotata"); assert.equal(esito(r, D(11, 28), SOF).esito, "prenotata"); assert.equal(esito(r, D(12, "05"), SOF).esito, "prenotata");
assert.deepEqual([esito(r, D(12, 12), SOF).esito, esito(r, D(12, 12), SOF).motivo], ["limite", "sabati"]); ok("4° sabato di fila: rifiutato (max 3 sabati consecutivi)");

console.log("Fase 2 (ultimi 7 giorni): limiti sbloccati");
r = await prenota(T.c, [17, 18, 19, 20].map((g) => ({ data: D(11, g), figli: [LEO] })));
for (const g of [17, 18, 19, 20]) assert.equal(esito(r, D(11, g), LEO).esito, "prenotata");
ok("4 giorni feriali nella stessa settimana in fase 2: consentiti");

console.log("Regole sulle date");
r = await prenota(T.c, [{ data: D(11, 16), figli: [G] }]); assert.equal(esito(r, D(11, 16), G).esito, "fuori"); ok("nello stesso giorno non si prenota");
r = await prenota(T.c, [{ data: D(11, 22), figli: [LEO] }]); assert.equal(esito(r, D(11, 22), LEO).esito, "domenica"); ok("la domenica non c'è servizio");
r = await prenota(T.c, [{ data: D(12, 17), figli: [LEO] }]); assert.equal(esito(r, D(12, 17), LEO).esito, "non_aperta"); ok("oltre i 30 giorni non ancora prenotabile");
r = await prenota(T.c, [{ data: D(11, 25), figli: [G] }]); assert.equal(esito(r, D(11, 25), G).esito, "fuori"); ok("non si prenota per i figli di un'altra famiglia");

console.log("Posti e lista d'attesa");
r = await api("POST", "/api/nido/staff/giornata", { data: D(11, 25), chiusa: false, posti: 2, nota: "" }, STAFF); assert.equal(r.s, 200);
r = await prenota(T.a, [{ data: D(11, 25), figli: [G, TOM] }]);
assert.equal(esito(r, D(11, 25), G).esito, "prenotata"); assert.equal(esito(r, D(11, 25), TOM).esito, "prenotata");
// Sofia (già 3 giornate a novembre: 21, 28, 18?) e Leonardo (4 a novembre): ordino chi ha meno giornate nel mese
// Sofia: 21/11, 28/11 = 2; Leonardo: 17, 18, 19, 20 = 4. Leonardo entra PER PRIMO in lista, Sofia per seconda.
r = await prenota(T.c, [{ data: D(11, 25), figli: [LEO] }]); assert.equal(esito(r, D(11, 25), LEO).esito, "attesa");
r = await prenota(T.b, [{ data: D(11, 25), figli: [SOF] }]); assert.equal(esito(r, D(11, 25), SOF).esito, "attesa"); ok("giornata piena: si va in lista d'attesa");
let g25 = (await api("GET", "/api/nido/staff/giornata?data=2026-11-25", null, STAFF)).j;
assert.equal(g25.iscritti.length, 2); assert.equal(g25.attesa.length, 2);
assert.equal(g25.attesa[0].figlio, "Sofia Cocco"); ok("lista d'attesa ordinata: prima chi ha frequentato meno nel mese");
cal = (await api("GET", "/api/nido/calendario", null, T.a)).j;
const pidG = gg("2026-11-25").figli.find((x) => x.id === G).pid;
const nm = posta.length;
r = await api("POST", "/api/nido/annulla", { id: pidG }, T.a); assert.equal(r.s, 200);
g25 = (await api("GET", "/api/nido/staff/giornata?data=2026-11-25", null, STAFF)).j;
assert.equal(g25.iscritti.length, 2); assert.equal(g25.attesa.length, 1);
assert.ok(g25.iscritti.some((x) => x.figlio === "Sofia Cocco"), "Sofia ha preso il posto"); assert.equal(g25.attesa[0].figlio, "Leonardo Pinna");
ok("posto liberato: assegnato in automatico a chi aveva la precedenza");
const mail = await attendiPosta(nm); assert.ok(mail, "email di posto assegnato"); assert.equal(mail.to, "b@test.it");
const testoMail = decodifica(mail.testo);
assert.match(testoMail, /martedì|mercoledì/); assert.match(testoMail, /25 novembre/); assert.ok(!/Sofia|Cocco|Giulia|Mura/.test(testoMail), "l'email non contiene nomi di bambini/e");
assert.match(testoMail, /portale\.test/); ok("email di posto assegnato: solo data e link, nessun nome di bambino/a");
// uscita dalla lista d'attesa
cal = (await api("GET", "/api/nido/calendario", null, T.c)).j;
const wait = gg("2026-11-25").figli.find((x) => x.id === LEO); assert.equal(wait.stato, "attesa");
r = await api("POST", "/api/nido/annulla", { id: wait.pid }, T.c); assert.equal(r.s, 200); ok("si può uscire dalla lista d'attesa");

console.log("Eliminazione a 48 ore");
cal = (await api("GET", "/api/nido/calendario", null, T.c)).j;
const p17 = gg("2026-11-17").figli.find((x) => x.id === LEO), p18 = gg("2026-11-18").figli.find((x) => x.id === LEO);
assert.equal(gg("2026-11-17").eliminabile, false); assert.equal(gg("2026-11-18").eliminabile, true);
r = await api("POST", "/api/nido/annulla", { id: p17.pid }, T.c); assert.equal(r.s, 409); assert.match(r.j.errore, /48 ore/); ok("17/11 ore 16:30 (30 ore): non eliminabile");
r = await api("POST", "/api/nido/annulla", { id: p18.pid }, T.c); assert.equal(r.s, 200); ok("18/11 ore 16:30 (54 ore): eliminabile");
r = await api("POST", "/api/nido/annulla", { id: gg("2026-11-19").figli.find((x) => x.id === LEO).pid }, T.a); assert.equal(r.s, 404); ok("non si elimina la prenotazione di un'altra famiglia");

console.log("Segreteria");
r = await api("GET", "/api/nido/staff/riepilogo", null, STAFF); assert.equal(r.s, 200);
assert.ok(r.j.kpi.figliDiversiMese >= 3); assert.equal(r.j.kpi.daApprovare, 0); assert.ok(r.j.giorni.length > 20); ok("riepilogo e indicatori");
g25 = (await api("GET", "/api/nido/staff/giornata?data=2026-11-19", null, STAFF)).j;
const riga = g25.iscritti[0]; assert.ok(riga.telefono && riga.genitore && riga.figlio);
r = await api("POST", "/api/nido/staff/presenza", { id: riga.id, presenza: "presente" }, STAFF); assert.equal(r.s, 200);
g25 = (await api("GET", "/api/nido/staff/giornata?data=2026-11-19", null, STAFF)).j; assert.equal(g25.iscritti[0].presenza, "presente"); ok("presenze segnate dalla Segreteria");
r = await api("GET", "/api/nido/staff/figli?q=pinn", null, STAFF); assert.equal(r.j.figli[0].nome, "Leonardo Pinna");
r = await api("POST", "/api/nido/staff/aggiungi", { data: D(12, 16), figlio: LEO }, STAFF); assert.equal(r.j.esito, "prenotata"); ok("inserimento a mano");
r = await api("POST", "/api/nido/staff/giornata", { data: D(11, 24), chiusa: true, posti: 0, nota: "Chiuso" }, STAFF);
r = await prenota(T.c, [{ data: D(11, 24), figli: [LEO] }]); assert.equal(esito(r, D(11, 24), LEO).esito, "chiusa"); ok("giornata chiusa dalla Segreteria: non prenotabile");
r = await api("GET", "/api/nido/staff/impostazioni", null, STAFF); assert.equal(r.j.posti, 15);

console.log("Chiusure programmate");
r = await api("POST", "/api/nido/staff/chiusure", { da: "2027-01-04", a: "2027-01-10", nota: "Vacanze di Natale" }, STAFF);
assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.chiuse, 6, "7 giorni meno la domenica"); ok("chiusura di un periodo molto in anticipo (domeniche saltate)");
r = await api("GET", "/api/nido/staff/chiusure", null, STAFF);
assert.ok(r.j.chiusure.some((c) => c.data === "2027-01-06" && c.nota === "Vacanze di Natale")); assert.ok(!r.j.chiusure.some((c) => c.data === "2027-01-10")); ok("elenco delle chiusure programmate");
r = await api("POST", "/api/nido/staff/chiusure", { da: "2026-11-10", a: "2026-11-12" }, STAFF); assert.equal(r.s, 400); ok("non si chiude nel passato");
r = await api("POST", "/api/nido/staff/chiusure", { da: "2027-02-10", a: "2027-02-01" }, STAFF); assert.equal(r.s, 400); ok("periodo con date invertite rifiutato");
r = await api("POST", "/api/nido/staff/chiusure", { da: "2027-01-04", a: "2027-01-04" }, T.c); assert.ok(r.s === 403 || r.s === 401 || r.s === 404, "solo la Segreteria: " + r.s); ok("le famiglie non possono chiudere giornate");
r = await api("POST", "/api/nido/staff/chiusure/riapri", { data: "2027-01-06" }, STAFF); assert.equal(r.s, 200);
r = await api("GET", "/api/nido/staff/chiusure", null, STAFF); assert.ok(!r.j.chiusure.some((c) => c.data === "2027-01-06")); ok("riapertura di una giornata");

console.log("Password dimenticata");
const np = posta.length;
r = await api("POST", "/api/nido/password-dimenticata", { email: "nessuno@test.it" }); assert.equal(r.s, 200);
r = await api("POST", "/api/nido/password-dimenticata", { email: "b@test.it" }); assert.equal(r.s, 200);
const rm = await attendiPosta(np); assert.ok(rm); assert.equal(rm.to, "b@test.it");
const tm = decodifica(rm.testo); const tok = /#\/reimposta\/([A-Za-z0-9._-]+)/.exec(tm)?.[1];
assert.ok(tok, "link con il token nell'email: " + tm.slice(0, 200)); assert.match(tm, /portale\.test\/#\/reimposta\//);
assert.equal(posta.length, np + 1, "nessuna email per l'indirizzo sconosciuto"); ok("link di reimpostazione inviato solo se l'email esiste");
const NP = "Nuova-password-456";
r = await api("POST", "/api/collections/users/confirm-password-reset", { token: tok, password: NP, passwordConfirm: NP }); assert.equal(r.s, 204, JSON.stringify(r.j));
await login("b@test.it", NP); ok("nuova password scelta dal link e accesso riuscito");
r = await api("POST", "/api/collections/users/auth-with-password", { identity: "b@test.it", password: PASS }); assert.equal(r.s, 400); ok("la vecchia password non funziona più");

console.log("Aggiunta di un altro bambino/a");
r = await api("POST", "/api/nido/figlio", { nome: "Nuovo", cognome: "Pinna", nascita: "2023-06-01" }, T.c); assert.equal(r.s, 200);
assert.equal((await api("GET", "/api/nido/me", null, T.c)).j.figli.length, 2); ok("figlio/a aggiunto/a");

console.log("Età per frequentare");
r = await api("POST", "/api/nido/figlio", { nome: "Pulcino", cognome: "Pinna", nascita: "2025-06-02" }, T.c); assert.equal(r.s, 200); assert.equal(r.j.avvisi.length, 1); assert.match(r.j.avvisi[0], /2 dicembre 2026/);
r = await api("POST", "/api/nido/figlio", { nome: "Grandino", cognome: "Pinna", nascita: "2019-12-04" }, T.c); assert.equal(r.s, 200); assert.deepEqual(r.j.avvisi, []);
r = await api("POST", "/api/nido/figlio", { nome: "Troppo", cognome: "Grande", nascita: "2019-11-10" }, T.c); assert.equal(r.s, 400); assert.match(r.j.errore, /7 anni o più/); ok("aggiunta: sotto 18 mesi con avviso, 7 anni o più rifiutato");
const mc = (await api("GET", "/api/nido/me", null, T.c)).j.figli;
const pul = mc.find((x) => x.nome === "Pulcino"), gra = mc.find((x) => x.nome === "Grandino");
assert.equal(pul.dal, "2026-12-02"); assert.equal(gra.fino, "2026-12-04");
r = await prenota(T.c, [{ data: "2026-12-01", figli: [pul.id] }]); assert.equal(esito(r, "2026-12-01", pul.id).esito, "piccolo"); assert.equal(esito(r, "2026-12-01", pul.id).dal, "2026-12-02");
r = await prenota(T.c, [{ data: "2026-12-02", figli: [pul.id] }]); assert.equal(esito(r, "2026-12-02", pul.id).esito, "prenotata"); ok("prenotazione prima dei 18 mesi bloccata, dal giorno del 18° mese consentita");
r = await prenota(T.c, [{ data: "2026-12-03", figli: [gra.id] }]); assert.equal(esito(r, "2026-12-03", gra.id).esito, "prenotata");
r = await prenota(T.c, [{ data: "2026-12-04", figli: [gra.id] }]); assert.equal(esito(r, "2026-12-04", gra.id).esito, "grande"); ok("prenotazione dal 7° compleanno in poi bloccata, il giorno prima consentita");
r = await api("POST", "/api/nido/staff/aggiungi", { figlio: pul.id, data: "2026-12-01" }, STAFF); assert.equal(r.j.esito, "piccolo"); ok("anche la Segreteria non può inserire fuori età");

console.log("Orario diverso per una giornata");
{
  const cal = async () => (await api("GET", "/api/nido/calendario", null, T.c)).j.giorni.find((x) => x.data === "2026-11-18");
  let g18 = await cal(); assert.equal(g18.inizio, "16:30"); assert.equal(g18.orarioModificato, false); assert.equal(g18.eliminabile, true);
  r = await api("POST", "/api/nido/staff/giornata", { data: "2026-11-18", chiusa: false, posti: 15, nota: "Nido chiuso", inizio: "08:00", fine: "12:00" }, STAFF); assert.equal(r.s, 200, JSON.stringify(r.j)); assert.equal(r.j.orarioModificato, true);
  g18 = await cal(); assert.equal(g18.inizio, "08:00"); assert.equal(g18.fine, "12:00"); assert.equal(g18.orarioModificato, true);
  assert.equal(g18.eliminabile, false); ok("orario cambiato: famiglie lo vedono e il limite delle 48 ore parte dal nuovo ingresso");
  r = await api("GET", "/api/nido/staff/giornata?data=2026-11-18", null, STAFF); assert.equal(r.j.inizio, "08:00"); assert.equal(r.j.orarioStandard.inizio, "16:30");
  r = await api("POST", "/api/nido/staff/giornata", { data: "2026-11-18", chiusa: false, posti: 15, nota: "", inizio: "12:00", fine: "08:00" }, STAFF); assert.equal(r.s, 400);
  r = await api("POST", "/api/nido/staff/giornata", { data: "2026-11-18", chiusa: false, posti: 15, nota: "", inizio: "25:00", fine: "26:00" }, STAFF); assert.equal(r.s, 400); ok("orari non validi rifiutati");
  r = await api("POST", "/api/nido/staff/giornata", { data: "2026-11-18", chiusa: false, posti: 15, nota: "", inizio: "09:00", fine: "11:00" }, T.c); assert.ok(r.s === 401 || r.s === 403); ok("le famiglie non possono cambiare l'orario");
  r = await api("POST", "/api/nido/staff/giornata", { data: "2026-11-18", chiusa: false, posti: 15, nota: "", inizio: "16:30", fine: "18:30" }, STAFF); assert.equal(r.s, 200); assert.equal(r.j.orarioModificato, false);
  g18 = await cal(); assert.equal(g18.inizio, "16:30"); assert.equal(g18.orarioModificato, false); assert.equal(g18.eliminabile, true); ok("orario di solito ripristinato");
}

console.log("Limite alle richieste ripetute");
r = await api("PATCH", "/api/settings", { rateLimits: { enabled: true } }, SU); assert.equal(r.s, 200);
let bloccato = false;
for (let i = 0; i < 12; i++) { const x = await api("POST", "/api/nido/password-dimenticata", { email: "x" + i + "@test.it" }); if (x.s === 429) { bloccato = true; break; } }
assert.ok(bloccato, "troppe richieste ripetute devono essere bloccate"); ok("richieste ripetute (password dimenticata): bloccate dopo 6 in 10 minuti");

smtp.close();
console.log(`\n${nOk} verifiche superate`);
process.exit(0);
