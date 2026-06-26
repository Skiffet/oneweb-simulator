// ==========================================
// TODO: เปลี่ยนเป็น IP ของ GPU server
// หา IP ได้โดยพิมพ์ ip a บนเครื่อง server
// ==========================================
export const API_URL = "http://192.168.100.219:3000";

export async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
