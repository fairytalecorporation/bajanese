# Contributing to Bajanese

First off, thanks for taking the time to contribute! The following is a set of guidelines for contributing to this project.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/Bajanese.git
   cd Bajanese
   ```
3. **Serve the site locally** with any static server (opening the files directly won't load the menu, because browsers block `fetch` on `file://`):
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

No build step, no dependencies. Edit the pages, `style.css`, `script.js`, `cart.js` or the files in `data/`, then refresh. See the [README](README.md) for how the site fits together.

## Development Workflow

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. Make your changes.
3. Verify your changes with a local server, at phone width and desktop width.
4. Commit with a descriptive message.

## Style Guidelines

- **Aesthetic:** Matches the logo: indigo (`--brand-indigo`) for structure, red (`--brand-red-strong` for text and buttons) for ordering, yellow only on indigo backgrounds, white page, sticker-style cards. Baloo 2 for headings, Inter for body text.
- **Shared header and footer:** every page carries identical copies. If you change one, change them all.
- **No frameworks.** All vanilla HTML, CSS, and JavaScript.
- **CSS:** Custom properties in `:root` for the palette; prefer these over hardcoded values.
- **JavaScript:** ES5-compatible syntax (IIFE, `var`, function expressions) to avoid any transpilation needs.
- **Accessibility:** Include `aria-label`, `:focus-visible`, and respect `prefers-reduced-motion`.
- **Responsive:** Mobile-first; test at 375px, 600px, and desktop widths.

## Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/amazing-feature
   ```
2. Open a Pull Request on the original repository.
3. Provide a clear description of the changes and why they are necessary.
4. Wait for review!

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms. Be kind and respectful to others.
