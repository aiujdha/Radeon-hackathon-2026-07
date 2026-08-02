import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner, LoadingBlock, EmptyState, PageHeader } from '../components/feedback'
import { MaterialLibrary } from '../components/MaterialLibrary'
import { TaskWorkbench } from '../components/TaskWorkbench'
import { RiskReportCenter } from '../components/RiskReportCenter'
import { CollaborationCenter } from '../components/CollaborationCenter'
import { AdminOperations, IntegrationAdminCenter } from '../components/IntegrationAdminCenter'
import { canWriteProject, PROJECT_ROLE_LABELS, type ProjectRole } from '../auth/roles'
import { getReportReadiness } from '../features/preflight'
import type { Project, ProjectCreate, ProjectOverview, RunProgress, RunState, RunStatus } from '../api/dto'

const ACTIVE_RUN_STATUSES: RunStatus[] = [
  'queued', 'scanning', 'indexing', 'retrieving', 'evaluating', 'drafting', 'waiting_confirmation',
]

const ARTIFACT_LABELS: Record<string, string> = {
  report: '项目报告（Markdown）',
  risk_csv: '风险清单（CSV）',
  next_week_plan: '下周计划',
  result: '运行结果（JSON）',
}

function isActive(status: RunStatus): boolean {
  return ACTIVE_RUN_STATUSES.includes(status)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function DashboardPage() {
  const { client, user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [runs, setRuns] = useState<RunState[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionPending, setActionPending] = useState(false)
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null)

  const selectedRun = useMemo(
    () => runs.find((run) => run.run_id === selectedRunId) ?? null,
    [runs, selectedRunId],
  )

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await client.listProjects()
      setProjects(list)
      setSelectedId((current) => current && list.some((p) => p.project_id === current)
        ? current : list[0]?.project_id ?? null)
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setLoading(false)
    }
  }, [client])

  const loadProjectData = useCallback(async (projectId: string) => {
    setError(null)
    try {
      const [nextOverview, nextRuns, members] = await Promise.all([
        client.getOverview(projectId),
        client.listRuns(projectId),
        client.listMembers(projectId),
      ])
      setOverview(nextOverview)
      setRuns(nextRuns)
      setProjectRole(members.find((member) => member.user_id === user?.user_id)?.role ?? null)
      setSelectedRunId((current) => current && nextRuns.some((run) => run.run_id === current)
        ? current : nextRuns[0]?.run_id ?? null)
    } catch (cause) {
      setError(cause as Error)
    }
  }, [client, user?.user_id])

  useEffect(() => { void loadProjects() }, [loadProjects])
  useEffect(() => {
    setOverview(null)
    setRuns([])
    setSelectedRunId(null)
    setProgress(null)
    setProjectRole(null)
    if (selectedId) void loadProjectData(selectedId)
  }, [loadProjectData, selectedId])

  useEffect(() => {
    if (!selectedId || !selectedRun || !isActive(selectedRun.status)) {
      setProgress(null)
      return
    }
    let alive = true
    const refresh = async () => {
      try {
        const next = await client.getRunProgress(selectedId, selectedRun.run_id)
        if (!alive) return
        setProgress(next)
        if (!isActive(next.status)) await loadProjectData(selectedId)
      } catch (cause) {
        if (alive) setError(cause as Error)
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [client, loadProjectData, selectedId, selectedRun])

  const runAction = async (action: () => Promise<RunState>) => {
    if (!selectedId || actionPending) return
    setActionPending(true)
    setError(null)
    try {
      const updated = await action()
      await loadProjectData(selectedId)
      setSelectedRunId(updated.run_id)
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setActionPending(false)
    }
  }

  const startRun = () => void runAction(async () => {
    const [files, tasks] = await Promise.all([
      client.listProjectFiles(selectedId!),
      client.listTasks(selectedId!),
    ])
    const readiness = getReportReadiness(files, tasks.length)
    if (!readiness.ready) throw new Error(readiness.message ?? '当前项目尚未满足报告生成条件。')
    const run = await client.createRun(selectedId!)
    return client.executeRun(selectedId!, run.run_id)
  })

  const downloadArtifact = async (artifactName: string) => {
    if (!selectedId || !selectedRun) return
    setActionPending(true)
    setError(null)
    try {
      const { blob, filename } = await client.downloadRunArtifact(selectedId, selectedRun.run_id, artifactName)
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      link.click()
      URL.revokeObjectURL(href)
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setActionPending(false)
    }
  }

  return (
    <div>
      <PageHeader title="项目工作台">
        {projects.length > 0 ? <select className="project-select" aria-label="选择项目" value={selectedId ?? ''}
          disabled={loading}
          onChange={(event) => setSelectedId(event.target.value)}>
          {projects.map((project) => <option key={project.project_id} value={project.project_id}>{project.name}</option>)}
        </select> : null}
      </PageHeader>

      {user?.is_system_admin ? <ProjectCreator autoOpen={!loading && projects.length === 0} onCreated={async (project) => {
        await loadProjects()
        setSelectedId(project.project_id)
      }} /> : null}

      {error ? <ErrorBanner error={error} onRetry={() => selectedId ? void loadProjectData(selectedId) : void loadProjects()} /> : null}
      {loading ? <LoadingBlock label="正在加载可访问项目…" /> : null}
      {!loading && projects.length === 0 ? <EmptyState title="还没有可访问的项目" hint="从上方创建你的第一个项目；创建者会自动成为该项目管理员。" /> : null}
      {selectedId && overview ? <OverviewView overview={overview} /> : null}
      {selectedId && projectRole ? <p className={`access-banner ${projectRole === 'guest' ? 'read-only' : ''}`}>
        当前项目角色：{PROJECT_ROLE_LABELS[projectRole]}。
        {projectRole === 'guest' ? ' 只读模式：可查看项目数据和证据，不能上传、导入、修改任务或生成报告。' : ' 你可以在当前项目权限范围内协作。'}
      </p> : null}
      <AdminOperations />
      {selectedId ? <MaterialLibrary projectId={selectedId} canWrite={canWriteProject(projectRole)} /> : null}
      {selectedId ? <TaskWorkbench projectId={selectedId} canWrite={canWriteProject(projectRole)} /> : null}
      {selectedId ? <RiskReportCenter projectId={selectedId} /> : null}
      {selectedId ? <CollaborationCenter projectId={selectedId} /> : null}
      {selectedId && user?.is_system_admin ? <IntegrationAdminCenter projectId={selectedId} /> : null}
      {selectedId ? (
        <RunCenter projectId={selectedId} runs={runs} selectedRun={selectedRun} progress={progress}
          actionPending={actionPending} onStart={startRun} onSelect={setSelectedRunId}
          onCancel={() => selectedRun && void runAction(() => client.cancelRun(selectedId, selectedRun.run_id))}
          onRetry={() => selectedRun && void runAction(() => client.retryRun(selectedId, selectedRun.run_id))}
          onDownload={downloadArtifact} />
      ) : null}
    </div>
  )
}

function ProjectCreator({ autoOpen, onCreated }: { autoOpen: boolean; onCreated: (project: Project) => Promise<void> }) {
  const { client } = useAuth()
  const [open, setOpen] = useState(autoOpen)
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (autoOpen) setOpen(true)
  }, [autoOpen])

  const submit = async () => {
    const body: ProjectCreate = {
      project_id: projectId.trim().toLowerCase(), name: name.trim(), description: description.trim() || null,
    }
    if (!body.project_id || !body.name) return
    setPending(true); setError(null)
    try {
      const project = await client.createProject(body)
      await onCreated(project)
      setProjectId(''); setName(''); setDescription(''); setOpen(false)
    } catch (cause) { setError(cause as Error) } finally { setPending(false) }
  }

  return <section className={`project-creator ${autoOpen ? 'first-project' : ''}`} aria-label="创建项目">
    {!autoOpen ? <button type="button" className="text-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {open ? '收起项目创建' : '创建项目'}
    </button> : null}
    {open ? <div className="project-creator-form">
      <h2>{autoOpen ? '创建第一个项目' : '创建项目'}</h2><p className="muted">创建后你会自动成为项目管理员。项目 ID 只能使用小写字母、数字和连字符。</p>
      {error ? <ErrorBanner error={error} onRetry={() => void submit()} /> : null}
      <label>项目 ID<input aria-label="Project ID" value={projectId} disabled={pending} onChange={(event) => setProjectId(event.target.value)} placeholder="例如 client-a-delivery" /></label>
      <label>项目名称<input aria-label="Project name" value={name} disabled={pending} onChange={(event) => setName(event.target.value)} placeholder="例如 客户 A 交付项目" /></label>
      <label>项目说明 <span className="muted">（可选）</span><textarea aria-label="Project description" value={description} disabled={pending} onChange={(event) => setDescription(event.target.value)} placeholder="简要说明项目目的和范围" /></label>
      <div className="actions"><button type="button" className="primary" disabled={pending || !projectId.trim() || !name.trim()} onClick={() => void submit()}>创建并开始上传资料</button><button type="button" disabled={pending} onClick={() => setOpen(false)}>取消</button></div>
    </div> : null}
  </section>
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return <div className="stat"><div className="value">{value}</div><div className="label">{label}</div></div>
}

