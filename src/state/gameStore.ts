import type { CalendarRace, GameState, RaceResult, RaceStrategy, Rider, RiderProfile, RiderStats, TrainingType } from '../game/models';
import { starterTeam } from '../data/teams';
import { raceTemplates } from '../data/races';
import { opponents } from '../data/riders';
import { fatigueConfig, injuryConfig, moraleConfig } from '../game/config';
import { canTrain,healOneDay,rollInjury } from '../game/injuries/injurySystem';
import { applyRaceProgression,applyTraining,recoverDay,trainingAllowed } from '../game/progression/training';
import { simulateRace } from '../game/simulation/raceSimulation';
import type { RandomSource } from '../game/simulation/random';

export const SAVE_KEY='cycling-career-v1';
const GAME_VERSION=3;
const iso=(date:Date)=>date.toISOString().slice(0,10),toDate=(date:string)=>new Date(`${date}T12:00:00`);
const addDays=(date:string,days:number)=>{const next=toDate(date);next.setDate(next.getDate()+days);return iso(next)};
const daysBetween=(from:string,to:string)=>Math.max(0,Math.round((+toDate(to)-+toDate(from))/86400000));

function updateStatuses(calendar:CalendarRace[],currentDate:string) {return calendar.map(race=>({...race,status:race.status==='completed'?'completed':race.date===currentDate?'available':'planned'} as CalendarRace))}
function advanceRiderDay(rider:Rider,rest:boolean) {return healOneDay(rest?recoverDay(rider):rider)}
function recoverAcrossDays(rider:Rider,days:number) {let value=rider;for(let day=0;day<days;day++)value=advanceRiderDay(value,true);return value}

export function createGame(rider:Rider):GameState {
  const start='2027-02-01';
  return {gameVersion:GAME_VERSION,careerId:crypto.randomUUID(),currentDate:start,season:{year:2027,startDate:start,endDate:'2027-12-31',status:'active'},rider,team:starterTeam,selectedTraining:'endurance',calendar:raceTemplates.map((race,index)=>({...race,date:addDays(start,index*12+7),status:'planned'}))};
}
export function saveGame(game:GameState){localStorage.setItem(SAVE_KEY,JSON.stringify(game))}

function defaultPotentials(stats:RiderStats) {const potentials={} as RiderStats;Object.entries(stats).forEach(([key,value])=>potentials[key as keyof RiderStats]=Math.min(96,value+22));return potentials}
function migrateResult(result:Partial<RaceResult>|undefined):RaceResult|undefined {if(!result)return undefined;return {...result,reputationGained:result.reputationGained??.05,moraleChange:result.moraleChange??0,strategy:result.strategy??'normal',fatigueCost:result.fatigueCost??16,strategySummary:result.strategySummary??'Plan équilibré.',events:result.events??[]} as RaceResult}
export function migrateGame(saved:GameState):GameState {
  const profile=(saved.rider.profile as RiderProfile|'complet')==='complet'?'etapes':saved.rider.profile;
  const legacyHidden=saved.rider.hidden as Rider['hidden']&{potential?:number};
  const hidden={...legacyHidden,potentials:legacyHidden.potentials??defaultPotentials(saved.rider.stats)};
  const calendar=saved.calendar.map(race=>({...race,result:migrateResult(race.result)})),earliest=calendar.filter(race=>race.status!=='completed').sort((a,b)=>a.date.localeCompare(b.date))[0];
  const currentDate=earliest&&earliest.date<saved.currentDate?earliest.date:saved.currentDate;
  return {...saved,gameVersion:GAME_VERSION,currentDate,season:saved.season??{year:2027,startDate:'2027-02-01',endDate:'2027-12-31',status:'active'},rider:{...saved.rider,profile,hidden},calendar:updateStatuses(calendar,currentDate)};
}
export function loadGame():GameState|undefined {try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;return migrateGame(JSON.parse(raw) as GameState)}catch{return undefined}}
export function deleteSave(){localStorage.removeItem(SAVE_KEY)}

export function nextDay(game:GameState):GameState {
  if(game.calendar.some(race=>race.status==='available'))return {...game,notice:'Une course est prévue aujourd’hui. Vous devez la disputer avant de continuer.'};
  const currentDate=addDays(game.currentDate,1),rider=advanceRiderDay(game.rider,true);
  return {...game,currentDate,rider,notice:'Journée de repos : fatigue réduite et forme légèrement améliorée.',calendar:updateStatuses(game.calendar,currentDate)};
}

export function trainingBlockReason(game:GameState,type:TrainingType) {
  if(game.calendar.some(race=>race.status==='available'))return 'Une course est prévue aujourd’hui.';
  if(game.lastTrainingDate===game.currentDate)return 'Une activité a déjà été effectuée aujourd’hui.';
  if(!canTrain(game.rider,type))return `Votre blessure (${game.rider.injury?.name}) interdit cette séance.`;
  if(!trainingAllowed(game.rider,type))return `Fatigue trop élevée : cette séance dépasserait le seuil de ${fatigueConfig.trainingLimit}. Le repos est recommandé.`;
  return undefined;
}

export function train(game:GameState,type:TrainingType,random:RandomSource=Math.random):GameState {
  const reason=trainingBlockReason(game,type);if(reason)return {...game,notice:reason};
  const trained=applyTraining(game.rider,type,game.team.trainingQuality/65),injury=rollInjury(trained,game.currentDate,{kind:'training',type},random);
  const morale=injury?Math.max(0,trained.morale-moraleConfig.injuryLoss[injury.severity]):trained.morale;
  const rider=advanceRiderDay({...trained,morale,injury:injury??trained.injury},false),currentDate=addDays(game.currentDate,1);
  return {...game,currentDate,rider,lastTrainingDate:game.currentDate,notice:injury?`Séance terminée, mais ${injury.name} détectée (${injury.daysRemaining} jours).`:`Séance terminée. Fatigue +${trained.fatigue-game.rider.fatigue}; progression enregistrée.`,calendar:updateStatuses(game.calendar,currentDate)};
}

export function race(game:GameState,raceId:string,strategy:RaceStrategy,random:RandomSource=Math.random):GameState {
  const target=game.calendar.find(item=>item.id===raceId);if(!target||target.status!=='available'||target.date!==game.currentDate)return {...game,notice:'Cette course ne peut être disputée qu’à sa date prévue.'};
  const result=simulateRace(game.rider,opponents,target,strategy,random),afterRace=applyRaceProgression(game.rider,result,target),currentDate=addDays(game.currentDate,1);
  const rider=advanceRiderDay(afterRace,false),calendar=game.calendar.map(item=>item.id===raceId?{...item,status:'completed',result} as CalendarRace:item);
  return {...game,currentDate,lastResult:result,rider,notice:result.injury?`Course terminée : ${result.injury.name}.`:'Course terminée.',calendar:updateStatuses(calendar,currentDate)};
}

export function advanceToNextRace(game:GameState):GameState {
  if(game.calendar.some(race=>race.status==='available'))return {...game,notice:'La course du jour doit être disputée.'};
  const nextRace=game.calendar.filter(race=>race.status!=='completed'&&race.date>=game.currentDate).sort((a,b)=>a.date.localeCompare(b.date))[0];if(!nextRace)return game;
  const days=daysBetween(game.currentDate,nextRace.date),rider=recoverAcrossDays(game.rider,days);
  return {...game,currentDate:nextRace.date,rider,notice:`Repos automatique pendant ${days} jour${days>1?'s':''}.`,calendar:updateStatuses(game.calendar,nextRace.date)};
}

export {injuryConfig};
