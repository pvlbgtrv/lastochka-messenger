import { create } from 'zustand'
import type { Chat, Message } from '@/types'
import {
  getTinode,
  contactDisplayName,
  draftyToText,
  MESSAGES_PAGE,
  getAvatarUrl,
  hasImageAttachment,
  extractImageInfo,
  createImageDrafty,
  getFileUrl,
} from '@/lib/tinode-client'
import type { TinodeContact, TinodeMessage } from '@/lib/tinode-client'
import { useGroupsStore } from '@/store/groups'
import { uploadFile, compressImage } from '@/lib/image-upload'

interface ChatStore {
  chats: Chat[]
  messages: Record<string, Message[]>
  activeChatId: string | null
  searchQuery: string
  searchResults: Chat[]
  isSearching: boolean
  darkMode: boolean
  isLoadingMessages: boolean
  isLoadingMoreMessages: boolean
  hasMoreMessages: Record<string, boolean>
  playSound: boolean

  // Reply state
  replyToMessage: Message | null

  // Context menu state
  contextMenuMessage: Message | null
  contextMenuPosition: { x: number; y: number } | null

  // Inline editing state
  editingMessage: Message | null

  // Forwarding state
  forwardingMessage: Message | null

  // Voice recording state
  voiceBlob: Blob | null
  voiceDuration: number
  voiceAudioUrl: string | null

  // Image upload state
  isSendingImage: boolean
  imageUploadProgress: number
  imagePreview: string | null  // data URL для превью перед отправкой

  // Typing indicators: topicId -> Set of userIds who are typing
  typingUsers: Record<string, Set<string>>
  // Typing display names cache: userId -> displayName
  typingNames: Record<string, string>

  // Actions
  setActiveChat: (id: string | null) => void
  setSearchQuery: (q: string) => void
  searchUsers: (query: string) => Promise<void>
  sendMessage: (text: string) => void
  sendImageMessage: (file: File) => Promise<void>
  setImagePreview: (preview: string | null) => void
  setTypingUser: (topicId: string, userId: string, displayName: string) => void
  clearTypingUser: (topicId: string, userId: string) => void
  toggleDarkMode: () => void
  loadMoreMessages: () => Promise<void>
  markMessagesAsRead: (topicId: string) => void
  sendTypingNotification: (topicId: string) => void
  toggleSound: () => void

  // Reply actions
  setReplyTo: (msg: Message | null) => void

  // Context menu actions
  setContextMenuMessage: (msg: Message | null, position?: { x: number; y: number }) => void

  // Inline editing
  setEditingMessage: (msg: Message | null) => void
  startEditing: (msg: Message) => void
  cancelEditing: () => void
  submitEdit: (newText: string) => Promise<void>

  // Message operations
  deleteMessage: (msg: Message) => Promise<void>
  editMessage: (msg: Message, newText: string) => Promise<void>

  // Chat settings
  toggleMute: (chatId: string) => void
  togglePin: (chatId: string) => void

  // Forwarding
  startForward: (msg: Message) => void
  cancelForward: () => void
  forwardTo: (targetChatId: string) => Promise<void>

  // Voice
  setVoiceRecording: (blob: Blob | null, duration: number, audioUrl: string | null) => void
  sendVoiceMessage: () => Promise<void>
  cancelVoiceRecording: () => void

  // Called by auth store after login
  initFromTinode: () => void
  // Called by auth store on logout
  cleanup: () => void

  // Internal — called by Tinode callbacks
  _refreshContacts: () => void
  _addMessage: (topicId: string, msg: TinodeMessage) => void
  _playNotificationSound: () => void
}

// Map a Tinode contact to our Chat type
function contactToChat(cont: TinodeContact, pinnedRank = 0): Chat {
  return {
    id: cont.topic,
    name: contactDisplayName(cont),
    avatar: getAvatarUrl(cont.public?.photo),
    lastMessageTs: cont.touched ?? undefined,
    unread: cont.unread ?? 0,
    online: cont.online ?? false,
    isOnline: cont.online ?? false,
    isGroup: cont.topic?.startsWith('grp') ?? false,
    pinned: pinnedRank > 0,
    muted: false,
  }
}

