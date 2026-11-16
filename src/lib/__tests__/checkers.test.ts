import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { VvtatChecker } from '../vvtat-checker.ts';
import { JarChecker } from '../jar-checker.ts';
import { Security } from '../security.ts';
import { LbChecker } from '../lb-checker.ts';
import { AuditEngine } from '../audit-engine.ts';
import { WhoisChecker } from '../whois-checker.ts';
import { SslChecker } from '../ssl-checker.ts';
import { WebScraper } from '../scraper.ts';

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

    it('should reject disallowed non-HTTP(S) protocols by returning empty string', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('ftp://example.lt'), '');
      assert.strictEqual(VvtatChecker.normalizeDomain('file:///etc/passwd'), '');
      assert.strictEqual(VvtatChecker.normalizeDomain('javascript:alert(1)'), '');
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

    it('should strip trailing dots and handle bracketed IPv6 literals', () => {
      assert.strictEqual(VvtatChecker.normalizeDomain('pigu.lt.'), 'pigu.lt');
      assert.strictEqual(VvtatChecker.normalizeDomain('http://[::1]:8080/test'), '::1');
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

  describe('defensive non-string and malformed input handling', () => {
    it('should return false without throwing for null, undefined, numbers, objects, booleans, NaN, and symbols', () => {
      const invalidInputs: unknown[] = [
        null,
        undefined,
        123456789,
        300866792,
        {},
        true,
        false,
        NaN,
        Symbol('123456789'),
      ];

      for (const input of invalidInputs) {
        assert.doesNotThrow(() => {
          assert.strictEqual(
            JarChecker.validateCompanyCodeFormat(input),
            false,
            `Expected ${String(input)} to return false`,
          );
        });
      }
    });
  });
});

describe('JarChecker.classifyStatus', () => {
  it('should classify active status strings as VEIKIANTI', () => {
    assert.strictEqual(JarChecker.classifyStatus('Veikianti'), 'VEIKIANTI');
    assert.strictEqual(JarChecker.classifyStatus('Teisinis statusas neįregistruotas'), 'VEIKIANTI');
  });

  it('should classify bankruptcy status strings as BANKRUTUOJANTI', () => {
    assert.strictEqual(JarChecker.classifyStatus('Bankrutuojanti'), 'BANKRUTUOJANTI');
    assert.strictEqual(JarChecker.classifyStatus('Bankrutavo'), 'BANKRUTUOJANTI');
  });

  it('should classify liquidation status strings as LIKVIDUOJAMA', () => {
    assert.strictEqual(JarChecker.classifyStatus('Likviduojama'), 'LIKVIDUOJAMA');
    assert.strictEqual(JarChecker.classifyStatus('Likviduojamas'), 'LIKVIDUOJAMA');
  });

  it('should classify deregistered, empty, undefined, and unknown strings as NEZINOMA', () => {
    assert.strictEqual(JarChecker.classifyStatus('Išregistruota'), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus(''), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('   '), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus(undefined), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('Nežinomas statusas'), 'NEZINOMA');
  });
});

