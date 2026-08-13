import { useEffect, useState } from 'react';
import { Activity, Bike, CalendarDays, ChevronRight, Clock, Flag, Gauge, Medal, Mountain, Save, Trash2, Trophy, UserRound } from 'lucide-react';
import { CreateCareer } from '../components/CreateCareer';
import { trainingConfig } from '../game/config';
import type { GameState, RaceStrategy, Rider, RiderStats, TrainingType } from '../game/models';
import { advanceToNextRace, createGame, deleteSave, loadGame, nextDay, race, saveGame, train, trainingBlockReason } from '../state/gameStore';

const statLabels: Record<keyof RiderStats,string> = {mountain:'Montagne',sprint:'Sprint',climbing:'Côtes',timeTrial:'Chrono',pavement:'Pavés',endurance:'Endurance',explosiveness:'Explosivité',recovery:'Récupération',descending:'Descente',tactics:'Tactique',resistance:'Résistance',weather:'Météo'};
const terrainLabels = {sprint:'Sprint',plaine:'Plaine',vallons:'Vallons',montagne:'Montagne',chrono:'Chrono',paves:'Pavés'};
const profileLabels = {grimpeur:'Grimpeur',puncheur:'Puncheur',sprinteur:'Sprinteur',rouleur:'Rouleur',classiqueur:'Classiqueur',etapes:'Courses à étapes'};

function Metric({label,value,tone}:{label:string;value:number;tone?:string}) {
  return <div className="metric"><div><span>{label}</span><strong>{Math.round(value)}</strong></div><div className="meter"><i style={{width:`${value}%`,background:tone}} /></div></div>;
}

function RiderView({rider}:{rider:Rider}) {
  return <div className="content-view"><section className="panel profile-summary"><div className="rider-mark large">{rider.firstName[0]}{rider.lastName[0]}</div><div><span className="eyebrow">{profileLabels[rider.profile]} · {rider.nationality}</span><h1>{rider.firstName} {rider.lastName}</h1><p>{rider.height} cm · {rider.weight} kg · {rider.age} ans</p>{rider.injury&&<p className="injury-banner">⚠ {rider.injury.name} · {rider.injury.daysRemaining} jour(s) · {rider.injury.trainingRestriction==='light-only'?'entraînement léger uniquement':'activité interdite'}</p>}</div></section><section className="panel"><div className="panel-title"><h3>Caractéristiques</h3><span className="eyebrow">NIVEAU ACTUEL</span></div><div className="stats-grid">{Object.entries(rider.stats).map(([k,v])=><Metric key={k} label={statLabels[k as keyof RiderStats]} value={v}/>)}</div></section></div>;
}

function CalendarView({game,onRace}:{game:GameState;onRace:(id:string)=>void}) {
  return <div className="calendar-list">{game.calendar.map((r,i)=><article className={`calendar-card ${r.status}`} key={r.id}><div className="race-no">0{i+1}</div><div className="race-date"><b>{new Date(r.date+'T12:00').toLocaleDateString('fr-FR',{day:'2-digit'})}</b><span>{new Date(r.date+'T12:00').toLocaleDateString('fr-FR',{month:'short'}).toUpperCase()}</span></div><div className="race-name"><small>{r.country} · {terrainLabels[r.terrain]}</small><h3>{r.name}</h3><span>{r.distance} km · {r.elevation} m D+</span></div><div className="race-state">{r.status==='completed'?<><Medal/><b>{r.result?.position}e</b></>:r.status==='available'?<button className="primary" onClick={()=>onRace(r.id)}>COURIR</button>:<span>PLANIFIÉE</span>}</div></article>)}</div>;
}

function ResultToast({result,close}:{result:GameState['lastResult'];close:()=>void}) {
  if(!result) return null;
  return <div className="result"><button onClick={close}>×</button><Trophy/><span>RÉSULTAT OFFICIEL</span><h2>{result.position}<sup>e</sup></h2><p>sur {result.fieldSize} coureurs · {result.gap}</p><div className="score"><b>{result.score}</b><small>PERFORMANCE / 100</small></div>{result.events.map(e=><p className="event" key={e}>{e}</p>)}<div className="result-gains"><strong>+ {result.xpGained} XP</strong><span>+ {result.reputationGained.toFixed(2)} réputation</span><span>+ {result.fatigueCost} fatigue de course</span></div></div>;
}

