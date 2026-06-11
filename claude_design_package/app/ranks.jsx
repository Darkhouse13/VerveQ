/* global React */

/* ============================================================
   THE RANKS — competitive ladder, dark "premium" space.
   Hero: your ELO + tier + progress to next. Ladder: Bronze →
   Platinum staircase, your division highlighted. Leaderboard
   preview with your pinned row. Username-only: locked hero +
   CTA, ladder visible but unhighlighted.
   ============================================================ */

const RANK_LINE = '#3a3833';
const RANK_SOFT = '#b7b3a8';
const RANK_FAINT = '#8d8a81';

/* top → bottom (ladder reads downward from Platinum) */
const RANK_TIERS = [
  { id: 'plat',   name: 'Platinum', c: '#5FD0C8', range: '1800+ ELO',     sub: 'SEASONAL CROWN', pct: 'TOP 2% OF PLAYERS' },
  { id: 'gold',   name: 'Gold',     c: '#E2B23A', range: '1200–1799',     me: true, pct: '19% OF PLAYERS' },
  { id: 'silver', name: 'Silver',   c: '#9AA1A8', range: '600–1199 ELO',  sub: 'PROMOTION SERIES UNLOCK', pct: '41% OF PLAYERS' },
  { id: 'bronze', name: 'Bronze',   c: '#B07A43', range: '0–599 ELO',     sub: 'EVERYONE PLACES HERE', pct: '38% OF PLAYERS' },
];

const RANK_TOP = [
  { r: 1, n: 'venn_diagram', elo: '2,412' },
  { r: 2, n: 'K. Mensah',    elo: '2,389' },
  { r: 3, n: 'tiki_taka_',   elo: '2,371' },
  { r: 4, n: 'salah_szn',    elo: '2,298' },
  { r: 5, n: 'M. Okafor',    elo: '2,260' },
];
const RANK_MEDAL = { 1: '#E2B23A', 2: '#C9CFD6', 3: '#B07A43' };

function RkEmblem({ size = 84, c1 = 'var(--yellow)', c2 = 'var(--orange)', glyph = '♛', border = '#fff' }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * .17), flex: '0 0 auto',
      transform: 'rotate(-6deg)', background: `linear-gradient(135deg,${c1},${c2})`,
      border: Math.max(2, Math.round(size / 21)) + 'px solid ' + border,
      display: 'grid', placeItems: 'center', fontSize: size * .48,
    }}>{glyph}</div>
  );
}

