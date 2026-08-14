import type {RiderProfile,RiderStats,TeamMate,TeamRole} from '../models';
import {clamp} from '../config';
import {overallRating,profileRatingWeights} from './riderRating';

const profiles:RiderProfile[]=['grimpeur','puncheur','sprinteur','rouleur','baroudeur'];
const firstNames=['Émile','Noé','Mathis','Léo','Hugo','Arthur','Louis','Tom','Milan','Sacha','Nils','Pablo','Enzo','Jonas','Rui','Oscar'];
const lastNames=['Laurent','Bernard','Roy','Fontaine','Petit','Muller','Chevalier','Janssen','Moreau','Lind','Costa','Martin','Voss','Aerts','Rossi','Falk'];
const hash=(text:string)=>{let value=2166136261;for(const char of text)value=Math.imul(value^char.charCodeAt(0),16777619);return value>>>0};
const randomSource=(seed:string)=>{let state=hash(seed)||1;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296}};
const statKeys=Object.keys(profileRatingWeights.grimpeur) as (keyof RiderStats)[];
export function generateTeamMate(teamId:string,teamLevel:number,average:number,index:number,year=2027):TeamMate{
 const random=randomSource(`${teamId}-${year}-${index}`),profile=profiles[Math.floor(random()*profiles.length)],age=18+Math.floor(random()*17);
 const development=age<=22?(age-18)*.55:age<=29?2.5:Math.max(-2,2.5-(age-29)*.55),target=clamp(average+development+(random()-.5)*7+teamLevel*.3,38,78);
 const weights=profileRatingWeights[profile],stats={} as RiderStats;
 statKeys.forEach(key=>{const specialization=(weights[key]-.075)*34,variation=(random()-.5)*7;stats[key]=Math.round(clamp(target+specialization+variation,30,85))});
 const correction=target-overallRating(stats,profile);statKeys.forEach(key=>stats[key]=Math.round(clamp(stats[key]+correction,30,85)));
 const potentials={} as RiderStats;statKeys.forEach(key=>potentials[key]=Math.round(clamp(stats[key]+5+random()*Math.max(5,18-(age-18)*.55)+(weights[key]>.12?3:0),stats[key],94)));
 const level=overallRating(stats,profile),role:TeamRole=level>=average+5?'Leader':level>=average+2?'Coureur protégé':age<=21?'Jeune espoir':'Équipier';
 return {id:`${teamId}-${year}-${index}-${hash(`${teamId}-${index}`)}`,name:`${firstNames[(index+Math.floor(random()*8))%firstNames.length]} ${lastNames[(index*3+Math.floor(random()*8))%lastNames.length]}`,age,profile,stats,potentials,level,role,form:55+Math.round(random()*20),seasonsWithTeam:0};
}
export function generateRoster(teamId:string,teamLevel:number,average:number,year=2027,size=8){return Array.from({length:size},(_,index)=>generateTeamMate(teamId,teamLevel,average,index,year))}
