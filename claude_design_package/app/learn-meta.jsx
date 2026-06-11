/* global React, NBCard, MasteryBar, LEARN_SUBJECTS */
const { useState: useStateLM } = React;

/* ---------- Spacing / review surface: locked-in vs learning ---------- */
function LearnReview({ desktop, nav, goRun }) {
  const lockedIn = LEARN_SUBJECTS.filter(s => s.state === 'locked');
  const learning = LEARN_SUBJECTS.filter(s => s.state === 'learning');

  const Queue = ({ title, items, locked }) => (
    <div className="nb" style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: locked ? 'var(--surface)' : 'var(--surface)' }}>
      <div className="row between aic" style={{ flex: '0 0 auto' }}>
        <div>
          <div className="eyebrow" style={{ color: locked ? 'var(--blue)' : 'var(--orange)' }}>{locked ? 'Locked in' : 'Still learning'}</div>
          <div className="display" style={{ fontSize: 20 }}>{title}</div>
        </div>
        <span className="chip" style={{ background: locked ? 'var(--lime)' : 'var(--orange)', color: locked ? 'var(--ink)' : '#fff' }}>{items.length}</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', margin: '8px 0 12px', flex: '0 0 auto' }}>
        {locked ? 'Spacing out — you recall these reliably. Next nudge is days away, not now.' : 'Coming back soon while the memory is still forming. Short intervals on purpose.'}
      </p>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(s => (
          <div key={s.id} className="nb-flat" style={{ padding: 12, background: locked ? 'var(--surface)' : '#FFF1DC' }}>
            <div className="row between aic">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{s.label}</div>
              <span className="chip" style={{ fontSize: 9 }}>{locked ? `REVIEW IN ${Math.round((1 - s.mastery) * 6) + 5}D` : `DUE ${s.due > 10 ? 'NOW' : `IN ${s.due}H`}`}</span>
            </div>
            <div style={{ marginTop: 8 }}><MasteryBar value={s.mastery} tint={locked ? 'var(--lime)' : 'var(--orange)'} /></div>
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{Math.round(s.mastery * 100)}% mastery</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{s.due} items in queue</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="screen no-scroll pop">
      <div className="row between aic" style={{ padding: desktop ? '16px 22px 12px' : '12px 16px', flex: '0 0 auto' }}>
        <div className="row aic gap-12">
          <button className="btn btn-ghost" onClick={() => nav('learn')} style={{ boxShadow: 'none', padding: '6px 11px' }}>←</button>
          <div>
            <div className="eyebrow">Learn · spaced review</div>
            <div className="display" style={{ fontSize: desktop ? 26 : 21 }}>Your memory schedule</div>
          </div>
        </div>
        <button className="btn btn-orange" onClick={goRun} style={{ background: 'var(--orange)' }}>REVIEW DUE →</button>
      </div>
      <div style={{
        flex: 1, minHeight: 0, padding: desktop ? '0 22px 22px' : '0 16px 22px',
        display: 'grid', gap: desktop ? 18 : 12,
        gridTemplateColumns: desktop ? '1fr 1fr' : '1fr',
        gridAutoRows: desktop ? '1fr' : 'minmax(0,46%)',
        overflowY: desktop ? 'hidden' : 'auto',
      }}>
        <Queue title="Resting" items={lockedIn} locked />
        <Queue title="Active" items={learning} locked={false} />
      </div>
    </div>
  );
}

/* ---------- Subject-mastery dashboard ---------- */
function LearnMastery({ desktop, nav, goRun }) {
  const overall = Math.round(LEARN_SUBJECTS.reduce((a, s) => a + s.mastery, 0) / LEARN_SUBJECTS.length * 100);
  return (
    <div className="screen no-scroll pop">
      <div className="row between aic" style={{ padding: desktop ? '16px 22px 12px' : '12px 16px', flex: '0 0 auto' }}>
        <div className="row aic gap-12">
          <button className="btn btn-ghost" onClick={() => nav('learn')} style={{ boxShadow: 'none', padding: '6px 11px' }}>←</button>
          <div>
            <div className="eyebrow">Learn · mastery</div>
            <div className="display" style={{ fontSize: desktop ? 26 : 21 }}>Where you stand</div>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => nav('learn-review')} style={{ fontSize: 13 }}>Review schedule →</button>
      </div>

      <div style={{
        flex: 1, minHeight: 0, padding: desktop ? '0 22px 22px' : '0 16px 22px',
        display: 'grid', gap: desktop ? 18 : 14,
        gridTemplateColumns: desktop ? '300px 1fr' : '1fr',
        overflowY: desktop ? 'hidden' : 'auto',
      }}>
        {/* summary card */}
        <div className="nb" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, background: '#FBEED4', minHeight: 0 }}>
          <div className="eyebrow">Overall mastery</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="display" style={{ fontSize: 64, lineHeight: .9, color: 'var(--orange)' }}>{overall}</span>
            <span className="display" style={{ fontSize: 24 }}>%</span>
          </div>
          <MasteryBar value={overall / 100} tint="var(--orange)" />
          <div className="rule" style={{ margin: '4px 0' }} />
          <div className="row gap-10">
            <div style={{ flex: 1 }}><div className="display" style={{ fontSize: 28 }}>2</div><div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>LOCKED IN</div></div>
            <div style={{ flex: 1 }}><div className="display" style={{ fontSize: 28 }}>3</div><div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>LEARNING</div></div>
            <div style={{ flex: 1 }}><div className="display" style={{ fontSize: 28 }}>42</div><div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>DUE</div></div>
          </div>
          <button className="btn btn-orange block" onClick={goRun} style={{ marginTop: 'auto' }}>START SESSION →</button>
        </div>

        {/* per-subject */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflowY: desktop ? 'auto' : 'visible' }}>
          {LEARN_SUBJECTS.map(s => (
            <div key={s.id} className="nb-flat" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, flex: '0 0 auto', borderRadius: 10, border: 'var(--bw) solid var(--ink)', background: s.tint, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18 }}>
                {Math.round(s.mastery * 100)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between aic">
                  <div className="display" style={{ fontSize: 17 }}>{s.label}</div>
                  <span className="chip" style={{ background: s.state === 'locked' ? 'var(--lime)' : 'var(--surface)', fontSize: 9 }}>{s.state === 'locked' ? 'LOCKED IN' : 'LEARNING'}</span>
                </div>
                <div style={{ marginTop: 8 }}><MasteryBar value={s.mastery} tint={s.tint} /></div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 5 }}>{s.due} items due · last seen 2d ago</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LearnReview, LearnMastery });