function OverviewView({ overview }: { overview: ProjectOverview }) {
  return <section className="grid" aria-label="项目概览">
    <Stat value={overview.task_stats.total ?? 0} label="任务总数" />
    <Stat value={overview.task_stats.in_progress ?? 0} label="进行中" />
    <Stat value={overview.task_stats.completed ?? 0} label="已完成" />
    <Stat value={overview.risk_stats.total_active ?? 0} label="未关闭风险" />
    <Stat value={overview.pending_confirmations} label="待人工确认" />
  </section>
}

function RunCenter({ projectId, runs, selectedRun, progress, actionPending, onStart, onSelect, onCancel, onRetry, onDownload }: {
  projectId: string; runs: RunState[]; selectedRun: RunState | null; progress: RunProgress | null; actionPending: boolean
  onStart: () => void; onSelect: (runId: string) => void; onCancel: () => void; onRetry: () => void; onDownload: (name: string) => void
}) {
  return <section className="card run-center" aria-label="运行中心">
    <div className="card-title"><div><h2>报告运行中心</h2><p>当前项目：{projectId}</p></div><button type="button" className="primary" disabled={actionPending} onClick={onStart}>生成项目报告</button></div>
    {runs.length === 0 ? <EmptyState title="还没有运行记录" hint="上传项目资料和任务后，即可生成第一份项目报告。" /> : (
      <div className="run-layout"><div className="run-list" aria-label="运行历史">
        {runs.map((run) => <button type="button" key={run.run_id} className={`run-row ${run.run_id === selectedRun?.run_id ? 'selected' : ''}`} onClick={() => onSelect(run.run_id)}>
          <strong>{run.status}</strong><span>{formatDate(run.created_at)}</span><small>{run.run_id}</small>
        </button>)}
      </div>
      {selectedRun ? <RunDetail run={selectedRun} progress={progress} pending={actionPending} onCancel={onCancel} onRetry={onRetry} onDownload={onDownload} /> : null}
      </div>
    )}
  </section>
}

