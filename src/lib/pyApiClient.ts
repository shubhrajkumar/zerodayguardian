const PY_API_BASE = import.meta.env.VITE_PY_API_URL || "/pyapi";

const normalizeUrl = (path: string) => {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) return `${PY_API_BASE}/${path}`;
  return `${PY_API_BASE}${path}`;
};

export const pyGetJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(normalizeUrl(path), { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Python API error ${response.status}`);
  }
  return response.json() as Promise<T>;
};

export const pyPostJson = async <T,>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(normalizeUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Python API error ${response.status}`);
  }
  return response.json() as Promise<T>;
};
