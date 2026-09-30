"use client";
import { useEffect, useState, useRef } from "react";
import { Heart, MessageSquare, MapPin, Clock, Search, X, CheckCircle, User, AlertTriangle, ChevronRight, ChevronLeft, RefreshCw, ExternalLink, Flame, Shield, Activity, Trash2, Ban, Send, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen } from "lucide-react";
import SentinelShell from "@/components/SentinelShell";
import { eawsApi, isLocalTestApi } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Post { id:string; title:string; description:string; category:string; severity:string; location_name:string; latitude:number; longitude:number; created_at:string; is_verified:boolean; likes?:number; isLiked?:boolean; isAlarmed?:boolean; isConcerned?:boolean; alarmed?:number; concerned?:number; comments_count?:number; replies_count?:number; is_community?:boolean; incident_media?:{file_url:string;media_type:string}[]; reporter_profile?:{full_name:string;user_role:string;operator_code?:string}|null; reporter_id?:string; }
interface Citizen { user_id:string; full_name:string; phone:string; user_role:string; operator_code:string; is_approved:boolean; }
interface Comment { id:string; user_id?:string; content:string; created_at:string; user_profile?:{full_name:string;user_role:string;operator_code?:string}|null; author_name?:string; author_initials?:string; threat_flag?:boolean; }

const SEV:Record<string,string> = { "CRITICAL":"text-red-400 bg-red-500/10 border-red-500/25", "WARNING":"text-orange-400 bg-orange-500/10 border-orange-500/25", "HIGH":"text-orange-400 bg-orange-500/10 border-orange-500/25", "MEDIUM":"text-yellow-400 bg-yellow-500/10 border-yellow-500/25", "LOW":"text-green-400 bg-green-500/10 border-green-500/25", "PENDING TRIAGE":"text-purple-400 bg-purple-500/10 border-purple-500/25", "COMMUNITY":"text-purple-400 bg-purple-500/10 border-purple-500/25" };
const CATS = ["All","Updates","Fire","Flood","Medical","Police","Crime","Accident","Other"];
const PHOTOS = ["https://images.unsplash.com/photo-1599733589046-9b8308b5b50d?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1610296669228-602fa827fc1f?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=600&auto=format&fit=crop","https://images.unsplash.com/photo-1504701954957-2010ec3bcec1?w=600&auto=format&fit=crop"];
const darkStyle = [{elementType:"geometry",stylers:[{color:"#18181a"}]},{elementType:"labels.icon",stylers:[{visibility:"off"}]},{elementType:"labels.text.fill",stylers:[{color:"#7b7b7f"}]},{elementType:"labels.text.stroke",stylers:[{color:"#18181a"}]},{featureType:"road",elementType:"geometry.fill",stylers:[{color:"#242426"}]},{featureType:"road",elementType:"labels.text.fill",stylers:[{color:"#8a8a8f"}]},{featureType:"water",elementType:"geometry",stylers:[{color:"#000000"}]}];

function timeAgo(iso:string){const d=Math.floor((Date.now()-new Date(iso).getTime())/1000);if(d<60)return`${d}s ago`;if(d<3600)return`${Math.floor(d/60)}m ago`;if(d<86400)return`${Math.floor(d/3600)}h ago`;return new Date(iso).toLocaleDateString();}
function photo(p:Post){const m=p.incident_media?.find(x=>x.media_type==="image");if(m?.file_url)return m.file_url;const h=p.id.split("").reduce((a,c)=>a+c.charCodeAt(0),0);return PHOTOS[h%PHOTOS.length];}

