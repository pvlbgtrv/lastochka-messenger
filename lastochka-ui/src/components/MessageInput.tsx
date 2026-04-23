import { useEffect, useState, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { draftyToMarkdown } from '@/lib/tinode-client'
import { Send, Smile, Mic, ImagePlus, X, Bold, Italic, Strikethrough, Code, Link } from 'lucide-react'
import EmojiStickerPicker from './EmojiStickerPicker'

// в”Ђв”Ђв”Ђ Serialise contentEditable в†’ markdown в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function normalizeLinkUrl(rawUrl: string): string {
  const url = rawUrl.trim()
  if (!url) return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url
  return `https://${url}`
}

type DraftyFmt = { at: number; len: number; tp?: string; key?: number }
type DraftyEnt = { tp: string; data?: Record<string, unknown> }

function pushFmt(fmt: DraftyFmt[], span: DraftyFmt) {
  if (span.len <= 0) return
  fmt.push(span)
}

function serializeToDrafty(el: HTMLElement): { txt: string; fmt?: DraftyFmt[]; ent?: DraftyEnt[] } | null {
  const txtParts: string[] = []
  const fmt: DraftyFmt[] = []
  const ent: DraftyEnt[] = []

  const walk = (node: Node, styles: string[], linkKey?: number) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent ?? ''
      if (!value) return
      const at = txtParts.join('').length
      txtParts.push(value)
      for (const tp of styles) {
        pushFmt(fmt, { at, len: value.length, tp })
      }
      if (typeof linkKey === 'number') {
        pushFmt(fmt, { at, len: value.length, key: linkKey })
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const elNode = node as HTMLElement
    const tag = elNode.tagName.toLowerCase()

    if (tag === 'br') {
      txtParts.push('\n')
      return
    }

    let nextStyles = styles
    let nextLinkKey = linkKey
    if (tag === 'strong' || tag === 'b') nextStyles = [...styles, 'ST']
    if (tag === 'em' || tag === 'i') nextStyles = [...nextStyles, 'EM']
    if (tag === 'del' || tag === 's') nextStyles = [...nextStyles, 'DL']
    if (tag === 'code') nextStyles = [...nextStyles, 'CO']
    if (tag === 'a') {
      const href = normalizeLinkUrl(elNode.getAttribute('href') ?? '')
      if (href) {
        const key = ent.length
        ent.push({ tp: 'LN', data: { url: href } })
        nextLinkKey = key
      }
    }

    for (const child of Array.from(elNode.childNodes)) {
      walk(child, nextStyles, nextLinkKey)
    }
  }

  for (const child of Array.from(el.childNodes)) {
    walk(child, [])
  }

  const txt = txtParts.join('')
  if (!txt.trim()) return null
  return {
    txt,
    ...(fmt.length ? { fmt } : {}),
    ...(ent.length ? { ent } : {}),
  }
}

// в”Ђв”Ђв”Ђ Parse markdown в†’ HTML (for edit-mode prefill) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function mdToHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, '<strong>$1</strong>')
    .replace(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, '<em>$1</em>')
    .replace(/~~([^~\n]+?)~~/g, '<del>$1</del>')
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]\n]*?)\]\(([^)\n]+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>')
}

// в”Ђв”Ђв”Ђ Format toolbar button в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

function FmtBtn({
  children,
  onActivate,
  title,
}: {
  children: React.ReactNode
  onActivate: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onActivate() }}
      title={title}
      className="w-7 h-7 rounded flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-black/8 dark:hover:bg-white/8 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >
      {children}
    </button>
  )
}

// в”Ђв”Ђв”Ђ MessageInput в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type FmtType = 'bold' | 'italic' | 'strike' | 'code'

const FMT_TAGS: Record<FmtType, string> = {
  bold: 'strong', italic: 'em', strike: 'del', code: 'code',
}

