import { execFile, spawn } from 'node:child_process'
import { openSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const execFileAsync = promisify(execFile)
const ACCOUNT_ID = 'act_653630476536860'
const GRAPH_VERSION = 'v20.0'
const SMG_CAMPAIGN_PATTERNS = [
  '{sp} smg campaign - 2047 [new ppl]',
  '{sp} smg campaign - 2047 [broad]',
  '{sp} smg campaign - 0123 v3 - secondary',
  '{sp} smg campaign - 0123 v2 - secondary',
  '{sp} smg campaign - new ppl - 0123 v3',
]
const CALL_CONFIRMATION_AGENTS = ['William Carcamo', 'Kathering Silva']
const BUSINESS_HOURS_END = 19
const RESPOND_IO_ORGANIZATION_ID = '236383'
const RESPOND_IO_SPACE_ID = '238284'
const AGENT_REPORT_AGENTS = [
  { name: 'Belizabett Gonzalez', aliases: ['Belizabett Gonzalez'] },
  { name: 'Ailene Nuevas', aliases: ['Ailene Nuevas'] },
  { name: 'Laura Sanchez', aliases: ['Laura Sanchez', 'Laura Alejandra Sanchez Pinto'] },
  { name: 'Natasha Lopez', aliases: ['Natasha Lopez'] },
  { name: 'William Carcamo', aliases: ['William Carcamo'] },
  { name: 'Kathering Silva', aliases: ['Kathering Silva'] },
  { name: 'Kevin Tinjaca', aliases: ['Kevin Tinjaca'] },
  { name: 'Zara Meza', aliases: ['Zara Meza'] },
]
const DAILY_CS_AGENTS = [
  { name: 'Arles Martinez', aliases: ['Arles Martinez'] },
  { name: 'Aline Strelow', aliases: ['Aline Strelow', 'Ailene Nuevas', 'Alice F'] },
  { name: 'Brayam Zuluaga', aliases: ['Brayam Zuluaga', 'Brayan Zuluaga'] },
  { name: 'Edmilson Morales', aliases: ['Edmilson Morales', 'Edmilson Velasquez'] },
]
const DAILY_SALES_AGENTS = [
  { name: 'Andres Castro', aliases: ['Andres Castro', 'Andrés Castro'] },
  { name: 'Maria Claudia', aliases: ['Maria Claudia', 'María Claudia'] },
  { name: 'Alejandro Rivera', aliases: ['Alejandro Rivera'] },
  { name: 'Erika Vargas', aliases: ['Erika Vargas'] },
  { name: 'Meribet Yazziet', aliases: ['Meribet Yazziet'] },
  { name: 'Ailin Isabel', aliases: ['Ailin Isabel', 'Ailín Isabel'] },
]
const STAFF_PERFORMANCE_REPORT = [
  { name: 'Belizabett Gonzalez', respondAliases: ['Belizabett Gonzalez'], hubSpotAliases: ['Belizabett Gonzalez'], hasCalls: true },
  { name: 'Carol Fernandes', respondAliases: ['Carolina Lopez'], hubSpotAliases: ['Carol Fernandes'], hasCalls: false },
  { name: 'Ailene Nuevas', respondAliases: ['Ailene Nuevas'], hubSpotAliases: ['Ailene Nuevas', 'Aline Strelow'], hasCalls: true },
  { name: 'Laura Sanchez', respondAliases: ['Laura Sanchez'], hubSpotAliases: ['Laura Sanchez'], hasCalls: true },
  { name: 'Natasha Lopez', respondAliases: ['Natasha Lopez'], hubSpotAliases: ['Natasha Lopez'], hasCalls: true },
  { name: 'Natasha Lorente', respondAliases: ['Jose Lorente'], hubSpotAliases: ['Natasha Lorente'], hasCalls: false },
  { name: 'William Carcamo', respondAliases: ['William Carcamo'], hubSpotAliases: ['William Carcamo'], hasCalls: true },
  { name: 'Kathering Silva', respondAliases: ['Kathering Silva'], hubSpotAliases: ['Kathering Silva'], hasCalls: true },
  { name: 'Kevin Tinjaca', respondAliases: ['Kevin Tinjaca'], hubSpotAliases: ['Kevin Tinjaca'], hasCalls: true },
  { name: 'Zara Meza', respondAliases: ['Zara Meza'], hubSpotAliases: ['Zara Meza'], hasCalls: true },
]
// The Public Calls API marks these as missed, but dashboard review confirmed that
// an agent attempted to answer after the caller had already disconnected.
const EXCLUDED_MISSED_CALL_IDS = new Set([3979734082])

type GraphCampaign = {
  id: string
  name: string
  status: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  budget_remaining?: string
}

type GraphInsight = {
  campaign_id: string
  spend?: string
  impressions?: string
  clicks?: string
  actions?: GraphAction[]
}

type GraphAction = {
  action_type: string
  value?: string
}

type GraphList<T> = {
  data?: T[]
}

type RespondIoContact = Record<string, unknown>

type RespondIoListResponse = {
  items?: RespondIoContact[]
  pagination?: unknown
  message?: string
}

type RespondIoChannel = {
  id: number
  name: string
  source: string
}

type RespondIoChannelResponse = {
  items?: RespondIoChannel[]
  message?: string
}

type RespondIoAnalyticsResponse = {
  opened?: { count?: number }
  values?: Record<string, unknown>
  [key: string]: unknown
}

type RespondIoUser = {
  id: number
  firstName?: string
  lastName?: string
}

type RespondIoUserPerformanceResponse = {
  data?: {
    data?: Array<{ userId: number; outgoingMessageCount?: number }>
  }
}

type AircallUser = {
  id?: number
  name?: string
  email?: string
}

type AircallNumber = {
  name?: string
  digits?: string
}

type AircallIvrOption = {
  title?: string
  key?: string
  branch?: string
  transition_started_at?: string
  transition_ended_at?: string
}

type AircallCall = {
  id: number
  direction: string
  status: string
  missed_call_reason: string | null
  started_at: number
  answered_at: number | null
  ended_at: number
  duration: number
  archived: boolean
  raw_digits: string
  user?: AircallUser | null
  assigned_to?: AircallUser | null
  transferred_to?: AircallUser | null
  number?: AircallNumber | null
  tags?: { name?: string }[]
  comments?: unknown[]
  recording_short_url?: string | null
  voicemail_short_url?: string | null
  ivr_options_selected?: AircallIvrOption[]
}

type AircallCallsResponse = {
  calls?: AircallCall[]
  meta?: {
    next_page_link?: string | null
  }
  message?: string
}

type AircallAssignee = {
  name: string
  email: string | null
  source: 'direct'
}

type AircallWebhookPayload = {
  event?: string
  resource?: string
  timestamp?: number
  token?: string
  data?: AircallCall
}

type StoredAircallRingEvent = {
  call_id: number
  agent_name: string | null
  event_timestamp: number
}

type HubSpotTask = {
  id: string
  properties: {
    hs_createdate?: string | null
    hs_task_contact_phone?: string | null
    hs_task_status?: string | null
    hs_task_subject?: string | null
    hubspot_owner_id?: string | null
  }
}

type HubSpotTaskSearchResponse = {
  results?: HubSpotTask[]
  paging?: { next?: { after?: string } }
  message?: string
}

type HubSpotOwner = {
  id: string
  firstName?: string
  lastName?: string
}

type HubSpotDeal = {
  id: string
  properties: Record<string, string | null | undefined>
}

type HubSpotLineItem = {
  id: string
  properties: Record<string, string | null | undefined>
}

type HubSpotSearchResponse<T> = {
  results?: T[]
  paging?: { next?: { after?: string } }
  total?: number
  message?: string
}

function facebookBudgetApi(token: string): Plugin {
  return {
    name: 'facebook-budget-api',
    configureServer(server) {
      server.middlewares.use('/api/smg-campaign-budgets', async (request, response) => {
        try {
          if (!token) {
            sendJson(response, 500, {
              message: 'Missing FACEBOOK_SYSTEM_ACCESS_TOKEN in .env.local.',
            })
            return
          }

          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          const timezone = requestUrl.searchParams.get('timezone') || 'America/New_York'

          if (timezone !== 'America/New_York') {
            sendJson(response, 400, {
              message: 'Meta budget reports must use America/New_York timezone.',
            })
            return
          }

          const reportDate = requestUrl.searchParams.get('date') || getYesterdayInNewYork()
          const campaigns = await graphGet<GraphList<GraphCampaign>>(`${ACCOUNT_ID}/campaigns`, {
            fields:
              'id,name,status,effective_status,daily_budget,lifetime_budget,budget_remaining',
            limit: '200',
            access_token: token,
          })

          // The detail table remains SMG-only, while the headline/Finance spend
          // reconciles to every campaign Meta currently reports as active.
          const activeCampaigns = (campaigns.data ?? []).filter(
            (campaign) => campaign.effective_status === 'ACTIVE',
          )
          const activeSmgCampaigns = activeCampaigns.filter((campaign) =>
            isSmgCampaign(campaign.name),
          )
          const activeJobCampaigns = activeCampaigns.filter(
            (campaign) => isJobCampaign(campaign.name) && !isSmgCampaign(campaign.name),
          )

          const insights = await graphGet<GraphList<GraphInsight>>(`${ACCOUNT_ID}/insights`, {
            fields: 'campaign_id,spend,impressions,clicks,actions',
            level: 'campaign',
            time_range: JSON.stringify({ since: reportDate, until: reportDate }),
            limit: '200',
            access_token: token,
          })

          const insightsByCampaign = new Map(
            (insights.data ?? []).map((insight) => [insight.campaign_id, insight]),
          )

          sendJson(response, 200, {
            reportDate,
            timezone,
            fetchedAt: new Date().toISOString(),
            accountName: 'Dtrix Ad Account #1',
            accountId: ACCOUNT_ID,
            currency: 'USD',
            metaTotalDailyBudget: activeCampaigns.reduce((total, campaign) =>
              total + (centsToDollars(campaign.daily_budget) ?? 0), 0),
            metaTotalSpending: activeCampaigns.reduce((total, campaign) =>
              total + (decimalStringToNumber(insightsByCampaign.get(campaign.id)?.spend) ?? 0), 0),
            // Keep job campaigns in the saved breakdown so the sheet can subtract
            // their spend without changing the all-campaign dashboard total.
            campaigns: [...activeSmgCampaigns, ...activeJobCampaigns].map((campaign) => {
              const insight = insightsByCampaign.get(campaign.id)

              return {
                campaignId: campaign.id,
                campaignName: campaign.name,
                status: campaign.status,
                effectiveStatus: campaign.effective_status,
                dailyBudget: centsToDollars(campaign.daily_budget),
                lifetimeBudget: centsToDollars(campaign.lifetime_budget),
                budgetRemaining: centsToDollars(campaign.budget_remaining),
                spendYesterday: decimalStringToNumber(insight?.spend),
                impressionsYesterday: integerStringToNumber(insight?.impressions),
                clicksYesterday: integerStringToNumber(insight?.clicks),
                resultsYesterday: getMessagingConversationResults(insight),
              }
            }),
          })
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : 'Unable to fetch Facebook data.',
          })
        }
      })
    },
  }
}

