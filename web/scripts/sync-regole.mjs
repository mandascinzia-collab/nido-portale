// Copia le regole di prenotazione dal server (unica fonte) nel sito, così sono identiche.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const qui = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(qui, "../../pocketbase/pb_hooks/nido_regole.js"), "utf8");
const out = "// GENERATO da scripts/sync-regole.mjs – non modificare a mano (modifica pocketbase/pb_hooks/nido_regole.js)\n" +
  "const module = { exports: {} };\n" + src + "\nexport default module.exports;\n";
writeFileSync(resolve(qui, "../src/regole.generated.js"), out);
console.log("regole sincronizzate");
