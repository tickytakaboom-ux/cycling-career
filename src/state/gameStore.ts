import type { CalendarRace, GameState, RaceResult, RaceStrategy, Rider, RiderProfile, TrainingType } from '../game/models';
import { starterTeam } from '../data/teams';
import { raceTemplates } from '../data/races';
import { opponents } from '../data/riders';
import { applyRaceProgression,applyTraining,recoverDay } from '../game/progression/training';
import { simulateRace } from '../game/simulation/raceSimulation';

export const SAVE_KEY='cycling-career-v1';
const GAME_VERSION=2;
const iso=(date:Date)=>date.toISOString().slice(0,10);
const toDate=(date:string)=>new Date(`${date}T12:00:00`);
const addDays=(date:string,days:number)=>{const next=toDate(date);next.setDate(next.getDate()+days);return iso(next)};
const daysBetween=(from:string,to:string)=>Math.max(0,Math.round((+toDate(to)-+toDate(from))/86400000));

function updateStatuses(calendar:CalendarRace[],currentDate:string) {
  return calendar.map(race=>({...race,status:race.status==='completed'?'completed':race.date===currentDate?'available':'planned'} as CalendarRace));
}

function recoverAcrossDays(rider:Rider,days:number) {
  let recovered=rider;
  for(let day=0;day<days;day++) recovered=recoverDay(recovered);
  return recovered;
}

export function createGame(rider:Rider):GameState {
  const start='2027-02-01';
  return {gameVersion:GAME_VERSION,careerId:crypto.randomUUID(),currentDate:start,season:{year:2027,startDate:start,endDate:'2027-12-31',status:'active'},rider,team:starterTeam,selectedTraining:'endurance',calendar:raceTemplates.map((race,index)=>({...race,date:addDays(start,index*12+7),status:'planned'}))};
}

export function saveGame(game:GameState){localStorage.setItem(SAVE_KEY,JSON.stringify(game))}

function migrateResult(result:Partial<RaceResult>|undefined):RaceResult|undefined {
  if(!result)return undefined;
  return {...result,reputationGained:result.reputationGained??.05,strategy:result.strategy??'normal',fatigueCost:result.fatigueCost??16,strategySummary:result.strategySummary??'Plan équilibré.',events:result.events??[]} as RaceResult;
}

function migrateGame(saved:GameState):GameState {
  const profile=(saved.rider.profile as RiderProfile|'complet')==='complet'?'etapes':saved.rider.profile;
  const calendar=saved.calendar.map(race=>({...race,result:migrateResult(race.result)}));
  const earliestUnfinished=calendar.filter(race=>race.status!=='completed').sort((a,b)=>a.date.localeCompare(b.date))[0];
  const currentDate=earliestUnfinished&&earliestUnfinished.date<saved.currentDate?earliestUnfinished.date:saved.currentDate;
  return {...saved,gameVersion:GAME_VERSION,currentDate,season:saved.season??{year:2027,startDate:'2027-02-01',endDate:'2027-12-31',status:'active'},rider:{...saved.rider,profile},calendar:updateStatuses(calendar,currentDate)};
}

export function loadGame():GameState|undefined {
  try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return;return migrateGame(JSON.parse(raw) as GameState)}catch{return undefined}
}

export function deleteSave(){localStorage.removeItem(SAVE_KEY)}

export function nextDay(game:GameState):GameState {
  if(game.calendar.some(race=>race.status==='available'))return game;
  const nextRace=game.calendar.filter(race=>race.status!=='completed'&&race.date>game.currentDate).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const proposed=addDays(game.currentDate,1);
  const currentDate=nextRace&&proposed>nextRace.date?nextRace.date:proposed;
  return {...game,currentDate,rider:recoverDay(game.rider),calendar:updateStatuses(game.calendar,currentDate)};
}

export function train(game:GameState,type:TrainingType):GameState {
  if(game.lastTrainingDate===game.currentDate||game.calendar.some(race=>race.status==='available'))return game;
  return {...game,selectedTraining:type,lastTrainingDate:game.currentDate,rider:applyTraining(game.rider,type)};
}

export function race(game:GameState,raceId:string,strategy:RaceStrategy):GameState {
  const target=game.calendar.find(race=>race.id===raceId);
  if(!target||target.status!=='available'||target.date!==game.currentDate)return game;
  const result=simulateRace(game.rider,opponents,target,strategy);
  const afterRace=applyRaceProgression(game.rider,result,target);
  const currentDate=addDays(game.currentDate,1);
  const calendar=game.calendar.map(race=>race.id===raceId?{...race,status:'completed',result} as CalendarRace:race);
  return {...game,currentDate,lastResult:result,rider:recoverDay(afterRace),calendar:updateStatuses(calendar,currentDate)};
}

export function advanceToNextRace(game:GameState):GameState {
  if(game.calendar.some(race=>race.status==='available'))return game;
  const nextRace=game.calendar.filter(race=>race.status!=='completed'&&race.date>=game.currentDate).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(!nextRace)return game;
  const days=daysBetween(game.currentDate,nextRace.date);
  return {...game,currentDate:nextRace.date,rider:recoverAcrossDays(game.rider,days),calendar:updateStatuses(game.calendar,nextRace.date)};
}
