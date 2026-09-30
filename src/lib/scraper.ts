import * as cheerio from 'cheerio';
import { LegalEntityInfo, ConsumerProtectionInfo } from '../types/audit';

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
      hasDirectBankTransferOnly: false,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EShopTrustChecker/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          legalEntity: { found: false },
          consumerProtection: defaultProtection,
          rawTitle: '',
        };
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('title').text().trim();
      const bodyText = $('body').text().replace(/\s+/g, ' ');

      // 1. Įmonės kodo paieška (9 skaitmenys)
      // Ieškome tekstų: "Įmonės kodas: 123456789", "įm. k. 123456789", "kodas: 123456789"
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

      return {
        legalEntity: {
          found: !!(companyCode || address || phone),
          companyCode,
          vatCode,
          email,
          phone,
          hasLegacyPhonePrefix,
          address,
        },
        consumerProtection: {
          hasReturnPolicy,
          hasPrivacyPolicy,
          hasContactsPage,
          detectedPaymentMethods: detectedPayments,
          hasDirectBankTransferOnly: detectedPayments.length === 0 && /bankiniu pavedimu|pavedimu į sąskaitą/i.test(bodyText),
        },
        rawTitle: title,
      };
    } catch {
      return {
        legalEntity: { found: false },
        consumerProtection: defaultProtection,
        rawTitle: '',
      };
    }
  }
}
