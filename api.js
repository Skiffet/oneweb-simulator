export const API_URL = "http://192.168.100.235:3000";
export const SAT_API_URL = "http://192.168.100.235:5000";

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
