import requests
import time
import math

def get_distance(lat1, lon1, lat2, lon2):
    # Haversine formula to calculate distance between two lat/lon points in km
    R = 6371.0 # Earth radius in kilometers
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance

print("Fetching initial positions...")
res1 = requests.get('http://localhost:5000/api/satellites').json()
sats1 = {s['noradId']: s for s in res1['satellites']}

if not sats1:
    print("No satellites found.")
    exit()

# Pick the first satellite to track
test_id = list(sats1.keys())[0]
sat1 = sats1[test_id]

print(f"Tracking {sat1['name']} (NORAD {test_id})")
print(f"Time 0s: Lat {sat1['lat']:.5f}, Lon {sat1['lon']:.5f}")

wait_time = 5
print(f"Waiting exactly {wait_time} seconds...")
time.sleep(wait_time)

print("Fetching new positions...")
res2 = requests.get('http://localhost:5000/api/satellites').json()
sats2 = {s['noradId']: s for s in res2['satellites']}

sat2 = sats2.get(test_id)
if not sat2:
    print("Satellite moved out of bounds.")
    exit()

print(f"Time {wait_time}s: Lat {sat2['lat']:.5f}, Lon {sat2['lon']:.5f}")

# Calculate actual distance moved
dist = get_distance(sat1['lat'], sat1['lon'], sat2['lat'], sat2['lon'])
actual_speed = dist / wait_time
reported_speed = sat2['velocityKms']

print(f"\n--- Real-Time Verification ---")
print(f"Distance moved in {wait_time}s: {dist:.2f} km")
print(f"Calculated Speed (from map movement): {actual_speed:.2f} km/s")
print(f"Reported Physics Speed (from backend): {reported_speed:.2f} km/s")

if abs(actual_speed - reported_speed) < 0.2:
    print("✅ RESULT: System is perfectly REAL-TIME!")
else:
    print("❌ RESULT: Speeds do not match.")
