import requests
import json

res = requests.get("http://localhost:5000/api/satellites?oneweb_planes=true")
data = res.json()

if data.get("success"):
    sats = data.get("satellites", [])
    oneweb_sats = [s for s in sats if "ONEWEB" in s["name"].upper()]
    print(f"Total satellites: {len(sats)}")
    print(f"Total OneWeb satellites: {len(oneweb_sats)}")
    
    # Check bounds
    lons = [s["lon"] for s in oneweb_sats]
    if lons:
        print(f"OneWeb Longitude range: {min(lons)} to {max(lons)}")
    
    for s in oneweb_sats:
        print(f"{s['name']}: Lat {s['lat']:.2f}, Lon {s['lon']:.2f}, Adjacent: {s.get('isAdjacent')}")
else:
    print("API failed:", data)
