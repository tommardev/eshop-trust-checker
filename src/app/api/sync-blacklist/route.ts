import { NextResponse } from 'next/server';
import { VvtatChecker } from '@/lib/vvtat-checker';

export const dynamic = 'force-dynamic';

export async function POST() {
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
