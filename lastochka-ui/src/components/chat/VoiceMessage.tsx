import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Square } from 'lucide-react'
import { formatDuration } from '@/hooks/useVoiceRecorder'

interface VoiceMessageProps {
  audioUrl: string
  duration: number  // seconds
  isOwn: boolean
}

export default function VoiceMessage({ audioUrl, duration, isOwn }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const stop = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isOwn
            ? 'bg-brand/20 hover:bg-brand/30 text-brand'
            : 'bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300'
        }`}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      {/* Progress bar + time */}
      <div className="flex-1 min-w-0">
        <div className={`h-1.5 rounded-full overflow-hidden ${isOwn ? 'bg-black/10' : 'bg-black/10 dark:bg-white/10'}`}>
          <div
            className={`h-full rounded-full transition-all duration-200 ${isOwn ? 'bg-brand' : 'bg-brand dark:bg-brand-dark'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {formatDuration(Math.floor(currentTime))}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            {formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Stop button */}
      {isPlaying && (
        <button
          onClick={stop}
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Square size={12} />
        </button>
      )}
    </div>
  )
}
