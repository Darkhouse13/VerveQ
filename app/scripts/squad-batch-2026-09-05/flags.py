import json,re,unicodedata,collections,time,sys,subprocess
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
GW='th71cr371k16vaa8vhh77hjrdn8c8yv6'
FL=json.load(open(f'{S}/tm_flags.json')); T=json.load(open(f'{S}/tm_clubs.json')); tm2our=T['tm2our']
CM=json.load(open(f'{S}/club_map.json')); FX=json.load(open(f'{S}/gw4_club_fixtures.json'))
R=json.load(open(f'{S}/resolved.json'))
P=[json.loads(l) for l in open(f'{S}/fantasyPlayers.jsonl')]
# apply the batch's club moves in memory
byid={p['_id']:p for p in P}
for m in R['moves']: byid[m['playerId']]['clubId']=m['to']; byid[m['playerId']]['leagueId']=m['toLeague']; byid[m['playerId']]['active']=True
for o in R['out']: byid[o['playerId']]['active']=False
for n in R['new']: P.append({'_id':'new:'+n['tmId'],'providerPlayerId':'tm:'+n['tmId'],'name':n['tmName'],'clubId':n['clubId'],'leagueId':n['leagueId'],'active':True})
tm2player={v:k for k,v in R['tm_of_player'].items()}
for n in R['new']: tm2player[n['tmId']]='new:'+n['tmId']
byid={p['_id']:p for p in P}
TR=str.maketrans({'ı':'i','ø':'o','ß':'ss','ł':'l','đ':'d','æ':'ae','œ':'oe','ð':'d'})
def norm(s):
    s=(s or '').translate(TR); s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace("'",'').replace('-',' ')
    return re.sub(r'\s+',' ',re.sub(r'[^a-z ]',' ',s)).strip()
def our_parts(name):
    n=norm(name); m=re.match(r'^([a-z]) (.+)$',n)
    if re.match(r'^[A-Z]\.',name) and m: return m.group(1),m.group(2),None
    t=n.split(); return (None,n,n) if len(t)==1 else (t[0][0],' '.join(t[1:]),None)
def match_in_club(tmname,clubId):
    t=norm(tmname); toks=t.split(); hits=[]
    for p in P:
        if p['clubId']!=clubId or not p['active']: continue
        init,sur,mono=our_parts(p['name'])
        if mono and (mono==t or mono in toks): hits.append(p)
        elif sur and (t.endswith(' '+sur) or set(sur.split())<=set(toks)) and (init is None or toks[0][0]==init): hits.append(p)
        elif norm(p['name'])==t: hits.append(p)
    return hits
now=time.time()*1000
def fixture_for(clubId):
    fx=FX.get(clubId) or []
    up=[f for f in fx if f['kickoffAt']>=now-3*3600*1000]
    return (up or fx)[-1] if fx else None
def parse_until(s):
    m=re.match(r'(\d\d)/(\d\d)/(\d{4})',s or ''); 
    return time.mktime((int(m.group(3)),int(m.group(2)),int(m.group(1)),12,0,0,0,0,0))*1000 if m else None
recs=collections.defaultdict(dict); routed=collections.Counter(); unusable=collections.Counter(); unres=[]
for f in FL:
    clubId=tm2our.get(f['clubTmId'])
    if clubId is None: unusable[f['league']]+=1; continue
    pid=tm2player.get(f['tmId']); p=byid.get(pid) if pid else None
    if p is None:
        hits=match_in_club(f['name'],clubId)
        if len(hits)==1: p=hits[0]
        elif not hits:
            # maybe the player sits at another club in our db (TM club newer than ours) -> report
            unres.append((f['name'],f['club'],f['reason'])); routed[CM[clubId]['leagueId']]+=1; continue
        else: unres.append((f['name'],f['club'],'ambiguous')); routed[CM[clubId]['leagueId']]+=1; continue
    fx=fixture_for(p['clubId'])
    if fx is None: unusable[p['leagueId']]+=1; continue
    until=parse_until(f['until'])
    if f['kind']=='suspension': status,cat='out','suspension'
    else: status,cat=('doubtful' if until and until<fx['kickoffAt'] else 'out'),'injury'
    reason=f['reason'] or None
    rec={'providerPlayerId':p['providerPlayerId'],'providerFixtureId':fx['providerFixtureId'],'status':status,'category':cat,'reason':reason,'rawType':f"tm:{f['kind']}{(' until '+f['until']) if f['until'] else ''}"}
    L=p['leagueId']; routed[L]+=1
    cur=recs[L].get(p['providerPlayerId'])
    if cur is None or (cur['status']=='doubtful' and status=='out'): recs[L][p['providerPlayerId']]=rec
print('records per league',{L:len(v) for L,v in recs.items()},'routed',dict(routed),'unusable',dict(unusable),'unresolved',len(unres))
print('status',collections.Counter(r['status'] for v in recs.values() for r in v.values()),'cat',collections.Counter(r['category'] for v in recs.values() for r in v.values()))
for u in unres: print('  UNRES',u)
plan={str(L):{'gameweekId':GW,'leagueId':L,'records':sorted(v.values(),key=lambda r:r['providerPlayerId']),'rowsInFeed':routed[L]+unusable[L],'unusable':unusable[L]} for L,v in recs.items()}
json.dump(plan,open(f'{S}/availability_plan.json','w'),ensure_ascii=False,indent=0)
if '--apply' in sys.argv:
    for L,args in plan.items():
        out=subprocess.run(['npx','convex','run','fantasyAvailability:applyLeagueAvailability',json.dumps(args),'--prod'],cwd='/home/darkhouse/verveq/app',capture_output=True,text=True)
        print(L,out.stdout.strip()[-300:],out.stderr.strip()[-300:] if out.returncode else '',flush=True)
