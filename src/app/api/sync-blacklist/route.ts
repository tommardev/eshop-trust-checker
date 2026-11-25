import { NextRequest, NextResponse } from 'next/server';
import { SyncBlacklistAuth } from '@/lib/sync-blacklist-auth';
import { VvtatChecker } from '@/lib/vvtat-checker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = SyncBlacklistAuth.verify(request.headers, process.env.SYNC_BLACKLIST_SECRET);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: 'Neautorizuota užklausa. Reikalingas galiojantis sinchronizavimo raktas.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const updatedCount = await VvtatChecker.refreshFromOfficialSource();
    return NextResponse.json({
      success: true,
      message: 'VVTAT blokuojamų svetainių sąrašas sėkmingai atnaujintas.',
      totalBlockedCount: updatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Blacklist sync error:', error);
    return NextResponse.json(
      { error: 'Nepavyko atnaujinti VVTAT sąrašo iš oficialaus serverio.' },
      { status: 500 }
    );
  }
}
