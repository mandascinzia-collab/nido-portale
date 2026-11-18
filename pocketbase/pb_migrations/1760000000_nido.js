/// <reference path="../pb_data/types.d.ts" />
// Schema del portale prenotazioni Spazio gioco 0/6.
// - "users" (collezione di accesso già presente in PocketBase): famiglie e Segreteria. Aggiungiamo i nostri campi.
// - "figli", "giornate", "prenotazioni", "impostazioni": TUTTE private (regole = null): il browser non le legge
//   direttamente, passa solo dalle rotte /api/nido/* in pb_hooks/nido.pb.js che applicano le regole.
migrate((app) => {
  const auto = [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ];

  // ---- users: campi aggiuntivi + nessun accesso diretto da browser ----
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "nome", max: 80 }));
  users.fields.add(new TextField({ name: "cognome", max: 80 }));
  users.fields.add(new TextField({ name: "telefono", max: 40 }));
  users.fields.add(new SelectField({ name: "stato", maxSelect: 1, values: ["in_attesa", "approvato", "rifiutato"] }));
  users.fields.add(new BoolField({ name: "staff" }));
  users.listRule = null;
  users.viewRule = null;
  users.createRule = null;   // la registrazione passa da /api/nido/registrazione
  users.updateRule = null;
  users.deleteRule = null;
  users.passwordResetToken.duration = 7200; // il link "password dimenticata" vale 2 ore
  app.save(users);

  const figli = new Collection({
    type: "base",
    name: "figli",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "relation", name: "famiglia", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "nome", required: true, max: 80 },
      { type: "text", name: "cognome", required: true, max: 80 },
      { type: "text", name: "nascita", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { type: "bool", name: "attivo" },
      ...auto,
    ],
    indexes: ["CREATE INDEX idx_figli_famiglia ON figli (famiglia)"],
  });
  app.save(figli);

  // Una riga solo quando serve cambiare qualcosa per una data (chiusura, posti diversi, nota).
  const giornate = new Collection({
    type: "base",
    name: "giornate",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "data", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { type: "bool", name: "chiusa" },
      { type: "number", name: "posti", min: 0, onlyInt: true }, // 0 = usa il valore standard delle impostazioni
      { type: "text", name: "nota", max: 300 },
      ...auto,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_giornate_data ON giornate (data)"],
  });
  app.save(giornate);

  const prenotazioni = new Collection({
    type: "base",
    name: "prenotazioni",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "text", name: "data", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      { type: "relation", name: "figlio", required: true, collectionId: figli.id, maxSelect: 1, cascadeDelete: true },
      { type: "relation", name: "famiglia", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "select", name: "stato", required: true, maxSelect: 1, values: ["prenotata", "attesa", "annullata"] },
      { type: "select", name: "presenza", maxSelect: 1, values: ["presente", "assente"] },
      { type: "bool", name: "da_staff" },
      ...auto,
    ],
    indexes: [
      "CREATE INDEX idx_pren_data ON prenotazioni (data, stato)",
      "CREATE INDEX idx_pren_figlio ON prenotazioni (figlio, stato)",
      // rete di sicurezza: stesso/a bambino/a non può avere due prenotazioni attive nella stessa data
      "CREATE UNIQUE INDEX idx_pren_unica ON prenotazioni (figlio, data) WHERE stato != 'annullata'",
    ],
  });
  app.save(prenotazioni);

  const impostazioni = new Collection({
    type: "base",
    name: "impostazioni",
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { type: "bool", name: "prenotazioni_aperte" },
      { type: "bool", name: "approvazione_manuale" },
      { type: "number", name: "posti", min: 1, onlyInt: true },
      { type: "number", name: "max_settimana", min: 1, onlyInt: true },
      { type: "number", name: "max_mese", min: 1, onlyInt: true },
      { type: "number", name: "max_sabati_consecutivi", min: 1, onlyInt: true },
      { type: "number", name: "giorni_apertura", min: 1, onlyInt: true },
      { type: "number", name: "giorni_fase2", min: 0, onlyInt: true },
      { type: "number", name: "ore_annullo", min: 0, onlyInt: true },
      ...auto,
    ],
  });
  app.save(impostazioni);

  const s = new Record(impostazioni);
  s.set("prenotazioni_aperte", true);
  s.set("approvazione_manuale", true);
  s.set("posti", 15);
  s.set("max_settimana", 3);
  s.set("max_mese", 8);
  s.set("max_sabati_consecutivi", 3);
  s.set("giorni_apertura", 30);
  s.set("giorni_fase2", 7);
  s.set("ore_annullo", 48);
  app.save(s);

  // ---- impostazioni generali di PocketBase ----
  const st = app.settings();
  st.meta.appName = "Spazio gioco 0/6 – Nido di Quartu Sant'Elena";
  st.meta.senderName = "Spazio gioco 0/6";
  // dietro Caddy l'indirizzo reale del visitatore arriva in X-Forwarded-For (serve ai limiti sulle richieste)
  st.trustedProxy.headers = ["X-Forwarded-For"];
  st.trustedProxy.useLeftmostIP = false;
  // copia di sicurezza automatica ogni notte alle 03:00 (si tengono le ultime 14)
  st.backups.cron = "0 3 * * *";
  st.backups.cronMaxKeep = 14;
  // limiti alle richieste ripetute (contro i tentativi automatici)
  st.rateLimits.enabled = true;
  st.rateLimits.rules = [
    { label: "*:auth", audience: "", duration: 10, maxRequests: 8 },
    { label: "/api/nido/registrazione", audience: "", duration: 600, maxRequests: 10 },
    { label: "/api/nido/password-dimenticata", audience: "", duration: 600, maxRequests: 6 },
    { label: "/api/nido/", audience: "", duration: 10, maxRequests: 40 },
    { label: "/api/", audience: "", duration: 10, maxRequests: 100 },
  ];
  app.save(st);
}, (app) => {
  for (const n of ["impostazioni", "prenotazioni", "giornate", "figli"]) {
    try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {}
  }
});
