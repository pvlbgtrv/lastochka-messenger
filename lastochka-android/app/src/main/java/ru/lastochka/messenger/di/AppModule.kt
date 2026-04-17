package ru.lastochka.messenger.di

import android.content.Context
import coil.ImageLoader
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.SessionRepository
import ru.lastochka.messenger.data.TinodeClient
import ru.lastochka.messenger.data.local.AppDatabase
import ru.lastochka.messenger.service.NetworkMonitor
import javax.inject.Singleton

/**
 * Hilt модуль для предоставления зависимостей.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return AppDatabase.getInstance(context)
    }

    @Provides
    @Singleton
    fun provideTinodeClient(@ApplicationContext context: Context): TinodeClient {
        val app = context.applicationContext as ru.lastochka.messenger.LastochkaApp
        return app.tinodeClient
    }

    @Provides
    @Singleton
    fun provideNetworkMonitor(@ApplicationContext context: Context): NetworkMonitor {
        return NetworkMonitor(context)
    }

    @Provides
    @Singleton
    fun provideSessionRepository(
        @ApplicationContext context: Context,
        tinodeClient: TinodeClient,
        networkMonitor: NetworkMonitor
    ): SessionRepository {
        return SessionRepository(context, tinodeClient, networkMonitor)
    }

    @Provides
    @Singleton
    fun provideRepository(
        tinodeClient: TinodeClient,
        database: AppDatabase,
        sessionRepository: SessionRepository
    ): ChatRepository {
        return ChatRepository(tinodeClient, database, sessionRepository)
    }

    @Provides
    @Singleton
    fun provideImageLoader(
        @ApplicationContext context: Context,
        tinodeClient: TinodeClient
    ): ImageLoader {
        return createImageLoader(context, tinodeClient)
    }
}
