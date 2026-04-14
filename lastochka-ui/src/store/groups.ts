import { create } from 'zustand'
import { getTinode } from '@/lib/tinode-client'
import type { Group, GroupMember, CreateGroupParams, User } from '@/types'

interface GroupsStore {
  groups: Group[]
  channels: Group[]
  selectedGroup: Group | null
  isLoading: boolean
  error: string | null

  loadGroups: () => Promise<void>
  loadChannels: () => Promise<void>
  createGroup: (params: CreateGroupParams) => Promise<Group | null>
  createChannel: (params: Omit<CreateGroupParams, 'isChannel'>) => Promise<Group | null>
  selectGroup: (groupId: string) => Promise<void>
  addMember: (groupId: string, userId: string) => Promise<void>
  removeMember: (groupId: string, userId: string) => Promise<void>
  leaveGroup: (groupId: string) => Promise<void>
  deleteGroup: (groupId: string) => Promise<void>
  updateGroupInfo: (groupId: string, name: string, description?: string) => Promise<void>
  searchUsersForInvite: (query: string) => Promise<User[]>
}

// Строим URL аватара из Tinode photo объекта
function makeAvatarUrl(photo?: { type?: string; data?: string; ref?: string }): string | undefined {
  if (!photo) return undefined
  if (photo.ref) return photo.ref
  if (photo.data && photo.type) return `data:${photo.type};base64,${photo.data}`
  return undefined
}

// Преобразование Tinode topic в Group
function topicToGroup(topic: any): Group {
  const desc = topic?.desc || {}
  const pub = desc.public || topic.public || {}

  return {
    id: topic.name || topic.topic || '',
    name: pub.fn || topic.name || '',
    description: pub.note || '',
    avatar: makeAvatarUrl(pub.photo),
    owner: desc.owner || '',
    members: [],
    created: desc.created ? new Date(desc.created) : new Date(),
    isChannel: pub.type === 'channel',
    isPublic: pub.isPublic || false,
    membersCount: desc.acs?.count || 0,
  }
}

