import { cookies } from 'next/headers';

export interface AppConfig {
  authBaseUrl: string;
  proxyBaseUrl: string;
  analyseBaseUrl: string;
  apiBaseUrl: string;
}

export async function fetchApiConfig(): Promise<AppConfig | null> {
  const cookieStore = await cookies();

  const cookie = cookieStore.toString();
  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL;

  if (!authBaseUrl) {
    return null;
  }

  try {
    const normalizedBaseUrl = authBaseUrl.replace(/\/$/, "");

    const response = await fetch(`${normalizedBaseUrl}/api/config`, {
      method: 'GET',
      headers: {
        cookie,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}
