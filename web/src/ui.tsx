import type { ReactNode } from "react";

export const CONTATTI = { telefono: "389 918 4668", email: "geneattori@gmail.com" };
const CUP = "CUP: 2024-PE4-00263 - GENE-ATTORI: COSTRUTTORI DI CORRESPONSABILITÀ, finanziato dall'Unione europea - Next Generation EU-PNRR M5C3-Investimento 3. Interventi socio-educativi strutturati per combattere la povertà educativa nel Mezzogiorno a sostegno del Terzo Settore";
const ALT_LOGHI = "Loghi del progetto: Finanziato dall'Unione europea – NextGenerationEU; Agenzia per la Coesione Territoriale; La Clessidra Società Cooperativa Sociale Onlus; CEMEA Sardegna; Centro Sportivo Italiano Cagliari; Comune di Quartu Sant'Elena";

type P = { s?: number; c?: string; children: ReactNode };
const Svg = ({ s = 24, c = "currentColor", children }: P) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type I = { s?: number; c?: string };
export const IcoFreccia = (p: I) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IcoIndietro = (p: I) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const IcoCheck = (p: I) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IcoCestino = (p: I) => <Svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>;
export const IcoOrologio = (p: I) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IcoCalendario = (p: I) => <Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></Svg>;
export const IcoInfo = (p: I) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const IcoAttesa = (p: I) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5M17 8v4l2.5 1.5M17 20a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" /></Svg>;
export const IcoPersone = (p: I) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.5 2.6 3.5 5.5" /></Svg>;
export const IcoAnnulla = (p: I) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></Svg>;
export const IcoPiu = (p: I) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IcoAccedi = (p: I) => <Svg {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M4 12h11M11 8l4 4-4 4" /></Svg>;
export const IcoNuovo = (p: I) => <Svg {...p}><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.6 3.1-6 7-6" /><path d="M18 14v6M15 17h6" /></Svg>;
export const IcoAvviso = (p: I) => <Svg {...p}><path d="M12 4l9 16H3L12 4zM12 10v4M12 17h.01" /></Svg>;

export function Intestazione({ titolo = "Nido Comunale", sotto = "Spazio gioco 0/6 · Quartu Sant'Elena", children }: { titolo?: string; sotto?: string; children?: ReactNode }) {
  return (
    <header className="hd">
      <div className="marca" aria-hidden="true">N</div>
      <div className="tit">{titolo}<small>{sotto}</small></div>
      <div className="spazio" />
      {children ? <nav>{children}</nav> : null}
    </header>
  );
}

export function Wordmark() {
  return <div className="wordmark"><img src="/geneattori-scritta.png" alt="GENE-ATTORI – Costruttori di corresponsabilità" /></div>;
}

export function Loghi() {
  return (
    <div className="logos">
      <img src="/loghi-progetto.png" alt={ALT_LOGHI} />
      <p>{CUP}</p>
    </div>
  );
}

export function Piede({ torna }: { torna?: { href: string; testo: string } }) {
  return (
    <>
      <footer className="foot" id="gestisci">
        <span>Serve aiuto? <b>{CONTATTI.telefono}</b> · <b>{CONTATTI.email}</b></span>
        {torna ? <a href={torna.href}>{torna.testo}</a> : <a href="#/informativa">Informativa sulla privacy</a>}
      </footer>
      <Loghi />
    </>
  );
}

export function Scheda({ icona, titolo, blu, children }: { icona: ReactNode; titolo: string; blu?: boolean; children: ReactNode }) {
  return (
    <section className="sec">
      <div className="sh"><div className={"ic" + (blu ? " blu" : "")}>{icona}</div><h2>{titolo}</h2></div>
      {children}
    </section>
  );
}

export function Modale({ children, etichetta }: { children: ReactNode; etichetta: string }) {
  return <div className="modale" role="dialog" aria-modal="true" aria-label={etichetta}><div>{children}</div></div>;
}
