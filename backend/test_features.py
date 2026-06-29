from skyfield.api import load, EarthSatellite, wgs84
from datetime import datetime, timedelta

ts = load.timescale()
eph = load('de421.bsp')

line1 = "1 25544U 98067A   23180.50150937  .00015500  00000-0  28172-3 0  9995"
line2 = "2 25544  51.6416  60.5477 0005703 162.7760 162.9099 15.49887754399226"
sat = EarthSatellite(line1, line2, "ISS", ts)

t = ts.now()
bkk = wgs84.latlon(13.7563, 100.5018)

# 1. Sunlit
is_sunlit = sat.at(t).is_sunlit(eph)
print("Sunlit:", is_sunlit)

# 2. Az/Alt
difference = sat - bkk
topocentric = difference.at(t)
alt, az, distance = topocentric.altaz()
print("Alt:", alt.degrees, "Az:", az.degrees, "Dist:", distance.km)

# 3. Path prediction (-15 to +15 mins)
now = datetime.now()
times = [now + timedelta(minutes=i) for i in range(-15, 16, 3)]
t_array = ts.from_datetimes(times)

positions = sat.at(t_array)
subpoints = positions.subpoint()
lats = subpoints.latitude.degrees
lons = subpoints.longitude.degrees

path = [[lat, lon] for lat, lon in zip(lats, lons)]
print("Path length:", len(path))
print("First point:", path[0])
