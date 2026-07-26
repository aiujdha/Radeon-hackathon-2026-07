import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner, LoadingBlock } from './feedback'
import type { AdminHealth, BackupEntry, IntegrationExecutionResult, ScmPreviewRequest, ScmPreviewResponse } from '../api/dto'

const emptyChange: ScmPreviewRequest = {
  project_id: '', target: 'github_issues', operation: 'create', items: [{ title: '', body: '' }],
}

/**
 * UI-5's only external-write control.  The UI cannot execute until the API
 * returns an opaque, one-time confirmation ID for the exact preview payload.
 */
export function IntegrationAdminCenter({ projectId }: { projectId: string }) {
  const { client } = useAuth()
  const [change, setChange] = useState<ScmPreviewRequest>({ ...emptyChange, project_id: projectId })
  const [preview, setPreview] = useState<ScmPreviewResponse | null>(null)
  const [result, setResult] = useState<IntegrationExecutionResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => setChange((current) => ({ ...current, project_id: projectId })), [projectId])
  const updateItem = (field: 'title' | 'body', value: string) => setChange((current) => ({
    ...current, items: [{ ...current.items[0], [field]: value }],
  }))
  const createPreview = async () => {
    if (!change.items[0]?.title.trim()) return
    setPending(true); setError(null); setResult(null)
    try { setPreview(await client.previewScmChange(change)) } catch (cause) { setError(cause as Error) } finally { setPending(false) }
  }
  const execute = async () => {
    if (!preview || !window.confirm('Confirm this exact previewed change? It will be recorded as an external SCM write.')) return
    setPending(true); setError(null)
    try { setResult(await client.executeScmChange(change, preview.confirmation_id)); setPreview(null) } catch (cause) { setError(cause as Error) } finally { setPending(false) }
  }

  return <section className="card integration-center" aria-label="Controlled integration center">
    <div className="card-title"><div><h2>Controlled integrations</h2><p>Preview first. A human must confirm the exact server-issued change before any write.</p></div></div>
    {error ? <ErrorBanner error={error} onRetry={() => void createPreview()} /> : null}
    <div className="integration-form">
      <label>Target<select value={change.target} disabled={pending || Boolean(preview)} onChange={(event) => setChange((item) => ({ ...item, target: event.target.value as ScmPreviewRequest['target'] }))}><option value="github_issues">GitHub Issues</option><option value="jira">Jira</option></select></label>
      <label>Operation<select value={change.operation} disabled={pending || Boolean(preview)} onChange={(event) => setChange((item) => ({ ...item, operation: event.target.value as ScmPreviewRequest['operation'] }))}><option value="create">Create</option><option value="update">Update</option></select></label>
      <label>Issue title<input value={change.items[0]?.title ?? ''} disabled={pending || Boolean(preview)} onChange={(event) => updateItem('title', event.target.value)} placeholder="Short change title" /></label>
      <label>Description<textarea value={change.items[0]?.body ?? ''} disabled={pending || Boolean(preview)} onChange={(event) => updateItem('body', event.target.value)} placeholder="Optional description" /></label>
    </div>
    {!preview ? <button type="button" className="primary" disabled={pending || !change.items[0]?.title.trim()} onClick={() => void createPreview()}>1. Preview change</button> : <div className="preview-box"><h3>2. Review exact diff</h3><pre>{JSON.stringify(preview.preview, null, 2)}</pre><p className="muted">No token, secret, webhook URL, or credential is accepted or rendered by this screen.</p><div className="actions"><button type="button" className="primary" disabled={pending} onClick={() => void execute()}>3. Confirm and execute</button><button type="button" disabled={pending} onClick={() => setPreview(null)}>Discard preview</button></div></div>}
    {result ? <div className="execution-result"><strong>{result.summary}</strong><pre>{JSON.stringify(result.details, null, 2)}</pre><p className="muted">The connector audit records this execution. A rollback is not automatically performed; use the destination system's reviewed rollback procedure.</p></div> : null}
  </section>
}

/** Hidden completely when the server returns 403. The server remains the
 * authority: no client-side role check grants any operation. */
export function AdminOperations() {
  const { client } = useAuth()
  const [health, setHealth] = useState<AdminHealth | null>(null)
  const [backups, setBackups] = useState<BackupEntry[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [nextHealth, nextBackups] = await Promise.all([client.getAdminHealth(), client.listBackups()])
      setHealth(nextHealth); setBackups(nextBackups)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) { setHealth(null); setBackups([]); return }
      setError(cause as Error)
    } finally { setLoading(false) }
  }, [client])
  useEffect(() => { void load() }, [load])
  if (loading && !health) return null
  if (!health && !error) return null
  return <section className="card admin-operations" aria-label="System administration">
    <div className="card-title"><div><h2>System operations</h2><p>System-admin-only telemetry. Credentials and filesystem paths are intentionally not displayed.</p></div><button type="button" onClick={() => void load()}>Refresh</button></div>
    {error ? <ErrorBanner error={error} onRetry={() => void load()} /> : null}
    {health ? <><div className="grid"><Stat label="Health" value={health.status} /><Stat label="Queued calls" value={health.queue_status.queued_calls} /><Stat label="Cache hit rate" value={`${(health.cache_stats.hit_rate * 100).toFixed(1)}%`} /><Stat label="Backups" value={backups.length} /></div>
      <dl className="admin-details"><dt>Model</dt><dd>{health.model_metadata.model_name || 'Unavailable'} · {health.model_metadata.quantization || 'unknown'} · ctx {health.model_metadata.context_size || '—'}</dd><dt>Queue</dt><dd>{health.queue_status.active_llm_calls} LLM active / {health.queue_status.active_embedding_calls} embedding active / {health.queue_status.total_errors} errors</dd><dt>Cache</dt><dd>{health.cache_stats.size} / {health.cache_stats.max_entries} entries; {health.cache_stats.evictions} evictions</dd><dt>Recent failures</dt><dd>{health.issues.length ? health.issues.map((issue) => issue.message ?? issue.code ?? 'Unknown issue').join('; ') : 'None reported'}</dd><dt>Backup status</dt><dd>{backups[0] ? `${backups[0].status} · ${backups[0].timestamp || backups[0].name}` : 'No backup available'}</dd></dl>
      {health.gpu_metrics.length ? <p className="muted">GPU: {health.gpu_metrics.map((gpu) => `${gpu.name || `device ${gpu.device_id}`} ${gpu.vram_used_mb.toFixed(0)}/${gpu.vram_total_mb.toFixed(0)} MB`).join(' · ')}</p> : null}
    </> : <LoadingBlock label="Loading operations status…" />}
  </section>
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="stat"><div className="value">{value}</div><div className="label">{label}</div></div>
}
