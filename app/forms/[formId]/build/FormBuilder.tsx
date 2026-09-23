"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChatCircleText, DotsThreeVertical, ListBullets, Eye, Plus, Check, CircleNotch, CaretRight } from "@phosphor-icons/react";
import { FormPreview } from "@/app/forms/[formId]/preview/FormPreview";
import { archiveFormAction, publishFormAction } from "@/lib/forms/actions";
import { addField, addSection, deleteField, deleteSection, duplicateField, FIELD_TYPES, moveField, moveSection, updateField } from "@/lib/forms/schema-ops";
import { allFields } from "@/lib/onboarding/schema/visibility";
import { EMPTY_REVIEW_RULES, type ReviewRuleSet } from "@/lib/review/types";
import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type { FieldType, FormField, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { Modal } from "@/components/product/Modal";
import { AgentPanel, type AgentChangeSetView, type AgentChatMessage } from "./AgentPanel";
import { ReviewRulesEditor } from "./ReviewRulesEditor";
import { QuestionEditor, TYPE_LABELS } from "./QuestionEditor";
import { FormSettings } from "./FormSettings";
import { useBuilderDraft } from "./useBuilderDraft";
import "./builder.css";

type Selection = { kind: "overview" | "settings" | "rules" } | { kind: "section" | "field"; id: string };
type VersionSummary = { id: string; versionNumber: number; publishedAt: string };
export function FormBuilder({ formId, formName, slug, status, activeVersionNumber, initialSchema, initialRevision, initialIdentity, initialReviewRules, versions, branding, initialMessages, initialChangeSets, initialPublishedSnapshot }: {
  formId: string; formName: string; slug: string; status: string; activeVersionNumber: number | null; initialSchema: OnboardingSchema; initialRevision: number; initialIdentity: ClientIdentityMapping | null; initialReviewRules: ReviewRuleSet | null; versions: VersionSummary[]; branding: { businessName: string; coachName: string; primaryColor: string | null }; initialMessages: AgentChatMessage[]; initialChangeSets: AgentChangeSetView[]; initialPublishedSnapshot?: { schema: OnboardingSchema; identity: ClientIdentityMapping | null; reviewRules: ReviewRuleSet | null } | null;
}) {
  const router = useRouter(); const search = useSearchParams();
  const { draft, queue, edit, flush, recovered, downloadRecovery, discardRecovery } = useBuilderDraft(formId, { name: formName, schema: initialSchema, identity: initialIdentity, reviewRules: initialReviewRules ?? EMPTY_REVIEW_RULES }, initialRevision);
  const { schema } = draft;
  const [mode, setMode] = useState<"agent" | "build" | "preview">(search.get("agent") === "1" || allFields(initialSchema).length === 0 ? "agent" : "build");
  const [selection, setSelection] = useState<Selection>({ kind: "overview" });
  const [dialog, setDialog] = useState<"section" | "question" | "publish" | "delete" | "reload" | "archive" | null>(null);
  const [addTo, setAddTo] = useState(""); const [newTitle, setNewTitle] = useState(""); const [newType, setNewType] = useState<FieldType>("short_text");
  const [notice, setNotice] = useState(""); const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false); const actionLock = useRef(false); const [agentBusy, setAgentBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); const moreRef = useRef<HTMLDivElement>(null);
  const [published, setPublished] = useState(activeVersionNumber); const [publishedFingerprint, setPublishedFingerprint] = useState<string | null>(initialPublishedSnapshot ? fingerprint(initialPublishedSnapshot) : null);
  const root = useRef<HTMLElement>(null); const inspector = useRef<HTMLDivElement>(null);
  const selectedField = selection.kind === "field" ? allFields(schema).find((field) => field.id === selection.id) : undefined;
  const selectedSection = selection.kind === "section" ? schema.sections.find((section) => section.id === selection.id) : undefined;
  const fieldSection = selectedField ? schema.sections.find((section) => section.fields.some((field) => field.id === selectedField.id)) : undefined;
  const fieldsCount = allFields(schema).length;
  const unpublished = publishedFingerprint ? publishedFingerprint !== fingerprint(draft) : Boolean(published);
  const locked = busy || agentBusy;
  useEffect(() => {
    const viewport = window.visualViewport;
    const size = () => { if (viewport && viewport.scale === 1) root.current?.style.setProperty("--builder-viewport", viewport.height + "px"); };
    size(); viewport?.addEventListener("resize", size); return () => viewport?.removeEventListener("resize", size);
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(event: MouseEvent) { if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false); }
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setMoreOpen(false); }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [moreOpen]);
  function choose(next: Selection) { setSelection(next); setFailure(""); requestAnimationFrame(() => { inspector.current?.scrollTo({ top: 0 }); inspector.current?.querySelector<HTMLElement>("h2")?.focus(); }); }
  function change(next: OnboardingSchema) { edit({ ...queue.value, schema: next }); setFailure(""); }
  function mutate(operation: (value: OnboardingSchema) => OnboardingSchema) { try { change(operation(queue.value.schema)); return true; } catch (error) { setFailure(error instanceof Error ? error.message : "Could not change the draft."); return false; } }
  function changeField(patch: Partial<FormField> & { type?: FieldType }) {
    if (!selectedField) return;
    if (patch.type && patch.type !== selectedField.type) { mutate((value) => { const next = updateField(value, selectedField.id, patch); return { ...next, sections: next.sections.map((section) => ({ ...section, fields: section.fields.map((field) => field.id === selectedField.id ? { ...field, required: selectedField.required, description: selectedField.description, logic: selectedField.logic } : field) })) }; }); return; }
    change({ ...schema, sections: schema.sections.map((section) => ({ ...section, fields: section.fields.map((field) => field.id === selectedField.id ? { ...field, ...patch } as FormField : field) })) });
  }
  function openAdd(kind: "section" | "question", sectionId = "") { setNewTitle(""); setNewType("short_text"); setAddTo(sectionId); setDialog(kind); }
  function add() {
    if (!newTitle.trim()) return;
    try {
      const next = dialog === "section" ? addSection(schema, newTitle.trim()) : addField(schema, addTo, newType, newTitle.trim());
      change(next); setDialog(null); setMode("build");
      if (dialog === "section") choose({ kind: "section", id: next.sections.at(-1)!.id });
      else choose({ kind: "field", id: next.sections.find((section) => section.id === addTo)!.fields.at(-1)!.id });
    } catch (error) { setFailure(error instanceof Error ? error.message : "Could not add this question."); }
  }
  async function publish() {
    if (actionLock.current) return; actionLock.current = true; setBusy(true); setFailure("");
    try {
      await flush(); const result = await publishFormAction(formId);
      if (!("ok" in result && result.ok)) throw new Error("error" in result ? result.error : "Could not publish.");
      setPublished(result.versionNumber); setPublishedFingerprint(fingerprint(queue.value)); setDialog(null); setNotice("Published. Your client link now shows this onboarding."); router.refresh();
    } catch (error) { setDialog(null); setFailure(error instanceof Error ? error.message : "Could not publish. Your draft is still here."); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function archive() {
    if (actionLock.current) return; actionLock.current = true; setBusy(true);
    try { await flush(); const result = await archiveFormAction(formId); if (!("ok" in result && result.ok)) throw new Error("Could not archive this form."); router.push("/forms"); }
    catch (error) { setFailure(error instanceof Error ? error.message : "Could not archive."); setDialog(null); }
    finally { actionLock.current = false; setBusy(false); }
  }
  function remove() {
    if (selectedField && mutate((value) => deleteField(value, selectedField.id))) { choose({ kind: "overview" }); setDialog(null); }
    else if (selectedSection && mutate((value) => deleteSection(value, selectedSection.id))) { choose({ kind: "overview" }); setDialog(null); }
  }
  function switchMode(next: typeof mode) { setMoreOpen(false); setMode(next); requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(next === "agent" ? ".bw-agent h2" : next === "build" ? ".bw-build h2" : ".bw-preview h2")?.focus()); }
  function openTool(kind: "rules" | "settings") { setMoreOpen(false); setMode("build"); choose({ kind }); }
  const saveLabel = { saved: "Saved", unsaved: "Unsaved changes", saving: "Saving…", error: "Not saved", conflict: "Draft conflict" }[queue.state];
  return <main className="bw-workspace" ref={root}>
    <header className="bw-header">
      <div className="bw-identity">
        <Link href="/forms" aria-label="Back to Forms" onClick={(event) => { if (queue.dirty) { event.preventDefault(); void flush().then(() => router.push("/forms")).catch(() => setFailure("Your edits haven’t saved. Retry before leaving, or download a recovery copy.")); } }}><ArrowLeft size={16} />Forms</Link>
        <h1 title={draft.name || "Untitled onboarding"}>{draft.name || "Untitled onboarding"}</h1>
        <p className="bw-pub" data-state={published ? unpublished ? "changes" : "live" : "draft"} title={published ? unpublished ? "Published · Unpublished changes" : "Published · Up to date" : "Draft · Not published"}>{published ? unpublished ? "Published · Unpublished changes" : "Published · Up to date" : "Draft · Not published"}</p>
      </div>
      <nav className="bw-modes" aria-label="Workspace modes">{([{ value: "agent", label: "Agent", Icon: ChatCircleText }, { value: "build", label: "Build", Icon: ListBullets }, { value: "preview", label: "Preview", Icon: Eye }] as const).map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => switchMode(value)}><Icon size={16} />{label}{value === "build" ? <small>{fieldsCount}</small> : null}</button>)}</nav>
      <div className="bw-header-actions">
        <span className="bw-save" data-state={queue.state} role="status">{queue.state === "saving" ? <CircleNotch className="bw-spinner" size={15} /> : queue.state === "saved" ? <Check size={15} /> : null}{saveLabel}</span>
        <div className="bw-more" ref={moreRef}>
          <button type="button" className="bw-icon-button" aria-label="Form tools" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((open) => !open)}><DotsThreeVertical size={20} weight="bold" /></button>
          {moreOpen ? <div className="bw-more-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => openTool("rules")}>Review rules</button>
            <button type="button" role="menuitem" onClick={() => openTool("settings")}>Form settings</button>
          </div> : null}
        </div>
        <button type="button" className="bw-primary" disabled={locked || queue.state === "conflict"} onClick={() => setDialog("publish")}>Publish<ArrowRight size={15} /></button>
      </div>
    </header>
    {(failure || queue.error) ? <div className="bw-banner bw-banner-error" role="alert"><p>{failure || queue.error}{queue.state === "conflict" ? " Your edits are kept on this device. Review or download them before loading the saved draft." : " Your edits are still here."}</p><div>{queue.state === "error" || queue.state === "unsaved" ? <button type="button" onClick={() => void flush().catch(() => undefined)}>Retry save</button> : null}{queue.dirty ? <button type="button" onClick={downloadRecovery}>Download my edits</button> : null}{queue.state === "conflict" ? <button type="button" onClick={() => setDialog("reload")}>Load saved draft</button> : <button type="button" onClick={() => setFailure("")}>Dismiss</button>}</div></div> : notice ? <div className="bw-banner" role="status"><p>{notice}</p><button type="button" onClick={() => setNotice("")}>Dismiss</button></div> : recovered && queue.dirty ? <div className="bw-banner" role="status">Your unsaved edits were recovered on this device. Review them, then <button type="button" onClick={() => void flush().catch(() => undefined)}>Save recovered edits</button>.</div> : null}
    <div className="bw-panes" data-mode={mode}>
      <div className="bw-agent"><AgentPanel formId={formId} initialMessages={initialMessages} initialChangeSets={initialChangeSets} currentRevision={queue.revision} schema={schema} reviewRules={draft.reviewRules} disabled={busy} branding={branding} onFlushSave={flush} onApplying={setAgentBusy} onOpenBuilder={() => switchMode("build")} onApplied={(next) => { queue.replace({ name: next.formName ?? queue.value.name, schema: next.schema, identity: next.clientIdentityMapping, reviewRules: next.reviewRules ?? queue.value.reviewRules }, next.revision); setNotice("Changes applied to your draft. Preview before publishing."); choose({ kind: "overview" }); }} /></div>
      <div className="bw-build" ref={inspector}><fieldset disabled={locked} className="bw-editor-fieldset"><div className="bw-build-toolbar">{selection.kind !== "overview" ? <button type="button" className="bw-back" onClick={() => choose({ kind: "overview" })}><ArrowLeft size={16} />All sections</button> : <span className="eyebrow">Your onboarding</span>}<div><button type="button" className="bw-quiet" onClick={() => choose({ kind: "rules" })}>Review rules <small>{draft.reviewRules?.rules.length ?? 0}</small></button><button type="button" className="bw-quiet" onClick={() => choose({ kind: "settings" })}>Form settings</button></div></div>
      {selection.kind === "overview" ? <div className="bw-overview"><div className="bw-section-heading"><div><h2 tabIndex={-1}>Build your onboarding</h2><p>{schema.sections.length} sections · {fieldsCount} questions</p></div><button type="button" className="bw-secondary" onClick={() => openAdd("section")}><Plus size={16} />Add section</button></div>{!fieldsCount ? <div className="bw-empty"><h3>Start with your client’s story.</h3><p>Describe what you need to the Agent, or add your first question below.</p><button type="button" className="bw-secondary" onClick={() => switchMode("agent")}>Ask the Agent</button></div> : null}<div className="bw-section-list">{schema.sections.map((section, index) => <details className="bw-section" key={section.id} open><summary><span className="bw-section-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{section.title}</strong><small>{section.fields.length} questions</small></span><CaretRight size={17} /></summary><div><div className="bw-section-tools"><p>{section.description || "Keep related questions together."}</p><button type="button" onClick={() => choose({ kind: "section", id: section.id })}>Edit section</button></div>{section.fields.map((field, fieldIndex) => <button className="bw-question-row" key={field.id} type="button" onClick={() => choose({ kind: "field", id: field.id })}><span>{fieldIndex + 1}</span><span><strong>{field.label || "Untitled question"}</strong><small>{TYPE_LABELS[field.type]} · {field.required ? "Required" : "Optional"}{field.logic ? " · Conditional" : ""}</small></span><CaretRight size={16} /></button>)}<button type="button" className="bw-add-question" onClick={() => openAdd("question", section.id)}><Plus size={17} />Add question</button></div></details>)}</div></div> : null}
      {selectedSection ? <div className="bw-inspector"><h2 tabIndex={-1}>Edit section</h2><label>Section name<input value={selectedSection.title} onChange={(event) => change({ ...schema, sections: schema.sections.map((section) => section.id === selectedSection.id ? { ...section, title: event.target.value, navLabel: event.target.value } : section) })} /></label><label>Section introduction<textarea rows={3} value={selectedSection.description ?? ""} onChange={(event) => change({ ...schema, sections: schema.sections.map((section) => section.id === selectedSection.id ? { ...section, description: event.target.value } : section) })} /></label><div className="bw-actions"><button type="button" className="bw-secondary" disabled={schema.sections[0]?.id === selectedSection.id} onClick={() => mutate((value) => moveSection(value, selectedSection.id, -1))}>Move up</button><button type="button" className="bw-secondary" disabled={schema.sections.at(-1)?.id === selectedSection.id} onClick={() => mutate((value) => moveSection(value, selectedSection.id, 1))}>Move down</button><button type="button" className="bw-secondary" onClick={() => openAdd("question", selectedSection.id)}>Add question</button><button type="button" className="bw-text-danger" disabled={schema.sections.length <= 1} onClick={() => setDialog("delete")}>Delete section</button></div></div> : null}
      {selectedField ? <div className="bw-inspector"><p className="eyebrow">{fieldSection?.title}</p><h2 tabIndex={-1}>Edit question</h2><QuestionEditor key={selectedField.id} field={selectedField} schema={schema} onChange={changeField} canUp={fieldSection?.fields[0]?.id !== selectedField.id} canDown={fieldSection?.fields.at(-1)?.id !== selectedField.id} onMove={(direction) => mutate((value) => moveField(value, selectedField.id, direction))} onDuplicate={() => { mutate((value) => duplicateField(value, selectedField.id)); setNotice("Question duplicated in this section."); }} onDelete={() => setDialog("delete")} /><button type="button" className="bw-primary bw-done" onClick={() => { void flush().catch(() => undefined); choose({ kind: "overview" }); }}>Done editing<Check size={16} /></button></div> : null}
      {selection.kind === "rules" ? <div className="bw-inspector"><ReviewRulesEditor schema={schema} rules={draft.reviewRules} onChange={(reviewRules) => edit({ ...queue.value, reviewRules })} /></div> : null}
      {selection.kind === "settings" ? <div className="bw-inspector"><h2 tabIndex={-1}>Form settings</h2><FormSettings draft={draft} onChange={edit} /><details className="bw-disclosure"><summary>Published versions and client link</summary><div>{published ? <><p className="bw-note">Your published onboarding stays live while you edit.</p><button type="button" className="bw-secondary" onClick={() => void navigator.clipboard.writeText(window.location.origin + "/f/" + slug).then(() => setNotice("Client link copied.")).catch(() => setFailure("Could not copy. Open the client link and copy it from your browser."))}>Copy client link</button><Link href={"/f/" + slug} target="_blank">Open client link</Link></> : <p className="bw-note">Publish before sharing a client link.</p>}<ul>{versions.map((version) => <li key={version.id}>Version {version.versionNumber} · {new Date(version.publishedAt).toLocaleDateString()}</li>)}</ul><Link href={"/forms/" + formId + "/submissions"}>View responses</Link></div></details><button type="button" className="bw-text-danger" disabled={status === "archived"} onClick={() => setDialog("archive")}>Archive form</button></div> : null}
      </fieldset></div>
      <div className="bw-preview"><div className="bw-preview-heading"><div><p className="eyebrow">Client experience</p><h2 tabIndex={-1}>Preview your draft</h2><p>Try the onboarding as a client. Nothing is submitted.</p></div><button type="button" className="bw-secondary" onClick={() => switchMode("build")}>Back to Build</button></div>{mode === "preview" ? <FormPreview schema={schema} branding={branding} /> : null}</div>
    </div>
    {dialog ? <Modal titleId="builder-dialog-title" onClose={() => { if (!busy) setDialog(null); }}><div className="bw-dialog"><p className="eyebrow">{dialog === "question" ? "New question" : "Your onboarding"}</p><h2 id="builder-dialog-title">{dialog === "section" ? "Add a section" : dialog === "question" ? "What would you like to ask?" : dialog === "publish" ? published ? "Publish your changes?" : "Ready for your clients?" : dialog === "reload" ? "Load the saved draft?" : dialog === "archive" ? "Archive this form?" : "Remove " + (selectedField ? "this question?" : "this section?")}</h2>
      {dialog === "section" || dialog === "question" ? <form onSubmit={(event) => { event.preventDefault(); add(); }}>{dialog === "question" ? <label>Answer type<select value={newType} onChange={(event) => setNewType(event.target.value as FieldType)}>{FIELD_TYPES.map((type) => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label> : null}<label>{dialog === "section" ? "Section name" : "Question"}<input value={newTitle} autoFocus onChange={(event) => setNewTitle(event.target.value)} placeholder={dialog === "section" ? "e.g. Training experience" : "e.g. What is your main goal?"} /></label><p className="bw-note">You can refine the details after adding it.</p><div className="bw-dialog-actions"><button type="button" className="bw-secondary" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="bw-primary" disabled={!newTitle.trim()}>Add {dialog}</button></div></form> : <><p>{dialog === "publish" ? published ? "Your current client link will show this draft. Earlier submissions keep their original questions." : "We’ll save your draft and check it before making your onboarding available to clients." : dialog === "reload" ? "This replaces your local edits with the saved draft. Download your edits first if you need to keep them." : dialog === "archive" ? "Clients will no longer be able to open this form. Existing submissions remain stored." : selectedField ? "This removes the question from your draft. Published versions and existing responses stay unchanged." : "All questions in this section will be removed from your draft. Published versions remain unchanged."}</p>{dialog === "publish" ? <div className="bw-publish-summary"><span>{schema.sections.length} sections</span><span>{fieldsCount} questions</span><span>{draft.reviewRules?.rules.length ?? 0} review rules</span></div> : null}{dialog === "reload" ? <button type="button" className="bw-secondary" onClick={downloadRecovery}>Download my edits</button> : null}<div className="bw-dialog-actions"><button type="button" className="bw-secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button type="button" className={dialog === "publish" ? "bw-primary" : "bw-danger"} disabled={busy} onClick={() => dialog === "publish" ? void publish() : dialog === "reload" ? discardRecovery() : dialog === "archive" ? void archive() : remove()}>{busy ? dialog === "publish" ? "Publishing…" : "Archiving…" : dialog === "publish" ? "Publish onboarding" : dialog === "reload" ? "Load saved draft" : dialog === "archive" ? "Archive form" : "Remove from draft"}</button></div></>}{failure ? <p className="bw-inline-error" role="alert">{failure}</p> : null}</div></Modal> : null}
  </main>;
}

function fingerprint(value: { schema: OnboardingSchema; identity: ClientIdentityMapping | null; reviewRules: ReviewRuleSet | null }) { return JSON.stringify({ schema: value.schema, identity: value.identity, reviewRules: value.reviewRules ?? EMPTY_REVIEW_RULES }); }
