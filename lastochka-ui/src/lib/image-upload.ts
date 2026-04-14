/**
 * Загрузка изображений на Tinode сервер через HTTP multipart POST.
 * Аналог LargeFileHelper из Android SDK.
 */

import { getTinode } from './tinode-client'

const HOST = (import.meta.env.VITE_TINODE_HOST as string) || 'localhost:6060'
const API_KEY = (import.meta.env.VITE_TINODE_API_KEY as string) || 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K'
const SECURE = import.meta.env.VITE_TINODE_SECURE === 'true'

export interface ImageUploadResult {
  /** Relative URL: /v0/file/s/... */
  url: string
  /** MIME type */
  mimeType: string
  /** File name */
  fileName: string
  /** File size in bytes */
  size: number
}

/**
 * Получить базовый URL для файловых операций.
 */
function getBaseUrl(): string {
  const scheme = SECURE ? 'https' : 'http'
  // VITE_TINODE_HOST может быть "localhost:6060" или "api.lastochka-m.ru"
  return `${scheme}://${HOST}`
}

/**
 * Загрузить файл на Tinode сервер.
 * Поддерживает редирект 307.
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ImageUploadResult> {
  const tn = getTinode()
  const authToken = tn.getAuthToken()
  if (!authToken) {
    throw new Error('Нет токена авторизации')
  }

  const uploadUrl = `${getBaseUrl()}/v0/file/u/?apikey=${API_KEY}&auth=token&secret=${authToken.token}`

  return uploadToUrl(file, uploadUrl, onProgress)
}

async function uploadToUrl(
  file: File,
  url: string,
  onProgress?: (progress: number) => void
): Promise<ImageUploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Прогресс загрузки
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded / e.total)
        }
      })
    }

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          // Tinode server returns file ref in ctrl.params.ref or ctrl.params.url
          const params = response?.ctrl?.params || response?.params || {}
          const fileUrl = params.ref || params.url
          if (!fileUrl) {
            console.error('[uploadFile] No file URL in response:', JSON.stringify(response))
            reject(new Error('Нет URL файла в ответе сервера'))
            return
          }
          resolve({
            url: normalizeFileUrl(fileUrl),
            mimeType: file.type,
            fileName: file.name,
            size: file.size,
          })
        } catch (e) {
          console.error('[uploadFile] Parse error:', e, 'Raw response:', xhr.responseText)
          reject(new Error('Ошибка парсинга ответа сервера'))
        }
      } else if (xhr.status === 307) {
        // Redirect — повторяем загрузку на новый URL
        const redirectUrl = xhr.getResponseHeader('Location')
        if (!redirectUrl) {
          reject(new Error('Нет URL редиректа в ответе 307'))
          return
        }
        // Рекурсивно загружаем на новый URL
        uploadToUrl(file, redirectUrl, onProgress).then(resolve).catch(reject)
      } else {
        reject(new Error(`Загрузка не удалась: ${xhr.status} ${xhr.statusText}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Ошибка сети при загрузке файла'))
    })

    xhr.open('POST', url)
    xhr.send(formData)
  })
}

/**
 * Нормализовать URL файла — вернуть чистый URL без query-параметров.
 * Auth params добавляются отдельно при загрузке через getFileUrl().
 */
function normalizeFileUrl(fileUrl: string): string {
  // Если уже полный URL — вернуть без query params
  if (fileUrl.startsWith('http')) {
    const urlObj = new URL(fileUrl)
    return `${urlObj.origin}${urlObj.pathname}`
  }
  // Относительный URL — вернуть как есть (без query params)
  const cleanPath = fileUrl.split('?')[0]
  return cleanPath
}

/**
 * Сжать изображение для отправки.
 * Возвращает Blob (JPEG) и метаданные.
 */
export async function compressImage(
  file: File,
  options: {
    maxWidth?: number
    maxHeight?: number
    quality?: number
    skipIfBelow?: number // bytes — пропускать если файл уже маленький
  } = {}
): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    skipIfBelow = 1_048_576, // 1MB
  } = options

  // Если файл уже маленький и это JPEG/PNG — пропускаем сжатие
  if (file.size < skipIfBelow && (file.type === 'image/jpeg' || file.type === 'image/png')) {
    return { blob: file, width: 0, height: 0, mimeType: file.type }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      // Масштабируем если нужно
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Не удалось получить контекст canvas'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Не удалось сжать изображение'))
            return
          }
          resolve({ blob, width, height, mimeType: 'image/jpeg' })
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не удалось загрузить изображение'))
    }

    img.src = url
  })
}
