/// <reference path="../pb_data/types.d.ts" />
// Rotte del portale Spazio gioco 0/6. TUTTE le regole (posti, limiti per bambino/a, fasi 30/7 giorni,
// lista d'attesa, annullamento a 48 ore) sono applicate QUI, lato server, in transazione:
// il browser non può aggirarle.

// ======================= REGISTRAZIONE E ACCESSO =======================

routerAdd("POST", "/api/nido/registrazione", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const R = L.R;
  const b = e.requestInfo().body || {};
  if (b.sito) return e.json(200, { ok: true }); // campo trappola per i programmi automatici

  const err = (m) => e.json(400, { ok: false, errore: m });
  const email = L.clean(b.email, 200).toLowerCase();
  const password = String(b.password || "");
  const nome = L.clean(b.nome, 80), cognome = L.clean(b.cognome, 80), telefono = L.clean(b.telefono, 40);
  const figli = Array.isArray(b.figli) ? b.figli.slice(0, 4) : [];
  const oggi = L.adesso().oggi;

  if (!L.validEmail(email)) return err("Indirizzo email non valido.");
  if (password.length < 10 || password.length > 100) return err("La password deve avere almeno 10 caratteri.");
  if (!nome || !cognome) return err("Inserisci nome e cognome.");
  if (telefono.replace(/[^0-9]/g, "").length < 6) return err("Inserisci un numero di telefono valido.");
  if (b.consenso !== true) return err("Per proseguire conferma di aver letto l'informativa.");
  if (figli.length === 0) return err("Inserisci almeno un bambino o una bambina.");
  const fc = [], avvisi = [];
  for (const f of figli) {
    const fn = L.clean(f.nome, 80), fcg = L.clean(f.cognome, 80), fnasc = L.clean(f.nascita, 10);
    if (!fn || !fcg) return err("Inserisci nome e cognome di ogni bambino/a.");
    const cn = L.controllaNascita(fnasc, oggi, fn);
    if (cn.errore) return err(cn.errore);
    if (cn.avviso) avvisi.push(cn.avviso);
    fc.push({ nome: fn, cognome: fcg, nascita: fnasc });
  }

  try { $app.findAuthRecordByEmail("users", email); return err("Esiste già un account con questa email. Prova ad accedere oppure usa «Ho dimenticato la password»."); } catch (_) {}

  try {
    $app.runInTransaction((tx) => {
      const cfg = L.impostazioni(tx);
      const u = new Record(tx.findCollectionByNameOrId("users"));
      u.setEmail(email);
      u.setPassword(password);
      u.set("nome", nome); u.set("cognome", cognome); u.set("telefono", telefono);
      u.set("stato", cfg.approvazione ? "in_attesa" : "approvato");
      u.set("staff", false);
      tx.save(u);
      const col = tx.findCollectionByNameOrId("figli");
      for (const f of fc) {
        const r = new Record(col);
        r.set("famiglia", u.id); r.set("nome", f.nome); r.set("cognome", f.cognome); r.set("nascita", f.nascita); r.set("attivo", true);
        tx.save(r);
      }
    });
  } catch (ex) {
    return err("Non è stato possibile creare l'account. Controlla i dati e riprova.");
  }
  return e.json(200, { ok: true, avvisi });
});

// "Password dimenticata": invia il link per sceglierne una nuova (stessa risposta sia che l'email esista o no)
routerAdd("POST", "/api/nido/password-dimenticata", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const email = L.clean((e.requestInfo().body || {}).email, 200).toLowerCase();
  if (L.validEmail(email)) {
    try {
      const u = $app.findAuthRecordByEmail("users", email);
      const token = u.newPasswordResetToken();
      L.mail(email, "Reimposta la password · Spazio gioco 0/6",
        "Hai chiesto di reimpostare la password del portale Spazio gioco 0/6.\n\n" +
        "Apri questo link per scegliere una nuova password (vale 2 ore):\n" + L.sitoUrl() + "/#/reimposta/" + token + "\n\n" +
        "Se non sei stato/a tu, ignora questo messaggio: la tua password non cambia." + L.FIRMA);
    } catch (_) { /* email sconosciuta: nessuna differenza nella risposta */ }
  }
  return e.json(200, { ok: true });
});

