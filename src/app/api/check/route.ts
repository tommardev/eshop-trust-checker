import { NextRequest, NextResponse } from 'next/server';
import { AuditEngine } from '@/lib/audit-engine';
import { VvtatChecker } from '@/lib/vvtat-checker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('domain') || searchParams.get('url') || searchParams.get('q');

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nenurodytas domenas arba el. parduotuvės URL adresas.' },
        { status: 400 }
      );
    }

    const normalized = VvtatChecker.normalizeDomain(query);
    if (!normalized || normalized.length < 3 || !normalized.includes('.')) {
      return NextResponse.json(
        { error: 'Neteisingas domeno formatas (pvz. pigu.lt ar https://senukai.lt).' },
        { status: 400 }
      );
    }

    const auditResult = await AuditEngine.analyze(query);
    return NextResponse.json({ success: true, data: auditResult });
  } catch (error) {
    console.error('Audit execution error:', error);
    return NextResponse.json(
      { error: 'Įvyko vidinė klaida atliekant el. parduotuvės auditą.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.url || body.domain || body.query;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prašome pateikti el. parduotuvės adresą (pvz., pigu.lt).' },
        { status: 400 }
      );
    }

    const normalized = VvtatChecker.normalizeDomain(query);
    if (!normalized || normalized.length < 3 || !normalized.includes('.')) {
      return NextResponse.json(
        { error: 'Neteisingas domeno formatas. Įveskite galiojantį adresą (pvz., www.kalykla.lt).' },
        { status: 400 }
      );
    }

    const auditResult = await AuditEngine.analyze(query);
    return NextResponse.json({ success: true, data: auditResult });
  } catch (error) {
    console.error('Audit execution error in POST:', error);
    return NextResponse.json(
      { error: 'Nepavyko atlikti audito. Patikrinkite ryšį arba pabandykite vėliau.' },
      { status: 500 }
    );
  }
}
