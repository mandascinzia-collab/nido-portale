import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In sviluppo le chiamate /api vanno al PocketBase locale (porta 8090).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8090" } },
});
