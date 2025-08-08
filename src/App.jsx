
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

/* Minimal UI */
const Button = ({children, className='', variant, size, ...props}) => {
  const base='inline-flex items-center justify-center rounded-xl border px-4 py-3 text-base font-semibold transition active:scale-[0.99]';
  const variants={
    primary:'bg-blue-600 text-white border-blue-700 hover:bg-blue-700',
    secondary:'bg-gray-100 hover:bg-gray-200 border-gray-200',
    outline:'bg-transparent hover:bg-gray-50 border-gray-300',
    ghost:'bg-transparent border-transparent hover:bg-gray-50'
  };
  const sizes={icon:'h-10 w-10 p-0'};
  return <button className={[base, variants[variant||'secondary'], size? sizes[size]:'', className].join(' ')} {...props}>{children}</button>;
};
const Card = ({children,className})=> <div className={`rounded-2xl border ${className||''}`}>{children}</div>;
const CardHeader = ({children,className})=> <div className={`p-4 border-b ${className||''}`}>{children}</div>;
const CardTitle = ({children,className})=> <div className={`text-lg font-semibold ${className||''}`}>{children}</div>;
const CardContent = ({children,className})=> <div className={`p-4 space-y-2 ${className||''}`}>{children}</div>;
const Input = (props)=> <input {...props} className={`h-10 w-full rounded-md border border-gray-300 px-3 text-base ${props.className||''}`} />;
const Label = ({children,className})=> <label className={`text-sm font-medium ${className||''}`}>{children}</label>;
const Separator = ()=> <hr className="my-2 border-gray-200" />;

/* Helpers */
const uid = () => Math.random().toString(36).slice(2, 9);
const defaultColors = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#a78bfa","#ec4899","#06b6d4","#10b981","#8b5cf6","#f97316"];

/* Build pairing memory keys */
const pairKey = (a,b) => [a,b].sort().join("|");

