import type { Injury, InjurySeverity, RaceStrategy, Rider, Terrain, TrainingType } from '../models';
import { clamp, injuryConfig, strategyConfig, trainingConfig } from '../config';
import type { RandomSource } from '../simulation/random';

const restrictions:Record<InjurySeverity,Injury['trainingRestriction']>={minor:'light-only',moderate:'blocked',serious:'blocked',severe:'blocked'};
const names:Record<InjurySeverity,string>={minor:'Contusion légère',moderate:'Douleur musculaire',serious:'Lésion musculaire',severe:'Fracture'};
const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return value.toISOString().slice(0,10)};
const factorFor=(fatigue:number)=>injuryConfig.fatigueMultipliers.find(item=>fatigue<=item.max)?.value??1;

export function canTrain(rider:Rider,type:TrainingType) {
  if(!rider.injury)return true;
  if(rider.injury.trainingRestriction==='blocked')return false;
  return trainingConfig[type].light;
}

type InjuryContext={kind:'training';type:TrainingType}|{kind:'race';terrain:Terrain;strategy:RaceStrategy};

export function injuryRisk(rider:Rider,context:InjuryContext) {
  const base=context.kind==='training'?injuryConfig.baseTrainingRisk:injuryConfig.baseRaceRisk;
  const fatigue=factorFor(rider.fatigue);
  const overload=context.kind==='training'&&!trainingConfig[context.type].light?injuryConfig.overloadMultiplier:1;
  const intensive=context.kind==='training'&&context.type==='explosivite'?injuryConfig.intensiveMultiplier:1;
  const terrain=context.kind==='race'?injuryConfig.terrainMultipliers[context.terrain]:1;
  const strategy=context.kind==='race'?strategyConfig[context.strategy].injuryMultiplier:1;
  const lowForm=rider.form<50?injuryConfig.lowFormMultiplier:1;
  const resistance=clamp(1-(rider.hidden.injuryResistance-50)/180,.65,1.15);
  return clamp(base*fatigue*overload*intensive*terrain*strategy*lowForm*resistance,0,.25);
}

export function rollInjury(rider:Rider,date:string,context:InjuryContext,random:RandomSource=Math.random):Injury|undefined {
  if(rider.injury||random()>=injuryRisk(rider,context))return undefined;
  const roll=random();let severity:InjurySeverity='minor';let cumulative=0;
  for(const [candidate,weight] of Object.entries(injuryConfig.severityWeights) as [InjurySeverity,number][]) {cumulative+=weight;if(roll<=cumulative){severity=candidate;break}}
  const [minimum,maximum]=injuryConfig.durations[severity];
  const duration=Math.round(minimum+random()*(maximum-minimum));
  return {id:`injury-${date}-${severity}`,name:names[severity],severity,startDate:date,endDate:addDays(date,duration),daysRemaining:duration,trainingRestriction:restrictions[severity],performancePenalty:injuryConfig.performancePenalties[severity]};
}

export function healOneDay(rider:Rider):Rider {
  if(!rider.injury)return rider;
  const daysRemaining=rider.injury.daysRemaining-1;
  return daysRemaining<=0?{...rider,injury:undefined}:{...rider,injury:{...rider.injury,daysRemaining}};
}