function RunDetail({ run, progress, pending, onCancel, onRetry, onDownload }: { run: RunState; progress: RunProgress | null; pending: boolean; onCancel: () => void; onRetry: () => void; onDownload: (name: string) => void }) {
  const live = progress ?? run
  const stepLabel = progress?.current_step_name || `${live.current_step} / ${run.total_steps}`
  return <div className="run-detail"><h3>运行详情</h3><dl><dt>状态</dt><dd>{live.status}</dd><dt>创建时间</dt><dd>{formatDate(run.created_at)}</dd><dt>更新时间</dt><dd>{formatDate(run.updated_at)}</dd><dt>当前步骤</dt><dd>{stepLabel}</dd>{progress ? <><dt>进度</dt><dd>{progress.percentage}%</dd></> : null}{live.current_file ? <><dt>当前文件</dt><dd>{live.current_file}</dd></> : null}</dl>
    {run.error || progress?.error_summary ? <p className="run-error">{progress?.error_summary ?? run.error}</p> : null}
    <div className="actions">{isActive(run.status) ? <button type="button" disabled={pending} onClick={onCancel}>取消运行</button> : null}{['failed', 'cancelled'].includes(run.status) ? <button type="button" disabled={pending} onClick={onRetry}>重新运行</button> : null}</div>
    <h4>运行产物</h4>{Object.keys(run.artifacts).length === 0 ? <p className="muted">运行完成后会在此显示可下载产物。</p> : <div className="actions">{Object.keys(run.artifacts).map((name) => <button type="button" key={name} disabled={pending} onClick={() => onDownload(name)}>{ARTIFACT_LABELS[name] ?? name}</button>)}</div>}
  </div>
}
