import dns from 'node:dns/promises';
import net from 'node:net';

export class Security {
  public static readonly MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB
  public static readonly DEFAULT_TIMEOUT_MS = 4000;

  /**
   * Patikrina ar IP adresas yra privatus, ciklinis (loopback) arba debesijos metaduomenų adresas
   */
  public static isPrivateOrBlockedIp(ip: string): boolean {
    // IPv6 patikra
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
        return true;
      }
      // IPv4-mapped IPv6
      if (lower.startsWith('::ffff:')) {
        return this.isPrivateOrBlockedIp(lower.substring(7));
      }
      return false;
    }

    if (!net.isIPv4(ip)) {
      return true; // Nežinomas arba neteisingas IP formatas
    }

    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [a, b] = parts;

    // 0.0.0.0/8 (Šis tinklas)
    if (a === 0) return true;

    // 127.0.0.0/8 (Loopback / localhost)
    if (a === 127) return true;

    // 10.0.0.0/8 (Privatus tinklas Class A)
    if (a === 10) return true;

    // 172.16.0.0/12 (Privatus tinklas Class B: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Privatus tinklas Class C)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved)
    if (a >= 240) return true;

    return false;
  }

  /**
   * Patikrina ar domenas / hostas yra saugus užklausoms (SSRF prevencija)
   */
  public static async validateHostname(hostname: string): Promise<{ safe: boolean; reason?: string }> {
    const cleanHost = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');

    // Draudžiami fiksuoti vardai
    if (
      cleanHost === 'localhost' ||
      cleanHost.endsWith('.localhost') ||
      cleanHost.endsWith('.local') ||
      cleanHost.endsWith('.internal')
    ) {
      return { safe: false, reason: 'Prieiga prie vietinių ar vidinių tinklo resursų draudžiama (SSRF apsauga).' };
    }

    // Jei tiesiogiai įvestas IP adresas
    if (net.isIP(cleanHost)) {
      if (this.isPrivateOrBlockedIp(cleanHost)) {
        return { safe: false, reason: 'Prieiga prie privačių ar rezervuotų IP adresų draudžiama (SSRF apsauga).' };
      }
      return { safe: true };
    }

    try {
      const lookupResult = await dns.lookup(cleanHost, { all: true });
      for (const record of lookupResult) {
        if (this.isPrivateOrBlockedIp(record.address)) {
          return {
            safe: false,
            reason: `Domenas išsprendžiamas į privatų arba blokuojamą IP adresą (${record.address}) (SSRF apsauga).`
          };
        }
      }
      return { safe: true };
    } catch {
      return { safe: false, reason: 'Nepavyko išspręsti domeno DNS adreso.' };
    }
  }

  /**
   * Saugus HTTP GET su SSRF patikra, griežtu timeout ir dydžio ribojimu (maks. 2MB)
   */
  public static async safeFetchText(
    urlStr: string,
    options?: { timeoutMs?: number; maxBytes?: number; headers?: Record<string, string> }
  ): Promise<{ ok: boolean; status: number; text: string }> {
    const timeoutMs = options?.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
    const maxBytes = options?.maxBytes ?? this.MAX_PAYLOAD_BYTES;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlStr);
    } catch {
      return { ok: false, status: 400, text: '' };
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { ok: false, status: 400, text: '' };
    }

    const hostCheck = await this.validateHostname(parsedUrl.hostname);
    if (!hostCheck.safe) {
      return { ok: false, status: 403, text: hostCheck.reason || 'SSRF apsauga' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EShopTrustChecker/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(options?.headers || {})
        },
        signal: controller.signal
      });

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        return { ok: false, status: 413, text: 'Atsakymo dydis viršija leistiną 2MB ribą.' };
      }

      if (!response.body) {
        const text = await response.text();
        return { ok: response.ok, status: response.status, text: text.slice(0, maxBytes) };
      }

      // Streamed reading with strict size limit
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel('Atsakymo dydžio riba viršyta');
            break;
          }
          chunks.push(value);
        }
      }

      const decoder = new TextDecoder('utf-8');
      const combined = new Uint8Array(Math.min(totalBytes, maxBytes));
      let offset = 0;
      for (const chunk of chunks) {
        if (offset + chunk.byteLength > combined.length) {
          const slice = chunk.subarray(0, combined.length - offset);
          combined.set(slice, offset);
          offset += slice.byteLength;
          break;
        }
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }

      return {
        ok: response.ok,
        status: response.status,
        text: decoder.decode(combined)
      };
    } catch {
      return { ok: false, status: 504, text: '' };
    } finally {
      clearTimeout(timer);
    }
  }
}
