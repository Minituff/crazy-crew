# UI Context — Crazy Crew

## Design Language

Warm, playful, and family-friendly. Light background with punchy accent colors. Fredoka One (rounded display font) for all headings gives the site a fun, approachable feel. Nunito (clean humanist sans) for body text keeps things readable. The palette is warm and vibrant — designed to feel like a vacation, not a dashboard.

## Design Tokens (CSS Custom Properties)

Defined in `client/src/styles/global.css` `:root`:

### Colors

| Token | Value | Usage |
|---|---|---|
| `--orange` | `#FF6B35` | Primary accent — header border, card tops, hero title, push button |
| `--teal` | `#00B4D8` | Secondary accent — itinerary day headings (`## h2`), "ACTIVE NOW" badge |
| `--yellow` | `#FFD166` | Tertiary — available for highlights, custom page use |
| `--bg` | `#FFF8F0` | Page background — warm off-white |
| `--text` | `#2D3748` | Primary text — dark slate |
| `--text-light` | `#718096` | Secondary text — dates, location, captions |
| `--radius` | `14px` | Default border radius |
| `--shadow` | `0 4px 20px rgba(0,0,0,0.10)` | Card resting shadow |
| `--shadow-hover` | `0 8px 32px rgba(0,0,0,0.16)` | Card hover shadow |

### Typography

| Token | Value | Usage |
|---|---|---|
| `--font-display` | `'Fredoka One', cursive` | All headings (h1, h2, h3), card titles, site wordmark |
| `--font-body` | `'Nunito', sans-serif` | Body text, buttons, metadata, captions |

## Layout

- Max content width: `960px` for the homepage grid; `760px` for the itinerary view
- Centered with `margin: 0 auto`, padding `0 24px 80px`
- Header: sticky top, `64px` tall, white with `3px solid var(--orange)` bottom border and subtle box-shadow
- Push bell: fixed bottom-right at `24px` offset, `52px` circular button

## Components

### `<Header>`
Sticky site header. "Crazy Crew 🎉" wordmark in Fredoka One orange. Always links to `/trips`. Serves as the consistent way back to the card grid from any page.

### `<TripCard>`
White card with `5px` colored top border using `--card-color` CSS variable (set from `trip.cover_color`). Hover lifts with `translateY(-4px)` and deeper shadow. Contains:
- Large emoji (`3rem`)
- Trip title in Fredoka One
- Date range + location in `--text-light`
- "ACTIVE NOW" teal badge (absolute, top-right) when `trip.active === true`

### `<AllTrips>` (homepage grid)
Hero section: "Welcome, Crazy Crew! 🎉" in Fredoka One orange, subtitle in `--text-light`. Responsive grid: `repeat(auto-fill, minmax(280px, 1fr))`, `24px` gap.

### `<ItineraryView>`
Full-page trip view:
- **Header band**: gradient using `--header-color` (from `cover_color`), white text, trip emoji, title in Fredoka One, location, and "← All Trips" back link
- **Content**: `react-markdown` with custom prose styles

### Itinerary Markdown Styles

| Element | Style |
|---|---|
| `h1` | Fredoka One, orange (`--orange`), `2rem` |
| `h2` | Fredoka One, teal (`--teal`), `1.6rem`, bottom border |
| `h3` | Fredoka One, `--text`, `1.2rem` |
| `p` | `1.05rem`, `1.75` line-height, `16px` bottom margin |
| `strong` | `font-weight: 800` |
| `a` | Teal, `font-weight: 700`, underline on hover |
| `table` | Full-width, collapsed borders, `#f7fafc` header row |

### `<PushSubscribe>`
Floating circular button (orange, `52px`) pinned bottom-right. Shows `<Bell>` (subscribe) or `<BellOff>` (unsubscribe) from lucide-react. Scales up 10% on hover. Hidden if `serviceWorker`/`PushManager` not available.

### "← All Trips" link
Lives inside the itinerary header band. Semi-transparent white (`rgba(255,255,255,0.75)`), brightens to full white on hover. Small (`0.875rem`), bold. Provides the primary "back" navigation.

## State Indicators

| State | Appearance |
|---|---|
| Loading | Centered `60px` padded text, `--text-light`, 700 weight |
| Error | Centered `60px` padded text, `#e53e3e` red, 700 weight |
| Empty (no trips) | Centered `60px` padded text, `--text-light`, suggests adding a `.md` file |

## Interaction Patterns

- **TripCard hover**: `translateY(-4px)` lift + deeper shadow — desktop-only transform (touch devices don't hover)
- **Push button hover**: `scale(1.1)` + intensified orange shadow
- **No toast library** — push state changes are reflected immediately in the bell icon
- **SPA navigation**: react-router-dom `<Link>` for all internal nav; no full page reloads
- **Smart home redirect**: `/` fires a fetch, shows "Loading…" briefly, then navigates; users should not notice the redirect on fast connections

## Custom Page Freedom

Pages in `client/src/pages/` are fully self-contained — no constraints on layout, fonts, or styles. They can import CSS modules, use any layout, embed maps or photos, and fetch from any API. The only integration point is registration in `trips.js` and metadata in `custom-trips.json`.
