import { useState } from "react";
import { api, impostaNuovaPassword } from "../api";
import { IcoIndietro, Intestazione, Loghi } from "../ui";

// Richiesta del link ("password dimenticata")
export function PasswordDimenticata() {
  const [email, setEmail] = useState("");
  const [inviata, setInviata] = useState(false);
  const [errore, setErrore] = useState("");
  const [attesa, setAttesa] = useState(false);
  async function invia(e: React.FormEvent) {
    e.preventDefault(); setErrore(""); setAttesa(true);
    try { await api.post("/api/nido/password-dimenticata", { email: email.trim() }); setInviata(true); }
    catch (x: any) { setErrore(x.message); } finally { setAttesa(false); }
  }
  return (
    <>
      <Intestazione><a href="#/" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><IcoIndietro s={18} /> Indietro</a></Intestazione>
      <main className="wrap reg">
        <h1 className="gr" style={{ marginBottom: 18 }}>Password dimenticata</h1>
        <section className="sec">
          {inviata ? (
            <div className="stack">
              <div className="ok" role="status">Se l'indirizzo è registrato, ti abbiamo scritto un'email con il link per scegliere una nuova password.</div>
              <p className="piccolo">Controlla anche la cartella dello spam. Il link vale 2 ore.</p>
              <a className="btn" href="#/">Torna all'accesso</a>
            </div>
          ) : (
            <form className="stack" onSubmit={invia}>
              <p>Scrivi l'email con cui ti sei registrato/a: ti mandiamo un link per scegliere una nuova password.</p>
              <label className="f"><span>Email</span><input className="c" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              {errore ? <div className="errore" role="alert">{errore}</div> : null}
              <button className="btn pieno" type="submit" disabled={attesa}>{attesa ? "Un momento…" : "Invia il link"}</button>
            </form>
          )}
        </section>
        <Loghi />
      </main>
    </>
  );
}

// Scelta della nuova password (si arriva dal link ricevuto per email)
export function NuovaPassword({ token }: { token: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [errore, setErrore] = useState("");
  const [fatto, setFatto] = useState(false);
  const [attesa, setAttesa] = useState(false);
  async function invia(e: React.FormEvent) {
    e.preventDefault(); setErrore("");
    if (pw.length < 10) return setErrore("La password deve avere almeno 10 caratteri.");
    if (pw !== pw2) return setErrore("Le due password non coincidono.");
    setAttesa(true);
    try { await impostaNuovaPassword(token, pw); setFatto(true); }
    catch (x: any) { setErrore(x.message); } finally { setAttesa(false); }
  }
  return (
    <>
      <Intestazione />
      <main className="wrap reg">
        <h1 className="gr" style={{ marginBottom: 18 }}>Scegli una nuova password</h1>
        <section className="sec">
          {fatto ? (
            <div className="stack">
              <div className="ok" role="status">Fatto: la tua password è stata cambiata.</div>
              <a className="btn pieno" href="#/">Accedi</a>
            </div>
          ) : (
            <form className="stack" onSubmit={invia}>
              <label className="f"><span>Nuova password</span><input className="c" type="password" required minLength={10} placeholder="Almeno 10 caratteri" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
              <label className="f"><span>Ripeti la password</span><input className="c" type="password" required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
              {errore ? <div className="errore" role="alert">{errore}</div> : null}
              <button className="btn pieno" type="submit" disabled={attesa}>{attesa ? "Un momento…" : "Salva la nuova password"}</button>
              <a className="piccolo" href="#/password">Il link non funziona? Richiedine uno nuovo</a>
            </form>
          )}
        </section>
        <Loghi />
      </main>
    </>
  );
}
