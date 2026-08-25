/* ============================================================================
   APP SHELL
   ----------------------------------------------------------------------------
   Five destinations, each a distinct job. Earlier versions had seven, three of
   which (Today / Filing runs / Calendar) were the same list of filing runs in
   different clothes — which is what made the app hard to hold in your head.

     Dashboard  — where do we stand this month
     Calendar   — when is everything due (calendar + timeline views)
     Tracker    — the whole book against every compliance, one grid
     Clients    — the client list
     Reminders  — what we have told clients

   Two things are deliberately NOT here.

   The rule catalogue: nobody opens an app to read "status logic" or browse the
   ITR ladder — that documents how the engine decides, a job for whoever builds
   the backend. The real user question ("why does this apply to this client?")
   is asked while looking at one obligation, so it lives in that obligation's
   drawer; the catalogue sits under Settings with the rest of the configuration.

   Team: levelling work is a filter ("owner"), present on every screen that
   lists anything, not a destination of its own.

   Penalty exposure used to sit permanently at the foot of the rail. It has been
   demoted: late fees are a consequence of missing a date, not the thing anyone
   is tracking, and putting a rupee figure in front of every screen made the app
   read like a debt collector. It now appears as a secondary column beside the
   filings it belongs to.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Icon } from "./ui/Icon.tsx";
import type { IconName } from "./ui/Icon.tsx";
import { CommandPalette } from "./ui/CommandPalette.tsx";
import { useApp, useEngine, useObligations, useOutbox } from "./ui/app-state.tsx";
import {
  getFirm, getNotificationSettings, getViewedNotifs, markNotifViewed, summarise,
} from "./domain/engine.ts";
import {
  CLIENTS, CLIENT_BY_ID, GST_ENTITIES, GST_ENTITY_BY_ID, TDS_DEDUCTORS, TDS_DEDUCTOR_BY_ID,
} from "./domain/book.ts";
import { DEFS, FY_START } from "./domain/catalog.ts";
import { TODAY, addDays, fmtDate } from "./domain/dates.ts";
import { Avatar } from "./ui/bits.tsx";
import { Logo } from "./ui/Logo.tsx";
import { Splash } from "./ui/Splash.tsx";

import { TodayPage } from "./routes/Today.tsx";
import { RunsPage } from "./routes/Runs.tsx";
import { RunDetailPage } from "./routes/RunDetail.tsx";
import { CalendarPage } from "./routes/Calendar.tsx";
import { ClientsPage } from "./routes/Clients.tsx";
import { ClientDetailPage } from "./routes/ClientDetail.tsx";
import { MatrixPage } from "./routes/Matrix.tsx";
import { TeamPage } from "./routes/Team.tsx";
import { RulesPage } from "./routes/Rules.tsx";
import { RemindersPage } from "./routes/Reminders.tsx";
import { CompliancesPage } from "./routes/Compliances.tsx";
import { ComplianceDetailPage } from "./routes/ComplianceDetail.tsx";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  count?: number;
  alarm?: boolean;
  end?: boolean;
}

export function App() {
  const { theme, toggleTheme, me } = useApp();
  /* The shell — Dashboard's own stats and the notification bell — is about
     right now, not the client book's whole history. Scoped to the current
     year so a resolved arrear from a retired financial year can't inflate
     "in arrears" or win "biggest backlog" years after it was actually filed. */
  const allObligations = useObligations();
  const obligations = useMemo(
    () => allObligations.filter((o) => o.fy === FY_START),
    [allObligations],
  );
  const outbox = useOutbox();
  const notifSettings = useEngine(getNotificationSettings);
  const viewedNotifs = useEngine(getViewedNotifs);
  const firm = useEngine(getFirm);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  /* The rail's own scroll container clips anything that pokes out past its
     width (an `overflow-y: auto` box forces overflow-x to auto too, per the
     CSS spec, even though only y was ever set) — so a tooltip positioned
     relative to its nav link never escapes the collapsed 60px rail. Rendered
     through a portal at real screen coordinates instead, it sits above
     everything and isn't clipped by any ancestor. */
  const [navTip, setNavTip] = useState<{ label: string; top: number; left: number } | null>(null);
  useEffect(() => {
    if (!collapsed) setNavTip(null);
  }, [collapsed]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  /* On a phone the rail has nowhere to live permanently — it opens as an
     off-canvas drawer over the page instead of sharing the row with it. */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  /* Shown once per page load while the engine builds the book. */
  const [booting, setBooting] = useState(true);

  /* The scrolling element is `.work`, not the window. */
  const workRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  /**
   * Send a new page back to the top.
   *
   * Nothing does this for us. The window never scrolls — `.work` owns the
   * overflow — so the browser has no scroll position to restore and React
   * Router's <ScrollRestoration> is both unavailable under BrowserRouter and
   * scoped to the window regardless. The result was that leaving the tracker
   * half-scrolled and coming back later dropped the reader into the middle of
   * a grid, under a heading they never saw.
   *
   * `behavior: "instant"` because `.work` is declared `scroll-behavior: smooth`
   * for in-page anchors; inherited here it would turn every navigation into a
   * long glide up through the previous page's content.
   *
   * Keyed on pathname only. The query string is page-local state on several
   * screens — Filing runs keeps its tab there, and the log its filters — and
   * those must not throw the reader to the top mid-task.
   */
  useEffect(() => {
    workRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

  const summary = useMemo(() => summarise(obligations), [obligations]);

  const dueSoonRuns = useMemo(() => {
    const horizon = addDays(TODAY, 7);
    const runIds = new Set<string>();
    for (const o of obligations) {
      if (o.status === "Pending" && o.dueDate >= TODAY && o.dueDate <= horizon) runIds.add(o.runId);
    }
    return runIds.size;
  }, [obligations]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      setPaletteOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* One flat list. Five items do not need grouping headers, and the headers
     were themselves part of what made the rail feel busy. */
  const items: NavItem[] = [
    { to: "/", label: "Dashboard", icon: "today", end: true },
    { to: "/calendar", label: "Calendar", icon: "calendar", count: dueSoonRuns },
    { to: "/compliances", label: "Compliances", icon: "rules", count: DEFS.length },
    { to: "/tracker", label: "Tracker", icon: "matrix", count: summary.overdueCount, alarm: summary.overdueCount > 0 },
    /* The badge covers all three record types the page opens on (GST/TDS/
       ITR), not just the ITR bucket — CLIENTS.length alone under-reported
       what "Clients" actually holds once the other two tabs exist. */
    { to: "/clients", label: "Clients", icon: "clients", count: CLIENTS.length + GST_ENTITIES.length + TDS_DEDUCTORS.length },
    { to: "/reminders", label: "Reminders", icon: "outbox" },
    { to: "/settings", label: "Settings", icon: "settings" },
  ];

  const crumbs = useMemo(() => breadcrumbs(location.pathname), [location.pathname]);

  /* Notifications are derived from the book, never stored. Each one is a real
     condition someone has to act on, and each links to the screen that acts on
     it. Nothing here is a "welcome" or a "tip". */
  const notifications = useMemo(() => {
    const list: { to: string; title: string; body: string; tone: string; icon: IconName; kind: string }[] = [];
    /* Which conditions are allowed to shout is firm configuration — every one
       of these is real, but which of them a given practice wants raised
       differs. Set on Settings → Notifications. */
    const on = notifSettings;

    const worst = new Map<string, { form: string; period: string; runId: string; n: number }>();
    let failedSends = 0;
    let dueToday = 0;
    for (const o of obligations) {
      if (o.status === "Overdue") {
        const cur = worst.get(o.runId);
        if (cur) cur.n++;
        else worst.set(o.runId, { form: o.form, period: o.periodLabel, runId: o.runId, n: 1 });
      }
      if (o.status === "Pending" && o.dueDate === TODAY) dueToday++;
    }
    for (const e of outbox) if (e.status === "Failed") failedSends++;

    const top = [...worst.values()].sort((a, b) => b.n - a.n)[0];
    if (top && on.gap) {
      list.push({
        to: `/runs/${encodeURIComponent(top.runId)}`,
        title: `${top.n} clients have not filed ${top.form}`,
        body: `${top.period} · highest number of pending clients`,
        tone: "risk",
        icon: "alert",
        kind: "gap",
      });
    }
    if (dueToday > 0 && on.dueToday) {
      list.push({
        to: `/calendar?date=${TODAY}`,
        title: `${dueToday.toLocaleString("en-IN")} filings are due today`,
        body: "Due by end of day",
        tone: "warn",
        icon: "clock",
        kind: "dueToday",
      });
    }
    if (summary.unassigned > 0 && on.unowned) {
      list.push({
        to: "/clients?owner=none",
        title: `${summary.unassigned.toLocaleString("en-IN")} open items have no owner`,
        body: "No staff member is assigned",
        tone: "warn",
        icon: "user",
        kind: "unowned",
      });
    }
    if (failedSends > 0 && on.failed) {
      list.push({
        to: "/reminders?status=failed",
        title: `${failedSends} reminders failed to send`,
        body: "The client was not notified",
        tone: "risk",
        icon: "send",
        kind: "failed",
      });
    }
    return list;
  }, [obligations, outbox, summary.unassigned, notifSettings]);

  /* Read against the title, not a stored flag — the same alert with a bigger
     number ("3 clients" → "5 clients") is new information and should raise
     the badge again, not stay marked read because that kind was clicked once. */
  const unreadCount = notifications.filter((n) => viewedNotifs[n.kind] !== n.title).length;

  return (
    <div className="shell">
      {mobileNavOpen ? (
        <div className="railscrim" onClick={() => setMobileNavOpen(false)} />
      ) : null}
      <nav
        className={`rail${collapsed ? " is-collapsed" : ""}${mobileNavOpen ? " is-mobile-open" : ""}`}
        aria-label="Main"
      >
        <div className="rail__brand">
          <span className="rail__mark"><Logo size={26} /></span>
          <span className="rail__wordmark">
            <b>Compliance Tracker</b>
            <span>KDK · {fmtDate(TODAY)}</span>
          </span>
          <button
            type="button"
            className="railclose"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="rail__scroll">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) => `navlink${isActive ? " is-active" : ""}`}
              aria-label={collapsed ? it.label : undefined}
              onMouseEnter={(e) => {
                if (!collapsed) return;
                const r = e.currentTarget.getBoundingClientRect();
                setNavTip({ label: it.label, top: r.top + r.height / 2, left: r.right + 12 });
              }}
              onFocus={(e) => {
                if (!collapsed) return;
                const r = e.currentTarget.getBoundingClientRect();
                setNavTip({ label: it.label, top: r.top + r.height / 2, left: r.right + 12 });
              }}
              onMouseLeave={() => setNavTip(null)}
              onBlur={() => setNavTip(null)}
            >
              <Icon name={it.icon} className="navlink__icon" />
              <span className="navlink__text">{it.label}</span>
              {it.count != null && it.count > 0 ? (
                <span className={`navlink__count${it.alarm ? " is-alarm" : ""}`}>
                  {it.count > 999 ? `${Math.round(it.count / 100) / 10}k` : it.count}
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
        {collapsed && navTip ? createPortal(
          <span className="navtip" style={{ top: navTip.top, left: navTip.left }}>
            {navTip.label}
          </span>,
          document.body,
        ) : null}

        {/* The rail used to end after the nav list and read as unfinished. It
            now closes with the two things a rail is actually good for: a live
            read on the week, and who you are signed in as. */}
        <div className="rail__foot">
          <Link to="/calendar" className="railnow">
            <span className="railnow__head">This week</span>
            <span className="railnow__grid">
              <span>
                <b className="num">{summary.dueThisWeek.toLocaleString("en-IN")}</b>
                <em>due</em>
              </span>
              <span className={summary.overdueCount > 0 ? "is-late" : undefined}>
                <b className="num">{summary.overdueCount.toLocaleString("en-IN")}</b>
                <em>late</em>
              </span>
              <span>
                <b className="num">{summary.filedThisMonth.toLocaleString("en-IN")}</b>
                <em>filed</em>
              </span>
            </span>
          </Link>

          <button
            type="button"
            className="railcollapse"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "expand" : "collapse"} size={16} />
            <span>Collapse</span>
          </button>
        </div>
      </nav>

      <main className="work" ref={workRef}>
        {/* The breadcrumb used to repeat the page title on every top-level
            screen, so "Dashboard" appeared twice within 60px of itself. It now
            renders only where it earns its place: on a nested route, as a way
            back up. Top-level pages leave the slot empty and let the page's own
            header be the single title. */}
        <div className="topline">
          <button
            type="button"
            className="navtoggle iconbtn"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
          >
            <Icon name="menu" size={19} />
          </button>
          {crumbs.length > 1 ? (
            <div className="crumbs">
              {crumbs.map((c, i) => (
                <span key={i} className="u-row">
                  {i > 0 ? <span className="crumbs__sep">/</span> : null}
                  {c.to
                    ? <Link to={c.to}>{c.label}</Link>
                    : <span style={{ color: "var(--ink)" }}>{c.label}</span>}
                </span>
              ))}
            </div>
          ) : null}
          {/* Search takes the empty middle rather than hugging the right edge,
              which is what made this bar read as blank on top-level screens. */}
          <button type="button" className="searchbtn" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={15} />
            <span className="searchbtn__label">Search clients, compliances, PAN, GSTIN or TAN</span>
            <span className="kbd">/</span>
          </button>

          <div className="topline__tools">
            <div className="popwrap">
              <button
                type="button"
                className={`iconbtn${notifOpen ? " is-on" : ""}`}
                onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
                aria-expanded={notifOpen}
                aria-haspopup="menu"
                title="Notifications"
                aria-label={`Notifications, ${unreadCount} unread`}
              >
                <Icon name="bell" size={17} />
                {/* A bare dot said "something happened" and nothing more. The
                    count is the whole point: four things needing attention is
                    a different morning from one. Counts unread only — an alert
                    already opened stops raising the badge until it changes. */}
                {unreadCount > 0 ? (
                  <span className="iconbtn__badge num">{unreadCount}</span>
                ) : null}
              </button>

              {notifOpen ? (
                <>
                  <div className="sheetscrim" onClick={() => setNotifOpen(false)} />
                  <div className="pop pop--wide" role="menu">
                    <div className="pop__head">
                      Needs attention
                      {notifications.length > 0 ? (
                        <span className="pop__n num">{notifications.length}</span>
                      ) : null}
                    </div>
                    <div className="pop__list">
                      {notifications.map((n) => {
                        const unread = viewedNotifs[n.kind] !== n.title;
                        return (
                          <Link
                            key={n.to + n.title}
                            to={n.to}
                            className={`notif${unread ? " is-unread" : ""}`}
                            role="menuitem"
                            onClick={() => {
                              markNotifViewed(n.kind, n.title);
                              setNotifOpen(false);
                            }}
                          >
                            {/* Tone was carried by a 8px dot, which is the least
                                legible mark available. It is now the tint of an
                                icon chip that also says what kind of thing this
                                is — a deadline, an owner gap, a failed send. */}
                            <span className={`notif__ico n-${n.tone}`}>
                              <Icon name={n.icon} size={14} />
                            </span>
                            <span className="notif__body">
                              <b>{n.title}</b>
                              <span>{n.body}</span>
                            </span>
                            <span className="notif__go">
                              <Icon name="chevronRight" size={14} />
                            </span>
                          </Link>
                        );
                      })}
                      {notifications.length === 0 ? (
                        <div className="pop__empty">
                          <span className="pop__emptyico"><Icon name="check" size={18} /></span>
                          <b>All clear</b>
                          <span>Nothing needs attention right now.</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="pop__foot">
                      <Link to="/tracker" className="pop__footlink" onClick={() => setNotifOpen(false)}>
                        Open the tracker
                      </Link>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <button
              type="button"
              className="iconbtn"
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
            </button>

            <span className="topline__div" />

            <div className="popwrap">
              <button
                type="button"
                className={`profilebtn${profileOpen ? " is-on" : ""}`}
                onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                title={`${me.name} · ${me.role}`}
              >
                <Avatar initials={me.initials} />
                <Icon name="chevronDown" size={13} className="profilebtn__caret" />
              </button>

              {profileOpen ? (
                <>
                  <div className="sheetscrim" onClick={() => setProfileOpen(false)} />
                  <div className="pop" role="menu">
                    {/* The identity block's text wrapper carries a class of its
                        own. It used to be a bare <span>, which `.pop__id span`
                        also matched — including the Avatar, whose own
                        display:grid centring lost to it, so the initials sat in
                        the top-left corner of the circle. */}
                    <div className="pop__id">
                      <Avatar initials={me.initials} large />
                      <span className="pop__idtext">
                        <b>{me.name}</b>
                        <em>{me.role} · {firm.name}</em>
                      </span>
                    </div>
                    <div className="pop__list">
                      <Link to="/clients" className="pop__item" role="menuitem" onClick={() => setProfileOpen(false)}>
                        <Icon name="clients" size={15} /> My clients
                      </Link>
                      <button type="button" className="pop__item" role="menuitem" onClick={() => setProfileOpen(false)}>
                        <Icon name="user" size={15} /> Account
                      </button>
                      <Link to="/settings" className="pop__item" role="menuitem" onClick={() => setProfileOpen(false)}>
                        <Icon name="rules" size={15} /> Settings
                      </Link>
                      <button
                        type="button"
                        className="pop__item"
                        role="menuitem"
                        onClick={() => { toggleTheme(); setProfileOpen(false); }}
                      >
                        <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
                        {theme === "dark" ? "Light theme" : "Dark theme"}
                      </button>
                    </div>
                    <div className="pop__sep" />
                    <div className="pop__list">
                      <button type="button" className="pop__item pop__item--danger" role="menuitem" onClick={() => setProfileOpen(false)}>
                        <Icon name="ban" size={15} /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/compliances" element={<CompliancesPage />} />
          <Route path="/compliances/:code" element={<ComplianceDetailPage />} />
          <Route path="/tracker" element={<MatrixPage />} />
          <Route path="/matrix" element={<MatrixPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          {/* Settings holds only what a person can change — currently the
              reminder engine's two guards. The ITR ladder and status
              precedence tables that used to live here were read-only
              specifications of the engine's decision logic: useful to whoever
              builds the backend, useless to a CA, and unactionable either way.
              The one question they answered that a user does ask — "why does
              this apply to this client?" — is answered in the obligation's own
              drawer, against the obligation. */}
          <Route path="/settings" element={<RulesPage />} />
          <Route path="/settings/rules" element={<RulesPage />} />
          <Route path="/rules" element={<RulesPage />} />
        </Routes>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {booting ? <Splash onDone={() => setBooting(false)} /> : null}
    </div>
  );
}

function breadcrumbs(path: string): { label: string; to?: string }[] {
  const seg = path.split("/").filter(Boolean);
  if (seg.length === 0) return [{ label: "Dashboard" }];
  const first = seg[0];
  const map: Record<string, string> = {
    runs: "Filing",
    calendar: "Calendar",
    clients: "Clients",
    compliances: "Compliances",
    tracker: "Tracker",
    matrix: "Tracker",
    team: "Team",
    rules: "Settings",
    reminders: "Reminders",
    settings: "Settings",
  };
  /* Settings is a real parent, so its child keeps a readable label rather
     than the raw slug every other detail route falls back to. */
  if (first === "settings") {
    return [{ label: "Settings" }, { label: map[seg[1]] ?? seg[1] ?? "" }];
  }
  const head = { label: map[first] ?? first, to: seg.length > 1 ? `/${first}` : undefined };
  if (seg.length === 1) return [head];

  /* Resolve a client's internal id to their name. Internal ids are never shown
     to users, and the URL segment would otherwise surface one here. */
  const child = decodeURIComponent(seg[1]);
  /* The path alone doesn't say which of the three unlinked records this id
     belongs to (that lives in the `?type=` query string, not the pathname),
     so this checks all three id-spaces — they never overlap. */
  const label = first === "clients"
    ? (CLIENT_BY_ID[child]?.name ?? GST_ENTITY_BY_ID[child]?.name ?? TDS_DEDUCTOR_BY_ID[child]?.name ?? "Client")
    : child;
  return [head, { label }];
}
