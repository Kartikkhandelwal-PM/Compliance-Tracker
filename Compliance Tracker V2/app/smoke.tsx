import { renderToString } from "react-dom/server.browser";
import { MemoryRouter } from "react-router-dom";
import { App } from "./src/App.tsx";
import { AppProvider } from "./src/ui/app-state.tsx";

const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
g.window = { matchMedia: () => ({ matches: false }), addEventListener: () => {}, removeEventListener: () => {} };
g.document = { documentElement: { setAttribute: () => {} } };

const routes = ["/", "/runs", "/runs/GSTR-3B::2026-07", "/calendar", "/clients", "/clients/C002",
  "/clients/C005", "/matrix", "/team", "/rules", "/reminders"];

let bad = 0;
for (const r of routes) {
  try {
    const html = renderToString(
      <MemoryRouter initialEntries={[r]}><AppProvider><App /></AppProvider></MemoryRouter>,
    );
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(`OK   ${r.padEnd(26)} ${html.length.toString().padStart(7)}b | ${text.slice(150, 330)}`);
  } catch (e) {
    bad++;
    console.log(`FAIL ${r.padEnd(26)} ${(e as Error).message}`);
  }
}
console.log(bad === 0 ? "\nAll routes rendered." : `\n${bad} route(s) failed.`);
