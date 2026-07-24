import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { ProjectFileEntry } from '../api/dto'
import { EmptyState, ErrorBanner, LoadingBlock } from './feedback'

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function MaterialLibrary({ projectId }: { projectId: string }) {
  const { client } = useAuth()
  const [files, setFiles] = useState<ProjectFileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setFiles(await client.listProjectFiles(projectId))
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setLoading(false)
    }
  }, [client, projectId])

  useEffect(() => { void load() }, [load])

  const upload = async (event: ChangeEvent<HTMLInputElement>, taskFile: boolean) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading) return
    setUploading(true)
    setError(null)
    try {
      await client.uploadProjectFile(projectId, file, taskFile)
      await load()
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setUploading(false)
    }
  }

  const download = async (entry: ProjectFileEntry) => {
    setUploading(true)
    setError(null)
    try {
      const { blob, filename } = await client.downloadProjectFile(projectId, entry.relative_path)
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      link.click()
      URL.revokeObjectURL(href)
    } catch (cause) {
      setError(cause as Error)
    } finally {
      setUploading(false)
    }
  }

  return <section className="card material-library" aria-label="Material library">
    <div className="card-title"><div><h2>Materials</h2><p>Files stay within this project. Uploaded files are indexed by a controlled run.</p></div><div className="upload-actions">
      <label className="file-button">Upload reference<input type="file" disabled={uploading} accept=".md,.txt,.pdf,.docx,.xlsx" onChange={(event) => void upload(event, false)} /></label>
      <label className="file-button">Upload task list<input type="file" disabled={uploading} accept=".csv,.xlsx" onChange={(event) => void upload(event, true)} /></label>
    </div></div>
    {error ? <ErrorBanner error={error} onRetry={() => void load()} /> : null}
    {loading ? <LoadingBlock label="Loading project materials…" /> : files.length === 0 ? <EmptyState title="No materials yet" hint="Upload reference material and one task CSV/XLSX before generating a report." /> : <table><thead><tr><th>File</th><th>Kind</th><th>State</th><th>Size</th><th>Updated</th><th /></tr></thead><tbody>{files.map((file) => <tr key={file.relative_path}><td>{file.filename}</td><td>{file.is_task_file ? 'Task list' : 'Reference'}</td><td><span className={`state state-${file.processing_status}`}>{file.processing_status === 'indexed' ? `Indexed (v${file.index_version})` : 'Uploaded — indexed by next run'}</span></td><td>{formatBytes(file.size_bytes)}</td><td>{formatDate(file.updated_at)}</td><td><button type="button" className="text-button" disabled={uploading} onClick={() => void download(file)}>Download</button></td></tr>)}</tbody></table>}
  </section>
}
