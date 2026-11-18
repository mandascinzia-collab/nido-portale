import { useState } from "react";
import type { Me } from "../types";
import { IcoAttesa, IcoAvviso, IcoCalendario, IcoFreccia, IcoInfo, IcoOrologio, IcoCestino, Intestazione, Piede, Scheda } from "../ui";

const CHIAVE = "nido_regole_lette";
const letteInSessione = () => { try { return sessionStorage.getItem(CHIAVE) === "1"; } catch { return false; } };

export default function Regole({ me, esci }: { me: Me; esci: () => void }) {
  const c = me.config;
  const [letto, setLetto] = useState(letteInSessione());
  const cambia = (v: boolean) => { setLetto(v); try { sessionStorage.setItem(CHIAVE, v ? "1" : "0"); } catch { /* ok */ } };

  return (
    <>
      <Intestazione>
        <span className="piccolo">{me.utente.nome} {me.utente.cognome}</span>
        <button className="linkbtn" type="button" onClick={esci}>Esci</button>
      </Intestazione>
      <main className="wrap">
        <section className="intro">
          <div className="pillola">Leggere con attenzione</div>
          <h1 className="gr">Come funziona la prenotazione</h1>
          <p className="lead">I posti dello Spazio gioco sono limitati. Queste regole servono a far partecipare il maggior numero possibile di bambini e bambine.</p>
        </section>

        <div className="colonna">
          <Scheda icona={<IcoOrologio s={26} c="#1f6b5c" />} titolo="Orari e posti">
            <div className="orari">
              <div><div className="n">Spazio gioco</div><div className="s">Dal lunedì al venerdì</div><div className="o">16:30 – 18:30</div></div>
              <div><div className="n">Spazio gioco del sabato mattina</div><div className="s">Il sabato</div><div className="o">8:30 – 12:30</div></div>
              <div className="posti"><div className="x">{c.posti}</div><div className="y">posti per ogni giornata</div></div>
            </div>
          </Scheda>

          <Scheda icona={<IcoCalendario s={26} c="#1f6b5c" />} titolo="Quando puoi prenotare">
            <p>Puoi prenotare le giornate dei <b>prossimi {c.giorniApertura} giorni di calendario</b> (domeniche e festivi compresi). Ogni giorno si apre una nuova giornata: per prenotare più avanti basta accedere di nuovo.</p>
            <div className="avviso"><IcoInfo s={22} c="#6e4200" /><span><b>Non si può prenotare nella stessa giornata.</b> Le prenotazioni per una giornata si chiudono a mezzanotte del giorno prima.</span></div>
          </Scheda>

          <Scheda icona={<IcoAvviso s={26} c="#1f6b5c" />} titolo="Quante giornate si possono prenotare">
            <div className="fasi">
              <div className="f1">
                <div className="barra" />
                <div className="estremi"><span>{c.giorniApertura} giorni prima</span><span>{c.giorniFase2} giorni prima</span></div>
                <div className="nome">Fase 1 · Con i limiti</div>
                <div className="limiti">
                  <div><div className="x">{c.maxSettimana}</div><div className="y">giornate a settimana, più il sabato</div></div>
                  <div><div className="x">{c.maxMese}</div><div className="y">giornate al mese solare</div></div>
                  <div><div className="x">{c.maxSabatiConsecutivi}</div><div className="y">sabati consecutivi</div></div>
                </div>
              </div>
              <div className="f2">
                <div className="barra" />
                <div className="estremi"><span>{c.giorniFase2} giorni prima</span><span>Il giorno prima</span></div>
                <div className="nome">Fase 2 · Limiti sbloccati</div>
                <p>I posti rimasti si aprono a tutti, <b>senza i limiti della fase 1</b>, fino a mezzanotte del giorno prima.</p>
              </div>
            </div>
          </Scheda>

          <div className="griglia">
            <Scheda icona={<IcoAttesa s={26} c="#243b7a" />} titolo="Giornata completa? Lista d'attesa" blu>
              <p>Se una giornata è piena puoi metterti in lista d'attesa.</p>
              <p>Se si libera un posto, lo ottiene chi ha <b>frequentato meno nel mese</b>. A parità, chi si è messo in lista prima.</p>
            </Scheda>
            <Scheda icona={<IcoCestino s={26} c="#1f6b5c" />} titolo="Se non puoi venire">
              <p>Annulla dalla tua area personale <b>almeno {c.oreAnnullo} ore prima</b> della giornata prenotata. Permetterai ad un'altra famiglia di usufruire del servizio.</p>
            </Scheda>
          </div>
        </div>

        <section className="conferma">
          {me.utente.stato !== "approvato" ? (
            <div className="avviso"><IcoInfo s={22} c="#6e4200" /><span>Il tuo account è in attesa di approvazione da parte della Segreteria del Nido. Potrai scegliere le giornate appena sarà approvato.</span></div>
          ) : null}
          <label className="check">
            <input type="checkbox" checked={letto} onChange={(e) => cambia(e.target.checked)} />
            <span>Ho letto e ho capito come funziona la prenotazione.</span>
          </label>
          {letto ? <a className="btn pieno" href="#/prenota">Scegli le giornate <IcoFreccia s={20} c="#fff" /></a> : <button type="button" className="btn" disabled>Scegli le giornate</button>}
          <p className="piccolo">Puoi rileggere queste regole in qualsiasi momento da «Come funziona».</p>
        </section>
        <Piede />
      </main>
    </>
  );
}
