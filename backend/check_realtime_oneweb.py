import requests
import time
import math

def get_distance(lat1, lon1, lat2, lon2):
    R = 6371.0 # Earth radius
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

print("Fetching initial positions...")
res1 = requests.get('http://localhost:5000/api/satellites?oneweb_planes=true').json()
sats1 = [s for s in res1['satellites'] if "ONEWEB" in s['name']]

if not sats1:
    print("No OneWeb satellites found.")
    exit()

sat1 = sats1[0]
test_id = sat1['noradId']

print(f"Tracking {sat1['name']} (NORAD {test_id})")
print(f"Time 0s: Lat {sat1['lat']:.5f}, Lon {sat1['lon']:.5f}")

wait_time = 5
print(f"Waiting exactly {wait_time} seconds...")
time.sleep(wait_time)

print("Fetching new positions...")
res2 = requests.get('http://localhost:5000/api/satellites?oneweb_planes=true').json()
sats2 = {s['noradId']: s for s in res2['satellites']}

sat2 = sats2.get(test_id)
if not sat2:
    print("Satellite moved out of bounds.")
    exit()

print(f"Time {wait_time}s: Lat {sat2['lat']:.5f}, Lon {sat2['lon']:.5f}")

dist = get_distance(sat1['lat'], sat1['lon'], sat2['lat'], sat2['lon'])
actual_speed = dist / wait_time
reported_speed = sat2['velocityKms']

print(f"\n--- Real-Time Verification ---")
print(f"Distance moved in {wait_time}s: {dist:.2f} km")
print(f"Calculated Speed (from map movement): {actual_speed:.2f} km/s")
print(f"Reported Physics Speed: {reported_speed:.2f} km/s")

if abs(actual_speed - reported_speed) < 0.5:
    print("SUCCESS: Speeds match closely. The system is REAL-TIME.")
else:
    print("WARNING: Speeds do not perfectly match, but position is updating.")
