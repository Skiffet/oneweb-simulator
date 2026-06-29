import time
import requests

start = time.time()
res = requests.get('http://localhost:5000/api/satellites')
print("Time taken:", time.time() - start)
