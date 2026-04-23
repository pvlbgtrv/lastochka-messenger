import { Tinode, Drafty } from 'tinode-sdk'
import type { MeTopic, Topic, TinodeContact, TinodeMessage } from 'tinode-sdk'

const HOST = (import.meta.env.VITE_TINODE_HOST as string) || 'app.lastochka-m.ru'
const API_KEY = (import.meta.env.VITE_TINODE_API_KEY as string) || 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K'
const SECURE = (import.meta.env.VITE_TINODE_SECURE as string | undefined) === 'false' ? false : true
const APP_NAME = (import.meta.env.VITE_APP_NAME as string) || 'Ласточка'

// Number of messages to load per page
export const MESSAGES_PAGE = 24

let _tinode: Tinode | null = null

export function getTinode(): Tinode {
  if (!_tinode) {
    _tinode = new Tinode(
      { appName: APP_NAME, host: HOST, apiKey: API_KEY, transport: 'ws', secure: SECURE },
    )
    _tinode.enableLogging(true, false)
  }
  return _tinode
}

// Build avatar URL from Tinode photo object
export function getAvatarUrl(photo?: { type?: string; data?: string; ref?: string; large?: { type?: string; data?: string; ref?: string } }): string | undefined {
  if (!photo) return undefined

  // Try large version first
  if (photo.large) {
    if (photo.large.ref) return photo.large.ref
    if (photo.large.data && photo.large.type) return `data:${photo.large.type};base64,${photo.large.data}`
  }

  // Fallback to regular photo
  if (photo.ref) return photo.ref
  if (photo.data && photo.type) return `data:${photo.type};base64,${photo.data}`

  return undefined
}

/**
 * Build file URL from Tinode file reference.
 * Handles both relative (/v0/file/s/...) and absolute URLs.
 * Adds auth query parameters so browser <img> tags can download files.
 */
export function getFileUrl(ref?: string): string | undefined {
  if (!ref) return undefined
  if (ref.startsWith('http')) return ref
  // Relative URL — prepend base + auth params
  const scheme = SECURE ? 'https' : 'http'
  const baseUrl = `${scheme}://${HOST}${ref.startsWith('/') ? '' : '/'}${ref}`

  // Add auth query params for browser <img> tags (Tinode requires auth for file serving)
  const tn = getTinode()
  const authToken = tn.getAuthToken()
  if (authToken) {
    // encodeURIComponent to preserve + and / in the token
    return `${baseUrl}?apikey=${API_KEY}&auth=token&secret=${encodeURIComponent(authToken.token)}`
  }

  return baseUrl
}

// Extract display name from a Tinode contact object
export function contactDisplayName(cont: TinodeContact): string {
  return cont.public?.fn || cont.topic || cont.name || 'Без имени'
}

// Convert Drafty/plain message content to preview string
export function draftyToText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  // Try Drafty toPlainText
  try {
    if (typeof Drafty !== 'undefined' && Drafty && typeof Drafty.toPlainText === 'function') {
      return Drafty.toPlainText(content) as string
    }
  } catch {
    // ignore
  }
  // Fallback: read txt field if present (Drafty object structure)
  try {
    const d = content as Record<string, unknown>
    if (typeof d.txt === 'string') return d.txt
  } catch {
    // ignore
  }
  return '[вложение]'
}

type DraftyFmtSpan = { at?: number; len?: number; key?: number; tp?: string }
type DraftyEntity = { tp?: string; data?: Record<string, unknown> }

function applyWrapperByType(
  rawText: string,
  at: number,
  len: number,
  tp: string,
  entityData?: Record<string, unknown>,
): string {
  if (at < 0 || len <= 0 || at + len > rawText.length) return rawText
  const left = rawText.slice(0, at)
  const mid = rawText.slice(at, at + len)
  const right = rawText.slice(at + len)

  switch (tp) {
    case 'ST':
      return `${left}**${mid}**${right}`
    case 'EM':
      return `${left}_${mid}_${right}`
    case 'DL':
      return `${left}~~${mid}~~${right}`
    case 'CO':
      return `${left}\`${mid}\`${right}`
    case 'LN': {
      const url = typeof entityData?.url === 'string'
        ? entityData.url
        : typeof entityData?.ref === 'string'
          ? entityData.ref
          : ''
      if (!url) return rawText
      return `${left}[${mid}](${url})${right}`
    }
    default:
      return rawText
  }
}

