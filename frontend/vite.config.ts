import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Served from https://<user>.github.io/Compliance-Tracker/, so every asset URL
   has to carry that prefix. `base` is only applied for the production build —
   `npm run dev` stays at "/" so local URLs are not prefixed. */
const BASE = process.env.GITHUB_PAGES === "true" ? "/Compliance-Tracker/" : "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    {
      /* GitHub Pages has no server-side rewrite, so a deep link like
         /Compliance-Tracker/calendar returns its 404 document. Shipping a
         404.html that IS the app means the router boots there and resolves the
         path itself — no redirect bounce, and the URL never changes. */
      name: "spa-404-fallback",
      closeBundle() {
        if (BASE === "/") return;
        const { copyFileSync } = require("node:fs") as typeof import("node:fs");
        copyFileSync("dist/index.html", "dist/404.html");
      },
    },
  ],
});
