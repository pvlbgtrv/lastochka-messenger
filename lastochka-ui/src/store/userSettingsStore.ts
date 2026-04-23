import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppLanguage = 'ru' | 'en'
export type AccentColor = 'indigo' | 'emerald' | 'rose'
export type MediaAutoload = 'all' | 'wifi' | 'none'

interface UserSettingsState {
  notificationsEnabled: boolean
  chatNotificationsEnabled: boolean
  vibrationEnabled: boolean
  privacyShowStatus: boolean
  privacyAllowSearch: boolean
  privacyReadReceipts: boolean
  security2FA: boolean
  language: AppLanguage
  accentColor: AccentColor
  mediaAutoload: MediaAutoload
  setNotificationsEnabled: (value: boolean) => void
  setChatNotificationsEnabled: (value: boolean) => void
  setVibrationEnabled: (value: boolean) => void
  setPrivacyShowStatus: (value: boolean) => void
  setPrivacyAllowSearch: (value: boolean) => void
  setPrivacyReadReceipts: (value: boolean) => void
  setSecurity2FA: (value: boolean) => void
  setLanguage: (value: AppLanguage) => void
  setAccentColor: (value: AccentColor) => void
  setMediaAutoload: (value: MediaAutoload) => void
  cycleMediaAutoload: () => void
}

const LEGACY_SETTINGS_KEY = 'lastochka.settings.v1'
const USER_SETTINGS_KEY = 'lastochka.userSettings.v1'

type SettingsFields = Pick<
  UserSettingsState,
  | 'notificationsEnabled'
  | 'chatNotificationsEnabled'
  | 'vibrationEnabled'
  | 'privacyShowStatus'
  | 'privacyAllowSearch'
  | 'privacyReadReceipts'
  | 'security2FA'
  | 'language'
  | 'accentColor'
  | 'mediaAutoload'
>

const defaultSettings: SettingsFields = {
  notificationsEnabled: true,
  chatNotificationsEnabled: true,
  vibrationEnabled: true,
  privacyShowStatus: true,
  privacyAllowSearch: true,
  privacyReadReceipts: true,
  security2FA: false,
  language: 'ru',
  accentColor: 'indigo',
  mediaAutoload: 'all',
}

function readLegacySettings(): Partial<SettingsFields> {
  try {
    const raw = localStorage.getItem(LEGACY_SETTINGS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<SettingsFields>
    return parsed ?? {}
  } catch {
    return {}
  }
}

const initialSettings: SettingsFields = {
  ...defaultSettings,
  ...readLegacySettings(),
}

export const useUserSettingsStore = create<UserSettingsState>()(
  persist(
    (set, get) => ({
      ...initialSettings,
      setNotificationsEnabled: (value) => set({ notificationsEnabled: value }),
      setChatNotificationsEnabled: (value) => set({ chatNotificationsEnabled: value }),
      setVibrationEnabled: (value) => set({ vibrationEnabled: value }),
      setPrivacyShowStatus: (value) => set({ privacyShowStatus: value }),
      setPrivacyAllowSearch: (value) => set({ privacyAllowSearch: value }),
      setPrivacyReadReceipts: (value) => set({ privacyReadReceipts: value }),
      setSecurity2FA: (value) => set({ security2FA: value }),
      setLanguage: (value) => set({ language: value }),
      setAccentColor: (value) => set({ accentColor: value }),
      setMediaAutoload: (value) => set({ mediaAutoload: value }),
      cycleMediaAutoload: () => {
        const current = get().mediaAutoload
        const next = current === 'all' ? 'wifi' : current === 'wifi' ? 'none' : 'all'
        set({ mediaAutoload: next })
      },
    }),
    {
      name: USER_SETTINGS_KEY,
    },
  ),
)
