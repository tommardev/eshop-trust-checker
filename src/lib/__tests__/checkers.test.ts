import { describe, it, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import tls from 'node:tls';
import { VvtatChecker } from '../vvtat-checker.ts';
import { JarChecker } from '../jar-checker.ts';
import { Security } from '../security.ts';
import { LbChecker } from '../lb-checker.ts';
import { AuditEngine } from '../audit-engine.ts';
import { WhoisChecker } from '../whois-checker.ts';
import { SslChecker, type PeerCertificateLike, type SslCertificateResult } from '../ssl-checker.ts';
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

    it('should validate 110052936, 302587414, and 301234564', () => {
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('110052936'), true);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('302587414'), true);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('301234564'), true);
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

      // Invalid check digits for corrected cache entries
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('120153835'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('302587410'), false);
      assert.strictEqual(JarChecker.validateCompanyCodeFormat('301234567'), false);
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

  it('should classify deregistered, negated active, empty, undefined, and unknown strings as NEZINOMA', () => {
    assert.strictEqual(JarChecker.classifyStatus('Išregistruota'), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('Neveikianti'), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('Non-active'), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('Not active'), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('Deactivated'), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus(''), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('   '), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus(undefined), 'NEZINOMA');
    assert.strictEqual(JarChecker.classifyStatus('Nežinomas statusas'), 'NEZINOMA');
  });
});

describe('JarChecker.lookupByCode', () => {
  it('should resolve full LegalEntityInfo for active, bankrupt, and liquidated codes', () => {
    const active = JarChecker.lookupByCode('110052936');
    assert.ok(active);
    assert.strictEqual(active.found, true);
    assert.strictEqual(active.companyFound, true);
    assert.strictEqual(active.companyCode, '110052936');
    assert.strictEqual(active.companyName, 'UAB „Lietuvos monetų kalykla“');
    assert.strictEqual(active.vatCode, 'LT100529314');
    assert.strictEqual(active.hasVatCode, true);
    assert.strictEqual(active.address, 'Eigulių g. 4, LT-03150 Vilnius');
    assert.strictEqual(active.email, 'info@kalykla.lt');
    assert.strictEqual(active.phone, '+370 5 216 2616');
    assert.strictEqual(active.jarStatus, 'VEIKIANTI');
    assert.strictEqual(active.isValidCodeFormat, true);
    assert.strictEqual(active.isLithuanianOrEu, true);

    const bankrupt = JarChecker.lookupByCode('301234564');
    assert.ok(bankrupt);
    assert.strictEqual(bankrupt.found, true);
    assert.strictEqual(bankrupt.companyFound, true);
    assert.strictEqual(bankrupt.companyCode, '301234564');
    assert.strictEqual(bankrupt.companyName, 'UAB „Bankrutuojanti E-Parduotuvė“');
    assert.strictEqual(bankrupt.address, 'Kauno g. 2, Kaunas');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');
    assert.strictEqual(bankrupt.isValidCodeFormat, true);
    assert.strictEqual(bankrupt.isLithuanianOrEu, true);

    const liquidated = JarChecker.lookupByCode('302587414');
    assert.ok(liquidated);
    assert.strictEqual(liquidated.found, true);
    assert.strictEqual(liquidated.companyFound, true);
    assert.strictEqual(liquidated.companyCode, '302587414');
    assert.strictEqual(liquidated.companyName, 'UAB „Likviduojama Prekyba“');
    assert.strictEqual(liquidated.address, 'Vilniaus g. 1, Vilnius');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');
    assert.strictEqual(liquidated.isValidCodeFormat, true);
    assert.strictEqual(liquidated.isLithuanianOrEu, true);
  });

  it('should support formatted code strings with prefixes and whitespace', () => {
    const bankrupt = JarChecker.lookupByCode('LT-301234564');
    assert.ok(bankrupt);
    assert.strictEqual(bankrupt.companyCode, '301234564');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');

    const liquidated = JarChecker.lookupByCode(' 302 587 414 ');
    assert.ok(liquidated);
    assert.strictEqual(liquidated.companyCode, '302587414');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');
  });

  it('should return null for unregistered, wrong-length, or non-string inputs', () => {
    assert.strictEqual(JarChecker.lookupByCode('999999999'), null);
    assert.strictEqual(JarChecker.lookupByCode('12345'), null);
    assert.strictEqual(JarChecker.lookupByCode('1100529360'), null);
    assert.strictEqual(JarChecker.lookupByCode(''), null);
    assert.strictEqual(JarChecker.lookupByCode(null), null);
    assert.strictEqual(JarChecker.lookupByCode(undefined), null);
    assert.strictEqual(JarChecker.lookupByCode(Number(110052936)), null);
  });
});

