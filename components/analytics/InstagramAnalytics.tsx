"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Instagram Analytics Component
 * 
 * Easy-to-use Instagram analytics tracking component.
 * Instagram uses Facebook Pixel, so this integrates with Meta Pixel.
 * Simply copy and paste this component into your website.
 * 
 * @example
 * ```tsx
 * <InstagramAnalytics pixelId="your-pixel-id" />
 * ```
 * 
 * For regular React apps (not Next.js), replace Script with useEffect:
 * ```tsx
 * useEffect(() => {
 *   const script = document.createElement('script');
 *   script.innerHTML = \`
 *     !function(f,b,e,v,n,t,s)
 *     {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
 *     n.callMethod.apply(n,arguments):n.queue.push(arguments)};
 *     if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
 *     n.queue=[];t=b.createElement(e);t.async=!0;
 *     t.src=v;s=b.getElementsByTagName(e)[0];
 *     s.parentNode.insertBefore(t,s)}(window, document,'script',
 *     'https://connect.facebook.net/en_US/fbevents.js');
 *     fbq('init', 'YOUR_PIXEL_ID');
 *     fbq('track', 'PageView');
 *   \`;
 *   document.head.appendChild(script);
 * }, []);
 * ```
 */
interface InstagramAnalyticsProps {
  /**
   * Your Meta Pixel ID (found in Meta Events Manager)
   * Format: Usually a 15-16 digit number
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
  
  /**
   * Enable advanced matching (hash customer data)
   * @default false
   */
  advancedMatching?: boolean;
  
  /**
   * Customer data for advanced matching (email, phone, etc.)
   */
  customerData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

export function InstagramAnalytics({ 
  pixelId, 
  debug = false,
  trackPageView = true,
  advancedMatching = false,
  customerData
}: InstagramAnalyticsProps) {
  useEffect(() => {
    if (!pixelId) {
      if (debug) {
        console.warn("Instagram Analytics: pixelId is required");
      }
      return;
    }

    // Track custom events
    if (typeof window !== "undefined" && window.fbq) {
      if (trackPageView) {
        window.fbq("track", "PageView");
        if (debug) {
          console.log("Instagram Analytics: Page view tracked", pixelId);
        }
      }
    }
  }, [pixelId, debug, trackPageView]);

  if (!pixelId) {
    return null;
  }

  // Build advanced matching parameters
  const advancedMatchingParams = advancedMatching && customerData
    ? Object.entries(customerData)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: '${value}'`)
        .join(", ")
    : "";

  const pixelInit = advancedMatching && advancedMatchingParams
    ? `fbq('init', '${pixelId}', {${advancedMatchingParams}});`
    : `fbq('init', '${pixelId}');`;

  return (
    <>
      {/* Meta Pixel Code */}
      <Script
        id="instagram-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            ${pixelInit}
            ${trackPageView ? "fbq('track', 'PageView');" : ""}
          `,
        }}
        onLoad={() => {
          if (debug) {
            console.log("Instagram Analytics: Script loaded");
          }
        }}
      />
      
      {/* Noscript fallback */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}

// TypeScript declarations for window.fbq
declare global {
  interface Window {
    fbq?: (
      action: string,
      event: string,
      params?: Record<string, any>
    ) => void;
    _fbq?: any;
  }
}
