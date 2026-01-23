'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CacheCleanupButton } from './CacheCleanupButton';

interface CacheCleanupBannerProps {
  className?: string;
}

/**
 * Banner component that appears when cache cleanup is needed after UUID migration
 * Automatically checks cache status and provides cleanup functionality
 */
export function CacheCleanupBanner({ className }: CacheCleanupBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [hasCachedData, setHasCachedData] = useState(false);

  useEffect(() => {
    checkCacheStatus();
  }, []);

  const checkCacheStatus = async () => {
    try {
      const response = await fetch('/api/cleanup-cache');
      const result = await response.json();

      if (response.ok && result.hasCachedData) {
        setHasCachedData(true);
        setShowBanner(true);
      }
    } catch (error) {
      console.error('[CacheCleanupBanner] Error checking cache status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleCleanupComplete = () => {
    setShowBanner(false);
    setHasCachedData(false);
  };

  if (isChecking) {
    return (
      <Card className={`p-4 mb-4 ${className || ''}`}>
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking cache status...</p>
        </div>
      </Card>
    );
  }

  if (!showBanner) {
    return null;
  }

  return (
    <Card className={`p-4 mb-4 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800 ${className || ''}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Cache Cleanup Recommended
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBanner(false)}
              className="h-6 w-6 p-0 text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
            We've detected stale cache data that may cause issues. Clearing your cache will ensure optimal performance.
          </p>
          <div className="flex gap-2 mt-3">
            <CacheCleanupButton
              onClick={handleCleanupComplete}
              className="bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBanner(false)}
              className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}