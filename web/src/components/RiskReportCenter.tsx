import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock } from './feedback'
import type { CommentEntry, ProjectMemberEntry, ReportApprovalEntry, ReportDraftEntry, RiskCenterEntry } from '../api/dto'

const RISK_ACTIONS = ['acknowledge', 'resolve', 'dismiss', 'reopen'] as const
const APPROVALS = ['approved', 'rejected', 'request_changes'] as const

function formatDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value || '—' : parsed.toLocaleString()
}

function download(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.click()
  URL.revokeObjectURL(href)
}

export function RiskReportCenter({ projectId }: { projectId: string }) {
  const { client, user } = useAuth()
  const [tab, setTab] = useState<'risks' | 'reports'>('risks')
  const [risks, setRisks] = useState<RiskCenterEntry[]>([])
  const [reports, setReports] = useState<ReportDraftEntry[]>([])
  const [members, setMembers] = useState<ProjectMemberEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [nextRisks, nextReports, nextMembers] = await Promise.all([
        client.listRisks(projectId), client.listReportDrafts(projectId), client.listMembers(projectId),
      ])
      setRisks(nextRisks); setReports(nextReports); setMembers(nextMembers)
    } catch (cause) { setError(cause as Error) } finally { setLoading(false) }
  }, [client, projectId])

  useEffect(() => { void load() }, [load])
  const role = members.find((member) => member.user_id === user?.user_id)?.role
  const canManage = role === 'admin' || role === 'pm'

  return <section className="card risk-report-center" aria-label="Risk and report center">
    <div className="card-title"><div><h2>Risk and report center</h2><p>Review project risks and prepare approval-ready reports.</p></div><button type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    <div className="tab-bar"><button type="button" className={`tab ${tab === 'risks' ? 'selected' : ''}`} onClick={() => setTab('risks')}>Risks ({risks.length})</button><button type="button" className={`tab ${tab === 'reports' ? 'selected' : ''}`} onClick={() => setTab('reports')}>Reports ({reports.length})</button></div>
    {error ? <ErrorBanner error={error} onRetry={() => void load()} /> : null}
    {loading ? <LoadingBlock label="Loading risks and reports…" /> : null}
    {!loading && tab === 'risks' ? <RiskPanel projectId={projectId} risks={risks} members={members} canManage={canManage} onChanged={load} /> : null}
    {!loading && tab === 'reports' ? <ReportPanel projectId={projectId} reports={reports} canManage={canManage} onChanged={load} /> : null}
  </section>
}

