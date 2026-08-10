import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import type { Obligation } from "../domain/types.ts";
import { allObligations, getOutbox, getVersion, subscribe } from "../domain/engine.ts";

/* ---- Live obligation store ---------------------------------------------- */

export function useObligations(): Obligation[] {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  return useMemo(() => allObligations(), [v]);
}

export function useOutbox() {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  return useMemo(() => getOutbox(), [v]);
}

/**
 * Re-derive any engine-backed value when the store changes.
 *
 * The reminder cadence, its guards and the scheduled queue are all computed
 * from the same mutable store as the obligations, and each would otherwise
 * need its own near-identical hook. `read` is deliberately NOT a dependency:
 * it is an inline closure at every call site, so depending on it would
 * recompute on every render and defeat the memo. The store version is the only
 * thing that can change the answer.
 */
export function useEngine<T>(read: () => T): T {
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(read, [v]);
}

/* ---- Theme + toast ------------------------------------------------------- */

type Theme = "light" | "dark";

interface AppCtx {
  theme: Theme;
  toggleTheme: () => void;
  toast: (msg: string) => void;
  /** The signed-in user — Phase 1 is internal-only, so this is always staff. */
  me: { id: string; name: string; initials: string; role: string };
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("ct-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ct-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "light" ? "dark" : "light")), []);
  const toast = useCallback((m: string) => setMsg(m), []);

  const value = useMemo<AppCtx>(
    () => ({
      theme,
      toggleTheme,
      toast,
      me: { id: "s1", name: "Kartik Khandelwal", initials: "KK", role: "Partner" },
    }),
    [theme, toggleTheme, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {msg ? <div className="toast" role="status">{msg}</div> : null}
    </Ctx.Provider>
  );
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
