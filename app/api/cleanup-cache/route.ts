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
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has any cached data that might need cleanup
    let hasCachedData = false;
    
    if (typeof window !== 'undefined') {
      // Check localStorage for user-related keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(userId)) {
          hasCachedData = true;
          break;
        }
      }
    }
    
    return NextResponse.json({ 
      userId,
      hasCachedData,
      message: hasCachedData ? 'User has cached data that may need cleanup' : 'No cached data found'
    });
    
  } catch (error: any) {
    console.error('[API] Error checking cache status:', error);
    return NextResponse.json({ 
      error: 'Failed to check cache status',
      details: error.message 
    }, { status: 500 });
  }
}