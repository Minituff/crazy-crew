# Progress Tracker — Crazy Crew

## Current Status: Staycation 2026 is the active trip

Last updated: 2026-07-25

New trip added (2026-07-25):
- `data/itineraries/staycation-2026.md` created — Staycation 2026, Jul 29 – Aug 2 2026 (Phoenix/Prescott/Peoria, AZ), `current: true`
- `bear-2026.md` `current` flag flipped to `false` (trip already concluded Jul 3–8; only one trip should carry `current: true` at a time)
- Day headings use exact `## {Weekday}` format (no date suffix) per the push-scheduler contract, unlike `bear-2026.md` which has `## Thursday June 4th`-style headings

Push module extraction (2026-06-05):
- All push concerns moved from `server/index.js` into `server/push.js`
- `server/push.js` exports `initPush()`, `sendPushToAll()`, `mountPushRoutes(app)`
- `server/index.js` reduced to three push-related lines: import, `initPush()`, `mountPushRoutes(app)`
- Scheduler stays in `index.js` — it's trip business logic that calls `sendPushToAll`

Initial build (2026-06-05):
- Full project scaffolded from scratch — Express server, React/Vite client, Docker prod + dev setup
- Push notification system copied verbatim from cadence (`getVapidKeys`, `readPushSubs`, `savePushSubs`, `sanitizePushSub`, `sendPushToAll`)
- 9am daily push scheduler using `setInterval` + `lastFiredKey` dedup pattern (from cadence)
- gray-matter date quirk fixed: bare `YYYY-MM-DD` frontmatter values parsed as JS `Date` objects by js-yaml; `normDate()` helper converts back to ISO strings
- Sample itinerary `data/itineraries/bear-2026.md` created (Big Bear Lake, Jul 3–8 2026)
- Hot-reload dev environment: `docker-compose.dev.yml` + `Dockerfile.dev` with nodemon + Vite HMR + concurrently

Current trip redirect (2026-06-05):
- `/` auto-redirects to first trip with `current: true` in frontmatter; falls back to first date-active trip; falls back to `/trips`
- `/trips` always shows the card grid — no redirect
- `← All Trips` link in itinerary header band
- Header logo links to `/trips`
- `bear-2026.md` marked `current: true` by user

Context docs (2026-06-05):
- `context/` folder created with project-overview, architecture, ui-context, and progress-tracker

---

## Completed Features

### Infrastructure
- [x] Multi-stage prod Dockerfile (Vite build → Express static serve)
- [x] Dev Dockerfile with nodemon + Vite HMR
- [x] `docker-compose.yml` — production, macvlan `10.1.2.112`, port 3000
- [x] `docker-compose.dev.yml` — dev, macvlan `10.1.2.113`, ports 3000 + 5173
- [x] `./data:/data` bind-mount for all persistence
- [x] Traefik labels on dev compose (`crazy-crew.minituff.net → port 5173`)
- [x] `.gitignore` — excludes `node_modules/`, `client/dist/`, `vapid_keys.json`, `push_subscriptions.json`, `.env`

### Backend (`server/index.js`)
- [x] `GET /api/itineraries` — scans `data/itineraries/*.md` + `data/custom-trips.json`, returns merged sorted array with `active` and `current` fields
- [x] `GET /api/itineraries/:slug` — returns `{ slug, frontmatter, raw }` (raw = body without YAML block)
- [x] `GET /sw.js` served with `Service-Worker-Allowed: /` header
- [x] SPA fallback — all non-API routes serve `index.html`
- [x] 9am push scheduler — extracts `## {Weekday}` section from active itinerary
- [x] `normDate()` helper for gray-matter date objects

### Backend (`server/push.js`)
- [x] `initPush()` — loads/generates VAPID keys, calls `webpush.setVapidDetails`
- [x] `sendPushToAll(payload)` — fan-out with automatic dead-sub cleanup
- [x] `mountPushRoutes(app)` — registers all push API routes
- [x] `GET /api/push/vapid-public-key`
- [x] `POST /api/push/subscribe` — upsert by deviceId or endpoint
- [x] `DELETE /api/push/subscribe`
- [x] `DELETE /api/push/subscriptions/others`
- [x] `GET /api/push/subscriptions`
- [x] `DELETE /api/push/subscriptions/:deviceId`
- [x] `GET /api/push/subscriptions/count`
- [x] `POST /api/notify/test`

