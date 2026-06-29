import os
import requests
from dotenv import load_dotenv

load_dotenv()

ST_IDENTITY = os.getenv("SPACE_TRACK_USERNAME")
ST_PASSWORD = os.getenv("SPACE_TRACK_PASSWORD")

login_url = "https://www.space-track.org/ajaxauth/login"
payload = {'identity': ST_IDENTITY, 'password': ST_PASSWORD}
s = requests.Session()
res = s.post(login_url, data=payload)
print("Login status:", res.status_code)
if res.ok:
    query_url = "https://www.space-track.org/basicspacedata/query/class/gp/EPOCH/>now-30/orderby/NORAD_CAT_ID/format/json"
    res2 = s.get(query_url)
    print("Query status:", res2.status_code)
    try:
        data = res2.json()
        print("Data type:", type(data))
        if isinstance(data, list):
            print("List length:", len(data))
            if len(data) > 0:
                print("First element keys:", list(data[0].keys())[:5])
        else:
            print("Data:", data)
    except Exception as e:
        print("Error parsing JSON:", e)
        print("Raw text:", res2.text[:200])
