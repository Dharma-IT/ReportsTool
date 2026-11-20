export type TodoItem = { id: string; title: string; completed: boolean; parent_id: string | null; created_at: string; updated_at: string }
export function todoRequest(method: string, body?: unknown, env?: Record<string, string | undefined>): Promise<{ items?: TodoItem[]; item?: TodoItem | null }>
