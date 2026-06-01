/* global React */
const { useState: _uS, useRef: _uR, useEffect: _uE } = React;

/* ============================================================
   Shared UI primitives — neo-brutalist
   ============================================================ */

/* Big tappable card with hard shadow + lift */
function NBCard({ children, fill, onClick, className = '', style = {}, span2, tabIndex }) {
  return (
    <div
      className={'nbcard ' + className}
      onClick={onClick}
      tabIndex={onClick ? (tabIndex ?? 0) : undefined}
      role={onClick ? 'button' : undefined}
      style={{
        border: 'var(--bw) solid var(--ink)',
        borderRadius: 'var(--radius)',
        background: fill || 'var(--surface)',
        boxShadow: 'var(--sh) var(--sh) 0 var(--ink)',
        cursor: onClick ? 'pointer' : 'default',
        gridColumn: span2 ? 'span 2' : undefined,
        transition: 'transform .08s ease, box-shadow .08s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* status dot for rosters */
function StatusDot({ status }) {
  const map = {
    thinking: { c: 'var(--yellow)', label: 'Thinking' },
    locked:   { c: 'var(--blue)',   label: 'Locked in' },
    answered: { c: 'var(--good)',   label: 'Answered' },
  };
  const s = map[status] || map.thinking;
  return (
    <span className="row aic gap-6" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>
      <span style={{
        width: 11, height: 11, borderRadius: 999, background: s.c,
        border: '2px solid var(--ink)', flex: '0 0 auto',
        animation: status === 'thinking' ? 'pulse 1s infinite' : 'none',
      }} />
      {s.label}
    </span>
  );
}

/* segmented label/value stat block */
function Stat({ label, value, fill, big }) {
  return (
    <div style={{
      border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
      background: fill || 'var(--surface)', padding: big ? '10px 14px' : '7px 11px',
      minWidth: 0, textAlign: 'center', flex: 1,
    }}>
      <div className="eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="display" style={{ fontSize: big ? 30 : 20, lineHeight: 1, marginTop: 4 }}>{value}</div>
    </div>
  );
}

/* count-up-ish timer ring text */
function TimerBadge({ seconds, total = 20, fill }) {
  const pct = Math.max(0, Math.min(1, seconds / total));
  const danger = seconds <= 5;
  return (
    <div style={{
      border: 'var(--bw) solid var(--ink)', borderRadius: 999,
      background: danger ? 'var(--bad)' : (fill || 'var(--surface)'),
      color: danger ? '#fff' : 'var(--ink)',
      padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 9,
      boxShadow: 'calc(var(--sh) * .5) calc(var(--sh) * .5) 0 var(--ink)',
    }}>
      <span style={{
        width: 12, height: 12, borderRadius: 999,
        border: '2px solid currentColor',
        background: `conic-gradient(currentColor ${pct * 360}deg, transparent 0)`,
      }} />
      <span className="display" style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums', minWidth: 34 }}>
        0:{String(Math.max(0, seconds)).padStart(2, '0')}
      </span>
    </div>
  );
}

/* progress ladder (dots) */
function Ladder({ total, current, fill = 'var(--ink)' }) {
  return (
    <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} style={{
          width: 14, height: 14, borderRadius: 4, border: '2px solid var(--ink)',
          background: i < current ? fill : 'transparent',
        }} />
      ))}
    </div>
  );
}

/* mastery bar */
function MasteryBar({ value, tint = 'var(--lime)' }) {
  return (
    <div style={{
      height: 16, border: 'var(--bw) solid var(--ink)', borderRadius: 999,
      background: 'var(--surface)', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ width: (value * 100) + '%', height: '100%', background: tint }} />
    </div>
  );
}

/* a header bar used inside product screens */
function TopBar({ left, title, right }) {
  return (
    <div className="row between aic" style={{ padding: '14px 16px', flex: '0 0 auto' }}>
      <div className="row aic gap-10" style={{ minWidth: 0 }}>{left}</div>
      {title && <div className="display" style={{ fontSize: 17 }}>{title}</div>}
      <div className="row aic gap-8">{right}</div>
    </div>
  );
}

/* round back button */
function BackBtn({ onClick, label = 'Back' }) {
  return (
    <button className="btn btn-ghost" onClick={onClick} style={{ padding: '7px 12px', boxShadow: 'none', fontSize: 13 }}>
      ← {label}
    </button>
  );
}

/* placeholder image slot, monospace explainer */
function ImgSlot({ label, h = 120, fill }) {
  return (
    <div style={{
      height: h, border: 'var(--bw) dashed var(--ink)', borderRadius: 'var(--radius)',
      background: fill ||
        'repeating-linear-gradient(45deg, rgba(0,0,0,.05) 0 8px, transparent 8px 16px)',
      display: 'grid', placeItems: 'center',
    }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)', letterSpacing: '.06em' }}>{label}</span>
    </div>
  );
}

const keyframeStyle = document.createElement('style');
keyframeStyle.textContent = `@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(.7);opacity:.5} }`;
document.head.appendChild(keyframeStyle);

Object.assign(window, {
  NBCard, StatusDot, Stat, TimerBadge, Ladder, MasteryBar, TopBar, BackBtn, ImgSlot,
});
