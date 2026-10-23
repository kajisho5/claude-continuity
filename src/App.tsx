import { useEffect, useMemo, useRef, useState } from "react";
import { Infinity as InfinityIcon, KeyRound, MessageSquare, Plus, Send, Settings2, ShieldCheck, FileUp, Download, Trash2, Square, RefreshCw, ExternalLink } from "lucide-react";
import CreditCard from "./components/CreditCard";
import CreditSettingsForm from "./components/CreditSettingsForm";
import OnboardingWizard from "./components/OnboardingWizard";
import { CopyButton, Markdown, ThinkingBlock } from "./components/MessageContent";
import { summarizeCredit, type CreditSettings, type UsageRow } from "./lib/credit";
import { costOf, formatUsd, priceHint } from "./lib/pricing";

type Msg = { role: "user" | "assistant"; content: string; thinking?: string; model?: string; costUsd?: number; aborted?: boolean };
type Chat = { id: string; title: string; messages: Msg[]; source?: string };
type Model = { id: string; displayName: string; createdAt?: string; maxTokens?: number; effortLevels: string[]; adaptiveThinking: boolean };
type Pending = { chatId: string; requestId: string; text: string; thinking: string };
const welcome: Chat = { id: "welcome", title: "はじめに", messages: [{ role: "assistant", content: "Claude Continuityへようこそ。APIキーを設定するとClaude APIと会話できます。左側からClaudeのエクスポートを読み込むと、対応する会話をこの画面で開けます。\n\n注意：インポートした会話は、続きを送信した時点で選択した文脈がAnthropic APIへ送信されます。" }] };
const EFFORT_LABELS: Record<string, string> = { low: "低", medium: "中", high: "高", xhigh: "より高", max: "最大" };

function sortModels(models: Model[]): Model[] {
  const score = (id: string) => id.includes("opus") ? 0 : id.includes("sonnet") ? 1 : id.includes("haiku") ? 2 : 3;
  return models.filter(m => m.id).sort((a, b) => score(a.id) - score(b.id) || a.displayName.localeCompare(b.displayName));
}
function toUsageRows(rows: Awaited<ReturnType<typeof window.continuity.loadUsage>>): UsageRow[] {
  return rows.filter(row => row && typeof row.model === "string" && typeof row.createdAt === "string").map(row => ({
    model: row.model, createdAt: row.createdAt, inputTokens: Number(row.inputTokens) || 0, outputTokens: Number(row.outputTokens) || 0,
    cacheCreationInputTokens: Number(row.cacheCreationInputTokens) || 0, cacheReadInputTokens: Number(row.cacheReadInputTokens) || 0
  }));
}

