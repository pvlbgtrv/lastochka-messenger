import { useChatStore } from '@/store/chatStore'
import { X, Download, Share2 } from 'lucide-react'

export default function FullscreenImageViewer() {
  const { fullscreenImage, setFullscreenImage } = useChatStore()

  if (!fullscreenImage) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center animate-scale-in"
      onClick={() => setFullscreenImage(null)}
    >
      {/* Close button */}
      <button
        onClick={() => setFullscreenImage(null)}
        className="absolute top-12 right-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center tap-target"
      >
        <X size={22} className="text-white" />
      </button>

      {/* Actions */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-4 z-10">
        <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center tap-target">
          <Download size={20} className="text-white" />
        </button>
        <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center tap-target">
          <Share2 size={20} className="text-white" />
        </button>
      </div>

      {/* Image */}
      <img
        src={fullscreenImage}
        alt=""
        className="max-w-full max-h-[80vh] object-contain animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