export const useGroupsStore = create<GroupsStore>((set, get) => ({
  groups: [],
  channels: [],
  selectedGroup: null,
  isLoading: false,
  error: null,

  loadGroups: async () => {
    set({ isLoading: true, error: null })
    const tn = getTinode()
    const me = tn.getMeTopic()

    try {
      const groupsData: Group[] = []

      me.contacts((cont: any) => {
        // Tinode группы начинаются с 'grp', каналы с 'chn'
        const topicId = cont.name || cont.topic || ''
        if (topicId.startsWith('grp')) {
          const group = topicToGroup({ name: topicId, public: cont.public })
          groupsData.push(group)
        }
      })

      set({ groups: groupsData, isLoading: false })
    } catch (err) {
      console.error('Failed to load groups:', err)
      set({ isLoading: false, error: 'Ошибка загрузки групп' })
    }
  },

  loadChannels: async () => {
    set({ isLoading: true, error: null })
    const tn = getTinode()
    const me = tn.getMeTopic()

    try {
      const channelsData: Group[] = []

      me.contacts((cont: any) => {
        // Каналы в Tinode начинаются с 'chn'
        const topicId = cont.name || cont.topic || ''
        if (topicId.startsWith('chn')) {
          const channel = topicToGroup({ name: topicId, public: cont.public })
          channelsData.push(channel)
        }
      })

      set({ channels: channelsData, isLoading: false })
    } catch (err) {
      console.error('Failed to load channels:', err)
      set({ isLoading: false, error: 'Ошибка загрузки каналов' })
    }
  },

  createGroup: async (params: CreateGroupParams) => {
    const tn = getTinode()

    try {
      // Создаём новую группу: subscribe на топик с уникальным именем 'new...'
      const groupTopic = tn.getTopic((tn as any).newGroupTopicName(false))

      await groupTopic.subscribe(null, {
        desc: {
          public: {
            fn: params.name,
            note: params.description || '',
          },
          defacs: {
            auth: 'JRWPAS',
            anon: params.isPublic ? 'JR' : 'N',
          },
        },
        sub: { mode: 'JRWPASDO' },
      })

      // После subscribe topic.name содержит реальный ID группы
      const groupId = groupTopic.name

      // Добавляем участников
      for (const userId of (params.members || [])) {
        await groupTopic.setMeta({ sub: { user: userId, mode: 'JRWPA' } })
      }

      const group: Group = {
        id: groupId,
        name: params.name,
        description: params.description || '',
        owner: tn.getCurrentUserID(),
        members: [],
        created: new Date(),
        isChannel: false,
        isPublic: params.isPublic || false,
        membersCount: (params.members?.length || 0) + 1,
      }

      set((s) => ({ groups: [...s.groups, group] }))
      // Обновляем список из Tinode (на случай задержки синхронизации)
      setTimeout(() => get().loadGroups(), 1000)
      return group
    } catch (err) {
      console.error('Failed to create group:', err)
      set({ error: 'Ошибка создания группы' })
      return null
    }
  },

  createChannel: async (params: Omit<CreateGroupParams, 'isChannel'>) => {
    const tn = getTinode()

    try {
      // Каналы в Tinode — это 'chn' топики, создаются через 'nch...'
      const channelTopic = tn.getTopic((tn as any).newGroupTopicName(true))

      await channelTopic.subscribe(null, {
        desc: {
          public: {
            fn: params.name,
            note: params.description || '',
          },
          defacs: {
            auth: params.isPublic ? 'JRWPA' : 'N',
            anon: params.isPublic ? 'JR' : 'N',
          },
        },
        sub: { mode: 'JRWPASDO' },
      })

      const channelId = channelTopic.name

      // Добавляем участников как подписчиков (read-only)
      for (const userId of (params.members || [])) {
        await channelTopic.setMeta({ sub: { user: userId, mode: params.isPublic ? 'JR' : 'N' } })
      }

      const channel: Group = {
        id: channelId,
        name: params.name,
        description: params.description || '',
        owner: tn.getCurrentUserID(),
        members: [],
        created: new Date(),
        isChannel: true,
        isPublic: params.isPublic || false,
        membersCount: (params.members?.length || 0) + 1,
      }

      set((s) => ({ channels: [...s.channels, channel] }))
      setTimeout(() => get().loadChannels(), 1000)
      return channel
    } catch (err) {
      console.error('Failed to create channel:', err)
      set({ error: 'Ошибка создания канала' })
      return null
    }
  },

  selectGroup: async (groupId: string) => {
    const tn = getTinode()
    const topic = tn.getTopic(groupId)

    try {
      if (!topic.isSubscribed()) {
        await topic.subscribe(
          topic.startMetaQuery().withDesc().withSub().build()
        )
      } else {
        // Refresh subscribers metadata if already subscribed
        await (topic as any).getMeta(topic.startMetaQuery().withSub().build())
      }

      const members: GroupMember[] = []
      // Group topics use subscribers(), not contacts()
      ;(topic as any).subscribers((sub: any) => {
        const userId = sub.user || ''
        if (!userId) return
        members.push({
          userId,
          name: (sub.public as any)?.fn || userId,
          avatar: makeAvatarUrl((sub.public as any)?.photo),
          role: sub.acs?.isOwner?.() ? 'owner' : sub.acs?.isAdmin?.() ? 'admin' : 'member',
          joined: sub.updated ? new Date(sub.updated) : new Date(),
          online: sub.online || false,
        })
      })

      // topic.public is the direct property in Tinode SDK
      const pub = (topic as any).public || {}

      const group: Group = {
        id: groupId,
        name: pub.fn || groupId,
        description: pub.note || '',
        avatar: makeAvatarUrl(pub.photo),
        owner: '',
        members,
        created: new Date(),
        isChannel: groupId.startsWith('chn'),
        isPublic: pub.isPublic || false,
        membersCount: members.length,
      }

      set({ selectedGroup: group })
    } catch (err) {
      console.error('Failed to select group:', err)
      set({ error: 'Ошибка загрузки информации о группе' })
    }
  },

  addMember: async (groupId: string, userId: string) => {
    const tn = getTinode()
    const topic = tn.getTopic(groupId)

    try {
      // Приглашаем пользователя через setMeta sub
      await topic.setMeta({ sub: { user: userId, mode: 'JRWPA' } })
      // Обновляем список участников
      await get().selectGroup(groupId)
    } catch (err) {
      console.error('Failed to add member:', err)
      set({ error: 'Ошибка добавления участника' })
    }
  },

  removeMember: async (groupId: string, userId: string) => {
    const tn = getTinode()
    const topic = tn.getTopic(groupId)

    try {
      await (topic as any).delSubscription(userId)
      await get().selectGroup(groupId)
    } catch (err) {
      console.error('Failed to remove member:', err)
      set({ error: 'Ошибка удаления участника' })
    }
  },

  leaveGroup: async (groupId: string) => {
    const tn = getTinode()
    const topic = tn.getTopic(groupId)

    try {
      await topic.leave(true) // true = unsubscribe
      set((s) => ({
        groups: s.groups.filter(g => g.id !== groupId),
        channels: s.channels.filter(c => c.id !== groupId),
        selectedGroup: s.selectedGroup?.id === groupId ? null : s.selectedGroup,
      }))
    } catch (err) {
      console.error('Failed to leave group:', err)
      set({ error: 'Ошибка выхода из группы' })
    }
  },

  deleteGroup: async (groupId: string) => {
    const tn = getTinode()
    const topic = tn.getTopic(groupId)

    try {
      await topic.delTopic(true) // hard delete
      set((s) => ({
        groups: s.groups.filter(g => g.id !== groupId),
        channels: s.channels.filter(c => c.id !== groupId),
        selectedGroup: s.selectedGroup?.id === groupId ? null : s.selectedGroup,
      }))
    } catch (err) {
      console.error('Failed to delete group:', err)
      set({ error: 'Ошибка удаления группы' })
    }
  },

  updateGroupInfo: async (groupId: string, name: string, description?: string) => {
    const tn = getTinode()
    const topic = tn.getTopic(groupId)

    try {
      await topic.setMeta({
        desc: {
          public: {
            fn: name,
            note: description,
          },
        },
      })

      set((s) => ({
        groups: s.groups.map(g =>
          g.id === groupId ? { ...g, name, description } : g
        ),
        channels: s.channels.map(c =>
          c.id === groupId ? { ...c, name, description } : c
        ),
        selectedGroup: s.selectedGroup?.id === groupId
          ? { ...s.selectedGroup, name, description }
          : s.selectedGroup,
      }))
    } catch (err) {
      console.error('Failed to update group info:', err)
      set({ error: 'Ошибка обновления информации' })
    }
  },

  searchUsersForInvite: async (query: string) => {
    const tn = getTinode()
    const fnd = tn.getFndTopic()

    try {
      if (!fnd.isSubscribed()) {
        await fnd.subscribe(fnd.startMetaQuery().withSub().build())
      }

      // Tinode ищет по тегам. Логин хранится как тег basic:<login>.
      // Если запрос без namespace-префикса — добавляем basic:
      const tagQuery = query.includes(':') ? query : `basic:${query}`
      await fnd.setMeta({ desc: { public: tagQuery } })
      await (fnd as any).getMeta(fnd.startMetaQuery().withSub().build())

      const users: User[] = []
      fnd.contacts((sub: any) => {
        const id = sub.user || sub.topic || ''
        if (!id) return
        users.push({
          id,
          name: (sub.public as any)?.fn || id,
          avatar: makeAvatarUrl((sub.public as any)?.photo),
          online: sub.online || false,
        })
      })

      return users
    } catch (err) {
      console.error('Failed to search users:', err)
      return []
    }
  },
}))
