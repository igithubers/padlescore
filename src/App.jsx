
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Minimal UI
const Button = ({children, className='', variant, size, ...props}) => {
  const base='inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm transition active:scale-[0.99]';
  const variants={default:'bg-white hover:bg-gray-50 border-gray-200',secondary:'bg-gray-100 hover:bg-gray-200 border-gray-200',outline:'bg-transparent hover:bg-gray-50 border-gray-300',ghost:'bg-transparent border-transparent hover:bg-gray-50'};
  const sizes={icon:'h-9 w-9 p-0'};
  return <button className={[base, variants[variant||'default'], size? sizes[size]:'', className].join(' ')} {...props}>{children}</button>;
};
const Card = ({children,className})=> <div className={`rounded-2xl border ${className||''}`}>{children}</div>;
const CardHeader = ({children,className})=> <div className={`p-4 border-b ${className||''}`}>{children}</div>;
const CardTitle = ({children,className})=> <div className={`text-lg font-semibold ${className||''}`}>{children}</div>;
const CardContent = ({children,className})=> <div className={`p-4 space-y-2 ${className||''}`}>{children}</div>;
const Input = (props)=> <input {...props} className={`h-9 w-full rounded-md border border-gray-300 px-3 ${props.className||''}`} />;
const Label = ({children,className})=> <label className={`text-sm font-medium ${className||''}`}>{children}</label>;
const Separator = ()=> <hr className="my-2 border-gray-200" />;

const uid = () => Math.random().toString(36).slice(2, 9);
const defaultColors = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#a78bfa","#ec4899","#06b6d4","#10b981","#8b5cf6","#f97316"];

export default function App() {
  const [players, setPlayers] = useState([]);
  const [activeTab, setActiveTab] = useState("match");
  const [m2v2, setM2v2] = useState({ matches: [], totals: {} });
  const [american, setAmerican] = useState({ matches: [], totals: {} });
  const [mexican, setMexican] = useState({ matches: [], totals: {} });

  useEffect(() => {
    const raw = localStorage.getItem("padel_scorer_state_v2");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPlayers(parsed.players || []);
        setM2v2(parsed.m2v2 || { matches: [], totals: {} });
        setAmerican(parsed.american || { matches: [], totals: {} });
        setMexican(parsed.mexican || { matches: [], totals: {} });
        setActiveTab(parsed.ui?.activeTab || "match");
      } catch {}
    }
  }, []);

  useEffect(() => {
    const payload = { players, m2v2, american, mexican, ui: { activeTab } };
    localStorage.setItem("padel_scorer_state_v2", JSON.stringify(payload));
  }, [players, m2v2, american, mexican, activeTab]);

  return (
    <div className="mx-auto max-w-6xl p-4 pb-[5.5rem] sm:pb-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Padel Scorer</h1>
        <ImportExport onLoadAll={(data)=>{
          setPlayers(data.players||[]);
          setM2v2(data.m2v2||{matches:[], totals:{}});
          setAmerican(data.american||{matches:[], totals:{}});
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
          <Match2v2FinalInput players={players}
            matches={m2v2.matches}
            totals={m2v2.totals}
            onSave={(rec, delta)=> setM2v2(s=>({ matches:[rec, ...s.matches], totals: applyDelta(s.totals, delta) }))}
            onClear={()=> setM2v2(s=>({ ...s, matches: [] }))}
            onResetTotals={()=> setM2v2(s=>({ ...s, totals: {} }))}
          />
        )}

        {activeTab==='american' && (
          <SocialRoundFinalInput mode="american" players={players}
            matches={american.matches}
            totals={american.totals}
            onSave={(rec, delta)=> setAmerican(s=>({ matches:[rec, ...s.matches], totals: applyDelta(s.totals, delta) }))}
            onClear={()=> setAmerican(s=>({ ...s, matches: [] }))}
            onResetTotals={()=> setAmerican(s=>({ ...s, totals: {} }))}
          />
        )}

        {activeTab==='mexican' && (
          <SocialRoundFinalInput mode="mexican" players={players}
            matches={mexican.matches}
            totals={mexican.totals}
            onSave={(rec, delta)=> setMexican(s=>({ matches:[rec, ...s.matches], totals: applyDelta(s.totals, delta) }))}
            onClear={()=> setMexican(s=>({ ...s, matches: [] }))}
            onResetTotals={()=> setMexican(s=>({ ...s, totals: {} }))}
          />
        )}
      </div>

      <footer className="text-xs text-muted-foreground py-6 space-y-2">
        <div className="font-semibold">Как формируются пары</div>
        <div>Перед каждым раундом список игроков перемешивается случайно и разбивается по 4 человека на корт. После сохранения раунда пары автоматически обновляются.</div>
        <div className="font-semibold">Система подсчёта очков</div>
        <ul className="list-disc pl-5">
          <li><b>Матч 2×2:</b> победители получают <b>+3</b> очка (оба игрока из команды).</li>
          <li><b>Американка/Мексиканка:</b> каждый игрок получает столько очков, сколько набрала его команда в раунде.</li>
        </ul>
      </footer>
    </div>
  );
}

