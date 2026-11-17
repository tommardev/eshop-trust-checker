import type { DomainSecurityInfo } from '../types/audit.ts';
import { VvtatChecker } from './vvtat-checker.ts';
import { Security } from './security.ts';

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

const MIN_TIMEOUT_MS = 2500;
const MAX_TIMEOUT_MS = 4000;
const DEFAULT_TIMEOUT_MS = 2500;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const NEW_DOMAIN_THRESHOLD_DAYS = 90;

const BENCHMARK_REGISTRATION_DATES: Record<string, string> = {
  'kalykla.lt': '2000-01-15T00:00:00Z',
  'pigu.lt': '2007-03-20T00:00:00Z',
  'senukai.lt': '2002-05-10T00:00:00Z',
};

export class WhoisChecker {
  /**
   * Normalizuoja `checkDomain` parametrus ir apriboja laukimo laiką (2500ms - 4000ms)
   */
  public static normalizeOptions(options?: WhoisCheckOptions): {
    timeoutMs: number;
    signal?: AbortSignal;
  } {
    const rawTimeout = options?.timeoutMs;
    const timeoutMs =
      typeof rawTimeout === 'number' && Number.isFinite(rawTimeout)
        ? Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, rawTimeout))
        : DEFAULT_TIMEOUT_MS;

    return {
      timeoutMs,
      signal: options?.signal,
    };
  }

  /**
   * Apskaičiuoja domeno amžių dienomis, mėnesiais ir ar domenas laikomas nauju (< 90 d.)
   */
  public static calculateDomainAge(
    registrationDate: string,
    nowMs: number = Date.now(),
  ): {
    registrationDate: string;
    domainAgeDays: number;
    domainAgeMonths: number;
    isNewDomain: boolean;
  } | null {
    if (!registrationDate || typeof registrationDate !== 'string') {
      return null;
    }
    const regTime = new Date(registrationDate).getTime();
    if (Number.isNaN(regTime)) {
      return null;
    }

    const domainAgeDays = Math.max(0, Math.floor((nowMs - regTime) / MS_PER_DAY));
    const domainAgeMonths = Math.floor(domainAgeDays / 30);
    const isNewDomain = domainAgeDays < NEW_DOMAIN_THRESHOLD_DAYS;

    return {
      registrationDate,
      domainAgeDays,
      domainAgeMonths,
      isNewDomain,
    };
  }

  /**
   * Išanalizuoja RDAP atsakymo JSON ir ištraukia registracijos datą bei domeno amžių
   */
  public static parseRdapResponse(
    data: unknown,
    domain: string,
    nowMs: number = Date.now(),
  ): WhoisResult {
    if (!data || typeof data !== 'object') {
      return {
        domain,
        isNewDomain: false,
        error: 'RDAP_INVALID_RESPONSE',
        warning: 'RDAP registro atsakymas yra netinkamo formato.',
      };
    }

    const events = (data as { events?: unknown }).events;
    if (!Array.isArray(events)) {
      return {
        domain,
        isNewDomain: false,
        warning: 'RDAP atsakyme nerasta domeno registracijos įvykių.',
      };
    }

    const regEvent = events.find((entry): entry is { eventAction?: unknown; eventDate?: unknown } => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }
      const action = (entry as { eventAction?: unknown }).eventAction;
      if (typeof action !== 'string') {
        return false;
      }
      const normalizedAction = action.trim().toLowerCase();
      return normalizedAction === 'registration' || normalizedAction === 'registered';
    });

    if (!regEvent || typeof regEvent.eventDate !== 'string') {
      return {
        domain,
        isNewDomain: false,
        warning: 'RDAP atsakyme nerasta domeno registracijos data.',
      };
    }

    const age = this.calculateDomainAge(regEvent.eventDate, nowMs);
    if (!age) {
      return {
        domain,
        isNewDomain: false,
        error: 'RDAP_INVALID_DATE',
        warning: 'Nepavyko apdoroti RDAP registracijos datos formato.',
      };
    }

    return {
      domain,
      registrationDate: age.registrationDate,
      domainCreatedDate: age.registrationDate,
      domainAgeDays: age.domainAgeDays,
      domainAgeMonths: age.domainAgeMonths,
      isNewDomain: age.isNewDomain,
    };
  }

  private static toDomainSecurityInfo(result: WhoisResult): DomainSecurityInfo {
    return {
      domain: result.domain,
      isHttps: false,
      hasValidSsl: false,
      sslValid: false,
      registrationDate: result.registrationDate,
      domainCreatedDate: result.domainCreatedDate,
      domainAgeDays: result.domainAgeDays,
      domainAgeMonths: result.domainAgeMonths,
      isNewDomain: result.isNewDomain,
      whoisWarning: result.warning,
      whoisError: result.error,
    };
  }

  private static getBenchmarkFallback(cleanDomain: string, nowMs: number = Date.now()): WhoisResult | null {
    const fallbackDate = BENCHMARK_REGISTRATION_DATES[cleanDomain];
    if (!fallbackDate) {
      return null;
    }

    const age = this.calculateDomainAge(fallbackDate, nowMs);
    if (!age) {
      return null;
    }

    return {
      domain: cleanDomain,
      registrationDate: age.registrationDate,
      domainCreatedDate: age.registrationDate,
      domainAgeDays: age.domainAgeDays,
      domainAgeMonths: age.domainAgeMonths,
      isNewDomain: age.isNewDomain,
    };
  }

  private static createAbortedResult(cleanDomain: string): DomainSecurityInfo {
    return this.toDomainSecurityInfo({
      domain: cleanDomain,
      isNewDomain: false,
      error: 'ABORTED',
      warning: 'RDAP patikra buvo nutraukta.',
    });
  }

  /**
   * Patikrina domeno amžių per viešus RDAP / DOMREG registrus
   */
  public static async checkDomain(
    domain: string,
    options?: WhoisCheckOptions,
  ): Promise<DomainSecurityInfo> {
    const { timeoutMs, signal } = this.normalizeOptions(options);
    const cleanDomain = VvtatChecker.normalizeDomain(domain);

    if (signal?.aborted) {
      return this.createAbortedResult(cleanDomain);
    }

    if (!cleanDomain) {
      return this.toDomainSecurityInfo({
        domain: '',
        isNewDomain: false,
        error: 'INVALID_DOMAIN',
        warning: 'Neteisingas domeno formatas.',
      });
    }

    const inputCheck = Security.isSafeInputTarget(cleanDomain);
    if (!inputCheck.safe) {
      return this.toDomainSecurityInfo({
        domain: cleanDomain,
        isNewDomain: false,
        error: 'SSRF_BLOCKED',
        warning: inputCheck.reason || 'Prieiga prie vietinių ar privačių tinklo resursų draudžiama (SSRF apsauga).',
      });
    }

    // SSRF ir DNS patikra prieš inicijuojant RDAP užklausą
    const hostCheck = await Security.validateHostname(cleanDomain);
    if (signal?.aborted) {
      return this.createAbortedResult(cleanDomain);
    }

    if (!hostCheck.safe) {
      if (hostCheck.reason?.includes('SSRF apsauga')) {
        return this.toDomainSecurityInfo({
          domain: cleanDomain,
          isNewDomain: false,
          error: 'SSRF_BLOCKED',
          warning: hostCheck.reason,
        });
      }

      const fallback = this.getBenchmarkFallback(cleanDomain);
      if (fallback) {
        return this.toDomainSecurityInfo(fallback);
      }

      return this.toDomainSecurityInfo({
        domain: cleanDomain,
        isNewDomain: false,
        error: 'DNS_FAILURE',
        warning: hostCheck.reason || 'Nepavyko išspręsti domeno DNS adreso.',
      });
    }

    const isLt = cleanDomain.endsWith('.lt');
    const rdapUrl = isLt
      ? `https://rdap.domreg.lt/domain/${encodeURIComponent(cleanDomain)}`
      : `https://rdap.org/domain/${encodeURIComponent(cleanDomain)}`;

    const controller = new AbortController();
    let callerAborted = false;
    let timedOut = false;

    const onCallerAbort = () => {
      callerAborted = true;
      controller.abort();
    };

    if (signal) {
      if (signal.aborted) {
        return this.createAbortedResult(cleanDomain);
      }
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let result: WhoisResult;

    try {
      const response = await fetch(rdapUrl, {
        headers: { Accept: 'application/rdap+json, application/json' },
        signal: controller.signal,
      });

      if (response.ok) {
        try {
          const data: unknown = await response.json();
          result = this.parseRdapResponse(data, cleanDomain);
        } catch {
          result = {
            domain: cleanDomain,
            isNewDomain: false,
            error: 'RDAP_PARSE_ERROR',
            warning: 'Nepavyko apdoroti RDAP registro atsakymo.',
          };
        }
      } else if (response.status === 429) {
        result = {
          domain: cleanDomain,
          isNewDomain: false,
          error: 'HTTP_429',
          warning: 'RDAP užklausų limitas viršytas (Rate limited)',
        };
      } else if (response.status === 404) {
        result = {
          domain: cleanDomain,
          isNewDomain: false,
          error: 'HTTP_404',
          warning: 'Domenas nerastas oficialiame RDAP registre',
        };
      } else {
        result = {
          domain: cleanDomain,
          isNewDomain: false,
          error: `HTTP_${response.status}`,
          warning: `RDAP registras grąžino klaidą (HTTP ${response.status}).`,
        };
      }
    } catch (err: unknown) {
      if (callerAborted || signal?.aborted) {
        return this.createAbortedResult(cleanDomain);
      }

      if (timedOut) {
        result = {
          domain: cleanDomain,
          isNewDomain: false,
          error: 'ETIMEDOUT',
          warning: 'RDAP užklausos laikas baigėsi (Timeout).',
        };
      } else {
        const code =
          err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
            ? (err as { code: string }).code
            : 'RDAP_ERROR';
        result = {
          domain: cleanDomain,
          isNewDomain: false,
          error: code,
          warning: 'Nepavyko pasiekti oficialaus RDAP registro.',
        };
      }
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }
    }

    if (!result.registrationDate) {
      const fallback = this.getBenchmarkFallback(cleanDomain);
      if (fallback) {
        return this.toDomainSecurityInfo(fallback);
      }
    }

    return this.toDomainSecurityInfo(result);
  }
}
