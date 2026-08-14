import type { Team,TeamLevel,TeamMate,RiderProfile } from '../game/models';

const profiles:RiderProfile[]=['grimpeur','puncheur','sprinteur','rouleur','baroudeur'];
const names=['Émile Laurent','Noé Bernard','Mathis Roy','Léo Fontaine','Hugo Petit','Arthur Muller','Louis Chevalier','Tom Janssen'];
function roster(teamId:string,average:number):TeamMate[]{return names.map((name,index)=>({id:`${teamId}-${index}`,name,age:19+(index*3)%15,profile:profiles[index%profiles.length],level:average-4+(index%5)*2,role:index===0?'Leader':index<3?'Coureur protégé':'Équipier'}))}
function team(id:string,name:string,country:string,level:TeamLevel,prestige:number,training:number,medical:number,recovery:number,specialties:string[],size:number,average:number,color:string):Team{return {id,name,country,level,prestige,budget:level*180000,staffQuality:Math.round((training+medical+recovery)/3),trainingQuality:training,medicalQuality:medical,recoveryQuality:recovery,specialties,calendarSize:size,averageRiderLevel:average,color,roster:roster(id,average)}}
export const careerTeams:Team[]=[
 team('horizon-idf','Team Horizon Île-de-France','France',1,18,58,50,55,['endurance','jeunes coureurs'],12,48,'#c9ff3d'),
 team('armorique-avenir','Armorique Avenir','France',1,22,54,58,60,['baroudeurs','récupération'],12,49,'#66d9ef'),
 team('montagne-alpes','Structure Montagne Alpes','France',2,31,68,57,63,['montagne','développement'],14,53,'#ff9f43'),
 team('continental-nord','Continental Nord','Belgique',2,36,61,65,59,['pavés','sprint'],15,54,'#74b9ff'),
 team('iberia-proyecto','Iberia Proyecto','Espagne',3,49,70,69,66,['vallons','international'],17,59,'#ff7675'),
 team('aurora-cycling','Aurora Cycling','Danemark',4,72,79,82,78,['chrono','haut niveau'],19,67,'#a29bfe'),
];
export const teamById=(id:string)=>careerTeams.find(team=>team.id===id);
