# Feature: Implement Lithuanian Legal Entity (JAR) Modulo 11 Validation and Registry Lookup

The following plan should be complete, but its important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils types and models. Import from the right files etc.

## Feature Description

Provide robust validation and verification of 9-digit Lithuanian legal entity codes (JAR – Juridinių asmenų registras) using official Modulo 11 two-stage check digit arithmetic, defensive type/malformed input handling, and status classification (`VEIKIANTI`, `LIKVIDUOJAMA`, `BANKRUTUOJANTI`, `NEZINOMA`) backed by a structured offline JSON registry dataset (`src/data/jar-entities-cache.json`). Integrate JAR enterprise status evaluation into `AuditEngine` and `LegalSummaryCard` to immediately penalize shops operated by bankrupt or liquidated entities.

## User Story

As a Lithuanian consumer or compliance auditor  
I want the trust checker to validate extracted Lithuanian enterprise codes against official Modulo 11 checksum rules and verify their legal status in the JAR registry  
So that I am immediately alerted if an online store displays a counterfeit company code or belongs to a company undergoing bankruptcy or liquidation proceedings.

## Problem Statement

1. **Defensive Input Safety**: While `JarChecker.validateCompanyCodeFormat` implements Modulo 11 check digit logic, it assumes string inputs and will throw an unhandled `TypeError` if invoked with `null`, `undefined`, numbers, or malformed non-string types.
2. **Missing Status Classification & Code-Based Lookup**: `JarChecker.lookupEntity` only looks up entities by normalized domain in a small hardcoded map. When an unknown domain presents a valid extracted company code, the status is unconditionally returned as `'NEZINOMA'`. There is no lookup by company code (`lookupByCode`), nor status normalizer (`classifyStatus`) to categorize raw enterprise status descriptions into `'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA'`.
3. **Audit Scoring Disconnect**: `AuditEngine.analyze` verifies whether an enterprise code was found and whether its format is valid, but completely ignores `mergedLegal.jarStatus`. If a shop claims an entity undergoing bankruptcy (`BANKRUTUOJANTI`) or liquidation (`LIKVIDUOJAMA`), the audit engine currently awards full legal points (`PASS`) instead of penalizing trust score and displaying critical risk warnings.
4. **Hardcoded Data**: Known entity definitions are hardcoded inside `src/lib/jar-checker.ts` rather than living in an extensible, cached JSON dataset under `src/data/jar-entities-cache.json` mirroring `src/data/vvtat-blocked-cache.json` and `src/data/lb-flagged-cache.json`.

## Solution Statement

1. **Externalize & Expand Registry Dataset**: Create `src/data/jar-entities-cache.json` containing known Lithuanian legal entities with metadata (`lastUpdated`, `source`, `entities` list/record) covering active market leaders (`VEIKIANTI`), bankrupt entities (`BANKRUTUOJANTI`), and entities in liquidation (`LIKVIDUOJAMA`).
2. **Harden Modulo 11 & Input Sanitization**: Update `JarChecker.validateCompanyCodeFormat` to guard against `null`, `undefined`, non-string types, and malformed inputs, returning `false` without throwing.
3. **Implement Status Classification & Bidirectional Lookup**: Add `JarChecker.classifyStatus(rawStatus?: string)` to map arbitrary status strings into the strict union `'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA'`. Add `JarChecker.lookupByCode(code: string)` to search registry by 9-digit code, and update `JarChecker.lookupEntity(domain, extractedCode)` to query by code when domain lookup misses.
4. **Wire Status Scoring in AuditEngine**: In `src/lib/audit-engine.ts`, evaluate `mergedLegal.jarStatus`:
   - `BANKRUTUOJANTI`: Deduct 40 points, mark checklist as `FAIL`, push danger keyPoint ("Bankrutuojantis juridinis asmuo").
   - `LIKVIDUOJAMA`: Deduct 25 points, mark checklist as `WARN`, push warning keyPoint ("Likviduojamas juridinis asmuo").
   - `VEIKIANTI`: 0 deduction, mark checklist as `PASS`.
   - `NEZINOMA`: Standard valid format handling.
