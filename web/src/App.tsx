import { useCallback, useEffect, useState } from "react";
import { api, esci as azzeraSessione, leggiToken } from "./api";
import type { Me } from "./types";
import Accesso from "./pages/Accesso";
import Registrati from "./pages/Registrati";
import Regole from "./pages/Regole";
import Prenota from "./pages/Prenota";
import Informativa from "./pages/Informativa";
import Segreteria from "./pages/Segreteria";
import { NuovaPassword, PasswordDimenticata } from "./pages/Reimposta";

const leggiHash = () => window.location.hash.replace(/^#\/?/, "");
const vai = (p: string) => { window.location.hash = "#/" + p; };

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [pronto, setPronto] = useState(false);
  const [rotta, setRotta] = useState(leggiHash());

  useEffect(() => {
    const h = () => { setRotta(leggiHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", h);
    const scaduta = () => { setMe(null); vai(""); };
    window.addEventListener("nido-sessione-scaduta", scaduta);
    return () => { window.removeEventListener("hashchange", h); window.removeEventListener("nido-sessione-scaduta", scaduta); };
  }, []);

  useEffect(() => {
    if (!leggiToken()) { setPronto(true); return; }
    api.get<Me>("/api/nido/me").then(setMe).catch(() => azzeraSessione()).finally(() => setPronto(true));
  }, []);

  const dopoAccesso = useCallback((m: Me) => { setMe(m); vai(m.utente.staff ? "segreteria" : "regole"); }, []);
  const esci = useCallback(() => { azzeraSessione(); try { sessionStorage.clear(); } catch { /* ok */ } setMe(null); vai(""); }, []);

  const parti = rotta.split("/");
  const pagina = parti[0];

  // reindirizzamenti in base a chi è collegato
  useEffect(() => {
    if (!pronto) return;
    if (me) {
      if (pagina === "" || pagina === "registrati") vai(me.utente.staff ? "segreteria" : "regole");
      else if (me.utente.staff && (pagina === "regole" || pagina === "prenota")) vai("segreteria");
      else if (!me.utente.staff && pagina === "segreteria") vai("regole");
    } else if (["regole", "prenota", "segreteria"].includes(pagina)) vai("");
  }, [pronto, me, pagina]);

  if (!pronto) return <main className="wrap"><p>Un momento…</p></main>;

  if (pagina === "informativa") return <Informativa indietro={me ? "#/" + (me.utente.staff ? "segreteria" : "regole") : "#/registrati"} />;
  if (pagina === "password") return <PasswordDimenticata />;
  if (pagina === "reimposta" && parti[1]) return <NuovaPassword token={parti[1]} />;
  if (me) {
    if (me.utente.staff) return <Segreteria me={me} esci={esci} />;
    if (pagina === "prenota") return <Prenota me={me} esci={esci} />;
    return <Regole me={me} esci={esci} />;
  }
  if (pagina === "registrati") return <Registrati dopoAccesso={dopoAccesso} />;
  return <Accesso dopoAccesso={dopoAccesso} />;
}