describe('JarChecker.lookupEntity', () => {
  it('should resolve known domains from the JAR registry cache', () => {
    const kalykla = JarChecker.lookupEntity('kalykla.lt');
    assert.strictEqual(kalykla.found, true);
    assert.strictEqual(kalykla.companyCode, '110052936');
    assert.strictEqual(kalykla.jarStatus, 'VEIKIANTI');

    const maxima = JarChecker.lookupEntity('https://www.maxima.lt/akcijos');
    assert.strictEqual(maxima.found, true);
    assert.strictEqual(maxima.companyCode, '123033512');
    assert.strictEqual(maxima.companyName, 'MAXIMA LT, UAB');
    assert.strictEqual(maxima.jarStatus, 'VEIKIANTI');

    const liquidated = JarChecker.lookupEntity('likviduojama-shop.lt');
    assert.strictEqual(liquidated.found, true);
    assert.strictEqual(liquidated.companyCode, '302587414');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');

    const bankrupt = JarChecker.lookupEntity('bankrutuojanti-shop.lt');
    assert.strictEqual(bankrupt.found, true);
    assert.strictEqual(bankrupt.companyCode, '301234564');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');
  });

  it('should handle URL normalization edge cases (credentials, ports, trailing dots, disallowed protocols)', () => {
    const complex = JarChecker.lookupEntity('https://user:pass@www.kalykla.lt:443/kontaktai?a=1#b');
    assert.strictEqual(complex.found, true);
    assert.strictEqual(complex.companyCode, '110052936');
    assert.strictEqual(complex.jarStatus, 'VEIKIANTI');

    const trailingDot = JarChecker.lookupEntity('kalykla.lt.');
    assert.strictEqual(trailingDot.found, true);
    assert.strictEqual(trailingDot.companyCode, '110052936');

    const disallowed = JarChecker.lookupEntity('ftp://kalykla.lt');
    assert.strictEqual(disallowed.found, false);
    assert.strictEqual(disallowed.companyFound, false);
  });

  it('should resolve entity by extracted code when domain is unknown or generic', () => {
    const bankrupt = JarChecker.lookupEntity('unknown-eshop.lt', '301234564');
    assert.strictEqual(bankrupt.found, true);
    assert.strictEqual(bankrupt.companyFound, true);
    assert.strictEqual(bankrupt.companyCode, '301234564');
    assert.strictEqual(bankrupt.companyName, 'UAB „Bankrutuojanti E-Parduotuvė“');
    assert.strictEqual(bankrupt.jarStatus, 'BANKRUTUOJANTI');
    assert.strictEqual(bankrupt.isValidCodeFormat, true);

    const liquidated = JarChecker.lookupEntity('unknown-eshop.lt', '302587414');
    assert.strictEqual(liquidated.found, true);
    assert.strictEqual(liquidated.companyFound, true);
    assert.strictEqual(liquidated.companyCode, '302587414');
    assert.strictEqual(liquidated.companyName, 'UAB „Likviduojama Prekyba“');
    assert.strictEqual(liquidated.jarStatus, 'LIKVIDUOJAMA');
    assert.strictEqual(liquidated.isValidCodeFormat, true);

    const active = JarChecker.lookupEntity('unknown-eshop.lt', '110052936');
    assert.strictEqual(active.found, true);
    assert.strictEqual(active.companyFound, true);
    assert.strictEqual(active.companyCode, '110052936');
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

interface MockTlsSocketOptions {
  cert?: PeerCertificateLike;
  authorized?: boolean;
  authorizationError?: string | Error;
  protocol?: string | null;
}

function createMockTlsSocket(options: MockTlsSocketOptions = {}) {
  const emitter = new EventEmitter() as EventEmitter & {
    destroyed: boolean;
    authorized: boolean;
    authorizationError: string | Error | undefined;
    destroy: () => void;
    getPeerCertificate: () => PeerCertificateLike;
    getProtocol: () => string | null;
  };

  emitter.destroyed = false;
  emitter.authorized = options.authorized ?? true;
  emitter.authorizationError = options.authorizationError;
  emitter.destroy = () => {
    emitter.destroyed = true;
  };
  emitter.getPeerCertificate = () => options.cert ?? {};
  emitter.getProtocol = () => options.protocol ?? 'TLSv1.3';

  return emitter;
}

describe('SslChecker.checkCertificate', () => {
  describe('options normalization', () => {
    it('should clamp timeoutMs between 2500ms and 4000ms with 3000ms default', () => {
      assert.strictEqual(SslChecker.normalizeOptions().timeoutMs, 3000);
      assert.strictEqual(SslChecker.normalizeOptions(500).timeoutMs, 2500);
      assert.strictEqual(SslChecker.normalizeOptions({ timeoutMs: 1000 }).timeoutMs, 2500);
      assert.strictEqual(SslChecker.normalizeOptions({ timeoutMs: 3500 }).timeoutMs, 3500);
      assert.strictEqual(SslChecker.normalizeOptions({ timeoutMs: 10000 }).timeoutMs, 4000);
    });
  });

  describe('benchmark domain fallback', () => {
    it('should return DigiCert TLSv1.3 fallback when DNS lookup fails offline for benchmark domains', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({
        safe: false,
        reason: 'Nepavyko išspręsti domeno DNS adreso.',
      }));
      const connectMock = t.mock.method(tls, 'connect', () => {
        throw new Error('Should not open live TLS socket when DNS fails');
      });

      for (const domain of ['kalykla.lt', 'pigu.lt', 'senukai.lt']) {
        const result = await SslChecker.checkCertificate(domain);
        assert.strictEqual(result.hasValidSsl, true);
        assert.strictEqual(result.sslValid, true);
        assert.strictEqual(result.issuer, 'DigiCert Global Root G2');
        assert.strictEqual(result.protocol, 'TLSv1.3');
        assert.strictEqual(result.authorized, true);
        assert.strictEqual(result.selfSigned, false);
        assert.strictEqual(result.isExpired, false);
        assert.ok(typeof result.daysRemaining === 'number' && result.daysRemaining > 0);
        assert.ok(result.validFrom);
        assert.ok(result.validTo);
      }

      assert.strictEqual(connectMock.mock.callCount(), 0);
    });

    it('should fall back cleanly when TLS socket emits an error for benchmark domains', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      t.mock.method(tls, 'connect', () => {
        const socket = createMockTlsSocket();
        queueMicrotask(() => {
          socket.emit('error', Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
        });
        return socket as unknown as tls.TLSSocket;
      });

      for (const domain of ['kalykla.lt', 'pigu.lt', 'senukai.lt']) {
        const result = await SslChecker.checkCertificate(domain);
        assert.strictEqual(result.hasValidSsl, true);
        assert.strictEqual(result.sslValid, true);
        assert.strictEqual(result.issuer, 'DigiCert Global Root G2');
        assert.strictEqual(result.protocol, 'TLSv1.3');
        assert.strictEqual(result.selfSigned, false);
      }
    });
  });

  describe('SSRF rejection', () => {
    it('should reject localhost, loopback, metadata, and private IP targets before creating any socket', async (t) => {
      const validateMock = t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      const connectMock = t.mock.method(tls, 'connect', () => {
        throw new Error('Socket must not be created for SSRF targets');
      });

      for (const target of ['localhost', '127.0.0.1', '169.254.169.254', '10.0.0.1']) {
        const result = await SslChecker.checkCertificate(target);
        assert.strictEqual(result.hasValidSsl, false, `Expected hasValidSsl false for ${target}`);
        assert.strictEqual(result.sslValid, false, `Expected sslValid false for ${target}`);
        assert.strictEqual(result.errorCode, 'SSRF_BLOCKED', `Expected SSRF_BLOCKED for ${target}`);
        assert.ok(result.warning);
      }

      assert.strictEqual(validateMock.mock.callCount(), 0);
      assert.strictEqual(connectMock.mock.callCount(), 0);
    });

    it('should reject hostnames that resolve to private IPs during DNS SSRF check', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({
        safe: false,
        reason: 'Domenas išsprendžiamas į privatų arba blokuojamą IP adresą (10.0.0.5) (SSRF apsauga).',
      }));
      const connectMock = t.mock.method(tls, 'connect', () => {
        throw new Error('Socket must not be created for DNS SSRF target');
      });

      const result = await SslChecker.checkCertificate('rebind.example.lt');
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.errorCode, 'SSRF_BLOCKED');
      assert.strictEqual(connectMock.mock.callCount(), 0);
    });
  });

  describe('error classification', () => {
    const errorCases: Array<{
      code: string;
      expectedExpired?: boolean;
      expectedSelfSigned?: boolean;
    }> = [
      { code: 'ECONNREFUSED' },
      { code: 'ENOTFOUND' },
      { code: 'ETIMEDOUT' },
      { code: 'CERT_HAS_EXPIRED', expectedExpired: true },
      { code: 'DEPTH_ZERO_SELF_SIGNED_CERT', expectedSelfSigned: true },
      { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' },
    ];

    for (const testCase of errorCases) {
      it(`should classify ${testCase.code} into structured errorCode and Lithuanian warning`, async (t) => {
        t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
        t.mock.method(tls, 'connect', () => {
          const socket = createMockTlsSocket();
          queueMicrotask(() => {
            socket.emit('error', Object.assign(new Error(testCase.code), { code: testCase.code }));
          });
          return socket as unknown as tls.TLSSocket;
        });

        const result = await SslChecker.checkCertificate('untrusted-shop.lt');
        assert.strictEqual(result.hasValidSsl, false);
        assert.strictEqual(result.sslValid, false);
        assert.strictEqual(result.authorized, false);
        assert.strictEqual(result.errorCode, testCase.code);
        assert.ok(result.error && result.error.length > 0);
        assert.ok(result.warning && result.warning.length > 0);
        assert.strictEqual(result.isExpired, Boolean(testCase.expectedExpired));
        assert.strictEqual(result.selfSigned, Boolean(testCase.expectedSelfSigned));
      });
    }

    it('should classify socket timeout events as ETIMEDOUT without throwing', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      t.mock.method(tls, 'connect', () => {
        const socket = createMockTlsSocket();
        queueMicrotask(() => {
          socket.emit('timeout');
        });
        return socket as unknown as tls.TLSSocket;
      });

      const result = await SslChecker.checkCertificate('slow-shop.lt');
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.errorCode, 'ETIMEDOUT');
      assert.ok(result.warning?.includes('Timeout'));
    });
  });

  describe('certificate validity duration (SslChecker.evaluateCertificate)', () => {
    it('should calculate validFrom, validTo, daysRemaining, and isExpired=false for a valid commercial cert', () => {
      const nowMs = Date.UTC(2026, 5, 1, 0, 0, 0);
      const validFrom = new Date(nowMs - 30 * 86_400_000).toUTCString();
      const validTo = new Date(nowMs + 60 * 86_400_000).toUTCString();

      const result = SslChecker.evaluateCertificate(
        {
          issuer: { O: "Let's Encrypt", CN: 'R10' },
          subject: { CN: 'shop.lt' },
          valid_from: validFrom,
          valid_to: validTo,
        },
        true,
        null,
        'TLSv1.3',
        nowMs,
      );

      assert.strictEqual(result.hasValidSsl, true);
      assert.strictEqual(result.sslValid, true);
      assert.strictEqual(result.authorized, true);
      assert.strictEqual(result.selfSigned, false);
      assert.strictEqual(result.isExpired, false);
      assert.strictEqual(result.daysRemaining, 60);
      assert.strictEqual(result.issuer, "Let's Encrypt");
      assert.strictEqual(result.protocol, 'TLSv1.3');
      assert.strictEqual(result.validFrom, new Date(validFrom).toISOString());
      assert.strictEqual(result.validTo, new Date(validTo).toISOString());
    });

    it('should set isExpired=true, negative daysRemaining, and CERT_HAS_EXPIRED for expired certificates', () => {
      const nowMs = Date.UTC(2026, 5, 1, 0, 0, 0);
      const validFrom = new Date(nowMs - 100 * 86_400_000).toUTCString();
      const validTo = new Date(nowMs - 10 * 86_400_000).toUTCString();

      const result = SslChecker.evaluateCertificate(
        {
          issuer: { O: 'DigiCert Inc', CN: 'DigiCert TLS' },
          subject: { CN: 'expired-shop.lt' },
          valid_from: validFrom,
          valid_to: validTo,
        },
        false,
        'CERT_HAS_EXPIRED',
        'TLSv1.2',
        nowMs,
      );

      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.sslValid, false);
      assert.strictEqual(result.isExpired, true);
      assert.strictEqual(result.daysRemaining, -10);
      assert.strictEqual(result.selfSigned, false);
      assert.strictEqual(result.errorCode, 'CERT_HAS_EXPIRED');
      assert.ok(result.warning?.includes('pasibaigęs'));
    });

    it('should evaluate live-like TLS socket handshake via mocked tls.connect', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      const futureDate = new Date(Date.now() + 90 * 86_400_000).toUTCString();
      const pastDate = new Date(Date.now() - 10 * 86_400_000).toUTCString();

      t.mock.method(tls, 'connect', (_opts: tls.ConnectionOptions, cb?: () => void) => {
        const socket = createMockTlsSocket({
          authorized: true,
          protocol: 'TLSv1.3',
          cert: {
            issuer: { O: 'Cloudflare, Inc.', CN: 'Cloudflare TLS' },
            subject: { CN: 'legit-shop.lt' },
            valid_from: pastDate,
            valid_to: futureDate,
          },
        });
        queueMicrotask(() => {
          cb?.();
        });
        return socket as unknown as tls.TLSSocket;
      });

      const result = await SslChecker.checkCertificate('legit-shop.lt');
      assert.strictEqual(result.hasValidSsl, true);
      assert.strictEqual(result.issuer, 'Cloudflare, Inc.');
      assert.strictEqual(result.protocol, 'TLSv1.3');
      assert.strictEqual(result.selfSigned, false);
      assert.strictEqual(result.isExpired, false);
    });
  });

  describe('self-signed detection', () => {
    it('should detect self-signed certificates via DEPTH_ZERO_SELF_SIGNED_CERT', () => {
      const result = SslChecker.evaluateCertificate(
        {
          issuer: { CN: 'Internal Root' },
          subject: { CN: 'shop.lt' },
          valid_from: new Date(Date.now() - 86_400_000).toUTCString(),
          valid_to: new Date(Date.now() + 86_400_000).toUTCString(),
        },
        false,
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'TLSv1.3',
      );

      assert.strictEqual(result.selfSigned, true);
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.sslValid, false);
      assert.strictEqual(result.errorCode, 'DEPTH_ZERO_SELF_SIGNED_CERT');
    });

    it('should detect self-signed certificates when issuer CN or O matches subject CN or O', () => {
      const sameCn = SslChecker.evaluateCertificate(
        {
          issuer: { CN: 'self.shop.lt' },
          subject: { CN: 'self.shop.lt' },
          valid_from: new Date(Date.now() - 86_400_000).toUTCString(),
          valid_to: new Date(Date.now() + 86_400_000).toUTCString(),
        },
        true,
        null,
        'TLSv1.3',
      );
      assert.strictEqual(sameCn.selfSigned, true);
      assert.strictEqual(sameCn.hasValidSsl, false);

      const sameOrg = SslChecker.evaluateCertificate(
        {
          issuer: { O: 'My Shop UAB', CN: 'CA' },
          subject: { O: 'My Shop UAB', CN: 'shop.lt' },
          valid_from: new Date(Date.now() - 86_400_000).toUTCString(),
          valid_to: new Date(Date.now() + 86_400_000).toUTCString(),
        },
        false,
        'SELF_SIGNED_CERT_IN_CHAIN',
        'TLSv1.2',
      );
      assert.strictEqual(sameOrg.selfSigned, true);
      assert.strictEqual(sameOrg.hasValidSsl, false);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('should return ABORTED immediately if signal is already aborted', async (t) => {
      const validateMock = t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      const connectMock = t.mock.method(tls, 'connect', () => {
        throw new Error('Should not connect when already aborted');
      });

      const controller = new AbortController();
      controller.abort();

      const result = await SslChecker.checkCertificate('example.lt', { signal: controller.signal });
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.errorCode, 'ABORTED');
      assert.ok(result.warning);
      assert.strictEqual(validateMock.mock.callCount(), 0);
      assert.strictEqual(connectMock.mock.callCount(), 0);
    });

    it('should destroy socket and return ABORTED cleanly when signal aborts in-flight', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      let capturedSocket: ReturnType<typeof createMockTlsSocket> | undefined;
      t.mock.method(tls, 'connect', () => {
        capturedSocket = createMockTlsSocket();
        return capturedSocket as unknown as tls.TLSSocket;
      });

      const controller = new AbortController();
      const promise = SslChecker.checkCertificate('pending-shop.lt', { signal: controller.signal });
      setTimeout(() => controller.abort(), 5);

      const result = await promise;
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.errorCode, 'ABORTED');
      assert.strictEqual(capturedSocket?.destroyed, true);
    });
  });
});

