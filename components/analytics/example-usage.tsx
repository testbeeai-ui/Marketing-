/**
 * Example Usage of Analytics Components
 * 
 * This file shows how to use all analytics components together.
 * Copy the relevant parts into your own project.
 */

"use client";

import { 
  TwitterAnalytics, 
  InstagramAnalytics, 
  LinkedInAnalytics, 
  FacebookAnalytics 
} from './index';

/**
 * Example 1: Basic usage in Next.js layout
 */
export function AnalyticsExample() {
  return (
    <>
      {/* Twitter Analytics */}
      <TwitterAnalytics 
        pixelId="your-twitter-pixel-id-here"
        debug={process.env.NODE_ENV === 'development'}
      />

      {/* Instagram Analytics */}
      <InstagramAnalytics 
        pixelId="your-instagram-pixel-id-here"
        debug={process.env.NODE_ENV === 'development'}
      />

      {/* LinkedIn Analytics */}
      <LinkedInAnalytics 
        partnerId="your-linkedin-partner-id-here"
        debug={process.env.NODE_ENV === 'development'}
      />

      {/* Facebook Analytics */}
      <FacebookAnalytics 
        pixelId="your-facebook-pixel-id-here"
        debug={process.env.NODE_ENV === 'development'}
        autoConfig={true}
      />
    </>
  );
}

/**
 * Example 2: With environment variables
 */
export function AnalyticsWithEnv() {
  return (
    <>
      {process.env.NEXT_PUBLIC_TWITTER_PIXEL_ID && (
        <TwitterAnalytics pixelId={process.env.NEXT_PUBLIC_TWITTER_PIXEL_ID} />
      )}
      
      {process.env.NEXT_PUBLIC_INSTAGRAM_PIXEL_ID && (
        <InstagramAnalytics pixelId={process.env.NEXT_PUBLIC_INSTAGRAM_PIXEL_ID} />
      )}
      
      {process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID && (
        <LinkedInAnalytics partnerId={process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID} />
      )}
      
      {process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID && (
        <FacebookAnalytics pixelId={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID} />
      )}
    </>
  );
}

/**
 * Example 3: With advanced matching (Facebook/Instagram)
 */
export function AnalyticsWithAdvancedMatching() {
  // In a real app, get customer data from your auth system
  const customerData = {
    email: "user@example.com",
    firstName: "John",
    lastName: "Doe",
    phone: "+1234567890",
  };

  return (
    <>
      <FacebookAnalytics 
        pixelId="your-facebook-pixel-id"
        advancedMatching={true}
        customerData={customerData}
      />
      
      <InstagramAnalytics 
        pixelId="your-instagram-pixel-id"
        advancedMatching={true}
        customerData={customerData}
      />
    </>
  );
}

/**
 * Example 4: Conditional loading based on user consent
 */
export function AnalyticsWithConsent({ hasConsent }: { hasConsent: boolean }) {
  if (!hasConsent) {
    return null;
  }

  return (
    <>
      <TwitterAnalytics pixelId="your-twitter-pixel-id" />
      <InstagramAnalytics pixelId="your-instagram-pixel-id" />
      <LinkedInAnalytics partnerId="your-linkedin-partner-id" />
      <FacebookAnalytics pixelId="your-facebook-pixel-id" />
    </>
  );
}

/**
 * Example 5: Custom event tracking
 */
export function CustomEventTracking() {
  const handlePurchase = () => {
    // Track purchase event
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Purchase', {
        value: 29.99,
        currency: 'USD',
        content_name: 'Product Name',
      });
    }
  };

  const handleAddToCart = () => {
    // Track add to cart event
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'AddToCart', {
        value: 19.99,
        currency: 'USD',
      });
    }
  };

  return (
    <>
      <FacebookAnalytics pixelId="your-facebook-pixel-id" />
      <button onClick={handleAddToCart}>Add to Cart</button>
      <button onClick={handlePurchase}>Purchase</button>
    </>
  );
}
