import json,subprocess,sys,time
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
APP='/home/darkhouse/verveq/app'
def run(fn,args):
    out=subprocess.run(['npx','convex','run',fn,json.dumps(args),'--prod'],cwd=APP,capture_output=True,text=True)
    if out.returncode!=0: raise SystemExit(f'FAILED {fn}: {out.stderr[-2000:]}')
    t=out.stdout.strip(); i=t.find('{') if '{' in t else t.find('"')
    try: return json.loads(t[i:]) if i>=0 else t
    except Exception: return t
ev=json.load(open(f'{S}/events.json'))
state_f=f'{S}/apply_state.json'
try: st=json.load(open(state_f))
except Exception: st={'sweepId':None,'done':0,'counts':{'internal':0,'incomingKnown':0,'incomingNew':0,'outgoing':0,'unresolved':0,'alreadySeen':0,'superseded':0},'unresolved':[],'newPlayers':[]}
if st['sweepId'] is None:
    st['sweepId']=run('fantasyTransfers:startSweep',{'kind':'cron','windowFromDay':'2026-08-25','callsPlanned':0}); json.dump(st,open(state_f,'w'))
    print('sweepId',st['sweepId'],flush=True)
CH=50
while st['done']<len(ev):
    chunk=ev[st['done']:st['done']+CH]
    r=run('fantasyTransfers:applyTransferChunk',{'sweepId':st['sweepId'],'events':chunk})
    for k,v in r['counts'].items(): st['counts'][k]+=v
    st['unresolved']+=r['unresolved']; st['newPlayers']+=r['newPlayers']; st['done']+=len(chunk)
    json.dump(st,open(state_f,'w'))
    print(f"{st['done']}/{len(ev)} {r['counts']}",flush=True)
run('fantasyTransfers:finishSweep',{'sweepId':st['sweepId'],'status':'succeeded','callsMade':0,'dailyRemaining':None,'counts':st['counts']})
print('FINISHED',st['counts'],'unresolved',len(st['unresolved']),'created',len(st['newPlayers']))
