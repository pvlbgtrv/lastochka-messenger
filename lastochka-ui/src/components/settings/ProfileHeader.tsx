import { Camera } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export default function ProfileHeader() {
  const { displayName, avatar, userId } = useAuthStore()
  
  const name = displayName || 'Пользователь'
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex flex-col items-center pt-4 pb-6 px-4">
      {/* Avatar */}
      <div className="relative mb-4">
        {avatar ? (
          <img src={avatar} alt={name} className="w-24 h-24 rounded-full object-cover shadow-lg" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-brand/25">
            {initials}
          </div>
        )}
        <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-surface-dark border-2 border-brand flex items-center justify-center shadow-md">
          <Camera size={14} className="text-brand" />
        </button>
      </div>

      {/* Name */}
      <h2 className="text-[22px] font-bold text-gray-900 dark:text-gray-100 text-center">
        {name}
      </h2>
      {userId && (
        <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1 font-mono">
          ID: {userId}
        </p>
      )}
    </div>
  )
}
