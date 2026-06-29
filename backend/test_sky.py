import os
from skyfield.api import load, EarthSatellite
from datetime import datetime

ts = load.timescale()
t = ts.now()

line1 = "1 25544U 98067A   23180.50150937  .00015500  00000-0  28172-3 0  9995"
line2 = "2 25544  51.6416  60.5477 0005703 162.7760 162.9099 15.49887754399226"

sat = EarthSatellite(line1, line2, "ISS", ts)
geocentric = sat.at(t)
subpoint = geocentric.subpoint()

print("Lat:", subpoint.latitude.degrees)
print("Lon:", subpoint.longitude.degrees)
print("Alt:", subpoint.elevation.km)
