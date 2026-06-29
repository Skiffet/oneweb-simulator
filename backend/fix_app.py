import os
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix get_cached_satellites
def fix_get_cached():
    global content
    pattern = r"def get_cached_satellites\(\):.*?(?=@app\.route\('/'\))"
    replacement = '''def get_cached_satellites():
    global satellite_objects_cache, thailand_watchlist
    
    if satellite_objects_cache:
        return satellite_objects_cache
        
    with cache_lock:
        if satellite_objects_cache:
            return satellite_objects_cache
            
        data = fetch_tle_data()
        if not data: return {}
        
        print("Building satellite cache (Initial boot)...")
        new_sat_cache = {}
        other_count = 0
        for tle in data:
            try:
                name = tle.get("OBJECT_NAME", "Unknown")
                is_oneweb = "ONEWEB" in name.upper()
                
                if not is_oneweb:
                    if other_count >= 1500:
                        continue
                    other_count += 1
                    
                norad_id = str(tle.get("NORAD_CAT_ID", ""))
                if not norad_id: continue
                line1, line2 = tle.get("TLE_LINE1"), tle.get("TLE_LINE2")
                if not line1 or not line2: continue
                
                sat = EarthSatellite(line1, line2, name, ts)
                new_sat_cache[norad_id] = {'sat': sat, 'data': tle}
            except Exception:
                continue
                
        satellite_objects_cache = new_sat_cache
        print(f"Cache built with {len(satellite_objects_cache)} objects.")
        update_watchlist() # Build initial watchlist
            
    return satellite_objects_cache

'''
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Fix api_satellite_detail and oneweb_predictions
def fix_api_satellite_detail():
    global content
    pattern = r'airspace\["exit_in"\] = exit_idx - now_idx\s+else:\s+exit_idx = len\(in_bounds\).*?(?=if __name__ ==)'
    
    replacement = '''airspace["exit_in"] = exit_idx - now_idx
            else:
                exit_idx = len(in_bounds)
                
            past_bounds = in_bounds[:now_idx]
            if not past_bounds.all() and len(past_bounds) > 0:
                entry_idx = now_idx - int(np.argmin(past_bounds[::-1]))
            else:
                entry_idx = 0
                
            if entry_idx is not None and exit_idx is not None:
                airspace["duration"] = exit_idx - entry_idx
                
        else:
            future_bounds = in_bounds[now_idx+1:]
            if future_bounds.any():
                airspace["status"] = "upcoming"
                entry_idx = now_idx + 1 + int(np.argmax(future_bounds))
                airspace["entry_in"] = entry_idx - now_idx
                
                bounds_after_entry = in_bounds[entry_idx+1:]
                if not bounds_after_entry.all() and len(bounds_after_entry) > 0:
                    exit_idx = entry_idx + 1 + int(np.argmin(bounds_after_entry))
                    airspace["exit_in"] = exit_idx - now_idx
                    airspace["duration"] = exit_idx - entry_idx
                else:
                    airspace["exit_in"] = len(in_bounds) - now_idx
                    airspace["duration"] = len(in_bounds) - entry_idx
        
        return jsonify({
            "success": True,
            "sunlit": is_sunlit,
            "elevation": round(float(alt.degrees), 4),
            "azimuth": round(float(az.degrees), 4),
            "distance": round(float(distance.km), 4),
            "revolutions": round(mean_motion, 4),
            "path": path,
            "airspace": airspace
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

oneweb_predictions_cache = None
oneweb_predictions_last_time = None
predictions_lock = threading.Lock()

@app.route('/api/oneweb-predictions')
def oneweb_predictions():
    global oneweb_predictions_cache, oneweb_predictions_last_time
    
    now = datetime.now()
    if oneweb_predictions_cache and oneweb_predictions_last_time:
        if (now - oneweb_predictions_last_time).total_seconds() < 600:
            return jsonify(oneweb_predictions_cache)
            
    if not predictions_lock.acquire(blocking=False):
        if oneweb_predictions_cache:
            return jsonify(oneweb_predictions_cache)
        predictions_lock.acquire() 
        
    try:
        if oneweb_predictions_cache and oneweb_predictions_last_time:
            if (datetime.now() - oneweb_predictions_last_time).total_seconds() < 600:
                return jsonify(oneweb_predictions_cache)
                
        sat_cache = get_cached_satellites()
        if not sat_cache:
            return jsonify({"success": False, "error": "Failed to load satellite objects"})
        
        predictions = []
        t0 = ts.now()
        t1 = ts.tt_jd(t0.tt + 3/24)
        t_range = ts.linspace(t0, t1, 180) 
        
        for norad_id, obj in sat_cache.items():
            try:
                sat = obj['sat']
                tle = obj['data']
                name = tle.get("OBJECT_NAME", "Unknown")
                
                if "ONEWEB" not in name.upper():
                    continue
                    
                geocentric = sat.at(t_range)
                subpoints = geocentric.subpoint()
                
                lats = subpoints.latitude.degrees
                lons = subpoints.longitude.degrees
                
                in_bounds = (
                    (lats >= THAILAND_BOUNDS['minLat']) & (lats <= THAILAND_BOUNDS['maxLat']) &
                    (lons >= THAILAND_BOUNDS['minLon']) & (lons <= THAILAND_BOUNDS['maxLon'])
                )
                
                if in_bounds.any():
                    first_idx = int(np.argmax(in_bounds))
                    entry_in = first_idx + 1
                    
                    points_inside = 0
                    for val in in_bounds[first_idx:]:
                        if val:
                            points_inside += 1
                        else:
                            break
                    
                    predictions.append({
                        "name": name,
                        "noradId": norad_id,
                        "entry_in": entry_in,
                        "exit_in": entry_in + points_inside,
                        "duration": points_inside
                    })
            except Exception:
                continue
                
        predictions.sort(key=lambda x: x["entry_in"])
        
        result = {
            "success": True,
            "count": len(predictions),
            "timestamp": datetime.now().isoformat(),
            "predictions": predictions
        }
        
        oneweb_predictions_cache = result
        oneweb_predictions_last_time = datetime.now()
        
        return jsonify(result)
        
    finally:
        predictions_lock.release()

'''
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)

fix_get_cached()
fix_api_satellite_detail()

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("app.py successfully fixed!")
