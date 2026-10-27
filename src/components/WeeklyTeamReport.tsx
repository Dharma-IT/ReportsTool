import type { ReactNode } from 'react'
import { contactDuration, contactName } from '../../api/_lib/weekly-contact.ts'
import { combineAppointments, historicalRevenue, keepWeeklySeller, mean, ratioPercent } from '../../api/_lib/weekly-summary.ts'
import type { NoShowPeriod, WeeklyPeriod, WeeklyReport } from './weekly-types'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const count = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const display = (value: number | null | undefined, kind: 'money' | 'percent' | 'count' | 'time' = 'count') => value == null ? 'Pending' : kind === 'money' ? money.format(value) : kind === 'percent' ? `${value.toFixed(1)}%` : kind === 'time' ? contactDuration(value) : count.format(value)
type Row = { name: string; last: number | null; prior: number | null; detail?: string }

function Comparison({ id, title, subtitle, rows, kind = 'percent', note, children }: { id: string; title: string; subtitle: string; rows: Row[]; kind?: 'money' | 'percent' | 'count'; note?: string; children?: ReactNode }) {
  const highest = Math.max(...rows.flatMap((row) => [row.last ?? 0, row.prior ?? 0]), kind === 'percent' ? 10 : 1)
  const max = highest * 1.16
  return <section className="wr-card wr-comparison" data-report-section={id} aria-labelledby={`wr-${id}`}>
    <div className="wr-section-title"><span>{subtitle}</span><h2 id={`wr-${id}`}>{title}</h2>{children}</div>
    <div className="wr-legend"><span><i />Last week</span><span><i className="prior" />Two weeks ago</span></div>
    <div className="wr-chart-scroll"><div className="wr-bar-chart" style={{ minWidth: `${Math.max(460, rows.length * 126)}px` }}>
      {rows.map((row) => <div className={`wr-bar-group ${row.name === 'Average' ? 'average' : ''}`} key={row.name}>
        <div className="wr-bar-pair">{(['last', 'prior'] as const).map((period) => <div className={`wr-bar-column ${period}`} key={period}>
          <strong>{display(row[period], kind)}</strong><i style={{ height: `${(row[period] ?? 0) / max * 180}px` }} title={`${row.name}, ${period === 'last' ? 'last week' : 'prior week'}: ${display(row[period], kind)}`} />
        </div>)}</div><b>{row.name}</b>{row.detail ? <small>{row.detail}</small> : null}
      </div>)}
    </div></div>{note ? <p className="wr-note">{note}</p> : null}
  </section>
}

function filterPeriod(period: WeeklyPeriod, keep: (name: string) => boolean, canonical: (name: string) => string): WeeklyPeriod {
  const values = (record: Record<string, number> = {}) => Object.entries(record).reduce<Record<string, number>>((result, [name, value]) => {
    if (keep(name)) { const key = canonical(name); result[key] = (result[key] ?? 0) + value }
    return result
  }, {})
  const bySeller = values(period.bySeller), deals = values(period.dealCountsBySeller)
  const products = Object.fromEntries(Object.entries(period.products).map(([name, product]) => {
    const bySeller: typeof product.bySeller = {}
    for (const [seller, row] of Object.entries(product.bySeller)) if (keep(seller)) {
      const key = canonical(seller), previous = bySeller[key] ?? { revenue: 0, units: 0 }
      bySeller[key] = { revenue: previous.revenue + row.revenue, units: previous.units + row.units }
    }
    return [name, { bySeller, revenue: Object.values(bySeller).reduce((sum, row) => sum + row.revenue, 0), units: Object.values(bySeller).reduce((sum, row) => sum + row.units, 0) }]
  }))
  const refundsBySeller = values(period.refundsBySeller)
  return { ...period, bySeller, dealCountsBySeller: deals, averageTicketBySeller: Object.fromEntries(Object.keys(bySeller).map((name) => [name, deals[name] ? bySeller[name] / deals[name] : 0])), products, refundsBySeller,
    revenue: Object.values(bySeller).reduce((sum, value) => sum + value, 0), refunds: Object.values(refundsBySeller).reduce((sum, value) => sum + value, 0),
    refundCountsBySeller: values(period.refundCountsBySeller), newTreatmentsBySeller: values(period.newTreatmentsBySeller), repurchaseTreatmentsBySeller: values(period.repurchaseTreatmentsBySeller),
    warnings: period.warnings?.filter((warning) => keep(warning.seller)),
  }
}

