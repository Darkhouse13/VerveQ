/* global React, NBCard, Stat, ImgSlot */

/* ============================================================
   PROFILE — "Your locker"
   Full-account: identity, rank summary, stats, badges, activity,
   season history, sign-out.
   Username-only: upgrade CTA banner, locked rank card, no seasons.
   ============================================================ */

const PROF_BADGES = [
  { icon: '🔥', name: 'Hot Streak',   sub: '10 correct in a row',     earned: 'APR 2026', fill: 'var(--yellow)' },
  { icon: '⚡', name: 'Blitz Brain',  sub: '30 answers in 60s',       earned: 'MAY 2026', fill: 'var(--surface)' },
  { icon: '▦',  name: 'Grid Master',  sub: 'Perfect VerveGrid',       earned: 'MAY 2026', fill: 'var(--surface)' },
  { icon: '♛',  name: 'Gold Reached', sub: 'Hit the Gold tier',       earned: 'JUN 2026', fill: '#F5E2A8', ranked: true },
  { icon: '⚔',  name: 'Duelist',      sub: 'Win 25 duels',            progress: '18 / 25' },
  { icon: '◎',  name: 'Scholar',      sub: 'Master 5 Learn subjects', progress: '3 / 5' },
];

const PROF_ACTIVITY = [
  { icon: '⚔', tint: 'var(--ink)',    dark: true, name: 'Live Match · W 12–9', sub: 'VS K. MENSAH · 2H AGO',    delta: '+24 RP', casual: 'W',   good: true, ranked: true },
  { icon: '★', tint: 'var(--yellow)', name: 'Daily Challenge',                 sub: 'TOP 4% TODAY · YESTERDAY', delta: '9/10',   good: true },
  { icon: '▦', tint: 'var(--blue)',   dark: true, name: 'VerveGrid',           sub: 'PLAYER CONNECTIONS · YESTERDAY', delta: '7/9' },
  { icon: '⚔', tint: 'var(--ink)',    dark: true, name: 'Live Match · L 8–11', sub: 'VS TACTICO · 2D AGO',      delta: '−18 RP', casual: 'L',   bad: true, ranked: true },
  { icon: '🌱', tint: 'var(--lime)',  name: 'Learn · Tactics',                 sub: '12 CARDS REVIEWED · 2D AGO', delta: '+2%',  good: true },
];

const PROF_SEASONS = [
  { s: 'S1', tier: 'Silver III', c: '#9AA1A8' },
  { s: 'S2', tier: 'Silver I',   c: '#9AA1A8' },
  { s: 'S3', tier: 'Gold III',   c: '#E2B23A' },
  { s: 'S4', tier: 'Gold II',    c: '#E2B23A', now: true },
];

/* ---------- identity ---------- */
function PfIdentity({ guest, desktop }) {
  const av = desktop ? 88 : 74;
  return (
    <NBCard style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, flex: '0 0 auto' }}>
      <div className="row aic gap-14">
        <div style={{
          width: av, height: av, borderRadius: Math.round(av * .2), flex: '0 0 auto',
          background: 'var(--pink)', border: 'var(--bw) solid var(--ink)',
          transform: 'rotate(-4deg)', display: 'grid', placeItems: 'center',
          color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: av * .36,
          boxShadow: 'calc(var(--sh) * .66) calc(var(--sh) * .66) 0 var(--ink)',
        }}>JD</div>
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: desktop ? 29 : 24, lineHeight: 1, letterSpacing: '-.01em' }}>JayDee_9</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 6 }}>
            {guest ? 'PLAYING SINCE MAY 2026 · THIS DEVICE' : 'MEMBER SINCE MAR 2025'}
          </div>
          <div className="row gap-6 wrap" style={{ marginTop: 9 }}>
            {guest
              ? <span className="chip solid-yellow">USERNAME ONLY</span>
              : <span className="chip solid-ink">FULL ACCOUNT</span>}
            <span className="chip">🔥 12</span>
          </div>
        </div>
      </div>
      <div className="row gap-8">
        <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '9px 12px', fontSize: 13 }}>✎ EDIT</button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center', padding: '9px 12px', fontSize: 13 }}>⌁ SHARE</button>
      </div>
    </NBCard>
  );
}

