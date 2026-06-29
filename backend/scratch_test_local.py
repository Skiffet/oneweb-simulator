import requests
try:
    print("Testing local server...")
    res = requests.get("http://127.0.0.1:5000/api/satellites", timeout=60)
    print("Status:", res.status_code)
    data = res.json()
    print("Success:", data.get("success"))
    print("Count:", data.get("count"))
except Exception as e:
    print("Error:", e)
