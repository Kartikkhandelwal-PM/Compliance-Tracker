import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { App } from "./App.tsx";
import { AppProvider } from "./ui/app-state.tsx";
import "./styles/app.css";
import "./styles/jira.css";

/* A single-file preview (Claude artifact) has no server to rewrite deep links,
   so that build routes on the hash instead. */
const Router = import.meta.env.VITE_HASH_ROUTER === "1" ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Vite injects the deploy prefix, so the same build works at / locally
        and at /Compliance-Tracker/ on Pages. */}
    <Router basename={import.meta.env.VITE_HASH_ROUTER === "1" ? undefined : import.meta.env.BASE_URL}>
      <AppProvider>
        <App />
      </AppProvider>
    </Router>
  </StrictMode>,
);
