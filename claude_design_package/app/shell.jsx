/* global React, ReactDOM, Home, Compete, Arena, LearnFlow, Ranks, Profile, NBCard */
const { useState: useStateShell, useEffect: useEffectShell } = React;

/* ---------- Forge placeholder ---------- */
function Forge({ bp, nav }) {
  const desktop = bp === 'desktop';
  return (
    <div className="screen no-scroll pop">
      <div className="row aic gap-12" style={{ padding: desktop ? '16px 22px' : '14px 16px', flex: '0 0 auto' }}>
        <button className="btn btn-ghost" onClick={() => nav('home')} style={{ boxShadow: 'none', padding: '6px 11px' }}>←</button>
        <div>
          <div className="eyebrow">Create</div>
          <div className="display" style={{ fontSize: desktop ? 27 : 22 }}>The Forge 🛠</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: desktop ? '0 22px 22px' : '0 16px 22px', display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr 1fr' : '1fr', gridAutoRows: desktop ? '1fr' : 'minmax(120px,auto)', gap: 14, overflowY: desktop ? 'hidden' : 'auto' }}>
        {[['Build a question set', 'Author MCQ, text, numeric & ordering questions.', 'var(--pink)', '✏️'],
          ['Make a VerveGrid', 'Design a 3×3 player-connection puzzle.', 'var(--blue)', '▦'],
          ['Publish & share', 'Send your set to friends or the community feed.', 'var(--orange)', '📡']].map(([t, d, c, e]) => (
          <NBCard key={t} fill={c} className="lift" onClick={() => {}} style={{ padding: 18, color: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <span style={{ fontSize: 30 }}>{e}</span>
            <div className="display" style={{ fontSize: 21, marginTop: 'auto' }}>{t}</div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.92)', fontWeight: 500, margin: '6px 0 0' }}>{d}</p>
          </NBCard>
        ))}
      </div>
    </div>
  );
}

/* ---------- screen registry ---------- */
const SCREENS = {
  home:          { group: 'Shell',   label: 'Home',                 render: (p) => <Home {...p} /> },
  compete:       { group: 'Compete', label: 'Compete · nav',        render: (p) => <Compete {...p} /> },
  arena:         { group: 'Compete', label: 'Arena · in-game',      render: (p) => <Arena {...p} /> },
  ranks:         { group: 'Compete', label: 'Ranks ✦',              render: (p) => <Ranks {...p} /> },
  profile:       { group: 'Shell',   label: 'Profile ✦',            render: (p) => <Profile {...p} /> },
  forge:         { group: 'Shell',   label: 'The Forge',            render: (p) => <Forge {...p} /> },
  learn:         { group: 'Learn',   label: 'Learn · entry',        render: (p) => <LearnFlow {...p} sub="entry" pal={p.learnPal} /> },
  'learn-run':   { group: 'Learn',   label: 'Learn · questions',    render: (p) => <LearnFlow {...p} sub="run" pal={p.learnPal} /> },
  'learn-review':{ group: 'Learn',   label: 'Learn · spaced review',render: (p) => <LearnFlow {...p} sub="review" pal={p.learnPal} /> },
  'learn-mastery':{group: 'Learn',   label: 'Learn · mastery',      render: (p) => <LearnFlow {...p} sub="mastery" pal={p.learnPal} /> },
  'learn-unified':{group: 'Learn',   label: 'Learn · unified palette ✦', render: (p) => <LearnFlow {...p} sub="run" pal="unified" /> },
};
const CRUMB_OF = {
  home: ['Home'], compete: ['Compete'], arena: ['Compete', 'Arena'], ranks: ['Compete', 'Ranks'], forge: ['Forge'], profile: ['Profile'],
  learn: ['Learn'], 'learn-run': ['Learn', 'Questions'], 'learn-review': ['Learn', 'Review'], 'learn-mastery': ['Learn', 'Mastery'], 'learn-unified': ['Learn', 'Unified ✦'],
};

function App() {
  const [bp, setBp] = useStateShell('desktop');
  const [route, setRoute] = useStateShell('home');
  const [hist, setHist] = useStateShell([]);
  const [t, setTweak] = useTweaks({ bw: 3, sh: 6, learnPal: 'warm', accent: '#FF6A1A', account: 'full' });

  const nav = (r) => { setHist(h => [...h, route]); setRoute(r); };
  const back = () => setHist(h => { if (!h.length) return h; const n = [...h]; const prev = n.pop(); setRoute(prev); return n; });

  useEffectShell(() => {
    const r = document.documentElement.style;
    r.setProperty('--bw', t.bw + 'px');
    r.setProperty('--sh', t.sh + 'px');
    r.setProperty('--orange', t.accent);
  }, [t.bw, t.sh, t.accent]);

  /* hooks for scripted captures */
  useEffectShell(() => {
    window.__nav = setRoute; window.__setBp = setBp; window.__setTweak = setTweak;
  }, []);

  const screen = SCREENS[route];
  const rendered = screen.render({ bp, nav, learnPal: t.learnPal, account: t.account });

  const grouped = {};
  Object.entries(SCREENS).forEach(([k, v]) => { (grouped[v.group] = grouped[v.group] || []).push([k, v.label]); });

  return (
    <div className="app-shell">
      <div className="chrome">
        <div className="brand"><span className="mk">V</span>VerveQ <span style={{ color: '#6f6c64', fontWeight: 400, fontSize: 12, fontFamily: 'var(--font-mono)' }}>v2 shell</span></div>
        <div className="seg">
          <button className={bp === 'mobile' ? 'on' : ''} onClick={() => setBp('mobile')}>▢ Mobile</button>
          <button className={bp === 'desktop' ? 'on' : ''} onClick={() => setBp('desktop')}>▭ Desktop · never-scroll</button>
        </div>
        <div className="crumbs">
          {CRUMB_OF[route].map((c, i, arr) => <React.Fragment key={i}>{i > 0 && <span>›</span>}{i === arr.length - 1 ? <b>{c}</b> : c}</React.Fragment>)}
        </div>
        <div className="spacer" />
        {hist.length > 0 && <button className="btn btn-ghost" onClick={back} style={{ color: '#fff', borderColor: '#3a3833', padding: '5px 11px', fontSize: 12, boxShadow: 'none' }}>← Back</button>}
        <select value={route} onChange={e => nav(e.target.value)}>
          {Object.entries(grouped).map(([g, items]) => (
            <optgroup key={g} label={g}>
              {items.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="stage">
        {bp === 'mobile' ? (
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-notch" />
              {rendered}
            </div>
          </div>
        ) : (
          <div className="desk">{rendered}</div>
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Account state" />
        <TweakRadio label="Account" value={t.account} options={['full', 'username-only']} onChange={(v) => setTweak('account', v)} />
        <TweakSection label="Palette gut-check" />
        <TweakRadio label="Learn palette" value={t.learnPal} options={['warm', 'unified']} onChange={(v) => setTweak('learnPal', v)} />
        <TweakColor label="Accent" value={t.accent} options={['#FF6A1A', '#FF4D2E', '#FF3D7F', '#2C5CFF', '#1FA85B']} onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Neo-brutalist intensity" />
        <TweakSlider label="Border weight" value={t.bw} min={1} max={6} step={1} unit="px" onChange={(v) => setTweak('bw', v)} />
        <TweakSlider label="Shadow depth" value={t.sh} min={0} max={12} step={1} unit="px" onChange={(v) => setTweak('sh', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
