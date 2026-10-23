import { useEffect, useMemo, useRef, useState } from "react";
import { Infinity as InfinityIcon, KeyRound, MessageSquare, Plus, Send, Settings2, ShieldCheck, FileUp, Download, Trash2, Square, RefreshCw, ExternalLink, Paperclip, FolderOpen, Pencil } from "lucide-react";
import CreditCard from "./components/CreditCard";
import CreditSettingsForm from "./components/CreditSettingsForm";
import OnboardingWizard from "./components/OnboardingWizard";
import { ArtifactContext, Markdown, ThinkingBlock, type ArtifactRequest } from "./components/MessageContent";
import MessageItem, { AttachmentChip, type Msg } from "./components/MessageItem";
import ToolsMenu, { type Tools } from "./components/ToolsMenu";
import ProjectModal, { type Project } from "./components/ProjectModal";
import PreferencesSection from "./components/PreferencesSection";
import McpSection from "./components/McpSection";
import ArtifactPanel from "./components/ArtifactPanel";
import { summarizeCredit, type CreditSettings, type UsageRow } from "./lib/credit";
import { costOf, formatUsd, priceHint } from "./lib/pricing";

type Attachment = NonNullable<Msg["attachments"]>[number];
type Chat = { id: string; title: string; messages: Msg[]; source?: string; projectId?: string; style?: string; tools?: Tools; container?: { id: string; expiresAt?: string } };
type Model = { id: string; displayName: string; createdAt?: string; maxTokens?: number; effortLevels: string[]; adaptiveThinking: boolean; imageInput: boolean; pdfInput: boolean };
type Pending = { chatId: string; requestId: string; text: string; thinking: string; activity: string };
type Prefs = { autoTitle: boolean; customStyle: string };
type Reply = Omit<Msg, "role" | "attachments" | "alternates" | "altIndex">;
const welcome: Chat = { id: "welcome", title: "はじめに", messages: [{ role: "assistant", content: "Claude Continuityへようこそ。APIキーを設定するとClaude APIと会話できます。左側からClaudeのエクスポートを読み込むと、対応する会話をこの画面で開けます。\n\n注意：インポートした会話は、続きを送信した時点で選択した文脈がAnthropic APIへ送信されます。" }] };
const EFFORT_LABELS: Record<string, string> = { low: "低", medium: "中", high: "高", xhigh: "より高", max: "最大" };
const STYLES: { id: string; label: string }[] = [
  { id: "standard", label: "標準" }, { id: "concise", label: "簡潔" }, { id: "detailed", label: "詳しく" }, { id: "explanatory", label: "説明調" }, { id: "custom", label: "カスタム" }
];
const DEFAULT_TITLES = new Set(["新しい会話", "はじめに"]);

function sortModels(models: Model[]): Model[] {
  const score = (id: string) => id.includes("opus") ? 0 : id.includes("sonnet") ? 1 : id.includes("haiku") ? 2 : 3;
  return models.filter(m => m.id).sort((a, b) => score(a.id) - score(b.id) || a.displayName.localeCompare(b.displayName));
}
function toUsageRows(rows: Awaited<ReturnType<typeof window.continuity.loadUsage>>): UsageRow[] {
  return rows.filter(row => row && typeof row.model === "string" && typeof row.createdAt === "string").map(row => ({
    model: row.model, createdAt: row.createdAt, inputTokens: Number(row.inputTokens) || 0, outputTokens: Number(row.outputTokens) || 0,
    cacheCreationInputTokens: Number(row.cacheCreationInputTokens) || 0, cacheReadInputTokens: Number(row.cacheReadInputTokens) || 0,
    webSearchRequests: Number(row.webSearchRequests) || 0, ...(row.source==="mcp"?{source:"mcp"}:{})
  }));
}
function snapshot(m: Msg): Reply {
  const { role: _role, attachments: _a, alternates: _alt, altIndex: _i, ...reply } = m;
  return reply;
}

