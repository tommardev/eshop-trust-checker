# Conventions

How new code should look and where it plugs in. Read this before adding a module, route, audit check, or parser.

## Precedence

`repo:` paths below are this project's standard. `golden:` items apply only where the project is silent and do not fight the formatter, compiler, or existing files.

## Naming and Layout

- `repo:` PascalCase for classes (`AuditEngine`, `VvtatChecker`, `JarChecker`, `WebScraper`, `WhoisChecker` in `src/lib/`).
- `repo:` Kebab-case for module files (`src/lib/audit-engine.ts`, `src/lib/vvtat-checker.ts`).
- `repo:` Static helper classes with public static methods for domain check engines (`VvtatChecker.isBlocked()`, `JarChecker.validateCompanyCodeFormat()`).
- `repo:` TypeScript interfaces and types in `src/types/audit.ts` (`TrustAuditResult`, `AuditCheckItem`, `LegalEntityInfo`, `DomainSecurityInfo`).

## Imports

- `repo:` Imports at module top (`src/lib/audit-engine.ts`).
- `repo:` Path alias `@/*` maps to `./src/*` (`tsconfig.json`).
- `golden:` No inline dynamic imports unless handling an explicit circular dependency or heavy server-only optional dependency.

## Errors and Fallbacks

- `repo:` Resilience over failure: checkers catch network errors / timeouts and return fallback objects rather than throwing uncaught exceptions to `AuditEngine` (`src/lib/whois-checker.ts`, `src/lib/scraper.ts`).
- `repo:` Strict timeout bounds using `AbortController` (2500ms for WHOIS/RDAP, 4000ms for WebScraper) to prevent request hanging (`src/lib/whois-checker.ts#L23-L30`).
- `golden:` Do not swallow errors silently without logging or assigning a structured audit status (`status: 'WARN' | 'FAIL' | 'INFO'`). Never log secrets or raw PII.

## Where New Code Goes

- **Audit logic & checkers:** `src/lib/<name>-checker.ts` (e.g. `lb-checker.ts`, `ssl-checker.ts`).
- **Data schemas & types:** `src/types/audit.ts` (or domain-specific types in `src/types/`).
- **Official datasets / caches:** `src/data/` (JSON registries, static lists).
- **API routes:** `src/app/api/<route>/route.ts` (Next.js App Router).
- **UI Components:** `src/components/` (reusable UI elements, audit cards, search bar).
- **Pages / Views:** `src/app/` (page routes, layouts).

## Public Surfaces

- `repo:` `AuditEngine.analyze(inputQuery: string): Promise<TrustAuditResult>` is the single entry point orchestrator for auditing.
- `golden:` Keep the public surface small; do not leak scraper internals or raw HTML into client responses (Hyrum's Law).
