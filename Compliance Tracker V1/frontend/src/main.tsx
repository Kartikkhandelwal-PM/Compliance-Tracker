import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.tsx";
import { AppProvider } from "./ui/app-state.tsx";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Vite injects the deploy prefix, so the same build works at / locally
        and at /Compliance-Tracker/ on Pages. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
