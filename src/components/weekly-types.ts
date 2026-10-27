import type { AircallQuality } from '../../api/_lib/aircall-ledger.ts'
import type { ContactAgent } from '../../api/_lib/weekly-contact.ts'
import type { AppointmentBucket, RevenueWeek } from '../../api/_lib/weekly-summary.ts'

export type WeeklyProductTotals = { revenue: number; units: number; bySeller: Record<string, { revenue: number; units: number }> }
export type WeeklyPeriod = {
  fromDate: string; toDate: string; revenue: number; refunds: number; dealCount: number
  bySeller: Record<string, number>; dealCountsBySeller: Record<string, number>; averageTicketBySeller: Record<string, number>
  refundsBySeller: Record<string, number>; refundCountsBySeller?: Record<string, number>
  products: Record<string, WeeklyProductTotals>; newTreatments?: number
  newTreatmentsBySeller?: Record<string, number>; repurchaseTreatmentsBySeller?: Record<string, number>
  refundBasis?: string
  checkedAt?: string
  warnings?: Array<{ seller: string; message: string }>
}
type LeadMetrics = { messages: number; calls: number; bookings: number; callSeconds: number }
export type LeadPeriod = { fromDate: string; toDate: string; agents: Array<LeadMetrics & { name: string }>; days: Array<LeadMetrics & { date: string }>; totals: LeadMetrics }
type WeeklyActivityReport = { lastWeek: LeadPeriod; twoWeeksAgo: LeadPeriod }
export type WeeklyCallAgent = { name: string; aircallSeconds: number; aircallCalls: number; aircallValidCalls?: number; doxySeconds: number; doxyCalls: number }
export type WeeklyCallPeriod = { agents: WeeklyCallAgent[]; doxyUploaded: boolean; unknownDurationCalls: number; aircallUploaded: boolean; aircallAvailable: boolean; aircallQuality: AircallQuality }
type WeeklyCalls = { lastWeek: WeeklyCallPeriod; twoWeeksAgo: WeeklyCallPeriod }
export type NoShowPeriod = { bySeller: Record<string, AppointmentBucket>; byWeekday: Record<string, AppointmentBucket>; bySellerWeekday?: Record<string, Record<string, AppointmentBucket>> }
export type CsSourceMetrics = { abandonedCart: Record<string, number>; repurchaseList: Record<string, number>; repurchaseNoAnswer: Record<string, number> }
export type WeeklyReport = {
  timezone: string; contactRosters?: { sales: ContactAgent[]; cs: ContactAgent[] }; lastWeek: WeeklyPeriod; twoWeeksAgo: WeeklyPeriod
  revenueHistory?: RevenueWeek[]; source?: { selected: 'live' | 'saved'; prior: 'live' | 'saved' }
  calls?: { sales: WeeklyCalls; cs: WeeklyCalls }; noShows?: { lastWeek: NoShowPeriod; twoWeeksAgo: NoShowPeriod }
  csSourceMetrics?: { lastWeek: CsSourceMetrics; twoWeeksAgo: CsSourceMetrics }
  insights: Array<{ kind: string; title: string; detail: string }>; leadManagement?: WeeklyActivityReport; customerCare?: WeeklyActivityReport
}
