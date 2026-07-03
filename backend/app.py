import os
import math
import requests
import numpy as np
import threading
import time
from flask import Flask, jsonify, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from skyfield.api import load, EarthSatellite, wgs84
from datetime import datetime, timezone, timedelta
from rigorous_math import calculate_footprint_polygon

load_dotenv()

app = Flask(__name__)
CORS(app)

# Constants for Thailand Bounding Box
THAILAND_BOUNDS = {
    'minLat': 5.612851,
    'maxLat': 20.464834,
    'minLon': 97.343807,
    'maxLon': 105.636812
}

# Initialize Skyfield timescale and load ephemeris
ts = load.timescale()
eph = load('de421.bsp')
BKK = wgs84.latlon(13.7563, 100.5018)

ST_IDENTITY = os.getenv("SPACE_TRACK_USERNAME")
ST_PASSWORD = os.getenv("SPACE_TRACK_PASSWORD")

session = None
cached_tle_data = None
last_fetch_time = None
satellite_objects_cache = {}  # norad_id -> {'sat': EarthSatellite, 'data': dict}

def get_space_track_session():
    global session
    if session is not None:
        return session
    
    login_url = "https://www.space-track.org/ajaxauth/login"
    payload = {'identity': ST_IDENTITY, 'password': ST_PASSWORD}
    s = requests.Session()
    res = s.post(login_url, data=payload)
    if res.ok:
        session = s
        return session
    else:
        print("Space-Track login failed!")
        return None

def fetch_tle_data():
    global last_fetch_time
    now = datetime.now()
    
    s = get_space_track_session()
    
    query_url = "https://www.space-track.org/basicspacedata/query/class/gp/EPOCH/>now-30/orderby/NORAD_CAT_ID/format/json"
    print("Fetching new TLE data from Space-Track...")
    res = s.get(query_url) if s else None
    if not res or not res.ok:
        print("Failed to fetch TLE data from Space-Track. Trying local cache...")
        import json
        import os
        cache_path = os.path.join(os.path.dirname(__file__), '.cache', 'tle_data.json')
        if os.path.exists(cache_path):
            with open(cache_path, 'r') as f:
                cached_tle_data = json.load(f)
                last_fetch_time = now
                return cached_tle_data
        print("Local cache not found. Fetching from Celestrak...")
        import requests
        res = requests.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json')
        if not res.ok:
            return []
        cached_tle_data = res.json()
        last_fetch_time = now
        
    else:
        cached_tle_data = res.json()
        last_fetch_time = now
    
    # Save to local cache for offline use
    import json
    import os
    cache_dir = os.path.join(os.path.dirname(__file__), '.cache')
    os.makedirs(cache_dir, exist_ok=True)
    with open(os.path.join(cache_dir, 'tle_data.json'), 'w') as f:
        json.dump(cached_tle_data, f)
        
    return cached_tle_data

# Global cache for the instant API response
global_api_cache = {'true': None, 'false': None}

def background_fetch_loop():
    """Runs in the background, downloading and parsing TLEs so user requests never block."""
    global last_fetch_time, satellite_objects_cache
    with open('debug.log', 'a') as f: f.write("bg fetch thread started\n")
    while True:
        try:
            # Force cache refresh in the background
            last_fetch_time = None
            with open('debug.log', 'a') as f: f.write("calling fetch_tle_data\n")
            data = fetch_tle_data()
            with open('debug.log', 'a') as f: f.write(f"fetch_tle_data returned {len(data) if data else 0} items\n")
            if data:
                new_sat_cache = {}
                for tle in data:
                    try:
                        norad_id = str(tle.get("NORAD_CAT_ID", ""))
                        if not norad_id: continue
                        line1, line2 = tle.get("TLE_LINE1"), tle.get("TLE_LINE2")
                        if not line1 or not line2: continue
                        
                        name = tle.get("OBJECT_NAME", "Unknown")
                        sat = EarthSatellite(line1, line2, name, ts)
                        new_sat_cache[norad_id] = {'sat': sat, 'data': tle}
                    except Exception:
                        continue
                satellite_objects_cache = new_sat_cache
                with open('debug.log', 'a') as f: f.write(f"Updated satellite_objects_cache with {len(satellite_objects_cache)} items\n")
        except Exception as e:
            with open('debug.log', 'a') as f: f.write(f"Background fetch error: {e}\n")
            print(f"Background fetch error: {e}")
        time.sleep(600)  # Sleep for 10 minutes

