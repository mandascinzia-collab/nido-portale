import { useState } from "react";
import { accedi, api } from "../api";
import type { Me } from "../types";
import { IcoAccedi, IcoFreccia, IcoNuovo, Piede, Wordmark } from "../ui";

export default function Accesso({ dopoAccesso }: { dopoAccesso: (me: Me) => void }) {
  const [form, setForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    setErrore(""); setAttesa(true);
    try {
      await accedi(email.trim(), password);
      const me = await api.get<Me>("/api/nido/me");
      dopoAccesso(me);
    } catch (x: any) { setErrore(x.message); } finally { setAttesa(false); }
  }

  return (
    <>
      <Wordmark />
      <main className="wrap accesso">
        <section style={{ padding: "18px 0 6px" }}>
          <h1>Benvenuti allo Spazio gioco 0/6 del Nido</h1>
          <p className="lead">Un servizio in orario extra rispetto alla normale attività del Nido. Crea l'account della tua famiglia una volta sola: potrai prenotare le giornate che ti interessano e gestirle quando vuoi.</p>
        </section>

        <div className="due">
          <section className="verde">
            <div className="ico"><IcoNuovo s={30} c="#fff" /></div>
            <h2>Prima volta qui?<br />Registrati</h2>
            <p>Inserisci i tuoi dati e quelli del bambino/a una sola volta.</p>
            <div style={{ flex: 1 }} />
            <a className="btn bianco" href="#/registrati">Crea il tuo account <IcoFreccia s={20} /></a>
          </section>

          <section className="bianca">
            <div className="ico"><IcoAccedi s={30} c="#1f6b5c" /></div>
            <h2>Hai già un account?<br />Accedi</h2>
            {!form ? (
              <>
                <p>Entra con la tua email e la tua password per prenotare nuove giornate o gestire quelle già scelte.</p>
                <div style={{ flex: 1 }} />
                <button className="btn" type="button" onClick={() => setForm(true)}>Accedi <IcoFreccia s={20} /></button>
              </>
            ) : (
              <form className="stack" onSubmit={invia}>
                <label className="f"><span>Email</span><input className="c" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                <label className="f"><span>Password</span><input className="c" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
                {errore ? <div className="errore" role="alert">{errore}</div> : null}
                <button className="btn pieno" type="submit" disabled={attesa}>{attesa ? "Un momento…" : "Accedi"} <IcoFreccia s={20} c="#fff" /></button>
              </form>
            )}
            <a className="centro" href="#/password">Ho dimenticato la password</a>
          </section>
        </div>
        <Piede />
      </main>
    </>
  );
}
