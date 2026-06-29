import os
import re

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

fallback_code = '''        print("Falling back to Celestrak API (OneWeb + Starlink TLEs)...")
        try:
            import requests as req
            def parse_celestrak_tle(text):
                lines = text.strip().split('\\n')
                result = []
                for i in range(0, len(lines), 3):
                    if i + 2 >= len(lines): break
                    name = lines[i].strip()
                    line1 = lines[i+1].strip()
                    line2 = lines[i+2].strip()
                    if len(line1) >= 68 and len(line2) >= 68:
                        norad_id = line2[2:7].strip()
                        result.append({
                            "OBJECT_NAME": name,
                            "NORAD_CAT_ID": norad_id,
                            "TLE_LINE1": line1,
                            "TLE_LINE2": line2
                        })
                return result
                
            combined_data = []
            res_ow = req.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=tle', timeout=30)
            if res_ow.ok:
                combined_data.extend(parse_celestrak_tle(res_ow.text))
            res_sl = req.get('https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle', timeout=30)
            if res_sl.ok:
                combined_data.extend(parse_celestrak_tle(res_sl.text))
                
            if combined_data:
                data = combined_data
        except Exception as e:
            print("Celestrak fallback failed:", e)'''

pattern = r'        print\("Falling back to Celestrak API \(OneWeb \+ Starlink\)\.\.\."\).*?print\("Celestrak fallback failed:", e\)'
content = re.sub(pattern, fallback_code, content, flags=re.DOTALL)

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)
print("app.py successfully fixed with Celestrak TLE parsing fallback!")
