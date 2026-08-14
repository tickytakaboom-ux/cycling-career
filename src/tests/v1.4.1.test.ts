import {describe,expect,it} from 'vitest';
import {careerTeams} from '../data/careerTeams';
import {createRider} from '../data/riders';
import {overallRating,profileRatingWeights} from '../game/career/riderRating';
import type {RiderStats} from '../game/models';

const flat=(value:number):RiderStats=>({mountain:value,sprint:value,climbing:value,timeTrial:value,pavement:value,endurance:value,explosiveness:value,recovery:value,descending:value,tactics:value,resistance:value,weather:value});
describe('note générale V1.4.1',()=>{
 it('conserve la valeur d’un coureur uniforme',()=>expect(overallRating(flat(51),'grimpeur')).toBe(51));
 it('pondère davantage la montagne que le sprint pour un grimpeur',()=>{const base=flat(50),mountain=overallRating({...base,mountain:70},'grimpeur'),sprint=overallRating({...base,sprint:70},'grimpeur');expect(mountain-50).toBeGreaterThan(sprint-50)});
 it('adapte la note au profil sportif',()=>{const stats={...flat(45),sprint:70,explosiveness:65,mountain:35};expect(overallRating(stats,'sprinteur')).toBeGreaterThan(overallRating(stats,'grimpeur'))});
 it('utilise des poids positifs et normalisés par le calcul',()=>{for(const weights of Object.values(profileRatingWeights)){expect(Object.values(weights).every(value=>value>0)).toBe(true)}});
 it('calcule les notes des coéquipiers avec la même fonction',()=>{for(const team of careerTeams)for(const mate of team.roster){expect(mate.stats).toBeDefined();expect(mate.level).toBe(overallRating(mate.stats,mate.profile))}});
 it('reste un indicateur dérivé et évolue avec les caractéristiques',()=>{const rider=createRider({firstName:'Julian',lastName:'Stehlin',nationality:'France',height:178,weight:66,profile:'grimpeur'}),before=overallRating(rider.stats,rider.profile),after=overallRating({...rider.stats,mountain:rider.stats.mountain+5},rider.profile);expect(after).toBeGreaterThan(before);expect('level' in rider).toBe(false)});
});
