/* global React */
const { useState: useStateGrid, useEffect: useEffectGrid, useRef: useRefGrid } = React;

/* ============================================================
   VERVEGRID — 3×3 player-connection stage (Compete · UNIFIED palette)
   Each cell satisfies its ROW criterion × COLUMN criterion.
   Answer-leak discipline: ambient panels show ONLY status
   (guesses left, cells remaining, rarity of YOUR picks, timer).
   Never the answer set or correct players.
   ============================================================ */

const GRID_DEF = {
  date: 'JUN 1 · DAILY',
  cols: [
    { id: 'rma', label: 'Real Madrid', sub: 'CLUB',   crest: 'RMA', crestBg: 'var(--ink)',  crestFg: '#fff' },
    { id: 'mun', label: 'Man United',  sub: 'CLUB',   crest: 'MUN', crestBg: 'var(--bad)',  crestFg: '#fff' },
    { id: 'bra', label: 'Brazil',      sub: 'NATION', crest: 'BRA', crestBg: 'var(--good)', crestFg: '#fff' },
  ],
  rows: [
    { id: 'ucl', label: 'Champions Lg', sub: 'WINNER', icon: '★' },
    { id: 'bdo', label: 'Ballon d’Or',  sub: 'WINNER', icon: '◆' },
    { id: 'wc',  label: 'World Cup',     sub: 'WINNER', icon: '⌖' },
  ],
};

/* Illustrative pick pools per board state. pct = share of all players who
   picked this name → LOWER is rarer. correct=false ⇒ a missed cell (end only). */
const PICKS = {
  'ucl-rma': { name: 'Sergio Ramos',     pos: 'DF', nat: 'ESP', pct: 24 },
  'ucl-mun': { name: 'Cristiano Ronaldo', pos: 'FW', nat: 'POR', pct: 38 },
  'ucl-bra': { name: 'Casemiro',         pos: 'MF', nat: 'BRA', pct: 11 },
  'bdo-rma': { name: 'Luka Modrić',      pos: 'MF', nat: 'CRO', pct: 19 },
  'bdo-mun': { name: 'George Best',      pos: 'FW', nat: 'NIR', pct: 7  },
  'bdo-bra': { name: 'Ronaldinho',       pos: 'FW', nat: 'BRA', pct: 33 },
  'wc-rma':  { name: 'Roberto Carlos',   pos: 'DF', nat: 'BRA', pct: 14 },
  'wc-mun':  { name: 'Bobby Charlton',   pos: 'MF', nat: 'ENG', pct: 9  },
  'wc-bra':  { name: 'Cafu',             pos: 'DF', nat: 'BRA', pct: 12 },
};

/* which cells are filled per presenter state */
const BOARDS = {
  fresh:   { fills: [], wrong: 0, time: '0:00' },
  search:  { fills: ['ucl-rma', 'wc-bra'], wrong: 0, time: '0:42', active: 'bdo-rma' },
  partial: { fills: ['ucl-rma', 'bdo-mun', 'wc-bra', 'bdo-rma'], wrong: 1, time: '2:15' },
  solved:  { fills: Object.keys(PICKS), wrong: 0, time: '4:38' },
  failed:  { fills: ['ucl-rma', 'ucl-mun', 'bdo-mun', 'bdo-rma', 'wc-rma', 'wc-bra'], wrong: 3, time: '5:00',
             missed: ['ucl-bra', 'bdo-bra', 'wc-mun'] },
};

/* autocomplete demo — a realistic MIX; NOT a filtered correct-answer list */
const SEARCH_RESULTS = [
  { name: 'Cristiano Ronaldo', pos: 'FW', nat: 'POR', clubs: 'Sporting · Man Utd · Real Madrid' },
  { name: 'Ronaldo Nazário',  pos: 'FW', nat: 'BRA', clubs: 'Barça · Inter · Real Madrid' },
  { name: 'Ronaldinho',       pos: 'FW', nat: 'BRA', clubs: 'PSG · Barça · Milan' },
  { name: 'Ronald Koeman',    pos: 'DF', nat: 'NED', clubs: 'Ajax · Barça · Feyenoord' },
  { name: 'Ronald Araújo',    pos: 'DF', nat: 'URU', clubs: 'Boston River · Barça' },
];

