/* global React, ReactDOM, GridStage, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor, TweakSlider */
const { useState: useStateGS, useEffect: useEffectGS } = React;

const GRID_STATES = [
  ['fresh',   'Fresh grid'],
  ['search',  'Cell search open'],
  ['partial', 'Partially filled'],
  ['solved',  'Solved'],
  ['failed',  'Failed'],
];

function GridApp() {
  const [bp, setBp] = useStateGS('desktop');
  const [state, setState] = useStateGS('fresh');
  const [t, setTweak] = useTweaks({ bw: 3, sh: 6, accent: '#2C5CFF' });

  useEffectGS(() => {
    const r = document.documentElement.style;
    r.setProperty('--bw', t.bw + 'px');
    r.setProperty('--sh', t.sh + 'px');
    r.setProperty('--blue', t.accent);
  }, [t.bw, t.sh, t.accent]);

  const nav = () => {}; // standalone — back button is inert in this isolated stage

  return (
    <div className="app-shell">
      <div className="chrome">
        <div className="brand"><span className="mk" style={{ background: 'var(--blue)' }}>▦</span>VerveGrid <span style={{ color: '#6f6c64', fontWeight: 400, fontSize: 12, fontFamily: 'var(--font-mono)' }}>grid stage</span></div>
        <div className="seg">
          <button className={bp === 'mobile' ? 'on' : ''} onClick={() => setBp('mobile')}>▢ Mobile</button>
          <button className={bp === 'desktop' ? 'on' : ''} onClick={() => setBp('desktop')}>▭ Desktop · never-scroll</button>
        </div>
        <div className="crumbs"><span>Compete</span><span>›</span><b>VerveGrid</b></div>
        <div className="spacer" />
        <select value={state} onChange={e => setState(e.target.value)}>
          <optgroup label="Grid states">
            {GRID_STATES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </optgroup>
        </select>
      </div>

      <div className="stage">
        {bp === 'mobile' ? (
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-notch" />
              <GridStage bp="mobile" state={state} nav={nav} onState={setState} />
            </div>
          </div>
        ) : (
          <div className="desk"><GridStage bp="desktop" state={state} nav={nav} onState={setState} /></div>
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Compete accent" />
        <TweakColor label="Grid accent" value={t.accent} options={['#2C5CFF', '#FF6A1A', '#FF4D8D', '#1FA85B']} onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Neo-brutalist intensity" />
        <TweakSlider label="Border weight" value={t.bw} min={1} max={6} step={1} unit="px" onChange={(v) => setTweak('bw', v)} />
        <TweakSlider label="Shadow depth" value={t.sh} min={0} max={12} step={1} unit="px" onChange={(v) => setTweak('sh', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<GridApp />);
