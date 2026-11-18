// REGOLE DI PRENOTAZIONE – funzioni pure, senza dipendenze.
// Questo file è usato da DUE parti: dal server (PocketBase) e dal sito (copiato in web/src/regole.generated.js
// dallo script web/scripts/sync-regole.mjs). Così le regole mostrate a schermo e quelle applicate sono identiche.
// Scritto in stile semplice (var/function) per girare ovunque. Le date sono stringhe "AAAA-MM-GG" (ora di Roma).

(function (root) {
  var R = {};

  R.CFG_DEFAULT = {
    posti: 15,                 // posti per giornata
    maxSettimana: 3,           // giornate dal lunedì al venerdì per bambino/a a settimana (il sabato è in più)
    maxMese: 8,                // giornate per bambino/a nel mese solare (sabati compresi)
    maxSabatiConsecutivi: 3,   // sabati di fila per bambino/a
    giorniApertura: 30,        // si prenota fino a 30 giorni di calendario in avanti
    giorniFase2: 7,            // negli ultimi 7 giorni i limiti si sbloccano
    oreAnnullo: 48,            // si può eliminare una prenotazione fino a 48 ore prima
  };

  function p2(n) { return n < 10 ? "0" + n : "" + n; }

  R.valida = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  };
  R.ms = function (s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  };
  R.fmt = function (ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + "-" + p2(d.getUTCMonth() + 1) + "-" + p2(d.getUTCDate());
  };
  R.aggiungi = function (s, n) { return R.fmt(R.ms(s) + n * 86400000); };
  // Somma n mesi a una data (se il giorno non esiste nel mese di arrivo, usa l'ultimo giorno del mese: 29/2 + 12 mesi = 28/2).
  R.mesiPiu = function (s, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    var tot = (+m[1]) * 12 + (+m[2] - 1) + n, y = Math.floor(tot / 12), mo = tot % 12;
    var ultimo = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return y + "-" + p2(mo + 1) + "-" + p2(Math.min(+m[3], ultimo));
  };
  // Età per frequentare: da 18 mesi compiuti fino al giorno prima del 7° compleanno.
  R.MESI_MIN = 18;
  R.MESI_MAX = 84;
  R.dataInizio = function (nascita) { return R.mesiPiu(nascita, R.MESI_MIN); };
  R.dataFine = function (nascita) { return R.mesiPiu(nascita, R.MESI_MAX); }; // primo giorno NON più ammesso
  // "" se può frequentare in quella data, "piccolo" se non ha ancora 18 mesi, "grande" se ha già 7 anni.
  R.idoneo = function (nascita, data) {
    if (data < R.dataInizio(nascita)) return "piccolo";
    if (data >= R.dataFine(nascita)) return "grande";
    return "";
  };
  R.diff = function (a, b) { return Math.round((R.ms(b) - R.ms(a)) / 86400000); }; // giorni da a a b
  R.dow = function (s) { return new Date(R.ms(s)).getUTCDay(); };                  // 0 = domenica
  R.isSabato = function (s) { return R.dow(s) === 6; };
  R.isDomenica = function (s) { return R.dow(s) === 0; };
  R.lunedi = function (s) { var d = R.dow(s); return R.aggiungi(s, d === 0 ? -6 : 1 - d); }; // inizio settimana (lun–sab)
  R.mese = function (s) { return s.slice(0, 7); };

  // Orario del servizio: lun–ven 16:30–18:30, sabato 8:30–12:30, domenica nessun servizio.
  R.orario = function (s) {
    if (R.isSabato(s)) return { tipo: "sabato", nome: "Spazio gioco del sabato mattina", inizio: "08:30", fine: "12:30", inizioMin: 510 };
    return { tipo: "settimana", nome: "Spazio gioco", inizio: "16:30", fine: "18:30", inizioMin: 990 };
  };

  // Fase di una giornata rispetto a "oggi":
  //  passata | oggi | fase2 (ultimi 7 giorni, limiti sbloccati) | fase1 (da 30 a 8 giorni, con limiti) | presto (non ancora aperta)
  R.fase = function (oggi, data, cfg) {
    var n = R.diff(oggi, data);
    if (n < 0) return "passata";
    if (n === 0) return "oggi";
    if (n <= cfg.giorniFase2) return "fase2";
    if (n <= cfg.giorniApertura) return "fase1";
    return "presto";
  };
  R.apreIl = function (data, cfg) { return R.aggiungi(data, -cfg.giorniApertura); };

  // Ore che mancano all'inizio della giornata. oraMin = minuti dall'inizio di oggi (ora di Roma).
  // inizioMin (facoltativo) = ingresso della giornata se è stato cambiato; altrimenti quello standard.
  R.oreMancanti = function (oggi, oraMin, data, inizioMin) {
    var ini = typeof inizioMin === "number" ? inizioMin : R.orario(data).inizioMin;
    return (R.diff(oggi, data) * 1440 + ini - oraMin) / 60;
  };
  R.eliminabile = function (oggi, oraMin, data, cfg, inizioMin) { return R.oreMancanti(oggi, oraMin, data, inizioMin) >= cfg.oreAnnullo; };
  // "HH:MM" → minuti dalla mezzanotte, oppure -1 se non valido
  R.minuti = function (t) {
    var m = /^(\d{2}):(\d{2})$/.exec(t || "");
    if (!m || +m[1] > 23 || +m[2] > 59) return -1;
    return +m[1] * 60 + +m[2];
  };

  // Limiti della fase 1, per UN bambino/a.
  //  impegnate = date già prenotate (non in lista d'attesa) dallo stesso bambino/a, esclusa "data".
  //  Ritorna null se si può, altrimenti "settimana" | "sabati" | "mese".
  R.limite = function (impegnate, data, cfg) {
    var i, n = 0;
    if (!R.isSabato(data)) {
      var wk = R.lunedi(data);
      for (i = 0; i < impegnate.length; i++) if (!R.isSabato(impegnate[i]) && R.lunedi(impegnate[i]) === wk) n++;
      if (n >= cfg.maxSettimana) return "settimana";
    } else {
      var set = {};
      for (i = 0; i < impegnate.length; i++) if (R.isSabato(impegnate[i])) set[impegnate[i]] = 1;
      var run = 1, x = R.aggiungi(data, -7);
      while (set[x]) { run++; x = R.aggiungi(x, -7); }
      x = R.aggiungi(data, 7);
      while (set[x]) { run++; x = R.aggiungi(x, 7); }
      if (run > cfg.maxSabatiConsecutivi) return "sabati";
    }
    var m = 0;
    for (i = 0; i < impegnate.length; i++) if (R.mese(impegnate[i]) === R.mese(data)) m++;
    if (m >= cfg.maxMese) return "mese";
    return null;
  };

  R.MOTIVI = {
    settimana: "Max 3 a settimana",
    sabati: "Max 3 sabati di fila",
    mese: "Max 8 al mese",
  };

  // Precedenza in lista d'attesa: prima chi ha frequentato meno nel mese, poi chi si è messo in lista prima.
  //  a, b = { mese: numero giornate nel mese, quando: stringa ordinabile (momento di ingresso in lista) }
  R.precedenza = function (a, b) {
    if (a.mese !== b.mese) return a.mese - b.mese;
    return a.quando < b.quando ? -1 : a.quando > b.quando ? 1 : 0;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = R;
  else root.NidoRegole = R;
})(typeof globalThis !== "undefined" ? globalThis : this);