export default function WeeklyTeamReport({ report, team, error, onReconcile, reconciling }: { report: WeeklyReport | null; team: 'sales' | 'cs'; error: string; onReconcile: () => void; reconciling: boolean }) {
  const roster = report?.contactRosters?.[team]
  const keep = (name: string) => keepWeeklySeller(name, team, roster)
  const canonical = (name: string) => contactName(name, team, roster) ?? name
  const last = report ? filterPeriod(report.lastWeek, keep, canonical) : null
  const prior = report ? filterPeriod(report.twoWeeksAgo, keep, canonical) : null
  const calls = report?.calls?.[team]
  const names = [...new Set([...(roster?.map((agent) => agent.name) ?? []), ...Object.keys(last?.bySeller ?? {}), ...Object.keys(prior?.bySeller ?? {}), ...(calls?.lastWeek.agents.map((agent) => canonical(agent.name)) ?? [])])].filter(keep)
  const aircallRow = (name: string, period: 'lastWeek' | 'twoWeeksAgo') => calls?.[period].agents.find((agent) => canonical(agent.name) === name)
  const injectionUnits = (period: WeeklyPeriod | null, name: string) => period?.products['Weight Loss Injections']?.bySeller[name]?.units ?? 0
  const performance = names.map((name) => ({ name,
    last: calls ? ratioPercent(injectionUnits(last, name), aircallRow(name, 'lastWeek')?.aircallValidCalls ?? 0) : null,
    prior: calls ? ratioPercent(injectionUnits(prior, name), aircallRow(name, 'twoWeeksAgo')?.aircallValidCalls ?? 0) : null,
    detail: `${count.format(injectionUnits(last, name))} injection units / ${aircallRow(name, 'lastWeek')?.aircallValidCalls ?? 0} valid calls`,
  }))
  const averagePerformance = { last: mean(performance.map((row) => row.last)), prior: mean(performance.map((row) => row.prior)) }
  const meetings = (period: NoShowPeriod | undefined) => combineAppointments(Object.entries(period?.bySeller ?? {}).filter(([name]) => keep(name)).map(([, bucket]) => bucket))
  const lastMeetings = meetings(report?.noShows?.lastWeek), priorMeetings = meetings(report?.noShows?.twoWeeksAgo)
  const noShow = { last: ratioPercent(lastMeetings.noShows, lastMeetings.total), prior: ratioPercent(priorMeetings.noShows, priorMeetings.total) }
  const noShowRows: Row[] = names.map((name) => {
    const lastBucket = report?.noShows?.lastWeek.bySeller[name], priorBucket = report?.noShows?.twoWeeksAgo.bySeller[name]
    return { name, last: ratioPercent(lastBucket?.noShows ?? 0, lastBucket?.total ?? 0), prior: ratioPercent(priorBucket?.noShows ?? 0, priorBucket?.total ?? 0), detail: `${lastBucket?.noShows ?? 0} no-show/canceled of ${lastBucket?.total ?? 0} meetings` }
  })
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdayRows = weekdays.map((name) => {
    const bucket = (period: NoShowPeriod | undefined) => combineAppointments(Object.entries(period?.bySellerWeekday ?? {}).filter(([seller]) => keep(seller)).map(([, days]) => days[name]))
    const l = bucket(report?.noShows?.lastWeek), p = bucket(report?.noShows?.twoWeeksAgo)
    return { name, last: ratioPercent(l.noShows, l.total), prior: ratioPercent(p.noShows, p.total), detail: `${l.noShows} / ${l.total} meetings` }
  })
  const ticketRows = names.map((name) => ({ name, last: last?.dealCountsBySeller[name] ? (last.bySeller[name] ?? 0) / last.dealCountsBySeller[name] : null, prior: prior?.dealCountsBySeller[name] ? (prior.bySeller[name] ?? 0) / prior.dealCountsBySeller[name] : null, detail: `${last?.dealCountsBySeller[name] ?? 0} paid deals` }))
  const refundRows = names.map((name) => ({ name, last: last ? last.refundsBySeller[name] ?? 0 : null, prior: prior ? prior.refundsBySeller[name] ?? 0 : null, detail: `${last?.refundCountsBySeller?.[name] ?? 0} refunds last week / ${prior?.refundCountsBySeller?.[name] ?? 0} prior` }))
  const history = report?.revenueHistory ?? []
  const sellerRows = names.map((name) => ({ name, last: last?.bySeller[name] ?? 0, prior: prior?.bySeller[name] ?? 0, ...historicalRevenue(history, name, last?.fromDate ?? '') }))
  const maxRevenue = Math.max(...sellerRows.flatMap((row) => [row.last, row.prior, row.average ?? 0, row.highest ?? 0]), 1) * 1.1
  const totalDeals = (period: WeeklyPeriod | null) => Object.values(period?.dealCountsBySeller ?? {}).reduce((sum, value) => sum + value, 0)
  const treatmentCount = (period: WeeklyPeriod | null, repurchase: boolean) => period ? Object.values((repurchase ? period.repurchaseTreatmentsBySeller : period.newTreatmentsBySeller) ?? {}).reduce((sum, value) => sum + value, 0) : null
  const revenueChange = last && prior ? last.revenue - prior.revenue : null
  const pointChange = (a: number | null, b: number | null) => a == null || b == null ? 'Pending' : `${Math.abs(a - b).toFixed(1)} percentage points ${a >= b ? 'higher' : 'lower'}`
  const productGroups = [
    { name: 'Weight Loss Injections', keys: ['Weight Loss Injections'], color: '#1e754c' }, { name: 'Slim Boost', keys: ['Slim Boost'], color: '#55b78b' },
    { name: 'Nutritional Plans', keys: ['Nutritional Plans'], color: '#9bcbb4' }, { name: 'NAD+', keys: ['NAD+'], color: '#39d39b' },
    { name: 'Peptides', keys: ['Peptides', 'Sermorelin', 'GHK-Cu Troches', 'Glutathione'], color: '#94ad89' }, { name: 'Other products', keys: ['Other products'], color: '#c7aa64' },
  ].map((group) => ({ ...group, revenue: group.keys.reduce((sum, key) => sum + (last?.products[key]?.revenue ?? 0), 0) }))
  const productBase = productGroups.reduce((sum, product) => sum + Math.max(0, product.revenue), 0)
  let position = 0
  const gradient = productGroups.map((product) => { const start = position; position += productBase ? Math.max(0, product.revenue) / productBase * 100 : 0; return `${product.color} ${start}% ${position}%` }).join(',')
  const callRows = names.map((name) => ({ name, row: aircallRow(name, 'lastWeek') }))
  const activeCallRows = callRows.filter(({ row }) => row && (row.aircallCalls > 0 || row.doxyCalls > 0))
  const sumAircall = calls ? calls.lastWeek.agents.reduce((sum, row) => sum + row.aircallSeconds, 0) : null
  const sumDoxy = calls?.lastWeek.doxyUploaded ? calls.lastWeek.agents.reduce((sum, row) => sum + row.doxySeconds, 0) : null
  const sumConnected = sumAircall != null && sumDoxy != null ? sumAircall + sumDoxy : null
  const callPlotRows = [...callRows, ...(calls && activeCallRows.length ? [{ name: 'Average', row: { name: 'Average', aircallSeconds: (sumAircall ?? 0) / activeCallRows.length, doxySeconds: (sumDoxy ?? 0) / activeCallRows.length, aircallCalls: 0, doxyCalls: 0 } }] : [])]
  const maxCall = Math.max(...callRows.map(({ row }) => (row?.aircallSeconds ?? 0) + (sumDoxy != null ? row?.doxySeconds ?? 0 : 0)), 1) * 1.15
  const withAverage = (rows: Row[]) => [...rows, { name: 'Average', last: mean(rows.map((row) => row.last)), prior: mean(rows.map((row) => row.prior)) }]

  return <div className="wr-report">
    <header className="weekly-heading"><div><p className="eyebrow">Weekly {team === 'sales' ? 'sales' : 'customer service'} report</p><h1>{team === 'sales' ? 'Sales' : 'Customer Service'} performance</h1><p>{last ? `${last.fromDate} through ${last.toDate} ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· New York time ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Monday-Saturday` : 'Loading HubSpot reporting data...'}</p></div><span>HubSpot + call ledger</span></header>
    {last?.checkedAt ? <p className="wr-note">HubSpot checked {new Date(last.checkedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })} (New York time).</p> : null}
    {error ? <div className="daily-error" role="alert">Weekly report unavailable: {error}</div> : null}
    {last?.warnings?.map((warning) => <div className="daily-warning" role="status" key={warning.message}>{warning.seller}: {warning.message}</div>)}
    {lastMeetings.unresolved ? <div className="daily-warning" role="status">{lastMeetings.unresolved} meeting(s) have no final attendance outcome. They remain in the scheduled-meeting denominator; no-show totals may be incomplete.</div> : null}

    <section className="wr-card" data-report-section="major-points"><div className="wr-section-title"><span>Weekly recap</span><h2>Major Points</h2></div>
      <div className="wr-highlights"><article><span>Revenue</span><strong>{display(last?.revenue, 'money')}</strong><p>{revenueChange == null ? 'Pending HubSpot data' : `${money.format(Math.abs(revenueChange))} ${revenueChange >= 0 ? 'more' : 'less'} than the prior week (${display(prior?.revenue, 'money')}).`}</p></article>
        <article><span>Average agent performance</span><strong>{display(averagePerformance.last, 'percent')}</strong><p>{pointChange(averagePerformance.last, averagePerformance.prior)} than the prior week. Injections sold / valid Aircall calls.</p></article>
        <article><span>Appointment no-show rate</span><strong>{display(noShow.last, 'percent')}</strong><p>{pointChange(noShow.last, noShow.prior)} than the prior week. Canceled + No Show / scheduled meetings.</p></article></div>
    </section>

    <section className="wr-card wr-treatments" data-report-section="new-treatments"><div className="wr-section-title"><span>Weight Loss Injections only</span><h2>{team === 'sales' ? 'New Treatments' : 'CS Treatment Mix'}</h2><p>{team === 'sales' ? 'Sales-owned injection units excluding repurchases. Customer Service sales are excluded from the Sales new-treatment count.' : 'CS injection units shown separately from Sales new treatments, with repurchases identified from HubSpot source data.'}</p></div><div className="wr-treatment-values"><article><strong>{display(treatmentCount(last, false))}</strong><span>{team === 'sales' ? 'New injection units (including Microdose)' : 'Non-repurchase injection units'}</span><small>Prior week: {display(treatmentCount(prior, false))}</small></article><article><strong>{display(treatmentCount(last, true))}</strong><span>Repurchase injection units</span><small>Prior week: {display(treatmentCount(prior, true))}</small></article></div></section>

    <section className="wr-card wr-product-revenue" data-report-section="product-revenue"><div className="wr-section-title"><span>By product</span><h2>Sales Revenue</h2><p>All associated products are included. The chart shows the mix of positive product revenue.</p></div><div className="wr-product-layout"><div className="wr-donut" style={{ background: productBase ? `conic-gradient(${gradient})` : '#e5ece7' }} role="img" aria-label="Product revenue distribution" /><div className="wr-product-values">{productGroups.map((product) => <div key={product.name}><i style={{ background: product.color }} /><span>{product.name}<small>{productBase ? (Math.max(0, product.revenue) / productBase * 100).toFixed(1) : '0.0'}%</small></span><strong>{display(last ? product.revenue : null, 'money')}</strong></div>)}<div className="wr-adjustment"><span>Unallocated revenue</span><strong>{display(last?.products['Unallocated revenue']?.revenue ?? (last ? 0 : null), 'money')}</strong></div><p className="wr-note">Unallocated revenue is the difference between deal amounts and associated line items. It is not assigned to a product. Product revenue plus this difference reconciles to total revenue.</p></div></div></section>

    <section className="wr-card" data-report-section="seller-revenue"><div className="wr-section-title"><span>Weekly sales growth</span><h2>Revenue by Seller</h2><p>Average and highest use complete reporting weeks from September 28 through the selected week, including zero-sales weeks. Future weeks are excluded.</p></div>
      <div className="wr-legend"><span><i />Last week</span><span><i className="prior" />Two weeks ago</span><span><i className="history-average" />Average</span><span><i className="highest" />Highest</span></div>
      <div className="wr-chart-scroll"><div className="wr-bar-chart" style={{ minWidth: `${Math.max(460, sellerRows.length * 150)}px` }}>{sellerRows.map((row) => <div className="wr-bar-group" key={row.name}><div className="wr-bar-pair wr-four-bars">{(['last', 'prior', 'average', 'highest'] as const).map((key) => <div className={`wr-bar-column ${key}`} key={key}><i style={{ height: `${(row[key] ?? 0) / maxRevenue * 190}px` }} title={`${row.name} ${key}: ${display(row[key], 'money')}`} /></div>)}</div><b>{row.name}</b><small>{last?.newTreatmentsBySeller?.[row.name] ?? 0} new units / {prior?.newTreatmentsBySeller?.[row.name] ?? 0} prior<br />{last?.dealCountsBySeller[row.name] ?? 0} paid deals / {prior?.dealCountsBySeller[row.name] ?? 0} prior</small></div>)}</div></div>
      <div className="wr-table-wrap"><table><thead><tr><th>Seller</th><th>Last week</th><th>Prior week</th><th>Average</th><th>Highest</th></tr></thead><tbody>{sellerRows.map((row) => <tr key={row.name}><th>{row.name}</th><td>{display(last ? row.last : null, 'money')}</td><td>{display(prior ? row.prior : null, 'money')}</td><td>{display(row.average, 'money')}</td><td>{display(row.highest, 'money')}</td></tr>)}</tbody></table></div>
    </section>

    {['Slim Boost', 'Nutritional Plans', 'NAD+', 'Sermorelin', 'GHK-Cu Troches', 'Glutathione'].map((title) => {
      const l = last?.products[title], p = prior?.products[title]
      const rows = names.map((name) => ({ name, last: last ? ratioPercent(l?.bySeller[name]?.units ?? 0, injectionUnits(last, name)) : null, prior: prior ? ratioPercent(p?.bySeller[name]?.units ?? 0, injectionUnits(prior, name)) : null, detail: `${l?.bySeller[name]?.units ?? 0} units / ${injectionUnits(last, name)} injections` }))
      return <Comparison key={title} id={`product-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`} title={title} subtitle="Compared to injections" rows={withAverage(rows)} note="Units sold / injection units sold for each agent. Pending means there is no injection denominator. Average excludes undefined ratios."><p>{display(last ? l?.revenue ?? 0 : null, 'money')} revenue and {display(last ? l?.units ?? 0 : null)} units last week, compared with {display(prior ? p?.revenue ?? 0 : null, 'money')} and {display(prior ? p?.units ?? 0 : null)} units in the prior week.</p></Comparison>
    })}

    <Comparison id="refunds" title="Refunds" subtitle="Per seller" rows={withAverage(refundRows)} kind="money" note="Matches the Refunds dashboard: refund values on deals whose Paid date (all pipelines) is in the selected week, grouped by HubSpot deal owner. This is a paid-deal cohort, not refund-processing-date cash flow. Amounts are shown as positive outflows."><p>{display(last?.refunds, 'money')} refunded last week across {Object.values(last?.refundCountsBySeller ?? {}).reduce((sum, value) => sum + value, 0)} deals, compared with {display(prior?.refunds, 'money')} in the prior week.</p></Comparison>

    <Comparison id="performance" title="Performance" subtitle="Valid-call conversion" rows={withAverage(performance)} note="Weight Loss Injection units sold / valid Aircall calls. Valid calls are answered, finalized calls with more than 60 seconds of connected time, matching Daily. Doxy is not part of this denominator. Average excludes agents with no valid calls."><p>Average agent performance: {display(averagePerformance.last, 'percent')} last week versus {display(averagePerformance.prior, 'percent')} prior.</p></Comparison>

    <Comparison id="average-ticket" title="Average Ticket" subtitle="Paid HubSpot deals" rows={withAverage(ticketRows)} kind="money" note="Each agent: revenue / paid deals. The Average bar is the arithmetic mean of defined agent tickets. The team ticket below weights every paid deal equally."><p>Average agent ticket: {display(mean(ticketRows.map((row) => row.last)), 'money')} last week versus {display(mean(ticketRows.map((row) => row.prior)), 'money')} prior. Team revenue per paid deal: {display(last && totalDeals(last) ? last.revenue / totalDeals(last) : null, 'money')}.</p></Comparison>

    <Comparison id="no-show-weekday" title="No-show by Weekday" subtitle="HubSpot meeting outcomes" rows={weekdayRows} note="Only this team's meetings starting Monday-Saturday in New York time. No-show = canceled/no-show outcome or a matching meeting-title marker (including Canceled, Cancelled, and Cancelado). The denominator is all scheduled meetings in the selected period." />
    <Comparison id="no-show-seller" title="No-show by Seller" subtitle="Canceled or not attended meetings" rows={withAverage(noShowRows)} note="No-show = canceled/no-show outcome or a matching meeting-title marker (including Canceled, Cancelled, and Cancelado). Average is the mean of defined agent rates; the team rate is total no-shows divided by total meetings."><p>Team rate: {display(noShow.last, 'percent')} ({lastMeetings.noShows}/{lastMeetings.total}) versus {display(noShow.prior, 'percent')} ({priorMeetings.noShows}/{priorMeetings.total}) prior.</p></Comparison>

    <section className="wr-card" data-report-section="calls"><div className="wr-section-title"><span>Channels and connected time</span><h2>Calls</h2><p>Aircall uses the shared API and webhook ledger. Doxy comes only from the Weekly upload. Total and channels are separate bars so time is not double-counted.</p><button className="daily-export-button" type="button" onClick={onReconcile} disabled={reconciling}>{reconciling ? 'Reconciling...' : 'Reconcile Aircall'}</button></div>
      <div className="wr-highlights wr-call-highlights"><article><span>Aircall time</span><strong>{display(sumAircall, 'time')}</strong></article><article><span>Doxy time</span><strong>{display(sumDoxy, 'time')}</strong></article><article><span>Total connected time</span><strong>{display(sumConnected, 'time')}</strong></article></div>
      <div className="wr-legend"><span><i />Total</span><span><i className="prior" />Aircall</span><span><i className="history-average" />Doxy</span></div>
      <div className="wr-chart-scroll"><div className="wr-bar-chart" style={{ minWidth: `${Math.max(460, callPlotRows.length * 150)}px` }}>{callPlotRows.map(({ name, row }) => <div className="wr-bar-group" key={name}><div className="wr-bar-pair">{[{ key: 'last', value: sumDoxy != null ? (row?.aircallSeconds ?? 0) + (row?.doxySeconds ?? 0) : null }, { key: 'prior', value: calls ? row?.aircallSeconds ?? 0 : null }, { key: 'average', value: sumDoxy != null ? row?.doxySeconds ?? 0 : null }].map((channel) => <div className={`wr-bar-column ${channel.key}`} key={channel.key}><i style={{ height: `${(channel.value ?? 0) / maxCall * 170}px` }} title={`${name}: ${display(channel.value, 'time')}`} /></div>)}</div><b>{name}</b></div>)}</div></div>
      <div className="wr-table-wrap"><table><thead><tr><th>Agent</th><th>Aircall calls</th><th>Valid calls</th><th>Aircall time</th><th>Doxy calls</th><th>Doxy time</th><th>Total time</th></tr></thead><tbody>{callRows.map(({ name, row }) => <tr key={name}><th>{name}</th><td>{calls ? row?.aircallCalls ?? 0 : 'Pending'}</td><td>{calls ? row?.aircallValidCalls ?? 0 : 'Pending'}</td><td>{display(calls ? row?.aircallSeconds ?? 0 : null, 'time')}</td><td>{sumDoxy != null ? row?.doxyCalls ?? 0 : 'Pending'}</td><td>{display(sumDoxy != null ? row?.doxySeconds ?? 0 : null, 'time')}</td><td>{display(sumDoxy != null && calls ? (row?.aircallSeconds ?? 0) + (row?.doxySeconds ?? 0) : null, 'time')}</td></tr>)}</tbody><tfoot><tr><th>Average active agent</th><td colSpan={2}>{activeCallRows.length} agents with calls</td><td>{display(sumAircall != null && activeCallRows.length ? sumAircall / activeCallRows.length : null, 'time')}</td><td>{sumDoxy == null ? 'Upload needed' : 'Uploaded'}</td><td>{display(sumDoxy != null && activeCallRows.length ? sumDoxy / activeCallRows.length : null, 'time')}</td><td>{display(sumConnected != null && activeCallRows.length ? sumConnected / activeCallRows.length : null, 'time')}</td></tr></tfoot></table></div>
      <p className="wr-note">Chart height uses seconds on a linear scale. Values retain hours, minutes, and seconds. Combined time remains Pending until a Weekly Doxy file is uploaded.</p>
    </section>

    {team === 'cs' ? <section className="wr-card" data-report-section="cs-lists"><div className="wr-section-title"><span>Customer Service lists</span><h2>CS Call Details</h2><p>HubSpot calls associated with deals by Imported Source. Unanswered calls use the No Answer outcome, separate from appointment no-shows.</p></div>{(['abandonedCart', 'repurchaseList', 'repurchaseNoAnswer'] as const).map((key) => <Comparison key={key} id={`cs-${key}`} title={{ abandonedCart: 'Abandoned Cart', repurchaseList: 'Repurchase List', repurchaseNoAnswer: 'Repurchase No-answer' }[key]} subtitle="Associated HubSpot calls" kind="count" rows={names.map((name) => ({ name, last: report?.csSourceMetrics?.lastWeek[key][name] ?? 0, prior: report?.csSourceMetrics?.twoWeeksAgo[key][name] ?? 0 }))} />)}</section> : null}
  </div>
}
