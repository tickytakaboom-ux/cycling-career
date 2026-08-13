import type { RaceStrategy, RiderStats, Terrain, TrainingType } from './models';

export const terrainWeights: Record<Terrain, Partial<Record<keyof RiderStats, number>>> = {
  sprint:{sprint:.34,explosiveness:.2,endurance:.13,tactics:.13,resistance:.1,weather:.1},
  plaine:{endurance:.24,sprint:.2,timeTrial:.16,tactics:.14,resistance:.14,weather:.12},
  vallons:{climbing:.22,explosiveness:.22,endurance:.18,tactics:.14,resistance:.14,descending:.1},
  montagne:{mountain:.3,climbing:.2,endurance:.15,resistance:.12,recovery:.08,tactics:.08,descending:.07},
  chrono:{timeTrial:.42,endurance:.2,resistance:.14,tactics:.1,weather:.08,recovery:.06},
  paves:{pavement:.32,resistance:.2,endurance:.16,tactics:.14,weather:.1,explosiveness:.08},
};

export const trainingConfig: Record<TrainingType,{label:string; fatigue:number; form:number; stats:(keyof RiderStats)[]; description:string}> = {
  recuperation:{label:'Récupération',fatigue:-10,form:-.5,stats:[],description:'Réduit la fatigue, sans faire progresser les caractéristiques.'},
  endurance:{label:'Endurance',fatigue:9,form:1.1,stats:['endurance','resistance'],description:'Développe le fond et la résistance aux efforts longs.'},
  montagne:{label:'Montagne',fatigue:12,form:1.3,stats:['mountain','climbing'],description:'Travail exigeant pour les longues ascensions.'},
  sprint:{label:'Sprint',fatigue:10,form:.9,stats:['sprint','explosiveness'],description:'Améliore la vitesse et les accélérations.'},
  explosivite:{label:'Explosivité',fatigue:11,form:1,stats:['explosiveness','climbing'],description:'Travail intense des changements de rythme.'},
  chrono:{label:'Contre-la-montre',fatigue:11,form:1.1,stats:['timeTrial','endurance'],description:'Développe la puissance sur les efforts continus.'},
  technique:{label:'Technique',fatigue:6,form:.5,stats:['descending','tactics','pavement'],description:'Séance légère de pilotage et de placement.'},
};

export const strategyConfig: Record<RaceStrategy,{performance:number; fatigue:number; variance:number; summary:string}> = {
  economiser:{performance:-1.2,fatigue:10,variance:.7,summary:'Effort maîtrisé : moins de fatigue et moins de risques, mais un potentiel de résultat réduit.'},
  normal:{performance:0,fatigue:16,variance:1,summary:'Plan équilibré : effort, risque et dépense énergétique modérés.'},
  agressif:{performance:1.6,fatigue:24,variance:1.45,summary:'Course offensive : davantage de chances de dépasser votre niveau, au prix de fatigue et de risques élevés.'},
};

export const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,n));
