import env from './env';

type ServiceName = 'proxy' | 'analyse' | 'auth';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

const publicServiceUrls: Record<ServiceName, string> = {
  proxy: env.PROXY_URL,
  analyse: env.ANALYSE_URL,
  auth: env.AUTH_URL,
};

const internalServiceUrls: Partial<Record<ServiceName, string | undefined>> = {
  proxy: env.INTERNAL_PROXY_URL,
  analyse: env.INTERNAL_ANALYSE_URL,
  auth: env.INTERNAL_AUTH_URL,
};

export function getPublicServiceUrl(service: ServiceName): string {
  return trimTrailingSlash(publicServiceUrls[service]);
}

export function getInternalServiceUrl(service: ServiceName): string {
  return trimTrailingSlash(internalServiceUrls[service] || publicServiceUrls[service]);
}
