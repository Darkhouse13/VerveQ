import json,collections
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
R=json.load(open(f'{S}/resolved.json')); CM=json.load(open(f'{S}/club_map.json'))
DAY='2026-09-05'; SRC='manual end-of-window batch (ESPN roster + Transfermarkt)'
ev=[]
for m in R['moves']:
    ev.append({'providerTransferKey':f"manual:{DAY}:{m['providerPlayerId']}:{m['from']}:{m['to']}",'providerPlayerId':m['providerPlayerId'],'playerName':m['name'],'transferDate':DAY,'rawFromClubId':m['from'],'rawToClubId':m['to'],'fromCovered':True,'toCovered':True,'transferType':f"{SRC}; TM {m['tmId']} @ {m['tmClub']}",'loan':False,'classification':'incoming_known','toLeagueId':m['toLeague'],'toClubName':CM[m['to']]['ourName']})
for o in R['out']:
    ev.append({'providerTransferKey':f"manual:{DAY}:{o['providerPlayerId']}:{o['clubId']}:out",'providerPlayerId':o['providerPlayerId'],'playerName':o['name'],'transferDate':DAY,'rawFromClubId':o['clubId'],'rawToClubId':None,'fromCovered':True,'toCovered':False,'transferType':f"{SRC}; TM {o['tmId']} @ {o['tmClub']}",'loan':False,'classification':'outgoing','toClubName':None})
for n in R['new']:
    ev.append({'providerTransferKey':f"manual:{DAY}:tm:{n['tmId']}:new:{n['clubId']}",'providerPlayerId':f"tm:{n['tmId']}",'playerName':n['tmName'],'transferDate':DAY,'rawFromClubId':None,'rawToClubId':n['clubId'],'fromCovered':False,'toCovered':True,'transferType':f"{SRC}; ESPN {n['espnId']}",'loan':False,'classification':'incoming_new','toLeagueId':n['leagueId'],'toClubName':CM[n['clubId']]['ourName'],'newPlayerPosition':n['position']})
assert len({e['providerTransferKey'] for e in ev})==len(ev)
json.dump(ev,open(f'{S}/events.json','w'),ensure_ascii=False,indent=0)
print('events',len(ev),collections.Counter(e['classification'] for e in ev))
