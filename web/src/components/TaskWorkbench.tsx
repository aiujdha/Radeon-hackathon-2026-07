import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock } from './feedback'
import {
  TASK_ALLOWED_TRANSITIONS,
  type ConfirmationRecord,
  type OperationAuditRecord,
  type PhaseFTaskStatus,
  type TaskChangeRecord,
  type TaskImportDiff,
  type TaskImportResult,
  type TaskRecord,
} from '../api/dto'

const STATUS_LABELS: Record<PhaseFTaskStatus, string> = {
  pending_confirmation: 'Pending confirmation',
  not_started: 'Not started',
  in_progress: 'In progress',
  mostly_completed: 'Mostly completed',
  completed: 'Completed',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
}

const STATUS_FILTER_OPTIONS: PhaseFTaskStatus[] = [
  'pending_confirmation', 'not_started', 'in_progress', 'mostly_completed',
  'completed', 'delayed', 'cancelled',
]

type TabId = 'tasks' | 'queue' | 'import' | 'audit'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status as PhaseFTaskStatus] ?? status
}

/** Allowed targets come from the mirrored state machine; the SERVER remains
 * the single authority and rejects anything else (TASK_INVALID_TRANSITION). */
function allowedTargets(status: string): PhaseFTaskStatus[] {
  return TASK_ALLOWED_TRANSITIONS[status as PhaseFTaskStatus] ?? []
}

