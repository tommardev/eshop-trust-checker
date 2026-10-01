import { VvtatChecker } from './vvtat-checker.ts';

export class LbChecker {
  /**
   * Žinomi Lietuvos Banko (LB) įspėjimų sąraše esantys finansinių paslaugų / apgaulingų investicijų domenai
   */
  private static lbFlaggedDomains: Set<string> = new Set([
    'crypto-invest.com',
    'quick-loan-fast.eu',
    'bank-secure-login.net',
  ]);

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
}