/* ---------- hero: your standing (full account) ---------- */
function RkHero({ nav, desktop }) {
  return (
    <div style={{
      border: '3px solid #fff', borderRadius: 'var(--radius)',
      background: 'linear-gradient(150deg,#2a2823,#1a1916)',
      padding: desktop ? 22 : 18, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 14, flex: '1 1 auto',
    }}>
      <div className="row between aic">
        <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff' }}>SEASON 4</span>
        <span className="mono" style={{ fontSize: 10.5, color: RANK_SOFT, letterSpacing: '.08em' }}>ENDS IN 12 DAYS</span>
      </div>
      <div className="col gap-14" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
        <div className="row aic gap-16">
          <RkEmblem size={desktop ? 86 : 72} />
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: desktop ? 40 : 32, color: '#fff', lineHeight: .95 }}>Gold II</div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--yellow)', marginTop: 6 }}>#1,204 GLOBALLY · TOP 8%</div>
          </div>
        </div>
        <div className="row aic gap-10" style={{ alignItems: 'baseline' }}>
          <span className="display" style={{ fontSize: desktop ? 54 : 44, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>1,514</span>
          <span className="eyebrow" style={{ color: RANK_FAINT }}>ELO RATING</span>
        </div>
        <div>
          <div style={{ height: 14, border: '2px solid #fff', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: '64%', height: '100%', background: 'linear-gradient(90deg,var(--yellow),var(--orange))' }} />
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: RANK_SOFT, marginTop: 7 }}>
            320 / 500 RP TO <b style={{ color: 'var(--yellow)' }}>GOLD I</b> · PROMOTION SERIES AT 500
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {['PER-MODE RATINGS · SEASON 5', 'SEASON ARCHIVE · SOON'].map(l => (
          <div key={l} style={{
            border: '2px dashed ' + RANK_LINE, borderRadius: 'var(--radius)',
            minHeight: 52, display: 'grid', placeItems: 'center', padding: '8px 10px',
          }}>
            <span className="mono" style={{ fontSize: 9, color: RANK_FAINT, letterSpacing: '.08em', textAlign: 'center' }}>{l}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-orange block" onClick={() => nav('compete')}>PLAY RANKED →</button>
    </div>
  );
}

/* ---------- hero: locked (username-only) ---------- */
function RkHeroLocked({ nav, desktop }) {
  return (
    <div style={{
      border: '3px solid #fff', borderRadius: 'var(--radius)',
      background: 'linear-gradient(150deg,#2a2823,#1a1916)',
      padding: desktop ? 22 : 18, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 14, flex: '1 1 auto',
    }}>
      <div className="row between aic">
        <span className="chip" style={{ background: '#26241f', color: RANK_SOFT, borderColor: RANK_LINE }}>SEASON 4</span>
        <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff' }}>🔒 FULL ACCOUNTS</span>
      </div>
      <RkEmblem size={desktop ? 86 : 72} c1="#26241f" c2="#3a3833" glyph="🔒" border={RANK_LINE} />
      <div>
        <div className="display" style={{ fontSize: desktop ? 34 : 28, color: '#fff', lineHeight: 1 }}>Ranked is waiting</div>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: RANK_SOFT, fontWeight: 500, maxWidth: 360 }}>
          ELO, tiers and the season ladder are for full accounts — so every rank is earned by one real player.
          Your casual stats stay; placement takes <b style={{ color: '#fff' }}>5 ranked matches</b> once you upgrade.
        </p>
      </div>
      <div style={{ border: '2px dashed ' + RANK_LINE, borderRadius: 'var(--radius)', padding: '10px 14px' }}>
        <span className="mono" style={{ fontSize: 10, color: RANK_FAINT, letterSpacing: '.06em' }}>
          YOUR ELO · YOUR TIER · YOUR GLOBAL RANK — APPEAR HERE
        </span>
      </div>
      <div className="col gap-10" style={{ marginTop: 'auto' }}>
        <button className="btn btn-orange block">CREATE FULL ACCOUNT →</button>
        <button className="btn btn-ghost block" onClick={() => nav('compete')} style={{ color: '#fff', borderColor: RANK_LINE, fontSize: 13 }}>
          KEEP PLAYING CASUAL
        </button>
      </div>
    </div>
  );
}

/* ---------- ladder ---------- */
function RkDivisions({ active }) {
  /* III → I, with II in progress */
  const divs = [
    { d: 'III', state: 'done' },
    { d: 'II',  state: 'now' },
    { d: 'I',   state: 'next' },
  ];
  if (!active) {
    return (
      <div className="row gap-6" style={{ flex: '0 0 auto' }}>
        {divs.map(x => (
          <span key={x.d} className="mono" style={{
            fontSize: 9, color: RANK_FAINT, border: '2px solid ' + RANK_LINE,
            borderRadius: 4, padding: '2px 6px', fontWeight: 700,
          }}>{x.d}</span>
        ))}
      </div>
    );
  }
  return (
    <div className="row gap-8" style={{ marginTop: 12 }}>
      {divs.map(x => (
        <div key={x.d} style={{
          flex: 1, borderRadius: 6, padding: '7px 9px', position: 'relative',
          border: x.state === 'now' ? '3px solid var(--yellow)' : '2px solid ' + RANK_LINE,
          background: x.state === 'done' ? '#E2B23A' : 'transparent',
        }}>
          <div className="row between aic">
            <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: x.state === 'done' ? 'var(--ink)' : '#fff' }}>{x.d}</span>
            {x.state === 'done' && <span className="mono" style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink)' }}>✓</span>}
            {x.state === 'now' && <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff', fontSize: 8, padding: '1px 7px' }}>YOU</span>}
          </div>
          {x.state === 'now' && (
            <div style={{ height: 7, border: '2px solid #fff', borderRadius: 999, overflow: 'hidden', marginTop: 7 }}>
              <div style={{ width: '64%', height: '100%', background: 'var(--yellow)' }} />
            </div>
          )}
          {x.state === 'next' && <div className="mono" style={{ fontSize: 9, color: RANK_FAINT, marginTop: 8 }}>500 RP</div>}
        </div>
      ))}
    </div>
  );
}