### Frontend
- [x] `App.jsx` — react-router-dom routes: `/`, `/trips`, `/:slug`
- [x] `Home.jsx` — smart redirect (current → active → /trips)
- [x] `AllTrips.jsx` — card grid, hero section
- [x] `Header.jsx` — sticky orange-bordered header, links to `/trips`
- [x] `TripCard.jsx` — colored top border, emoji, title, date range, location, ACTIVE NOW badge
- [x] `ItineraryView.jsx` — react-markdown + remark-gfm, gradient header, ← All Trips link
- [x] `PushSubscribe.jsx` — floating Bell/BellOff button, service worker registration
- [x] `push.js` — copied from cadence, storageKey `'crazycreNotificationDeviceId'`
- [x] `sw.js` — copied from cadence, tag/title updated to `'crazy-crew'` / `'Crazy Crew'`
- [x] `global.css` — Fredoka One + Nunito, CSS vars, all component styles
- [x] `trips.js` — empty custom page registry with commented example

### Data
- [x] `data/itineraries/bear-2026.md` — Big Bear 2026 itinerary, `current: false` (concluded)
- [x] `data/itineraries/staycation-2026.md` — Staycation 2026 itinerary, `current: true` (active default)
- [x] `data/custom-trips.json` — empty array

### Docs
- [x] `context/project-overview.md`
- [x] `context/architecture.md`
- [x] `context/ui-context.md`
- [x] `context/progress-tracker.md`

---

## Architectural Decisions

| Decision | Rationale |
|---|---|
| Push code copied verbatim from cadence | Proven in production. No reason to reinvent. |
| gray-matter for frontmatter parsing | Standard library; avoids writing a YAML parser. `normDate()` handles the Date object quirk. |
| `current: true` frontmatter flag | Explicit manual control over which trip shows on startup — more reliable than relying solely on dates during and between trips. |
| `/` redirects, `/trips` does not | Bookmarking `crazy-crew.com` always lands on the active experience. `/trips` is the stable "browse" URL. |
| Header always links to `/trips` | Tapping the logo while on a trip shouldn't re-trigger the redirect. |
| No CSS framework | Project is small enough that a single `global.css` is easier to reason about than a utility class system. |
| react-router-dom for routing | Needed for the custom page registry pattern (lazy-loaded components per slug). |
| Custom pages are fully self-contained | No constraints means no fighting the framework for bespoke trip pages. |
| `setInterval` + `lastFiredKey` (not node-cron) | Same battle-tested pattern as cadence — avoids an additional dependency. |
| Push logic in `server/push.js`, not `index.js` | Makes the push surface (VAPID, subscriptions, routes) easy to find and modify in isolation. Scheduler stays in `index.js` because it owns the trip-awareness logic. |

---

## Known Issues / Open Items

- [ ] No PWA manifest or app icons yet — `icon-192.png` / `icon-512.png` / `manifest.json` not created; install-to-homescreen works but uses browser default icon
- [ ] Push notifications show no icon (falls back to browser default since `/icon-192.png` does not exist)
- [ ] No `CLAUDE.md` at repo root yet

---

## Adding a New Trip

1. Create `data/itineraries/{slug}.md` with YAML frontmatter (title, emoji, start, end, location, cover_color)
2. Add `## {Full Weekday Name}` day headings for the push scheduler
3. Set `current: true` when the trip is the active focus
4. Rebuild (`docker compose up -d --build`) — no code changes needed

## Adding a Custom React Trip Page

1. Create `client/src/pages/{Name}Page.jsx`
2. Register in `client/src/trips.js`: `'slug': { component: lazy(() => import('./pages/{Name}Page.jsx')) }`
3. Add entry to `data/custom-trips.json` with slug, title, emoji, dates, location, cover_color
4. Rebuild