function respondIoReportMetricsApi(apiToken: string, analyticsToken: string): Plugin {
  return {
    name: 'respond-io-report-metrics-api',
    configureServer(server) {
      server.middlewares.use('/api/respondio-login', async (_request, response) => {
        try {
          const stdout = openSync('respond-login.out.log', 'a')
          const stderr = openSync('respond-login.err.log', 'a')
          const child = spawnNodeScript(['respond-login.mjs', '--profile'], {
            cwd: getAppRoot(),
            detached: true,
            stdio: ['ignore', stdout, stderr],
          })

          child.unref()
          sendJson(response, 202, {
            message:
              'respond.io login opened. Complete login and open Reports > Conversations in the browser window.',
          })
        } catch (error) {
          sendJson(response, 500, {
            message:
              error instanceof Error ? error.message : 'Unable to open respond.io login window.',
          })
        }
      })

      server.middlewares.use('/api/respondio-report-metrics', async (request, response) => {
        try {
          if (!apiToken) {
            sendJson(response, 500, {
              message: 'Missing RESPOND_IO_ACCESS_TOKEN in .env.local.',
            })
            return
          }

          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          const reportDate = requestUrl.searchParams.get('date') || getYesterdayInNewYork()
          const platform = requestUrl.searchParams.get('platform') ?? 'all'
          const channels = await respondIoGet<RespondIoChannelResponse>('space/channel', apiToken, {
            limit: '100',
          })
          const excludedTiktokChannel = (channels.items ?? []).find(
            (channel) => channel.name === 'PT - 2034',
          )

          if (!analyticsToken) {
            if (process.env.RENDER) {
              sendJson(response, 500, {
                message:
                  'Missing RESPOND_IO_ANALYTICS_ACCESS_TOKEN in Render. Browser login only works for local saved-session fetching.',
              })
              return
            }

            const report = await runRespondIoSessionReport(reportDate, platform)
            sendJson(response, 200, {
              ...report,
              excludedTiktokChannel: report.excludedTiktokChannel ?? excludedTiktokChannel,
            })
            return
          }

          const meta = await fetchRespondReportGroup({
            token: analyticsToken,
            reportDate,
            adPlatform: 'meta',
            includedChannelIds: getIncludedMetaChannelIds(channels.items ?? [], excludedTiktokChannel?.id),
          })
          const tiktok = await fetchRespondReportGroup({
            token: analyticsToken,
            reportDate,
            adPlatform: 'tiktok',
          })

          sendJson(response, 200, {
            reportDate,
            timezone: 'America/New_York',
            excludedTiktokChannel,
            metrics: {
              newRespondMeta: meta.newCount,
              totalRespondMeta: meta.totalCount,
              newRespondTiktok: tiktok.newCount,
              totalRespondTiktok: tiktok.totalCount,
            },
          })
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : 'Unable to fetch respond.io report.',
          })
        }
      })
    },
  }
}

function tiktokAdsManagerApi(): Plugin {
  return {
    name: 'tiktok-ads-manager-api',
    configureServer(server) {
      server.middlewares.use('/api/tiktok-login', async (_request, response) => {
        try {
          const stdout = openSync('tiktok-login.out.log', 'a')
          const stderr = openSync('tiktok-login.err.log', 'a')
          const child = spawnNodeScript(['tiktok-login.mjs'], {
            cwd: getAppRoot(),
            detached: true,
            stdio: ['ignore', stdout, stderr],
          })

          child.unref()
          sendJson(response, 202, {
            message: 'TikTok Ads Manager login opened. Log in, then close that browser window.',
          })
        } catch (error) {
          sendJson(response, 500, {
            message:
              error instanceof Error ? error.message : 'Unable to open TikTok login window.',
          })
        }
      })

      server.middlewares.use('/api/tiktok-report', async (request, response) => {
        try {
          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          const reportDate = requestUrl.searchParams.get('date') || getYesterdayInNewYork()
          const mode = requestUrl.searchParams.get('mode')
          const args = ['tiktok-report.mjs', `--date=${reportDate}`]

          if (mode === 'manual') {
            args.push('--manual')
          }

          const { stdout } = await execNodeScript(args, {
            cwd: getAppRoot(),
            timeout: 120_000,
          })

          sendJson(response, 200, JSON.parse(String(stdout)))
        } catch (error) {
          const message =
            error && typeof error === 'object' && 'stderr' in error
              ? parseRespondReportError(String(error.stderr))
              : error instanceof Error
                ? error.message
                : 'Unable to fetch TikTok Ads Manager data.'

          sendJson(response, 500, { message })
        }
      })
    },
  }
}

async function runRespondIoSessionReport(reportDate: string, platform: string) {
  try {
    const { stdout } = await execNodeScript(
      ['respond-report.mjs', `--date=${reportDate}`, `--platform=${platform}`],
      {
        cwd: getAppRoot(),
        timeout: 120_000,
      },
    )

    return JSON.parse(String(stdout)) as {
      reportDate: string
      timezone: string
      excludedTiktokChannel?: RespondIoChannel
      metrics: {
        newRespondMeta: number | null
        totalRespondMeta: number | null
        newRespondTiktok: number | null
        totalRespondTiktok: number | null
      }
    }
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'stderr' in error
        ? parseRespondReportError(String(error.stderr))
        : 'Unable to run saved-session respond.io report.'

    throw new Error(message, { cause: error })
  }
}

function aircallMissedCallsApi(
  apiId: string,
  apiToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Plugin {
  return {
    name: 'aircall-missed-calls-api',
    configureServer(server) {
      server.middlewares.use('/api/missed-calls', async (request, response) => {
        try {
          if (!apiId || !apiToken) {
            sendJson(response, 500, {
              message: 'Missing AIRCALL_API_ID or AIRCALL_API_TOKEN in .env.local.',
            })
            return
          }

          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          const reportDate = requestUrl.searchParams.get('date') || getTodayInNewYork()
          const clientNumber = requestUrl.searchParams.get('phone')?.replace(/\D/g, '') ?? ''
          const { from, to } = getNewYorkUnixDayRange(reportDate)
          const calls = await fetchAircallCalls({
            apiId,
            apiToken,
            from,
            to,
            phoneNumber: clientNumber,
          })

          const missedCallRows = calls
            .filter((call) => isUserDidNotAnswerCall(call))
            .filter((call) => !EXCLUDED_MISSED_CALL_IDS.has(call.id))
            .filter((call) =>
              clientNumber ? call.raw_digits.replace(/\D/g, '') === clientNumber : true,
            )
          const lastRungAgents = await fetchLastRungAgents(
            missedCallRows.map((call) => call.id),
            supabaseUrl,
            supabaseServiceRoleKey,
          ).catch(() => new Map<number, string>())
          const missedCalls = await Promise.all(missedCallRows.map(async (call) => {
            const detailedCall = (await fetchAircallCallDetail(call.id, apiId, apiToken)
              .catch(() => call)
            ) ?? call
            const enrichedCall = {
              ...call,
              ...detailedCall,
              number: detailedCall.number ?? call.number,
              ivr_options_selected:
                detailedCall.ivr_options_selected ?? call.ivr_options_selected,
            }
            const normalizedClientNumber = call.raw_digits.replace(/\D/g, '')
            const assignee = getCallAssignee(enrichedCall, 'direct')

            return {
              id: enrichedCall.id,
              reportDate,
              direction: enrichedCall.direction,
              status: enrichedCall.status,
              missedCallReason: enrichedCall.missed_call_reason,
              startedAt: new Date(enrichedCall.started_at * 1000).toISOString(),
              startedAtNewYork: formatAircallDateTime(enrichedCall.started_at),
              endedAt: new Date(enrichedCall.ended_at * 1000).toISOString(),
              durationSeconds: enrichedCall.duration,
              clientNumber: enrichedCall.raw_digits,
              displayClientNumber: normalizedClientNumber,
              aircallNumberName: enrichedCall.number?.name ?? '',
              aircallNumberDigits: enrichedCall.number?.digits ?? '',
              missedByName:
                lastRungAgents.get(enrichedCall.id) ??
                getVerifiedMissedByName(enrichedCall.id) ??
                assignee?.name ??
                null,
              assigneeName: assignee?.name ?? null,
              assigneeEmail: assignee?.email ?? null,
              assigneeSource: assignee?.source ?? null,
              tags: (enrichedCall.tags ?? []).map((tag) => tag.name).filter(Boolean),
              commentsCount: enrichedCall.comments?.length ?? 0,
              recordingUrl: enrichedCall.recording_short_url ?? null,
              voicemailUrl: enrichedCall.voicemail_short_url ?? null,
              archived: enrichedCall.archived,
            }
          }))
          const missedByNames = [
            ...new Set(missedCalls.map((call) => call.missedByName).filter(Boolean)),
          ] as string[]
          const users = missedByNames.length
            ? await fetchAircallUsers(apiId, apiToken)
            : []
          const agentCalls = (
            await Promise.all(
              missedByNames.map((agentName) => {
                const user = users.find(
                  (candidate) => candidate.name && namesMatch(candidate.name, agentName),
                )

                return user?.id
                  ? fetchAircallCalls({
                      apiId,
                      apiToken,
                      from,
                      to,
                      phoneNumber: '',
                      direction: null,
                      userId: user.id,
                    })
                  : Promise.resolve([])
              }),
            )
          ).flat()
          const availableMissedCalls = missedCalls.filter(
            (call) =>
              !call.missedByName ||
              !isAgentBusyDuringCall(
                call.missedByName,
                call.id,
                call.startedAt,
                call.endedAt,
                agentCalls,
              ),
          )

          sendJson(response, 200, {
            reportDate,
            timezone: 'America/New_York',
            calls: availableMissedCalls,
          })
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : 'Unable to fetch Aircall missed calls.',
          })
        }
      })
    },
  }
}

