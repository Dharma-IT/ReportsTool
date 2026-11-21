export type BiginTransaction = { id: string; paidDate: string; owner: string; amount: number; contact: string; email: string; phone: string; pipeline: string; dealName: string; stage: string; firstName?: string; lastName?: string; paymentNotes?: string }
export function getBiginTransactions(query: URLSearchParams, env?: Record<string, string | undefined>): Promise<{rows: BiginTransaction[]; more: boolean}>
export function validateTransactionQuery(query: URLSearchParams): {from: string; to: string; pipeline: string; page: number}

export type BiginItem = {id: string; dealId: string; paidDate: string; name: string; unitPrice: number | null; quantity: number | null; discount: number | null; installmentFee: number | null; itemAmount: number | null; amount: number | null; dealName: string; owner: string; firstName: string; lastName: string; source: string}
export function getBiginItems(query: URLSearchParams, env?: Record<string, string | undefined>): Promise<{items: BiginItem[]; missingProducts: number}>
