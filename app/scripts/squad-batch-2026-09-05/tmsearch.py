import re,json,subprocess,urllib.parse,time,os,sys
S='/tmp/claude-1000/-home-darkhouse-verveq/32c23db7-8564-4441-b1f7-05995c2c7c2b/scratchpad'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
CACHE=os.environ.get('TM_CACHE',f'{S}/tm_search_cache.json')
cache=json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def search(q):
    if q in cache: return cache[q]
    url='https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query='+urllib.parse.quote(q)
    for i in range(3):
        h=subprocess.run(['curl','-s','--max-time','40','-A',UA,'-H','Accept-Language: en-US,en;q=0.9',url],capture_output=True,text=True).stdout
        if 'Search results for players' in h or 'tm-main' in h: break
        time.sleep(3)
    i=h.find('Search results for players'); seg=h[i:i+150000] if i>0 else ''
    res=[]
    for m in re.finditer(r'<td class="hauptlink"><a title="([^"]+)" href="/[^"]*/profil/spieler/(\d+)">.*?<tr><td><a title="([^"]*)" href="/[^"]*/verein/(\d+)">.*?</table></td><td class="zentriert">([^<]*)</td>.*?<td class="zentriert">([^<]*)</td><td class="zentriert"><img[^>]*title="([^"]*)"',seg,re.S):
        name,pid,club,cid,pos,age,nat=m.groups()
        res.append({'name':name,'tmId':pid,'club':club,'clubTmId':cid,'pos':pos,'age':age,'nat':nat})
    cache[q]=res; json.dump(cache,open(CACHE,'w'),ensure_ascii=False)
    time.sleep(1.1)
    return res
if __name__=='__main__':
    for q in sys.argv[1:]: print(q, json.dumps(search(q),ensure_ascii=False)[:800])