function Dashboard({game,setGame,onReset}:{game:GameState;setGame:(g:GameState)=>void;onReset:()=>void}) {
  const [tab,setTab]=useState<'dashboard'|'rider'|'calendar'>('dashboard');
  const [racing,setRacing]=useState<string>();
  const [strategy,setStrategy]=useState<RaceStrategy>('normal');
  const next=game.calendar.find(r=>r.status!=='completed');
  const available=game.calendar.find(r=>r.status==='available');
  const selectedBlock=trainingBlockReason(game,game.selectedTraining);
  const update=(g:GameState)=>{setGame(g);saveGame(g)};
  const runRace=()=>{if(racing){update(race(game,racing,strategy));setRacing(undefined)}};
  const best=Math.min(...game.calendar.flatMap(r=>r.result?[r.result.position]:[99]));
  return <div className="shell">
    <aside><div className="logo"><Bike/><b>C/C</b></div><nav><button className={tab==='dashboard'?'active':''} onClick={()=>setTab('dashboard')}><Gauge/><span>Vue d'ensemble</span></button><button className={tab==='rider'?'active':''} onClick={()=>setTab('rider')}><UserRound/><span>Mon coureur</span></button><button className={tab==='calendar'?'active':''} onClick={()=>setTab('calendar')}><CalendarDays/><span>Calendrier</span></button></nav><div className="aside-bottom"><button onClick={()=>saveGame(game)}><Save/><span>Sauvegarder</span></button><button onClick={onReset}><Trash2/><span>Nouvelle carrière</span></button></div></aside>
    <main className="main">
      <header><div><span className="eyebrow">SAISON 2027 · JOUR {Math.ceil((+new Date(game.currentDate)-+new Date('2027-02-01'))/86400000)+1}</span><h2>{tab==='dashboard'?`Bonjour, ${game.rider.firstName}.`:tab==='rider'?'Profil du coureur':'Calendrier de saison'}</h2></div><div className="date"><Clock/><div><small>DATE ACTUELLE</small><b>{new Date(game.currentDate+'T12:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</b></div></div></header>
      {tab==='dashboard' && <>
        <section className="hero-card"><div className="rider-mark">{game.rider.firstName[0]}{game.rider.lastName[0]}</div><div className="rider-title"><span>{game.team.name}</span><h1>{game.rider.firstName}<br/><strong>{game.rider.lastName}</strong></h1><div className="chips"><i>{game.rider.age} ANS</i><i>{game.rider.nationality.toUpperCase()}</i><i>{profileLabels[game.rider.profile].toUpperCase()}</i></div>{game.rider.injury&&<p className="injury-chip">⚠ {game.rider.injury.name} · {game.rider.injury.daysRemaining} j</p>}</div><div className="condition"><div title="État physique et niveau de préparation actuel."><Metric label="FORME · ÉTAT PHYSIQUE" value={game.rider.form} tone="#c9ff3d"/></div><div title="Charge physique accumulée. Une fatigue élevée réduit performance et progression."><Metric label="FATIGUE · CHARGE" value={game.rider.fatigue} tone="#ff7657"/></div><div title="État psychologique ayant un effet léger sur les performances."><Metric label="MORAL · MENTAL" value={game.rider.morale} tone="#6fa8ff"/></div></div></section>
        <div className="dashboard-grid">
          <section className="panel next-race"><div className="panel-title"><div><span className="eyebrow">PROCHAIN OBJECTIF</span><h3>{next?.name??'Saison terminée'}</h3></div><Flag/></div>{next && <><div className={`route ${next.terrain}`}><Mountain/><div className="route-line"/><b>{next.elevation} m D+</b></div><div className="race-meta"><span><b>{terrainLabels[next.terrain]}</b>PROFIL</span><span><b>{next.distance} km</b>DISTANCE</span><span><b>{new Date(next.date+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</b>DATE</span></div>{available?<button className="primary" onClick={()=>setRacing(available.id)}>PRENDRE LE DÉPART <ChevronRight/></button>:<button className="outline" onClick={()=>update(advanceToNextRace(game))}>AVANCER JUSQU'À LA COURSE <ChevronRight/></button>}</>}</section>
          <section className="panel training"><div className="panel-title"><div><span className="eyebrow">PROGRAMME DU JOUR</span><h3>Entraînement</h3></div><Activity/></div><div className="training-list">{(Object.keys(trainingConfig) as TrainingType[]).filter(k=>k!=='recuperation').map(k=><button title={trainingConfig[k].description} className={game.selectedTraining===k?'active':''} onClick={()=>update({...game,selectedTraining:k,notice:undefined})} key={k}><span>{trainingConfig[k].label}</span><small>+{trainingConfig[k].fatigue} fatigue · {trainingConfig[k].stats.length} axes travaillés</small></button>)}</div><p className="training-note">Une séance ou un repos consomme la journée. Les gains ralentissent près du potentiel et lorsque la fatigue monte.</p>{selectedBlock&&<p className="warning">⚠ {selectedBlock}</p>}{game.notice&&<p className="notice">{game.notice}</p>}<div className="actions"><button className="primary" disabled={Boolean(selectedBlock)} onClick={()=>update(train(game,game.selectedTraining))}>{available?'COURSE À DISPUTER':'ENTRAÎNER · JOUR SUIVANT'}</button><button className="outline" disabled={Boolean(available)} onClick={()=>update(nextDay(game))}>{available?'COURSE À DISPUTER':'REPOS · JOUR SUIVANT'}</button></div></section>
        </div>
        <section className="season-strip"><div title="Expérience sportive accumulée grâce aux courses."><small>EXPÉRIENCE</small><b>{game.rider.experience} XP</b><em>Vécu sportif accumulé en course.</em></div><div><small>COURSES</small><b>{game.calendar.filter(r=>r.status==='completed').length} / {game.calendar.length}</b></div><div><small>MEILLEUR RÉSULTAT</small><b>{best===99?'—':`${best}e`}</b></div><div title="Notoriété dans le peloton, utilisée plus tard pour les contrats, équipes et sponsors."><small>RÉPUTATION</small><b>{game.rider.reputation.toFixed(1)}</b><em>Notoriété dans le peloton.</em></div></section>
      </>}
      {tab==='rider' && <RiderView rider={game.rider}/>} {tab==='calendar' && <CalendarView game={game} onRace={setRacing}/>} 
    </main>
    {racing && <div className="modal-back"><div className="modal"><span className="eyebrow">BRIEFING DE COURSE</span><h2>{game.calendar.find(r=>r.id===racing)?.name}</h2><p>Chaque plan change le potentiel de performance, la variance et la fatigue finale.</p><div className="strategy">{([['economiser','Économiser','− performance · + régularité · +10 fatigue'],['normal','Rythme normal','Équilibré · +16 fatigue'],['agressif','Course agressive','+ potentiel · + risque · +24 fatigue']] as const).map(s=><button className={strategy===s[0]?'selected':''} onClick={()=>setStrategy(s[0])} key={s[0]}><b>{s[1]}</b><small>{s[2]}</small></button>)}</div><button className="primary big" onClick={runRace}>SIMULER LA COURSE <Flag/></button><button className="cancel" onClick={()=>setRacing(undefined)}>Annuler</button></div></div>}
    {game.lastResult && <ResultToast result={game.lastResult} close={()=>update({...game,lastResult:undefined})}/>} 
  </div>;
}

export function App(){
  const [game,setGame]=useState<GameState|undefined>(()=>loadGame());
  useEffect(()=>{if(game)saveGame(game)},[game]);
  if(!game) return <CreateCareer onCreate={r=>setGame(createGame(r))}/>;
  return <Dashboard game={game} setGame={setGame} onReset={()=>{if(confirm('Supprimer cette carrière et recommencer ?')){deleteSave();setGame(undefined)}}}/>;
}
