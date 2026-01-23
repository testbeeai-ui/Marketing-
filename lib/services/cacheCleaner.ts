/**
 * Cache Cleaner Service
 * Clears stale cache data after UUID migration from numeric IDs
 */

import { clearAllImages } from '../storage';

/**
 * Clear all client-side caches that might contain stale numeric ID references
 */
export async function clearAllCaches(): Promise<void> {
  try {
    console.log('[CacheCleaner] Starting cache cleanup...');
    
    // Clear IndexedDB image storage
    await clearAllImages();
    console.log('[CacheCleaner] Cleared image storage cache');
    
    // Clear any browser localStorage that might contain user data
    if (typeof window !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('user') || key.includes('block') || key.includes('sub-block'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[CacheCleaner] Removed localStorage key: ${key}`);
      });
    }
    
    console.log('[CacheCleaner] Cache cleanup completed successfully');
  } catch (error) {
    console.error('[CacheCleaner] Error during cache cleanup:', error);
    throw error;
  }
}

/**
 * Clear specific user-related caches (for individual user cleanup)
 */
export async function clearUserCaches(userId: string): Promise<void> {
  try {
    console.log(`[CacheCleaner] Clearing caches for user: ${userId}`);
    
    // Clear any user-specific localStorage
    if (typeof window !== 'undefined') {
      const userKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(userId)) {
          userKeys.push(key);
        }
      }
      userKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[CacheCleaner] Removed user localStorage key: ${key}`);
      });
    }
    
    console.log(`[CacheCleaner] User cache cleanup completed for: ${userId}`);
  } catch (error) {
    console.error(`[CacheCleaner] Error clearing user caches for ${userId}:`, error);
    throw error;
  }
}