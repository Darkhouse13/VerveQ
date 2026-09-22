import json,re,unicodedata,collections,difflib
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
P=[json.loads(l) for l in open(f'{S}/fantasyPlayers.jsonl')]
R=json.load(open(f'{S}/espn/rosters.json'))
CM=json.load(open(f'{S}/club_map.json'))
espn2club={v['espnId']:cid for cid,v in CM.items()}
TR=str.maketrans({'ı':'i','ø':'o','Ø':'o','ß':'ss','ł':'l','Ł':'l','đ':'d','Đ':'d','æ':'ae','Æ':'ae','œ':'oe','Œ':'oe','þ':'th','ð':'d','Ð':'d','ħ':'h','ŀ':'l','ı':'i'})
def norm(s):
    s=(s or '').translate(TR)
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    s=s.replace("'",'').replace('-',' ')
    return re.sub(r'\s+',' ',re.sub(r'[^a-z ]',' ',s)).strip()
def our_parts(name):
    n=norm(name); m=re.match(r'^([a-z])\.? (.+)$',norm(name.replace('.','. ')))
    if re.match(r'^[A-Z]\.',name) and m: return {'init':m.group(1),'sur':m.group(2),'full':n,'mono':None}
    toks=n.split()
    if len(toks)==1: return {'init':None,'sur':n,'full':n,'mono':n}
    return {'init':toks[0][0],'sur':' '.join(toks[1:]),'full':n,'mono':None}
def espn_parts(a):
    full=norm(a['fullName']); disp=norm(a['displayName']); short=norm(a['shortName']); first=norm(a['first']); last=norm(a['last'])
    toks=full.split()
    return {'full':full,'disp':disp,'short':short,'first':first,'last':last,'init':(first[:1] or (toks[0][0] if toks else None)),'toks':set(toks)|set(disp.split())}
def score(o,e):
    # returns level (lower better) or None
    if o['full'] and o['full'] in (e['short'],e['disp'],e['full']): return 1
    if o['sur'] and o['sur']==e['last'] and o['init'] and o['init']==e['init']: return 2
    if o['sur'] and o['init'] and o['init']==e['init'] and (e['full'].endswith(' '+o['sur']) or e['disp'].endswith(' '+o['sur']) or set(o['sur'].split())<=e['toks']): return 3
    if o['mono'] and (o['mono'] in e['toks'] or o['mono']==e['disp']): return 4
    if o['sur'] and (o['sur']==e['last'] or e['full'].endswith(' '+o['sur']) or e['disp'].endswith(' '+o['sur'])): return 5
    if o['sur'] and o['init'] and o['init']==e['init'] and (o['sur'].split()[-1] in e['toks']): return 6
    if o['sur'] and o['init'] and o['init']==e['init'] and e['last'] and difflib.SequenceMatcher(None,o['sur'].split()[-1],e['last'].split()[-1] if e['last'] else '').ratio()>=0.8: return 7
    if o['sur'] and o['init'] and o['init']==e['init'] and difflib.SequenceMatcher(None,o['sur'],e['full'][len(e['first'])+1:] if e['full'].startswith(e['first']+' ') else e['full']).ratio()>=0.85: return 7
    return None
def greedy(ours,theirs):
    """ours: list of (key,parts) theirs: list of (key,parts). returns matches dict okey->tkey, level"""
    matched={}; usedT=set()
    for lvl in (1,2,3,4,5,6,7):
        cand=collections.defaultdict(list)
        for ok,op in ours:
            if ok in matched: continue
            for tk,tp in theirs:
                if tk in usedT: continue
                if score(op,tp)==lvl: cand[ok].append(tk)
        rev=collections.defaultdict(list)
        for ok,tks in cand.items():
            for tk in tks: rev[tk].append(ok)
        for ok,tks in cand.items():
            if len(tks)==1 and len(rev[tks[0]])==1:
                matched[ok]=(tks[0],lvl); usedT.add(tks[0])
    return matched
