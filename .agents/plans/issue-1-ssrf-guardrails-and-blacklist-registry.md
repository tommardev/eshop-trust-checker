# Feature: Implement SSRF Guardrails, URL/Domain Sanitizer, and VVTAT/LB Blacklist Registry

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Provide hardened domain normalization, strictly preventing Server-Side Request Forgery (SSRF) by blocking loopback, RFC 1918 private IPs, link-local/cloud metadata addresses, and local subnets, while matching normalized domains against cached VVTAT court-ordered blocked websites and Lietuvos Bankas (LB) unregistered financial/shop entity registries. Also enforce SSRF validation at the API boundary (`/api/check`) before launching downstream scraping or network checks.

## User Story

As a Lithuanian online shopper or compliance auditor
I want submitted e-shop URLs and domains to be safely normalized, validated against SSRF attacks, and checked against official VVTAT and Lietuvos Bankas blacklists
So that malicious internal network probes are rejected immediately and known court-blocked or fraudulent financial domains are flagged with zero trust score.

## Problem Statement

1. User-supplied URLs arrive in arbitrary formats (`https://user:pass@www.sub.domain.lt:8443/path?query#hash`, IPv6 brackets, trailing dots, or raw IP addresses) and must be deterministically normalized before registry lookup or network inspection.
2. Without strict pre-flight SSRF validation at both the API route boundary (`src/app/api/check/route.ts`) and HTTP fetch helper (`src/lib/security.ts`), attackers could submit `http://127.0.0.1`, `http://169.254.169.254`, or private RFC 1918 addresses to probe internal infrastructure.
3. Lietuvos Bankas (`src/lib/lb-checker.ts`) currently stores only a small hardcoded `Set` in code rather than a structured cached JSON dataset (`src/data/lb-flagged-cache.json`) with metadata/court/warning context similar to `src/data/vvtat-blocked-cache.json`.

## Solution Statement

1. Enhance `Security` (`src/lib/security.ts`) with a synchronous fast-path `isSafeUrlOrDomainInput(input: string)` validator alongside `validateHostname` and `isPrivateOrBlockedIp` so `/api/check` (GET and POST) immediately returns HTTP 400 when given loopback (`localhost`, `127.0.0.0/8`, `::1`), private RFC 1918 IPs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), or non-HTTP(S) schemes (`file://`, `ftp://`, `javascript:`).
2. Refine `VvtatChecker.normalizeDomain` (`src/lib/vvtat-checker.ts`) to handle IPv6 bracketed literals cleanly, strip trailing dots, and preserve court-order metadata from `src/data/vvtat-blocked-cache.json`.
3. Extract Lietuvos Bankas flagged entities into a structured JSON cache `src/data/lb-flagged-cache.json` and update `LbChecker` (`src/lib/lb-checker.ts`) to load from the JSON cache while maintaining the public `LbChecker.isFlagged(domain)` and `LbChecker.getAllFlagged()` static methods.
4. Expand unit tests in `src/lib/__tests__/checkers.test.ts` to cover all SSRF IPv4/IPv6/hostname edge cases, protocol/credential/port stripping, and VVTAT + LB exact and subdomain matching.

## Out of Scope / Non-Goals

- Not included: Modifying WHOIS/RDAP (`src/lib/whois-checker.ts`) or TLS socket inspection (`src/lib/ssl-checker.ts`) — covered by Issue #3.
- Not included: Modifying Cheerio HTML scraping heuristics (`src/lib/scraper.ts`) — covered by Issue #4.
- Not included: Modifying `AuditEngine` scoring weights (`src/lib/audit-engine.ts`) — covered by Issue #5.
- Not changing: Existing `TrustAuditResult` and `BlacklistStatus` public TypeScript interfaces in `src/types/audit.ts`.

## Feature Metadata

**Feature Type**: Enhancement / Security Hardening
**Estimated Complexity**: Low-Medium
**Primary Systems Affected**: `src/lib/security.ts`, `src/lib/vvtat-checker.ts`, `src/lib/lb-checker.ts`, `src/data/lb-flagged-cache.json`, `src/app/api/check/route.ts`, `src/lib/__tests__/checkers.test.ts`
**Dependencies**: Node.js built-in `node:net`, `node:dns/promises`, `node:test`, `node:assert/strict` (zero new external npm packages)

## Related Work

