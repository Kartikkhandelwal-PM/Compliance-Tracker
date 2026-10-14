/* ============================================================================
   HEAD ILLUSTRATIONS — Income tax, GST, TDS
   ----------------------------------------------------------------------------
   Small flat drawings for the client Overview's head cards. Drawn in
   `currentColor` (the head's own colour, set by the card) over the card's
   own background, so they follow light and dark themes without a second set.

     Income tax — a return form with a filed tick
     GST        — an invoice with a percentage badge
     TDS        — a payslip with a coin being taken off at source
   ========================================================================== */

type Kind = "itr" | "gst" | "tds";

const PAPER = "var(--sheet)";

export function HeadArt({ kind, muted }: { kind: Kind; muted?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 96"
      width="120"
      height="96"
      aria-hidden
      className={`headart${muted ? " is-muted" : ""}`}
    >
      {/* Soft backdrop */}
      <circle cx="62" cy="50" r="40" fill="currentColor" opacity="0.1" />
      <circle cx="98" cy="18" r="6" fill="currentColor" opacity="0.16" />
      <circle cx="20" cy="76" r="4" fill="currentColor" opacity="0.2" />
      {kind === "itr" ? <Itr /> : kind === "gst" ? <Gst /> : <Tds />}
    </svg>
  );
}

function Itr() {
  return (
    <g>
      {/* Back sheet, slightly turned */}
      <rect x="40" y="16" width="44" height="58" rx="5" fill={PAPER} stroke="currentColor" strokeOpacity="0.25" transform="rotate(6 62 45)" />
      {/* Front form */}
      <rect x="34" y="14" width="46" height="62" rx="5" fill={PAPER} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <rect x="34" y="14" width="46" height="13" rx="5" fill="currentColor" opacity="0.9" />
      <rect x="34" y="22" width="46" height="5" fill="currentColor" opacity="0.9" />
      <rect x="40" y="18.5" width="18" height="3.5" rx="1.75" fill={PAPER} opacity="0.9" />
      {/* Rupee glyph */}
      <path d="M41 34h10M41 38h10M44 34c5 0 5 7 0 7h-3l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Lines */}
      <rect x="56" y="34" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.35" />
      <rect x="56" y="41" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="40" y="54" width="34" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      <rect x="40" y="61" width="26" height="3" rx="1.5" fill="currentColor" opacity="0.2" />
      {/* Filed tick */}
      <circle cx="82" cy="70" r="12" fill="currentColor" />
      <path d="M76.5 70.5l3.5 3.5 7-7.5" fill="none" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Gst() {
  return (
    <g>
      {/* Invoice with a torn bottom edge */}
      <path
        d="M36 14h42a4 4 0 0 1 4 4v58l-5.25-4-5.25 4-5.25-4-5.25 4-5.25-4-5.25 4-5.25-4L36 76V18a4 4 0 0 1 4-4Z"
        fill={PAPER} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" strokeLinejoin="round"
      />
      <rect x="42" y="21" width="20" height="4" rx="2" fill="currentColor" opacity="0.9" />
      <rect x="42" y="31" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="42" y="37" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="42" y="43" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      <path d="M42 52h34" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 2" />
      <rect x="42" y="57" width="12" height="4" rx="2" fill="currentColor" opacity="0.5" />
      <rect x="62" y="57" width="14" height="4" rx="2" fill="currentColor" opacity="0.9" />
      {/* Percentage badge */}
      <circle cx="84" cy="30" r="13" fill="currentColor" />
      <circle cx="79.5" cy="25.5" r="2.4" fill="none" stroke={PAPER} strokeWidth="1.8" />
      <circle cx="88.5" cy="34.5" r="2.4" fill="none" stroke={PAPER} strokeWidth="1.8" />
      <path d="M89 24.5l-10 11" stroke={PAPER} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Tds() {
  return (
    <g>
      {/* Payslip */}
      <rect x="24" y="24" width="58" height="44" rx="6" fill={PAPER} stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      <circle cx="36" cy="37" r="5.5" fill="currentColor" opacity="0.85" />
      <rect x="46" y="33" width="26" height="3.5" rx="1.75" fill="currentColor" opacity="0.4" />
      <rect x="46" y="39" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="30" y="50" width="22" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="30" y="57" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="58" y="50" width="18" height="10" rx="3" fill="currentColor" opacity="0.15" />
      <path d="M62 55h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Coin taken off at source */}
      <path d="M84 40v14" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
      <path d="M80.5 51l3.5 4 3.5-4" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="90" cy="72" rx="12" ry="4" fill="currentColor" opacity="0.35" />
      <rect x="78" y="66" width="24" height="6" fill="currentColor" opacity="0.35" />
      <ellipse cx="90" cy="66" rx="12" ry="4" fill="currentColor" />
      <circle cx="88" cy="26" r="10" fill="currentColor" />
      <path d="M84 26h8" stroke={PAPER} strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

/* ---- Tab icons --------------------------------------------------------------
   The same three drawings reduced to a 20px glyph for the tab bar: a soft
   tinted tile in the head's colour with the one shape that identifies it. */

export function HeadIcon({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden className={`headicon headicon--${kind}`}>
      <rect width="20" height="20" rx="5" fill="currentColor" opacity="0.14" />
      {kind === "itr" ? (
        <g>
          <rect x="5" y="3.5" width="9" height="12" rx="1.5" fill={PAPER} stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 7h5M7 9.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="14" cy="14" r="3.6" fill="currentColor" />
          <path d="M12.4 14.1l1.1 1.1 2-2.2" fill="none" stroke={PAPER} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : kind === "gst" ? (
        <g>
          <path d="M5 3.5h8.5a1 1 0 0 1 1 1v11.5l-1.6-1.2-1.6 1.2-1.6-1.2-1.6 1.2L6.5 14.8 5 16V4.5a1 1 0 0 1 0-1Z" fill={PAPER} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="14.5" cy="6" r="3.6" fill="currentColor" />
          <path d="M16 4.6l-3 2.8" stroke={PAPER} strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="13.3" cy="4.9" r="0.7" fill={PAPER} />
          <circle cx="15.7" cy="7.1" r="0.7" fill={PAPER} />
          <path d="M7 9h4.5M7 11.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <rect x="3" y="5.5" width="11" height="8" rx="1.5" fill={PAPER} stroke="currentColor" strokeWidth="1.2" />
          <circle cx="6" cy="8.5" r="1.2" fill="currentColor" />
          <path d="M8.5 8.5h3M5 11.2h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="15" cy="13.5" r="3.6" fill="currentColor" />
          <path d="M13.3 13.5h3.4" stroke={PAPER} strokeWidth="1.3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
