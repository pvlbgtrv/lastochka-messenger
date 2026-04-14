import { useState, useRef, type KeyboardEvent, useEffect, useCallback } from 'react'
import { useChatStore } from '@/store/chat'
import Icon from '@/components/ui/Icon'
import { X, Image as ImageIcon, Mic, Send, Square } from 'lucide-react'
import { useVoiceRecorder, formatDuration } from '@/hooks/useVoiceRecorder'

export default function MessageInput() {
  const [text, setText] = useState('')
  const {
    activeChatId,
    sendMessage,
    sendTypingNotification,
    replyToMessage,
    setReplyTo,
    sendImageMessage,
    setImagePreview,
    imagePreview,
    isSendingImage,
    imageUploadProgress,
    sendVoiceMessage,
    cancelVoiceRecording,
  } = useChatStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedFileRef = useRef<File | null>(null)

  const {
    isRecording,
    duration,
    blob: voiceBlob,
    audioUrl: voiceAudioUrl,
    error: voiceError,
    startRecording,
    stopRecording: stopRecorder,
    cancelRecording,
  } = useVoiceRecorder()

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (voiceAudioUrl && voiceBlob) {
      // Recording finished
    }
  }, [voiceAudioUrl, voiceBlob])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || !activeChatId) return
    sendMessage(trimmed)
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'
    if (activeChatId) {
      sendTypingNotification(activeChatId)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null }, 500)
    }
  }

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeChatId) return
    if (!file.type.startsWith('image/')) return
    selectedFileRef.current = file
    const reader = new FileReader()
    reader.onload = (event) => setImagePreview(event.target?.result as string)
    reader.readAsDataURL(file)
  }, [activeChatId, setImagePreview])

  const handleSendImage = useCallback(() => {
    const file = selectedFileRef.current
    if (!file) return
    sendImageMessage(file)
    selectedFileRef.current = null
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [sendImageMessage, setImagePreview])

  const handleCancelImage = useCallback(() => {
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [setImagePreview])

  const handleSendVoice = useCallback(() => {
    sendVoiceMessage()
  }, [sendVoiceMessage])

  const handleCancelVoice = useCallback(() => {
    cancelRecording()
    cancelVoiceRecording()
  }, [cancelRecording, cancelVoiceRecording])

  const handleMicClick = useCallback(() => {
    if (isRecording) stopRecorder()
    else startRecording()
  }, [isRecording, startRecording, stopRecorder])

  const hasContent = text.trim() || imagePreview || voiceAudioUrl || isRecording

  return (
    <div className="flex-shrink-0 bg-white/90 dark:bg-[#17212b] backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/50">
      {/* Voice Recording / Preview */}
      {(isRecording || voiceAudioUrl) && (
        <div className="px-4 py-3 border-b border-gray-100/50 dark:border-gray-800/50">
          {isRecording && (
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                  <Mic size={20} className="text-white" />
                </div>
                <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Запись голосового...</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatDuration(duration)}</p>
              </div>
              <button onClick={cancelRecording} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
              <button onClick={stopRecorder} className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all shadow-lg shadow-red-500/30 active:scale-90">
                <Square size={16} />
              </button>
            </div>
          )}
          {!isRecording && voiceAudioUrl && (
            <div className="flex items-center gap-3">
              <audio src={voiceAudioUrl} controls className="flex-1 h-10 rounded-lg" />
              <button onClick={handleSendVoice} className="w-11 h-11 rounded-full bg-brand hover:bg-brand-dark flex items-center justify-center text-white transition-all shadow-lg shadow-brand/25 active:scale-90">
                <Send size={18} />
              </button>
              <button onClick={handleCancelVoice} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>
          )}
          {voiceError && <p className="text-sm text-red-500">{voiceError}</p>}
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && !voiceAudioUrl && !isRecording && (
        <div className="relative px-4 py-3 border-b border-gray-100/50 dark:border-gray-800/50">
          <div className="relative inline-block group">
            <img src={imagePreview} alt="Превью" className="max-h-[200px] max-w-[300px] rounded-xl object-contain border border-gray-200/50 dark:border-gray-700/50 shadow-sm" />
            <button onClick={handleCancelImage} className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-90">
              <X size={14} />
            </button>
            {isSendingImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl backdrop-blur-sm">
                <div className="text-white text-center">
                  <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-medium">{Math.round(imageUploadProgress * 100)}%</p>
                </div>
              </div>
            )}
          </div>
          {!isSendingImage && (
            <div className="flex gap-2 mt-3">
              <button onClick={handleSendImage} className="px-5 py-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-brand/25 active:scale-95">
                Отправить
              </button>
              <button onClick={handleCancelImage} className="px-5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-all active:scale-95">
                Отмена
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reply Preview */}
      {replyToMessage && !imagePreview && !voiceAudioUrl && !isRecording && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100/50 dark:border-gray-800/50">
          <div className="w-1 h-9 rounded-full bg-brand flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-brand font-semibold truncate">{replyToMessage.senderName || 'Пользователь'}</p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{replyToMessage.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 py-3">
        <button className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 dark:text-gray-500 hover:text-brand hover:bg-brand/5 dark:hover:bg-brand/10 transition-all duration-200 flex-shrink-0 active:scale-90">
          <Icon name="emoji" size={21} />
        </button>

        <div className="flex-1 bg-gray-50/80 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl px-4 py-2.5 flex items-end gap-2 focus-within:border-brand/50 focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:shadow-sm transition-all duration-200">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Сообщение"
            className="flex-1 bg-transparent resize-none outline-none text-[14px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 leading-relaxed max-h-[150px] overflow-y-auto scrollbar-none"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-brand transition-colors flex-shrink-0 rounded-lg hover:bg-brand/5 transition-all active:scale-90"
          >
            <ImageIcon size={19} />
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

        <button
          onClick={hasContent ? (text.trim() ? handleSend : handleMicClick) : undefined}
          className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 flex-shrink-0 active:scale-90 ${
            hasContent
              ? 'bg-brand hover:bg-brand-dark text-white shadow-lg shadow-brand/30'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
          }`}
          title={text.trim() ? 'Отправить' : isRecording ? 'Остановить запись' : 'Голосовое сообщение'}
        >
          {isRecording ? <Square size={18} /> : text.trim() ? <Icon name="send" size={19} /> : <Mic size={19} />}
        </button>
      </div>
    </div>
  )
}
