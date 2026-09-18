export type ShopifyCogsRow = {
  id: string; date: string; order: string; product: string; qty: number
  unit_price: number; subtotal: number; shipping: number; fulfillment_supliful: number
  processing_supliful: number; processing_shopify: number; total: number
  payout_received: number
}
export function syncShopifyCogs(date: string): Promise<{ date: string; fetchedAt: string; rows: ShopifyCogsRow[] }>
export function saveShopifyCogs(date: string, rows: ShopifyCogsRow[]): Promise<{ date: string; rows: ShopifyCogsRow[] }>
export function getSavedShopifyCogs(date: string): Promise<{ date: string; fetchedAt: string | null; rows: ShopifyCogsRow[] }>
export function getSavedShopifyCogsDates(): Promise<{ dates: string[] }>
