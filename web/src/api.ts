import type { ApiErrorBody, Project, TokenResponse, UserProfile } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const fallbackMessages: Record<number, string> = {
  400: "请求无效，请检查填写内容。",
  401: "登录已失效，请重新登录。",
  403: "你没有执行此操作的权限。",
  404: "未找到请求的项目或资源。",
  409: "该操作与当前状态冲突，请刷新后重试。",
  422: "提交的数据格式不正确。",
  429: "请求过于频繁，请稍后再试。",
  500: "服务暂时异常，请稍后再试。",
  502: "后端服务暂时不可用。",
  503: "后端服务暂时不可用。"
};

function parseErrorDetail(value: unknown): { message?: string; code?: string } {
  if (typeof value === "string") return { message: value };
  if (value && typeof value === "object") {
    const detail = value as ApiErrorBody;
    return {
      message: typeof detail.message === "string" ? detail.message : undefined,
      code: typeof detail.error_code === "string" ? detail.error_code : undefined
    };
  }
  return {};
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return "无法连接后端服务，请检查服务是否已启动。";
  return "发生未知错误，请稍后再试。";
}

export type ApiClientOptions = {
  baseUrl?: string;
  getToken?: () => string | null;
  fetchImpl?: typeof fetch;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly getToken: () => string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
    this.getToken = options.getToken ?? (() => null);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const token = this.getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    }

    let body: ApiErrorBody | undefined;
    try {
      body = await response.json() as ApiErrorBody;
    } catch {
      // The API may return an empty or non-JSON proxy error.
    }
    const detail = parseErrorDetail(body?.detail ?? body);
    throw new ApiError(response.status, detail.message ?? fallbackMessages[response.status] ?? "请求失败，请稍后再试。", detail.code ?? body?.error_code);
  }

  login(username: string, password: string): Promise<TokenResponse> {
    return this.request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
  }

  getCurrentUser(): Promise<UserProfile> {
    return this.request<UserProfile>("/auth/me");
  }

  listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/api/projects");
  }
}
