/* global React, NBCard, CATEGORIES, SPORTS, FOOTBALL_MODES, ARENA_CATEGORIES */
const { useState: useStateCompete } = React;

function Crumb({ steps, onJump }) {
  return (
    <div className="row aic gap-6 mono" style={{ fontSize: 12, color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ opacity: .5 }}>›</span>}
          <button
            className="btn-ghost"
            onClick={() => s.go && onJump(s.go)}
            style={{
              border: 0, background: 'none', padding: 0, fontFamily: 'var(--font-mono)',
              fontSize: 12, color: i === steps.length - 1 ? 'var(--ink)' : 'var(--ink-soft)',
              fontWeight: i === steps.length - 1 ? 700 : 400,
              cursor: s.go ? 'pointer' : 'default',
            }}
          >{s.label}</button>
        </React.Fragment>
      ))}
    </div>
  );
}

function RanksBanner({ onClick, wide }) {
  return (
    <NBCard fill="var(--ink)" onClick={onClick} className="lift" style={{
      padding: wide ? '14px 18px' : 14, color: '#fff', display: 'flex', alignItems: 'center', gap: 14,
      flex: '0 0 auto',
    }}>
      <div style={{
        width: 44, height: 44, flex: '0 0 auto', borderRadius: 9, transform: 'rotate(-6deg)',
        background: 'linear-gradient(135deg,var(--yellow),var(--orange))', border: '3px solid #fff',
        display: 'grid', placeItems: 'center', fontSize: 22,
      }}>♛</div>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow" style={{ color: 'var(--yellow)' }}>COMPETITIVE LADDER · SEASON 4</div>
        <div className="display" style={{ fontSize: 19 }}>You're <span style={{ color: 'var(--yellow)' }}>Gold II</span> · 320 to promotion</div>
      </div>
      <span className="display" style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--yellow)', whiteSpace: 'nowrap' }}>VIEW RANKS →</span>
    </NBCard>
  );
}

function CatTile({ c, onClick }) {
  return (
    <NBCard fill={c.live ? c.tint : 'var(--surface)'} onClick={c.live ? onClick : undefined}
      className={c.live ? 'lift' : ''}
      style={{
        padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0,
        opacity: c.live ? 1 : .55, cursor: c.live ? 'pointer' : 'not-allowed',
        color: c.live && c.tint === 'var(--ink)' ? '#fff' : 'var(--ink)',
      }}>
      <div className="row between aic">
        <span style={{ fontSize: 26 }}>{c.icon}</span>
        {!c.live && <span className="chip" style={{ fontSize: 9 }}>SOON</span>}
      </div>
      <div className="display" style={{ fontSize: 22, marginTop: 'auto', lineHeight: 1 }}>{c.label}</div>
      <div className="mono" style={{ fontSize: 10.5, marginTop: 4, color: 'var(--ink-soft)' }}>{c.count}</div>
    </NBCard>
  );
}

