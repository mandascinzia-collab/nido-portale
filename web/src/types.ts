import type { Cfg, Fase } from "./regole.generated.js";

export interface CfgServer extends Cfg { aperte: boolean }
export interface Figlio { id: string; nome: string; cognome: string; nascita: string; eta: string }
export interface Utente { id: string; email: string; nome: string; cognome: string; telefono: string; stato: "in_attesa" | "approvato" | "rifiutato"; staff: boolean }
export interface Me { utente: Utente; figli: Figlio[]; config: CfgServer; oggi: string }
export interface GiornoFiglio { id: string; stato: "prenotata" | "attesa" | null; pid: string | null }
export interface Giorno {
  data: string; tipo: "settimana" | "sabato"; nome: string; inizio: string; fine: string; fase: Fase; apreIl: string | null;
  chiusa: boolean; nota: string; posti: number; occupati: number; attesa: number; eliminabile: boolean; figli: GiornoFiglio[];
}
export interface Calendario { oggi: string; ultimoPrenotabile: string; config: CfgServer; approvato: boolean; giorni: Giorno[]; impegni: Record<string, string[]> }
export interface Esito { data: string; figlio: string; esito: string; motivo: string | null }
