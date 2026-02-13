/**
 * Social Media Analytics Components
 * 
 * Easy-to-use analytics tracking components for Twitter, Instagram, LinkedIn, and Facebook.
 * Simply copy and paste these components into your website.
 * 
 * @example
 * ```tsx
 * import { 
 *   TwitterAnalytics, 
 *   InstagramAnalytics, 
 *   LinkedInAnalytics, 
 *   FacebookAnalytics 
 * } from '@/components/analytics';
 * 
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       <TwitterAnalytics pixelId="your-twitter-pixel-id" />
 *       <InstagramAnalytics pixelId="your-instagram-pixel-id" />
 *       <LinkedInAnalytics partnerId="your-linkedin-partner-id" />
 *       <FacebookAnalytics pixelId="your-facebook-pixel-id" />
 *       {children}
 *     </>
 *   );
 * }
 * ```
 */

export { TwitterAnalytics } from './TwitterAnalytics';
export { InstagramAnalytics } from './InstagramAnalytics';
export { LinkedInAnalytics } from './LinkedInAnalytics';
export { FacebookAnalytics } from './FacebookAnalytics';