describe('JarChecker.lookupByCode', () => {
  it('should resolve full LegalEntityInfo for active, bankrupt, and liquidated codes', () => {
    const active = JarChecker.lookupByCode('120153835');
    assert.ok(active);
    assert.strictEqual(active.found, true);
    assert.strictEqual(active.companyFound, true);
    assert.strictEqual(active.companyCode, '120153835');
    assert.strictEqual(active.companyName, 'UAB „Lietuvos monetų kalykla“');
    assert.strictEqual(active.vatCode, 'LT201538314');
    assert.strictEqual(active.hasVatCode, true);
    assert.strictEqual(active.address, 'Eigulių g. 4, LT-03150 Vilnius');
    assert.strictEqual(active.email, 'info@kalykla.lt');
    assert.strictEqual(active.phone, '+370 5 216 2616');
    assert.strictEqual(active.jarStatus, 'VEIKIANTI');
    assert.strictEqual(active.isValidCodeFormat, true);
    assert.strictEqual(active.isLithuanianOrEu, true);

    const bankrupt = JarChecker.lookupByCode('301234567');
    assert.ok(bankrupt);
    assert.strictEqual(bankrupt.found, true);
    assert.strictEqual(bankrupt.companyFound, true);
    assert.strictEqual(bankrupt.companyCode, '301234567');
    assert.strictEqual(bankrupt.companyName, 'UAB „Bankrutuojanti E-Parduotuvė“');
    assert.strictEqual(bankrupt.address, 'Kauno g. 2, Kaunas');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');
    assert.strictEqual(bankrupt.isValidCodeFormat, true);
    assert.strictEqual(bankrupt.isLithuanianOrEu, true);

    const liquidated = JarChecker.lookupByCode('302587410');
    assert.ok(liquidated);
    assert.strictEqual(liquidated.found, true);
    assert.strictEqual(liquidated.companyFound, true);
    assert.strictEqual(liquidated.companyCode, '302587410');
    assert.strictEqual(liquidated.companyName, 'UAB „Likviduojama Prekyba“');
    assert.strictEqual(liquidated.address, 'Vilniaus g. 1, Vilnius');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');
    assert.strictEqual(liquidated.isValidCodeFormat, true);
    assert.strictEqual(liquidated.isLithuanianOrEu, true);
  });

  it('should support formatted code strings with prefixes and whitespace', () => {
    const bankrupt = JarChecker.lookupByCode('LT-301234567');
    assert.ok(bankrupt);
    assert.strictEqual(bankrupt.companyCode, '301234567');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');

    const liquidated = JarChecker.lookupByCode(' 302 587 410 ');
    assert.ok(liquidated);
    assert.strictEqual(liquidated.companyCode, '302587410');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');
  });

  it('should return null for unregistered, wrong-length, or non-string inputs', () => {
    assert.strictEqual(JarChecker.lookupByCode('999999999'), null);
    assert.strictEqual(JarChecker.lookupByCode('12345'), null);
    assert.strictEqual(JarChecker.lookupByCode('1201538350'), null);
    assert.strictEqual(JarChecker.lookupByCode(''), null);
    assert.strictEqual(JarChecker.lookupByCode(null), null);
    assert.strictEqual(JarChecker.lookupByCode(undefined), null);
    assert.strictEqual(JarChecker.lookupByCode(120153835), null);
  });
});

