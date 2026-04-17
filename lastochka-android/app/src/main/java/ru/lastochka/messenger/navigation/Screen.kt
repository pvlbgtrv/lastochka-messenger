package ru.lastochka.messenger.navigation

import android.net.Uri

/**
 * Экраны приложения для Compose Navigation.
 */
sealed class Screen(val route: String) {
    data object Chats : Screen("chats")
    data object Chat : Screen("chat/{topicName}/{topicTitle}") {
        fun createRoute(topicName: String, topicTitle: String): String {
            return "chat/${Uri.encode(topicName)}/${Uri.encode(topicTitle)}"
        }
    }
    data object NewChat : Screen("new_chat")

    data object Contacts : Screen("contacts")

    data object Settings : Screen("settings")
    data object Profile : Screen("profile")
    data object ContactInfo : Screen("contact_info/{topicName}/{topicTitle}") {
        fun createRoute(topicName: String, topicTitle: String): String {
            return "contact_info/${Uri.encode(topicName)}/${Uri.encode(topicTitle)}"
        }
    }
    data object CreateGroup : Screen("create_group")
    data object Login : Screen("login")
    data object Register : Screen("register")
}