ours_by_club=collections.defaultdict(list)
for p in P:
    if p['active']: ours_by_club[p['clubId']].append(p)
espn_by_club={}
for t in R: espn_by_club[espn2club[t['espnId']]]=t
allA={a['id']:(a,t) for t in R for a in t['athletes']}
matches={}   # our _id -> (espn athlete id, level, sameclub)
left=[]; arrived=[]
for cid,t in espn_by_club.items():
    ours=[(p['_id'],our_parts(p['name'])) for p in ours_by_club.get(cid,[])]
    theirs=[(a['id'],espn_parts(a)) for a in t['athletes']]
    m=greedy(ours,theirs)
    for ok,(tk,l) in m.items(): matches[ok]=(tk,l,True)
    left+=[p for p in ours_by_club.get(cid,[]) if p['_id'] not in m]
    got={v[0] for v in m.values()}
    arrived+=[(a,cid) for a in t['athletes'] if a['id'] not in got]
print('active',sum(len(v) for v in ours_by_club.values()),'matched same club',len(matches),'left',len(left),'arrived',len(arrived))
print('levels',collections.Counter(v[1] for v in matches.values()))
# cross-club: arrived vs (left + inactive players)
inactive=[p for p in P if not p['active']]
pool=[(p['_id'],our_parts(p['name'])) for p in left+inactive]
theirs=[(a['id'],espn_parts(a)) for a,c in arrived]
m2=greedy(pool,theirs)
byid={p['_id']:p for p in P}
arrivedClub={a['id']:c for a,c in arrived}
moves=[]; 
for ok,(tk,l) in m2.items():
    p=byid[ok]; a=allA[tk][0]; moves.append({'playerId':ok,'providerPlayerId':p['providerPlayerId'],'name':p['name'],'from':p['clubId'],'fromLeague':p['leagueId'],'to':arrivedClub[tk],'toLeague':CM[arrivedClub[tk]]['leagueId'],'espn':a['fullName'],'espnId':tk,'level':l,'wasActive':p['active'],'price':p['price']})
moved_ids={m['playerId'] for m in moves}; moved_espn={m['espnId'] for m in moves}
outgoing=[p for p in left if p['_id'] not in moved_ids]
new=[(a,c) for a,c in arrived if a['id'] not in moved_espn]
print('moves',len(moves),'(reactivated',sum(1 for m in moves if not m['wasActive']),') outgoing candidates',len(outgoing),'new candidates',len(new))
print('outgoing by price',collections.Counter(p['price'] for p in outgoing).most_common())
print('new by pos',collections.Counter(a['pos'] for a,c in new))
json.dump({'matches':matches,'moves':moves,'outgoing':[{k:p[k] for k in ('_id','providerPlayerId','name','clubId','leagueId','price','feedPosition')} for p in outgoing],'new':[{'espnId':a['id'],'name':a['fullName'],'display':a['displayName'],'pos':a['pos'],'dob':a['dob'],'clubId':c,'leagueId':CM[c]['leagueId'],'club':CM[c]['ourName']} for a,c in new]},open(f'{S}/diff.json','w'),indent=1,ensure_ascii=False)
print('\nSAMPLE MOVES'); 
for m in sorted(moves,key=lambda m:-(m['price'] or 0))[:25]: print(f"  {m['name']:<22} {m['price']}  {CM[m['from']]['ourName']:<22} -> {CM[m['to']]['ourName']:<22} ({m['espn']}, L{m['level']}{'' if m['wasActive'] else ', was inactive'})")
print('\nSAMPLE OUTGOING (highest price)')
for p in sorted(outgoing,key=lambda p:-(p['price'] or 0))[:30]: print(f"  {p['name']:<22} {p['price']}  {CM[p['clubId']]['ourName']}")
print('\nSAMPLE NEW')
for a,c in new[:20]: print(f"  {a['fullName']:<26} {a['pos']}  {CM[c]['ourName']}  dob {str(a['dob'])[:10]}")
