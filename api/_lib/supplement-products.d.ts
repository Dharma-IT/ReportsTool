export type SupplementProduct = { id: string; name: string; match_name: string; unit_cost: number; created_at?: string; updated_at?: string }
export function getSupplementProducts(): Promise<{ products: SupplementProduct[] }>
export function createSupplementProduct(product: Partial<SupplementProduct>): Promise<{ product: SupplementProduct }>
export function updateSupplementProduct(product: Partial<SupplementProduct>): Promise<{ product: SupplementProduct }>
export function deleteSupplementProduct(id: string): Promise<{ product: SupplementProduct }>
export function findSupplementProductCost(name: string, products: SupplementProduct[]): number | null
