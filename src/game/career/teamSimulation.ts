import type {CalendarRace,Rider,RiderStats,TeamMate,TeamRaceResult} from '../models';
import {terrainWeights} from '../config';
import {clamp} from '../config';
import {performance} from '../simulation/raceSimulation';
import type {RandomSource} from '../simulation/random';

const suitability=(mate:TeamMate,race:CalendarRace)=>Object.entries(terrainWeights[race.terrain]).reduce((sum,[key,weight])=>sum+mate.stats[key as keyof RiderStats]*(weight??0),0)+mate.form*.04;
export function selectTeamMates(roster:TeamMate[],race:CalendarRace,count=5){return [...roster].sort((a,b)=>suitability(b,race)-suitability(a,race)).slice(0,count).map(mate=>mate.id)}
const asRider=(mate:TeamMate):Rider=>({id:mate.id,firstName:mate.name.split(' ')[0],lastName:mate.name.split(' ').slice(1).join(' '),nationality:'Europe',age:mate.age,height:178,weight:68,profile:mate.profile,stats:mate.stats,hidden:{potentials:mate.potentials,consistency:65,injuryResistance:70,learning:68,mental:68},form:mate.form,fatigue:12,morale:65,reputation:5,experience:Math.max(0,(mate.age-18)*160)});
export function simulateTeamMates(roster:TeamMate[],selectedIds:string[],race:CalendarRace,field:Rider[],random:RandomSource=Math.random):TeamRaceResult[]{
 const opponentScores=field.map(rider=>performance(rider,race,'normal',random).final);
 return roster.filter(mate=>selectedIds.includes(mate.id)).map(mate=>{const score=performance(asRider(mate),race,'normal',random).final;return {riderId:mate.id,riderName:mate.name,position:1+opponentScores.filter(value=>value>score).length,score:+score.toFixed(1),selected:true}}).sort((a,b)=>a.position-b.position);
}
export function updateTeamMateForms(roster:TeamMate[],selectedIds:string[],difficulty:number){return roster.map(mate=>({...mate,form:clamp(selectedIds.includes(mate.id)?mate.form-difficulty*.018:mate.form+(65-mate.form)*.08,45,82)}))}
