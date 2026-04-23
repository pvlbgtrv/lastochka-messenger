export interface BotRecord {
  id: string
  owner_user_id: string
  username: string
  display_name: string
  about: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_used_at?: string
  webhook_url?: string
  webhook_last_status?: number
  webhook_last_error?: string
  webhook_last_delivery_at?: string
  tinode_user_id?: string
  tinode_login?: string
  tinode_topic?: string
  allowed_topics?: string[]
  provision_status?: 'pending' | 'ready' | 'failed'
  provision_error?: string
}

interface ApiResponse<T> {
  data: T
}

const BOT_GATEWAY_URL = (import.meta.env.VITE_BOT_GATEWAY_URL as string) || 'http://localhost:8090'

function buildHeaders(ownerUserId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': ownerUserId,
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const payload = await res.json() as { error?: { message?: string } }
      if (payload?.error?.message) msg = payload.error.message
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function listBots(ownerUserId: string): Promise<BotRecord[]> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots`, {
    headers: buildHeaders(ownerUserId),
  })
  const payload = await unwrap<ApiResponse<BotRecord[]>>(res)
  return payload.data
}

export async function createBot(
  ownerUserId: string,
  input: { display_name: string; username: string; about?: string },
): Promise<{ bot: BotRecord; api_token: string }> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots`, {
    method: 'POST',
    headers: buildHeaders(ownerUserId),
    body: JSON.stringify(input),
  })
  const payload = await unwrap<ApiResponse<{ bot: BotRecord; api_token: string }>>(res)
  return payload.data
}

export async function updateBot(
  ownerUserId: string,
  botId: string,
  input: { display_name?: string; username?: string; about?: string },
): Promise<BotRecord> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}`, {
    method: 'PATCH',
    headers: buildHeaders(ownerUserId),
    body: JSON.stringify(input),
  })
  const payload = await unwrap<ApiResponse<BotRecord>>(res)
  return payload.data
}

export async function deleteBot(
  ownerUserId: string,
  botId: string,
): Promise<BotRecord> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}`, {
    method: 'DELETE',
    headers: buildHeaders(ownerUserId),
  })
  const payload = await unwrap<ApiResponse<BotRecord>>(res)
  return payload.data
}

export async function regenerateBotToken(
  ownerUserId: string,
  botId: string,
): Promise<{ bot: BotRecord; api_token: string }> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}/tokens/regenerate`, {
    method: 'POST',
    headers: buildHeaders(ownerUserId),
  })
  const payload = await unwrap<ApiResponse<{ bot: BotRecord; api_token: string }>>(res)
  return payload.data
}

export async function revokeBotToken(ownerUserId: string, botId: string): Promise<BotRecord> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}/tokens/revoke`, {
    method: 'POST',
    headers: buildHeaders(ownerUserId),
  })
  const payload = await unwrap<ApiResponse<BotRecord>>(res)
  return payload.data
}

export async function setBotWebhook(
  ownerUserId: string,
  botId: string,
  input: { url: string; secret: string },
): Promise<BotRecord> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}/webhook`, {
    method: 'POST',
    headers: buildHeaders(ownerUserId),
    body: JSON.stringify(input),
  })
  const payload = await unwrap<ApiResponse<BotRecord>>(res)
  return payload.data
}

export async function deleteBotWebhook(ownerUserId: string, botId: string): Promise<BotRecord> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}/webhook`, {
    method: 'DELETE',
    headers: buildHeaders(ownerUserId),
  })
  const payload = await unwrap<ApiResponse<BotRecord>>(res)
  return payload.data
}

export async function createTestUpdate(
  ownerUserId: string,
  botId: string,
  input: { chat_id: string; text: string },
): Promise<{ update_id: number; type: string; payload: unknown; created_at: string }> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}/updates/test`, {
    method: 'POST',
    headers: buildHeaders(ownerUserId),
    body: JSON.stringify(input),
  })
  const payload = await unwrap<ApiResponse<{ update_id: number; type: string; payload: unknown; created_at: string }>>(res)
  return payload.data
}

export async function createIncomingUpdate(
  ownerUserId: string,
  botId: string,
  input: { chat_id: string; text: string },
): Promise<{ update_id: number; type: string; payload: unknown; created_at: string }> {
  const res = await fetch(`${BOT_GATEWAY_URL}/api/v1/bots/${encodeURIComponent(botId)}/updates/incoming`, {
    method: 'POST',
    headers: buildHeaders(ownerUserId),
    body: JSON.stringify(input),
  })
  const payload = await unwrap<ApiResponse<{ update_id: number; type: string; payload: unknown; created_at: string }>>(res)
  return payload.data
}