function RkLadder({ guest, desktop }) {
  const step = desktop ? 26 : 10;
  return (
    <div className="col" style={{ minHeight: 0, gap: desktop ? 12 : 10 }}>
      <div className="row between aic" style={{ flex: '0 0 auto' }}>
        <span className="eyebrow" style={{ color: RANK_SOFT }}>The ladder</span>
        <span className="mono" style={{ fontSize: 10, color: RANK_FAINT }}>CLIMB ↑ · BRONZE → PLATINUM</span>
      </div>
      {RANK_TIERS.map((t, i) => {
        const isMe = t.me && !guest;
        return (
          <div key={t.id} style={{
            marginLeft: (RANK_TIERS.length - 1 - i) * step,
            border: isMe ? '3px solid var(--yellow)' : '2px solid ' + RANK_LINE,
            borderRadius: 'var(--radius)',
            background: isMe ? '#26241f' : 'rgba(255,255,255,.025)',
            padding: isMe ? '14px 16px' : '11px 14px',
            flex: desktop ? (isMe ? '1.4 1 auto' : '1 1 auto') : '0 0 auto', minHeight: 0,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            boxShadow: isMe ? '6px 6px 0 rgba(226,178,58,.25)' : 'none',
          }}>
            <div className="row aic gap-12">
              <RkEmblem size={isMe ? 50 : (desktop ? 46 : 38)} c1={t.c} c2={t.c} glyph="♛" border={isMe ? '#fff' : RANK_LINE} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row aic gap-8">
                  <span className="display" style={{ fontSize: isMe ? 22 : (desktop ? 21 : 17), color: '#fff', lineHeight: 1 }}>{t.name}</span>
                  {isMe && <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff', fontSize: 8.5 }}>YOU ARE HERE</span>}
                </div>
                <div className="mono" style={{ fontSize: 9.5, color: isMe ? 'var(--yellow)' : RANK_FAINT, marginTop: 3, letterSpacing: '.05em' }}>
                  {t.range}{t.sub ? ' · ' + t.sub : isMe ? ' · DIVISIONS CLIMB III → I' : ''}
                </div>
              </div>
              {!isMe && (
                <div className="col gap-6" style={{ alignItems: 'flex-end', flex: '0 0 auto' }}>
                  <RkDivisions active={false} />
                  <span className="mono" style={{ fontSize: 8.5, color: RANK_FAINT, letterSpacing: '.08em' }}>{t.pct}</span>
                </div>
              )}
            </div>
            {isMe && <RkDivisions active />}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- leaderboard preview ---------- */
function RkBoard({ guest, desktop }) {
  return (
    <div style={{
      border: '2px solid ' + RANK_LINE, borderRadius: 'var(--radius)',
      display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', flex: '1 1 auto',
      background: 'rgba(255,255,255,.025)',
    }}>
      <div className="row between aic" style={{ padding: '13px 16px 11px', flex: '0 0 auto' }}>
        <span className="eyebrow" style={{ color: RANK_SOFT }}>Global leaderboard</span>
        <span className="mono" style={{ fontSize: 10, color: RANK_FAINT }}>9,996 PLAYERS</span>
      </div>
      <div style={{ minHeight: 0, overflow: 'hidden', flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        {RANK_TOP.map(p => (
          <div key={p.r} className="row aic gap-12" style={{ borderTop: '2px solid ' + RANK_LINE, padding: desktop ? '10px 16px' : '9px 14px', flex: '1 1 auto', minHeight: 0 }}>
            <span style={{
              width: 26, height: 26, borderRadius: 999, flex: '0 0 auto',
              border: '2px solid ' + (RANK_MEDAL[p.r] || RANK_LINE),
              background: RANK_MEDAL[p.r] || 'transparent',
              color: RANK_MEDAL[p.r] ? 'var(--ink)' : RANK_FAINT,
              display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 12,
            }}>{p.r}</span>
            <span className="display" style={{ fontSize: 14.5, color: '#fff', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.n}</span>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: '#5FD0C8', border: '2px solid #fff', transform: 'rotate(-6deg)', flex: '0 0 auto' }}></span>
            <span className="mono" style={{ fontSize: 11.5, color: RANK_SOFT, fontWeight: 700 }}>{p.elo}</span>
          </div>
        ))}
      </div>
      <div className="mono tac" style={{ fontSize: 11, color: RANK_FAINT, padding: '4px 0 2px', letterSpacing: '.4em', flex: '0 0 auto' }}>···</div>
      {guest ? (
        <div className="row aic gap-12" style={{ borderTop: '2px dashed ' + RANK_LINE, padding: '11px 16px', flex: '0 0 auto' }}>
          <span style={{
            width: 26, height: 26, borderRadius: 999, border: '2px dashed ' + RANK_LINE,
            display: 'grid', placeItems: 'center', fontSize: 11, color: RANK_FAINT, flex: '0 0 auto',
          }}>?</span>
          <span className="mono" style={{ fontSize: 10, color: RANK_FAINT, flex: 1, letterSpacing: '.04em' }}>
            YOUR ROW UNLOCKS WITH A FULL ACCOUNT
          </span>
        </div>
      ) : (
        <div className="row aic gap-12" style={{
          borderTop: '3px solid var(--yellow)', padding: '11px 16px',
          background: '#26241f', flex: '0 0 auto',
        }}>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--yellow)', fontWeight: 700, flex: '0 0 auto' }}>#1,204</span>
          <span style={{
            width: 26, height: 26, borderRadius: 8, background: 'var(--pink)', border: '2px solid #fff',
            display: 'grid', placeItems: 'center', color: '#fff',
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 10, transform: 'rotate(-4deg)', flex: '0 0 auto',
          }}>JD</span>
          <span className="display" style={{ fontSize: 14.5, color: '#fff', flex: 1 }}>JayDee_9 <span className="mono" style={{ fontSize: 9.5, color: 'var(--yellow)', fontWeight: 700 }}>YOU</span></span>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: '#E2B23A', border: '2px solid #fff', transform: 'rotate(-6deg)', flex: '0 0 auto' }}></span>
          <span className="mono" style={{ fontSize: 11.5, color: '#fff', fontWeight: 700 }}>1,514</span>
        </div>
      )}
      <div style={{ padding: 12, flex: '0 0 auto', borderTop: '2px solid ' + RANK_LINE }}>
        <button className="btn block" style={{
          background: 'transparent', color: '#fff', borderColor: '#fff',
          boxShadow: 'none', fontSize: 13, padding: '10px 14px',
        }}>FULL LEADERBOARD →</button>
      </div>
    </div>
  );
}

/* ============================================================ */
function Ranks({ bp, nav, account }) {
  const desktop = bp === 'desktop';
  const guest = account === 'username-only';

  const header = (
    <div className="row between aic" style={{ padding: desktop ? '16px 22px 14px' : '12px 16px', flex: '0 0 auto', gap: 12 }}>
      <div className="row aic gap-12" style={{ minWidth: 0 }}>
        <button className="btn btn-ghost" onClick={() => nav('home')} style={{ boxShadow: 'none', padding: '6px 11px', color: '#fff', borderColor: RANK_LINE }}>←</button>
        <div>
          <div className="eyebrow" style={{ color: 'var(--yellow)' }}>Competitive ladder · Season 4</div>
          <div className="display" style={{ fontSize: desktop ? 27 : 21, color: '#fff', lineHeight: 1.05, marginTop: 2 }}>The Ranks</div>
        </div>
      </div>
      <span className="chip" style={{ background: '#26241f', color: RANK_SOFT, borderColor: RANK_LINE }}>⚽ FOOTBALL</span>
    </div>
  );

  if (desktop) {
    return (
      <div className="screen no-scroll pop" style={{ background: 'var(--ink)', color: '#fff' }}>
        {header}
        <div style={{
          flex: 1, minHeight: 0, padding: '0 22px 22px',
          display: 'grid', gridTemplateColumns: '1.05fr 1.35fr 1fr', gap: 18,
        }}>
          <div className="col" style={{ minHeight: 0 }}>
            {guest ? <RkHeroLocked nav={nav} desktop /> : <RkHero nav={nav} desktop />}
          </div>
          <RkLadder guest={guest} desktop />
          <div className="col" style={{ minHeight: 0 }}>
            <RkBoard guest={guest} desktop />
          </div>
        </div>
      </div>
    );
  }

  /* mobile — scrolls */
  return (
    <div className="screen scroll-y pop" style={{ background: 'var(--ink)', color: '#fff' }}>
      {header}
      <div style={{ padding: '0 16px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {guest ? <RkHeroLocked nav={nav} /> : <RkHero nav={nav} />}
        <RkLadder guest={guest} />
        <RkBoard guest={guest} />
      </div>
    </div>
  );
}

Object.assign(window, { Ranks });
