import axios, { AxiosError, AxiosRequestConfig } from "axios";

const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL;

function getAuthBaseUrl(): string {
  if (!AUTH_BASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_AUTH_BASE_URL");
  }

  return AUTH_BASE_URL.replace(/\/$/, "");
}

let apiClientInstance: ReturnType<typeof axios.create> | null = null;

function getApiClient() {
  if (!apiClientInstance) {
    apiClientInstance = axios.create({
      baseURL: getAuthBaseUrl(),
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    });

    apiClientInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const data = error.response.data as { error?: string; message?: string };
          const message = data?.error || data?.message || "Request failed";
          return Promise.reject(new Error(message));
        }
        return Promise.reject(error);
      }
    );
  }
  return apiClientInstance;
}

export const apiClient = {
  get: async function <T>(url: string, config?: AxiosRequestConfig) {
    return getApiClient().get<T>(url, config);
  },
  post: async function <T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return getApiClient().post<T>(url, data, config);
  },
  put: async function <T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return getApiClient().put<T>(url, data, config);
  },
  patch: async function <T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return getApiClient().patch<T>(url, data, config);
  },
  delete: async function <T>(url: string, config?: AxiosRequestConfig) {
    return getApiClient().delete<T>(url, config);
  },
  request: async function <T>(config: AxiosRequestConfig) {
    return getApiClient().request<T>(config);
  },
};

// Extended config to support both 'body' (fetch-like) and 'data' (axios)
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  init: ExtendedAxiosRequestConfig = {}
): Promise<T> {
  const { body, ...rest } = init;
  const response = await apiClient.request<T>({
    url: path,
    data: body, // Convert body to data for axios
    ...rest,
  });
  return response.data;
}

export function buildAuthUrl(path: string): string {
  const baseUrl = getAuthBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}
