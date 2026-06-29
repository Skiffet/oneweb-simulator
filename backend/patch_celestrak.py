import os
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

fallback_code = '''    query_url = "https://www.space-track.org/basicspacedata/query/class/gp/EPOCH/>now-30/orderby/NORAD_CAT_ID/format/json"
    print("Fetching new TLE data from Space-Track...")
    
    data = None
    try:
        res = s.get(query_url, timeout=30)
        if res.ok:
            data = res.json()
            if isinstance(data, list) and len(data) > 0 and 'error' in data[0]:
                print("Space-Track API Error:", data[0]['error'], flush=True)
                data = None
        else:
            print("Failed to fetch TLE data, status:", res.status_code)
    except Exception as e:
        print("Exception fetching TLE data:", e)
        
    if not data:
        print("Falling back to Celestrak API...")
        try:
            import requests as req
            res_c = req.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json', timeout=30)
            if res_c.ok:
                data = res_c.json()
        except Exception as e:
            print("Celestrak fallback failed:", e)
            
    if not data:
        return cached_tle_data if cached_tle_data is not None else []
        
    cached_tle_data = data
    last_fetch_time = datetime.now()
    return data'''

pattern = r'query_url = "https://www\.space-track\.org.*?return data'
content = re.sub(pattern, fallback_code, content, flags=re.DOTALL)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("app.py successfully fixed with Celestrak fallback!")
