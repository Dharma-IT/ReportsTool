export type ShopifySalesRow = {
  id: string
  name: string
  gross_sales: number | null
  discounts: number | null
  returns: number | null
  net_sales: number | null
  shipping_charges: number | null
  total_sales: number | null
  qty: number
  unit_price: number
  sales: number
  product_name: string
}

export type ShopifyHistoricalProductRow = {
  product: string
  qty: number
  sales_amount: number
}

export function fetchShopifySales(date: string): Promise<{
  date: string
  fetchedAt: string
  rows: ShopifySalesRow[]
}>
export function fetchHistoricalShopifyProductSales(date: string): Promise<ShopifyHistoricalProductRow[]>
export function syncShopifySales(date: string): Promise<{
  date: string
  fetchedAt: string
  rows: ShopifySalesRow[]
  historicalRows: ShopifyHistoricalProductRow[]
}>
export function getSavedShopifySales(date: string): Promise<{
  date: string
  fetchedAt?: string
  rows: ShopifySalesRow[]
  historicalRows?: ShopifyHistoricalProductRow[]
}>
export function getSavedShopifySalesDates(): Promise<{ dates: string[] }>
export function updateHistoricalShopifySales(date: string): Promise<{
  throughDate: string
  fetchedAt: string
  historicalRows: ShopifyHistoricalProductRow[]
}>
export function getHistoricalShopifySales(): Promise<{
  throughDate?: string
  fetchedAt?: string
  historicalRows: ShopifyHistoricalProductRow[]
}>
