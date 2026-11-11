export type DealMetadata = { pipelines: { id: string; label: string; stages: { id: string; label: string }[] }[]; options: Record<string, Record<string, string>>; owners: Record<string, string> }
export function getMigrationDealMetadata(token: string): Promise<DealMetadata>
export function getMigrationDealPage(token: string, pipeline: string, after?: string): Promise<{ rows: string[][]; scanned: number; missingPhone: number; missingName: number; recoveredPhone: number; withPaidDate: number; missingPaidDate: number; after: string | null }>