// Convert Drafty to markdown-like text preserving common inline formatting.
export function draftyToMarkdown(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content !== 'object') return ''

  const d = content as Record<string, unknown>
  const txt = typeof d.txt === 'string' ? d.txt : draftyToText(content)
  if (!txt) return ''

  const fmt = Array.isArray(d.fmt) ? (d.fmt as DraftyFmtSpan[]) : []
  if (!fmt.length) return txt
  const ent = Array.isArray(d.ent) ? (d.ent as DraftyEntity[]) : []

  const spans = fmt
    .map((span) => {
      const at = typeof span.at === 'number' ? span.at : -1
      const len = typeof span.len === 'number' ? span.len : 0
      const tp = typeof span.tp === 'string'
        ? span.tp
        : (typeof span.key === 'number' && ent[span.key]?.tp ? ent[span.key]!.tp! : '')
      const entityData = typeof span.key === 'number' ? ent[span.key]?.data : undefined
      return { at, len, tp, entityData }
    })
    .filter((span) => span.at >= 0 && span.len > 0 && !!span.tp)
    .sort((a, b) => (b.at - a.at) || (b.len - a.len))

  let out = txt
  for (const span of spans) {
    out = applyWrapperByType(out, span.at, span.len, span.tp, span.entityData)
  }
  return out
}
/**
 * Check if Drafty content contains an image (IM/EX entity with mime type image/*).
 * Handles both flat format { mime, ref, val } and nested { data: { mime, ref, val } }.
 */
export function hasImageAttachment(content: unknown): boolean {
  if (!content || typeof content !== 'object') return false
  try {
    const d = content as Record<string, unknown>
    const ent = d.ent as Array<Record<string, unknown>> | undefined
    if (!ent) return false
    return ent.some((e) => {
      const tp = (e.tp as string) || ''
      if (tp && tp !== 'IM' && tp !== 'EX') return false

      // Try nested data object
      const dataObj = (e.data as Record<string, unknown>) || e
      const mime = (dataObj.mime as string) || ''
      if (!mime.startsWith('image/')) return false
      return !!(dataObj.ref || dataObj.val)
    })
  } catch {
    return false
  }
}

/**
 * Extract image info from Drafty content.
 * Handles both formats:
 *   - Standard Tinode: { tp: "IM", data: { mime, ref, width, height } }
 *   - Flat: { mime, ref, width, height } (top-level entity fields)
 */
