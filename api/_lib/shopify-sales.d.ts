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
  sales: number
  product_name: string
}

export function fetchShopifySales(date: string): Promise<{
  date: string
  fetchedAt: string
  rows: ShopifySalesRow[]
}>
