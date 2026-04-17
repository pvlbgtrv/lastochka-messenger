import { useChatStore } from '@/store/chatStore'
import { X } from 'lucide-react'

const COMMON_EMOJIS: string[][] = [
  ['🥹', '😊', '😁', '🤩', '😎', '🥳'],
  ['😂', '🤣', '😉', '😇', '🙃', '🤗'],
  ['🫶', '❤️', '💙', '💜', '✨', '🌈'],
  ['🔥', '⚡', '💯', '🚀', '🎯', '🏆'],
  ['👍', '👏', '🙌', '🤝', '🙏', '👌'],
  ['🤔', '😮', '😢', '😤', '😴', '🤯'],
  ['🎉', '🎁', '🎨', '🎵', '📷', '🍕'],
  ['🐱', '🦊', '🐼', '🦄', '🐧', '🕊️'],
]

export default function EmojiStickerPicker() {
  const {
    showEmojiPicker,
    showStickerPicker,
    stickerPacks,
    selectedStickerPack,
    sendMessage,
    setShowEmojiPicker,
    setShowStickerPicker,
    setSelectedStickerPack,
    emojiStyle,
  } = useChatStore()

  if (!showEmojiPicker && !showStickerPicker) return null

  const handleEmojiSelect = (emoji: string) => {
    sendMessage(emoji)
    setShowEmojiPicker(false)
  }

  const handleStickerSelect = (stickerUrl: string) => {
    sendMessage('', undefined, stickerUrl)
    setShowStickerPicker(false)
  }

  const activePack = stickerPacks.find((p) => p.id === selectedStickerPack) || stickerPacks[0]

  return (
    <div className="glass-strong dark:glass-strong-dark border-t border-gray-200/50 dark:border-gray-700/30 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200/50 dark:border-gray-700/30">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmojiPicker(true)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
              showEmojiPicker
                ? 'bg-brand text-white'
                : 'bg-white/60 dark:bg-surface-variant-dark/60 text-gray-600 dark:text-gray-300'
            }`}
          >
            Эмодзи
          </button>
          <button
            onClick={() => setShowStickerPicker(true)}
            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
              showStickerPicker
                ? 'bg-brand text-white'
                : 'bg-white/60 dark:bg-surface-variant-dark/60 text-gray-600 dark:text-gray-300'
            }`}
          >
            Стикеры
          </button>
        </div>
        <button
          onClick={() => {
            setShowEmojiPicker(false)
            setShowStickerPicker(false)
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-all"
        >
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="h-[220px] md:h-[240px] overflow-y-auto p-3">
        {showEmojiPicker && (
          <div className="grid grid-cols-6 gap-2">
            {COMMON_EMOJIS.flat().map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSelect(emoji)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95 ${
                  emojiStyle === 'classic'
                    ? 'text-[26px] bg-white/65 dark:bg-surface-variant-dark/55 hover:bg-white dark:hover:bg-surface-dark hover:scale-110'
                    : 'text-[22px] bg-transparent hover:bg-black/5 dark:hover:bg-white/8 hover:scale-105'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {showStickerPicker && (
          <div>
            {/* Pack tabs */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {stickerPacks.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setSelectedStickerPack(pack.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${
                    activePack?.id === pack.id
                      ? 'bg-brand text-white'
                      : 'bg-white/60 dark:bg-surface-variant-dark/60 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <span>{pack.coverUrl}</span>
                  <span>{pack.name}</span>
                </button>
              ))}
            </div>

            {/* Stickers grid */}
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(64px,64px))] justify-center gap-2.5">
              {activePack?.stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  onClick={() => handleStickerSelect(sticker.url)}
                  className="w-16 h-16 flex items-center justify-center text-[34px] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {sticker.emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
