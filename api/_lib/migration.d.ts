export type MigrationContact = { name: string; phone: string; email: string }
export function getMigrationPage(token: string, after?: string): Promise<{ contacts: MigrationContact[]; noName: number; noPhone: number; scanned: number; after: string | null }>
