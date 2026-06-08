/* global React, NBCard, Ladder, LEARN_QUESTIONS, LearnReview, LearnMastery */
const { useState: useStateLearn } = React;

/* correctness helper */
function isCorrect(q, v) {
  if (v == null) return false;
  if (q.type === 'mcq') return v === q.correct;
  if (q.type === 'text') return q.accept.includes(String(v).trim().toLowerCase());
  if (q.type === 'numeric') return Number(v) === q.answer;
  if (q.type === 'order') {
    const target = [...q.items].sort((a, b) => a.year - b.year).map(i => i.id);
    return JSON.stringify(v) === JSON.stringify(target);
  }
  return false;
}

const TYPE_LABEL = { mcq: 'Multiple choice', text: 'Free text', numeric: 'Numeric', order: 'Put in order' };

/* ---------------- question type renderers (controlled) ---------------- */
function QMcq({ q, value, setValue, reveal, branchPick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {q.options.map(o => {
        const picked = value === o.k;
        const correct = reveal && o.k === q.correct;
        const wrong = reveal && picked && o.k !== q.correct;
        const isBranch = branchPick === o.k && !reveal;
        let fill = 'var(--surface)', color = 'var(--ink)';
        if (correct) { fill = 'var(--lime)'; }
        else if (wrong) { fill = 'var(--pink)'; color = '#fff'; }
        else if (picked) { fill = 'var(--ink)'; color = '#fff'; }
        return (
          <button key={o.k} onClick={() => !reveal && setValue(o.k)} style={{
            border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', background: fill, color,
            padding: '14px 15px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13,
            fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 15.5,
            boxShadow: picked ? 'none' : 'calc(var(--sh)*.5) calc(var(--sh)*.5) 0 var(--ink)',
            transform: picked ? 'translate(2px,2px)' : 'none', cursor: reveal ? 'default' : 'pointer',
            opacity: reveal && !correct && !wrong ? .5 : 1,
          }}>
            <span className="display" style={{ width: 30, height: 30, flex: '0 0 auto', borderRadius: 6, border: '2px solid currentColor', display: 'grid', placeItems: 'center', fontSize: 14 }}>{o.k}</span>
            <span style={{ flex: 1 }}>{o.t}</span>
            {correct && <span style={{ fontSize: 18 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function QText({ q, value, setValue, reveal }) {
  const ok = reveal && isCorrect(q, value);
  return (
    <div>
      <input value={value || ''} disabled={reveal} placeholder="Type your answer…" onChange={e => setValue(e.target.value)}
        style={{
          width: '100%', border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
          background: reveal ? (ok ? 'var(--lime)' : 'var(--surface)') : 'var(--surface)',
          padding: '16px 16px', fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 600,
          boxShadow: 'calc(var(--sh)*.5) calc(var(--sh)*.5) 0 var(--ink)', outline: 'none',
        }} />
      {reveal && (
        <div className="mono" style={{ fontSize: 12, marginTop: 10, color: 'var(--ink-soft)' }}>
          Accepted: <b style={{ color: 'var(--ink)' }}>{q.correct}</b>
        </div>
      )}
    </div>
  );
}

function QNumeric({ q, value, setValue, reveal }) {
  const ok = reveal && isCorrect(q, value);
  return (
    <div className="row aic gap-12">
      <input type="number" value={value ?? ''} disabled={reveal} placeholder="00" onChange={e => setValue(e.target.value)}
        style={{
          width: 150, border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
          background: reveal ? (ok ? 'var(--lime)' : 'var(--surface)') : 'var(--surface)',
          padding: '14px 16px', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 38,
          textAlign: 'center', boxShadow: 'calc(var(--sh)*.5) calc(var(--sh)*.5) 0 var(--ink)', outline: 'none',
        }} />
      <span className="display" style={{ fontSize: 22, color: 'var(--ink-soft)' }}>{q.unit}</span>
    </div>
  );
}

function QOrder({ q, value, setValue, reveal }) {
  const order = value || q.items.map(i => i.id);
  const byId = Object.fromEntries(q.items.map(i => [i.id, i]));
  const target = [...q.items].sort((a, b) => a.year - b.year).map(i => i.id);
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setValue(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {order.map((id, i) => {
        const it = byId[id];
        const rightSpot = reveal && target[i] === id;
        return (
          <div key={id} className="nb-flat" style={{
            padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 12,
            background: reveal ? (rightSpot ? 'var(--lime)' : 'var(--pink)') : 'var(--surface)',
            color: reveal && !rightSpot ? '#fff' : 'var(--ink)',
            boxShadow: 'calc(var(--sh)*.5) calc(var(--sh)*.5) 0 var(--ink)',
          }}>
            <span className="display" style={{ fontSize: 16, width: 18 }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{it.t}{reveal && <span className="mono" style={{ fontSize: 11, marginLeft: 8, opacity: .7 }}>{it.year}</span>}</span>
            {!reveal && (
              <div className="col gap-6">
                <button onClick={() => move(i, -1)} style={{ border: '2px solid var(--ink)', borderRadius: 5, background: 'var(--surface)', width: 26, height: 20, lineHeight: 0, fontSize: 11 }}>▲</button>
                <button onClick={() => move(i, 1)} style={{ border: '2px solid var(--ink)', borderRadius: 5, background: 'var(--surface)', width: 26, height: 20, lineHeight: 0, fontSize: 11 }}>▼</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderQ(q, value, setValue, reveal, branchPick) {
  if (q.type === 'mcq') return <QMcq q={q} value={value} setValue={setValue} reveal={reveal} branchPick={branchPick} />;
  if (q.type === 'text') return <QText q={q} value={value} setValue={setValue} reveal={reveal} />;
  if (q.type === 'numeric') return <QNumeric q={q} value={value} setValue={setValue} reveal={reveal} />;
  if (q.type === 'order') return <QOrder q={q} value={value} setValue={setValue} reveal={reveal} />;
  return null;
}

/* ---------------- mistake branch ---------------- */
function Branch({ q, onRetry, onShow }) {
  return (
    <div className="slam" style={{ border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', background: '#FFE9C7', boxShadow: 'var(--sh) var(--sh) 0 var(--ink)', padding: 18 }}>
      <div className="row aic gap-10">
        <span style={{ fontSize: 26 }}>🤔</span>
        <div className="display" style={{ fontSize: 19 }}>Hang on — common trap</div>
      </div>
      <p style={{ fontSize: 15, lineHeight: 1.45, margin: '12px 0 16px', fontWeight: 500 }}>{q.branchTeach}</p>
      <div className="row gap-10">
        <button className="btn btn-ink" onClick={onRetry} style={{ flex: 1, justifyContent: 'center' }}>TRY AGAIN</button>
        <button className="btn btn-ghost" onClick={onShow} style={{ flex: 1, justifyContent: 'center' }}>Show me why →</button>
      </div>
    </div>
  );
}

/* ---------------- teaching reveal (never restates the answer) ---------------- */
function Reveal({ q, correct, onContinue, last }) {
  const [felt, setFelt] = useStateLearn(null);
  const [rated, setRated] = useStateLearn(null);
  return (
    <div className="slam" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row aic gap-10">
        <span className="chip" style={{ background: correct ? 'var(--lime)' : 'var(--pink)', color: correct ? 'var(--ink)' : '#fff', fontSize: 11 }}>
          {correct ? '✓ GOT IT' : '↻ NOT YET'}
        </span>
        <span className="eyebrow">The why — not the what</span>
      </div>

      <div style={{ border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', background: '#FFF8E8', boxShadow: 'var(--sh) var(--sh) 0 var(--ink)', padding: 16 }}>
        <div className="row aic gap-8" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <span className="display" style={{ fontSize: 15 }}>Here's the idea to keep</span>
        </div>
        <p style={{ fontSize: 15.5, lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{q.teach}</p>
      </div>

      {/* spacing self-rate feeds the schedule */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>How well did that stick?</div>
        <div className="row gap-8">
          {[['Again', 'var(--pink)'], ['Hard', 'var(--orange)'], ['Good', 'var(--surface)'], ['Easy', 'var(--lime)']].map(([l, c]) => (
            <button key={l} onClick={() => setRated(l)} style={{
              flex: 1, border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', padding: '9px 4px',
              background: rated === l ? c : 'var(--surface)', color: rated === l && (l === 'Again') ? '#fff' : 'var(--ink)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              boxShadow: rated === l ? 'none' : 'calc(var(--sh)*.4) calc(var(--sh)*.4) 0 var(--ink)',
              transform: rated === l ? 'translate(2px,2px)' : 'none',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* the learning-or-test loop */}
      <div style={{ border: '2px dashed var(--ink)', borderRadius: 'var(--radius)', padding: '11px 14px' }}>
        <div className="row between aic" style={{ gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Did that feel like <i>learning</i> or a <i>test</i>?</span>
          <div className="row gap-6">
            <button onClick={() => setFelt('learn')} className="chip" style={{ background: felt === 'learn' ? 'var(--lime)' : 'var(--surface)', cursor: 'pointer' }}>LEARNING</button>
            <button onClick={() => setFelt('test')} className="chip" style={{ background: felt === 'test' ? 'var(--orange)' : 'var(--surface)', color: felt === 'test' ? '#fff' : 'var(--ink)', cursor: 'pointer' }}>A TEST</button>
          </div>
        </div>
        {felt && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 8 }}>{felt === 'learn' ? "Good — that's the goal. We'll keep this rhythm." : "Noted — we'll add more teaching scaffolding before the next one like it."}</div>}
      </div>

      <button className="btn btn-orange block" disabled={!rated} onClick={onContinue} style={{ opacity: rated ? 1 : .5, cursor: rated ? 'pointer' : 'not-allowed' }}>
        {last ? 'FINISH SESSION →' : 'NEXT QUESTION →'}
      </button>
    </div>
  );
}

/* ---------------- session summary ---------------- */
function LearnSummary({ results, nav }) {
  const got = results.filter(Boolean).length;
  return (
    <div className="slam tac" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', maxWidth: 420, margin: '0 auto', paddingTop: 10 }}>
      <span style={{ fontSize: 44 }}>🌱</span>
      <div className="display" style={{ fontSize: 30, lineHeight: 1 }}>Session done</div>
      <p style={{ fontSize: 15, color: 'var(--ink-soft)', margin: 0 }}>You worked through {results.length} questions. The point wasn't the score — it's what moved into your long-term memory.</p>
      <div className="row gap-10" style={{ width: '100%' }}>
        <div className="nb-flat" style={{ flex: 1, padding: 14 }}><div className="display" style={{ fontSize: 30 }}>{got}/{results.length}</div><div className="mono" style={{ fontSize: 10 }}>FIRST TRY</div></div>
        <div className="nb-flat" style={{ flex: 1, padding: 14, background: 'var(--lime)' }}><div className="display" style={{ fontSize: 30 }}>+2</div><div className="mono" style={{ fontSize: 10 }}>LOCKED IN</div></div>
        <div className="nb-flat" style={{ flex: 1, padding: 14 }}><div className="display" style={{ fontSize: 30 }}>9</div><div className="mono" style={{ fontSize: 10 }}>SCHEDULED</div></div>
      </div>
      <div className="row gap-10" style={{ width: '100%' }}>
        <button className="btn block" onClick={() => nav('learn-mastery')}>SEE MASTERY</button>
        <button className="btn btn-orange block" onClick={() => nav('learn-review')}>REVIEW PLAN →</button>
      </div>
    </div>
  );
}

/* ---------------- entry ---------------- */
function LearnEntry({ desktop, nav, onStart }) {
  return (
    <div className="screen no-scroll pop" style={{ position: 'relative' }}>
      <div className="row between aic" style={{ padding: desktop ? '16px 22px' : '14px 16px', flex: '0 0 auto' }}>
        <div className="row aic gap-10">
          <button className="btn btn-ghost" onClick={() => nav('home')} style={{ boxShadow: 'none', padding: '6px 11px' }}>←</button>
          <div className="display" style={{ fontSize: 20 }}>Learn</div>
        </div>
        <div className="row gap-8">
          <button className="btn btn-ghost" onClick={() => nav('learn-mastery')} style={{ fontSize: 13 }}>Mastery</button>
          <button className="btn btn-ghost" onClick={() => nav('learn-review')} style={{ fontSize: 13 }}>Review</button>
        </div>
      </div>
      {desktop ? (
        <div style={{ flex: 1, minHeight: 0, padding: '0 22px 22px', display: 'grid', gridTemplateRows: '1.25fr 1fr', gap: 16, overflow: 'hidden' }}>
          {/* hero band */}
          <div className="nb" style={{ background: 'var(--orange)', color: '#fff', padding: 30, display: 'flex', minHeight: 0, gap: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -30, bottom: -60, fontSize: 280, opacity: .12, lineHeight: 1 }}>🌱</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, zIndex: 1 }}>
              <span className="chip" style={{ background: '#fff', color: 'var(--ink)', alignSelf: 'flex-start' }}>TODAY'S SESSION</span>
              <div className="display" style={{ fontSize: 56, lineHeight: .95, marginTop: 'auto' }}>Learn it,<br />don't cram it.</div>
              <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,.92)', fontWeight: 500, margin: '14px 0 0', maxWidth: 460 }}>
                A short adaptive set — multiple choice, free text, numbers and ordering. Get it wrong and we teach, not just mark.
              </p>
            </div>
            <div style={{ width: 220, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 1 }}>
              <div className="eyebrow" style={{ color: 'rgba(255,255,255,.85)' }}>4 questions · ≈4 min</div>
              {['Multiple choice', 'Free text', 'Numeric', 'Put in order'].map((t, i) => (
                <div key={t} className="row aic gap-10" style={{ background: 'rgba(255,255,255,.16)', border: '2px solid #fff', borderRadius: 'var(--radius)', padding: '9px 12px' }}>
                  <span className="display" style={{ fontSize: 14, width: 16 }}>{i + 1}</span>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{t}</span>
                </div>
              ))}
              <button className="btn btn-ink block" onClick={onStart} style={{ background: 'var(--ink)', marginTop: 'auto' }}>START →</button>
            </div>
          </div>
          {/* bottom band */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, minHeight: 0 }}>
            <div className="nb-flat" style={{ padding: 18, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="row between aic"><div className="eyebrow">Picking up where you left off</div><button className="btn btn-ghost" onClick={() => nav('learn-mastery')} style={{ fontSize: 12, padding: '4px 8px', boxShadow: 'none' }}>All subjects →</button></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12, flex: 1, justifyContent: 'center' }}>
                {[['Transfer records', .33, 'var(--pink)', 'LEARNING'], ['Tactics & formations', .54, 'var(--orange)', 'LEARNING'], ['Laws of the game', .67, 'var(--orange)', 'LEARNING']].map(([l, v, c, st]) => (
                  <div key={l}>
                    <div className="row between" style={{ marginBottom: 4 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{l}</span><span className="mono" style={{ fontSize: 11 }}>{Math.round(v * 100)}% · {st}</span></div>
                    <div style={{ height: 13, border: '2px solid var(--ink)', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: (v * 100) + '%', height: '100%', background: c }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="nb-flat" style={{ padding: 18, background: '#FFF1DC', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="eyebrow">Your learning streak</div>
              <div className="row aic gap-10" style={{ marginTop: 10 }}>
                <span className="display" style={{ fontSize: 46, color: 'var(--orange)' }}>9</span>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>days in a<br />row 🌱</span>
              </div>
              <div className="row gap-6" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} style={{ width: 30, height: 30, borderRadius: 7, border: '2px solid var(--ink)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, background: i < 5 ? 'var(--lime)' : 'var(--surface)', color: 'var(--ink)' }}>{d}</div>
                ))}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 'auto' }}>6 items due today · keep it alive.</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, padding: '0 16px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div className="nb" style={{ background: 'var(--orange)', color: '#fff', padding: 20, display: 'flex', flexDirection: 'column' }}>
            <span className="chip" style={{ background: '#fff', color: 'var(--ink)', alignSelf: 'flex-start' }}>TODAY'S SESSION</span>
            <div className="display" style={{ fontSize: 36, lineHeight: .98, marginTop: 16 }}>Learn it,<br />don't cram it.</div>
            <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.92)', fontWeight: 500, margin: '12px 0 18px' }}>A short adaptive set. Get it wrong and we teach, not just mark.</p>
            <button className="btn btn-ink block" onClick={onStart} style={{ background: 'var(--ink)' }}>START — 4 QUESTIONS →</button>
          </div>
          <div className="nb-flat" style={{ padding: 16 }}>
            <div className="eyebrow">In this set</div>
            <div className="row gap-8 wrap" style={{ marginTop: 10 }}>
              {['Multiple choice', 'Free text', 'Numeric', 'Put in order'].map(t => <span key={t} className="chip">{t}</span>)}
            </div>
          </div>
          <div className="nb-flat" style={{ padding: 16 }}>
            <div className="eyebrow">Picking up where you left off</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
              {[['Transfer records', .33, 'var(--pink)'], ['Tactics & formations', .54, 'var(--orange)'], ['Laws of the game', .67, 'var(--orange)']].map(([l, v, c]) => (
                <div key={l}>
                  <div className="row between"><span style={{ fontSize: 13, fontWeight: 600 }}>{l}</span><span className="mono" style={{ fontSize: 11 }}>{Math.round(v * 100)}%</span></div>
                  <div style={{ height: 12, border: '2px solid var(--ink)', borderRadius: 999, overflow: 'hidden', marginTop: 4 }}><div style={{ width: (v * 100) + '%', height: '100%', background: c }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- runner ---------------- */
function LearnRunner({ desktop, nav, pal }) {
  const [idx, setIdx] = useStateLearn(0);
  const [stage, setStage] = useStateLearn('answer'); // answer | branch | reveal
  const [value, setValue] = useStateLearn(null);
  const [results, setResults] = useStateLearn([]);
  const [done, setDone] = useStateLearn(false);
  const q = LEARN_QUESTIONS[idx];

  const submit = () => {
    if (q.type === 'mcq' && value === q.branchOn) { setStage('branch'); return; }
    finalize();
  };
  const finalize = () => {
    setResults(r => { const n = [...r]; n[idx] = isCorrect(q, value); return n; });
    setStage('reveal');
  };
  const next = () => {
    if (idx + 1 >= LEARN_QUESTIONS.length) { setDone(true); return; }
    setIdx(idx + 1); setValue(null); setStage('answer');
  };

  const canSubmit = q.type === 'order' ? true : (value != null && String(value).length > 0);

  if (done) {
    return (
      <div className="screen no-scroll pop" style={{ padding: desktop ? '40px 22px' : '24px 16px', overflowY: 'auto', justifyContent: 'center' }}>
        <LearnSummary results={results} nav={nav} />
      </div>
    );
  }

  /* left context rail (desktop) */
  const rail = (
    <div className="nb" style={{ background: pal === 'unified' ? 'var(--surface)' : '#FBEED4', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
      <div className="row between aic">
        <span className="chip solid-ink">{q.subject}</span>
        <span className="chip">{TYPE_LABEL[q.type]}</span>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Progress</div>
        <Ladder total={LEARN_QUESTIONS.length} current={idx + (stage === 'reveal' ? 1 : 0)} fill="var(--orange)" />
        <div className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Question {idx + 1} of {LEARN_QUESTIONS.length}</div>
      </div>
      <div className="rule" />
      <div style={{ marginTop: 'auto' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>The Learn promise</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 500, margin: 0, color: 'var(--ink-soft)' }}>
          Every miss earns an explanation, not a red ✕. We schedule a comeback so it actually sticks.
        </p>
      </div>
      <button className="btn btn-ghost" onClick={() => nav('learn')} style={{ fontSize: 13 }}>← Leave session</button>
    </div>
  );

  /* the question/reveal column */
  const column = (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 14, overflowY: 'auto', paddingRight: 2 }}>
      {!desktop && (
        <div className="row between aic">
          <span className="chip solid-ink">{TYPE_LABEL[q.type]}</span>
          <Ladder total={LEARN_QUESTIONS.length} current={idx + (stage === 'reveal' ? 1 : 0)} fill="var(--orange)" />
        </div>
      )}
      <div className="eyebrow">{q.subject}</div>
      <div className="display" style={{ fontSize: desktop ? 27 : 23, lineHeight: 1.1 }}>{q.prompt}</div>

      {stage !== 'branch' && renderQ(q, value, setValue, stage === 'reveal', null)}

      {stage === 'branch' && (
        <>
          {renderQ(q, value, setValue, false, value)}
          <Branch q={q} onRetry={() => { setValue(null); setStage('answer'); }} onShow={finalize} />
        </>
      )}

      {stage === 'answer' && (
        <button className="btn btn-orange block" disabled={!canSubmit} onClick={submit} style={{ opacity: canSubmit ? 1 : .5, cursor: canSubmit ? 'pointer' : 'not-allowed', marginTop: 4 }}>
          CHECK ANSWER
        </button>
      )}

      {stage === 'reveal' && (
        <Reveal q={q} correct={isCorrect(q, value)} last={idx + 1 >= LEARN_QUESTIONS.length} onContinue={next} />
      )}
    </div>
  );

  return (
    <div className="screen no-scroll pop">
      {desktop ? (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, padding: 22 }}>
          {rail}
          <div style={{ minHeight: 0, maxWidth: 720, width: '100%' }}>{column}</div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, padding: '12px 16px 18px', display: 'flex', flexDirection: 'column' }}>{column}</div>
      )}
    </div>
  );
}

/* ---------------- wrapper: sets palette, routes Learn sub-screens ---------------- */
function LearnFlow({ bp, nav, sub, pal = 'warm' }) {
  const desktop = bp === 'desktop';
  const [running, setRunning] = useStateLearn(sub === 'run');

  let inner;
  if (sub === 'review') inner = <LearnReview desktop={desktop} nav={nav} goRun={() => nav('learn-run')} />;
  else if (sub === 'mastery') inner = <LearnMastery desktop={desktop} nav={nav} goRun={() => nav('learn-run')} />;
  else if (sub === 'run' || running) inner = <LearnRunner desktop={desktop} nav={nav} pal={pal} />;
  else inner = <LearnEntry desktop={desktop} nav={nav} onStart={() => setRunning(true)} />;

  return (
    <div data-pal={pal === 'unified' ? undefined : 'warm'} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
      {pal === 'unified' && (
        <div className="row between aic" style={{ background: 'var(--ink)', color: '#fff', padding: '8px 16px', flex: '0 0 auto' }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--yellow)' }}>◑ GUT-CHECK · same Learn screen rendered in the UNIFIED palette</span>
          <span className="chip" style={{ background: 'var(--yellow)', color: 'var(--ink)', borderColor: '#fff', fontSize: 9 }}>COMPARE</span>
        </div>
      )}
      {inner}
    </div>
  );
}

Object.assign(window, { LearnFlow });
