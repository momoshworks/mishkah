export async function apiFetch(path, options = {}) {
  const config = {
    credentials: 'include',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };
  if (config.body !== undefined && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(path, config);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || 'حدث خطأ غير متوقع في الخادم');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
