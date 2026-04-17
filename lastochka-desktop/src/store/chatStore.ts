import { create } from 'zustand'
import type { Chat, Message, Reaction, StickerPack } from '@/types'
import { contactDisplayName, draftyToText, getAvatarUrl, getTinode, createImageDrafty, uploadFile, getFileUrl } from '@/lib/tinode-client'
import type { TinodeContact, TinodeMessage } from '@/lib/tinode-client'

// ─── Mock Data (removed - using real Tinode data only) ───────────
// Mock data has been removed. All data now comes from Tinode server.

const CURRENT_USER_ID = 'usr_me'

// Number of messages to load per page (imported from tinode-client)
const MESSAGES_PAGE = 24

const PHONE_DIGITS_REGEX = /\D/g
const userDisplayNameCache = new Map<string, string>()

function cacheUserDisplayName(userId?: string, name?: string) {
  if (!userId || !name) return
  const cleanName = name.trim()
  if (!cleanName || cleanName === userId) return
  userDisplayNameCache.set(userId, cleanName)
}

function resolveSenderName(senderId: string, myUserId: string): string {
  if (!senderId || senderId === myUserId || senderId === CURRENT_USER_ID) {
    return 'Вы'
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
    pinned: false,
    muted: false,
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
  const text = draftyToText(content)
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
  }
}

