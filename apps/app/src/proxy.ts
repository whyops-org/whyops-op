import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/"];
const PUBLIC_FILE_REGEX =
  /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp|css|js|map|txt|xml|json|webmanifest|woff2?|ttf|otf|eot)$/i;
const PUBLIC_METADATA_ROUTES = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
  "/site.webmanifest",
]);

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.includes(pathname);
}

function isPublicAssetPath(pathname: string) {
  return PUBLIC_METADATA_ROUTES.has(pathname) || PUBLIC_FILE_REGEX.test(pathname);
}

const PREFETCH_HEADERS = {
  nextRouterPrefetch: "next-router-prefetch",
  purpose: "purpose",
  prefetchValue: "prefetch",
} as const;

function isPrefetchRequest(request: NextRequest) {
  return (
    request.headers.has(PREFETCH_HEADERS.nextRouterPrefetch) ||
    request.headers.get(PREFETCH_HEADERS.purpose) === PREFETCH_HEADERS.prefetchValue
  );
}

interface UserPayload {
  user?: {
    onboardingComplete?: boolean;
    [key: string]: unknown;
  };
  onboardingComplete?: boolean;
  [key: string]: unknown;
}

async function fetchWithTimeout(url: string, cookie: string, timeoutMs = 1200) {
  return fetch(url, {
    method: "GET",
    headers: { cookie },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static files from /public and metadata assets.
  if (isPublicAssetPath(pathname)) {
    return NextResponse.next();
  }

  // Skip expensive auth checks for route prefetch requests.
  if (isPrefetchRequest(request)) {
    return NextResponse.next();
  }

  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL;

  if (!authBaseUrl) {
    return NextResponse.next();
  }

  const cookie = request.headers.get("cookie") ?? "";
  const normalizedBaseUrl = authBaseUrl.replace(/\/$/, "");

  let hasSession = false;
  let onboardingComplete = false;

  try {
    const userResponse = await fetchWithTimeout(`${normalizedBaseUrl}/api/session/context`, cookie);

    if (userResponse.ok) {
      hasSession = true;
      const userPayload = (await userResponse.json()) as UserPayload;
      onboardingComplete = Boolean(
        userPayload?.user?.onboardingComplete ?? userPayload?.onboardingComplete
      );
    } else if (userResponse.status === 401 || userResponse.status === 403) {
      hasSession = false;
    } else {
      return NextResponse.next();
    }
  } catch (err) {
    console.error("proxy: auth check failed", err);
    // Prefer availability and fast navigation if auth backend is slow/unreachable.
    return NextResponse.next();
  }

  if (!hasSession && !isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  if (!hasSession) {
    return NextResponse.next();
  }

  if (!onboardingComplete && pathname !== "/onboarding") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/onboarding";
    return NextResponse.redirect(redirectUrl);
  }

  if (onboardingComplete && (pathname === "/" || pathname === "/onboarding")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/agents";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: "/",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/onboarding",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