function aircallWebhookApi(
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
  webhookToken: string,
): Plugin {
  const acceptedEvents = new Set([
    'call.ringing_on_agent',
    'call.agent_declined',
    'call.answered',
    'call.hungup',
    'call.ended',
  ])

  return {
    name: 'aircall-webhook-api',
    configureServer(server) {
      server.middlewares.use('/api/aircall/webhook', async (request, response) => {
        if (request.method === 'OPTIONS') {
          sendJson(response, 200, { ok: true })
          return
        }

        if (request.method !== 'POST') {
          sendJson(response, 405, { message: 'Method not allowed.' })
          return
        }

        try {
          if (!supabaseUrl || !supabaseServiceRoleKey || !webhookToken) {
            throw new Error('Aircall webhook storage is not configured.')
          }

          const payload = await readJsonRequest<AircallWebhookPayload>(request)
          if (payload.token !== webhookToken) {
            sendJson(response, 401, { message: 'Invalid Aircall webhook token.' })
            return
          }

          if (!payload.event || !acceptedEvents.has(payload.event)) {
            sendJson(response, 200, { ok: true, ignored: true })
            return
          }

          const callId = Number(payload.data?.id)
          const eventTimestamp = Number(payload.timestamp)
          if (!Number.isFinite(callId) || !Number.isFinite(eventTimestamp)) {
            sendJson(response, 200, { ok: true, ignored: true })
            return
          }

          const agent = payload.data?.user
          await supabaseRest(
            supabaseUrl,
            supabaseServiceRoleKey,
            'aircall_call_events?on_conflict=event_key',
            {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify({
                event_key: `${callId}:${payload.event}:${eventTimestamp}:${agent?.id ?? 'none'}`,
                call_id: callId,
                event_type: payload.event,
                event_timestamp: eventTimestamp,
                agent_id: agent?.id ?? null,
                agent_name: agent?.name ?? null,
                payload,
              }),
            },
          )
          sendJson(response, 200, { ok: true })
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : 'Unable to store Aircall event.',
          })
        }
      })
    },
  }
}

