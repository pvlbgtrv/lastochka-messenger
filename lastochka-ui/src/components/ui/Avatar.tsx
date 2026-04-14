import clsx from 'clsx'

interface AvatarProps {
  name: string
  src?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean
  className?: string
}

const COLORS = [
  'bg-[#e17076]', 'bg-[#7bc862]', 'bg-[#65aadd]',
  'bg-[#a695e7]', 'bg-[#ee7aae]', 'bg-[#faa774]',
  'bg-[#6ec9cb]', 'bg-[#2AABEE]',
]

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ name, src, size = 'md', online, className }: AvatarProps) {
  const sizeClass = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-base', xl: 'w-32 h-32 text-4xl' }[size]

  return (
    <div className={clsx('relative flex-shrink-0', className)}>
      <div className={clsx('rounded-full flex items-center justify-center font-medium text-white select-none', sizeClass, !src && getColor(name))}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
        ) : (
          initials(name)
        )}
      </div>
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#4dcd5e] border-2 border-sidebar dark:border-sidebar-dark rounded-full" />
      )}
    </div>
  )
}
