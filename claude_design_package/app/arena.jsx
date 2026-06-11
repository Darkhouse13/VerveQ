/* global React, NBCard, StatusDot, Stat, TimerBadge, ARENA_ROSTER, ARENA_REVEAL */
const { useState: useStateArena, useEffect: useEffectArena, useRef: useRefArena } = React;

/* The one in-game question. Lives ONLY in the center column — never in side panels. */
const ARENA_Q = {
  round: 4, total: 10, category: 'Knowledge',
  prompt: "Which nation has won the most men's FIFA World Cups?",
  options: [
    { k: 'A', t: 'Brazil' },
    { k: 'B', t: 'Germany' },
    { k: 'C', t: 'Italy' },
    { k: 'D', t: 'Argentina' },
  ],
  correct: 'A',
};

/* ---- the centered phone-width ANSWERING column (the only answer surface) ---- */
function AnswerColumn({ phase, picked, setPicked, locked, setLocked, seconds, embedded }) {
  const reveal = phase === 'reveal';
  return (
    <div style={{
      width: embedded ? 392 : '100%', maxWidth: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      background: 'var(--surface)',
      border: embedded ? 'var(--bw) solid var(--ink)' : 'none',
      borderRadius: embedded ? 'var(--radius)' : 0,
      boxShadow: embedded ? 'var(--sh) var(--sh) 0 var(--ink)' : 'none',
      overflow: 'hidden',
    }}>
      {/* column header */}
      <div className="row between aic" style={{ padding: '12px 14px', borderBottom: 'var(--bw) solid var(--ink)', flex: '0 0 auto', background: 'var(--paper)' }}>
        <span className="chip solid-ink">ROUND {ARENA_Q.round} / {ARENA_Q.total}</span>
        <span className="chip solid-yellow">{ARENA_Q.category}</span>
        <TimerBadge seconds={seconds} total={14} />
      </div>

      {/* question + options — scrolls only inside the phone column if ever needed */}
      <div style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div className="eyebrow">Question</div>
        <div className="display" style={{ fontSize: 23, lineHeight: 1.08 }}>{ARENA_Q.prompt}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
          {ARENA_Q.options.map(o => {
            const isPicked = picked === o.k;
            const isCorrect = reveal && o.k === ARENA_Q.correct;
            const isWrongPick = reveal && isPicked && o.k !== ARENA_Q.correct;
            let fill = 'var(--surface)', color = 'var(--ink)';
            if (isCorrect) { fill = 'var(--good)'; color = '#fff'; }
            else if (isWrongPick) { fill = 'var(--bad)'; color = '#fff'; }
            else if (isPicked && !reveal) { fill = 'var(--ink)'; color = '#fff'; }
            return (
              <button key={o.k}
                onClick={() => !locked && !reveal && setPicked(o.k)}
                style={{
                  border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
                  background: fill, color, padding: '13px 14px', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-ui)',
                  fontWeight: 600, fontSize: 15.5,
                  boxShadow: isPicked ? 'none' : 'calc(var(--sh)*.5) calc(var(--sh)*.5) 0 var(--ink)',
                  transform: isPicked ? 'translate(2px,2px)' : 'none',
                  cursor: locked || reveal ? 'default' : 'pointer',
                  opacity: reveal && !isCorrect && !isWrongPick ? .45 : 1,
                }}>
                <span className="display" style={{
                  width: 28, height: 28, flex: '0 0 auto', borderRadius: 6,
                  border: '2px solid currentColor', display: 'grid', placeItems: 'center', fontSize: 14,
                }}>{o.k}</span>
                <span style={{ flex: 1 }}>{o.t}</span>
                {isCorrect && <span style={{ fontSize: 18 }}>✓</span>}
                {isWrongPick && <span style={{ fontSize: 18 }}>✕</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* footer action */}
      <div style={{ padding: 14, borderTop: 'var(--bw) solid var(--ink)', flex: '0 0 auto', background: 'var(--paper)' }}>
        {!reveal && (
          <button className={'btn block ' + (picked ? 'btn-orange' : '')}
            disabled={!picked}
            onClick={() => setLocked(true)}
            style={{ opacity: picked ? 1 : .5, cursor: picked ? 'pointer' : 'not-allowed' }}>
            {locked ? '✓ LOCKED IN — WAITING…' : 'LOCK IN ANSWER'}
          </button>
        )}
        {reveal && (
          <div className="row between aic">
            <div>
              <div className="eyebrow">Result</div>
              <div className="display" style={{ fontSize: 20, color: picked === ARENA_Q.correct ? 'var(--good)' : 'var(--bad)' }}>
                {picked === ARENA_Q.correct ? 'CORRECT +90' : 'MISSED +0'}
              </div>
            </div>
            <span className="chip solid-ink">NEXT IN 0:04</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- ambient side panels (allowlist only: timer/score/lives/streak/combo/roster/standings) ---- */
function RosterPanel({ phase }) {
  const reveal = phase === 'reveal';
  return (
    <div className="nb" style={{ padding: 14, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div className="row between aic" style={{ flex: '0 0 auto' }}>
        <div className="eyebrow">{reveal ? 'Reveal · who picked what' : 'Live roster · 6 players'}</div>
        <span className="chip" style={{ fontSize: 9 }}>{reveal ? 'VERDICTS' : 'STATUS'}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!reveal && ARENA_ROSTER.map(p => (
          <div key={p.id} className="nb-flat" style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10, background: p.you ? 'var(--yellow)' : 'var(--surface)' }}>
            <div style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 999, border: '2px solid var(--ink)', background: p.you ? 'var(--orange)' : 'var(--surface)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 11, color: p.you ? '#fff' : 'var(--ink)' }}>
              {p.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <StatusDot status={p.status} />
            </div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{p.score}</div>
          </div>
        ))}
        {reveal && ARENA_REVEAL.map(p => (
          <div key={p.id} className="nb-flat" style={{ padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10, background: p.you ? 'var(--yellow)' : 'var(--surface)' }}>
            <span className="display" style={{ width: 26, height: 26, flex: '0 0 auto', borderRadius: 6, border: '2px solid var(--ink)', display: 'grid', placeItems: 'center', fontSize: 12, background: p.correct ? 'var(--good)' : 'var(--bad)', color: '#fff' }}>{p.pick}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{(p.ms / 1000).toFixed(2)}s · {p.delta}</div>
            </div>
            <span style={{ fontSize: 15 }}>{p.correct ? '✓' : '✕'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StandingsPanel() {
  const sorted = [...ARENA_ROSTER].sort((a, b) => b.score - a.score);
  return (
    <div className="nb" style={{ padding: 14, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div className="eyebrow" style={{ flex: '0 0 auto' }}>Running standings</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {sorted.map((p, i) => (
          <div key={p.id} className="row aic gap-10" style={{ padding: '6px 8px', borderRadius: 6, background: p.you ? 'var(--yellow)' : 'transparent', border: p.you ? '2px solid var(--ink)' : '2px solid transparent' }}>
            <span className="display" style={{ fontSize: 15, width: 20 }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            {p.streak > 2 && <span className="chip" style={{ fontSize: 8.5, padding: '2px 7px' }}>🔥{p.streak}</span>}
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function YouPanel({ seconds }) {
  return (
    <div className="nb" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, height: '100%' }}>
      <div className="row between aic">
        <div className="eyebrow">This round</div>
        <span className="chip" style={{ fontSize: 9 }}>SERVER CLOCK</span>
      </div>
      <div className="row center"><TimerBadge seconds={seconds} total={14} fill="var(--surface)" /></div>
      <div className="rule" />
      <div className="eyebrow">Your run</div>
      <div className="row gap-8"><Stat label="SCORE" value="1,840" fill="var(--surface)" /><Stat label="RANK" value="4th" fill="var(--surface)" /></div>
      <div className="row gap-8">
        <div style={{ flex: 1, border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', padding: '7px 11px', textAlign: 'center' }}>
          <div className="eyebrow" style={{ fontSize: 9.5 }}>LIVES</div>
          <div style={{ fontSize: 17, marginTop: 2 }}>♥♥<span style={{ opacity: .25 }}>♥</span></div>
        </div>
        <Stat label="STREAK" value="🔥4" fill="var(--surface)" />
      </div>
      <div style={{ border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', padding: '9px 11px', textAlign: 'center', background: 'var(--orange)', color: '#fff' }}>
        <div className="eyebrow" style={{ fontSize: 9.5, color: '#fff' }}>COMBO MULTIPLIER</div>
        <div className="display" style={{ fontSize: 28, lineHeight: 1 }}>×2.5</div>
      </div>
    </div>
  );
}

function Arena({ bp, nav }) {
  const desktop = bp === 'desktop';
  const [phase, setPhase] = useStateArena('question');  // question | reveal
  const [picked, setPicked] = useStateArena(null);
  const [locked, setLocked] = useStateArena(false);
  const [seconds, setSeconds] = useStateArena(11);
  const tick = useRefArena();

  useEffectArena(() => {
    if (phase !== 'question') return;
    tick.current = setInterval(() => setSeconds(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(tick.current);
  }, [phase]);

  const broadcastBar = (
    <div className="row between aic" style={{ padding: desktop ? '12px 22px' : '10px 14px', flex: '0 0 auto', background: 'var(--ink)', color: '#fff', borderBottom: '2px solid #000' }}>
      <div className="row aic gap-12" style={{ minWidth: 0 }}>
        <button className="btn btn-ghost" onClick={() => nav('compete')} style={{ boxShadow: 'none', padding: '5px 10px', color: '#fff', borderColor: '#3a3833' }}>←</button>
        <span className="chip" style={{ background: 'var(--orange)', color: '#fff', borderColor: '#fff' }}>◈ CHALLENGE ARENA</span>
        {desktop && <span className="mono" style={{ fontSize: 12, color: '#b7b3a8' }}>Lobby #ARENA-7K2 · Football · Knowledge</span>}
      </div>
      <div className="row aic gap-8">
        {/* presenter toggle to demo the reveal state */}
        <button className="btn" onClick={() => setPhase(p => p === 'question' ? 'reveal' : 'question')}
          style={{ background: 'var(--yellow)', padding: '6px 12px', fontSize: 12 }}>
          {phase === 'question' ? '▶ SHOW REVEAL' : '↺ BACK TO QUESTION'}
        </button>
      </div>
    </div>
  );

  if (desktop) {
    return (
      <div className="screen no-scroll pop" style={{ background: '#201E1A' }}>
        {broadcastBar}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 392px 1fr', gap: 18, padding: 20 }}>
          {/* LEFT ambient */}
          <div style={{ display: 'grid', gridTemplateRows: '1.3fr 1fr', gap: 16, minHeight: 0 }}>
            <RosterPanel phase={phase} />
            <StandingsPanel />
          </div>
          {/* CENTER stays a phone */}
          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <AnswerColumn embedded phase={phase} picked={picked} setPicked={setPicked} locked={locked} setLocked={setLocked} seconds={seconds} />
          </div>
          {/* RIGHT ambient */}
          <div style={{ minHeight: 0 }}>
            <YouPanel seconds={seconds} />
          </div>
        </div>
        {/* answer-leak note for the operator */}
        <div className="mono" style={{ position: 'absolute', bottom: 8, left: 22, fontSize: 10, color: '#6f6c64' }}>
          side panels = timer · score · lives · streak · combo · roster status · standings · (reveal: picks). never question / options / answers.
        </div>
      </div>
    );
  }

  /* MOBILE — side context collapses into a compact header + roster strip */
  const sorted = [...ARENA_ROSTER].sort((a, b) => b.score - a.score);
  return (
    <div className="screen no-scroll pop" style={{ background: 'var(--paper)' }}>
      {broadcastBar}
      {/* collapsed ambient: status strip */}
      <div style={{ padding: '10px 12px 8px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: 'var(--bw) solid var(--ink)' }}>
        <div className="row between aic">
          <span className="chip solid-ink" style={{ fontSize: 9 }}>4th / 6 · 1,840</span>
          <span className="chip" style={{ fontSize: 9 }}>♥♥· 🔥4 · ×2.5</span>
        </div>
        <div className="row gap-6" style={{ overflowX: 'auto', paddingBottom: 2 }}>
          {(phase === 'question' ? ARENA_ROSTER : ARENA_REVEAL).map(p => (
            <div key={p.id} style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 46 }}>
              <div style={{ position: 'relative', width: 34, height: 34, borderRadius: 999, border: '2px solid var(--ink)', background: p.you ? 'var(--orange)' : 'var(--surface)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 11, color: p.you ? '#fff' : 'var(--ink)' }}>
                {p.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                <span style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 999, border: '2px solid var(--ink)', background: phase === 'reveal' ? (p.correct ? 'var(--good)' : 'var(--bad)') : (p.status === 'locked' ? 'var(--blue)' : p.status === 'answered' ? 'var(--good)' : 'var(--yellow)') }} />
              </div>
              <span className="mono" style={{ fontSize: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 44 }}>{p.name.split(/[ _]/)[0]}</span>
            </div>
          ))}
        </div>
      </div>
      {/* the answering column fills the phone */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <AnswerColumn phase={phase} picked={picked} setPicked={setPicked} locked={locked} setLocked={setLocked} seconds={seconds} />
      </div>
    </div>
  );
}

Object.assign(window, { Arena });