export default function App() {
  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState("american"); // default to a social mode
  const [m2v2, setM2v2] = useState({ matches: [], totals: {} });
  const [american, setAmerican] = useState({ matches: [], totals: {}, partners: {} });
  const [mexican, setMexican] = useState({ matches: [], totals: {} });
  const [playerModal, setPlayerModal] = useState(null); // player id or null

  /* Load */
  useEffect(() => {
    const raw = localStorage.getItem("padel_scorer_state_v3");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPlayers(parsed.players || []);
        setM2v2(parsed.m2v2 || { matches: [], totals: {} });
        setAmerican(parsed.american || { matches: [], totals: {}, partners:{} });
        setMexican(parsed.mexican || { matches: [], totals: {} });
        setActiveTab(parsed.ui?.activeTab || "american");
      } catch {}
    }
  }, []);

  /* Save */
  useEffect(() => {
    const payload = { players, m2v2, american, mexican, ui: { activeTab } };
    localStorage.setItem("padel_scorer_state_v3", JSON.stringify(payload));
  }, [players, m2v2, american, mexican, activeTab]);

  /* Derived helpers */
  const nameOf = (id) => players.find(p=>p.id===id)?.name || "?";

  return (
    <div className="mx-auto max-w-6xl p-4 pb-10 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Padel Scorer</h1>
        <ImportExport onLoadAll={(data)=>{
          setPlayers(data.players||[]);
          setM2v2(data.m2v2||{matches:[], totals:{}});
          setAmerican(data.american||{matches:[], totals:{}, partners:{}});
          setMexican(data.mexican||{matches:[], totals:{}});
        }} />
      </header>

      <PlayerManager players={players} setPlayers={setPlayers} />

      <div className="w-full">
        <div className="rounded-xl border p-1 grid grid-cols-3 gap-1">
          {['match','american','mexican'].map(v=> (
            <button key={v} onClick={()=> setActiveTab(v)} className={`rounded-lg px-3 py-2 text-sm border ${activeTab===v? 'bg-gray-100 border-gray-300':'border-transparent hover:bg-gray-50'}`}>
              {v==='match'?'Матч 2×2':v==='american'?'Американка':'Мексиканка'}
            </button>
          ))}
        </div>

        {activeTab==='match' && (
          <Match2v2FinalInput
            players={players}
            matches={m2v2.matches}
            totals={m2v2.totals}
            onSave={(rec, delta)=> setM2v2(s=>({ matches:[rec, ...s.matches], totals: applyDelta(s.totals, delta) }))}
            onClear={()=> setM2v2(s=>({ ...s, matches: [] }))}
            onResetTotals={()=> setM2v2(s=>({ ...s, totals: {} }))}
            onPlayerClick={setPlayerModal}
          />
        )}

        {activeTab==='american' && (
          <SmartSocialRound
            mode="american"
            players={players}
            state={american}
            setState={setAmerican}
            nameOf={nameOf}
            onPlayerClick={setPlayerModal}
          />
        )}

        {activeTab==='mexican' && (
          <SmartSocialRound
            mode="mexican"
            players={players}
            state={mexican}
            setState={setMexican}
            nameOf={nameOf}
            onPlayerClick={setPlayerModal}
          />
        )}
      </div>

      <footer className="text-xs text-muted-foreground py-6 space-y-2">
        <div className="font-semibold">Как формируются пары</div>
        <ul className="list-disc pl-5">
          <li><b>Американка:</b> пары подбираются так, чтобы <b>не повторять партнёров</b> до тех пор, пока не переберутся все комбинации. После исчерпания — цикл начинается заново.</li>
          <li><b>Мексиканка:</b> составы кортов подбираются так, чтобы <b>сбалансировать силу</b> (по текущим очкам): на один корт попадают сильные и слабые игроки, команды внутри корта формируются как (сильнейший + слабейший) против (2-й + 3-й).</li>
        </ul>
        <div className="font-semibold">Система подсчёта очков</div>
        <ul className="list-disc pl-5">
          <li><b>Матч 2×2:</b> победители получают <b>+3</b> очка.</li>
          <li><b>Американка/Мексиканка:</b> каждый игрок получает столько очков, <b>сколько набрала его команда</b> в раунде.</li>
        </ul>
      </footer>

      {playerModal && (
        <PlayerModal
          playerId={playerModal}
          onClose={()=> setPlayerModal(null)}
          players={players}
          datasets={{ m2v2, american, mexican }}
        />
      )}
    </div>
  );
}

