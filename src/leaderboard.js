const REQUEST_TIMEOUT = 6000;

export const normalizeInitials = value => String(value || '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')
  .slice(0, 3);

const request = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Leaderboard unavailable');
    return payload;
  } finally {
    clearTimeout(timer);
  }
};

export const leaderboard = {
  async beginRun(difficulty, gameVersion) {
    return request('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ difficulty, gameVersion }),
    });
  },

  async list(difficulty, limit = 10) {
    const query = new URLSearchParams({ difficulty, limit: String(limit) });
    return request(`/api/scores?${query}`);
  },

  async submit(entry) {
    return request('/api/scores', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  },
};