// ======================= AREA DELLA FAMIGLIA =======================

routerAdd("GET", "/api/nido/me", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const u = $app.findRecordById("users", e.auth.id);
  const cfg = L.impostazioni($app);
  const figli = $app.findRecordsByFilter("figli", "famiglia = {:f} && attivo = true", "created", 20, 0, { f: u.id });
  const ora = L.adesso();
  return e.json(200, {
    utente: { id: u.id, email: u.email(), nome: u.getString("nome"), cognome: u.getString("cognome"), telefono: u.getString("telefono"),
      stato: u.getString("stato"), staff: u.getBool("staff") },
    figli: figli.map((f) => ({ id: f.id, nome: f.getString("nome"), cognome: f.getString("cognome"), nascita: f.getString("nascita"), eta: L.eta(f.getString("nascita"), ora.oggi), dal: L.R.dataInizio(f.getString("nascita")), fino: L.R.dataFine(f.getString("nascita")) })),
    config: L.cfgPubblica(cfg),
    oggi: ora.oggi,
  });
}, $apis.requireAuth("users"));

// Calendario della famiglia: da oggi a (giorni di apertura + 7), con posti, fase e prenotazioni di ogni figlio/a
routerAdd("GET", "/api/nido/calendario", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const R = L.R;
  const u = $app.findRecordById("users", e.auth.id);
  const cfg = L.impostazioni($app);
  const ora = L.adesso();
  const ultimo = R.aggiungi(ora.oggi, cfg.giorniApertura + 7);

  const figli = $app.findRecordsByFilter("figli", "famiglia = {:f} && attivo = true", "created", 20, 0, { f: u.id });
  const tutte = $app.findRecordsByFilter("prenotazioni", "data >= {:a} && data <= {:b} && stato != 'annullata'", "data", 20000, 0, { a: ora.oggi, b: ultimo });
  const conteggi = {};
  for (const r of tutte) {
    const d = r.getString("data");
    if (!conteggi[d]) conteggi[d] = { occ: 0, att: 0 };
    if (r.getString("stato") === "prenotata") conteggi[d].occ++; else conteggi[d].att++;
  }
  const mie = {};
  for (const r of tutte) if (r.getString("famiglia") === u.id) {
    const k = r.getString("data") + "|" + r.getString("figlio");
    mie[k] = { id: r.id, stato: r.getString("stato") };
  }
  const ov = {};
  for (const g of $app.findRecordsByFilter("giornate", "data >= {:a} && data <= {:b}", "data", 1000, 0, { a: ora.oggi, b: ultimo })) ov[g.getString("data")] = g;

  const giorni = [];
  for (let i = 0; ; i++) {
    const d = R.aggiungi(ora.oggi, i);
    if (d > ultimo) break;
    if (R.isDomenica(d)) continue;
    const o = R.orario(d), g = ov[d], c = conteggi[d] || { occ: 0, att: 0 };
    const fase = R.fase(ora.oggi, d, cfg);
    giorni.push({
      data: d, tipo: o.tipo, nome: o.nome, inizio: o.inizio, fine: o.fine, fase: fase,
      apreIl: fase === "presto" ? R.apreIl(d, cfg) : null,
      chiusa: !!(g && g.getBool("chiusa")), nota: g ? g.getString("nota") : "",
      posti: g && g.getInt("posti") > 0 ? g.getInt("posti") : cfg.posti, occupati: c.occ, attesa: c.att,
      eliminabile: R.eliminabile(ora.oggi, ora.min, d, cfg),
      figli: figli.map((f) => { const m = mie[d + "|" + f.id]; return m ? { id: f.id, stato: m.stato, pid: m.id } : { id: f.id, stato: null, pid: null }; }),
    });
  }
  // date già prenotate da ciascun/a figlio/a (servono a calcolare i limiti anche sul sito)
  const da = R.aggiungi(ora.oggi, -62);
  const impegni = {};
  for (const f of figli) {
    impegni[f.id] = $app.findRecordsByFilter("prenotazioni", "figlio = {:f} && stato = 'prenotata' && data >= {:d}", "data", 2000, 0, { f: f.id, d: da }).map((r) => r.getString("data"));
  }
  return e.json(200, { oggi: ora.oggi, ultimoPrenotabile: R.aggiungi(ora.oggi, cfg.giorniApertura), config: L.cfgPubblica(cfg), approvato: u.getString("stato") === "approvato", giorni, impegni });
}, $apis.requireAuth("users"));

