package ru.lastochka.messenger.di

import android.content.Context
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import ru.lastochka.messenger.data.TinodeClient
import timber.log.Timber

/**
 * OkHttp Interceptor для добавления заголовков авторизации Tinode
 * к запросам загрузки файлов.
 *
 * Официальный Tinode SDK использует заголовки:
 *   X-Tinode-APIKey: <apikey>
 *   X-Tinode-Auth: Token <token>
 *
 *而不是 query-параметры (?apikey=...&secret=...),
 * которые сервер отклоняет с 400 malformed.
 */
class TinodeAuthInterceptor(
    private val tinodeClient: TinodeClient
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val url = originalRequest.url.toString()

        // Добавляем заголовки ТОЛЬКО для запросов к нашему серверу
        if (url.contains(tinodeClient.serverHostName)) {
            val authToken = tinodeClient.getAuthToken()
            if (authToken != null) {
                val newRequest = originalRequest.newBuilder()
                    .header("X-Tinode-APIKey", tinodeClient.getApiKey())
                    .header("X-Tinode-Auth", "Token $authToken")
                    .build()
                Timber.d("TinodeAuthInterceptor: added auth headers for $url")
                return chain.proceed(newRequest)
            } else {
                Timber.w("TinodeAuthInterceptor: no auth token available for $url")
            }
        }

        return chain.proceed(originalRequest)
    }
}

/**
 * Создать ImageLoader для Coil с OkHttp клиентом,
 * который автоматически добавляет заголовки авторизации Tinode.
 */
fun createImageLoader(
    context: Context,
    tinodeClient: TinodeClient
): ImageLoader {
    val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(TinodeAuthInterceptor(tinodeClient))
        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    return ImageLoader.Builder(context)
        .okHttpClient(okHttpClient)
        .memoryCache {
            MemoryCache.Builder(context)
                .maxSizePercent(0.25) // 25% доступной памяти
                .build()
        }
        .diskCache {
            DiskCache.Builder()
                .directory(context.cacheDir.resolve("coil_image_cache"))
                .maxSizeBytes(100L * 1024 * 1024) // 100 MB
                .build()
        }
        .crossfade(true)
        .build()
}
