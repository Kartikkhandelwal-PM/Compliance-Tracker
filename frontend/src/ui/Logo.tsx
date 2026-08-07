/* ============================================================================
   LOGO
   ----------------------------------------------------------------------------
   A mark for the module, replacing the borrowed "K" tile.

   The whole product is one sentence: a statutory date, met. So the mark is a
   calendar page — rounded leaf, two binder tabs, the ruled header every Indian
   compliance calendar has — with a check cut through it. Nothing here is
   decorative: drop either half and it stops meaning "compliance tracker".

   Drawn on a 32-unit grid with 2.6-unit strokes so it stays legible at 24px in
   the rail and holds up at 96px on the splash. The check is knocked out in the
   page colour rather than drawn on top, so the mark keeps working as a
   single-colour glyph (favicon, print, forced-colors) where the gradient is
   thrown away.
   ========================================================================== */

export function Logo({ size = 28, id = "ct" }: { size?: number; id?: string }) {
  const g = `${id}-g`;
  const k = `${id}-k`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Compliance Tracker"
    >
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        {/* The check is a hole in the page, not a stroke laid over it. */}
        <mask id={k}>
          <rect x="0" y="0" width="32" height="32" fill="#fff" />
          <path
            d="M10.4 17.4 L14.3 21.3 L22.1 12.6"
            stroke="#000"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </mask>
      </defs>

      {/* binder tabs */}
      <path
        d="M11 2.6v3.2M21 2.6v3.2"
        stroke={`url(#${g})`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* the page, with the check knocked out */}
      <g mask={`url(#${k})`}>
        <rect x="4" y="5.4" width="24" height="24" rx="6.4" fill={`url(#${g})`} />
      </g>
      {/* the ruled header line every statutory calendar has */}
      <path
        d="M4.6 11.8h22.8"
        stroke="var(--sheet)"
        strokeWidth="1.5"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />
    </svg>
  );
}