export default function MessageInput() {
  const [isEmpty, setIsEmpty] = useState(true)
  const [isFocused, setIsFocused] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const editorRef    = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef  = useRef<HTMLInputElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const {
    sendMessage, replyToMessage, editMessage,
    showEmojiPicker, showStickerPicker,
    setShowEmojiPicker, setShowStickerPicker,
    replyToId, editingMessageId,
    startReply, startEdit,
    messages, activeChatId,
  } = useChatStore()

  const replyMessage = replyToId && activeChatId
    ? messages[activeChatId]?.find((m) => m.id === replyToId)
    : null

  // в”Ђв”Ђ Helpers в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

  const checkEmpty = () => {
    setIsEmpty(!(editorRef.current?.textContent?.trim()))
  }

  const clearEditor = () => {
    if (editorRef.current) editorRef.current.innerHTML = ''
    setIsEmpty(true)
  }

  const focusEnd = (el: HTMLElement) => {
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  // в”Ђв”Ђ Edit mode: prefill editor в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !editingMessageId) return
    const msg = activeChatId
      ? messages[activeChatId]?.find((m) => m.id === editingMessageId)
      : undefined
    if (!msg) return
    editor.innerHTML = mdToHtml(msg.text)
    setIsEmpty(false)
    requestAnimationFrame(() => focusEnd(editor))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMessageId])

  // в”Ђв”Ђ Send в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const handleSend = () => {
    const editor = editorRef.current
    if (!editor) return
    const drafty = serializeToDrafty(editor)
    const text = draftyToMarkdown(drafty || '').trim()
    if (!text) return

    if (editingMessageId) {
      void editMessage(editingMessageId, text, drafty)
      startEdit(null)
    } else if (replyToId) {
      void replyToMessage(replyToId, text, drafty)
      startReply(null)
    } else {
      void sendMessage(text, undefined, undefined, drafty)
    }
    clearEditor()
  }

  // в”Ђв”Ђ Image в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const handlePickImage = () => imageInputRef.current?.click()

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    void sendMessage('', file)
    e.target.value = ''
  }

  // в”Ђв”Ђ Paste в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items
    const imageItem = items ? Array.from(items).find((i) => i.type.startsWith('image/')) : null
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) void sendMessage('', file)
      return
    }

    // Plain text paste only (no HTML bleed-in)
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text) return

    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    const range = sel.getRangeAt(0)
    range.deleteContents()

    const lines = text.split('\n')
    lines.forEach((line, i) => {
      if (i > 0) {
        const br = document.createElement('br')
        range.insertNode(br)
        range.setStartAfter(br)
      }
      if (line) {
        const tn = document.createTextNode(line)
        range.insertNode(tn)
        range.setStartAfter(tn)
      }
    })
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    checkEmpty()
  }

  // в”Ђв”Ђ Keyboard shortcuts в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }
    // Shift+Enter в†’ explicit <br> (prevents browser from inserting <div>)
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const br = document.createElement('br')
        range.insertNode(br)
        range.setStartAfter(br)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
      }
      checkEmpty()
      return
    }
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); applyFormat('bold') }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); applyFormat('italic') }
      if (e.key === 'u' || e.key === 'U') { e.preventDefault(); applyFormat('strike') }
    }
  }

  // в”Ђв”Ђ Format в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const applyFormat = (type: FmtType) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()

    // Use browser's built-in toggle behavior for common inline formats.
    if (type === 'bold' || type === 'italic' || type === 'strike') {
      const cmd = type === 'bold' ? 'bold' : type === 'italic' ? 'italic' : 'strikeThrough'
      document.execCommand(cmd)
      checkEmpty()
      return
    }

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    const selectedText = range.toString()

    const el = document.createElement(FMT_TAGS[type])

    if (selectedText) {
      try {
        range.surroundContents(el)
      } catch {
        // Selection spans multiple nodes вЂ” extract and wrap
        el.appendChild(range.extractContents())
        range.insertNode(el)
      }
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      // No selection вЂ” insert placeholder and select it
      el.textContent = 'текст'
      range.insertNode(el)
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    checkEmpty()
  }

  const handleLinkButton = () => {
    const sel = window.getSelection()
    if (sel?.rangeCount) savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    setShowLinkInput(true)
    requestAnimationFrame(() => linkInputRef.current?.focus())
  }

  const applyLink = () => {
    const normalizedUrl = normalizeLinkUrl(linkUrl)
    if (!normalizedUrl) return
    const editor = editorRef.current
    if (!editor) return
    editor.focus()

    const sel = window.getSelection()
    if (!sel) return

    if (savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }

    const range = sel.getRangeAt(0)
    const selectedText = range.toString()

    const a = document.createElement('a')
    a.href = normalizedUrl
    a.textContent = selectedText || normalizedUrl
    if (selectedText) range.deleteContents()
    range.insertNode(a)
    range.setStartAfter(a)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)

    setShowLinkInput(false)
    setLinkUrl('')
    savedRangeRef.current = null
    checkEmpty()
  }

  const cancelLink = () => {
    setShowLinkInput(false)
    setLinkUrl('')
    savedRangeRef.current = null
  }

  // в”Ђв”Ђ Pickers close on outside click в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const isPickerOpen = showEmojiPicker || showStickerPicker

  useEffect(() => {
    if (!isPickerOpen) return
    const close = () => { setShowEmojiPicker(false); setShowStickerPicker(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onPtr = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPtr)
    document.addEventListener('touchstart', onPtr, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPtr)
      document.removeEventListener('touchstart', onPtr)
    }
  }, [isPickerOpen, setShowEmojiPicker, setShowStickerPicker])

  // в”Ђв”Ђ Auto-focus on reply/edit в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  useEffect(() => {
    if (replyToId || editingMessageId) editorRef.current?.focus()
  }, [replyToId, editingMessageId])

  // в”Ђв”Ђв”Ђ Render в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  return (
    <div ref={containerRef} className="safe-bottom">
      {(showEmojiPicker || showStickerPicker) && <EmojiStickerPicker />}

      {/* Reply bar */}
      {replyMessage && (
        <div className="flex items-center gap-2 px-3 py-2 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-brand truncate">
              Ответ: {replyMessage.senderName || 'Пользователь'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {replyMessage.text}
            </p>
          </div>
          <button type="button" onClick={() => startReply(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Editing bar */}
      {editingMessageId && (
        <div className="flex items-center gap-2 px-3 py-2 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-brand truncate">Редактирование сообщения</p>
          </div>
          <button type="button" onClick={() => startEdit(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Formatting toolbar */}
      {isFocused && !showLinkInput && (
        <div className="flex items-center gap-0.5 px-3 py-1 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
          <FmtBtn onActivate={() => applyFormat('bold')}   title="Жирный (Ctrl+B)"><Bold         size={14} /></FmtBtn>
          <FmtBtn onActivate={() => applyFormat('italic')} title="Курсив (Ctrl+I)"><Italic        size={14} /></FmtBtn>
          <FmtBtn onActivate={() => applyFormat('strike')} title="Зачёркнутый (Ctrl+U)"><Strikethrough size={14} /></FmtBtn>
          <FmtBtn onActivate={() => applyFormat('code')}   title="Код"><Code          size={14} /></FmtBtn>
          <div className="w-px h-4 bg-gray-200/60 dark:bg-gray-600/40 mx-1" />
          <FmtBtn onActivate={handleLinkButton} title="Ссылка"><Link size={14} /></FmtBtn>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-400/60 dark:text-gray-600/60 pr-1 select-none">Shift+Enter - новая строка</span>
        </div>
      )}

      {/* Link URL input */}
      {isFocused && showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-1.5 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
          <Link size={13} className="text-gray-400 shrink-0" />
          <input
            ref={linkInputRef}
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              if (e.key === 'Escape') cancelLink()
            }}
            className="flex-1 bg-transparent text-[13px] text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
          />
          <button type="button" onClick={applyLink} disabled={!linkUrl.trim()}
            className="text-[13px] font-semibold text-brand disabled:opacity-30 transition-opacity">ОК</button>
          <button type="button" onClick={cancelLink}>
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 py-2 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 tap-target shadow-sm ${
            showEmojiPicker
              ? 'bg-gradient-to-br from-brand/25 to-brand/15 text-brand ring-1 ring-brand/30'
              : 'bg-white/70 dark:bg-surface-variant-dark/60 text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-surface-dark'
          }`}>
          <Smile size={22} />
        </button>

        <button type="button" onClick={handlePickImage}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-surface-variant-dark/60 text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-surface-dark transition-all duration-200 tap-target shadow-sm"
          title="Выбрать изображение">
          <ImagePlus size={22} />
        </button>

        {/* Rich text editor */}
        <div className="relative flex-1 bg-white/80 dark:bg-surface-variant-dark/80 rounded-2xl px-4 py-2.5 min-h-[44px] flex items-start">
          {/* Placeholder */}
          {isEmpty && (
            <span className="absolute top-2.5 left-4 text-[15px] text-gray-400 pointer-events-none select-none leading-relaxed">
              Сообщение...
            </span>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={checkEmpty}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null
              if (next && containerRef.current?.contains(next)) return
              setTimeout(() => {
                const active = document.activeElement
                if (active && containerRef.current?.contains(active)) return
                if (showLinkInput) return
                setIsFocused(false)
              }, 0)
            }}
            className="rich-editor flex-1 min-h-[24px] max-h-[120px] overflow-y-auto bg-transparent text-[15px] text-gray-900 dark:text-gray-100 outline-none leading-relaxed whitespace-pre-wrap break-words"
          />
        </div>

        {!isEmpty ? (
          <button onClick={handleSend}
            className="w-10 h-10 rounded-full bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 tap-target shadow-lg shadow-brand/25">
            <Send size={18} />
          </button>
        ) : (
          <button type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all tap-target">
            <Mic size={22} />
          </button>
        )}
      </div>
    </div>
  )
}



