from app import get_cached_satellites, fetch_tle_data
import time

print("Testing fetch_tle_data directly...")
start = time.time()
data = fetch_tle_data()
print("fetch_tle_data finished in", time.time() - start, "seconds.")
if data:
    print("Fetched", len(data), "items.")
else:
    print("Data is empty or None")

print("\nTesting get_cached_satellites directly...")
start = time.time()
cache = get_cached_satellites()
print("get_cached_satellites finished in", time.time() - start, "seconds.")
if cache:
    print("Cache has", len(cache), "items.")
else:
    print("Cache is empty or None")
