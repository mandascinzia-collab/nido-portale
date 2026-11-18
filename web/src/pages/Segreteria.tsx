import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { CfgServer, Me } from "../types";
import { fmtGiorno, fmtLunga, fmtMaiusc } from "../date";
import { IcoCestino, IcoPiu, Loghi, Modale } from "../ui";

interface GiornoS { data: string; tipo: string; nome: string; inizio: string; fine: string; fase: string; posti: number; occupati: number; attesa: number; chiusa: boolean; nota: string }
interface Riepilogo { oggi: string; config: CfgServer; giorni: GiornoS[]; kpi: { figliDiversiMese: number; famiglie: number; occupazione7: number; attesaTotale: number; attesaGiorni: number; daApprovare: number } }
interface Riga { id: string; stato: string; presenza: string; daStaff: boolean; figlio: string; eta: string; genitore: string; telefono: string; email: string; mese: number }
interface Dettaglio { data: string; nome: string; inizio: string; fine: string; fase: string; oggi: string; posti: number; chiusa: boolean; nota: string; iscritti: Riga[]; attesa: Riga[] }
interface Famiglia { id: string; nome: string; email: string; telefono: string; stato: string; creato: string; figli: { id: string; nome: string; eta: string }[] }
type Scheda = "giornate" | "famiglie" | "impostazioni";

const meseTxt = (n: number) => (n === 0 ? "Nessuna giornata nel mese" : n + (n === 1 ? " giornata nel mese" : " giornate nel mese"));
const orario = (g: { inizio: string; fine: string }) => g.inizio.replace(/^0/, "") + "–" + g.fine.replace(/^0/, "");

