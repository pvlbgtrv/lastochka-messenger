import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bot, KeyRound, Plus, RefreshCw, Save, Send, ShieldOff, Trash2, Webhook } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/auth'
import {
  createBot,
  createTestUpdate,
  deleteBot,
  deleteBotWebhook,
  listBots,
  regenerateBotToken,
  revokeBotToken,
  setBotWebhook,
  updateBot,
  type BotRecord,
} from '@/lib/bot-api'

function provisionStatusLabel(status?: BotRecord['provision_status']): string {
  if (status === 'ready') return 'Готов'
  if (status === 'failed') return 'Ошибка'
  return 'Подготовка'
}

function provisionStatusClasses(status?: BotRecord['provision_status']): string {
  if (status === 'ready') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
  if (status === 'failed') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
}

interface BotsScreenProps {
  embedded?: boolean
}

export default function BotsScreen({ embedded = false }: BotsScreenProps) {
  const { goBack } = useChatStore()
  const { userId } = useAuthStore()
  const [bots, setBots] = useState<BotRecord[]>([])
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenPreview, setTokenPreview] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newAbout, setNewAbout] = useState('')

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  )

  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editAbout, setEditAbout] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const selectedBotReady = selectedBot?.provision_status === 'ready'

  useEffect(() => {
    if (!userId) return
    void reloadBots(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    setEditName(selectedBot?.display_name ?? '')
    setEditUsername(selectedBot?.username ?? '')
    setEditAbout(selectedBot?.about ?? '')
    setWebhookUrl(selectedBot?.webhook_url ?? '')
    setWebhookSecret('')
  }, [selectedBot])

  useEffect(() => {
    if (!userId || !selectedBot || selectedBot.provision_status !== 'pending') {
      return
    }
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      if (cancelled) return
      await reloadBots(userId, true)
      if (cancelled) return
      timer = window.setTimeout(poll, 4000)
    }

    timer = window.setTimeout(poll, 2500)
    return () => {
      cancelled = true
      if (timer !== undefined) {
        window.clearTimeout(timer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedBot?.id, selectedBot?.provision_status])

  async function reloadBots(ownerId: string, silent = false) {
    if (!silent) {
      setIsLoading(true)
      setError(null)
    }
    try {
      const data = await listBots(ownerId)
      setBots(data)
      setSelectedBotId((prev) => prev ?? data[0]?.id ?? null)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить ботов')
      }
    } finally {
      if (!silent) {
        setIsLoading(false)
      }
    }
  }

  async function handleCreate() {
    if (!userId) return
    setError(null)
    setTokenPreview(null)
    try {
      const data = await createBot(userId, {
        display_name: newName,
        username: newUsername,
        about: newAbout,
      })
      setBots((prev) => [data.bot, ...prev])
      setSelectedBotId(data.bot.id)
      setTokenPreview(data.api_token)
      setNewName('')
      setNewUsername('')
      setNewAbout('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать бота')
    }
  }

  async function handleSave() {
    if (!userId || !selectedBot) return
    setError(null)
    try {
      const updated = await updateBot(userId, selectedBot.id, {
        display_name: editName,
        username: editUsername,
        about: editAbout,
      })
      setBots((prev) => prev.map((bot) => (bot.id === updated.id ? updated : bot)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения')
    }
  }

  async function handleRegenerateToken() {
    if (!userId || !selectedBot) return
    setError(null)
    try {
      const data = await regenerateBotToken(userId, selectedBot.id)
      setBots((prev) => prev.map((bot) => (bot.id === data.bot.id ? data.bot : bot)))
      setTokenPreview(data.api_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сгенерировать новый ключ')
    }
  }

  async function handleRevokeToken() {
    if (!userId || !selectedBot) return
    setError(null)
    try {
      const data = await revokeBotToken(userId, selectedBot.id)
      setBots((prev) => prev.map((bot) => (bot.id === data.id ? data : bot)))
      setTokenPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отозвать ключ')
    }
  }

  async function handleSetWebhook() {
    if (!userId || !selectedBot) return
    setError(null)
    try {
      const updated = await setBotWebhook(userId, selectedBot.id, {
        url: webhookUrl,
        secret: webhookSecret,
      })
      setBots((prev) => prev.map((bot) => (bot.id === updated.id ? updated : bot)))
      setWebhookSecret('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить webhook')
    }
  }

  async function handleDeleteWebhook() {
    if (!userId || !selectedBot) return
    setError(null)
    try {
      const updated = await deleteBotWebhook(userId, selectedBot.id)
      setBots((prev) => prev.map((bot) => (bot.id === updated.id ? updated : bot)))
      setWebhookUrl('')
      setWebhookSecret('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить webhook')
    }
  }

  async function handleDeleteBot() {
    if (!userId || !selectedBot) return
    if (!window.confirm(`Удалить бота "${selectedBot.display_name}"?`)) return
    setError(null)
    setTokenPreview(null)
    try {
      await deleteBot(userId, selectedBot.id)
      const nextBots = bots.filter((bot) => bot.id !== selectedBot.id)
      setBots(nextBots)
      setSelectedBotId((prev) => (prev === selectedBot.id ? (nextBots[0]?.id ?? null) : prev))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить бота')
    }
  }

  async function handleTestUpdate() {
    if (!userId || !selectedBot) return
    setError(null)
    try {
      const chatId = selectedBot.tinode_topic?.trim() || 'manual-test-chat'
      await createTestUpdate(userId, selectedBot.id, {
        chat_id: chatId,
        text: `Manual test at ${new Date().toISOString()}`,
      })
      await reloadBots(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать тестовый апдейт')
    }
  }

  return (
    <div className={embedded ? 'h-full' : 'flex flex-col h-full bg-gradient-to-br from-[#f8f9fc] via-[#f0f2f7] to-[#e8ecf3] dark:from-[#0a0f18] dark:via-[#0e1621] dark:to-[#111b27]'}>
      {!embedded && (
        <header className="flex items-center gap-3 px-3 pt-12 pb-3 safe-top glass-strong dark:glass-strong-dark z-10">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all tap-target"
          >
            <ArrowLeft size={22} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h1 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Чат-боты</h1>
        </header>
      )}

      <div className={embedded ? 'p-4 space-y-5' : 'flex-1 overflow-y-auto overscroll-contain p-4 space-y-5'}>
        <section className="glass dark:glass-dark rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">Создать бота</h2>
          <div className="grid gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название"
              className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm"
            />
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
              placeholder="Логин (например: support_bot)"
              className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm"
            />
            <textarea
              value={newAbout}
              onChange={(e) => setNewAbout(e.target.value)}
              placeholder="Описание (опционально)"
              rows={2}
              className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm resize-none"
            />
            <button
              onClick={() => void handleCreate()}
              className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white font-medium hover:bg-brand/90 transition"
            >
              <Plus size={16} />
              Создать
            </button>
          </div>
        </section>

        <section className="glass dark:glass-dark rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Мои боты</h2>
            <button
              onClick={() => userId && void reloadBots(userId)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:text-brand transition"
            >
              <RefreshCw size={13} />
              Обновить
            </button>
          </div>
          {isLoading ? (
            <div className="text-sm text-gray-500">Загрузка...</div>
          ) : bots.length === 0 ? (
            <div className="text-sm text-gray-500">Ботов пока нет</div>
          ) : (
            <div className="space-y-2">
              {bots.map((bot) => (
                <button
                  key={bot.id}
                  onClick={() => setSelectedBotId(bot.id)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                    selectedBotId === bot.id
                      ? 'border-brand bg-brand/10'
                      : 'border-white/30 dark:border-white/10 bg-white/60 dark:bg-[#182333]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-brand" />
                    <span className="text-sm font-medium">{bot.display_name}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${provisionStatusClasses(bot.provision_status)}`}>
                      {provisionStatusLabel(bot.provision_status)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">@{bot.username}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedBot && (
          <section className="glass dark:glass-dark rounded-2xl p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Управление ботом</h2>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm w-full"
            />
            <input
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
              className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm w-full"
            />
            <textarea
              value={editAbout}
              onChange={(e) => setEditAbout(e.target.value)}
              rows={2}
              className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm w-full resize-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-white text-sm"
              >
                <Save size={14} />
                Сохранить
              </button>
              <button
                onClick={() => void handleRegenerateToken()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm"
              >
                <KeyRound size={14} />
                Новый API ключ
              </button>
              <button
                onClick={() => void handleRevokeToken()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 text-white text-sm"
              >
                <ShieldOff size={14} />
                Отозвать ключ
              </button>
              <button
                onClick={() => void handleDeleteBot()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-700 text-white text-sm"
              >
                <Trash2 size={14} />
                Удалить бота
              </button>
            </div>
            <div className="rounded-xl border border-white/40 dark:border-white/10 p-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Provision:</span>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${provisionStatusClasses(selectedBot.provision_status)}`}>
                  {provisionStatusLabel(selectedBot.provision_status)}
                </span>
              </div>
              <div>Tinode topic: {selectedBot.tinode_topic || '—'}</div>
              {selectedBot.provision_status === 'pending' ? <div>Идёт автообновление статуса…</div> : null}
              {selectedBot.provision_error ? <div>Ошибка: {selectedBot.provision_error}</div> : null}
            </div>
            <div className="rounded-xl border border-white/40 dark:border-white/10 p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Webhook</div>
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/bot-webhook"
                className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm w-full"
              />
              <input
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Secret (для подписи X-Bot-Signature)"
                className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-[#1a2534] border border-white/40 dark:border-white/10 text-sm w-full"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleSetWebhook()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm"
                >
                  <Webhook size={14} />
                  Сохранить webhook
                </button>
                <button
                  onClick={() => void handleDeleteWebhook()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-500 text-white text-sm"
                >
                  <ShieldOff size={14} />
                  Удалить webhook
                </button>
                <button
                  onClick={() => void handleTestUpdate()}
                  disabled={!selectedBotReady}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                  Тестовый апдейт
                </button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <div>Last webhook status: {selectedBot.webhook_last_status ?? 0}</div>
                {selectedBot.webhook_last_error ? <div>Last error: {selectedBot.webhook_last_error}</div> : null}
                {selectedBot.webhook_last_delivery_at ? <div>Last delivery: {selectedBot.webhook_last_delivery_at}</div> : null}
              </div>
            </div>
          </section>
        )}

        {tokenPreview && (
          <section className="glass dark:glass-dark rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">API ключ (показывается один раз)</h2>
            <code className="block text-xs break-all bg-black/80 text-emerald-300 p-3 rounded-xl">{tokenPreview}</code>
          </section>
        )}

        {error && (
          <section className="rounded-2xl p-3 bg-red-100/80 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-sm">
            {error}
          </section>
        )}

        {!embedded && <div className="safe-bottom" />}
      </div>
    </div>
  )
}
