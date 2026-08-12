import type { GameState,RaceStrategy,Rider,TrainingType } from '../game/models';
import { starterTeam } from '../data/teams';
import { raceTemplates } from '../data/races';
import { opponents } from '../data/riders';
import { applyRaceProgression,applyTraining,recoverDay } from '../game/progression/training';
import { simulateRace } from '../game/simulation/raceSimulation';
export const SAVE_KEY='cycling-career-v1';
const iso=(d:Date)=>d.toISOString().slice(0,10);
export function createGame(rider:Rider):GameState{const start=new Date('2027-02-01T12:00:00'); return {gameVersion:1,careerId:crypto.randomUUID(),currentDate:iso(start),rider,team:starterTeam,selectedTraining:'endurance',calendar:raceTemplates.map((r,i)=>({...r,date:iso(new Date(start.getTime()+(i*12+7)*86400000)),status:'planned'}))};}
export function saveGame(game:GameState){localStorage.setItem(SAVE_KEY,JSON.stringify(game))}
export function loadGame():GameState|undefined{try{const raw=localStorage.getItem(SAVE_KEY); if(!raw)return; const game=JSON.parse(raw) as GameState; return game.gameVersion===1?game:undefined}catch{return undefined}}
export function deleteSave(){localStorage.removeItem(SAVE_KEY)}
export function nextDay(game:GameState):GameState{const next=new Date(game.currentDate+'T12:00:00'); next.setDate(next.getDate()+1); const date=iso(next), rider=game.selectedTraining==='recuperation'?applyTraining(game.rider,'recuperation'):recoverDay(game.rider); return {...game,currentDate:date,rider,calendar:game.calendar.map(r=>({...r,status:r.status==='completed'?'completed':r.date<=date?'available':'planned'}))};}
export function train(game:GameState,type:TrainingType):GameState{return {...game,selectedTraining:type,rider:applyTraining(game.rider,type)}}
export function race(game:GameState,raceId:string,strategy:RaceStrategy):GameState{const target=game.calendar.find(r=>r.id===raceId); if(!target||target.status!=='available')return game; const result=simulateRace(game.rider,opponents,target,strategy); return {...game,lastResult:result,rider:applyRaceProgression(game.rider,result.xpGained),calendar:game.calendar.map(r=>r.id===raceId?{...r,status:'completed',result}:r)}}
export function advanceToNextRace(game:GameState):GameState{let next=game.calendar.find(r=>r.status==='planned'); if(!next)return game; const date=next.date; return {...game,currentDate:date,rider:recoverDay(game.rider),calendar:game.calendar.map(r=>({...r,status:r.status==='completed'?'completed':r.date<=date?'available':'planned'}))};}
