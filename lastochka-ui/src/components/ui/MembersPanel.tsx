import { useState } from 'react'
import { X, UserPlus, Crown, Shield, Pencil, Check } from 'lucide-react'
import { useGroupsStore } from '@/store/groups'
import { useAuthStore } from '@/store/auth'
import UserSearch from './UserSearch'
import type { GroupMember, User } from '@/types'

interface MembersPanelProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  canAddMembers?: boolean
  canRemoveMembers?: boolean
}

export default function MembersPanel({
  isOpen,
  onClose,
  groupId,
  canAddMembers = false,
  canRemoveMembers = false,
}: MembersPanelProps) {
  const { selectedGroup, removeMember, leaveGroup, deleteGroup, addMember, updateGroupInfo } = useGroupsStore()
  const { userId } = useAuthStore()
  const [showAddUser, setShowAddUser] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  if (!isOpen || !selectedGroup) return null

  const isOwner = selectedGroup.members.some(m => m.userId === userId && m.role === 'owner')

  const handleStartEdit = () => {
    setEditName(selectedGroup.name)
    setEditDesc(selectedGroup.description || '')
    setIsEditingName(true)
  }

  const handleSaveEdit = async () => {
    if (editName.trim()) {
      await updateGroupInfo(groupId, editName.trim(), editDesc.trim())
    }
    setIsEditingName(false)
  }

  const handleAddUser = async (user: User) => {
    await addMember(groupId, user.id)
    setShowAddUser(false)
  }

  const handleLeaveOrDelete = async () => {
    if (isOwner) {
      if (confirm(`Удалить ${selectedGroup.isChannel ? 'канал' : 'группу'} "${selectedGroup.name}"?`)) {
        await deleteGroup(groupId)
        onClose()
      }
    } else {
      if (confirm(`Покинуть ${selectedGroup.isChannel ? 'канал' : 'группу'} "${selectedGroup.name}"?`)) {
        await leaveGroup(groupId)
        onClose()
      }
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-900 z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {selectedGroup.isChannel ? 'Подписчики' : 'Участники'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Информация о группе */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          {isEditingName ? (
            <div className="space-y-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Название группы"
                className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
              <input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Описание (необязательно)"
                className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-brand text-white text-sm hover:bg-brand-dark transition-colors"
                >
                  <Check size={16} /> Сохранить
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedGroup.name}</p>
                {selectedGroup.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{selectedGroup.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {selectedGroup.membersCount} {selectedGroup.isChannel ? 'подписчиков' : 'участников'}
                </p>
              </div>
              {isOwner && (
                <button
                  onClick={handleStartEdit}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                  title="Редактировать"
                >
                  <Pencil size={16} className="text-gray-500" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Кнопка добавления */}
        {canAddMembers && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setShowAddUser(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand/10 text-brand hover:bg-brand/20 transition-colors font-medium"
            >
              <UserPlus size={18} />
              Добавить участника
            </button>
          </div>
        )}

        {/* Список участников */}
        <div className="flex-1 overflow-y-auto p-2">
          {selectedGroup.members.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">Загрузка участников...</p>
          )}

          {/* Владелец */}
          {selectedGroup.members.filter(m => m.role === 'owner').map((member) => (
            <MemberItem key={member.userId} member={member} showRole canRemove={false} />
          ))}

          {/* Админы */}
          {selectedGroup.members.filter(m => m.role === 'admin').map((member) => (
            <MemberItem
              key={member.userId}
              member={member}
              showRole
              canRemove={canRemoveMembers && isOwner}
              onRemove={() => removeMember(groupId, member.userId)}
            />
          ))}

          {/* Обычные участники */}
          {selectedGroup.members.filter(m => m.role === 'member').map((member) => (
            <MemberItem
              key={member.userId}
              member={member}
              showRole={false}
              canRemove={canRemoveMembers && isOwner}
              onRemove={() => removeMember(groupId, member.userId)}
            />
          ))}
        </div>

        {/* Кнопка выхода / удаления */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLeaveOrDelete}
            className="w-full py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
          >
            {isOwner
              ? `Удалить ${selectedGroup.isChannel ? 'канал' : 'группу'}`
              : `Покинуть ${selectedGroup.isChannel ? 'канал' : 'группу'}`}
          </button>
        </div>
      </div>

      {/* Модальное окно поиска пользователей */}
      {showAddUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
            <UserSearch
              onSelect={handleAddUser}
              onClose={() => setShowAddUser(false)}
              showStartChat={false}
            />
          </div>
        </div>
      )}
    </>
  )
}

interface MemberItemProps {
  member: GroupMember
  showRole?: boolean
  canRemove?: boolean
  onRemove?: () => void
}

function MemberItem({ member, showRole, canRemove, onRemove }: MemberItemProps) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors group">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-semibold flex-shrink-0 relative">
          {member.avatar ? (
            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            (member.name || '?').charAt(0).toUpperCase()
          )}
          {member.online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
          )}
        </div>

        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
          {showRole && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              {member.role === 'owner' && (
                <><Crown size={12} className="text-yellow-500" /><span>Владелец</span></>
              )}
              {member.role === 'admin' && (
                <><Shield size={12} className="text-brand" /><span>Администратор</span></>
              )}
            </div>
          )}
        </div>
      </div>

      {canRemove && (
        <button
          onClick={onRemove}
          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="Удалить участника"
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}