function callConfirmationApi(hubSpotToken: string, apiId: string, apiToken: string): Plugin {
  return {
    name: 'call-confirmation-api',
    configureServer(server) {
      server.middlewares.use('/api/call-confirmation', async (request, response) => {
        try {
          if (!hubSpotToken || !apiId || !apiToken) {
            sendJson(response, 500, {
              message: 'Missing HUBSPOT_ACCESS_TOKEN or Aircall credentials in .env.local.',
            })
            return
          }

          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          const reportDate = requestUrl.searchParams.get('date') || getTodayInNewYork()
          const previousReportDate = shiftIsoDate(reportDate, -1)
          const { from, to } = getNewYorkUnixDayRange(reportDate)
          const [tasks, previousTasks, outboundCalls, owners] = await Promise.all([
            fetchHubSpotMissedCallTasks(reportDate, hubSpotToken),
            fetchHubSpotMissedCallTasks(previousReportDate, hubSpotToken),
            fetchAircallCalls({ apiId, apiToken, from, to, phoneNumber: '', direction: 'outbound' }),
            fetchHubSpotOwners(hubSpotToken),
          ])
          const ownerNames = new Map(
            owners.map((owner) => [owner.id, `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()]),
          )
          const buildConfirmationNumbers = (sourceTasks: HubSpotTask[]) => {
            const uniqueTasks = Array.from(
              new Map(
                sourceTasks
                .map((task) => [normalizePhoneNumber(task.properties.hs_task_contact_phone), task] as const)
                .filter(([phone]) => phone),
              ).entries(),
            )
            return uniqueTasks.map(([phone, task]) => {
              const assignedTo = ownerNames.get(task.properties.hubspot_owner_id ?? '') ?? 'Unassigned'
              const confirmedCalls = outboundCalls.filter((call) => {
                const agentName = getCallAssignee(call, 'direct')?.name ?? ''
                return (
                  phoneNumbersMatch(phone, normalizePhoneNumber(call.raw_digits)) &&
                  CALL_CONFIRMATION_AGENTS.some((allowedAgent) =>
                    namesMatch(agentName, allowedAgent),
                  )
                )
              })

              return {
                phone,
                assignedTo,
                called: confirmedCalls.length > 0,
                calledBy: Array.from(
                  new Set(
                    confirmedCalls
                      .map((call) => getCallAssignee(call, 'direct')?.name)
                      .filter(Boolean),
                  ),
                ),
                callCount: confirmedCalls.length,
              }
            })
          }
          const makeRow = (date: string, outsideBusinessHours: boolean, rowTasks: HubSpotTask[]) => {
            const numbers = buildConfirmationNumbers(rowTasks)
            const notCalled = numbers.filter((number) => !number.called).length

            return {
              reportDate: date,
              outsideBusinessHours,
              totalNumbers: numbers.length,
              notCalled,
              notCalledPercent: numbers.length
                ? Math.round((notCalled / numbers.length) * 10000) / 100
                : 0,
              numbers,
            }
          }
          // Saturday tasks are carried into the following day's report, but they
          // must still appear on Saturday itself when they were created before
          // the 7 PM business-hours cutoff.
          const previousOutsideHoursTasks = previousTasks.filter(isOutsideBusinessHoursTask)
          const currentBusinessHoursTasks = tasks.filter((task) => !isAtOrAfterBusinessHoursEnd(task))
          const rows = [
            ...(previousOutsideHoursTasks.length
              ? [makeRow(previousReportDate, true, previousOutsideHoursTasks)]
              : []),
            makeRow(reportDate, false, currentBusinessHoursTasks),
          ]
          const currentRow = rows.at(-1)!

          sendJson(response, 200, {
            reportDate,
            timezone: 'America/New_York',
            totalNumbers: currentRow.totalNumbers,
            notCalled: currentRow.notCalled,
            notCalledPercent: currentRow.notCalledPercent,
            numbers: currentRow.numbers,
            rows,
          })
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : 'Unable to build call confirmation.',
          })
        }
      })
    },
  }
}

type DailyCsHubSpotMetrics = {
  injections: number
  nad: number
  plan: number
  peptides: number
  sales: number
  refunds: number
  balance: number
}

function emptyDailyCsHubSpotMetrics(): DailyCsHubSpotMetrics {
  return { injections: 0, nad: 0, plan: 0, peptides: 0, sales: 0, refunds: 0, balance: 0 }
}

function classifyDailyCsProduct(name: string) {
  const product = name.toLowerCase()
  if (product.includes('nad+') || /\bnad\b/.test(product)) return 'nad'
  if (product.includes('nutrition')) return 'plan'
  if (
    (product.includes('peptide') && !product.includes('tirzepatide')) ||
    ['bpc-157', 'bpc 157', 'cjc-1295', 'cjc 1295', 'ipamorelin', 'sermorelin', 'tesamorelin'].some((name) => product.includes(name))
  ) return 'peptides'
  if (product.includes('semaglutide') || product.includes('tirzepatide') || product.includes('injection') || product.includes('slim boost')) return 'injections'
  return null
}

function parseDailyCsDealDescription(description: string) {
  const products: Array<{ name: string; quantity: number }> = []
  const itemPattern = /(?:^|,\s*)(\d+(?:\.\d+)?)x\s+(.+?)(?=,\s*\d+(?:\.\d+)?x\s+|$)/gi
  for (const match of description.matchAll(itemPattern)) {
    const quantity = Number(match[1])
    const name = match[2]?.trim()
    if (name && Number.isFinite(quantity)) products.push({ name, quantity })
  }
  return products
}

async function fetchDailyCsHubSpot(
  fromDate: string,
  toDate: string,
  token: string,
  teamAgents: Array<{ name: string; aliases: string[] }>,
) {
  if (!token) throw new Error('HubSpot reporting is not configured.')
  const fromPaidDate = String(Date.parse(`${fromDate}T00:00:00Z`))
  const toPaidDate = String(Date.parse(`${toDate}T00:00:00Z`))
  const deals = await searchAllHubSpotObjects<HubSpotDeal>('deals', {
    filterGroups: [{ filters: [{
      propertyName: 'paid_date_all_pipelines',
      operator: fromDate === toDate ? 'EQ' : 'BETWEEN',
      value: fromPaidDate,
      ...(fromDate === toDate ? {} : { highValue: toPaidDate }),
    }] }],
    properties: ['dealname', 'amount', 'value_refund', 'hubspot_owner_id', 'deal_description_items__test'],
  }, token)
  const owners = await fetchHubSpotOwners(token)
  const ownerNames = new Map(owners.map((owner) => [
    owner.id,
    `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim(),
  ]))

  const dealToLineItems = new Map<string, string[]>()
  for (let index = 0; index < deals.length; index += 100) {
    const dealBatch = deals.slice(index, index + 100)
    const associations = await hubSpotPost<{ results?: Array<{ from: { id: string }; to: Array<{ toObjectId: string }> }> }>(
      '/crm/v4/associations/deals/line_items/batch/read',
      { inputs: dealBatch.map((deal) => ({ id: deal.id })) },
      token,
    )
    for (const row of associations.results ?? []) {
      dealToLineItems.set(row.from.id, row.to.map((item) => item.toObjectId))
    }
  }

  const lineItemIds = Array.from(new Set(Array.from(dealToLineItems.values()).flat()))
  const lineItemsById = new Map<string, HubSpotLineItem>()
  for (let index = 0; index < lineItemIds.length; index += 100) {
    const itemBatch = lineItemIds.slice(index, index + 100)
    const payload = await hubSpotPost<{ results?: HubSpotLineItem[] }>(
      '/crm/v3/objects/line_items/batch/read',
      { inputs: itemBatch.map((id) => ({ id })), properties: ['name', 'quantity'] },
      token,
    )
    for (const item of payload.results ?? []) lineItemsById.set(item.id, item)
  }

  const metrics = new Map<string, DailyCsHubSpotMetrics>()
  for (const deal of deals) {
    const ownerName = ownerNames.get(deal.properties.hubspot_owner_id ?? '')
    if (!ownerName) continue
    const matchingAgent = teamAgents.find((agent) =>
      agent.aliases.some((alias) => namesMatch(ownerName, alias)),
    )
    if (!matchingAgent) continue
    const key = matchingAgent.name.toLowerCase()
    const row = metrics.get(key) ?? emptyDailyCsHubSpotMetrics()
    row.sales += finiteNumber(deal.properties.amount)
    row.refunds += finiteNumber(deal.properties.value_refund)
    const descriptionProducts = parseDailyCsDealDescription(
      deal.properties.deal_description_items__test ?? '',
    )
    if (descriptionProducts.length) {
      for (const item of descriptionProducts) {
        const category = classifyDailyCsProduct(item.name)
        if (category) row[category] += item.quantity
      }
    } else {
      // Older deals may not have the Transactions table's aggregate field.
      // Associated line items remain a fallback, but are never added on top of
      // the aggregate description because that would count the same item twice.
      for (const itemId of dealToLineItems.get(deal.id) ?? []) {
        const item = lineItemsById.get(itemId)
        const category = classifyDailyCsProduct(item?.properties.name ?? '')
        if (category) row[category] += finiteNumber(item?.properties.quantity, 1)
      }
    }
    row.sales = roundMoney(row.sales)
    row.refunds = roundMoney(row.refunds)
    row.balance = roundMoney(row.sales - row.refunds)
    metrics.set(key, row)
  }
  return metrics
}

function financeReportApi(
  hubSpotToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Plugin {
  return {
    name: 'hubspot-finance-report-api',
    configureServer(server) {
      server.middlewares.use('/api/finance-report', async (request, response) => {
        try {
          if (!hubSpotToken) throw new Error('HubSpot reporting is not configured.')
          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          const reportDate = requestUrl.searchParams.get('date') || getTodayInNewYork()
          if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
            sendJson(response, 400, { message: 'Date must use YYYY-MM-DD.' })
            return
          }

          const paidDate = String(new Date(`${reportDate}T00:00:00Z`).getTime())
          const [deals, savedAdSpend] = await Promise.all([
            searchAllHubSpotObjects<HubSpotDeal>('deals', {
            // Match the HubSpot Finance dashboard's business-date filter. Deals
            // can enter the PAID stage on a later calendar day, so stage-entry
            // timestamps do not reliably identify the date of the sale.
            filterGroups: [
              { filters: [
                { propertyName: 'paid_date_all_pipelines', operator: 'EQ', value: paidDate },
              ] },
            ],
            properties: ['dealname', 'amount', 'net_revenue', 'value_refund'],
            }, hubSpotToken),
            fetchSavedAdSpend(reportDate, supabaseUrl, supabaseServiceRoleKey),
          ])

          const dealIds = deals.map((deal) => deal.id)
          const associations = dealIds.length
            ? await hubSpotPost<{ results?: Array<{ from: { id: string }; to: Array<{ toObjectId: string }> }> }>(
                '/crm/v4/associations/deals/line_items/batch/read',
                { inputs: dealIds.map((id) => ({ id })) },
                hubSpotToken,
              )
            : { results: [] }
          const lineItemIds = Array.from(new Set(
            (associations.results ?? []).flatMap((row) => row.to.map((item) => item.toObjectId)),
          ))
          const lineItems = lineItemIds.length
            ? await hubSpotPost<{ results?: HubSpotLineItem[] }>(
                '/crm/v3/objects/line_items/batch/read',
                {
                  inputs: lineItemIds.map((id) => ({ id })),
                  properties: ['name', 'quantity', 'price', 'amount', 'hs_cost_of_goods_sold'],
                },
                hubSpotToken,
              )
            : { results: [] }

          const productRows = new Map<string, { category: string; product: string; quantity: number; revenue: number; cogs: number }>()
          for (const item of lineItems.results ?? []) {
            const sourceProduct = item.properties.name?.trim() || 'Other'
            const { category, product } = normalizeFinanceProduct(sourceProduct)
            const quantity = finiteNumber(item.properties.quantity, 1)
            const revenue = finiteNumber(item.properties.amount, finiteNumber(item.properties.price) * quantity)
            const cogs = finiteNumber(item.properties.hs_cost_of_goods_sold) * quantity
            const key = product.toLowerCase()
            const current = productRows.get(key) ?? {
              category, product, quantity: 0, revenue: 0, cogs: 0,
            }
            current.quantity += quantity
            current.revenue += revenue
            current.cogs += cogs
            productRows.set(key, current)
          }

          // Match the HubSpot Finance dashboard's (SUM) Amount card. Deal-level
          // Amount is authoritative because it also includes charges such as tax
          // or fees that do not always have their own line item. Net Revenue is
          // not used here: a value of zero previously removed otherwise-paid
          // deals and caused the report total to differ from HubSpot.
          const allocatedRevenue = roundMoney(Array.from(productRows.values()).reduce((sum, row) => sum + row.revenue, 0))
          const totalRevenue = roundMoney(deals.reduce(
            (sum, deal) => sum + finiteNumber(deal.properties.amount), 0,
          ))
          const reconciliationDifference = roundMoney(totalRevenue - allocatedRevenue)
          if (Math.abs(reconciliationDifference) > 0.005) {
            productRows.set('__reconciliation__', {
              category: 'Others', product: 'Taxes / Fees / Unallocated Revenue', quantity: 0,
              revenue: reconciliationDifference, cogs: 0,
            })
          }
          const lineItemCogs = Array.from(productRows.values()).reduce((sum, row) => sum + row.cogs, 0)
          const cogs = roundMoney(lineItemCogs || totalRevenue * 0.32)

          sendJson(response, 200, {
            reportDate,
            timezone: 'America/New_York',
            fetchedAt: new Date().toISOString(),
            dealCount: deals.length,
            rows: Array.from(productRows.values()).sort((a, b) => b.revenue - a.revenue),
            totalRevenue,
            allocatedRevenue,
            reconciliationDifference,
            cogs,
            adsCostMeta: savedAdSpend.meta,
            adsCostTiktok: savedAdSpend.tiktok,
            revenueLoss: { cancelled: 0, dispute: 0, refund: deals.reduce((sum, deal) => sum + finiteNumber(deal.properties.value_refund), 0) },
          })
        } catch (error) {
          sendJson(response, 500, { message: error instanceof Error ? error.message : 'Unable to build finance report.' })
        }
      })
    },
  }
}

async function fetchSavedAdSpend(
  reportDate: string,
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Saved ad-spend reporting is not configured.')
  const response = await supabaseRest(
    supabaseUrl,
    serviceRoleKey,
    `meta_budget_reports?select=meta_total_spending,tiktok_total_spending&report_date=eq.${encodeURIComponent(reportDate)}&limit=1`,
  )
  const rows = await response.json() as Array<{
    meta_total_spending?: number | null
    tiktok_total_spending?: number | null
  }>
  return {
    meta: rows[0]?.meta_total_spending ?? 0,
    tiktok: rows[0]?.tiktok_total_spending ?? 0,
  }
}

function agentReportApi(
  apiId: string,
  apiToken: string,
  respondIoToken: string,
  respondIoAnalyticsToken: string,
  hubSpotToken: string,
  supabaseUrl: string,
  supabaseServiceRoleKey: string,
): Plugin {
  return {
    name: 'aircall-agent-report-api',
    configureServer(server) {
      server.middlewares.use('/api/daily-cs-report', async (request, response) => {
        try {
          if (!apiId || !apiToken) {
            sendJson(response, 500, { message: 'Missing Aircall credentials.' })
            return
          }

          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          const team = requestUrl.searchParams.get('team') === 'sales' ? 'sales' : 'cs'
          const teamAgents = team === 'sales' ? DAILY_SALES_AGENTS : DAILY_CS_AGENTS
          const fromDate = requestUrl.searchParams.get('from') || getTodayInNewYork()
          const toDate = requestUrl.searchParams.get('to') || fromDate
          if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
            sendJson(response, 400, { message: 'Dates must use YYYY-MM-DD.' })
            return
          }
          if (fromDate > toDate) {
            sendJson(response, 400, { message: 'The start date must be before the end date.' })
            return
          }
          const rangeDays = Math.floor((Date.parse(`${toDate}T12:00:00Z`) - Date.parse(`${fromDate}T12:00:00Z`)) / 86400000) + 1
          if (rangeDays > 31) {
            sendJson(response, 400, { message: 'Choose a date range of 31 days or fewer.' })
            return
          }

          const startRange = getNewYorkUnixDayRange(fromDate)
          const endRange = getNewYorkUnixDayRange(toDate)
          let hubSpotError: string | null = null
          const [calls, users, hubSpotRows] = await Promise.all([
            fetchAircallCalls({ apiId, apiToken, from: startRange.from, to: endRange.to, phoneNumber: '', direction: 'outbound' }),
            fetchAircallUsers(apiId, apiToken),
            fetchDailyCsHubSpot(fromDate, toDate, hubSpotToken, teamAgents).catch((error: unknown) => {
              hubSpotError = error instanceof Error ? error.message : 'Unable to load HubSpot sales.'
              return new Map<string, DailyCsHubSpotMetrics>()
            }),
          ])

          const agents = teamAgents.map(({ name, aliases }) => {
            const matchingUserIds = new Set(users
              .filter((user) => user.id && user.name && aliases.some((alias) => namesMatch(user.name!, alias)))
              .map((user) => user.id!))
            const agentCalls = calls.filter((call) =>
              Boolean((call.user?.id && matchingUserIds.has(call.user.id)) ||
                (call.user?.name && aliases.some((alias) => namesMatch(call.user!.name!, alias)))),
            )
            const validCalls = agentCalls.filter((call) =>
              call.answered_at !== null && Math.max(0, call.ended_at - call.answered_at) > 60,
            )
            const validSeconds = validCalls.reduce((sum, call) => sum + Math.max(0, call.ended_at - call.answered_at!), 0)
            const totalTalkSeconds = agentCalls.reduce((sum, call) =>
              sum + (call.answered_at === null ? 0 : Math.max(0, call.ended_at - call.answered_at)), 0)
            const uniqueNumbers = new Set(agentCalls.map((call) => call.raw_digits).filter(Boolean))

            const hubSpot = hubSpotRows.get(name.toLowerCase()) ?? emptyDailyCsHubSpotMetrics()
            return {
              name,
              numbersCalled: uniqueNumbers.size,
              totalIntents: agentCalls.length,
              validCalls: validCalls.length,
              averageCallSeconds: validCalls.length ? Math.round(validSeconds / validCalls.length) : 0,
              totalTalkSeconds,
              ...hubSpot,
            }
          })

          sendJson(response, 200, {
            fromDate, toDate, team, timezone: 'America/New_York', agents,
            hubSpotAvailable: hubSpotError === null,
            hubSpotError,
          })
        } catch (error) {
          sendJson(response, 500, { message: error instanceof Error ? error.message : 'Unable to build the CS daily report.' })
        }
      })

      server.middlewares.use('/api/agent-report', async (request, response) => {
        try {
          const requestUrl = new URL(request.url ?? '', 'http://localhost')
          if (requestUrl.searchParams.get('action') === 'respond-login') {
            const host = request.headers.host?.split(':')[0] ?? ''
            if (!['localhost', '127.0.0.1'].includes(host)) {
              sendJson(response, 400, {
                message:
                  'respond.io login can only open from the local or desktop dashboard. Run the dashboard locally to refresh its Playwright session.',
              })
              return
            }
            const loginProcess = spawnNodeScript(['respond-login.mjs', '--auto'], {
              cwd: getAppRoot(),
              detached: true,
              stdio: 'ignore',
              windowsHide: false,
            })
            loginProcess.unref()
            sendJson(response, 202, {
              message:
                'respond.io login opened. Sign in and leave the browser on Reports > Conversations; it will close after saving the session.',
            })
            return
          }

          const reportDate = requestUrl.searchParams.get('date') || getTodayInNewYork()
          const mode = requestUrl.searchParams.get('mode') === 'live' ? 'live' : 'saved'
          if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
            sendJson(response, 400, { message: 'Date must use YYYY-MM-DD.' })
            return
          }

          if (!supabaseUrl || !supabaseServiceRoleKey) {
            sendJson(response, 500, { message: 'Agent report storage is not configured.' })
            return
          }

          if (mode === 'saved') {
            const savedResponse = await supabaseRest(
              supabaseUrl,
              supabaseServiceRoleKey,
              `agent_reports?report_date=eq.${encodeURIComponent(reportDate)}&select=report_data`,
            )
            const savedRows = (await savedResponse.json()) as Array<{ report_data: unknown }>
            if (!savedRows.length) {
              sendJson(response, 404, {
                message: 'No saved report exists for this date. Use Fetch Live to create it.',
              })
              return
            }
            sendJson(response, 200, savedRows[0].report_data)
            return
          }

          if (!apiId || !apiToken) {
            sendJson(response, 500, { message: 'Missing Aircall credentials.' })
            return
          }

          const { from, to } = getNewYorkUnixDayRange(reportDate)
          const [calls, users, hubSpotBookings, botBookings] = await Promise.all([
            fetchAircallCalls({ apiId, apiToken, from, to, phoneNumber: '', direction: null }),
            fetchAircallUsers(apiId, apiToken),
            fetchHubSpotStaffBookings(reportDate, hubSpotToken).catch(() => null),
            fetchHubSpotBotBookings(reportDate, hubSpotToken).catch(() => null),
          ])
          const agents = AGENT_REPORT_AGENTS.map(({ name, aliases }) => {
            const matchingUsers = users.filter(
              (candidate) =>
                candidate.name && aliases.some((alias) => namesMatch(candidate.name!, alias)),
            )
            const matchingUserIds = new Set(
              matchingUsers.map((candidate) => candidate.id).filter(Boolean),
            )
            const agentCalls = calls.filter((call) => {
              if (call.user?.id && matchingUserIds.has(call.user.id)) return true
              return Boolean(
                call.user?.name && aliases.some((alias) => namesMatch(call.user!.name!, alias)),
              )
            })
            const inbound = agentCalls.filter((call) => call.direction === 'inbound').length
            const outbound = agentCalls.filter((call) => call.direction === 'outbound').length
            const callLengthSeconds = agentCalls.reduce((total, call) => {
              if (!call.answered_at) return total
              return total + Math.max(0, call.ended_at - call.answered_at)
            }, 0)

            return {
              id: matchingUsers[0]?.id ?? null,
              name,
              callLengthSeconds,
              inbound,
              outbound,
              totalCalls: inbound + outbound,
            }
          })
          let respondIoError: string | null = null
          const respondMessages = await fetchRespondStaffMessages(
            reportDate,
            respondIoToken,
            respondIoAnalyticsToken,
          ).catch((error: unknown) => {
            respondIoError =
              error instanceof Error ? error.message : 'Unknown respond.io reporting error.'
            return null
          })
          const staff = STAFF_PERFORMANCE_REPORT.map(({ name, respondAliases, hasCalls }) => {
            const agent = agents.find((candidate) => namesMatch(candidate.name, name))
            const matchingAircallConfig = AGENT_REPORT_AGENTS.find((candidate) =>
              namesMatch(candidate.name, name),
            )
            const matchingUserIds = new Set(
              users
                .filter(
                  (user) =>
                    user.id &&
                    matchingAircallConfig?.aliases.some(
                      (alias) => user.name && namesMatch(user.name, alias),
                    ),
                )
                .map((user) => user.id!),
            )
            const matchingCalls = calls.filter(
              (call) => call.user?.id && matchingUserIds.has(call.user.id),
            )
            const connectedOver30Seconds = matchingCalls.filter(
              (call) =>
                call.direction === 'outbound' &&
                call.answered_at !== null &&
                call.ended_at - call.answered_at > 30,
            ).length
            const hubSpotAliases =
              STAFF_PERFORMANCE_REPORT.find((candidate) => candidate.name === name)
                ?.hubSpotAliases ?? [name]
            const bookingsByMessages = hubSpotBookings === null
              ? null
              : hubSpotAliases.reduce(
                  (sum, alias) => sum + (hubSpotBookings.get(`${alias.toLowerCase()}|message`) ?? 0),
                  0,
                )
            const bookingsByCall = hubSpotBookings === null
              ? null
              : hubSpotAliases.reduce(
                  (sum, alias) => sum + (hubSpotBookings.get(`${alias.toLowerCase()}|call`) ?? 0),
                  0,
                )

            return {
              name,
              messages: respondMessages
                ? respondAliases.reduce(
                    (count, alias) => count + (respondMessages.get(alias.toLowerCase()) ?? 0),
                    0,
                  )
                : null,
              calls: hasCalls ? (agent?.outbound ?? 0) : null,
              connectedOver30Seconds: hasCalls ? connectedOver30Seconds : null,
              bookingsByMessages,
              bookingsByCall,
              totalBookings:
                bookingsByMessages === null || bookingsByCall === null
                  ? null
                  : bookingsByMessages + bookingsByCall,
            }
          })

          const reportData = {
            reportDate,
            timezone: 'America/New_York',
            botPerformance: {
              totalBookings: botBookings,
            },
            agents,
            totals: {
              callLengthSeconds: agents.reduce((sum, agent) => sum + agent.callLengthSeconds, 0),
              inbound: agents.reduce((sum, agent) => sum + agent.inbound, 0),
              outbound: agents.reduce((sum, agent) => sum + agent.outbound, 0),
              totalCalls: agents.reduce((sum, agent) => sum + agent.totalCalls, 0),
            },
            staff,
            staffTotals: {
              messages: staff.reduce((sum, row) => sum + (row.messages ?? 0), 0),
              calls: staff.reduce((sum, row) => sum + (row.calls ?? 0), 0),
              connectedOver30Seconds: staff.reduce(
                (sum, row) => sum + (row.connectedOver30Seconds ?? 0),
                0,
              ),
              bookingsByMessages:
                hubSpotBookings === null
                  ? null
                  : staff.reduce((sum, row) => sum + (row.bookingsByMessages ?? 0), 0),
              bookingsByCall:
                hubSpotBookings === null
                  ? null
                  : staff.reduce((sum, row) => sum + (row.bookingsByCall ?? 0), 0),
              totalBookings:
                hubSpotBookings === null
                  ? null
                  : staff.reduce((sum, row) => sum + (row.totalBookings ?? 0), 0),
            },
            respondIoAvailable: respondMessages !== null,
            respondIoError,
          }
          await supabaseRest(
            supabaseUrl,
            supabaseServiceRoleKey,
            'agent_reports?on_conflict=report_date',
            {
              method: 'POST',
              headers: { Prefer: 'resolution=merge-duplicates' },
              body: JSON.stringify({
                report_date: reportDate,
                timezone: reportData.timezone,
                report_data: reportData,
                fetched_at: new Date().toISOString(),
              }),
            },
          )
          sendJson(response, 200, reportData)
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : 'Unable to build agent report.',
          })
        }
      })
    },
  }
}

async function fetchRespondStaffMessages(
  reportDate: string,
  apiToken: string,
  analyticsToken: string,
) {
  if (!apiToken) throw new Error('respond.io reporting is not configured.')
  const userPayload = await respondIoGet<{ items?: RespondIoUser[] }>('space/user', apiToken, {
    limit: '100',
  })
  const usersById = new Map(
    (userPayload.items ?? []).map((user) => [
      user.id,
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    ]),
  )
  if (!analyticsToken) {
    return runRespondIoSessionMessageReport(reportDate, usersById)
  }
  try {
    const performance = await respondIoAnalyticsPost<RespondIoUserPerformanceResponse>(
      'user/performance',
      {
        date: getNewYorkDateRange(reportDate),
        pagination: {
          page: 1,
          itemsPerPage: 100,
          sortBy: ['closedCount'],
          sortDesc: [true],
        },
      },
      analyticsToken,
    )
    const messages = new Map<string, number>()
    for (const row of performance.data?.data ?? []) {
      const name = usersById.get(row.userId)
      if (name) messages.set(name.toLowerCase(), row.outgoingMessageCount ?? 0)
    }
    return messages
  } catch {
    return runRespondIoSessionMessageReport(reportDate, usersById)
  }
}

async function runRespondIoSessionMessageReport(
  reportDate: string,
  usersById: Map<number, string>,
) {
  const reportNames = new Set(
    STAFF_PERFORMANCE_REPORT.flatMap(({ respondAliases }) =>
      respondAliases.map((alias) => alias.toLowerCase()),
    ),
  )
  const reportUsers = [...usersById].filter(([, name]) => reportNames.has(name.toLowerCase()))
  const { stdout } = await execNodeScript(
    [
      'respond-message-report.mjs',
      `--date=${reportDate}`,
      `--user-ids=${JSON.stringify(reportUsers.map(([id]) => id))}`,
    ],
    { cwd: getAppRoot(), timeout: 120_000, maxBuffer: 1024 * 1024 },
  )
  const payload = JSON.parse(String(stdout)) as { counts?: Record<string, number> }
  return new Map(
    reportUsers.map(([id, name]) => [name.toLowerCase(), payload.counts?.[String(id)] ?? 0]),
  )
}

function getNodeScriptEnv() {
  return process.versions.electron
    ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    : process.env
}

function getAppRoot() {
  return process.env.DHARMA_APP_ROOT || process.cwd()
}

function resolveScriptArg(scriptName: string) {
  return resolve(getAppRoot(), 'scripts', scriptName)
}

function spawnNodeScript(
  args: string[],
  options: Parameters<typeof spawn>[2],
) {
  const [scriptName, ...scriptArgs] = args

  return spawn(process.execPath, [resolveScriptArg(scriptName), ...scriptArgs], {
    ...options,
    env: getNodeScriptEnv(),
  })
}

function execNodeScript(
  args: string[],
  options: Parameters<typeof execFile>[2],
) {
  const [scriptName, ...scriptArgs] = args

  return execFileAsync(process.execPath, [resolveScriptArg(scriptName), ...scriptArgs], {
    ...options,
    env: getNodeScriptEnv(),
  })
}

function parseRespondReportError(stderr: string) {
  try {
    const payload = JSON.parse(stderr)
    return payload.message ?? stderr
  } catch {
    return stderr || 'Unable to run saved-session respond.io report.'
  }
}

function respondIoSampleApi(token: string): Plugin {
  return {
    name: 'respond-io-sample-api',
    configureServer(server) {
      server.middlewares.use('/api/respondio-contact-sample', async (_request, response) => {
        try {
          if (!token) {
            sendJson(response, 500, {
              message: 'Missing RESPOND_IO_ACCESS_TOKEN in .env.local.',
            })
            return
          }

          const payload = await respondIoPost<RespondIoListResponse>(
            'contact/list',
            {
              search: '',
              timezone: 'UTC',
              filter: { $and: [] },
            },
            token,
            { limit: '1' },
          )
          const contacts = payload.items ?? []
          const firstContact = contacts[0]

          sendJson(response, 200, {
            fetchedAt: new Date().toISOString(),
            endpoint: 'POST /v2/contact/list?limit=1',
            returnedItems: contacts.length,
            hasPagination: Boolean(payload.pagination),
            firstContactId: typeof firstContact?.id === 'number' ? firstContact.id : null,
            firstContactFields: firstContact ? Object.keys(firstContact) : [],
          })
        } catch (error) {
          sendJson(response, 500, {
            message: error instanceof Error ? error.message : 'Unable to fetch respond.io data.',
          })
        }
      })
    },
  }
}

async function graphGet<T>(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const response = await fetch(url)
  const payload = (await response.json()) as { error?: { message?: string } }

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Facebook API failed with ${response.status}.`)
  }

  return payload as T
}

async function fetchAircallCalls({
  apiId,
  apiToken,
  from,
  to,
  phoneNumber,
  direction = 'inbound',
  userId,
}: {
  apiId: string
  apiToken: string
  from: number
  to: number
  phoneNumber: string
  direction?: 'inbound' | 'outbound' | null
  userId?: number
}) {
  const url = new URL('https://api.aircall.io/v1/calls/search')
  url.searchParams.set('from', String(from))
  url.searchParams.set('to', String(to))
  url.searchParams.set('per_page', '100')
  url.searchParams.set('fetch_call_timeline', 'true')

  if (direction) {
    url.searchParams.set('direction', direction)
  }

  if (phoneNumber) {
    url.searchParams.set('phone_number', phoneNumber)
  }

  if (userId) {
    url.searchParams.set('user_id', String(userId))
  }

  const calls: AircallCall[] = []
  let nextUrl: string | null = url.toString()

  while (nextUrl) {
    const requestUrl: string = nextUrl
    const payload: AircallCallsResponse = await aircallGet(requestUrl, apiId, apiToken)
    calls.push(...(payload.calls ?? []))
    nextUrl = payload.meta?.next_page_link ?? null
  }

  return calls
}

async function fetchAircallUsers(apiId: string, apiToken: string) {
  const users: AircallUser[] = []
  let nextUrl: string | null = 'https://api.aircall.io/v1/users?per_page=100'

  while (nextUrl) {
    const payload: { users?: AircallUser[]; meta?: { next_page_link?: string | null } } =
      await aircallGet(nextUrl, apiId, apiToken)
    users.push(...(payload.users ?? []))
    nextUrl = payload.meta?.next_page_link ?? null
  }

  return users
}

async function fetchAircallCallDetail(callId: number, apiId: string, apiToken: string) {
  const url = new URL(`https://api.aircall.io/v1/calls/${callId}`)
  url.searchParams.set('fetch_contact', 'true')
  url.searchParams.set('fetch_short_urls', 'true')
  url.searchParams.set('fetch_call_timeline', 'true')
  const payload = await aircallGet<{ call?: AircallCall }>(url.toString(), apiId, apiToken)

  return payload.call ?? null
}

async function fetchHubSpotMissedCallTasks(reportDate: string, token: string) {
  const { from, to } = getNewYorkUnixDayRange(reportDate)
  const tasks: HubSpotTask[] = []
  let after: string | undefined

  do {
    const response = await hubSpotPost<HubSpotTaskSearchResponse>(
      '/crm/v3/objects/tasks/search',
      {
        filterGroups: [
          {
            filters: [
              { propertyName: 'hs_createdate', operator: 'GTE', value: new Date(from * 1000).toISOString() },
              { propertyName: 'hs_createdate', operator: 'LTE', value: new Date(to * 1000).toISOString() },
            ],
          },
        ],
        properties: [
          'hs_createdate',
          'hs_task_contact_phone',
          'hs_task_status',
          'hs_task_subject',
          'hubspot_owner_id',
        ],
        limit: 200,
        ...(after ? { after } : {}),
      },
      token,
    )
    tasks.push(...(response.results ?? []))
    after = response.paging?.next?.after
  } while (after)

  return tasks.filter(
    (task) => task.properties.hs_task_subject?.trim().toLowerCase() === 'missed calls',
  )
}

async function fetchHubSpotStaffBookings(reportDate: string, token: string) {
  if (!token) throw new Error('HubSpot reporting is not configured.')
  const { from, to } = getNewYorkUnixDayRange(reportDate)
  const bookings = new Map<string, number>()
  const meetingIds: string[] = []
  let after: string | undefined

  do {
    const response = await hubSpotPost<{
      results?: Array<{ id: string }>
      paging?: { next?: { after?: string } }
    }>(
      '/crm/v3/objects/meetings/search',
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'hs_createdate',
                operator: 'GTE',
                value: String(from * 1000),
              },
              {
                propertyName: 'hs_createdate',
                operator: 'LTE',
                value: String(to * 1000),
              },
            ],
          },
        ],
        properties: ['hs_createdate'],
        limit: 200,
        ...(after ? { after } : {}),
      },
      token,
    )
    meetingIds.push(...(response.results ?? []).map((meeting) => meeting.id))
    after = response.paging?.next?.after
  } while (after)

  const meetingToContact = new Map<string, string>()
  for (let index = 0; index < meetingIds.length; index += 100) {
    const ids = meetingIds.slice(index, index + 100)
    const associations = await hubSpotPost<{
      results?: Array<{
        from: { id: string }
        to: Array<{ toObjectId: number }>
      }>
    }>('/crm/v4/associations/meetings/contacts/batch/read', {
      inputs: ids.map((id) => ({ id })),
    }, token)

    for (const association of associations.results ?? []) {
      const contactId = association.to[0]?.toObjectId
      if (contactId) meetingToContact.set(String(association.from.id), String(contactId))
    }
  }

  const contactIds = [...new Set(meetingToContact.values())]
  const contacts = new Map<string, { agent?: string | null; channel?: string | null }>()
  for (let index = 0; index < contactIds.length; index += 100) {
    const ids = contactIds.slice(index, index + 100)
    const batch = await hubSpotPost<{
      results?: Array<{
        id: string
        properties: {
          agent_lead_management?: string | null
          chanel?: string | null
        }
      }>
    }>('/crm/v3/objects/contacts/batch/read', {
      properties: ['agent_lead_management', 'chanel'],
      inputs: ids.map((id) => ({ id })),
    }, token)

    for (const contact of batch.results ?? []) {
      contacts.set(String(contact.id), {
        agent: contact.properties.agent_lead_management,
        channel: contact.properties.chanel,
      })
    }
  }

  for (const meetingId of meetingIds) {
    const contactId = meetingToContact.get(meetingId)
    const contact = contactId ? contacts.get(contactId) : undefined
    const staffName = contact?.agent?.trim().toLowerCase()
    const channel = contact?.channel?.trim().toLowerCase()
    if (!staffName || (channel !== 'call' && channel !== 'message')) continue
    const key = `${staffName}|${channel}`
    bookings.set(key, (bookings.get(key) ?? 0) + 1)
  }

  return bookings
}

