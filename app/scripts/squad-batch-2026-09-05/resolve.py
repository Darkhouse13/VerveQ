import json,re,unicodedata,collections,sys,os
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
sys.path.insert(0,S)
D=json.load(open(f'{S}/diff.json'))
C=json.load(open(f'{S}/tm_search_cache.json'))
CM=json.load(open(f'{S}/club_map.json'))
T=json.load(open(f'{S}/tm_clubs.json')); tm2our=T['tm2our']
P=[json.loads(l) for l in open(f'{S}/fantasyPlayers.jsonl')]; byid={p['_id']:p for p in P}
TR=str.maketrans({'ı':'i','ø':'o','ß':'ss','ł':'l','đ':'d','æ':'ae','œ':'oe','ð':'d'})
def norm(s):
    s=(s or '').translate(TR).replace('&amp;','&'); s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace("'",'').replace('-',' ')
    return re.sub(r'\s+',' ',re.sub(r'[^a-z ]',' ',s)).strip()
def our_parts(name):
    n=norm(name); m=re.match(r'^([a-z]) (.+)$',n)
    if re.match(r'^[A-Z]\.',name) and m: return m.group(1),m.group(2),None
    t=n.split()
    if len(t)==1: return None,n,n
    return t[0][0],' '.join(t[1:]),None
def q_for_our(name):
    n=name.translate(TR); m=re.match(r'^[A-Z]\.\s+(.+)$',n); return (m.group(1) if m else n).strip()
def name_match(init,sur,mono,tmname):
    t=norm(tmname); toks=t.split()
    if mono: return mono==t or mono in toks
    if not sur: return False
    if not (t.endswith(' '+sur) or t==sur or set(sur.split())<=set(toks)): return False
    return init is None or (toks and toks[0][0]==init)
def full_match(full,tmname):
    a=norm(full); b=norm(tmname)
    if a==b: return True
    ta,tb=a.split(),b.split()
    return len(ta)>=2 and len(tb)>=2 and ta[0]==tb[0] and ta[-1]==tb[-1]
def results(q):
    r=C.get(q)
    if r is None: return None
    return r
truncated=lambda r: len(r)>=10
NONCLUB={'75','4023'}  # Unknown / --- (515 = Without Club is a real release)
report=collections.defaultdict(list)
confirmed_moves=[]; confirmed_out=[]; confirmed_new=[]; keep=[]; unresolved=[]
tm_of_player={}  # our _id -> tmId
used_tm=set()
# 1. moves (ESPN cross-club matches)
extra_new=[]
for m in D['moves']:
    init,sur,mono=our_parts(m['name']); r=results(q_for_our(m['name']))
    if r is None: unresolved.append(('move','no-search',m)); continue
    cands=[x for x in r if name_match(init,sur,mono,x['name'])]
    at_dest=[x for x in cands if tm2our.get(x['clubTmId'])==m['to']]
    at_src=[x for x in cands if tm2our.get(x['clubTmId'])==m['from']]
    if at_dest:
        x=at_dest[0]; confirmed_moves.append({**m,'tmId':x['tmId'],'tmName':x['name'],'tmClub':x['club']}); tm_of_player[m['playerId']]=x['tmId']; used_tm.add(x['tmId'])
    elif at_src:
        keep.append({**m,'why':'TM says still at source club','tm':at_src[0]}); tm_of_player[m['playerId']]=at_src[0]['tmId']; used_tm.add(at_src[0]['tmId'])
        extra_new.append(m)   # the ESPN athlete at dest is someone else
    elif cands and not truncated(r):
        other=[x for x in cands if tm2our.get(x['clubTmId'])]
        if len(other)==1:
            x=other[0]; confirmed_moves.append({**m,'to':tm2our[x['clubTmId']],'toLeague':CM[tm2our[x['clubTmId']]]['leagueId'],'tmId':x['tmId'],'tmName':x['name'],'tmClub':x['club'],'note':'dest corrected by TM'}); tm_of_player[m['playerId']]=x['tmId']; used_tm.add(x['tmId'])
        elif not other and len(cands)==1 and cands[0]['clubTmId'] not in NONCLUB:
            x=cands[0]; confirmed_out.append({'playerId':m['playerId'],'providerPlayerId':m['providerPlayerId'],'name':m['name'],'clubId':m['from'],'leagueId':m['fromLeague'],'price':m['price'],'tmId':x['tmId'],'tmName':x['name'],'tmClub':x['club']}); tm_of_player[m['playerId']]=x['tmId']; used_tm.add(x['tmId'])
            extra_new.append(m)
        else: unresolved.append(('move','ambiguous',m,cands))
    else: unresolved.append(('move','no-candidate' if not cands else 'truncated',m,cands))
