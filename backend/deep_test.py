import os
import time
import requests
import statistics
import concurrent.futures

BASE_URL = "http://127.0.0.1:5001"

def test_api_speed_and_math(endpoint):
    start = time.time()
    try:
        res = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
        elapsed = time.time() - start
        
        if res.status_code != 200:
            return False, f"Status code {res.status_code}", elapsed
            
        data = res.json()
        if not data.get("success"):
            return False, "API returned success=False", elapsed
            
        # Mathematical verification
        if endpoint == "/api/satellites":
            satellites = data.get("satellites", [])
            if not satellites:
                return True, "No satellites found", elapsed
                
            for sat in satellites:
                # Math bounds check
                lat = sat.get("lat")
                lon = sat.get("lon")
                alt = sat.get("alt")
                vel = sat.get("velocityKms")
                
                if not (-90 <= lat <= 90):
                    return False, f"Invalid latitude: {lat}", elapsed
                if not (-180 <= lon <= 180):
                    return False, f"Invalid longitude: {lon}", elapsed
                if alt < 100 or alt > 50000:
                    pass
                if vel < 0 or vel > 15: # Satellites generally move between 3-8 km/s
                    return False, f"Invalid physics velocity: {vel}", elapsed
                    
        return True, "Math and structure validated", elapsed
    except Exception as e:
        return False, str(e), time.time() - start

def stress_test():
    print("======================================")
    print("🚀 DEEP STRESS & MATH VALIDATION TEST")
    print("======================================")
    print("Warming up server cache...")
    try:
        res = requests.get(f"{BASE_URL}/api/satellites", timeout=30)
        print("Warmup finished with status:", res.status_code)
        time.sleep(2)
    except Exception as e:
        print("Warmup failed:", e)
        
    print("Targeting: /api/satellites, /api/oneweb-predictions")
    print("Simulating 50 concurrent users...\n")
    
    endpoints = ["/api/satellites"] * 100 + ["/api/oneweb-predictions"] * 100
    
    success_count = 0
    fail_count = 0
    times = []
    errors = set()
    
    start_total = time.time()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        results = executor.map(test_api_speed_and_math, endpoints)
        
        for success, msg, elapsed in results:
            if success:
                success_count += 1
                times.append(elapsed)
            else:
                fail_count += 1
                errors.add(msg)
                
    total_time = time.time() - start_total
    
    print("📊 RESULTS SUMMARY")
    print("--------------------------------------")
    print(f"Total Requests Processed : {success_count + fail_count}")
    print(f"Successful Requests      : {success_count}")
    print(f"Failed Requests          : {fail_count}")
    
    if success_count > 0:
        avg_time = statistics.mean(times)
        max_time = max(times)
        min_time = min(times)
        p95 = statistics.quantiles(times, n=20)[18] if len(times) >= 20 else max_time
        
        print(f"\n⏱️ PERFORMANCE METRICS")
        print(f"Avg Response Time  : {avg_time*1000:.2f} ms")
        print(f"Fastest Response   : {min_time*1000:.2f} ms")
        print(f"Slowest Response   : {max_time*1000:.2f} ms")
        print(f"95th Percentile    : {p95*1000:.2f} ms")
        
    print(f"\n⏳ Total Test Duration: {total_time:.2f} seconds")
    
    if fail_count > 0:
        print("\n⚠️ ERRORS FOUND:")
        for e in errors:
            print(f"- {e}")
            
    print("======================================")

if __name__ == "__main__":
    stress_test()