async function fetchHubSpotBotBookings(reportDate: string, token: string) {
  if (!token) throw new Error('HubSpot reporting is not configured.')
  const { from, to } = getNewYorkUnixDayRange(reportDate)
  let totalBookings = 0
  let after: string | undefined

  do {
    const response = await hubSpotPost<HubSpotSearchResponse<HubSpotDeal>>(
      '/crm/v3/objects/deals/search',
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'hs_createdate',
                operator: 'GTE',
                value: String(from * 1000),
              },
              {
                propertyName: 'hs_createdate',
                operator: 'LTE',
                value: String(to * 1000),
              },
              {
                propertyName: 'created_by_ai_bot',
                operator: 'EQ',
                value: 'true',
              },
            ],
          },
        ],
        properties: ['hs_createdate'],
        limit: 200,
        ...(after ? { after } : {}),
      },
      token,
    )
    totalBookings += (response.results ?? []).length
    after = response.paging?.next?.after
  } while (after)

  return totalBookings
}

async function fetchHubSpotOwners(token: string) {
  const owners: HubSpotOwner[] = []
  let after = ''

  do {
    const url = new URL('https://api.hubapi.com/crm/v3/owners')
    url.searchParams.set('limit', '100')
    url.searchParams.set('archived', 'false')
    if (after) url.searchParams.set('after', after)
    const payload = await hubSpotGet<{
      results?: HubSpotOwner[]
      paging?: { next?: { after?: string } }
    }>(url.toString(), token)
    owners.push(...(payload.results ?? []))
    after = payload.paging?.next?.after ?? ''
  } while (after)

  return owners
}

