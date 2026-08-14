import type { InjurySeverity, RaceStrategy, RiderStats, Terrain, TrainingType } from './models';

export const terrainWeights: Record<Terrain, Partial<Record<keyof RiderStats, number>>> = {
  sprint:{sprint:.34,explosiveness:.2,endurance:.13,tactics:.13,resistance:.1,weather:.1}, plaine:{endurance:.24,sprint:.2,timeTrial:.16,tactics:.14,resistance:.14,weather:.12},
  vallons:{climbing:.22,explosiveness:.22,endurance:.18,tactics:.14,resistance:.14,descending:.1}, montagne:{mountain:.3,climbing:.2,endurance:.15,resistance:.12,recovery:.08,tactics:.08,descending:.07},
  chrono:{timeTrial:.42,endurance:.2,resistance:.14,tactics:.1,weather:.08,recovery:.06}, paves:{pavement:.32,resistance:.2,endurance:.16,tactics:.14,weather:.1,explosiveness:.08},
};

export const trainingConfig: Record<TrainingType,{label:string; fatigue:number; form:number; stats:(keyof RiderStats)[]; specialization:number; light:boolean; description:string}> = {
  recuperation:{label:'Repos',fatigue:0,form:0,stats:[],specialization:0,light:true,description:'Journée sans entraînement : récupération automatique.'},
  endurance:{label:'Endurance légère',fatigue:8,form:-.35,stats:['endurance','resistance'],specialization:1.1,light:true,description:'Développe le fond avec une charge modérée.'},
  montagne:{label:'Montagne',fatigue:14,form:-.75,stats:['mountain','climbing'],specialization:1.15,light:false,description:'Travail exigeant pour les longues ascensions.'},
  sprint:{label:'Sprint',fatigue:12,form:-.65,stats:['sprint','explosiveness'],specialization:1.15,light:false,description:'Améliore la vitesse et les accélérations.'},
  explosivite:{label:'Intensif',fatigue:20,form:-1.15,stats:['explosiveness','climbing'],specialization:1.2,light:false,description:'Travail très intense des changements de rythme.'},
  chrono:{label:'Contre-la-montre',fatigue:15,form:-.8,stats:['timeTrial','endurance'],specialization:1.15,light:false,description:'Développe la puissance sur les efforts continus.'},
  technique:{label:'Pavés et technique',fatigue:14,form:-.55,stats:['pavement','descending','tactics'],specialization:1.1,light:false,description:'Pilotage, placement et adaptation aux pavés.'},
};

export const progressionConfig={baseGain:.19,ageFactors:[{max:20,value:1.15},{max:23,value:1.1},{max:26,value:1},{max:29,value:.9},{max:32,value:.75},{max:100,value:.55}],fatigueFactors:[{max:30,value:1},{max:60,value:.9},{max:80,value:.7},{max:90,value:.4},{max:100,value:.1}],minimumPotentialFactor:.015,experienceFactorMax:.08};
export const fatigueConfig={minimum:3,maximum:100,trainingLimit:98,chronicThreshold:75,chronicMoraleLoss:.45,raceBaseCost:10,distanceCostDivisor:45,difficultyCostDivisor:18};
export const recoveryConfig={base:3,highFatigueBonus:7,recoveryStatDivisor:28,maximumDaily:15};
export const formConfig={minimum:35,maximum:88,restGain:2,highFormThreshold:78,highFormDecay:.25,raceDifficultyLoss:2.8};
export const moraleConfig={neutral:50,minimum:0,maximum:100,performanceRange:.06,trainingGain:.25,restGain:{fresh:.5,moderate:.25},objectiveSuccess:3,objectiveFailure:-2,streakBonus:1.5,streakPenalty:-1.5,injuryLoss:{minor:1,moderate:4,serious:8,severe:14},resultChanges:{win:8,podium:5,top10:2,top20:.8,expected:.2,poor:-2.5}};
export const raceConfig={formImpact:.1,fatigueMaxPenalty:.2,agePenaltyPerYear:1.05,experienceMaxBonus:2.8,experienceScale:1000,prestigeThreshold:35,randomStdDev:3.4,reputationDivisors:{win:16,podium:32,top10:90},xp:{base:8,distanceDivisor:35,prestigeDivisor:10,resultMax:12}};
export const strategyConfig: Record<RaceStrategy,{performance:number; fatigueMultiplier:number; variance:number; injuryMultiplier:number; summary:string}> = {
  economiser:{performance:-1.1,fatigueMultiplier:.72,variance:.7,injuryMultiplier:.75,summary:'Effort maîtrisé : moins de fatigue et de risques, mais un potentiel de résultat réduit.'},
  normal:{performance:0,fatigueMultiplier:1,variance:1,injuryMultiplier:1,summary:'Plan équilibré : effort, risque et dépense énergétique modérés.'},
  agressif:{performance:1.7,fatigueMultiplier:1.35,variance:1.45,injuryMultiplier:1.25,summary:'Course offensive : potentiel supérieur, mais fatigue, variance et risque accrus.'},
};
export const injuryConfig={baseTrainingRisk:.002,baseRaceRisk:.006,fatigueMultipliers:[{max:30,value:1},{max:50,value:1.4},{max:65,value:2.1},{max:75,value:3.2},{max:85,value:5},{max:92,value:8},{max:100,value:12}],overloadMultiplier:1.8,intensiveMultiplier:1.35,lowFormMultiplier:1.25,terrainMultipliers:{sprint:1.15,plaine:1,vallons:1.1,montagne:1.15,chrono:.8,paves:1.65} as Record<Terrain,number>,severityWeights:{minor:.62,moderate:.25,serious:.1,severe:.03},durations:{minor:[1,3],moderate:[4,14],serious:[15,45],severe:[45,130]} as Record<InjurySeverity,[number,number]>,performancePenalties:{minor:.03,moderate:.08,serious:.16,severe:.25} as Record<InjurySeverity,number>};

export const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
