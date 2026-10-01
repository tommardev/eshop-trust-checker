import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VvtatChecker } from '../vvtat-checker.ts';
import { JarChecker } from '../jar-checker.ts';
import { Security } from '../security.ts';
import { LbChecker } from '../lb-checker.ts';
import { AuditEngine } from '../audit-engine.ts';

describe('VvtatChecker.normalizeDomain', () => {
  describe('protocol stripping', () => {
    it('should strip http:// protocol', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('http://example.lt'), 'example.lt');
    });

    it('should strip https:// protocol', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('https://example.lt'), 'example.lt');
    });

    it('should handle uppercase and mixed-case protocols', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('HTTPS://EXAMPLE.LT'), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('Http://Shop.Lt'), 'shop.lt');
    });
  });

  describe('prefix handling', () => {
    it('should strip leading www. from standard domains', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('www.pigu.lt'), 'pigu.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('https://www.senukai.lt'), 'senukai.lt');
    });

    it('should strip leading www. but preserve subdomains', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('www.sub.example.lt'), 'sub.example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('https://www.eshop.kalykla.lt'), 'eshop.kalykla.lt');
    });

    it('should preserve subdomains when www. is absent', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('sub.example.lt'), 'sub.example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('api.shop.lt'), 'api.shop.lt');
    });

    it('should not strip www from within domain names', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('mywwwsite.lt'), 'mywwwsite.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('awww.lt'), 'awww.lt');
    });
  });

  describe('URL components stripping (credentials, ports, paths, queries, hashes)', () => {
    it('should strip user credentials (auth)', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('user:password@domain.com'), 'domain.com');
      assert.strictEqual(VvtatChecker.normalizeDomain('https://admin:secret123@secure.shop.lt'), 'secure.shop.lt');
    });

    it('should strip port numbers', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('example.lt:8080'), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('https://example.lt:443'), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('localhost:3000'), 'localhost');
    });

    it('should strip paths and trailing slashes', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('example.lt/'), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('example.lt/shop/categories/item-123'), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('https://senukai.lt/c/statyba/5'), 'senukai.lt');
    });

    it('should strip query parameters and hash fragments', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('example.lt?ref=google&utm_source=ad'), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('example.lt#terms-and-conditions'), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('https://shop.lt/item?id=1#specs'), 'shop.lt');
    });

    it('should correctly normalize complex combined URLs', () => {
      const complexUrl = 'https://tester:secret@www.subdomain.eshop.lt:8443/products/catalog?page=2&sort=asc#results';
      assert.strictEqual(VvtatChecker.normalizeDomain(complexUrl), 'subdomain.eshop.lt');
    });
  });

  describe('whitespace and edge case handling', () => {
    it('should trim surrounding whitespace', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('   example.lt   '), 'example.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('\t\nhttps://pigu.lt\n\t'), 'pigu.lt');
    });

    it('should convert domain to lowercase', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('WWW.PIGU.LT'), 'pigu.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('HTTPS://WWW.KESCOSENUKAI.LT/PATH'), 'kescosenukai.lt');
    });

    it('should return already clean domains unmodified', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('senukai.lt'), 'senukai.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('topocentras.lt'), 'topocentras.lt');
    });
  });
});

describe('JarChecker.validateCompanyCodeFormat', () => {
  describe('valid codes (Stage 1: weights 1..8, sum1 % 11 !== 10)', () => {
    it('should validate 300866792 (UAB "Pigu" - sum1 % 11 = 2)', () => {
      // 3*1 + 0*2 + 0*3 + 8*4 + 6*5 + 6*6 + 7*7 + 9*8 = 222; 222 % 11 = 2
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('300866792'), true);
    });

    it('should validate 234376520 (UAB "Kesko Senukai Digital" - sum1 % 11 = 0)', () => {
      // 2*1 + 3*2 + 4*3 + 3*4 + 7*5 + 6*6 + 5*7 + 2*8 = 154; 154 % 11 = 0
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('234376520'), true);
    });

    it('should validate 134777619 (UAB "Topo grupė" - sum1 % 11 = 9)', () => {
      // 1*1 + 3*2 + 4*3 + 7*4 + 7*5 + 7*6 + 6*7 + 1*8 = 174; 174 % 11 = 9
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('134777619'), true);
    });

    it('should validate 123033512 (Maxima LT - sum1 % 11 = 2)', () => {
      // 1*1 + 2*2 + 3*3 + 0*4 + 3*5 + 3*6 + 5*7 + 1*8 = 90; 90 % 11 = 2
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('123033512'), true);
    });
  });

  describe('valid codes (Stage 2: sum1 % 11 === 10, sum2 % 11 !== 10)', () => {
    it('should validate 200000017 (Stage 1 remainder 10, Stage 2 remainder 7)', () => {
      // Stage 1: 2*1 + 0*2 + 0*3 + 0*4 + 0*5 + 0*6 + 0*7 + 1*8 = 10; 10 % 11 = 10
      // Stage 2: 2*3 + 0*4 + 0*5 + 0*6 + 0*7 + 0*8 + 0*9 + 1*1 = 7; 7 % 11 = 7
      // Expected check digit: 7
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('200000017'), true);
    });
  });

  describe('valid codes (Stage 2 with k2 === 10 fallback to 0)', () => {
    it('should validate 281000000 (Stage 1 remainder 10, Stage 2 remainder 10 -> check digit 0)', () => {
      // Stage 1: 2*1 + 8*2 + 1*3 + 0*4 + 0*5 + 0*6 + 0*7 + 0*8 = 21; 21 % 11 = 10
      // Stage 2: 2*3 + 8*4 + 1*5 + 0*6 + 0*7 + 0*8 + 0*9 + 0*1 = 43; 43 % 11 = 10 -> k2 becomes 0
      // Expected check digit: 0
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('281000000'), true);
    });
  });

  describe('invalid check digits', () => {
    it('should reject Stage 1 codes with incorrect check digits', () => {
      // 300866792 expected check digit 2
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('300866790'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('300866791'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('300866793'), false);

      // 234376520 expected check digit 0
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('234376521'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('234376529'), false);

      // 134777619 expected check digit 9
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('134777618'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('134777610'), false);
    });

    it('should reject Stage 2 codes with incorrect check digits', () => {
      // 200000017 expected check digit 7
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('200000016'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('200000018'), false);
    });

    it('should reject Stage 2 fallback codes with non-zero check digits', () => {
      // 281000000 expected check digit 0
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('281000001'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('281000005'), false);
    });
  });

  describe('input formatting and character sanitization', () => {
    it('should accept valid company codes with whitespace', () => {
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('  300866792  '), true);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('300 866 792'), true);
    });

    it('should accept valid company codes with hyphens or dashes', () => {
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('300-866-792'), true);
    });

    it('should accept valid company codes with non-digit prefixes (e.g. LT VAT prefix)', () => {
      // Non-digits are stripped, leaving 9 digits
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('LT300866792'), true);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('JAR: 300866792'), true);
    });
  });

  describe('length and edge case rejection', () => {
    it('should reject empty strings or whitespace-only strings', () => {
      assert.strictEqual(JarChecker.validateCompanyCodeFormat(''), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('   '), false);
    });

    it('should reject codes shorter than 9 digits', () => {
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('1'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('12345'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('30086679'), false); // 8 digits
    });

    it('should reject codes longer than 9 digits', () => {
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('3008667920'), false); // 10 digits
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('300866792123'), false); // 12 digits
    });

    it('should reject purely alphabetic or special character inputs', () => {
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('abcdefghi'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('!@#$%^&*()'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('LT-INVALID'), false);
    });
  });
});

