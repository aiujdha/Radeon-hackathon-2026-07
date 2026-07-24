import { API_PATHS } from './paths'
import { ApiError, mapError, NETWORK_ERROR_STATUS } from './errors'
import type {
  LoginRequest,
  TokenResponse,
  UserProfile,
  Project,
  ProjectOverview,
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

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
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
}
