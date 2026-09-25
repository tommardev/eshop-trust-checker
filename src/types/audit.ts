export type TrustLevel = 'SAFE' | 'CAUTION' | 'DANGEROUS';

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

export interface AuditCheckItem {
  id: string;
  category: 'LEGAL' | 'BLACKLIST' | 'TECHNICAL' | 'CONSUMER_RIGHTS' | 'PAYMENT';
  title: string;
  status: CheckStatus;
  description: string;
  sourceReference?: string;
  sourceUrl?: string;
}

export interface LegalEntityInfo {
  found: boolean;
  companyCode?: string;
  companyName?: string;
  vatCode?: string;
  address?: string;
  email?: string;
  phone?: string;
  jarStatus?: 'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA';
  isValidCodeFormat?: boolean;
}

export interface DomainSecurityInfo {
  domain: string;
  isHttps: boolean;
  sslValid: boolean;
  sslIssuer?: string;
  registrationDate?: string;
  domainAgeDays?: number;
  domainAgeMonths?: number;
  isNewDomain: boolean; // < 90 days
}

export interface ConsumerProtectionInfo {
  hasReturnPolicy: boolean;
  hasPrivacyPolicy: boolean;
  hasContactsPage: boolean;
  detectedPaymentMethods: string[];
  hasDirectBankTransferOnly: boolean;
}

export interface TrustAuditResult {
  query: string;
  normalizedUrl: string;
  domain: string;
  timestamp: string;
  trustScore: number; // 0 - 100
  trustLevel: TrustLevel;
  verdictSummary: string;
  
  blacklist: {
    isVvtatBlocked: boolean;
    vvtatDetails?: string;
    isLbFlagged: boolean;
    lbDetails?: string;
  };

  legalEntity: LegalEntityInfo;
  domainSecurity: DomainSecurityInfo;
  consumerProtection: ConsumerProtectionInfo;
  
  checklist: AuditCheckItem[];
  vvtatRulesMatched: {
    rule1SellerIdentity: boolean;
    rule2PriceHeuristics: boolean;
    rule3ReviewsIndication: boolean;
    rule4PaymentSafety: boolean;
    rule5Jurisdiction: boolean;
  };
  recommendations: string[];
}
