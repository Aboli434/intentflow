import { HealthStatus } from '@intentflow/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiCheckState {
  status: 'loading' | 'connected' | 'unavailable';
  data?: HealthStatus;
  error?: string;
  lastChecked?: string;
}

export async function fetchApiHealth(): Promise<ApiCheckState> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      return {
        status: 'unavailable',
        error: `HTTP Error ${res.status}: ${res.statusText}`,
        lastChecked: new Date().toLocaleTimeString(),
      };
    }

    const data = (await res.json()) as HealthStatus;
    return {
      status: 'connected',
      data,
      lastChecked: new Date().toLocaleTimeString(),
    };
  } catch (err) {
    return {
      status: 'unavailable',
      error: err instanceof Error ? err.message : 'Network request failed',
      lastChecked: new Date().toLocaleTimeString(),
    };
  }
}
