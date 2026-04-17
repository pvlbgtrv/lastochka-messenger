// ─── User ────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  avatar?: string
  online?: boolean
  lastSeen?: Date
  bio?: string
  phone?: string
  email?: string
}

// ─── Reactions ───────────────────────────────────────────────────

export type ReactionType = '❤️' | '👍' | '😂' | '😮' | '😢' | '🔥'

export interface Reaction {
  emoji: ReactionType
  userId: string
  userName: string
}

// ─── Message ─────────────────────────────────────────────────────

export interface Message {
  id: string
  chatId: string
  senderId: string
  senderName?: string
  text: string
  ts: Date
  read?: boolean
  edited?: boolean
  // Reply
  replyTo?: {
    seq: number
    senderName: string
    text: string
  }
  // Image / media
  imageUrl?: string
  imageWidth?: number
  imageHeight?: number
  imageThumbnail?: string
  // Sticker
  stickerId?: string
  // Reactions
  reactions?: Reaction[]
  // Tinode seq
  seq?: number
}

// ─── Chat ────────────────────────────────────────────────────────

export interface Chat {
  id: string
  name: string
  login?: string
  phone?: string
  avatar?: string
  lastMessage?: string
  lastMessageTs?: Date
  unread?: number
  online?: boolean
  isGroup?: boolean
  membersCount?: number
  pinned?: boolean
  muted?: boolean
  description?: string
  typing?: boolean
  lastSeenText?: string
}

// ─── Group ───────────────────────────────────────────────────────

export interface GroupMember {
  userId: string
  name: string
  avatar?: string
  role: 'owner' | 'admin' | 'member'
  online?: boolean
}

export interface Group {
  id: string
  name: string
  description?: string
  avatar?: string
  owner: string
  members: GroupMember[]
  membersCount: number
  isPublic: boolean
}

// ─── Sticker ─────────────────────────────────────────────────────

export interface Sticker {
  id: string
  pack: string
  url: string
  emoji: string
}

export interface StickerPack {
  id: string
  name: string
  coverUrl: string
  stickers: Sticker[]
}
