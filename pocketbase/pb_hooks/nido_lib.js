// Funzioni di supporto lato server (caricate con require() dentro i gestori delle rotte).
const R = require(`${__hooks}/nido_regole.js`);

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function dataIt(s) {
  const p = s.split("-");
  return GIORNI[R.dow(s)] + " " + (+p[2]) + " " + MESI[+p[1] - 1];
}

// Ora di Roma "AAAA-MM-GGTHH:MM" (ora legale/solare gestita a mano, senza Intl).
function romeNow(nowMs) {
  const d = new Date(nowMs === undefined ? Date.now() : nowMs);
  const y = d.getUTCFullYear();
  const lastSunday = (month) => {
    const last = new Date(Date.UTC(y, month + 1, 0, 1, 0, 0));
    return Date.UTC(y, month, last.getUTCDate() - last.getUTCDay(), 1, 0, 0);
  };
  const dst = d.getTime() >= lastSunday(2) && d.getTime() < lastSunday(9);
  const l = new Date(d.getTime() + (dst ? 2 : 1) * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return l.getUTCFullYear() + "-" + p(l.getUTCMonth() + 1) + "-" + p(l.getUTCDate()) + "T" + p(l.getUTCHours()) + ":" + p(l.getUTCMinutes());
}

// { oggi: "AAAA-MM-GG", min: minuti dall'inizio della giornata }.
// NIDO_FINTA_ORA serve SOLO ai collaudi automatici (es. "2026-11-16T10:00"); in produzione non esiste.
function adesso() {
  const finta = $os.getenv("NIDO_FINTA_ORA");
  const s = finta ? finta : romeNow();
  return { oggi: s.slice(0, 10), min: +s.slice(11, 13) * 60 + +s.slice(14, 16) };
}

function clean(s, max) {
  return String(s === undefined || s === null ? "" : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}
function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 200; }

function impostazioni(app) {
  const r = app.findFirstRecordByFilter("impostazioni", "id != ''");
  const D = R.CFG_DEFAULT;
  const n = (k, d) => (r.getInt(k) > 0 ? r.getInt(k) : d);
  return {
    rec: r,
    aperte: r.getBool("prenotazioni_aperte"),
    approvazione: r.getBool("approvazione_manuale"),
    posti: n("posti", D.posti),
    maxSettimana: n("max_settimana", D.maxSettimana),
    maxMese: n("max_mese", D.maxMese),
    maxSabatiConsecutivi: n("max_sabati_consecutivi", D.maxSabatiConsecutivi),
    giorniApertura: n("giorni_apertura", D.giorniApertura),
    giorniFase2: r.getInt("giorni_fase2"),
    oreAnnullo: r.getInt("ore_annullo"),
  };
}
function cfgPubblica(c) {
  return { posti: c.posti, maxSettimana: c.maxSettimana, maxMese: c.maxMese, maxSabatiConsecutivi: c.maxSabatiConsecutivi,
    giorniApertura: c.giorniApertura, giorniFase2: c.giorniFase2, oreAnnullo: c.oreAnnullo, aperte: c.aperte };
}

// ---- Email (solo testi minimi: niente nomi di bambini/e) ----
// Chiusura comune a tutti i messaggi automatici
const FIRMA = "\n\nQuesto è un messaggio automatico: per informazioni telefona al 389 918 4668 o scrivi a geneattori@gmail.com.\n\nSpazio gioco 0/6 – Nido di Quartu Sant'Elena";
function sitoUrl() { return ($os.getenv("NIDO_SITE_URL") || "").replace(/\/+$/, ""); }

function mail(to, subject, text) {
  try {
    const st = $app.settings();
    if (!st.smtp.enabled) { $app.logger().warn("Email non inviata: SMTP non attivo", "oggetto", subject); return false; }
    const msg = new MailerMessage({
      from: { address: st.meta.senderAddress, name: st.meta.senderName },
      to: [{ address: to }],
      subject: subject,
      text: text,
    });
    $app.newMailClient().send(msg);
    return true;
  } catch (err) {
    $app.logger().error("Errore invio email", "oggetto", subject, "errore", String(err));
    return false;
  }
}

function mailPostoAssegnato(famigliaId, data) {
  try {
    const u = $app.findRecordById("users", famigliaId);
    const og = orarioGiorno(data, giornata($app, data));
    mail(u.email(), "Si è liberato un posto · Spazio gioco 0/6",
      "Si è liberato un posto per la giornata di " + dataIt(data) + (og.modificato ? " (orario: dalle " + og.inizio + " alle " + og.fine + ")" : "") + ".\n" +
      "La prenotazione è già inserita nella tua area personale: " + sitoUrl() + "\n\n" +
      "Se non puoi più venire, eliminala dalla tua area personale almeno 48 ore prima." + FIRMA);
  } catch (err) { $app.logger().error("mailPostoAssegnato", "errore", String(err)); }
}

// ---- Giornate, posti, prenotazioni ----
// Orario di una giornata: quello standard, oppure quello cambiato dalla Segreteria per quella data.
function orarioGiorno(data, g) {
  const o = R.orario(data);
  const i = g ? g.getString("inizio") : "", f = g ? g.getString("fine") : "";
  if (i && f && R.minuti(i) >= 0 && R.minuti(f) > R.minuti(i) && (i !== o.inizio || f !== o.fine)) {
    return { tipo: o.tipo, nome: o.nome, inizio: i, fine: f, inizioMin: R.minuti(i), modificato: true, standard: { inizio: o.inizio, fine: o.fine } };
  }
  return { tipo: o.tipo, nome: o.nome, inizio: o.inizio, fine: o.fine, inizioMin: o.inizioMin, modificato: false, standard: { inizio: o.inizio, fine: o.fine } };
}

function giornata(app, data) {
  try { return app.findFirstRecordByFilter("giornate", "data = {:d}", { d: data }); } catch (_) { return null; }
}
function postiGiornata(app, data, cfg) {
  const g = giornata(app, data);
  return g && g.getInt("posti") > 0 ? g.getInt("posti") : cfg.posti;
}
function chiusaGiornata(app, data) {
  const g = giornata(app, data);
  return !!(g && g.getBool("chiusa"));
}
function occupati(app, data) { return app.countRecords("prenotazioni", $dbx.hashExp({ data: data, stato: "prenotata" })); }
function inAttesa(app, data) { return app.countRecords("prenotazioni", $dbx.hashExp({ data: data, stato: "attesa" })); }

// date già prenotate (non in lista d'attesa) da un/a bambino/a, in una finestra attorno a "data"
function impegnate(app, figlioId, data, escludiId) {
  const rs = app.findRecordsByFilter("prenotazioni", "figlio = {:f} && stato = 'prenotata' && data >= {:a} && data <= {:b}", "data", 2000, 0,
    { f: figlioId, a: R.aggiungi(data, -62), b: R.aggiungi(data, 62) });
  return rs.filter((r) => r.id !== escludiId).map((r) => r.getString("data"));
}
function giornateNelMese(app, figlioId, data) {
  return app.countRecords("prenotazioni", $dbx.exp("figlio = {:f} AND stato = 'prenotata' AND data LIKE {:m}", { f: figlioId, m: R.mese(data) + "-%" }));
}

// Esito di una richiesta di prenotazione per UN bambino/a e UNA data.
// opts.staff = true → inserimento a mano: niente limiti né finestre (solo la data non deve essere passata).
// Ritorna { esito: "prenotata" | "attesa" | "gia" | "limite" | "chiusa" | "piccolo" | "grande" | "fuori" | "domenica" | "non_aperta", motivo? }
function prenotaUno(tx, cfg, ora, famiglia, figlio, data, opts) {
  const staff = !!(opts && opts.staff);
  if (!R.valida(data)) return { esito: "fuori" };
  if (R.isDomenica(data)) return { esito: "domenica" };
  const fase = R.fase(ora.oggi, data, cfg);
  if (staff) { if (fase === "passata") return { esito: "fuori" }; }
  else {
    if (!cfg.aperte) return { esito: "non_aperta" };
    if (fase === "passata" || fase === "oggi") return { esito: "fuori" };
    if (fase === "presto") return { esito: "non_aperta" };
  }
  if (chiusaGiornata(tx, data)) return { esito: "chiusa" };
  const idon = R.idoneo(figlio.getString("nascita"), data);
  if (idon === "piccolo") return { esito: "piccolo", dal: R.dataInizio(figlio.getString("nascita")) };
  if (idon === "grande") return { esito: "grande" };

  const gia = tx.countRecords("prenotazioni", $dbx.exp("figlio = {:f} AND data = {:d} AND stato != 'annullata'", { f: figlio.id, d: data }));
  if (gia > 0) return { esito: "gia" };

  if (!staff && fase === "fase1") {
    const motivo = R.limite(impegnate(tx, figlio.id, data), data, cfg);
    if (motivo) return { esito: "limite", motivo: motivo };
  }

  const piena = occupati(tx, data) >= postiGiornata(tx, data, cfg);
  if (piena && staff) return { esito: "piena" };
  const r = new Record(tx.findCollectionByNameOrId("prenotazioni"));
  r.set("data", data);
  r.set("figlio", figlio.id);
  r.set("famiglia", famiglia.id);
  r.set("stato", piena ? "attesa" : "prenotata");
  r.set("da_staff", staff);
  tx.save(r);
  return { esito: piena ? "attesa" : "prenotata", id: r.id };
}

// Assegna i posti liberi a chi è in lista d'attesa, rispettando la precedenza e (in fase 1) i limiti.
// Ritorna l'elenco dei posti assegnati [{ famiglia, data }]: le email partono DOPO la transazione.
function promuovi(tx, cfg, ora, data) {
  const assegnati = [];
  if (R.diff(ora.oggi, data) < 1 || chiusaGiornata(tx, data)) return assegnati;
  const posti = postiGiornata(tx, data, cfg);
  const fase = R.fase(ora.oggi, data, cfg);
  let liberi = posti - occupati(tx, data);
  while (liberi > 0) {
    const coda = tx.findRecordsByFilter("prenotazioni", "data = {:d} && stato = 'attesa'", "created", 1000, 0, { d: data });
    const cand = [];
    for (const r of coda) {
      const u = tx.findRecordById("users", r.getString("famiglia"));
      if (u.getString("stato") !== "approvato") continue;
      if (fase === "fase1" && !r.getBool("da_staff") && R.limite(impegnate(tx, r.getString("figlio"), data), data, cfg)) continue;
      cand.push({ r: r, mese: giornateNelMese(tx, r.getString("figlio"), data), quando: r.getString("created") + r.id });
    }
    if (cand.length === 0) break;
    cand.sort((a, b) => R.precedenza(a, b));
    const vince = cand[0].r;
    vince.set("stato", "prenotata");
    tx.save(vince);
    assegnati.push({ famiglia: vince.getString("famiglia"), data: data });
    liberi--;
  }
  return assegnati;
}

function inviaAssegnati(assegnati) { for (const a of assegnati) mailPostoAssegnato(a.famiglia, a.data); }

// Esegue "promuovi" per ogni data dell'elenco in un'unica transazione e invia le email.
function promuoviDate(date) {
  const ora = adesso();
  let assegnati = [];
  $app.runInTransaction((tx) => {
    const cfg = impostazioni(tx);
    for (const d of date) assegnati = assegnati.concat(promuovi(tx, cfg, ora, d));
  });
  inviaAssegnati(assegnati);
  return assegnati.length;
}

function mesiEta(nascita, oggi) {
  const a = nascita.split("-").map(Number), b = oggi.split("-").map(Number);
  let mesi = (b[0] - a[0]) * 12 + (b[1] - a[1]);
  if (b[2] < a[2]) mesi--;
  return mesi;
}

// All'iscrizione: sotto i 18 mesi si può iscrivere (frequenterà più avanti); da 7 anni in su no.
// Restituisce { errore } se la data non va bene, altrimenti { avviso } (testo, oppure "").
function controllaNascita(nascita, oggi, nome) {
  const chi = nome ? " di " + nome : "";
  if (!R.valida(nascita) || nascita > oggi) return { errore: "Controlla la data di nascita" + chi + ": la data non è valida." };
  if (oggi >= R.dataFine(nascita)) return { errore: "La data di nascita" + chi + " indica un'età di 7 anni o più. Lo Spazio gioco è rivolto a bambini e bambine dai 18 mesi ai 6 anni: non è possibile iscrivere " + (nome || "il bambino/a") + "." };
  return { avviso: avvisoPiccolo(nascita, oggi, nome) };
}

function avvisoPiccolo(nascita, oggi, nome) {
  if (oggi >= R.dataInizio(nascita)) return "";
  return (nome || "Il bambino/a") + " non ha ancora 18 mesi e potrà frequentare il servizio a partire dal " + dataIt(R.dataInizio(nascita)) + " " + R.dataInizio(nascita).slice(0, 4) + ".";
}

function eta(nascita, oggi) {
  const mesi = mesiEta(nascita, oggi);
  if (mesi < 24) return mesi + (mesi === 1 ? " mese" : " mesi");
  const anni = Math.floor(mesi / 12);
  return anni + (anni === 1 ? " anno" : " anni");
}

function nomeFiglio(f) { return f.getString("nome") + " " + f.getString("cognome"); }

module.exports = { R, FIRMA, dataIt, romeNow, adesso, clean, validEmail, impostazioni, cfgPubblica, sitoUrl, mail, mailPostoAssegnato,
  giornata, postiGiornata, chiusaGiornata, occupati, inAttesa, impegnate, giornateNelMese, prenotaUno, promuovi, inviaAssegnati,
  promuoviDate, orarioGiorno, eta, mesiEta, controllaNascita, avvisoPiccolo, nomeFiglio };
