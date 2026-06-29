import requests
res = requests.get('http://localhost:5000/api/satellites')
print(res.status_code)
print(len(res.json().get('satellites', [])))