// ─── Chat Store ──────────────────────────────────────────────────

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
  view: 'chatList' | 'chat' | 'search' | 'settings' | 'profile'
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
  goBack: () => void
  openSearch: () => void
  closeSearch: () => void
  openSettings: () => void
  openProfile: () => void
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
  sendMessage: (text: string, imageFile?: File, stickerId?: string) => Promise<void>
  editMessage: (messageId: string, newText: string) => Promise<void>
  deleteMessage: (messageId: string, hard?: boolean) => Promise<void>
  replyToMessage: (messageId: string, text: string) => Promise<void>
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
    icon: '👥',
    groupType: 'private',
    inviteLink: 'https://app.lastochka-m.ru/invite/grp_team',
    members: [
      { id: 'usr_me', name: 'Вы' },
      { id: 'usr_max', name: 'Макс' },
      { id: 'usr_anna', name: 'Анна' },
      { id: 'usr_alice', name: 'Алиса Иванова' },
    ],
  },
  grp_family: {
    icon: '❤️',
    groupType: 'private',
    inviteLink: 'https://app.lastochka-m.ru/invite/grp_family',
    members: [
      { id: 'usr_me', name: 'Вы' },
      { id: 'usr_mom', name: 'Мама' },
      { id: 'usr_bob', name: 'Борис Петров' },
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
      name: 'Весёлые',
      coverUrl: '😄',
      stickers: [
        { id: 'funny-1', pack: 'funny', url: '😄', emoji: '😄' },
        { id: 'funny-2', pack: 'funny', url: '😂', emoji: '😂' },
        { id: 'funny-3', pack: 'funny', url: '🤣', emoji: '🤣' },
        { id: 'funny-4', pack: 'funny', url: '😎', emoji: '😎' },
        { id: 'funny-5', pack: 'funny', url: '🤩', emoji: '🤩' },
        { id: 'funny-6', pack: 'funny', url: '🥳', emoji: '🥳' },
      ],
    },
    {
      id: 'love',
      name: 'Лайк и любовь',
      coverUrl: '❤️',
      stickers: [
        { id: 'love-1', pack: 'love', url: '❤️', emoji: '❤️' },
        { id: 'love-2', pack: 'love', url: '🫶', emoji: '🫶' },
        { id: 'love-3', pack: 'love', url: '😍', emoji: '😍' },
        { id: 'love-4', pack: 'love', url: '😘', emoji: '😘' },
        { id: 'love-5', pack: 'love', url: '🔥', emoji: '🔥' },
        { id: 'love-6', pack: 'love', url: '👍', emoji: '👍' },
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
        set((state) => ({
          messages: { ...state.messages, [id]: loaded },
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

  goBack: () => set({
    view: 'chatList',
    activeChatId: null,
    showEmojiPicker: false,
    showStickerPicker: false,
  }),

  openSearch: () => set({ view: 'search', searchQuery: '', searchResults: [], isSearching: false }),
  closeSearch: () => set({ view: 'chatList' }),

  openSettings: () => set({ view: 'settings' }),

  openProfile: () => set({ view: 'profile' }),

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
      lastMessage: 'Группа создана',
      lastMessageTs: nowTs,
    }

    const createdMessage: Message = {
      id: `msg_created_${Date.now()}`,
      chatId: groupId,
      senderId: CURRENT_USER_ID,
      senderName: 'Вы',
      text: `Создана группа «${cleanName}»`,
      ts: nowTs,
      read: true,
    }

    const groupMembers: GroupMemberLite[] = [
      { id: CURRENT_USER_ID, name: 'Вы' },
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
          icon: '👥',
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

    me.contacts((cont: TinodeContact) => {
      if (!cont.topic) return
      if (cont.topic.startsWith('usr')) {
        cacheUserDisplayName(cont.topic, contactDisplayName(cont))
      }
      const existing = existingChats.find((chat) => chat.id === cont.topic)
      const pinRank = typeof me.pinnedTopicRank === 'function' ? me.pinnedTopicRank(cont.topic) : 0
      nextChats.push({
        ...contactToChat(cont),
        pinned: existing?.pinned ?? pinRank > 0,
        muted: existing?.muted ?? false,
        description: existing?.description,
      })
    })

    nextChats.sort((a, b) => {
      const ap = a.pinned ? 1 : 0
      const bp = b.pinned ? 1 : 0
      if (ap !== bp) return bp - ap
      const at = a.lastMessageTs ? new Date(a.lastMessageTs).getTime() : 0
      const bt = b.lastMessageTs ? new Date(b.lastMessageTs).getTime() : 0
      return bt - at
    })

    set({ chats: nextChats })
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
              item.text === mapped.text &&
              (item.imageUrl || '') === (mapped.imageUrl || '') &&
              (item.stickerId || '') === (mapped.stickerId || ''),
            )
          : -1

        if (optimisticIdx >= 0) {
          // Replace optimistic local echo with the authoritative server message.
          nextMessages = [...existing]
          nextMessages[optimisticIdx] = mapped
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
                lastMessage: mapped.text || (mapped.imageUrl ? '📷 Фото' : 'Сообщение'),
                lastMessageTs: mapped.ts,
              }
            : chat,
        ),
      }
    })
  },

  sendMessage: async (text, imageFile, stickerId) => {
    const { activeChatId } = get()
    if (!activeChatId) return

    const nowTs = new Date()
    const tn = getTinode()
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
          senderName: 'Вы',
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
                ? { ...chat, lastMessage: text || '📷 Фото', lastMessageTs: nowTs }
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
        senderName: 'Вы',
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
              ? { ...chat, lastMessage: '🙂 Стикер', lastMessageTs: nowTs }
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
    const safeText = text.trim()
    if (!safeText) return

    // Optimistic UI: add message immediately
    const optimisticMsg: Message = {
      id: `msg_${Date.now()}`,
      chatId: activeChatId,
      senderId: CURRENT_USER_ID,
      senderName: 'Вы',
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
            ? { ...chat, lastMessage: safeText, lastMessageTs: nowTs }
            : chat
        ),
      }
    })

    await topic.publishMessage(topic.createMessage(safeText, false)).catch(() => {
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

        return {
          ...msg,
          reactions: [...existingReactions, { emoji, userId: CURRENT_USER_ID, userName: 'Вы' }],
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
        return {
          ...msg,
          reactions: msg.reactions?.filter(
            (r) => !(r.emoji === emoji && r.userId === CURRENT_USER_ID)
          ) || [],
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

  editMessage: async (messageId, newText) => {
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
      const editedContent = topic.createMessage(newText.trim(), false)
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

  replyToMessage: async (messageId, text) => {
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
      senderName: 'Вы',
      text,
      ts: nowTs,
      read: false,
      replyTo: {
        seq: originalMsg.seq || 0,
        senderName: originalMsg.senderName || 'Пользователь',
        text: originalMsg.text.substring(0, 50) + (originalMsg.text.length > 50 ? '...' : ''),
      },
    }

    set((state) => {
      const chatMessages = state.messages[activeChatId] || []
      return {
        messages: { ...state.messages, [activeChatId]: [...chatMessages, optimisticMsg] },
        chats: state.chats.map((chat) =>
          chat.id === activeChatId
            ? { ...chat, lastMessage: text, lastMessageTs: nowTs }
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
