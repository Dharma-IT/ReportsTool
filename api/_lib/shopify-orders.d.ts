export type ShopifyOrderLineItem = {
  shopify_order_id: string
  shopify_lineitem_id: string
  order_date: string
  name: string
  email: string | null
  financial_status: string
  paid_at: string | null
  lineitem_quantity: number
  lineitem_name: string
  lineitem_price: number
  lineitem_compare_at_price: number | null
  lineitem_sku: string | null
  fetched_at: string
}

export function syncShopifyOrders(from: string, to: string): Promise<{
  from: string
  to: string
  fetchedAt: string
  rows: ShopifyOrderLineItem[]
}>

export function getSavedShopifyOrders(date: string): Promise<{
  date: string
  rows: ShopifyOrderLineItem[]
}>

export function getSavedShopifyOrderDates(): Promise<{ dates: string[] }>

export type ShopifySupplementContact = {
  orderId: string
  orderName: string
  email: string
  billingPhone: string
  shippingName: string
  firstName: string
  lastName: string
}

export function fetchShopifySupplementContacts(date: string): Promise<{
  date: string
  contacts: ShopifySupplementContact[]
}>
