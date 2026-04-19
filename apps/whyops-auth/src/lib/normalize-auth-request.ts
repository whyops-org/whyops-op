const SIGN_OUT_PATH = '/api/auth/sign-out';

export function normalizeAuthRequest(request: Request): Request {
  if (request.method !== 'POST') {
    return request;
  }

  const url = new URL(request.url);
  if (url.pathname !== SIGN_OUT_PATH || request.headers.has('content-type')) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');

  return new Request(request.url, {
    method: request.method,
    headers,
    body: '{}',
  });
}
