// Collegamento al server dei dati (PocketBase). L'indirizzo si imposta con VITE_PB_URL (vedi .env.example).
const BASE = ((import.meta.env.VITE_PB_URL as string | undefined) || "").replace(/\/+$/, "");
const KEY = "nido_token";

export const leggiToken = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
const salvaToken = (t: string | null) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* memoria del browser non disponibile */ } };

export class ErroreApi extends Error {
  stato: number;
  constructor(stato: number, messaggio: string) { super(messaggio); this.stato = stato; }
}

async function chiama<T>(metodo: string, percorso: string, corpo?: unknown): Promise<T> {
  const t = leggiToken();
  let r: Response;
  try {
    r = await fetch(BASE + percorso, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: t } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroreApi(0, "Non riesco a collegarmi al server. Controlla la connessione e riprova.");
  }
  let j: any = null;
  try { j = await r.json(); } catch { /* risposta vuota */ }
  if (!r.ok) {
    if (r.status === 401 && t) { salvaToken(null); window.dispatchEvent(new Event("nido-sessione-scaduta")); }
    const msg = (j && (j.errore || j.message)) || "Qualcosa non ha funzionato. Riprova.";
    throw new ErroreApi(r.status, r.status === 429 ? "Troppi tentativi ravvicinati: attendi qualche minuto e riprova." : msg);
  }
  return j as T;
}

export const api = {
  get: <T,>(p: string) => chiama<T>("GET", p),
  post: <T,>(p: string, b?: unknown) => chiama<T>("POST", p, b ?? {}),
};

export async function accedi(email: string, password: string): Promise<void> {
  let r: Response;
  try {
    r = await fetch(BASE + "/api/collections/users/auth-with-password", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identity: email, password }),
    });
  } catch { throw new ErroreApi(0, "Non riesco a collegarmi al server. Controlla la connessione e riprova."); }
  if (r.status === 429) throw new ErroreApi(429, "Troppi tentativi ravvicinati: attendi qualche minuto e riprova.");
  if (!r.ok) throw new ErroreApi(r.status, "Email o password non corrette.");
  const j = await r.json();
  salvaToken(j.token);
}

export function esci() { salvaToken(null); }

export async function impostaNuovaPassword(token: string, password: string): Promise<void> {
  let r: Response;
  try {
    r = await fetch(BASE + "/api/collections/users/confirm-password-reset", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password, passwordConfirm: password }),
    });
  } catch { throw new ErroreApi(0, "Non riesco a collegarmi al server. Controlla la connessione e riprova."); }
  if (!r.ok) throw new ErroreApi(r.status, "Il link non è più valido (dura 2 ore) oppure la password è troppo corta. Richiedine uno nuovo.");
}
