import { API_PATHS } from './paths'
import { ApiError, mapError, NETWORK_ERROR_STATUS } from './errors'
import type {
  LoginRequest,
  TokenResponse,
  UserProfile,
  Project,
  ProjectOverview,
  RunProgress,
  RunState,
  ProjectFileEntry,
  UploadResult,
} from './dto'

export interface ApiClientOptions {
  /** Base URL prepended to every request path. Empty string = same-origin. */
  baseUrl?: string
  /** Request timeout in milliseconds. */
  timeoutMs?: number
  /** Returns the current Bearer token, or null when unauthenticated. */
  getToken?: () => string | null
  /** Injectable fetch (mainly for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Unified API client for the workbench.
 *
 * Responsibilities (UI-0 acceptance):
 *  - Prefix every request with `baseUrl`.
 *  - Attach `Authorization: Bearer <token>` when a token is available.
 *  - Enforce a request timeout (AbortController) and translate aborts into a
 *    network `ApiError`.
 *  - Map HTTP status (401/403/404/409/422/5xx) and network failures into a
 *    single `ApiError` with a user-readable message.
 */
export class ApiClient {
  readonly baseUrl: string
  readonly timeoutMs: number
  private readonly getToken: () => string | null
  private readonly fetchImpl: typeof fetch

  constructor(opts: ApiClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? '').replace(/\/+$/, '')
    this.timeoutMs = opts.timeoutMs ?? 15000
    this.getToken = opts.getToken ?? (() => null)
    this.fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  }

  private buildHeaders(json = true): Record<string, string> {
    const headers: Record<string, string> = {}
    if (json) headers['Content-Type'] = 'application/json'
    const token = this.getToken()
    // SECURITY: the token is read from storage and sent over the wire only.
    // It is never written to console, logs, or anywhere else.
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: this.buildHeaders(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      clearTimeout(timer)
      throw new ApiError(NETWORK_ERROR_STATUS, {
        message: 'Network request failed. Please check your connection.',
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      let parsed: unknown = null
      try {
        parsed = await response.json()
      } catch {
        // body may be empty or non-JSON; fall back to status-only mapping
      }
      throw mapError(response.status, parsed)
    }

    if (response.status === 204) {
      return undefined as T
    }
    try {
      return (await response.json()) as T
    } catch {
      return undefined as T
    }
  }

  private async requestBlob(path: string): Promise<{ blob: Blob; filename: string }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: this.buildHeaders(false),
        signal: controller.signal,
      })
    } catch {
      throw new ApiError(NETWORK_ERROR_STATUS, {
        message: 'Network request failed. Please check your connection.',
      })
    } finally {
      clearTimeout(timer)
    }
    if (!response.ok) {
      let parsed: unknown = null
      try {
        parsed = await response.json()
      } catch {
        // The error response may be an empty file response.
      }
      throw mapError(response.status, parsed)
    }
    const disposition = response.headers.get('content-disposition') ?? ''
    const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? 'artifact'
    return { blob: await response.blob(), filename }
  }

  private async requestForm<T>(path: string, form: FormData): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST', headers: this.buildHeaders(false), body: form, signal: controller.signal,
      })
    } catch {
      throw new ApiError(NETWORK_ERROR_STATUS, { message: 'Network request failed. Please check your connection.' })
    } finally {
      clearTimeout(timer)
    }
    if (!response.ok) {
      let parsed: unknown = null
      try { parsed = await response.json() } catch { /* status-only fallback */ }
      throw mapError(response.status, parsed)
    }
    return (await response.json()) as T
  }

  // ----- Auth -----

  login(req: LoginRequest): Promise<TokenResponse> {
    return this.request<TokenResponse>('POST', API_PATHS.login, req)
  }

  getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('GET', API_PATHS.me)
  }

  // ----- Projects -----

  listProjects(): Promise<Project[]> {
    return this.request<Project[]>('GET', API_PATHS.projects)
  }

  getProject(projectId: string): Promise<Project> {
    return this.request<Project>('GET', API_PATHS.projectDetail(projectId))
  }

  getOverview(projectId: string): Promise<ProjectOverview> {
    return this.request<ProjectOverview>('GET', API_PATHS.overview(projectId))
  }

  // ----- Project files -----

  listProjectFiles(projectId: string): Promise<ProjectFileEntry[]> {
    return this.request('GET', API_PATHS.files(projectId))
  }

  uploadProjectFile(projectId: string, file: File, taskFile = false): Promise<UploadResult> {
    const form = new FormData()
    form.append('file', file, file.name)
    form.append('task_file', String(taskFile))
    return this.requestForm(API_PATHS.files(projectId), form)
  }

  downloadProjectFile(projectId: string, relativePath: string): Promise<{ blob: Blob; filename: string }> {
    const sourcePrefix = 'source/'
    const filename = relativePath.startsWith(sourcePrefix) ? relativePath.slice(sourcePrefix.length) : relativePath
    return this.requestBlob(API_PATHS.downloadFile(projectId, filename))
  }

  // ----- Runs -----

  listRuns(projectId: string): Promise<RunState[]> {
    return this.request('GET', API_PATHS.runs(projectId))
  }

  getRun(projectId: string, runId: string): Promise<RunState> {
    return this.request('GET', API_PATHS.runDetail(projectId, runId))
  }

  getRunProgress(projectId: string, runId: string): Promise<RunProgress> {
    return this.request('GET', API_PATHS.runProgress(projectId, runId))
  }

  createRun(projectId: string): Promise<RunState> {
    return this.request('POST', API_PATHS.runs(projectId))
  }

  executeRun(projectId: string, runId: string): Promise<RunState> {
    return this.request('POST', API_PATHS.executeRun(projectId, runId))
  }

  cancelRun(projectId: string, runId: string): Promise<RunState> {
    return this.request('DELETE', API_PATHS.runDetail(projectId, runId))
  }

  retryRun(projectId: string, runId: string): Promise<RunState> {
    return this.request('POST', API_PATHS.retryRun(projectId, runId))
  }

  downloadRunArtifact(
    projectId: string,
    runId: string,
    artifactName: string,
  ): Promise<{ blob: Blob; filename: string }> {
    return this.requestBlob(API_PATHS.runArtifact(projectId, runId, artifactName))
  }
}