function rarityTier(pct) {
  if (pct <= 12) return { label: 'ELITE',  c: 'var(--pink)',     fg: '#fff' };
  if (pct <= 30) return { label: 'RARE',   c: 'var(--blue)',     fg: '#fff' };
  return            { label: 'COMMON', c: 'var(--ink-soft)', fg: '#fff' };
}

function avgRarity(fillKeys) {
  const v = fillKeys.filter(k => PICKS[k]).map(k => PICKS[k].pct);
  if (!v.length) return null;
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length);
}

function initials(name) {
  return name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ---------- one grid square ---------- */
function GridCell({ rowDef, colDef, fill, missed, onPick, compact }) {
  const pad = compact ? 8 : 12;
  if (missed) {
    return (
      <div style={{
        background: 'repeating-linear-gradient(45deg, rgba(0,0,0,.06) 0 10px, transparent 10px 20px), var(--paper)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 0,
      }}>
        <span className="display" style={{ fontSize: compact ? 22 : 30, color: 'var(--ink-soft)' }}>—</span>
        <span className="mono" style={{ fontSize: compact ? 8 : 9.5, letterSpacing: '.12em', color: 'var(--bad)', fontWeight: 700 }}>MISSED</span>
      </div>
    );
  }
  if (fill) {
    const t = rarityTier(fill.pct);
    return (
      <div style={{
        background: 'var(--surface)', display: 'flex', flexDirection: 'column', minHeight: 0,
        padding: pad, gap: compact ? 5 : 7, animation: 'pop .22s ease both',
      }}>
        <div className="row aic gap-8" style={{ minHeight: 0 }}>
          <div style={{
            width: compact ? 30 : 40, height: compact ? 30 : 40, flex: '0 0 auto', borderRadius: compact ? 7 : 9,
            border: '2px solid var(--ink)', background: 'var(--paper)', display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: compact ? 11 : 14,
          }}>{initials(fill.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: compact ? 12.5 : 15.5, lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fill.name}</div>
            <div className="mono" style={{ fontSize: compact ? 8.5 : 10, color: 'var(--ink-soft)' }}>{fill.pos} · {fill.nat}</div>
          </div>
        </div>
        <div className="row aic gap-6" style={{ marginTop: 'auto' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: compact ? 8.5 : 10, letterSpacing: '.06em',
            border: '2px solid var(--ink)', borderRadius: 999, padding: compact ? '1px 6px' : '2px 8px',
            background: t.c, color: t.fg,
          }}>{t.label}</span>
          <span className="mono" style={{ fontSize: compact ? 10 : 12.5, fontWeight: 700 }}>{fill.pct}%</span>
        </div>
      </div>
    );
  }
  /* empty + tappable */
  return (
    <button onClick={onPick} className="gridcell-empty" style={{
      border: 0, background: 'var(--surface)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: compact ? 4 : 7, minHeight: 0, width: '100%', height: '100%',
      fontFamily: 'var(--font-ui)', transition: 'background .1s ease',
    }}>
      <span style={{
        width: compact ? 28 : 38, height: compact ? 28 : 38, borderRadius: compact ? 8 : 10, border: '2.5px dashed var(--ink-soft)',
        display: 'grid', placeItems: 'center', fontSize: compact ? 18 : 24, color: 'var(--ink-soft)', fontWeight: 700,
      }}>＋</span>
      <span className="mono" style={{ fontSize: compact ? 8 : 9.5, letterSpacing: '.1em', color: 'var(--ink-soft)' }}>TAP TO PICK</span>
    </button>
  );
}

/* ---------- column / row axis crest ---------- */
function Crest({ def, compact }) {
  if (def.flag) {
    return <span style={{ fontSize: compact ? 20 : 26, lineHeight: 1 }}>{def.crest}</span>;
  }
  return (
    <span style={{
      width: compact ? 26 : 34, height: compact ? 26 : 34, borderRadius: compact ? 6 : 8, flex: '0 0 auto',
      border: '2px solid var(--ink)', background: def.crestBg, color: def.crestFg,
      display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 900,
      fontSize: compact ? 9 : 11, transform: 'rotate(-4deg)',
    }}>{def.crest}</span>
  );
}

/* ---------- the 3×3 board (incl. axis headers) ---------- */
function Board({ board, onPick, compact }) {
  const fillSet = board.fills;
  const missedSet = board.missed || [];
  return (
    <div style={{
      height: '100%', width: compact ? '100%' : 'auto',
      aspectRatio: compact ? 'auto' : '1.04 / 1', maxWidth: '100%', maxHeight: '100%',
      display: 'grid',
      gridTemplateColumns: `${compact ? 'minmax(54px,0.6fr)' : 'minmax(72px,0.62fr)'} 1fr 1fr 1fr`,
      gridTemplateRows: `${compact ? 'minmax(46px,0.52fr)' : 'minmax(56px,0.56fr)'} 1fr 1fr 1fr`,
      gap: 'var(--bw)', background: 'var(--ink)',
      border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
      boxShadow: 'var(--sh) var(--sh) 0 var(--ink)', overflow: 'hidden',
    }}>
      {/* corner mark */}
      <div style={{ background: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, color: '#fff' }}>
        <span className="display" style={{ fontSize: compact ? 18 : 24, color: 'var(--orange)' }}>▦</span>
        <span className="mono" style={{ fontSize: compact ? 6.5 : 8, letterSpacing: '.12em', color: '#8d8a81' }}>3×3</span>
      </div>
      {/* column headers */}
      {GRID_DEF.cols.map(c => (
        <div key={c.id} style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: compact ? 3 : 5, padding: 4 }}>
          <Crest def={c} compact={compact} />
          <div style={{ textAlign: 'center', lineHeight: 1 }}>
            <div className="display" style={{ fontSize: compact ? 10.5 : 13.5, lineHeight: 1 }}>{c.label}</div>
            <div className="mono" style={{ fontSize: compact ? 6.5 : 8, letterSpacing: '.1em', color: 'var(--ink-soft)', marginTop: 2 }}>{c.sub}</div>
          </div>
        </div>
      ))}
      {/* rows */}
      {GRID_DEF.rows.map(r => (
        <React.Fragment key={r.id}>
          {/* row header */}
          <div style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: compact ? 2 : 4, padding: 4, textAlign: 'center' }}>
            <span style={{ fontSize: compact ? 15 : 19, lineHeight: 1 }}>{r.icon}</span>
            <div style={{ lineHeight: 1 }}>
              <div className="display" style={{ fontSize: compact ? 9.5 : 12.5, lineHeight: 1.02 }}>{r.label}</div>
              <div className="mono" style={{ fontSize: compact ? 6.5 : 8, letterSpacing: '.1em', color: 'var(--ink-soft)', marginTop: 2 }}>{r.sub}</div>
            </div>
          </div>
          {GRID_DEF.cols.map(c => {
            const key = `${r.id}-${c.id}`;
            return (
              <GridCell key={key} rowDef={r} colDef={c} compact={compact}
                fill={fillSet.includes(key) ? PICKS[key] : null}
                missed={missedSet.includes(key)}
                onPick={() => onPick && onPick(key)} />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------- HUD stat block ---------- */
function HudStat({ label, value, sub, fill, fg, big }) {
  return (
    <div style={{
      border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', flex: 1, minWidth: 0,
      background: fill || 'var(--surface)', color: fg || 'var(--ink)', padding: big ? '11px 13px' : '8px 11px', textAlign: 'center',
    }}>
      <div className="eyebrow" style={{ fontSize: 9, color: fg ? 'rgba(255,255,255,.8)' : 'var(--ink-soft)' }}>{label}</div>
      <div className="display" style={{ fontSize: big ? 34 : 22, lineHeight: 1, marginTop: 3 }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: 8.5, marginTop: 3, opacity: .8 }}>{sub}</div>}
    </div>
  );
}

function RarityLegend() {
  return (
    <div className="row gap-6 wrap" style={{ alignItems: 'center' }}>
      {[['ELITE', 'var(--pink)', '≤12%'], ['RARE', 'var(--blue)', '≤30%'], ['COMMON', 'var(--ink-soft)', '>30%']].map(([l, c, r]) => (
        <span key={l} className="row aic gap-6" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: c, border: '2px solid var(--ink)' }} />
          {l} <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>{r}</span>
        </span>
      ))}
    </div>
  );
}

/* ---------- pick log (YOUR picks only — no answer leak) ---------- */
function PickLog({ board, compact }) {
  const entries = board.fills.filter(k => PICKS[k]);
  return (
    <div className="nb" style={{ padding: 13, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div className="row between aic" style={{ flex: '0 0 auto' }}>
        <div className="eyebrow">Your pick log</div>
        <span className="chip" style={{ fontSize: 8.5 }}>{entries.length}/9</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {entries.length === 0 && (
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5, padding: '4px 2px' }}>
            No picks yet — tap any square to search for a player who fits both its row &amp; column.
          </div>
        )}
        {entries.map(k => {
          const [rid, cid] = k.split('-');
          const r = GRID_DEF.rows.find(x => x.id === rid);
          const c = GRID_DEF.cols.find(x => x.id === cid);
          const p = PICKS[k];
          const t = rarityTier(p.pct);
          return (
            <div key={k} className="nb-flat" style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 26, height: 26, flex: '0 0 auto', borderRadius: 6, border: '2px solid var(--ink)', background: 'var(--paper)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 10 }}>{initials(p.name)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.crest && !c.flag ? c.crest : c.label} × {r.label}</div>
              </div>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: t.c }}>{p.pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- cell search / select sheet ---------- */
function SearchSheet({ cellKey, board, onClose, compact }) {
  const [query, setQuery] = useStateGrid('rona');
  if (!cellKey) return null;
  const [rid, cid] = cellKey.split('-');
  const r = GRID_DEF.rows.find(x => x.id === rid);
  const c = GRID_DEF.cols.find(x => x.id === cid);
  const guessesLeft = 9 - board.fills.length - board.wrong;
  const results = query.trim() ? SEARCH_RESULTS : [];

  const panel = (
    <div className="slam" onClick={e => e.stopPropagation()} style={{
      width: '100%', maxWidth: compact ? '100%' : 460, background: 'var(--surface)',
      border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)',
      boxShadow: 'var(--sh) var(--sh) 0 var(--ink)', display: 'flex', flexDirection: 'column',
      maxHeight: compact ? '82%' : '88%', minHeight: 0,
    }}>
      {/* sheet header — shows the CRITERIA (the prompt), never the answer */}
      <div style={{ padding: 16, borderBottom: 'var(--bw) solid var(--ink)', flex: '0 0 auto' }}>
        <div className="row between aic">
          <span className="eyebrow">Fill this square</span>
          <button className="btn btn-ghost" onClick={onClose} style={{ boxShadow: 'none', padding: '4px 9px' }}>✕</button>
        </div>
        <div className="row aic gap-10" style={{ marginTop: 8 }}>
          <Crest def={c} />
          <span className="display" style={{ fontSize: 20 }}>×</span>
          <span style={{ fontSize: 19 }}>{r.icon}</span>
          <div className="display" style={{ fontSize: compact ? 17 : 19, lineHeight: 1.05 }}>
            {c.label} <span style={{ color: 'var(--ink-soft)' }}>×</span> {r.label} {r.sub.toLowerCase()}
          </div>
        </div>
      </div>
      {/* search input */}
      <div style={{ padding: '12px 16px', flex: '0 0 auto', background: 'var(--paper)', borderBottom: 'var(--bw) solid var(--ink)' }}>
        <div className="row aic gap-8" style={{ border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', background: 'var(--surface)', padding: '10px 12px' }}>
          <span style={{ fontSize: 16, color: 'var(--ink-soft)' }}>⌕</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search any player…" style={{
            border: 0, outline: 'none', background: 'transparent', flex: 1, fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600, color: 'var(--ink)',
          }} />
          <span className="chip solid-ink" style={{ fontSize: 8.5 }}>{guessesLeft} GUESSES LEFT</span>
        </div>
      </div>
      {/* results — generic autocomplete, no correctness hints */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map(p => (
          <div key={p.name} className="nb-flat lift" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, flex: '0 0 auto', borderRadius: 8, border: '2px solid var(--ink)', background: 'var(--paper)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 12 }}>{initials(p.name)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="display" style={{ fontSize: 15.5 }}>{p.name}</div>
              <div className="mono" style={{ fontSize: 9.5, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.pos} · {p.nat} · {p.clubs}</div>
            </div>
            <span className="display" style={{ color: 'var(--ink-soft)' }}>＋</span>
          </div>
        ))}
        {!results.length && (
          <div className="mono tac" style={{ fontSize: 12, color: 'var(--ink-soft)', padding: 24 }}>Type a name to search the full player database.</div>
        )}
      </div>
      {/* no-leak reassurance */}
      <div style={{ padding: '11px 16px', borderTop: 'var(--bw) solid var(--ink)', background: 'var(--paper)', flex: '0 0 auto' }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-soft)', lineHeight: 1.45 }}>
          ⚠ Any player can be guessed. You only learn if it counts — and how rare it is — <b style={{ color: 'var(--ink)' }}>after you lock it in.</b>
        </div>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(14,13,11,.55)', zIndex: 60,
      display: 'flex', alignItems: compact ? 'flex-end' : 'center', justifyContent: 'center',
      padding: compact ? 0 : 18,
    }}>{panel}</div>
  );
}

/* ---------- end overlay (solved / failed) ---------- */
function EndOverlay({ state, board, onClose }) {
  if (state !== 'solved' && state !== 'failed') return null;
  const correct = board.fills.filter(k => PICKS[k]).length;
  const won = state === 'solved';
  const avg = avgRarity(board.fills);
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,13,11,.62)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div className="slam" style={{
        width: '100%', maxWidth: 380, background: 'var(--surface)', border: 'var(--bw) solid var(--ink)',
        borderRadius: 'var(--radius)', boxShadow: 'var(--sh) var(--sh) 0 var(--ink)', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 20px 16px', background: won ? 'var(--good)' : 'var(--ink)', color: '#fff', borderBottom: 'var(--bw) solid var(--ink)' }}>
          <div className="eyebrow" style={{ color: won ? 'rgba(255,255,255,.85)' : 'var(--yellow)' }}>{won ? 'GRID COMPLETE' : 'OUT OF GUESSES'}</div>
          <div className="display" style={{ fontSize: 34, lineHeight: 1, marginTop: 6 }}>{won ? 'Perfect 9/9' : `${correct} / 9 filled`}</div>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row gap-8">
            <HudStat label="AVG RARITY" value={avg + '%'} sub="lower = rarer" fill="var(--orange)" fg="#fff" big />
            <HudStat label={won ? 'TIME' : 'CELLS'} value={won ? board.time : `${correct}/9`} big />
          </div>
          <div style={{ border: 'var(--bw) solid var(--ink)', borderRadius: 'var(--radius)', padding: '11px 13px', background: 'var(--paper)', textAlign: 'center' }}>
            <div className="eyebrow" style={{ fontSize: 9 }}>{won ? 'RARITY PERCENTILE' : 'TODAY'}</div>
            <div className="display" style={{ fontSize: 18, marginTop: 3 }}>{won ? 'Top 6% of solvers today' : '12,041 played · 28% went perfect'}</div>
          </div>
          <div className="row gap-8">
            <button className="btn btn-ink block" onClick={onClose} style={{ flex: 1 }}>REVIEW BOARD</button>
            <button className="btn btn-orange block" style={{ flex: 1 }}>SHARE ⇪</button>
          </div>
          <div className="mono tac" style={{ fontSize: 9.5, color: 'var(--ink-soft)' }}>Missed squares stay hidden — no answers revealed.</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   GRID STAGE — desktop never-scroll + mobile
   ============================================================ */
function GridStage({ bp, state, nav, onState }) {
  const desktop = bp === 'desktop';
  const board = BOARDS[state] || BOARDS.fresh;
  const [active, setActive] = useStateGrid(state === 'search' ? board.active : null);
  useEffectGrid(() => { setActive(state === 'search' ? board.active : null); }, [state]);

  const guessesLeft = Math.max(0, 9 - board.fills.length - board.wrong);
  const cellsLeft = 9 - board.fills.length;
  const avg = avgRarity(board.fills);
  const ended = state === 'solved' || state === 'failed';
  const [endOpen, setEndOpen] = useStateGrid(true);
  useEffectGrid(() => { setEndOpen(true); }, [state]);

  /* broadcast bar — dark, matches Arena */
  const bar = (
    <div className="row between aic" style={{ padding: desktop ? '12px 22px' : '10px 14px', flex: '0 0 auto', background: 'var(--ink)', color: '#fff', borderBottom: '2px solid #000' }}>
      <div className="row aic gap-12" style={{ minWidth: 0 }}>
        <button className="btn btn-ghost" onClick={() => nav && nav('compete')} style={{ boxShadow: 'none', padding: '5px 10px', color: '#fff', borderColor: '#3a3833' }}>←</button>
        <span className="chip" style={{ background: 'var(--blue)', color: '#fff', borderColor: '#fff' }}>▦ VERVEGRID</span>
        {desktop && <span className="mono" style={{ fontSize: 12, color: '#b7b3a8' }}>Football · {GRID_DEF.date} · 9 guesses</span>}
      </div>
      <div className="row aic gap-8">
        <span className="chip" style={{ background: '#26241f', color: '#b7b3a8', borderColor: '#3a3833', fontSize: 9 }}>STATE</span>
        <div className="row" style={{ border: '2px solid #3a3833', borderRadius: 7, overflow: 'hidden' }}>
          {['fresh', 'search', 'partial', 'solved', 'failed'].map(s => (
            <button key={s} onClick={() => onState(s)} style={{
              background: s === state ? 'var(--orange)' : 'transparent', color: s === state ? '#fff' : '#b7b3a8',
              border: 0, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
              textTransform: 'uppercase', padding: '6px 10px', cursor: 'pointer',
            }}>{s}</button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ambient stat cluster (shared content, laid out differently per bp) */
  const statRow = (big) => (
    <div className="row gap-8">
      <HudStat label="GUESSES" value={guessesLeft} sub="left" fill={guessesLeft <= 2 ? 'var(--bad)' : 'var(--surface)'} fg={guessesLeft <= 2 ? '#fff' : null} big={big} />
      <HudStat label="CELLS" value={cellsLeft} sub="remaining" big={big} />
      <HudStat label="RARITY" value={avg == null ? '—' : avg + '%'} sub="avg · lower rarer" fill="var(--orange)" fg="#fff" big={big} />
    </div>
  );

  if (desktop) {
    return (
      <div className="screen no-scroll pop" style={{ background: '#201E1A', position: 'relative' }}>
        {bar}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '286px 1fr 286px', gap: 18, padding: 20 }}>
          {/* LEFT ambient — your run */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            <div className="nb" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto' }}>
              <div className="row between aic">
                <div className="eyebrow">Your run</div>
                <span className="chip solid-yellow" style={{ fontSize: 8.5 }}>⏱ {board.time}</span>
              </div>
              {statRow(true)}
              <div className="rule" />
              <div className="eyebrow" style={{ fontSize: 9 }}>Rarity scale</div>
              <RarityLegend />
            </div>
            <div className="nb" style={{ padding: 14, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--paper)' }}>
              <div className="eyebrow">How it works</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
                Each square needs a player matching its <b style={{ color: 'var(--ink)' }}>column club</b> and <b style={{ color: 'var(--ink)' }}>row honour</b>. Rarer picks score better. 9 guesses, no repeats.
              </div>
            </div>
          </div>
          {/* CENTER — the board (centerpiece) */}
          <div style={{ minHeight: 0, display: 'grid', placeItems: 'center' }}>
            <Board board={board} onPick={(k) => setActive(k)} />
          </div>
          {/* RIGHT ambient — pick log */}
          <div style={{ minHeight: 0 }}>
            <PickLog board={board} />
          </div>
        </div>
        <div className="mono" style={{ position: 'absolute', bottom: 7, left: 22, fontSize: 10, color: '#6f6c64' }}>
          ambient = guesses · cells · rarity-of-your-picks · timer · pick log. never the answer set or correct players.
        </div>
        <SearchSheet cellKey={active} board={board} onClose={() => { setActive(null); if (state === 'search') onState('fresh'); }} />
        {ended && endOpen && <EndOverlay state={state} board={board} onClose={() => setEndOpen(false)} />}
      </div>
    );
  }

  /* MOBILE — grid is the focus */
  return (
    <div className="screen no-scroll pop" style={{ background: 'var(--paper)', position: 'relative' }}>
      {bar}
      {/* compact HUD strip */}
      <div style={{ padding: '10px 12px 0', flex: '0 0 auto' }}>
        {statRow(false)}
      </div>
      {/* board fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: '12px 12px 14px' }}>
        <Board board={board} onPick={(k) => setActive(k)} compact />
      </div>
      <SearchSheet cellKey={active} board={board} onClose={() => { setActive(null); if (state === 'search') onState('fresh'); }} compact />
      {ended && endOpen && <EndOverlay state={state} board={board} onClose={() => setEndOpen(false)} />}
    </div>
  );
}

Object.assign(window, { GridStage });
