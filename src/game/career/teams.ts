import type { CalendarRace,Race,Team,TeamLevel,Terrain } from '../models';
import { generateWeather } from '../weather/weather';
import {selectTeamMates} from './teamSimulation';

const terrainCycle:Terrain[]=['plaine','vallons','sprint','montagne','chrono','paves'];
const names=['Prix des Rives','Boucles du Bocage','Trophée des Espoirs','Circuit des Deux Vallées','Classique du Littoral','Tour du Haut-Pays','Chrono des Lacs','Flèche des Coteaux','Grand Prix des Flandres','Challenge des Alpes','Coupe de la Frontière','Route des Pins','Mémorial du Vent','Course des Sommets','Classic Europa','Tour de l’Avenir'];
const addDays=(date:string,days:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
export function generateTeamCalendar(team:Team,year=2027):CalendarRace[]{
 return Array.from({length:team.calendarSize},(_,index)=>{
  const terrain=team.specialties.includes('montagne')&&index%3===0?'montagne':team.specialties.includes('pavés')&&index%4===0?'paves':terrainCycle[index%terrainCycle.length];
  const level=Math.min(4,Math.max(1,team.level+(index>team.calendarSize-3?1:0))) as TeamLevel;
  const race:Race={id:`${team.id}-${year}-${index}`,name:names[index%names.length],country:team.country,date:addDays(`${year}-02-01`,7+index*Math.floor(275/team.calendarSize)),terrain,distance:95+level*18+(index%4)*9,elevation:terrain==='montagne'?2200+level*500:terrain==='vallons'?1100+level*280:350+level*180,prestige:12+level*12+(index%5),difficulty:30+level*10+(index%6),competitionLevel:level,maxAltitude:terrain==='montagne'?1350+level*350:300+level*80};
  return {...race,status:'planned',weather:generateWeather(race),selectedTeamMateIds:selectTeamMates(team.roster,{...race,status:'planned'})};
 });
}
export function fieldRange(level:TeamLevel){return ({1:{average:[43,52],best:[53,57]},2:{average:[48,57],best:[58,63]},3:{average:[55,65],best:[66,73]},4:{average:[62,72],best:[73,82]}} as const)[level]}