function RiskPanel({ projectId, risks, members, canManage, onChanged }: { projectId: string; risks: RiskCenterEntry[]; members: ProjectMemberEntry[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const { client } = useAuth()
  const [severity, setSeverity] = useState('')
  const [lifecycle, setLifecycle] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignee, setAssignee] = useState('')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const selected = risks.find((risk) => risk.record_id === selectedId) ?? null
  const visible = useMemo(() => risks.filter((risk) => (!severity || risk.severity === severity) && (!lifecycle || risk.lifecycle === lifecycle)), [risks, severity, lifecycle])

  const act = async (action: typeof RISK_ACTIONS[number]) => {
    if (!selected || pending) return
    const high = selected.severity === 'high' || selected.severity === 'critical'
    if ((action === 'resolve' || action === 'dismiss') && high && !window.confirm(`Confirm ${action} for this ${selected.severity} risk? This action is audited.`)) return
    setPending(true); setError(null)
    try { await client.updateRiskLifecycle(projectId, selected.record_id, { action, note }); setNote(''); await onChanged() } catch (cause) { setError(cause as Error) } finally { setPending(false) }
  }
  const assign = async () => {
    if (!selected || !assignee || pending) return
    setPending(true); setError(null)
    try { await client.assignRisk(projectId, selected.record_id, { risk_id: selected.record_id, assignee_user_id: assignee }); await onChanged() } catch (cause) { setError(cause as Error) } finally { setPending(false) }
  }

  return <div className="risk-layout"><div><div className="filter-bar"><label>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="">All</option><option>critical</option><option>high</option><option>medium</option><option>low</option></select></label><label>Status<select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)}><option value="">All</option><option>active</option><option>acknowledged</option><option>resolved</option><option>dismissed</option><option>expired</option></select></label></div>{error ? <ErrorBanner error={error} /> : null}{visible.length === 0 ? <EmptyState title="No matching risks" hint="A risk scan will add risks when it finds evidence gaps, deadlines, or blocked dependencies." /> : <table><thead><tr><th>Risk</th><th>Severity</th><th>Status</th><th>Owner</th><th>Discussion</th></tr></thead><tbody>{visible.map((risk) => <tr key={risk.record_id} className={risk.record_id === selectedId ? 'selected-row' : ''} onClick={() => { setSelectedId(risk.record_id); setAssignee(risk.assigned_to ?? '') }}><td>{risk.title}</td><td><span className={`risk-${risk.severity}`}>{risk.severity}</span></td><td>{risk.lifecycle}</td><td>{risk.assignee_name ?? 'Unassigned'}</td><td>{risk.comment_count}</td></tr>)}</tbody></table>}</div>{selected ? <aside className="task-detail"><h3>{selected.title}</h3><p>{selected.description || 'No additional description was recorded.'}</p><dl><dt>Risk ID</dt><dd>{selected.record_id}</dd><dt>Severity</dt><dd>{selected.severity}</dd><dt>Status</dt><dd>{selected.lifecycle}</dd><dt>Created</dt><dd>{formatDate(selected.created_at)}</dd></dl>{canManage ? <><label>Assign owner<select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Select member</option>{members.filter((m) => m.role !== 'guest').map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name} ({member.role})</option>)}</select></label><button type="button" disabled={!assignee || pending} onClick={() => void assign()}>Assign</button><textarea aria-label="Risk action note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Action note (recorded with the lifecycle change)" /> <div className="actions">{RISK_ACTIONS.map((action) => <button key={action} type="button" disabled={pending} onClick={() => void act(action)}>{action}</button>)}</div></> : <p className="muted">Only a project manager or administrator can assign or close risks.</p>}<Discussion projectId={projectId} entityType="risk" entityId={selected.record_id} /></aside> : null}</div>
}

