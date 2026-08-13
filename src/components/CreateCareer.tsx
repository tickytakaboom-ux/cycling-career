import { useState,type FormEvent } from 'react';
import { Bike,ChevronRight } from 'lucide-react';
import { createRider } from '../data/riders';
import type { Rider,RiderProfile } from '../game/models';

const profiles:{id:RiderProfile;name:string;desc:string}[]=[
  {id:'grimpeur',name:'Grimpeur',desc:'Léger et résistant dans les grands cols.'},
  {id:'puncheur',name:'Puncheur',desc:'Explosif sur les reliefs courts.'},
  {id:'sprinteur',name:'Sprinteur',desc:'Puissant dans les arrivées rapides.'},
  {id:'rouleur',name:'Rouleur',desc:'Taillé pour les efforts longs.'},
  {id:'classiqueur',name:'Classiqueur',desc:'Solide sur les pavés et dans le vent.'},
  {id:'etapes',name:'Courses à étapes',desc:'Régulier en montagne, chrono et récupération.'},
];

export function CreateCareer({onCreate}:{onCreate:(r:Rider)=>void}) {
  const [profile,setProfile]=useState<RiderProfile>('etapes');
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    onCreate(createRider({firstName:String(form.get('firstName')),lastName:String(form.get('lastName')),nationality:String(form.get('nationality')),height:Number(form.get('height')),weight:Number(form.get('weight')),profile}));
  };
  return <main className="create"><div className="brand"><Bike/><span>CYCLING / CAREER</span></div><section className="intro"><span className="eyebrow">NOUVELLE CARRIÈRE · SAISON 2027</span><h1>Écrivez votre<br/><i>propre légende.</i></h1><p>À 18 ans, chaque choix façonne votre développement. Chaque course raconte une histoire.</p></section><form onSubmit={submit} className="creator"><div className="form-head"><b>01</b><div><h2>Identité du coureur</h2><p>Tous les nouveaux coureurs débutent à 18 ans.</p></div></div><div className="fields"><label>PRÉNOM<input name="firstName" required defaultValue="Julian"/></label><label>NOM<input name="lastName" required defaultValue="Morel"/></label><label>NATIONALITÉ<input name="nationality" required defaultValue="France"/></label><label>TAILLE (CM)<input name="height" type="number" min="155" max="205" defaultValue="178"/></label><label>POIDS (KG)<input name="weight" type="number" min="48" max="100" defaultValue="66"/></label></div><div className="form-head profile-head"><b>02</b><div><h2>Profil sportif</h2><p>Choisissez vos forces naturelles.</p></div></div><div className="profiles">{profiles.map(item=><button type="button" className={profile===item.id?'selected':''} onClick={()=>setProfile(item.id)} key={item.id}><strong>{item.name}</strong><small>{item.desc}</small></button>)}</div><button className="primary big">COMMENCER LA CARRIÈRE <ChevronRight/></button></form></main>;
}