export default function App() {
 const [chats,setChats]=useState<Chat[]>([welcome]);
 const [active,setActive]=useState("welcome");
 const [draft,setDraft]=useState("");
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
 const pendingRef=useRef<Pending|null>(null);
 const messagesRef=useRef<HTMLElement>(null);
 const busy=pending!==null;
 const chat=chats.find(c=>c.id===active)??chats[0]??welcome;
 const currentModel=availableModels.find(m=>m.id===model);
 const usageTotal=useMemo(()=>usageRows.reduce((acc,row)=>({inputTokens:acc.inputTokens+row.inputTokens,outputTokens:acc.outputTokens+row.outputTokens,calls:acc.calls+1}),{inputTokens:0,outputTokens:0,calls:0}),[usageRows]);
 const summary=useMemo(()=>summarizeCredit(usageRows,credit,new Date(now)),[usageRows,credit,now]);

 useEffect(()=>{
   Promise.all([window.continuity.keyStatus(),window.continuity.loadChats(),window.continuity.loadUsage(),window.continuity.loadCredit()])
    .then(([s,saved,usage,savedCredit])=>{setConfigured(s.configured); if(saved.length){setChats(saved);setActive(saved[0].id);} setUsageRows(toUsageRows(usage)); setCredit(savedCredit); setOnboarding(!savedCredit?.onboardingDone); setLoaded(true);})
    .catch(e=>{setStatus("初期化エラー: "+err(e));setLoaded(true);});
   // Re-evaluate the credit cycle as time passes (day boundaries, expiry).
   const timer=window.setInterval(()=>setNow(Date.now()),60_000);
   const unsubscribe=window.continuity.onStream(event=>{
     const current=pendingRef.current;
     if(!current||current.requestId!==event.requestId)return;
     const next={...current,[event.kind]:current[event.kind]+event.delta};
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
 useEffect(()=>{ if(effort&&currentModel&&!currentModel.effortLevels.includes(effort)) setEffort(""); },[currentModel,effort]);
 useEffect(()=>{
   if(!loaded)return;
   const timer=window.setTimeout(()=>{window.continuity.saveChats(chats).catch(e=>setStatus("ローカル保存エラー: "+err(e)));},350);
   return ()=>window.clearTimeout(timer);
 },[chats,loaded]);
 useEffect(()=>{ const el=messagesRef.current; if(el) el.scrollTop=el.scrollHeight; },[active,chat.messages.length,pending?.text,pending?.thinking]);

 function updateChat(id:string,messages:Msg[],title?:string){
   setChats(cs=>cs.map(c=>c.id===id?{...c,messages,title:title??c.title}:c));
 }
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
 async function send(){
   const text=draft.trim();if(!text||busy)return;
   if(!configured){setSettings(true);setStatus("先にAnthropic APIキーを設定してください");return;}
   const current=chat;
   const messages:Msg[]=[...current.messages,{role:"user",content:text}];
   const title=current.title==="新しい会話"||current.title==="はじめに"?text.slice(0,48):current.title;
   const requestId=crypto.randomUUID();
   const start:Pending={chatId:current.id,requestId,text:"",thinking:""};
   updateChat(current.id,messages,title);setDraft("");pendingRef.current=start;setPending(start);setStatus("Claudeに問い合わせ中…");
   try{
     const response=await window.continuity.reply({requestId,messages:messages.slice(-60).map(m=>({role:m.role,content:m.content})),model,effort:effort||undefined});
     const cost=costOf(response.usage.model,response.usage);
     const reply:Msg={role:"assistant",content:response.text,model:response.usage.model,...(response.thinking?{thinking:response.thinking}:{}),...(cost!=null?{costUsd:cost}:{}),...(response.aborted?{aborted:true}:{})};
     updateChat(current.id,[...messages,reply],title);
     if(response.usage.inputTokens||response.usage.outputTokens){
       setUsageRows(rows=>[...rows,{...response.usage,createdAt:new Date().toISOString()}]);
       setLastUsage({inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens,costUsd:cost});
     }
     const costText=cost!=null?` · 推定 ${formatUsd(cost,4)}`:"";
     setStatus(response.aborted?`応答を停止しました${costText}`:`応答完了 · ${response.usage.inputTokens.toLocaleString()} input / ${response.usage.outputTokens.toLocaleString()} output tokens${costText}`);
   }catch(e){updateChat(current.id,[...messages,{role:"assistant",content:"APIエラー: "+err(e)+"\n\nConsoleのクレジット残高、APIキー、利用可能モデルを確認してください。"}],title);setStatus("APIリクエストに失敗しました");}
   finally{pendingRef.current=null;setPending(null);}
 }
 function stop(){ if(pending) void window.continuity.abortReply(pending.requestId); }
 async function exportChat(){try{const result=await window.continuity.exportChat({fileName:chat.title.replace(/[^\p{L}\p{N} _-]/gu,"").slice(0,80)||"conversation",data:JSON.stringify(chat,null,2)});if(!result.canceled)setStatus("会話をJSONにエクスポートしました");}catch(e){setStatus("エクスポートエラー: "+err(e));}}
 function deleteChat(){if(busy){setStatus("応答中は削除できません。");return;}if(chats.length<=1){setStatus("最後の会話は削除できません。");return;}if(!window.confirm("この会話を端末内の履歴から削除しますか？"))return;const remaining=chats.filter(c=>c.id!==active);setChats(remaining);setActive(remaining[0].id);setStatus("会話を削除しました");}
 function newChat(){const id="chat-"+Date.now();setChats(cs=>[{id,title:"新しい会話",messages:[]},...cs]);setActive(id);}
 const hint=priceHint(model);
 const showPending=pending&&pending.chatId===chat.id;
 const query=search.toLowerCase();
 return <div className="shell">
  <aside>
   <div className="brand"><span className="mark"><InfinityIcon size={19}/></span><div><b>Claude Continuity</b><small>LOCAL WORKSPACE</small></div></div>
   <button className="btn-primary new" onClick={newChat}><Plus size={16}/> 新しい会話</button>
   <button className="nav" onClick={()=>void importExport()}><FileUp size={16}/> Claudeエクスポートを読み込む</button>
   <CreditCard summary={summary} totals={usageTotal} onConfigure={()=>setOnboarding(true)}/>
   <div className="label">会話履歴 · {chats.length}</div>
   <input className="chat-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="会話を検索…" aria-label="会話を検索"/>
   <div className="chatlist">{chats.filter(c=>c.title.toLowerCase().includes(query)||c.messages.some(m=>m.content.toLowerCase().includes(query))).map(c=><button key={c.id} className={"chatlink "+(c.id===active?"active":"")} onClick={()=>setActive(c.id)}><MessageSquare size={15}/><span>{c.title}</span></button>)}</div>
   <div className="bottom"><button className="nav" onClick={()=>setSettings(true)}><Settings2 size={16}/> API設定</button><div className="secure"><ShieldCheck size={15}/> ローカル優先設計</div></div>
  </aside>
  <main><header><span>Workspace / <b>{chat.title}</b></span><div className="header-actions"><button className="nav" onClick={()=>void exportChat()} title="会話をJSONで保存"><Download size={15}/> JSON保存</button><button className="nav" onClick={deleteChat} title="この会話を削除"><Trash2 size={15}/></button><button className="nav header-status" onClick={()=>setSettings(true)}><span className={"dot "+(configured?"green":"")}/>{configured?"API設定済み":"API未設定"} <Settings2 size={16}/></button></div></header>
   <section className="messages" ref={messagesRef}>
    {chat.messages.length===0&&!showPending&&<div className="empty"><InfinityIcon size={30}/><h1>会話を続ける</h1><p>インポートした履歴を選ぶか、ここから新しい会話を始めます。</p><button className="btn-secondary" onClick={()=>void importExport()}><FileUp size={16}/> Claudeのエクスポートを読み込む</button></div>}
    {chat.messages.map((m,i)=><article key={i} className={"message "+m.role}><div className="avatar">{m.role==="assistant"?<InfinityIcon size={16}/>:"You"}</div><div className="msgbody">
      <b>{m.role==="assistant"?"Claude":"あなた"}{m.role==="assistant"&&m.model&&<span className="msg-meta">{m.model}{m.costUsd!=null?` · ${formatUsd(m.costUsd,4)}`:""}</span>}</b>
      {m.thinking&&<ThinkingBlock text={m.thinking}/>}
      {m.role==="assistant"?<Markdown text={m.content}/>:<p className="user-text">{m.content}</p>}
      {m.aborted&&<p className="msg-note">応答を途中で停止しました</p>}
      {m.role==="assistant"&&m.content&&<div className="msg-actions"><CopyButton text={m.content}/></div>}
    </div></article>)}
    {showPending&&<article className="message assistant pending"><div className="avatar"><InfinityIcon size={16}/></div><div className="msgbody"><b>Claude</b>
      <ThinkingBlock text={pending.thinking} live={!pending.text}/>
      {pending.text?<Markdown text={pending.text}/>:!pending.thinking&&<p className="busy">Claudeが応答中…</p>}
    </div></article>}
   </section>
   <footer><div className="composer">
    <div className="composer-toolbar">
     <label htmlFor="model-select">モデル{availableModels.length?` · ${availableModels.length}件`:""}</label>
     <select id="model-select" value={model} onChange={e=>setModel(e.target.value)} disabled={busy||modelsLoading}>{availableModels.length?availableModels.map(m=><option key={m.id} value={m.id}>{m.displayName} · {m.id}</option>):<option value={model}>{modelsLoading?"利用可能モデルを取得中…":model}</option>}</select>
     {currentModel&&currentModel.effortLevels.length>0&&<>
      <label htmlFor="effort-select">思考の深さ</label>
      <select id="effort-select" value={effort} onChange={e=>setEffort(e.target.value)} disabled={busy} title="深いほど回答の質が上がり、クレジットを多く使います">
       <option value="">既定</option>
       {currentModel.effortLevels.map(level=><option key={level} value={level}>{EFFORT_LABELS[level]??level}（{level}）</option>)}
      </select></>}
     <button className="nav icon-text" onClick={()=>void refreshModels(true)} disabled={modelsLoading||busy} title="APIキーで利用できるモデルを再取得"><RefreshCw size={13}/>{modelsLoading?"取得中…":"モデル更新"}</button>
     {hint&&<span className="price-hint">{hint}</span>}
    </div>
    <textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}} placeholder="Claudeにメッセージ…（Enterで送信、Shift+Enterで改行）"/>
    <div className="composebottom"><span><KeyRound size={13}/>{configured?"APIキー保存済み":"APIキーを設定してください"}</span>
     {busy?<button className="btn-secondary" onClick={stop}><Square size={13}/> 停止</button>:<button className="btn-primary" onClick={()=>void send()} disabled={!draft.trim()}><Send size={15}/> 送信</button>}</div>
   </div><div className="status"><span>{status}</span><span>{lastUsage?`直近の応答: ${(lastUsage.inputTokens+lastUsage.outputTokens).toLocaleString()} tokens${lastUsage.costUsd!=null?` · ${formatUsd(lastUsage.costUsd,4)}`:""}`:"会話はこの端末に自動保存されます"}</span></div></footer>
  </main>
  {settings&&<div className="overlay" onClick={()=>setSettings(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSettings(false)} aria-label="閉じる">×</button>
   <h2>Anthropic API設定</h2><p className="muted">Anthropic Consoleで発行したAPIキーを入力してください。</p>
   <label className="field"><span>API Key</span><input className="text-input" type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder={configured?"保存済み。変更する場合のみ入力":"sk-ant-…"} autoComplete="off"/></label>
   <div className="hint"><ShieldCheck size={13}/> APIキーはOSの安全な保存領域に暗号化して保存します。 <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noreferrer">キーを作成 <ExternalLink size={11}/></a></div>
   <div className="actions"><button className="btn-secondary" onClick={()=>setSettings(false)}>キャンセル</button><button className="btn-primary" disabled={!key.trim()} onClick={()=>void saveKey()}>保存</button></div>
   <CreditSettingsForm value={credit} onSave={saveCredit}/>
   <div className="credit-guide"><b>Maxプランの月間APIクレジットを使う</b><p>Max 5x は月 $100、Max 20x は月 $200 相当。請求サイクル末で失効し、繰り越されません。Claude Code では使えません（API・Agent SDK・Playground が対象）。</p><a href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">公式設定手順</a><a href="https://platform.claude.com/settings/billing" target="_blank" rel="noreferrer">ConsoleのBillingを開く</a><button className="link" onClick={()=>{setSettings(false);setOnboarding(true);}}>初期設定をやり直す</button></div>
   <small className="fineprint">このアプリはAPIキーでAnthropic APIを呼び出します。リンク済み組織のクレジットが利用されます。購入済み残高への自動リロードはこのアプリから設定・変更しません。送信した会話文脈はAnthropic APIへ送られます。</small></div></div>}
  {onboarding&&loaded&&<OnboardingWizard keyConfigured={configured} onFinish={finishOnboarding} onSkip={skipOnboarding}/>}
 </div>;
}
function err(e:unknown){return (e instanceof Error?e.message:String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/,"");}
