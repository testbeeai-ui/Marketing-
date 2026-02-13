"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * LinkedIn Analytics Component
 * 
 * Easy-to-use LinkedIn Insight Tag analytics tracking component.
 * Simply copy and paste this component into your website.
 * 
 * @example
 * ```tsx
 * <LinkedInAnalytics partnerId="your-partner-id" />
 * ```
 * 
 * For regular React apps (not Next.js), replace Script with useEffect:
 * ```tsx
 * useEffect(() => {
 *   const script = document.createElement('script');
 *   script.type = 'text/javascript';
 *   script.innerHTML = \`
 *     _linkedin_partner_id = "YOUR_PARTNER_ID";
 *     window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
 *     window._linkedin_data_partner_ids.push(_linkedin_partner_id);
 *   \`;
 *   document.head.appendChild(script);
 *   
 *   const script2 = document.createElement('script');
 *   script2.type = 'text/javascript';
 *   script2.async = true;
 *   script2.src = 'https://snap.licdn.com/li.lms-analytics/insight.min.js';
 *   document.head.appendChild(script2);
 * }, []);
 * ```
 */
interface LinkedInAnalyticsProps {
  /**
   * Your LinkedIn Partner ID (found in LinkedIn Campaign Manager)
   * Format: Usually a numeric string
   */
  partnerId: string;
  
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

export function LinkedInAnalytics({ 
  partnerId, 
  debug = false,
  trackPageView = true 
}: LinkedInAnalyticsProps) {
  useEffect(() => {
    if (!partnerId) {
      if (debug) {
        console.warn("LinkedIn Analytics: partnerId is required");
      }
      return;
    }

    // Track page view if enabled
    if (trackPageView && typeof window !== "undefined" && window.lintrk) {
      window.lintrk("track", { conversion_id: partnerId });
      if (debug) {
        console.log("LinkedIn Analytics: Page view tracked", partnerId);
      }
    }
  }, [partnerId, debug, trackPageView]);

  if (!partnerId) {
    return null;
  }

  return (
    <>
      {/* LinkedIn Insight Tag */}
      <Script
        id="linkedin-analytics-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            _linkedin_partner_id = "${partnerId}";
            window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
            window._linkedin_data_partner_ids.push(_linkedin_partner_id);
          `,
        }}
      />
      
      <Script
        id="linkedin-analytics"
        strategy="afterInteractive"
        src="https://snap.licdn.com/li.lms-analytics/insight.min.js"
        onLoad={() => {
          if (debug) {
            console.log("LinkedIn Analytics: Script loaded");
          }
        }}
      />
      
      {/* Noscript fallback */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://px.ads.linkedin.com/collect/?pid=${partnerId}&fmt=gif`}
        />
      </noscript>
    </>
  );
}

// TypeScript declarations for window.lintrk
declare global {
  interface Window {
    lintrk?: (action: string, params?: Record<string, any>) => void;
    _linkedin_data_partner_ids?: string[];
  }
}
