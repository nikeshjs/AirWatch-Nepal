/**
 * AirWatch Nepal — API Service
 * All API calls to the Django backend go through this module.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    try {
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
        return await res.json();
    } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(`Network error: ${err.message}`, 0);
    }
}

// ── Endpoints ─────────────────────────────────────────────

/** GET /api/health/ */
export const checkHealth = () => request('/health/');

/** GET /api/cities/ → [{ id, name, latitude, longitude }] */
export const getCities = () => request('/cities/');

/**
 * GET /api/cities/<name>/summary/
 * Returns: { city, pm25, aqi, status, message, historical, forecast, env_current, env_series }
 */
export const getCitySummary = (cityName) =>
    request(`/cities/${encodeURIComponent(cityName)}/summary/`);

/** GET /api/summary/ → [{ city, pm25, aqi, status, latitude, longitude }] */
export const getAllCitiesSummary = () => request('/summary/');

/** POST /api/predictions/generate/ → Triggers ML pipeline to generate fresh predictions */
export const triggerPredictions = () =>
    request('/predictions/generate/', { method: 'POST' });
