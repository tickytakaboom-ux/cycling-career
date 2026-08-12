import type { RiderStats, Terrain, TrainingType } from './models';
export const terrainWeights: Record<Terrain, Partial<Record<keyof RiderStats, number>>> = {
 sprint:{sprint:.34,explosiveness:.2,endurance:.13,tactics:.13,resistance:.1,weather:.1}, plaine:{endurance:.24,sprint:.2,timeTrial:.16,tactics:.14,resistance:.14,weather:.12},
 vallons:{climbing:.22,explosiveness:.22,endurance:.18,tactics:.14,resistance:.14,descending:.1}, montagne:{mountain:.3,climbing:.2,endurance:.15,resistance:.12,recovery:.08,tactics:.08,descending:.07},
 chrono:{timeTrial:.42,endurance:.2,resistance:.14,tactics:.1,weather:.08,recovery:.06}, paves:{pavement:.32,resistance:.2,endurance:.16,tactics:.14,weather:.1,explosiveness:.08}
};
export const trainingConfig: Record<TrainingType,{label:string; fatigue:number; form:number; stats:(keyof RiderStats)[]}> = {
 recuperation:{label:'Récupération',fatigue:-14,form:2,stats:['recovery']}, endurance:{label:'Endurance',fatigue:8,form:2,stats:['endurance','resistance']}, montagne:{label:'Montagne',fatigue:11,form:3,stats:['mountain','climbing']}, sprint:{label:'Sprint',fatigue:9,form:2,stats:['sprint','explosiveness']}, explosivite:{label:'Explosivité',fatigue:10,form:2,stats:['explosiveness','climbing']}, chrono:{label:'Contre-la-montre',fatigue:10,form:3,stats:['timeTrial','endurance']}, technique:{label:'Technique',fatigue:5,form:1,stats:['descending','tactics','pavement']}
};
export const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