export default function App() {
 const [chats,setChats]=useState<Chat[]>([welcome]);
 const [active,setActive]=useState("welcome");
 const [draft,setDraft]=useState("");
 const [pendingAttachments,setPendingAttachments]=useState<Attachment[]>([]);
 const [search,setSearch]=useState("");
 const [model,setModel]=useState("claude-sonnet-4-5");
 const [effort,setEffort]=useState("");
 const [availableModels,setAvailableModels]=useState<Model[]>([]);
 const [modelsLoading,setModelsLoading]=useState(false);
 const [key,setKey]=useState("");
 const [configured,setConfigured]=useState(false);
 const [settings,setSettings]=useState(false);
 const [pending,setPending]=useState<Pending|null>(null);
 const [status,setStatus]=useState("準備完了");
 const [loaded,setLoaded]=useState(false);
 const [lastUsage,setLastUsage]=useState<{inputTokens:number;outputTokens:number;costUsd:number|null}|null>(null);
 const [usageRows,setUsageRows]=useState<UsageRow[]>([]);
 const [credit,setCredit]=useState<CreditSettings|null>(null);
 const [onboarding,setOnboarding]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 const [projects,setProjects]=useState<Project[]>([]);
 const [projectFilter,setProjectFilter]=useState<string|null>(null);
 const [projectModal,setProjectModal]=useState<{project:Project;isNew:boolean}|null>(null);
 const [prefs,setPrefs]=useState<Prefs>({autoTitle:true,customStyle:""});
 const [artifact,setArtifact]=useState<ArtifactRequest|null>(null);
 const [dragging,setDragging]=useState(false);
 const pendingRef=useRef<Pending|null>(null);
 const messagesRef=useRef<HTMLElement>(null);
 const busy=pending!==null;
 const chat=chats.find(c=>c.id===active)??chats[0]??welcome;
 const chatProject=projects.find(p=>p.id===chat.projectId)??null;
 const currentModel=availableModels.find(m=>m.id===model);
 const usageTotal=useMemo(()=>usageRows.reduce((acc,row)=>({inputTokens:acc.inputTokens+row.inputTokens,outputTokens:acc.outputTokens+row.outputTokens,calls:acc.calls+1,mcpCalls:acc.mcpCalls+(row.source==="mcp"?1:0)}),{inputTokens:0,outputTokens:0,calls:0,mcpCalls:0}),[usageRows]);
 const summary=useMemo(()=>summarizeCredit(usageRows,credit,new Date(now)),[usageRows,credit,now]);

 useEffect(()=>{
   Promise.all([window.continuity.keyStatus(),window.continuity.loadChats(),window.continuity.loadUsage(),window.continuity.loadCredit(),window.continuity.loadProjects(),window.continuity.loadPrefs()])
    .then(([s,saved,usage,savedCredit,savedProjects,savedPrefs])=>{setConfigured(s.configured); if(saved.length){setChats(saved as Chat[]);setActive(saved[0].id);} setUsageRows(toUsageRows(usage)); setCredit(savedCredit); setOnboarding(!savedCredit?.onboardingDone); setProjects(savedProjects); setPrefs(savedPrefs); setLoaded(true);})
    .catch(e=>{setStatus("初期化エラー: "+err(e));setLoaded(true);});
   // Re-evaluate the credit cycle as time passes (day boundaries, expiry).
   const timer=window.setInterval(()=>setNow(Date.now()),60_000);
   const unsubscribe=window.continuity.onStream(event=>{
     const current=pendingRef.current;
     if(!current||current.requestId!==event.requestId)return;
     const next=event.kind==="activity"?{...current,activity:event.delta}:{...current,[event.kind]:current[event.kind]+event.delta,...(event.kind==="text"?{activity:""}:{})};
     pendingRef.current=next;setPending(next);
   });
   return ()=>{window.clearInterval(timer);unsubscribe();};
 },[]);
 async function refreshModels(announce=false){
   if(!configured){setSettings(true);setStatus("先にAnthropic APIキーを設定してください");return;}
   setModelsLoading(true);
   try{
     const sorted=sortModels(await window.continuity.listModels());
     setAvailableModels(sorted);
     setModel(current=>sorted.some(m=>m.id===current)?current:(sorted.find(m=>m.id.includes("opus"))?.id??sorted[0]?.id??current));
     setStatus(sorted.length?`${sorted.length}件の利用可能モデルを${announce?"更新":"取得"}しました`:"利用可能なモデルが見つかりませんでした");
   }catch(e){setStatus("モデル一覧取得エラー: "+err(e));}
   finally{setModelsLoading(false);}
 }
 useEffect(()=>{ if(configured) void refreshModels(); },[configured]);
 useEffect(()=>{
   // MCP usage is written by another process; pick it up when the window regains focus.
   const reload=()=>{window.continuity.loadUsage().then(rows=>setUsageRows(toUsageRows(rows))).catch(()=>{});};
   window.addEventListener("focus",reload);
   return ()=>window.removeEventListener("focus",reload);
 },[]);
 useEffect(()=>{ if(effort&&currentModel&&!currentModel.effortLevels.includes(effort)) setEffort(""); },[currentModel,effort]);
 useEffect(()=>{
   if(!loaded)return;
   const timer=window.setTimeout(()=>{window.continuity.saveChats(chats).catch(e=>setStatus("ローカル保存エラー: "+err(e)));},350);
   return ()=>window.clearTimeout(timer);
 },[chats,loaded]);
 useEffect(()=>{ const el=messagesRef.current; if(el) el.scrollTop=el.scrollHeight; },[active,chat.messages.length,pending?.text,pending?.thinking]);

 function patchChat(id:string,patch:(c:Chat)=>Chat){ setChats(cs=>cs.map(c=>c.id===id?patch(c):c)); }
 async function importExport(){
   try{
     const result=await window.continuity.chooseExport();
     if(!result)return;
     if(!result.count){setStatus("会話を認識できませんでした。エクスポート形式を確認してください。");alert("このファイルから会話を抽出できませんでした。JSON/ZIPの構造に合わせた対応が必要な可能性があります。");return;}
     setChats(cs=>{const existing=new Set(cs.map(c=>c.id));const incoming=result.conversations.filter(c=>!existing.has(c.id));const mapped=incoming.map(c=>({...c,title:c.title||"インポートした会話"}));if(mapped.length){setActive(mapped[0].id);setStatus(`${mapped.length}件の会話をインポートしました（${result.fileName}）`);return [...mapped,...cs];}setStatus("読み込んだ会話はすべて既に存在します。");return cs;});
   }catch(e){setStatus("インポートエラー: "+err(e));}
 }
 async function saveKey(){
   try{await window.continuity.saveApiKey(key.trim());setConfigured(true);setKey("");setSettings(false);setStatus("APIキーをOSの安全な保存領域に保存しました");}
   catch(e){setStatus(err(e));}
 }
 async function saveCredit(next:CreditSettings){ setCredit(await window.continuity.saveCredit(next)); }
 async function savePrefs(next:Prefs){ setPrefs(await window.continuity.savePrefs(next)); }
 async function saveProjects(next:Project[]){ setProjects(await window.continuity.saveProjects(next)); }
 async function finishOnboarding(next:CreditSettings,apiKey?:string){
   if(apiKey){await window.continuity.saveApiKey(apiKey);setConfigured(true);}
   await saveCredit(next);
   setOnboarding(false);
   setStatus("初期設定が完了しました");
 }
 async function skipOnboarding(){
   await saveCredit({plan:null,monthlyAmountUsd:0,resetDay:new Date().getDate(),onboardingDone:true});
   setOnboarding(false);
 }
 function addAttachments(result:{added:Attachment[];errors:string[]}){
   if(result.added.length) setPendingAttachments(list=>[...list,...result.added]);
   if(result.errors.length) setStatus("添付できませんでした: "+result.errors.join(" / "));
 }
 async function onPaste(e:React.ClipboardEvent){
   const files=Array.from(e.clipboardData.files);
   if(!files.length)return;
   e.preventDefault();
   for(const file of files) addAttachments(await window.continuity.addAttachmentData(file.name||`pasted-${Date.now()}.png`,new Uint8Array(await file.arrayBuffer())));
 }
 async function onDrop(e:React.DragEvent){
   e.preventDefault();setDragging(false);
   const files=Array.from(e.dataTransfer.files);
   if(files.length) addAttachments(await window.continuity.addAttachmentFiles(files));
 }

 /** Sends `history` (ending with a user turn) and appends or replaces the reply. */
 async function runReply(target:Chat,history:Msg[],mode:{kind:"append";retitle?:boolean}|{kind:"regenerate";previous:Msg}){
   if(!configured){setSettings(true);setStatus("先にAnthropic APIキーを設定してください");return;}
   const requestId=crypto.randomUUID();
   const start:Pending={chatId:target.id,requestId,text:"",thinking:"",activity:""};
   pendingRef.current=start;setPending(start);setStatus("Claudeに問い合わせ中…");
   const container=target.container&&(!target.container.expiresAt||Date.parse(target.container.expiresAt)>Date.now())?target.container.id:undefined;
   try{
     const response=await window.continuity.reply({requestId,model,effort:effort||undefined,style:target.style,projectId:target.projectId,tools:target.tools,containerId:container,
       messages:history.slice(-60).map(m=>({role:m.role,content:m.content,...(m.attachments?.length?{attachments:m.attachments}:{})}))});
     const cost=costOf(response.usage.model,response.usage);
     const reply:Reply={content:response.text,model:response.usage.model,...(response.thinking?{thinking:response.thinking}:{}),...(cost!=null?{costUsd:cost}:{}),...(response.aborted?{aborted:true}:{}),
       ...(response.citations.length?{citations:response.citations}:{}),...(response.files.length?{files:response.files}:{})};
     let next:Msg={role:"assistant",...reply};
     if(mode.kind==="regenerate"){
       const versions=mode.previous.alternates?.length?mode.previous.alternates:[snapshot(mode.previous)];
       next={...next,alternates:[...versions,reply],altIndex:versions.length};
     }
     patchChat(target.id,c=>({...c,messages:[...history,next],...(response.container?{container:response.container}:{})}));
     if(response.usage.inputTokens||response.usage.outputTokens){
       setUsageRows(rows=>[...rows,{...response.usage,createdAt:new Date().toISOString()}]);
       setLastUsage({inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens,costUsd:cost});
     }
     const costText=cost!=null?` · 推定 ${formatUsd(cost,4)}`:"";
     const searches=response.usage.webSearchRequests?` · 検索 ${response.usage.webSearchRequests}回`:"";
     const notices=response.notices.length?` · ${response.notices.join(" / ")}`:"";
     setStatus((response.aborted?`応答を停止しました${costText}`:`応答完了 · ${response.usage.inputTokens.toLocaleString()} input / ${response.usage.outputTokens.toLocaleString()} output tokens${searches}${costText}`)+notices);
     if(mode.kind==="append"&&mode.retitle&&prefs.autoTitle&&response.text&&!response.aborted) void autoTitle(target.id,history[history.length-1].content,response.text);
   }catch(e){
     // A failed regeneration keeps the previous answer; a failed new turn shows the error in place of a reply.
     const fallback:Msg=mode.kind==="regenerate"?mode.previous:{role:"assistant",content:"APIエラー: "+err(e)+"\n\nConsoleのクレジット残高、APIキー、利用可能モデルを確認してください。"};
     patchChat(target.id,c=>({...c,messages:[...history,fallback]}));
     setStatus(mode.kind==="regenerate"?"再生成に失敗しました: "+err(e):"APIリクエストに失敗しました");
   }
   finally{pendingRef.current=null;setPending(null);}
 }
 async function autoTitle(chatId:string,user:string,assistant:string){
   try{
     const result=await window.continuity.generateTitle(user,assistant);
     if(!result)return;
     if(result.title) patchChat(chatId,c=>({...c,title:result.title!}));
     setUsageRows(rows=>[...rows,{...result.usage,cacheCreationInputTokens:0,cacheReadInputTokens:0,createdAt:new Date().toISOString()}]);
   }catch{/* Titles are a convenience; keep the provisional title on failure. */}
 }
 async function send(){
   const text=draft.trim();if((!text&&!pendingAttachments.length)||busy)return;
   const current=chat;
   const userMsg:Msg={role:"user",content:text,...(pendingAttachments.length?{attachments:pendingAttachments}:{})};
   const history=[...current.messages,userMsg];
   const provisional=DEFAULT_TITLES.has(current.title);
   const title=provisional?(text||pendingAttachments[0]?.name||"新しい会話").slice(0,48):current.title;
   patchChat(current.id,c=>({...c,messages:history,title}));setDraft("");setPendingAttachments([]);
   await runReply({...current,title},history,{kind:"append",retitle:provisional});
 }
 function regenerate(index:number){
   const previous=chat.messages[index];
   if(busy||previous?.role!=="assistant")return;
   const history=chat.messages.slice(0,index);
   patchChat(chat.id,c=>({...c,messages:history}));
   void runReply(chat,history,{kind:"regenerate",previous});
 }
 function editAndResend(index:number,text:string){
   if(busy)return;
   const original=chat.messages[index];
   const history=[...chat.messages.slice(0,index),{...original,content:text}];
   patchChat(chat.id,c=>({...c,messages:history}));
   void runReply(chat,history,{kind:"append"});
 }
 function selectAlternate(index:number,alt:number){
   patchChat(chat.id,c=>({...c,messages:c.messages.map((m,i)=>{
     if(i!==index||!m.alternates?.[alt])return m;
     return {role:"assistant",...m.alternates[alt],alternates:m.alternates,altIndex:alt};
   })}));
 }
 async function saveFile(fileId:string,name:string){
   try{const result=await window.continuity.saveGeneratedFile(fileId,name);if(!result.canceled)setStatus(`保存しました: ${result.filePath}`);}
   catch(e){setStatus("ファイル保存エラー: "+err(e));}
 }
 function stop(){ if(pending) void window.continuity.abortReply(pending.requestId); }
 async function exportChat(){try{const result=await window.continuity.exportChat({fileName:chat.title.replace(/[^\p{L}\p{N} _-]/gu,"").slice(0,80)||"conversation",data:JSON.stringify(chat,null,2)});if(!result.canceled)setStatus("会話をJSONにエクスポートしました");}catch(e){setStatus("エクスポートエラー: "+err(e));}}
 function deleteChat(){if(busy){setStatus("応答中は削除できません。");return;}if(chats.length<=1){setStatus("最後の会話は削除できません。");return;}if(!window.confirm("この会話を端末内の履歴から削除しますか？"))return;const remaining=chats.filter(c=>c.id!==active);setChats(remaining);setActive(remaining[0].id);setStatus("会話を削除しました");}
 function newChat(){const id="chat-"+Date.now();setChats(cs=>[{id,title:"新しい会話",messages:[],...(projectFilter?{projectId:projectFilter}:{})},...cs]);setActive(id);setArtifact(null);}
 function newProject(){setProjectModal({project:{id:crypto.randomUUID(),name:"",instructions:"",knowledge:[],memory:false},isNew:true});}
 async function upsertProject(project:Project){ await saveProjects(projects.some(p=>p.id===project.id)?projects.map(p=>p.id===project.id?project:p):[...projects,project]); }
 function deleteProject(id:string){ void saveProjects(projects.filter(p=>p.id!==id)); setChats(cs=>cs.map(c=>c.projectId===id?{...c,projectId:undefined}:c)); if(projectFilter===id)setProjectFilter(null); }

 const hint=priceHint(model);
 const showPending=pending&&pending.chatId===chat.id;
 const query=search.toLowerCase();
 const visibleChats=chats.filter(c=>(!projectFilter||c.projectId===projectFilter)&&(c.title.toLowerCase().includes(query)||c.messages.some(m=>m.content.toLowerCase().includes(query))));
 const lastAssistant=chat.messages.length-1;
 return <ArtifactContext.Provider value={setArtifact}><div className="shell">
  <aside>
   <div className="brand"><span className="mark"><InfinityIcon size={19}/></span><div><b>Claude Continuity</b><small>LOCAL WORKSPACE</small></div></div>
   <button className="btn-primary new" onClick={newChat}><Plus size={16}/> 新しい会話</button>
   <button className="nav" onClick={()=>void importExport()}><FileUp size={16}/> Claudeエクスポートを読み込む</button>
   <CreditCard summary={summary} totals={usageTotal} onConfigure={()=>setOnboarding(true)}/>
   <div className="label row">プロジェクト<button className="icon-btn" onClick={newProject} aria-label="プロジェクトを作成" title="プロジェクトを作成"><Plus size={14}/></button></div>
   <div className="projectlist">
    {projects.length===0&&<p className="hint tight">指示とナレッジをまとめて、会話ごとに自動で付けられます。</p>}
    {projects.map(p=><div key={p.id} className={"projectlink "+(projectFilter===p.id?"active":"")}>
      <button className="chatlink" onClick={()=>setProjectFilter(f=>f===p.id?null:p.id)}><FolderOpen size={15}/><span>{p.name}</span><small>{chats.filter(c=>c.projectId===p.id).length}</small></button>
      <button className="icon-btn" onClick={()=>setProjectModal({project:p,isNew:false})} aria-label={`${p.name} を編集`}><Pencil size={13}/></button>
    </div>)}
   </div>
   <div className="label">{projectFilter?`${projects.find(p=>p.id===projectFilter)?.name??""} の会話`:"会話履歴"} · {visibleChats.length}</div>
   <input className="chat-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="会話を検索…" aria-label="会話を検索"/>
   <div className="chatlist">{visibleChats.map(c=><button key={c.id} className={"chatlink "+(c.id===active?"active":"")} onClick={()=>{setActive(c.id);setArtifact(null);}}><MessageSquare size={15}/><span>{c.title}</span></button>)}</div>
   <div className="bottom"><button className="nav" onClick={()=>setSettings(true)}><Settings2 size={16}/> API設定</button><div className="secure"><ShieldCheck size={15}/> ローカル優先設計</div></div>
  </aside>
  <main className={dragging?"dragging":""} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={e=>{if(e.currentTarget===e.target)setDragging(false);}} onDrop={e=>void onDrop(e)}>
   <header><span className="crumbs">Workspace /
     <select className="project-select" value={chat.projectId??""} onChange={e=>patchChat(chat.id,c=>({...c,projectId:e.target.value||undefined}))} aria-label="この会話のプロジェクト">
      <option value="">プロジェクトなし</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
     / <b>{chat.title}</b></span>
    <div className="header-actions"><button className="nav" onClick={()=>void exportChat()} title="会話をJSONで保存"><Download size={15}/> JSON保存</button><button className="nav" onClick={deleteChat} title="この会話を削除"><Trash2 size={15}/></button><button className="nav header-status" onClick={()=>setSettings(true)}><span className={"dot "+(configured?"green":"")}/>{configured?"API設定済み":"API未設定"} <Settings2 size={16}/></button></div></header>
   <div className="workspace">
    <div className="conversation">
     <section className="messages" ref={messagesRef}>
      {chat.messages.length===0&&!showPending&&<div className="empty"><InfinityIcon size={30}/><h1>{chatProject?chatProject.name:"会話を続ける"}</h1><p>{chatProject?"このプロジェクトの指示とナレッジが自動で付きます。":"インポートした履歴を選ぶか、ここから新しい会話を始めます。"}</p>{!chatProject&&<button className="btn-secondary" onClick={()=>void importExport()}><FileUp size={16}/> Claudeのエクスポートを読み込む</button>}</div>}
      {chat.messages.map((m,i)=><MessageItem key={`${chat.id}-${i}`} message={m} isLast={i===lastAssistant&&!showPending} busy={busy}
        onRegenerate={()=>regenerate(i)} onEdit={text=>editAndResend(i,text)} onSelectAlternate={alt=>selectAlternate(i,alt)} onSaveFile={(id,name)=>void saveFile(id,name)}/>)}
      {showPending&&<article className="message assistant pending"><div className="avatar"><InfinityIcon size={16}/></div><div className="msgbody"><b>Claude</b>
        <ThinkingBlock text={pending.thinking} live={!pending.text}/>
        {pending.activity&&<p className="activity">{pending.activity}</p>}
        {pending.text?<Markdown text={pending.text}/>:!pending.thinking&&!pending.activity&&<p className="busy">Claudeが応答中…</p>}
      </div></article>}
     </section>
     <footer><div className="composer">
      {pendingAttachments.length>0&&<div className="attachment-row">{pendingAttachments.map(a=><AttachmentChip key={a.id} attachment={a} onRemove={()=>setPendingAttachments(list=>list.filter(x=>x.id!==a.id))}/>)}</div>}
      <textarea value={draft} onChange={e=>setDraft(e.target.value)} onPaste={e=>void onPaste(e)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} placeholder="Claudeにメッセージ…（Enterで送信、Shift+Enterで改行。ファイルはドラッグ＆ドロップか貼り付けでも添付できます）"/>
      <div className="composer-toolbar">
       <button className="btn-secondary small icon-only" onClick={()=>void window.continuity.pickAttachments().then(addAttachments)} disabled={busy} title="ファイルを添付" aria-label="ファイルを添付"><Paperclip size={14}/></button>
       <ToolsMenu tools={chat.tools??{}} onChange={tools=>patchChat(chat.id,c=>({...c,tools}))} disabled={busy} projectMemory={chatProject?.memory}/>
       <select id="style-select" aria-label="スタイル" value={chat.style??"standard"} onChange={e=>patchChat(chat.id,c=>({...c,style:e.target.value}))} disabled={busy}>
        {STYLES.filter(s=>s.id!=="custom"||prefs.customStyle.trim()).map(s=><option key={s.id} value={s.id}>スタイル: {s.label}</option>)}</select>
       <select id="model-select" aria-label="モデル" value={model} onChange={e=>setModel(e.target.value)} disabled={busy||modelsLoading}>{availableModels.length?availableModels.map(m=><option key={m.id} value={m.id}>{m.displayName}</option>):<option value={model}>{modelsLoading?"モデルを取得中…":model}</option>}</select>
       {currentModel&&currentModel.effortLevels.length>0&&<select id="effort-select" aria-label="思考の深さ" value={effort} onChange={e=>setEffort(e.target.value)} disabled={busy} title="思考の深さ：深いほど回答の質が上がり、クレジットを多く使います">
         <option value="">思考: 既定</option>
         {currentModel.effortLevels.map(level=><option key={level} value={level}>思考: {EFFORT_LABELS[level]??level}</option>)}
        </select>}
       <button className="icon-btn" onClick={()=>void refreshModels(true)} disabled={modelsLoading||busy} title="APIキーで利用できるモデルを再取得" aria-label="モデル一覧を更新"><RefreshCw size={13}/></button>
      </div>
      <div className="composer-meta"><span><KeyRound size={12}/>{configured?"APIキー保存済み":"APIキーを設定してください"}</span>{hint&&<span>{hint}</span>}<span className="spacer"/>
       {busy?<button className="btn-secondary" onClick={stop}><Square size={13}/> 停止</button>:<button className="btn-primary" onClick={()=>void send()} disabled={!draft.trim()&&!pendingAttachments.length}><Send size={15}/> 送信</button>}</div>
     </div><div className="status"><span>{status}</span><span>{lastUsage?`直近の応答: ${(lastUsage.inputTokens+lastUsage.outputTokens).toLocaleString()} tokens${lastUsage.costUsd!=null?` · ${formatUsd(lastUsage.costUsd,4)}`:""}`:"会話はこの端末に自動保存されます"}</span></div></footer>
    </div>
    {artifact&&<ArtifactPanel artifact={artifact} onClose={()=>setArtifact(null)}/>}
   </div>
   {dragging&&<div className="drop-hint">ここにドロップして添付</div>}
  </main>
  {settings&&<div className="overlay" onClick={()=>setSettings(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSettings(false)} aria-label="閉じる">×</button>
   <h2>Anthropic API設定</h2><p className="muted">Anthropic Consoleで発行したAPIキーを入力してください。</p>
   <label className="field"><span>API Key</span><input className="text-input" type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder={configured?"保存済み。変更する場合のみ入力":"sk-ant-…"} autoComplete="off"/></label>
   <div className="hint"><ShieldCheck size={13}/> APIキーはOSの安全な保存領域に暗号化して保存します。 <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">キーを作成 <ExternalLink size={11}/></a></div>
   <div className="actions"><button className="btn-secondary" onClick={()=>setSettings(false)}>キャンセル</button><button className="btn-primary" disabled={!key.trim()} onClick={()=>void saveKey()}>保存</button></div>
   <CreditSettingsForm value={credit} onSave={saveCredit}/>
   <PreferencesSection prefs={prefs} onSave={savePrefs}/>
   <McpSection/>
   <div className="credit-guide"><b>Maxプランの月間APIクレジットを使う</b><p>Max 5x は月 $100、Max 20x は月 $200 相当。請求サイクル末で失効し、繰り越されません。Claude Code では使えません（API・Agent SDK・Playground が対象）。</p><a href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">公式設定手順</a><a href="https://platform.claude.com/settings/billing" target="_blank" rel="noreferrer">ConsoleのBillingを開く</a><button className="link" onClick={()=>{setSettings(false);setOnboarding(true);}}>初期設定をやり直す</button></div>
   <small className="fineprint">このアプリはAPIキーでAnthropic APIを呼び出します。リンク済み組織のクレジットが利用されます。購入済み残高への自動リロードはこのアプリから設定・変更しません。送信した会話文脈と添付ファイルはAnthropic APIへ送られます。</small></div></div>}
  {projectModal&&<ProjectModal project={projectModal.project} isNew={projectModal.isNew} onSave={upsertProject} onDelete={()=>deleteProject(projectModal.project.id)} onClose={()=>setProjectModal(null)}/>}
  {onboarding&&loaded&&<OnboardingWizard keyConfigured={configured} onFinish={finishOnboarding} onSkip={skipOnboarding}/>}
 </div></ArtifactContext.Provider>;
}
function err(e:unknown){return (e instanceof Error?e.message:String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/,"");}
