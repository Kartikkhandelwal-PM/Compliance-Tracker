# Compliance Tracker

Statutory compliance tracking for a CA practice: what is due, what is late, who
owns it, and what the client has been told.

**Live:** https://kartikkhandelwal-pm.github.io/Compliance-Tracker/

## What it is

A working front-end over a rule engine that maps India's statutory calendar
onto a book of clients. The demo runs on 640 generated clients against 52
compliances, so every figure on screen is computed rather than typed.

| Screen | Answers |
|---|---|
| Dashboard | What has to go out in the next seven days, and what is already late |
| Calendar | When everything is due, as a month grid or a year timeline |
| Compliances | The catalogue: each form, its recurrence, its due rule, its penalty |
| Tracker | Every client against every compliance, one grid |
| Clients | The book, filtered and sorted |
| Reminders | What each client was actually told, and whether they read it |

## Running it

```bash
cd frontend
npm install
npm run dev
```

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run typecheck` | Types only |

## Deployment

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. The build sets `GITHUB_PAGES=true`, which
switches Vite's `base` to `/Compliance-Tracker/`; `404.html` is emitted as a
copy of `index.html` so deep links resolve client-side.

## Layout

```
frontend/src
  domain/    the rule engine, statutory calendar, client book, message templates
  routes/    one file per screen
  ui/        shared components and the design system
  styles/    tokens.css (the palette) + app.css
```

`domain/` holds no React and `routes/` holds no business logic, so the engine
can be lifted to a backend without touching the screens.
