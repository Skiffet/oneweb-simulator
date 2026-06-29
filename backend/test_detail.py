import requests
import json

# Get all satellites first to find a valid NORAD ID
res = requests.get("http://localhost:5000/api/satellites")
data = res.json()
if data.get("satellites"):
    sat = data["satellites"][0]
    norad_id = sat["noradId"]
    print(f"Testing detail for {sat['name']} (ID {norad_id})")
    
    # Fetch detail
    res_detail = requests.get(f"http://localhost:5000/api/satellite/{norad_id}")
    detail_data = res_detail.json()
    print(json.dumps(detail_data, indent=2))
else:
    print("No satellites found over Thailand right now.")
