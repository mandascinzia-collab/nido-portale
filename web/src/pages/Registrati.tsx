import { useState } from "react";
import { accedi, api } from "../api";
import type { Me } from "../types";
import { IcoFreccia, IcoIndietro, IcoPiu, Intestazione, Loghi } from "../ui";

interface Fg { nome: string; cognome: string; nascita: string }
const vuoto = (): Fg => ({ nome: "", cognome: "", nascita: "" });

export default function Registrati({ dopoAccesso }: { dopoAccesso: (me: Me) => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [tel, setTel] = useState("");
  const [figli, setFigli] = useState<Fg[]>([vuoto()]);
  const [letta, setLetta] = useState(false);
  const [sito, setSito] = useState(""); // campo trappola, deve restare vuoto
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);

  const cambiaFiglio = (i: number, k: keyof Fg, v: string) => setFigli(figli.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const oggi = new Date().toISOString().slice(0, 10);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setErrore("");
    if (pw.length < 10) return setErrore("La password deve avere almeno 10 caratteri.");
    if (pw !== pw2) return setErrore("Le due password non coincidono.");
    if (!letta) return setErrore("Per proseguire conferma di aver letto l'informativa.");
    setAttesa(true);
    try {
      await api.post("/api/nido/registrazione", { email: email.trim(), password: pw, nome, cognome, telefono: tel, figli, consenso: true, sito });
      await accedi(email.trim(), pw);
      dopoAccesso(await api.get<Me>("/api/nido/me"));
    } catch (x: any) { setErrore(x.message); } finally { setAttesa(false); }
  }

  return (
    <>
      <Intestazione><a href="#/" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><IcoIndietro s={18} /> Indietro</a></Intestazione>
      <main className="wrap reg">
        <h1 className="gr" style={{ marginBottom: 18 }}>Crea il tuo account</h1>
        <form onSubmit={invia}>
          <section className="sec">
            <div className="sh"><div className="num">1</div><h2>Il tuo accesso</h2></div>
            <p>Userai l'email e la password per entrare ogni volta.</p>
            <div className="stack">
              <label className="f"><span>Email</span><input className="c" type="email" required placeholder="nome@esempio.it" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <div className="riga2">
                <label className="f"><span>Password</span><input className="c" type="password" required minLength={10} placeholder="Almeno 10 caratteri" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
                <label className="f"><span>Ripeti la password</span><input className="c" type="password" required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
              </div>
            </div>
          </section>

          <section className="sec">
            <div className="sh"><div className="num">2</div><h2>Genitore o tutore/tutrice</h2></div>
            <p>Ti contatteremo solo per le attività a cui sei iscritto/a.</p>
            <div className="stack">
              <div className="riga2">
                <label className="f"><span>Nome</span><input className="c" required autoComplete="given-name" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
                <label className="f"><span>Cognome</span><input className="c" required autoComplete="family-name" value={cognome} onChange={(e) => setCognome(e.target.value)} /></label>
              </div>
              <label className="f"><span>Telefono</span><input className="c" type="tel" required placeholder="Es. 333 1234567" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} /></label>
            </div>
          </section>

          <section className="sec">
            <div className="sh"><div className="num">3</div><h2>Bambino/a</h2></div>
            <p>Lo Spazio gioco è rivolto a bambini e bambine dai 18 mesi ai 6 anni.</p>
            {figli.map((f, i) => (
              <div className="figlio" key={i}>
                <div className="tt">
                  <b>{figli.length === 1 ? "Dati del bambino/a" : (i + 1) + "° bambino/a"}</b>
                  {figli.length > 1 ? <button type="button" className="linkbtn" onClick={() => setFigli(figli.filter((_, j) => j !== i))}>Rimuovi</button> : null}
                </div>
                <div className="riga2">
                  <label className="f"><span>Nome</span><input className="c" required value={f.nome} onChange={(e) => cambiaFiglio(i, "nome", e.target.value)} /></label>
                  <label className="f"><span>Cognome</span><input className="c" required value={f.cognome} onChange={(e) => cambiaFiglio(i, "cognome", e.target.value)} /></label>
                </div>
                <label className="f"><span>Data di nascita</span><input className="c" type="date" required max={oggi} value={f.nascita} onChange={(e) => cambiaFiglio(i, "nascita", e.target.value)} /></label>
              </div>
            ))}
            {figli.length < 4 ? <button type="button" className="btn pic" onClick={() => setFigli([...figli, vuoto()])}><IcoPiu s={18} /> Aggiungi un altro/a bambino/a</button> : null}
            <p className="piccolo" style={{ marginTop: 14 }}>Non inserire informazioni sulla salute: per quelle rivolgiti direttamente al Nido.</p>
          </section>

          <section className="sec">
            <div className="stack">
              <label className="check">
                <input type="checkbox" checked={letta} onChange={(e) => setLetta(e.target.checked)} />
                <span>Ho letto l'<a href="#/informativa" target="_blank" rel="noreferrer">informativa sul trattamento dei dati personali</a> relativa all'uso di questo portale.</span>
              </label>
              <input className="sr" tabIndex={-1} autoComplete="off" aria-hidden="true" value={sito} onChange={(e) => setSito(e.target.value)} />
              {errore ? <div className="errore" role="alert">{errore}</div> : null}
              <button className="btn pieno largo" type="submit" disabled={attesa}>{attesa ? "Un momento…" : "Crea account"} <IcoFreccia s={20} c="#fff" /></button>
              <p className="piccolo" style={{ textAlign: "center" }}>Hai già un account? <a href="#/">Accedi</a></p>
            </div>
          </section>
        </form>
        <Loghi />
      </main>
    </>
  );
}
