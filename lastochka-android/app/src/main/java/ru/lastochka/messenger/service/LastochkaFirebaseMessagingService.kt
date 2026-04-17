package ru.lastochka.messenger.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import ru.lastochka.messenger.MainActivity
import ru.lastochka.messenger.R
import ru.lastochka.messenger.data.SessionRepository
import ru.lastochka.messenger.data.TinodeHttpClient
import javax.inject.Inject

/**
 * Сервис для обработки Push-уведомлений (FCM).
 */
@AndroidEntryPoint
class LastochkaFirebaseMessagingService : FirebaseMessagingService() {

    @Inject lateinit var sessionRepository: SessionRepository

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        message.notification?.let { notification ->
            val title = notification.title ?: "Ласточка"
            val body = notification.body ?: "Новое сообщение"

            // Данные сообщения (topicName и т.д.)
            val topicName = message.data["topicName"]
            val seq = message.data["seq"]?.toIntOrNull()

            showNotification(title, body, topicName, seq)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Отправляем новый токен на сервер Tinode при наличии сессии
        serviceScope.launch {
            try {
                if (sessionRepository.isAuthenticated) {
                    // TODO: tinodeClient.setPushToken(token) — когда метод будет добавлен
                    android.util.Log.d("FCM", "New token: $token (will be sent to server)")
                }
            } catch (e: Exception) {
                android.util.Log.e("FCM", "Failed to send push token", e)
            }
        }
    }

    private fun showNotification(title: String, body: String, topicName: String?, seq: Int?) {
        val channelId = "lastochka_messages"
        val notificationId = seq ?: System.currentTimeMillis().toInt() % 100000
        val notificationManager = getSystemService(NotificationManager::class.java)

        // Создаем канал (для Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Сообщения",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Уведомления о новых сообщениях"
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Intent для открытия чата при клике
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            if (topicName != null) {
                putExtra("topicName", topicName)
            }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.logo_splash) // Или иконка сообщения
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(notificationId, notification)
    }
}