describe('Security.isPrivateOrBlockedIp (SSRF Protection)', () => {
  it('should identify loopback addresses as blocked', () => {
    assert.strictEqual(Security.isPrivateOrBlockedIp('127.0.0.1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('127.0.1.5'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('::1'), true);
  });

  it('should identify private RFC 1918 networks as blocked', () => {
    assert.strictEqual(Security.isPrivateOrBlockedIp('10.0.0.1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('172.16.0.1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('172.31.255.254'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('192.168.1.1'), true);
  });

  it('should identify cloud metadata addresses as blocked', () => {
    assert.strictEqual(Security.isPrivateOrBlockedIp('169.254.169.254'), true);
  });

  it('should allow legitimate public IP addresses', () => {
    assert.strictEqual(Security.isPrivateOrBlockedIp('8.8.8.8'), false);
    assert.strictEqual(Security.isPrivateOrBlockedIp('1.1.1.1'), false);
    assert.strictEqual(Security.isPrivateOrBlockedIp('185.199.108.153'), false);
  });
});

describe('LbChecker.isFlagged', () => {
  it('should flag known fraudulent/unlicensed financial domains', () => {
    assert.strictEqual(LbChecker.isFlagged('crypto-invest.com').isFlagged, true);
    assert.strictEqual(LbChecker.isFlagged('https://quick-loan-fast.eu/login').isFlagged, true);
  });

  it('should not flag standard trusted e-shops', () => {
    assert.strictEqual(LbChecker.isFlagged('pigu.lt').isFlagged, false);
    assert.strictEqual(LbChecker.isFlagged('kalykla.lt').isFlagged, false);
  });
});

describe('VvtatChecker.isBlocked', () => {
  it('should flag domains known in VVTAT blacklist cache', () => {
    const blockedList = VvtatChecker.getAllBlocked();
    if (blockedList.length > 0) {
      const sampleBlocked = blockedList[0];
      assert.strictEqual(VvtatChecker.isBlocked(sampleBlocked).isBlocked, true);
      assert.strictEqual(VvtatChecker.isBlocked(`https://www.${sampleBlocked}/catalog`).isBlocked, true);
    }
  });

  it('should not flag legitimate shops', () => {
    assert.strictEqual(VvtatChecker.isBlocked('kalykla.lt').isBlocked, false);
    assert.strictEqual(VvtatChecker.isBlocked('pigu.lt').isBlocked, false);
    assert.strictEqual(VvtatChecker.isBlocked('senukai.lt').isBlocked, false);
  });
});

describe('AuditEngine.analyze', () => {
  it('should immediately set score to 0 and DANGEROUS for VVTAT blocked domains', async () => {
    const blockedList = VvtatChecker.getAllBlocked();
    if (blockedList.length > 0) {
      const blockedDomain = blockedList[0];
      const result = await AuditEngine.analyze(blockedDomain);
      assert.strictEqual(result.trustScore, 0);
      assert.strictEqual(result.trustLevel, 'DANGEROUS');
      assert.strictEqual(result.blacklist.isVvtatBlocked, true);
    }
  });

  it('should rate known trusted state enterprise (kalykla.lt) as SAFE with score >= 90', async () => {
    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.trustLevel, 'SAFE');
    assert.ok(result.trustScore >= 90, `Expected score >= 90, got ${result.trustScore}`);
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.companyCode, '120153835');
    assert.strictEqual(result.blacklist.isVvtatBlocked, false);
  });

  it('should evaluate known marketplace (pigu.lt) verifying legal entity recognition', async () => {
    const result = await AuditEngine.analyze('pigu.lt');
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.isValidCodeFormat, true);
    assert.strictEqual(result.blacklist.isVvtatBlocked, false);
  });
});
