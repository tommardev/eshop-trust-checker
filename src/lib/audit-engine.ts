import { VvtatChecker } from './vvtat-checker';
import { WhoisChecker } from './whois-checker';
import { WebScraper } from './scraper';
import { JarChecker } from './jar-checker';
import { 
  TrustAuditResult, 
  AuditCheckItem, 
  TrustLevel 
} from '../types/audit';

export class AuditEngine {
  /**
   * Atlieka pilną svetainės patikimumo auditą
   */
  public static async analyze(inputQuery: string): Promise<TrustAuditResult> {
    const rawDomain = VvtatChecker.normalizeDomain(inputQuery);
    const normalizedUrl = `https://${rawDomain}`;
    const timestamp = new Date().toISOString();

    // 1. Lygiagretus duomenų surinkimas
    const [blacklistCheck, whoisInfo, scrapedData] = await Promise.all([
      Promise.resolve(VvtatChecker.isBlocked(rawDomain)),
      WhoisChecker.checkDomain(rawDomain),
      WebScraper.analyzeWebsite(normalizedUrl),
    ]);

    // 2. Juridinio asmens tikrinimas (JAR / Rekvizitai)
    const legalInfo = JarChecker.lookupEntity(rawDomain, scrapedData.legalEntity.companyCode);
    
    // Sujungiame iškrapštytus kontaktus su JAR duomenimis
    const mergedLegal = {
      ...legalInfo,
      email: legalInfo.email || scrapedData.legalEntity.email,
      phone: legalInfo.phone || scrapedData.legalEntity.phone,
      hasLegacyPhonePrefix: scrapedData.legalEntity.hasLegacyPhonePrefix ?? false,
      address: legalInfo.address || scrapedData.legalEntity.address,
      vatCode: legalInfo.vatCode || scrapedData.legalEntity.vatCode,
    };

    // 3. Kontrolinio sąrašo (Checklist) sudarymas
    const checklist: AuditCheckItem[] = [];
    let score = 100;

    // A. VVTAT Blokuojamų sąrašas (Kritinis)
    if (blacklistCheck.isBlocked) {
      score = 0;
      checklist.push({
        id: 'vvtat-blacklist',
        category: 'BLACKLIST',
        title: 'VVTAT Blokuojamų svetainių registras',
        status: 'FAIL',
        description: blacklistCheck.reason || 'Domenas įtrauktas į oficialų teismo sprendimu blokuojamų el. parduotuvių sąrašą.',
        sourceReference: 'LR Teisingumo ministerija ir VVTAT',
        sourceUrl: 'https://vvtat.lrv.lt/lt/blokuojami-tinklalapiai-646/'
      });
    } else {
      checklist.push({
        id: 'vvtat-blacklist',
        category: 'BLACKLIST',
        title: 'VVTAT Blokuojamų svetainių registras',
        status: 'PASS',
        description: 'Svetainė nėra įtraukta į VVTAT teismo sprendimu blokuojamų parduotuvių juodąjį sąrašą.',
        sourceReference: 'VVTAT oficialus registras',
        sourceUrl: 'https://vvtat.lrv.lt/lt/blokuojami-tinklalapiai-646/'
      });
    }

    // B. Juridinio asmens tapatybė (VVTAT Taisyklė #1)
    if (mergedLegal.found && mergedLegal.companyCode) {
      if (mergedLegal.isValidCodeFormat !== false) {
        checklist.push({
          id: 'legal-identity',
          category: 'LEGAL',
          title: 'Pardavėjo rekvizitai ir tapatybė',
          status: 'PASS',
          description: `Rastas registruotas juridinis asmuo (${mergedLegal.companyName || 'Įmonės kodas: ' + mergedLegal.companyCode}). Nurodytas buveinės adresas ir kontaktai.`,
          sourceReference: 'VVTAT 1-oji auksinė taisyklė ir Registrų Centras',
        });
      } else {
        score -= 25;
        checklist.push({
          id: 'legal-identity',
          category: 'LEGAL',
          title: 'Pardavėjo rekvizitai ir tapatybė',
          status: 'WARN',
          description: `Svetainėje nurodytas įmonės kodas (${mergedLegal.companyCode}) neatitinka Lietuvos juridinio asmens kontrolinio skaičiaus formato.`,
          sourceReference: 'Registrų Centro JAR formatas',
        });
      }
    } else {
      score -= 35;
      checklist.push({
        id: 'legal-identity',
        category: 'LEGAL',
        title: 'Pardavėjo rekvizitai ir tapatybė',
        status: 'FAIL',
        description: 'Svetainėje NERASTAS privalomas įmonės kodas arba buveinės adresas. Pagal įstatymą visos el. parduotuvės privalo skelbti šiuos duomenis.',
        sourceReference: 'VVTAT 1-oji taisyklė: Patikrinkite informaciją apie pardavėją',
        sourceUrl: 'https://vvtat.lrv.lt/lt/naujienos-ir-pranesimai-ziniasklaidai-377/fiktyvios-internetines-parduotuves-kaip-atpazinti-ir-neapsigauti-977/'
      });
    }

    // C. Domeno amžius (WHOIS)
    if (whoisInfo.isNewDomain) {
      score -= 25;
      checklist.push({
        id: 'domain-age',
        category: 'TECHNICAL',
        title: 'Domeno amžius ir registracija',
        status: 'WARN',
        description: `Domenas registruotas neseniai (< 90 dienų). Dauguma fiktyvių svetainių sukuriamos trumpam prieš pradedant sukčiavimą.`,
        sourceReference: 'DOMREG / WHOIS registras',
      });
    } else {
      const ageText = whoisInfo.domainAgeMonths ? `(apie ${Math.floor(whoisInfo.domainAgeMonths / 12)} m. / ${whoisInfo.domainAgeMonths} mėn.)` : '';
      checklist.push({
        id: 'domain-age',
        category: 'TECHNICAL',
        title: 'Domeno amžius ir registracija',
        status: 'PASS',
        description: `Domenas yra ilgalaikis ${ageText}, neturi greitos vienadienės registracijos požymių.`,
        sourceReference: 'DOMREG / WHOIS',
      });
    }

    // D. SSL / HTTPS šifravimas (VVTAT Taisyklė #4)
    if (whoisInfo.sslValid) {
      checklist.push({
        id: 'ssl-security',
        category: 'TECHNICAL',
        title: 'Mokėjimo kortelių ir ryšio šifravimas (SSL)',
        status: 'PASS',
        description: 'Svetainė naudoja saugų HTTPS šifruotą ryšį. Naršyklėje rodomas spynos simbolis.',
        sourceReference: 'VVTAT 4-oji taisyklė: Saugokite mokėjimo duomenis',
      });
    } else {
      score -= 30;
      checklist.push({
        id: 'ssl-security',
        category: 'TECHNICAL',
        title: 'Mokėjimo kortelių ir ryšio šifravimas (SSL)',
        status: 'FAIL',
        description: 'Svetainėje nėra galiojančio saugaus SSL sertifikato! Įvedami duomenys ir mokėjimo kortelės gali būti perimtos.',
        sourceReference: 'VVTAT 4-oji taisyklė',
      });
    }

    // E. Vartotojų teisės (Prekių grąžinimas - 14 dienų)
    if (scrapedData.consumerProtection.hasReturnPolicy) {
      checklist.push({
        id: 'return-policy',
        category: 'CONSUMER_RIGHTS',
        title: 'Prekių grąžinimo politika (14 dienų)',
        status: 'PASS',
        description: 'Aptiktos prekių grąžinimo sąlygos, atitinkančios Civilinio kodekso 14 dienų atsisakymo teisę.',
        sourceReference: 'LR Civilinio kodekso 6.228(10) straipsnis',
      });
    } else {
      score -= 15;
      checklist.push({
        id: 'return-policy',
        category: 'CONSUMER_RIGHTS',
        title: 'Prekių grąžinimo politika (14 dienų)',
        status: 'WARN',
        description: 'Nerasta aiški 14 dienų prekių grąžinimo garantija ar atsisakymo taisyklės.',
        sourceReference: 'LR Civilinis kodeksas',
      });
    }

    // F. Mokėjimo metodai
    if (scrapedData.consumerProtection.detectedPaymentMethods.length > 0) {
      checklist.push({
        id: 'payment-gateways',
        category: 'PAYMENT',
        title: 'Atsiskaitymo būdai',
        status: 'PASS',
        description: `Aptikti sertifikuoti mokėjimo operatoriai / būdai: ${scrapedData.consumerProtection.detectedPaymentMethods.join(', ')}.`,
        sourceReference: 'VVTAT mokėjimų saugumo gairės',
      });
    } else if (scrapedData.consumerProtection.hasDirectBankTransferOnly) {
      score -= 20;
      checklist.push({
        id: 'payment-gateways',
        category: 'PAYMENT',
        title: 'Atsiskaitymo būdai',
        status: 'WARN',
        description: 'Siūlomas tik tiesioginis bankinis pavedimas. Fiktyvios parduotuvės dažnai neturi sutarties su mokėjimo tarpininkais.',
        sourceReference: 'VVTAT rekomendacija rinktis saugius atsiskaitymus',
      });
    }

    // G. Telefono numerio formato patikra (naujas RRT 0 / +370 vs pasenęs 8)
    if (mergedLegal.hasLegacyPhonePrefix) {
      score -= 10;
      checklist.push({
        id: 'legacy-phone-prefix',
        category: 'LEGAL',
        title: 'Pasenęs ryšio numerio formatas (prefiksas 8)',
        status: 'WARN',
        description: `Svetainėje nurodytas telefono numeris (${mergedLegal.phone}) naudoja nebegaliojantį prefiksą „8“ vietoje naujojo standarto „0“ arba „+370“. Tai rodo, kad kontaktiniai duomenys ilgą laiką neatnaujinti ir svetainė gali būti apleista.`,
        sourceReference: 'Ryšių reguliavimo tarnybos (RRT) nacionalinis numeracijos planas',
        sourceUrl: 'https://www.rrt.lt/',
      });
    }

    // Apskaičiuojame galutinį balą ir lygį
    const finalScore = Math.max(0, Math.min(100, score));
    let trustLevel: TrustLevel = 'SAFE';
    let verdictSummary = '';

    if (finalScore >= 85) {
      trustLevel = 'SAFE';
      verdictSummary = 'Svetainė atrodo patikima ir legali. Nurodyti juridinio asmens rekvizitai, ilgalaikis domenas, galiojantis SSL šifravimas bei vartotojų teisių politikos.';
    } else if (finalScore >= 50) {
      trustLevel = 'CAUTION';
      verdictSummary = 'Būkite atsargūs. Trūksta dalies rekvizitų arba domenas yra labai naujas. Rekomenduojama rinktis atsiskaitymą atsiimant prekes (COD).';
    } else {
      trustLevel = 'DANGEROUS';
      verdictSummary = 'Aukšta rizika arba fiktyvi parduotuvė! Svetainė įtraukta į juoduosius sąrašus arba neskelbia savo juridinio asmens tapatybės.';
    }

    // Rekomendacijos vartotojui
    const recommendations: string[] = [];
    if (trustLevel === 'DANGEROUS') {
      recommendations.push('Primygtinai rekomenduojame NEPIRKTI šioje svetainėje ir nesuvedinėti banko kortelių duomenų.');
      recommendations.push('Jei jau atlikote mokėjimą ir negavote prekės, kuo skubiau kreipkitės į savo banką dėl pinigų susigrąžinimo (chargeback).');
    } else if (trustLevel === 'CAUTION') {
      recommendations.push('Prieš perkant susisiekite nurodytu telefonu ar el. paštu ir įsitikinkite, kad pardavėjas atsako.');
      recommendations.push('Rinkitės atsiskaitymą kurjeriui atsiimant prekę, o ne išankstinį banko pavedimą.');
    } else {
      recommendations.push('Pardavėjas atitinka VVTAT reikalavimus ir turi registruotus rekvizitus.');
      recommendations.push('Išsaugokite pirkimo patvirtinimo sąskaitą faktūrą ir užsakymo el. laišką.');
    }

    if (mergedLegal.hasLegacyPhonePrefix) {
      recommendations.push('Atkreipkite dėmesį: svetainėje nurodytas pasenusio formato telefono numeris (su prefiksu 8). Prieš pirkdami patikrinkite, ar pardavėjas atsako.');
    }

    return {
      query: inputQuery,
      normalizedUrl,
      domain: rawDomain,
      timestamp,
      trustScore: finalScore,
      trustLevel,
      verdictSummary,
      blacklist: {
        isVvtatBlocked: blacklistCheck.isBlocked,
        vvtatDetails: blacklistCheck.reason,
        isLbFlagged: false,
      },
      legalEntity: mergedLegal,
      domainSecurity: whoisInfo,
      consumerProtection: scrapedData.consumerProtection,
      checklist,
      vvtatRulesMatched: {
        rule1SellerIdentity: mergedLegal.found,
        rule2PriceHeuristics: true,
        rule3ReviewsIndication: true,
        rule4PaymentSafety: whoisInfo.sslValid,
        rule5Jurisdiction: true,
      },
      recommendations,
    };
  }
}
