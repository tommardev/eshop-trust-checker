import blockedCache from '../data/vvtat-blocked-cache.json';

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
    for (const blocked of this.blockedSet) {
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
   * Sinchronizuoja sąrašą tiesiogiai iš VVTAT serverio
   */
  public static async refreshFromOfficialSource(): Promise<number> {
    try {
      const response = await fetch('https://vvtat.lrv.lt/public/canonical/1790138878/49228/blokuojami.txt', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EShopTrustChecker/1.0' },
        next: { revalidate: 3600 }
      });
      if (!response.ok) return this.blockedSet.size;

      const text = await response.text();
      const lines = text.split('\n')
        .map(l => l.trim().toLowerCase())
        .filter(l => l && !l.startsWith('#') && l.includes('.'));

      lines.forEach(domain => this.blockedSet.add(domain));
      return this.blockedSet.size;
    } catch {
      return this.blockedSet.size;
    }
  }
}
