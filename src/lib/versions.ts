import type { Msg } from "../components/MessageItem";

/**
 * Editing a user turn keeps the previous wording and the replies that followed it as a version,
 * so the thread can be switched back like the Claude apps' "< 1/2 >" on edited messages.
 * The active version's replies live in the thread itself; inactive ones are stored in `tail`.
 */
export function editUserMessage(messages: Msg[], index: number, text: string): Msg[] {
  const original = messages[index];
  const current = original.versionIndex ?? 0;
  const versions = original.versions?.length
    ? original.versions.map((v, i) => i === current ? { ...v, tail: messages.slice(index + 1) } : v)
    : [{ content: original.content, ...(original.attachments ? { attachments: original.attachments } : {}), tail: messages.slice(index + 1) }];
  const next = [...versions, { content: text, ...(original.attachments ? { attachments: original.attachments } : {}), tail: [] }];
  return [...messages.slice(0, index), { ...original, content: text, versions: next, versionIndex: next.length - 1 }];
}

export function selectUserVersion(messages: Msg[], index: number, target: number): Msg[] {
  const message = messages[index];
  const versions = message.versions;
  if (!versions?.[target]) return messages;
  const current = message.versionIndex ?? 0;
  const saved = versions.map((v, i) => i === current ? { ...v, tail: messages.slice(index + 1) } : v);
  const chosen = saved[target];
  const { attachments: _drop, ...rest } = message;
  return [...messages.slice(0, index), { ...rest, content: chosen.content, ...(chosen.attachments ? { attachments: chosen.attachments } : {}), versions: saved, versionIndex: target }, ...chosen.tail];
}
