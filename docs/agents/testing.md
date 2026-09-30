# Testing Guidelines

How tests are structured and what to verify in `eshop-trust-checker`.

## Precedence

Unit test conventions (`repo:`) win. Golden defaults (`golden:`) guide coverage when no specific testing convention exists.

## Test Layout

- File naming: `*.test.ts` or `*.spec.ts` placed adjacent to source files or in `src/__tests__/`.
- Fixture files: `*.data.ts` or static JSON in `src/data/` (e.g. `src/data/vvtat-blocked-cache.json`).
- Mock files: `*.mock.ts` for network boundary mocks (WHOIS/RDAP, HTTP responses).

## Critical Seams to Test

1. **Domain Normalization (`src/lib/vvtat-checker.ts`)**:
   - Stripping `https://`, `http://`, `www.`, path trailing slashes, query strings, user credentials (`user:pass@domain.com`).
   - Subdomain matching (`sub.bad-domain.com` flagged if `bad-domain.com` is in blocked list).
2. **JAR Company Code Verification (`src/lib/jar-checker.ts`)**:
   - Modulo 11 check algorithm: valid 9-digit Lithuanian codes return `true`, invalid check digits return `false`, wrong length returns `false`.
   - Known entity dictionary lookup (`kalykla.lt`, `pigu.lt`, `senukai.lt`).
3. **Audit Engine Orchestration (`src/lib/audit-engine.ts`)**:
   - Correct aggregation of checklist items.
   - Blacklist hit immediately reduces trust score to 0 and triggers 'DANGEROUS' status.
   - Missing company rekvizitai penalty (-35 score).
4. **Scraper Heuristics (`src/lib/scraper.ts`)**:
   - Extraction of company code, VAT code, phone numbers (+370 international, new national standard starting with 0, and legacy 8 prefix), email, address, and return policy signals.

## Commands

- Run type checking: `npx tsc --noEmit`
- Run linting: `npm run lint`

## Golden Rules

- `golden:` Unit tests at seams only. No heavy end-to-end framework unless explicitly requested in the plan.
- `golden:` Do not delete failing tests to go green. Fix the root cause in the implementation.
- `golden:` Test observable behavior and return contracts, not private class internals.
