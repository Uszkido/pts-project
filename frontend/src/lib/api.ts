import { APP_CONFIG } from './pts.config';

const BASE_URL = APP_CONFIG.API_URL;

class ApiClient {
    private async request(path: string, options: RequestInit = {}) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('pts_token') : null;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const response = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = data.error || data.message || `Request failed with status ${response.status}`;
            throw new Error(error);
        }

        // Auto-unwrap the standard response format
        if (data.success && data.data !== undefined) {
            return data.data;
        }

        return data;
    }

    async get(path: string, options?: RequestInit) {
        return this.request(path, { ...options, method: 'GET' });
    }

    async post(path: string, body: any, options?: RequestInit) {
        return this.request(path, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async put(path: string, body: any, options?: RequestInit) {
        return this.request(path, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    async delete(path: string, options?: RequestInit) {
        return this.request(path, { ...options, method: 'DELETE' });
    }
}

export const api = new ApiClient();
