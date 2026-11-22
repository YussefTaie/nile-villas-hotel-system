import { API_BASE_URL, API_TIMEOUT_MS } from './config';
import { ApiError } from './ApiError';

export interface RequestOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = API_TIMEOUT_MS, headers, ...init } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') ?? '';
    const body: unknown = response.status === 204
      ? undefined
      : contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
      throw normalizeApiError(response.status, body);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The request timed out. Please try again.', null, 'TIMEOUT');
    }
    throw new ApiError('Unable to connect to the server. Check the connection and try again.', null, 'NETWORK');
  } finally {
    window.clearTimeout(timeout);
  }
}

function normalizeApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail;
    const message = typeof detail === 'string' ? detail : 'The request could not be completed.';
    return new ApiError(message, status, 'HTTP_ERROR', detail);
  }
  return new ApiError('The request could not be completed.', status, 'HTTP_ERROR', body);
}
