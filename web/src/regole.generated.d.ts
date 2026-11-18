export interface Cfg {
  posti: number; maxSettimana: number; maxMese: number; maxSabatiConsecutivi: number;
  giorniApertura: number; giorniFase2: number; oreAnnullo: number;
}
export type Fase = "passata" | "oggi" | "fase2" | "fase1" | "presto";
export type Motivo = "settimana" | "sabati" | "mese";
export interface Regole {
  CFG_DEFAULT: Cfg;
  valida(s: string): boolean;
  aggiungi(s: string, n: number): string;
  mesiPiu(s: string, n: number): string;
  dataInizio(nascita: string): string;
  dataFine(nascita: string): string;
  idoneo(nascita: string, data: string): "" | "piccolo" | "grande";
  diff(a: string, b: string): number;
  dow(s: string): number;
  isSabato(s: string): boolean;
  isDomenica(s: string): boolean;
  lunedi(s: string): string;
  mese(s: string): string;
  orario(s: string): { tipo: "sabato" | "settimana"; nome: string; inizio: string; fine: string; inizioMin: number };
  fase(oggi: string, data: string, cfg: Cfg): Fase;
  apreIl(data: string, cfg: Cfg): string;
  oreMancanti(oggi: string, oraMin: number, data: string): number;
  eliminabile(oggi: string, oraMin: number, data: string, cfg: Cfg): boolean;
  limite(impegnate: string[], data: string, cfg: Cfg): Motivo | null;
  precedenza(a: { mese: number; quando: string }, b: { mese: number; quando: string }): number;
}
declare const R: Regole;
export default R;
