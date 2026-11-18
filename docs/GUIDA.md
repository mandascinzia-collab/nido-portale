# Guida passo passo: mettere online il portale

Tempo previsto: circa 2 ore, la prima volta. Non servono competenze tecniche: ogni passaggio dice cosa cliccare o cosa copiare.
Se in un punto qualcosa non corrisponde a quello che vedi sullo schermo, scrivimi cosa compare e proseguiamo insieme.

## Come funziona, in una riga
Le famiglie aprono il **sito** (ospitato su Netlify). Il sito parla con il **server dei dati** (su Hetzner), dove restano gli account, i dati dei bambini e delle bambine e le prenotazioni. Il server spedisce anche le email.

## Cosa serve (tutto a nome della cooperativa)
| Servizio | A cosa serve | Costo indicativo |
|---|---|---|
| **Hetzner Cloud** | Il server dei dati | circa 4–5 € al mese (+20% per le copie di sicurezza automatiche) |
| **DuckDNS** | Un indirizzo gratuito per il server (es. `nidoquartu.duckdns.org`) | gratis |
| **GitHub** | Custodisce il codice del portale | gratis |
| **Netlify** | Ospita il sito per le famiglie | gratis |
| **Gmail** (all'inizio) | Spedisce le email di servizio | gratis |

Prima di iniziare decidi **con quale email** si aprono gli account (consiglio una casella della cooperativa, non personale) e conserva tutte le password in un posto sicuro.

---

## Passo 1 – Hetzner: creare il server
1. Vai su **console.hetzner.cloud** e crea l'account con i dati della cooperativa (servono documento e un metodo di pagamento).
2. Crea un nuovo **Progetto** (es. «Portale Nido»).
3. **Add Server** e scegli:
   - Località: **Falkenstein** o **Nuremberg** (Germania) oppure **Helsinki** (Finlandia): sono in Unione europea.
   - Immagine: **Ubuntu 24.04**.
   - Tipo: il più piccolo con architettura **x86** (CX22 o equivalente) è più che sufficiente.
   - **Backups**: attiva l'opzione (+20%): è la copia di sicurezza dell'intero server.
   - Accesso: scegli **SSH key** se sai farlo; altrimenti lascia che Hetzner ti mandi la password di root per email.
   - Nome: `nido-portale`.
4. Premi **Create & Buy now**. Dopo un minuto vedrai l'**indirizzo IP** del server (numeri tipo `95.216.12.34`): copialo.
5. Nella console: **Firewalls** non serve configurarlo ora (lo fa lo script di installazione).

## Passo 2 – DuckDNS: dare un nome al server
1. Vai su **duckdns.org** e accedi (con Google o GitHub).
2. Nella casella «sub domain» scrivi un nome (es. `nidoquartu`) e premi **add domain**.
3. Nella riga del nome appena creato, nel campo **current ip** incolla l'IP del server e premi **update ip**.

Il nome completo, per esempio `nidoquartu.duckdns.org`, è l'indirizzo del server. Annotalo.

## Passo 3 – GitHub: caricare il codice
1. Crea l'account su **github.com** (o accedi a quello della cooperativa) e premi **New repository**.
2. Nome: `nido-portale`. Scegli **Private** (privato) e premi **Create repository**.
3. Nella pagina del repository scegli **uploading an existing file**, trascina **tutto il contenuto** della cartella `nido-portale` che ti ho consegnato (le cartelle `web`, `pocketbase`, `server`, `test`, `docs` e i file `netlify.toml`, `README.md`, `.gitignore`) e premi **Commit changes**.
   - Se GitHub segnala che i file sono troppi per un solo caricamento, caricali a gruppi (una cartella alla volta).
4. Annota l'indirizzo del repository (es. `https://github.com/NOME/nido-portale`).

> Un repository **privato** richiede, per il server, una «chiave» per scaricare gli aggiornamenti. Se preferisci non farlo, rendi il repository **pubblico**: dentro non ci sono dati di famiglie né password, solo il codice. Dimmi quale scegli e ti guido.

## Passo 4 – Installare il server
1. Collegati al server. Da Windows apri **PowerShell**, da Mac **Terminale** e scrivi (con il tuo IP):
   ```
   ssh root@95.216.12.34
   ```
   Alla prima connessione rispondi `yes`. Se hai ricevuto la password per email, incollala (non si vede mentre la scrivi) e Hetzner ti chiederà di cambiarla.
2. Scarica ed esegui lo script di installazione (sostituisci i tre valori):
   ```
   git clone https://github.com/NOME/nido-portale.git /opt/nido-repo
   bash /opt/nido-repo/server/install.sh nidoquartu.duckdns.org TUA-EMAIL@esempio.it https://github.com/NOME/nido-portale.git
   ```
3. Aspetta qualche minuto. Alla fine compare «Fatto. Il servizio è attivo.»
4. Leggi le credenziali del pannello e salvale in un posto sicuro, poi cancella il file:
   ```
   cat /root/credenziali-nido.txt
   rm /root/credenziali-nido.txt
   ```
5. Prova: apri nel browser `https://nidoquartu.duckdns.org/api/health`. Se compare un messaggio con `"code":200`, il server funziona.

## Passo 5 – Creare l'account della Segreteria
1. Apri `https://nidoquartu.duckdns.org/_/` e accedi con le credenziali del passo 4.
2. Menu a sinistra: **Collections → users → New record** e compila:
   - **email** e **password** (scegli una password lunga) e **passwordConfirm**;
   - **nome** e **cognome** della persona;
   - **stato** = `approvato`;
   - **staff** = attivo (spunta).
   Premi **Create**.
3. Ripeti per ogni persona della Segreteria. Con queste credenziali si entra poi dal sito: si arriva direttamente alla Segreteria.

## Passo 6 – Email (password dimenticata e posti liberati)
Nel pannello (`/_/`): **Settings → Mail settings**.
1. **Sender name**: `Spazio gioco 0/6`. **Sender address**: l'indirizzo Gmail che userai.
2. Attiva **Use SMTP mail server** e compila (Gmail):
   - Host: `smtp.gmail.com`; Port: `465`; TLS encryption: **Always**;
   - Username: l'indirizzo Gmail completo; Password: una **«password per le app»** (non la password normale).
3. Come ottenere la «password per le app»: nell'account Google → **Sicurezza** → attiva la **verifica in due passaggi** → cerca **Password per le app** → creane una chiamata «Portale Nido» e copia il codice di 16 lettere.
4. Premi **Save** e poi **Send test email**: controlla che arrivi.

Consigli:
- Usa un account Gmail **dedicato solo all'invio** (non quello su cui arrivano i messaggi delle famiglie).
- Le email contengono solo il link o la data, mai i nomi dei bambini e delle bambine.
- **Prima di aprire alle famiglie** conviene passare a un servizio di invio della cooperativa (Brevo o Resend, con un dominio vostro): si cambiano solo questi campi, il resto non cambia.

## Passo 7 – Netlify: pubblicare il sito
1. Vai su **app.netlify.com** e accedi con **GitHub** (consenti l'accesso al repository `nido-portale`).
2. **Add new site → Import an existing project → GitHub** e scegli `nido-portale`.
3. Le impostazioni di compilazione sono già nel file `netlify.toml`: lascia tutto com'è.
4. Prima di premere **Deploy**, apri **Add environment variables** (o, dopo, **Site configuration → Environment variables**) e crea:
   - Nome: `VITE_PB_URL`
   - Valore: `https://nidoquartu.duckdns.org` (l'indirizzo del server, **senza** barra finale).
5. Premi **Deploy**. Dopo 1–2 minuti il sito è online a un indirizzo tipo `https://nome-casuale.netlify.app`.
6. (Facoltativo) **Site configuration → Change site name** per scegliere un nome leggibile, es. `spaziogioco-quartu.netlify.app`.
7. Se hai creato la variabile **dopo** il primo deploy: **Deploys → Trigger deploy → Clear cache and deploy site**.

## Passo 8 – Collegare il server al sito (link nelle email)
Sul server (stessa connessione `ssh` del passo 4):
```
nido-imposta-sito https://spaziogioco-quartu.netlify.app
```
(con l'indirizzo vero del tuo sito). Serve perché il link «reimposta la password» nelle email porti al sito giusto.

## Passo 9 – Collaudo prima di aprire alle famiglie
Con due persone, o con due browser diversi:
- [ ] Registrare una famiglia di prova con due bambini/e → compare «in attesa di approvazione».
- [ ] Dalla Segreteria (login con l'account del passo 5): **Famiglie → Approva**. Arriva un'email di conferma alla famiglia di prova.
- [ ] Dalla famiglia: scegliere due giornate e premere **Prenota**; poi eliminarne una con il cestino.
- [ ] Provare «Ho dimenticato la password»: arriva l'email, il link porta al sito e permette di scegliere la nuova password.
- [ ] Dalla Segreteria: **Impostazioni di questa giornata** → posti = 1; con due famiglie prenotare la stessa giornata (la seconda va in lista d'attesa); la prima elimina → la seconda riceve l'email del posto liberato.
- [ ] Provare da telefono.
- [ ] Cancellare le famiglie di prova (Segreteria → Famiglie → Elimina account).

## Passo 10 – Prima di aprire alle famiglie (privacy)
Da concordare con chi segue la privacy (cooperativa e Comune):
- [ ] **Informativa**: controllare il testo in `web/src/pages/Informativa.tsx` (titolare del trattamento / ATI, contatto, tempi di conservazione). Chi la valida dà il via libera.
- [ ] **Hetzner**: firmare l'accordo sul trattamento dei dati (Hetzner lo mette a disposizione nella console, nelle sezioni su sicurezza e privacy) e indicare Hetzner come fornitore informatico responsabile del trattamento.
- [ ] **Servizio di invio email** (Google, o Brevo/Resend): idem per l'accordo sul trattamento; indicarlo nel registro dei trattamenti.
- [ ] **Operatori e operatrici** che usano la Segreteria: designazione scritta ad autorizzati al trattamento.
- [ ] Decidere per quanto tempo si conservano i dati e quando si cancellano (a fine servizio). Dalla Segreteria si può eliminare un account con tutti i dati collegati.

---

## Uso quotidiano
- **Registrazioni nuove**: Segreteria → Famiglie. Il numero accanto alla voce mostra quante sono da approvare. (Se preferisci che entrino subito, togli la spunta in **Impostazioni**.)
- **Presenze**: Segreteria → Giornate → scegli «Oggi» → Presente / Assente per ogni bambino/a.
- **Elenco da stampare / CSV**: pulsanti nella giornata scelta.
- **Giornata chiusa (festivo) o con meno posti**: in fondo alla giornata, «Impostazioni di questa giornata».
- **Cambiare i limiti** (posti, giornate a settimana, ecc.): Segreteria → Impostazioni. Il testo di «Come funziona» si aggiorna da solo.
- **Aggiungere a mano** un bambino o una bambina: pulsante «Aggiungi a mano» (la famiglia deve avere un account).

## Manutenzione (10 minuti al mese)
1. Collegati con `ssh root@IP` e scrivi `nido-stato`: mostra se il servizio è attivo, lo spazio libero, le ultime copie di sicurezza e se ci sono aggiornamenti.
2. Se `nido-stato` segnala aggiornamenti: `apt update && apt upgrade -y`, e se chiede il riavvio: `reboot`.
3. **Copie di sicurezza**: il server ne fa una ogni notte alle 03:00 (si tengono le ultime 14) e Hetzner ne fa un'altra dell'intero server. Ogni tanto scarica una copia dal pannello (*Settings → Backups*) e conservala altrove.
4. **Aggiornare il codice dopo una modifica**: dopo aver caricato le modifiche su GitHub, sul server scrivi `nido-aggiorna`. (Il sito su Netlify si aggiorna da solo.)

## Se qualcosa non va
| Sintomo | Cosa controllare |
|---|---|
| «Non riesco a collegarmi al server» sul sito | Apri `https://IL-TUO-NOME.duckdns.org/api/health`. Se non risponde: `ssh` sul server e `systemctl status nido caddy`. Controlla anche che `VITE_PB_URL` su Netlify sia giusto e rifai il deploy. |
| Le email non arrivano | Pannello → Settings → Mail settings → **Send test email**. Controlla la «password per le app» e lo spam. |
| Il link «reimposta la password» porta alla pagina sbagliata | Rifai il passo 8 con l'indirizzo giusto del sito. |
| Una famiglia non riesce a registrarsi: «Esiste già un account» | Ha già un account: usare «Ho dimenticato la password». |
| «Troppi tentativi ravvicinati» | È una protezione: attendere qualche minuto. |
| Ho cambiato il nome DuckDNS o l'IP | Aggiorna l'IP su duckdns.org e rifai il passo 4 punto 2 solo se hai cambiato server; altrimenti cambia `VITE_PB_URL` su Netlify e rifai il deploy. |
