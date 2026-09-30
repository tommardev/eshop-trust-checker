# Best Practices

Canonical = the way agents must copy. Excluded = rejected here. Language = rules true in this stack.
Every bullet is tagged: `repo:` path · `golden:` standard name · `overridden:` standard rejected.

## Precedence

Host project standard (`repo:`) wins on architecture, stack, naming, and data validation. Golden defaults fill silence. Safety floors are never overridden by habit.

## Audit Orchestration & Concurrency

### Canonical

- `repo:` `src/lib/audit-engine.ts` executes independent checkers concurrently using `Promise.all`:
```typescript
const [blacklistCheck, whoisInfo, scrapedData] = await Promise.all([
  Promise.resolve(VvtatChecker.isBlocked(rawDomain)),
  WhoisChecker.checkDomain(rawDomain),
  WebScraper.analyzeWebsite(normalizedUrl),
]);
```
- `golden:` Fail-open / fallback aggregation: if a non-critical source (like WHOIS RDAP) times out, the audit completes with available data and a warning rather than failing the entire audit.

### Excluded

- Serial `await` execution of independent network requests.
- Directly invoking external scrapers or RDAP calls from React components.

### Language

- `repo:` TypeScript `Promise.all` with typed results.

## Data Extraction & Scraping

### Canonical

- `repo:` `src/lib/scraper.ts` parses HTML using `cheerio` after acquiring text with an aborted `fetch`. Custom User-Agent header identifying the audit tool.
- `repo:` Regex extraction with word boundaries and contextual keywords (e.g. `/(?:įmonės\s*kodas|kodas)[:\s]+([0-9]{9})\b/i`).

### Excluded

- Running headless Chromium / Playwright for simple static HTML parsing where `cheerio` suffices.
- Fetching arbitrary external URLs without protocol sanitization (`https://` enforcement).

### Language

- `golden:` WHATWG Fetch standard with `AbortController` signals and explicit timeouts.

## Legal Entity Validation

### Canonical

- `repo:` `src/lib/jar-checker.ts` Modulo 11 check-digit verification algorithm for 9-digit Lithuanian legal entity codes:
```typescript
const weights1 = [1, 2, 3, 4, 5, 6, 7, 8];
let sum1 = 0;
for (let i = 0; i < 8; i++) sum1 += digits[i] * weights1[i];
let k = sum1 % 11;
```

### Excluded

- Treating any 9-digit string as a valid company code without algorithmic verification.

## TypeScript & Type Safety

### Canonical

- `repo:` `src/types/audit.ts` defines explicit discriminated unions and interfaces for all audit results (`TrustLevel = 'SAFE' | 'CAUTION' | 'DANGEROUS'`).

### Excluded

- Use of `any` for audit results or checker returns.

### Language

- `golden:` TypeScript Handbook + `tsconfig.json` `strict: true`, `noEmit: true`.
