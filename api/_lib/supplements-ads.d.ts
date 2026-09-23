export type SupplementsAdsRow = {
  report_date: string
  meta: number | string
  google: number | string
  tiktok: number | string
  cogs?: number | string
  shipping?: number | string
  fulfillment?: number | string
  processing?: number | string
  fetched_at?: string
  updated_at?: string
}

export function getSupplementsAds(date?: string): Promise<{ rows: SupplementsAdsRow[] }>
export function saveSupplementsAds(row: Partial<SupplementsAdsRow>): Promise<{ row: SupplementsAdsRow }>
