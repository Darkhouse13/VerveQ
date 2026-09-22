import json,sys
sys.path.insert(0,'/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad')
from tmsearch import search,cache
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
qs=json.load(open(f'{S}/tm_queries.json'))
for i,q in enumerate(qs):
    if q in cache: continue
    r=search(q)
    if i%50==0: print(i,q,len(r),flush=True)
print('DONE',len(cache),flush=True)