def background_calc_loop():
    """Runs continuously in the background to pre-calculate all satellite positions and footprints."""
    global satellite_objects_cache, global_api_cache
    
    while True:
        try:
            if not satellite_objects_cache:
                time.sleep(1)
                continue
                
            t = ts.now()
            results_true = []
            results_false = []
            
            for norad_id, obj in satellite_objects_cache.items():
                try:
                    sat = obj['sat']
                    tle = obj['data']
                    name = tle.get("OBJECT_NAME", "Unknown")
                    
                    geocentric = sat.at(t)
                    subpoint = geocentric.subpoint()
                    lat = subpoint.latitude.degrees
                    lon = subpoint.longitude.degrees
                    
                    # Use strict boundaries logic
                    is_in_thailand = (THAILAND_BOUNDS['minLat'] <= lat <= THAILAND_BOUNDS['maxLat'] and
                                      THAILAND_BOUNDS['minLon'] <= lon <= THAILAND_BOUNDS['maxLon'])
                    
                    is_oneweb_plane = False
                    if "ONEWEB" in name.upper():
                        if -25 <= lat <= 50 and (THAILAND_BOUNDS['minLon'] - 30) <= lon <= (THAILAND_BOUNDS['maxLon'] + 30):
                            is_oneweb_plane = True
                    
                    if is_in_thailand or is_oneweb_plane:
                        alt = subpoint.elevation.km
                        speed_kms = np.linalg.norm(geocentric.velocity.km_per_s)
                        speed_kmh = speed_kms * 3600
                        apogee = float(tle.get("APOAPSIS") or tle.get("APOGEE") or 0)
                        perigee = float(tle.get("PERIAPSIS") or tle.get("PERIGEE") or 0)
                        inclination = float(tle.get("INCLINATION") or 0)
                        period = float(tle.get("PERIOD") or 0)
                        launch_date = tle.get("LAUNCH_DATE", "")
                        launch_year = launch_date.split("-")[0] if launch_date else "Unknown"
                        country_code = tle.get("COUNTRY_CODE", "UNK")
                        object_type = tle.get("OBJECT_TYPE", "UNKNOWN")
                        
                        footprint_polygon, local_elev, true_width, true_height = calculate_footprint_polygon(lat, lon, alt, 1600.0, 1024.0, use_real_elevation=is_in_thailand)
                        
                        strips = []
                        is_turned_off = False
                        pitch_offset_km = 0.0
                        if "ONEWEB" in name.upper():
                            from rigorous_math import calculate_oneweb_strips
                            import math
                            # Compute heading by propagating 1 second into future
                            t1 = ts.utc(t.utc_datetime() + timedelta(seconds=1))
                            lat1 = sat.at(t1).subpoint().latitude.degrees
                            lon1 = sat.at(t1).subpoint().longitude.degrees
                            d_lon = math.radians(lon1 - lon)
                            d_lat = math.radians(lat1 - lat)
                            heading_rad = math.atan2(d_lon * math.cos(math.radians(lat)), d_lat)
                            
                            # Progressive Pitch & Turn Off Logic
                            if -5.0 <= lat <= 5.0:
                                is_turned_off = True
                            elif 5.0 < abs(lat) <= 20.0:
                                pitch_magnitude = 210.0 * ((20.0 - abs(lat)) / 15.0)
                                sign_lat = 1 if lat >= 0 else -1
                                sign_heading = 1 if math.cos(heading_rad) >= 0 else -1
                                pitch_offset_km = -pitch_magnitude * sign_lat * sign_heading

                            strips = calculate_oneweb_strips(lat, lon, heading_rad, pitch_offset_km)
                        
                        sat_payload = {
                            "name": name,
                            "noradId": norad_id,
                            "lat": round(float(lat), 4),
                            "lon": round(float(lon), 4),
                            "alt": round(float(alt), 4),
                            "velocityKms": round(float(speed_kms), 4),
                            "velocityKmh": round(float(speed_kmh), 4),
                            "apogee": round(apogee, 4),
                            "perigee": round(perigee, 4),
                            "inclination": round(inclination, 4),
                            "period": round(period, 4),
                            "launchYear": launch_year,
                            "countryCode": country_code,
                            "objectType": object_type,
                            "isAdjacent": not is_in_thailand,
                            "footprint": footprint_polygon,
                            "strips_polygon": strips,
                            "isTurnedOff": is_turned_off,
                            "pitchOffsetKm": pitch_offset_km,
                            "localElevKm": local_elev,
                            "trueWidthKm": true_width,
                            "trueHeightKm": true_height
                        }
                        # Add to True list if it's OneWeb or in Thailand
                        results_true.append(sat_payload)
                        # Add to False list ONLY if it's in Thailand
                        if is_in_thailand:
                            results_false.append(sat_payload)
                            
                except Exception:
                    continue
            
            timestamp = datetime.now().isoformat()
            global_api_cache['true'] = {
                "success": True, "count": len(results_true),
                "timestamp": timestamp, "satellites": results_true
            }
            global_api_cache['false'] = {
                "success": True, "count": len(results_false),
                "timestamp": timestamp, "satellites": results_false
            }
            
            time.sleep(3)  # Pre-calculate every 3 seconds
        except Exception as e:
            import traceback
            with open('error.log', 'a') as f:
                f.write(traceback.format_exc() + '\n')
            time.sleep(3)

