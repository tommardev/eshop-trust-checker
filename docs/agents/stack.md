# Stack and Toolchain

Languages, frameworks, runtimes, and dependencies for `eshop-trust-checker`.

## Languages & Runtimes

- **TypeScript:** 5.6.3 (`tsconfig.json`)
  - Target: ES5, DOM, DOM.Iterable, ESNext
  - Module resolution: `bundler`
  - Strict type checking enabled (`strict: true`, `noEmit: true`)
  - Path alias: `@/*` → `./src/*`
- **Node.js:** Node.js 22.18+ / 24 LTS runtime (unflagged native TypeScript execution for `node --test`; `@types/node`: ^20.17.0 — keep aligned if `@types/node` is upgraded later)

## Framework & UI (Planned / Configured)

- **Framework:** Next.js 15.5.29 (App Router architecture)
- **UI Runtime:** React 18.3.1, React DOM 18.3.1
- **Styling:** Tailwind CSS 3.4.14, PostCSS 8.5.29, Autoprefixer 10.4.20
- **Utility Libraries:** `clsx` 2.1.1, `tailwind-merge` 2.5.4
- **Icons:** `lucide-react` 0.453.0

## Domain & Analysis Engines

- **HTML Parsing & Extraction:** `cheerio` 1.0.0
- **Network & Fetch:** Native `fetch` with `AbortController` (timeouts: 2.5s–4s)
- **Data & Caches:** Local static JSON cache in `src/data/vvtat-blocked-cache.json`

## Commands

- Install dependencies: `npm install`
- Development server: `npm run dev`
- Run unit tests: `npm test`
- Typecheck: `npx tsc --noEmit --incremental false` (clean non-incremental check for CI/validation; `npx tsc --noEmit` also works locally)
- Lint code: `npm run lint`
- Build application: `npm run build`
- Start production server: `npm run start`
- Restore agent skills: `npx skills experimental_install --yes`

> Note: `.agents/skills/piv-validate/SKILL.md` is gitignored via `.gitignore` (restored locally with `npx skills experimental_install --yes`), so `docs/agents/stack.md` and `docs/agents/testing.md` remain the committed source of truth.