describe('JarChecker.lookupEntity', () => {
  it('should resolve known domains from the JAR registry cache', () => {
    const kalykla = JarChecker.lookupEntity('kalykla.lt');
    assert.strictEqual(kalykla.found, true);
    assert.strictEqual(kalykla.companyCode, '120153835');
    assert.strictEqual(kalykla.jarStatus, 'VEIKIANTI');

    const maxima = JarChecker.lookupEntity('https://www.maxima.lt/akcijos');
    assert.strictEqual(maxima.found, true);
    assert.strictEqual(maxima.companyCode, '123033512');
    assert.strictEqual(maxima.companyName, 'MAXIMA LT, UAB');
    assert.strictEqual(maxima.jarStatus, 'VEIKIANTI');

    const liquidated = JarChecker.lookupEntity('likviduojama-shop.lt');
    assert.strictEqual(liquidated.found, true);
    assert.strictEqual(liquidated.companyCode, '302587410');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');

    const bankrupt = JarChecker.lookupEntity('bankrutuojanti-shop.lt');
    assert.strictEqual(bankrupt.found, true);
    assert.strictEqual(bankrupt.companyCode, '301234567');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');
  });

  it('should resolve entity by extracted code when domain is unknown or generic', () => {
    const bankrupt = JarChecker.lookupEntity('unknown-eshop.lt', '301234567');
    assert.strictEqual(bankrupt.found, true);
    assert.strictEqual(bankrupt.companyFound, true);
    assert.strictEqual(bankrupt.companyCode, '301234567');
    assert.strictEqual(bankrupt.companyName, 'UAB „Bankrutuojanti E-Parduotuvė“');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');
    assert.strictEqual(bankrupt.isValidCodeFormat, true);

    const liquidated = JarChecker.lookupEntity('unknown-eshop.lt', '302587410');
    assert.strictEqual(liquidated.found, true);
    assert.strictEqual(liquidated.companyFound, true);
    assert.strictEqual(liquidated.companyCode, '302587410');
    assert.strictEqual(liquidated.companyName, 'UAB „Likviduojama Prekyba“');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');
    assert.strictEqual(liquidated.isValidCodeFormat, true);

    const active = JarChecker.lookupEntity('unknown-eshop.lt', '120153835');
    assert.strictEqual(active.found, true);
    assert.strictEqual(active.companyFound, true);
    assert.strictEqual(active.companyCode, '120153835');
    assert.strictEqual(active.companyName, 'UAB „Lietuvos monetų kalykla“');
    assert.strictEqual(active.jarStatus, 'VEIKIANTI');
    assert.strictEqual(active.isValidCodeFormat, true);
  });

  it('should accept valid Modulo 11 code not in registry with NEZINOMA status', () => {
    const result = JarChecker.lookupEntity('unknown-eshop.lt', '200000017');
    assert.strictEqual(result.found, true);
    assert.strictEqual(result.companyFound, true);
    assert.strictEqual(result.companyCode, '200000017');
    assert.strictEqual(result.isValidCodeFormat, true);
    assert.strictEqual(result.jarStatus, 'NEZINOMA');
  });

  it('should reject unknown domain with invalid check digit code', () => {
    const result = JarChecker.lookupEntity('unknown-eshop.lt', '300866790');
    assert.strictEqual(result.found, false);
    assert.strictEqual(result.companyFound, false);
    assert.strictEqual(result.isValidCodeFormat, false);
    assert.strictEqual(result.jarStatus, 'NEZINOMA');
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

  it('should identify cloud metadata and link-local addresses as blocked', () => {
    assert.strictEqual(Security.isPrivateOrBlockedIp('169.254.169.254'), true);
  });

  it('should identify IPv4-mapped IPv6, CGNAT, and IPv6 link-local/unique-local addresses as blocked', () => {
    assert.strictEqual(Security.isPrivateOrBlockedIp('::ffff:127.0.0.1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('::ffff:10.0.0.1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('::ffff:192.168.1.1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('100.64.0.1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('fe80::1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('fc00::1'), true);
    assert.strictEqual(Security.isPrivateOrBlockedIp('fd00::1'), true);
  });

  it('should allow legitimate public IP addresses', () => {
    assert.strictEqual(Security.isPrivateOrBlockedIp('8.8.8.8'), false);
    assert.strictEqual(Security.isPrivateOrBlockedIp('1.1.1.1'), false);
    assert.strictEqual(Security.isPrivateOrBlockedIp('185.199.108.153'), false);
  });
});

describe('Security.isSafeInputTarget & Security.validateInputTarget', () => {
  it('should reject disallowed protocols', () => {
    assert.strictEqual(Security.isSafeInputTarget('ftp://example.lt').safe, false);
    assert.strictEqual(Security.isSafeInputTarget('file:///etc/passwd').safe, false);
    assert.strictEqual(Security.isSafeInputTarget('javascript:alert(1)').safe, false);
    assert.strictEqual(Security.validateInputTarget('ftp://example.lt').safe, false);
  });

  it('should reject localhost, private IPs, metadata endpoints, and IPv6 loopback', () => {
    const blockedTargets = [
      'localhost',
      'http://127.0.0.1:8080/admin',
      'https://10.0.0.1',
      'http://172.16.0.5',
      'http://192.168.1.1',
      'http://169.254.169.254/latest/meta-data/',
      '[::1]',
      'sub.localhost',
    ];

    for (const target of blockedTargets) {
      assert.strictEqual(Security.isSafeInputTarget(target).safe, false, `Expected ${target} to be rejected by isSafeInputTarget`);
      assert.strictEqual(Security.validateInputTarget(target).safe, false, `Expected ${target} to be rejected by validateInputTarget`);
    }
  });

  it('should accept valid public domains', () => {
    assert.strictEqual(Security.isSafeInputTarget('https://www.pigu.lt').safe, true);
    assert.strictEqual(Security.validateInputTarget('https://www.pigu.lt').safe, true);
    assert.strictEqual(Security.isSafeInputTarget('senukai.lt').safe, true);
  });
});

describe('LbChecker.isFlagged', () => {
  it('should flag known fraudulent/unlicensed financial domains and subdomains', () => {
    assert.strictEqual(LbChecker.isFlagged('crypto-invest.com').isFlagged, true);
    assert.strictEqual(LbChecker.isFlagged('https://quick-loan-fast.eu/login').isFlagged, true);
    assert.strictEqual(LbChecker.isFlagged('fx-profit-lt.com').isFlagged, true);
    assert.strictEqual(LbChecker.isFlagged('sub.crypto-invest.com').isFlagged, true);
  });

  it('should expose all flagged domains via getAllFlagged()', () => {
    const allFlagged = LbChecker.getAllFlagged();
    assert.ok(Array.isArray(allFlagged));
    assert.ok(allFlagged.includes('crypto-invest.com'));
    assert.ok(allFlagged.includes('fx-profit-lt.com'));
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

  function mockCleanExternalChecks(t: TestContext, scrapedCompanyCode?: string) {
    t.mock.method(WhoisChecker, 'checkDomain', async (domain: string) => ({
      domain,
      isHttps: true,
      hasValidSsl: true,
      sslValid: true,
      registrationDate: '2018-01-01T00:00:00Z',
      domainCreatedDate: '2018-01-01T00:00:00Z',
      domainAgeDays: 2500,
      domainAgeMonths: 83,
      isNewDomain: false,
    }));

    t.mock.method(SslChecker, 'checkCertificate', async () => ({
      hasValidSsl: true,
      sslValid: true,
      issuer: 'Test CA',
      validTo: '2027-01-01T00:00:00.000Z',
      isExpired: false,
      daysRemaining: 365,
      protocol: 'TLSv1.3',
      authorized: true,
    }));

    t.mock.method(WebScraper, 'analyzeWebsite', async () => ({
      legalEntity: {
        found: Boolean(scrapedCompanyCode),
        companyFound: Boolean(scrapedCompanyCode),
        companyCode: scrapedCompanyCode,
        isLithuanianOrEu: Boolean(scrapedCompanyCode),
      },
      consumerProtection: {
        hasReturnPolicy: true,
        hasPrivacyPolicy: true,
        hasContactsPage: true,
        detectedPaymentMethods: ['Paysera'],
        paymentMethodsDetected: ['Paysera'],
        hasDirectBankTransferOnly: false,
        suspiciousIndicators: [],
      },
      rawTitle: 'Test E-Shop',
    }));
  }

  it('should score active VEIKIANTI entity as 100 with PASS legal-status checklist item (mocked network)', async (t) => {
    mockCleanExternalChecks(t);

    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.legalEntity.jarStatus, 'VEIKIANTI');
    assert.strictEqual(result.trustScore, 100);
    assert.strictEqual(result.trustLevel, 'SAFE');

    const legalStatusCheck = result.checklist.find((item) => item.id === 'legal-status');
    assert.ok(legalStatusCheck);
    assert.strictEqual(legalStatusCheck.status, 'PASS');
  });

  it('should deduct exactly 40 points and flag BANKRUTUOJANTI entity as FAIL (mocked network)', async (t) => {
    mockCleanExternalChecks(t);

    const result = await AuditEngine.analyze('bankrutuojanti-shop.lt');
    assert.strictEqual(result.legalEntity.jarStatus, 'BANKRUTUOJANTI');
    assert.strictEqual(result.trustScore, 60);
    assert.strictEqual(result.trustLevel, 'CAUTION');

    const legalStatusCheck = result.checklist.find((item) => item.id === 'legal-status');
    assert.ok(legalStatusCheck);
    assert.strictEqual(legalStatusCheck.status, 'FAIL');
    assert.strictEqual(legalStatusCheck.title, 'JAR Teisinis statusas: Bankrutuojanti įmonė');

    const dangerPoint = result.recommendations.keyPoints.find(
      (kp) => kp.type === 'danger' && kp.title === 'Įmonė bankrutuoja',
    );
    assert.ok(dangerPoint);
  });

  it('should deduct exactly 25 points and flag LIKVIDUOJAMA entity as WARN (mocked network)', async (t) => {
    mockCleanExternalChecks(t);

    const result = await AuditEngine.analyze('likviduojama-shop.lt');
    assert.strictEqual(result.legalEntity.jarStatus, 'LIKVIDUOJAMA');
    assert.strictEqual(result.trustScore, 75);
    assert.strictEqual(result.trustLevel, 'CAUTION');

    const legalStatusCheck = result.checklist.find((item) => item.id === 'legal-status');
    assert.ok(legalStatusCheck);
    assert.strictEqual(legalStatusCheck.status, 'WARN');
    assert.strictEqual(legalStatusCheck.title, 'JAR Teisinis statusas: Likviduojama įmonė');

    const warningPoint = result.recommendations.keyPoints.find(
      (kp) => kp.type === 'warning' && kp.title === 'Įmonė likviduojama',
    );
    assert.ok(warningPoint);
  });

  it('should resolve unknown domain returning scraped companyCode 301234567 as BANKRUTUOJANTI via code lookup (mocked network)', async (t) => {
    mockCleanExternalChecks(t, '301234567');

    const result = await AuditEngine.analyze('unknown-eshop.lt');
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.companyCode, '301234567');
    assert.strictEqual(result.legalEntity.companyName, 'UAB „Bankrutuojanti E-Parduotuvė“');
    assert.strictEqual(result.legalEntity.jarStatus, 'BANKRUTUOJANTI');
    assert.strictEqual(result.trustScore, 60);

    const legalStatusCheck = result.checklist.find((item) => item.id === 'legal-status');
    assert.ok(legalStatusCheck);
    assert.strictEqual(legalStatusCheck.status, 'FAIL');

    const dangerPoint = result.recommendations.keyPoints.find(
      (kp) => kp.type === 'danger' && kp.title === 'Įmonė bankrutuoja',
    );
    assert.ok(dangerPoint);
  });

  it('should directly flag bankrutuojanti-shop.lt as BANKRUTUOJANTI with FAIL status and <= 60 score', async () => {
    const result = await AuditEngine.analyze('bankrutuojanti-shop.lt');
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.companyCode, '301234567');
    assert.strictEqual(result.legalEntity.jarStatus, 'BANKRUTUOJANTI');
    assert.ok(result.trustScore <= 60, `Expected score <= 60, got ${result.trustScore}`);
    assert.notStrictEqual(result.trustLevel, 'SAFE');

    const legalStatusCheck = result.checklist.find((item) => item.id === 'legal-status');
    assert.ok(legalStatusCheck);
    assert.strictEqual(legalStatusCheck.status, 'FAIL');

    const dangerPoint = result.recommendations.keyPoints.find(
      (kp) => kp.type === 'danger' && kp.title === 'Įmonė bankrutuoja',
    );
    assert.ok(dangerPoint);
  });

  it('should directly flag likviduojama-shop.lt as LIKVIDUOJAMA with WARN status and <= 75 score', async () => {
    const result = await AuditEngine.analyze('likviduojama-shop.lt');
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.companyCode, '302587410');
    assert.strictEqual(result.legalEntity.jarStatus, 'LIKVIDUOJAMA');
    assert.ok(result.trustScore <= 75, `Expected score <= 75, got ${result.trustScore}`);
    assert.notStrictEqual(result.trustLevel, 'SAFE');

    const legalStatusCheck = result.checklist.find((item) => item.id === 'legal-status');
    assert.ok(legalStatusCheck);
    assert.strictEqual(legalStatusCheck.status, 'WARN');

    const warningPoint = result.recommendations.keyPoints.find(
      (kp) => kp.type === 'warning' && kp.title === 'Įmonė likviduojama',
    );
    assert.ok(warningPoint);
  });
});
