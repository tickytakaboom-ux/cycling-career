import type {RiderProfile,RiderStats} from '../models';
import {clamp} from '../config';

type Weights=Record<keyof RiderStats,number>;
const weights=(values:Weights)=>values;
export const profileRatingWeights:Record<RiderProfile,Weights>={
 grimpeur:weights({mountain:.22,climbing:.18,endurance:.13,resistance:.1,recovery:.09,descending:.06,sprint:.025,pavement:.025,timeTrial:.04,explosiveness:.05,tactics:.06,weather:.04}),
 sprinteur:weights({sprint:.24,explosiveness:.19,endurance:.13,resistance:.1,tactics:.09,timeTrial:.05,mountain:.025,climbing:.035,pavement:.04,recovery:.06,descending:.035,weather:.035}),
 puncheur:weights({climbing:.19,explosiveness:.2,sprint:.13,endurance:.13,resistance:.09,tactics:.09,mountain:.045,timeTrial:.035,pavement:.025,recovery:.05,descending:.035,weather:.025}),
 rouleur:weights({timeTrial:.24,endurance:.18,resistance:.14,tactics:.11,weather:.07,recovery:.07,sprint:.05,explosiveness:.05,mountain:.025,climbing:.035,pavement:.04,descending:.03}),
 baroudeur:weights({endurance:.19,resistance:.17,explosiveness:.13,tactics:.16,recovery:.08,weather:.07,climbing:.06,mountain:.04,sprint:.04,timeTrial:.04,pavement:.03,descending:.03}),
 classiqueur:weights({pavement:.22,resistance:.17,endurance:.15,weather:.11,tactics:.11,explosiveness:.08,sprint:.05,climbing:.03,mountain:.02,timeTrial:.03,recovery:.02,descending:.01}),
 etapes:weights({mountain:.14,climbing:.12,timeTrial:.15,endurance:.16,recovery:.11,resistance:.1,tactics:.07,descending:.04,weather:.03,sprint:.025,explosiveness:.035,pavement:.02}),
};
/** Indicateur d'interface uniquement : aucune simulation ne dépend de cette valeur. */
export function overallRating(stats:RiderStats,profile:RiderProfile){const entries=Object.entries(profileRatingWeights[profile]);const total=entries.reduce((sum,[,weight])=>sum+weight,0);return Math.round(entries.reduce((score,[key,weight])=>score+stats[key as keyof RiderStats]*weight,0)/total)}
const offsets:Record<RiderProfile,Partial<RiderStats>>={grimpeur:{mountain:7,climbing:5,endurance:2,recovery:2,sprint:-7,pavement:-5},sprinteur:{sprint:8,explosiveness:6,endurance:2,mountain:-7,climbing:-5},puncheur:{climbing:5,explosiveness:7,sprint:3,endurance:2,mountain:-2},rouleur:{timeTrial:7,endurance:5,resistance:4,tactics:3,sprint:-2},baroudeur:{endurance:5,resistance:5,explosiveness:3,tactics:5},classiqueur:{pavement:7,resistance:5,weather:4},etapes:{mountain:3,climbing:2,timeTrial:4,endurance:4,recovery:3}};
export function teammateStats(profile:RiderProfile,target:number,index=0):RiderStats{const stats:RiderStats={mountain:target,sprint:target,climbing:target,timeTrial:target,pavement:target,endurance:target,explosiveness:target,recovery:target,descending:target,tactics:target,resistance:target,weather:target};Object.entries(offsets[profile]).forEach(([key,value])=>stats[key as keyof RiderStats]+=value??0);const correction=target-overallRating(stats,profile),variation=index%3-1;Object.keys(stats).forEach((key,statIndex)=>stats[key as keyof RiderStats]=Math.round(clamp(stats[key as keyof RiderStats]+correction+(statIndex%4===0?variation:0),30,85)));return stats}
