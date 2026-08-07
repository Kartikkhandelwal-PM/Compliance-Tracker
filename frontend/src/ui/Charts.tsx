/* ============================================================================
   DASHBOARD CHARTS
   ----------------------------------------------------------------------------
   Two small, purpose-built charts for the Today dashboard band. No charting
   library — both are plain CSS/SVG so they inherit the app's tokens exactly.

   StatusDonut     — part-to-whole snapshot of every obligation's status.
                     Status colour is reserved for exactly this: filed /
                     pending / overdue / not-applicable, nothing else.
   HeadExposureBar — ₹ at risk by compliance head. Head colour is the one
                     categorical palette in the app; the five real heads are
                     rendered in the fixed order validated against the
                     dataviz skill's CVD/normal-vision checks — reordering
                     them needs re-validating, see tokens.css.
   ========================================================================== */

import { inrShort } from "../domain/dates.ts";

const HEAD_ORDER = ["Income Tax", "TDS", "ROC/MCA", "GST", "ROC/MCA (LLP)", "Other Statutory"];

const HEAD_CLASS: Record<string, string> = {
  GST: "head-gst",
  "Income Tax": "head-it",
  TDS: "head-tds",
  "ROC/MCA": "head-roc",
  "ROC/MCA (LLP)": "head-llp",
  "Other Statutory": "head-other",
};

/* ---- Status donut --------------------------------------------------------- */

export interface StatusSeg {
  key: string;
  label: string;
  value: number;
  cls: string; // e.g. "filed" | "pending" | "overdue" | "na"
}

export function StatusDonut({
  segments, centerLabel, centerValue,
}: { segments: StatusSeg[]; centerLabel: string; centerValue: string }) {
  const total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
  const GAP = 2.4; // degrees of surface-colour gap between segments

  let angle = 0;
  const stops: string[] = [];
  for (const s of segments) {
    if (s.value <= 0) continue;
    const span = (s.value / total) * 360;
    const start = angle;
    const end = angle + span;
    const gapEnd = Math.min(end, start + Math.max(0, span - GAP));
    stops.push(`var(--st-${s.cls}-solid) ${start}deg ${gapEnd}deg`);
    stops.push(`transparent ${gapEnd}deg ${end}deg`);
    angle = end;
  }
  const bg = stops.length ? `conic-gradient(${stops.join(", ")})` : "var(--sunk-2)";

  return (
    <div className="donutwrap">
      <div className="donut" style={{ background: bg }} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        <div className="donut__hole">
          <div className="donut__value num">{centerValue}</div>
          <div className="donut__label">{centerLabel}</div>
        </div>
      </div>
      <ul className="legend">
        {segments.map((s) => (
          <li key={s.key} className="legend__row">
            <i className="legend__dot" style={{ background: `var(--st-${s.cls}-solid)` }} />
            <span className="legend__label">{s.label}</span>
            <span className="legend__value num">{s.value.toLocaleString("en-IN")}</span>
            <span className="legend__pct num u-mute">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Head exposure bars ---------------------------------------------------- */

export function HeadExposureBars({ byHead }: { byHead: Record<string, number> }) {
  const rows = HEAD_ORDER
    .map((head) => ({ head, value: byHead[head] ?? 0 }))
    .filter((r) => r.value > 0);
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (!rows.length) {
    return <div className="u-mute" style={{ padding: "var(--s4) 0" }}>No exposure by head — nothing overdue.</div>;
  }

  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.head} className="hbar">
          <span className="hbar__label">{r.head}</span>
          <span className="hbar__track">
            <span
              className={`hbar__fill ${HEAD_CLASS[r.head]}`}
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className="hbar__value num">{inrShort(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/* ============================================================================
   SPARKLINE  —  how the arrears count got to where it is.
   ----------------------------------------------------------------------------
   One series, so no legend: the card's own title names it. The endpoint is
   emphasised because "where it stands today" is the reading, and the area
   fades out so the line stays the mark rather than the fill.
   ========================================================================== */

export function Sparkline({
  points, label, tone = "risk",
}: {
  points: number[];
  label: string;
  tone?: "risk" | "good";
}) {
  if (points.length < 2) return null;
  const W = 300, H = 64, PAD = 5;
  const lo = Math.min(...points), hi = Math.max(...points);
  const span = Math.max(1, hi - lo);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (n: number) => PAD + (1 - (n - lo) / span) * (H - PAD * 2);
  const line = points.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(" ");
  const stroke = tone === "risk" ? "var(--st-overdue-solid)" : "var(--st-filed-solid)";
  const id = `spk-${tone}`;

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={W} cy={y(points[points.length - 1])} r="3.5" fill={stroke} stroke="var(--sheet)" strokeWidth="2" />
    </svg>
  );
}
