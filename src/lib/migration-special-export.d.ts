export type SpecialContact = { name: string; phone: string; email: string }
export type SpecialExport = { contacts: SpecialContact[]; matched: number; duplicates: number; excluded: number; pipelineRows?: string[][]; sourceName?: string }
export function specialExportContacts(text: string): SpecialExport
export function specialExportCsv(contacts: SpecialContact[]): string
export function skippedPipelineRows(text: string): string[][]
