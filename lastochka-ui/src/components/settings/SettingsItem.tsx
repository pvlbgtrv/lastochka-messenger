import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

// ─── Settings Section ────────────────────────────────────────────

interface SettingsSectionProps {
  title?: string
  children: ReactNode
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="mb-6">
      {title && (
        <h3 className="px-4 mb-2 text-[12px] font-semibold text-muted uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div className="mx-4 glass dark:glass-dark rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// ─── Settings Item ───────────────────────────────────────────────

interface SettingsItemProps {
  icon: ReactNode
  label: string
  description?: string
  right?: ReactNode
  onClick?: () => void
  danger?: boolean
}

export function SettingsItem({
  icon,
  label,
  description,
  right,
  onClick,
  danger,
}: SettingsItemProps) {
  const content = (
    <>
      {/* Icon */}
      <div
        className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          danger
            ? 'bg-red-100 dark:bg-red-900/30'
            : 'bg-brand/10 dark:bg-brand/20'
        )}
      >
        <span className={danger ? 'text-red-500' : 'text-brand'}>{icon}</span>
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0 ml-3">
        <p className={clsx('text-[15px] font-medium truncate', danger ? 'text-red-500' : 'text-gray-900 dark:text-gray-100')}>
          {label}
        </p>
        {description && (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {description}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {right}
        {onClick && (
          <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center px-4 py-3.5 hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors"
      >
        {content}
      </button>
    )
  }

  return (
    <div className="flex items-center px-4 py-3.5">
      {content}
    </div>
  )
}

// ─── Settings Toggle ─────────────────────────────────────────────

interface SettingsToggleProps {
  icon: ReactNode
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SettingsToggle({ icon, label, description, checked, onChange }: SettingsToggleProps) {
  return (
    <div className="flex items-center px-4 py-3.5">
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center flex-shrink-0 text-brand">
        {icon}
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0 ml-3">
        <p className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
          {label}
        </p>
        {description && (
          <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {description}
          </p>
        )}
      </div>

      {/* Toggle switch */}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0',
          checked ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

// ─── Divider ─────────────────────────────────────────────────────

export function SettingsDivider() {
  return <div className="h-px bg-gray-200/50 dark:bg-gray-700/50 mx-4" />
}
