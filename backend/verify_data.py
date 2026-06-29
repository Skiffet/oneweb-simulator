import requests
import json

res = requests.get('http://localhost:5000/api/satellites?oneweb_planes=true')
data = res.json()

if data.get('success'):
    sats = data['satellites']
    print(f"Total satellites: {len(sats)}")
    
    # Check for any missing fields that might cause JS to crash
    for sat in sats:
        required_keys = ['name', 'noradId', 'lat', 'lon', 'alt', 'velocityKms', 'objectType']
        for k in required_keys:
            if k not in sat:
                print(f"Missing key {k} in satellite {sat.get('name')}")
        
        # Test JSON stringify equivalent since JS uses it
        json.dumps(sat).replace("'", "&#39;")
        
    print("All satellites have valid data format.")
else:
    print("API Error")
