import { NextResponse } from 'next/server';
import { pingDatabase } from '@/lib/db';
import { CACHE_PROFILES } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const startedAt = performance.now();
  try {
    const dbResult = await pingDatabase();
    const totalLatencyMs = Math.round(performance.now() - startedAt);

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        totalLatencyMs,
        database: dbResult,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': CACHE_PROFILES.noStore,
        },
      }
    );
  } catch (error: any) {
    const totalLatencyMs = Math.round(performance.now() - startedAt);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        totalLatencyMs,
        error: error?.message || 'Database ping failed',
      },
      {
        status: 503,
        headers: {
          'Cache-Control': CACHE_PROFILES.noStore,
        },
      }
    );
  }
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': CACHE_PROFILES.noStore,
    },
  });
}