function ReportPanel({ projectId, reports, canManage, onChanged }: { projectId: string; reports: ReportDraftEntry[]; canManage: boolean; onChanged: () => Promise<void> }) {
  const { client } = useAuth()
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null)
  const selected = reports.find((report) => report.id === selectedId) ?? null
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [comment, setComment] = useState('')
  const [approvals, setApprovals] = useState<ReportApprovalEntry[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => { if (!selectedId && reports[0]) setSelectedId(reports[0].id) }, [reports, selectedId])
  useEffect(() => { if (selected) { setTitle(selected.title); setContent(selected.content_md); void client.getReportApprovals(projectId, selected.id).then(setApprovals).catch((cause) => setError(cause as Error)) } }, [client, projectId, selected?.id])
  const refresh = async () => { await onChanged() }
  const save = async () => { if (!selected || pending) return; setPending(true); try { await client.updateReportDraft(projectId, selected.id, { title, content_md: content }); await refresh() } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  const create = async () => { const nextTitle = window.prompt('Draft title'); if (!nextTitle) return; setPending(true); try { const draft = await client.createReportDraft(projectId, { title: nextTitle, content_md: '# ' + nextTitle + '\n' }); await refresh(); setSelectedId(draft.id) } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  const submit = async () => { if (!selected) return; setPending(true); try { await client.submitReport(projectId, selected.id); await refresh() } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  const decide = async (decision: typeof APPROVALS[number]) => { if (!selected) return; setPending(true); try { await client.decideReport(projectId, selected.id, { decision, comment }); setComment(''); await refresh(); setApprovals(await client.getReportApprovals(projectId, selected.id)) } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  const exportFile = async (format: 'pdf' | 'docx') => { if (!selected) return; setPending(true); try { const file = await client.downloadReport(projectId, selected.id, format); download(file.blob, file.filename) } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  return <div className="report-layout"><div className="report-list"><button type="button" className="primary" disabled={pending} onClick={() => void create()}>New draft</button>{reports.length === 0 ? <EmptyState title="No report drafts" hint="Create a draft from the current project findings." /> : reports.map((report) => <button type="button" key={report.id} className={`run-row ${report.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(report.id)}><strong>{report.title}</strong><span>{report.status} · v{report.version}</span><small>{formatDate(report.updated_at)}</small></button>)}</div>{selected ? <div className="report-editor"><h3>{selected.title}</h3>{error ? <ErrorBanner error={error} /> : null}<label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} disabled={selected.status !== 'draft'} /></label><div className="markdown-grid"><label>Markdown<textarea aria-label="Report Markdown" value={content} onChange={(e) => setContent(e.target.value)} disabled={selected.status !== 'draft'} /></label><article className="markdown-preview"><h4>Preview</h4><pre>{content}</pre><p className="muted">Source links must be project-scoped. Structured citation navigation is deferred until the backend exposes report citation records.</p></article></div><div className="actions">{selected.status === 'draft' ? <><button type="button" disabled={pending} onClick={() => void save()}>Save draft</button><button type="button" disabled={pending} onClick={() => void submit()}>Submit for approval</button></> : null}<button type="button" disabled={pending} onClick={() => void exportFile('pdf')}>Export PDF</button><button type="button" disabled={pending} onClick={() => void exportFile('docx')}>Export DOCX</button></div>{canManage && selected.status === 'submitted' ? <div className="approval-box"><h4>Approval decision</h4><textarea aria-label="Approval comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Required review comment or change request" /> <div className="actions">{APPROVALS.map((decision) => <button type="button" key={decision} disabled={pending} onClick={() => void decide(decision)}>{decision}</button>)}</div></div> : null}{!canManage && selected.status === 'submitted' ? <p className="muted">Only a project manager or administrator can approve this report.</p> : null}<h4>Approval history</h4>{approvals.length ? <ul className="history-list">{approvals.map((item) => <li key={item.id}><strong>{item.decision} by {item.approver_name}</strong><span>{item.comment || 'No comment'}</span><small>{formatDate(item.created_at)}</small></li>)}</ul> : <p className="muted">No approval decisions yet.</p>}<Discussion projectId={projectId} entityType="report" entityId={selected.id} /></div> : <EmptyState title="Select a report" hint="Choose a draft to edit, review, or export." />}</div>
}

function Discussion({ projectId, entityType, entityId }: { projectId: string; entityType: 'risk' | 'report'; entityId: string }) {
  const { client } = useAuth(); const [items, setItems] = useState<CommentEntry[]>([]); const [body, setBody] = useState(''); const [error, setError] = useState<Error | null>(null)
  const load = useCallback(() => client.listComments(projectId, entityType, entityId).then(setItems).catch((cause) => setError(cause as Error)), [client, entityId, entityType, projectId])
  useEffect(() => { void load() }, [load])
  const post = async () => { if (!body.trim()) return; try { await client.createComment(projectId, { entity_type: entityType, entity_id: entityId, body }); setBody(''); await load() } catch (cause) { setError(cause as Error) } }
  return <div className="discussion"><h4>Discussion</h4>{error ? <ErrorBanner error={error} /> : null}{items.map((item) => <p key={item.id}><strong>{item.author_name}</strong> · {item.body}</p>)}<textarea aria-label="Discussion comment" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a project discussion comment" /><button type="button" onClick={() => void post()}>Comment</button></div>
}
