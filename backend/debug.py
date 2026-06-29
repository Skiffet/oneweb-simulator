from app import fetch_tle_data, ts, EarthSatellite, THAILAND_BOUNDS
tle_data = fetch_tle_data()
t = ts.now()
count = 0
for tle in tle_data:
    line1 = tle.get("TLE_LINE1")
    line2 = tle.get("TLE_LINE2")
    name = tle.get("OBJECT_NAME", "Unknown")
    if not line1 or not line2: continue
    
    sat = EarthSatellite(line1, line2, name, ts)
    subpoint = sat.at(t).subpoint()
    lat = subpoint.latitude.degrees
    lon = subpoint.longitude.degrees
    if THAILAND_BOUNDS['minLat'] <= lat <= THAILAND_BOUNDS['maxLat']:
        if THAILAND_BOUNDS['minLon'] <= lon <= THAILAND_BOUNDS['maxLon']:
            count += 1
print("Over Thailand:", count)
