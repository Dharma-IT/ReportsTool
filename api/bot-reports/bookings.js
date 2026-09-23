function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

function dummyEmailPhone(properties) {
  const text = Object.values(properties ?? {}).filter(Boolean).join(' ')
  const match = text.match(/([+\d][\d\s().-]{6,})@dummy\.com/i)
  return match ? normalizePhone(match[1]) : ''
}

async function fetchManualAppointments(fromDate, toDate, dateField) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) throw new Error('HubSpot reporting is not configured')

  const fallback = new Date().toISOString().slice(0, 10)
  const start = /^\d{4}-\d{2}-\d{2}$/.test(fromDate ?? '') ? fromDate : fallback
  const end = /^\d{4}-\d{2}-\d{2}$/.test(toDate ?? '') ? toDate : start
  // Eastern midnight is 04:00 or 05:00 UTC; keep a one-hour DST buffer.
  const from = Date.parse(`${start}T00:00:00Z`) + (3 * 3600000)
  const to = Date.parse(`${end}T00:00:00Z`) + (30 * 3600000)
  const dateProperty = dateField === 'meeting' ? 'hs_meeting_start_time' : 'hs_createdate'
  const meetings = []
  let after

  do {
    const upstream = await fetch('https://api.hubapi.com/crm/v3/objects/meetings/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterGroups: [{ filters: [
          { propertyName: dateProperty, operator: 'GTE', value: String(from) },
          { propertyName: dateProperty, operator: 'LT', value: String(to) },
        ] }],
        properties: ['hs_createdate', 'hs_meeting_start_time', 'hs_meeting_title', 'hs_meeting_body', 'hs_internal_meeting_notes', 'hs_meeting_outcome', 'hubspot_owner_id'],
        limit: 200,
        ...(after ? { after } : {}),
      }),
    })
    const payload = await upstream.json()
    if (!upstream.ok) throw new Error(payload.message ?? `HubSpot API failed with ${upstream.status}`)
    meetings.push(...(payload.results ?? []))
    after = payload.paging?.next?.after
  } while (after)

  const ownersResponse = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100&archived=false', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const ownersPayload = await ownersResponse.json()
  if (!ownersResponse.ok) throw new Error(ownersPayload.message ?? `HubSpot owners failed with ${ownersResponse.status}`)
  const ownerNames = new Map((ownersPayload.results ?? []).map((owner) => [String(owner.id), `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()]))
  const appointmentTeams = [
    { team: 'sales', name: 'Andres Castro', aliases: ['andres castro'] },
    { team: 'sales', name: 'Maria Claudia', aliases: ['maria claudia'] },
    { team: 'sales', name: 'Erika Vargas', aliases: ['erika vargas'] },
    { team: 'sales', name: 'Meribet Yazziet', aliases: ['meribet yazziet', 'meribet sampson'] },
    { team: 'sales', name: 'Ailin Isabel', aliases: ['ailin isabel'] },
    { team: 'nutritionist', name: 'Maria Sandoval', aliases: ['maria sandoval'] },
    { team: 'nutritionist', name: 'Paula Alfonso', aliases: ['paula alfonso'] },
    { team: 'cs', name: 'Arles Martinez', aliases: ['arles martinez'] },
    { team: 'cs', name: 'Aline Strelow', aliases: ['aline strelow', 'ailene nuevas', 'alice f'] },
    { team: 'cs', name: 'Brayam Zuluaga', aliases: ['brayam zuluaga', 'brayan zuluaga'] },
    { team: 'cs', name: 'Edmilson Morales', aliases: ['edmilson morales', 'edmilson velasquez'] },
  ]
  const teamAppointments = meetings.flatMap((meeting) => {
    const assignee = (ownerNames.get(String(meeting.properties.hubspot_owner_id)) ?? '').toLowerCase()
    const assignedAgent = appointmentTeams.find((agent) => agent.aliases.includes(assignee))
    const meetingAt = meeting.properties.hs_meeting_start_time || meeting.properties.hs_createdate
    return assignedAgent && meetingAt ? [{ team: assignedAgent.team, agent: assignedAgent.name, meeting_start_at: meetingAt }] : []
  })
  const teamCounts = {
    nutritionist: teamAppointments.filter((appointment) => appointment.team === 'nutritionist').length,
    cs: teamAppointments.filter((appointment) => appointment.team === 'cs').length,
    sales: teamAppointments.filter((appointment) => appointment.team === 'sales').length,
  }

  const meetingBatches = Array.from({ length: Math.ceil(meetings.length / 100) }, (_, index) => meetings.slice(index * 100, (index + 1) * 100))
  const associationGroups = await Promise.all(meetingBatches.map(async (meetingBatch) => {
    const associationResponse = await fetch('https://api.hubapi.com/crm/v4/associations/meetings/contacts/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: meetingBatch.map((meeting) => ({ id: meeting.id })) }),
    })
    const associations = await associationResponse.json()
    if (!associationResponse.ok) throw new Error(associations.message ?? `HubSpot associations failed with ${associationResponse.status}`)
    return associations.results ?? []
  }))
  const allAssociations = associationGroups.flat()
  const contactIds = [...new Set(allAssociations.flatMap((item) => item.to ?? []).map((item) => String(item.toObjectId)))]
  const contactBatches = Array.from({ length: Math.ceil(contactIds.length / 100) }, (_, index) => contactIds.slice(index * 100, (index + 1) * 100))
  const contactGroups = await Promise.all(contactBatches.map(async (batchIds) => {
    const contactsResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: ['source'], inputs: batchIds.map((id) => ({ id })) }),
    })
    const contacts = await contactsResponse.json()
    if (!contactsResponse.ok) throw new Error(contacts.message ?? `HubSpot contacts failed with ${contactsResponse.status}`)
    return contacts.results ?? []
  }))
  const contactSources = new Map(contactGroups.flat().map((contact) => [String(contact.id), contact.properties?.source]))
  const sourceByMeeting = new Map()
  for (const association of allAssociations) {
    const source = (association.to ?? []).map((item) => contactSources.get(String(item.toObjectId))).find(Boolean)
    if (source) sourceByMeeting.set(String(association.from.id), source)
  }

  const manualRows = meetings.flatMap((meeting) => {
    const phone = dummyEmailPhone(meeting.properties)
    const source = sourceByMeeting.get(String(meeting.id)) || 'unknown'
    const status = String(meeting.properties.hs_meeting_outcome ?? '').toUpperCase() === 'CANCELED' ? 'Cancelled' : 'Completed'
    if (!phone) return []
    const bookedAt = meeting.properties.hs_createdate
    const meetingAt = meeting.properties.hs_meeting_start_time || bookedAt
    if (!bookedAt) return []
    return [{
      id: `hubspot-${meeting.id}`,
      respond_contact_id: String(meeting.id),
      contact_phone: phone,
      booked_at: bookedAt,
      meeting_start_at: meetingAt,
      source_platform: source,
      source_type: source,
      campaign_name: null,
      ad_name: null,
      meeting_name: meeting.properties.hs_meeting_title || null,
      status,
    }]
  })
  return { manualRows, teamCounts, teamAppointments }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const fromDate = Array.isArray(request.query?.from) ? request.query.from[0] : request.query?.from
    const toDate = Array.isArray(request.query?.to) ? request.query.to[0] : request.query?.to
    const dateField = Array.isArray(request.query?.dateField) ? request.query.dateField[0] : request.query?.dateField
    const [hubSpotResult, botResult] = await Promise.allSettled([
      fetchManualAppointments(fromDate, toDate, dateField),
      fetch('https://dharma-agent-yd5l.onrender.com/api/reports/bookings').then(async (upstream) => {
        const payload = await upstream.json()
        if (!upstream.ok) throw new Error(payload.message ?? `Bot reports API failed with ${upstream.status}`)
        return payload
      }),
    ])
    const hubSpotAppointments = hubSpotResult.status === 'fulfilled' ? hubSpotResult.value : { manualRows: [], teamCounts: { nutritionist: 0, cs: 0, sales: 0 }, teamAppointments: [] }
    const botReport = botResult.status === 'fulfilled' ? botResult.value : { summary: { total: 0, fromAds: 0, byPlatform: {} }, rows: [] }
    const report = {
      summary: botReport.summary ?? { total: 0, fromAds: 0, byPlatform: {} },
      rows: botReport.rows ?? [],
      manualRows: hubSpotAppointments.manualRows,
      teamCounts: hubSpotAppointments.teamCounts,
      teamAppointments: hubSpotAppointments.teamAppointments,
      ...(hubSpotResult.status === 'rejected' ? { hubSpotWarning: hubSpotResult.reason instanceof Error ? hubSpotResult.reason.message : 'Unable to load manual appointments' } : {}),
      ...(botResult.status === 'rejected' ? { botWarning: botResult.reason instanceof Error ? botResult.reason.message : 'Unable to load bot appointments' } : {}),
    }

    response.status(200)
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response.send(JSON.stringify(report))
  } catch (error) {
    return response.status(502).json({
      message: error instanceof Error ? error.message : 'Unable to load manual appointments',
    })
  }
}
