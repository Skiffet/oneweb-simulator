import requests

# 1. Check if HTML contains the updated fetch URL
print("Checking HTML...")
html = requests.get('http://localhost:5000/').text
if 'oneweb_planes=${showOneweb}' in html:
    print("SUCCESS: Frontend HTML correctly has the toggle logic.")
else:
    print("ERROR: Frontend HTML is missing the toggle logic.")

# 2. Check if API returns adjacent OneWeb satellites
print("\nChecking API...")
data = requests.get('http://localhost:5000/api/satellites?oneweb_planes=true').json()
if data['success']:
    sats = data['satellites']
    adjacent = [s for s in sats if s.get('isAdjacent')]
    if adjacent:
        print(f"SUCCESS: API returned {len(adjacent)} adjacent OneWeb satellites.")
        print(f"Sample: {adjacent[0]['name']} at {adjacent[0]['lon']} lon")
    else:
        print("ERROR: API returned NO adjacent OneWeb satellites.")
else:
    print("ERROR: API returned error.")
