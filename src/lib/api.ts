type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown;
};

const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL;

function getAuthBaseUrl(): string {
  if (!AUTH_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_AUTH_BASE_URL");
  }

  return AUTH_BASE_URL.replace(/\/$/, "");
}

export function buildAuthUrl(path: string): string {
  const baseUrl = getAuthBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const url = buildAuthUrl(path);
  const { body, headers, ...rest } = init;

  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.error || payload?.message || "Request failed";
    throw new Error(message);
  }

  return payload as T;
}
