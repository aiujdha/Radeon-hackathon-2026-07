import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  ErrorBanner,
  LoadingBlock,
  EmptyState,
  PageHeader,
} from '../components/feedback'
import type { Project, ProjectOverview } from '../api/dto'

export function DashboardPage() {
  const { client } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overview, setOverview] = useState<ProjectOverview | null>(null)
  const [projectsError, setProjectsError] = useState<Error | null>(null)
  const [overviewError, setOverviewError] = useState<Error | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingOverview, setLoadingOverview] = useState(false)

  useEffect(() => {
    let active = true
    setLoadingProjects(true)
    client
      .listProjects()
      .then((list) => {
        if (!active) return
        setProjects(list)
        setSelectedId((prev) => prev ?? list[0]?.project_id ?? null)
      })
      .catch((err) => active && setProjectsError(err as Error))
      .finally(() => active && setLoadingProjects(false))
    return () => {
      active = false
    }
  }, [client])

  useEffect(() => {
    if (!selectedId) {
      setOverview(null)
      return
    }
    let active = true
    setLoadingOverview(true)
    setOverviewError(null)
    client
      .getOverview(selectedId)
      .then((o) => active && setOverview(o))
      .catch((err) => active && setOverviewError(err as Error))
      .finally(() => active && setLoadingOverview(false))
    return () => {
      active = false
    }
  }, [client, selectedId])

  return (
    <div>
      <PageHeader title="Project Dashboard">
        <select
          className="project-select"
          aria-label="Select project"
          value={selectedId ?? ''}
          disabled={loadingProjects || projects.length === 0}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.project_id} value={p.project_id}>
              {p.name}
            </option>
          ))}
        </select>
      </PageHeader>

      {loadingProjects ? (
        <LoadingBlock label="Loading projects…" />
      ) : projectsError ? (
        <ErrorBanner error={projectsError} />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          hint="Create a project from the backend to get started."
        />
      ) : null}

      {!loadingProjects && !projectsError && projects.length > 0 ? (
        <section>
          {loadingOverview ? (
            <LoadingBlock label="Loading overview…" />
          ) : overviewError ? (
            <ErrorBanner
              error={overviewError}
              onRetry={() => setSelectedId((id) => id)} // re-trigger effect
            />
          ) : overview ? (
            <OverviewView overview={overview} />
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="stat">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}

function OverviewView({ overview }: { overview: ProjectOverview }) {
  return (
    <div>
      <div className="grid">
        <Stat value={overview.task_stats.total} label="Tasks (total)" />
        <Stat value={overview.task_stats.in_progress} label="Tasks (in progress)" />
        <Stat value={overview.task_stats.done} label="Tasks (done)" />
        <Stat value={overview.risk_stats.open} label="Risks (open)" />
        <Stat value={overview.pending_confirmations} label="Pending confirmations" />
      </div>

      <div className="card">
        <h2>Recent runs</h2>
        {overview.recent_runs.length === 0 ? (
          <EmptyState title="No runs yet" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {overview.recent_runs.map((r) => (
                <tr key={r.run_id}>
                  <td>{r.run_id}</td>
                  <td>{r.status}</td>
                  <td>{r.started_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Recent document changes</h2>
        {overview.recent_doc_changes.length === 0 ? (
          <EmptyState title="No recent changes" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Change</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {overview.recent_doc_changes.map((d) => (
                <tr key={d.doc_id}>
                  <td>{d.doc_name}</td>
                  <td>{d.change_type}</td>
                  <td>{d.changed_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