/**
 * Parse Drafty content from string or object.
 * Tinode SDK may send content as a JSON string.
 */
function parseDraftyContent(content: unknown): Record<string, unknown> {
  if (!content) return {}
  if (typeof content === 'object') return content as Record<string, unknown>
  // Try parsing JSON string
  try {
    return JSON.parse(content as string)
  } catch {
    return {}
  }
}

// Map a Tinode message to our Message type
function tinodeMsgToMessage(topicId: string, msg: TinodeMessage, myUserId: string): Message {
  // from is undefined when SDK fires _routeData locally (before server echo)
  const senderId = (!msg.from || msg.from === myUserId) ? 'me' : msg.from

  // Parse content (may be string or object)
  const parsedContent = parseDraftyContent(msg.content)

  // Debug: log messages with entities (images, audio)
  if (parsedContent.ent && Array.isArray(parsedContent.ent) && parsedContent.ent.length > 0) {
    console.log('[tinode-msg] Message with entities:', {
      topicId,
      seq: msg.seq,
      from: msg.from,
      content: parsedContent,
    })
  }

  // Extract reply info from message headers
  const head = (msg as any).head as Record<string, unknown> | undefined
  const replyTo = head?.reply
    ? {
        seq: parseInt(head.reply as string, 10),
        senderName: (head.replyName as string) || 'Пользователь',
        text: (head.replyText as string) || '[сообщение]',
      }
    : undefined

  // Extract image info from Drafty content
  const imageInfo = extractImageInfo(parsedContent)
  const hasImage = hasImageAttachment(parsedContent)

  // Extract audio info from Drafty content
  let audioAttachment: { url: string; duration?: number } | undefined
  try {
    const ent = parsedContent.ent as Array<Record<string, unknown>> | undefined
    if (ent) {
      for (const e of ent) {
        const mime = (e.mime as string) || ''
        if (mime.startsWith('audio/') && e.ref) {
          audioAttachment = {
            url: getFileUrl(e.ref as string) || (e.ref as string),
            duration: e.duration as number | undefined,
          }
          break
        }
      }
    }
  } catch { /* ignore */ }

  return {
    id: `${topicId}-${msg.seq}`,
    chatId: topicId,
    senderId,
    text: hasImage ? (draftyToText(msg.content) || '📷 Изображение') : draftyToText(msg.content),
    ts: msg.ts,
    read: true,
    edited: !!head?.replace,
    seq: msg.seq,
    replyTo,
    imageUrl: imageInfo?.url,
    imageWidth: imageInfo?.width,
    imageHeight: imageInfo?.height,
    hasMedia: hasImage || !!audioAttachment,
    duration: audioAttachment?.duration,
    attachments: audioAttachment ? [{
      type: 'audio' as const,
      name: 'voice.ogg',
      url: audioAttachment.url,
    }] : undefined,
  }
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  messages: {},
  activeChatId: null,
  searchQuery: '',
  searchResults: [],
  isSearching: false,
  darkMode: false,
  isLoadingMessages: false,
  isLoadingMoreMessages: false,
  hasMoreMessages: {},
  playSound: true,
  replyToMessage: null,
  contextMenuMessage: null,
  contextMenuPosition: null,
  editingMessage: null,
  forwardingMessage: null,
  voiceBlob: null,
  voiceDuration: 0,
  voiceAudioUrl: null,
  isSendingImage: false,
  imageUploadProgress: 0,
  imagePreview: null,
  typingUsers: {},
  typingNames: {},

  // ─── Sound notification ─────────────────────────────────────────────────────

  _playNotificationSound: () => {
    if (!get().playSound) return
    
    // Simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.15)
    } catch (err) {
      console.error('Failed to play notification sound', err)
    }
  },

  toggleSound: () => {
    set((s) => ({ playSound: !s.playSound }))
  },

  // ─── Image preview ──────────────────────────────────────────────────────────

  setImagePreview: (preview) => {
    set({ imagePreview: preview })
  },

  // ─── Typing indicators ──────────────────────────────────────────────────────

  setTypingUser: (topicId, userId, displayName) => {
    set((s) => {
      const existing = s.typingUsers[topicId] || new Set<string>()
      existing.add(userId)
      return {
        typingUsers: { ...s.typingUsers, [topicId]: new Set(existing) },
        typingNames: { ...s.typingNames, [userId]: displayName },
      }
    })

    // Auto-clear after 3 seconds (same as Android)
    setTimeout(() => {
      get().clearTypingUser(topicId, userId)
    }, 3000)
  },

  clearTypingUser: (topicId, userId) => {
    set((s) => {
      const existing = s.typingUsers[topicId]
      if (!existing) return s
      const next = new Set(existing)
      next.delete(userId)
      return {
        typingUsers: { ...s.typingUsers, [topicId]: next },
      }
    })
  },

  // ─── Send image message ─────────────────────────────────────────────────────

  sendImageMessage: async (file: File) => {
    console.log('[chatStore] sendImageMessage called with:', file.name, file.size, file.type)
    const { activeChatId, replyToMessage } = get()
    console.log('[chatStore] activeChatId:', activeChatId, 'replyToMessage:', replyToMessage?.id)
    if (!activeChatId) {
      console.error('[chatStore] No activeChatId!')
      return
    }

    set({ isSendingImage: true, imageUploadProgress: 0, imagePreview: null })

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)

    if (!topic.isSubscribed()) {
      console.warn('Cannot send image: topic not subscribed')
      set({ isSendingImage: false })
      return
    }

    try {
      // 1. Compress image
      const { blob, width, height } = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        skipIfBelow: 1_048_576, // 1MB
      })

      // Create a File from blob (for upload)
      const fileToUpload = new File([blob], file.name || 'image.jpg', { type: 'image/jpeg' })

      // 2. Upload to server (same as Android — via HTTP multipart POST)
      console.log('[sendImage] Uploading file to server...')
      const uploadResult = await uploadFile(fileToUpload, async (progress) => {
        set({ imageUploadProgress: progress })
      })
      console.log('[sendImage] Upload success:', uploadResult.url)

      // 3. Create Drafty content with ref (URL) — same format as Android
      const draftyContent = createImageDrafty(
        '',
        uploadResult.url,
        'image/jpeg',
        width || undefined,
        height || undefined,
      )

      // 4. Create a message draft
      const draft = topic.createMessage('', false) as any

      // Replace the content with our image Drafty
      draft.content = draftyContent

      // Add reply header if replying
      if (replyToMessage && replyToMessage.seq) {
        if (!draft.head) draft.head = {}
        draft.head.reply = String(replyToMessage.seq)
        draft.head.reply_name = replyToMessage.senderName || ''
        draft.head.reply_text = replyToMessage.text.slice(0, 200)
      }

      // 5. Add optimistic message to UI immediately (use blob URL for preview)
      const optimisticId = `optimistic-${Date.now()}`
      const previewUrl = URL.createObjectURL(blob)
      const optimisticMsg: Message = {
        id: optimisticId,
        chatId: activeChatId,
        senderId: 'me',
        text: '[Изображение]',
        ts: new Date(),
        read: false,
        imageUrl: previewUrl,
        imageWidth: width || undefined,
        imageHeight: height || undefined,
        uploadProgress: 1,
      }

      console.log('[sendImage] Adding optimistic message:', optimisticId)

      set((s) => ({
        messages: {
          ...s.messages,
          [activeChatId]: [...(s.messages[activeChatId] ?? []), optimisticMsg],
        },
        replyToMessage: null,
      }))

      // 6. Publish via WebSocket
      console.log('[sendImage] Calling topic.publishMessage(draft)')
      try {
        await topic.publishMessage(draft)
        console.log('[sendImage] publishMessage succeeded')
      } catch (pubErr) {
        console.error('[sendImage] publishMessage FAILED:', pubErr)
      }

      // 7. Update chat preview
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === activeChatId
            ? { ...c, lastMessage: '📷 Изображение', lastMessageTs: new Date() }
            : c,
        ),
      }))
    } catch (err) {
      console.error('Failed to send image', err)
      // Mark the last message as failed if it was optimistic
      set((s) => {
        const msgs = s.messages[activeChatId] ?? []
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg?.id.startsWith('optimistic-')) {
          return {
            messages: {
              ...s.messages,
              [activeChatId]: msgs.map((m) =>
                m.id === lastMsg.id ? { ...m, uploadFailed: true } : m
              ),
            },
          }
        }
        return {}
      })
    } finally {
      set({ isSendingImage: false, imageUploadProgress: 0 })
    }
  },

  // ─── Public actions ─────────────────────────────────────────────────────────

  setSearchQuery: (q) => set({ searchQuery: q, searchResults: [] }),

  searchUsers: async (query: string) => {
    if (query.length < 3) {
      set({ searchResults: [], isSearching: false })
      return
    }
    set({ isSearching: true })
    const tn = getTinode()
    const fnd = tn.getFndTopic()
    try {
      if (!fnd.isSubscribed()) {
        await fnd.subscribe(fnd.startMetaQuery().withSub().withDesc().build())
      }
      await fnd.setMeta({ desc: { public: query } })
      const results: Chat[] = []
      fnd.contacts((sub: TinodeContact) => {
        const id = sub.topic || sub.name || ''
        if (!id) return
        results.push(contactToChat(sub))
      })
      set({ searchResults: results, isSearching: false })
    } catch (err) {
      console.error('Search failed', err)
      set({ isSearching: false })
    }
  },

  toggleDarkMode: () => {
    const next = !get().darkMode
    document.documentElement.classList.toggle('dark', next)
    set({ darkMode: next })
  },

  setActiveChat: async (id) => {
    const prev = get().activeChatId
    set({ activeChatId: id })

    if (!id || id === prev) return

    const tn = getTinode()
    const topic = tn.getTopic(id)

    // Register message callback
    topic.onData = (msg: TinodeMessage) => {
      get()._addMessage(id, msg)
    }

    // Register info callback for typing indicators
    topic.onInfo = (info: unknown) => {
      const msg = info as Record<string, unknown>
      if (msg.what === 'kp' && msg.from && msg.from !== tn.getCurrentUserID()) {
        // Someone is typing
        const displayName = contactDisplayName({ topic: msg.topic as string } as TinodeContact)
        get().setTypingUser(id, msg.from as string, displayName)
      }
    }

    // Subscribe and load last N messages if not already subscribed
    if (!topic.isSubscribed()) {
      set({ isLoadingMessages: true })
      try {
        const getQuery = topic.startMetaQuery()
          .withLaterDesc()
          .withLaterSub()
          .withLaterData(MESSAGES_PAGE)
          .withLaterDel()
          .build()
        await topic.subscribe(getQuery)

        // Mark messages as read when opening chat
        if (((topic as any).getDesc()?.unread ?? 0) > 0) {
          topic.noteRead()
        }
      } catch (err) {
        console.error('Failed to subscribe to topic', id, err)
      } finally {
        set({ isLoadingMessages: false })
      }
    } else {
      // Already subscribed - just mark as read
      if ((topic.getDesc()?.unread ?? 0) > 0) {
        topic.noteRead()
      }
    }

    // Load existing cached messages
    const msgs: Message[] = []
    const myUserId = tn.getCurrentUserID()
    topic.messages((msg) => {
      msgs.push(tinodeMsgToMessage(id, msg, myUserId))
    })
    
    // Check if there are more messages to load
    const hasMore = msgs.length >= MESSAGES_PAGE
    
    set((s) => ({ 
      messages: { ...s.messages, [id]: msgs },
      hasMoreMessages: { ...s.hasMoreMessages, [id]: hasMore }
    }))
  },

  sendMessage: async (text) => {
    const { activeChatId, replyToMessage } = get()
    if (!activeChatId || !text.trim()) return

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)

    if (!topic.isSubscribed()) {
      console.warn('Cannot send message: topic not subscribed')
      return
    }

    try {
      const draft = topic.createMessage(text, false) as any

      // Add reply header if replying to a message
      if (replyToMessage && replyToMessage.seq) {
        if (!draft.head) draft.head = {}
        draft.head.reply = String(replyToMessage.seq)
      }

      await topic.publishMessage(draft)

      // Clear reply state
      set({ replyToMessage: null })

      // Optimistic UI update — real message will come back via onData
    } catch (err) {
      console.error('Failed to send message', err)
    }
  },

  loadMoreMessages: async () => {
    const { activeChatId, hasMoreMessages } = get()
    if (!activeChatId || !hasMoreMessages[activeChatId]) return

    set({ isLoadingMoreMessages: true })

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)

    if (!topic.isSubscribed()) {
      set({ isLoadingMoreMessages: false })
      return
    }

    try {
      // Get current messages to find the earliest seq
      const currentMsgs = get().messages[activeChatId] || []
      if (currentMsgs.length === 0) {
        set({ isLoadingMoreMessages: false })
        return
      }

      // Find the earliest message seq
      const earliestSeq = currentMsgs[0].id.split('-').pop()
      const minSeq = earliestSeq ? parseInt(earliestSeq, 10) : 1

      // Load earlier messages
      await topic.getMessagesPage(MESSAGES_PAGE, undefined, minSeq - 1, undefined)

      // Reload messages from topic
      const msgs: Message[] = []
      const myUserId = tn.getCurrentUserID()
      topic.messages((msg) => {
        msgs.push(tinodeMsgToMessage(activeChatId, msg, myUserId))
      })

      // Sort messages by seq
      msgs.sort((a, b) => {
        const aSeq = parseInt(a.id.split('-').pop() || '0', 10)
        const bSeq = parseInt(b.id.split('-').pop() || '0', 10)
        return aSeq - bSeq
      })

      // Check if there are still more messages
      const hasMore = msgs.length >= MESSAGES_PAGE

      set((s) => ({
        messages: { ...s.messages, [activeChatId]: msgs },
        hasMoreMessages: { ...s.hasMoreMessages, [activeChatId]: hasMore },
        isLoadingMoreMessages: false
      }))
    } catch (err) {
      console.error('Failed to load more messages', err)
      set({ isLoadingMoreMessages: false })
    }
  },

  markMessagesAsRead: (topicId) => {
    const tn = getTinode()
    const topic = tn.getTopic(topicId)

    if (topic.isSubscribed()) {
      topic.noteRead()
    }
  },

  sendTypingNotification: (topicId) => {
    const tn = getTinode()
    const topic = tn.getTopic(topicId)

    if (topic.isSubscribed()) {
      topic.noteKeyPress()
    }
  },

  // ─── Reply ──────────────────────────────────────────────────────────────────

  setReplyTo: (msg) => {
    set({ replyToMessage: msg })
  },

  // ─── Context Menu ───────────────────────────────────────────────────────────

  setContextMenuMessage: (msg, position) => {
    set({ contextMenuMessage: msg, contextMenuPosition: position || null })
  },

  // ─── Inline Editing ─────────────────────────────────────────────────────────

  setEditingMessage: (msg) => {
    set({ editingMessage: msg })
  },

  startEditing: (msg) => {
    set({ editingMessage: msg, contextMenuMessage: null })
  },

  cancelEditing: () => {
    set({ editingMessage: null })
  },

  submitEdit: async (newText) => {
    const { activeChatId, editingMessage } = get()
    if (!activeChatId || !editingMessage || editingMessage.senderId !== 'me' || !editingMessage.seq) {
      get().cancelEditing()
      return
    }

    if (!newText.trim()) {
      get().cancelEditing()
      return
    }

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)

    try {
      const draft = topic.createMessage(newText.trim(), false) as any
      if (!draft.head) draft.head = {}
      draft.head.replace = String(editingMessage.seq)
      await topic.publishMessage(draft)

      // Optimistic update
      set((s) => ({
        messages: {
          ...s.messages,
          [activeChatId]: (s.messages[activeChatId] ?? []).map((m) =>
            m.seq === editingMessage.seq ? { ...m, text: newText.trim(), edited: true } : m,
          ),
        },
        editingMessage: null,
      }))
    } catch (err) {
      console.error('Failed to edit message', err)
    }
  },

  // ─── Delete Message ─────────────────────────────────────────────────────────

  deleteMessage: async (msg) => {
    const { activeChatId } = get()
    if (!activeChatId || msg.senderId !== 'me' || !msg.seq) return

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)

    try {
      // Tinode: delete message by seq — use leave + deleteTopic for single message
      // Or use the low-level API
      await (topic as any).deleteMessage(msg.seq)

      // Remove from local state
      set((s) => ({
        messages: {
          ...s.messages,
          [activeChatId]: (s.messages[activeChatId] ?? []).filter((m) => m.seq !== msg.seq),
        },
        contextMenuMessage: null,
      }))
    } catch (err) {
      console.error('Failed to delete message', err)
    }
  },

  // ─── Edit Message ───────────────────────────────────────────────────────────

  editMessage: async (msg, newText) => {
    const { activeChatId } = get()
    if (!activeChatId || msg.senderId !== 'me' || !msg.seq) return

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)

    try {
      // Tinode: publish with head.replace = seq
      const draft = topic.createMessage(newText, false) as any
      if (!draft.head) draft.head = {}
      draft.head.replace = String(msg.seq)
      await topic.publishMessage(draft)

      // Update local state optimistically
      set((s) => ({
        messages: {
          ...s.messages,
          [activeChatId]: (s.messages[activeChatId] ?? []).map((m) =>
            m.seq === msg.seq ? { ...m, text: newText, edited: true } : m,
          ),
        },
        contextMenuMessage: null,
      }))
    } catch (err) {
      console.error('Failed to edit message', err)
    }
  },

  // ─── Chat Settings ──────────────────────────────────────────────────────────

  toggleMute: (chatId) => {
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId ? { ...c, muted: !c.muted } : c,
      ),
    }))

    // Persist via Tinode me.setMeta
    const tn = getTinode()
    const me = tn.getMeTopic()
    const chat = get().chats.find((c) => c.id === chatId)
    if (chat && me.isSubscribed()) {
      const mode = chat.muted ? 'N' : 'JRWPAS' // N = no notifications
      me.setMeta({ sub: { topic: chatId, mode } }).catch((err: unknown) => {
        console.error('Failed to update mute status', err)
      })
    }
  },

  togglePin: (chatId) => {
    set((s) => {
      const chat = s.chats.find((c) => c.id === chatId)
      if (!chat) return s

      const isPinned = chat.pinned
      const tn = getTinode()
      const me = tn.getMeTopic()

      if (me.isSubscribed()) {
        if (isPinned) {
          // Unpin: set rank to 0
          me.setMeta({ sub: { topic: chatId, pvt: { pin: 0 } } }).catch((err: unknown) => {
            console.error('Failed to unpin', err)
          })
        } else {
          // Pin: set rank to current timestamp
          me.setMeta({ sub: { topic: chatId, pvt: { pin: Date.now() } } }).catch((err: unknown) => {
            console.error('Failed to pin', err)
          })
        }
      }

      return {
        chats: s.chats.map((c) =>
          c.id === chatId ? { ...c, pinned: !c.pinned } : c,
        ),
      }
    })
  },

  // ─── Forwarding ─────────────────────────────────────────────────────────────

  startForward: (msg) => {
    set({ forwardingMessage: msg, contextMenuMessage: null })
  },

  cancelForward: () => {
    set({ forwardingMessage: null })
  },

  forwardTo: async (targetChatId) => {
    const { forwardingMessage } = get()
    if (!forwardingMessage) return

    const tn = getTinode()
    const topic = tn.getTopic(targetChatId)

    if (!topic.isSubscribed()) {
      // Subscribe briefly to send
      try {
        await topic.subscribe(
          topic.startMetaQuery().withLaterDesc().withLaterSub().build()
        )
      } catch (err) {
        console.error('Failed to subscribe for forward', err)
        return
      }
    }

    try {
      // Create forwarded message with "FWD" header in the text
      const senderName = forwardingMessage.senderId === 'me'
        ? 'Вы'
        : (forwardingMessage.senderName || 'Пользователь')

      const fwdText = `⟮ переслано от ${senderName} ⟯\n${forwardingMessage.text}`

      const draft = topic.createMessage(fwdText, false) as any

      // Copy original message headers if any (reply, etc)
      if (forwardingMessage.replyTo) {
        if (!draft.head) draft.head = {}
        draft.head.reply = String(forwardingMessage.replyTo.seq)
      }

      await topic.publishMessage(draft)

      // Add to local messages
      const fwdMsg: Message = {
        id: `${targetChatId}-${Date.now()}`,
        chatId: targetChatId,
        senderId: 'me',
        text: fwdText,
        ts: new Date(),
        read: false,
        replyTo: forwardingMessage.replyTo,
      }

      set((s) => ({
        messages: {
          ...s.messages,
          [targetChatId]: [...(s.messages[targetChatId] ?? []), fwdMsg],
        },
        forwardingMessage: null,
      }))

      // Update chat preview
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === targetChatId
            ? { ...c, lastMessage: '↗ Пересланное сообщение', lastMessageTs: new Date() }
            : c,
        ),
      }))
    } catch (err) {
      console.error('Failed to forward message', err)
    }
  },

  // ─── Voice Messages ─────────────────────────────────────────────────────────

  setVoiceRecording: (blob, duration, audioUrl) => {
    set({ voiceBlob: blob, voiceDuration: duration, voiceAudioUrl: audioUrl })
  },

  cancelVoiceRecording: () => {
    set({ voiceBlob: null, voiceDuration: 0, voiceAudioUrl: null })
  },

  sendVoiceMessage: async () => {
    const { activeChatId, voiceBlob, voiceDuration } = get()
    if (!activeChatId || !voiceBlob) return

    const tn = getTinode()
    const topic = tn.getTopic(activeChatId)

    if (!topic.isSubscribed()) {
      console.warn('Cannot send voice: topic not subscribed')
      set({ voiceBlob: null, voiceDuration: 0, voiceAudioUrl: null })
      return
    }

    try {
      // Upload voice blob as file
      const scheme = import.meta.env.VITE_TINODE_SECURE === 'true' ? 'https' : 'http'
      const host = import.meta.env.VITE_TINODE_HOST as string
      const apiKey = import.meta.env.VITE_TINODE_API_KEY as string
      const authToken = tn.getAuthToken()
      if (!authToken) throw new Error('No auth token')

      const uploadUrl = `${scheme}://${host}/v0/file/u?apikey=${apiKey}&auth=token&secret=${authToken.token}`

      const fileUrl = await new Promise<string>((resolve, reject) => {
        const formData = new FormData()
        formData.append('file', voiceBlob, 'voice.ogg')

        const xhr = new XMLHttpRequest()
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText)
              const url = response?.ctrl?.params?.url
              if (!url) reject(new Error('No URL'))
              else resolve(url.startsWith('http') ? url : `${scheme}://${host}${url}`)
            } catch { reject(new Error('Parse error')) }
          } else if (xhr.status === 307) {
            const redirectUrl = xhr.getResponseHeader('Location')
            if (!redirectUrl) reject(new Error('No redirect'))
            else {
              // Re-upload to redirect URL
              const xhr2 = new XMLHttpRequest()
              xhr2.addEventListener('load', () => {
                try {
                  const resp = JSON.parse(xhr2.responseText)
                  const url = resp?.ctrl?.params?.url
                  if (!url) reject(new Error('No URL'))
                  else resolve(url.startsWith('http') ? url : `${scheme}://${host}${url}`)
                } catch { reject(new Error('Parse error')) }
              })
              xhr2.addEventListener('error', () => reject(new Error('Network error')))
              xhr2.open('POST', redirectUrl)
              const fd2 = new FormData()
              fd2.append('file', voiceBlob, 'voice.ogg')
              xhr2.send(fd2)
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('Network error')))
        xhr.open('POST', uploadUrl)
        xhr.send(formData)
      })

      // Create voice message with EX entity
      const durationSec = voiceDuration
      const draftyContent = {
        txt: ' ',
        fmt: [{ at: 0, len: 1, type: 'EX', data: 0 }],
        ent: [{
          mime: 'audio/ogg',
          ref: fileUrl,
          duration: durationSec,
          name: 'voice.ogg',
        }],
      }

      const pubPacket: Record<string, unknown> = {
        topic: activeChatId,
        noecho: false,
        head: { mime: 'audio/ogg' },
        content: draftyContent,
      }

      // Optimistic message
      const optimisticMsg: Message = {
        id: `optimistic-voice-${Date.now()}`,
        chatId: activeChatId,
        senderId: 'me',
        text: `🎤 Голосовое сообщение (${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')})`,
        ts: new Date(),
        read: false,
        hasMedia: true,
        imageUrl: undefined,
        attachments: [{
          type: 'audio',
          name: 'voice.ogg',
          url: fileUrl,
          size: voiceBlob.size,
        }],
      }

      set((s) => ({
        messages: {
          ...s.messages,
          [activeChatId]: [...(s.messages[activeChatId] ?? []), optimisticMsg],
        },
        voiceBlob: null,
        voiceDuration: 0,
        voiceAudioUrl: null,
      }))

      await topic.publishMessage(pubPacket)

      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === activeChatId
            ? { ...c, lastMessage: '🎤 Голосовое', lastMessageTs: new Date() }
            : c,
        ),
      }))
    } catch (err) {
      console.error('Failed to send voice message', err)
    }
  },

  // ─── Tinode lifecycle ────────────────────────────────────────────────────────

  initFromTinode: () => {
    const tn = getTinode()
    const me = tn.getMeTopic()

    // Register callbacks
    me.onContactUpdate = (_what, _cont) => {
      get()._refreshContacts()
    }
    me.onSubsUpdated = () => {
      get()._refreshContacts()
    }

    // Subscribe to me topic to get contact list
    const query = me.startMetaQuery()
      .withLaterSub()
      .withDesc()
      .withTags()
      .build()

    me.subscribe(query)
      .then(() => {
        get()._refreshContacts()
        useGroupsStore.getState().loadGroups()
        useGroupsStore.getState().loadChannels()
      })
      .catch((err: unknown) => {
        console.error('Failed to subscribe to me topic', err)
      })
  },

  cleanup: () => {
    const { activeChatId } = get()
    if (activeChatId) {
      try {
        const tn = getTinode()
        const topic = tn.getTopic(activeChatId)
        if (topic.isSubscribed()) {
          topic.leave(false)
        }
      } catch {
        // ignore
      }
    }
    set({ chats: [], messages: {}, activeChatId: null })
  },

  // ─── Internal ────────────────────────────────────────────────────────────────

  _refreshContacts: () => {
    const tn = getTinode()
    const me = tn.getMeTopic()
    const chats: Chat[] = []
    me.contacts((cont: TinodeContact) => {
      // Ensure topic field is set (SDK quirk)
      if (!cont.topic && cont.name) cont.topic = cont.name
      const pinnedRank = me.pinnedTopicRank(cont.topic)
      const chat = contactToChat(cont, pinnedRank)
      // Try to get last message text from cached messages
      const msgs = get().messages[cont.topic]
      if (msgs && msgs.length > 0) {
        chat.lastMessage = msgs[msgs.length - 1].text
      }
      chats.push(chat)
    })
    // Sort: pinned first, then by last message time
    chats.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      const ta = a.lastMessageTs?.getTime() ?? 0
      const tb = b.lastMessageTs?.getTime() ?? 0
      return tb - ta
    })
    set({ chats })
  },

  _addMessage: (topicId, tinodeMsg) => {
    const tn = getTinode()
    const myUserId = tn.getCurrentUserID()

    // Debug: log ALL incoming messages to see content structure
    const rawContent = tinodeMsg.content
    if (rawContent) {
      console.log('[_addMessage] Raw content type:', typeof rawContent, rawContent)
    }

    const msg = tinodeMsgToMessage(topicId, tinodeMsg, myUserId)

    // Debug: log parsed message with any media
    if (msg.imageUrl || msg.hasMedia || msg.attachments) {
      console.log('[_addMessage] Media message parsed:', {
        id: msg.id,
        imageUrl: msg.imageUrl,
        hasMedia: msg.hasMedia,
        attachments: msg.attachments,
        text: msg.text,
      })
    }

    // Deduplicate: skip if message with this ID already exists
    const existing = get().messages[topicId] ?? []
    if (existing.some((m) => m.id === msg.id)) return

    // Play sound if message is from another user and chat is not active
    const { activeChatId } = get()
    if (topicId !== activeChatId && msg.senderId !== 'me') {
      get()._playNotificationSound()
    }

    set((s) => ({
      messages: {
        ...s.messages,
        [topicId]: [...(s.messages[topicId] ?? []), msg],
      },
      // Update last message preview in chat list
      chats: s.chats.map((c) =>
        c.id === topicId
          ? { ...c, lastMessage: msg.text, lastMessageTs: msg.ts }
          : c,
      ),
    }))
  },
}))