# Start the background fetching thread
bg_thread = threading.Thread(target=background_fetch_loop, daemon=True)
bg_thread.start()

# Start the background calculation thread
calc_thread = threading.Thread(target=background_calc_loop, daemon=True)
calc_thread.start()

def get_cached_satellites():
    global satellite_objects_cache
    
    data = fetch_tle_data()
    if not data: return {}
    
    # Rebuild cache if data length changed (e.g. tests or very first load)
    if len(satellite_objects_cache) != len(data):
        new_sat_cache = {}
        for tle in data:
            try:
                norad_id = str(tle.get("NORAD_CAT_ID", ""))
                if not norad_id: continue
                line1, line2 = tle.get("TLE_LINE1"), tle.get("TLE_LINE2")
                if not line1 or not line2: continue
                
                name = tle.get("OBJECT_NAME", "Unknown")
                sat = EarthSatellite(line1, line2, name, ts)
                new_sat_cache[norad_id] = {'sat': sat, 'data': tle}
            except Exception:
                continue
        satellite_objects_cache = new_sat_cache
        
    return satellite_objects_cache

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/debug')
def api_debug():
    global satellite_objects_cache, global_api_cache
    return jsonify({
        "sat_cache_len": len(satellite_objects_cache) if satellite_objects_cache else 0,
        "global_api_cache_true": global_api_cache['true'] is not None,
        "global_api_cache_false": global_api_cache['false'] is not None
    })

@app.route('/api/satellites')
def api_satellites():
    import time
    start = time.time()
    from flask import request
    show_oneweb = request.args.get('oneweb_planes', 'false').lower() == 'true'
    cache_key = 'true' if show_oneweb else 'false'
    
    if global_api_cache[cache_key] is not None:
        res = jsonify(global_api_cache[cache_key])
        print(f"API served in {time.time() - start:.4f}s")
        return res
    else:
        return jsonify({"success": False, "error": "System is warming up, please wait a few seconds..."})