function PlayerManager({ players, setPlayers }) {
  const [name, setName] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  function addPlayer() {
    const n = name.trim();
    if (!n) return;
    const defaultColors = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#a78bfa","#ec4899","#06b6d4","#10b981","#8b5cf6","#f97316"];
    setPlayers([...players, { id: uid(), name: n, color: defaultColors[colorIdx % defaultColors.length] }]);
    setName(""); setColorIdx(i => (i + 1) % defaultColors.length);
  }

  function removePlayer(id) { setPlayers(players.filter(p => p.id !== id)); }

  return (
    <motion.div initial={{opacity:0, y:6}} animate={{opacity:1, y:0}}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Игроки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grow max-w-sm">
              <Label>Имя</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Добавить игрока"/>
            </div>
            <div>
              <Label>Цвет</Label>
              <div className="flex items-center gap-2">
                <div className="h-9 w-14 rounded-md border" style={{ background: ["#3b82f6","#ef4444","#22c55e","#f59e0b","#a78bfa","#ec4899","#06b6d4","#10b981","#8b5cf6","#f97316"][colorIdx % 10] }} />
                <Button variant="secondary" onClick={() => setColorIdx((i) => (i + 1) % 10)} title="Сменить цвет">↻</Button>
              </div>
            </div>
            <Button className="h-10 px-5 text-base" onClick={addPlayer}>Добавить</Button>
          </div>

          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">Добавьте минимум 4 игроков.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <AnimatePresence>
                {players.map(p => (
                  <motion.button key={p.id} layout initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.98}}
                    className="flex items-center justify-between rounded-xl border p-3 text-left active:scale-[0.99] transition">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full border" style={{ background: p.color || "#eee" }}/>
                      <span className="font-semibold text-base">{p.name}</span>
                    </div>
                    <Button variant="ghost" onClick={() => removePlayer(p.id)}>Удалить</Button>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Match2v2FinalInput({ players, matches, totals, onSave, onClear, onResetTotals }) {
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [kind, setKind] = useState("classic");
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const ready = teamA.length === 2 && teamB.length === 2 && teamA.every(id => !teamB.includes(id));

  function save() {
    if (!ready) return toast.error("Выберите составы команд");
    if (scoreA === scoreB) return toast.error("Нужен победитель");

    const winner = scoreA > scoreB ? teamA : teamB;
    const participants = [...teamA, ...teamB];

    const rec = {
      id: uid(),
      date: new Date().toISOString(),
      type: "2v2",
      mode: kind,
      participants,
      scoreText: `${labelOf(teamA, players)} vs ${labelOf(teamB, players)} — ${scoreA}:${scoreB} (${kind === "race"? "очки" : "сеты"})`,
    };

    const delta = {};
    winner.forEach(id => delta[id] = (delta[id] || 0) + 3);

    onSave(rec, delta);
    setScoreA(0); setScoreB(0);
    toast.success("Матч сохранён");
  }

  const board = buildBoard(players, totals);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <motion.div layout className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Матч 2×2 — итоговый ввод</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <TeamPicker label="Команда A" players={players} value={teamA} onChange={setTeamA} />
              <TeamPicker label="Команда B" players={players} value={teamB} onChange={setTeamB} />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Тип счёта</Label>
                <select className="h-9 w-full rounded-md border px-3" value={kind} onChange={e=> setKind(e.target.value)}>
                  <option value="classic">Классика (сеты)</option>
                  <option value="race">На счёт (очки)</option>
                </select>
              </div>
              <div>
                <Label>Счёт A</Label>
                <Input inputMode="numeric" type="number" value={scoreA} onChange={e=> setScoreA(parseInt(e.target.value||"0"))}/>
              </div>
              <div>
                <Label>Счёт B</Label>
                <Input inputMode="numeric" type="number" value={scoreB} onChange={e=> setScoreB(parseInt(e.target.value||"0"))}/>
              </div>
            </div>

            <Button className="h-12" onClick={save}>Сохранить игру</Button>

            <Separator />

            <HistoryList matches={matches} players={players} emptyText="Пока нет матчей"/>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div layout>
        <LeaderboardCard title="Таблица (2×2)" board={board} onReset={onResetTotals} />
        <div className="mt-2">
          <Button variant="outline" onClick={onClear}>Очистить историю 2×2</Button>
        </div>
      </motion.div>
    </div>
  );
}

function SocialRoundFinalInput({ mode, players, matches, totals, onSave, onClear, onResetTotals }) {
  const [courtCount, setCourtCount] = useState(1);
  const [activePairs, setActivePairs] = useState([]);
  const [roundResults, setRoundResults] = useState([]);

  const eligibleIds = useMemo(()=> players.map(p=>p.id), [players]);

  useEffect(()=>{
    if (eligibleIds.length >= 4) {
      const maxCourts = Math.min(Math.floor(eligibleIds.length/4), Math.max(1, courtCount));
      const pairs = makeRoundPairs(eligibleIds).slice(0, maxCourts);
      setActivePairs(pairs);
      setRoundResults(pairs.map((_,i)=>({court:i+1, aScore:0, bScore:0})));
    } else { setActivePairs([]); setRoundResults([]); }
  }, [eligibleIds.join(","), courtCount, mode]);

  function saveRound() {
    if (activePairs.length===0) return;

    const delta = {};
    const participants = [];
    activePairs.forEach((q, idx)=>{
      const [a1,a2,b1,b2] = q; const rr = roundResults[idx];
      [a1,a2,b1,b2].forEach(id=> participants.push(id));
      delta[a1] = (delta[a1]||0) + rr.aScore; delta[a2] = (delta[a2]||0) + rr.aScore;
      delta[b1] = (delta[b1]||0) + rr.bScore; delta[b2] = (delta[b2]||0) + rr.bScore;
    });

    const scoreText = roundResults.map((r,i)=>`Корт ${i+1}: ${r.aScore}:${r.bScore}`).join("; ");
    const rec = { id: uid(), date: new Date().toISOString(), type: mode, participants, scoreText };
    onSave(rec, delta);

    // NEW: после сохранения — сгенерировать новые пары автоматически
    const ids = players.map(p=>p.id);
    const maxCourts = Math.min(Math.floor(ids.length/4), Math.max(1, courtCount));
    const pairs = makeRoundPairs(ids).slice(0, maxCourts);
    setActivePairs(pairs);
    setRoundResults(pairs.map((_,i)=>({court:i+1,aScore:0,bScore:0})));

    toast.success("Раунд сохранён, пары обновлены");
  }

  function nameOf(id) { return players.find(x => x.id === id)?.name || "?"; }

  const board = buildBoard(players, totals);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <motion.div layout className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{mode === "american"? "Американка" : "Мексиканка"} — итоговый ввод</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Кортов</Label>
                <Input inputMode="numeric" type="number" min={1} max={Math.max(1, Math.floor(players.length/4))} value={courtCount} onChange={e=> setCourtCount(parseInt(e.target.value||"1"))}/>
              </div>
              <div className="flex items-end text-xs text-muted-foreground">Составы и счёт вводятся по итогам раунда.</div>
            </div>

            {activePairs.length===0 ? (
              <p className="text-sm text-muted-foreground">Добавьте минимум 4 игроков.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {activePairs.map((quad, idx)=>{
                  const [a1,a2,b1,b2] = quad; const rr = roundResults[idx];
                  return (
                    <motion.div key={idx} layout initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} className="rounded-2xl border p-3 space-y-2">
                      <div className="text-sm font-semibold">Корт {idx+1}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="font-semibold text-base">Команда A</div>
                          <div className="text-base font-bold">{nameOf(a1)} <span className="opacity-70">+</span> {nameOf(a2)}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <Input inputMode="numeric" className="w-24 text-center text-lg font-semibold" value={rr.aScore} onChange={e=> setRoundResults(prev=> prev.map((x,i)=> i===idx? {...x, aScore: parseInt(e.target.value||"0")}:x))} />
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-base">Команда B</div>
                          <div className="text-base font-bold">{nameOf(b1)} <span className="opacity-70">+</span> {nameOf(b2)}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <Input inputMode="numeric" className="w-24 text-center text-lg font-semibold" value={rr.bScore} onChange={e=> setRoundResults(prev=> prev.map((x,i)=> i===idx? {...x, bScore: parseInt(e.target.value||"0")}:x))} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div layout>
        <LeaderboardCard title={`Таблица (${mode === 'american' ? 'Американка' : 'Мексиканка'})`} board={buildBoard(players, totals)} onReset={onResetTotals} />
        <div className="mt-2">
          <Button variant="secondary" onClick={()=>{
            const ids = players.map(p=>p.id);
            const maxCourts = Math.min(Math.floor(ids.length/4), Math.max(1, courtCount));
            const pairs = makeRoundPairs(ids).slice(0, maxCourts);
            setActivePairs(pairs);
            setRoundResults(pairs.map((_,i)=>({court:i+1,aScore:0,bScore:0})));
          }}>Новые пары</Button>
          <Button variant="outline" className="ml-2" onClick={onClear}>Очистить историю</Button>
        </div>
      </motion.div>
    </div>
  );
}

function TeamPicker({ label, players, value, onChange }) {
  function toggle(id) {
    if (value.includes(id)) onChange(value.filter(x => x !== id));
    else if (value.length < 2) onChange([...value, id]);
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {players.map(p => (
          <motion.button key={p.id} layout onClick={() => toggle(p.id)} initial={{opacity:0, scale:0.98}} animate={{opacity:1, scale:1}}
            className={`rounded-xl border p-3 text-left transition active:scale-[0.99] ${value.includes(p.id) ? "ring-2 ring-offset-1" : "opacity-90"}`} style={{ borderColor: p.color || "#ddd" }}>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full border" style={{ background: p.color || "#eee" }}/>
              <span className="font-semibold text-base">{p.name}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function HistoryList({ matches, players, emptyText }) {
  function fmt(d) { try { return new Date(d).toLocaleString(); } catch { return d; } }
  function names(ids) { return ids.map(id=> players.find(p=>p.id===id)?.name || "?").join(", "); }
  return (
    <div>
      <Label>История</Label>
      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2 mt-2">
          <AnimatePresence>
            {matches.map(m => (
              <motion.li key={m.id} layout initial={{opacity:0, y:6}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-6}} className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">{fmt(m.date)}</div>
                <div className="text-sm mt-1">{m.scoreText}</div>
                <div className="text-xs mt-1">Игроки: {names(m.participants)}</div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function buildBoard(players, totals) {
  return [...players].map(p => ({ id: p.id, name: p.name, score: totals[p.id] || 0, color: p.color }))
    .sort((a,b)=> b.score - a.score);
}

function LeaderboardCard({ title, board, onReset }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-end">
          <Button variant="outline" onClick={onReset}>Сбросить очки</Button>
        </div>
        {board.length === 0 ? (
          <p className="text-sm text-muted-foreground">Добавьте игроков.</p>
        ) : (
          <div className="divide-y rounded-xl border overflow-hidden">
            <AnimatePresence>
              {board.map((r, i) => (
                <motion.div key={r.id} layout initial={{opacity:0}} animate={{opacity:1}} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 text-center font-semibold">{i+1}</div>
                    <div className="h-5 w-5 rounded-full border" style={{ background: r.color || "#eee" }} />
                    <div className="font-medium">{r.name}</div>
                  </div>
                  <div className="text-lg font-bold">{r.score}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImportExport({ onLoadAll }) {
  function exportJson() {
    const raw = localStorage.getItem("padel_scorer_state_v2");
    const blob = new Blob([raw || "{}"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `padel-scorer-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        onLoadAll(parsed);
        localStorage.setItem("padel_scorer_state_v2", JSON.stringify(parsed));
        toast.success("Данные импортированы");
      } catch {
        toast.error("Не удалось прочитать файл");
      }
    };
    reader.readAsText(file);
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

function labelOf(ids, players) {
  return ids.map(id => players.find(p=>p.id===id)?.name || "?").join(" + ");
}

function makeRoundPairs(playerIds) {
  const ids = [...playerIds];
  const pairs = [];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  for (let i = 0; i + 3 < ids.length; i += 4) {
    pairs.push([ids[i], ids[i + 1], ids[i + 2], ids[i + 3]]);
  }
  return pairs;
}

function applyDelta(baseline, delta) {
  const next = { ...baseline };
  Object.entries(delta).forEach(([k, v]) => { next[k] = (next[k] || 0) + v; });
  return next;
}
