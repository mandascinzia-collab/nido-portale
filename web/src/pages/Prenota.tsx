import { useCallback, useEffect, useMemo, useState } from "react";
import R from "../regole.generated.js";
import type { Motivo } from "../regole.generated.js";
import { api } from "../api";
import type { Calendario, Esito, Giorno, Me } from "../types";
import { ddmm, elencoNomi, fmtBreve, fmtGiorno, fmtLunga } from "../date";
import { CONTATTI, IcoAvviso, IcoCalendario, IcoCestino, IcoCheck, IcoInfo, Intestazione, Modale, Piede } from "../ui";

type Sel = Record<string, Record<string, true>>; // idFiglio → { data → true }

export default function Prenota({ me, esci }: { me: Me; esci: () => void }) {
  const [cal, setCal] = useState<Calendario | null>(null);
  const [errore, setErrore] = useState("");
  const [act, setAct] = useState<Record<string, boolean>>({ [me.figli[0]?.id]: true });
  const [sel, setSel] = useState<Sel>({});
  const [conf, setConf] = useState<{ data: string; nomi: string[]; pids: string[] } | null>(null);
  const [esiti, setEsiti] = useState<{ riga: string; ok: boolean }[] | null>(null);
  const [lavoro, setLavoro] = useState(false);

  const carica = useCallback(async () => {
    try { setCal(await api.get<Calendario>("/api/nido/calendario")); setErrore(""); }
    catch (x: any) { setErrore(x.message); }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  const figli = me.figli;
  const primo = (id: string) => figli.find((f) => f.id === id)?.nome ?? "";

  const calc = useMemo(() => {
    if (!cal) return null;
    const cfg = cal.config;
    const giorniVisibili = cal.giorni.filter((g) => g.fase !== "passata");
    const piena = (g: Giorno) => g.occupati >= g.posti;
    const selPren = (fid: string) => Object.keys(sel[fid] || {}).filter((d) => { const g = giorniVisibili.find((x) => x.data === d); return g && !piena(g); });
    const impegni = (fid: string, escludi?: string) => (cal.impegni[fid] || []).concat(selPren(fid)).filter((d) => d !== escludi);
    const targets = figli.filter((f) => act[f.id]);
    const isAll = targets.length > 1;
    const meseOggi = R.mese(cal.oggi);
    const meseDi = (fid: string) => impegni(fid).filter((d) => R.mese(d) === meseOggi).length;
    const motivoTesto = (m: Motivo) => (m === "settimana" ? "Max " + cfg.maxSettimana + " a settimana" : m === "sabati" ? "Max " + cfg.maxSabatiConsecutivi + " sabati di fila" : "Max " + cfg.maxMese + " al mese");

    const righe = giorniVisibili.map((g) => {
      const chiusoPerTutti = g.fase === "oggi" || g.fase === "presto" || g.chiusa;
      const sts = targets.map((f) => {
        const gf = g.figli.find((x) => x.id === f.id)!;
        const existing = gf.stato !== null;
        const pressed = !!sel[f.id]?.[g.data];
        const motivo = !existing && !pressed && !chiusoPerTutti && g.fase === "fase1" ? R.limite(impegni(f.id, g.data), g.data, cfg) : null;
        return { f, gf, existing, pressed, blocked: !!motivo, motivo };
      });
      const existing = sts.length > 0 && sts.every((x) => x.existing);
      const elig = sts.filter((x) => !x.existing && !x.blocked && !chiusoPerTutti);
      const pressed = elig.length > 0 && elig.every((x) => x.pressed);
      const blocked = !existing && !chiusoPerTutti && elig.length === 0;
      const piano = piena(g);
      const attesa = existing ? sts.every((x) => x.gf.stato === "attesa") : piano;
      const disabled = !cal.approvato || !cfg.aperte || chiusoPerTutti || existing || blocked;
      const liberi = Math.max(0, g.posti - g.occupati);

      let badge = "", tono = "";
      if (liberi > 1) badge = liberi + " posti";
      else if (liberi === 1) { badge = "1 posto"; tono = "poco"; }
      if (piano) { badge = pressed ? "In lista d'attesa" : "Completo · lista d'attesa"; tono = "coda"; }
      if (g.chiusa) { badge = "Chiusa"; tono = "grigio"; }
      else if (g.fase === "oggi") { badge = "Non prenotabile"; tono = "grigio"; }
      else if (g.fase === "presto") { badge = "Dal " + ddmm(g.apreIl || g.data); tono = "grigio"; }
      if (blocked) { const m = sts.find((x) => x.motivo)?.motivo; badge = m ? motivoTesto(m) : "Limite raggiunto"; tono = "grigio"; }
      if (existing) { badge = attesa ? "In lista d'attesa" : "Prenotata"; tono = attesa ? "mioatt" : "mio"; }

      const dom = R.diff(cal.oggi, g.data) === 1;
      let orario = g.inizio.replace(/^0/, "") + " – " + g.fine.replace(/^0/, "");
      if (dom && !chiusoPerTutti) orario += " · prenota entro stanotte";
      if (piano && g.attesa > 0 && !chiusoPerTutti) orario += " · " + g.attesa + " in coda";
      if (g.nota) orario += " · " + g.nota;
      if (isAll && !blocked && !existing) {
        const fuori = sts.filter((x) => x.blocked).map((x) => x.f.nome);
        if (fuori.length) orario += " · " + elencoNomi(fuori) + " non disponibile (limite raggiunto)";
      }

      const prenPer: string[] = [], attPer: string[] = [];
      for (const f of figli) {
        const gf = g.figli.find((x) => x.id === f.id)!;
        if (gf.stato === "prenotata") prenPer.push(f.nome);
        else if (gf.stato === "attesa") attPer.push(f.nome);
        else if (sel[f.id]?.[g.data]) (piano ? attPer : prenPer).push(f.nome);
      }
      const esist = sts.filter((x) => x.existing);
      const eliminabile = esist.length > 0 && esist.every((x) => (x.gf.stato === "prenotata" ? g.eliminabile : g.fase !== "oggi"));
      return { g, sts, elig, existing, pressed, blocked, attesa, piano, disabled, badge, tono, orario, prenPer, attPer, esist, eliminabile,
        sab: g.tipo === "sabato", f2: g.fase === "fase2", dom, oggi: g.fase === "oggi" };
    });

    // riepilogo laterale
    const scelte: { data: string; chi: string; att: boolean }[] = [];
    let nPren = 0, nAtt = 0;
    for (const f of figli) for (const d of Object.keys(sel[f.id] || {})) {
      const g = giorniVisibili.find((x) => x.data === d);
      if (!g) continue;
      const att = piena(g);
      scelte.push({ data: d, chi: f.nome + " · " + g.nome + (att ? " · in attesa" : ""), att });
      if (att) nAtt++; else nPren++;
    }
    scelte.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    return { cfg, righe, targets, isAll, meseDi, scelte, nPren, nAtt };
  }, [cal, sel, act, figli]);

  const segnaFiglio = (id: string) => {
    const n = { ...act };
    if (n[id]) { if (Object.keys(n).filter((k) => n[k]).length > 1) delete n[id]; } else n[id] = true;
    setAct(n);
  };

  const toggle = (data: string, ids: string[], giaSel: boolean) => {
    const n: Sel = { ...sel };
    for (const id of ids) {
      const m = { ...(n[id] || {}) };
      if (giaSel) delete m[data]; else m[data] = true;
      n[id] = m;
    }
    setSel(n); setEsiti(null);
  };

  async function prenota() {
    const per: Record<string, string[]> = {};
    for (const f of figli) for (const d of Object.keys(sel[f.id] || {})) (per[d] = per[d] || []).push(f.id);
    const richieste = Object.entries(per).map(([data, f]) => ({ data, figli: f }));
    if (richieste.length === 0) return;
    setLavoro(true); setErrore("");
    try {
      const r = await api.post<{ esiti: Esito[] }>("/api/nido/prenota", { richieste });
      const righe = r.esiti.map((e) => {
        const dove = fmtBreve(e.data), chi = primo(e.figlio);
        if (e.esito === "prenotata") return { riga: chi + " · " + dove + " · prenotata", ok: true };
        if (e.esito === "attesa") return { riga: chi + " · " + dove + " · in lista d'attesa", ok: true };
        const motivo = e.esito === "limite" ? "limite raggiunto" : e.esito === "gia" ? "già prenotata" : e.esito === "chiusa" ? "giornata chiusa" : "non prenotabile";
        return { riga: chi + " · " + dove + " · non prenotata (" + motivo + ")", ok: false };
      });
      setEsiti(righe); setSel({});
      await carica();
    } catch (x: any) { setErrore(x.message); } finally { setLavoro(false); }
  }

  async function elimina() {
    if (!conf) return;
    setLavoro(true);
    try {
      for (const pid of conf.pids) await api.post("/api/nido/annulla", { id: pid });
      setConf(null); setEsiti(null);
      await carica();
    } catch (x: any) { setErrore(x.message); setConf(null); await carica(); } finally { setLavoro(false); }
  }

  if (!cal || !calc) {
    return (
      <>
        <Intestazione><span className="piccolo">{me.utente.nome} {me.utente.cognome}</span><button className="linkbtn" onClick={esci}>Esci</button></Intestazione>
        <main className="wrap"><p>{errore || "Un momento, carico le giornate…"}</p></main>
      </>
    );
  }
  const { cfg, righe, targets, isAll, meseDi, scelte, nPren, nAtt } = calc;
  const nomiSel = elencoNomi(targets.map((f) => f.nome));

  return (
    <>
      <Intestazione>
        <a href="#/regole">Come funziona</a>
        <button className="linkbtn" type="button" onClick={() => document.getElementById("gestisci")?.scrollIntoView({ behavior: "smooth" })}>Gestisci o annulla una prenotazione</button>
        <button className="linkbtn" type="button" onClick={esci}>Esci</button>
      </Intestazione>
      <main className="wrap" style={{ maxWidth: 1180 }}>
        <section className="pren-tit">
          <h1>Prenota le giornate di Spazio gioco</h1>
          <div className="finestra"><IcoCalendario s={22} /> Puoi prenotare fino al {fmtLunga(cal.ultimoPrenotabile)}</div>
          <p className="piccolo" style={{ marginTop: 10 }}>Non si può prenotare nella stessa giornata: le prenotazioni chiudono a mezzanotte del giorno prima.</p>
          {!cal.approvato ? <div className="avviso" style={{ marginTop: 14 }}><IcoInfo s={22} c="#6e4200" /><span>Il tuo account è in attesa di approvazione da parte della Segreteria del Nido. Appena sarà approvato potrai scegliere le giornate: ti scriveremo un'email.</span></div> : null}
          {cal.approvato && !cfg.aperte ? <div className="avviso" style={{ marginTop: 14 }}><IcoInfo s={22} c="#6e4200" /><span>Le prenotazioni sono temporaneamente chiuse.</span></div> : null}
          {errore ? <div className="errore" role="alert" style={{ marginTop: 14 }}>{errore}</div> : null}
        </section>

        <div className="layout">
          <div className="centro">
            <section aria-label="Per chi prenoti">
              <h2 style={{ fontSize: 22, fontWeight: 800 }}>Per chi prenoti?</h2>
              {figli.length > 1 ? <p className="piccolo" style={{ margin: "4px 0 10px" }}>Spunta uno o più figli/e: i limiti e le prenotazioni restano separati per ciascuno/a.</p> : <div style={{ height: 10 }} />}
              <div className="figli">
                {figli.map((f) => {
                  const on = !!act[f.id];
                  const n = Object.keys(sel[f.id] || {}).length;
                  return (
                    <button type="button" key={f.id} className="fig" aria-pressed={on} onClick={() => segnaFiglio(f.id)}>
                      <span className="av" aria-hidden="true">{f.nome.charAt(0)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="nm">{f.nome} {f.cognome.charAt(0)}.</span>
                        <span className="sb">{f.eta} · {meseDi(f.id)} di {cfg.maxMese} nel mese</span>
                        {n > 0 ? <span className="sl">{n} {n === 1 ? "giornata selezionata" : "giornate selezionate"}</span> : null}
                      </span>
                      {on ? <IcoCheck s={22} c="#1f6b5c" /> : null}
                    </button>
                  );
                })}
              </div>
              {figli.length > 1 ? <p className="piccolo" style={{ marginTop: 10 }}>Puoi spuntare più di un figlio/a: la giornata che scegli viene prenotata per ognuno/a di loro (se qualcuno/a ha raggiunto il limite, per lui/lei non viene prenotata). Per scegliere giornate diverse, lascia un solo figlio/a con la spunta. Poi premi «Prenota».</p> : null}
            </section>

            <div className="blocco">
              <h2>Giornate per <span>{nomiSel}</span></h2>
              <div className="regole2">
                <div><h3>Spazio gioco</h3><span className="regola"><IcoAvviso s={16} /> Max {cfg.maxSettimana} a settimana · {cfg.maxMese} al mese</span></div>
                <div><h3>Spazio gioco del sabato mattina</h3><span className="regola"><IcoAvviso s={16} /> Max {cfg.maxSabatiConsecutivi} sabati consecutivi</span></div>
              </div>

              {righe.map((r) => (
                <div className="cella" key={r.g.data}>
                  <button type="button" className={"riga" + (r.pressed ? " sel" : "") + (r.existing ? " esiste" : "") + (r.attesa ? " att" : "") + (r.disabled && !r.existing ? " off" : "")}
                    disabled={r.disabled} aria-pressed={r.pressed || r.existing}
                    onClick={() => toggle(r.g.data, r.elig.map((x) => x.f.id), r.pressed)}>
                    <span className="box" aria-hidden="true">{r.pressed || r.existing ? <IcoCheck s={18} c="#fff" /> : null}</span>
                    <span className="txt">
                      <span className="g">
                        <span>{fmtGiorno(r.g.data)}{r.oggi ? " · oggi" : r.dom ? " · domani" : ""}</span>
                        {r.sab ? <span className="tag sab">Sabato mattina</span> : null}
                        {r.f2 && !r.g.chiusa ? <span className="tag f2">Fase 2 · posti per tutti</span> : null}
                        {r.prenPer.length ? <span className="tag chi">Prenotata per {elencoNomi(r.prenPer)}</span> : null}
                        {r.attPer.length ? <span className="tag chi att">In lista d'attesa per {elencoNomi(r.attPer)}</span> : null}
                      </span>
                      <span className="o">{r.orario}</span>
                    </span>
                    <span className={"badge " + r.tono}>{r.badge}</span>
                  </button>
                  {r.esist.length > 0 ? (
                    <span className="cestino">
                      <span className="tip">{r.eliminabile ? "Elimina questa prenotazione" : "Non si può più eliminare (mancano meno di " + cfg.oreAnnullo + " ore)"}</span>
                      <button type="button" aria-label={r.eliminabile ? "Elimina questa prenotazione" : "Non si può più eliminare"} aria-disabled={!r.eliminabile}
                        onClick={() => { if (r.eliminabile) setConf({ data: r.g.data, nomi: r.esist.map((x) => x.f.nome), pids: r.esist.map((x) => x.gf.pid as string) }); }}>
                        <IcoCestino s={22} />
                      </button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="piccolo" style={{ marginTop: 18 }}>Non trovi la giornata che cerchi? Contatta il Nido: <b>{CONTATTI.telefono} · {CONTATTI.email}</b></p>
          </div>

          <aside>
            <div className="box">
              {!esiti ? (
                <>
                  <h2>La tua selezione</h2>
                  <div className="tot">{nPren}<span> {nPren === 1 ? "giornata" : "giornate"}</span></div>
                  {nAtt > 0 ? <div className="att">+ {nAtt} in lista d'attesa</div> : null}
                  <ul>{scelte.map((s, i) => <li key={s.data + i}><span>{fmtBreve(s.data)}</span><span>{s.chi}</span></li>)}</ul>
                  {scelte.length === 0 ? <p className="piccolo">Nessuna giornata selezionata. Tocca una giornata per aggiungerla.</p> : null}
                  <button type="button" className="btn pieno largo" disabled={scelte.length === 0 || lavoro || !cal.approvato} onClick={prenota}>{lavoro ? "Un momento…" : "Prenota"}</button>
                  <p className="nota">Puoi eliminare una prenotazione fino a {cfg.oreAnnullo} ore prima.</p>
                </>
              ) : (
                <div className="esiti">
                  <div className="salvata"><IcoCheck s={26} c="#1f6b5c" /> {esiti.some((e) => e.ok) ? "Prenotazione salvata" : "Nessuna prenotazione salvata"}</div>
                  <ul>{esiti.map((e, i) => <li key={i} className={e.ok ? "" : "no"}><span>{e.riga}</span></li>)}</ul>
                  <div className="nota">Le tue prenotazioni restano salvate: puoi rientrare quando vuoi per vederle o per prenotare altre giornate. Per eliminarne una, usa il cestino accanto alla giornata (fino a {cfg.oreAnnullo} ore prima).</div>
                </div>
              )}
            </div>
          </aside>
        </div>
        <Piede />
      </main>

      {conf ? (
        <Modale etichetta="Conferma eliminazione">
          <div className="ic"><IcoCestino s={26} c="#8a2a1f" /></div>
          <h2>Eliminare la prenotazione?</h2>
          <p>Stai eliminando la prenotazione del <b>{fmtBreve(conf.data)}</b> per <b>{elencoNomi(conf.nomi)}</b>.</p>
          <div className="az">
            <button type="button" className="btn rosso" disabled={lavoro} onClick={elimina}>Conferma</button>
            <button type="button" className="btn" onClick={() => setConf(null)}>Annulla</button>
          </div>
        </Modale>
      ) : null}
    </>
  );
}

