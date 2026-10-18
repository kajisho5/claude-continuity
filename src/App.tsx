import { useEffect, useState } from "react";
import { KeyRound, MessageSquare, Plus, Send, Settings2, ShieldCheck, Sparkles, FileUp, Download, Trash2 } from "lucide-react";
type Msg = { role: "user" | "assistant"; content: string };
type Chat = { id: string; title: string; messages: Msg[]; source?: string };
const welcome: Chat = { id: "welcome", title: "はじめに", messages: [{ role: "assistant", content: "Claude Continuityへようこそ。APIキーを設定するとClaude APIと会話できます。左側からClaudeのエクスポートを読み込むと、対応する会話をこの画面で開けます。\n\n注意：インポートした会話は、続きを送信した時点で選択した文脈がAnthropic APIへ送信されます。" }] };
export default function App() {
 const [chats,setChats]=useState<Chat[]>([welcome]);
 const [active,setActive]=useState("welcome");
 const [draft,setDraft]=useState("");
 const [search,setSearch]=useState("");
 const [model,setModel]=useState("claude-sonnet-4-5");
 const [key,setKey]=useState("");
 const [configured,setConfigured]=useState(false);
 const [settings,setSettings]=useState(false);
 const [busy,setBusy]=useState(false);
 const [status,setStatus]=useState("準備完了");
 const [loaded,setLoaded]=useState(false);
 const [lastUsage,setLastUsage]=useState<{inputTokens:number;outputTokens:number}|null>(null);
 const [usageTotal,setUsageTotal]=useState({inputTokens:0,outputTokens:0,calls:0});
 const chat=chats.find(c=>c.id===active)??chats[0]??welcome;

 useEffect(()=>{
   Promise.all([window.continuity.keyStatus(),window.continuity.loadChats(),window.continuity.loadUsage()])
    .then(([s,saved,usage])=>{setConfigured(s.configured); if(saved.length){setChats(saved);setActive(saved[0].id);} setUsageTotal(usage.reduce((acc,row)=>({inputTokens:acc.inputTokens+row.inputTokens,outputTokens:acc.outputTokens+row.outputTokens,calls:acc.calls+1}),{inputTokens:0,outputTokens:0,calls:0})); setLoaded(true);})
    .catch(e=>{setStatus("初期化エラー: "+err(e));setLoaded(true);});
 },[]);
 useEffect(()=>{
   if(!loaded)return;
   const timer=window.setTimeout(()=>{window.continuity.saveChats(chats).catch(e=>setStatus("ローカル保存エラー: "+err(e)));},350);
   return ()=>window.clearTimeout(timer);
 },[chats,loaded]);

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
 async function send(){
   const text=draft.trim();if(!text||busy)return;
   if(!configured){setSettings(true);setStatus("先にAnthropic APIキーを設定してください");return;}
   const current=chat;
   const messages=[...current.messages,{role:"user" as const,content:text}];
   const title=current.title==="新しい会話"||current.title==="はじめに"?text.slice(0,48):current.title;
   updateChat(current.id,messages,title);setDraft("");setBusy(true);setStatus("Claudeに問い合わせ中…");
   try{
     const response=await window.continuity.reply({messages:messages.slice(-60),model});
     updateChat(current.id,[...messages,{role:"assistant",content:response.text}],title);
     setLastUsage({inputTokens:response.usage.inputTokens,outputTokens:response.usage.outputTokens});
     setUsageTotal(prev=>({...prev,inputTokens:prev.inputTokens+response.usage.inputTokens,outputTokens:prev.outputTokens+response.usage.outputTokens,calls:prev.calls+1}));
     setStatus(`応答完了 · ${response.usage.inputTokens.toLocaleString()} input / ${response.usage.outputTokens.toLocaleString()} output tokens`);
   }catch(e){updateChat(current.id,[...messages,{role:"assistant",content:"APIエラー: "+err(e)+"\n\nConsoleのクレジット残高、APIキー、利用可能モデルを確認してください。"}],title);setStatus("APIリクエストに失敗しました");}
   finally{setBusy(false);}
 }
 async function exportChat(){try{const result=await window.continuity.exportChat({fileName:chat.title.replace(/[^\p{L}\p{N} _-]/gu,"").slice(0,80)||"conversation",data:JSON.stringify(chat,null,2)});if(!result.canceled)setStatus("会話をJSONにエクスポートしました");}catch(e){setStatus("エクスポートエラー: "+err(e));}}
 function deleteChat(){if(chats.length<=1){setStatus("最後の会話は削除できません。");return;}if(!window.confirm("この会話を端末内の履歴から削除しますか？"))return;const remaining=chats.filter(c=>c.id!==active);setChats(remaining);setActive(remaining[0].id);setStatus("会話を削除しました");}
 function newChat(){const id="chat-"+Date.now();setChats(cs=>[{id,title:"新しい会話",messages:[]},...cs]);setActive(id);}
 return <div className="shell">
  <aside><div className="brand"><span className="mark"><Sparkles size={19}/></span><div><b>Claude Continuity</b><small>LOCAL WORKSPACE</small></div></div>
   <button className="new" onClick={newChat}><Plus size={16}/> 新しい会話</button>
   <button className="nav" onClick={()=>void importExport()}><FileUp size={16}/> Claudeエクスポートを読み込む</button>
   <div className="label">会話履歴 · {chats.length}</div>
   <input className="chat-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="会話を検索…" aria-label="会話を検索"/>
   <div className="usage-card"><div>この端末で記録したAPI使用量</div><strong>{(usageTotal.inputTokens+usageTotal.outputTokens).toLocaleString()} <small>tokens</small></strong><span>{usageTotal.calls} 回 · input {usageTotal.inputTokens.toLocaleString()} / output {usageTotal.outputTokens.toLocaleString()}</span><em>クレジット残高ではなく、アプリ内の記録です</em></div>
   <div className="chatlist">{chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase())||c.messages.some(m=>m.content.toLowerCase().includes(search.toLowerCase()))).map(c=><button key={c.id} className={"chatlink "+(c.id===active?"active":"")} onClick={()=>setActive(c.id)}><MessageSquare size={15}/><span>{c.title}</span></button>)}</div>
   <div className="bottom"><button className="nav" onClick={()=>setSettings(true)}><Settings2 size={16}/> API設定</button><div className="secure"><ShieldCheck size={15}/> ローカル優先設計</div></div>
  </aside>
  <main><header><span>Workspace / <b>{chat.title}</b></span><div className="header-actions"><button className="nav" onClick={()=>void exportChat()} title="会話をJSONで保存"><Download size={15}/> JSON保存</button><button className="nav" onClick={deleteChat} title="この会話を削除"><Trash2 size={15}/></button><button className="nav header-status" onClick={()=>setSettings(true)}><span className={"dot "+(configured?"green":"")}/>{configured?"API設定済み":"API未設定"} <Settings2 size={16}/></button></div></header>
   <section className="messages">
    {chat.messages.length===0&&<div className="empty"><Sparkles size={30}/><h1>会話を続ける</h1><p>インポートした履歴を選ぶか、ここから新しい会話を始めます。</p><button className="secondary" onClick={()=>void importExport()}><FileUp size={16}/> Claudeのエクスポートを読み込む</button></div>}
    {chat.messages.map((m,i)=><article key={i} className={"message "+m.role}><div className="avatar">{m.role==="assistant"?<Sparkles size={16}/>:"You"}</div><div className="msgbody"><b>{m.role==="assistant"?"Claude":"あなた"}</b><p>{m.content}</p></div></article>)}
    {busy&&<p className="busy">Claudeが応答中…</p>}
   </section>
   <footer><div className="composer"><div className="composer-toolbar"><label htmlFor="model-select">モデル</label><select id="model-select" value={model} onChange={e=>setModel(e.target.value)} disabled={busy}><option value="claude-sonnet-4-5">Claude Sonnet 4.5</option><option value="claude-opus-4-1">Claude Opus 4.1</option><option value="claude-haiku-5-5">Claude Haiku 5.5（低コスト）</option></select></div><textarea value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="Claudeにメッセージ…（Enterで送信、Shift+Enterで改行）"/><div className="composebottom"><span><KeyRound size={13}/>{configured?"APIキー保存済み":"APIキーを設定してください"}</span><button onClick={()=>void send()} disabled={busy||!draft.trim()}><Send size={15}/> 送信</button></div></div><div className="status"><span>{status}</span><span>{lastUsage?`直近の応答: ${lastUsage.inputTokens+lastUsage.outputTokens} tokens`:"会話はこの端末に自動保存されます"}</span></div></footer>
  </main>
  {settings&&<div className="overlay" onClick={()=>setSettings(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSettings(false)}>×</button><h2>Anthropic API設定</h2><p>Anthropic Consoleで発行したAPIキーを入力してください。</p><label>API Key</label><input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder={configured?"保存済み。変更する場合のみ入力":"sk-ant-…"} autoComplete="off"/><div className="note"><ShieldCheck size={15}/> APIキーはOSの安全な保存領域に暗号化して保存します。</div><div className="actions"><button className="secondary" onClick={()=>setSettings(false)}>キャンセル</button><button className="save" disabled={!key.trim()} onClick={()=>void saveKey()}>保存</button></div><div className="credit-guide"><b>Maxプランの月間APIクレジットを使う</b><p>Max 20xには月額200 USD相当のAPIクレジットが含まれます。先にClaude Console組織をプランにリンクし、BillingのPromotional creditsにクレジットが表示されることを確認してください。これはClaudeアプリ内の利用上限とは別枠です。</p><a href="https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers" target="_blank" rel="noreferrer">公式設定手順</a><a href="https://platform.claude.com/settings/billing" target="_blank" rel="noreferrer">ConsoleのBillingを開く</a></div><small>このアプリはAPIキーでAnthropic APIを呼び出します。リンク済み組織のクレジットが利用されます。購入済み残高への自動リロードはこのアプリから設定・変更しません。送信した会話文脈はAnthropic APIへ送られます。</small></div></div>}
 </div>;
}
function err(e:unknown){return e instanceof Error?e.message:String(e);}
