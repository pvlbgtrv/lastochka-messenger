import { useState } from 'react'
import { X, Users, Lock, UserPlus } from 'lucide-react'
import { useGroupsStore } from '@/store/groups'
import UserSearch from './UserSearch'
import type { User } from '@/types'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateGroupModal({ isOpen, onClose }: CreateGroupModalProps) {
  const { createGroup } = useGroupsStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<User[]>([])
  const [showUserSearch, setShowUserSearch] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Введите название')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const result = await createGroup({
        name: name.trim(),
        description: description.trim(),
        isChannel: false,
        isPublic: false,
        members: selectedMembers.map(u => u.id),
      })

      if (result) {
        onClose()
        // Сброс формы
        setName('')
        setDescription('')
        setSelectedMembers([])
      } else {
        setError('Ошибка создания. Попробуйте снова.')
      }
    } catch (err) {
      setError('Ошибка создания. Попробуйте снова.')
      console.error('Failed to create:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectUser = (user: User) => {
    if (!selectedMembers.find(m => m.id === user.id)) {
      setSelectedMembers([...selectedMembers, user])
    }
    setShowUserSearch(false)
  }

  const handleRemoveMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter(m => m.id !== userId))
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
          {/* Заголовок */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Создать группу</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Для общения с друзьями и коллегами</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Форма */}
          <div className="p-6 space-y-4">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Название <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
                placeholder="Название группы"
                className="w-full h-12 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand transition-all"
                autoFocus
                maxLength={60}
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Описание
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Краткое описание"
                rows={2}
                maxLength={200}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand transition-all resize-none"
              />
            </div>

            {/* Участники */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Участники {selectedMembers.length > 0 && `(${selectedMembers.length})`}
                </label>
                <button
                  type="button"
                  onClick={() => setShowUserSearch(true)}
                  className="text-sm text-brand hover:underline flex items-center gap-1"
                >
                  <UserPlus size={14} />
                  Добавить
                </button>
              </div>

              {selectedMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-gray-100 dark:bg-gray-800">
                  {selectedMembers.map((user) => (
                    <span
                      key={user.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 rounded-lg text-sm"
                    >
                      <span className="w-5 h-5 rounded-full bg-brand/20 text-brand text-xs flex items-center justify-center font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-gray-900 dark:text-white">{user.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(user.id)}
                        className="hover:text-red-500 transition-colors ml-0.5"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
                  Участники не выбраны
                </div>
              )}
            </div>

            {/* Ошибка */}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex items-center justify-end gap-3 px-6 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !name.trim()}
              className="px-6 py-2.5 bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
            >
              {isLoading ? 'Создание...' : 'Создать группу'}
            </button>
          </div>
        </div>
      </div>

      {/* Поиск пользователей */}
      {showUserSearch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6">
            <UserSearch
              onSelect={handleSelectUser}
              onClose={() => setShowUserSearch(false)}
              showStartChat={false}
            />
          </div>
        </div>
      )}
    </>
  )
}
