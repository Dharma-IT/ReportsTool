export type ShopifySalesRow = {
  id: string
  day: string
  sale_id: string
  order_name: string
  product_title: string
  line_gross_sales: number
  line_discounts: number
  line_returns: number
  line_net_sales: number
  line_shipping_charges: number
  line_return_fees: number
  line_taxes: number
  line_total_sales: number
  name: string
  gross_sales: number | null
  discounts: number | null
  returns: number | null
  net_sales: number | null
  shipping_charges: number | null
  total_sales: number | null
  qty: number
  sales: number
  product_name: string
  unit_weight: number
  weight_unit: 'GRAMS' | 'KILOGRAMS' | 'OUNCES' | 'POUNDS' | null
  shipping_country: string | null
  shipping_province: string | null
  shipping_service: string | null
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
