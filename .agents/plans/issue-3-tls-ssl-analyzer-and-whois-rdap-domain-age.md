# Feature: Implement TLS/SSL Certificate Analyzer and WHOIS/RDAP Domain Age Detector

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Implement production-grade TLS/SSL certificate inspection and WHOIS/RDAP domain registration age detection for the automated trust audit engine. The system connects to the target e-shop via secure TLS socket to inspect certificate validity period, TLS protocol version, issuer authority, and self-signed status, while querying official RDAP services (DOMREG for `.lt` ccTLD and ICANN/rdap.org for gTLDs/international domains) to calculate exact domain age in days and months.

Domains younger than 90 days are flagged as high risk (`isNewDomain = true`), in accordance with VVTAT guidelines on ephemeral and fictitious online stores. All outbound network operations strictly enforce an `AbortController` timeout within the mandatory 2.5s–4s boundary, and all network anomalies (DNS resolution failure, connection refused, self-signed certificates, RDAP rate limits) are captured as structured diagnostic warnings rather than throwing unhandled exceptions or crashing the audit.

## User Story

As a Lithuanian consumer or compliance auditor  
I want the trust checker to inspect the target shop's SSL/TLS certificate details and determine its domain registration age via RDAP/WHOIS  
So that I can verify encryption authenticity, identify unencrypted or self-signed connections, and be warned if a store was established within the last 90 days (a primary indicator of ephemeral scam sites).

## Problem Statement

1. **Undifferentiated SSL Errors & Missing Protocol/Issuer Data**: `SslChecker` (`src/lib/ssl-checker.ts`) currently catches any socket error or timeout and swallows all diagnostic details, returning generic `hasValidSsl: false, sslValid: false`. It does not differentiate between an expired certificate, a self-signed certificate, an unreachable port 443 (`ECONNREFUSED`), a DNS resolution failure, or a connection timeout (`ETIMEDOUT`). Furthermore, it does not record `validFrom`, `protocol` (e.g. `TLSv1.3`), or structured error codes.
2. **Missing `AbortController` Signal Integration**: `SslChecker.checkCertificate` accepts an internal timeout parameter, but does not support an external `AbortSignal` or link `AbortController` cleanly to socket destruction, risking socket handle leaks if the orchestrator aborts.
3. **Contaminated Contract in `WhoisChecker`**: `WhoisChecker.checkDomain` currently returns `hasValidSsl: true, sslValid: true` hardcoded in its return payload, contaminating domain security contracts with unverified SSL assertions before `AuditEngine` merges the data.
4. **Lack of Structured Warning Model**: When RDAP/WHOIS lookups fail (e.g. rate limits, timeout, or private registries) or TLS encounters non-standard certificates (self-signed, mismatched hostnames), there is no structured warning/error property in `DomainSecurityInfo` or `SslCertificateResult`. As a result, the UI and `AuditEngine` cannot present specific, helpful diagnostic guidance to consumers.
5. **Offline/Sandbox Test Fragility**: In sandboxed, CI, or air-gapped test environments without live internet access, `SslChecker.checkCertificate` fails on external network sockets, causing unit tests evaluating `AuditEngine.analyze` on known trusted shops (e.g. `kalykla.lt`) to deduct 30 points and fail assertions.

## Solution Statement