async function hubSpotGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string }

  if (!response.ok) {
    throw new Error(payload.message ?? `HubSpot API failed with ${response.status}.`)
  }

  return payload
}

async function hubSpotPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(`https://api.hubapi.com${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string }

  if (!response.ok) {
    throw new Error(payload.message ?? `HubSpot API failed with ${response.status}.`)
  }

  return payload
}

async function searchAllHubSpotObjects<T>(
  objectType: string,
  query: Record<string, unknown>,
  token: string,
) {
  const results: T[] = []
  let after: string | undefined
  do {
    const payload = await hubSpotPost<HubSpotSearchResponse<T>>(
      `/crm/v3/objects/${objectType}/search`,
      { ...query, limit: 100, ...(after ? { after } : {}) },
      token,
    )
    results.push(...(payload.results ?? []))
    after = payload.paging?.next?.after
  } while (after)
  return results
}

function finiteNumber(value: string | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function normalizeFinanceProduct(product: string) {
  const name = product.toLowerCase()
  // Subscription products often also contain a medication name. Classify the
  // commercial product type first so they do not inflate medication quantity.
  if (name.includes('subscription') || name.includes('membership')) {
    return { category: 'Subscription', product }
  }
  if (name.includes('lipo mino')) return { category: 'Medication/Treatment', product: 'Lipo Mino' }
  if (name.includes('metformin')) return { category: 'Medication/Treatment', product: 'Metformin' }
  if (name.includes('nad+')) return { category: 'Medication/Treatment', product: 'NAD+' }
  if (name.includes('nutrition consultation')) return { category: 'Medication/Treatment', product: 'Nutritional Consultation' }
  if (name.includes('semaglutide')) return { category: 'Medication/Treatment', product: 'Semaglutide' }
  if (name.includes('tirzepatide')) return { category: 'Medication/Treatment', product: 'Tirzepatide' }

  // Finance's approved medication list is intentionally closed. Everything
  // not matched above belongs in Supplements, including newly-created names.
  return { category: 'Supplements', product }
}

function normalizePhoneNumber(value?: string | null) {
  return value?.replace(/\D/g, '') ?? ''
}

function phoneNumbersMatch(left: string, right: string) {
  if (!left || !right) return false

  const comparisonLength = Math.min(10, left.length, right.length)
  return comparisonLength >= 7 && left.slice(-comparisonLength) === right.slice(-comparisonLength)
}

function namesMatch(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

function isOutsideBusinessHoursTask(task: HubSpotTask) {
  const createdAt = task.properties.hs_createdate
  if (!createdAt) return false

  const newYorkParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(createdAt))
  const weekday = newYorkParts.find((part) => part.type === 'weekday')?.value
  const hour = Number(newYorkParts.find((part) => part.type === 'hour')?.value)

  return weekday === 'Sat' || hour >= BUSINESS_HOURS_END
}

function isAtOrAfterBusinessHoursEnd(task: HubSpotTask) {
  const createdAt = task.properties.hs_createdate
  if (!createdAt) return false

  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(createdAt))
      .find((part) => part.type === 'hour')?.value,
  )

  return hour >= BUSINESS_HOURS_END
}

function shiftIsoDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function isAgentBusyDuringCall(
  agentName: string,
  missedCallId: number,
  missedCallStartedAt: string,
  missedCallEndedAt: string,
  calls: AircallCall[],
) {
  const missedCallStart = Date.parse(missedCallStartedAt) / 1000
  const missedCallEnd = Date.parse(missedCallEndedAt) / 1000

  return calls.some((call) => {
    if (call.id === missedCallId || !call.user?.name || !namesMatch(call.user.name, agentName)) {
      return false
    }

    // Aircall assigns the user field to the agent making or answering a call.
    // Any overlap means that agent was occupied during this missed call.
    return call.started_at < missedCallEnd && call.ended_at > missedCallStart
  })
}

function getCallAssignee(
  call: AircallCall,
  source: AircallAssignee['source'],
): AircallAssignee | null {
  const user = call.assigned_to ?? call.transferred_to ?? call.user ?? null

  if (!user?.name) {
    return null
  }

  return {
    name: user.name,
    email: user.email ?? null,
    source,
  }
}

function getVerifiedMissedByName(callId: number) {
  // Aircall's public call timeline omits agent ring attempts. Keep dashboard-verified
  // attempts here as a fallback when route timing is unavailable in the API response.
  const verifiedMissedBy: Record<number, string> = {
    3957724828: 'William Carcamo',
    3958681499: 'Kevin Tinjaca',
    3976084348: 'Kevin Tinjaca',
    3979647200: 'Kevin Tinjaca',
    3979664579: 'Kevin Tinjaca',
  }

  return verifiedMissedBy[callId] ?? null
}

async function aircallGet<T>(url: string, apiId: string, apiToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiId}:${apiToken}`).toString('base64')}`,
    },
  })
  const payload = (await response.json().catch(() => ({}))) as AircallCallsResponse

  if (!response.ok) {
    throw new Error(payload.message ?? `Aircall API failed with ${response.status}.`)
  }

  return payload as T
}

function getSupabaseRestUrl(supabaseUrl: string, path: string) {
  const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`
  const restUrl = baseUrl.includes('/rest/v1/') ? baseUrl : `${baseUrl}rest/v1/`
  return new URL(path, restUrl).toString()
}

