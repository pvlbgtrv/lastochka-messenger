package ru.lastochka.messenger

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import dagger.hilt.android.HiltAndroidApp
import ru.lastochka.messenger.data.TinodeClient
import ru.lastochka.messenger.data.local.AppDatabase
import ru.lastochka.messenger.di.createImageLoader
import ru.lastochka.messenger.service.NetworkMonitor
import timber.log.Timber
import javax.inject.Inject

/**
 * Приложение Ласточка — инициализация Tinode SDK и Room DB.
 */
@HiltAndroidApp
class LastochkaApp : Application(), ImageLoaderFactory {

    @Inject lateinit var networkMonitor: NetworkMonitor

    lateinit var tinodeClient: TinodeClient
        private set

    /** Получить base URL для загрузки файлов (http:// или https:// + host) */
    fun getFileBaseUrl(): String {
        return tinodeClient.getFileBaseUrl()
    }

    lateinit var database: AppDatabase
        private set

    private lateinit var _imageLoader: ImageLoader

    override fun onCreate() {
        super.onCreate()

        // Инициализация Timber для логирования
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        } else {
            // В production можно добавить CrashlyticsTree или свою реализацию
            // Timber.plant(CrashlyticsTree())
        }

        Timber.d("LastochkaApp onCreate")

        // Инициализация Room
        database = AppDatabase.getInstance(this)

        // Инициализация Tinode SDK
        // Dev сервер: ws:// (без TLS), production: wss://
        val isDev = getString(R.string.default_host_name).contains("10.0.2.2") ||
                    getString(R.string.default_host_name).contains("localhost")
        tinodeClient = TinodeClient(
            context = this,
            appName = APP_NAME,
            apiKey = getString(R.string.default_api_key),
            hostName = getString(R.string.default_host_name),
            useTLS = !isDev
        )

        // Запуск мониторинга сети (автореконнект)
        networkMonitor.startMonitoring()

        // Инициализация ImageLoader для Coil с авторизацией Tinode
        _imageLoader = createImageLoader(this, tinodeClient)
    }

    /**
     * ImageLoaderFactory — Coil использует этот ImageLoader по умолчанию
     * для всех AsyncImage/SubcomposeAsyncImage вызовов.
     */
    override fun newImageLoader(): ImageLoader = _imageLoader

    /** Получить ImageLoader для использования в Compose */
    fun getImageLoader(): ImageLoader = _imageLoader

    override fun onTerminate() {
        super.onTerminate()
        networkMonitor.stopMonitoring()
        tinodeClient.disconnect()
    }

    companion object {
        const val APP_NAME = "Ласточка"
    }
}
