import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock } from './feedback'
import type { NotificationEntry, ProjectMemberEntry } from '../api/dto'

const ROLES = ['admin', 'pm', 'member', 'guest'] as const

function projectFromLink(link: string | null): string | null {
  const match = /^\/projects\/([^/]+)\//.exec(link ?? '')
  return match?.[1] ?? null
}

function date(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function CollaborationCenter({ projectId }: { projectId: string }) {
  const { client, user } = useAuth()
  const [tab, setTab] = useState<'members' | 'notifications'>('members')
  const [members, setMembers] = useState<ProjectMemberEntry[]>([])
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [nextMembers, nextNotifications] = await Promise.all([
        client.listMembers(projectId), client.listNotifications(unreadOnly),
      ])
      setMembers(nextMembers); setNotifications(nextNotifications)
    } catch (cause) { setError(cause as Error) } finally { setLoading(false) }
  }, [client, projectId, unreadOnly])
  useEffect(() => { void load() }, [load])

  const ownRole = members.find((member) => member.user_id === user?.user_id)?.role
  const canAdminister = ownRole === 'admin'
  const projectNotifications = useMemo(
    () => notifications.filter((item) => projectFromLink(item.link) === projectId),
    [notifications, projectId],
  )

  const markAllRead = async () => {
    setPending(true); setError(null)
    try { await client.markAllNotificationsRead(); await load() } catch (cause) { setError(cause as Error) } finally { setPending(false) }
  }
  const markRead = async (item: NotificationEntry) => {
    if (item.is_read) return
    setPending(true); setError(null)
    try { await client.markNotificationRead(item.id); await load() } catch (cause) { setError(cause as Error) } finally { setPending(false) }
  }

  return <section className="card collaboration-center" aria-label="Collaboration and notifications">
    <div className="card-title"><div><h2>Collaboration</h2><p>Project roles, mentions, and project-scoped notifications.</p></div><button type="button" disabled={loading} onClick={() => void load()}>Refresh</button></div>
    <div className="tab-bar"><button type="button" className={`tab ${tab === 'members' ? 'selected' : ''}`} onClick={() => setTab('members')}>Members</button><button type="button" className={`tab ${tab === 'notifications' ? 'selected' : ''}`} onClick={() => setTab('notifications')}>Inbox ({projectNotifications.filter((item) => !item.is_read).length})</button></div>
    {error ? <ErrorBanner error={error} onRetry={() => void load()} /> : null}
    {loading ? <LoadingBlock label="Loading collaboration data…" /> : null}
    {!loading && tab === 'members' ? <MemberPanel projectId={projectId} members={members} canAdminister={canAdminister} pending={pending} setPending={setPending} setError={setError} reload={load} /> : null}
    {!loading && tab === 'notifications' ? <Inbox notifications={projectNotifications} unreadOnly={unreadOnly} setUnreadOnly={setUnreadOnly} pending={pending} onRead={markRead} onReadAll={markAllRead} /> : null}
  </section>
}

function MemberPanel({ projectId, members, canAdminister, pending, setPending, setError, reload }: { projectId: string; members: ProjectMemberEntry[]; canAdminister: boolean; pending: boolean; setPending: (value: boolean) => void; setError: (error: Error | null) => void; reload: () => Promise<void> }) {
  const { client, user } = useAuth()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<typeof ROLES[number]>('member')
  const add = async () => { if (!userId.trim()) return; setPending(true); setError(null); try { await client.addMember(projectId, { user_id: userId.trim(), role }); setUserId(''); await reload() } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  const changeRole = async (member: ProjectMemberEntry, nextRole: typeof ROLES[number]) => { setPending(true); setError(null); try { await client.updateMemberRole(projectId, member.user_id, { user_id: member.user_id, role: nextRole }); await reload() } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  const remove = async (member: ProjectMemberEntry) => { if (!window.confirm(`Remove ${member.display_name} from this project?`)) return; setPending(true); setError(null); try { await client.removeMember(projectId, member.user_id); await reload() } catch (cause) { setError(cause as Error) } finally { setPending(false) } }
  return <div>{canAdminister ? <div className="member-add"><input aria-label="User ID" value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Existing user ID" /><select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>{ROLES.map((item) => <option key={item}>{item}</option>)}</select><button type="button" className="primary" disabled={pending || !userId.trim()} onClick={() => void add()}>Add member</button></div> : <p className="muted">Only project administrators can add, change, or remove members. Your role is enforced by the API.</p>}<table><thead><tr><th>Member</th><th>Role</th><th>Joined</th>{canAdminister ? <th>Actions</th> : null}</tr></thead><tbody>{members.map((member) => <tr key={member.user_id}><td>{member.display_name} <small className="muted">@{member.username}</small>{member.user_id === user?.user_id ? ' (you)' : ''}</td><td>{canAdminister && member.user_id !== user?.user_id ? <select value={member.role} disabled={pending} onChange={(event) => void changeRole(member, event.target.value as typeof role)}>{ROLES.map((item) => <option key={item}>{item}</option>)}</select> : member.role}</td><td>{date(member.joined_at)}</td>{canAdminister ? <td>{member.user_id !== user?.user_id ? <button type="button" disabled={pending} onClick={() => void remove(member)}>Remove</button> : '—'}</td> : null}</tr>)}</tbody></table></div>
}

function Inbox({ notifications, unreadOnly, setUnreadOnly, pending, onRead, onReadAll }: { notifications: NotificationEntry[]; unreadOnly: boolean; setUnreadOnly: (value: boolean) => void; pending: boolean; onRead: (item: NotificationEntry) => Promise<void>; onReadAll: () => Promise<void> }) {
  const open = async (item: NotificationEntry) => {
    await onRead(item)
    // Links originate on the server. Only internal project routes are opened.
    if (item.link?.startsWith('/projects/')) window.location.hash = item.link
  }
  return <div><div className="filter-bar"><label><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Unread only</label><button type="button" disabled={pending || !notifications.some((item) => !item.is_read)} onClick={() => void onReadAll()}>Mark all read</button></div>{notifications.length === 0 ? <EmptyState title="No notifications for this project" hint="Assignments, approvals, replies, and @mentions will appear here." /> : <ul className="notification-list">{notifications.map((item) => <li key={item.id} className={item.is_read ? 'read' : 'unread'}><button type="button" disabled={pending} onClick={() => void open(item)}><strong>{item.title}</strong><span>{item.body || 'No additional details'}</span><small>{date(item.created_at)} · {item.kind}</small></button></li>)}</ul>}</div>
}
