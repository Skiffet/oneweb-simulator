export const API_URL = "http://122.155.209.87";
export const SAT_API_URL = "http://122.155.209.87";

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