export function extractImageInfo(content: unknown): { url: string; width?: number; height?: number } | null {
  if (!content || typeof content !== 'object') return null
  try {
    const d = content as Record<string, unknown>
    const ent = d.ent as Array<Record<string, unknown>> | undefined
    if (!ent) return null

    for (const e of ent) {
      const tp = (e.tp as string) || ''
      if (tp && tp !== 'IM' && tp !== 'EX') continue

      // Try nested data object, fallback to entity itself
      const dataObj = (e.data as Record<string, unknown>) || e
      const mime = (dataObj.mime as string) || ''
      if (!mime.startsWith('image/')) continue

      const ref = dataObj.ref as string | undefined
      const val = dataObj.val as string | undefined
      const width = dataObj.width as number | undefined
      const height = dataObj.height as number | undefined

      // Case 1: ref (URL from server upload)
      if (ref) {
        return {
          url: getFileUrl(ref) || ref,
          width,
          height,
        }
      }

      // Case 2: val (base64 inline data)
      if (val && typeof val === 'string') {
        if (val.startsWith('data:')) {
          return { url: val, width, height }
        }
        return {
          url: `data:${mime};base64,${val}`,
          width,
          height,
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Create Drafty content for an image message.
 * Uses standard Tinode format: { tp: "IM" | "EX", data: { mime, ref, width, height } }
 */
export function createImageDrafty(
  caption: string,
  imageRef: string,
  mimeType: string,
  width?: number,
  height?: number
): unknown {
  // Ensure ref is a relative path (strip base URL and query params if present)
  let cleanRef = imageRef
  if (cleanRef.startsWith('http')) {
    try {
      const u = new URL(cleanRef)
      cleanRef = u.pathname
    } catch { /* keep as is */ }
  }
  cleanRef = cleanRef.split('?')[0]  // strip query params

  const ent: Array<Record<string, unknown>> = [{
    tp: 'IM',  // Use IM for images (not EX)
    data: {
      mime: mimeType,
      ref: cleanRef,
      ...(width && { width }),
      ...(height && { height }),
    },
  }]

  if (caption.trim()) {
    return {
      txt: caption,
      fmt: [{ at: 0, len: caption.length, key: 0 }],
      ent,
    }
  }

  // Image without caption
  return {
    txt: ' ',
    fmt: [{ at: -1, len: 0, key: 0 }],
    ent,
  }
}

/**
 * Upload a file to Tinode server and return the file reference.
 * Uses the Tinode upload endpoint directly.
 */
export async function uploadFile(file: File): Promise<{ ref: string; width?: number; height?: number }> {
  const tn = getTinode()
  const authToken = tn.getAuthToken()
  
  if (!authToken) {
    throw new Error('Not authenticated')
  }

  // Use trailing slash (/u/) and multipart upload, same as production web UI.
  // This avoids method rewrite issues on redirects and matches Tinode upload handler expectations.
  const scheme = SECURE ? 'https' : 'http'
  const uploadUrl = `${scheme}://${HOST}/v0/file/u/?apikey=${API_KEY}&auth=token&secret=${encodeURIComponent(authToken.token)}`

  const uploadToUrl = (url: string): Promise<{ ref: string; width?: number; height?: number }> =>
    new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText) as {
              ctrl?: { params?: { ref?: string; url?: string; width?: number; height?: number } }
              params?: { ref?: string; url?: string; width?: number; height?: number }
              ref?: string
              url?: string
              width?: number
              height?: number
            }

            const params = response.ctrl?.params || response.params || {}
            const ref = params.ref || params.url || response.ref || response.url
            if (!ref) {
              reject(new Error('Upload failed: malformed response'))
              return
            }

            const cleanRef = String(ref).split('?')[0]
            resolve({
              ref: cleanRef,
              width: params.width || response.width,
              height: params.height || response.height,
            })
          } catch {
            reject(new Error('Upload failed: invalid server response'))
          }
          return
        }

        if (xhr.status === 307) {
          const redirectUrl = xhr.getResponseHeader('Location')
          if (!redirectUrl) {
            reject(new Error('Upload failed: redirect without location'))
            return
          }
          uploadToUrl(redirectUrl).then(resolve).catch(reject)
          return
        }

        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed: network error'))
      })

      xhr.open('POST', url)
      xhr.send(formData)
    })

  return uploadToUrl(uploadUrl)
}

// Save auth token to localStorage
export function saveAuthToken(token: { token: string; expires: Date }) {
  localStorage.setItem('lastochka-auth-token', JSON.stringify({
    token: token.token,
    expires: token.expires.toISOString(),
  }))
}

// Load auth token from localStorage
export function loadAuthToken(): { token: string; expires: Date } | null {
  try {
    const raw = localStorage.getItem('lastochka-auth-token')
    if (!raw) return null
    const obj = JSON.parse(raw) as { token: string; expires: string }
    return { token: obj.token, expires: new Date(obj.expires) }
  } catch {
    return null
  }
}

// Clear stored auth token
export function removeAuthToken() {
  localStorage.removeItem('lastochka-auth-token')
}

export type { MeTopic, Topic, TinodeContact, TinodeMessage }

