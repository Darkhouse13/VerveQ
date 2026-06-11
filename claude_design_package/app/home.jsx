/* global React, NBCard, ImgSlot */
const { useState: useStateHome } = React;

function BrandBar({ compact, onProfile }) {
  return (
    <div className="row between aic" style={{ padding: compact ? '12px 16px' : '16px 22px', flex: '0 0 auto' }}>
      <div className="row aic gap-10">
        <div style={{
          width: compact ? 30 : 38, height: compact ? 30 : 38, borderRadius: 8,
          background: 'var(--ink)', color: '#fff', display: 'grid', placeItems: 'center',
          border: 'var(--bw) solid var(--ink)', fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: compact ? 16 : 20, transform: 'rotate(-4deg)',
        }}>V</div>
        <div className="display" style={{ fontSize: compact ? 19 : 24, letterSpacing: '-.02em' }}>
          Verve<span style={{ color: 'var(--orange)' }}>Q</span>
        </div>
      </div>
      <div className="row aic gap-8">
        <span className="chip solid-yellow" title="day streak">🔥 12</span>
        <span className="chip" title="coins">◎ 2,480</span>
        <div onClick={onProfile} role="button" tabIndex={0} title="Profile" style={{
          width: compact ? 30 : 36, height: compact ? 30 : 36, borderRadius: 999,
          border: 'var(--bw) solid var(--ink)', background: 'var(--pink)',
          display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)',
          fontWeight: 900, color: '#fff', fontSize: 14, cursor: 'pointer',
        }}>JD</div>
      </div>
    </div>
  );
}

function PillarLearn({ onClick, tall }) {
  return (
    <NBCard fill="#FBEED4" onClick={onClick} className="lift" style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="row between aic">
        <span className="chip" style={{ background: '#fff' }}>WARM PATH</span>
        <span style={{ fontSize: 26 }}>🌱</span>
      </div>
      <div className="display" style={{ fontSize: tall ? 46 : 34, lineHeight: .95, marginTop: 'auto', color: '#211806' }}>
        LEARN
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6E5E38', fontWeight: 500, maxWidth: 280 }}>
        Build real knowledge. Adaptive questions, teaching reveals, spaced review — not a test.
      </p>
      <div className="row aic gap-8" style={{ marginTop: 14 }}>
        <span className="chip" style={{ background: '#B8E018' }}>3 subjects locked in</span>
        <span className="chip" style={{ background: '#fff' }}>6 due today</span>
      </div>
    </NBCard>
  );
}

function PillarCompete({ onClick, tall }) {
  return (
    <NBCard fill="var(--orange)" onClick={onClick} className="lift" style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: 0, color: '#fff' }}>
      <div className="row between aic">
        <span className="chip" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>RANKED</span>
        <span style={{ fontSize: 26 }}>⚡</span>
      </div>
      <div className="display" style={{ fontSize: tall ? 46 : 34, lineHeight: .95, marginTop: 'auto', color: '#fff' }}>
        COMPETE
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,.92)', fontWeight: 500, maxWidth: 280 }}>
        Live arenas, duels and football mind-games. Pick a category, climb the ranks.
      </p>
      <div className="row aic gap-8" style={{ marginTop: 14 }}>
        <span className="chip" style={{ background: '#fff' }}>🟢 3 lobbies live</span>
        <span className="chip" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>Rank: Gold II</span>
      </div>
    </NBCard>
  );
}