// Prenotazione: body { richieste: [{ data, figli: [idFiglio, ...] }, ...] }
routerAdd("POST", "/api/nido/prenota", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const R = L.R;
  const u = $app.findRecordById("users", e.auth.id);
  if (u.getString("stato") !== "approvato") return e.json(403, { ok: false, errore: "Il tuo account non è ancora stato approvato dalla Segreteria." });
  const b = e.requestInfo().body || {};
  const richieste = Array.isArray(b.richieste) ? b.richieste.slice(0, 80) : [];
  if (richieste.length === 0) return e.json(400, { ok: false, errore: "Nessuna giornata selezionata." });

  const coppie = [];
  for (const r of richieste) for (const f of (Array.isArray(r.figli) ? r.figli : [])) coppie.push({ data: String(r.data), figlio: String(f) });
  coppie.sort((x, y) => (x.data < y.data ? -1 : x.data > y.data ? 1 : 0));
  if (coppie.length > 160) return e.json(400, { ok: false, errore: "Troppe richieste in una volta." });

  const esiti = [];
  $app.runInTransaction((tx) => {
    const cfg = L.impostazioni(tx), ora = L.adesso();
    for (const c of coppie) {
      let f;
      try { f = tx.findRecordById("figli", c.figlio); } catch (_) { esiti.push({ data: c.data, figlio: c.figlio, esito: "fuori" }); continue; }
      if (f.getString("famiglia") !== u.id || !f.getBool("attivo")) { esiti.push({ data: c.data, figlio: c.figlio, esito: "fuori" }); continue; }
      const x = L.prenotaUno(tx, cfg, ora, u, f, c.data, { staff: false });
      esiti.push({ data: c.data, figlio: c.figlio, esito: x.esito, motivo: x.motivo || null, dal: x.dal || null });
    }
  });
  return e.json(200, { ok: true, esiti });
}, $apis.requireAuth("users"));

// Eliminazione di una prenotazione (o uscita dalla lista d'attesa)
routerAdd("POST", "/api/nido/annulla", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const R = L.R;
  const id = L.clean((e.requestInfo().body || {}).id, 40);
  let esito = [200, null];
  let assegnati = [];
  $app.runInTransaction((tx) => {
    const cfg = L.impostazioni(tx), ora = L.adesso();
    let p;
    try { p = tx.findRecordById("prenotazioni", id); } catch (_) { esito = [404, "Prenotazione non trovata."]; return; }
    if (p.getString("famiglia") !== e.auth.id || p.getString("stato") === "annullata") { esito = [404, "Prenotazione non trovata."]; return; }
    const data = p.getString("data");
    if (p.getString("stato") === "prenotata" && !R.eliminabile(ora.oggi, ora.min, data, cfg)) {
      esito = [409, "Non si può più eliminare questa prenotazione: mancano meno di " + cfg.oreAnnullo + " ore. Contatta il Nido."]; return;
    }
    if (p.getString("stato") === "attesa" && R.diff(ora.oggi, data) < 1) { esito = [409, "La giornata è già iniziata o è oggi."]; return; }
    const eraPrenotata = p.getString("stato") === "prenotata";
    p.set("stato", "annullata");
    tx.save(p);
    if (eraPrenotata) assegnati = L.promuovi(tx, cfg, ora, data);
  });
  L.inviaAssegnati(assegnati);
  if (esito[0] !== 200) return e.json(esito[0], { ok: false, errore: esito[1] });
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Aggiunta di un altro bambino/a (fino a 4 per famiglia)
routerAdd("POST", "/api/nido/figlio", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const b = e.requestInfo().body || {};
  const nome = L.clean(b.nome, 80), cognome = L.clean(b.cognome, 80), nascita = L.clean(b.nascita, 10);
  const oggi = L.adesso().oggi;
  if (!nome || !cognome) return e.json(400, { ok: false, errore: "Inserisci nome e cognome del bambino/a." });
  const cn = L.controllaNascita(nascita, oggi, nome);
  if (cn.errore) return e.json(400, { ok: false, errore: cn.errore });
  if ($app.countRecords("figli", $dbx.hashExp({ famiglia: e.auth.id, attivo: true })) >= 4) return e.json(400, { ok: false, errore: "Si possono inserire al massimo 4 bambini/e." });
  const r = new Record($app.findCollectionByNameOrId("figli"));
  r.set("famiglia", e.auth.id); r.set("nome", nome); r.set("cognome", cognome); r.set("nascita", nascita); r.set("attivo", true);
  $app.save(r);
  return e.json(200, { ok: true, avvisi: cn.avviso ? [cn.avviso] : [] });
}, $apis.requireAuth("users"));