# 2. outgoing candidates
for o in D['outgoing']:
    init,sur,mono=our_parts(o['name']); r=results(q_for_our(o['name']))
    if r is None: unresolved.append(('out','no-search',o)); continue
    cands=[x for x in r if name_match(init,sur,mono,x['name'])]
    at_cur=[x for x in cands if tm2our.get(x['clubTmId'])==o['clubId']]
    covered=[x for x in cands if tm2our.get(x['clubTmId']) and tm2our.get(x['clubTmId'])!=o['clubId']]
    if at_cur:
        keep.append({**o,'why':'TM confirms current club (ESPN omission)','tm':at_cur[0]}); tm_of_player[o['_id']]=at_cur[0]['tmId']; used_tm.add(at_cur[0]['tmId'])
    elif len(covered)==1:
        x=covered[0]; to=tm2our[x['clubTmId']]
        confirmed_moves.append({'playerId':o['_id'],'providerPlayerId':o['providerPlayerId'],'name':o['name'],'from':o['clubId'],'fromLeague':o['leagueId'],'to':to,'toLeague':CM[to]['leagueId'],'price':o['price'],'tmId':x['tmId'],'tmName':x['name'],'tmClub':x['club'],'wasActive':True,'note':'move found by TM only'}); tm_of_player[o['_id']]=x['tmId']; used_tm.add(x['tmId'])
    elif len(covered)>1: unresolved.append(('out','ambiguous-covered',o,covered))
    elif cands and (len(cands)==1 or not truncated(r)) and cands[0]['clubTmId'] not in NONCLUB:
        x=cands[0]; confirmed_out.append({'playerId':o['_id'],'providerPlayerId':o['providerPlayerId'],'name':o['name'],'clubId':o['clubId'],'leagueId':o['leagueId'],'price':o['price'],'tmId':x['tmId'],'tmName':x['name'],'tmClub':x['club'],'ncands':len(cands)}); tm_of_player[o['_id']]=x['tmId']; used_tm.add(x['tmId'])
    else: unresolved.append(('out','no-candidate' if not cands else 'truncated',o,cands))
# 3. new candidates
POS={'G':'GK','D':'DEF','M':'MID','F':'ATT'}
TMPOS={'GK':'GK','Goalkeeper':'GK','CB':'DEF','LB':'DEF','RB':'DEF','Defender':'DEF','DM':'MID','CM':'MID','AM':'MID','LM':'MID','RM':'MID','Midfield':'MID','LW':'ATT','RW':'ATT','CF':'ATT','SS':'ATT','Attack':'ATT'}
existing_tm=set(used_tm)
for n in D['new']+[{'espnId':m['espnId'],'name':m['espn'],'pos':None,'clubId':m['to'],'leagueId':m['toLeague'],'club':CM[m['to']]['ourName'],'from_refuted_move':True} for m in extra_new]:
    r=results(n['name'].translate(TR))
    if r is None: unresolved.append(('new','no-search',n)); continue
    cands=[x for x in r if full_match(n['name'],x['name'])]
    here=[x for x in cands if tm2our.get(x['clubTmId'])==n['clubId']]
    if here:
        x=here[0]
        if x['tmId'] in used_tm: report['new-dup-of-move'].append((n['name'],x['tmId'])); continue
        pos=POS.get(n.get('pos')) or TMPOS.get(x['pos'])
        if pos is None: unresolved.append(('new','no-position',n,x)); continue
        confirmed_new.append({**n,'tmId':x['tmId'],'tmName':x['name'],'position':pos,'tmPos':x['pos'],'age':x['age']}); used_tm.add(x['tmId'])
    elif cands:
        report['new-tm-elsewhere'].append((n['name'],n['club'],[(x['name'],x['club']) for x in cands][:3]))
    else: unresolved.append(('new','no-candidate',n))
