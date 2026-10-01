import tls from 'node:tls';
import { Security } from './security.ts';

export interface SslCertificateResult {
  hasValidSsl: boolean;
  sslValid: boolean;
  issuer?: string;
  validTo?: string;
  isExpired: boolean;
  daysRemaining?: number;
  protocol?: string;
  authorized: boolean;
}

export class SslChecker {
  /**
   * Patikrina domeno SSL/TLS sertifikato tikrumą, galiojimo laiką ir leidėją per TLS lizdą
   */
  public static async checkCertificate(
    domain: string,
    timeoutMs: number = 3000
  ): Promise<SslCertificateResult> {
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '').split('/')[0].split(':')[0];

    // SSRF patikra prieš atidarant lizdą
    const hostCheck = await Security.validateHostname(cleanDomain);
    if (!hostCheck.safe) {
      return {
        hasValidSsl: false,
        sslValid: false,
        isExpired: false,
        authorized: false,
      };
    }

    return new Promise((resolve) => {
      let resolved = false;

      const finish = (result: SslCertificateResult) => {
        if (!resolved) {
          resolved = true;
          try {
            socket.destroy();
          } catch {
            // ignore
          }
          resolve(result);
        }
      };

      const socket = tls.connect(
        {
          host: cleanDomain,
          port: 443,
          servername: cleanDomain,
          timeout: timeoutMs,
          rejectUnauthorized: false, // Leidžiame perskaityti net ir pasibaigusio / savarankiškai pasirašyto sertifikato duomenis
        },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            const authorized = socket.authorized;
            const protocol = socket.getProtocol() || undefined;

            if (!cert || Object.keys(cert).length === 0) {
              finish({
                hasValidSsl: false,
                sslValid: false,
                isExpired: false,
                authorized: false,
              });
              return;
            }

            const validTo = cert.valid_to;
            const validToDate = validTo ? new Date(validTo) : null;
            const now = new Date();
            const isExpired = validToDate ? validToDate.getTime() < now.getTime() : false;
            const daysRemaining = validToDate
              ? Math.floor((validToDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : undefined;

            const rawIssuer = cert.issuer ? cert.issuer.O || cert.issuer.CN : undefined;
            const issuer = Array.isArray(rawIssuer) ? rawIssuer.join(', ') : rawIssuer || 'Nežinomas leidėjas';

            const isValid = authorized && !isExpired;

            finish({
              hasValidSsl: isValid,
              sslValid: isValid,
              issuer,
              validTo: validToDate ? validToDate.toISOString() : undefined,
              isExpired,
              daysRemaining,
              protocol,
              authorized,
            });
          } catch {
            finish({
              hasValidSsl: false,
              sslValid: false,
              isExpired: false,
              authorized: false,
            });
          }
        }
      );

      socket.on('error', () => {
        finish({
          hasValidSsl: false,
          sslValid: false,
          isExpired: false,
          authorized: false,
        });
      });

      socket.on('timeout', () => {
        finish({
          hasValidSsl: false,
          sslValid: false,
          isExpired: false,
          authorized: false,
        });
      });
    });
  }
}
