"use client";
import { useEffect, useState, useRef } from "react";
import { Heart, MessageSquare, MapPin, Clock, Search, X, CheckCircle, User, AlertTriangle, ChevronRight, ChevronLeft, RefreshCw, ExternalLink, Phone, Flame, Shield, Activity, Trash2, Ban } from "lucide-react";
import SentinelShell from "@/components/SentinelShell";
import { eawsApi } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Post { id:string; title:string; description:string; category:string; severity:string; location_name:string; latitude:number; longitude:number; created_at:string; is_verified:boolean; likes?:number; isLiked?:boolean; isAlarmed?:boolean; isConcerned?:boolean; alarmed?:number; concerned?:number; comments_count?:number; incident_media?:{file_url:string;media_type:string}[]; reporter_profile?:{full_name:string;user_role:string;operator_code?:string}|null; reporter_id?:string; }
interface Citizen { user_id:string; full_name:string; phone:string; user_role:string; operator_code:string; is_approved:boolean; }
interface Comment { id:string; user_id:string; content:string; created_at:string; user_profile?:{full_name:string;user_role:string;operator_code?:string}|null; }

const SEV:Record<string,string> = { CRITICAL:"text-red-400 bg-red-500/10 border-red-500/25", WARNING:"text-orange-400 bg-orange-500/10 border-orange-500/25", HIGH:"text-orange-400 bg-orange-500/10 border-orange-500/25", MEDIUM:"text-yellow-400 bg-yellow-500/10 border-yellow-500/25", LOW:"text-green-400 bg-green-500/10 border-green-500/25" };
const CATS = ["All","Fire","Medical","Crime","Accident","Other"];
const PHOTOS = ["https://images.unsplash.com/photo-1599733589046-9b8308b5b50d?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1610296669228-602fa827fc1f?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=600&auto=format&fit=crop"];
const darkStyle = [{elementType:"geometry",stylers:[{color:"#18181a"}]},{elementType:"labels.icon",stylers:[{visibility:"off"}]},{elementType:"labels.text.fill",stylers:[{color:"#7b7b7f"}]},{elementType:"labels.text.stroke",stylers:[{color:"#18181a"}]},{featureType:"road",elementType:"geometry.fill",stylers:[{color:"#242426"}]},{featureType:"road",elementType:"labels.text.fill",stylers:[{color:"#8a8a8f"}]},{featureType:"water",elementType:"geometry",stylers:[{color:"#000000"}]}];

function timeAgo(iso:string){const d=Math.floor((Date.now()-new Date(iso).getTime())/1000);if(d<60)return`${d}s ago`;if(d<3600)return`${Math.floor(d/60)}m ago`;if(d<86400)return`${Math.floor(d/3600)}h ago`;return new Date(iso).toLocaleDateString();}
function photo(p:Post){const m=p.incident_media?.find(x=>x.media_type==="image");if(m?.file_url)return m.file_url;const h=p.id.split("").reduce((a,c)=>a+c.charCodeAt(0),0);return PHOTOS[h%PHOTOS.length];}

// ── Compact Post Card ──────────────────────────────────────────────────────────
function PostCard({post,active,onClick}:{post:Post;active:boolean;onClick:()=>void}){
  const name=post.reporter_profile?.full_name||"Citizen Reporter";
  const initials=name.split(" ").map((w:string)=>w[0]).slice(0,2).join("").toUpperCase();
  return(
    <button onClick={onClick} className={`w-full text-left rounded-xl border transition-all overflow-hidden ${active?"border-red-500/40 bg-[#1a1212]":"border-white/[0.06] bg-[#111111] hover:border-white/10"}`}>
      <img src={photo(post)} alt="" className="w-full h-28 object-cover" onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-white font-bold text-[12px] leading-snug line-clamp-2">{post.title}</p>
          <span className={`text-[9px] font-bold border rounded-full px-2 py-0.5 flex-shrink-0 ${SEV[post.severity]||SEV.LOW}`}>{post.severity}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mb-2">
          <div className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">{initials}</div>
          <span className="truncate">{name}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-neutral-600">
          <span className="flex items-center gap-1"><MapPin size={9}/><span className="truncate">{post.location_name}</span></span>
          <span className="ml-auto flex-shrink-0">{timeAgo(post.created_at)}</span>
        </div>
      </div>
      {active&&<div className="px-3 pb-3"><div className="text-[10px] text-red-400 font-bold flex items-center gap-1"><MapPin size={10}/> Pinned on map</div></div>}
    </button>
  );
}

