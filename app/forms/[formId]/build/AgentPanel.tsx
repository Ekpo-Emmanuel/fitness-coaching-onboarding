"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUp, Check, CircleNotch, Eye } from "@phosphor-icons/react";
import { FormPreview } from "@/app/forms/[formId]/preview/FormPreview";
import { Modal } from "@/components/product/Modal";
import { StatusBadge } from "@/components/product/ui";
import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type { OnboardingSchema } from "@/lib/onboarding/schema/types";
import type { ReviewRuleSet } from "@/lib/review/types";
import { isDestructiveProposal, parseChangeDetails } from "./agent-changes";
import { agentNextPrompts, agentStarterPrompts } from "./agent-suggestions";
import "./builder.css";

export type AgentChatMessage = { id: string; role: "user" | "assistant"; content: string; changeSetId?: string | null };
export type AgentChangeSetView = { id: string; status: "proposed" | "applied" | "rejected" | "superseded"; summary: string; details: string[]; baseDraftRevision: number };
type Applied = { schema: OnboardingSchema; clientIdentityMapping: ClientIdentityMapping | null; reviewRules?: ReviewRuleSet | null; revision: number; formName?: string };
const FAIL = "The Agent couldn’t complete that request. Your form has not been changed.";

export function AgentPanel({ formId, initialMessages, initialChangeSets, currentRevision, schema, reviewRules, branding = { businessName: "Coaching", coachName: "", primaryColor: null }, autoFocus, disabled = false, onFlushSave, onApplying, onOpenBuilder, onApplied }: {
  formId: string; initialMessages: AgentChatMessage[]; initialChangeSets: AgentChangeSetView[]; currentRevision?: number; schema?: OnboardingSchema | null; reviewRules?: ReviewRuleSet | null; branding?: { businessName: string; coachName: string; primaryColor: string | null }; autoFocus?: boolean; disabled?: boolean; onFlushSave?: () => Promise<void>; onApplying?: (value: boolean) => void; onOpenBuilder?: () => void; onApplied: (next: Applied) => void;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [sets, setSets] = useState<Record<string, AgentChangeSetView>>(Object.fromEntries(initialChangeSets.map((item) => [item.id, item])));
  const [draft, setDraft] = useState(""); const [working, setWorking] = useState<"sending" | "applying" | "rejecting" | "previewing" | null>(null);
  const [error, setError] = useState(""); const [preview, setPreview] = useState<{ id: string; schema: OnboardingSchema } | null>(null);
  const busy = useRef(false); const scroller = useRef<HTMLDivElement>(null); const input = useRef<HTMLTextAreaElement>(null);
  const sending = working === "sending";
  const composingLocked = disabled || sending;
  const unavailable = Boolean(working) || disabled;
  const canSend = Boolean(draft.trim()) && !unavailable;
  const starters = useMemo(() => agentStarterPrompts(schema, reviewRules), [schema, reviewRules]);
  const last = messages.at(-1);
  const lastSet = last?.changeSetId ? sets[last.changeSetId] : undefined;
  const nextPrompts = lastSet?.status === "applied" ? agentNextPrompts(lastSet.details) : [];
  useEffect(() => { if (autoFocus && matchMedia("(min-width:1100px)").matches) input.current?.focus(); }, [autoFocus]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "instant" }); }, [messages, working]);
  useEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.overflowY = "hidden";
    field.style.height = "0px";
    const next = Math.min(Math.max(field.scrollHeight, 40), 120);
    field.style.height = `${next}px`;
    field.style.overflowY = field.scrollHeight > 120 ? "auto" : "hidden";
  }, [draft]);
  function stale(item: AgentChangeSetView) { return item.status === "superseded" || (item.status === "proposed" && currentRevision !== undefined && item.baseDraftRevision !== currentRevision); }
  async function send(text = draft) {
    const message = text.trim(); if (!message || busy.current || disabled) return;
    busy.current = true; setWorking("sending"); setError("");
    try {
      await onFlushSave?.();
      setMessages((previous) => { const lastTurn = previous.at(-1); if (lastTurn?.role === "user" && lastTurn.content === message) return previous; return [...previous, { id: crypto.randomUUID(), role: "user", content: message }]; }); setDraft("");
      const response = await fetch(`/api/forms/${formId}/agent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const payload = await response.json();
      if (!response.ok || !payload.message) throw new Error(payload.error || FAIL);
      setMessages((previous) => [...previous, payload.message]);
      if (payload.changeSet) setSets((previous) => ({ ...previous, [payload.changeSet.id]: payload.changeSet }));
    } catch (reason) { setDraft(message); setError(reason instanceof Error ? reason.message : FAIL); }
    finally { busy.current = false; setWorking(null); }
  }
  async function decide(id: string, action: "apply" | "reject" | "preview") {
    if (busy.current || disabled) return; busy.current = true; setWorking(action === "apply" ? "applying" : action === "reject" ? "rejecting" : "previewing"); setError("");
    if (action === "apply") onApplying?.(true);
    try {
      if (action !== "reject") await onFlushSave?.();
      const response = await fetch(`/api/forms/${formId}/agent/change-sets/${id}/${action}`, { method: action === "preview" ? "GET" : "POST" });
      const payload = await response.json();
      if (!response.ok) { if (response.status === 409) setSets((previous) => ({ ...previous, [id]: { ...previous[id], status: "superseded" } })); throw new Error(payload.error || "Could not complete that action. Your draft is unchanged."); }
      if (action === "preview") { if (!payload.schema) throw new Error("This proposal preview is unavailable. Your draft is unchanged."); setPreview({ id, schema: payload.schema }); }
      else if (action === "apply") {
        if (!payload.schema || payload.revision == null) throw new Error("Could not confirm those changes. Reload the saved draft before continuing.");
        onApplied({ schema: payload.schema, revision: payload.revision, clientIdentityMapping: payload.clientIdentityMapping ?? null, reviewRules: payload.reviewRules, formName: payload.formName });
        setSets((previous) => ({ ...previous, [id]: { ...previous[id], status: "applied" } })); setPreview(null);
      } else setSets((previous) => ({ ...previous, [id]: { ...previous[id], status: "rejected" } }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not complete that action. Try again."); }
    finally { busy.current = false; setWorking(null); onApplying?.(false); }
  }
  return <aside className="bw-agent-panel" data-empty={messages.length ? undefined : "true"}>
    <header className="bw-agent-heading"><span className="bw-agent-mark" aria-hidden="true">✳</span><div><p className="eyebrow">Coaching Agent</p><h2 tabIndex={-1}>{messages.length ? "Ask for a change." : "Let’s build it together."}</h2></div></header>
    <div className="bw-conversation" ref={scroller} aria-label="Agent conversation">
      {!messages.length ? <div className="bw-agent-welcome">
        <h3>Tell me what to change.</h3>
        <p>Describe the onboarding in ordinary language. I propose the edit. You apply it.</p>
        <div className="bw-suggestions">{starters.map((text) => <button key={text} type="button" disabled={unavailable} onClick={() => void send(text)}>{text}<ArrowRight size={16} /></button>)}</div>
        {onOpenBuilder ? <button type="button" className="bw-quiet" onClick={onOpenBuilder}>Or start in Build<ArrowRight size={16} /></button> : null}
      </div> : null}
      {messages.map((message) => {
        const proposal = message.changeSetId ? sets[message.changeSetId] : undefined;
        const outdated = proposal ? stale(proposal) : false;
        const pending = proposal?.status === "proposed" && !outdated;
        const state = proposal ? outdated ? "superseded" : proposal.status : undefined;
        const changes = proposal ? parseChangeDetails(proposal.details) : [];
        const destructive = proposal ? isDestructiveProposal(proposal.details) : false;
        return <article className="bw-turn" data-role={message.role} key={message.id}>
          {message.role === "user" ? <p className="bw-coach"><span>You</span>{message.content}</p> : <div className="bw-agent-copy">{message.content ? <p>{message.content}</p> : null}
            {proposal ? <section className="bw-changeset" data-state={state} data-kind={destructive && pending ? "destructive" : undefined}>
              <div className="bw-changeset-head">
                <h3>{pending ? "Proposed changes" : state === "applied" ? "Applied to draft" : state === "rejected" ? "Rejected" : "Outdated proposal"}</h3>
                {pending ? <p className="bw-changeset-flag">Not applied</p> : <StatusBadge status={outdated ? "superseded" : proposal.status} />}
              </div>
              {pending ? <>
                <ul className="bw-change-list">{(changes.length ? changes : [{ kind: "other" as const, verb: "Change", label: proposal.summary, destructive: false }]).map((item, index) => <li key={index} data-kind={item.kind}><span>{item.verb}</span> {item.label}</li>)}</ul>
                <p className="bw-note">{destructive ? "This removes content from your draft. Publish is still separate." : "This stays a draft until you publish."}</p>
                <button type="button" className="bw-proposal-preview" disabled={unavailable} onClick={() => void decide(proposal.id, "preview")}><Eye size={16} />Preview proposed form</button>
                <div className="bw-proposal-actions">
                  <button type="button" className="bw-secondary" disabled={unavailable} onClick={() => void decide(proposal.id, "reject")}>Reject</button>
                  <button type="button" className="bw-primary" disabled={unavailable} onClick={() => void decide(proposal.id, "apply")}>Apply changes<Check size={16} /></button>
                </div>
              </> : <div className="bw-proposal-receipt">
                <p>{outdated ? "Your draft changed after this proposal. Ask again for an updated version." : proposal.status === "applied" ? "In your draft. Clients see it after you publish." : "Rejected. The draft was not changed."}</p>
                {outdated ? <div className="bw-actions"><button type="button" className="bw-secondary" disabled={unavailable} onClick={() => void send("Update your last proposal for the current draft.")}>Update proposal</button>{proposal.status === "proposed" ? <button type="button" className="bw-quiet" disabled={unavailable} onClick={() => void decide(proposal.id, "reject")}>Reject</button> : null}</div>
                  : proposal.status === "applied" && onOpenBuilder ? <button type="button" className="bw-quiet" onClick={onOpenBuilder}>View in Build<ArrowRight size={16} /></button> : null}
              </div>}
            </section> : null}
          </div>}
        </article>;
      })}
      {lastSet?.status === "applied" && nextPrompts.length ? <div className="bw-suggestions bw-suggestions-next">{nextPrompts.map((text) => <button key={text} type="button" disabled={unavailable} onClick={() => void send(text)}>{text}<ArrowRight size={16} /></button>)}</div> : null}
      {working ? <p className="bw-agent-working" role="status"><CircleNotch size={16} className="bw-spinner" />{working === "sending" ? "Working on your form…" : working === "applying" ? "Applying to your draft…" : working === "rejecting" ? "Rejecting this proposal…" : "Preparing the proposed form…"}</p> : null}
    </div>
    {error ? <div className="bw-agent-error" role="alert"><p>{error}</p><div>{draft.trim() ? <button type="button" className="bw-quiet" onClick={() => void send()}>Retry</button> : null}<button type="button" className="bw-quiet" onClick={() => setError("")}>Dismiss</button></div></div> : null}
    <form
      className="bw-composer"
      data-busy={working || undefined}
      data-ready={canSend ? "true" : undefined}
      aria-busy={sending}
      onSubmit={(event) => { event.preventDefault(); void send(); }}
    >
      <div className="bw-composer-dock">
        <label>
          <span className="sr-only">Describe a change for the Agent</span>
          <textarea
            ref={input}
            id="agent-composer"
            rows={1}
            value={draft}
            enterKeyHint="enter"
            placeholder="Describe the change…"
            disabled={composingLocked}
            aria-invalid={error ? true : undefined}
            style={{ resize: "none" }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              if (event.shiftKey) return;
              if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <button
          type="submit"
          className="bw-composer-send"
          disabled={!canSend}
          aria-label={sending ? "Sending" : "Send to Agent"}
          aria-keyshortcuts="Control+Enter Meta+Enter"
        >
          {sending ? <CircleNotch size={18} className="bw-spinner" /> : <ArrowUp size={18} weight="bold" />}
        </button>
      </div>
    </form>
    {preview ? <Modal titleId="proposal-preview-title" onClose={() => { if (!working) setPreview(null); }}><div className="bw-proposal-dialog"><p className="eyebrow">Proposed · Not applied</p><h2 id="proposal-preview-title">Preview proposed changes</h2><p className="bw-note">This is the form the Agent proposes. Your draft has not changed.</p>{error ? <p role="alert" className="bw-inline-error">{error}</p> : null}<FormPreview schema={preview.schema} branding={branding} /><div className="bw-dialog-actions"><button type="button" className="bw-secondary" disabled={unavailable} onClick={() => setPreview(null)}>Close preview</button><button type="button" className="bw-primary" disabled={unavailable || stale(sets[preview.id])} onClick={() => void decide(preview.id, "apply")}>{working === "applying" ? "Applying…" : "Apply changes"}</button></div></div></Modal> : null}
  </aside>;
}
