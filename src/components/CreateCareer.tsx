import { useState,type FormEvent } from 'react';
import { Bike,ChevronRight } from 'lucide-react';
import { createRider } from '../data/riders';
import type { Rider,RiderProfile } from '../game/models';

export const creationProfiles:{id:RiderProfile;name:string;desc:string;strengths:string}[]=[
 {id:'grimpeur',name:'Grimpeur',desc:'Spécialiste des ascensions longues.',strengths:'Montagne · Côtes · Endurance · Récupération'},
 {id:'sprinteur',name:'Sprinteur',desc:'Spécialiste des arrivées rapides.',strengths:'Sprint · Explosivité · Endurance'},
 {id:'puncheur',name:'Puncheur',desc:'Excellent sur les efforts courts et les bosses.',strengths:'Côtes · Explosivité · Sprint · Endurance'},
 {id:'rouleur',name:'Rouleur',desc:'Spécialiste de l’effort régulier.',strengths:'Chrono · Endurance · Résistance · Tactique'},
 {id:'baroudeur',name:'Baroudeur',desc:'À l’aise dans les échappées et les courses risquées.',strengths:'Endurance · Résistance · Explosivité · Tactique'},
];
export function CreateCareer({onCreate}:{onCreate:(r:Rider)=>void}){
 const [profile,setProfile]=useState<RiderProfile>('grimpeur');
 const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=new FormData(event.currentTarget);onCreate(createRider({firstName:String(form.get('firstName')),lastName:String(form.get('lastName')),nationality:String(form.get('nationality')),height:Number(form.get('height')),weight:Number(form.get('weight')),profile}))};
 return <main className="create"><div className="brand"><Bike/><span>CYCLING / CAREER</span></div><section className="intro"><span className="eyebrow">NOUVELLE CARRIÈRE · SAISON 2027</span><h1>Écrivez votre<br/><i>propre légende.</i></h1><p>À 18 ans, vos qualités naturelles ouvrent une voie sans vous enfermer. Votre évolution écrira votre spécialité.</p></section><form onSubmit={submit} className="creator"><div className="form-head"><b>01</b><div><h2>Identité du coureur</h2><p>Tous les nouveaux coureurs débutent automatiquement à 18 ans.</p></div></div><div className="fields"><label>PRÉNOM<input name="firstName" required defaultValue="Julian"/></label><label>NOM<input name="lastName" required defaultValue="Stehlin"/></label><label>NATIONALITÉ<input name="nationality" required defaultValue="France"/></label><label>TAILLE (CM)<input name="height" type="number" min="155" max="205" defaultValue="178"/></label><label>POIDS (KG)<input name="weight" type="number" min="48" max="100" defaultValue="66"/></label></div><div className="form-head profile-head"><b>02</b><div><h2>Profil sportif</h2><p>Il influence vos statistiques et potentiels cachés, jamais votre carrière future.</p></div></div><div className="profiles">{creationProfiles.map(item=><button type="button" className={profile===item.id?'selected':''} onClick={()=>setProfile(item.id)} key={item.id}><strong>{item.name}</strong><small>{item.desc}</small><small>{item.strengths}</small></button>)}</div><button className="primary big">DÉCOUVRIR MES OFFRES <ChevronRight/></button></form></main>;
}