// ── Per-citizen mock medical/contacts data ──────────────────────────────────────
const CITIZEN_DATA: Record<string, { blood_type: string; allergies: string; chronic_conditions: string; medications: string; emergency_contacts: { name: string; relation: string; phone: string }[] }> = {
  "c-001": { blood_type: "O+", allergies: "Penicillin", chronic_conditions: "Asthma, Hypertension", medications: "Salbutamol", emergency_contacts: [{ name: "Ama Harrison", relation: "Spouse", phone: "+233 20 111 2233" }, { name: "Kwame Harrison", relation: "Brother", phone: "+233 24 555 7788" }] },
  "c-002": { blood_type: "A+", allergies: "Sulfonamides", chronic_conditions: "Diabetes Type 2", medications: "Metformin", emergency_contacts: [{ name: "Kofi Boateng", relation: "Father", phone: "+233 20 111 2244" }, { name: "Yaa Boateng", relation: "Mother", phone: "+233 20 111 2255" }] },
  "c-003": { blood_type: "B-", allergies: "None", chronic_conditions: "None", medications: "None", emergency_contacts: [{ name: "Ekow Asante", relation: "Uncle", phone: "+233 24 555 7799" }] },
  "c-004": { blood_type: "O-", allergies: "Aspirin", chronic_conditions: "Epilepsy", medications: "Sodium Valproate", emergency_contacts: [{ name: "Adwoa Mensah", relation: "Sister", phone: "+233 50 909 1011" }] },
  "c-005": { blood_type: "AB+", allergies: "Peanuts", chronic_conditions: "Asthma", medications: "Albuterol Inhaler", emergency_contacts: [{ name: "Yaw Osei-Bonsu", relation: "Husband", phone: "+233 27 456 8802" }] },
};

function resolveCitizenData(citizen: Citizen) {
  // Direct key match
  if (CITIZEN_DATA[citizen.user_id]) return CITIZEN_DATA[citizen.user_id];
  // Match by name
  const nameKey = Object.keys(CITIZEN_DATA).find(k => {
    const names: Record<string, string> = { "c-001": "harrison", "c-002": "ama", "c-003": "kwame", "c-004": "nana", "c-005": "abena" };
    return citizen.full_name.toLowerCase().includes(names[k] || "");
  });
  if (nameKey) return CITIZEN_DATA[nameKey];
  // Fallback
  return { blood_type: "Unknown", allergies: "Unknown", chronic_conditions: "Unknown", medications: "Unknown", emergency_contacts: [] };
}