export default function Segreteria({ me, esci }: { me: Me; esci: () => void }) {
  const [scheda, setScheda] = useState<Scheda>("giornate");
  const [riep, setRiep] = useState<Riepilogo | null>(null);
  const [errore, setErrore] = useState("");
  const carica = useCallback(async () => {
    try { setRiep(await api.get<Riepilogo>("/api/nido/staff/riepilogo")); setErrore(""); } catch (x: any) { setErrore(x.message); }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  return (
    <>
      <header className="sh-hd noprint">
        <div>
          <div className="tt"><div className="marca" aria-hidden="true">N</div><div>Segreteria<small>Spazio gioco 0/6 · Nido di Quartu Sant'Elena</small></div></div>
          <nav aria-label="Sezioni">
            {(["giornate", "famiglie", "impostazioni"] as Scheda[]).map((s) => (
              <button key={s} type="button" aria-current={scheda === s ? "page" : undefined} onClick={() => setScheda(s)}>
                {fmtMaiusc(s)}{s === "famiglie" && riep && riep.kpi.daApprovare > 0 ? <span className="pill">{riep.kpi.daApprovare}</span> : null}
              </button>
            ))}
          </nav>
          <span><span className="piccolo">{me.utente.nome} </span><button className="linkbtn" type="button" onClick={esci}>Esci</button></span>
        </div>
      </header>
      <main className="wrap wide" style={{ paddingTop: 24 }}>
        {errore ? <div className="errore" role="alert" style={{ marginBottom: 14 }}>{errore}</div> : null}
        {!riep ? <p>Un momento…</p> : scheda === "giornate" ? <Giornate riep={riep} ricarica={carica} vaiFamiglie={() => setScheda("famiglie")} /> :
          scheda === "famiglie" ? <Famiglie ricarica={carica} /> : <Impostazioni ricarica={carica} />}
        <Loghi />
      </main>
    </>
  );
}

// ------------------------------------------------------------------ GIORNATE
function Giornate({ riep, ricarica, vaiFamiglie }: { riep: Riepilogo; ricarica: () => Promise<void>; vaiFamiglie: () => void }) {
  const [data, setData] = useState(riep.oggi);
  const [det, setDet] = useState<Dettaglio | null>(null);
  const [errore, setErrore] = useState("");
  const [aggiungi, setAggiungi] = useState(false);
  const [togli, setTogli] = useState<Riga | null>(null);
  const k = riep.kpi;

  const apri = useCallback(async () => {
    try { setDet(await api.get<Dettaglio>("/api/nido/staff/giornata?data=" + data)); setErrore(""); } catch (x: any) { setErrore(x.message); }
  }, [data]);
  useEffect(() => { apri(); }, [apri]);
  const tutto = async () => { await apri(); await ricarica(); };

  async function presenza(r: Riga, v: "presente" | "assente") {
    try { await api.post("/api/nido/staff/presenza", { id: r.id, presenza: r.presenza === v ? "" : v }); await apri(); } catch (x: any) { setErrore(x.message); }
  }
  async function rimuovi() {
    if (!togli) return;
    try { await api.post("/api/nido/staff/rimuovi", { id: togli.id }); setTogli(null); await tutto(); } catch (x: any) { setErrore(x.message); setTogli(null); }
  }
  function csv() {
    if (!det) return;
    const righe = [["Data", "Stato", "Bambino/a", "Genitore", "Telefono", "Email", "Presenza"]];
    for (const r of det.iscritti) righe.push([det.data, "Prenotato", r.figlio, r.genitore, r.telefono, r.email, r.presenza]);
    for (const r of det.attesa) righe.push([det.data, "Lista d'attesa", r.figlio, r.genitore, r.telefono, r.email, ""]);
    const testo = "﻿" + righe.map((l) => l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([testo], { type: "text/csv;charset=utf-8" }));
    a.download = "spazio-gioco-" + det.data + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const tag = (g: GiornoS): [string, string] => {
    if (g.chiusa) return ["Chiusa", ""];
    if (g.fase === "oggi") return ["In corso oggi", "g"];
    if (g.occupati >= g.posti) return ["Completa", "r"];
    if (g.fase === "fase2") return ["Fase 2", "y"];
    return ["Fase 1", "b"];
  };

  return (
    <>
      <div className="noprint" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800 }}>Giornate</h1>
        <p className="piccolo">{fmtMaiusc(fmtGiorno(riep.oggi))} {riep.oggi.slice(0, 4)} · prossimi {riep.config.giorniApertura} giorni</p>
      </div>
      <section className="kpis" aria-label="Riepilogo">
        <div className="kpi"><div className="l">Bambini/e diversi/e nel mese</div><div className="v">{k.figliDiversiMese} <span>su {k.famiglie} famiglie iscritte</span></div></div>
        <div className="kpi"><div className="l">Posti occupati, prossimi 7 giorni</div><div className="v">{k.occupazione7}%</div><div className="bar"><div style={{ width: k.occupazione7 + "%" }} /></div></div>
        <div className="kpi"><div className="l">In lista d'attesa</div><div className="v">{k.attesaTotale} <span>su {k.attesaGiorni} {k.attesaGiorni === 1 ? "giornata" : "giornate"}</span></div></div>
        <div className="kpi"><div className="l">Registrazioni da approvare</div><div className="v">{k.daApprovare} {k.daApprovare > 0 ? <button className="linkbtn" style={{ fontSize: 15 }} onClick={vaiFamiglie}>Vai alle famiglie</button> : null}</div></div>
      </section>

      <div className="seg-griglia">
        <section className="elenco-g noprint" aria-label="Elenco giornate">
          <h2>Prossime giornate</h2>
          {riep.giorni.map((g) => {
            const [t, tono] = tag(g);
            return (
              <button type="button" key={g.data} className="giorno-b" aria-pressed={data === g.data} onClick={() => setData(g.data)}>
                <span className="a">
                  <b>{fmtMaiusc(fmtGiorno(g.data))}</b>
                  <small>{g.tipo === "sabato" ? "Sabato mattina" : "Spazio gioco"} · {orario(g)}</small>
                  <span className={"p" + (g.occupati >= g.posti ? " pieno" : "")}><span style={{ width: Math.min(100, Math.round((g.occupati / g.posti) * 100)) + "%" }} /></span>
                </span>
                <span className="b"><b>{g.occupati}/{g.posti}</b><span className={"etichetta " + tono}>{t}</span></span>
              </button>
            );
          })}
        </section>

        <div className="dett">
          {errore ? <div className="errore" role="alert">{errore}</div> : null}
          {det ? (
            <>
              <section>
                <div className="top">
                  <div>
                    <h2>{fmtMaiusc(fmtGiorno(det.data))}</h2>
                    <p className="piccolo">{det.nome} · {orario(det)}{det.chiusa ? " · CHIUSA" : ""}{det.nota ? " · " + det.nota : ""}</p>
                  </div>
                  <div className="az">
                    <button type="button" className="btn pic" onClick={() => setAggiungi(true)}><IcoPiu s={16} /> Aggiungi a mano</button>
                    <button type="button" className="btn pic" onClick={() => window.print()}>Stampa elenco</button>
                    <button type="button" className="btn pic" onClick={csv}>Esporta CSV</button>
                  </div>
                </div>
                <p style={{ margin: "10px 0 0", fontWeight: 700 }}>
                  {det.iscritti.length} di {det.posti} posti occupati
                  {det.data === det.oggi ? <span className="piccolo"> · Presenti {det.iscritti.filter((r) => r.presenza === "presente").length} · Assenti {det.iscritti.filter((r) => r.presenza === "assente").length} · Da segnare {det.iscritti.filter((r) => !r.presenza).length}</span> : null}
                </p>
                <div className="tbl">
                  <div className="r h"><span>Bambino/a</span><span>Genitore e telefono</span><span>Presenza</span></div>
                  {det.iscritti.length === 0 ? <p className="piccolo" style={{ padding: "10px 4px" }}>Nessuna prenotazione per questa giornata.</p> : null}
                  {det.iscritti.map((r) => (
                    <div className="r" key={r.id}>
                      <span><b>{r.figlio}</b><small>{r.eta} · {meseTxt(r.mese)}{r.daStaff ? " · inserito/a a mano" : ""}</small></span>
                      <span>{r.genitore}<small>{r.telefono}</small></span>
                      <span className="pr">
                        {det.data === det.oggi ? (
                          <>
                            <button type="button" className="p" aria-pressed={r.presenza === "presente"} onClick={() => presenza(r, "presente")}>Presente</button>
                            <button type="button" className="a" aria-pressed={r.presenza === "assente"} onClick={() => presenza(r, "assente")}>Assente</button>
                          </>
                        ) : <span className="piccolo">Prenotato</span>}
                        <button type="button" className="x noprint" onClick={() => setTogli(r)} aria-label={"Elimina la prenotazione di " + r.figlio}><IcoCestino s={16} /></button>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2>Lista d'attesa</h2>
                {det.attesa.length === 0 ? <p className="piccolo">Nessuno in lista per questa giornata.</p> : (
                  <>
                    <p className="piccolo">In ordine di precedenza: prima chi ha frequentato meno nel mese, poi chi si è messo in lista prima.</p>
                    {det.attesa.map((r, i) => (
                      <div className="coda-r" key={r.id}>
                        <span className="pos">{i + 1}</span>
                        <span className="nm"><b>{r.figlio}</b><small>{r.genitore} · {r.telefono}</small></span>
                        <span className="piccolo">{meseTxt(r.mese)}</span>
                        <button type="button" className="linkbtn noprint" onClick={() => setTogli(r)}>Togli</button>
                      </div>
                    ))}
                  </>
                )}
              </section>

              <ImpostaGiornata det={det} fatto={tutto} />
            </>
          ) : null}
        </div>
      </div>

      {aggiungi && det ? <AggiungiAMano data={det.data} chiudi={() => setAggiungi(false)} fatto={async () => { setAggiungi(false); await tutto(); }} /> : null}
      {togli ? (
        <Modale etichetta="Conferma">
          <div className="ic"><IcoCestino s={26} c="#8a2a1f" /></div>
          <h2>Togliere dalla giornata?</h2>
          <p>Stai togliendo <b>{togli.figlio}</b> dal {fmtGiorno(det?.data || data)}. Se c'è qualcuno in lista d'attesa, il posto passa a chi ha la precedenza.</p>
          <div className="az"><button className="btn rosso" type="button" onClick={rimuovi}>Conferma</button><button className="btn" type="button" onClick={() => setTogli(null)}>Annulla</button></div>
        </Modale>
      ) : null}
    </>
  );
}

function ImpostaGiornata({ det, fatto }: { det: Dettaglio; fatto: () => Promise<void> }) {
  const [chiusa, setChiusa] = useState(det.chiusa);
  const [posti, setPosti] = useState(String(det.posti));
  const [nota, setNota] = useState(det.nota);
  const [msg, setMsg] = useState("");
  useEffect(() => { setChiusa(det.chiusa); setPosti(String(det.posti)); setNota(det.nota); setMsg(""); }, [det.data, det.chiusa, det.posti, det.nota]);
  async function salva(e: React.FormEvent) {
    e.preventDefault();
    try { await api.post("/api/nido/staff/giornata", { data: det.data, chiusa, posti: parseInt(posti, 10) || 0, nota }); setMsg("Salvato."); await fatto(); }
    catch (x: any) { setMsg(x.message); }
  }
  return (
    <section className="noprint">
      <h2>Impostazioni di questa giornata</h2>
      <form className="stack" onSubmit={salva} style={{ marginTop: 10 }}>
        <label className="check"><input type="checkbox" checked={chiusa} onChange={(e) => setChiusa(e.target.checked)} /><span>Giornata chiusa (festivo o servizio sospeso): non si può prenotare</span></label>
        <div className="riga2">
          <label className="f"><span>Posti disponibili</span><input className="c" type="number" min={1} max={200} value={posti} onChange={(e) => setPosti(e.target.value)} /></label>
          <label className="f"><span>Nota (la vedono le famiglie)</span><input className="c" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><button className="btn pic pieno" type="submit">Salva</button>{msg ? <span className="piccolo">{msg}</span> : null}</div>
      </form>
    </section>
  );
}

function AggiungiAMano({ data, chiudi, fatto }: { data: string; chiudi: () => void; fatto: () => Promise<void> }) {
  const [q, setQ] = useState("");
  const [ris, setRis] = useState<{ id: string; nome: string; genitore: string; approvato: boolean }[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (q.trim().length < 2) { setRis([]); return; }
    const t = setTimeout(() => { api.get<{ figli: typeof ris }>("/api/nido/staff/figli?q=" + encodeURIComponent(q.trim())).then((r) => setRis(r.figli)).catch(() => setRis([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  async function aggiungi(id: string) {
    try {
      const r = await api.post<{ ok: boolean; esito: string }>("/api/nido/staff/aggiungi", { data, figlio: id });
      if (r.ok) return fatto();
      setMsg(r.esito === "gia" ? "È già prenotato/a per questa giornata." : r.esito === "piena" ? "La giornata è piena: aumenta i posti nelle impostazioni della giornata." : r.esito === "chiusa" ? "La giornata è chiusa." : "Non è possibile aggiungerlo/a.");
    } catch (x: any) { setMsg(x.message); }
  }
  return (
    <Modale etichetta="Aggiungi a mano">
      <h2>Aggiungi a mano</h2>
      <p>{fmtMaiusc(fmtGiorno(data))}. Cerca il bambino o la bambina per nome o cognome (la famiglia deve avere un account).</p>
      <input className="c" autoFocus placeholder="Es. Rossi" value={q} onChange={(e) => setQ(e.target.value)} />
      {msg ? <div className="errore" role="alert">{msg}</div> : null}
      <div>
        {ris.map((r) => (
          <div className="coda-r" key={r.id}>
            <span className="nm"><b>{r.nome}</b><small>{r.genitore}{r.approvato ? "" : " · account non ancora approvato"}</small></span>
            <button type="button" className="btn pic" onClick={() => aggiungi(r.id)}>Aggiungi</button>
          </div>
        ))}
        {q.trim().length >= 2 && ris.length === 0 ? <p className="piccolo">Nessun risultato.</p> : null}
      </div>
      <div className="az"><button type="button" className="btn" onClick={chiudi}>Chiudi</button></div>
    </Modale>
  );
}

// ------------------------------------------------------------------ FAMIGLIE
function Famiglie({ ricarica }: { ricarica: () => Promise<void> }) {
  const [elenco, setElenco] = useState<Famiglia[] | null>(null);
  const [errore, setErrore] = useState("");
  const [elimina, setElimina] = useState<Famiglia | null>(null);
  const [filtro, setFiltro] = useState("");
  const carica = useCallback(async () => {
    try { setElenco((await api.get<{ famiglie: Famiglia[] }>("/api/nido/staff/famiglie")).famiglie); } catch (x: any) { setErrore(x.message); }
  }, []);
  useEffect(() => { carica(); }, [carica]);
  async function stato(f: Famiglia, s: string) {
    try { await api.post("/api/nido/staff/famiglia", { id: f.id, stato: s }); await carica(); await ricarica(); } catch (x: any) { setErrore(x.message); }
  }
  async function cancella() {
    if (!elimina) return;
    try { await api.post("/api/nido/staff/famiglia/elimina", { id: elimina.id }); setElimina(null); await carica(); await ricarica(); } catch (x: any) { setErrore(x.message); setElimina(null); }
  }
  const ordine: Record<string, number> = { in_attesa: 0, approvato: 1, rifiutato: 2 };
  const lista = (elenco || []).filter((f) => !filtro || (f.nome + " " + f.email + " " + f.figli.map((x) => x.nome).join(" ")).toLowerCase().includes(filtro.toLowerCase()))
    .sort((a, b) => ordine[a.stato] - ordine[b.stato]);
  const etichetta: Record<string, string> = { in_attesa: "Da approvare", approvato: "Approvata", rifiutato: "Rifiutata" };
  return (
    <>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Famiglie</h1>
      {errore ? <div className="errore" role="alert">{errore}</div> : null}
      <section className="sec">
        <input className="c" placeholder="Cerca per nome, email o bambino/a" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 420 }} />
        {!elenco ? <p>Un momento…</p> : lista.length === 0 ? <p className="piccolo" style={{ marginTop: 12 }}>Nessuna famiglia.</p> : lista.map((f) => (
          <div className="fam" key={f.id}>
            <span><b>{f.nome}</b> <span className={"stato-b " + f.stato}>{etichetta[f.stato]}</span><small>{f.telefono} · {f.email}</small><small>Registrata il {fmtLunga(f.creato)}</small></span>
            <span>{f.figli.map((x) => <small key={x.id} style={{ color: "#22282d" }}>{x.nome} · {x.eta}</small>)}</span>
            <span className="az">
              {f.stato !== "approvato" ? <button type="button" className="btn pic pieno" onClick={() => stato(f, "approvato")}>Approva</button> : null}
              {f.stato === "in_attesa" ? <button type="button" className="btn pic" onClick={() => stato(f, "rifiutato")}>Rifiuta</button> : null}
              <button type="button" className="linkbtn" onClick={() => setElimina(f)}>Elimina account</button>
            </span>
          </div>
        ))}
      </section>
      {elimina ? (
        <Modale etichetta="Conferma">
          <div className="ic"><IcoCestino s={26} c="#8a2a1f" /></div>
          <h2>Eliminare l'account?</h2>
          <p>Verranno cancellati definitivamente l'account di <b>{elimina.nome}</b>, i dati dei bambini e delle bambine e tutte le loro prenotazioni. Usalo, ad esempio, per una richiesta di cancellazione dei dati.</p>
          <div className="az"><button className="btn rosso" type="button" onClick={cancella}>Elimina</button><button className="btn" type="button" onClick={() => setElimina(null)}>Annulla</button></div>
        </Modale>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------ IMPOSTAZIONI
function Impostazioni({ ricarica }: { ricarica: () => Promise<void> }) {
  const [v, setV] = useState<(CfgServer & { approvazione: boolean }) | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { api.get<CfgServer & { approvazione: boolean }>("/api/nido/staff/impostazioni").then(setV).catch((x) => setMsg(x.message)); }, []);
  if (!v) return <p>{msg || "Un momento…"}</p>;
  const num = (k: keyof CfgServer, etichetta: string, min = 0) => (
    <label className="f"><span>{etichetta}</span><input className="c" type="number" min={min} value={String(v[k] as number)} onChange={(e) => setV({ ...v, [k]: parseInt(e.target.value, 10) || 0 })} /></label>
  );
  async function salva(e: React.FormEvent) {
    e.preventDefault();
    try { await api.post("/api/nido/staff/impostazioni", v); setMsg("Impostazioni salvate."); await ricarica(); } catch (x: any) { setMsg(x.message); }
  }
  return (
    <>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Impostazioni</h1>
      <section className="sec">
        <p>Le regole valgono per tutte le prenotazioni <b>nuove</b>. Le prenotazioni già fatte non cambiano.</p>
        <form onSubmit={salva}>
          <div className="stack">
            <label className="check"><input type="checkbox" checked={v.aperte} onChange={(e) => setV({ ...v, aperte: e.target.checked })} /><span>Prenotazioni aperte (togli la spunta per sospenderle)</span></label>
            <label className="check"><input type="checkbox" checked={v.approvazione} onChange={(e) => setV({ ...v, approvazione: e.target.checked })} /><span>Le nuove registrazioni devono essere approvate dalla Segreteria</span></label>
          </div>
          <div className="imp">
            {num("posti", "Posti per giornata", 1)}
            {num("maxSettimana", "Giornate a settimana per bambino/a (lun–ven)", 1)}
            {num("maxMese", "Giornate al mese solare per bambino/a", 1)}
            {num("maxSabatiConsecutivi", "Sabati consecutivi per bambino/a", 1)}
            {num("giorniApertura", "Giorni di calendario prenotabili in anticipo", 1)}
            {num("giorniFase2", "Giorni prima in cui i limiti si sbloccano (fase 2)")}
            {num("oreAnnullo", "Ore prima entro cui si può eliminare una prenotazione")}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><button className="btn pieno" type="submit">Salva</button>{msg ? <span className="piccolo" role="status">{msg}</span> : null}</div>
        </form>
        <p className="piccolo" style={{ marginTop: 18 }}>Il testo della pagina «Come funziona» si aggiorna da solo con questi valori.</p>
      </section>
      <ChiusureProgrammate ricarica={ricarica} />
    </>
  );
}

interface Chiusura { data: string; nota: string; prenotazioni: number }

// Chiusure (festivi, ponti, vacanze) impostabili anche molto in anticipo, oltre i giorni prenotabili dalle famiglie.
function ChiusureProgrammate({ ricarica }: { ricarica: () => Promise<void> }) {
  const [oggi, setOggi] = useState("");
  const [elenco, setElenco] = useState<Chiusura[] | null>(null);
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [nota, setNota] = useState("");
  const [msg, setMsg] = useState("");
  const [occupato, setOccupato] = useState(false);
  const carica = useCallback(async () => {
    try { const r = await api.get<{ oggi: string; chiusure: Chiusura[] }>("/api/nido/staff/chiusure"); setOggi(r.oggi); setElenco(r.chiusure); } catch (x: any) { setMsg(x.message); }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  async function chiudi(e: React.FormEvent) {
    e.preventDefault();
    if (!da) { setMsg("Scegli il primo giorno di chiusura."); return; }
    setOccupato(true);
    try {
      const r = await api.post<{ chiuse: number; conPrenotazioni: number }>("/api/nido/staff/chiusure", { da, a: a || da, nota });
      setMsg(r.chiuse + (r.chiuse === 1 ? " giornata chiusa." : " giornate chiuse.") + (r.conPrenotazioni > 0 ? " Attenzione: " + r.conPrenotazioni + (r.conPrenotazioni === 1 ? " di queste ha" : " di queste hanno") + " già prenotazioni, che restano valide: avvisa le famiglie." : " Le domeniche sono escluse."));
      setDa(""); setA(""); setNota("");
      await carica(); await ricarica();
    } catch (x: any) { setMsg(x.message); } finally { setOccupato(false); }
  }
  async function riapri(d: string) {
    try { await api.post("/api/nido/staff/chiusure/riapri", { data: d }); setMsg(fmtMaiusc(fmtGiorno(d)) + ": giornata riaperta."); await carica(); await ricarica(); } catch (x: any) { setMsg(x.message); }
  }

  return (
    <section className="sec" style={{ marginTop: 24 }}>
      <h2>Chiusure programmate</h2>
      <p>Imposta in anticipo i giorni in cui il servizio è chiuso (festivi, ponti, vacanze). Le famiglie vedono la chiusura, con la tua nota, quando quel giorno entra nel periodo prenotabile. Le domeniche sono escluse.</p>
      <form onSubmit={chiudi}>
        <div className="imp">
          <label className="f"><span>Dal</span><input className="c" type="date" min={oggi} value={da} onChange={(e) => { setDa(e.target.value); if (!a || a < e.target.value) setA(e.target.value); }} /></label>
          <label className="f"><span>Al (incluso)</span><input className="c" type="date" min={da || oggi} value={a} onChange={(e) => setA(e.target.value)} /></label>
          <label className="f"><span>Nota (la vedono le famiglie)</span><input className="c" type="text" maxLength={300} placeholder="Es. Vacanze di Natale" value={nota} onChange={(e) => setNota(e.target.value)} /></label>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn pieno" type="submit" disabled={occupato}>Chiudi questi giorni</button>
          {msg ? <span className="piccolo" role="status">{msg}</span> : null}
        </div>
      </form>
      <h3 style={{ marginTop: 22, fontSize: 18, fontWeight: 800 }}>Giornate chiuse da oggi in poi</h3>
      {elenco === null ? <p className="piccolo">Un momento…</p> : elenco.length === 0 ? <p className="piccolo">Nessuna chiusura programmata.</p> : (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {elenco.map((c) => (
            <li key={c.data} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", padding: "10px 0", borderTop: "1px solid var(--linea, #e6dfd2)" }}>
              <span><b>{fmtMaiusc(fmtGiorno(c.data))} {c.data.slice(0, 4)}</b>{c.nota ? " · " + c.nota : ""}{c.prenotazioni > 0 ? " · " + c.prenotazioni + (c.prenotazioni === 1 ? " prenotazione già presente" : " prenotazioni già presenti") : ""}</span>
              <button className="btn" type="button" onClick={() => riapri(c.data)}>Riapri</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

