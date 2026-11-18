# Portale prenotazioni – Spazio gioco 0/6 (Nido di Quartu Sant'Elena)

Progetto GENE-ATTORI: Costruttori di corresponsabilità (PNRR / NextGenerationEU, CUP 2024-PE4-00263).
Le famiglie si registrano con i dati dei figli e delle figlie, prenotano le giornate e gestiscono le prenotazioni.
La Segreteria approva le registrazioni, vede gli elenchi, segna le presenze e gestisce lista d'attesa e impostazioni.

**Per mettere online il portale segui `docs/GUIDA.md`** (passo passo, senza conoscenze tecniche).

## Come è fatto
| Parte | Dove | Cosa fa |
|---|---|---|
| Sito (React + TypeScript + Vite) | `web/` | Pagine per le famiglie e per la Segreteria. Va su **Netlify** (da GitHub). |
| Server dei dati (PocketBase) | `pocketbase/` | Database, accessi, email, regole di prenotazione. Va su un server **Hetzner**. |
| Regole di prenotazione | `pocketbase/pb_hooks/nido_regole.js` | Unica fonte: la usano sia il server sia il sito (il sito la copia da solo al momento della compilazione). |
| Installazione del server | `server/` | Script per installare, aggiornare e controllare il server. |
| Collaudi automatici | `test/` | `PB_BIN=/percorso/pocketbase test/run-local.sh` (39 verifiche su regole, lista d'attesa, email, sicurezza). |

## Regole applicate dal server (non aggirabili dal browser)
- 15 posti per giornata (modificabile). Spazio gioco lun–ven 16:30–18:30; sabato 8:30–12:30; domenica nessun servizio.
- Si prenota fino a 30 giorni di calendario in avanti, mai nello stesso giorno (chiude a mezzanotte del giorno prima).
- Fase 1 (da 30 a 8 giorni prima): per **ogni bambino/a** max 3 giornate a settimana (lun–ven) più il sabato, max 8 al mese solare (sabati compresi), max 3 sabati consecutivi.
- Fase 2 (ultimi 7 giorni): i posti rimasti sono per tutti, senza questi limiti.
- Giornata piena → lista d'attesa. Se si libera un posto va in automatico a chi ha frequentato meno nel mese; a parità, a chi era in lista da prima. Email con sola data e link.
- Eliminazione di una prenotazione fino a 48 ore prima dell'inizio della giornata.

Tutti i numeri si cambiano dalla Segreteria → Impostazioni, senza toccare il codice.

## Sviluppo in locale
```bash
# terminale 1: server (PocketBase 0.40.x)
cd pocketbase && pocketbase superuser upsert tua@email.it PasswordLunga && pocketbase serve --http=127.0.0.1:8090
# terminale 2: sito
cd web && npm install && npm run dev
```
