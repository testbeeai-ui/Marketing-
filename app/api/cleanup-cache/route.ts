import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-server';
import { clearUserCaches } from '@/lib/services/cacheCleaner';

/**
 * API endpoint to clear user-specific caches after UUID migration
 * This helps resolve issues with stale numeric ID references
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    console.log(`[API] Starting cache cleanup for user: ${userId}`);
    
    // Clear user-specific caches
    await clearUserCaches(userId);
    
    console.log(`[API] Cache cleanup completed for user: ${userId}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'User caches cleared successfully',
      userId 
    });
    
  } catch (error: any) {
    console.error('[API] Error during cache cleanup:', error);
    return NextResponse.json({ 
      error: 'Failed to clear caches',
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check cache status
 * Note: localStorage/IndexedDB are client-only. We cannot inspect them server-side.
 * We return a conservative hint based on whether the user is authenticated
 * (POST cleanup still works to clear server-side state if any is added later).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Server cannot access client localStorage/IndexedDB. Return hint for client to run
    // its own check or simply try POST cleanup. hasCachedData stays false server-side.
    return NextResponse.json({ 
      userId,
      hasCachedData: false,
      message: 'Cache status is client-only (localStorage/IndexedDB). Call POST to clear caches.'
    });
    
  } catch (error: any) {
    console.error('[API] Error checking cache status:', error);
    return NextResponse.json({ 
      error: 'Failed to check cache status',
      details: error.message 
    }, { status: 500 });
  }
}