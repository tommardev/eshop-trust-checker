import * as cheerio from 'cheerio';
import type { LegalEntityInfo, ConsumerProtectionInfo } from '../types/audit.ts';
import { Security } from './security.ts';

export interface ScrapedData {
  legalEntity: Partial<LegalEntityInfo>;
  consumerProtection: ConsumerProtectionInfo;
  rawTitle: string;
  foundTextSnippet?: string;
}

export class WebScraper {
  /**
   * Nuskaito nurodytą svetainę ir ištraukia teisinius rekvizitus bei vartotojų teisių politikas
   */
  public static async analyzeWebsite(targetUrl: string): Promise<ScrapedData> {
    let url = targetUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const defaultProtection: ConsumerProtectionInfo = {
      hasReturnPolicy: false,
      hasPrivacyPolicy: false,
      hasContactsPage: false,
      detectedPaymentMethods: [],
      paymentMethodsDetected: [],
      hasDirectBankTransferOnly: false,
      suspiciousIndicators: [],
    };

    try {
      // Saugus atsisiuntimas su SSRF blokavimu, 4000ms timeout ir 2MB riba
      const fetchResult = await Security.safeFetchText(url, {
        timeoutMs: 4000,
        maxBytes: 2 * 1024 * 1024,
      });

      if (!fetchResult.ok || !fetchResult.text) {
        return {
          legalEntity: { found: false, companyFound: false, isLithuanianOrEu: false },
          consumerProtection: defaultProtection,
          rawTitle: '',
        };
      }

      const html = fetchResult.text;
      const $ = cheerio.load(html);

      const title = $('title').text().trim();
      const bodyText = $('body').text().replace(/\s+/g, ' ');

      // 1. Įmonės kodo paieška (9 skaitmenys)
      let companyCode: string | undefined;
      const codeRegex = /(?:įmonės\s*kodas|įm\.\s*k\.|kodas|company\s*code|reg\.\s*nr\.?)[:\s]+([0-9]{9})\b/i;
      const codeMatch = bodyText.match(codeRegex);
      if (codeMatch && codeMatch[1]) {
        companyCode = codeMatch[1];
      }

      // 2. PVM kodo paieška
      let vatCode: string | undefined;
      const vatRegex = /(?:PVM\s*kodas|VAT|PVM\s*mokėtojo\s*kodas)[:\s]+(LT[0-9]{9,12})\b/i;
      const vatMatch = bodyText.match(vatRegex);
      if (vatMatch && vatMatch[1]) {
        vatCode = vatMatch[1];
      }

      // 3. El. pašto paieška
      let email: string | undefined;
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i;
      const emailMatch = bodyText.match(emailRegex);
      if (emailMatch && emailMatch[1]) {
        email = emailMatch[1];
      }

      // 4. Telefono numerio paieška (+370, naujas standartas 0, arba pasenęs 8)
      let phone: string | undefined;
      let hasLegacyPhonePrefix = false;
      const allPhoneMatches = Array.from(bodyText.matchAll(/(?:(?:\+370|0|8)(?:[\s.-]?\d){8})\b/g));
      if (allPhoneMatches.length > 0) {
        const modernMatch = allPhoneMatches.find(m => m[0].startsWith('+370') || m[0].startsWith('0'));
        if (modernMatch) {
          phone = modernMatch[0].trim();
          hasLegacyPhonePrefix = false;
        } else {
          phone = allPhoneMatches[0][0].trim();
          hasLegacyPhonePrefix = true;
        }
      }

      // 5. Adreso paieška porštėje ar tekste
      let address: string | undefined;
      const addressRegex = /([A-ZĄČĘĖĮŠŲŪŽ][a-ząčęėįšųūž\s.-]+(?:g\.|gatvė|al\.|pr\.|prospektas|plentas|skg\.)\s+[0-9A-Za-z/-]+(?:,\s*[A-ZĄČĘĖĮŠŲŪŽa-ząčęėįšųūž\s]+)?)/;
      const addressMatch = bodyText.match(addressRegex);
      if (addressMatch && addressMatch[1]) {
        address = addressMatch[1].trim();
      }

      // 6. Prekių grąžinimo politikos aptikimas (VVTAT Taisyklė)
      const hasReturnPolicy = /grąžin|gražin|prekių grąžinimo|14 dien|atsisakymo teis/i.test(bodyText) ||
        $('a[href*="grazin"], a[href*="return"]').length > 0;

      // 7. Privatumo politikos aptikimas
      const hasPrivacyPolicy = /privatumo politika|asmens duomen|slapuk/i.test(bodyText) ||
        $('a[href*="privatum"], a[href*="privacy"]').length > 0;

      // 8. Kontaktų puslapio nuoroda
      const hasContactsPage = /kontakt|kontaktai|apie mus|susisiekite/i.test(bodyText) ||
        $('a[href*="kontakt"], a[href*="contact"]').length > 0;

      // 9. Mokėjimų būdų aptikimas
      const detectedPayments: string[] = [];
      const lowerHtml = html.toLowerCase();
      if (lowerHtml.includes('paysera')) detectedPayments.push('Paysera');
      if (lowerHtml.includes('montonio')) detectedPayments.push('Montonio');
      if (lowerHtml.includes('makecommerce')) detectedPayments.push('MakeCommerce');
      if (lowerHtml.includes('neopay')) detectedPayments.push('Neopay');
      if (lowerHtml.includes('stripe')) detectedPayments.push('Stripe');
      if (lowerHtml.includes('mastercard') || lowerHtml.includes('visa')) detectedPayments.push('Kortelės (Visa/Mastercard)');
      if (lowerHtml.includes('pristatymo metu') || lowerHtml.includes('kurjeriui')) detectedPayments.push('Atsiskaitymas atsiimant (COD)');

      const hasDirectBankTransferOnly = detectedPayments.length === 0 && /bankiniu pavedimu|pavedimu į sąskaitą/i.test(bodyText);

      // Įtartini rodikliai
      const suspiciousIndicators: string[] = [];
      if (!companyCode && !address) {
        suspiciousIndicators.push('Nėra nurodytų pardavėjo rekvizitų (įmonės kodo ir buveinės adreso)');
      }
      if (hasLegacyPhonePrefix) {
        suspiciousIndicators.push('Nurodytas pasenęs telefono ryšio prefiksas 8 vietoje naujojo 0 / +370');
      }
      if (hasDirectBankTransferOnly) {
        suspiciousIndicators.push('Siūlomas tik tiesioginis išankstinis bankinis pavedimas be mokėjimo tarpininkų garantijų');
      }
      if (!hasReturnPolicy) {
        suspiciousIndicators.push('Nerasta aiški 14 dienų prekių grąžinimo garantija');
      }

      const isFound = !!(companyCode || address || phone);

      return {
        legalEntity: {
          found: isFound,
          companyFound: isFound,
          companyCode,
          vatCode,
          hasVatCode: !!vatCode,
          email,
          phone,
          hasLegacyPhonePrefix,
          address,
          physicalAddress: address,
          isLithuanianOrEu: isFound,
        },
        consumerProtection: {
          hasReturnPolicy,
          hasPrivacyPolicy,
          hasContactsPage,
          detectedPaymentMethods: detectedPayments,
          paymentMethodsDetected: detectedPayments,
          hasDirectBankTransferOnly,
          suspiciousIndicators,
        },
        rawTitle: title,
      };
    } catch {
      return {
        legalEntity: { found: false, companyFound: false, isLithuanianOrEu: false },
        consumerProtection: defaultProtection,
        rawTitle: '',
      };
    }
  }
}
