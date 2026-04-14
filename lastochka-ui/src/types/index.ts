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

export interface Message {
  id: string
  chatId: string
  senderId: string
  senderName?: string
  text: string
  ts: Date
  read?: boolean
  edited?: boolean
  deleted?: boolean
  // Reply
  replyTo?: {
    seq: number
    senderName: string
    text: string
  }
  // Tinode seq for API operations
  seq?: number
  // Image / media
  imageUrl?: string        // URL изображения (полный или относительный)
  imageWidth?: number      // Ширина изображения
  imageHeight?: number     // Высота изображения
  imageThumbnail?: string  // Base64 превью или data URL
  duration?: number        // Duration in seconds (for audio/video)
  attachments?: Attachment[]
  hasMedia?: boolean
  // Upload progress (для optimistically добавленных сообщений)
  uploadProgress?: number  // 0..1, undefined если не загружается
  uploadFailed?: boolean   // true если загрузка не удалась
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'file'
  name: string
  size?: number
  url?: string
  previewUrl?: string
}

export interface Chat {
  id: string
  name: string
  avatar?: string
  lastMessage?: string
  lastMessageTs?: Date
  unread?: number
  online?: boolean
  isGroup?: boolean
  isChannel?: boolean
  pinned?: boolean
  muted?: boolean
  membersCount?: number
  description?: string
  isOnline?: boolean
}

export interface Group {
  id: string
  name: string
  description?: string
  avatar?: string
  owner: string
  members: GroupMember[]
  created: Date
  isChannel: boolean
  isPublic: boolean
  membersCount: number
}

export interface GroupMember {
  userId: string
  name: string
  avatar?: string
  role: 'owner' | 'admin' | 'member'
  joined: Date
  online?: boolean
}

export interface CreateGroupParams {
  name: string
  description?: string
  isChannel: boolean
  isPublic: boolean
  members: string[] // user IDs
  avatar?: string
}

export interface SearchResults {
  users: User[]
  groups: Group[]
  channels: Group[]
  messages: Message[]
}
