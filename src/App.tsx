import { useEffect, useMemo, useRef, useState } from "react";
import type { ConnectorView } from "./lib/connectors";
import { ArrowDown, ArrowUpRight, Ghost, Plus, Shapes, FileUp, FolderOpen, MessagesSquare, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import CreditCard from "./components/CreditCard";
import LogoMark, { LogoGlyph } from "./components/LogoMark";
import OnboardingWizard from "./components/OnboardingWizard";
import { ArtifactContext, Markdown, ThinkingBlock, type ArtifactRequest } from "./components/MessageContent";
import MessageItem, { type Msg } from "./components/MessageItem";
import Composer, { type ComposerHandle } from "./components/Composer";
import { type Tools } from "./components/ToolsMenu";
import ProjectModal, { type Project } from "./components/ProjectModal";
import SettingsPage, { type SettingsTab } from "./components/SettingsPage";
import Toaster, { type Toast } from "./components/Toaster";
import ChatsPage from "./components/ChatsPage";
import { ProjectPage, ProjectsPage } from "./components/ProjectsPage";
import ShortcutsDialog from "./components/ShortcutsDialog";
import ArtifactsPage, { type ArtifactEntry } from "./components/ArtifactsPage";
import { artifactKey, extractArtifacts } from "./lib/artifacts";
import { statusText } from "./components/UpdateSection";
import type { UpdateStatus } from "./lib/update";
import HandoffDialog from "./components/HandoffDialog";
import ArtifactPanel from "./components/ArtifactPanel";
import ChatMenu from "./components/ChatMenu";
import AccountMenu from "./components/AccountMenu";
import { ConfirmDialog, RenameDialog } from "./components/Dialog";
import { PLAN_LABELS, summarizeCredit, type CreditSettings, type UsageRow } from "./lib/credit";
import { costOf, formatUsd, priceHint } from "./lib/pricing";
import { DEFAULT_PREFS, type Prefs } from "./lib/prefs";
import { CONTINUE_PROMPT, mergeContinuation } from "./lib/continue";
import { plainPreview } from "./lib/time";
import { editUserMessage, selectUserVersion } from "./lib/versions";

type Attachment = NonNullable<Msg["attachments"]>[number];
type Chat = { id: string; title: string; messages: Msg[]; source?: string; projectId?: string; starred?: boolean; updatedAt?: string; incognito?: boolean; style?: string; tools?: Tools; container?: { id: string; expiresAt?: string } };
type Model = { id: string; displayName: string; createdAt?: string; maxTokens?: number; effortLevels: string[]; adaptiveThinking: boolean; imageInput: boolean; pdfInput: boolean };
type Pending = { chatId: string; requestId: string; text: string; thinking: string; activity: string; startedAt: number; firstTextAt?: number };
type Reply = Omit<Msg, "role" | "attachments" | "alternates" | "altIndex">;
const welcome: Chat = { id: "welcome", title: "はじめに", messages: [{ role: "assistant", content: "Claude Continuityへようこそ。APIキーを設定するとClaude APIと会話できます。左側からClaudeのエクスポートを読み込むと、対応する会話をこの画面で開けます。\n\n注意：インポートした会話は、続きを送信した時点で選択した文脈がAnthropic APIへ送信されます。" }] };
const EFFORT_LABELS: Record<string, string> = { low: "低", medium: "中", high: "高", xhigh: "より高", max: "最大" };
const STYLES: { id: string; label: string }[] = [
  { id: "standard", label: "標準" }, { id: "concise", label: "簡潔" }, { id: "detailed", label: "詳しく" }, { id: "explanatory", label: "説明調" }, { id: "custom", label: "カスタム" }
];
const DEFAULT_TITLES = new Set(["新しい会話", "はじめに"]);
const SUGGESTIONS = [
  { label: "要約する", prompt: "次の文章を、要点を3つにまとめてください。\n\n" },
  { label: "書く", prompt: "次の内容でメールの下書きを書いてください：" },
  { label: "コード", prompt: "次の処理をするコードを書いてください：" },
  { label: "学ぶ", prompt: "初心者向けに、次のことを例を交えて説明してください：" },
  { label: "考える", prompt: "次のテーマについて、異なる視点からアイデアを5つ出してください：" }
];
const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const KEYS = IS_MAC ? { newChat: "⇧⌘O", search: "⌘K" } : { newChat: "Ctrl+Shift+O", search: "Ctrl+K" };
function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 5 ? "夜更かしですね" : h < 11 ? "おはようございます" : h < 18 ? "こんにちは" : "こんばんは";
}

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
 const [configured,setConfigured]=useState(false);
 const [settings,setSettings]=useState<SettingsTab|null>(null);
 const [view,setView]=useState<"chat"|"chats"|"projects"|"project"|"artifacts">("chat");
 const [openProject,setOpenProject]=useState<string|null>(null);
 const [shortcuts,setShortcuts]=useState(false);
 const [toasts,setToasts]=useState<Toast[]>([]);
 const [pending,setPending]=useState<Pending|null>(null);
 const [status,setStatus]=useState("準備完了");
 const [loaded,setLoaded]=useState(false);
 const [lastUsage,setLastUsage]=useState<{inputTokens:number;outputTokens:number;costUsd:number|null}|null>(null);
 const [usageRows,setUsageRows]=useState<UsageRow[]>([]);
 const [credit,setCredit]=useState<CreditSettings|null>(null);
 const [onboarding,setOnboarding]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 const [projects,setProjects]=useState<Project[]>([]);
 const [projectModal,setProjectModal]=useState<{project:Project;isNew:boolean}|null>(null);
 const [prefs,setPrefs]=useState<Prefs>(DEFAULT_PREFS);
 const [artifact,setArtifact]=useState<ArtifactRequest|null>(null);
 const [dragging,setDragging]=useState(false);
 const [sidebarOpen,setSidebarOpen]=useState(true);
 const [atBottom,setAtBottom]=useState(true);
 const [renaming,setRenaming]=useState<string|null>(null);
 const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
 const [confirmBulk,setConfirmBulk]=useState<string[]|null>(null);
 const [handoff,setHandoff]=useState(false);
 const [connectors,setConnectors]=useState<ConnectorView[]>([]);
 const [update,setUpdate]=useState<UpdateStatus>({state:"idle"});
 const [updateDismissed,setUpdateDismissed]=useState("");
 const pendingRef=useRef<Pending|null>(null);
 const composerRef=useRef<ComposerHandle>(null);
 const searchRef=useRef<HTMLInputElement>(null);
 const messagesRef=useRef<HTMLElement>(null);
 const busy=pending!==null;
 const chat=chats.find(c=>c.id===active)??chats[0]??welcome;
 const chatProject=projects.find(p=>p.id===chat.projectId)??null;
 const currentModel=availableModels.find(m=>m.id===model);
 const usageTotal=useMemo(()=>usageRows.reduce((acc,row)=>({inputTokens:acc.inputTokens+row.inputTokens,outputTokens:acc.outputTokens+row.outputTokens,calls:acc.calls+1,mcpCalls:acc.mcpCalls+(row.source==="mcp"?1:0)}),{inputTokens:0,outputTokens:0,calls:0,mcpCalls:0}),[usageRows]);
 // Artifacts in the open chat, oldest first; same kind + title are versions of one artifact.
 const chatArtifacts=useMemo(()=>chat.messages.filter(m=>m.role==="assistant").flatMap(m=>extractArtifacts(m.content)),[chat.messages]);
 const artifactVersions=artifact?chatArtifacts.filter(a=>artifactKey(a)===artifactKey(artifact)):[];
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
     const next=event.kind==="activity"?{...current,activity:event.delta}:{...current,[event.kind]:current[event.kind]+event.delta,...(event.kind==="text"?{activity:"",firstTextAt:current.firstTextAt??Date.now()}:{})};
     pendingRef.current=next;setPending(next);
   });
   const offUpdate=window.continuity.onUpdateStatus(setUpdate);
   window.continuity.listConnectors().then(setConnectors).catch(()=>{});
   return ()=>{window.clearInterval(timer);unsubscribe();offUpdate();};
 },[]);
 async function refreshModels(announce=false){
   if(!configured){setSettings("api");setStatus("先にAnthropic APIキーを設定してください");return;}
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
 // When a new reply rewrites the open artifact, follow it to the newest version, as the Claude apps do.
 useEffect(()=>{
   if(!artifact)return;
   const same=chatArtifacts.filter(a=>artifactKey(a)===artifactKey(artifact));
   const newest=same[same.length-1];
   if(newest&&newest.code!==artifact.code&&!same.slice(0,-1).some(a=>a.code===artifact.code)) return;
   if(newest&&newest.code!==artifact.code) setArtifact(newest);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[chatArtifacts.length]);
 useEffect(()=>{
   // Resolve the theme here rather than trusting the OS bridge: "system" follows prefers-color-scheme, the others are fixed.
   const media=window.matchMedia("(prefers-color-scheme: dark)");
   const apply=()=>{document.documentElement.dataset.theme=prefs.theme==="system"?(media.matches?"dark":"light"):prefs.theme;};
   apply();
   if(prefs.theme!=="system")return;
   media.addEventListener("change",apply);
   return ()=>media.removeEventListener("change",apply);
 },[prefs.theme]);
 useEffect(()=>{
   // MCP usage is written by another process; pick it up when the window regains focus.
   const reload=()=>{window.continuity.loadUsage().then(rows=>setUsageRows(toUsageRows(rows))).catch(()=>{});};
   window.addEventListener("focus",reload);
   return ()=>window.removeEventListener("focus",reload);
 },[]);
 useEffect(()=>{ if(effort&&currentModel&&!currentModel.effortLevels.includes(effort)) setEffort(""); },[currentModel,effort]);
 useEffect(()=>{
   if(!loaded)return;
   const timer=window.setTimeout(()=>{window.continuity.saveChats(chats.filter(c=>!c.incognito)).catch(e=>setStatus("ローカル保存エラー: "+err(e)));},350);
   return ()=>window.clearTimeout(timer);
 },[chats,loaded]);
 useEffect(()=>{ const el=messagesRef.current; if(el&&atBottom) el.scrollTop=el.scrollHeight; },[chat.messages.length,pending?.text,pending?.thinking]);
 useEffect(()=>{ const el=messagesRef.current; if(el){el.scrollTop=el.scrollHeight;setAtBottom(true);} composerRef.current?.focus(); },[active]);
 // An incognito chat exists only while it is open: leaving it discards it.
 useEffect(()=>{ setChats(cs=>cs.some(c=>c.incognito&&c.id!==active)?cs.filter(c=>!c.incognito||c.id===active):cs); },[active]);
 function scrollToBottom(){ const el=messagesRef.current; if(el) el.scrollTo({top:el.scrollHeight,behavior:"smooth"}); }
 useEffect(()=>{
   // Shortcuts modeled on the Claude apps: new chat, search, stop/close.
   const onKey=(e:KeyboardEvent)=>{
     const mod=e.metaKey||e.ctrlKey;
     if(mod&&e.shiftKey&&e.key.toLowerCase()==="o"){e.preventDefault();newChat();}
     else if(mod&&e.shiftKey&&(e.key==="?"||e.code==="Slash")){e.preventDefault();setShortcuts(true);}
     else if(mod&&e.shiftKey&&e.key.toLowerCase()==="s"){e.preventDefault();setSidebarOpen(v=>!v);}
     else if(mod&&!e.shiftKey&&e.key.toLowerCase()==="k"){e.preventDefault();setSidebarOpen(true);setTimeout(()=>searchRef.current?.focus(),0);}
     else if(mod&&e.key==="/"){e.preventDefault();composerRef.current?.focus();}
     else if(e.key==="Escape"){
       if(pendingRef.current) void window.continuity.abortReply(pendingRef.current.requestId);
       else if(artifact) setArtifact(null);
       else if(projectModal) setProjectModal(null);
     }
   };
   window.addEventListener("keydown",onKey);
   return ()=>window.removeEventListener("keydown",onKey);
 });

 function patchChat(id:string,patch:(c:Chat)=>Chat){ setChats(cs=>cs.map(c=>c.id===id?patch(c):c)); }
 async function importExport(){
   try{
     const result=await window.continuity.chooseExport();
     if(!result)return;
     if(!result.count){setStatus("会話を認識できませんでした。エクスポート形式を確認してください。");alert("このファイルから会話を抽出できませんでした。JSON/ZIPの構造に合わせた対応が必要な可能性があります。");return;}
     setChats(cs=>{const existing=new Set(cs.map(c=>c.id));const incoming=result.conversations.filter(c=>!existing.has(c.id));const mapped=incoming.map(c=>({...c,title:c.title||"インポートした会話"}));if(mapped.length){setActive(mapped[0].id);setView("chat");setStatus(`${mapped.length}件の会話をインポートしました（${result.fileName}）`);toast(`${mapped.length}件の会話を読み込みました`);return [...mapped,...cs];}setStatus("読み込んだ会話はすべて既に存在します。");return cs;});
   }catch(e){setStatus("インポートエラー: "+err(e));toast("読み込みに失敗しました: "+err(e),"error");}
 }
 function toast(text:string,kind:Toast["kind"]="ok"){
   const id=Date.now()+Math.random();
   setToasts(list=>[...list.slice(-2),{id,text,kind}]);
   window.setTimeout(()=>setToasts(list=>list.filter(t=>t.id!==id)),kind==="error"?6000:3200);
 }
 async function saveKey(apiKey:string){ await window.continuity.saveApiKey(apiKey);setConfigured(true);setStatus("APIキーをOSの安全な保存領域に保存しました");toast("API キーを保存しました"); }
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
 async function runReply(target:Chat,history:Msg[],mode:{kind:"append";retitle?:boolean}|{kind:"regenerate";previous:Msg}|{kind:"continue";previous:Msg}){
   if(!configured){setSettings("api");setStatus("先にAnthropic APIキーを設定してください");return;}
   const requestId=crypto.randomUUID();
   const start:Pending={chatId:target.id,requestId,text:"",thinking:"",activity:"",startedAt:Date.now()};
   pendingRef.current=start;setPending(start);setStatus("Claudeに問い合わせ中…");
   const container=target.container&&(!target.container.expiresAt||Date.parse(target.container.expiresAt)>Date.now())?target.container.id:undefined;
   try{
     const response=await window.continuity.reply({requestId,model,effort:effort||undefined,style:target.style,projectId:target.projectId,tools:target.incognito?{...target.tools,memory:false}:target.tools,containerId:container,chatId:target.id,incognito:!!target.incognito,
       messages:history.slice(-2000).map(m=>({role:m.role,content:m.content,...(m.attachments?.length?{attachments:m.attachments}:{})}))});
     const cost=costOf(response.usage.model,response.usage);
     const thoughtUntil=pendingRef.current?.firstTextAt??Date.now();
     const reply:Reply={content:response.text,model:response.usage.model,...(response.thinking?{thinking:response.thinking,thinkingSeconds:(thoughtUntil-start.startedAt)/1000}:{}),...(cost!=null?{costUsd:cost}:{}),...(response.aborted?{aborted:true}:{}),
       ...(response.citations.length?{citations:response.citations}:{}),...(response.files.length?{files:response.files}:{}),
       ...(response.steps.length?{steps:response.steps}:{}),...(response.stopReason?{stopReason:response.stopReason}:{})};
     let next:Msg={role:"assistant",...reply};
     // history = [..., partial reply, synthetic "continue" turn]; the continuation is merged into the partial reply.
     const kept=mode.kind==="continue"?history.slice(0,-2):history;
     if(mode.kind==="continue") next=mergeContinuation(mode.previous,reply);
     if(mode.kind==="regenerate"){
       const versions=mode.previous.alternates?.length?mode.previous.alternates:[snapshot(mode.previous)];
       next={...next,alternates:[...versions,reply],altIndex:versions.length};
     }
     patchChat(target.id,c=>({...c,messages:[...kept,next],updatedAt:new Date().toISOString(),...(response.container?{container:response.container}:{})}));
     setAtBottom(true);
     if(response.usage.inputTokens||response.usage.outputTokens){
       setUsageRows(rows=>[...rows,{...response.usage,createdAt:new Date().toISOString()}]);
       setLastUsage({inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens,costUsd:cost});
     }
     const costText=cost!=null?` · 推定 ${formatUsd(cost,4)}`:"";
     const searches=response.usage.webSearchRequests?` · 検索 ${response.usage.webSearchRequests}回`:"";
     const notices=response.notices.length?` · ${response.notices.join(" / ")}`:"";
     setStatus((response.aborted?`応答を停止しました${costText}`:`応答完了 · ${response.usage.inputTokens.toLocaleString()} input / ${response.usage.outputTokens.toLocaleString()} output tokens${searches}${costText}`)+notices);
     if(prefs.notifyOnReply&&!response.aborted&&!document.hasFocus()&&typeof Notification!=="undefined"){
       // The body is left out for incognito chats so nothing private lingers in the OS notification center.
       const note=new Notification(target.incognito?"Claude が回答しました":target.title,{body:target.incognito?"シークレットチャット":(plainPreview(response.text,120)||"回答が完了しました")});
       note.onclick=()=>{void window.continuity.focusWindow();setActive(target.id);setView("chat");};
     }
     if(mode.kind==="append"&&mode.retitle&&prefs.autoTitle&&!target.incognito&&response.text&&!response.aborted) void autoTitle(target.id,history[history.length-1].content,response.text);
   }catch(e){
     // A failed regeneration keeps the previous answer; a failed new turn shows the error in place of a reply.
     const tooLong=/prompt is too long|too many (input )?tokens|context (window|length)/i.test(err(e));
     const hint=tooLong?"会話や添付が長すぎて、モデルが扱える量を超えました。添付を減らすか、新しい会話で続けてください（右上の「Claude で続ける」の要約を新しい会話に貼る方法もあります）。":"Consoleのクレジット残高、APIキー、利用可能モデルを確認してください。";
     const fallback:Msg=mode.kind==="append"?{role:"assistant",content:"APIエラー: "+err(e)+"\n\n"+hint}:mode.previous;
     patchChat(target.id,c=>({...c,messages:[...(mode.kind==="continue"?history.slice(0,-2):history),fallback]}));
     setStatus(mode.kind==="regenerate"?"再生成に失敗しました: "+err(e):mode.kind==="continue"?"続きの生成に失敗しました: "+err(e):"APIリクエストに失敗しました");
     if(mode.kind!=="append") toast((mode.kind==="regenerate"?"再生成":"続きの生成")+"に失敗しました: "+err(e),"error");
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
   patchChat(current.id,c=>({...c,messages:history,title,updatedAt:new Date().toISOString()}));setDraft("");setPendingAttachments([]);
   await runReply({...current,title},history,{kind:"append",retitle:provisional});
 }
 function continueReply(index:number){
   const previous=chat.messages[index];
   if(busy||previous?.role!=="assistant")return;
   const history:Msg[]=[...chat.messages.slice(0,index+1),{role:"user",content:CONTINUE_PROMPT}];
   void runReply(chat,history,{kind:"continue",previous});
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
   const history=editUserMessage(chat.messages,index,text);
   patchChat(chat.id,c=>({...c,messages:history}));
   void runReply(chat,history,{kind:"append"});
 }
 function selectVersion(index:number,version:number){
   if(busy)return;
   patchChat(chat.id,c=>({...c,messages:selectUserVersion(c.messages,index,version)}));
 }
 function selectAlternate(index:number,alt:number){
   patchChat(chat.id,c=>({...c,messages:c.messages.map((m,i)=>{
     if(i!==index||!m.alternates?.[alt])return m;
     return {role:"assistant",...m.alternates[alt],alternates:m.alternates,altIndex:alt};
   })}));
 }
 async function saveFile(fileId:string,name:string){
   try{const result=await window.continuity.saveGeneratedFile(fileId,name);if(!result.canceled){setStatus(`保存しました: ${result.filePath}`);toast(`${name} を保存しました`);}}
   catch(e){setStatus("ファイル保存エラー: "+err(e));toast("ファイルを保存できませんでした: "+err(e),"error");}
 }
 function stop(){ if(pending) void window.continuity.abortReply(pending.requestId); }
 async function exportChat(id=active){const target=chats.find(c=>c.id===id);if(!target)return;try{const result=await window.continuity.exportChat({fileName:target.title.replace(/[^\p{L}\p{N} _-]/gu,"").slice(0,80)||"conversation",data:JSON.stringify(target,null,2)});if(!result.canceled){setStatus("会話をJSONにエクスポートしました");toast("JSON に書き出しました");}}catch(e){setStatus("エクスポートエラー: "+err(e));toast("書き出しに失敗しました: "+err(e),"error");}}
 async function exportHtml(id:string){
   const target=chats.find(c=>c.id===id);if(!target)return;
   try{
     // Rendered on demand so react-dom/server is only loaded when someone exports.
     const { chatToHtml }=await import("./lib/exportHtml");
     const result=await window.continuity.exportChat({fileName:target.title.replace(/[^\p{L}\p{N} _-]/gu,"").slice(0,80)||"conversation",data:chatToHtml(target),format:"html"});
     if(!result.canceled)toast("HTML に書き出しました。ブラウザで開いて共有できます");
   }catch(e){toast("書き出しに失敗しました: "+err(e),"error");}
 }
 function requestDelete(id:string){if(busy){setStatus("応答中は削除できません。");return;}if(chats.length<=1){setStatus("最後の会話は削除できません。");return;}setConfirmDelete(id);}
 function deleteChat(id:string){const remaining=chats.filter(c=>c.id!==id);if(!remaining.length)return;setChats(remaining);if(id===active){setActive(remaining[0].id);setArtifact(null);}setStatus("会話を削除しました");toast("会話を削除しました");}
 function deleteMany(ids:string[]){
   if(busy){toast("応答中は削除できません","error");return;}
   const drop=new Set(ids);
   const remaining=chats.filter(c=>!drop.has(c.id));
   const next=remaining.length?remaining:[{id:"chat-"+Date.now(),title:"新しい会話",messages:[]} as Chat];
   setChats(next);
   if(drop.has(active)){setActive(next[0].id);setArtifact(null);}
   toast(`${ids.length} 件の会話を削除しました`);
 }
 function chatMenu(c:Chat,variant:"row"|"title"){
   return <ChatMenu title={c.title} starred={!!c.starred} variant={variant} projects={projects} projectId={c.projectId}
     onStar={()=>patchChat(c.id,x=>({...x,starred:!x.starred}))} onRename={()=>setRenaming(c.id)} onExport={()=>void exportChat(c.id)} onExportHtml={()=>void exportHtml(c.id)}
     onDelete={()=>requestDelete(c.id)} onMoveProject={id=>patchChat(c.id,x=>({...x,projectId:id}))}/>;
 }
 function newChat(projectId?:string){
   // Reuse an untouched empty chat instead of stacking blank ones, as the Claude apps do.
   const blank=chats.find(c=>c.messages.length===0&&!c.incognito&&c.title==="新しい会話"&&(c.projectId??null)===(projectId??null));
   if(blank){setActive(blank.id);}
   else{const id="chat-"+Date.now();setChats(cs=>[{id,title:"新しい会話",messages:[],...(projectId?{projectId}:{})},...cs]);setActive(id);}
   setArtifact(null);setView("chat");setTimeout(()=>composerRef.current?.focus(),0);
 }
 function newProject(){setProjectModal({project:{id:crypto.randomUUID(),name:"",instructions:"",knowledge:[],memory:false},isNew:true});}
 async function upsertProject(project:Project){
   const exists=projects.some(p=>p.id===project.id);
   await saveProjects(exists?projects.map(p=>p.id===project.id?project:p):[...projects,project]);
   if(!exists){setOpenProject(project.id);setView("project");toast("プロジェクトを作成しました");}
 }
 function deleteProject(id:string){ void saveProjects(projects.filter(p=>p.id!==id)); setChats(cs=>cs.map(c=>c.projectId===id?{...c,projectId:undefined}:c)); if(openProject===id){setOpenProject(null);setView("projects");} }

 const hint=priceHint(model);
 const showPending=pending&&pending.chatId===chat.id;
 const query=search.toLowerCase();
 // Untouched new chats stay out of the lists until the first message, as in the Claude apps.
 const visibleChats=chats.filter(c=>c.messages.length>0&&!c.incognito&&(c.title.toLowerCase().includes(query)||c.messages.some(m=>m.content.toLowerCase().includes(query))));
 const chatRows=chats.filter(c=>c.messages.length>0&&!c.incognito).map(c=>({id:c.id,title:c.title,projectId:c.projectId,updatedAt:c.updatedAt,starred:c.starred,
   preview:plainPreview([...c.messages].reverse().find(m=>m.role==="assistant")?.content??c.messages[0]?.content??"",140)}));
 const artifactEntries:ArtifactEntry[]=view!=="artifacts"?[]:chats.filter(c=>!c.incognito).flatMap(c=>{
   const groups=new Map<string,ArtifactEntry>();
   for(const a of c.messages.filter(m=>m.role==="assistant").flatMap(m=>extractArtifacts(m.content))){
     const key=artifactKey(a);const prev=groups.get(key);
     groups.set(key,{key,chatId:c.id,chatTitle:c.title,updatedAt:c.updatedAt,latest:a,versions:(prev?.versions??0)+1});
   }
   return [...groups.values()];
 });
 const openProjectData=projects.find(p=>p.id===openProject)??null;
 const starredChats=visibleChats.filter(c=>c.starred);
 const recentChats=visibleChats.filter(c=>!c.starred);
 const chatRow=(c:Chat)=>{const on=c.id===active&&view==="chat";return <div key={c.id} className={"chatrow group/row relative flex items-center rounded-[8px]"+(on?" active":"")}>
   <button className={"chatlink flex w-full min-w-0 flex-1 items-center gap-[9px] rounded-[8px] border-0 px-[10px] py-[7px] text-left text-[12.5px] group-hover/row:bg-line group-hover/row:text-ink group-has-[.chat-menu.open]/row:bg-line group-has-[.chat-menu.open]/row:text-ink "+(on?"bg-line text-ink":"bg-transparent text-ink-4")} onClick={()=>{setActive(c.id);setArtifact(null);setView("chat");}} title={c.title}>
    <span className={"flex-1 overflow-hidden text-clip whitespace-nowrap group-hover/row:[mask-image:linear-gradient(90deg,#000_calc(100%_-_46px),transparent_calc(100%_-_22px))] group-has-[.chat-menu.open]/row:[mask-image:linear-gradient(90deg,#000_calc(100%_-_46px),transparent_calc(100%_-_22px))]"+(on?" [mask-image:linear-gradient(90deg,#000_calc(100%_-_46px),transparent_calc(100%_-_22px))]":"")}>{c.title}</span></button>
   {chatMenu(c,"row")}
 </div>;};
 const lastAssistant=chat.messages.length-1;
 const fresh=chat.messages.length===0&&!showPending;
 const composer=(variant:"welcome"|"footer")=><Composer ref={composerRef} variant={variant} incognito={!!chat.incognito} draft={draft} onDraft={setDraft} attachments={pendingAttachments}
   onRemoveAttachment={id=>setPendingAttachments(list=>list.filter(x=>x.id!==id))} onPickFiles={()=>void window.continuity.pickAttachments().then(addAttachments)}
   onPaste={e=>void onPaste(e)} onSend={()=>void send()} onStop={stop} busy={busy}
   tools={chat.incognito?{...chat.tools,memory:false}:chat.tools??{}} onTools={tools=>patchChat(chat.id,c=>({...c,tools}))} projectMemory={chatProject?.memory}
   style={chat.style==="custom"?"custom:custom":chat.style??"standard"} styles={[...STYLES.filter(s=>s.id!=="custom").map(s=>({value:s.id,label:s.label})),...prefs.customStyles.map(st=>({value:"custom:"+st.id,label:st.name}))]} onStyle={v=>patchChat(chat.id,c=>({...c,style:v}))}
   model={model} models={availableModels.length?availableModels.map(m=>({value:m.id,label:m.displayName})):[{value:model,label:modelsLoading?"取得中…":model}]} onModel={setModel} modelsLoading={modelsLoading} onRefreshModels={()=>void refreshModels(true)}
   effort={effort} efforts={currentModel?.effortLevels.length?[{value:"",label:"思考: 既定"},...currentModel.effortLevels.map(l=>({value:l,label:`思考: ${EFFORT_LABELS[l]??l}`}))]:[]} onEffort={setEffort}
   connectors={chat.incognito?[]:connectors.filter(c=>c.enabled).map(c=>({id:c.id,name:c.name}))} onManageConnectors={()=>setSettings("connectors")}
   placeholder={chat.incognito?"シークレットチャット（保存されません）":fresh?"今日はどんなお手伝いをしましょうか？":"返信…"} placement={fresh?"down":"up"}/>;
 return <ArtifactContext.Provider value={setArtifact}><div className={"shell chatfont-"+prefs.chatFont+(sidebarOpen?"":" sidebar-closed")+" flex h-screen min-h-[600px]"+(prefs.chatFont==="sans"?" [--chat-font:var(--sans)]":prefs.chatFont==="system"?' [--chat-font:system-ui,-apple-system,"Segoe_UI","Hiragino_Sans","Yu_Gothic_UI",sans-serif]':"")}>
  <aside aria-hidden={!sidebarOpen} className={"flex min-h-0 shrink-0 flex-col overflow-hidden border-r bg-sidebar py-[22px] transition-[width,padding] duration-[220ms] ease-claude "+(sidebarOpen?"w-[264px] border-line px-[14px] max-[1000px]:w-[220px]":"w-0 border-transparent px-0")}>
   <div className="brand flex items-center gap-[10px] pt-0 pr-[2px] pb-[18px] pl-[6px]"><span className="mark grid size-[30px] shrink-0 place-items-center"><LogoMark size={30} title="Claude Continuity"/></span><b className="flex-1 whitespace-nowrap font-serif text-[15px] font-semibold text-ink-2">Claude Continuity</b>
    <button className="ghost-btn tip tip-below" data-tip="サイドバーを閉じる" aria-label="サイドバーを閉じる" onClick={()=>setSidebarOpen(false)}><PanelLeftClose size={17}/></button></div>
   <button className="new-chat group/new flex w-full items-center gap-[10px] rounded-[9px] border-0 bg-transparent px-[8px] py-[7px] text-left text-[13px] font-semibold text-ink-2 hover:bg-line" onClick={()=>newChat()}><span className="plus-dot grid size-[24px] shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-transform duration-200 ease-claude group-hover/new:rotate-90 group-hover/new:scale-[1.05] group-active/new:rotate-0 group-active/new:scale-[.92]"><Plus size={15} strokeWidth={2.6}/></span>新しい会話<kbd className="ml-auto opacity-0 transition-opacity duration-150 ease-[ease] group-hover/new:opacity-100">{KEYS.newChat}</kbd></button>
   <div className="search-box group/search mt-[6px] mb-[2px] flex items-center gap-[8px] rounded-[9px] border border-transparent px-[8px] text-subtle focus-within:border-line-strong focus-within:bg-inset"><Search size={14}/><input ref={searchRef} className="chat-search m-0 w-full rounded-[7px] border-0 bg-transparent px-0 py-[8px] text-[12.5px] text-ink-2 outline-none placeholder:text-faint" value={search} onChange={e=>setSearch(e.target.value)} placeholder="会話を検索" aria-label="会話を検索"/><kbd className="ml-auto opacity-0 transition-opacity duration-150 ease-[ease] group-hover/search:opacity-100 group-focus-within/search:opacity-100">{KEYS.search}</kbd></div>
   <button className={"side-nav mt-[2px] flex w-full items-center gap-[10px] rounded-[9px] border-0 px-[10px] py-[8px] text-left text-[13px] hover:bg-line hover:text-ink [&_svg]:text-muted"+(view==="chats"?" active bg-line text-ink":" bg-transparent text-ink-4")} onClick={()=>{setView("chats");setArtifact(null);}}><MessagesSquare size={16}/>チャット</button>
   <button className={"side-nav mt-[2px] flex w-full items-center gap-[10px] rounded-[9px] border-0 px-[10px] py-[8px] text-left text-[13px] hover:bg-line hover:text-ink [&_svg]:text-muted"+(view==="artifacts"?" active bg-line text-ink":" bg-transparent text-ink-4")} onClick={()=>{setView("artifacts");setArtifact(null);}}><Shapes size={16}/>アーティファクト</button>
   <button className={"side-nav mt-[2px] flex w-full items-center gap-[10px] rounded-[9px] border-0 px-[10px] py-[8px] text-left text-[13px] hover:bg-line hover:text-ink [&_svg]:text-muted"+(view==="projects"||view==="project"?" active bg-line text-ink":" bg-transparent text-ink-4")} onClick={()=>{setView("projects");setArtifact(null);}}><FolderOpen size={16}/>プロジェクト</button>
   <div className="side-scroll mx-[-6px] mt-[4px] mb-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[6px]">
    {starredChats.length>0&&<><div className="label mx-[10px] mt-[18px] mb-[6px] text-[10.5px] font-medium tracking-[.4px] text-subtle">スター付き</div>
     <div className="chatlist flex min-h-0 flex-none flex-col gap-px overflow-visible">{starredChats.map(c=>chatRow(c))}</div></>}
    <div className="label mx-[10px] mt-[18px] mb-[6px] text-[10.5px] font-medium tracking-[.4px] text-subtle">最近の会話</div>
    <div className="chatlist flex min-h-0 flex-none flex-col gap-px overflow-visible">{recentChats.map(c=>chatRow(c))}{recentChats.length===0&&<p className="hint tight mx-[9px] mt-[2px] mb-[4px] text-[9.5px]">{search?"一致する会話はありません。":"まだ会話はありません。"}</p>}</div>
   </div>
   <CreditCard summary={summary} totals={usageTotal} onConfigure={()=>setOnboarding(true)}/>
   <AccountMenu name={prefs.displayName} plan={credit?.plan?`${PLAN_LABELS[credit.plan]} プラン`:"プラン未設定"} configured={configured}
    onSettings={()=>setSettings("general")} onShortcuts={()=>setShortcuts(true)} onImport={()=>void importExport()} onOnboarding={()=>setOnboarding(true)}/>
  </aside>
  <main className={"relative flex min-w-0 flex-1 flex-col"+(dragging?" dragging":"")} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={e=>{if(e.currentTarget===e.target)setDragging(false);}} onDrop={e=>void onDrop(e)}>
   <header className="flex h-[52px] shrink-0 items-center justify-start gap-[8px] px-[16px] text-[12px] text-muted">
    {!sidebarOpen&&<button className="ghost-btn tip tip-below" data-tip="サイドバーを開く" aria-label="サイドバーを開く" onClick={()=>setSidebarOpen(true)}><PanelLeftOpen size={17}/></button>}
    <span className="crumbs flex min-w-0 flex-1 items-center gap-[4px]">
     {view!=="chat"?null:fresh
      ? chat.incognito?null:<select className="project-select max-w-[180px] rounded-[8px] border border-accent/45 bg-accent/16 px-[8px] py-[4px] text-[10px] font-semibold text-link" value={chat.projectId??""} onChange={e=>patchChat(chat.id,c=>({...c,projectId:e.target.value||undefined}))} aria-label="この会話のプロジェクト">
         <option value="">プロジェクトなし</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      : <>{chatProject&&<><button className="crumb-project inline-flex items-center gap-[6px] whitespace-nowrap rounded-[8px] border-0 bg-transparent px-[8px] py-[6px] text-[13px] text-muted hover:bg-line hover:text-ink" onClick={()=>{setOpenProject(chatProject.id);setView("project");setArtifact(null);}}><FolderOpen size={14}/>{chatProject.name}</button><span className="crumb-sep mx-[-4px] text-faint">/</span></>}{chatMenu(chat,"title")}</>}
    </span>
    <div className="header-actions flex items-center gap-[2px]">
     {view==="chat"&&fresh&&!chat.projectId&&<button className={"ghost-btn incognito-toggle tip tip-below tip-end"+(chat.incognito?" on bg-ink-2 text-bg enabled:hover:bg-ink enabled:hover:text-bg":"")} aria-pressed={!!chat.incognito}
       data-tip={chat.incognito?"シークレットチャットをやめる":"シークレットチャット（保存しない）"} aria-label="シークレットチャット" onClick={()=>patchChat(chat.id,c=>({...c,incognito:!c.incognito}))}><Ghost size={17}/></button>}
     {view==="chat"&&!fresh&&chat.incognito&&<span className="incognito-badge inline-flex items-center gap-[6px] rounded-[9px] border border-dashed border-line-input px-[10px] py-[5px] text-[12px] text-muted"><Ghost size={13}/>シークレット · 保存されません</span>}
     {view==="chat"&&!fresh&&<button className="btn-secondary small handoff-btn tip tip-below tip-end rounded-[9px]" data-tip="Claude アプリの新しいチャットに文脈を渡す" onClick={()=>setHandoff(true)}><ArrowUpRight size={14}/>Claude で続ける</button>}
     {!configured&&<button className="btn-secondary small" onClick={()=>setSettings("api")}><span className="dot"/>APIキーを設定</button>}
    </div></header>
   {view==="artifacts"?<div className="workspace flex min-h-0 flex-1"><ArtifactsPage entries={artifactEntries} now={now} onOpen={e=>{setActive(e.chatId);setView("chat");setTimeout(()=>setArtifact(e.latest),0);}}/></div>:
    view==="projects"?<div className="workspace flex min-h-0 flex-1"><ProjectsPage projects={projects} chats={chatRows} now={now} onCreate={newProject} onOpen={id=>{setOpenProject(id);setView("project");}}/></div>:
    view==="project"&&openProjectData?<div className="workspace flex min-h-0 flex-1"><ProjectPage project={openProjectData} chats={chatRows} now={now} onBack={()=>setView("projects")}
      onEdit={()=>setProjectModal({project:openProjectData,isNew:false})} onStart={()=>newChat(openProjectData.id)} onOpenChat={id=>{setActive(id);setView("chat");}}/></div>:
   view==="chats"?<div className="workspace flex min-h-0 flex-1"><ChatsPage now={now} onNew={()=>newChat()} onDelete={ids=>setConfirmBulk(ids)} onOpen={id=>{setActive(id);setView("chat");}}
     chats={chatRows.map(c=>({...c,projectName:projects.find(p=>p.id===c.projectId)?.name}))}/></div>:
   <div className="workspace flex min-h-0 flex-1">
    <div className={"conversation relative flex min-w-0 flex-1 flex-col"+(fresh?" fresh items-center justify-center overflow-auto":"")+(chat.incognito?" incognito":"")}>
     {fresh
      ? <section className="welcome -mt-[6vh] flex w-[min(720px,100%-48px)] animate-[fadeUp_.35s_var(--ease)_both] flex-col items-stretch gap-[20px]">
         {chat.incognito
          ? <><h1 className="incognito-title m-0 flex items-center justify-center gap-[14px] font-serif text-[36px] leading-[1.2] font-normal tracking-[-.3px] text-ink-2 [&_svg]:text-ink-3"><Ghost size={32}/>シークレットチャット</h1><p className="-mt-[10px] mb-0 text-center text-[13px] text-muted">この会話は履歴に保存されず、メモリも使いません。ほかの会話に移ると消えます。</p></>
          : <h1 className="m-0 flex items-center justify-center gap-[14px] font-serif text-[36px] leading-[1.2] font-normal tracking-[-.3px] text-ink-2"><LogoGlyph size={34}/>{chatProject?chatProject.name:greeting()+(prefs.displayName?`、${prefs.displayName}さん`:"")}</h1>}
         {chatProject&&<p className="-mt-[10px] mb-0 text-center text-[13px] text-muted">このプロジェクトの指示とナレッジが自動で付きます。</p>}
         {composer("welcome")}
         <div className="suggestions flex flex-wrap justify-center gap-[8px]">{SUGGESTIONS.map(sg=><button key={sg.label} className="rounded-[10px] border border-line-strong bg-transparent px-[13px] py-[7px] text-[12.5px] text-ink-3 hover:border-line-input hover:bg-surface" onClick={()=>{setDraft(sg.prompt);composerRef.current?.focus();}}>{sg.label}</button>)}</div>
         {!chatProject&&<button className="link-btn inline-flex items-center gap-[6px] self-center rounded-[6px] border-0 bg-transparent px-[8px] py-[4px] text-[12px] text-subtle hover:text-ink-3" onClick={()=>void importExport()}><FileUp size={13}/> Claude のエクスポートから会話を続ける</button>}
        </section>
      : <>
       <section className="messages flex-1 overflow-auto scroll-auto px-[24px] pt-[12px] pb-[24px] max-[1000px]:px-[22px]" ref={messagesRef} onScroll={e=>{const el=e.currentTarget;setAtBottom(el.scrollHeight-el.scrollTop-el.clientHeight<120);}}>
        <div className="thread mx-auto my-0 max-w-[760px] pt-[20px]">
         {chat.messages.map((m,i)=><MessageItem key={`${chat.id}-${i}`} message={m} isLast={i===lastAssistant&&!showPending} busy={busy}
           onRegenerate={()=>regenerate(i)} onEdit={text=>editAndResend(i,text)} onSelectAlternate={alt=>selectAlternate(i,alt)} onSaveFile={(id,name)=>void saveFile(id,name)} onContinue={()=>continueReply(i)} onSelectVersion={v=>selectVersion(i,v)}/>)}
         {showPending&&<article className="message assistant pending mt-0 mb-[22px] block animate-fade-up text-[13px] leading-[1.85]">
           {(pending.thinking||!pending.text)&&<ThinkingBlock text={pending.thinking} live={!pending.text} seconds={pending.firstTextAt?(pending.firstTextAt-pending.startedAt)/1000:undefined}/>}
           {pending.activity&&<p className="activity my-[6px] text-[12.5px] text-muted before:mr-[7px] before:inline-block before:size-[7px] before:animate-pulse-dot before:rounded-full before:bg-accent before:content-['']">{pending.activity}</p>}
           {pending.text&&<Markdown text={pending.text} className="mt-0 font-chat text-[16px] leading-[1.78] text-ink-3 [&_code]:font-mono [&_h1]:text-ink [&_h2]:text-ink [&_h3]:text-ink [&_pre]:font-mono [&_table]:font-sans"/>}
           <div className="msg-actions working mt-[6px] flex items-center gap-[2px] opacity-100 transition-opacity duration-200 ease-[ease]"><LogoGlyph size={24} working/></div>
         </article>}
        </div>
       </section>
       {!atBottom&&<button className="to-bottom tip relative bottom-[150px] left-1/2 z-[3] grid size-[34px] -translate-x-1/2 animate-fade-in place-items-center rounded-full border border-line-strong bg-surface-2 text-ink-3 shadow-[0_8px_24px_var(--shadow)] hover:bg-raised" data-tip="最新へ" aria-label="最新のメッセージへ" onClick={scrollToBottom}><ArrowDown size={16}/></button>}
       <footer className="px-[24px] pt-0 pb-[14px] max-[1000px]:px-[18px]">{composer("footer")}
        <div className="status mx-auto mt-[8px] mb-0 flex max-w-[760px] flex-wrap justify-center gap-x-[10px] gap-y-[4px] px-[8px] text-center text-[11px] text-subtle"><span className="status-text">{status==="準備完了"?"Claude は間違えることがあります。回答は必ずご確認ください。":status}</span>{hint&&<span className="status-hint text-faint before:mr-[10px] before:text-faint before:content-['·']">{hint}</span>}</div>
       </footer>
      </>}
    </div>
    {artifact&&<ArtifactPanel artifact={artifact} versions={artifactVersions.length?artifactVersions:[artifact]} onSelect={setArtifact} onClose={()=>setArtifact(null)}/>}
   </div>}
   {(update.state==="available"||update.state==="downloading"||update.state==="ready")&&updateDismissed!==update.state+update.version&&<div className="update-banner absolute top-[58px] left-1/2 z-[6] flex max-w-[min(720px,calc(100%-40px))] animate-toast-in items-center gap-[12px] rounded-[12px] border border-line-strong bg-modal py-[8px] pr-[8px] pl-[16px] text-[12.5px] whitespace-normal text-ink-2 shadow-[0_8px_24px_var(--shadow)] [transform:translateX(-50%)]" role="status">
     <span className="update-banner-text flex min-w-0 flex-col gap-px"><b className="text-[13px] text-ink">{update.state==="ready"?"アップデートの準備ができました":"アップデートがあります"}</b>{statusText(update)}</span>
     {update.state==="downloading"&&<span className="update-progress block h-[6px] w-[140px] shrink-0 overflow-hidden rounded-[3px] bg-line" aria-label={`${update.percent}%`}><i className="block h-full bg-accent transition-[width] duration-300 ease-[ease]" style={{width:`${update.percent}%`}}/></span>}
     {update.state!=="downloading"&&"notes" in update&&update.notes&&<button className="link text-[12px] whitespace-nowrap no-underline" onClick={()=>setSettings("about")}>変更内容</button>}
     {update.state==="available"&&<button className="btn-primary small" onClick={()=>void window.continuity.downloadUpdate()}>ダウンロード</button>}
     {update.state==="ready"&&<button className="btn-primary small" onClick={()=>void window.continuity.installUpdate()}>再起動して更新</button>}
     {update.state!=="downloading"&&<button className="btn-text px-[8px] py-[6px] whitespace-nowrap" onClick={()=>setUpdateDismissed(update.state+update.version)}>あとで</button>}
   </div>}
   {dragging&&<div className="drop-hint pointer-events-none absolute inset-[12px] z-[4] grid animate-[fadeIn_.15s_ease] place-items-center rounded-[14px] border-2 border-dashed border-accent bg-accent/10 text-[14px] font-semibold text-link light:bg-[color-mix(in_srgb,var(--accent)_8%,#fff)]">ここにドロップして添付</div>}
  </main>
  {settings&&<SettingsPage initialTab={settings} prefs={prefs} onSavePrefs={savePrefs} configured={configured} onSaveKey={saveKey}
    credit={credit} onSaveCredit={saveCredit} onRestartOnboarding={()=>{setSettings(null);setOnboarding(true);}} onClose={()=>setSettings(null)} onNotice={toast} onConnectors={setConnectors}
    model={model} onUsage={usage=>setUsageRows(rows=>[...rows,{...usage,createdAt:new Date().toISOString()}])}/>}
  {handoff&&<HandoffDialog title={chat.title} turns={chat.messages.map(m=>({role:m.role,content:m.content}))} model={model} modelLabel={currentModel?.displayName??model} configured={configured}
    onUsage={usage=>setUsageRows(rows=>[...rows,{...usage,createdAt:new Date().toISOString()}])} onNotice={toast} onClose={()=>setHandoff(false)}/>}
  {shortcuts&&<ShortcutsDialog onClose={()=>setShortcuts(false)}/>}
  <Toaster toasts={toasts} onDismiss={id=>setToasts(list=>list.filter(t=>t.id!==id))}/>
  {renaming&&<RenameDialog initial={chats.find(c=>c.id===renaming)?.title??""} onSave={title=>patchChat(renaming,c=>({...c,title}))} onClose={()=>setRenaming(null)}/>}
  {confirmDelete&&<ConfirmDialog title="会話を削除しますか？" body={`「${chats.find(c=>c.id===confirmDelete)?.title??""}」を端末内の履歴から削除します。元に戻せません。`} confirm="削除"
    onConfirm={()=>deleteChat(confirmDelete)} onClose={()=>setConfirmDelete(null)}/>}
  {confirmBulk&&<ConfirmDialog title={`${confirmBulk.length} 件の会話を削除しますか？`} body="選んだ会話を端末内の履歴から削除します。元に戻せません（バックアップがあれば復元できます）。" confirm="削除"
    onConfirm={()=>deleteMany(confirmBulk)} onClose={()=>setConfirmBulk(null)}/>}
  {projectModal&&<ProjectModal project={projectModal.project} isNew={projectModal.isNew} onSave={upsertProject} onDelete={()=>deleteProject(projectModal.project.id)} onClose={()=>setProjectModal(null)}/>}
  {onboarding&&loaded&&<OnboardingWizard keyConfigured={configured} onFinish={finishOnboarding} onSkip={skipOnboarding}/>}
 </div></ArtifactContext.Provider>;
}
function err(e:unknown){return (e instanceof Error?e.message:String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/,"");}
