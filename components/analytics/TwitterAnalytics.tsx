"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Twitter Analytics Component
 * 
 * Easy-to-use Twitter/X analytics tracking component.
 * Simply copy and paste this component into your website.
 * 
 * @example
 * ```tsx
 * <TwitterAnalytics pixelId="your-pixel-id" />
 * ```
 * 
 * For regular React apps (not Next.js), replace Script with useEffect:
 * ```tsx
 * useEffect(() => {
 *   const script = document.createElement('script');
 *   script.src = 'https://static.ads-twitter.com/uwt.js';
 *   script.async = true;
 *   document.head.appendChild(script);
 *   
 *   window.twttr = window.twttr || {};
 *   window.twttr.conversion = window.twttr.conversion || {};
 *   window.twttr.conversion.track = function(id) {
 *     // Track conversion
 *   };
 * }, []);
 * ```
 */
interface TwitterAnalyticsProps {
  /**
   * Your Twitter Pixel ID (found in Twitter Ads Manager)
   * Format: Usually starts with "o" followed by alphanumeric characters
   */
  pixelId: string;
  
  /**
   * Enable debug mode (logs events to console)
   * @default false
   */
  debug?: boolean;
  
  /**
   * Auto-track page views
   * @default true
   */
  trackPageView?: boolean;
}

export function TwitterAnalytics({ 
  pixelId, 
  debug = false,
  trackPageView = true 
}: TwitterAnalyticsProps) {
  useEffect(() => {
    if (!pixelId) {
      if (debug) {
        console.warn("Twitter Analytics: pixelId is required");
      }
      return;
    }

    // Initialize Twitter Pixel
    if (typeof window !== "undefined") {
      window.twttr = window.twttr || {};
      window.twttr.conversion = window.twttr.conversion || {};
      
      // Track page view if enabled
      if (trackPageView) {
        window.twttr?.conversion?.track?.(pixelId);
        if (debug) {
          console.log("Twitter Analytics: Page view tracked", pixelId);
        }
      }
    }
  }, [pixelId, debug, trackPageView]);

  if (!pixelId) {
    return null;
  }

  return (
    <>
      {/* Twitter Universal Website Tag */}
      <Script
        id="twitter-analytics"
        strategy="afterInteractive"
        src="https://static.ads-twitter.com/uwt.js"
        onLoad={() => {
          if (debug) {
            console.log("Twitter Analytics: Script loaded");
          }
        }}
      />
      
      {/* Twitter Pixel Base Code */}
      <Script
        id="twitter-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
            },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
            a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
            twq('config','${pixelId}');
          `,
        }}
      />
    </>
  );
}

// TypeScript declarations for window.twttr
declare global {
  interface Window {
    twttr?: {
      conversion?: {
        track?: (pixelId: string) => void;
      };
    };
  }
}