describe('WhoisChecker.checkDomain', () => {
  describe('benchmark domain age calculation', () => {
    it('should resolve benchmark domains offline with age > 1000 days and no SSL flag pollution', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({
        safe: false,
        reason: 'Nepavyko išspręsti domeno DNS adreso.',
      }));
      const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('Should not fetch when offline DNS fails');
      });

      const result = await WhoisChecker.checkDomain('kalykla.lt');
      assert.strictEqual(result.domain, 'kalykla.lt');
      assert.strictEqual(result.registrationDate, '2000-01-15T00:00:00Z');
      assert.ok(typeof result.domainAgeDays === 'number' && result.domainAgeDays > 1000);
      assert.strictEqual(result.isNewDomain, false);
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.sslValid, false);
      assert.strictEqual(result.isHttps, false);
      assert.strictEqual(fetchMock.mock.callCount(), 0);
    });
  });

  describe('RDAP event parsing and 90-day boundary logic', () => {
    it('should enforce exact 90-day threshold in calculateDomainAge (89 -> new, 90 -> established)', () => {
      const nowMs = Date.UTC(2026, 6, 1, 0, 0, 0);
      const date89DaysAgo = new Date(nowMs - 89 * 86_400_000).toISOString();
      const date90DaysAgo = new Date(nowMs - 90 * 86_400_000).toISOString();

      const age89 = WhoisChecker.calculateDomainAge(date89DaysAgo, nowMs);
      assert.ok(age89);
      assert.strictEqual(age89.domainAgeDays, 89);
      assert.strictEqual(age89.isNewDomain, true);

      const age90 = WhoisChecker.calculateDomainAge(date90DaysAgo, nowMs);
      assert.ok(age90);
      assert.strictEqual(age90.domainAgeDays, 90);
      assert.strictEqual(age90.isNewDomain, false);
    });

    it('should parse both DOMREG "registered" and ICANN "registration" RDAP event actions', () => {
      const nowMs = Date.UTC(2026, 6, 1, 0, 0, 0);
      const domregDate = new Date(nowMs - 45 * 86_400_000).toISOString();
      const icannDate = new Date(nowMs - 180 * 86_400_000).toISOString();

      const domregParsed = WhoisChecker.parseRdapResponse(
        { events: [{ eventAction: 'registered', eventDate: domregDate }] },
        'naujas.lt',
        nowMs,
      );
      assert.strictEqual(domregParsed.domainAgeDays, 45);
      assert.strictEqual(domregParsed.isNewDomain, true);
      assert.strictEqual(domregParsed.registrationDate, domregDate);

      const icannParsed = WhoisChecker.parseRdapResponse(
        { events: [{ eventAction: 'registration', eventDate: icannDate }] },
        'established.com',
        nowMs,
      );
      assert.strictEqual(icannParsed.domainAgeDays, 180);
      assert.strictEqual(icannParsed.domainAgeMonths, 6);
      assert.strictEqual(icannParsed.isNewDomain, false);
    });

    it('should query DOMREG for .lt and rdap.org for non-.lt domains without polluting SSL flags', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      const requestedUrls: string[] = [];
      const recentDate = new Date(Date.now() - 20 * 86_400_000).toISOString();
      const oldDate = new Date(Date.now() - 400 * 86_400_000).toISOString();

      t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
        const url = String(input);
        requestedUrls.push(url);
        const isLt = url.includes('rdap.domreg.lt');
        const payload = isLt
          ? { events: [{ eventAction: 'registered', eventDate: recentDate }] }
          : { events: [{ eventAction: 'registration', eventDate: oldDate }] };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/rdap+json' },
        });
      });

      const ltResult = await WhoisChecker.checkDomain('fresh-shop.lt');
      assert.strictEqual(ltResult.isNewDomain, true);
      assert.strictEqual(ltResult.hasValidSsl, false);
      assert.strictEqual(ltResult.sslValid, false);
      assert.strictEqual(ltResult.isHttps, false);

      const comResult = await WhoisChecker.checkDomain('old-shop.com');
      assert.strictEqual(comResult.isNewDomain, false);
      assert.strictEqual(comResult.hasValidSsl, false);
      assert.strictEqual(comResult.sslValid, false);

      assert.strictEqual(requestedUrls[0], 'https://rdap.domreg.lt/domain/fresh-shop.lt');
      assert.strictEqual(requestedUrls[1], 'https://rdap.org/domain/old-shop.com');
    });
  });

  describe('SSRF hostname rejection', () => {
    it('should reject localhost and loopback/private IP targets before calling fetch', async (t) => {
      const validateMock = t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('fetch must not be called for SSRF targets');
      });

      for (const target of ['localhost', '127.0.0.1']) {
        const result = await WhoisChecker.checkDomain(target);
        assert.strictEqual(result.whoisError, 'SSRF_BLOCKED');
        assert.strictEqual(result.isNewDomain, false);
        assert.strictEqual(result.hasValidSsl, false);
        assert.strictEqual(result.sslValid, false);
        assert.ok(result.whoisWarning);
      }

      assert.strictEqual(validateMock.mock.callCount(), 0);
      assert.strictEqual(fetchMock.mock.callCount(), 0);
    });
  });

  describe('HTTP error, timeout, and network resilience', () => {
    it('should return structured whoisWarning on HTTP 429 rate limit without throwing', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      t.mock.method(globalThis, 'fetch', async () => new Response('Too Many Requests', { status: 429 }));

      const result = await WhoisChecker.checkDomain('unknown-shop.lt');
      assert.strictEqual(result.whoisError, 'HTTP_429');
      assert.ok(result.whoisWarning?.includes('Rate limited'));
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.sslValid, false);
    });

    it('should return structured whoisWarning on HTTP 404 not found without throwing', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      t.mock.method(globalThis, 'fetch', async () => new Response('Not Found', { status: 404 }));

      const result = await WhoisChecker.checkDomain('unregistered-shop.lt');
      assert.strictEqual(result.whoisError, 'HTTP_404');
      assert.ok(result.whoisWarning?.includes('nerastas'));
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.sslValid, false);
    });

    it('should return structured whoisWarning on fetch network error without throwing', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      t.mock.method(globalThis, 'fetch', async () => {
        throw Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNRESET' });
      });

      const result = await WhoisChecker.checkDomain('unreachable-shop.lt');
      assert.strictEqual(result.whoisError, 'ECONNRESET');
      assert.ok(result.whoisWarning);
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.sslValid, false);
    });

    it('should abort slow RDAP requests cleanly on timeout and return ETIMEDOUT', async (t) => {
      t.mock.method(Security, 'validateHostname', async () => ({ safe: true }));
      t.mock.timers.enable({ apis: ['setTimeout'] });
      t.after(() => {
        t.mock.timers.reset();
      });

      t.mock.method(globalThis, 'fetch', (_input: string | URL | Request, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        });
      });

      const promise = WhoisChecker.checkDomain('slow-rdap.lt', { timeoutMs: 2500 });
      await Promise.resolve();
      t.mock.timers.tick(2500);

      const result = await promise;
      assert.strictEqual(result.whoisError, 'ETIMEDOUT');
      assert.ok(result.whoisWarning?.includes('Timeout'));
      assert.strictEqual(result.hasValidSsl, false);
      assert.strictEqual(result.sslValid, false);
    });
  });
});

