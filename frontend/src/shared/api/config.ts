const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (configuredBaseUrl || '/api/v1').replace(/\/$/, '');
export const API_TIMEOUT_MS = 15_000;
