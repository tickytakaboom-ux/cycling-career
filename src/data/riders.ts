import type { Rider, RiderProfile, RiderStats } from '../game/models';
import { clamp } from '../game/config';

type NewRiderInput = Pick<Rider,'firstName'|'lastName'|'nationality'|'height'|'weight'|'profile'>;
const base: RiderStats={mountain:43,sprint:43,climbing:43,timeTrial:42,pavement:41,endurance:46,explosiveness:45,recovery:48,descending:43,tactics:39,resistance:44,weather:41};
const bonuses:Record<RiderProfile,Partial<RiderStats>>={grimpeur:{mountain:14,climbing:12,endurance:5,sprint:-6},puncheur:{climbing:8,explosiveness:14,tactics:3},sprinteur:{sprint:16,explosiveness:11,mountain:-8},rouleur:{timeTrial:15,endurance:10,resistance:6},classiqueur:{pavement:15,resistance:9,weather:7},etapes:{mountain:7,climbing:6,timeTrial:7,endurance:8,recovery:5}};

export function createRider(input:NewRiderInput):Rider {
  const stats={...base};
  Object.entries(bonuses[input.profile]).forEach(([key,value])=>stats[key as keyof RiderStats]=clamp(stats[key as keyof RiderStats]+(value??0),32,62));
  return {id:crypto.randomUUID(),...input,age:18,stats,hidden:{potential:82,consistency:68,injuryResistance:72,learning:76,mental:70},form:62,fatigue:10,morale:75,reputation:2,experience:0};
}

const names=[['Milo','Verne'],['Nico','Aerts'],['Luca','Bellini'],['Oscar','Lind'],['Tomas','Kral'],['Sven','Meijer'],['Hugo','Costa'],['Jonas','Falk'],['Enzo','Martin'],['Adam','Nowak'],['Iker','Sola'],['Sam','Bennett'],['Louis','Fabre'],['Marek','Novak'],['Rui','Alves'],['Noah','Schmid'],['Axel','Jans'],['Theo','Mercier'],['Leo','Rossi'],['Felix','Bauer'],['Pablo','Vega'],['Finn','Eriksen'],['Max','Dumont'],['Elias','Voss'],['Robin','Willem'],['David','Kovac'],['Anton','Larsen'],['Mateo','Gil'],['Jan','Vos'],['Ben','Clarke']];
const profiles:RiderProfile[]=['grimpeur','puncheur','sprinteur','rouleur','classiqueur','etapes'];
export const opponents=names.map((name,index)=>{
  const age=20+index%13;
  const rider=createRider({firstName:name[0],lastName:name[1],nationality:'Europe',height:174+index%12,weight:62+index%13,profile:profiles[index%6]});
  const development=7+Math.min(age-20,8)*.9+(index%7);
  Object.keys(rider.stats).forEach(key=>rider.stats[key as keyof RiderStats]=clamp(rider.stats[key as keyof RiderStats]+development,38,82));
  return {...rider,age,experience:(age-18)*180+(index%5)*90,reputation:18+index%24,form:58+index%18,fatigue:8+index%16};
});
