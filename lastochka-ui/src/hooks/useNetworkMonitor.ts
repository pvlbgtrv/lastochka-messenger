/**
 * Network monitor — обнаружение потери соединения и автореконнект.
 * Аналог NetworkMonitor из Android + SessionRepository.autoLogin.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { getTinode, loadAuthToken } from '@/lib/tinode-client'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'

interface NetworkState {
  isOnline: boolean
  lastReconnectAttempt: Date | null
  reconnectCount: number
}

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY = 2000  // 2 sec
const RECONNECT_MAX_DELAY = 30000 // 30 sec

export function useNetworkMonitor() {
  const [network, setNetwork] = useState<NetworkState>({
    isOnline: navigator.onLine,
    lastReconnectAttempt: null,
    reconnectCount: 0,
  })

  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)

  const tryReconnect = useCallback(() => {
    const tn = getTinode()
    const authToken = loadAuthToken()

    if (!authToken) {
      console.warn('No auth token — cannot reconnect')
      return
    }

    if (attemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('Max reconnect attempts reached')
      return
    }

    attemptRef.current += 1
    const delay = Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attemptRef.current - 1), RECONNECT_MAX_DELAY)

    console.log(`Reconnect attempt ${attemptRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`)
    setNetwork((s) => ({ ...s, lastReconnectAttempt: new Date(), reconnectCount: attemptRef.current }))

    reconnectTimeoutRef.current = setTimeout(async () => {
      try {
        if (!tn.isConnected()) {
          await tn.connect()
          // onConnect callback in auth store handles re-auth
        }
      } catch (err) {
        console.error('Reconnect failed', err)
        tryReconnect() // retry with backoff
      }
    }, delay)
  }, [])

  // Browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: online')
      setNetwork((s) => ({ ...s, isOnline: true }))
      attemptRef.current = 0 // reset counter
      tryReconnect()
    }

    const handleOffline = () => {
      console.log('Network: offline')
      setNetwork((s) => ({ ...s, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [tryReconnect])

  // Tinode disconnect event — trigger reconnect
  useEffect(() => {
    const tn = getTinode()
    const originalOnDisconnect = tn.onDisconnect

    tn.onDisconnect = (err?: Error) => {
      console.log('Tinode disconnected', err?.message)
      setNetwork((s) => ({ ...s, isOnline: false }))

      // Call original handler if exists
      originalOnDisconnect?.(err)

      // Try to reconnect after a short delay
      setTimeout(() => {
        if (navigator.onLine) {
          tryReconnect()
        }
      }, 1000)
    }

    return () => {
      tn.onDisconnect = originalOnDisconnect
    }
  }, [tryReconnect])

  // Cleanup
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return network
}