/* Player manager */
function PlayerManager({ players, setPlayers }) {
  const [name, setName] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  function addPlayer() {
    const n = name.trim();
    if (!n) return;
    const color = defaultColors[colorIdx % defaultColors.length];
    setPlayers([...players, { id: uid(), name: n, color }]);
    setName(""); setColorIdx(i=> (i+1)%defaultColors.length);
  }
  function removePlayer(id) { setPlayers(players.filter(p => p.id !== id)); }

  return (
    <motion.div initial={{opacity:0, y:6}} animate={{opacity:1, y:0}}>
      <Card>
        <CardHeader><CardTitle>Игроки</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grow max-w-sm">
              <Label>Имя</Label>
              <Input value={name} onChange={(e)=> setName(e.target.value)} placeholder="Добавить игрока" />
            </div>
            <div className="flex items-end gap-2">
              <div className="h-9 w-14 rounded-md border" style={{ background: defaultColors[colorIdx % defaultColors.length] }} />
              <Button variant="secondary" onClick={()=> setColorIdx(i=> (i+1)%defaultColors.length)}>Сменить цвет</Button>
            </div>
            <Button onClick={addPlayer}>Добавить</Button>
          </div>

          {players.length>0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <AnimatePresence>
                {players.map(p => (
                  <motion.div key={p.id} layout initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} className="flex items-center justify-between rounded-xl border p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full border" style={{ background: p.color }}/>
                      <span className="font-semibold text-base">{p.name}</span>
                    </div>
                    <Button variant="ghost" onClick={()=> removePlayer(p.id)}>Удалить</Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* Match 2v2 */
function Match2v2FinalInput({ players, matches, totals, onSave, onClear, onResetTotals, onPlayerClick }) {
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [kind, setKind] = useState("classic");
  const [scoreA, setScoreA] = useState(""); // empty by default
  const [scoreB, setScoreB] = useState("");

  const ready = teamA.length === 2 && teamB.length === 2 && teamA.every(id => !teamB.includes(id));

  function toggle(id, team, setTeam) {
    if (team.includes(id)) setTeam(team.filter(x=>x!==id));
    else if (team.length<2) setTeam([...team, id]);
  }

  function save() {
    if (!ready) return toast.error("Выберите составы команд");
    const a = Number(scoreA||0), b = Number(scoreB||0);
    if (a===b) return toast.error("Нужен победитель");
    const winner = a>b ? teamA : teamB;
    const rec = {
      id: uid(),
      date: new Date().toISOString(),
      type: "2v2",
      mode: kind,
      teamA: [...teamA],
      teamB: [...teamB],
      score: { a, b }
    };
    const delta = {}; winner.forEach(id => delta[id]=(delta[id]||0)+3);
    onSave(rec, delta);
    setScoreA(""); setScoreB("");
    toast.success("Матч сохранён");
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <motion.div layout className="lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Матч 2×2 — итоговый ввод</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Команда A</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {players.map(p=> (
                    <button key={p.id} onClick={()=> toggle(p.id, teamA, setTeamA)} className={`rounded-xl border p-3 text-left ${teamA.includes(p.id)?'ring-2 ring-offset-1':''}`} style={{borderColor:p.color}}>
                      <span className="font-semibold text-base">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Команда B</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {players.map(p=> (
                    <button key={p.id} onClick={()=> toggle(p.id, teamB, setTeamB)} className={`rounded-xl border p-3 text-left ${teamB.includes(p.id)?'ring-2 ring-offset-1':''}`} style={{borderColor:p.color}}>
                      <span className="font-semibold text-base">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Тип счёта</Label>
                <select className="h-10 w-full rounded-md border px-3" value={kind} onChange={e=> setKind(e.target.value)}>
                  <option value="classic">Классика (сеты)</option>
                  <option value="race">На счёт (очки)</option>
                </select>
              </div>
              <div>
                <Label>Счёт A</Label>
                <Input inputMode="numeric" type="number" placeholder="—" value={scoreA} onChange={e=> setScoreA(e.target.value.replace(/\D/g,''))}/>
              </div>
              <div>
                <Label>Счёт B</Label>
                <Input inputMode="numeric" type="number" placeholder="—" value={scoreB} onChange={e=> setScoreB(e.target.value.replace(/\D/g,''))}/>
              </div>
            </div>

            <Button variant="primary" className="h-12 shadow-md hover:shadow-lg" onClick={save}>
              Сохранить игру
            </Button>

            <Separator />

            <Leaderboard title="Таблица (2×2)" players={players} totals={totals} onPlayerClick={onPlayerClick} onReset={onResetTotals} />
            <HistoryList matches={matches} players={players} emptyText="Пока нет матчей"/>
            <div className="mt-2"><Button variant="outline" onClick={onClear}>Очистить историю 2×2</Button></div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* Smart Social Modes */
function SmartSocialRound({ mode, players, state, setState, nameOf, onPlayerClick }) {
  const [courtCount, setCourtCount] = useState(1);
  const [courts, setCourts] = useState([]); // [{a:[id,id], b:[id,id]}]
  const [scores, setScores] = useState([]); // [{a:'',b:''}]

  /* Re-seed courts on players change */
  useEffect(()=>{
    if (players.length>=4) {
      const maxCourts = Math.min(Math.floor(players.length/4), Math.max(1, courtCount));
      const next = mode==='american'
        ? generateAmericano(players.map(p=>p.id), maxCourts, state.partners||{}, state.matches)
        : generateMexicano(players.map(p=>p.id), maxCourts, state.totals||{});
      setCourts(next);
      setScores(next.map(()=>({a:"",b:""})));
    } else { setCourts([]); setScores([]); }
    // eslint-disable-next-line
  }, [players.length, courtCount, mode]);

  function saveRound() {
    if (courts.length===0) return;
    // accumulate delta per player
    const delta = {};
    const recCourts = courts.map((c,i)=>{
      const a = Number(scores[i]?.a||0), b = Number(scores[i]?.b||0);
      c.a.forEach(id => delta[id]=(delta[id]||0)+a);
      c.b.forEach(id => delta[id]=(delta[id]||0)+b);
      return { a: [...c.a], b: [...c.b], score:{a,b} };
    });

    // Build record with structure for modal
    const rec = { id: uid(), date: new Date().toISOString(), type: mode, courts: recCourts };

    // update partners memory for Americano
    let partners = state.partners || {};
    if (mode==='american') {
      recCourts.forEach(c=>{
        const k1 = [c.a[0], c.a[1]].sort().join("|");
        const k2 = [c.b[0], c.b[1]].sort().join("|");
        partners[k1] = (partners[k1]||0)+1;
        partners[k2] = (partners[k2]||0)+1;
      });
    }

    setState(s=> ({
      ...s,
      matches: [rec, ...(s.matches||[])],
      totals: applyDelta(s.totals||{}, delta),
      partners
    }));

    // After save: re-generate new courts (auto)
    const maxCourts = Math.min(Math.floor(players.length/4), Math.max(1, courtCount));
    const next = mode==='american'
      ? generateAmericano(players.map(p=>p.id), maxCourts, partners, [rec, ...state.matches])
      : generateMexicano(players.map(p=>p.id), maxCourts, applyDelta(state.totals||{}, delta));
    setCourts(next);
    setScores(next.map(()=>({a:"",b:""})));

    toast.success("Раунд сохранён, пары обновлены");
  }

  function setScore(i, side, val) {
    setScores(prev => prev.map((x,idx)=> idx===i? { ...x, [side]: val.replace(/\D/g,'') } : x));
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <motion.div layout className="lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>{mode==='american'?'Американка':'Мексиканка'} — итоговый ввод</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Кортов</Label>
                <Input inputMode="numeric" type="number" min={1} max={Math.max(1, Math.floor(players.length/4))} value={courtCount} onChange={e=> setCourtCount(parseInt(e.target.value||"1"))}/>
              </div>
              <div className="flex items-end text-xs text-muted-foreground">После сохранения раунда пары обновятся автоматически.</div>
            </div>

            {courts.length===0 ? (
              <p className="text-sm text-muted-foreground">Добавьте минимум 4 игроков.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {courts.map((c, idx)=> (
                  <motion.div key={idx} layout initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} className="rounded-2xl border p-3 space-y-2">
                    <div className="text-sm font-semibold">Корт {idx+1}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="font-semibold text-base">Команда A</div>
                        <div className="text-base font-bold">{c.a.map(id=> getNameWithColor(players,id)).reduce((acc,el,i)=> i? [...acc, <span key={i} className='opacity-70'> + </span>, el] : [el], [])}</div>
                        <Input inputMode="numeric" type="number" placeholder="—" className="w-24 text-center text-lg font-semibold mt-1" value={scores[idx]?.a||""} onChange={e=> setScore(idx,'a',e.target.value)} />
                      </div>
                      <div>
                        <div className="font-semibold text-base">Команда B</div>
                        <div className="text-base font-bold">{c.b.map(id=> getNameWithColor(players,id)).reduce((acc,el,i)=> i? [...acc, <span key={i} className='opacity-70'> + </span>, el] : [el], [])}</div>
                        <Input inputMode="numeric" type="number" placeholder="—" className="w-24 text-center text-lg font-semibold mt-1" value={scores[idx]?.b||""} onChange={e=> setScore(idx,'b',e.target.value)} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <Button variant="primary" className="h-12 shadow-md hover:shadow-lg" onClick={saveRound}>Сохранить раунд</Button>

            <Separator />
            <Leaderboard title={`Таблица (${mode==='american'?'Американка':'Мексиканка'})`} players={players} totals={state.totals||{}} onPlayerClick={onPlayerClick} onReset={()=> setState(s=>({...s, totals:{}}))} />
            <HistoryList matches={state.matches||[]} players={players} emptyText="Пока нет раундов"/>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={()=>{
                const ids = players.map(p=>p.id);
                const maxCourts = Math.min(Math.floor(ids.length/4), Math.max(1, courtCount));
                const next = mode==='american'
                  ? generateAmericano(ids, maxCourts, state.partners||{}, state.matches||[])
                  : generateMexicano(ids, maxCourts, state.totals||{});
                setCourts(next); setScores(next.map(()=>({a:"",b:""})));
              }}>Новые пары</Button>
              <Button variant="outline" onClick={()=> setState(s=>({...s, matches: []}))}>Очистить историю</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* Leaderboard + click to open modal */
function Leaderboard({ title, players, totals, onPlayerClick, onReset }) {
  const board = [...players].map(p=> ({ id:p.id, name:p.name, score: totals[p.id]||0, color:p.color })).sort((a,b)=> b.score - a.score);
  return (
    <Card>
      <CardHeader className="flex items-center justify-between"><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-end"><Button variant="outline" onClick={onReset}>Сбросить очки</Button></div>
        {board.length===0 ? <p className="text-sm text-muted-foreground">Добавьте игроков.</p> : (
          <div className="divide-y rounded-xl border overflow-hidden">
            <AnimatePresence>
              {board.map((r,i)=> (
                <motion.button key={r.id} onClick={()=> onPlayerClick?.(r.id)} layout initial={{opacity:0}} animate={{opacity:1}} className="flex items-center justify-between p-3 w-full text-left hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 text-center font-semibold">{i+1}</div>
                    <div className="h-5 w-5 rounded-full border" style={{ background: r.color }} />
                    <div className="font-medium underline">{r.name}</div>
                  </div>
                  <div className="text-lg font-bold">{r.score}</div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* Player modal */
function PlayerModal({ playerId, onClose, players, datasets }) {
  const nameOf = (id)=> players.find(p=>p.id===id)?.name || "?";
  const all = [
    ...datasets.m2v2.matches.map(m=> ({...m, modeLabel:'2×2'})),
    ...datasets.american.matches.map(m=> ({...m, modeLabel:'Американка'})),
    ...datasets.mexican.matches.map(m=> ({...m, modeLabel:'Мексиканка'})),
  ].sort((a,b)=> new Date(b.date)-new Date(a.date));

  // collect entries for this player
  const entries = [];
  let totalScored = 0;
  for (const m of all) {
    if (m.type==='2v2') {
      const court = { a: m.teamA, b: m.teamB, score: m.score };
      const inA = court.a.includes(playerId), inB = court.b.includes(playerId);
      if (!inA && !inB) continue;
      const partner = nameOf((inA? court.a : court.b).find(id=> id!==playerId));
      const opponents = (inA? court.b : court.a).map(nameOf).join(", ");
      const scored = (inA? court.score.a : court.score.b);
      totalScored += scored;
      entries.push({ when:m.date, mode:m.modeLabel, partner, opponents, score:`${court.score.a}:${court.score.b}` });
    } else {
      for (const c of m.courts||[]) {
        const inA = c.a.includes(playerId), inB = c.b.includes(playerId);
        if (!inA && !inB) continue;
        const partner = nameOf((inA? c.a : c.b).find(id=> id!==playerId));
        const opponents = (inA? c.b : c.a).map(nameOf).join(", ");
        const scored = (inA? c.score.a : c.score.b);
        totalScored += scored;
        entries.push({ when:m.date, mode:m.modeLabel, partner, opponents, score:`${c.score.a}:${c.score.b}` });
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center p-3 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl p-4 space-y-3" onClick={e=> e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold">{nameOf(playerId)}</div>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </div>
        <div className="text-sm">Суммарный счёт (очки игрока во всех играх): <b>{totalScored}</b></div>
        {entries.length===0 ? <div className="text-sm text-muted-foreground">Игрок ещё не играл.</div> : (
          <div className="max-h-96 overflow-auto rounded-xl border divide-y">
            {entries.map((e,idx)=> (
              <div key={idx} className="p-3 text-sm">
                <div className="text-xs text-muted-foreground">{new Date(e.when).toLocaleString()}</div>
                <div><b>{e.mode}</b> — партнёр: <b>{e.partner}</b>; соперники: {e.opponents}</div>
                <div>Счёт: <b>{e.score}</b></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* History list (renders both modes) */
function HistoryList({ matches, players, emptyText }) {
  return (
    <div>
      <Label>История</Label>
      {matches.length===0 ? <p className="text-sm text-muted-foreground">{emptyText}</p> : (
        <ul className="space-y-2 mt-2">
          <AnimatePresence>
            {matches.map(m => (
              <motion.li key={m.id} layout initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">{new Date(m.date).toLocaleString()}</div>
                {m.type==='2v2' ? (
                  <div className="text-sm mt-1">
                    {m.teamA.map(id=> players.find(p=>p.id===id)?.name).join(" + ")} vs {m.teamB.map(id=> players.find(p=>p.id===id)?.name).join(" + ")}
                    {" — "}{m.score.a}:{m.score.b}
                  </div>
                ) : (
                  <div className="text-sm mt-1">
                    {(m.courts||[]).map((c,i)=> `Корт ${i+1}: ${c.a.map(id=>players.find(p=>p.id===id)?.name).join(" + ")} vs ${c.b.map(id=>players.find(p=>p.id===id)?.name).join(" + ")} — ${c.score.a}:${c.score.b}`).join("; ")}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* Algorithms */
function generateAmericano(ids, courtCount, partnersMemory, matches) {
  // partnersMemory: { "id1|id2": timesPlayedTogether }
  const shuffled = [...ids].sort(()=> Math.random()-0.5);
  const result = [];
  const used = new Set(); // ids used this round
  // greedy: pick first unused, partner with minimal past count
  for (let c=0; c<courtCount; c++) {
    const teamA = [], teamB = [];
    for (let t=0; t<2; t++) {
      const free = shuffled.find(id=> !used.has(id));
      if (free==null) break;
      used.add(free);
      const candidates = shuffled.filter(id=> !used.has(id));
      let best = null, bestScore = Infinity;
      for (const cand of candidates) {
        const key = [free, cand].sort().join("|");
        const score = partnersMemory?.[key] || 0;
        if (score < bestScore) { bestScore = score; best = cand; }
      }
      if (best==null) break;
      used.add(best);
      (t===0 ? teamA : teamB).push(free, best);
    }
    if (teamA.length===2 && teamB.length===2) {
      result.push({ a: teamA, b: teamB });
    }
  }
  return result;
}

function generateMexicano(ids, courtCount, totals) {
  // Sort by current totals desc (stronger first)
  const arr = [...ids].sort((a,b)=> (totals[b]||0)-(totals[a]||0));
  const result = [];
  let i = 0;
  for (let c=0; c<courtCount; c++) {
    const group = [arr[i], arr[i+1], arr[i+2], arr[i+3]].filter(Boolean);
    i += 4;
    if (group.length<4) break;
    // Teams: (1+4) vs (2+3)
    result.push({ a: [group[0], group[3]], b: [group[1], group[2]] });
  }
  return result;
}

/* Utilities */
function getNameWithColor(players, id) {
  const p = players.find(x=> x.id===id);
  if (!p) return "?";
  return <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border" style={{background:p.color}}></span>{p.name}</span>;
}
function applyDelta(baseline, delta) {
  const next = { ...baseline };
  Object.entries(delta).forEach(([k, v]) => { next[k] = (next[k] || 0) + v; });
  return next;
}

/* Import/Export */
function ImportExport({ onLoadAll }) {
  function exportJson() {
    const raw = localStorage.getItem("padel_scorer_state_v3");
    const blob = new Blob([raw || "{}"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `padel-scorer-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const parsed = JSON.parse(String(rd.result));
        onLoadAll(parsed);
        localStorage.setItem("padel_scorer_state_v3", JSON.stringify(parsed));
        toast.success("Данные импортированы");
      } catch { toast.error("Не удалось прочитать файл"); }
    }; rd.readAsText(file);
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={exportJson}>Экспорт</Button>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input type="file" accept="application/json" onChange={importJson} className="hidden" />
        <span className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">Импорт</span>
      </label>
    </div>
  );
}