export function TaskWorkbench({ projectId }: { projectId: string }) {
  const { client, user } = useAuth()
  const [tab, setTab] = useState<TabId>('tasks')
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [queue, setQueue] = useState<ConfirmationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextTasks, nextQueue] = await Promise.all([
        client.listTasks(projectId, statusFilter || undefined),
        client.listConfirmationQueue(projectId, 'pending'),
      ])
      setTasks(nextTasks)
      setQueue(nextQueue)
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setLoading(false)
    }
  }, [client, projectId, statusFilter])

  useEffect(() => { void load() }, [load])

  return (
    <section className="card task-workbench" aria-label="Task workbench">
      <div className="card-title">
        <div>
          <h2>Task workbench</h2>
          <p>Confirm extracted tasks, import task lists and drive status changes with an audit trail.</p>
        </div>
      </div>
      <div className="tab-bar" role="tablist" aria-label="Task workbench sections">
        <button type="button" role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'tab selected' : 'tab'} onClick={() => setTab('tasks')}>Tasks ({tasks.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'queue'} className={tab === 'queue' ? 'tab selected' : 'tab'} onClick={() => setTab('queue')}>Confirmation queue ({queue.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'import'} className={tab === 'import' ? 'tab selected' : 'tab'} onClick={() => setTab('import')}>Import CSV/XLSX</button>
        <button type="button" role="tab" aria-selected={tab === 'audit'} className={tab === 'audit' ? 'tab selected' : 'tab'} onClick={() => setTab('audit')}>Audit log</button>
      </div>
      {error ? <ErrorBanner error={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingBlock label="Loading task workbench…" /> : null}
      {!loading && tab === 'tasks' ? (
        <TaskListPanel projectId={projectId} tasks={tasks} statusFilter={statusFilter}
          onStatusFilter={setStatusFilter} operator={user?.username ?? ''} onChanged={load} />
      ) : null}
      {!loading && tab === 'queue' ? (
        <ConfirmationQueuePanel projectId={projectId} queue={queue}
          operator={user?.username ?? ''} onChanged={load} />
      ) : null}
      {!loading && tab === 'import' ? (
        <ImportPanel projectId={projectId} operator={user?.username ?? ''} onImported={load} />
      ) : null}
      {!loading && tab === 'audit' ? <AuditPanel projectId={projectId} /> : null}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Tasks: list + client-side filters + detail (history, transitions)
// ---------------------------------------------------------------------------

function TaskListPanel({ projectId, tasks, statusFilter, onStatusFilter, operator, onChanged }: {
  projectId: string; tasks: TaskRecord[]; statusFilter: string
  onStatusFilter: (value: string) => void; operator: string; onChanged: () => Promise<void>
}) {
  const [ownerFilter, setOwnerFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dueBefore, setDueBefore] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const owners = useMemo(
    () => [...new Set(tasks.map((task) => task.owner).filter((o): o is string => Boolean(o)))].sort(),
    [tasks],
  )
  const priorities = useMemo(
    () => [...new Set(tasks.map((task) => task.priority).filter(Boolean))].sort(),
    [tasks],
  )

  // Server filters by status; owner/priority/due-date narrowing is client-side.
  const visible = useMemo(() => tasks.filter((task) => {
    if (ownerFilter && task.owner !== ownerFilter) return false
    if (priorityFilter && task.priority !== priorityFilter) return false
    if (dueBefore && (!task.due_date || task.due_date > dueBefore)) return false
    return true
  }), [tasks, ownerFilter, priorityFilter, dueBefore])

  const selectedTask = visible.find((task) => task.id === selectedTaskId)
    ?? tasks.find((task) => task.id === selectedTaskId)
    ?? null

  return (
    <div>
      <div className="filter-bar" aria-label="Task filters">
        <label>Status
          <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}>
            <option value="">All</option>
            {STATUS_FILTER_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label>Owner
          <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
            <option value="">All</option>
            {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </select>
        </label>
        <label>Priority
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="">All</option>
            {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <label>Due before
          <input type="date" value={dueBefore} onChange={(event) => setDueBefore(event.target.value)} />
        </label>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No tasks match the current filters"
          hint="Import a task list or accept candidates from the confirmation queue." />
      ) : (
        <div className="task-layout">
          <table aria-label="Task list">
            <thead><tr><th>Title</th><th>Status</th><th>Owner</th><th>Priority</th><th>Due</th></tr></thead>
            <tbody>
              {visible.map((task) => (
                <tr key={task.id} className={task.id === selectedTaskId ? 'selected-row' : ''}
                  onClick={() => setSelectedTaskId(task.id)}>
                  <td>{task.title}</td>
                  <td><span className={`state status-${task.status}`}>{statusLabel(task.status)}</span></td>
                  <td>{task.owner ?? '—'}</td>
                  <td>{task.priority || '—'}</td>
                  <td>{task.due_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedTask ? (
            <TaskDetail key={selectedTask.id} projectId={projectId} task={selectedTask}
              operator={operator} onChanged={onChanged} />
          ) : <p className="muted">Select a task to inspect details, history and status transitions.</p>}
        </div>
      )}
    </div>
  )
}

function TaskDetail({ projectId, task, operator, onChanged }: {
  projectId: string; task: TaskRecord; operator: string; onChanged: () => Promise<void>
}) {
  const { client } = useAuth()
  const [history, setHistory] = useState<TaskChangeRecord[]>([])
  const [historyError, setHistoryError] = useState<Error | null>(null)
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [transitionError, setTransitionError] = useState<Error | null>(null)

  const loadHistory = useCallback(async () => {
    setHistoryError(null)
    try {
      setHistory(await client.getTaskHistory(projectId, task.id))
    } catch (cause) {
      setHistoryError(cause as Error)
    }
  }, [client, projectId, task.id])

  useEffect(() => { void loadHistory() }, [loadHistory])

  const targets = allowedTargets(task.status)

  const submitTransition = async () => {
    if (!target || !reason.trim() || pending) return
    setPending(true)
    setTransitionError(null)
    try {
      await client.transitionTask(projectId, task.id, {
        status: target as PhaseFTaskStatus,
        reason: reason.trim(),
        changed_by: operator || null,
      })
      setTarget('')
      setReason('')
      await Promise.all([onChanged(), loadHistory()])
    } catch (cause) {
      // Server-side rejection (e.g. TASK_INVALID_TRANSITION) surfaces here.
      setTransitionError(cause as Error)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="task-detail" aria-label="Task details">
      <h3>{task.title}</h3>
      <dl>
        <dt>Status</dt><dd>{statusLabel(task.status)}</dd>
        <dt>Owner</dt><dd>{task.owner ?? '—'}</dd>
        <dt>Priority</dt><dd>{task.priority || '—'}</dd>
        <dt>Due date</dt><dd>{task.due_date ?? '—'}</dd>
        <dt>Acceptance</dt><dd>{task.acceptance_criteria || '—'}</dd>
        <dt>Dependencies</dt><dd>{task.dependencies.length > 0 ? task.dependencies.join(', ') : '—'}</dd>
        <dt>Source</dt><dd>{task.source_ref ?? '—'}</dd>
        {task.confirmed_by ? (
          <>
            <dt>Confirmed by</dt><dd>{task.confirmed_by} ({formatDate(task.confirmed_at)})</dd>
            <dt>Basis</dt><dd>{task.confirmation_basis ?? '—'}</dd>
          </>
        ) : null}
        <dt>Updated</dt><dd>{formatDate(task.updated_at)}</dd>
      </dl>

      <h4>Change status</h4>
      {targets.length === 0 ? (
        <p className="muted">This task is in a final state — no transitions are allowed.</p>
      ) : (
        <div className="transition-form">
          <select aria-label="Target status" value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Select target status…</option>
            {targets.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
          <textarea aria-label="Transition reason" placeholder="Reason (required, recorded in history)"
            value={reason} rows={2} maxLength={2000}
            onChange={(event) => setReason(event.target.value)} />
          <button type="button" className="primary" disabled={pending || !target || !reason.trim()}
            onClick={() => void submitTransition()}>Apply transition</button>
        </div>
      )}
      {transitionError ? <ErrorBanner error={transitionError} /> : null}

      <h4>History</h4>
      {historyError ? <ErrorBanner error={historyError} onRetry={() => void loadHistory()} /> : null}
      {history.length === 0 ? <p className="muted">No status changes recorded yet.</p> : (
        <ul className="history-list">
          {history.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.from_status ? `${statusLabel(entry.from_status)} → ` : ''}{statusLabel(entry.to_status)}</strong>
              <span>{formatDate(entry.changed_at)}{entry.changed_by ? ` · ${entry.changed_by}` : ''}</span>
              {entry.change_reason ? <small>{entry.change_reason}</small> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmation queue: accept / modify / ignore with reason + evidence
// ---------------------------------------------------------------------------

function ConfirmationQueuePanel({ projectId, queue, operator, onChanged }: {
  projectId: string; queue: ConfirmationRecord[]; operator: string; onChanged: () => Promise<void>
}) {
  const { client } = useAuth()
  const [openId, setOpenId] = useState<number | null>(null)
  const [action, setAction] = useState<'accept' | 'modify' | 'ignore'>('accept')
  const [basis, setBasis] = useState('')
  const [notes, setNotes] = useState('')
  const [modTitle, setModTitle] = useState('')
  const [modOwner, setModOwner] = useState('')
  const [modDue, setModDue] = useState('')
  const [modPriority, setModPriority] = useState('')
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState<Error | null>(null)

  const openItem = (item: ConfirmationRecord) => {
    setOpenId(item.id)
    setAction('accept')
    setBasis('')
    setNotes('')
    setModTitle(item.candidate_title)
    setModOwner(item.candidate_owner ?? '')
    setModDue(item.candidate_due_date ?? '')
    setModPriority(item.candidate_priority ?? '')
    setActionError(null)
  }

  const submit = async (item: ConfirmationRecord) => {
    if (pending || !operator) return
    setPending(true)
    setActionError(null)
    try {
      await client.processConfirmation(projectId, item.task_id, {
        action,
        confirmed_by: operator,
        confirmation_basis: basis.trim() || null,
        confirmation_notes: notes.trim() || null,
        ...(action === 'modify'
          ? {
              modified_title: modTitle.trim() || null,
              modified_owner: modOwner.trim() || null,
              modified_due_date: modDue || null,
              modified_priority: modPriority.trim() || null,
            }
          : {}),
      })
      setOpenId(null)
      await onChanged()
    } catch (cause) {
      setActionError(cause as Error)
    } finally {
      setPending(false)
    }
  }

  if (queue.length === 0) {
    return <EmptyState title="Confirmation queue is empty"
      hint="Candidates extracted from meeting minutes will wait here for a human decision." />
  }

  return (
    <div aria-label="Confirmation queue">
      {queue.map((item) => (
        <div key={item.id} className="queue-item">
          <div className="queue-summary">
            <div>
              <strong>{item.candidate_title}</strong>
              <p className="muted">
                {item.candidate_owner ? `Owner: ${item.candidate_owner} · ` : ''}
                {item.candidate_due_date ? `Due: ${item.candidate_due_date} · ` : ''}
                Source: {item.source_kind}{item.source_ref ? ` (${item.source_ref})` : ''} ·
                Confidence: {(item.confidence * 100).toFixed(0)}%
              </p>
              {item.candidate_acceptance ? <p className="muted">Acceptance: {item.candidate_acceptance}</p> : null}
            </div>
            <button type="button" className="text-button" onClick={() => openId === item.id ? setOpenId(null) : openItem(item)}>
              {openId === item.id ? 'Close' : 'Review'}
            </button>
          </div>
          {openId === item.id ? (
            <div className="queue-form">
              <div className="filter-bar">
                <label>Decision
                  <select aria-label="Decision" value={action} onChange={(event) => setAction(event.target.value as typeof action)}>
                    <option value="accept">Accept as-is</option>
                    <option value="modify">Accept with changes</option>
                    <option value="ignore">Ignore</option>
                  </select>
                </label>
              </div>
              {action === 'modify' ? (
                <div className="filter-bar">
                  <label>Title<input value={modTitle} onChange={(event) => setModTitle(event.target.value)} /></label>
                  <label>Owner<input value={modOwner} onChange={(event) => setModOwner(event.target.value)} /></label>
                  <label>Due date<input type="date" value={modDue} onChange={(event) => setModDue(event.target.value)} /></label>
                  <label>Priority<input value={modPriority} onChange={(event) => setModPriority(event.target.value)} /></label>
                </div>
              ) : null}
              <textarea aria-label="Confirmation basis" placeholder="Basis / evidence for this decision"
                rows={2} value={basis} onChange={(event) => setBasis(event.target.value)} />
              <textarea aria-label="Confirmation notes" placeholder="Notes (optional)"
                rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
              {!operator ? <p className="muted">Sign-in identity is required to record the decision.</p> : null}
              <button type="button" className="primary" disabled={pending || !operator}
                onClick={() => void submit(item)}>Record decision</button>
              {actionError ? <ErrorBanner error={actionError} /> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV / XLSX import: preview first (dry-run), then explicit confirm
// ---------------------------------------------------------------------------

function ImportPanel({ projectId, operator, onImported }: {
  projectId: string; operator: string; onImported: () => Promise<void>
}) {
  const { client } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [diff, setDiff] = useState<TaskImportDiff | null>(null)
  const [result, setResult] = useState<TaskImportResult | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [overwriteConflicts, setOverwriteConflicts] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!next || pending) return
    setFile(next)
    setDiff(null)
    setResult(null)
    setError(null)
    setPending(true)
    try {
      setDiff(await client.previewTaskImport(projectId, next))
    } catch (cause) {
      setError(cause as Error)
      setFile(null)
    } finally {
      setPending(false)
    }
  }

  const confirm = async () => {
    if (!file || pending || !operator) return
    setPending(true)
    setError(null)
    try {
      setResult(await client.confirmTaskImport(projectId, file, operator, skipDuplicates, overwriteConflicts))
      setDiff(null)
      setFile(null)
      await onImported()
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setPending(false)
    }
  }

  const previewColumns = diff && diff.preview.length > 0 ? Object.keys(diff.preview[0]) : []

  return (
    <div aria-label="Task import">
      <p className="muted">Step 1: choose a CSV/XLSX file to preview the diff. Step 2: confirm to persist. Nothing is written before you confirm.</p>
      <div className="actions">
        <label className="file-button">Choose task file
          <input type="file" accept=".csv,.xlsx,.xls" disabled={pending} onChange={(event) => void pick(event)} />
        </label>
        {file ? <span className="muted">Selected: {file.name}</span> : null}
      </div>
      {pending ? <LoadingBlock label="Talking to the server…" /> : null}
      {error ? <ErrorBanner error={error} /> : null}
      {diff ? (
        <div className="import-preview">
          <div className="grid">
            <div className="stat"><div className="value">{diff.new_rows}</div><div className="label">New rows</div></div>
            <div className="stat"><div className="value">{diff.duplicate_rows}</div><div className="label">Duplicates</div></div>
            <div className="stat"><div className="value">{diff.conflict_rows}</div><div className="label">Conflicts</div></div>
          </div>
          {diff.preview.length > 0 ? (
            <table aria-label="Import preview rows">
              <thead><tr>{previewColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
              <tbody>
                {diff.preview.map((row, index) => (
                  <tr key={index}>{previewColumns.map((column) => <td key={column}>{row[column] ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          ) : <p className="muted">The file contains no data rows.</p>}
          <div className="actions import-options">
            <label><input type="checkbox" checked={skipDuplicates}
              onChange={(event) => setSkipDuplicates(event.target.checked)} /> Skip duplicates</label>
            <label><input type="checkbox" checked={overwriteConflicts}
              onChange={(event) => setOverwriteConflicts(event.target.checked)} /> Overwrite conflicts</label>
            <button type="button" className="primary" disabled={pending || !operator} onClick={() => void confirm()}>
              Confirm import
            </button>
          </div>
          {!operator ? <p className="muted">Sign-in identity is required to confirm an import.</p> : null}
        </div>
      ) : null}
      {result ? (
        <div className="grid" aria-label="Import result">
          <div className="stat"><div className="value">{result.imported}</div><div className="label">Imported</div></div>
          <div className="stat"><div className="value">{result.skipped}</div><div className="label">Skipped</div></div>
          <div className="stat"><div className="value">{result.errors}</div><div className="label">Errors</div></div>
        </div>
      ) : null}
      {result && result.details.length > 0 ? (
        <ul className="history-list">{result.details.map((detail, index) => <li key={index}><small>{detail}</small></li>)}</ul>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function AuditPanel({ projectId }: { projectId: string }) {
  const { client } = useAuth()
  const [records, setRecords] = useState<OperationAuditRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRecords(await client.getTaskAuditLog(projectId, 100))
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setLoading(false)
    }
  }, [client, projectId])

  useEffect(() => { void load() }, [load])

  return (
    <div aria-label="Audit log">
      {error ? <ErrorBanner error={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingBlock label="Loading audit log…" /> : records.length === 0 ? (
        <EmptyState title="No audit entries yet"
          hint="Task confirmations, imports and status changes are recorded here." />
      ) : (
        <table aria-label="Audit entries">
          <thead><tr><th>When</th><th>Operation</th><th>Entity</th><th>Operator</th><th>Details</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.created_at)}</td>
                <td>{record.operation}</td>
                <td>{record.entity_type} · {record.entity_id}</td>
                <td>{record.operator ?? '—'}</td>
                <td className="audit-details">{record.details ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