new_by_tm={n['tmId']:n for n in confirmed_new}
still=[]
for u in unresolved:
    if u[0]=='out' and u[1]=='ambiguous-covered':
        o=u[2]; hits=[x for x in u[3] if x['tmId'] in new_by_tm]
        if len(hits)>1 and o.get('feedPosition'):
            hp=[x for x in hits if TMPOS.get(x['pos'])==o['feedPosition']]
            if len(hp)==1: hits=hp
        if len(hits)==1:
            x=hits[0]; n=new_by_tm.pop(x['tmId']); to=n['clubId']
            confirmed_moves.append({'playerId':o['_id'],'providerPlayerId':o['providerPlayerId'],'name':o['name'],'from':o['clubId'],'fromLeague':o['leagueId'],'to':to,'toLeague':CM[to]['leagueId'],'price':o['price'],'tmId':x['tmId'],'tmName':x['name'],'tmClub':x['club'],'wasActive':True,'note':'ambiguous resolved via new-arrival TM id'})
            tm_of_player[o['_id']]=x['tmId']; continue
    still.append(u)
unresolved=still; confirmed_new=[n for n in confirmed_new if n['tmId'] in new_by_tm]
# summary
print('confirmed moves',len(confirmed_moves),' outgoing',len(confirmed_out),' new',len(confirmed_new),' keep',len(keep),' unresolved',collections.Counter((u[0],u[1]) for u in unresolved))
print('report',{k:len(v) for k,v in report.items()})
print('out by price',sorted(collections.Counter(o['price'] for o in confirmed_out).items()))
print('new by pos',collections.Counter(n['position'] for n in confirmed_new))
# sanity: a player id appears at most once across moves/out
ids=[m['playerId'] for m in confirmed_moves]+[o['playerId'] for o in confirmed_out]; assert len(ids)==len(set(ids)),'dup player'
assert len({n['tmId'] for n in confirmed_new})==len(confirmed_new)
json.dump({'moves':confirmed_moves,'out':confirmed_out,'new':confirmed_new,'keep':keep,'unresolved':unresolved,'report':report,'tm_of_player':tm_of_player},open(f'{S}/resolved.json','w'),ensure_ascii=False,indent=1,default=str)
if '-v' in sys.argv:
    print('\nMOVES'); [print(f"  {m['name']:<24} {m['price']}  {CM[m['from']]['ourName']:<22} -> {CM[m['to']]['ourName']:<22} TM:{m['tmName']} @ {m['tmClub']} {m.get('note','')}") for m in sorted(confirmed_moves,key=lambda m:-(m['price'] or 0))]
    print('\nOUT'); [print(f"  {o['name']:<24} {o['price']}  {CM[o['clubId']]['ourName']:<22} TM:{o['tmName']} @ {o['tmClub']} (cands {o.get('ncands')})") for o in sorted(confirmed_out,key=lambda o:-(o['price'] or 0))]
    print('\nNEW'); [print(f"  {n['name']:<26} {n['position']} {n['club']:<20} TM:{n['tmName']} age {n['age']}") for n in confirmed_new]
    print('\nKEEP'); [print(f"  {k['name']:<24} {k['why']}  TM:{k['tm']['name']} @ {k['tm']['club']}") for k in keep]
    print('\nUNRESOLVED'); [print('  ',u[0],u[1],u[2].get('name'),[(x['name'],x['club']) for x in (u[3] if len(u)>3 else [])][:4]) for u in unresolved]
