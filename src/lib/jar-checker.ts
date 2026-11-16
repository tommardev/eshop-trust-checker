import jarCache from '../data/jar-entities-cache.json' with { type: 'json' };
import type {
  LegalEntityInfo,
  JarCacheEntity,
  JarEntitiesCache,
  JarEntityStatus,
} from '../types/audit.ts';

export class JarChecker {
  private static normalizeDomain(domain: unknown): string {
    if (!domain || typeof domain !== 'string') {
      return '';
    }
    return domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .split('#')[0]
      .replace(/^www\./, '');
  }

  private static cleanCompanyCode(code: unknown): string {
    if (!code || typeof code !== 'string') {
      return '';
    }
    return code.trim().replace(/\D/g, '');
  }

  private static readonly entitiesByDomain: Map<string, JarCacheEntity> = new Map(
    ((jarCache as JarEntitiesCache).entities ?? [])
      .map((entity) => [JarChecker.normalizeDomain(entity.domain), entity] as const)
      .filter(([domain]) => domain.length > 0)
  );

  private static readonly entitiesByCode: Map<string, JarCacheEntity> = new Map(
    ((jarCache as JarEntitiesCache).entities ?? [])
      .map((entity) => [JarChecker.cleanCompanyCode(entity.companyCode), entity] as const)
      .filter(([code]) => code.length === 9)
  );

  private static toLegalEntityInfo(entry: JarCacheEntity): LegalEntityInfo {
    return {
      found: true,
      companyFound: true,
      companyCode: this.cleanCompanyCode(entry.companyCode),
      companyName: entry.companyName,
      vatCode: entry.vatCode,
      hasVatCode: Boolean(entry.vatCode),
      address: entry.address,
      physicalAddress: entry.address,
      email: entry.email,
      phone: entry.phone,
      jarStatus: this.classifyStatus(entry.jarStatus),
      isValidCodeFormat: true,
      isLithuanianOrEu: entry.isLithuanianOrEu ?? true,
    };
  }

  /**
   * Tikrina Lietuvos juridinio asmens kodo (9 skaitmenų) kontrolinį skaičių pagal Modulo 11 algoritmą
   */
  public static validateCompanyCodeFormat(code: unknown): boolean {
    const cleaned = this.cleanCompanyCode(code);
    if (cleaned.length !== 9) {
      return false;
    }

    const digits = cleaned.split('').map(Number);
    const weights1 = [1, 2, 3, 4, 5, 6, 7, 8];
    let sum1 = 0;
    for (let i = 0; i < 8; i++) {
      sum1 += digits[i] * weights1[i];
    }

    const k = sum1 % 11;
    if (k !== 10) {
      return k === digits[8];
    }

    // Antrasis svorių etapas, jei liekana 10
    const weights2 = [3, 4, 5, 6, 7, 8, 9, 1];
    let sum2 = 0;
    for (let i = 0; i < 8; i++) {
      sum2 += digits[i] * weights2[i];
    }

    let k2 = sum2 % 11;
    if (k2 === 10) {
      k2 = 0;
    }

    return k2 === digits[8];
  }

  /**
   * Klasifikuoja žalią JAR teisinio statuso eilutę į standartizuotą statusą
   */
  public static classifyStatus(rawStatus?: string): JarEntityStatus {
    if (!rawStatus || typeof rawStatus !== 'string') {
      return 'NEZINOMA';
    }

    const s = rawStatus.toLowerCase().trim();
    if (!s) {
      return 'NEZINOMA';
    }

    if (s.includes('bankrut') || s.includes('bankrupt')) {
      return 'BANKRUTUOJANTI';
    }
    if (s.includes('likvid') || s.includes('liquidat')) {
      return 'LIKVIDUOJAMA';
    }
    // Tikriname išregistravimo ir neaktyvumo požymius prieš 'registruot' / 'active'
    if (
      s.includes('išregistruot') ||
      s.includes('isregistruot') ||
      s.includes('deregister') ||
      s.includes('inactive')
    ) {
      return 'NEZINOMA';
    }
    // JAR duomenyse „Teisinis statusas neįregistruotas“ reiškia aktyvų (veikiantį) juridinį asmenį
    if (
      s.includes('veikian') ||
      s.includes('neįregistruot') ||
      s.includes('neiregistruot') ||
      s.includes('registruot') ||
      s.includes('active')
    ) {
      return 'VEIKIANTI';
    }

    return 'NEZINOMA';
  }

  /**
   * Ieško juridinio asmens duomenų pagal 9 skaitmenų įmonės kodą iš lokalių JAR duomenų
   */
  public static lookupByCode(code: unknown): LegalEntityInfo | null {
    const cleaned = this.cleanCompanyCode(code);
    if (cleaned.length !== 9) {
      return null;
    }

    const entry = this.entitiesByCode.get(cleaned);
    if (!entry) {
      return null;
    }

    return this.toLegalEntityInfo(entry);
  }

  /**
   * Tikrina įmonės duomenis pagal domeną arba ištrauktą kodą
   */
  public static lookupEntity(domain: string, extractedCode?: string): LegalEntityInfo {
    const normDomain = this.normalizeDomain(domain);

    // 1. Jei tai žinomas subjektas pagal domeną iš JAR talpyklos
    if (normDomain) {
      const domainMatch = this.entitiesByDomain.get(normDomain);
      if (domainMatch) {
        return this.toLegalEntityInfo(domainMatch);
      }
    }

    // 2. Jei ištrauktas įmonės kodas iš svetainės HTML
    if (extractedCode && typeof extractedCode === 'string') {
      const codeMatch = this.lookupByCode(extractedCode);
      if (codeMatch) {
        return codeMatch;
      }

      const isValid = this.validateCompanyCodeFormat(extractedCode);
      if (isValid) {
        const cleanedCode = this.cleanCompanyCode(extractedCode);
        return {
          found: true,
          companyFound: true,
          companyCode: cleanedCode,
          isValidCodeFormat: true,
          jarStatus: 'NEZINOMA', // Be tiesioginės JAR API sesijos statusas yra nežinomas, net jei algoritmas tinka
          isLithuanianOrEu: true,
        };
      }
    }

    return {
      found: false,
      companyFound: false,
      isValidCodeFormat: false,
      jarStatus: 'NEZINOMA',
      isLithuanianOrEu: false,
    };
  }
}