async function supabaseRest(
  supabaseUrl: string,
  serviceRoleKey: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(getSupabaseRestUrl(supabaseUrl, path), {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(payload.message ?? `Supabase failed with ${response.status}.`)
  }

  return response
}

async function fetchLastRungAgents(
  callIds: number[],
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  const result = new Map<number, string>()
  if (!callIds.length || !supabaseUrl || !serviceRoleKey) return result

  const params = new URLSearchParams({
    select: 'call_id,agent_name,event_timestamp',
    event_type: 'eq.call.ringing_on_agent',
    call_id: `in.(${callIds.join(',')})`,
    order: 'event_timestamp.desc',
  })
  const response = await supabaseRest(
    supabaseUrl,
    serviceRoleKey,
    `aircall_call_events?${params.toString()}`,
  )
  const rows = (await response.json()) as StoredAircallRingEvent[]
  rows.forEach((row) => {
    if (row.agent_name && !result.has(row.call_id)) result.set(row.call_id, row.agent_name)
  })
  return result
}

async function readJsonRequest<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error('Request payload is too large.')
    chunks.push(buffer)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

function isUserDidNotAnswerCall(call: AircallCall) {
  return (
    call.direction === 'inbound' &&
    call.answered_at === null &&
    call.duration > 0 &&
    call.missed_call_reason === 'agents_did_not_answer'
  )
}

async function respondIoPost<T>(
  path: string,
  body: unknown,
  token: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`https://api.respond.io/v2/${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as RespondIoListResponse

  if (!response.ok) {
    throw new Error(payload?.message ?? `respond.io API failed with ${response.status}.`)
  }

  return payload as T
}

async function respondIoGet<T>(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.respond.io/v2/${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const payload = (await response.json()) as RespondIoChannelResponse

  if (!response.ok) {
    throw new Error(payload?.message ?? `respond.io API failed with ${response.status}.`)
  }

  return payload as T
}

async function respondIoAnalyticsPost<T>(path: string, body: unknown, token: string) {
  const response = await fetch(`https://app.respond.io/analytics/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      orgid: RESPOND_IO_ORGANIZATION_ID,
      botid: RESPOND_IO_SPACE_ID,
      timezone: 'America/New_York',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as { message?: string }

  if (!response.ok) {
    throw new Error(payload?.message ?? `respond.io analytics failed with ${response.status}.`)
  }

  return payload as T
}

async function fetchRespondReportGroup({
  token,
  reportDate,
  adPlatform,
  includedChannelIds,
}: {
  token: string
  reportDate: string
  adPlatform: string
  includedChannelIds?: number[]
}) {
  const baseFilters = {
    date: getNewYorkDateRange(reportDate),
    adPlatform: [adPlatform],
    ...(includedChannelIds?.length
      ? { conversationOpenedChannels: includedChannelIds }
      : {}),
  }
  const overview = await respondIoAnalyticsPost<RespondIoAnalyticsResponse>(
    'conversation',
    baseFilters,
    token,
  )
  const openedByContactType = await respondIoAnalyticsPost<RespondIoAnalyticsResponse>(
    'conversation/open-group',
    { ...baseFilters, groupBy: 'contactType' },
    token,
  )

  return {
    totalCount: overview.opened?.count ?? 0,
    newCount: readCountByPossibleKeys(openedByContactType, ['new', 'New Contact', 'new_contact']),
  }
}

function getIncludedMetaChannelIds(channels: RespondIoChannel[], excludedChannelId?: number) {
  return channels
    .map((channel) => channel.id)
    .filter((channelId) => channelId !== excludedChannelId)
}

function readCountByPossibleKeys(payload: RespondIoAnalyticsResponse, keys: string[]) {
  for (const key of keys) {
    const count = readCountAtKey(payload, key)

    if (count !== null) {
      return count
    }
  }

  const values = Array.isArray(payload.values) ? payload.values : Array.isArray(payload) ? payload : []

  for (const row of values) {
    if (!row || typeof row !== 'object') {
      continue
    }

    const item = row as Record<string, unknown>
    const label = String(
      item.key ?? item.label ?? item.name ?? item.type ?? item.contactType ?? '',
    ).toLowerCase()

    if (keys.some((key) => label === key.toLowerCase())) {
      const count = item.count ?? item.value ?? item.total
      return typeof count === 'number' ? count : 0
    }
  }

  return 0
}

function readCountAtKey(payload: RespondIoAnalyticsResponse, key: string) {
  const value = payload[key] ?? payload.values?.[key]

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'object' && value) {
    const count = (value as { count?: unknown; value?: unknown; total?: unknown }).count ??
      (value as { count?: unknown; value?: unknown; total?: unknown }).value ??
      (value as { count?: unknown; value?: unknown; total?: unknown }).total

    return typeof count === 'number' ? count : 0
  }

  return null
}

function getNewYorkDateRange(reportDate: string) {
  return {
    from: `${reportDate} 00:00:00`,
    to: `${reportDate} 23:59:59`,
  }
}

