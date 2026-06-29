// Auth server (Node.js/Express) — เปลี่ยนเป็น IP ของเครื่อง server (ip a)
export const API_URL = "http://192.168.100.219:3000";

// Satellite data server (Python/Flask) — เปลี่ยน IP ให้ตรงกับเครื่องที่รัน backend/app.py
export const SAT_API_URL = "http://192.168.100.219:5000";

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
