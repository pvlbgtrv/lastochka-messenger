package ru.lastochka.messenger.ui.screens.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Экран настроек.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateToProfile: () -> Unit,
    onLogout: () -> Unit
) {
    var showLogoutDialog by remember { mutableStateOf(false) }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Выход") },
            text = { Text("Вы действительно хотите выйти из аккаунта?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLogoutDialog = false
                        // onLogout → MainActivity → sessionRepository.logout() → authState → Unauthenticated
                        onLogout()
                    }
                ) {
                    Text("Выйти", color = Color(0xFFEF5350), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) {
                    Text("Отмена")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Настройки") }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn {
                // Профиль
                item {
                    SettingsSectionHeader("Профиль")
                }
                item {
                    SettingsItem(
                        icon = Icons.Default.Person,
                        title = "Изменить профиль",
                        subtitle = "Имя, фото, био",
                        onClick = onNavigateToProfile
                    )
                }

                // Уведомления
                item {
                    SettingsSectionHeader("Уведомления")
                }
                item {
                    var notificationsEnabled by remember { mutableStateOf(true) }
                    SettingsItem(
                        icon = Icons.Default.Notifications,
                        title = "Уведомления",
                        subtitle = "Звук и вибрация",
                        trailing = {
                            Switch(
                                checked = notificationsEnabled,
                                onCheckedChange = { notificationsEnabled = it }
                            )
                        },
                        onClick = { notificationsEnabled = !notificationsEnabled }
                    )
                }

                // Внешний вид
                item {
                    SettingsSectionHeader("Внешний вид")
                }
                item {
                    var isDarkTheme by remember { mutableStateOf(false) }
                    SettingsItem(
                        icon = Icons.Default.DarkMode,
                        title = "Тёмная тема",
                        trailing = {
                            Switch(
                                checked = isDarkTheme,
                                onCheckedChange = { isDarkTheme = it }
                            )
                        },
                        onClick = { isDarkTheme = !isDarkTheme }
                    )
                }

                // О приложении
                item {
                    SettingsSectionHeader("О приложении")
                }
                item {
                    SettingsItem(
                        icon = Icons.Default.Info,
                        title = "Версия",
                        subtitle = "1.0.0 (Alpha)"
                    )
                }
                item {
                    SettingsItem(
                        icon = Icons.Default.Code,
                        title = "Лицензия",
                        subtitle = "GPL v3"
                    )
                }

                // Выход
                item {
                    Spacer(modifier = Modifier.height(16.dp))
                }
                item {
                    Button(
                        onClick = { showLogoutDialog = true },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .height(48.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFEF5350)
                        )
                    ) {
                        Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Выйти", fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(32.dp))
                }
            }
        }
    }
}

@Composable
fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    )
}

@Composable
fun SettingsItem(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    trailing: @Composable (() -> Unit)? = null,
    onClick: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = onClick != null, onClick = onClick ?: {})
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        trailing?.invoke()
    }
}
