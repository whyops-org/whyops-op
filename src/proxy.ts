import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/"];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.includes(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL;

  if (!authBaseUrl) {
    return NextResponse.next();
  }

  const cookie = request.headers.get("cookie") ?? "";
  const normalizedBaseUrl = authBaseUrl.replace(/\/$/, "");

  const sessionResponse = await fetch(`${normalizedBaseUrl}/api/auth/get-session`, {
    method: "GET",
    headers: {
      cookie,
    },
    cache: "no-store",
  });

  const sessionPayload = sessionResponse.ok ? await sessionResponse.json() : null;
  const hasSession = Boolean(sessionPayload?.session || sessionPayload?.user);

  if (!hasSession && !isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  if (!hasSession) {
    return NextResponse.next();
  }

  const userResponse = await fetch(`${normalizedBaseUrl}/api/users/me`, {
    method: "GET",
    headers: {
      cookie,
    },
    cache: "no-store",
  });

  const userPayload = userResponse.ok ? await userResponse.json() : null;
  const onboardingComplete = Boolean(userPayload?.data?.onboardingComplete ?? userPayload?.onboardingComplete);

  if (!onboardingComplete && pathname !== "/onboarding") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/onboarding";
    return NextResponse.redirect(redirectUrl);
  }

  if (onboardingComplete && (pathname === "/" || pathname === "/onboarding")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
