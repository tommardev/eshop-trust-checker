import lbCache from '../data/lb-flagged-cache.json' with { type: 'json' };
import { VvtatChecker } from './vvtat-checker.ts';

export class LbChecker {
  /**
   * Žinomi Lietuvos Banko (LB) įspėjimų sąraše esantys finansinių paslaugų / apgaulingų investicijų domenai
   */
  private static lbFlaggedDomains: Set<string> = new Set(
    lbCache.domains.map((d: string) => d.toLowerCase().trim())
  );

  /**
   * Patikrina ar domenas yra Lietuvos banko nepatikimų finansų subjektų sąraše
   */
  public static isFlagged(domain: string): { isFlagged: boolean; reason?: string } {
    const normalized = VvtatChecker.normalizeDomain(domain);

    if (this.lbFlaggedDomains.has(normalized)) {
      return {
        isFlagged: true,
        reason: 'Domenas yra įtrauktas į Lietuvos banko (LB) subjektų, neturinčių teisės teikti finansines paslaugas, įspėjamąjį sąrašą.',
      };
    }

    for (const flagged of this.lbFlaggedDomains) {
      if (normalized.endsWith('.' + flagged)) {
        return {
          isFlagged: true,
          reason: `Subdomenas priklauso Lietuvos banko įspėjamajame sąraše esančiam subjektui (${flagged}).`,
        };
      }
    }

    return { isFlagged: false };
  }

  /**
   * Gauti visus šiuo metu žinomus Lietuvos banko įspėtus domenus
   */
  public static getAllFlagged(): string[] {
    return Array.from(this.lbFlaggedDomains);
  }
}
