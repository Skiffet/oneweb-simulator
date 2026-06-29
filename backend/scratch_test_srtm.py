import srtm
import time

print("Initializing elevation data...")
start = time.time()
elevation_data = srtm.get_data()
print(f"Initialized in {time.time() - start:.2f} seconds")

# Everest
print("Querying Everest...")
start = time.time()
elev = elevation_data.get_elevation(27.9881, 86.9250)
print(f"Everest: {elev}m in {time.time() - start:.2f} seconds")

# Dead Sea
print("Querying Dead Sea...")
start = time.time()
elev = elevation_data.get_elevation(31.5, 35.5)
print(f"Dead Sea: {elev}m in {time.time() - start:.2f} seconds")