**Implements**: [Issue #1](https://github.com/tommardev/eshop-trust-checker/issues/1) · **Epic**: `docs/PRD.md` (Phase 4.1 & 4.2.1) & `docs/ARCHITECTURE.md` (Section 2 & 3)

**Back-references**:
- `docs/agents/security.md` - Why: Defines non-negotiable SSRF and timeout safety floors
- `docs/VVTAT_CRITERIA_AND_DATA_SOURCES.md` - Why: Defines official VVTAT and Lietuvos Bankas data sources

**Forward-references**:
- Issue #6 (`POST /api/check` rate limiting and error responses)
- Issue #9 (Comprehensive unit test suite and security regression tests)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `src/lib/security.ts` (lines 1-198) - Why: Contains `Security.isPrivateOrBlockedIp`, `Security.validateHostname`, and `Security.safeFetchText` with `AbortController` and 2MB stream limit.
- `src/lib/vvtat-checker.ts` (lines 1-86) - Why: Contains `VvtatChecker.normalizeDomain`, `VvtatChecker.isBlocked`, and `VvtatChecker.refreshFromOfficialSource`.
- `src/lib/lb-checker.ts` (lines 1-37) - Why: Contains `LbChecker.isFlagged` that needs to be backed by a cached JSON registry and expose `getAllFlagged()`.
- `src/data/vvtat-blocked-cache.json` (lines 1-35) - Why: Reference JSON schema for cached domain blacklists.
- `src/app/api/check/route.ts` (lines 1-67) - Why: Entry point for `GET` and `POST /api/check` where SSRF-prohibited inputs must be rejected with HTTP 400.
- `src/lib/__tests__/checkers.test.ts` (lines 1-288) - Why: Existing `node --test` unit test suite where new SSRF and blacklist tests belong.

### New Files to Create

- `src/data/lb-flagged-cache.json` - Cached JSON registry of Lietuvos Bankas flagged domains with `lastUpdated`, `source`, and `domains` list matching `vvtat-blocked-cache.json`.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- `docs/agents/security.md` - SSRF & Network Boundary Protection rules (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `::1`, `localhost`).
- `docs/agents/conventions.md` - Static checker class methods and `.ts` import extensions required by `node --test`.
- `docs/agents/testing.md` - Unit testing conventions at seams using `node --test`.

### Patterns to Follow

**Static Class Pattern:**
All checkers in `src/lib/` are stateless classes with `public static` methods (e.g. `VvtatChecker.normalizeDomain`, `Security.isPrivateOrBlockedIp`, `LbChecker.isFlagged`).

**JSON Import Pattern (Node.js native test runner compatible):**
```typescript
import blockedCache from '../data/vvtat-blocked-cache.json' with { type: 'json' };
```
Always include `with { type: 'json' }` for JSON imports and `.ts` extensions on relative imports inside `src/lib/` so `npm test` (`node --test src/lib/__tests__/checkers.test.ts`) executes without a custom loader.

**SSRF Validation Pattern:**
Reject prohibited schemes (`ftp:`, `file:`, `javascript:`, `data:`), local hostnames (`localhost`, `*.localhost`, `*.local`, `*.internal`), IPv4 private/reserved blocks, and IPv6 loopback/unique-local/link-local (`::1`, `::`, `fe80::/10`, `fc00::/7`, `::ffff:<ipv4>`) before any network call.

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation & Cached Registry Data

**Tasks:**
- Create `src/data/lb-flagged-cache.json` modeled after `src/data/vvtat-blocked-cache.json`.
- Update `src/lib/lb-checker.ts` to load domains from `src/data/lb-flagged-cache.json` with `with { type: 'json' }` and expose `getAllFlagged(): string[]`.

### Phase 2: Hardened Domain Normalization & SSRF Input Guard

**Depends on:** Phase 1

**Tasks:**
- Enhance `VvtatChecker.normalizeDomain` in `src/lib/vvtat-checker.ts` to reject non-HTTP(S) schemes (returning `''` when a scheme like `javascript:`, `file://`, or `ftp://` is explicitly passed), strip IPv6 brackets or port suffixes safely, and trim trailing dots (`example.lt.` -> `example.lt`).
- Add `Security.validateInputTarget(rawInput: string)` in `src/lib/security.ts` that checks both URL scheme validity and synchronous hostname/IP SSRF rules (`localhost`, `.local`, `.internal`, IPv4/IPv6 literals via `isPrivateOrBlockedIp`).

### Phase 3: API Route Boundary Integration

**Depends on:** Phase 2

**Tasks:**
- Update `src/app/api/check/route.ts` (`GET` and `POST`) to call `Security.validateInputTarget(query)` and `Security.validateHostname(normalized)` so SSRF-prohibited inputs (`localhost`, `127.0.0.1`, `10.0.0.1`, `192.168.1.1`, `169.254.169.254`, `[::1]`) immediately return HTTP 400 with a clear Lithuanian error message before `AuditEngine.analyze()` runs.

### Phase 4: Testing & Validation

**Depends on:** Phases 1–3

**Tasks:**
- Expand `src/lib/__tests__/checkers.test.ts` to test:
  - Malformed schemes (`ftp://`, `file://`, `javascript:`), trailing dots, and IPv6 loopback/private addresses.
  - `Security.validateInputTarget` and `Security.isPrivateOrBlockedIp` across RFC 1918 ranges, CGNAT (`100.64.0.0/10`), link-local (`169.254.169.254`), IPv4-mapped IPv6 (`::ffff:127.0.0.1`, `::ffff:10.0.0.1`), and local hostnames.
  - `VvtatChecker.isBlocked` and `LbChecker.isFlagged` exact and subdomain matching.
- Run `npm test`, `npx tsc --noEmit`, and `npm run lint`.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### CREATE `src/data/lb-flagged-cache.json`

- **IMPLEMENT**: Create JSON file containing `lastUpdated`, `source` (`"https://www.lb.lt/lt/finansu-rinkos-dalyviai-neturintys-teises-teikti-finansiniu-paslaugu"`), and `domains` array including `crypto-invest.com`, `quick-loan-fast.eu`, `bank-secure-login.net`, `fx-profit-lt.com`, `bit-wealth-eu.net`.
- **PATTERN**: Mirror `src/data/vvtat-blocked-cache.json` (lines 1-35).
- **VALIDATE**: `node -e "JSON.parse(require('fs').readFileSync('src/data/lb-flagged-cache.json', 'utf8'))"`
- **SATISFIES**: AC #4 (Lietuvos Bankas unregistered financial/shop entity checker is integrated).

### UPDATE `src/lib/lb-checker.ts`

- **IMPLEMENT**: Import `lbCache from '../data/lb-flagged-cache.json' with { type: 'json' }`, initialize `private static lbFlaggedDomains: Set<string>` from `lbCache.domains`, keep `isFlagged(domain: string)` matching exact and `*.flagged` subdomains, and add `public static getAllFlagged(): string[]`.
- **PATTERN**: Mirror `src/lib/vvtat-checker.ts` (lines 1-60).
- **IMPORTS**: `import lbCache from '../data/lb-flagged-cache.json' with { type: 'json' };` and `import { VvtatChecker } from './vvtat-checker.ts';`.
- **GOTCHA**: Must use `with { type: 'json' }` and `.ts` extension on relative imports so Node's native test runner works without build steps.
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #4

### UPDATE `src/lib/vvtat-checker.ts`

- **IMPLEMENT**: In `VvtatChecker.normalizeDomain(input: string)`:
  1. If `input` contains a scheme (`^[a-zA-Z][a-zA-Z0-9+.-]*:`) that is NOT `http://` or `https://`, return `''`.
  2. Strip `http://` or `https://`, strip `user:pass@` credentials, strip `/`, `?`, `#`.
  3. Handle bracketed IPv6 (`[::1]:8080` -> `::1`) vs standard `host:port` (`example.lt:8080` -> `example.lt`).
  4. Strip leading `www.` and trailing dots (`.`).
- **PATTERN**: Existing `src/lib/vvtat-checker.ts` (lines 12-26).
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #1 & AC #3

### UPDATE `src/lib/security.ts`

- **IMPLEMENT**: Add `public static isSafeInputTarget(rawInput: string): { safe: boolean; reason?: string }` to synchronously validate raw user input before DNS resolution:
  - Reject empty inputs or inputs with disallowed URI schemes (`!/^(https?:\/\/)/i.test(trimmed)` when `trimmed.includes('://')` or `/^(javascript|data|file|ftp):/i.test(trimmed)`).
  - Normalize the hostname using `VvtatChecker.normalizeDomain(rawInput)` (or internal host extraction) and reject `localhost`, `*.localhost`, `*.local`, `*.internal`, and any IP literal where `this.isPrivateOrBlockedIp(host)` is `true`.
- **PATTERN**: Mirror `Security.validateHostname` in `src/lib/security.ts` (lines 69-90).
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #2 (Strict SSRF protection rejects private IP ranges and localhost).

### UPDATE `src/app/api/check/route.ts`

- **IMPLEMENT**: Import `Security` from `@/lib/security`. In both `GET` and `POST` handlers, after checking `query` is non-empty, call `Security.isSafeInputTarget(query)`. If `!targetCheck.safe`, return `NextResponse.json({ error: targetCheck.reason || 'Neteisingas arba blokuojamas domeno adresas (SSRF apsauga).' }, { status: 400 })`.
- **PATTERN**: Existing validation blocks in `src/app/api/check/route.ts` (lines 12-25 and 43-56).
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #1 & AC #2

### UPDATE `src/lib/__tests__/checkers.test.ts`

- **IMPLEMENT**: Add unit test cases covering:
  - Disallowed protocols (`ftp://`, `file://`, `javascript:alert(1)`) returning `''` in `normalizeDomain` and `safe: false` in `Security.isSafeInputTarget`.
  - IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`, `::ffff:10.0.0.1`, `::ffff:192.168.1.1`) and IPv6 link-local/unique-local (`fe80::1`, `fc00::1`, `fd00::1`) in `Security.isPrivateOrBlockedIp`.
  - `Security.isSafeInputTarget` rejecting `localhost`, `http://127.0.0.1:8080/admin`, `https://10.0.0.1`, `http://172.16.0.5`, `http://192.168.1.1`, `http://169.254.169.254/latest/meta-data/`, and `sub.localhost`.
  - `LbChecker.isFlagged`subdomain matching (`sub.crypto-invest.com`) and `LbChecker.getAllFlagged()`.
- **PATTERN**: Mirror `describe` / `it` blocks in `src/lib/__tests__/checkers.test.ts` (lines 207-260).
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #1, AC #2, AC #3, AC #4

---

## TESTING STRATEGY

### Unit Tests

Executed via Node's built-in test runner (`npm test` -> `node --test src/lib/__tests__/checkers.test.ts`). Tests run deterministically offline against cached JSON registries and pure functions in `VvtatChecker`, `LbChecker`, `JarChecker`, and `Security`.

### Integration Tests

`AuditEngine.analyze` tests in `src/lib/__tests__/checkers.test.ts` verify that VVTAT and LB blacklist hits immediately produce `trustScore: 0` and `trustLevel: 'DANGEROUS'`.

### Edge Cases

- Credentials in URL (`https://admin:pass@www.pigu.lt:8443/path?a=1#top`)
- IPv4-mapped IPv6 loopback (`::ffff:127.0.0.1`) and private ranges (`::ffff:10.0.0.1`)
- Non-HTTP schemes (`ftp://example.lt`, `file:///etc/passwd`, `javascript:void(0)`)
- Subdomains of blocked domains (`shop.svajoniuspinta.lt`, `login.crypto-invest.com`)
- Trailing dot in FQDN (`pigu.lt.`)

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npx tsc --noEmit
npm run lint
```

### Level 2: Unit Tests

```bash
npm test
```

### Level 3: Production Build Check

```bash
npm run build
```

---

## ACCEPTANCE CRITERIA

- [ ] Domain input normalizer strips protocols (`http://`, `https://`), trailing paths, auth, and ports, and rejects non-HTTP(S) schemes.
- [ ] Strict SSRF protection rejects private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`, `::1`, `localhost`, `169.254.169.254`) in both `Security` and `/api/check`.
- [ ] VVTAT blacklist matcher reads from cached JSON repository (`src/data/vvtat-blocked-cache.json`) and flags exact and subdomain matches with court order context.
- [ ] Lietuvos Bankas unregistered financial/shop entity checker reads from cached JSON repository (`src/data/lb-flagged-cache.json`) and flags exact and subdomain matches.
- [ ] All unit tests (`npm test`), type checks (`npx tsc --noEmit`), and linter checks (`npm run lint`) pass with zero errors.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully
- [ ] Full test suite passes (`npm test`)
- [ ] No linting or type checking errors (`npm run lint && npx tsc --noEmit`)
- [ ] Acceptance criteria all met

---

## OPEN QUESTIONS / ASSUMPTIONS

- **Assumed**: Lietuvos Bankas flagged domains should be stored in `src/data/lb-flagged-cache.json` mirroring `src/data/vvtat-blocked-cache.json` so both blacklist registries share a consistent static cache layout before live sync endpoints are added.
- **Assumed**: Non-HTTP(S) schemes (such as `ftp://`, `file://`, `javascript:`) passed to `VvtatChecker.normalizeDomain` or `/api/check` should be rejected immediately as invalid domain inputs.

## NOTES

- Much of the foundational code in `src/lib/security.ts`, `src/lib/vvtat-checker.ts`, and `src/lib/lb-checker.ts` is already scaffolded in the repository. The remaining work for Issue #1 is closing the API boundary SSRF check in `src/app/api/check/route.ts`, externalizing `LbChecker`'s dataset to `src/data/lb-flagged-cache.json`, hardening scheme/IPv6 edge cases in `normalizeDomain`, and adding regression tests for those edge cases.

## AMENDMENTS
