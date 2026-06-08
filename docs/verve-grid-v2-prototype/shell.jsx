/* global React, ReactDOM, Home, Compete, Arena, LearnFlow, NBCard */
const { useState: useStateShell, useEffect: useEffectShell } = React;

/* ---------- Ranks destination (prominent home; detailed UX is a later pass) ---------- */
const TIERS = [
  { t: 'Bronze',   c: '#B07A43' }, { t: 'Silver', c: '#9AA1A8' },
  { t: 'Gold',     c: '#E2B23A', me: true }, { t: 'Platinum', c: '#5FD0C8' },
  { t: 'Diamond',  c: '#5B8CF0' }, { t: 'Vervemaster', c: '#FF4D8D' },
];
function Ranks({ bp, nav }) {
  const desktop = bp === 'desktop';
  return (
    <div className="screen no-scroll pop" style={{ background: 'var(--ink)', color: '#fff' }}>
      <div className="row between aic" style={{ padding: desktop ? '16px 22px' : '14px 16px', flex: '0 0 auto' }}>
        <div className="row aic gap-12">
          <button className="btn btn-ghost" onClick={() => nav('home')} style={{ boxShadow: 'none', padding: '6px 11px', color: '#fff', borderColor: '#3a3833' }}>←</button>
          <div>
            <div className="eyebrow" style={{ color: 'var(--yellow)' }}>Competitive ladder · Season 4</div>
            <div className="display" style={{ fontSize: desktop ? 27 : 22, color: '#fff' }}>The Ranks</div>
          </div>
        </div>
        <span className="chip" style={{ background: '#26241f', color: '#b7b3a8', borderColor: '#3a3833' }}>UX REWORK IN PROGRESS</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: desktop ? '0 22px 22px' : '0 16px 22px', display: 'grid', gridTemplateColumns: desktop ? '1fr 1.4fr' : '1fr', gap: 18, overflowY: desktop ? 'hidden' : 'auto' }}>
        <div style={{ border: '3px solid #fff', borderRadius: 'var(--radius)', background: 'linear-gradient(150deg,#2a2823,#1a1916)', padding: 22, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ width: 84, height: 84, borderRadius: 14, transform: 'rotate(-6deg)', background: 'linear-gradient(135deg,var(--yellow),var(--orange))', border: '4px solid #fff', display: 'grid', placeItems: 'center', fontSize: 42 }}>♛</div>
          <div className="display" style={{ fontSize: 38, marginTop: 16, color: '#fff' }}>Gold II</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--yellow)' }}>#1,204 globally · top 8%</div>
          <div style={{ height: 14, border: '2px solid #fff', borderRadius: 999, marginTop: 16, overflow: 'hidden' }}><div style={{ width: '64%', height: '100%', background: 'var(--yellow)' }} /></div>
          <div className="mono" style={{ fontSize: 11, color: '#b7b3a8', marginTop: 8 }}>320 / 500 RP to Gold I · 12 days left</div>
          <button className="btn btn-orange block" onClick={() => nav('compete')} style={{ marginTop: 'auto', background: 'var(--orange)' }}>PLAY RANKED →</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflowY: desktop ? 'auto' : 'visible' }}>
          <div className="eyebrow" style={{ color: '#b7b3a8' }}>Tiers</div>
          {TIERS.map(t => (
            <div key={t.t} className="row aic gap-14" style={{ padding: '12px 14px', borderRadius: 'var(--radius)', border: t.me ? '3px solid var(--yellow)' : '2px solid #3a3833', background: t.me ? '#26241f' : 'transparent' }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: t.c, border: '2px solid #fff', transform: 'rotate(-6deg)', display: 'grid', placeItems: 'center', fontSize: 18 }}>♛</div>
              <div style={{ flex: 1 }}>
                <div className="display" style={{ fontSize: 17, color: '#fff' }}>{t.t}</div>
                <div className="mono" style={{ fontSize: 10.5, color: '#8d8a81' }}>{t.me ? 'YOU ARE HERE — II of III' : 'I · II · III divisions'}</div>
              </div>
              {t.me && <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff' }}>CURRENT</span>}
            </div>
          ))}
          <div className="mono" style={{ fontSize: 11, color: '#6f6c64', marginTop: 4 }}>Placeholder destination — rewards, seasons & promotion series land in the dedicated Ranks pass.</div>
        </div>
      </div>
    </div>
  );
}

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
  ranks:         { group: 'Compete', label: 'Ranks',                render: (p) => <Ranks {...p} /> },
  forge:         { group: 'Shell',   label: 'The Forge',            render: (p) => <Forge {...p} /> },
  learn:         { group: 'Learn',   label: 'Learn · entry',        render: (p) => <LearnFlow {...p} sub="entry" pal={p.learnPal} /> },
  'learn-run':   { group: 'Learn',   label: 'Learn · questions',    render: (p) => <LearnFlow {...p} sub="run" pal={p.learnPal} /> },
  'learn-review':{ group: 'Learn',   label: 'Learn · spaced review',render: (p) => <LearnFlow {...p} sub="review" pal={p.learnPal} /> },
  'learn-mastery':{group: 'Learn',   label: 'Learn · mastery',      render: (p) => <LearnFlow {...p} sub="mastery" pal={p.learnPal} /> },
  'learn-unified':{group: 'Learn',   label: 'Learn · unified palette ✦', render: (p) => <LearnFlow {...p} sub="run" pal="unified" /> },
};
const CRUMB_OF = {
  home: ['Home'], compete: ['Compete'], arena: ['Compete', 'Arena'], ranks: ['Compete', 'Ranks'], forge: ['Forge'],
  learn: ['Learn'], 'learn-run': ['Learn', 'Questions'], 'learn-review': ['Learn', 'Review'], 'learn-mastery': ['Learn', 'Mastery'], 'learn-unified': ['Learn', 'Unified ✦'],
};

function App() {
  const [bp, setBp] = useStateShell('desktop');
  const [route, setRoute] = useStateShell('home');
  const [hist, setHist] = useStateShell([]);
  const [t, setTweak] = useTweaks({ bw: 3, sh: 6, learnPal: 'warm', accent: '#FF6A1A' });

  const nav = (r) => { setHist(h => [...h, route]); setRoute(r); };
  const back = () => setHist(h => { if (!h.length) return h; const n = [...h]; const prev = n.pop(); setRoute(prev); return n; });

  useEffectShell(() => {
    const r = document.documentElement.style;
    r.setProperty('--bw', t.bw + 'px');
    r.setProperty('--sh', t.sh + 'px');
    r.setProperty('--orange', t.accent);
  }, [t.bw, t.sh, t.accent]);

  const screen = SCREENS[route];
  const rendered = screen.render({ bp, nav, learnPal: t.learnPal });

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
