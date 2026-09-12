export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

export function teamRoom(sessionId: string, teamId: string): string {
  return `session:${sessionId}:team:${teamId}`;
}

export function userRoom(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}`;
}