5. **Update UI Status Presentation**: Update `LegalSummaryCard.tsx` to display distinct color-coded badges and descriptions for all 4 JAR statuses.
6. **Comprehensive Unit Testing**: Expand `src/lib/__tests__/checkers.test.ts` to test Modulo 11 defensive edge cases, status classification, code lookup, and audit engine scoring penalties.

## Out of Scope / Non-Goals

- Not included: Live HTTP scraping of Registrų Centras or data.gov.lt SOAP/REST APIs requiring authenticated session tokens or API keys (runs deterministically offline against cached dataset).
- Not included: Modifying Cheerio regex heuristics for extracting company codes from HTML (covered by Issue #4).
- Not included: Changing WHOIS/RDAP or SSL certificate checkers (covered by Issue #3).
- Not changing: The public `LegalEntityInfo` TypeScript interface shape in `src/types/audit.ts`.

## Feature Metadata

**Feature Type**: Enhancement / Core Verification Service  
**Estimated Complexity**: Medium  
**Primary Systems Affected**: `src/lib/jar-checker.ts`, `src/data/jar-entities-cache.json`, `src/lib/audit-engine.ts`, `src/components/LegalSummaryCard.tsx`, `src/lib/__tests__/checkers.test.ts`  
**Dependencies**: Node.js built-in `node:test`, `node:assert/strict` (zero new external npm packages)

## Related Work

**Implements**: [Issue #2](https://github.com/tommardev/eshop-trust-checker/issues/2) · **Epic**: `docs/PRD.md` (Phase 4.2.4) & `docs/ARCHITECTURE.md` (Section 2 & 3)

**Back-references**:
- `.agents/plans/issue-1-ssrf-guardrails-and-blacklist-registry.md` - Why: Establishes JSON cache import convention with `with { type: 'json' }` and `.ts` relative imports.
- `docs/VVTAT_CRITERIA_AND_DATA_SOURCES.md` - Why: Defines JAR status rules and Registrų Centras open data classifications.

**Forward-references**:
- Issue #4 (Cheerio web scraper for extracting company codes from HTML)
- Issue #5 (AuditEngine multi-source aggregation)
- Issue #8 (TrustScoreGauge and LegalSummaryCard enhancements)
- Issue #9 (Comprehensive unit tests)

---

## CONTEXT REFERENCES

### Relevant Codebase Files IMPORTANT: YOU MUST READ THESE FILES BEFORE IMPLEMENTING!

- `src/lib/jar-checker.ts` (lines 1-143) - Why: Contains `JarChecker` with `validateCompanyCodeFormat`, `knownEntities`, and `lookupEntity`. Needs defensive input guards, code-based lookup, and status classification.
- `src/types/audit.ts` (lines 15-30) - Why: Defines `LegalEntityInfo` with `jarStatus?: 'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA'`.
- `src/lib/audit-engine.ts` (lines 44-59, 112-162) - Why: Aggregates `legalInfo` and computes scores. Needs `jarStatus` evaluation for bankruptcy and liquidation penalties.
- `src/components/LegalSummaryCard.tsx` (lines 69-75) - Why: UI display of JAR status. Needs badge styling for `LIKVIDUOJAMA` and `BANKRUTUOJANTI`.
- `src/data/vvtat-blocked-cache.json` (lines 1-35) - Why: Reference schema for static JSON cache data in `src/data/`.
- `src/lib/__tests__/checkers.test.ts` (lines 95-205) - Why: Existing unit test suite for Modulo 11 check digits and entity lookup.

### New Files to Create

- `src/data/jar-entities-cache.json` - Cached JSON dataset of Lithuanian legal entities with company codes, names, VAT codes, addresses, contact details, domains, and JAR statuses.

### Relevant Documentation YOU SHOULD READ THESE BEFORE IMPLEMENTING!

- `docs/VVTAT_CRITERIA_AND_DATA_SOURCES.md` (Section 2.B) - Registrų Centras (JAR) criteria: active (`Veikianti`), bankrupt (`Bankrutuojanti`), in liquidation (`Likviduojama`), deregistered (`Išregistruota`).
- `docs/agents/conventions.md` - Checker class pattern (stateless class with public static methods, `.ts` imports).
- `docs/agents/testing.md` - Node native test runner conventions (`npm test`).

### Patterns to Follow

**Defensive Input Guard Pattern:**
```typescript
if (!code || typeof code !== 'string') {
  return false;
}
```

**JSON Cache Import Pattern (Node.js native test runner compatible):**
```typescript
import jarCache from '../data/jar-entities-cache.json' with { type: 'json' };
```
Always use `with { type: 'json' }` and `.ts` extension on relative imports.

**Status Classification Pattern:**
```typescript
public static classifyStatus(rawStatus?: string): 'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA' {
  if (!rawStatus || typeof rawStatus !== 'string') return 'NEZINOMA';
  const s = rawStatus.toLowerCase().trim();
  if (s.includes('bankrut') || s.includes('bankrupt')) return 'BANKRUTUOJANTI';
  if (s.includes('likvid') || s.includes('liquidat')) return 'LIKVIDUOJAMA';
  if (s.includes('veikian') || s.includes('registruot') || s.includes('active')) return 'VEIKIANTI';
  return 'NEZINOMA';
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation & Cached Registry Dataset

**Tasks:**
- Create `src/data/jar-entities-cache.json` with structured records of known entities, including active enterprises (`VEIKIANTI`), enterprises in liquidation (`LIKVIDUOJAMA`), and bankrupt enterprises (`BANKRUTUOJANTI`).
- Define TypeScript helper types for the cache structure.

### Phase 2: Core Modulo 11 Validation & Status Classification

**Depends on:** Phase 1

**Tasks:**
- Harden `JarChecker.validateCompanyCodeFormat` in `src/lib/jar-checker.ts` against `null`, `undefined`, non-string types, and whitespace-only strings.
- Implement `JarChecker.classifyStatus(rawStatus?: string)` to map strings into `'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA'`.
- Implement `JarChecker.lookupByCode(code: string)` to resolve entity details by 9-digit code from `src/data/jar-entities-cache.json`.
- Enhance `JarChecker.lookupEntity(domain: string, extractedCode?: string)`:
  - If found by domain in cache, return entity info.
  - If not found by domain but `extractedCode` is supplied, search by cleaned code in cache.
  - If found in cache, return the cached entity info with its status.
  - If not found in cache, validate format via `validateCompanyCodeFormat`. If valid, return `found: true, companyFound: true, isValidCodeFormat: true, jarStatus: 'NEZINOMA'`. If invalid, return `found: false, companyFound: false, isValidCodeFormat: false, jarStatus: 'NEZINOMA'`.

### Phase 3: Integration with AuditEngine & UI

**Depends on:** Phase 2

**Tasks:**
- Update `src/lib/audit-engine.ts` to evaluate `mergedLegal.jarStatus`:
  - When `mergedLegal.jarStatus === 'BANKRUTUOJANTI'`: deduct 40 points, add checklist item with status `FAIL` and title "Bankrutuojantis juridinis asmuo", add danger recommendation keyPoint.
  - When `mergedLegal.jarStatus === 'LIKVIDUOJAMA'`: deduct 25 points, add checklist item with status `WARN` and title "Likviduojamas juridinis asmuo", add warning recommendation keyPoint.
  - When `mergedLegal.jarStatus === 'VEIKIANTI'`: verify existing PASS handling.
- Update `src/components/LegalSummaryCard.tsx` to handle `LIKVIDUOJAMA` (amber badge) and `BANKRUTUOJANTI` (rose badge) in the "Statusas registre" field.

### Phase 4: Testing & Validation

**Depends on:** Phases 1–3

**Tasks:**
- Expand `src/lib/__tests__/checkers.test.ts` to test:
  - Non-string / null / undefined inputs to `validateCompanyCodeFormat`.
  - `classifyStatus` with various raw strings.
  - `lookupByCode` with active, bankrupt, liquidated, and unregistered codes.
  - `lookupEntity` resolving entity by extracted code when domain is generic or unknown.
  - `AuditEngine.analyze` scoring for bankrupt and liquidated entity scenarios.
- Run `npx tsc --noEmit`, `npm run lint`, and `npm test`.

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### CREATE `src/data/jar-entities-cache.json`

- **IMPLEMENT**: Create JSON file with `lastUpdated`, `source` (`"https://data.gov.lt/datasets/1545/ (Registrų Centras JAR atvirieji duomenys)"`), and `entities` array/dictionary containing:
  - `120153835`: UAB „Lietuvos monetų kalykla“, domain `kalykla.lt`, `VEIKIANTI`, VAT `LT201538314`, address `Eigulių g. 4, LT-03150 Vilnius`, email `info@kalykla.lt`, phone `+370 5 216 2616`.
  - `300866792`: UAB „Pigu“, domain `pigu.lt`, `VEIKIANTI`, VAT `LT100003295815`, address `Laisvės pr. 75, Vilnius`, email `pagalba@pigu.lt`, phone `+370 661 05555`.
  - `234376520`: UAB „Kesko Senukai Digital“, domain `senukai.lt`, `VEIKIANTI`, VAT `LT343765219`, address `Kareivių g. 11B, Vilnius`, email `info@senukai.lt`, phone `+370 700 11119`.
  - `134777619`: UAB „Topo grupė“, domain `topocentras.lt`, `VEIKIANTI`, VAT `LT347776113`, address `Savanorių pr. 206A, Kaunas`, email `info@topocentras.lt`, phone `+370 700 55800`.
  - `123033512`: MAXIMA LT, UAB, domain `maxima.lt`, `VEIKIANTI`, VAT `LT230335113`, address `Savanorių pr. 5, Vilnius`.
  - `302587410`: UAB „Likviduojama Prekyba“, domain `likviduojama-shop.lt`, `LIKVIDUOJAMA`, address `Vilniaus g. 1, Vilnius`.
  - `301234567`: UAB „Bankrutuojanti E-Parduotuvė“, domain `bankrutuojanti-shop.lt`, `BANKRUTUOJANTI`, address `Kauno g. 2, Kaunas`.
- **PATTERN**: Mirror `src/data/vvtat-blocked-cache.json`.
- **VALIDATE**: `node -e "JSON.parse(require('fs').readFileSync('src/data/jar-entities-cache.json', 'utf8'))"`
- **SATISFIES**: AC #2 (Status lookup classifies enterprise state).

### UPDATE `src/lib/jar-checker.ts`

- **IMPLEMENT**:
  1. Import `jarCache from '../data/jar-entities-cache.json' with { type: 'json' }`.
  2. Build internal lookup maps by domain and by 9-digit company code.
  3. In `validateCompanyCodeFormat(code: unknown)`:
     - Check `if (!code || typeof code !== 'string') return false;`.
     - Retain two-stage Modulo 11 logic.
  4. Add `public static classifyStatus(rawStatus?: string): 'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA'`.
  5. Add `public static lookupByCode(code: string): LegalEntityInfo | null`.
  6. Update `public static lookupEntity(domain: string, extractedCode?: string): LegalEntityInfo`:
     - Clean input domain and code defensively without throwing.
     - Match domain in registry.
     - If not matched by domain and `extractedCode` provided, lookup by cleaned code in registry.
     - If found in registry, return complete entity info including `jarStatus` and `isValidCodeFormat: true`.
     - If not found in registry, validate format via `validateCompanyCodeFormat`. If valid: return `found: true, companyFound: true, companyCode: cleanedCode, isValidCodeFormat: true, jarStatus: 'NEZINOMA', isLithuanianOrEu: true`. If invalid or absent: return `found: false, companyFound: false, isValidCodeFormat: false, jarStatus: 'NEZINOMA', isLithuanianOrEu: false`.
- **PATTERN**: Existing `JarChecker` in `src/lib/jar-checker.ts` (lines 70-142).
- **IMPORTS**: `import jarCache from '../data/jar-entities-cache.json' with { type: 'json' };` and `import type { LegalEntityInfo } from '../types/audit.ts';`.
- **GOTCHA**: Must keep `with { type: 'json' }` and `.ts` extension for Node native test runner compatibility.
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #1, AC #2, AC #3.

### UPDATE `src/lib/audit-engine.ts`

- **IMPLEMENT**: In `AuditEngine.analyze`, in section `// C. Teisinis statusas ir Pardavėjo tapatybė`:
  - Check `mergedLegal.jarStatus`:
    - If `mergedLegal.jarStatus === 'BANKRUTUOJANTI'`:
      - Deduct 40 points (`score -= 40`).
      - Push checklist item with `id: 'legal-status'`, `status: 'FAIL'`, `title: 'JAR Teisinis statusas: Bankrutuojanti įmonė'`, description indicating legal entity is in bankruptcy proceedings.
      - Push `keyPoints` danger alert: `title: 'Įmonė bankrutuoja'`, description: `Pardavėjo juridinis asmuo yra bankrutuojantis. Didelė rizika prarasti pinigus neatgavus prekių.`.
    - Else if `mergedLegal.jarStatus === 'LIKVIDUOJAMA'`:
      - Deduct 25 points (`score -= 25`).
      - Push checklist item with `id: 'legal-status'`, `status: 'WARN'`, `title: 'JAR Teisinis statusas: Likviduojama įmonė'`, description indicating legal entity is being liquidated.
      - Push `keyPoints` warning alert: `title: 'Įmonė likviduojama'`, description: `Pardavėjo juridinis asmuo yra likvidavimo stadijoje.`.
    - Else if `mergedLegal.jarStatus === 'VEIKIANTI'`:
      - Add checklist item with `status: 'PASS'`, indicating officially active legal entity in JAR.
- **PATTERN**: Existing checklist generation in `src/lib/audit-engine.ts` (lines 112-162).
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #2 (Status lookup integration and risk handling).

### UPDATE `src/components/LegalSummaryCard.tsx`

- **IMPLEMENT**: In `LegalSummaryCard`, update the "Statusas registre" section to render appropriate badge text and styles:
  - `VEIKIANTI`: "Veikiantis juridinis asmuo" with green text/badge.
  - `LIKVIDUOJAMA`: "Likviduojama įmonė" with amber badge.
  - `BANKRUTUOJANTI`: "Bankrutuojanti įmonė" with rose/red badge.
  - `NEZINOMA` / default: "Nežinomas / Neįvertintas registre" with slate text.
- **PATTERN**: Existing `LegalSummaryCard` (lines 70-74).
- **VALIDATE**: `npx tsc --noEmit`
- **SATISFIES**: AC #2.

### UPDATE `src/lib/__tests__/checkers.test.ts`

- **IMPLEMENT**: Add test suites for:
  - `JarChecker.validateCompanyCodeFormat` edge cases: `null`, `undefined`, number types, object types, boolean, NaN, and symbols returning `false` without throwing.
  - `JarChecker.classifyStatus`: correctly classifies `"Veikianti"`, `"Teisinis statusas neįregistruotas"`, `"Bankrutuojanti"`, `"Bankrutavo"`, `"Likviduojama"`, `"Likviduojamas"`, and unknown strings.
  - `JarChecker.lookupByCode`: returns full `LegalEntityInfo` for active (`120153835`), bankrupt (`301234567`), and liquidated (`302587410`) codes.
  - `JarChecker.lookupEntity`: resolves company by extracted code when domain is not in registry.
  - `AuditEngine.analyze`: verifies that analyzing a bankrupt entity results in significant score reduction and `BANKRUTUOJANTI` checklist item.
- **PATTERN**: Existing test blocks in `src/lib/__tests__/checkers.test.ts`.
- **VALIDATE**: `npm test`
- **SATISFIES**: AC #1, AC #2, AC #3.

---

## TESTING STRATEGY

### Unit Tests

Executed via Node.js native test runner (`node --test src/lib/__tests__/checkers.test.ts`). Tests verify:
- Modulo 11 check digit arithmetic across Stage 1, Stage 2, and Stage 2 fallback to 0.
- Input type safety: `validateCompanyCodeFormat(undefined as unknown as string)` -> `false` without unhandled exceptions.
- Status classification: `classifyStatus('Bankrutuojanti') === 'BANKRUTUOJANTI'`.
- Entity lookup by domain and by code from cached registry.

### Integration Tests

`AuditEngine.analyze` tests verify:
- Active entity (`kalykla.lt`, `pigu.lt`) receives `VEIKIANTI` status.
- Bankrupt entity code (`301234567`) triggers score penalty and danger warnings.
- Liquidated entity code (`302587410`) triggers warning and points deduction.

### Edge Cases

- Non-string inputs: `null`, `undefined`, `123456789`, `{}`
- Code with formatting: `"LT-120153835"`, `" 300 866 792 "`, `"JAR: 234376520"`
- Unknown domain with valid 9-digit code (returns `isValidCodeFormat: true`, `jarStatus: 'NEZINOMA'`)
- Unknown domain with invalid check digit code (returns `isValidCodeFormat: false`, `jarStatus: 'NEZINOMA'`)
- Liquidated / bankrupt statuses in registry lookup

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

- [ ] Modulo 11 checksum calculation correctly validates valid 9-digit codes (Stage 1, Stage 2, fallback 0) and rejects corrupt check digits.
- [ ] Status lookup classifies enterprise state into `'VEIKIANTI'`, `'LIKVIDUOJAMA'`, `'BANKRUTUOJANTI'`, and `'NEZINOMA'`.
- [ ] Handles missing (`null`, `undefined`, empty string) or malformed codes gracefully without throwing unhandled exceptions.
- [ ] Known entities and statuses are externalized into `src/data/jar-entities-cache.json` with lookup supported by both domain and 9-digit code.
- [ ] `AuditEngine.analyze` penalizes bankrupt and liquidated entities with appropriate scoring deductions and checklist items.
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

- **Assumed**: Registrų Centras enterprise records should be cached in `src/data/jar-entities-cache.json` mirroring `vvtat-blocked-cache.json` and `lb-flagged-cache.json` so the audit engine operates with zero external network latency and 100% offline predictability during automated tests.
- **Assumed**: If an entity code is not found in the local cache but has a mathematically valid Modulo 11 check digit, its `jarStatus` is classified as `'NEZINOMA'` (unknown) without penalizing the shop as fraudulent, while an invalid check digit indicates an invalid code format.
- **Assumed**: A company in bankruptcy (`BANKRUTUOJANTI`) represents a critical consumer financial risk and incurs a -40 point penalty in `AuditEngine`, while a company in liquidation (`LIKVIDUOJAMA`) incurs a -25 point penalty.

## NOTES

- The Modulo 11 algorithm implementation in `JarChecker.validateCompanyCodeFormat` is already mathematically correct. The core work of Issue #2 is input hardening against non-string/null parameters, introducing status classification (`classifyStatus`), supporting lookup by company code in addition to domain via `src/data/jar-entities-cache.json`, and wiring status warnings into `AuditEngine` and `LegalSummaryCard`.

## AMENDMENTS
