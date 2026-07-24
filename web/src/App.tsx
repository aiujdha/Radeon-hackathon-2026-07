import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiClient, errorMessage } from "./api";
import { useAuth } from "./auth";
import type { Project } from "./types";

type Route = "projects" | "settings";

function currentRoute(): Route {
  return window.location.hash === "#/settings" ? "settings" : "projects";
}

function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await login(username, password);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-layout">
    <form className="login-card" onSubmit={submit}>
      <p className="eyebrow">ProjectPack Office Agent</p>
      <h1>统一工作台</h1>
      <p>使用你的项目账号登录。账号或访问令牌不会写入页面日志。</p>
      <label>用户名<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
      <label>密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      {message && <p className="error" role="alert">{message}</p>}
      <button disabled={busy} type="submit">{busy ? "正在登录…" : "登录"}</button>
    </form>
  </main>;
}

function ProjectLanding() {
  const { user } = useAuth();
  const client = useMemo(() => new ApiClient({ getToken: () => sessionStorage.getItem("projectpack.workbench.session.v1") ? JSON.parse(sessionStorage.getItem("projectpack.workbench.session.v1")!).access_token as string : null }), []);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    client.listProjects().then(setProjects).catch((error) => setMessage(errorMessage(error)));
  }, [client]);

  return <section className="page">
    <p className="eyebrow">项目</p>
    <h1>欢迎，{user?.display_name}</h1>
    <p>UI-0 已建立安全的工作台骨架。项目运行、资料库、任务看板与审批页面将在后续阶段接入。</p>
    {message && <p className="error" role="alert">{message}</p>}
    {projects === null && !message && <p>正在读取项目列表…</p>}
    {projects?.length === 0 && <p className="empty">暂无项目。请先在现有 MVP 工作台创建项目。</p>}
    {projects && projects.length > 0 && <ul className="project-list">{projects.map((project) => <li key={project.project_id}><strong>{project.name}</strong><span>{project.project_id}</span></li>)}</ul>}
  </section>;
}

function Shell() {
  const { logout, user } = useAuth();
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return <div className="shell">
    <header><a href="#/projects" className="brand">ProjectPack Office Agent</a><div><span>{user?.display_name}</span><button className="text-button" onClick={logout}>退出登录</button></div></header>
    <nav aria-label="主导航"><a className={route === "projects" ? "active" : ""} href="#/projects">项目</a><a className={route === "settings" ? "active" : ""} href="#/settings">设置</a></nav>
    {route === "projects" ? <ProjectLanding /> : <section className="page"><h1>设置</h1><p>当前版本只提供登录态与 API 基础配置。项目级成员和权限设置将在 UI-4 接入。</p></section>}
  </div>;
}

export default function App() {
  const { user, isRestoring } = useAuth();
  if (isRestoring) return <main className="loading">正在恢复登录状态…</main>;
  return user ? <Shell /> : <LoginPage />;
}
