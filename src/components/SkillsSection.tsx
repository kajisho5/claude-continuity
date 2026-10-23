import { useEffect, useState } from "react";
import { FolderUp, FileArchive, Sparkles, Trash2 } from "lucide-react";
import { useT } from "../i18n";
import type { Prefs } from "../lib/prefs";
import { relativeTime } from "../lib/time";

type Skill = { id: string; name: string; updatedAt: string };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const ROW = "flex items-center gap-[10px] rounded-[10px] border border-line bg-inset px-[12px] py-[10px]";

/** Custom Skills (Skills API): upload a skill folder or archive, choose which ones Claude may use, delete them. */
export default function SkillsSection({ prefs, configured, onSavePrefs, onReloadPrefs }: { prefs: Prefs; configured: boolean; onSavePrefs: (next: Prefs) => void; onReloadPrefs: () => void }) {
  const t = useT();
  const s = t.settings.skills;
  const [list, setList] = useState<Skill[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = () => { window.continuity.listSkills().then(setList).catch(e => { setList([]); setNotice(message(e)); }); };
  useEffect(() => { if (configured) load(); else setList([]); }, [configured]);
  async function upload(kind: "folder" | "file") {
    setBusy(true); setNotice("");
    try {
      const skill = await window.continuity.uploadSkill(kind);
      if (skill) { setNotice(s.uploaded(skill.name)); onReloadPrefs(); load(); }
    } catch (e) { setNotice(message(e)); }
    finally { setBusy(false); }
  }
  async function remove(skill: Skill) {
    if (!window.confirm(s.confirmDelete(skill.name))) return;
    setBusy(true); setNotice("");
    try { await window.continuity.deleteSkill(skill.id); onReloadPrefs(); load(); }
    catch (e) { setNotice(message(e)); }
    finally { setBusy(false); }
  }
  const toggle = (id: string, on: boolean) => onSavePrefs({ ...prefs, enabledSkills: on ? [...new Set([...prefs.enabledSkills, id])] : prefs.enabledSkills.filter(x => x !== id) });
  return <section className="credit-form skills-section">
    <h3 className="m-[0_0_6px] font-serif text-[16px] leading-[normal] font-semibold text-ink">{s.heading}</h3>
    <p className="muted">{s.intro}</p>
    <ul className="hint-list m-[8px_0_0] flex flex-col gap-[4px] pl-[18px] text-[11px] leading-[1.6] text-subtle">{s.notes.map(n => <li key={n}>{n}</li>)}</ul>
    {!configured ? <p className="hint">{s.needKey}</p> : list === null ? <p className="hint">{t.common.loading}</p>
      : <ul className="skill-list m-[14px_0_0] flex list-none flex-col gap-[6px] p-0">
        {list.map(k => <li key={k.id} className={ROW}>
          <Sparkles size={16} className="shrink-0 text-muted" />
          <span className="flex min-w-0 flex-1 flex-col gap-[2px]"><b className="text-[13px] text-ink-2">{k.name}</b><small className="text-[11px] text-subtle">{s.updated(relativeTime(k.updatedAt))}</small></span>
          <input type="checkbox" className="switch" aria-label={s.use(k.name)} checked={prefs.enabledSkills.includes(k.id)} disabled={busy || (!prefs.enabledSkills.includes(k.id) && prefs.enabledSkills.length >= 16)} onChange={e => toggle(k.id, e.target.checked)} />
          <button className="icon-btn" aria-label={s.remove(k.name)} disabled={busy} onClick={() => void remove(k)}><Trash2 size={14} /></button>
        </li>)}
        {list.length === 0 && <li className={"empty " + ROW + " justify-center border-dashed bg-transparent text-center text-[12px] text-subtle"}>{s.empty}</li>}
      </ul>}
    <div className="form-actions start">
      <button className="btn-secondary small upload-folder" disabled={!configured || busy} onClick={() => void upload("folder")}><FolderUp size={13} />{s.uploadFolder}</button>
      <button className="btn-secondary small upload-file" disabled={!configured || busy} onClick={() => void upload("file")}><FileArchive size={13} />{s.uploadFile}</button>
    </div>
    {notice && <p className="form-message skills-notice whitespace-pre-wrap text-[12px] text-muted">{notice}</p>}
  </section>;
}
