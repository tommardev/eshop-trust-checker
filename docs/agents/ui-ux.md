# UI / UX Guidelines

Guidance for building user-facing interfaces in `eshop-trust-checker`.

## Precedence

Fintech / Gov trust aesthetic (`repo:`) defined in `docs/ARCHITECTURE.md` and `docs/PRD.md`. **WCAG 2.2 AA** is the non-negotiable accessibility floor (`golden:`).

## Design System & Styling

- `repo:` Tailwind CSS with utility-first layout (`tailwind.config.js`).
- `repo:` Lucide React icons (`lucide-react`) for status and category indicators.
- `repo:` Aesthetic: Trustworthy, clean, governmental/fintech styling (clean white/slate backgrounds, clear status cards).
- `repo:` Traffic Light Score System:
  - 🟢 **Safe (90–100):** Emerald / Green indicators.
  - 🟡 **Caution (50–89):** Amber / Yellow indicators.
  - 🔴 **Dangerous (0–49):** Rose / Red indicators.

## Component States

Every audit query and form submission must explicitly support:
- **Empty state:** Search input waiting for URL or domain entry with quick example chips (`kalykla.lt`, `pigu.lt`).
- **Loading state:** Accessible progress / scanning animation showing active pipeline steps (VVTAT check, WHOIS inspection, Scraper).
- **Error state:** User-friendly Lithuanian error messages for invalid input, offline targets, or server errors with retry options.
- **Result view:** Clear scorecard summary followed by detailed category breakdown (Legal, Technical, Consumer Rights, Blacklist).

## Accessibility (Floor)

- `golden:` WCAG 2.2 AA compliance.
- `golden:` Semantic HTML elements (`<main>`, `<header>`, `<section>`, `<article>`, `<button>`).
- `golden:` Meaning never conveyed by color alone: status indicators must pair colors with icons and explicit text badges (e.g. `Saugus`, `Atsargiai`, `Pavojingas`).
- `golden:` High contrast: minimum 4.5:1 for standard text, 3:1 for large text and UI borders.
- `golden:` Full keyboard navigability and visible focus rings (never `outline: none` without a clear ring alternative).
- `golden:` Honor `prefers-reduced-motion` for scanning animations.