// ── Compact Post Card ──────────────────────────────────────────────────────────
function PostCard({post,active,onClick}:{post:Post;active:boolean;onClick:()=>void}){
  const name=post.reporter_profile?.full_name||"Citizen Reporter";
  const initials=name.split(" ").map((w:string)=>w[0]).slice(0,2).join("").toUpperCase();
  const isComm = post.category?.toLowerCase() === "community";
  const mediaImage = post.incident_media?.find((item) => item.media_type === "image")?.file_url;
  const imageUrl = mediaImage || (isLocalTestApi ? "" : photo(post));
  const hasImage = Boolean(imageUrl);
  return(
    <button onClick={onClick} className={`w-full text-left rounded-xl border transition-all overflow-hidden ${active?"border-purple-500/50 bg-[#141118]":"border-white/[0.06] bg-[#111111] hover:border-white/10"}`}>
      {(!isComm || hasImage) && (
        hasImage ? (
          <img src={imageUrl} alt="" className="w-full h-28 object-cover" onError={e=>{(e.target as HTMLImageElement).style.display="none";}}/>
        ) : (
          <div className="flex h-16 items-center justify-center bg-neutral-900 text-[10px] text-neutral-500">No media attached</div>
        )
      )}
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
          {post.location_name && (
            <span className="flex items-center gap-1"><MapPin size={9}/><span className="truncate">{post.location_name}</span></span>
          )}
          <span className="ml-auto flex-shrink-0">{timeAgo(post.created_at)}</span>
        </div>
      </div>
      {active&&<div className="px-3 pb-3"><div className="text-[10px] text-purple-400 font-bold flex items-center gap-1"><MapPin size={10}/> Pinned on map</div></div>}
    </button>
  );
}

