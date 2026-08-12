import { describe,expect,it } from 'vitest';
import { createRider } from '../data/riders';
import { applyTraining } from '../game/progression/training';
import { performance,riderBaseScore,simulateRace } from '../game/simulation/raceSimulation';
import type { Race } from '../game/models';
const race=(terrain:Race['terrain']):Race=>({id:terrain,name:terrain,country:'Test',date:'2027-01-01',terrain,distance:180,elevation:terrain==='montagne'?3500:300,prestige:50,difficulty:60});
const make=(profile:Parameters<typeof createRider>[0]['profile'])=>createRider({firstName:'Test',lastName:'Rider',nationality:'France',age:20,height:178,weight:65,profile});
describe('moteur de simulation',()=>{
 it('favorise le spécialiste adapté au terrain',()=>{expect(riderBaseScore(make('sprinteur'),race('sprint'))).toBeGreaterThan(riderBaseScore(make('grimpeur'),race('sprint'))); expect(riderBaseScore(make('grimpeur'),race('montagne'))).toBeGreaterThan(riderBaseScore(make('sprinteur'),race('montagne')))});
 it('la fatigue réduit la performance',()=>{const fresh=make('complet'),tired={...fresh,fatigue:90}; const fixed=()=>.5; expect(performance(fresh,race('plaine'),'normal',fixed).final).toBeGreaterThan(performance(tired,race('plaine'),'normal',fixed).final)});
 it('la forme améliore la performance',()=>{const rider=make('complet'),low={...rider,form:35},high={...rider,form:90}; const fixed=()=>.5; expect(performance(high,race('plaine'),'normal',fixed).final).toBeGreaterThan(performance(low,race('plaine'),'normal',fixed).final)});
 it('produit un classement valide',()=>{const result=simulateRace(make('complet'),[make('grimpeur'),make('sprinteur')],race('vallons'),'normal',()=>.5); expect(result.position).toBeGreaterThanOrEqual(1);expect(result.position).toBeLessThanOrEqual(3);expect(result.score).toBeGreaterThanOrEqual(1);expect(result.score).toBeLessThanOrEqual(100)});
 it('fait progresser sans dépasser les limites',()=>{let rider=make('sprinteur');for(let i=0;i<500;i++)rider=applyTraining(rider,'sprint');expect(rider.stats.sprint).toBeLessThanOrEqual(100);expect(rider.fatigue).toBeLessThanOrEqual(100)});
});