@app.route('/api/satellite/<norad_id>')
def api_satellite_detail(norad_id):
    sat_cache = get_cached_satellites()
    obj = sat_cache.get(str(norad_id))
    if not obj:
        return jsonify({"success": False, "error": "Satellite not found"})
        
    try:
        sat = obj['sat']
        tle = obj['data']
        
        now = datetime.now(timezone.utc)
        t_now = ts.from_datetime(now)
        
        # 1. Sunlit Check
        is_sunlit = bool(sat.at(t_now).is_sunlit(eph))
        
        # 2. Azimuth & Elevation
        difference = sat - BKK
        topocentric = difference.at(t_now)
        alt, az, distance = topocentric.altaz()
        
        # 3. Revolutions per Day
        mean_motion = float(tle.get("MEAN_MOTION") or 0)
        
        # 4. Ground track: -10 to +90 mins, every 3 mins
        times = [now + timedelta(minutes=i) for i in range(-10, 91, 3)]
        t_array = ts.from_datetimes(times)

        positions = sat.at(t_array)
        subpoints = positions.subpoint()
        lats = subpoints.latitude.degrees
        lons = subpoints.longitude.degrees

        path = [[round(float(lat), 4), round(float(lon), 4)] for lat, lon in zip(lats, lons)]
        
        # 5. Airspace Calculation (-30 to +90 mins)
        times_eval = [now + timedelta(minutes=i) for i in range(-30, 91)]
        t_eval = ts.from_datetimes(times_eval)
        pos_eval = sat.at(t_eval).subpoint()
        lats_eval = pos_eval.latitude.degrees
        lons_eval = pos_eval.longitude.degrees
        
        # Pure NumPy Vectorization for Bounding Box Math
        in_bounds = (lats_eval >= THAILAND_BOUNDS['minLat']) & (lats_eval <= THAILAND_BOUNDS['maxLat']) & \
                    (lons_eval >= THAILAND_BOUNDS['minLon']) & (lons_eval <= THAILAND_BOUNDS['maxLon'])
        
        airspace = {"status": "none", "entry_in": None, "exit_in": None, "duration": None}
        now_idx = 30
        
        if in_bounds[now_idx]:
            airspace["status"] = "inside"
            
            future_bounds = in_bounds[now_idx+1:]
            if not future_bounds.all() and len(future_bounds) > 0:
                exit_idx = now_idx + 1 + int(np.argmin(future_bounds))
                airspace["exit_in"] = exit_idx - now_idx
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
        
        # 6. Pass Prediction (next 5 passes over Bangkok, min elevation 10°)
        passes = []
        try:
            t0 = ts.from_datetime(now)
            t1 = ts.from_datetime(now + timedelta(days=3))
            t_ev, events = sat.find_events(BKK, t0, t1, altitude_degrees=10.0)
            cur = {}
            for ti, ev in zip(t_ev, events):
                dt = ti.utc_datetime()
                if ev == 0:
                    cur = {'aos': dt.isoformat(), 'aos_ts': dt.timestamp()}
                elif ev == 1:
                    topo = (sat - BKK).at(ti)
                    el, az_p, _ = topo.altaz()
                    cur['tca'] = dt.isoformat()
                    cur['max_el'] = round(float(el.degrees), 1)
                    cur['az_peak'] = round(float(az_p.degrees), 1)
                elif ev == 2:
                    if 'aos_ts' in cur and 'max_el' in cur:
                        cur['los'] = dt.isoformat()
                        cur['duration_min'] = round((dt.timestamp() - cur['aos_ts']) / 60, 1)
                        cur['in_min'] = int((cur['aos_ts'] - now.timestamp()) / 60)
                        del cur['aos_ts']
                        passes.append(cur)
                        if len(passes) >= 5:
                            break
                    cur = {}
        except Exception:
            passes = []

        return jsonify({
            "success": True,
            "sunlit": is_sunlit,
            "elevation": round(float(alt.degrees), 4),
            "azimuth": round(float(az.degrees), 4),
            "distance": round(float(distance.km), 4),
            "revolutions": round(mean_motion, 4),
            "path": path,
            "airspace": airspace,
            "passes": passes
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/api/oneweb-predictions')
def api_oneweb_predictions():
    sat_cache = get_cached_satellites()
    if not sat_cache:
        return jsonify({"success": False, "error": "No data"})
        
    onewebs = [obj for obj in sat_cache.values() if "ONEWEB" in obj['data'].get("OBJECT_NAME", "").upper()]
    
    now = datetime.now(timezone.utc)
    times_eval = [now + timedelta(minutes=i) for i in range(1, 91)]
    t_eval = ts.from_datetimes(times_eval)
    
    predictions = []
    
    for obj in onewebs:
        try:
            sat = obj['sat']
            name = obj['data'].get("OBJECT_NAME", "Unknown")
            norad_id = str(obj['data'].get("NORAD_CAT_ID", ""))
            
            pos_eval = sat.at(t_eval).subpoint()
            lats = pos_eval.latitude.degrees
            lons = pos_eval.longitude.degrees
            
            in_bounds = (lats >= THAILAND_BOUNDS['minLat']) & (lats <= THAILAND_BOUNDS['maxLat']) & \
                        (lons >= THAILAND_BOUNDS['minLon']) & (lons <= THAILAND_BOUNDS['maxLon'])
                         
            if in_bounds.any():
                first_idx = int(np.argmax(in_bounds))
                entry_in = first_idx + 1
                
                # Count consecutive True values from first_idx
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
    
    return jsonify({
        "success": True,
        "count": len(predictions),
        "timestamp": datetime.now().isoformat(),
        "predictions": predictions
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
