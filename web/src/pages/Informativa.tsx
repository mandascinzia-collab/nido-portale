import type { ReactNode } from "react";
import { IcoInfo, Intestazione, Piede, CONTATTI } from "../ui";

const Num = ({ n, t, children }: { n: number; t: string; children: ReactNode }) => (
  <section className="sec">
    <div className="sh"><div className="num" aria-hidden="true">{n}</div><h2>{t}</h2></div>
    {children}
  </section>
);

export default function Informativa({ indietro }: { indietro: string }) {
  return (
    <>
      <Intestazione />
      <main className="wrap">
        <section className="intro">
          <h1 className="gr">Informativa sul trattamento dei dati personali</h1>
          <p className="lead">Come usiamo i dati tuoi e del bambino/a nel portale di prenotazione dello Spazio gioco. Informativa ai sensi dell'art. 13 del Regolamento UE 2016/679 e del D.Lgs. 196/2003, come modificato dal D.Lgs. 101/2018.</p>
          <div className="avviso" style={{ marginTop: 16, maxWidth: 680 }}><IcoInfo s={22} c="#6e4200" /><span>Il bambino/a frequenta già il Nido e le autorizzazioni sono già state date: <b>qui non c'è niente da firmare.</b></span></div>
        </section>

        <div className="griglia">
          <div className="colonna">
            <Num n={1} t="Chi è il titolare del trattamento">
              <p>Il titolare è l'<b>ATI</b> (Associazione Temporanea di Imprese) che gestisce il Nido Comunale di Quartu Sant'Elena e lo Spazio gioco del progetto GENE-ATTORI. I responsabili sono il <b>dr. Dimitri Pibiri</b> e la <b>sig.ra Cinzia Mandas</b>.</p>
              <p>Per qualsiasi richiesta sui tuoi dati: <b>{CONTATTI.email}</b>.</p>
            </Num>
            <Num n={2} t="Quali dati usiamo">
              <ul>
                <li><b>Genitore o tutore/tutrice:</b> nome, cognome, email, telefono e la password per entrare (conservata in forma cifrata).</li>
                <li><b>Bambino/a:</b> nome, cognome e data di nascita.</li>
                <li><b>Uso del servizio:</b> giornate prenotate o annullate, lista d'attesa e presenze.</li>
                <li>Il portale non chiede informazioni sulla salute. Quelle eventualmente già date al Nido restano nella documentazione del Nido.</li>
              </ul>
            </Num>
            <Num n={3} t="Perché li usiamo">
              <ul>
                <li>Gestire il tuo account e le prenotazioni dello Spazio gioco.</li>
                <li>Gestire i posti, la lista d'attesa e la frequenza, secondo le regole che trovi in «Come funziona».</li>
                <li>Contattarti per comunicazioni legate al servizio, come il link per cambiare la password o l'avviso di un posto liberato.</li>
                <li>Rendicontare il progetto a chi lo finanzia e fare statistiche e rilevazioni sulla soddisfazione: in questo caso i dati sono usati in forma <b>anonima o aggregata</b>.</li>
              </ul>
              <p>Non usiamo i dati per pubblicità e non li vendiamo.</p>
            </Num>
            <Num n={4} t="Su quali basi">
              <p>I dati servono a svolgere il servizio che hai richiesto (art. 6, par. 1, lett. b, del Regolamento UE 2016/679). I dati del bambino/a sono forniti da chi esercita la responsabilità genitoriale.</p>
              <p>Il consenso al trattamento dei dati è già stato raccolto all'iscrizione al Nido: <b>non devi firmare nulla di nuovo.</b> Con la registrazione dichiari solo di aver letto questa informativa.</p>
            </Num>
          </div>
          <div className="colonna">
            <Num n={5} t="Chi può vedere i dati">
              <ul>
                <li>Gli <b>operatori e operatrici del servizio</b> designati/e per iscritto dal titolare, solo per quanto serve al loro lavoro.</li>
                <li>Il <b>fornitore del servizio informatico</b> che ospita il portale, nominato responsabile del trattamento, con server in Unione europea.</li>
                <li>Il <b>servizio di invio delle email</b> di servizio, che riceve solo il tuo indirizzo email e il testo del messaggio: nei messaggi non compaiono i dati dei bambini e delle bambine.</li>
                <li>Il <b>Comune di Quartu Sant'Elena</b> e gli enti di controllo o finanziatori, quando previsto dalla legge o per la rendicontazione.</li>
                <li>I dati non vengono diffusi e non sono trasferiti fuori dall'Unione europea.</li>
              </ul>
            </Num>
            <Num n={6} t="Come li proteggiamo">
              <p>I dati sono trattati con strumenti informatici e, se serve, cartacei, in modo riservato, pertinente e non eccedente rispetto alle finalità. L'accesso al portale richiede email e password, la connessione è protetta e l'elenco delle famiglie è visibile solo al personale autorizzato.</p>
              <p>Il sito non usa cookie di profilazione né strumenti di tracciamento: conserva solo, sul tuo dispositivo, il dato tecnico necessario a tenerti collegato/a.</p>
            </Num>
            <Num n={7} t="Per quanto tempo">
              <p>Per tutta la durata del servizio e poi per il tempo richiesto dagli obblighi di legge e di rendicontazione del progetto. Quando non servono più, i dati vengono cancellati o resi anonimi. Se non vuoi più usare il portale puoi chiedere la chiusura dell'account.</p>
              <p>Se non fornisci i dati necessari non è possibile creare l'account né prenotare le giornate.</p>
            </Num>
            <Num n={8} t="I tuoi diritti">
              <p>Puoi chiedere in ogni momento l'accesso ai dati, la rettifica, la cancellazione, la limitazione, l'opposizione al trattamento e la portabilità (artt. 15-22 del Regolamento UE 2016/679). Scrivi a <b>{CONTATTI.email}</b>.</p>
              <p>Le assegnazioni dalla lista d'attesa seguono regole fisse e non c'è alcuna decisione presa solo in modo automatico sulla tua persona.</p>
              <p>Se ritieni che i tuoi diritti non siano rispettati puoi presentare reclamo al <b>Garante per la protezione dei dati personali</b> (garanteprivacy.it).</p>
            </Num>
          </div>
        </div>
        <Piede torna={{ href: indietro, testo: "Torna indietro" }} />
      </main>
    </>
  );
}
