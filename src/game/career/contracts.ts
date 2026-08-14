import { careerTeams,teamById } from '../../data/careerTeams';
import type { Contract,ContractObjective,ContractOffer,Rider,Team } from '../models';

const objectives=(team:Team):ContractObjective[]=>[
 {id:'races',label:`Participer à ${Math.min(10,team.calendarSize)} courses`,type:'races',target:Math.min(10,team.calendarSize),progress:0,status:'active'},
 {id:'top20',label:`Obtenir ${team.level+1} top 20`,type:'top20',target:team.level+1,progress:0,status:'active'},
 {id:'reputation',label:`Atteindre ${3+team.level} de réputation`,type:'reputation',target:3+team.level,progress:0,status:'active'},
];
export function contractFor(team:Team,year:number):Contract{return {id:`contract-${team.id}-${year}`,teamId:team.id,startYear:year,durationYears:1,monthlySalary:300+team.level*200+team.prestige*4,role:team.level>=3?'Équipier':'Jeune espoir',calendarDescription:`${team.calendarSize} courses ${team.level===1?'régionales et nationales':team.level===2?'nationales, avec quelques rendez-vous internationaux':'principalement internationales'}`,opponentDescription:team.level===1?'Peloton accessible':team.level===2?'Peloton national compétitif':'Peloton international relevé',developmentRating:team.trainingQuality>=68?'Excellent':team.trainingQuality>=60?'Très bon':'Correct',objectives:objectives(team)}}
export function generateOffers(rider:Rider,year=2027):ContractOffer[]{
 const eligible=rider.reputation>=12?[careerTeams[2],careerTeams[4],careerTeams[5]]:rider.reputation>=6?[careerTeams[1],careerTeams[2],careerTeams[3]]:careerTeams.slice(0,3);
 return eligible.map(team=>({id:`offer-${team.id}-${year}`,teamId:team.id,contract:contractFor(team,year),interestScore:Math.round(45+rider.reputation*2+team.trainingQuality/5-team.level*5)}));
}
export function resolveOffer(offer:ContractOffer){const team=teamById(offer.teamId);if(!team)throw new Error('Équipe introuvable');return {team,contract:offer.contract}}
