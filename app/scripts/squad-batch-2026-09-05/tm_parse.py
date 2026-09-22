from html.parser import HTMLParser
import re,json,glob,unicodedata,collections
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
LEAGUE={'GB1':39,'GB2':40,'FR1':61,'L1':78,'NL1':88,'PO1':94,'IT1':135,'ES1':140}
class P(HTMLParser):
    def __init__(s): super().__init__(); s.in_items=False; s.rows=[]; s.row=None; s.cell=None; s.tdepth=0
    def handle_starttag(s,tag,attrs):
        a=dict(attrs)
        if tag=='table' and a.get('class')=='items': s.in_items=True; s.tdepth=0
        if not s.in_items: return
        if tag=='table': s.tdepth+=1
        if tag=='tr' and s.tdepth==1: s.row=[]
        if tag=='td' and s.row is not None and s.tdepth==1: s.cell={'text':'','links':[],'titles':[]}
        if s.cell is not None:
            if tag=='a' and a.get('href'): s.cell['links'].append(a['href'])
            if tag=='img' and a.get('title'): s.cell['titles'].append(a['title'])
            if tag in('br','td','tr'): s.cell['text']+=' '
    def handle_endtag(s,tag):
        if not s.in_items: return
        if tag=='td' and s.cell is not None and s.tdepth==1: s.row.append(s.cell); s.cell=None
        if tag=='tr' and s.row is not None and s.tdepth==1:
            if s.row: s.rows.append(s.row)
            s.row=None
        if tag=='table':
            if s.tdepth==0: s.in_items=False
            else: s.tdepth-=1
    def handle_data(s,d):
        if s.cell is not None: s.cell['text']+=d
out=[]
for f in sorted(glob.glob(f'{S}/tm/*_p1.html')):
    code,kind=re.search(r'tm/(\w+)_(\w+)_p1',f).groups()
    p=P(); p.feed(open(f,encoding='utf-8').read())
    for r in p.rows:
        if len(r)<4: continue
        pl=[l for l in r[0]['links'] if '/profil/spieler/' in l]
        if not pl: continue
        name=r[0]['titles'][0] if r[0]['titles'] else re.sub(r'\s+',' ',r[0]['text']).strip()
        pos=re.sub(r'\s+',' ',r[0]['text']).strip()
        pos=pos[len(name):].strip() if pos.startswith(name) else pos
        club=r[1]['titles'][0] if r[1]['titles'] else ''
        cl=[l for l in r[1]['links'] if '/verein/' in l]
        out.append({'league':LEAGUE[code],'kind':'injury' if kind=='verletztespieler' else 'suspension','name':name,'tmId':pl[0].rsplit('/',1)[1],'pos':pos,'club':club,'clubTmId':cl[0].rsplit('/',1)[1] if cl else None,'reason':re.sub(r'\s+',' ',r[2]['text']).strip(),'until':re.sub(r'\s+',' ',r[3]['text']).strip()})
json.dump(out,open(f'{S}/tm_flags.json','w'),indent=0,ensure_ascii=False)
print('rows',len(out),collections.Counter((o['league'],o['kind']) for o in out))
print('sample until values',collections.Counter(o['until'] for o in out).most_common(6))
print('reasons',collections.Counter(o['reason'] for o in out).most_common(12))
# club map
Pl=[json.loads(l) for l in open(f'{S}/fantasyPlayers.jsonl')]
M=[json.loads(l) for l in open(f'{S}/fantasyDraftPoolMeta.jsonl')]
byp={p['_id']:p for p in Pl}
names=collections.defaultdict(collections.Counter); league={}
for m in M:
    p=byp.get(m['playerId'])
    if p and m.get('clubName'): names[p['clubId']][m['clubName']]+=1; league[p['clubId']]=p['leagueId']
ours={cid:(c.most_common(1)[0][0],league[cid]) for cid,c in names.items()}
def norm(s):
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('&','and')
    s=re.sub(r'\b(fc|cf|afc|ac|as|sc|ss|us|ud|sd|rc|cd|club|de|del|the|1\.|sv|vfb|vfl|tsg|fsv|bsc|sk|nk|sco|olympique|calcio|racing|real|deportivo|athletic|athletico|atletico|city|united|town|rovers|wanderers|hotspur|albion|county|association|and|hove|of|la|le|les|los)\b','',s)
    return re.sub(r'[^a-z0-9]','',s)
tmclubs={(o['club'],o['league']) for o in out}
tmmap={}; un=[]
for club,lid in sorted(tmclubs):
    n=norm(club); cands=[(cid,nm) for cid,(nm,l) in ours.items() if l==lid]
    hit=[c for c in cands if norm(c[1])==n]
    if not hit: hit=[c for c in cands if n and (n in norm(c[1]) or norm(c[1]) in n)]
    if len(hit)==1: tmmap[club]=hit[0][0]
    else: un.append((club,lid,hit))
print('tm clubs',len(tmclubs),'mapped',len(tmmap)); 
for u in un: print('UNMATCHED',u)
json.dump(tmmap,open(f'{S}/tm_club_map.json','w'),indent=1,ensure_ascii=False)