/* ---------- rank summary / locked ---------- */
function PfRank({ guest, nav }) {
  if (guest) {
    return (
      <NBCard style={{
        padding: 18, display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0, flex: '1 1 auto', justifyContent: 'center',
        background: 'repeating-linear-gradient(45deg, rgba(0,0,0,.045) 0 10px, transparent 10px 20px), var(--surface)',
      }}>
        <div className="row between aic">
          <span className="eyebrow">Ranked · Season 4</span>
          <span className="chip">🔒 LOCKED</span>
        </div>
        <div className="display" style={{ fontSize: 19, lineHeight: 1.1 }}>ELO &amp; tiers need a full account</div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 500 }}>
          Casual modes still count toward your stats. Placement starts the moment you upgrade.
        </p>
        <button className="btn btn-ghost" onClick={() => nav('ranks')} style={{ alignSelf: 'flex-start', padding: '5px 9px', fontSize: 12 }}>
          PEEK AT THE LADDER →
        </button>
      </NBCard>
    );
  }
  return (
    <NBCard fill="var(--ink)" onClick={() => nav('ranks')} className="lift" style={{ padding: 18, color: '#fff', display: 'flex', flexDirection: 'column', gap: 11, minHeight: 0, flex: '1 1 auto', justifyContent: 'space-between' }}>
      <div className="row between aic">
        <span className="eyebrow" style={{ color: 'var(--yellow)' }}>Ranked · Season 4</span>
        <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff' }}>TOP 8%</span>
      </div>
      <div className="col gap-14" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
        <div className="row aic gap-14">
          <div style={{
            width: 60, height: 60, borderRadius: 11, transform: 'rotate(-6deg)', flex: '0 0 auto',
            background: 'linear-gradient(135deg,var(--yellow),var(--orange))', border: '3px solid #fff',
            display: 'grid', placeItems: 'center', fontSize: 29,
          }}>♛</div>
          <div>
            <div className="display" style={{ fontSize: 29, color: '#fff', lineHeight: 1 }}>Gold II</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 5 }}>1,514 ELO · #1,204 GLOBAL</div>
          </div>
        </div>
        <div>
          <div style={{ height: 12, border: '2px solid #fff', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: '64%', height: '100%', background: 'var(--yellow)' }} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: '#b7b3a8', marginTop: 6 }}>320 / 500 RP TO GOLD I</div>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: '#b7b3a8', borderTop: '2px solid #3a3833', paddingTop: 10 }}>
          THIS SEASON · <b style={{ color: '#fff' }}>41W — 26L</b> · <b style={{ color: 'var(--yellow)' }}>+480 RP</b>
        </div>
      </div>
      <div className="row between aic">
        <span className="mono" style={{ fontSize: 10.5, color: '#b7b3a8' }}>ENDS IN 12D</span>
        <span className="display" style={{ fontSize: 13, color: 'var(--yellow)' }}>VIEW RANKS →</span>
      </div>
    </NBCard>
  );
}

/* ---------- upgrade CTA (username-only) ---------- */
function PfUpgrade({ desktop }) {
  return (
    <NBCard fill="var(--blue)" className="lift" style={{
      padding: desktop ? '14px 20px' : 16, color: '#fff',
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flex: '0 0 auto',
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 10, flex: '0 0 auto', transform: 'rotate(-5deg)',
        background: 'rgba(255,255,255,.18)', border: '2px solid #fff',
        display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24,
      }}>↑</div>
      <div style={{ flex: '1 1 230px', minWidth: 0 }}>
        <div className="display" style={{ fontSize: desktop ? 20 : 17, lineHeight: 1.08 }}>Save your progress — create a full account</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,.92)', marginTop: 3 }}>
          Your streak, stats &amp; badges live on this device only. Back them up and unlock Ranked.
        </div>
      </div>
      <button className="btn" style={{ background: '#fff', flex: '0 0 auto', fontSize: 13 }}>CREATE ACCOUNT →</button>
    </NBCard>
  );
}

