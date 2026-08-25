/* A small hand-picked icon set. Stroke-only, 1.6px, 24-grid — icons here are
   navigational furniture, so they stay quiet and never carry state colour. */

export type IconName =
  | "today" | "runs" | "calendar" | "clients" | "matrix" | "team" | "rules"
  | "outbox" | "search" | "chevronRight" | "chevronLeft" | "chevronDown"
  | "check" | "close" | "alert" | "filter" | "download" | "moon" | "sun"
  | "collapse" | "expand" | "plus" | "clock" | "send" | "external" | "info"
  | "arrowRight" | "sort" | "user" | "bolt" | "ban" | "history" | "bell"
  | "tick" | "tickDouble" | "menu" | "settings" | "fullscreen" | "fullscreenExit"
  | "sync"
  /* Chat furniture — only used to make the WhatsApp preview read as a real
     thread rather than a quotation of one. */
  | "phone" | "video" | "dots" | "lock" | "mic" | "attach" | "smile" | "camera";

const P: Record<IconName, string> = {
  today: "M4 5.5h16M4 5.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13ZM8 2.5v3M16 2.5v3M12 10v5M9.5 12.5h5",
  runs: "M3.5 6.5h17M3.5 12h17M3.5 17.5h17M7 4.5v4M14 10v4M9.5 15.5v4",
  calendar: "M4 5.5h16M4 5.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13ZM8 2.5v3M16 2.5v3M7.5 10h2M11 10h2M14.5 10h2M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2",
  clients: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.4a6.5 6.5 0 0 1 3.5 5.6",
  matrix: "M3.5 3.5h17v17h-17zM3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17",
  team: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0",
  rules: "M12 3.5v17M6.5 7.5h11M4 7.5 6.5 15h-5L4 7.5ZM20 7.5 22.5 15h-5L20 7.5ZM8.5 20.5h7",
  outbox: "M3.5 12.5h5l1.5 3h4l1.5-3h5M3.5 12.5 6 5a1.5 1.5 0 0 1 1.4-1h9.2A1.5 1.5 0 0 1 18 5l2.5 7.5v5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-5Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  chevronRight: "m9.5 5.5 6.5 6.5-6.5 6.5",
  chevronLeft: "M14.5 5.5 8 12l6.5 6.5",
  chevronDown: "m5.5 9.5 6.5 6.5 6.5-6.5",
  check: "m4.5 12.5 5 5 10-11",
  close: "M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5",
  alert: "M12 8.5v5M12 17h.01M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  filter: "M3.5 5.5h17l-6.5 7.5v6l-4 2v-8L3.5 5.5Z",
  download: "M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z",
  sun: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8",
  collapse: "M9.5 4v16M4 4.5h16v15H4zM6.7 9.5 5 12l1.7 2.5",
  expand: "M9.5 4v16M4 4.5h16v15H4zM5 9.5 6.7 12 5 14.5",
  plus: "M12 5v14M5 12h14",
  clock: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2",
  send: "M21 3.5 10.5 14M21 3.5l-6.5 17.5-4-7.5-7.5-4L21 3.5Z",
  external: "M14 4.5h5.5V10M19 5 11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10",
  info: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 11v5.5M12 7.6h.01",
  arrowRight: "M4 12h16M14 6l6 6-6 6",
  sort: "M7 4v16M7 20l-3-3M17 20V4M17 4l3 3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0",
  bolt: "M13 2.5 4 13.5h7l-1 8 9-11h-7l1-8Z",
  ban: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM6 6l12 12",
  history: "M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v5h5M12 7.5V12l3 2",
  sync: "M4 12a8 8 0 0 1 14-5.3M18 3v4h-4M20 12a8 8 0 0 1-14 5.3M6 21v-4h4",
  bell: "M18 8.5a6 6 0 1 0-12 0c0 5.2-1.6 6.8-2 7.2a.6.6 0 0 0 .4 1h15.2a.6.6 0 0 0 .4-1c-.4-.4-2-2-2-7.2ZM9.8 20a2.4 2.4 0 0 0 4.4 0",
  /* WhatsApp receipts. One tick = sent to the server, two = on the handset;
     the colour, not the count, is what says "read". */
  tick: "m3.5 12.5 4.5 4.5 8.5-10",
  tickDouble: "m2 12.5 4.5 4.5 8.5-10M10.5 16.2 12 17.8l7-8.3",
  /* The rail's off-canvas toggle on narrow screens. */
  menu: "M3.5 6.5h17M3.5 12h17M3.5 17.5h17",

  /* Settings: sliders, not a gear and not a lightning bolt.
     A bolt means "automatic" — it is already doing that job on the Auto tag and
     the scheduler button, so using it for Settings too made one glyph mean two
     unrelated things. A cog is the other convention, but a cog drawn at this
     weight needs teeth to read as a cog; simplified to a spoked circle it is
     indistinguishable from the `sun` theme toggle sitting inches away in the
     same bar. Sliders collide with nothing here and read unambiguously as
     "things you set". */
  settings: "M3.5 7h10.5M18 7h2.5M3.5 12h2.5M10 12h10.5M3.5 17h8.5M16 17h4.5"
    + "M16 5a2 2 0 1 0 0 4 2 2 0 1 0 0-4ZM8 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4Z"
    + "M14 15a2 2 0 1 0 0 4 2 2 0 1 0 0-4Z",

  /* Full screen: four corner brackets opening outward, and inward to leave.
     `expand`/`collapse` are a bordered panel with a divider and a chevron —
     a SIDEBAR toggle, which is exactly what they are used for on the rail.
     Reusing them for the grid's full-screen control said "collapse the panel"
     when it meant "fill the screen". */
  fullscreen: "M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15",
  fullscreenExit: "M4.5 9H9V4.5M19.5 9H15V4.5M4.5 15H9v4.5M19.5 15H15v4.5",

  phone: "M6.8 3.5 9 8l-2 1.6a12 12 0 0 0 5.4 5.4L14 13l4.5 2.2v3.6a1.7 1.7 0 0 1-1.9 1.7C9.3 20 4 14.7 3.2 7.4A1.7 1.7 0 0 1 4.9 5.5h1.9Z",
  video: "M3.5 7.5A1.5 1.5 0 0 1 5 6h8.5A1.5 1.5 0 0 1 15 7.5v9A1.5 1.5 0 0 1 13.5 18H5a1.5 1.5 0 0 1-1.5-1.5v-9ZM15 10.5l5.5-3v9l-5.5-3",
  dots: "M12 6.5h.01M12 12h.01M12 17.5h.01",
  lock: "M6.5 10.5h11v9h-11zM9 10.5V7.5a3 3 0 0 1 6 0v3",
  mic: "M12 3.5a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-5 0V6A2.5 2.5 0 0 1 12 3.5ZM5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3",
  attach: "M20 11.5 12 19.5a5 5 0 0 1-7-7l8-8a3.4 3.4 0 0 1 4.8 4.8l-8 8a1.8 1.8 0 0 1-2.5-2.5l7.3-7.3",
  smile: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM8.8 9.5h.01M15.2 9.5h.01M8 14a5 5 0 0 0 8 0",
  camera: "M3.5 8.5A1.5 1.5 0 0 1 5 7h2l1.5-2.5h7L17 7h2a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-9ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
};

/* ---------------------------------------------------------------------------
   Brand marks for the two channels clients actually receive things on. These
   are filled, full-colour glyphs rather than members of the stroke set above:
   a WhatsApp message and an email are recognised by their logo far faster than
   by any neutral icon, and that recognition is the whole point in an outbox.
   ------------------------------------------------------------------------- */

export type BrandName = "whatsapp" | "email";

export function BrandIcon({
  name, size = 16, className,
}: { name: BrandName; size?: number; className?: string }) {
  if (name === "whatsapp") {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#25D366"
          d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
        />
      </svg>
    );
  }
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="4" width="21" height="16" rx="2.6" fill="#EA4335" />
      <path d="M1.5 6.6 12 13.6l10.5-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Icon({
  name, size = 17, className, style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={P[name]} />
    </svg>
  );
}
