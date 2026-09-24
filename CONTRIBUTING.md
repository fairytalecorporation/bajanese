# Contributing to orographiclouds

First off, thanks for taking the time to contribute! The following is a set of guidelines for contributing to this project.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/orographiclouds.git
   cd orographiclouds
   ```
3. **Open `index.html`** in your browser directly, or serve locally with any static server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

No build step, no dependencies. Edit `index.html`, `style.css`, or `script.js` and refresh.

## Development Workflow

1. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. Make your changes to `index.html`, `style.css`, or `script.js`.
3. Verify your changes work by opening the file or running a local server.
4. Commit with a descriptive message.

## Style Guidelines

- **Aesthetic:** Sunset horizon / atmospheric — warm embers, deep indigos, misty clouds.
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
