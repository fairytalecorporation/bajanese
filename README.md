# Bajanese

Bajan meets Chinese. The website for the Bajanese Restaurant (Lower Collymore Rock, St. Michael) and the Bajanese Grill (St. George, Thursday to Saturday), live at [bajanese.com](https://bajanese.com) on GitHub Pages.

A static site: plain HTML, CSS and ES5 JavaScript, with no build step. Customers can build an order and send it to a location on WhatsApp until the Bajanese web and mobile apps launch.

## Pages

| Page | What it's for |
|---|---|
| `index.html` | Home: both locations, deals, featured dishes, catering, the app |
| `menu.html` | Restaurant and Grill menus, with Add and ♥ (favourite) buttons |
| `order.html` | The cart, WhatsApp checkout, and recent orders |
| `locations.html` | Both locations with hours, open-now status, and contact links |
| `catering.html` | Catering packages and event quotes |
| `app.html` | The coming app, rewards, app deals, and the waitlist |
| `about.html`, `careers.html`, `faq.html`, `privacy.html`, `terms.html` | Supporting pages |

## Editing content

Most day-to-day changes are made in the `data/` files. The website reads them now, and the apps are meant to read the same files later.

- **`data/menu.json`**: dishes and prices.
  - Prices are in BBD cents (`800` = $8).
  - `days` limits a dish to certain days, numbered Monday = 1 (the Grill uses `[4, 5, 6]`).
  - `sizes` and `options` give customers choices when they add the dish.
  - `allergens: null` means allergen information hasn't been recorded yet. Use `[]` only when a dish really has none.
  - Never change a dish's `id` once it's published: favourites, saved orders and links depend on it.
- **`data/locations.json`**: addresses, map links, phone and WhatsApp numbers, and hours.
  - Hours are 7 entries starting Monday: `null` (closed), `[openMinutes, closeMinutes]` (for example `[660, 1260]` is 11:00 to 21:00), or `"open"` when the day is set but the times aren't published yet.
  - Times are Barbados time.
  - A location's `whatsapp` number is where its website orders go.
- **`data/site.json`**: where the site's buttons go.
  - Fill in the Google Form links (`waitlistFormUrl`, `cateringFormUrl`, `careersFormUrl`). Until then those buttons fall back to Instagram.
  - When the app launches, set `orderUrl`, `accountUrl`, `iosUrl` and `androidUrl`. The Order buttons, Sign in link and store badges switch over, and checkout hands the cart to the app.
- **`data/deals.json`**: current offers (`title`, `description`, optional `validFrom`/`validTo` dates, `locationIds`, `appOnly`). Expired deals hide themselves.

## Code

- `style.css` has the palette taken from the logo, plus all the components.
  - Dark mode overrides the colour tokens in two identical blocks near the top: one follows the system setting, the other applies when the header toggle is used.
  - The visitor's choice is saved under `bajanese.theme`. A one-line script in each page's `<head>` applies it before the page draws.
- `script.js` holds the shared helpers (Barbados clock, data loading, formatting) and draws the locations, deals and menu.
- `cart.js` runs the cart, favourites, the choice picker, WhatsApp checkout and recent orders. It saves them in the browser's `localStorage` (keys `bajanese.cart`, `bajanese.faves`, `bajanese.orders`).

## Running locally

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. To test open-now badges and Grill days, add a Barbados time to any URL, for example `menu.html?now=2026-09-28T12:00` (a Monday).
