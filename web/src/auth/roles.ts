export type ProjectRole = 'admin' | 'pm' | 'member' | 'guest'

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  admin: '项目管理员',
  pm: '项目经理',
  member: '项目成员',
  guest: '只读访客',
}

export function canWriteProject(role: ProjectRole | null): boolean {
  return role === 'admin' || role === 'pm' || role === 'member'
}
