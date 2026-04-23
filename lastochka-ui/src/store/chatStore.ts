import { create } from 'zustand'
import type { Chat, Message, Reaction, StickerPack } from '@/types'
import { contactDisplayName, draftyToMarkdown, getAvatarUrl, getTinode, createImageDrafty, uploadFile, getFileUrl } from '@/lib/tinode-client'
import type { TinodeContact, TinodeMessage } from '@/lib/tinode-client'
import { createIncomingUpdate, listBots, type BotRecord } from '@/lib/bot-api'

// в”Ђв”Ђв”Ђ Mock Data (removed - using real Tinode data only) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Mock data has been removed. All data now comes from Tinode server.

const CURRENT_USER_ID = 'usr_me'

// Number of messages to load per page (imported from tinode-client)
const MESSAGES_PAGE = 24

const PHONE_DIGITS_REGEX = /\D/g
const userDisplayNameCache = new Map<string, string>()
const previewHydrationInFlight = new Set<string>()
const CHAT_PREVIEW_CACHE_KEY = 'lastochka.chatPreviewCache.v1'
const REACTION_CACHE_KEY = 'lastochka.reactionCache.v1'

type ChatPreviewCacheEntry = {
  lastMessage?: string
  lastMessageTs?: string
}

function readChatPreviewCache(): Record<string, ChatPreviewCacheEntry> {
  try {
    const raw = localStorage.getItem(CHAT_PREVIEW_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ChatPreviewCacheEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeChatPreviewCache(cache: Record<string, ChatPreviewCacheEntry>) {
  try {
    localStorage.setItem(CHAT_PREVIEW_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore localStorage write errors
  }
}

function setChatPreviewCache(topicId: string, lastMessage?: string, lastMessageTs?: Date) {
  if (!topicId) return
  const cache = readChatPreviewCache()
  cache[topicId] = {
    lastMessage: lastMessage || undefined,
    lastMessageTs: lastMessageTs ? lastMessageTs.toISOString() : undefined,
  }
  writeChatPreviewCache(cache)
}

function readReactionCache(): Record<string, Reaction[]> {
  try {
    const raw = localStorage.getItem(REACTION_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Reaction[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeReactionCache(cache: Record<string, Reaction[]>) {
  try {
    localStorage.setItem(REACTION_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore localStorage write errors
  }
}

function getCachedReactions(messageId: string): Reaction[] {
  if (!messageId) return []
  const cache = readReactionCache()
  const value = cache[messageId]
  return Array.isArray(value) ? value : []
}

function setCachedReactions(messageId: string, reactions: Reaction[]) {
  if (!messageId) return
  const cache = readReactionCache()
  if (!reactions.length) {
    delete cache[messageId]
  } else {
    cache[messageId] = reactions
  }
  writeReactionCache(cache)
}

function cacheUserDisplayName(userId?: string, name?: string) {
  if (!userId || !name) return
  const cleanName = name.trim()
  if (!cleanName || cleanName === userId) return
  userDisplayNameCache.set(userId, cleanName)
}

function resolveSenderName(senderId: string, myUserId: string): string {
  if (!senderId || senderId === myUserId || senderId === CURRENT_USER_ID) {
    return 'Р’С‹'
  }
  return userDisplayNameCache.get(senderId) || senderId
}

function cacheTopicSubscribers(topic: unknown) {
  const t = topic as { subscribers?: (cb: (sub: unknown) => void) => void }
  if (typeof t.subscribers !== 'function') return

  t.subscribers((subRaw) => {
    const sub = subRaw as {
      user?: string
      public?: { fn?: string }
    }
    cacheUserDisplayName(sub.user, sub.public?.fn)
  })
}

function normalizePhoneForSearch(value?: string): string {
  if (!value) return ''
  return value.replace(PHONE_DIGITS_REGEX, '')
}

function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase()
}

function extractContactLogin(cont: TinodeContact): string | undefined {
  const pub = cont.public as Record<string, unknown> | undefined
  const pvt = cont.private as Record<string, unknown> | undefined
  const loginCandidate = pub?.uname || pvt?.login || cont.name
  return typeof loginCandidate === 'string' ? loginCandidate : undefined
}

function extractContactPhone(cont: TinodeContact): string | undefined {
  const pub = cont.public as Record<string, unknown> | undefined
  const pvt = cont.private as Record<string, unknown> | undefined
  const phoneCandidate = pub?.phone || pub?.tel || pvt?.phone || pvt?.tel
  return typeof phoneCandidate === 'string' ? phoneCandidate : undefined
}

function doesChatMatchQuery(chat: Chat, query: string): boolean {
  const q = normalizeText(query)
  if (!q) return true
  const phoneQuery = normalizePhoneForSearch(q)
  const phone = normalizePhoneForSearch(chat.phone)

  return [
    normalizeText(chat.name),
    normalizeText(chat.login),
    normalizeText(chat.description),
    normalizeText(chat.id),
  ].some((field) => field.includes(q)) || (!!phoneQuery && !!phone && phone.includes(phoneQuery))
}

function buildFndQueries(rawQuery: string): string[] {
  const trimmed = rawQuery.trim()
  if (!trimmed) return []

  const base = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
  const normalized = base.toLowerCase()
  const phoneDigits = normalizePhoneForSearch(base)
  const tokens = normalized.split(/\s+/).map((t) => t.trim()).filter(Boolean)

  const queries = new Set<string>()
  queries.add(trimmed)
  queries.add(normalized)

  if (normalized && !normalized.includes(':') && tokens.length === 1) {
    queries.add(`basic:${normalized}`)
  }

  if (!normalized.includes(':')) {
    for (const token of tokens) {
      queries.add(`fn:${token}`)
      queries.add(`name:${token}`)
    }
  }

  if (phoneDigits) {
    queries.add(phoneDigits)
    queries.add(`tel:${phoneDigits}`)
    queries.add(`tel:+${phoneDigits}`)
    if (phoneDigits.length === 11 && phoneDigits.startsWith('8')) {
      const ruE164 = `7${phoneDigits.slice(1)}`
      queries.add(`tel:${ruE164}`)
      queries.add(`tel:+${ruE164}`)
    } else if (phoneDigits.length === 10 && phoneDigits.startsWith('9')) {
      const ruE164 = `7${phoneDigits}`
      queries.add(`tel:${ruE164}`)
      queries.add(`tel:+${ruE164}`)
    }
  }

  return Array.from(queries).filter(Boolean)
}

function contactToChat(cont: TinodeContact): Chat {
  const name = contactDisplayName(cont)
  const pub = (cont.public || {}) as Record<string, unknown>
  const botType = typeof pub.type === 'string' ? pub.type.toLowerCase() : ''
  const pubTags = Array.isArray(pub.tags) ? pub.tags : []
  const hasBotTag = pubTags.some((tag) => typeof tag === 'string' && tag.toLowerCase() === 'bot')
  const isBot = botType === 'bot' || hasBotTag
  if (cont.topic?.startsWith('usr')) {
    cacheUserDisplayName(cont.topic, name)
  }

  return {
    id: cont.topic,
    name,
    login: extractContactLogin(cont),
    phone: extractContactPhone(cont),
    description: typeof (cont.public as Record<string, unknown> | undefined)?.note === 'string'
      ? ((cont.public as Record<string, unknown>).note as string)
      : undefined,
    avatar: getAvatarUrl(cont.public?.photo),
    lastMessageTs: cont.touched ?? undefined,
    unread: cont.unread ?? 0,
    online: cont.online ?? false,
    isGroup: cont.topic?.startsWith('grp') ?? false,
    isBot,
    pinned: false,
    muted: false,
  }
}

function botToSearchChat(bot: BotRecord, existingChatId?: string): Chat {
  const topicId = existingChatId || bot.tinode_user_id?.trim() || bot.tinode_topic?.trim() || `bot:${bot.id}`
  const status = bot.provision_status || 'pending'
  const description = bot.about || (status === 'ready' ? 'Р§Р°С‚-Р±РѕС‚' : 'Р‘РѕС‚ РµС‰С‘ РЅРµ РіРѕС‚РѕРІ')
  return {
    id: topicId,
    botId: bot.id,
    isBot: true,
    name: `${bot.display_name} рџ¤–`,
    login: bot.username,
    description,
    online: true,
    isGroup: false,
    unread: 0,
    pinned: false,
    muted: false,
  }
}

function mergeBotVisual(existing: Chat, botLike: Chat): Chat {
  return {
    ...existing,
    isBot: existing.isBot || botLike.isBot || Boolean(existing.botId) || Boolean(botLike.botId),
    botId: existing.botId || botLike.botId,
  }
}

function parseTinodeContent(content: unknown): { text: string; imageUrl?: string; stickerId?: string } {
  if (!content) return { text: '' }

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>
      return parseTinodeContent(parsed)
    } catch {
      return { text: content }
    }
  }

  if (typeof content !== 'object') return { text: '' }

  const d = content as Record<string, unknown>
  const text = draftyToMarkdown(content)
  const ent = d.ent as Array<Record<string, unknown>> | undefined

  if (ent) {
    for (const entity of ent) {
      const dataObj = ((entity.data as Record<string, unknown>) || entity) as Record<string, unknown>
      const mime = String(dataObj.mime || '')
      const ref = dataObj.ref as string | undefined
      const val = dataObj.val as string | undefined
      if (mime.startsWith('image/')) {
        if (ref) return { text, imageUrl: getFileUrl(ref) || ref }
        if (val && val.startsWith('data:')) return { text, imageUrl: val }
        if (val) return { text, imageUrl: `data:${mime};base64,${val}` }
      }
    }
  }

  return { text }
}

function normalizeMessageTextForEchoMatch(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\[([^\]\n]+?)\]\(([^)\n]+?)\)/g, '$1')
    .replace(/\*\*([^*\n]+?)\*\*/g, '$1')
    .replace(/__([^_\n]+?)__/g, '$1')
    .replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, '$1')
    .replace(/~~([^~\n]+?)~~/g, '$1')
    .replace(/`([^`\n]+?)`/g, '$1')
}

function toChatPreviewText(text: string): string {
  return normalizeMessageTextForEchoMatch(text)
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function tinodeMsgToMessage(topicId: string, msg: TinodeMessage, myUserId: string): Message {
  const senderId = !msg.from || msg.from === myUserId ? CURRENT_USER_ID : msg.from
  const parsed = parseTinodeContent(msg.content)
  const head = msg.head as Record<string, unknown> | undefined
  const stickerId = typeof head?.sticker === 'string' ? head.sticker : parsed.stickerId
  const senderName = resolveSenderName(senderId, myUserId)
  return {
    id: msg.seq ? `${topicId}-${msg.seq}` : `msg_${Date.now()}`,
    chatId: topicId,
    senderId,
    senderName,
    text: parsed.text,
    imageUrl: parsed.imageUrl,
    stickerId,
    ts: msg.ts instanceof Date ? msg.ts : new Date(msg.ts),
    read: true,
    seq: msg.seq,
    reactions: msg.seq ? getCachedReactions(`${topicId}-${msg.seq}`) : [],
  }
}

function messageToPreview(msg?: Message): string | undefined {
  if (!msg) return undefined
  if (msg.text) return toChatPreviewText(msg.text)
  if (msg.imageUrl) return 'рџ“· Р¤РѕС‚Рѕ'
  if (msg.stickerId) return 'рџ™‚ РЎС‚РёРєРµСЂ'
  return 'РЎРѕРѕР±С‰РµРЅРёРµ'
}

function sortChatsByPinnedAndTime(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    const ap = a.pinned ? 1 : 0
    const bp = b.pinned ? 1 : 0
    if (ap !== bp) return bp - ap
    const at = a.lastMessageTs ? new Date(a.lastMessageTs).getTime() : 0
    const bt = b.lastMessageTs ? new Date(b.lastMessageTs).getTime() : 0
    return bt - at
  })
}

// в”Ђв”Ђв”Ђ Chat Store в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

interface ChatState {
  chats: Chat[]
  messages: Record<string, Message[]>
  activeChatId: string | null
  searchQuery: string
  searchResults: Chat[]
  isSearching: boolean
  darkMode: boolean
  emojiStyle: 'classic' | 'minimal'

  // Navigation
  view: 'chatList' | 'chat' | 'search' | 'settings' | 'profile' | 'bots'
  showMembersPanel: boolean

  // UI state
  showEmojiPicker: boolean
  showStickerPicker: boolean
  showImagePicker: boolean
  showCreateGroupModal: boolean
  showGroupSettingsModal: boolean
  selectedStickerPack: string | null
  fullscreenImage: string | null
  activeGroupSettingsId: string | null
  groupSettings: Record<string, GroupSettings>

  // Message actions
  replyToId: string | null
  editingMessageId: string | null

  // Actions
  setActiveChat: (id: string) => void
  deleteChat: (chatId?: string) => Promise<void>
  goBack: () => void
  openSearch: () => void
  closeSearch: () => void
  openSettings: () => void
  openProfile: () => void
  openBots: () => void
  openCreateGroupModal: () => void
  closeCreateGroupModal: () => void
  createGroup: (name: string, memberIds: string[]) => void
  openGroupSettingsModal: (groupId: string) => void
  closeGroupSettingsModal: () => void
  updateGroupSettings: (groupId: string, patch: Partial<GroupSettings>) => void
  addGroupMember: (groupId: string, userId: string) => void
  removeGroupMember: (groupId: string, userId: string) => void
  regenerateGroupInviteLink: (groupId: string) => void
  setSearchQuery: (query: string) => void
  searchUsers: (query: string) => Promise<void>
  updateGroupProfile: (groupId: string, profile: { name?: string; description?: string }) => Promise<void>
  toggleMute: (chatId: string) => void
  togglePin: (chatId: string) => void
  toggleDarkMode: () => void
  setEmojiStyle: (style: 'classic' | 'minimal') => void
  initFromTinode: () => Promise<void>
  cleanup: () => void

  // Messaging
  sendMessage: (text: string, imageFile?: File, stickerId?: string, draftyContent?: unknown) => Promise<void>
  editMessage: (messageId: string, newText: string, draftyContent?: unknown) => Promise<void>
  deleteMessage: (messageId: string, hard?: boolean) => Promise<void>
  replyToMessage: (messageId: string, text: string, draftyContent?: unknown) => Promise<void>
  startReply: (messageId: string | null) => void
  startEdit: (messageId: string | null) => void
  addReaction: (messageId: string, emoji: Reaction['emoji']) => void
  removeReaction: (messageId: string, emoji: Reaction['emoji']) => void

  // UI toggles
  setShowEmojiPicker: (show: boolean) => void
  setShowStickerPicker: (show: boolean) => void
  setShowImagePicker: (show: boolean) => void
  setSelectedStickerPack: (packId: string | null) => void
  setFullscreenImage: (url: string | null) => void
  _refreshContacts: () => void
  _hydrateChatPreview: (topicId: string) => Promise<void>
  _addMessage: (topicId: string, msg: TinodeMessage) => void

  // Stickers & data
  stickerPacks: StickerPack[]
}

type GroupType = 'public' | 'private'

interface GroupMemberLite {
  id: string
  name: string
}

interface GroupSettings {
  icon: string
  groupType: GroupType
  inviteLink: string
  members: GroupMemberLite[]
}

const initialGroupSettings: Record<string, GroupSettings> = {
  grp_team: {
    icon: 'рџ‘Ґ',
    groupType: 'private',
    inviteLink: 'https://app.lastochka-m.ru/invite/grp_team',
    members: [
      { id: 'usr_me', name: 'Р’С‹' },
      { id: 'usr_max', name: 'РњР°РєСЃ' },
      { id: 'usr_anna', name: 'РђРЅРЅР°' },
      { id: 'usr_alice', name: 'РђР»РёСЃР° РРІР°РЅРѕРІР°' },
    ],
  },
  grp_family: {
    icon: 'вќ¤пёЏ',
    groupType: 'private',
    inviteLink: 'https://app.lastochka-m.ru/invite/grp_family',
    members: [
      { id: 'usr_me', name: 'Р’С‹' },
      { id: 'usr_mom', name: 'РњР°РјР°' },
      { id: 'usr_bob', name: 'Р‘РѕСЂРёСЃ РџРµС‚СЂРѕРІ' },
    ],
  },
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  activeChatId: null,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  darkMode: false,
  emojiStyle: 'classic',

  view: 'chatList',
  showMembersPanel: false,

  showEmojiPicker: false,
  showStickerPicker: false,
  showImagePicker: false,
  showCreateGroupModal: false,
  showGroupSettingsModal: false,
  selectedStickerPack: null,
  fullscreenImage: null,
  activeGroupSettingsId: null,
  groupSettings: initialGroupSettings,

  // Message actions state
  replyToId: null,
  editingMessageId: null,

  // Stickers & data
  stickerPacks: [
    {
      id: 'funny',
      name: 'Р’РµСЃС‘Р»С‹Рµ',
      coverUrl: 'рџ„',
      stickers: [
        { id: 'funny-1', pack: 'funny', url: 'рџ„', emoji: 'рџ„' },
        { id: 'funny-2', pack: 'funny', url: 'рџ‚', emoji: 'рџ‚' },
        { id: 'funny-3', pack: 'funny', url: 'рџ¤Ј', emoji: 'рџ¤Ј' },
        { id: 'funny-4', pack: 'funny', url: 'рџЋ', emoji: 'рџЋ' },
        { id: 'funny-5', pack: 'funny', url: 'рџ¤©', emoji: 'рџ¤©' },
        { id: 'funny-6', pack: 'funny', url: 'рџҐі', emoji: 'рџҐі' },
      ],
    },
    {
      id: 'love',
      name: 'Р›Р°Р№Рє Рё Р»СЋР±РѕРІСЊ',
      coverUrl: 'вќ¤пёЏ',
      stickers: [
        { id: 'love-1', pack: 'love', url: 'вќ¤пёЏ', emoji: 'вќ¤пёЏ' },
        { id: 'love-2', pack: 'love', url: 'рџ«¶', emoji: 'рџ«¶' },
        { id: 'love-3', pack: 'love', url: 'рџЌ', emoji: 'рџЌ' },
        { id: 'love-4', pack: 'love', url: 'рџ', emoji: 'рџ' },
        { id: 'love-5', pack: 'love', url: 'рџ”Ґ', emoji: 'рџ”Ґ' },
        { id: 'love-6', pack: 'love', url: 'рџ‘Ќ', emoji: 'рџ‘Ќ' },
      ],
    },
  ],

  setActiveChat: (id) => {
    set((state) => {
      const exists = state.chats.some((chat) => chat.id === id)
      const fromSearch = state.searchResults.find((chat) => chat.id === id)
      const shouldAdd = !exists && !!fromSearch

      return {
        activeChatId: id,
        view: 'chat',
        showEmojiPicker: false,
        showStickerPicker: false,
        chats: shouldAdd && fromSearch ? [fromSearch, ...state.chats] : state.chats,
      }
    })

    if (!id) return

    const tn = getTinode()
    const topic = tn.getTopic(id)
    topic.onData = (msg: TinodeMessage) => {
      get()._addMessage(id, msg)
    }

    const loadTopic = async () => {
      try {
        if (!topic.isSubscribed()) {
          await topic.subscribe(
            topic.startMetaQuery()
              .withLaterDesc()
              .withLaterSub()
              .withLaterData(MESSAGES_PAGE)
              .build(),
          )
        }
        cacheTopicSubscribers(topic)

        const myUserId = tn.getCurrentUserID()
        const loaded: Message[] = []
        topic.messages((msg: TinodeMessage) => {
          loaded.push(tinodeMsgToMessage(id, msg, myUserId))
        })
        loaded.sort((a, b) => a.ts.getTime() - b.ts.getTime())
        const lastLoaded = loaded.length > 0 ? loaded[loaded.length - 1] : undefined
        set((state) => ({
          messages: { ...state.messages, [id]: loaded },
          chats: state.chats.map((chat) =>
            chat.id === id
              ? {
                  ...chat,
                  lastMessage: messageToPreview(lastLoaded) ?? chat.lastMessage,
                  lastMessageTs: lastLoaded?.ts ?? chat.lastMessageTs,
                }
              : chat,
          ),
        }))

        if ((topic.getDesc()?.unread ?? 0) > 0) {
          topic.noteRead()
        }
      } catch {
        // ignore topic load failures; user can retry by reopening chat
      }
    }

    void loadTopic()
  },

  deleteChat: async (chatId) => {
    const targetChatId = chatId || get().activeChatId
    if (!targetChatId) return

    const tn = getTinode()
    const target = get().chats.find((chat) => chat.id === targetChatId)
    if (!target?.botId) {
      const topic = tn.getTopic(targetChatId)
      if (topic?.isSubscribed()) {
        try {
          await topic.leave(true)
        } catch {
          // ignore leave errors; local deletion still applies
        }
      }
    }

    set((state) => {
      const nextChats = state.chats.filter((chat) => chat.id !== targetChatId)
      const nextMessages = { ...state.messages }
      delete nextMessages[targetChatId]
      const nextSearch = state.searchResults.filter((chat) => chat.id !== targetChatId)
      const wasActive = state.activeChatId === targetChatId
      return {
        chats: nextChats,
        messages: nextMessages,
        searchResults: nextSearch,
        activeChatId: wasActive ? null : state.activeChatId,
        view: wasActive ? 'chatList' : state.view,
      }
    })
  },

  goBack: () => set((state) => {
    const backToSettings = state.view === 'profile' || state.view === 'bots'
    return {
      view: backToSettings ? 'settings' : 'chatList',
      activeChatId: backToSettings ? state.activeChatId : null,
      showEmojiPicker: false,
      showStickerPicker: false,
    }
  }),

  openSearch: () => set({ view: 'search', searchQuery: '', searchResults: [], isSearching: false }),
  closeSearch: () => set({ view: 'chatList' }),

  openSettings: () => set({ view: 'settings' }),

  openProfile: () => set({ view: 'profile' }),

  openBots: () => set({ view: 'bots' }),

  openCreateGroupModal: () => set({ showCreateGroupModal: true }),

  closeCreateGroupModal: () => set({ showCreateGroupModal: false }),

  createGroup: (name, memberIds) => set((state) => {
    const cleanName = name.trim()
    if (!cleanName) return state

    const groupId = `grp_${Date.now()}`
    const nowTs = new Date()
    const uniqueMembers = Array.from(new Set(memberIds.filter(Boolean)))

    const newGroup: Chat = {
      id: groupId,
      name: cleanName,
      isGroup: true,
      membersCount: uniqueMembers.length + 1, // + current user
      online: false,
      unread: 0,
      pinned: false,
      muted: false,
      lastMessage: 'Р“СЂСѓРїРїР° СЃРѕР·РґР°РЅР°',
      lastMessageTs: nowTs,
    }

    const createdMessage: Message = {
      id: `msg_created_${Date.now()}`,
      chatId: groupId,
      senderId: CURRENT_USER_ID,
      senderName: 'Р’С‹',
      text: `РЎРѕР·РґР°РЅР° РіСЂСѓРїРїР° В«${cleanName}В»`,
      ts: nowTs,
      read: true,
    }

    const groupMembers: GroupMemberLite[] = [
      { id: CURRENT_USER_ID, name: 'Р’С‹' },
      ...uniqueMembers.map((memberId) => {
        const user = state.chats.find((chat) => chat.id === memberId)
        return { id: memberId, name: user?.name || memberId }
      }),
    ]

    return {
      chats: [newGroup, ...state.chats],
      messages: {
        ...state.messages,
        [groupId]: [createdMessage],
      },
      activeChatId: groupId,
      view: 'chat',
      showCreateGroupModal: false,
      groupSettings: {
        ...state.groupSettings,
        [groupId]: {
          icon: 'рџ‘Ґ',
          groupType: 'private',
          inviteLink: `https://app.lastochka-m.ru/invite/${groupId}`,
          members: groupMembers,
        },
      },
      showEmojiPicker: false,
      showStickerPicker: false,
    }
  }),

  openGroupSettingsModal: (groupId) => set((state) => {
    const chat = state.chats.find((item) => item.id === groupId)
    if (!chat?.isGroup) return state
    return {
      showGroupSettingsModal: true,
      activeGroupSettingsId: groupId,
    }
  }),

  closeGroupSettingsModal: () => set({
    showGroupSettingsModal: false,
    activeGroupSettingsId: null,
  }),

  updateGroupSettings: (groupId, patch) => set((state) => ({
    groupSettings: {
      ...state.groupSettings,
      [groupId]: {
        ...state.groupSettings[groupId],
        ...patch,
      },
    },
  })),

  addGroupMember: (groupId, userId) => set((state) => {
    const current = state.groupSettings[groupId]
    if (!current) return state
    if (current.members.some((member) => member.id === userId)) return state

    const user = state.chats.find((chat) => chat.id === userId)
    const nextMembers = [...current.members, { id: userId, name: user?.name || userId }]

    return {
      groupSettings: {
        ...state.groupSettings,
        [groupId]: {
          ...current,
          members: nextMembers,
        },
      },
      chats: state.chats.map((chat) =>
        chat.id === groupId ? { ...chat, membersCount: nextMembers.length } : chat,
      ),
    }
  }),

  removeGroupMember: (groupId, userId) => set((state) => {
    const current = state.groupSettings[groupId]
    if (!current) return state
    if (userId === CURRENT_USER_ID) return state

    const nextMembers = current.members.filter((member) => member.id !== userId)
    if (nextMembers.length === current.members.length) return state

    return {
      groupSettings: {
        ...state.groupSettings,
        [groupId]: {
          ...current,
          members: nextMembers,
        },
      },
      chats: state.chats.map((chat) =>
        chat.id === groupId ? { ...chat, membersCount: nextMembers.length } : chat,
      ),
    }
  }),

  regenerateGroupInviteLink: (groupId) => set((state) => ({
    groupSettings: {
      ...state.groupSettings,
      [groupId]: {
        ...state.groupSettings[groupId],
        inviteLink: `https://app.lastochka-m.ru/invite/${groupId}?t=${Date.now().toString(36)}`,
      },
    },
  })),

  setSearchQuery: (query) => set({
    searchQuery: query,
    ...(query.trim() ? {} : { searchResults: [], isSearching: false }),
  }),

  searchUsers: async (query) => {
    const normalizedQuery = query.trim()
    if (normalizedQuery.length < 2) {
      set({ searchResults: [], isSearching: false })
      return
    }

    set({ isSearching: true })
    const q = normalizedQuery.toLowerCase()
    const localMatches = get().chats.filter((chat) => doesChatMatchQuery(chat, q))

    const tn = getTinode()
    const fnd = tn.getFndTopic()
    const remoteMatches: Chat[] = []
    const remoteSeen = new Set<string>()
    const botMatches: Chat[] = []

    try {
      if (!fnd.isSubscribed()) {
        await fnd.subscribe(fnd.startMetaQuery().withSub().build())
      }

      const fndQueries = buildFndQueries(normalizedQuery)
      for (const qv of fndQueries) {
        await fnd.setMeta({ desc: { public: qv } })
        await (fnd as unknown as { getMeta: (query: unknown) => Promise<unknown> })
          .getMeta(fnd.startMetaQuery().withSub().build())
        fnd.contacts((sub: TinodeContact) => {
          if (!sub.topic || remoteSeen.has(sub.topic)) return
          remoteSeen.add(sub.topic)
          remoteMatches.push(contactToChat(sub))
        })
      }

      const ownerUserId = tn.getCurrentUserID()
      if (ownerUserId) {
        const bots = await listBots(ownerUserId)
        for (const bot of bots) {
          const existingChat = get().chats.find((chat) => {
            if (bot.tinode_user_id?.trim() && chat.id === bot.tinode_user_id.trim()) return true
            if (bot.tinode_topic?.trim() && chat.id === bot.tinode_topic.trim()) return true
            return false
          })
          const chat = botToSearchChat(bot, existingChat?.id)
          if (doesChatMatchQuery(chat, normalizedQuery)) {
            botMatches.push(chat)
          }
        }
      }
    } catch (err) {
      console.error('Search failed:', err)
    }

    const merged = [...localMatches]
    const seen = new Set(localMatches.map((chat) => chat.id))
    for (const chat of remoteMatches) {
      // Do not re-filter server-side matches. Tinode already matched them by tags,
      // but returned payload may not include login/phone fields used by local filter.
      if (!seen.has(chat.id)) {
        merged.push(chat)
        seen.add(chat.id)
      }
    }
    for (const chat of botMatches) {
      if (!seen.has(chat.id)) {
        merged.push(chat)
        seen.add(chat.id)
      } else {
        const idx = merged.findIndex((item) => item.id === chat.id)
        if (idx >= 0) {
          merged[idx] = mergeBotVisual(merged[idx], chat)
        }
      }
    }

    set({
      searchResults: merged,
      isSearching: false,
    })
  },

  updateGroupProfile: async (groupId, profile) => {
    const { name, description } = profile
    const nextName = name?.trim()
    const nextDescription = description?.trim()

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === groupId
          ? {
              ...chat,
              ...(typeof nextName === 'string' && nextName.length > 0 ? { name: nextName } : {}),
              ...(typeof nextDescription === 'string' ? { description: nextDescription } : {}),
            }
          : chat,
      ),
    }))

    try {
      const tn = getTinode()
      const topic = tn.getTopic(groupId)
      if (topic?.isSubscribed()) {
        await topic.setMeta({
          desc: {
            public: {
              ...(typeof nextName === 'string' && nextName.length > 0 ? { fn: nextName } : {}),
              ...(typeof nextDescription === 'string' ? { note: nextDescription } : {}),
            },
          },
        })
      }
    } catch (err) {
      console.error('Failed to update group profile:', err)
    }
  },

  toggleMute: (chatId) => {
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, muted: !chat.muted } : chat,
      ),
    }))
  },

  togglePin: (chatId) => {
    set((state) => {
      const toggled = state.chats.map((chat) =>
        chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat,
      )
      toggled.sort((a, b) => {
        const ap = a.pinned ? 1 : 0
        const bp = b.pinned ? 1 : 0
        if (ap !== bp) return bp - ap
        const at = a.lastMessageTs ? new Date(a.lastMessageTs).getTime() : 0
        const bt = b.lastMessageTs ? new Date(b.lastMessageTs).getTime() : 0
        return bt - at
      })
      return { chats: toggled }
    })
  },

  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

  setEmojiStyle: (style) => set({ emojiStyle: style }),

  initFromTinode: async () => {
    const tn = getTinode()
    const me = tn.getMeTopic()

    me.onContactUpdate = () => {
      get()._refreshContacts()
    }
    me.onSubsUpdated = () => {
      get()._refreshContacts()
    }

    try {
      if (!me.isSubscribed()) {
        await me.subscribe(
          me.startMetaQuery()
            .withLaterDesc()
            .withLaterSub()
            .withLaterData(1)
            .build(),
        )
      }
    } catch {
      // ignore subscribe errors, UI can still work with cached data
    }

    get()._refreshContacts()
  },

  cleanup: () => {
    set({
      chats: [],
      messages: {},
      activeChatId: null,
      searchResults: [],
      isSearching: false,
      showEmojiPicker: false,
      showStickerPicker: false,
      showCreateGroupModal: false,
      showGroupSettingsModal: false,
      view: 'chatList',
    })
  },

  _refreshContacts: () => {
    const tn = getTinode()
    const me = tn.getMeTopic()
    const nextChats: Chat[] = []
    const existingChats = get().chats
    const existingMessagesByChat = get().messages
    const previewCache = readChatPreviewCache()

    me.contacts((cont: TinodeContact) => {
      if (!cont.topic) return
      if (cont.topic.startsWith('usr')) {
        cacheUserDisplayName(cont.topic, contactDisplayName(cont))
      }
      const existing = existingChats.find((chat) => chat.id === cont.topic)
      const pinRank = typeof me.pinnedTopicRank === 'function' ? me.pinnedTopicRank(cont.topic) : 0
      const mapped = contactToChat(cont)
      const topicMessages = existingMessagesByChat[cont.topic]
      const lastLoaded = topicMessages && topicMessages.length > 0
        ? topicMessages[topicMessages.length - 1]
        : undefined
      const cached = previewCache[cont.topic]
      const cachedTs = cached?.lastMessageTs ? new Date(cached.lastMessageTs) : undefined
      nextChats.push({
        ...mapped,
        pinned: existing?.pinned ?? pinRank > 0,
        muted: existing?.muted ?? false,
        lastMessage: messageToPreview(lastLoaded) ?? existing?.lastMessage ?? cached?.lastMessage,
        lastMessageTs: lastLoaded?.ts ?? mapped.lastMessageTs ?? existing?.lastMessageTs ?? cachedTs,
        description: existing?.description,
        isBot: existing?.isBot ?? mapped.isBot,
        botId: existing?.botId,
      })
    })

    const sortedChats = sortChatsByPinnedAndTime(nextChats)
    set({ chats: sortedChats })

    sortedChats
      .filter((chat) => !chat.lastMessage)
      .slice(0, 30)
      .forEach((chat) => {
        void get()._hydrateChatPreview(chat.id)
      })
  },

  _hydrateChatPreview: async (topicId) => {
    if (!topicId || previewHydrationInFlight.has(topicId)) return
    previewHydrationInFlight.add(topicId)

    try {
      const tn = getTinode()
      const topic = tn.getTopic(topicId)

      if (!topic.isSubscribed()) {
        await topic.subscribe(
          topic.startMetaQuery()
            .withLaterData(1)
            .build(),
        )
      }

      cacheTopicSubscribers(topic)

      const myUserId = tn.getCurrentUserID()
      let latest: Message | undefined
      topic.messages((msg: TinodeMessage) => {
        const mapped = tinodeMsgToMessage(topicId, msg, myUserId)
        if (!latest || mapped.ts.getTime() > latest.ts.getTime()) {
          latest = mapped
        }
      })

      if (!latest) return
      const latestMsg = latest
      const latestPreview = messageToPreview(latestMsg)
      setChatPreviewCache(topicId, latestPreview, latestMsg.ts)

      set((state) => {
        const existing = state.messages[topicId] ?? []
        const hasMessage = existing.some((item) => item.id === latestMsg.id)
        const nextMessages = hasMessage
          ? existing
          : [...existing, latestMsg].sort((a, b) => a.ts.getTime() - b.ts.getTime())

        const nextChats = state.chats.map((chat) => {
          if (chat.id !== topicId) return chat
          const currentTs = chat.lastMessageTs ? new Date(chat.lastMessageTs).getTime() : 0
          const latestTs = latestMsg.ts.getTime()
          const shouldReplace = !chat.lastMessage || latestTs >= currentTs

          return {
            ...chat,
            lastMessage: shouldReplace ? (latestPreview ?? chat.lastMessage) : chat.lastMessage,
            lastMessageTs: latestTs >= currentTs ? latestMsg.ts : chat.lastMessageTs,
          }
        })

        return {
          messages: { ...state.messages, [topicId]: nextMessages },
          chats: sortChatsByPinnedAndTime(nextChats),
        }
      })
    } catch {
      // ignore preview hydration errors for individual chats
    } finally {
      previewHydrationInFlight.delete(topicId)
    }
  },

  _addMessage: (topicId, msg) => {
    const tn = getTinode()
    const myUserId = tn.getCurrentUserID()
    const mapped = tinodeMsgToMessage(topicId, msg, myUserId)

    set((state) => {
      const existing = state.messages[topicId] ?? []
      const exists = existing.some((item) => item.id === mapped.id)
      let nextMessages = existing

      if (!exists) {
        const optimisticIdx = mapped.seq
          ? existing.findIndex((item) =>
              !item.seq &&
              item.senderId === mapped.senderId &&
              (
                item.text === mapped.text ||
                normalizeMessageTextForEchoMatch(item.text) === normalizeMessageTextForEchoMatch(mapped.text)
              ) &&
              (item.imageUrl || '') === (mapped.imageUrl || '') &&
              (item.stickerId || '') === (mapped.stickerId || ''),
            )
          : -1

        if (optimisticIdx >= 0) {
          // Replace optimistic local echo with the authoritative server message.
          const optimistic = existing[optimisticIdx]
          const shouldKeepOptimisticText = normalizeMessageTextForEchoMatch(optimistic.text) === normalizeMessageTextForEchoMatch(mapped.text)
          nextMessages = [...existing]
          nextMessages[optimisticIdx] = {
            ...mapped,
            text: shouldKeepOptimisticText ? optimistic.text : mapped.text,
            reactions: optimistic.reactions && optimistic.reactions.length ? optimistic.reactions : mapped.reactions,
          }
        } else {
          nextMessages = [...existing, mapped]
        }
      }

      return {
        messages: { ...state.messages, [topicId]: nextMessages },
        chats: state.chats.map((chat) =>
          chat.id === topicId
            ? {
                ...chat,
                lastMessage: messageToPreview(mapped) || 'РЎРѕРѕР±С‰РµРЅРёРµ',
                lastMessageTs: mapped.ts,
              }
            : chat,
        ),
      }
    })
    setChatPreviewCache(topicId, messageToPreview(mapped), mapped.ts)
  },

  sendMessage: async (text, imageFile, stickerId, draftyContent) => {
    const { activeChatId } = get()
    if (!activeChatId) return

    const nowTs = new Date()
    const safeText = text.trim()
    const tn = getTinode()
    const activeChat = get().chats.find((chat) => chat.id === activeChatId)

    if (activeChat?.botId) {
      if (!safeText) return
      const botId = activeChat.botId
      const ownerUserId = tn.getCurrentUserID()
      if (!botId || !ownerUserId) return

      const optimisticMsg: Message = {
        id: `msg_${Date.now()}`,
        chatId: activeChatId,
        senderId: CURRENT_USER_ID,
        senderName: 'Р’С‹',
        text: safeText,
        ts: nowTs,
        read: false,
      }

      set((state) => {
        const chatMessages = state.messages[activeChatId] || []
        return {
          messages: { ...state.messages, [activeChatId]: [...chatMessages, optimisticMsg] },
          chats: state.chats.map((chat) =>
            chat.id === activeChatId
              ? { ...chat, lastMessage: toChatPreviewText(safeText), lastMessageTs: nowTs }
              : chat,
          ),
        }
      })

      try {
        await createIncomingUpdate(ownerUserId, botId, {
          chat_id: activeChatId,
          text: safeText,
        })
      } catch (err) {
        console.error('Bot message send failed:', err)
      }
      return
    }

    const topic = tn.getTopic(activeChatId)

    if (!topic) return
    if (!topic.isSubscribed()) {
      try {
        await topic.subscribe(
          topic.startMetaQuery()
            .withLaterDesc()
            .withLaterSub()
            .withLaterData(MESSAGES_PAGE)
            .build(),
        )
      } catch {
        return
      }
    }

    // Handle image upload
    if (imageFile) {
      try {
        const uploadResult = await uploadFile(imageFile)
        const imageContent = createImageDrafty(
          text,
          uploadResult.ref,
          imageFile.type,
          uploadResult.width,
          uploadResult.height
        )
        
        // Optimistic UI: add message immediately
        const optimisticMsg: Message = {
          id: `msg_${Date.now()}`,
          chatId: activeChatId,
          senderId: CURRENT_USER_ID,
          senderName: 'Р’С‹',
          text,
          imageUrl: getFileUrl(uploadResult.ref),
          ts: nowTs,
          read: false,
        }

        set((state) => {
          const chatMessages = state.messages[activeChatId] || []
          return {
            messages: { ...state.messages, [activeChatId]: [...chatMessages, optimisticMsg] },
            chats: state.chats.map((chat) =>
              chat.id === activeChatId
                ? { ...chat, lastMessage: toChatPreviewText(text) || 'рџ“· Р¤РѕС‚Рѕ', lastMessageTs: nowTs }
                : chat
            ),
          }
        })

        const draft = topic.createMessage('', false) as Record<string, unknown>
        draft.content = imageContent
        await topic.publishMessage(draft)
      } catch (err) {
        console.error('Image send failed:', err)
        // TODO: show error toast
      }
      return
    }

    // Handle sticker (TODO: implement sticker sending)
    if (stickerId) {
      const optimisticMsg: Message = {
        id: `msg_${Date.now()}`,
        chatId: activeChatId,
        senderId: CURRENT_USER_ID,
        senderName: 'Р’С‹',
        text: '',
        stickerId,
        ts: nowTs,
        read: false,
      }

      set((state) => {
        const chatMessages = state.messages[activeChatId] || []
        return {
          messages: { ...state.messages, [activeChatId]: [...chatMessages, optimisticMsg] },
          chats: state.chats.map((chat) =>
            chat.id === activeChatId
              ? { ...chat, lastMessage: 'рџ™‚ РЎС‚РёРєРµСЂ', lastMessageTs: nowTs }
              : chat,
          ),
        }
      })

      try {
        const stickerDraft = topic.createMessage(stickerId, false) as Record<string, unknown>
        const withStickerHead = {
          ...stickerDraft,
          head: {
            ...((stickerDraft.head as Record<string, unknown>) || {}),
            sticker: stickerId,
          },
        }
        await topic.publishMessage(withStickerHead)
      } catch (err) {
        console.error('Sticker message failed:', err)
      }
      return
    }

    // Handle plain text
    if (!safeText) return

    // Optimistic UI: add message immediately
    const optimisticMsg: Message = {
      id: `msg_${Date.now()}`,
      chatId: activeChatId,
      senderId: CURRENT_USER_ID,
      senderName: 'Р’С‹',
      text: safeText,
      ts: nowTs,
      read: false,
    }

    set((state) => {
      const chatMessages = state.messages[activeChatId] || []
      return {
        messages: { ...state.messages, [activeChatId]: [...chatMessages, optimisticMsg] },
        chats: state.chats.map((chat) =>
          chat.id === activeChatId
            ? { ...chat, lastMessage: toChatPreviewText(safeText), lastMessageTs: nowTs }
            : chat
        ),
      }
    })

    const plainDraft = topic.createMessage(safeText, false) as Record<string, unknown>
    if (draftyContent && typeof draftyContent === 'object') {
      plainDraft.content = draftyContent
    }
    await topic.publishMessage(plainDraft).catch(() => {
      // keep optimistic UI, avoid breaking UX on transient network errors
    })
  },

  addReaction: (messageId, emoji) => set((state) => {
    const { activeChatId, messages } = state
    if (!activeChatId) return state

    const updatedMessages = {
      ...messages,
      [activeChatId]: messages[activeChatId]?.map((msg) => {
        if (msg.id !== messageId) return msg
        const existingReactions = msg.reactions || []
        const alreadyExists = existingReactions.some((r) => r.emoji === emoji && r.userId === CURRENT_USER_ID)
        if (alreadyExists) return msg

        const nextReactions = [...existingReactions, { emoji, userId: CURRENT_USER_ID, userName: 'Вы' }]
        setCachedReactions(msg.id, nextReactions)
        return {
          ...msg,
          reactions: nextReactions,
        }
      }) || [],
    }

    return { messages: updatedMessages }
  }),

  removeReaction: (messageId, emoji) => set((state) => {
    const { activeChatId, messages } = state
    if (!activeChatId) return state

    const updatedMessages = {
      ...messages,
      [activeChatId]: messages[activeChatId]?.map((msg) => {
        if (msg.id !== messageId) return msg
        const nextReactions = msg.reactions?.filter(
          (r) => !(r.emoji === emoji && r.userId === CURRENT_USER_ID)
        ) || []
        setCachedReactions(msg.id, nextReactions)
        return {
          ...msg,
          reactions: nextReactions,
        }
      }) || [],
    }

    return { messages: updatedMessages }
  }),

  setShowEmojiPicker: (show) => set({ showEmojiPicker: show, showStickerPicker: false }),
  setShowStickerPicker: (show) => set({ showStickerPicker: show, showEmojiPicker: false }),
  setShowImagePicker: (show) => set({ showImagePicker: show }),
  setSelectedStickerPack: (packId) => set({ selectedStickerPack: packId }),
  setFullscreenImage: (url) => set({ fullscreenImage: url }),

  // Reply/Edit actions
  startReply: (messageId) => set({ replyToId: messageId }),
  startEdit: (messageId) => set({ editingMessageId: messageId }),

  editMessage: async (messageId, newText, draftyContent) => {
    const { activeChatId, messages } = get()
    if (!activeChatId || !newText.trim()) return

    const msg = messages[activeChatId]?.find((m) => m.id === messageId)
    if (!msg || !msg.seq) return

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)
    if (!topic || !topic.isSubscribed()) return

    // Update local state optimistically
    set((state) => ({
      messages: {
        ...state.messages,
        [activeChatId]: state.messages[activeChatId]?.map((m) =>
          m.id === messageId ? { ...m, text: newText.trim(), edited: true } : m
        ) || [],
      },
      editingMessageId: null,
    }))

    // Send edited message via Tinode (re-publish with same seq)
    try {
      const editedContent = topic.createMessage(newText.trim(), false) as Record<string, unknown>
      if (draftyContent && typeof draftyContent === 'object') {
        editedContent.content = draftyContent
      }
      await topic.publishMessage(editedContent)
    } catch (err) {
      console.error('Edit message failed:', err)
    }
  },

  deleteMessage: async (messageId, hard = false) => {
    const { activeChatId, messages } = get()
    if (!activeChatId) return

    const msg = messages[activeChatId]?.find((m) => m.id === messageId)
    if (!msg || !msg.seq) return

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)
    if (!topic || !topic.isSubscribed()) return

    // Optimistic update
    set((state) => ({
      messages: {
        ...state.messages,
        [activeChatId]: state.messages[activeChatId]?.filter((m) => m.id !== messageId) || [],
      },
    }))

    // Delete on server
    try {
      await topic.del([msg.seq], hard)
    } catch (err) {
      console.error('Delete message failed:', err)
      // Revert optimistic update (optional, could reload from server)
    }
  },

  replyToMessage: async (messageId, text, draftyContent) => {
    const { activeChatId, messages } = get()
    if (!activeChatId || !text.trim()) return

    const originalMsg = messages[activeChatId]?.find((m) => m.id === messageId)
    if (!originalMsg) return

    const nowTs = new Date()
    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)
    if (!topic || !topic.isSubscribed()) return

    // Create message with reply info in head
    const content = topic.createMessage(text.trim(), false) as Record<string, unknown>
    if (draftyContent && typeof draftyContent === 'object') {
      content.content = draftyContent
    }
    
    // Add reply reference to message head (Tinode supports this)
    const msgWithReply = {
      ...content,
      head: {
        ...((content.head as Record<string, unknown>) || {}),
        reply: messageId,
      },
    }

    // Optimistic UI
    const optimisticMsg: Message = {
      id: `msg_${Date.now()}`,
      chatId: activeChatId,
      senderId: CURRENT_USER_ID,
      senderName: 'Р’С‹',
      text,
      ts: nowTs,
      read: false,
      replyTo: {
        seq: originalMsg.seq || 0,
        senderName: originalMsg.senderName || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ',
        text: originalMsg.text.substring(0, 50) + (originalMsg.text.length > 50 ? '...' : ''),
      },
    }

    set((state) => {
      const chatMessages = state.messages[activeChatId] || []
      return {
        messages: { ...state.messages, [activeChatId]: [...chatMessages, optimisticMsg] },
        chats: state.chats.map((chat) =>
          chat.id === activeChatId
            ? { ...chat, lastMessage: toChatPreviewText(text), lastMessageTs: nowTs }
            : chat
        ),
        replyToId: null,
      }
    })

    try {
      await topic.publishMessage(msgWithReply)
    } catch (err) {
      console.error('Reply message failed:', err)
    }
  },
}))



