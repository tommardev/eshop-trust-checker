# AGENTS.md

> README is for humans. This file is for coding agents.

## Project

`eshop-trust-checker` is an automated Lithuanian e-commerce trust and compliance audit engine. It evaluates online shops against VVTAT 5 golden consumer rules, official court-ordered blocked domain lists, state enterprise registry (JAR) company code validation via Modulo 11, domain age (WHOIS/RDAP), and HTML scraping for legal disclosures and return policies.

**Stack:** Next.js 15.5.29 (App Router), React 18.3.1, TypeScript 5.6.3, Tailwind CSS 3.4.14, Cheerio 1.0.0.
**Hosting:** Vercel GitHub App already connected (`https://eshop-trust-checker.vercel.app`, automatic PR previews enabled; Roadmap Task `3.3` complete).

## Precedence

1. User chat
2. This repo's code, configs, and helpers (`repo:`) — including when stricter or more specific than common defaults
3. Golden defaults in helpers (`golden:`) — only where this repo is silent and the rule applies to this stack
4. Safety / a11y floors in **Boundaries** — never overridden by local habit

Do not invent a second style guide. Do not average conflicting rules.

## Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Start production: `npm run start`
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Restore agent skills: `npx skills experimental_install --yes`

## Tools

- Docs/APIs: **Context7 MCP** — prefer over client web search and training memory for library and framework documentation.
- Live web search & page fetch: **Exa MCP** (`web_search_exa`, `web_fetch_exa`).
- Browser debug and verification: **Chrome Devtools for Agents**.
- Dependencies: **Sonatype MCP** — check developer trust score and vulnerabilities before adding or upgrading dependencies.
- GitHub: **`gh` CLI only** (no GitHub MCP).

## Layout

```
README.md                               Human project README (GitHub-visible)
AI_CODING_README.md                     Human cheat sheet (workflow, skill cmds)
AI_CODING_LEARN.md                      Mandatory intros and tutorials
docs/
  ARCHITECTURE.md                       System architecture & data model spec
  PRD.md                                Product requirements & user journeys
  AUTOMATION_WORKFLOW.md                Autonomous planning & implementation specs
  VVTAT_CRITERIA_AND_DATA_SOURCES.md    Official sources, rules, & criteria
  agents/                               On-demand helper deep-dives
src/
  data/                                 Static datasets & cached registries
  lib/                                  Audit engine & individual source checkers
  types/                                TypeScript interfaces & audit schemas
  app/                                  Next.js App Router (pages & API routes)
  components/                           React UI components & audit views
```

**Seams** (where new work plugs in):
- **New audit check/source:** Add checker in `src/lib/<name>-checker.ts` and integrate into `AuditEngine.analyze()` in `src/lib/audit-engine.ts`.
- **Audit data contracts:** Extend types in `src/types/audit.ts`.
- **API endpoints:** Add Next.js App Router handlers in `src/app/api/<route>/route.ts`.
- **UI Components:** Add reusable React components in `src/components/`.
- **Tests:** Add unit tests as `*.test.ts` adjacent to code or in `src/__tests__/`.

## Conventions

- Classes with public static methods for checkers (`AuditEngine`, `VvtatChecker`, `JarChecker`, `WebScraper`, `WhoisChecker`).
- Domain normalization strips protocol, auth, paths, and query params (`VvtatChecker.normalizeDomain`).
- Lithuanian 9-digit company code verification enforces Modulo 11 check digits (`JarChecker.validateCompanyCodeFormat`).
- HTTP requests must specify an `AbortController` timeout (2.5s–4s) to avoid hanging serverless functions.
- **GitHub Actions Job Summaries:** Whenever creating or modifying a workflow in `.github/workflows/`, include a concise `if: always()` step writing to `$GITHUB_STEP_SUMMARY` ([Adding a job summary](https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary)) so every run clearly reports trigger/mode, outcome, and what was done or skipped (pass `${{ ... }}` via `env:`, never inline in `run:`).
- Detailed conventions and code layout: Read `docs/agents/conventions.md`.

## Boundaries

- **Always:** Validate and sanitize target domains before scraping; enforce SSRF protections against internal/private IP ranges; use strict HTTP timeouts; check TypeScript types (`npx tsc --noEmit`).
- **Ask first:** Adding new external npm dependencies; database migrations; altering scoring thresholds in `AuditEngine`; modifying public API schemas.
- **Never:** Commit secrets or `.env.local`; execute unscoped network calls to loopback/private IPs; use `dangerouslySetInnerHTML` with scraped web content; skip hooks; delete failing tests to go green; manually bump `"version"` in `package.json`, `package-lock.json`, or `.release-please-manifest.json`, or hand-edit `CHANGELOG.md` in feature/fix PRs.

## Testing

- Unit tests at seams only (`*.test.ts` or `*.spec.ts`).
- Verify domain normalization, company code Modulo 11 checksums, and audit scoring calculation.
- Detailed testing instructions: Read `docs/agents/testing.md`.

## Git / PRs

- Commit message style: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- Follow `.agents/commands/commit.md` for commits (include a `Context:` section whenever `AGENTS.md`, `docs/`, or `.agents/` assets change).
- Keep changes surgical and atomic.
- Non-trivial features, refactors, bugs, and follow-up work go to GitHub Issues first (`gh issue create`); link PRs with `Closes #<N>`. Read `docs/agents/planning.md`.
- **Pre-1.0 Versioning (`0.MINOR.PATCH`):** Managed by `release-please` (`release-please-config.json`, `.release-please-manifest.json`). `feat:`/`fix:` = patch bump; `chore:`/`docs:`/`ci:`/`test:`/`refactor:`/`perf:`/`style:` = no bump; forbid `!` and `BREAKING CHANGE:` unless explicitly instructed by a human; never manually edit version/changelog files.

## Pointers

This file is the index. Helpers are not always-on. Before you edit an area, **Read** the matching helper:

| When you are editing                                    | Read first                      |
| ------------------------------------------------------- | ------------------------------- |
| Planning, backlog, or GitHub Issues                     | `docs/agents/planning.md`       |
| Stack, dependencies, or versions                        | `docs/agents/stack.md`          |
| Module layout, imports, naming, CI workflows, or seams  | `docs/agents/conventions.md`    |
| Audit orchestration, scraping, or code patterns         | `docs/agents/best-practices.md` |
| UI components, styling, or accessibility                | `docs/agents/ui-ux.md`          |
| Tests or test fixtures                                  | `docs/agents/testing.md`        |
| Network calls, scraping boundaries, or secrets          | `docs/agents/security.md`       |

## Gotchas

- **RDAP / WHOIS Rate Limits:** RDAP endpoints (like DOMREG) may throttle or timeout. Always fall back gracefully without failing the entire audit.
- **SSRF Risk:** Never allow users to submit `localhost`, `127.0.0.1`, or private network addresses for scraping.
- **No Token File Yet:** The repo uses Tailwind utility classes directly; no centralized design token JSON exists yet.