// ── Inline Citizen Profile ─────────────────────────────────────────────────────
function InlineProfile({citizen,onBack}:{citizen:Citizen;onBack:()=>void}){
  const initials=citizen.full_name.split(" ").map((w:string)=>w[0]).slice(0,2).join("").toUpperCase();
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<{sender:string;text:string;time:string}[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [showMediaPrompt, setShowMediaPrompt] = useState(false);

  useEffect(() => {
    if (chatOpen) {
      eawsApi.getMessages(citizen.user_id).then(res => setMsgs(res)).catch(e => console.error(e));
      const interval = setInterval(() => {
        eawsApi.getMessages(citizen.user_id).then(res => setMsgs(res)).catch(e => console.error(e));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [chatOpen, citizen.user_id]);

  const handleDeleteMsg = async (msgId: string) => {
    try {
      await eawsApi.deleteMessage(citizen.user_id, msgId);
      const updated = await eawsApi.getMessages(citizen.user_id);
      setMsgs(updated);
    } catch(e) {
      console.error(e);
    }
  };

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
              <div><p className="text-white font-bold text-[12px]">{citizen.full_name}</p><p className="text-[9px] text-green-400 font-semibold">Online · Direct Line</p></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 flex flex-col">
            {msgs.length===0 && <div className="flex-1 flex items-center justify-center"><p className="text-neutral-600 text-[11px] text-center">No messages yet. Send a message to start communication.</p></div>}
            {msgs.map((m:any,i)=>(
              <div key={m.id || i} className={`group relative flex flex-col max-w-[85%] ${m.sender==="operator"?"ml-auto items-end":"mr-auto items-start"}`}>
                <div className={`p-2.5 rounded-2xl text-[11px] leading-relaxed shadow-sm ${m.is_deleted ? "bg-neutral-900 border border-white/10 text-neutral-500 italic" : m.sender==="operator"?"bg-red-600 text-white rounded-br-none":"bg-neutral-800 text-neutral-200 rounded-bl-none"}`}>
                  {m.is_deleted ? (
                    <span className="flex items-center gap-1.5"><Ban size={12}/> This message was deleted</span>
                  ) : (
                    <>
                      {m.media_url && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/10">
                          {m.type === 'video' ? (
                            <video src={m.media_url} controls className="max-h-48 w-full object-cover" />
                          ) : (
                            <img src={m.media_url} alt="" className="max-h-48 w-full object-cover" onError={(e)=>(e.target as HTMLElement).style.display='none'} />
                          )}
                        </div>
                      )}
                      {m.text && <p className="break-words">{m.text}</p>}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[8px] text-neutral-600">{m.time || 'Just now'}</span>
                  {!m.is_deleted && (
                    <button onClick={() => handleDeleteMsg(m.id)} title="Delete Message" className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity p-0.5">
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showMediaPrompt && (
            <div className="px-3 py-2 bg-[#1a1a1a] border-t border-white/10 flex items-center gap-2">
              <input
                value={mediaUrlInput}
                onChange={e=>setMediaUrlInput(e.target.value)}
                placeholder="Paste Image/Video URL..."
                className="flex-1 bg-[#111] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none"
              />
              <button onClick={()=>setShowMediaPrompt(false)} className="text-neutral-400 hover:text-white"><X size={13}/></button>
            </div>
          )}

          <form onSubmit={async e=>{
            e.preventDefault();
            const text = newMsg.trim();
            const media = mediaUrlInput.trim();
            if(!text && !media) return;
            setNewMsg("");
            setMediaUrlInput("");
            setShowMediaPrompt(false);
            try {
              const type = media ? (media.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image') : 'text';
              await eawsApi.sendMessage(citizen.user_id, text, type, media || undefined);
              const updated = await eawsApi.getMessages(citizen.user_id);
              setMsgs(updated);
            } catch(e){
              console.error(e);
            }
          }} className="p-3 border-t border-white/[0.05] flex gap-2 items-center">
            <button type="button" onClick={()=>setShowMediaPrompt(!showMediaPrompt)} title="Attach Media URL" className={`p-2 rounded-xl border border-white/10 transition-colors ${showMediaPrompt ? 'bg-red-500/20 text-red-400' : 'bg-[#181818] text-neutral-400 hover:text-white'}`}>
              <ExternalLink size={13}/>
            </button>
            <input
              value={newMsg}
              onChange={e=>setNewMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLInputElement).form?.requestSubmit();
                }
              }}
              placeholder="Type message to citizen... (Press Enter or click Send)"
              className="flex-1 bg-[#181818] border border-white/[0.06] rounded-xl px-3 py-2 text-[11px] text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/50"
            />
            <button type="submit" className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1.5 shadow-md shadow-red-900/30">
              <Send size={12}/> Send
            </button>
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
          <p className="text-[10px] text-amber-300">
            Masked. Authorized reveal and access auditing are not connected, so medical details are unavailable.
          </p>
        </div>
        {/* Emergency Contacts */}
        <div className="bg-[#151515] border border-white/[0.06] rounded-xl p-4">
          <p className="text-[11px] font-bold text-neutral-300 mb-2">Emergency Contacts</p>
          <p className="text-neutral-500 text-[11px] italic py-2">Contact records are not available from the configured API.</p>
        </div>
        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={()=>setChatOpen(true)} disabled={isLocalTestApi} title={isLocalTestApi ? "Citizen messaging is unavailable in TEST mode" : undefined} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"><MessageSquare size={12}/>{isLocalTestApi ? "Messaging unavailable" : "Message"}</button>
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
  const handle='@' + name.toLowerCase().replace(/\s+/g, '_');
  const isComm = local.category?.toLowerCase() === 'community' || (local as any).is_community;
  
  // Media source if present
  const mediaItem = local.incident_media?.find(x => x.media_type === 'image');
  const hasMedia = !!(mediaItem?.file_url);
  const imgSrc = mediaItem?.file_url || ((() => {
    const h = local.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return PHOTOS[h % PHOTOS.length];
  })());

  const isOperator = ['dispatcher', 'police', 'fire', 'ambulance', 'admin'].includes(userRole);

  useEffect(() => {
    setLocal({...post});
  }, [post]);

  useEffect(()=>{
    if (isComm) {
      setComments((local as any).replies || []);
      setLoadingComments(false);
      return;
    }
    let cancelled=false;
    setLoadingComments(true);
    eawsApi.getComments(local.id).then(data=>{if(!cancelled)setComments(data||[]);}).catch(()=>{}).finally(()=>{if(!cancelled)setLoadingComments(false);});
    return()=>{cancelled=true;};
  },[local.id, (local as any).replies, isComm]);

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
      if (isComm) {
        const reply = await eawsApi.addReply(local.id, commentText.trim());
        const newReply = {
          ...reply,
          author_name: reply.author_name || 'Ghana Citizen',
          author_initials: reply.author_initials || 'GC',
          content: reply.content || commentText.trim(),
          created_at: reply.created_at || new Date().toISOString()
        };
        setComments(prev=>[...prev, newReply]);
        const updated = {
          ...local,
          comments_count: (local.comments_count ?? 0) + 1,
          replies: [...((local as any).replies || []), newReply]
        };
        setLocal(updated);
        onUpdate(updated);
      } else {
        const c=await eawsApi.addComment(local.id,commentText.trim());
        setComments(prev=>[...prev,{...c,user_profile:c.user_profile||{full_name:'You',user_role:'operator'}}]);
        const updated={...local,comments_count:(local.comments_count??0)+1};
        setLocal(updated);onUpdate(updated);
      }
      setCommentText('');
    }catch{}
    setSubmitting(false);
  }

  async function handleDelete(){
    if(isLocalTestApi) return;
    if(!window.confirm("Are you sure you want to delete/remove this post? It will be removed immediately.")) return;
    try{
      await eawsApi.deleteIncident(local.id);
      onDeletePost(local.id);
      onClose();
    }catch(err:any){
      alert("Failed to delete post: " + (err.message || err));
    }
  }

  async function handleBlock(){
    if(isLocalTestApi || !local.reporter_id) return;
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
    <div className="relative z-10 w-full h-full flex flex-col bg-[#0d0d0d] animate-in slide-in-from-right duration-200">
      
      {/* Top Sticky Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/[0.06] flex-shrink-0 bg-[#0d0d0d]">
          <button onClick={onClose} className="p-2 rounded-xl bg-neutral-900 border border-white/[0.08] text-neutral-400 hover:text-white transition-colors">
            <X size={15}/>
          </button>
          {isOperator && (
            <button onClick={handleDelete} disabled={isLocalTestApi} className="p-2 rounded-xl bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-950/60 hover:text-red-300 transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50" title={isLocalTestApi ? "Post removal is not connected in TEST mode" : "Delete Post"}>
              <Trash2 size={13}/> <span className="text-[11px] font-bold">{isLocalTestApi ? "Removal unavailable in TEST" : "Delete Post"}</span>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{isComm ? 'Post Details' : local.title}</p>
            <p className="text-[11px] text-neutral-500">{isComm ? 'Community Post' : 'Incident Report'} · {timeAgo(local.created_at)}</p>
          </div>
          {!isComm && (
            <span className={`text-[10px] font-bold border rounded-full px-2.5 py-1 flex-shrink-0 ${SEV[local.severity]||SEV.LOW}`}>{local.severity}</span>
          )}
        </div>

        {/* Scrollable Detail Body */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Author Row & Main Post Body */}
          <div className="p-5 border-b border-white/[0.05] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center font-bold text-purple-300 text-sm flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-base">{name}</span>
                    {local.is_verified && (
                      <CheckCircle size={15} className="text-emerald-400" />
                    )}
                    {roleBadge(local.reporter_profile?.user_role)}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{handle}</p>
                </div>
              </div>

              {isOperator && local.reporter_profile?.user_role !== 'dispatcher' && local.reporter_profile?.user_role !== 'operator' && local.reporter_id && (
                <button onClick={handleBlock} disabled={isLocalTestApi} title={isLocalTestApi ? "Account moderation is not connected in TEST mode" : undefined} className="px-2 py-1 rounded-lg bg-red-950/50 border border-red-500/20 text-red-400 hover:bg-red-950/80 hover:text-red-300 text-xs font-bold transition-colors flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50">
                  <Ban size={10}/>{isLocalTestApi ? "Blocking unavailable in TEST" : "Block User"}
                </button>
              )}
            </div>

            {/* Post Title & Content Text */}
            <div className="text-white text-sm leading-relaxed whitespace-pre-line font-normal space-y-2">
              <p className="font-semibold text-white text-base">{local.title}</p>
              {local.description && local.description !== local.title && (
                <p className="text-neutral-300 text-sm leading-relaxed">{local.description}</p>
              )}
            </div>

            {/* Attached Media Image (if available) */}
            {(hasMedia || (local as any).image_url) && (
              <div className="relative rounded-xl overflow-hidden border border-white/[0.08] max-h-80 bg-neutral-950">
                <img src={(local as any).image_url || imgSrc} alt="" className="w-full h-full object-cover" onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
              </div>
            )}

            {/* Location Pin & Geo Coordinates */}
            {local.location_name && (
              <div className="bg-[#151515] border border-white/[0.06] rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-neutral-300 font-semibold">
                  <MapPin size={14} className="text-red-400 flex-shrink-0" />
                  <span>{local.location_name}</span>
                </div>
                {local.latitude !== 0 && local.longitude !== 0 && (
                  <div className="text-[10px] font-mono text-neutral-500 pl-5">
                    {local.latitude}° N, {local.longitude}° W
                  </div>
                )}
              </div>
            )}

            {/* Timestamp & Meta */}
            <div className="text-xs text-neutral-500 border-t border-white/[0.05] pt-3 flex items-center justify-between">
              <span>{timeAgo(local.created_at)} · {new Date(local.created_at).toLocaleDateString()}</span>
              <span>{(local.likes ?? 0) * 3 + 12} Views</span>
            </div>
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

          {/* Comments Section */}
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
                  const cName = c.author_name || c.user_profile?.full_name || (c as any).user_name || 'Ghana Citizen';
                  const cInit = c.author_initials || (cName ? cName.split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase() : 'GC');
                  return(
                    <div key={c.id} className="bg-[#151515] border border-white/[0.06] rounded-xl p-3.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-300 flex-shrink-0">{cInit}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-bold text-[12px]">{cName}</span>
                            {roleBadge(c.user_profile?.user_role)}
                          </div>
                        </div>
                        <span className="text-[10px] text-neutral-600 font-mono flex-shrink-0">{timeAgoC(c.created_at)}</span>
                      </div>
                      <div className="pl-9">
                        {c.threat_flag && (
                          <span className="mb-1 inline-flex rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-300">
                            Flagged for human review · threat language
                          </span>
                        )}
                        <p className="text-neutral-300 text-[12px] leading-relaxed">{c.content}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={commentsEndRef}/>
              </div>
            )}
          </div>
        </div>

        {/* Comment Input Sticky Footer */}
        <form onSubmit={submitComment} className="flex-shrink-0 p-4 border-t border-white/[0.07] bg-[#0d0d0d] flex gap-2">
          <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Post your reply..." disabled={submitting}
            className="flex-1 bg-[#181818] border border-white/[0.08] rounded-xl px-4 py-2.5 text-[12px] text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500/40 transition-colors"/>
          <button type="submit" disabled={submitting||!commentText.trim()} className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-[12px] transition-colors flex items-center gap-1.5 flex-shrink-0">
            {submitting?<div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"/>:<><MessageSquare size={13}/>Reply</>}
          </button>
        </form>
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
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if(existing){
      existing.addEventListener("load",()=>setLoaded(true));
      if((window as any).google) setLoaded(true);
      return;
    }
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
    const targetLat = focusPost.latitude || 5.6037;
    const targetLng = focusPost.longitude || -0.1870;
    
    // Trigger map resize event so Google Maps adjusts to container width
    g.maps.event.trigger(mapInst.current, "resize");
    mapInst.current.panTo({lat: targetLat, lng: targetLng});
    mapInst.current.setZoom(15);

    const entry=markers.current.find((e:any)=>e.post?.id===focusPost.id);
    if(entry){
      if(infoWin.current)infoWin.current.close();
      const iw=new g.maps.InfoWindow({content:`<div style="font-family:monospace;font-size:11px;color:#111;padding:4px"><b style="color:#dc2626">${focusPost.title}</b><br/><span style="color:#555;font-size:10px">${focusPost.location_name || 'Accra, Ghana'}</span></div>`});
      iw.open(mapInst.current,entry.marker);
      infoWin.current=iw;
    }
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

const DEFAULT_MOCK_POSTS: Post[] = [
  {
    id: "inc-1",
    title: "Rising water levels on Liberation Road",
    description: "Water has reached knee level near the traffic light. Avoid the area and seek alternative bypass routes.",
    category: "flood",
    severity: "CRITICAL",
    location_name: "Liberation Road, Accra",
    latitude: 5.5560,
    longitude: -0.1962,
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    is_verified: true,
    likes: 24,
    replies_count: 1,
    reporter_profile: { full_name: "Kwame Asante", user_role: "citizen" },
    reporter_id: "c-003"
  },
  {
    id: "cp-001",
    title: "Anyone else notice the traffic is really bad on the N1 highway this morning? Took me 45 minutes from Spintex to Accra Mall. Stay safe out there everyone 🙏",
    description: "",
    category: "community",
    severity: "COMMUNITY",
    location_name: "Accra, Ghana",
    latitude: 5.6037,
    longitude: -0.1870,
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    is_verified: true,
    likes: 7,
    replies_count: 2,
    reporter_profile: { full_name: "D. Harrison", user_role: "citizen" },
    reporter_id: "c-001",
    is_community: true
  },
  {
    id: "inc-2",
    title: "Bushfire spotted near Achimota Forest",
    description: "Thick smoke visible from the main road. Fire service has been called and dispatchers are en-route.",
    category: "fire",
    severity: "WARNING",
    location_name: "Achimota Forest, Accra",
    latitude: 5.6147,
    longitude: -0.2105,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    is_verified: true,
    likes: 12,
    replies_count: 0,
    reporter_profile: { full_name: "Ama Serwaa Boateng", user_role: "citizen" },
    reporter_id: "c-002"
  },
  {
    id: "cp-002",
    title: "Heads up: The Electricity Company is doing maintenance work in East Legon areas 12 and 13 today from 9am to 4pm. Power will be out. Charge your devices now! ⚡",
    description: "",
    category: "community",
    severity: "COMMUNITY",
    location_name: "East Legon, Accra",
    latitude: 5.6322,
    longitude: -0.1654,
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    is_verified: true,
    likes: 21,
    replies_count: 1,
    reporter_profile: { full_name: "Kwame Asante", user_role: "citizen" },
    reporter_id: "c-003",
    is_community: true
  },
  {
    id: "INC-8829-X",
    title: "Structure Fire - Makola Market",
    description: "Large blaze reported in sector 3 of Makola Market. Multiple vendor structures involved.",
    category: "fire",
    severity: "CRITICAL",
    location_name: "Makola Market, Accra",
    latitude: 5.5458,
    longitude: -0.2078,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    is_verified: true,
    likes: 5,
    replies_count: 2,
    reporter_profile: { full_name: "D. Harrison", user_role: "citizen" },
    reporter_id: "c-001"
  },
  {
    id: "INC-1209-A",
    title: "Armed Robbery - East Legon",
    description: "Suspects fled in a black sedan after residential break-in. Police unit dispatched.",
    category: "police",
    severity: "HIGH",
    location_name: "East Legon, Accra",
    latitude: 5.6322,
    longitude: -0.1654,
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    is_verified: true,
    likes: 12,
    replies_count: 1,
    reporter_profile: { full_name: "Abena Osei-Bonsu", user_role: "citizen" },
    reporter_id: "c-005"
  },
  {
    id: "inc-3",
    title: "Injured person near Tema Station",
    description: "Someone collapsed near the bus terminal. Ambulance has been contacted and is currently on the way.",
    category: "medical",
    severity: "MEDIUM",
    location_name: "Tema Station, Accra",
    latitude: 5.6844,
    longitude: 0.0118,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    is_verified: true,
    likes: 6,
    replies_count: 0,
    reporter_profile: { full_name: "Nana Mensah", user_role: "citizen" },
    reporter_id: "c-004"
  },
  {
    id: "INC-7701-J",
    title: "Suspicious Vehicle Activity - Osu RE",
    description: "Unmarked vehicle lingering near commercial bank. Vehicle cleared by security team.",
    category: "police",
    severity: "MEDIUM",
    location_name: "Osu RE, Accra",
    latitude: 5.5560,
    longitude: -0.1812,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 43).toISOString(),
    is_verified: true,
    likes: 3,
    replies_count: 0,
    reporter_profile: { full_name: "Jayden Spark", user_role: "citizen" },
    reporter_id: "c-006"
  }
];

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CommunityPage(){
  const [posts,setPosts]=useState<Post[]>(isLocalTestApi ? [] : DEFAULT_MOCK_POSTS);
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
    try{
      const [incidents, communityPosts] = await Promise.all([
        eawsApi.getIncidentFeed(),
        eawsApi.getCommunityPosts()
      ]);

      const mappedCommunity = (communityPosts || []).map((p: any) => ({
        id: p.id,
        title: p.content || '',
        description: '',
        category: 'community',
        severity: 'COMMUNITY',
        location_name: '', // Empty location by default for community posts
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        created_at: p.created_at,
        is_verified: p.is_verified ?? true,
        likes: p.likes_count ?? 0,
        replies_count: p.replies_count ?? 0,
        reporter_profile: {
          full_name: p.author_name || 'Ghana Citizen',
          user_role: 'citizen'
        },
        reporter_id: p.author_id,
        is_community: true,
        replies: p.replies || []
      }));

      // Combine and sort by date descending
      const merged = [...(incidents || []), ...mappedCommunity];
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPosts(prev=>{
        const prevMap=new Map(prev.map(p=>[p.id,p]));
        return merged.map((p:any)=>{
          const old=prevMap.get(p.id);
          return {
            ...p,
            likes:       p.likes ?? p.likes_count ?? 0,
            alarmed:     p.alarmed_count ?? old?.alarmed  ?? 0,
            concerned:   p.concerned_count ?? old?.concerned ?? 0,
            isLiked:     old?.isLiked    ?? false,
            isAlarmed:   old?.isAlarmed  ?? false,
            isConcerned: old?.isConcerned ?? false,
          };
        });
      });
    }catch(e){
      console.warn('EAWS community feed load failed:', e);
      setPosts((prev) => isLocalTestApi ? [] : prev.length > 0 ? prev : DEFAULT_MOCK_POSTS);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    load();
    eawsApi.getMe().then(r => {
      setUserRole(r.profile.user_role);
      setUserId(r.user.id);
    }).catch(()=>{});
    const iv=setInterval(load,3000); // Poll every 3 seconds for real-time synchronization
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
    const pCat = p.category?.toLowerCase() || '';
    const mc = cat === "All" || 
               (cat === "Updates" && pCat === "community") || 
               (cat !== "Updates" && pCat === cat.toLowerCase());
    const mq=!feedQ||p.title.toLowerCase().includes(feedQ.toLowerCase())||p.description?.toLowerCase().includes(feedQ.toLowerCase());
    return mc&&mq;
  });

  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);

  return(<>
    <SentinelShell title="Community Intelligence" subtitle="Live citizen feed · Geographic mapping · Citizen lookup">
      <div className="h-full flex overflow-hidden" style={{background:"#0a0a0a"}}>

        {/* ── LEFT: Feed ── */}
        <div
          className="flex-shrink-0 flex flex-col border-r border-white/[0.05] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
          style={{ width: isLeftOpen ? "300px" : "0px", minWidth: isLeftOpen ? "300px" : "0px", opacity: isLeftOpen ? 1 : 0, overflow: isLeftOpen ? "visible" : "hidden" }}
        >
          <div className="flex-shrink-0 p-3.5 border-b border-white/[0.05] space-y-2 bg-[#0d0d0d]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-white font-bold text-[12px]">Live Feed</span>
              <span className="text-[10px] text-neutral-500 ml-auto">{posts.length} posts</span>
              <button onClick={()=>{setLoading(true);load();}} title="Refresh Feed" className="p-1.5 rounded-lg bg-neutral-900 border border-white/[0.06] text-neutral-400 hover:text-white transition-colors"><RefreshCw size={11}/></button>
              <button onClick={() => setIsLeftOpen(false)} title="Slide to Minimize Feed" className="p-1.5 rounded-lg bg-neutral-900 border border-white/[0.06] text-neutral-400 hover:text-white transition-colors flex items-center justify-center"><PanelLeftClose size={13}/></button>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-neutral-500"/>
              <input value={feedQ} onChange={e=>setFeedQ(e.target.value)} placeholder="Search posts..." className="w-full bg-[#181818] border border-white/[0.06] rounded-xl pl-7 pr-3 py-2 text-[12px] text-white placeholder-neutral-600 focus:outline-none focus:border-white/20"/>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {CATS.map(c=><button key={c} onClick={()=>setCat(c)} className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${cat===c?"bg-white text-black border-white":"text-neutral-500 border-white/[0.07] hover:text-white"}`}>{c}</button>)}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading?Array.from({length:4}).map((_,i)=><div key={i} className="h-48 rounded-xl bg-[#111] animate-pulse border border-white/[0.04]"/>):
              filtered.length===0?<div className="py-12 text-center text-neutral-600 text-[12px]">No posts match filters</div>:
              filtered.map(p=><PostCard key={p.id} post={p} active={focusPost?.id===p.id} onClick={()=>{setFocusPost(focusPost?.id===p.id?null:p);setDetailPost(p);setIsRightOpen(true);}}/>)
            }
          </div>
        </div>

        {/* ── CENTRE: Map ── */}
        <div className="flex-1 min-w-0 relative">
          <CommunityMap posts={filtered} focusPost={focusPost} onProfileOpen={(p)=>{
            // Convert post reporter to Citizen shape and open inline
            setProfile({user_id:p.reporter_id||p.id,full_name:p.reporter_profile?.full_name||'Citizen Reporter',phone:'',user_role:p.reporter_profile?.user_role||'citizen',operator_code:p.reporter_profile?.operator_code||p.id,is_approved:p.is_verified});
            setIsRightOpen(true);
          }}/>
          {!focusPost&&(
            <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-[#111]/90 border border-white/10 rounded-xl px-4 py-2 backdrop-blur pointer-events-none">
              <p className="text-neutral-400 text-[11px] text-center">Click a post to pin · Click a pin to view profile</p>
            </div>
          )}
          {/* Floating re-open buttons */}
          {!isLeftOpen && (
            <button
              onClick={() => setIsLeftOpen(true)}
              className="absolute left-4 bottom-8 z-[1000] flex items-center gap-2 bg-[#141414]/95 hover:bg-[#1c1c1e] border border-red-500/70 hover:border-red-500 text-white text-[12px] font-bold px-4 py-2.5 rounded-2xl transition-all shadow-[0_0_25px_rgba(239,68,68,0.3)] backdrop-blur-md"
              title="Open Live Feed"
            >
              <PanelLeftOpen size={15} className="text-red-400" />
              <span>Live Feed</span>
              <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center shadow">
                {posts.length}
              </span>
            </button>
          )}
          {!isRightOpen && (
            <button
              onClick={() => setIsRightOpen(true)}
              className="absolute right-4 bottom-8 z-[1000] flex items-center gap-2 bg-[#141414]/95 hover:bg-[#1c1c1e] border border-red-500/70 hover:border-red-500 text-white text-[12px] font-bold px-4 py-2.5 rounded-2xl transition-all shadow-[0_0_25px_rgba(239,68,68,0.3)] backdrop-blur-md"
              title="Open Citizen Lookup"
            >
              <PanelRightOpen size={15} className="text-red-400" />
              <span>Citizen Lookup</span>
            </button>
          )}
        </div>

        {/* ── RIGHT: Citizen Search / Inline Profile / Inline Post Detail ── */}
        <div
          className="flex-shrink-0 flex flex-col border-l border-white/[0.05] bg-[#0d0d0d] relative transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-10"
          style={{ width: isRightOpen ? "380px" : "0px", minWidth: isRightOpen ? "380px" : "0px", opacity: isRightOpen ? 1 : 0, overflow: isRightOpen ? "hidden" : "hidden" }}
        >
          {detailPost ? (
            <PostDetailModal
              post={detailPost}
              onClose={()=>setDetailPost(null)}
              onUpdate={updatePost}
              userRole={userRole}
              onDeletePost={onDeletePost}
              onBlockUser={onBlockUser}
            />
          ) : profile ? (
            <InlineProfile citizen={profile} onBack={()=>setProfile(null)}/>
          ) : (
            <>
              <div className="flex-shrink-0 p-4 border-b border-white/[0.05]">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white font-bold text-sm">Citizen Lookup</p>
                  <button onClick={() => setIsRightOpen(false)} title="Slide to Minimize Panel" className="p-1.5 rounded-lg bg-neutral-900 border border-white/[0.06] text-neutral-400 hover:text-white transition-colors flex items-center justify-center"><PanelRightClose size={13}/></button>
                </div>
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
  </>
  );
}