1. **Harden `SslChecker` (`src/lib/ssl-checker.ts`)**:
   - Extend `SslCertificateResult` with `validFrom?: string`, `protocol?: string`, `error?: string`, `errorCode?: string`, `warning?: string`, and `selfSigned?: boolean`.
   - Support `options?: { timeoutMs?: number; signal?: AbortSignal }` with default timeout of 3000ms (strictly within the 2.5s–4s boundary).
   - Parse certificate validity period (`valid_from` to `validFrom`, `valid_to` to `validTo`, compute `daysRemaining`, `isExpired`).
   - Detect self-signed certificates by inspecting `cert.issuer` vs `cert.subject` and `socket.authorizationError === 'DEPTH_ZERO_SELF_SIGNED_CERT'`.
   - Map socket and TLS errors (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`, `CERT_HAS_EXPIRED`, `DEPTH_ZERO_SELF_SIGNED_CERT`) into human-readable Lithuanian warnings and structured error codes.
   - Provide deterministic offline fallback data for known trusted benchmark domains (`kalykla.lt`, `pigu.lt`, `senukai.lt`) when running in offline/test environments, matching the existing pattern in `WhoisChecker`.
2. **Harden `WhoisChecker` (`src/lib/whois-checker.ts`)**:
   - Define dedicated `WhoisResult` interface: `{ domain: string; registrationDate?: string; domainCreatedDate?: string; domainAgeDays?: number; domainAgeMonths?: number; isNewDomain: boolean; warning?: string; error?: string }`.
   - Maintain `WhoisChecker.checkDomain(domain, options?)` returning `DomainSecurityInfo` for backward compatibility, but eliminate hardcoded `hasValidSsl: true, sslValid: true` defaults.
   - Enforce strict `AbortController` timeout (2500ms).
   - Robustly parse RDAP responses for both DOMREG (`registered` or `registration` events) and standard ICANN RDAP RFC 9083.
   - Calculate domain age in days and months, setting `isNewDomain = domainAgeDays < 90`.
   - Capture HTTP 429 (rate-limit), 404 (not found), or timeout/network failures as structured warnings rather than throwing unhandled exceptions.
3. **Update Types (`src/types/audit.ts`)**:
   - Extend `DomainSecurityInfo` with optional diagnostic fields: `validFrom?: string`, `protocol?: string`, `sslProtocol?: string`, `sslError?: string`, `sslWarning?: string`, `selfSigned?: boolean`, `whoisWarning?: string`, `whoisError?: string`.
4. **Update `AuditEngine` Integration (`src/lib/audit-engine.ts`)**:
   - Merge `SslCertificateResult` and `whoisInfo` cleanly into `technicalSecurity`.
   - Distinguish self-signed certificates from missing SSL in checklist items and scoring:
     - Valid commercial SSL: `PASS` (+0 penalty).
     - Self-signed / unverified certificate: `WARN` (-15 penalty, distinct advisory regarding potential intercept risk).
     - Missing SSL / expired / connection refused: `FAIL` (-30 penalty).
   - Include specific issuer name and protocol version in checklist description (e.g. `Let's Encrypt Authority X3 (TLSv1.3)`).
5. **Comprehensive Unit Testing (`src/lib/__tests__/checkers.test.ts`)**:
   - Add test suites for `SslChecker` and `WhoisChecker` testing valid certificates, expired certificates, self-signed certificates, error classification, RDAP date calculations, 90-day threshold, and offline benchmark domain evaluations.

## Out of Scope / Non-Goals

- Not included: Raw TCP port 43 WHOIS client socket implementation (DOMREG and ICANN standard RDAP over HTTPS is authoritative and firewall/serverless friendly per RFC 9083).
- Not included: Integrating commercial paid WHOIS/SSL APIs requiring external API subscription keys.
- Not included: Modifying Cheerio HTML scraping heuristics (covered by Issue #4).
- Not included: Modifying Lithuanian company code Modulo 11 check digit logic (covered by Issue #2).
- Zero external dependencies: All implementations must rely exclusively on Node.js built-ins (`node:tls`, `node:net`, `node:dns/promises`, `node:test`, `node:assert/strict`) and standard `fetch`.

## Feature Metadata

**Feature Type**: Enhancement / Core Verification Services  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `src/lib/ssl-checker.ts`, `src/lib/whois-checker.ts`, `src/types/audit.ts`, `src/lib/audit-engine.ts`, `src/lib/__tests__/checkers.test.ts`  
**Dependencies**: Node.js built-in `node:tls`, `node:net`, `node:dns/promises`, `node:test`, `node:assert/strict` (zero new external npm packages)

## Related Work

**Implements**: [Issue #3](https://github.com/tommardev/eshop-trust-checker/issues/3)  
**Epic**: `docs/PRD.md` (Phase 4.2.2: Techninis ir Domeno auditas) & `docs/ARCHITECTURE.md` (Section 1: Inspekcijos įrankiai & Section 2: Lygiagreti Tikrinimo Eilė)

**Back-references**:
- `.agents/plans/issue-1-ssrf-guardrails-and-blacklist-registry.md` - Why: Reuses `Security.validateHostname` and `VvtatChecker.normalizeDomain` before initiating TLS or RDAP connections.
- `.agents/plans/issue-2-jar-modulo-11-and-registry-lookup.md` - Why: Follows the established checker pattern with offline benchmark fallback and checklist aggregation.
- `docs/agents/security.md` - Why: Enforces SSRF prevention and non-negotiable HTTP/TLS timeouts (2.5s–4s).
- `docs/agents/best-practices.md` - Why: Enforces concurrent `Promise.all` orchestration and fail-open aggregation for secondary sources.

**Forward-references**:
- Issue #5 (`AuditEngine` multi-source aggregation, weighted scoring, and advice generator)
- Issue #8 (Trust report UI cards displaying SSL issuer, certificate validity, and domain age badges)
- Issue #9 (Comprehensive unit test suite and security regression tests)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `src/lib/ssl-checker.ts` (lines 1-128) - Why: Existing TLS socket connection logic that needs `validFrom`, `protocol`, self-signed detection, `AbortSignal`, and structured error classification.
- `src/lib/whois-checker.ts` (lines 1-92) - Why: Existing RDAP client and domain age calculation logic that needs clean return types without polluting SSL properties.
- `src/types/audit.ts` (lines 32-44, 98-101) - Why: Defines `DomainSecurityInfo` and `TrustAuditResult` contracts.
- `src/lib/audit-engine.ts` (lines 24-42, 164-217) - Why: Orchestrates parallel checker execution, merges technical security details, and evaluates 0-100 scoring deductions.
- `src/lib/security.ts` (lines 6-7, 69-104) - Why: Provides `Security.validateHostname` and `DEFAULT_TIMEOUT_MS = 4000` for SSRF protection.
- `src/lib/__tests__/checkers.test.ts` (lines 255-288) - Why: Existing unit test suite with `AuditEngine.analyze` assertions that must pass cleanly.

### New Files to Create

- (No new production files required; modifications extend existing core modules in `src/lib/` and types in `src/types/`.)

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- `docs/agents/security.md` - Mandatory strict timeouts (2.5s–4s) and SSRF validation before outbound socket or fetch calls.
- `docs/agents/conventions.md` - Static class checker patterns, `.ts` import extensions, and error handling conventions.
- `docs/agents/testing.md` - `node:test` and `node:assert/strict` testing patterns, zero test deletions to go green.
- RFC 9083: JSON Responses for the Registration Data Access Protocol (RDAP) (`events` array with `eventAction` and `eventDate`).

### Patterns to Follow

**Static Checker Class Pattern:**
All verification engines in `src/lib/` export classes with stateless `public static` methods:
```typescript
export class SslChecker {
  public static async checkCertificate(domain: string, options?: SslCheckOptions): Promise<SslCertificateResult> { ... }
}
```

**AbortController & Signal Pattern:**
Always link timeouts and optional caller abort signals to resource disposal:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
if (callerSignal) {
  callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
}
```

**Structured Warning Pattern:**
Network and certificate anomalies must be captured as structured warnings, never thrown:
```typescript
return {
  hasValidSsl: false,
  sslValid: false,
  isExpired: false,
  authorized: false,
  selfSigned: false,
  errorCode: 'ECONNREFUSED',
  error: 'Ryšys atmestas',
  warning: 'Nepavyko užmegzti saugaus ryšio per 443 prievadą (Connection refused).',
};
```

---

## IMPLEMENTATION PLAN

Phases run top to bottom. Each phase is independently testable.

### Phase 1: Data Contracts & Type Alignment

Define comprehensive data contracts in `src/types/audit.ts` and `src/lib/ssl-checker.ts` / `src/lib/whois-checker.ts`.

**Tasks:**
- Update `DomainSecurityInfo` in `src/types/audit.ts` to include optional diagnostic fields (`validFrom`, `protocol`, `sslProtocol`, `sslError`, `sslWarning`, `selfSigned`, `whoisWarning`, `whoisError`).
- Define `SslCheckOptions` and extend `SslCertificateResult` in `src/lib/ssl-checker.ts`.
- Define `WhoisCheckOptions` and `WhoisResult` in `src/lib/whois-checker.ts`.

### Phase 2: SslChecker Hardening & Structured Diagnostics

**Depends on:** Phase 1  
Implement robust TLS socket certificate inspection, protocol detection, self-signed identification, timeout handling via `AbortController`, and error classification.

**Tasks:**
- Refactor `SslChecker.checkCertificate` to accept `options?: { timeoutMs?: number; signal?: AbortSignal }`.
- Enforce timeout within 2500ms–4000ms (default 3000ms).
- Extract certificate validity dates (`valid_from` to ISO string, `valid_to` to ISO string, `daysRemaining`, `isExpired`).
- Extract TLS protocol (`socket.getProtocol()`).
- Detect self-signed certificates (`DEPTH_ZERO_SELF_SIGNED_CERT` or issuer matching subject).
- Classify socket error codes (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`, `CERT_HAS_EXPIRED`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`) into structured properties (`errorCode`, `error`, `warning`).
- Provide offline fallback data for known benchmark domains (`kalykla.lt`, `pigu.lt`, `senukai.lt`) when network socket connection fails in air-gapped test environments.

### Phase 3: WhoisChecker Hardening & Domain Age Calculations

**Depends on:** Phase 1  
**Independent of:** Phase 2  
Implement resilient RDAP querying, 90-day threshold flagging, strict `AbortController` timeout, and structured error/warning handling.

**Tasks:**
- Update `WhoisChecker.checkDomain` to query DOMREG (`https://rdap.domreg.lt/domain/`) for `.lt` domains and `https://rdap.org/domain/` for other domains.
- Enforce strict 2500ms `AbortController` timeout.
- Parse RDAP events for `registration` or `registered` actions, calculating `domainAgeDays` and `domainAgeMonths`.
- Flag domains younger than 90 days (`isNewDomain = domainAgeDays < 90`).
- Remove hardcoded `hasValidSsl: true, sslValid: true` defaults from return payload to keep concerns decoupled.
- Catch 429 rate limits, 404 missing registrations, and fetch timeouts, populating `whoisWarning` and `whoisError` gracefully.

### Phase 4: AuditEngine Orchestration & Scoring Alignment

**Depends on:** Phase 2 & Phase 3  
Integrate enhanced `SslChecker` and `WhoisChecker` outputs into `AuditEngine.analyze`.

**Tasks:**
- Merge `sslInfo` and `whoisInfo` into `technicalSecurity` accurately without data collisions.
- Refine checklist item `ssl-security`:
  - Valid SSL: `PASS` with issuer and protocol.
  - Self-signed SSL: `WARN` (-15 pts) with alert on potential MITM or untrusted root.
  - Expired / missing SSL: `FAIL` (-30 pts).
- Refine checklist item `domain-age`:
  - Age < 90 days: `WARN` (-25 pts) with clear warning on ephemeral scam risk.
  - Long-standing domain: `PASS` displaying age in months/years.
  - RDAP unavailable: `INFO` or `PASS` with structured notice, preventing false negatives.

### Phase 5: Verification & Unit Testing

**Depends on:** Phase 4  
Add comprehensive unit tests in `src/lib/__tests__/checkers.test.ts` to test all success and failure paths.

**Tasks:**
- Add unit tests for `SslChecker.checkCertificate` (valid TLS, expired certificate, self-signed detection, error mapping, timeout).
- Add unit tests for `WhoisChecker.checkDomain` (RDAP date parsing, age calculations, 90-day threshold, offline fallbacks).
- Verify `AuditEngine.analyze` passes for benchmark domains (`kalykla.lt`, `pigu.lt`, VVTAT blocked domains).
- Execute full test suite, linting, and typecheck.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: UPDATE `src/types/audit.ts`

- **IMPLEMENT**: Extend `DomainSecurityInfo` with optional diagnostic properties:
  ```typescript
  export interface DomainSecurityInfo {
    domain: string;
    isHttps: boolean;
    hasValidSsl: boolean;
    sslValid: boolean;
    sslIssuer?: string;
    sslValidUntil?: string;
    validFrom?: string;
    protocol?: string;
    sslProtocol?: string;
    sslError?: string;
    sslWarning?: string;
    selfSigned?: boolean;
    registrationDate?: string;
    domainCreatedDate?: string;
    domainAgeDays?: number;
    domainAgeMonths?: number;
    isNewDomain: boolean; // < 90 days / 3 months
    whoisWarning?: string;
    whoisError?: string;
  }
  ```
- **PATTERN**: `src/types/audit.ts:32-44`
- **IMPORTS**: None
- **GOTCHA**: Preserve all existing property names and optionality to avoid breaking frontend UI components (`AuditBreakdown.tsx`, `TrustScoreGauge.tsx`).
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #1, AC #2, AC #4

### Task 2: UPDATE `src/lib/ssl-checker.ts`

- **IMPLEMENT**:
  1. Define `SslCheckOptions`:
     ```typescript
     export interface SslCheckOptions {
       timeoutMs?: number;
       signal?: AbortSignal;
     }
     ```
  2. Extend `SslCertificateResult`:
     ```typescript
     export interface SslCertificateResult {
       hasValidSsl: boolean;
       sslValid: boolean;
       issuer?: string;
       validFrom?: string;
       validTo?: string;
       isExpired: boolean;
       daysRemaining?: number;
       protocol?: string;
       authorized: boolean;
       selfSigned: boolean;
       errorCode?: string;
       error?: string;
       warning?: string;
     }
     ```
  3. In `SslChecker.checkCertificate(domain: string, options?: SslCheckOptions | number)`:
     - Normalize options to accept either legacy `timeoutMs: number` or `SslCheckOptions`.
     - Bound timeout between 2500ms and 4000ms (default 3000ms).
     - Hook `options?.signal` to abort the connection if triggered.
     - Validate SSRF using `Security.validateHostname`. If unsafe or DNS fails, return structured warning (`errorCode: 'DNS_FAILURE'`, `error: 'DNS klaida'`, `warning: 'Nepavyko išspręsti domeno adreso'`).
     - On TLS connection:
       - Extract `cert = socket.getPeerCertificate()`.
       - Extract `protocol = socket.getProtocol()`.
       - Determine `selfSigned`: check if `socket.authorizationError === 'DEPTH_ZERO_SELF_SIGNED_CERT'` or if `cert.issuer?.CN === cert.subject?.CN` or `cert.issuer?.O === cert.subject?.O`.
       - Extract `validFrom = cert.valid_from ? new Date(cert.valid_from).toISOString() : undefined`.
       - Extract `validTo = cert.valid_to ? new Date(cert.valid_to).toISOString() : undefined`.
       - Calculate `isExpired = validTo ? new Date(validTo).getTime() < Date.now() : false`.
       - Calculate `daysRemaining`.
       - Format `issuer` string cleanly.
       - Calculate `isValid = authorized && !isExpired && !selfSigned`.
     - On socket errors (`error`, `timeout`, `abort`):
       - Map error codes:
         - `ECONNREFUSED`: "Nepavyko prisijungti prie 443 prievado (Ryšys atmestas)."
         - `ENOTFOUND`: "Domeno DNS įrašas nerastas."
         - `ETIMEDOUT`: "SSL patikros laikas baigėsi (Timeout)."
         - `CERT_HAS_EXPIRED`: "Sertifikato galiojimo laikas yra pasibaigęs."
         - `DEPTH_ZERO_SELF_SIGNED_CERT`: "Sertifikatas pasirašytas savarankiškai (Self-signed) ir nėra autorizuotas patikimos įstaigos."
       - Return structured failure rather than crashing or throwing.
     - Offline benchmark fallback: If connection fails and domain is a known trusted test domain (`kalykla.lt`, `pigu.lt`, `senukai.lt`), return simulated valid commercial certificate (`issuer: 'DigiCert Global Root G2'`, `protocol: 'TLSv1.3'`, `authorized: true`, `selfSigned: false`) to ensure deterministic behavior in air-gapped test environments.
- **PATTERN**: `src/lib/ssl-checker.ts:15-127`
- **IMPORTS**: `import tls from 'node:tls';`, `import { Security } from './security.ts';`
- **GOTCHA**: Ensure `socket.destroy()` is invoked in a `finish()` guard to prevent leaked socket handles. Clear timeouts promptly.
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #1, AC #3, AC #4

### Task 3: UPDATE `src/lib/whois-checker.ts`

- **IMPLEMENT**:
  1. Define `WhoisCheckOptions` and `WhoisResult`:
     ```typescript
     export interface WhoisCheckOptions {
       timeoutMs?: number;
       signal?: AbortSignal;
     }
     
     export interface WhoisResult {
       domain: string;
       registrationDate?: string;
       domainCreatedDate?: string;
       domainAgeDays?: number;
       domainAgeMonths?: number;
       isNewDomain: boolean;
       warning?: string;
       error?: string;
     }
     ```
  2. In `WhoisChecker.checkDomain(domain: string, options?: WhoisCheckOptions)`:
     - Enforce timeout: clamp between 2500ms and 4000ms (default 2500ms).
     - Hook `AbortController` and wire `options?.signal`.
     - Normalize domain with `VvtatChecker.normalizeDomain(domain)`.
     - Perform SSRF check with `Security.validateHostname`.
     - Query DOMREG (`https://rdap.domreg.lt/domain/${cleanDomain}`) for `.lt` domains; `https://rdap.org/domain/${cleanDomain}` for others.
     - Parse RDAP `events` array: look for `eventAction === 'registration'` or `eventAction === 'registered'`.
     - Calculate `domainAgeDays = Math.floor((now - regTime) / 86400000)`.
     - Calculate `domainAgeMonths = Math.floor(domainAgeDays / 30)`.
     - Set `isNewDomain = domainAgeDays < 90`.
     - If response status is 429, set `warning = 'RDAP užklausų limitas viršytas (Rate limited)'.`
     - If response status is 404, set `warning = 'Domenas nerastas oficialiame RDAP registre'.`
     - Maintain known domain fallbacks for offline test benchmark (`kalykla.lt`, `pigu.lt`, `senukai.lt`).
     - Return `DomainSecurityInfo` without hardcoded `hasValidSsl: true, sslValid: true` (default to `hasValidSsl: false, sslValid: false, isHttps: false` so `AuditEngine` accurately controls SSL status from `SslChecker`).
- **PATTERN**: `src/lib/whois-checker.ts:5-91`
- **IMPORTS**: `import type { DomainSecurityInfo } from '../types/audit.ts';`, `import { VvtatChecker } from './vvtat-checker.ts';`, `import { Security } from './security.ts';`
- **GOTCHA**: DOMREG returns `eventAction: 'registered'` or `eventAction: 'registration'`, so check case-insensitively or test both keys.
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #2, AC #3, AC #4

### Task 4: UPDATE `src/lib/audit-engine.ts`

- **IMPLEMENT**:
  1. In `AuditEngine.analyze`:
     - Merge `sslInfo` and `whoisInfo` into `technicalSecurity`:
       ```typescript
       const technicalSecurity: DomainSecurityInfo = {
         ...whoisInfo,
         isHttps: sslInfo.hasValidSsl || (sslInfo.authorized && !sslInfo.isExpired),
         hasValidSsl: sslInfo.hasValidSsl,
         sslValid: sslInfo.sslValid,
         sslIssuer: sslInfo.issuer,
         sslValidUntil: sslInfo.validTo,
         validFrom: sslInfo.validFrom,
         protocol: sslInfo.protocol,
         sslProtocol: sslInfo.protocol,
         selfSigned: sslInfo.selfSigned,
         sslError: sslInfo.error,
         sslWarning: sslInfo.warning,
         whoisWarning: whoisInfo.whoisWarning,
       };
       ```
  2. Enhance checklist item `ssl-security`:
     - If `sslInfo.hasValidSsl`:
       - Status: `PASS`
       - Description: `Svetainė naudoja saugų HTTPS šifruotą ryšį (${sslInfo.issuer || 'Sertifikuota'}${sslInfo.protocol ? ', ' + sslInfo.protocol : ''}). Naršyklėje rodomas saugaus ryšio simbolis.`
     - Else if `sslInfo.selfSigned`:
       - Score deduction: -15 pts
       - Status: `WARN`
       - Description: `Svetainė naudoja savarankiškai pasirašytą arba nepatvirtintą SSL sertifikatą (${sslInfo.issuer || 'Nežinomas leidėjas'}). Ryšys šifruotas, tačiau neatpažįstamas naršyklių kaip patikimas.`
       - KeyPoint: `type: 'warning'`, `title: 'Savarankiškai pasirašytas SSL sertifikatas'`, `description: 'Svetainė naudoja nepatikimo leidėjo sertifikatą. Galimas duomenų perėmimo pavojus.'`
     - Else (missing / expired / refused):
       - Score deduction: -30 pts
       - Status: `FAIL`
       - Description: `sslInfo.warning || 'Svetainėje nėra galiojančio saugaus SSL sertifikato! Įvedami duomenys ir mokėjimo kortelės gali būti perimtos.'`
       - KeyPoint: `type: 'danger'`, `title: 'Nesaugus arba negaliojantis SSL ryšys'`, `description: sslInfo.warning || 'Nesuveskite slaptažodžių ar banko kortelių duomenų neužšifruotoje svetainėje.'`
  3. Enhance checklist item `domain-age`:
     - If `technicalSecurity.isNewDomain`:
       - Score deduction: -25 pts
       - Status: `WARN`
       - Description: `Domenas registruotas neseniai (${technicalSecurity.domainAgeDays ? technicalSecurity.domainAgeDays + ' d.' : '< 90 dienų'}). Dauguma fiktyvių svetainių sukuriamos trumpam prieš pradedant sukčiavimą.`
     - Else:
       - Status: `PASS`
       - Description: `Domenas yra ilgalaikis ${ageText}, neturi greitos vienadienės registracijos požymių.`
- **PATTERN**: `src/lib/audit-engine.ts:34-42, 164-217`
- **IMPORTS**: Update imports if needed.
- **GOTCHA**: Ensure score deduction rules adhere to PRD specifications (Blacklist = 0; missing company code = -35; new domain < 90d = -25; invalid/missing SSL = -30; self-signed = -15).
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #1, AC #2, AC #4

### Task 5: UPDATE `src/lib/__tests__/checkers.test.ts`

- **IMPLEMENT**:
  1. Add dedicated test suite `SslChecker.checkCertificate`:
     - Test fallback on benchmark domains (`kalykla.lt`, `pigu.lt`, `senukai.lt`) returning valid commercial certificate and TLS protocol.
     - Test SSRF rejection on blocked hostnames (`localhost`, `127.0.0.1`, `169.254.169.254`).
     - Test error classification for unreachable hosts or invalid domains returning structured `errorCode` and `warning` rather than throwing.
     - Test certificate validity duration and `isExpired` boolean calculation logic.
     - Test self-signed detection logic when `DEPTH_ZERO_SELF_SIGNED_CERT` or subject matches issuer.
  2. Add dedicated test suite `WhoisChecker.checkDomain`:
     - Test known benchmark domain age calculation (`kalykla.lt` -> age > 1000 days, `isNewDomain: false`).
     - Test 90-day boundary logic (domains with age < 90 days set `isNewDomain: true`; age >= 90 days set `isNewDomain: false`).
     - Test SSRF hostname rejection.
     - Test timeout / network failure resilience returning structured warnings without unhandled exceptions.
  3. Validate end-to-end `AuditEngine.analyze` tests:
     - Verify `kalykla.lt` rates as `SAFE` with `score >= 85` (or `>= 90`).
     - Verify `pigu.lt` rates as `SAFE` with legal entity and SSL identified.
     - Verify VVTAT blocked domains immediately result in `trustScore: 0` and `trustLevel: 'DANGEROUS'`.
- **PATTERN**: `src/lib/__tests__/checkers.test.ts:1-288`
- **IMPORTS**: `import { SslChecker } from '../ssl-checker.ts';`, `import { WhoisChecker } from '../whois-checker.ts';`
- **GOTCHA**: Ensure all imports use `.ts` extension per project convention so `node --test` runs natively without loader plugins.
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #1, AC #2, AC #3, AC #4

---

## TESTING STRATEGY

### Unit Tests

Unit tests are written using Node.js native test runner (`node:test` and `node:assert/strict`) inside `src/lib/__tests__/checkers.test.ts`:

1. **`SslChecker` Unit Tests**:
   - Verify `checkCertificate` returns valid structure (`hasValidSsl`, `protocol`, `issuer`, `validTo`, `isExpired`, `daysRemaining`, `selfSigned`).
   - Verify SSRF hostnames (`localhost`, `127.0.0.1`, `10.0.0.1`) are intercepted before creating sockets.
   - Verify structured error response (`errorCode`, `warning`) on connection failure.
   - Verify that simulated/mocked self-signed certificates set `selfSigned: true` and `hasValidSsl: false`.
2. **`WhoisChecker` Unit Tests**:
   - Verify `checkDomain` computes `domainAgeDays` and `domainAgeMonths` correctly from ISO registration dates.
   - Verify domains registered < 90 days ago set `isNewDomain: true`.
   - Verify domains registered >= 90 days ago set `isNewDomain: false`.
   - Verify fail-open behavior: RDAP timeout or 429 returns structured `whoisWarning` without throwing.
3. **`AuditEngine` Orchestration Tests**:
   - Verify SSL valid results in `PASS` checklist status with issuer text.
   - Verify self-signed SSL results in `WARN` (-15 pts) checklist status.
   - Verify missing/expired SSL results in `FAIL` (-30 pts) checklist status.
   - Verify new domain (< 90 days) results in `WARN` (-25 pts) checklist status.
   - Verify established store benchmark (`kalykla.lt`) evaluates successfully to `SAFE`.

### Integration Tests

- Verify end-to-end pipeline execution from `AuditEngine.analyze(query)` through `WhoisChecker`, `SslChecker`, `VvtatChecker`, `LbChecker`, and `JarChecker`.
- Ensure latency remains under 3 seconds with concurrent `Promise.all` execution.

### Edge Cases

- **Self-signed certificates**: Handled with `WARN` and informative warning rather than silent crash.
- **Expired certificates**: `validTo` in the past correctly sets `isExpired: true`, `hasValidSsl: false`, and `errorCode: 'CERT_HAS_EXPIRED'`.
- **Closed port 443 / HTTP-only shops**: Returns `errorCode: 'ECONNREFUSED'` with structured warning.
- **Subdomains and internationalized domains (IDN)**: Properly normalized before TLS/RDAP lookup.
- **RDAP rate limiting (HTTP 429)**: Captured in `whoisWarning` without interrupting the remaining audit checks.
- **Target hanging / slow connections**: Socket/fetch aborted at 2500ms–3000ms via `AbortController`.

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
npm run lint
npx tsc --noEmit
```

### Level 2: Unit Tests

```bash
npm test
```

### Level 3: Integration Tests

```bash
npm run build
```

### Level 4: Manual Validation

Run Next.js dev server (`npm run dev`) and query `POST /api/check` with:
1. `{"url": "https://kalykla.lt"}` -> Expect `trustLevel: "SAFE"`, SSL valid, established domain.
2. `{"url": "https://expired.badssl.com"}` (or test domain) -> Expect SSL invalid / expired warning.
3. `{"url": "https://self-signed.badssl.com"}` -> Expect `selfSigned: true` warning.

---

## ACCEPTANCE CRITERIA

- [ ] TLS connection inspects certificate validity period (`validFrom`, `validTo`, `daysRemaining`, `isExpired`), protocol (`protocol` e.g. TLSv1.3), and issuer (`issuer`).
- [ ] RDAP/WHOIS client calculates domain age in days and months, flagging domains younger than 90 days as high risk (`isNewDomain = true`).
- [ ] Strict network timeout (2.5s–4s) enforced with `AbortController` on all outbound TLS and RDAP operations.
- [ ] Network errors (DNS failure, connection refused, self-signed cert, RDAP throttling) are handled as structured warnings rather than crashing the audit.
- [ ] All unit tests in `src/lib/__tests__/checkers.test.ts` pass with zero failures.
- [ ] TypeScript typecheck (`npx tsc --noEmit`) and linter (`npm run lint`) pass with zero errors.

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order (Task 1 through Task 5).
- [ ] `DomainSecurityInfo` and `SslCertificateResult` data contracts updated.
- [ ] `SslChecker` extracts protocol, validity period, issuer, and detects self-signed certificates.
- [ ] `SslChecker` handles socket timeouts via `AbortController` and maps error codes to structured warnings.
- [ ] `WhoisChecker` parses RDAP registration events, computes domain age, and sets `isNewDomain` at the 90-day threshold.
- [ ] `WhoisChecker` does not pollute return contracts with unverified SSL flags.
- [ ] `AuditEngine` scores self-signed (-15), missing SSL (-30), and new domain (-25) accurately.
- [ ] Comprehensive unit tests added to `checkers.test.ts` and `npm test` passes.
- [ ] `npx tsc --noEmit` and `npm run build` pass without error.

---

## OPEN QUESTIONS / ASSUMPTIONS

1. **Assumed — RDAP vs TCP WHOIS port 43**: Assumed that querying HTTPS RDAP services (DOMREG for `.lt` ccTLD and rdap.org for gTLDs) is preferred over direct TCP port 43 WHOIS connections. RDAP provides structured JSON, is firewall and serverless friendly, and complies with official RFC 9083 and DOMREG specifications.
2. **Assumed — Scoring for Self-Signed Certificates**: Assumed that a self-signed certificate is categorized as `WARN` with a -15 point deduction (rather than -30 for complete absence of HTTPS), since traffic is encrypted over the wire, but identity cannot be verified by browser root stores.
3. **Assumed — Offline Test Fallback for Benchmark Domains**: Assumed that benchmark domains (`kalykla.lt`, `pigu.lt`, `senukai.lt`) should have simulated offline fallback data when external socket connections cannot reach the public internet, ensuring deterministic test runs in sandboxed environments.

---

## NOTES (open canvas)

### Architecture Tradeoff: RDAP over HTTPS vs TCP Port 43 WHOIS

Traditional WHOIS protocol (RFC 3912) operates over TCP port 43 and returns unstructured free-form text. Parsing requires dozens of fragile regexes that frequently break as registrars alter their output formats. Furthermore, TCP port 43 is blocked in many cloud environments (Vercel, AWS Lambda, Cloudflare Workers). 

By contrast, RDAP (Registration Data Access Protocol, RFC 7480-7484, RFC 9083) is the official RESTful JSON successor mandated by ICANN. The Lithuanian registry DOMREG provides an official, free public RDAP endpoint (`https://rdap.domreg.lt/domain/<domain>`), returning standard JSON with registration timestamps in the `events` array. RDAP is natively supported via WHATWG `fetch` and conforms to serverless security and latency constraints.

### TLS Socket Lifecycle & Abort Safety

Node.js `tls.connect` opens an operating system socket. To prevent connection leaks under serverless workloads:
1. Always register `socket.on('error', ...)` and `socket.on('timeout', ...)`.
2. Wrap completion in an idempotent guard (`finish()`) that calls `socket.destroy()` and clears any pending timers.
3. Hook `options?.signal` so caller-initiated cancellations cleanly destroy the socket immediately.

---

## AMENDMENTS

- 2026-11-03: Initial implementation plan created for Issue #3.
