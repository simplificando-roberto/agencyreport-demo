export const API = "/api";

export async function apiFetch(path: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers,
    credentials: "include", // Send cookies automatically
  });

  if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
    window.location.href = "/";
  }
  return res;
}

export function getAgencyName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("agency_name") || "Agency";
}

export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/me`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("agency_name", data.agency_name);
      return true;
    }
  } catch {}
  return false;
}

export async function logout() {
  await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
  localStorage.removeItem("agency_name");
  window.location.href = "/";
}
