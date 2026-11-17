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
  companyFound?: boolean;
  companyCode?: string;
  companyName?: string;
  vatCode?: string;
  hasVatCode?: boolean;
  address?: string;
  physicalAddress?: string;
  email?: string;
  phone?: string;
  hasLegacyPhonePrefix?: boolean;
  jarStatus?: 'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA';
  isValidCodeFormat?: boolean;
  isLithuanianOrEu: boolean;
}

export interface DomainSecurityInfo {
  domain: string;
  isHttps: boolean;
  hasValidSsl: boolean;
  sslValid: boolean;
  sslIssuer?: string;
  sslValidUntil?: string;
  registrationDate?: string;
  domainCreatedDate?: string;
  domainAgeDays?: number;
  domainAgeMonths?: number;
  isNewDomain: boolean; // < 90 days / 3 months
}

export interface ConsumerProtectionInfo {
  hasReturnPolicy: boolean;
  hasPrivacyPolicy: boolean;
  hasContactsPage: boolean;
  detectedPaymentMethods: string[];
  paymentMethodsDetected: string[];
  hasDirectBankTransferOnly: boolean;
  suspiciousIndicators: string[];
}

export interface RecommendationKeyPoint {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
}

export interface StructuredRecommendations {
  verdict: string;
  keyPoints: RecommendationKeyPoint[];
  vvtatAdviceLink: string;
  list: string[];
}

export interface BlacklistStatus {
  isVvtatBlocked: boolean;
  vvtatDetails?: string;
  isLbFlagged: boolean;
  lbDetails?: string;
}

export interface VvtatRulesMatched {
  rule1SellerIdentity: boolean;
  rule2PriceHeuristics: boolean;
  rule3ReviewsIndication: boolean;
  rule4PaymentSafety: boolean;
  rule5Jurisdiction: boolean;
}

export interface TrustAuditResult {
  query: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  normalizedDomain: string;
  timestamp: string;
  trustScore: number; // 0 - 100
  trustLevel: TrustLevel;
  verdictSummary: string;
  
  blacklist: BlacklistStatus;
  blacklistStatus: BlacklistStatus;

  legalEntity: LegalEntityInfo;
  domainSecurity: DomainSecurityInfo;
  technicalSecurity: DomainSecurityInfo;
  consumerProtection: ConsumerProtectionInfo;
  
  checklist: AuditCheckItem[];
  vvtatRulesMatched: VvtatRulesMatched;
  recommendations: StructuredRecommendations;
}

export type JarEntityStatus = 'VEIKIANTI' | 'LIKVIDUOJAMA' | 'BANKRUTUOJANTI' | 'NEZINOMA';

export interface JarCacheEntity {
  companyCode: string;
  domain: string;
  companyName: string;
  jarStatus: string;
  vatCode?: string;
  address?: string;
  email?: string;
  phone?: string;
  isLithuanianOrEu?: boolean;
}

export interface JarEntitiesCache {
  lastUpdated: string;
  source: string;
  entities: JarCacheEntity[];
}