/* ---------- stat tiles ---------- */
function PfStats({ guest }) {
  const tiles = [
    ['Games played', guest ? '38' : '412'],
    ['Win rate', guest ? '54%' : '61%'],
    ['Best streak', guest ? '11' : '23'],
    ['Fav topic', '⚽ Football'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', gap: 12, flex: '1 1 auto', minHeight: 0 }}>
      {tiles.map(([l, v]) => (
        <div key={l} style={{
          border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
          background: 'var(--surface)', padding: '13px 14px', minWidth: 0, textAlign: 'center',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div className="eyebrow" style={{ fontSize: 9.5 }}>{l}</div>
          <div className="display" style={{ fontSize: 26, lineHeight: 1, marginTop: 6, whiteSpace: 'nowrap' }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- achievements ---------- */
function PfBadges({ guest, cols = 2 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, flex: '1 1 auto' }}>
      <div className="row between aic" style={{ flex: '0 0 auto' }}>
        <span className="eyebrow">Achievements</span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{guest ? '3' : '4'} / 6</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gridAutoRows: '1fr', gap: 10, flex: '1 1 auto', minHeight: 0 }}>
        {PROF_BADGES.map(b => {
          const locked = !b.earned || (guest && b.ranked);
          const sub = (guest && b.ranked) ? 'RANKED ONLY' : (b.earned || b.progress + ' · IN PROGRESS');
          return (
            <div key={b.name} style={{
              border: locked ? '2px dashed var(--ink-soft)' : 'var(--bw) solid var(--ink)',
              borderRadius: 'var(--radius)',
              background: locked ? 'transparent' : (b.fill || 'var(--surface)'),
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
              opacity: locked ? .62 : 1, minWidth: 0,
            }}>
              <span style={{ fontSize: 20, flex: '0 0 auto', filter: locked ? 'grayscale(1)' : 'none' }}>{b.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div className="display" style={{ fontSize: 13.5, lineHeight: 1.1 }}>{b.name}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-soft)', marginTop: 3, letterSpacing: '.05em' }}>{sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- recent activity ---------- */
function PfActivity({ guest, limit }) {
  const rows = PROF_ACTIVITY.slice(0, limit || PROF_ACTIVITY.length);
  return (
    <NBCard style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', flex: '1 1 auto' }}>
      <div className="row between aic" style={{ padding: '12px 16px 10px', flex: '0 0 auto' }}>
        <span className="eyebrow">Recent activity</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>LAST 7 DAYS</span>
      </div>
      {rows.map(r => {
        const delta = (guest && r.ranked) ? r.casual : r.delta;
        const tone = r.good ? 'var(--good)' : r.bad ? 'var(--bad)' : 'var(--ink)';
        return (
          <div key={r.name + r.sub} className="row aic gap-12" style={{ borderTop: '2px solid var(--ink)', padding: '10px 16px', flex: '1 1 auto', minHeight: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flex: '0 0 auto',
              background: r.tint, border: '2px solid var(--ink)',
              color: r.dark ? '#fff' : 'var(--ink)',
              display: 'grid', placeItems: 'center', fontSize: 16,
            }}>{r.icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="display" style={{ fontSize: 13.5, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--ink-soft)', marginTop: 3, letterSpacing: '.05em' }}>{r.sub}</div>
            </div>
            <span className="mono" style={{
              fontSize: 11, fontWeight: 700, flex: '0 0 auto', color: tone,
              border: '2px solid ' + tone, borderRadius: 999, padding: '2px 9px',
            }}>{delta}</span>
          </div>
        );
      })}
    </NBCard>
  );
}

/* ---------- season history ---------- */
function PfSeasons({ guest }) {
  if (guest) {
    return <ImgSlot label="SEASON HISTORY — FULL ACCOUNTS ONLY" h={86} />;
  }
  return (
    <NBCard style={{ padding: 14, flex: '0 0 auto' }}>
      <div className="row between aic">
        <span className="eyebrow">Season history</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>PEAK TIER</span>
      </div>
      <div className="row gap-8" style={{ marginTop: 10 }}>
        {PROF_SEASONS.map(s => (
          <div key={s.s} style={{
            flex: 1, minWidth: 0, textAlign: 'center', padding: '9px 4px 8px',
            border: s.now ? 'var(--bw) solid var(--ink)' : '2px solid var(--ink)',
            borderRadius: 'var(--radius)',
            background: s.now ? s.c : 'var(--surface)',
            boxShadow: s.now ? 'calc(var(--sh) * .5) calc(var(--sh) * .5) 0 var(--ink)' : 'none',
          }}>
            <div className="row aic center gap-6">
              <span style={{ width: 12, height: 12, borderRadius: 3, background: s.now ? 'var(--ink)' : s.c, border: '2px solid var(--ink)', transform: 'rotate(-6deg)', display: 'inline-block' }}></span>
              <span className="mono" style={{ fontSize: 10, fontWeight: 700 }}>{s.s}</span>
            </div>
            <div className="display" style={{ fontSize: 12.5, marginTop: 4, whiteSpace: 'nowrap' }}>{s.tier}</div>
          </div>
        ))}
      </div>
    </NBCard>
  );
}

/* ---------- sign out ---------- */
function PfSignOut({ guest }) {
  return (
    <div className="col gap-8" style={{ flex: '0 0 auto' }}>
      {guest && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--bad)', letterSpacing: '.04em' }}>
          ⚠ USERNAME-ONLY: SIGNING OUT ERASES PROGRESS ON THIS DEVICE.
        </div>
      )}
      <button className="btn block" style={{ background: 'var(--surface)', color: 'var(--bad)', fontSize: 13, padding: '10px 14px' }}>
        SIGN OUT
      </button>
    </div>
  );
}

/* ============================================================ */
function Profile({ bp, nav, account }) {
  const desktop = bp === 'desktop';
  const guest = account === 'username-only';

  const header = (
    <div className="row between aic" style={{ padding: desktop ? '16px 22px 12px' : '12px 16px', flex: '0 0 auto', gap: 12 }}>
      <div className="row aic gap-12" style={{ minWidth: 0 }}>
        <button className="btn btn-ghost" onClick={() => nav('home')} style={{ boxShadow: 'none', padding: '6px 11px' }}>←</button>
        <div>
          <div className="eyebrow">Your locker</div>
          <div className="display" style={{ fontSize: desktop ? 26 : 21, lineHeight: 1.05, marginTop: 2 }}>Profile</div>
        </div>
      </div>
      <span className="chip solid-ink">@JAYDEE_9</span>
    </div>
  );

  if (desktop) {
    return (
      <div className="screen no-scroll pop">
        {header}
        {guest && <div style={{ padding: '0 22px 16px', flex: '0 0 auto' }}><PfUpgrade desktop /></div>}
        <div style={{
          flex: 1, minHeight: 0, padding: '0 22px 22px',
          display: 'grid', gridTemplateColumns: '1.05fr 1.25fr 1.1fr', gap: 16,
        }}>
          {/* identity + rank + sign-out */}
          <div className="col gap-16" style={{ minHeight: 0 }}>
            <PfIdentity guest={guest} desktop />
            <PfRank guest={guest} nav={nav} />
            <div style={{ marginTop: 'auto' }}><PfSignOut guest={guest} /></div>
          </div>
          {/* stats + achievements */}
          <div className="col gap-16" style={{ minHeight: 0 }}>
            <PfStats guest={guest} />
            <PfBadges guest={guest} cols={2} />
          </div>
          {/* activity + seasons */}
          <div className="col gap-16" style={{ minHeight: 0 }}>
            <PfActivity guest={guest} limit={guest ? 4 : 5} />
            <PfSeasons guest={guest} />
          </div>
        </div>
      </div>
    );
  }

  /* mobile — scrolls */
  return (
    <div className="screen scroll-y pop">
      {header}
      <div style={{ padding: '0 16px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PfIdentity guest={guest} />
        {guest && <PfUpgrade />}
        <PfRank guest={guest} nav={nav} />
        <PfStats guest={guest} />
        <PfBadges guest={guest} cols={2} />
        <PfActivity guest={guest} />
        <PfSeasons guest={guest} />
        <PfSignOut guest={guest} />
      </div>
    </div>
  );
}

Object.assign(window, { Profile });
