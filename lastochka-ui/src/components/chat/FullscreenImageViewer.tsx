import { useState, useRef, useCallback, useEffect } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'

interface FullscreenImageViewerProps {
  url: string
  onClose: () => void
}

export default function FullscreenImageViewer({ url, onClose }: FullscreenImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const lastTouchDistance = useRef<number>(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (lastTouchDistance.current > 0) {
        const ratio = distance / lastTouchDistance.current
        setScale((prev) => Math.min(Math.max(prev * ratio, 1), 5))
      }
      lastTouchDistance.current = distance
    }
  }, [])

  const handleTouchEnd = useCallback(() => { lastTouchDistance.current = 0 }, [])
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }) }
  }, [scale, position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => { setIsDragging(false) }, [])
  const handleDoubleClick = useCallback(() => {
    setScale((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : prev === 3 ? 1 : 1))
    setPosition({ x: 0, y: 0 })
  }, [])

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.5, 5))
  const zoomOut = () => {
    setScale((prev) => { const next = Math.max(prev - 0.5, 1); if (next === 1) setPosition({ x: 0, y: 0 }); return next })
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fade-in cursor-zoom-out" onClick={onClose}>
      <button onClick={onClose} className="absolute top-5 right-5 z-10 p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white transition-all duration-200 active:scale-90">
        <X size={22} />
      </button>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-white/10">
        <button onClick={(e) => { e.stopPropagation(); zoomOut() }} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"><ZoomOut size={18} /></button>
        <span className="text-white/90 text-sm font-medium min-w-[50px] text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <button onClick={(e) => { e.stopPropagation(); zoomIn() }} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"><ZoomIn size={18} /></button>
      </div>

      <div
        className="relative flex items-center justify-center overflow-hidden w-full h-full"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          ref={imgRef}
          src={url}
          alt="Полноэкранный просмотр"
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-200"
          style={{ transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`, cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-out' }}
          draggable={false}
        />
      </div>
    </div>
  )
}
