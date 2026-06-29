import os
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add compute_oneweb_predictions_background function
compute_func = '''
def compute_oneweb_predictions_background():
    global oneweb_predictions_cache, oneweb_predictions_last_time
    print("Background thread: Computing OneWeb predictions...")
    
    if not satellite_objects_cache:
        return
        
    try:
        predictions = []
        t0 = ts.now()
        t1 = ts.tt_jd(t0.tt + 3/24)
        t_range = ts.linspace(t0, t1, 180) # 1-minute intervals
        
        for norad_id, obj in satellite_objects_cache.items():
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
        print(f"Background thread: OneWeb predictions computed ({len(predictions)} found).")
    except Exception as e:
        print(f"Background thread error computing OneWeb predictions: {e}")

'''

content = content.replace("def background_fetch_loop():", compute_func + "\ndef background_fetch_loop():")

# 2. Add compute_oneweb_predictions_background() to update_watchlist() AND get_cached_satellites()
content = content.replace("update_watchlist() # Build initial watchlist", "update_watchlist()\n        compute_oneweb_predictions_background()")
content = content.replace("update_watchlist()", "update_watchlist()\n                compute_oneweb_predictions_background()")
# remove duplicate we might have just created in get_cached_satellites
content = content.replace("update_watchlist()\n                compute_oneweb_predictions_background()\n        compute_oneweb_predictions_background()", "update_watchlist()\n        compute_oneweb_predictions_background()")

# 3. Simplify the endpoint
old_endpoint = r"@app\.route\('/api/oneweb-predictions'\).*?(?=if __name__ == '__main__':)"
new_endpoint = '''@app.route('/api/oneweb-predictions')
def oneweb_predictions():
    if oneweb_predictions_cache:
        return jsonify(oneweb_predictions_cache)
    return jsonify({"success": False, "error": "Still computing predictions..."})

'''

content = re.sub(old_endpoint, new_endpoint, content, flags=re.DOTALL)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("app.py successfully fixed!")