function RanksCard({ onClick, tall }) {
  return (
    <NBCard fill="var(--ink)" onClick={onClick} className="lift" style={{ padding: 18, color: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div className="row between aic">
        <span className="eyebrow" style={{ color: 'var(--yellow)' }}>THE LADDER</span>
        <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff' }}>SEASON 4</span>
      </div>
      <div className="row aic gap-12" style={{ marginTop: tall ? 18 : 12 }}>
        <div style={{
          width: tall ? 62 : 50, height: tall ? 62 : 50, flex: '0 0 auto', borderRadius: 10, transform: 'rotate(-6deg)',
          background: 'linear-gradient(135deg,var(--yellow),var(--orange))', border: '3px solid #fff',
          display: 'grid', placeItems: 'center', fontSize: tall ? 30 : 24,
        }}>♛</div>
        <div>
          <div className="display" style={{ fontSize: tall ? 30 : 24, color: '#fff' }}>Gold II</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--yellow)' }}>320 / 500 to Gold I</div>
        </div>
      </div>
      <div style={{ height: 12, border: '2px solid #fff', borderRadius: 999, marginTop: 12, overflow: 'hidden' }}>
        <div style={{ width: '64%', height: '100%', background: 'var(--yellow)' }} />
      </div>
      <div className="row between" style={{ marginTop: 'auto', paddingTop: 14 }}>
        <span className="mono" style={{ fontSize: 11, color: '#b7b3a8' }}>#1,204 globally</span>
        <span className="display" style={{ fontSize: 13, color: 'var(--yellow)' }}>VIEW RANKS →</span>
      </div>
    </NBCard>
  );
}

function ForgeCard({ onClick }) {
  return (
    <NBCard fill="var(--pink)" onClick={onClick} className="lift" style={{ padding: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 30, flex: '0 0 auto' }}>🛠</div>
      <div style={{ minWidth: 0 }}>
        <div className="display" style={{ fontSize: 19 }}>The Forge</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.9)', fontWeight: 500 }}>Build & share your own question sets.</div>
      </div>
      <span className="display" style={{ marginLeft: 'auto', fontSize: 20 }}>→</span>
    </NBCard>
  );
}

function DailyHook({ icon, name, sub, fill, onClick }) {
  return (
    <NBCard fill={fill} onClick={onClick} className="lift" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div className="display" style={{ fontSize: 16, lineHeight: 1 }}>{name}</div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{sub}</div>
    </NBCard>
  );
}

function Home({ bp, nav }) {
  const desktop = bp === 'desktop';

  const dailies = (
    <>
      <DailyHook icon="★" name="Daily Challenge" sub="RESETS IN 6:12" fill="var(--yellow)" onClick={() => nav('compete')} />
      <DailyHook icon="♥" name="Survival Sprint" sub="BEST: 23 IN A ROW" fill="var(--surface)" onClick={() => nav('compete')} />
      <DailyHook icon="?" name="Daily Quiz" sub="10 Q · NOT PLAYED" fill="var(--surface)" onClick={() => nav('compete')} />
    </>
  );

  if (desktop) {
    return (
      <div className="screen no-scroll pop">
        <BrandBar onProfile={() => nav('profile')} />
        <div style={{
          flex: '1 1 auto', minHeight: 0, display: 'grid',
          gridTemplateColumns: '1.5fr 1fr', gap: 16, padding: '0 22px 22px',
        }}>
          {/* left: pillars + dailies */}
          <div style={{ display: 'grid', gridTemplateRows: '1.5fr .9fr', gap: 16, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 0 }}>
              <PillarLearn tall onClick={() => nav('learn')} />
              <PillarCompete tall onClick={() => nav('compete')} />
            </div>
            <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="eyebrow">Daily hooks · keep the streak</div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, minHeight: 0 }}>
                {dailies}
              </div>
            </div>
          </div>
          {/* right: ranks + forge */}
          <div style={{ display: 'grid', gridTemplateRows: '1.7fr .8fr', gap: 16, minHeight: 0 }}>
            <RanksCard tall onClick={() => nav('ranks')} />
            <ForgeCard onClick={() => nav('forge')} />
          </div>
        </div>
      </div>
    );
  }

  /* mobile — scrollable */
  return (
    <div className="screen scroll-y pop">
      <BrandBar compact onProfile={() => nav('profile')} />
      <div style={{ padding: '0 16px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PillarLearn onClick={() => nav('learn')} />
        <PillarCompete onClick={() => nav('compete')} />
        <div className="eyebrow" style={{ marginTop: 4 }}>Daily hooks</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {dailies}
        </div>
        <ForgeCard onClick={() => nav('forge')} />
        <RanksCard onClick={() => nav('ranks')} />
      </div>
    </div>
  );
}

const liftStyle = document.createElement('style');
liftStyle.textContent = `
.lift:hover { transform: translate(-2px,-2px); box-shadow: calc(var(--sh) + 2px) calc(var(--sh) + 2px) 0 var(--ink) !important; }
.lift:active { transform: translate(2px,2px); box-shadow: calc(var(--sh) / 2) calc(var(--sh) / 2) 0 var(--ink) !important; }`;
document.head.appendChild(liftStyle);

Object.assign(window, { Home });
