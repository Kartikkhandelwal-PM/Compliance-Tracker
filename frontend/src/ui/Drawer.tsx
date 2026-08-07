import { useEffect } from "react";
import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";

export function Drawer({
  open, onClose, title, subtitle, wide, footer, children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside
        className={`drawer${wide ? " drawer--wide" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="drawer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--f-serif)", fontSize: "var(--t-20)", fontWeight: 600, letterSpacing: "-0.012em", lineHeight: 1.2 }}>
              {title}
            </div>
            {subtitle ? <div className="u-mute" style={{ fontSize: "var(--t-13)", marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="drawer__foot">{footer}</div> : null}
      </aside>
    </>
  );
}