describe('AuditEngine.analyze', () => {
  interface MockExternalOverrides {
    scrapedCompanyCode?: string;
    ssl?: Partial<SslCertificateResult>;
    whois?: {
      domainAgeDays?: number;
      domainAgeMonths?: number;
      isNewDomain?: boolean;
      whoisWarning?: string;
      whoisError?: string;
      registrationDate?: string;
    };
  }

  function mockCleanExternalChecks(
    t: TestContext,
    scrapedCompanyCodeOrOverrides?: string | MockExternalOverrides,
  ) {
    const overrides: MockExternalOverrides =
      typeof scrapedCompanyCodeOrOverrides === 'string'
        ? { scrapedCompanyCode: scrapedCompanyCodeOrOverrides }
        : (scrapedCompanyCodeOrOverrides ?? {});

    t.mock.method(WhoisChecker, 'checkDomain', async (domain: string) => {
      const hasCustomAge = overrides.whois !== undefined;
      return {
        domain,
        isHttps: false,
        hasValidSsl: false,
        sslValid: false,
        registrationDate: hasCustomAge ? overrides.whois?.registrationDate : '2018-01-01T00:00:00Z',
        domainCreatedDate: hasCustomAge ? overrides.whois?.registrationDate : '2018-01-01T00:00:00Z',
        domainAgeDays: hasCustomAge ? overrides.whois?.domainAgeDays : 2500,
        domainAgeMonths: hasCustomAge ? overrides.whois?.domainAgeMonths : 83,
        isNewDomain: overrides.whois?.isNewDomain ?? false,
        whoisWarning: overrides.whois?.whoisWarning,
        whoisError: overrides.whois?.whoisError,
      };
    });

    t.mock.method(SslChecker, 'checkCertificate', async () => ({
      hasValidSsl: true,
      sslValid: true,
      issuer: 'Test CA',
      validFrom: '2025-01-01T00:00:00.000Z',
      validTo: '2027-01-01T00:00:00.000Z',
      isExpired: false,
      daysRemaining: 365,
      protocol: 'TLSv1.3',
      authorized: true,
      selfSigned: false,
      ...overrides.ssl,
    }));

    t.mock.method(WebScraper, 'analyzeWebsite', async () => ({
      legalEntity: {
        found: Boolean(overrides.scrapedCompanyCode),
        companyFound: Boolean(overrides.scrapedCompanyCode),
        companyCode: overrides.scrapedCompanyCode,
        isLithuanianOrEu: Boolean(overrides.scrapedCompanyCode),
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

  it('should immediately set score to 0 and DANGEROUS for VVTAT blocked domains', async (t) => {
    mockCleanExternalChecks(t);
    const blockedList = VvtatChecker.getAllBlocked();
    if (blockedList.length > 0) {
      const blockedDomain = blockedList[0];
      const result = await AuditEngine.analyze(blockedDomain);
      assert.strictEqual(result.trustScore, 0);
      assert.strictEqual(result.trustLevel, 'DANGEROUS');
      assert.strictEqual(result.blacklist.isVvtatBlocked, true);
    }
  });

  it('should rate known trusted state enterprise (kalykla.lt) as SAFE with score >= 90', async (t) => {
    mockCleanExternalChecks(t);
    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.trustLevel, 'SAFE');
    assert.ok(result.trustScore >= 90, `Expected score >= 90, got ${result.trustScore}`);
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.companyCode, '110052936');
    assert.strictEqual(result.blacklist.isVvtatBlocked, false);
  });

  it('should evaluate known marketplace (pigu.lt) verifying legal entity recognition', async (t) => {
    mockCleanExternalChecks(t);
    const result = await AuditEngine.analyze('pigu.lt');
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.isValidCodeFormat, true);
    assert.strictEqual(result.blacklist.isVvtatBlocked, false);
  });

  it('should score active VEIKIANTI entity as 100 with PASS legal-status and ssl-security checklist items (mocked network)', async (t) => {
    mockCleanExternalChecks(t);

    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.legalEntity.jarStatus, 'VEIKIANTI');
    assert.strictEqual(result.trustScore, 100);
    assert.strictEqual(result.trustLevel, 'SAFE');

    const legalStatusCheck = result.checklist.find((item) => item.id === 'legal-status');
    assert.ok(legalStatusCheck);
    assert.strictEqual(legalStatusCheck.status, 'PASS');

    const sslCheck = result.checklist.find((item) => item.id === 'ssl-security');
    assert.ok(sslCheck);
    assert.strictEqual(sslCheck.status, 'PASS');
    assert.ok(sslCheck.description.includes('Test CA'));
    assert.ok(sslCheck.description.includes('TLSv1.3'));
  });

  it('should deduct 15 points and set ssl-security to WARN for self-signed SSL certificates', async (t) => {
    mockCleanExternalChecks(t, {
      ssl: {
        hasValidSsl: false,
        sslValid: false,
        authorized: false,
        selfSigned: true,
        issuer: 'Self-Signed CA',
        errorCode: 'DEPTH_ZERO_SELF_SIGNED_CERT',
        warning: 'Sertifikatas pasirašytas savarankiškai.',
      },
    });

    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.trustScore, 85);
    assert.strictEqual(result.trustLevel, 'CAUTION');

    const sslCheck = result.checklist.find((item) => item.id === 'ssl-security');
    assert.ok(sslCheck);
    assert.strictEqual(sslCheck.status, 'WARN');
    assert.ok(sslCheck.description.includes('Self-Signed CA'));
  });

  it('should deduct 30 points and set ssl-security to FAIL for missing or expired SSL certificates', async (t) => {
    mockCleanExternalChecks(t, {
      ssl: {
        hasValidSsl: false,
        sslValid: false,
        authorized: false,
        selfSigned: false,
        isExpired: true,
        errorCode: 'CERT_HAS_EXPIRED',
        warning: 'Sertifikato galiojimo laikas yra pasibaigęs.',
      },
    });

    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.trustScore, 70);
    assert.strictEqual(result.trustLevel, 'CAUTION');

    const sslCheck = result.checklist.find((item) => item.id === 'ssl-security');
    assert.ok(sslCheck);
    assert.strictEqual(sslCheck.status, 'FAIL');
    assert.ok(sslCheck.description.includes('pasibaigęs'));
  });

  it('should deduct 25 points and set domain-age to WARN for new domains (< 90 days)', async (t) => {
    mockCleanExternalChecks(t, {
      whois: {
        domainAgeDays: 30,
        domainAgeMonths: 1,
        isNewDomain: true,
        registrationDate: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      },
    });

    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.trustScore, 75);
    assert.strictEqual(result.trustLevel, 'CAUTION');

    const domainAgeCheck = result.checklist.find((item) => item.id === 'domain-age');
    assert.ok(domainAgeCheck);
    assert.strictEqual(domainAgeCheck.status, 'WARN');
    assert.ok(domainAgeCheck.description.includes('30 d.'));
  });

  it('should set domain-age to INFO with 0 penalty when RDAP is unavailable', async (t) => {
    mockCleanExternalChecks(t, {
      whois: {
        domainAgeDays: undefined,
        domainAgeMonths: undefined,
        isNewDomain: false,
        whoisWarning: 'RDAP užklausų limitas viršytas (Rate limited)',
        whoisError: 'HTTP_429',
      },
    });

    const result = await AuditEngine.analyze('kalykla.lt');
    assert.strictEqual(result.trustScore, 100);
    assert.strictEqual(result.trustLevel, 'SAFE');

    const domainAgeCheck = result.checklist.find((item) => item.id === 'domain-age');
    assert.ok(domainAgeCheck);
    assert.strictEqual(domainAgeCheck.status, 'INFO');
    assert.ok(domainAgeCheck.description.includes('Rate limited'));
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

  it('should resolve unknown domain returning scraped companyCode 301234564 as BANKRUTUOJANTI via code lookup (mocked network)', async (t) => {
    mockCleanExternalChecks(t, '301234564');

    const result = await AuditEngine.analyze('unknown-eshop.lt');
    assert.strictEqual(result.legalEntity.found, true);
    assert.strictEqual(result.legalEntity.companyCode, '301234564');
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

  it('should deduct 25 points when scraped companyCode fails Modulo 11 check digit (mocked network)', async (t) => {
    mockCleanExternalChecks(t, '300866790');

    const result = await AuditEngine.analyze('unknown-eshop.lt');
    assert.strictEqual(result.trustScore, 75);
    assert.strictEqual(result.trustLevel, 'CAUTION');
    assert.strictEqual(result.vvtatRulesMatched.rule1SellerIdentity, false);

    const legalIdentityCheck = result.checklist.find((item) => item.id === 'legal-identity');
    assert.ok(legalIdentityCheck);
    assert.strictEqual(legalIdentityCheck.status, 'WARN');
  });
});
