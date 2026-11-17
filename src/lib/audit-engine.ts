import { VvtatChecker } from './vvtat-checker.ts';
import { WhoisChecker } from './whois-checker.ts';
import { WebScraper } from './scraper.ts';
import { JarChecker } from './jar-checker.ts';
import { SslChecker } from './ssl-checker.ts';
import { LbChecker } from './lb-checker.ts';
import type { 
  TrustAuditResult, 
  AuditCheckItem, 
  TrustLevel,
  RecommendationKeyPoint,
  DomainSecurityInfo,
} from '../types/audit.ts';

export class AuditEngine {
  /**
   * Atlieka pilną svetainės patikimumo auditą lygiagrečiu būdu
   */
  public static async analyze(inputQuery: string): Promise<TrustAuditResult> {
    const rawDomain = VvtatChecker.normalizeDomain(inputQuery);
    const normalizedUrl = `https://${rawDomain}`;
    const timestamp = new Date().toISOString();

    // 1. Lygiagretus duomenų surinkimas (VVTAT, LB, WHOIS, SSL, Scraping)
    const [blacklistCheck, lbCheck, whoisInfo, sslInfo, scrapedData] = await Promise.all([
      Promise.resolve(VvtatChecker.isBlocked(rawDomain)),
      Promise.resolve(LbChecker.isFlagged(rawDomain)),
      WhoisChecker.checkDomain(rawDomain),
      SslChecker.checkCertificate(rawDomain),
      WebScraper.analyzeWebsite(normalizedUrl),
    ]);

    // Apjungiame domeno ir SSL techninius duomenis
    const technicalSecurity: DomainSecurityInfo = {
      ...whoisInfo,
      isHttps: sslInfo.hasValidSsl || (sslInfo.authorized && !sslInfo.isExpired),
      hasValidSsl: sslInfo.hasValidSsl,
      sslValid: sslInfo.sslValid,
      sslIssuer: sslInfo.issuer,
      sslValidUntil: sslInfo.validTo,
      validFrom: sslInfo.validFrom,
      protocol: sslInfo.protocol,
      sslProtocol: sslInfo.protocol,
      selfSigned: Boolean(sslInfo.selfSigned),
      sslError: sslInfo.error,
      sslWarning: sslInfo.warning,
      whoisWarning: whoisInfo.whoisWarning,
      whoisError: whoisInfo.whoisError,
    };

    // 2. Juridinio asmens tikrinimas (JAR / Rekvizitai)
    const legalInfo = JarChecker.lookupEntity(rawDomain, scrapedData.legalEntity.companyCode);
    
    // Sujungiame iškrapštytus kontaktus su JAR duomenimis
    const mergedLegal = {
      ...legalInfo,
      companyCode: legalInfo.companyCode || scrapedData.legalEntity.companyCode,
      email: legalInfo.email || scrapedData.legalEntity.email,
      phone: legalInfo.phone || scrapedData.legalEntity.phone,
      hasLegacyPhonePrefix: scrapedData.legalEntity.hasLegacyPhonePrefix ?? false,
      address: legalInfo.address || scrapedData.legalEntity.address,
      physicalAddress: legalInfo.physicalAddress || scrapedData.legalEntity.address,
      vatCode: legalInfo.vatCode || scrapedData.legalEntity.vatCode,
      hasVatCode: !!(legalInfo.vatCode || scrapedData.legalEntity.vatCode),
      companyFound: legalInfo.companyFound || scrapedData.legalEntity.companyFound || false,
      isLithuanianOrEu: legalInfo.isLithuanianOrEu || scrapedData.legalEntity.isLithuanianOrEu || false,
    };

    // 3. Kontrolinio sąrašo (Checklist) sudarymas ir balų skaičiavimas
    const checklist: AuditCheckItem[] = [];
    const keyPoints: RecommendationKeyPoint[] = [];
    const recommendationList: string[] = [];
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
      keyPoints.push({
        type: 'danger',
        title: 'Kritinis pavojus: Teismo sprendimu blokuojama svetainė',
        description: 'VVTAT ir teismo sprendimu prieiga prie šio domeno Lietuvoje yra apribota dėl vartotojų teisių pažeidimų.'
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

    // B. Lietuvos Banko įspėjimų sąrašas
    if (lbCheck.isFlagged) {
      score = 0;
      checklist.push({
        id: 'lb-blacklist',
        category: 'BLACKLIST',
        title: 'Lietuvos banko įspėjimų registras',
        status: 'FAIL',
        description: lbCheck.reason || 'Domenas įtrauktas į LB nepatikimų finansinių subjektų sąrašą.',
        sourceReference: 'Lietuvos Bankas',
        sourceUrl: 'https://www.lb.lt/'
      });
      keyPoints.push({
        type: 'danger',
        title: 'Lietuvos banko įspėjimas',
        description: 'Subjektas neturi teisės teikti finansinių paslaugų Lietuvos Respublikoje.'
      });
    }

    // C. Juridinio asmens tapatybė (VVTAT Taisyklė #1)
    if (mergedLegal.companyCode) {
      if (mergedLegal.isValidCodeFormat !== false) {
        checklist.push({
          id: 'legal-identity',
          category: 'LEGAL',
          title: 'Pardavėjo rekvizitai ir tapatybė',
          status: 'PASS',
          description: `Rastas registruotas juridinis asmuo (${mergedLegal.companyName || 'Įmonės kodas: ' + mergedLegal.companyCode}). Nurodytas buveinės adresas ir kontaktai.`,
          sourceReference: 'VVTAT 1-oji auksinė taisyklė ir Registrų Centras',
        });
        if (mergedLegal.jarStatus !== 'BANKRUTUOJANTI' && mergedLegal.jarStatus !== 'LIKVIDUOJAMA') {
          keyPoints.push({
            type: 'success',
            title: 'Oficialūs pardavėjo rekvizitai rasti',
            description: `Identifikuotas juridinis asmuo su galiojančiu 9 skaitmenų JAR kodu (${mergedLegal.companyCode}).`
          });
        }
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
        keyPoints.push({
          type: 'warning',
          title: 'Neteisingas įmonės kodo formatas',
          description: `Nurodytas kodas ${mergedLegal.companyCode} neatitinka Modulo 11 kontrolinio skaitmens.`
        });
      }

      if (mergedLegal.jarStatus === 'BANKRUTUOJANTI') {
        score -= 40;
        checklist.push({
          id: 'legal-status',
          category: 'LEGAL',
          title: 'JAR Teisinis statusas: Bankrutuojanti įmonė',
          status: 'FAIL',
          description: 'Juridinių asmenų registre (JAR) nurodyta, kad šiam juridiniam asmeniui vykdomos bankroto procedūros.',
          sourceReference: 'Registrų Centras (JAR)',
        });
        keyPoints.push({
          type: 'danger',
          title: 'Įmonė bankrutuoja',
          description: 'Pardavėjo juridinis asmuo yra bankrutuojantis. Didelė rizika prarasti pinigus neatgavus prekių.',
        });
      } else if (mergedLegal.jarStatus === 'LIKVIDUOJAMA') {
        score -= 25;
        checklist.push({
          id: 'legal-status',
          category: 'LEGAL',
          title: 'JAR Teisinis statusas: Likviduojama įmonė',
          status: 'WARN',
          description: 'Juridinių asmenų registre (JAR) nurodyta, kad šis juridinis asmuo yra likvidavimo stadijoje.',
          sourceReference: 'Registrų Centras (JAR)',
        });
        keyPoints.push({
          type: 'warning',
          title: 'Įmonė likviduojama',
          description: 'Pardavėjo juridinis asmuo yra likvidavimo stadijoje.',
        });
      } else if (mergedLegal.jarStatus === 'VEIKIANTI') {
        checklist.push({
          id: 'legal-status',
          category: 'LEGAL',
          title: 'JAR Teisinis statusas: Veikianti įmonė',
          status: 'PASS',
          description: 'Juridinių asmenų registre (JAR) juridinis asmuo yra registruotas kaip oficialiai veikiantis.',
          sourceReference: 'Registrų Centras (JAR)',
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
      keyPoints.push({
        type: 'danger',
        title: 'Nėra nurodyto juridinio asmens',
        description: 'Pardavėjas neskelbia įmonės kodo ir buveinės adreso. Didelė rizika susidurti su sukčiais.'
      });
    }

    // D. Domeno amžius (WHOIS)
    if (technicalSecurity.isNewDomain) {
      score -= 25;
      checklist.push({
        id: 'domain-age',
        category: 'TECHNICAL',
        title: 'Domeno amžius ir registracija',
        status: 'WARN',
        description: `Domenas registruotas neseniai (${technicalSecurity.domainAgeDays ? technicalSecurity.domainAgeDays + ' d.' : '< 90 dienų'}). Dauguma fiktyvių svetainių sukuriamos trumpam prieš pradedant sukčiavimą.`,
        sourceReference: 'DOMREG / WHOIS registras',
      });
      keyPoints.push({
        type: 'warning',
        title: 'Naujai registruotas domenas',
        description: 'Domenas veikia mažiau nei 3 mėnesius. Būkite atsargūs atlikdami išankstinius apmokėjimus.'
      });
    } else if (technicalSecurity.whoisWarning && !technicalSecurity.domainAgeDays) {
      checklist.push({
        id: 'domain-age',
        category: 'TECHNICAL',
        title: 'Domeno amžius ir registracija',
        status: 'INFO',
        description: `Domeno registracijos datos nepavyko gauti iš RDAP/WHOIS registro (${technicalSecurity.whoisWarning}).`,
        sourceReference: 'DOMREG / WHOIS',
      });
    } else {
      const ageText = technicalSecurity.domainAgeMonths ? `(apie ${Math.floor(technicalSecurity.domainAgeMonths / 12)} m. / ${technicalSecurity.domainAgeMonths} mėn.)` : '';
      checklist.push({
        id: 'domain-age',
        category: 'TECHNICAL',
        title: 'Domeno amžius ir registracija',
        status: 'PASS',
        description: `Domenas yra ilgalaikis ${ageText}, neturi greitos vienadienės registracijos požymių.`,
        sourceReference: 'DOMREG / WHOIS',
      });
    }

    // E. SSL / HTTPS šifravimas (VVTAT Taisyklė #4)
    if (sslInfo.hasValidSsl) {
      checklist.push({
        id: 'ssl-security',
        category: 'TECHNICAL',
        title: 'Mokėjimo kortelių ir ryšio šifravimas (SSL)',
        status: 'PASS',
        description: `Svetainė naudoja saugų HTTPS šifruotą ryšį (${sslInfo.issuer || 'Sertifikuota'}${sslInfo.protocol ? ', ' + sslInfo.protocol : ''}). Naršyklėje rodomas saugaus ryšio simbolis.`,
        sourceReference: 'VVTAT 4-oji taisyklė: Saugokite mokėjimo duomenis',
      });
    } else if (sslInfo.selfSigned) {
      score -= 15;
      checklist.push({
        id: 'ssl-security',
        category: 'TECHNICAL',
        title: 'Mokėjimo kortelių ir ryšio šifravimas (SSL)',
        status: 'WARN',
        description: `Svetainė naudoja savarankiškai pasirašytą arba nepatvirtintą SSL sertifikatą (${sslInfo.issuer || 'Nežinomas leidėjas'}). Ryšys šifruotas, tačiau neatpažįstamas naršyklių kaip patikimas.`,
        sourceReference: 'VVTAT 4-oji taisyklė',
      });
      keyPoints.push({
        type: 'warning',
        title: 'Savarankiškai pasirašytas SSL sertifikatas',
        description: 'Svetainė naudoja nepatikimo leidėjo sertifikatą. Galimas duomenų perėmimo pavojus.',
      });
    } else {
      score -= 30;
      checklist.push({
        id: 'ssl-security',
        category: 'TECHNICAL',
        title: 'Mokėjimo kortelių ir ryšio šifravimas (SSL)',
        status: 'FAIL',
        description: sslInfo.warning || 'Svetainėje nėra galiojančio saugaus SSL sertifikato! Įvedami duomenys ir mokėjimo kortelės gali būti perimtos.',
        sourceReference: 'VVTAT 4-oji taisyklė',
      });
      keyPoints.push({
        type: 'danger',
        title: 'Nesaugus arba negaliojantis SSL ryšys',
        description: sslInfo.warning || 'Nesuveskite slaptažodžių ar banko kortelių duomenų neužšifruotoje svetainėje.',
      });
    }

    // F. Vartotojų teisės (Prekių grąžinimas - 14 dienų)
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
      keyPoints.push({
        type: 'warning',
        title: 'Pasigesta aiškių grąžinimo taisyklių',
        description: 'Pardavėjas nepateikia aiškios informacijos apie 14 dienų grąžinimo teisę.'
      });
    }

    // G. Mokėjimo metodai
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
      keyPoints.push({
        type: 'warning',
        title: 'Tik tiesioginis bankinis pavedimas',
        description: 'Svetainė neturi integruotų mokėjimo tarpininkų (Paysera, Montonio, Stripe ir kt.).'
      });
    }

    // H. Telefono numerio formato patikra (naujas RRT 0 / +370 vs pasenęs 8)
    if (mergedLegal.hasLegacyPhonePrefix) {
      score -= 10;
      checklist.push({
        id: 'legacy-phone-prefix',
        category: 'LEGAL',
        title: 'Pasenęs ryšio numerio formatas (prefiksas 8)',
        status: 'WARN',
        description: `Svetainėje nurodytas telefono numeris (${scrapedData.legalEntity.phone || mergedLegal.phone}) naudoja nebegaliojantį prefiksą „8“ vietoje naujojo standarto „0“ arba „+370“. Tai rodo, kad kontaktiniai duomenys ilgą laiką neatnaujinti ir svetainė gali būti apleista.`,
        sourceReference: 'Ryšių reguliavimo tarnybos (RRT) nacionalinis numeracijos planas',
        sourceUrl: 'https://www.rrt.lt/',
      });
      keyPoints.push({
        type: 'warning',
        title: 'Apleisti kontaktai (prefiksas 8)',
        description: 'Telefono numeris neatnaujintas pagal naująjį Lietuvos numeracijos standartą.'
      });
    }

    // Apskaičiuojame galutinį balą ir lygį pagal PRD.md (90-100 SAFE, 50-89 CAUTION, 0-49 DANGEROUS)
    const finalScore = Math.max(0, Math.min(100, score));
    let trustLevel: TrustLevel = 'SAFE';
    let verdictSummary = '';

    if (finalScore >= 90) {
      trustLevel = 'SAFE';
      verdictSummary = 'Svetainė atrodo patikima ir legali. Nurodyti juridinio asmens rekvizitai, ilgalaikis domenas, galiojantis SSL šifravimas bei vartotojų teisių politikos.';
      recommendationList.push('Pardavėjas atitinka VVTAT reikalavimus ir turi registruotus rekvizitus.');
      recommendationList.push('Išsaugokite pirkimo patvirtinimo sąskaitą faktūrą ir užsakymo el. laišką.');
    } else if (finalScore >= 50) {
      trustLevel = 'CAUTION';
      verdictSummary = 'Būkite atsargūs. Trūksta dalies rekvizitų arba domenas yra labai naujas. Rekomenduojama rinktis atsiskaitymą atsiimant prekes (COD).';
      recommendationList.push('Prieš perkant susisiekite nurodytu telefonu ar el. paštu ir įsitikinkite, kad pardavėjas atsako.');
      recommendationList.push('Rinkitės atsiskaitymą kurjeriui atsiimant prekę (COD), o ne išankstinį banko pavedimą.');
    } else {
      trustLevel = 'DANGEROUS';
      verdictSummary = 'Aukšta rizika arba fiktyvi parduotuvė! Svetainė įtraukta į juoduosius sąrašus arba neskelbia savo juridinio asmens tapatybės.';
      recommendationList.push('Primygtinai rekomenduojame NEPIRKTI šioje svetainėje ir nesuvedinėti banko kortelių duomenų.');
      recommendationList.push('Jei jau atlikote mokėjimą ir negavote prekės, kuo skubiau kreipkitės į savo banką dėl pinigų susigrąžinimo (chargeback).');
    }

    if (mergedLegal.hasLegacyPhonePrefix) {
      recommendationList.push('Atkreipkite dėmesį: svetainėje nurodytas pasenusio formato telefono numeris (su prefiksu 8). Prieš pirkdami patikrinkite, ar pardavėjas atsako.');
    }

    // VVTAT 5 auksinių taisyklių tikrinimas
    const vvtatRulesMatched = {
      rule1SellerIdentity: mergedLegal.found && !!mergedLegal.companyCode && mergedLegal.isValidCodeFormat !== false,
      rule2PriceHeuristics: !/99%\s*nuolaida|nemokamai\s*tik\s*šiandien/i.test(scrapedData.rawTitle),
      rule3ReviewsIndication: mergedLegal.found && scrapedData.consumerProtection.hasContactsPage,
      rule4PaymentSafety: technicalSecurity.sslValid && !scrapedData.consumerProtection.hasDirectBankTransferOnly,
      rule5Jurisdiction: mergedLegal.isLithuanianOrEu && !blacklistCheck.isBlocked && !lbCheck.isFlagged,
    };

    const blacklistStatus = {
      isVvtatBlocked: blacklistCheck.isBlocked,
      vvtatDetails: blacklistCheck.reason,
      isLbFlagged: lbCheck.isFlagged,
      lbDetails: lbCheck.reason,
    };

    return {
      query: inputQuery,
      url: normalizedUrl,
      normalizedUrl,
      domain: rawDomain,
      normalizedDomain: rawDomain,
      timestamp,
      trustScore: finalScore,
      trustLevel,
      verdictSummary,
      blacklist: blacklistStatus,
      blacklistStatus,
      legalEntity: mergedLegal,
      domainSecurity: technicalSecurity,
      technicalSecurity,
      consumerProtection: scrapedData.consumerProtection,
      checklist,
      vvtatRulesMatched,
      recommendations: {
        verdict: verdictSummary,
        keyPoints,
        vvtatAdviceLink: 'https://vvtat.lrv.lt/lt/naujienos-ir-pranesimai-ziniasklaidai-377/fiktyvios-internetines-parduotuves-kaip-atpazinti-ir-neapsigauti-977/',
        list: recommendationList,
      },
    };
  }
}
