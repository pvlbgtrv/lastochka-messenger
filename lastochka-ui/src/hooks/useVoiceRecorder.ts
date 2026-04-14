/**
 * Voice recording hook using MediaRecorder API.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export interface VoiceRecording {
  isRecording: boolean
  duration: number
  blob: Blob | null
  audioUrl: string | null
  error: string | null
}

export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecording>({
    isRecording: false,
    duration: 0,
    blob: null,
    audioUrl: null,
    error: null,
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Prefer Opus/OGG, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : ''

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setState((s) => ({
          ...s,
          isRecording: false,
          blob,
          audioUrl: url,
          duration: durationRef.current,
        }))
        // Stop all tracks
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }

      recorder.start(100) // Collect data every 100ms
      mediaRecorderRef.current = recorder

      // Start duration timer
      durationRef.current = 0
      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setState((s) => ({ ...s, duration: durationRef.current }))
      }, 1000)

      setState((s) => ({
        ...s,
        isRecording: true,
        duration: 0,
        blob: null,
        audioUrl: null,
        error: null,
      }))
    } catch (err) {
      setState((s) => ({
        ...s,
        error: 'Нет доступа к микрофону',
      }))
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cancelRecording = useCallback(() => {
    stopRecording()
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl)
    setState({
      isRecording: false,
      duration: 0,
      blob: null,
      audioUrl: null,
      error: null,
    })
  }, [stopRecording, state.audioUrl])

  const clearRecording = useCallback(() => {
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl)
    setState({
      isRecording: false,
      duration: 0,
      blob: null,
      audioUrl: null,
      error: null,
    })
  }, [state.audioUrl])

  return {
    ...state,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  }
}

/**
 * Format duration in seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
