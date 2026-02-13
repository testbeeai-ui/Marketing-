# Social Media Analytics Components

Easy-to-use analytics tracking components for Twitter, Instagram, LinkedIn, and Facebook. These components can be easily copied and pasted into any website.

## Quick Start

### Next.js Projects

```tsx
import { 
  TwitterAnalytics, 
  InstagramAnalytics, 
  LinkedInAnalytics, 
  FacebookAnalytics 
} from '@/components/analytics';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TwitterAnalytics pixelId="your-twitter-pixel-id" />
        <InstagramAnalytics pixelId="your-instagram-pixel-id" />
        <LinkedInAnalytics partnerId="your-linkedin-partner-id" />
        <FacebookAnalytics pixelId="your-facebook-pixel-id" />
        {children}
      </body>
    </html>
  );
}
```

### Regular React Projects

For non-Next.js projects, you can use the vanilla JavaScript versions provided in each component's JSDoc comments, or modify the components to use `useEffect` instead of Next.js `Script` component.

## Components

### TwitterAnalytics

Tracks Twitter/X analytics using Twitter Universal Website Tag.

**Props:**
- `pixelId` (required): Your Twitter Pixel ID from Twitter Ads Manager
- `debug` (optional): Enable console logging (default: `false`)
- `trackPageView` (optional): Auto-track page views (default: `true`)

**Example:**
```tsx
<TwitterAnalytics pixelId="o1234567890" debug={true} />
```

**Where to find your Pixel ID:**
1. Go to Twitter Ads Manager
2. Navigate to Tools → Conversion tracking
3. Copy your Pixel ID

---

### InstagramAnalytics

Tracks Instagram analytics using Meta Pixel (Facebook Pixel).

**Props:**
- `pixelId` (required): Your Meta Pixel ID from Meta Events Manager
- `debug` (optional): Enable console logging (default: `false`)
- `trackPageView` (optional): Auto-track page views (default: `true`)
- `advancedMatching` (optional): Enable advanced matching (default: `false`)
- `customerData` (optional): Customer data for advanced matching

**Example:**
```tsx
<InstagramAnalytics 
  pixelId="123456789012345" 
  advancedMatching={true}
  customerData={{
    email: "user@example.com",
    phone: "+1234567890"
  }}
/>
```

**Where to find your Pixel ID:**
1. Go to Meta Events Manager
2. Select your pixel
3. Copy the Pixel ID (15-16 digit number)

---

### LinkedInAnalytics

Tracks LinkedIn analytics using LinkedIn Insight Tag.

**Props:**
- `partnerId` (required): Your LinkedIn Partner ID from LinkedIn Campaign Manager
- `debug` (optional): Enable console logging (default: `false`)
- `trackPageView` (optional): Auto-track page views (default: `true`)

**Example:**
```tsx
<LinkedInAnalytics partnerId="123456" />
```

**Where to find your Partner ID:**
1. Go to LinkedIn Campaign Manager
2. Navigate to Account Assets → Insight Tag
3. Copy your Partner ID

---

### FacebookAnalytics

Tracks Facebook analytics using Facebook Pixel.

**Props:**
- `pixelId` (required): Your Facebook Pixel ID from Facebook Events Manager
- `debug` (optional): Enable console logging (default: `false`)
- `trackPageView` (optional): Auto-track page views (default: `true`)
- `advancedMatching` (optional): Enable advanced matching (default: `false`)
- `customerData` (optional): Customer data for advanced matching
- `autoConfig` (optional): Enable automatic event detection (default: `false`)
- `domain` (optional): Domain verification

**Example:**
```tsx
<FacebookAnalytics 
  pixelId="123456789012345" 
  advancedMatching={true}
  autoConfig={true}
  customerData={{
    email: "user@example.com",
    firstName: "John",
    lastName: "Doe"
  }}
/>
```

**Where to find your Pixel ID:**
1. Go to Facebook Events Manager
2. Select your pixel
3. Copy the Pixel ID (15-16 digit number)

---

## Custom Event Tracking

All components expose global functions for custom event tracking:

### Twitter
```tsx
window.twttr?.conversion?.track('your-pixel-id');
```

### Instagram/Facebook
```tsx
// Track custom event
window.fbq?.('track', 'Purchase', {
  value: 29.99,
  currency: 'USD'
});

// Track custom conversion
window.fbq?.('trackCustom', 'CustomEvent', {
  customParameter: 'value'
});
```

### LinkedIn
```tsx
window.lintrk?.('track', { conversion_id: 'your-partner-id' });
```

## Common Events

### Facebook/Instagram Events:
- `PageView` - Page view (auto-tracked)
- `ViewContent` - Content viewed
- `Search` - Search performed
- `AddToCart` - Item added to cart
- `InitiateCheckout` - Checkout started
- `Purchase` - Purchase completed
- `Lead` - Lead generated
- `CompleteRegistration` - Registration completed

### Twitter Events:
- Page views (auto-tracked)
- Custom conversions via `twttr.conversion.track()`

### LinkedIn Events:
- Page views (auto-tracked)
- Custom conversions via `lintrk('track')`

## Testing

Enable debug mode to see events in the console:

```tsx
<TwitterAnalytics pixelId="your-id" debug={true} />
<FacebookAnalytics pixelId="your-id" debug={true} />
```

## Browser Extensions

Some browser extensions (ad blockers, privacy tools) may block analytics scripts. Test in incognito mode or disable extensions for testing.

## Privacy & GDPR

Make sure to:
1. Inform users about tracking in your privacy policy
2. Implement cookie consent if required
3. Respect user privacy preferences
4. Only track with user consent where required by law

## Support

For issues or questions:
- Check the official documentation for each platform
- Use browser developer tools to debug script loading
- Enable debug mode to see console logs