function ModeTile({ m, onClick, desktop }) {
  const dark = m.tint === 'var(--ink)';
  return (
    <NBCard fill={m.tint} onClick={onClick} className="lift" span2={m.span === 2 && desktop}
      style={{
        padding: m.feature ? 18 : 14, color: (dark || m.tint === 'var(--orange)' || m.tint === 'var(--blue)' || m.tint === 'var(--pink)') ? '#fff' : 'var(--ink)',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
      <div className="row between aic">
        <div style={{
          width: m.feature ? 44 : 34, height: m.feature ? 44 : 34, borderRadius: 8,
          background: 'rgba(255,255,255,.22)', border: '2px solid currentColor',
          display: 'grid', placeItems: 'center', fontSize: m.feature ? 22 : 17, flex: '0 0 auto',
        }}>{m.icon}</div>
        <div className="row gap-6" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {m.only && <span className="chip" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'currentColor', fontSize: 8.5 }}>FOOTBALL ONLY</span>}
          {m.multi && <span className="chip" style={{ background: 'rgba(255,255,255,.85)', color: 'var(--ink)', borderColor: 'currentColor', fontSize: 8.5 }}>MULTIPLAYER</span>}
          {m.daily && <span className="chip" style={{ background: 'rgba(255,255,255,.85)', color: 'var(--ink)', borderColor: 'currentColor', fontSize: 8.5 }}>DAILY</span>}
        </div>
      </div>
      <div className="display" style={{ fontSize: m.feature ? 30 : 19, marginTop: m.feature ? 14 : 10, lineHeight: 1 }}>{m.name}</div>
      <div style={{ fontSize: 12.5, marginTop: 5, fontWeight: 500, opacity: .92 }}>{m.desc}</div>
      {m.hasCats && (
        <div className="row gap-6" style={{ marginTop: 'auto', paddingTop: 10, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: 9.5, opacity: .85 }}>INCLUDES:</span>
          {ARENA_CATEGORIES.map(a => (
            <span key={a.id} className="chip" style={{ background: 'rgba(255,255,255,.85)', color: 'var(--ink)', borderColor: 'currentColor', fontSize: 8.5 }}>{a.label}</span>
          ))}
        </div>
      )}
    </NBCard>
  );
}

/* drawer shown when a mode with sub-categories (arena/duels) is tapped */
function ModeDrawer({ mode, onClose, onLaunch }) {
  if (!mode) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(14,13,11,.55)', zIndex: 60,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16,
    }}>
      <div className="slam" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460, background: 'var(--surface)',
        border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
        boxShadow: 'var(--sh) var(--sh) 0 var(--ink)', padding: 18, marginBottom: 'auto', marginTop: 'auto',
      }}>
        <div className="row between aic">
          <div className="display" style={{ fontSize: 24 }}>{mode.name}</div>
          <button className="btn btn-ghost" onClick={onClose} style={{ boxShadow: 'none', padding: '4px 10px' }}>✕</button>
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', margin: '6px 0 14px' }}>
          Pick a question category for this {mode.id === 'arena' ? 'lobby' : 'duel'}. <b style={{ color: 'var(--ink)' }}>Which Came First</b> and <b style={{ color: 'var(--ink)' }}>Knowledge</b> live here — they're categories, not standalone modes.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ARENA_CATEGORIES.map((a, i) => (
            <div key={a.id} className="nb-flat lift" onClick={onLaunch} style={{
              padding: 13, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              background: i === 0 ? 'var(--yellow)' : 'var(--surface)',
            }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div className="display" style={{ fontSize: 16 }}>{a.label}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{a.desc}</div>
              </div>
              <span className="display" style={{ marginLeft: 'auto' }}>→</span>
            </div>
          ))}
        </div>
        <button className="btn btn-orange block" onClick={onLaunch} style={{ marginTop: 16 }}>
          {mode.id === 'arena' ? 'ENTER LOBBY' : 'SEND CHALLENGE'} →
        </button>
      </div>
    </div>
  );
}

