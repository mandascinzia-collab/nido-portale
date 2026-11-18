const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const dow = (s: string) => new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))).getUTCDay();
export const nomeGiorno = (s: string) => GIORNI[dow(s)];
export const fmtBreve = (s: string) => +s.slice(8, 10) + " " + MESI[+s.slice(5, 7) - 1];                 // 16 novembre
export const fmtGiorno = (s: string) => nomeGiorno(s) + " " + fmtBreve(s);                               // lunedì 16 novembre
export const fmtLunga = (s: string) => fmtBreve(s) + " " + s.slice(0, 4);                                 // 16 novembre 2026
export const fmtMaiusc = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const ddmm = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7);
export const elencoNomi = (n: string[]) => (n.length > 1 ? n.slice(0, -1).join(", ") + " e " + n[n.length - 1] : n[0] || "");