// ── Inline Citizen Profile ─────────────────────────────────────────────────────
function InlineProfile({citizen,onBack}:{citizen:Citizen;onBack:()=>void}){
  const initials=citizen.full_name.split(" ").map((w:string)=>w[0]).slice(0,2).join("").toUpperCase();
  const med = resolveCitizenData(citizen);
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<{sender:string;text:string;time:string}[]>([]);
  const [newMsg, setNewMsg] = useState("");

  return(
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 border-b border-white/[0.05]">
        <button onClick={onBack} className="p-1.5 rounded-lg bg-neutral-900 border border-white/[0.06] text-neutral-400 hover:text-white transition-colors"><ChevronLeft size={14}/></button>
        <div><p className="text-white font-bold text-[13px]">Citizen Profile</p><p className="text-[10px] text-neutral-500">Identity & medical record</p></div>
      </div>

      {/* Chat Drawer — slides over the profile when open */}
      {chatOpen ? (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 p-3 border-b border-white/[0.05] bg-[#151515]">
            <button onClick={()=>setChatOpen(false)} className="p-1.5 rounded-lg bg-neutral-900 border border-white/[0.06] text-neutral-400 hover:text-white transition-colors"><ChevronLeft size={14}/></button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center font-bold text-[10px] text-white">{initials}</div>
              <div><p className="text-white font-bold text-[12px]">{citizen.full_name}</p><p className="text-[9px] text-green-400">Online</p></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 flex flex-col">
            {msgs.length===0 && <div className="flex-1 flex items-center justify-center"><p className="text-neutral-600 text-[11px] text-center">No messages yet. Send a message to start communication.</p></div>}
            {msgs.map((m,i)=>(
              <div key={i} className={`flex flex-col max-w-[85%] ${m.sender==="operator"?"ml-auto items-end":"mr-auto items-start"}`}>
                <div className={`p-2.5 rounded-2xl text-[11px] leading-relaxed ${m.sender==="operator"?"bg-red-600 text-white rounded-br-none":"bg-neutral-800 text-neutral-200 rounded-bl-none"}`}>{m.text}</div>
                <span className="text-[8px] text-neutral-600 mt-0.5">{m.time}</span>
              </div>
            ))}
          </div>
          <form onSubmit={e=>{e.preventDefault();if(!newMsg.trim())return;setMsgs(p=>[...p,{sender:"operator",text:newMsg,time:"Just now"}]);setNewMsg("");setTimeout(()=>{setMsgs(p=>[...p,{sender:"citizen",text:"Received. Standing by for instructions.",time:"Just now"}]);},1500);}} className="p-3 border-t border-white/[0.05] flex gap-2">
            <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} placeholder="Type message..." className="flex-1 bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[11px] text-white placeholder-neutral-600 focus:outline-none focus:border-red-500/50"/>
            <button type="submit" className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-colors"><MessageSquare size={13}/></button>
          </form>
        </div>
      ) : (

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Identity */}
        <div className="bg-[#151515] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border-2 border-neutral-700 flex items-center justify-center font-black text-base text-white">{initials}</div>
            <div>
              <p className="text-white font-black text-base leading-none">{citizen.full_name}</p>
              <p className="text-[10px] text-neutral-500 mt-1 flex items-center gap-1">{citizen.is_approved?<CheckCircle size={10} className="text-green-400"/>:<AlertTriangle size={10} className="text-yellow-400"/>}{citizen.is_approved?"Verified":"Pending"}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {[["Citizen ID",citizen.operator_code],["Phone",citizen.phone],["Role",citizen.user_role]].map(([l,v])=>(
              <div key={l} className="bg-[#111111] rounded-lg p-2.5"><p className="text-[9px] font-bold tracking-widest text-neutral-600 uppercase mb-1">{l}</p><p className="text-[12px] font-semibold text-white">{v||"N/A"}</p></div>
            ))}
          </div>
        </div>
        {/* Medical */}
        <div className="bg-[#151515] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[11px] font-bold text-neutral-300 mb-2">Medical Profile</p>
          <div className="grid grid-cols-2 gap-2">
            {[["Blood Type",med.blood_type],["Allergies",med.allergies],["Conditions",med.chronic_conditions],["Medications",med.medications]].map(([l,v])=>(
              <div key={l} className="bg-[#111111] rounded-lg p-2.5"><p className="text-[9px] font-bold tracking-widest text-neutral-600 uppercase mb-1">{l}</p><p className="text-[11px] font-semibold text-white">{v}</p></div>
            ))}
          </div>
        </div>
        {/* Emergency Contacts */}
        <div className="bg-[#151515] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[11px] font-bold text-neutral-300 mb-2">Emergency Contacts</p>
          <div className="space-y-2">
            {med.emergency_contacts.length === 0 ? (
              <p className="text-neutral-600 text-[11px] italic py-2">No emergency contacts registered</p>
            ) : med.emergency_contacts.map(c=>(
              <div key={c.name} className="flex items-center justify-between bg-[#111111] rounded-lg p-2.5">
                <div><p className="text-[12px] font-semibold text-white">{c.name}</p><p className="text-[10px] text-neutral-500">{c.relation}</p></div>
                <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 hover:text-white transition-colors"><Phone size={10}/>{c.phone}</a>
              </div>
            ))}
          </div>
        </div>
        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={()=>setChatOpen(true)} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"><MessageSquare size={12}/>Message</button>
          <a href={`/citizen?id=${encodeURIComponent(citizen.user_id)}`} className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 border border-white/[0.08]"><ExternalLink size={12}/>Full Profile</a>
        </div>
      </div>
      )}
    </div>
  );
}
// ── Post Detail Modal (mirrors mobile ReactionsCommentsScreen) ─────────────────
// ── Post Detail Modal (mirrors mobile ReactionsCommentsScreen) ─────────────────
function PostDetailModal({post,onClose,onUpdate,userRole,onDeletePost,onBlockUser}:{post:Post;onClose:()=>void;onUpdate:(p:Post)=>void;userRole:string;onDeletePost:(id:string)=>void;onBlockUser:(userId:string)=>void}){
  const [comments,setComments]=useState<Comment[]>([]);
  const [loadingComments,setLoadingComments]=useState(true);
  const [commentText,setCommentText]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [local,setLocal]=useState<Post>({...post});
  const commentsEndRef=useRef<HTMLDivElement>(null);

  const name=local.reporter_profile?.full_name||'Citizen Reporter';
  const initials=name.split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase();
  const imgSrc=(()=>{const m=local.incident_media?.find(x=>x.media_type==='image');if(m?.file_url)return m.file_url;const h=local.id.split('').reduce((a,c)=>a+c.charCodeAt(0),0);return PHOTOS[h%PHOTOS.length];})();
  const isOperator = ['dispatcher', 'police', 'fire', 'ambulance', 'admin'].includes(userRole);

  useEffect(()=>{
    let cancelled=false;
    setLoadingComments(true);
    eawsApi.getComments(local.id).then(data=>{if(!cancelled)setComments(data||[]);}).catch(()=>{}).finally(()=>{if(!cancelled)setLoadingComments(false);});
    return()=>{cancelled=true;};
  },[local.id]);

  useEffect(()=>{commentsEndRef.current?.scrollIntoView({behavior:'smooth'});},[comments]);

  async function react(type:'like'|'alarmed'|'concerned'){
    const key=type==='like'?'isLiked':type==='alarmed'?'isAlarmed':'isConcerned';
    const countKey=type==='like'?'likes':type==='alarmed'?'alarmed':'concerned';
    const was=!!(local as any)[key];
    const updated={...local,[key]:!was,[countKey]:Math.max(0,((local as any)[countKey]??0)+(was?-1:1))};
    setLocal(updated);onUpdate(updated);
    eawsApi.reactToIncident(local.id,type).catch(()=>{});
  }

  async function submitComment(e:React.FormEvent){
    e.preventDefault();
    if(!commentText.trim()||submitting)return;
    setSubmitting(true);
    try{
      const c=await eawsApi.addComment(local.id,commentText.trim());
      setComments(prev=>[...prev,{...c,user_profile:c.user_profile||{full_name:'You',user_role:'operator'}}]);
      const updated={...local,comments_count:(local.comments_count??0)+1};
      setLocal(updated);onUpdate(updated);
      setCommentText('');
    }catch{}
    setSubmitting(false);
  }

  async function handleDelete(){
    if(!window.confirm("Are you sure you want to delete/remove this incident report? It will be removed immediately.")) return;
    try{
      await eawsApi.deleteIncident(local.id);
      onDeletePost(local.id);
      onClose();
    }catch(err:any){
      alert("Failed to delete post: " + (err.message || err));
    }
  }

  async function handleBlock(){
    if(!local.reporter_id) return;
    if(!window.confirm(`Are you sure you want to block ${name} from using the EAWS platform? This will suspend their profile and remove their reports.`)) return;
    try{
      await eawsApi.blockUser(local.reporter_id);
      onBlockUser(local.reporter_id);
      onClose();
    }catch(err:any){
      alert("Failed to block user: " + (err.message || err));
    }
  }

  function roleBadge(role?:string){
    if(!role||role==='citizen')return null;
    const colors:Record<string,string>={dispatcher:'bg-red-500/20 text-red-400',police:'bg-blue-500/20 text-blue-400',fire:'bg-orange-500/20 text-orange-400',ambulance:'bg-green-500/20 text-green-400',admin:'bg-purple-500/20 text-purple-400'};
    return<span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${colors[role]||'bg-neutral-700 text-neutral-300'}`}>{role}</span>;
  }

  function timeAgoC(iso:string){const d=Math.floor((Date.now()-new Date(iso).getTime())/1000);if(d<60)return`${d}s ago`;if(d<3600)return`${Math.floor(d/60)}m ago`;if(d<86400)return`${Math.floor(d/3600)}h ago`;return new Date(iso).toLocaleDateString();}

  return(
    <div className="fixed inset-0 z-50 flex items-end justify-end" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
      <div className="relative z-10 w-full max-w-2xl h-full flex flex-col bg-[#0d0d0d] border-l border-white/[0.07] shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06] flex-shrink-0">
          <button onClick={onClose} className="p-2 rounded-xl bg-neutral-900 border border-white/[0.08] text-neutral-400 hover:text-white transition-colors"><X size={15}/></button>
          {isOperator && (
            <button onClick={handleDelete} className="p-2 rounded-xl bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-950/60 hover:text-red-300 transition-colors flex items-center gap-1.5" title="Delete Post"><Trash2 size={13}/> <span className="text-[11px] font-bold">Delete Post</span></button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{local.title}</p>
            <p className="text-[11px] text-neutral-500">Incident Report · {timeAgo(local.created_at)}</p>
          </div>
          <span className={`text-[10px] font-bold border rounded-full px-2.5 py-1 flex-shrink-0 ${SEV[local.severity]||SEV.LOW}`}>{local.severity}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Media */}
          <div className="relative h-52 w-full bg-neutral-950 flex-shrink-0 overflow-hidden">
            <img src={imgSrc} alt="" className="w-full h-full object-cover opacity-90" onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"/>
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border-2 border-white/20 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{initials}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-[12px]">{name}</p>
                    {isOperator && local.reporter_profile?.user_role !== 'dispatcher' && local.reporter_profile?.user_role !== 'operator' && local.reporter_id && (
                      <button onClick={handleBlock} className="px-1.5 py-0.5 rounded bg-red-950/50 border border-red-500/20 text-red-400 hover:bg-red-950/80 hover:text-red-300 text-[9px] font-bold transition-colors flex items-center gap-0.5"><Ban size={8}/> Block</button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">{roleBadge(local.reporter_profile?.user_role)}{local.is_verified&&<span className="text-[9px] text-green-400 font-bold flex items-center gap-0.5"><CheckCircle size={9}/>Verified</span>}</div>
                </div>
              </div>
              <span className={`text-[9px] font-bold border rounded-lg px-2 py-1 ${local.category==='fire'?'text-orange-400 bg-orange-500/20 border-orange-500/30':local.category==='medical'?'text-blue-400 bg-blue-500/20 border-blue-500/30':'text-red-400 bg-red-500/20 border-red-500/30'}`}>{local.category.toUpperCase()}</span>
            </div>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.05]">
            <MapPin size={13} className="text-red-400 flex-shrink-0"/>
            <p className="text-[12px] text-neutral-400">{local.location_name}</p>
            <span className="ml-auto text-[11px] text-neutral-600">{timeAgo(local.created_at)}</span>
          </div>

          {/* Description */}
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <p className="text-[11px] font-bold tracking-wider text-neutral-600 uppercase mb-2">Description</p>
            <p className="text-neutral-300 text-[13px] leading-relaxed">{local.description||'No further details provided.'}</p>
          </div>

          {/* Reactions */}
          <div className="px-5 py-4 border-b border-white/[0.05]">
            <p className="text-[11px] font-bold tracking-wider text-neutral-600 uppercase mb-3">Reactions</p>
            <div className="grid grid-cols-3 gap-2">
              {([['like','❤️','Support',local.likes??0,local.isLiked,'red'],['alarmed','⚠️','Alarmed',local.alarmed??0,local.isAlarmed,'orange'],['concerned','💙','Concerned',local.concerned??0,local.isConcerned,'blue']] as [string,string,string,number,boolean|undefined,string][]).map(([type,emoji,label,count,active,color])=>(
                <button key={type} onClick={()=>react(type as 'like'|'alarmed'|'concerned')}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${active?`bg-${color}-500/20 border-${color}-500/40 shadow-lg shadow-${color}-500/10`:'bg-[#151515] border-white/[0.06] hover:border-white/20'}`}>
                  <span className="text-xl">{emoji}</span>
                  <span className={`text-xs font-bold ${active?`text-${color}-400`:'text-neutral-300'}`}>{count} {label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div className="px-5 py-4">
            <p className="text-[11px] font-bold tracking-wider text-neutral-600 uppercase mb-3">Comments ({local.comments_count??comments.length})</p>
            {loadingComments?(
              <div className="space-y-3">{Array.from({length:2}).map((_,i)=><div key={i} className="h-16 rounded-xl bg-[#151515] animate-pulse"/>)}</div>
            ):comments.length===0?(
              <div className="py-10 text-center">
                <MessageSquare size={36} className="text-neutral-800 mx-auto mb-3"/>
                <p className="text-neutral-600 text-[12px]">No comments yet. Be the first to share an update.</p>
              </div>
            ):(
              <div className="space-y-3">
                {comments.map(c=>{
                  const cName=c.user_profile?.full_name||'Anonymous';
                  const cInit=cName.split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase();
                  return(
                    <div key={c.id} className="bg-[#151515] border border-white/[0.06] rounded-xl p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{cInit}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold text-[12px]">{cName}</span>
                            {roleBadge(c.user_profile?.user_role)}
                          </div>
                        </div>
                        <span className="text-[10px] text-neutral-600 font-mono flex-shrink-0">{timeAgoC(c.created_at)}</span>
                      </div>
                      <p className="text-neutral-300 text-[12px] leading-relaxed pl-9">{c.content}</p>
                    </div>
                  );
                })}
                <div ref={commentsEndRef}/>
              </div>
            )}
          </div>
        </div>

        {/* Comment Input */}
        <form onSubmit={submitComment} className="flex-shrink-0 p-4 border-t border-white/[0.07] bg-[#0d0d0d] flex gap-2">
          <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Add a comment or update..." disabled={submitting}
            className="flex-1 bg-[#181818] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[12px] text-white placeholder-neutral-600 focus:outline-none focus:border-red-500/40 transition-colors"/>
          <button type="submit" disabled={submitting||!commentText.trim()} className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-[12px] transition-colors flex items-center gap-1.5 flex-shrink-0">
            {submitting?<div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>:<><MessageSquare size={13}/>Post</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Community Map (with Places search, pin toggle, inline-profile callback) ─────
function CommunityMap({posts,focusPost,onProfileOpen}:{posts:Post[];focusPost:Post|null;onProfileOpen:(p:Post)=>void}){
  const mapRef=useRef<HTMLDivElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const mapInst=useRef<any>(null);
  const markers=useRef<any[]>([]);
  const infoWin=useRef<any>(null);
  const [loaded,setLoaded]=useState(false);
  const [pinsVisible,setPinsVisible]=useState(true);
  const [placeQ,setPlaceQ]=useState("");
  const [suggestions,setSuggestions]=useState<any[]>([]);

  useEffect(()=>{
    if((window as any).google){setLoaded(true);return;}
    const s=document.createElement("script");
    s.src=`https://maps.googleapis.com/maps/api/js?key=AIzaSyBsWnNq9bnzB8UATSXH0Hxiv6rDbQirD-Y&libraries=places`;
    s.async=true;s.onload=()=>setLoaded(true);
    document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    if(!loaded||!mapRef.current)return;
    const g=(window as any).google;
    mapInst.current=new g.maps.Map(mapRef.current,{center:{lat:5.6037,lng:-0.1870},zoom:12,styles:darkStyle,disableDefaultUI:true});
  },[loaded]);

  // Places autocomplete — use bounds (LatLngBounds) not Circle for AutocompleteService
  useEffect(()=>{
    if(!loaded||!placeQ.trim()){setSuggestions([]);return;}
    const g=(window as any).google;
    if(!g?.maps?.places)return;
    const svc=new g.maps.places.AutocompleteService();
    const t=setTimeout(()=>{
      const ghanaBounds=new g.maps.LatLngBounds(
        new g.maps.LatLng(4.5,- 3.5),
        new g.maps.LatLng(11.5,1.5)
      );
      svc.getPlacePredictions({input:placeQ,bounds:ghanaBounds,types:['geocode','establishment']},(preds:any,status:any)=>{
        if(status===g.maps.places.PlacesServiceStatus.OK&&preds){
          setSuggestions(preds.slice(0,6).map((p:any)=>({name:p.structured_formatting?.main_text||p.description,sub:p.structured_formatting?.secondary_text||'',placeId:p.place_id})));
        } else setSuggestions([]);
      });
    },350);
    return()=>clearTimeout(t);
  },[placeQ,loaded]);

  function selectPlace(placeId:string,name:string){
    const g=(window as any).google;
    if(!g||!mapInst.current)return;
    const svc=new g.maps.places.PlacesService(mapInst.current);
    svc.getDetails({placeId},(place:any,status:any)=>{
      if(status===g.maps.places.PlacesServiceStatus.OK&&place){
        mapInst.current.panTo(place.geometry.location);
        mapInst.current.setZoom(15);
        setPlaceQ(name);setSuggestions([]);
      }
    });
  }

  // Draw / redraw markers
  useEffect(()=>{
    if(!mapInst.current||!loaded)return;
    const g=(window as any).google;
    markers.current.forEach(m=>m.marker?.setMap(null));
    markers.current=[];
    if(!pinsVisible)return;
    posts.forEach(p=>{
      if(!p.latitude||!p.longitude)return;
      const isCrit=p.severity==="CRITICAL";
      const m=new g.maps.Marker({position:{lat:p.latitude,lng:p.longitude},map:mapInst.current,title:p.title,icon:{path:"M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",fillColor:isCrit?"#ef4444":"#f97316",fillOpacity:1,strokeColor:"#fff",strokeWeight:2,scale:1.4,anchor:new g.maps.Point(12,22)}});
      // InfoWindow shows post info only — no external link
      const iw=new g.maps.InfoWindow({content:`<div style="font-family:monospace;font-size:11px;color:#111;padding:6px;min-width:180px"><b style="color:#dc2626;display:block;margin-bottom:4px">${p.title}</b><span style="color:#555;font-size:10px">${p.location_name}</span><br/><span style="color:#777;font-size:10px">${p.reporter_profile?.full_name||'Citizen Reporter'}</span><br/><button onclick="window.__communityOpenProfile&&window.__communityOpenProfile('${p.id}')" style="display:block;width:100%;margin-top:8px;background:#dc2626;color:#fff;border:none;padding:5px 0;border-radius:4px;font-weight:bold;cursor:pointer;font-family:monospace;font-size:10px">View Profile</button></div>`});
      m.addListener("click",()=>{if(infoWin.current)infoWin.current.close();iw.open(mapInst.current,m);infoWin.current=iw;});
      markers.current.push({marker:m,post:p});
    });
  },[posts,loaded,pinsVisible]);

  // Register global callback so InfoWindow button can open profile in right panel
  useEffect(()=>{
    (window as any).__communityOpenProfile=(postId:string)=>{
      const found=posts.find(p=>p.id===postId);
      if(found)onProfileOpen(found);
      if(infoWin.current)infoWin.current.close();
    };
    return()=>{delete (window as any).__communityOpenProfile;};
  },[posts,onProfileOpen]);

  // Pan to focused post
  useEffect(()=>{
    if(!focusPost||!mapInst.current||!loaded)return;
    const g=(window as any).google;
    mapInst.current.panTo({lat:focusPost.latitude,lng:focusPost.longitude});
    mapInst.current.setZoom(15);
    const entry=markers.current.find((e:any)=>e.post?.id===focusPost.id);
    if(entry){if(infoWin.current)infoWin.current.close();const iw=new g.maps.InfoWindow({content:`<div style="font-family:monospace;font-size:11px;color:#111;padding:4px"><b style="color:#dc2626">${focusPost.title}</b><br/><span style="color:#555;font-size:10px">${focusPost.location_name}</span></div>`});iw.open(mapInst.current,entry.marker);infoWin.current=iw;}
  },[focusPost,loaded]);

  return(
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full"/>
      {!loaded&&<div className="absolute inset-0 flex items-center justify-center bg-[#111]"><p className="text-neutral-500 text-sm">Loading map...</p></div>}

      {/* Places search overlay */}
      <div className="absolute top-3 left-3 z-10 w-64">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-2.5 text-neutral-400 pointer-events-none"/>
          <input ref={searchRef} value={placeQ} onChange={e=>setPlaceQ(e.target.value)} placeholder="Search areas, towns, cities..." className="w-full bg-[#111]/95 backdrop-blur border border-white/20 rounded-xl pl-8 pr-8 py-2 text-[12px] text-white placeholder-neutral-500 focus:outline-none focus:border-white/40"/>
          {placeQ&&<button onClick={()=>{setPlaceQ('');setSuggestions([]);}} className="absolute right-2.5 top-2.5 text-neutral-500 hover:text-white"><X size={12}/></button>}
        </div>
        {suggestions.length>0&&(
          <div className="mt-1 bg-[#111]/97 border border-white/15 rounded-xl overflow-hidden shadow-2xl">
            {suggestions.map((s:any)=>(
              <button key={s.placeId} onClick={()=>selectPlace(s.placeId,s.name)} className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/[0.04] last:border-0 transition-colors">
                <p className="text-white text-[12px] font-semibold">{s.name}</p>
                <p className="text-neutral-500 text-[10px]">{s.sub}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pin toggle button */}
      <button onClick={()=>setPinsVisible(v=>!v)} className={`absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all backdrop-blur ${pinsVisible?'bg-[#111]/90 border-white/20 text-white hover:bg-[#1a1a1a]':'bg-neutral-900/90 border-white/10 text-neutral-500 hover:text-white'}`}>
        <MapPin size={12}/> {pinsVisible?`${posts.filter(p=>p.latitude&&p.longitude).length} Pins`:'Pins Off'}
      </button>

      {/* Focused post bottom card */}
      {focusPost&&(
        <div className="absolute bottom-4 left-4 right-4 bg-[#111111]/95 border border-white/10 rounded-xl p-3 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-[12px] leading-snug truncate">{focusPost.title}</p>
              <p className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5"><MapPin size={9}/>{focusPost.location_name}</p>
            </div>
            <a href="/dashboard" className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5 hover:bg-red-500/20 transition-colors whitespace-nowrap"><ExternalLink size={10}/>Live Map</a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CommunityPage(){
  const [posts,setPosts]=useState<Post[]>([]);
  const [loading,setLoading]=useState(true);
  const [cat,setCat]=useState("All");
  const [feedQ,setFeedQ]=useState("");
  const [focusPost,setFocusPost]=useState<Post|null>(null);
  const [citizenQ,setCitizenQ]=useState("");
  const [results,setResults]=useState<Citizen[]>([]);
  const [searching,setSearching]=useState(false);
  const [profile,setProfile]=useState<Citizen|null>(null);
  const [detailPost,setDetailPost]=useState<Post|null>(null);
  const [userRole,setUserRole]=useState<string>("citizen");
  const [userId,setUserId]=useState<string>("");
  const timerRef=useRef<any>(null);

  function updatePost(updated:Post){
    setPosts(prev=>prev.map(p=>p.id===updated.id?{...p,...updated}:p));
    if(focusPost?.id===updated.id)setFocusPost(updated);
    if(detailPost?.id===updated.id)setDetailPost(updated);
  }

  function onDeletePost(id:string){
    setPosts(prev=>prev.filter(p=>p.id!==id));
    if(focusPost?.id===id)setFocusPost(null);
    if(detailPost?.id===id)setDetailPost(null);
  }

  function onBlockUser(blockedUserId:string){
    // Immediately filter out all posts by this user from the feed
    setPosts(prev=>prev.filter(p=>p.reporter_id!==blockedUserId));
    if(focusPost?.reporter_id===blockedUserId)setFocusPost(null);
    if(detailPost?.reporter_id===blockedUserId)setDetailPost(null);
  }

  async function load(){
    try{const d=await eawsApi.getIncidentFeed();setPosts((d||[]).map((p:any)=>({...p,likes:p.likes_count??Math.floor(Math.random()*30),isLiked:false})));}
    catch{}setLoading(false);
  }

  useEffect(()=>{
    load();
    eawsApi.getMe().then(r => {
      setUserRole(r.profile.user_role);
      setUserId(r.user.id);
    }).catch(()=>{});
    const iv=setInterval(load,12000);
    return()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    clearTimeout(timerRef.current);
    if(!citizenQ.trim()){setResults([]);return;}
    setSearching(true);
    timerRef.current=setTimeout(async()=>{const r=await eawsApi.searchUsers(citizenQ);setResults(r);setSearching(false);},400);
  },[citizenQ]);

  function like(id:string){setPosts(p=>p.map(x=>x.id===id?{...x,isLiked:!x.isLiked,likes:(x.likes??0)+(x.isLiked?-1:1)}:x));eawsApi.reactToIncident(id,"like").catch(()=>{});}

  const filtered=posts.filter(p=>{
    const mc=cat==="All"||p.category.toLowerCase()===cat.toLowerCase();
    const mq=!feedQ||p.title.toLowerCase().includes(feedQ.toLowerCase())||p.description?.toLowerCase().includes(feedQ.toLowerCase());
    return mc&&mq;
  });

  return(<>
    <SentinelShell title="Community Intelligence" subtitle="Live citizen feed · Geographic mapping · Citizen lookup">
      <div className="h-full flex overflow-hidden" style={{background:"#0a0a0a"}}>

        {/* ── LEFT: Feed ── */}
        <div className="w-[300px] flex-shrink-0 flex flex-col border-r border-white/[0.05]">
          <div className="flex-shrink-0 p-3 border-b border-white/[0.05] space-y-2 bg-[#0d0d0d]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-white font-bold text-[12px]">Live Feed</span>
              <span className="text-[10px] text-neutral-600 ml-auto">{posts.length} posts</span>
              <button onClick={()=>{setLoading(true);load();}} className="p-1.5 rounded-lg bg-neutral-900 border border-white/[0.06] text-neutral-400 hover:text-white"><RefreshCw size={11}/></button>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-neutral-500"/>
              <input value={feedQ} onChange={e=>setFeedQ(e.target.value)} placeholder="Search posts..." className="w-full bg-[#181818] border border-white/[0.06] rounded-lg pl-7 pr-3 py-2 text-[12px] text-white placeholder-neutral-600 focus:outline-none focus:border-white/20"/>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {CATS.map(c=><button key={c} onClick={()=>setCat(c)} className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${cat===c?"bg-white text-black border-white":"text-neutral-500 border-white/[0.07] hover:text-white"}`}>{c}</button>)}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading?Array.from({length:4}).map((_,i)=><div key={i} className="h-48 rounded-xl bg-[#111] animate-pulse border border-white/[0.04]"/>):
              filtered.length===0?<div className="py-12 text-center text-neutral-600 text-[12px]">No posts match filters</div>:
              filtered.map(p=><PostCard key={p.id} post={p} active={focusPost?.id===p.id} onClick={()=>{setFocusPost(focusPost?.id===p.id?null:p);setDetailPost(p);}}/>)
            }
          </div>
        </div>

        {/* ── CENTRE: Map ── */}
        <div className="flex-1 min-w-0 relative">
          <CommunityMap posts={filtered} focusPost={focusPost} onProfileOpen={(p)=>{
            // Convert post reporter to Citizen shape and open inline
            setProfile({user_id:p.reporter_id||p.id,full_name:p.reporter_profile?.full_name||'Citizen Reporter',phone:'',user_role:p.reporter_profile?.user_role||'citizen',operator_code:p.reporter_profile?.operator_code||p.id,is_approved:p.is_verified});
          }}/>
          {!focusPost&&(
            <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-[#111]/90 border border-white/10 rounded-xl px-4 py-2 backdrop-blur pointer-events-none">
              <p className="text-neutral-400 text-[11px] text-center">Click a post to pin · Click a pin to view profile</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Citizen Search / Inline Profile ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col border-l border-white/[0.05] bg-[#0d0d0d]">
          {profile?(
            <InlineProfile citizen={profile} onBack={()=>setProfile(null)}/>
          ):(
            <>
              <div className="flex-shrink-0 p-4 border-b border-white/[0.05]">
                <p className="text-white font-bold text-sm mb-0.5">Citizen Lookup</p>
                <p className="text-[11px] text-neutral-500 mb-3">Search by name, phone or ID — click to view profile</p>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-3 text-neutral-500"/>
                  <input value={citizenQ} onChange={e=>setCitizenQ(e.target.value)} placeholder="e.g. Harrison, GH-ACR, +233..." className="w-full bg-[#181818] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-white placeholder-neutral-600 focus:outline-none focus:border-white/20"/>
                  {searching&&<div className="absolute right-3 top-3 w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"/>}
                  {!searching&&citizenQ&&<button onClick={()=>{setCitizenQ("");setResults([]);}} className="absolute right-3 top-3 text-neutral-500 hover:text-white"><X size={13}/></button>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {results.length===0&&!citizenQ&&(
                  <div className="py-12 text-center"><User size={36} className="text-neutral-800 mx-auto mb-3"/><p className="text-neutral-600 text-[12px]">Search any registered citizen on the EAWS platform</p></div>
                )}
                {results.length===0&&citizenQ&&!searching&&(
                  <div className="py-10 text-center text-neutral-600 text-[12px]">No results for "{citizenQ}"</div>
                )}
                {results.map((c:any)=>(
                  <button key={c.user_id} onClick={()=>setProfile(c)} className="w-full text-left bg-[#151515] border border-white/[0.06] rounded-xl p-3.5 hover:border-white/15 hover:bg-[#1a1a1a] transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-900 border border-white/10 flex items-center justify-center font-bold text-sm text-white flex-shrink-0">
                        {c.full_name.split(" ").map((w:string)=>w[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><p className="font-bold text-white text-[13px] truncate group-hover:text-red-400 transition-colors">{c.full_name}</p>{c.is_approved?<CheckCircle size={11} className="text-green-400 flex-shrink-0"/>:<AlertTriangle size={11} className="text-yellow-500 flex-shrink-0"/>}</div>
                        <p className="text-[11px] text-neutral-500 font-mono">{c.operator_code}</p>
                        <p className="text-[11px] text-neutral-600">{c.phone}</p>
                      </div>
                      <ChevronRight size={13} className="text-neutral-700 group-hover:text-neutral-400 flex-shrink-0"/>
                    </div>
                  </button>
                ))}
              </div>
              {/* Feed stats */}
              <div className="flex-shrink-0 border-t border-white/[0.05] p-4">
                <p className="text-[10px] font-bold tracking-wider text-neutral-600 uppercase mb-2">Feed Stats</p>
                <div className="grid grid-cols-2 gap-2">
                  {[["Total",posts.length],["Critical",posts.filter(p=>p.severity==="CRITICAL").length],["Verified",posts.filter(p=>p.is_verified).length],["This Hour",posts.filter(p=>(Date.now()-new Date(p.created_at).getTime())<3600000).length]].map(([l,v])=>(
                    <div key={String(l)} className="bg-[#151515] border border-white/[0.05] rounded-lg p-2.5 text-center"><p className="text-white font-black text-lg">{v}</p><p className="text-[10px] text-neutral-600">{l}</p></div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </SentinelShell>
    {detailPost&&(
      <PostDetailModal
        post={detailPost}
        onClose={()=>setDetailPost(null)}
        onUpdate={updatePost}
        userRole={userRole}
        onDeletePost={onDeletePost}
        onBlockUser={onBlockUser}
      />
    )}
  </>
  );
}