function Compete({ bp, nav }) {
  const desktop = bp === 'desktop';
  const [step, setStep] = useStateCompete('cats');     // cats | sports | modes
  const [drawer, setDrawer] = useStateCompete(null);

  const crumbSteps = [
    { label: 'Compete', go: () => setStep('cats') },
    ...(step !== 'cats' ? [{ label: 'Sport', go: () => setStep('sports') }] : []),
    ...(step === 'modes' ? [{ label: 'Football' }] : []),
  ];

  const onModeClick = (m) => {
    if (m.hasCats) setDrawer(m);
    else if (m.multi) nav('arena');
    else nav('arena'); // all modes demo into the in-game answering screen
  };

  /* header shared */
  const header = (
    <div className="row between aic" style={{ padding: desktop ? '16px 22px 12px' : '12px 16px', flex: '0 0 auto', gap: 12 }}>
      <div className="row aic gap-12" style={{ minWidth: 0 }}>
        {step !== 'cats'
          ? <button className="btn btn-ghost" onClick={() => setStep(step === 'modes' ? 'sports' : 'cats')} style={{ boxShadow: 'none', padding: '6px 11px' }}>←</button>
          : <button className="btn btn-ghost" onClick={() => nav('home')} style={{ boxShadow: 'none', padding: '6px 11px' }}>←</button>}
        <div style={{ minWidth: 0 }}>
          <Crumb steps={crumbSteps} onJump={(fn) => fn()} />
          <div className="display" style={{ fontSize: desktop ? 26 : 21, lineHeight: 1.05, marginTop: 2 }}>
            {step === 'cats' && 'Choose a category'}
            {step === 'sports' && 'Choose a sport'}
            {step === 'modes' && 'Football'}
          </div>
        </div>
      </div>
      <span className="chip solid-ink">{step === 'cats' ? 'THEME-FIRST NAV' : step === 'sports' ? '1 LIVE' : `${FOOTBALL_MODES.length} MODES`}</span>
    </div>
  );

  let body;
  if (step === 'cats') {
    body = (
      <div style={{
        flex: 1, minHeight: 0, padding: desktop ? '0 22px 22px' : '0 16px 22px',
        display: 'grid', gap: desktop ? 16 : 12,
        gridTemplateColumns: desktop ? 'repeat(3,1fr)' : 'repeat(2,1fr)',
        gridAutoRows: desktop ? '1fr' : 'minmax(120px,1fr)',
        overflowY: desktop ? 'hidden' : 'auto',
      }}>
        {CATEGORIES.map(c => <CatTile key={c.id} c={c} onClick={() => setStep('sports')} />)}
      </div>
    );
  } else if (step === 'sports') {
    body = (
      <div style={{
        flex: 1, minHeight: 0, padding: desktop ? '0 22px 22px' : '0 16px 22px',
        display: 'grid', gap: desktop ? 16 : 12,
        gridTemplateColumns: desktop ? 'repeat(2,1fr)' : '1fr',
        gridAutoRows: desktop ? '1fr' : 'minmax(96px,auto)',
        overflowY: desktop ? 'hidden' : 'auto',
      }}>
        {SPORTS.map(s => (
          <NBCard key={s.id} fill={s.live ? 'var(--surface)' : 'var(--surface)'}
            onClick={s.live ? () => setStep('modes') : undefined}
            className={s.live ? 'lift' : ''}
            style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16, opacity: s.live ? 1 : .5, cursor: s.live ? 'pointer' : 'not-allowed' }}>
            <span style={{ fontSize: 38 }}>{s.icon}</span>
            <div>
              <div className="display" style={{ fontSize: 26 }}>{s.label}</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{s.note}</div>
            </div>
            {s.live ? <span className="chip solid-lime" style={{ marginLeft: 'auto' }}>LIVE</span>
                    : <span className="chip" style={{ marginLeft: 'auto' }}>SOON</span>}
          </NBCard>
        ))}
      </div>
    );
  } else {
    /* modes — Ranks banner + grid */
    body = (
      <div style={{ flex: 1, minHeight: 0, padding: desktop ? '0 22px 22px' : '0 16px 22px', display: 'flex', flexDirection: 'column', gap: desktop ? 14 : 12, overflowY: desktop ? 'hidden' : 'auto' }}>
        <RanksBanner wide onClick={() => nav('ranks')} />
        <div style={{
          flex: 1, minHeight: 0, display: 'grid', gap: desktop ? 14 : 12,
          gridTemplateColumns: desktop ? 'repeat(4,1fr)' : 'repeat(2,1fr)',
          gridAutoRows: desktop ? '1fr' : 'minmax(132px,auto)',
        }}>
          {FOOTBALL_MODES.map(m => <ModeTile key={m.id} m={m} desktop={desktop} onClick={() => onModeClick(m)} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="screen no-scroll pop" style={{ position: 'relative' }}>
      {header}
      {body}
      <ModeDrawer mode={drawer} onClose={() => setDrawer(null)} onLaunch={() => { setDrawer(null); nav('arena'); }} />
    </div>
  );
}

Object.assign(window, { Compete });
