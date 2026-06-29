import os
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

fallback_code = '''        print("Falling back to Celestrak API (OneWeb + Starlink)...")
        try:
            import requests as req
            combined_data = []
            res_ow = req.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=json', timeout=30)
            if res_ow.ok:
                try: combined_data.extend(res_ow.json())
                except: pass
            res_sl = req.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json', timeout=30)
            if res_sl.ok:
                try: combined_data.extend(res_sl.json())
                except: pass
                
            if combined_data:
                data = combined_data
        except Exception as e:
            print("Celestrak fallback failed:", e)'''

pattern = r'        print\("Falling back to Celestrak API\.\.\."\).*?print\("Celestrak fallback failed:", e\)'
content = re.sub(pattern, fallback_code, content, flags=re.DOTALL)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("app.py successfully fixed with Celestrak OneWeb+Starlink fallback!")