// ======================= SEGRETERIA =======================
const soloStaff = (e) => {
  const u = $app.findRecordById("users", e.auth.id);
  if (!u.getBool("staff") || u.getString("stato") !== "approvato") throw new ForbiddenError("Riservato alla Segreteria.");
  return e.next();
};

routerAdd("GET", "/api/nido/staff/riepilogo", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const R = L.R;
  const cfg = L.impostazioni($app), ora = L.adesso();
  const ultimo = R.aggiungi(ora.oggi, cfg.giorniApertura);
  const rs = $app.findRecordsByFilter("prenotazioni", "data >= {:a} && data <= {:b} && stato != 'annullata'", "data", 20000, 0, { a: ora.oggi, b: ultimo });
  const c = {};
  for (const r of rs) { const d = r.getString("data"); if (!c[d]) c[d] = { occ: 0, att: 0 }; if (r.getString("stato") === "prenotata") c[d].occ++; else c[d].att++; }
  const ov = {};
  for (const g of $app.findRecordsByFilter("giornate", "data >= {:a} && data <= {:b}", "data", 1000, 0, { a: ora.oggi, b: ultimo })) ov[g.getString("data")] = g;
  const giorni = [];
  let occ7 = 0, cap7 = 0, attesaTot = 0, giorniAttesa = 0;
  for (let i = 0; i <= cfg.giorniApertura; i++) {
    const d = R.aggiungi(ora.oggi, i);
    if (R.isDomenica(d)) continue;
    const g = ov[d], x = c[d] || { occ: 0, att: 0 };
    const posti = g && g.getInt("posti") > 0 ? g.getInt("posti") : cfg.posti;
    const chiusa = !!(g && g.getBool("chiusa"));
    const o = R.orario(d);
    giorni.push({ data: d, tipo: o.tipo, nome: o.nome, inizio: o.inizio, fine: o.fine, fase: R.fase(ora.oggi, d, cfg), posti, occupati: x.occ, attesa: x.att, chiusa, nota: g ? g.getString("nota") : "" });
    if (i <= 7 && !chiusa) { occ7 += x.occ; cap7 += posti; }
    if (x.att > 0) { attesaTot += x.att; giorniAttesa++; }
  }
  const mese = R.mese(ora.oggi);
  const delMese = $app.findRecordsByFilter("prenotazioni", "data ~ {:m} && stato = 'prenotata'", "", 20000, 0, { m: mese + "-%" });
  const diversi = {};
  for (const r of delMese) diversi[r.getString("figlio")] = 1;
  const famiglie = $app.countRecords("users", $dbx.exp("staff = 0 AND stato = 'approvato'"));
  const daApprovare = $app.countRecords("users", $dbx.exp("staff = 0 AND stato = 'in_attesa'"));
  return e.json(200, {
    oggi: ora.oggi, config: L.cfgPubblica(cfg), giorni,
    kpi: { figliDiversiMese: Object.keys(diversi).length, famiglie, occupazione7: cap7 ? Math.round((occ7 / cap7) * 100) : 0, attesaTotale: attesaTot, attesaGiorni: giorniAttesa, daApprovare },
  });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("GET", "/api/nido/staff/giornata", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const R = L.R;
  const data = L.clean(e.request.url.query().get("data"), 10);
  if (!R.valida(data)) return e.json(400, { ok: false, errore: "Data non valida." });
  const ora = L.adesso();
  const rs = $app.findRecordsByFilter("prenotazioni", "data = {:d} && stato != 'annullata'", "created", 1000, 0, { d: data });
  const riga = (r) => {
    const f = $app.findRecordById("figli", r.getString("figlio"));
    const u = $app.findRecordById("users", r.getString("famiglia"));
    return {
      id: r.id, stato: r.getString("stato"), presenza: r.getString("presenza"), daStaff: r.getBool("da_staff"),
      figlio: L.nomeFiglio(f), eta: L.eta(f.getString("nascita"), ora.oggi),
      genitore: u.getString("nome") + " " + u.getString("cognome"), telefono: u.getString("telefono"), email: u.email(),
      mese: L.giornateNelMese($app, f.id, data), quando: r.getString("created") + r.id,
    };
  };
  const iscritti = rs.filter((r) => r.getString("stato") === "prenotata").map(riga);
  const attesa = rs.filter((r) => r.getString("stato") === "attesa").map(riga).sort((a, b) => R.precedenza(a, b));
  const g = L.giornata($app, data);
  const cfg = L.impostazioni($app);
  const o = R.orario(data);
  return e.json(200, {
    data, nome: o.nome, inizio: o.inizio, fine: o.fine, fase: R.fase(ora.oggi, data, cfg), oggi: ora.oggi,
    posti: L.postiGiornata($app, data, cfg), chiusa: L.chiusaGiornata($app, data), nota: g ? g.getString("nota") : "",
    iscritti, attesa,
  });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("POST", "/api/nido/staff/presenza", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const b = e.requestInfo().body || {};
  const v = String(b.presenza || "");
  if (v !== "" && v !== "presente" && v !== "assente") return e.json(400, { ok: false, errore: "Valore non valido." });
  const p = $app.findRecordById("prenotazioni", L.clean(b.id, 40));
  p.set("presenza", v);
  $app.save(p);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"), soloStaff);

// Ricerca di bambini/e (per inserimento a mano)
routerAdd("GET", "/api/nido/staff/figli", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const q = L.clean(e.request.url.query().get("q"), 60);
  if (q.length < 2) return e.json(200, { figli: [] });
  const rs = $app.findRecordsByFilter("figli", "attivo = true && (nome ~ {:q} || cognome ~ {:q})", "cognome,nome", 12, 0, { q: q });
  return e.json(200, { figli: rs.map((f) => {
    const u = $app.findRecordById("users", f.getString("famiglia"));
    return { id: f.id, nome: L.nomeFiglio(f), genitore: u.getString("nome") + " " + u.getString("cognome"), approvato: u.getString("stato") === "approvato" };
  }) });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("POST", "/api/nido/staff/aggiungi", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const b = e.requestInfo().body || {};
  const data = L.clean(b.data, 10);
  let esito = null;
  $app.runInTransaction((tx) => {
    const cfg = L.impostazioni(tx), ora = L.adesso();
    const f = tx.findRecordById("figli", L.clean(b.figlio, 40));
    const u = tx.findRecordById("users", f.getString("famiglia"));
    esito = L.prenotaUno(tx, cfg, ora, u, f, data, { staff: true });
  });
  return e.json(200, { ok: esito.esito === "prenotata", esito: esito.esito });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("POST", "/api/nido/staff/rimuovi", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  let assegnati = [];
  $app.runInTransaction((tx) => {
    const cfg = L.impostazioni(tx), ora = L.adesso();
    const p = tx.findRecordById("prenotazioni", L.clean((e.requestInfo().body || {}).id, 40));
    const era = p.getString("stato") === "prenotata";
    p.set("stato", "annullata");
    tx.save(p);
    if (era) assegnati = L.promuovi(tx, cfg, ora, p.getString("data"));
  });
  L.inviaAssegnati(assegnati);
  return e.json(200, { ok: true, assegnati: assegnati.length });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("POST", "/api/nido/staff/giornata", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const b = e.requestInfo().body || {};
  const data = L.clean(b.data, 10);
  if (!L.R.valida(data) || L.R.isDomenica(data)) return e.json(400, { ok: false, errore: "Data non valida." });
  let g = L.giornata($app, data);
  if (!g) { g = new Record($app.findCollectionByNameOrId("giornate")); g.set("data", data); }
  g.set("chiusa", !!b.chiusa);
  g.set("posti", Math.max(0, Math.min(200, parseInt(b.posti, 10) || 0)));
  g.set("nota", L.clean(b.nota, 300));
  $app.save(g);
  const n = L.promuoviDate([data]);
  return e.json(200, { ok: true, assegnati: n });
}, $apis.requireAuth("users"), soloStaff);

// Chiusure programmate: elenco di tutte le giornate chiuse da oggi in poi (anche oltre i giorni prenotabili)
routerAdd("GET", "/api/nido/staff/chiusure", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const ora = L.adesso();
  const gs = $app.findRecordsByFilter("giornate", "data >= {:a} && chiusa = true", "data", 1000, 0, { a: ora.oggi });
  return e.json(200, { oggi: ora.oggi, chiusure: gs.map((g) => {
    const d = g.getString("data");
    return { data: d, nota: g.getString("nota"), prenotazioni: $app.countRecords("prenotazioni", $dbx.exp("data = {:d} AND stato != 'annullata'", { d: d })) };
  }) });
}, $apis.requireAuth("users"), soloStaff);

// Chiude un periodo (da/a inclusi, domeniche escluse), anche molto in anticipo. Le prenotazioni già fatte non vengono toccate.
routerAdd("POST", "/api/nido/staff/chiusure", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const R = L.R;
  const b = e.requestInfo().body || {};
  const da = L.clean(b.da, 10), a = L.clean(b.a || b.da, 10), nota = L.clean(b.nota, 300);
  const ora = L.adesso();
  if (!R.valida(da) || !R.valida(a)) return e.json(400, { ok: false, errore: "Date non valide." });
  if (R.diff(ora.oggi, da) < 0) return e.json(400, { ok: false, errore: "La data di inizio non può essere nel passato." });
  if (R.diff(da, a) < 0) return e.json(400, { ok: false, errore: "La data finale è prima di quella iniziale." });
  if (R.diff(da, a) > 400) return e.json(400, { ok: false, errore: "Periodo troppo lungo (massimo 400 giorni)." });
  let chiuse = 0, conPrenotazioni = 0;
  for (let d = da; R.diff(d, a) >= 0; d = R.aggiungi(d, 1)) {
    if (R.isDomenica(d)) continue;
    let g = L.giornata($app, d);
    if (!g) { g = new Record($app.findCollectionByNameOrId("giornate")); g.set("data", d); }
    g.set("chiusa", true);
    g.set("nota", nota);
    $app.save(g);
    chiuse++;
    if ($app.countRecords("prenotazioni", $dbx.exp("data = {:d} AND stato != 'annullata'", { d: d })) > 0) conPrenotazioni++;
  }
  return e.json(200, { ok: true, chiuse, conPrenotazioni });
}, $apis.requireAuth("users"), soloStaff);

// Riapre una giornata chiusa (resta l'eventuale numero di posti personalizzato; la nota viene tolta)
routerAdd("POST", "/api/nido/staff/chiusure/riapri", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const b = e.requestInfo().body || {};
  const data = L.clean(b.data, 10);
  if (!L.R.valida(data)) return e.json(400, { ok: false, errore: "Data non valida." });
  const g = L.giornata($app, data);
  if (!g) return e.json(200, { ok: true });
  g.set("chiusa", false);
  g.set("nota", "");
  $app.save(g);
  const n = L.promuoviDate([data]);
  return e.json(200, { ok: true, assegnati: n });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("GET", "/api/nido/staff/famiglie", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const ora = L.adesso();
  const us = $app.findRecordsByFilter("users", "staff = false", "-created", 2000, 0);
  return e.json(200, { famiglie: us.map((u) => ({
    id: u.id, nome: u.getString("nome") + " " + u.getString("cognome"), email: u.email(), telefono: u.getString("telefono"), stato: u.getString("stato"),
    creato: u.getString("created").slice(0, 10),
    figli: $app.findRecordsByFilter("figli", "famiglia = {:f} && attivo = true", "created", 20, 0, { f: u.id }).map((f) => ({ id: f.id, nome: L.nomeFiglio(f), eta: L.eta(f.getString("nascita"), ora.oggi) })),
  })) });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("POST", "/api/nido/staff/famiglia", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const b = e.requestInfo().body || {};
  const stato = String(b.stato || "");
  if (["approvato", "rifiutato", "in_attesa"].indexOf(stato) < 0) return e.json(400, { ok: false, errore: "Stato non valido." });
  const u = $app.findRecordById("users", L.clean(b.id, 40));
  if (u.getBool("staff")) return e.json(400, { ok: false, errore: "Operazione non consentita." });
  const prima = u.getString("stato");
  u.set("stato", stato);
  $app.save(u);
  if (stato === "approvato" && prima !== "approvato") {
    L.mail(u.email(), "Account approvato · Spazio gioco 0/6",
      "Il tuo account è stato approvato: ora puoi prenotare le giornate dello Spazio gioco.\nAccedi qui: " + L.sitoUrl() + L.FIRMA);
  }
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"), soloStaff);

// Chiusura definitiva di un account (diritto alla cancellazione): elimina famiglia, figli/e e prenotazioni
routerAdd("POST", "/api/nido/staff/famiglia/elimina", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const u = $app.findRecordById("users", L.clean((e.requestInfo().body || {}).id, 40));
  if (u.getBool("staff")) return e.json(400, { ok: false, errore: "Operazione non consentita." });
  $app.delete(u);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("GET", "/api/nido/staff/impostazioni", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const c = L.impostazioni($app);
  return e.json(200, { ...L.cfgPubblica(c), approvazione: c.approvazione });
}, $apis.requireAuth("users"), soloStaff);

routerAdd("POST", "/api/nido/staff/impostazioni", (e) => {
  const L = require(`${__hooks}/nido_lib.js`);
  const b = e.requestInfo().body || {};
  const r = L.impostazioni($app).rec;
  const num = (k, min, max) => { const n = parseInt(b[k], 10); if (isNaN(n) || n < min || n > max) throw new BadRequestError("Valore non valido: " + k); return n; };
  r.set("prenotazioni_aperte", !!b.aperte);
  r.set("approvazione_manuale", !!b.approvazione);
  r.set("posti", num("posti", 1, 200));
  r.set("max_settimana", num("maxSettimana", 1, 6));
  r.set("max_mese", num("maxMese", 1, 31));
  r.set("max_sabati_consecutivi", num("maxSabatiConsecutivi", 1, 6));
  r.set("giorni_apertura", num("giorniApertura", 1, 120));
  r.set("giorni_fase2", num("giorniFase2", 0, 60));
  r.set("ore_annullo", num("oreAnnullo", 0, 240));
  $app.save(r);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"), soloStaff);

// ======================= LAVORI PERIODICI =======================
// Ogni 30 minuti: assegna i posti liberi a chi è in lista d'attesa (utile quando, entrando nella fase 2, i limiti si sbloccano).
cronAdd("nido_lista_attesa", "*/30 * * * *", () => {
  const L = require(`${__hooks}/nido_lib.js`);
  const cfg = L.impostazioni($app), ora = L.adesso();
  const date = [];
  for (let i = 1; i <= cfg.giorniApertura; i++) {
    const d = L.R.aggiungi(ora.oggi, i);
    if (!L.R.isDomenica(d) && L.inAttesa($app, d) > 0) date.push(d);
  }
  if (date.length) L.promuoviDate(date);
});