function getYesterdayInNewYork() {
  const newYorkDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const noonUtc = new Date(`${newYorkDate}T12:00:00Z`)
  noonUtc.setUTCDate(noonUtc.getUTCDate() - 1)

  return noonUtc.toISOString().slice(0, 10)
}

function getTodayInNewYork() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getNewYorkUnixDayRange(reportDate: string) {
  const start = zonedTimeToUtc(reportDate, 0, 0, 0, 'America/New_York')
  const end = zonedTimeToUtc(reportDate, 23, 59, 59, 'America/New_York')

  return {
    from: Math.floor(start.getTime() / 1000),
    to: Math.floor(end.getTime() / 1000),
  }
}

function zonedTimeToUtc(
  date: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
) {
  const [year, month, day] = date.split('-').map(Number)
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offset = getTimeZoneOffset(utcGuess, timeZone)
  const firstPass = new Date(utcGuess.getTime() - offset)
  const correctedOffset = getTimeZoneOffset(firstPass, timeZone)

  return new Date(utcGuess.getTime() - correctedOffset)
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  )

  return zonedAsUtc - date.getTime()
}

function formatAircallDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: '2-digit',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000))
}

function centsToDollars(value?: string) {
  return value ? Number(value) / 100 : null
}

function decimalStringToNumber(value?: string) {
  return value ? Number(value) : null
}

function isSmgCampaign(campaignName: string) {
  const normalizedName = normalizeCampaignName(campaignName)
  return SMG_CAMPAIGN_PATTERNS.some((pattern) =>
    normalizedName.includes(normalizeCampaignName(pattern)),
  )
}

function isJobCampaign(campaignName: string) {
  return /\bjob\b/i.test(campaignName)
}

function normalizeCampaignName(campaignName: string) {
  return campaignName.trim().toLowerCase().replace(/\s+/g, ' ')
}

function integerStringToNumber(value?: string) {
  return value ? Number.parseInt(value, 10) : null
}

function getMessagingConversationResults(insight?: GraphInsight) {
  const messagingActionTypes = [
    'onsite_conversion.messaging_conversation_started_7d',
    'onsite_conversion.messaging_conversation_started',
  ]
  const action = messagingActionTypes
    .map((actionType) =>
      (insight?.actions ?? []).find((currentAction) => currentAction.action_type === actionType),
    )
    .find(Boolean)

  return integerStringToNumber(action?.value) ?? null
}

function sendJson(response: ServerResponse, status: number, data: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.end(JSON.stringify(data))
}

type AppointmentBooking = {
  id: number | string
  contact_phone?: string | null
  booked_at: string
  meeting_start_at: string
  attribution_data?: { contactPhone?: string | null } | null
}

function appointmentPhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

async function fetchManualHubSpotAppointments(botRows: AppointmentBooking[], token: string) {
  if (!token) throw new Error('HubSpot reporting is not configured.')
  const dates = botRows.flatMap((row) => [Date.parse(row.booked_at), Date.parse(row.meeting_start_at)]).filter(Number.isFinite)
  const now = Date.now()
  const from = dates.length ? Math.min(...dates) - 86_400_000 : now - (30 * 86_400_000)
  const to = dates.length ? Math.max(...dates) + 86_400_000 : now + (30 * 86_400_000)
  const meetings = await searchAllHubSpotObjects<{
    id: string
    properties: Record<string, string | null | undefined>
  }>('meetings', {
    filterGroups: [{ filters: [
      { propertyName: 'hs_createdate', operator: 'GTE', value: String(from) },
      { propertyName: 'hs_createdate', operator: 'LTE', value: String(to) },
    ] }],
    properties: ['hs_createdate', 'hs_meeting_start_time', 'hs_meeting_title', 'hs_meeting_body', 'hs_internal_meeting_notes', 'hs_meeting_outcome'],
  }, token)
  const meetingBatches = Array.from({ length: Math.ceil(meetings.length / 100) }, (_, index) => meetings.slice(index * 100, (index + 1) * 100))
  const associationGroups = await Promise.all(meetingBatches.map((meetingBatch) => hubSpotPost<{
      results?: Array<{ from: { id: string }; to: Array<{ toObjectId: number }> }>
    }>('/crm/v4/associations/meetings/contacts/batch/read', {
      inputs: meetingBatch.map((meeting) => ({ id: meeting.id })),
    }, token)))
  const allAssociations = associationGroups.flatMap((group) => group.results ?? [])
  const contactIds = [...new Set(allAssociations.flatMap((item) => item.to ?? []).map((item) => String(item.toObjectId)))]
  const contactBatches = Array.from({ length: Math.ceil(contactIds.length / 100) }, (_, index) => contactIds.slice(index * 100, (index + 1) * 100))
  const contactGroups = await Promise.all(contactBatches.map((batchIds) => hubSpotPost<{
      results?: Array<{ id: string; properties: { source?: string | null } }>
    }>('/crm/v3/objects/contacts/batch/read', {
      properties: ['source'],
      inputs: batchIds.map((id) => ({ id })),
    }, token)))
  const contactSources = new Map(contactGroups.flatMap((group) => group.results ?? []).map((contact) => [String(contact.id), contact.properties.source]))
  const sourceByMeeting = new Map<string, string>()
  for (const association of allAssociations) {
    const source = (association.to ?? []).map((item) => contactSources.get(String(item.toObjectId))).find(Boolean)
    if (source) sourceByMeeting.set(String(association.from.id), source)
  }
  const botPhones = new Set(botRows.map((row) => appointmentPhone(row.contact_phone ?? row.attribution_data?.contactPhone)).filter(Boolean))

  const hubSpotMatches: Array<{ phone: string; status: string; meetingAt: string }> = []
  const manualRows = meetings.flatMap((meeting) => {
    const text = Object.values(meeting.properties).filter(Boolean).join(' ')
    const match = text.match(/([+\d][\d\s().-]{6,})@dummy\.com/i)
    const phone = match ? appointmentPhone(match[1]) : ''
    const source = sourceByMeeting.get(String(meeting.id)) || 'unknown'
    const status = String(meeting.properties.hs_meeting_outcome ?? '').toUpperCase() === 'CANCELED' ? 'Cancelled' : 'Completed'
    if (phone) hubSpotMatches.push({ phone, status, meetingAt: meeting.properties.hs_meeting_start_time || meeting.properties.hs_createdate || '' })
    const bookedAt = meeting.properties.hs_createdate
    if (!phone || botPhones.has(phone) || !bookedAt) return []
    return [{
      id: `hubspot-${meeting.id}`,
      respond_contact_id: meeting.id,
      contact_phone: phone,
      booked_at: bookedAt,
      meeting_start_at: meeting.properties.hs_meeting_start_time || bookedAt,
      source_platform: source,
      source_type: source,
      campaign_name: null,
      ad_name: null,
      meeting_name: meeting.properties.hs_meeting_title || null,
      status,
    }]
  })
  return { manualRows, hubSpotMatches }
}

function botReportsApi(hubSpotToken: string): Plugin {
  return {
    name: 'bot-reports-api',
    configureServer(server) {
      server.middlewares.use('/api/bot-reports/bookings', async (_request, response) => {
        try {
          const upstream = await fetch('https://dharma-agent-yd5l.onrender.com/api/reports/bookings')
          const report = await upstream.json() as { rows?: AppointmentBooking[]; manualRows?: unknown[]; hubSpotWarning?: string }
          response.statusCode = upstream.status
          if (upstream.ok) {
            try {
              const hubSpotAppointments = await fetchManualHubSpotAppointments(report.rows ?? [], hubSpotToken)
              report.manualRows = hubSpotAppointments.manualRows
              report.rows = (report.rows ?? []).map((row) => {
                const phone = appointmentPhone(row.contact_phone ?? row.attribution_data?.contactPhone)
                const rowTime = Date.parse(row.meeting_start_at || row.booked_at)
                const match = hubSpotAppointments.hubSpotMatches
                  .filter((item) => item.phone === phone)
                  .sort((left, right) => Math.abs(Date.parse(left.meetingAt) - rowTime) - Math.abs(Date.parse(right.meetingAt) - rowTime))[0]
                return { ...row, status: match?.status ?? 'Completed' }
              })
            } catch (error) {
              report.manualRows = []
              report.hubSpotWarning = error instanceof Error ? error.message : 'Unable to load HubSpot appointments'
            }
          }
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(report))
        } catch (error) {
          sendJson(response, 502, {
            message: error instanceof Error ? error.message : 'Unable to load booking report',
          })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      allowedHosts: [
        'dharma-campaignreport-503z.onrender.com',
        'reportstool.onrender.com',
      ],
    },
    plugins: [
      react(),
      botReportsApi(env.HUBSPOT_ACCESS_TOKEN ?? ''),
      facebookBudgetApi(env.FACEBOOK_SYSTEM_ACCESS_TOKEN ?? ''),
      respondIoReportMetricsApi(
        env.RESPOND_IO_ACCESS_TOKEN ?? '',
        env.RESPOND_IO_ANALYTICS_ACCESS_TOKEN ?? '',
      ),
      respondIoSampleApi(env.RESPOND_IO_ACCESS_TOKEN ?? ''),
      tiktokAdsManagerApi(),
      aircallWebhookApi(
        env.VITE_SUPABASE_URL ?? '',
        env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        env.AIRCALL_WEBHOOK_TOKEN ?? '',
      ),
      aircallMissedCallsApi(
        env.AIRCALL_API_ID ?? '',
        env.AIRCALL_API_TOKEN ?? '',
        env.VITE_SUPABASE_URL ?? '',
        env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      ),
      agentReportApi(
        env.AIRCALL_API_ID ?? '',
        env.AIRCALL_API_TOKEN ?? '',
        env.RESPOND_IO_ACCESS_TOKEN ?? '',
        env.RESPOND_IO_ANALYTICS_ACCESS_TOKEN ?? '',
        env.HUBSPOT_ACCESS_TOKEN ?? '',
        env.VITE_SUPABASE_URL ?? '',
        env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      ),
      callConfirmationApi(
        env.HUBSPOT_ACCESS_TOKEN ?? '',
        env.AIRCALL_API_ID ?? '',
        env.AIRCALL_API_TOKEN ?? '',
      ),
      financeReportApi(
        env.HUBSPOT_ACCESS_TOKEN ?? '',
        env.VITE_SUPABASE_URL ?? '',
        env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      ),
    ],
  }
})
