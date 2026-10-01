import blockedCache from '../data/vvtat-blocked-cache.json' with { type: 'json' };
import { Security } from './security.ts';

export class VvtatChecker {
  private static blockedSet: Set<string> = new Set(
    blockedCache.domains.map((d: string) => d.toLowerCase().trim())
  );

  /**
   * Normalizuoja domeną (pašalina protokolą, www, kelius, parametrus)
   */
  public static normalizeDomain(input: string): string {
    let cleaned = input.trim().toLowerCase();
    
    // Pašaliname protokolą
    cleaned = cleaned.replace(/^https?:\/\//i, '');
    // Pašaliname vartotojo autentifikacijos dalį
    cleaned = cleaned.replace(/^.*@/, '');
    // Pašaliname kelią ir parametrus
    cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
    // Pašaliname pradinį 'www.'
    if (cleaned.startsWith('www.')) {
      cleaned = cleaned.substring(4);
    }
    return cleaned;
  }

  /**
   * Patikrina ar domenas yra VVTAT teismo sprendimu blokuojamų svetainių sąraše
   */
  public static isBlocked(domain: string): { isBlocked: boolean; reason?: string } {
    const normalized = this.normalizeDomain(domain);
    
    if (this.blockedSet.has(normalized)) {
      return {
        isBlocked: true,
        reason: 'Įtraukta į oficialų Valstybinės vartotojų teisių apsaugos tarnybos (VVTAT) teismo sprendimu blokuojamų el. parduotuvių registrą dėl sistemingų pažeidimų.'
      };
    }

    // Tikriname subdomenų atveju (pvz. sub.domain.com)
    for (const blocked of Array.from(this.blockedSet)) {
      if (normalized.endsWith('.' + blocked)) {
        return {
          isBlocked: true,
          reason: `Subdomenas priklauso VVTAT blokuojamai svetainei (${blocked}).`
        };
      }
    }

    return { isBlocked: false };
  }

  /**
   * Gauti visus šiuo metu žinomus blokuojamus domenus
   */
  public static getAllBlocked(): string[] {
    return Array.from(this.blockedSet);
  }

  /**
   * Sinchronizuoja sąrašą tiesiogiai iš VVTAT serverio su griežtu timeout ir dydžio limitu
   */
  public static async refreshFromOfficialSource(): Promise<number> {
    try {
      const result = await Security.safeFetchText(
        'https://vvtat.lrv.lt/public/canonical/1790138878/49228/blokuojami.txt',
        { timeoutMs: 4000, maxBytes: 2 * 1024 * 1024 }
      );

      if (!result.ok || !result.text) {
        return this.blockedSet.size;
      }

      const lines = result.text
        .split('\n')
        .map(l => l.trim().toLowerCase())
        .filter(l => l && !l.startsWith('#') && l.includes('.'));

      lines.forEach(domain => this.blockedSet.add(domain));
      return this.blockedSet.size;
    } catch {
      return this.blockedSet.size;
    }
  }
}
