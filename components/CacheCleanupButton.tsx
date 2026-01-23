'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CacheCleanupButtonProps {
  className?: string;
  onClick?: () => void;
}

/**
 * Button component to trigger cache cleanup for the current user
 * Helps resolve issues with stale numeric ID references after UUID migration
 */
export function CacheCleanupButton({ className, onClick }: CacheCleanupButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCacheCleanup = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/cleanup-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Cache cleaned successfully', {
          description: 'All stale references have been cleared',
        });
        console.log('[CacheCleanupButton] Cache cleanup completed:', result);
        // Call the onClick callback if provided
        onClick?.();
      } else {
        toast.error('Cache cleanup failed', {
          description: result.error || 'Failed to clear caches',
        });
        console.error('[CacheCleanupButton] Cache cleanup failed:', result);
      }
    } catch (error) {
      toast.error('Cache cleanup error', {
        description: 'An unexpected error occurred',
      });
      console.error('[CacheCleanupButton] Unexpected error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCacheCleanup}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className={className}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4 mr-2" />
      )}
      {isLoading ? 'Cleaning...' : 'Clear Cache'}
    </Button>
  );
}