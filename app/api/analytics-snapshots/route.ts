import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest, createAuthenticatedClient } from '@/lib/auth-server';
import {
  useStorytellerLocalStore,
  listByUserLocal,
  listByUserSupabase,
} from '@/lib/storyteller/analyticsSnapshotStore';

/**
 * GET /api/analytics-snapshots
 * Returns the authenticated user's recent analytics snapshots.
 * Uses local file store when STORYTELLER_USE_LOCAL_STORE=true, otherwise Supabase.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20;
    const platform = searchParams.get('platform') || undefined;
    const typeParam = searchParams.get('type');
    const snapshotType = (typeParam === 'post' || typeParam === 'dashboard') ? typeParam : undefined;
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const dateRange =
      from || to
        ? { from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined, to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined }
        : undefined;

    if (useStorytellerLocalStore()) {
      const data = await listByUserLocal(userId, limit, platform, snapshotType, dateRange);
      return NextResponse.json(data);
    }

    const supabase = await createAuthenticatedClient();
    const data = await listByUserSupabase(supabase, userId, limit, platform, snapshotType, dateRange);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[analytics-snapshots] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics snapshots',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

