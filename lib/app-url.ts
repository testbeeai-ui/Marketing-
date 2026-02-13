import { NextRequest } from "next/server";

const FALLBACK_APP_URL = "https://marketing-bice-psi.vercel.app";

/**
 * Base URL for the app (invite links, redirects). Prefers NEXT_PUBLIC_APP_URL,
 * then request origin, then fallback so emails never get "undefined" in links.
 */
export function getAppBaseUrl(request?: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (request?.nextUrl?.origin) {
    return request.nextUrl.origin;
  }
  return FALLBACK_APP_URL;
}
