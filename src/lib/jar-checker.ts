import type { LegalEntityInfo } from '../types/audit';

export class JarChecker {
  /**
   * Žinomų patikimų Lietuvos el. prekybos / valstybinių subjektų duomenų bazė (etalonas)
   */
  private static knownEntities: Record<string, Partial<LegalEntityInfo>> = {
    'kalykla.lt': {
      found: true,
      companyCode: '120153835',
      companyName: 'UAB „Lietuvos monetų kalykla“',
      vatCode: 'LT201538314',
      address: 'Eigulių g. 4, LT-03150 Vilnius',
      email: 'info@kalykla.lt',
      phone: '+370 5 216 2616',
      jarStatus: 'VEIKIANTI',
      isValidCodeFormat: true,
    },
    'pigu.lt': {
      found: true,
      companyCode: '300866792',
      companyName: 'UAB „Pigu“',
      vatCode: 'LT100003295815',
      address: 'Laisvės pr. 75, Vilnius',
      email: 'pagalba@pigu.lt',
      phone: '+370 661 05555',
      jarStatus: 'VEIKIANTI',
      isValidCodeFormat: true,
    },
    'senukai.lt': {
      found: true,
      companyCode: '234376520',
      companyName: 'UAB „Kesko Senukai Digital“',
      vatCode: 'LT343765219',
      address: 'Kareivių g. 11B, Vilnius',
      email: 'info@senukai.lt',
      phone: '+370 700 11119',
      jarStatus: 'VEIKIANTI',
      isValidCodeFormat: true,
    },
    'topocentras.lt': {
      found: true,
      companyCode: '134777619',
      companyName: 'UAB „Topo grupė“',
      vatCode: 'LT347776113',
      address: 'Savanorių pr. 206A, Kaunas',
      email: 'info@topocentras.lt',
      phone: '+370 700 55800',
      jarStatus: 'VEIKIANTI',
      isValidCodeFormat: true,
    }
  };

  /**
   * Tikrina Lietuvos juridinio asmens kodo (9 skaitmenų) kontrolinį skaičių pagal Modulo 11 algoritmą
   */
  public static validateCompanyCodeFormat(code: string): boolean {
    const cleaned = code.trim().replace(/\D/g, '');
    if (cleaned.length !== 9) {
      return false;
    }

    const digits = cleaned.split('').map(Number);
    const weights1 = [1, 2, 3, 4, 5, 6, 7, 8];
    let sum1 = 0;
    for (let i = 0; i < 8; i++) {
      sum1 += digits[i] * weights1[i];
    }

    let k = sum1 % 11;
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
   * Tikrina įmonės duomenis pagal domeną arba ištrauktą kodą
   */
  public static lookupEntity(domain: string, extractedCode?: string): LegalEntityInfo {
    const normDomain = domain.toLowerCase().replace(/^www\./, '');
    
    // 1. Jei tai žinomas etaloninis subjektas
    if (this.knownEntities[normDomain]) {
      return {
        found: true,
        ...this.knownEntities[normDomain]
      } as LegalEntityInfo;
    }

    // 2. Jei ištrauktas įmonės kodas iš svetainės HTML
    if (extractedCode) {
      const isValid = this.validateCompanyCodeFormat(extractedCode);
      return {
        found: true,
        companyCode: extractedCode,
        isValidCodeFormat: isValid,
        jarStatus: isValid ? 'VEIKIANTI' : 'NEZINOMA',
      };
    }

    return {
      found: false,
      isValidCodeFormat: false,
      jarStatus: 'NEZINOMA',
    };
  }
}
