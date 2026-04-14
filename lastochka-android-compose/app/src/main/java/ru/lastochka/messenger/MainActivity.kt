package ru.lastochka.messenger

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.Reply
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.*
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import dagger.hilt.android.AndroidEntryPoint
import ru.lastochka.messenger.data.AuthState
import ru.lastochka.messenger.data.ChatRepository
import ru.lastochka.messenger.data.SessionRepository
import ru.lastochka.messenger.navigation.Screen
import ru.lastochka.messenger.ui.screens.auth.LoginScreen
import ru.lastochka.messenger.ui.screens.auth.RegisterScreen
import ru.lastochka.messenger.ui.screens.calls.CallsScreen
import ru.lastochka.messenger.ui.screens.chat.ChatScreen
import ru.lastochka.messenger.ui.screens.contact.ContactInfoScreen
import ru.lastochka.messenger.ui.screens.groups.CreateGroupScreen
import ru.lastochka.messenger.ui.screens.chatlist.ChatListScreen
import ru.lastochka.messenger.ui.screens.newchat.NewChatScreen
import ru.lastochka.messenger.ui.screens.settings.ProfileScreen
import ru.lastochka.messenger.ui.screens.settings.SettingsScreen
import ru.lastochka.messenger.ui.theme.LastochkaTheme
import ru.lastochka.messenger.viewmodel.AuthViewModel
import ru.lastochka.messenger.viewmodel.ChatListViewModel
import javax.inject.Inject

/**
 * Главная Activity — точка входа в приложение.
 * Управляет навигацией между экранами.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var chatRepository: ChatRepository
    @Inject lateinit var sessionRepository: SessionRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        // Устанавливаем splash screen ДО super.onCreate()
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        // Splash screen видимость управляется auth состоянием.
        // Держим splash пока проверяется сохранённая сессия.
        var keepSplashOnScreen = true
        splashScreen.setKeepOnScreenCondition { keepSplashOnScreen }

        setContent {
            LastochkaTheme {
                // AuthState как StateFlow — реагирует на logout/login
                val authState by sessionRepository.authState.collectAsState()
                val isAuthenticated = authState is AuthState.Authenticated

                // 1) Нет сохранённой сессии → сразу убираем splash (показать Login)
                LaunchedEffect(Unit) {
                    val hasSaved = sessionRepository.hasSavedSession()
                    if (!hasSaved) {
                        keepSplashOnScreen = false
                    }
                }

                // 2) AutoLogin завершился (успех или ошибка) → убираем splash
                LaunchedEffect(authState) {
                    if (authState !is AuthState.Unauthenticated) {
                        keepSplashOnScreen = false
                    }
                }

                // 3) Safety timeout — максимум 3 секунды
                LaunchedEffect(Unit) {
                    delay(3000)
                    keepSplashOnScreen = false
                }

                if (isAuthenticated) {
                    MainAppScreen(
                        onLogoutRequired = {
                            // Logout через SessionRepository
                            kotlinx.coroutines.GlobalScope.launch {
                                sessionRepository.logout()
                            }
                        }
                    )
                } else {
                    AuthNavHost(
                        onLoginSuccess = {
                            // Не recreate() — просто ждём пока authState обновится
                            // SessionRepository.login() уже установил _authState = Authenticated
                        }
                    )
                }
            }
        }
    }

    @Composable
    fun AuthNavHost(onLoginSuccess: () -> Unit) {
        val navController = rememberNavController()
        NavHost(
            navController = navController,
            startDestination = Screen.Login.route,
            enterTransition = { slideInHorizontally { it } },
            exitTransition = { slideOutHorizontally { -it } }
        ) {
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = onLoginSuccess,
                    onNavigateToRegister = {
                        navController.navigate(Screen.Register.route)
                    }
                )
            }
            composable(Screen.Register.route) {
                RegisterScreen(
                    onRegisterSuccess = onLoginSuccess,
                    onNavigateToLogin = {
                        navController.popBackStack()
                    }
                )
            }
        }
    }

    @Composable
    fun MainAppScreen(onLogoutRequired: () -> Unit) {
        val navController = rememberNavController()
        var selectedTab by remember { mutableStateOf(0) }
        val chatListViewModel: ChatListViewModel = hiltViewModel()
        val totalUnread by chatListViewModel.totalUnread.collectAsState()

        // Определяем текущий маршрут для подсветки таба
        val currentBackStackEntry by navController.currentBackStackEntryAsState()
        val currentRoute = currentBackStackEntry?.destination?.route

        LaunchedEffect(currentRoute) {
            selectedTab = when {
                currentRoute?.startsWith(Screen.Chats.route) == true -> 0
                currentRoute == Screen.Calls.route -> 1
                currentRoute?.startsWith(Screen.Settings.route) == true -> 2
                else -> selectedTab
            }
        }

        Scaffold(
            bottomBar = {
                NavigationBar {
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = {
                            selectedTab = 0
                            navController.navigate(Screen.Chats.route) {
                                popUpTo(Screen.Chats.route) { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        icon = {
                            if (totalUnread > 0) {
                                Badge(
                                    modifier = Modifier.offset(x = 8.dp, y = (-8).dp)
                                ) {
                                    Text(
                                        text = if (totalUnread > 99) "99+" else "$totalUnread",
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            }
                            Icon(Icons.Default.Chat, null)
                        },
                        label = { Text("Чаты", fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Normal) }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = {
                            selectedTab = 1
                            navController.navigate(Screen.Calls.route) {
                                popUpTo(Screen.Calls.route) { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        icon = { Icon(Icons.Default.Call, null) },
                        label = { Text("Звонки", fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal) }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 2,
                        onClick = {
                            selectedTab = 2
                            navController.navigate(Screen.Settings.route) {
                                popUpTo(Screen.Settings.route) { inclusive = false }
                                launchSingleTop = true
                            }
                        },
                        icon = { Icon(Icons.Default.Settings, null) },
                        label = { Text("Настройки", fontWeight = if (selectedTab == 2) FontWeight.Bold else FontWeight.Normal) }
                    )
                }
            }
        ) { padding ->
            NavHost(
                navController = navController,
                startDestination = Screen.Chats.route,
                modifier = Modifier.padding(padding)
            ) {
                // --- Chats Graph ---
                composable(Screen.Chats.route) {
                    ChatListScreen(
                        onChatClick = { topicName, topicTitle ->
                            navController.navigate(Screen.Chat.createRoute(topicName, topicTitle))
                        },
                        onNewChat = {
                            navController.navigate(Screen.NewChat.route)
                        },
                        onProfile = {
                            navController.navigate(Screen.Profile.route)
                        },
                        onLogout = onLogoutRequired
                    )
                }
                composable(
                    route = Screen.Chat.route,
                    arguments = listOf(
                        navArgument("topicName") { type = NavType.StringType },
                        navArgument("topicTitle") {
                            type = NavType.StringType
                            defaultValue = ""
                        }
                    )
                ) { backStackEntry ->
                    val topicName = backStackEntry.arguments?.getString("topicName") ?: ""
                    val topicTitleArg = backStackEntry.arguments?.getString("topicTitle") ?: ""
                    // Если title пустой или равен topicName — загружаем настоящее имя из контакта
                    val effectiveTitle = if (topicTitleArg.isBlank() || topicTitleArg == topicName) {
                        null // Загрузим из сервера
                    } else {
                        topicTitleArg
                    }
                    ChatScreen(
                        topicName = topicName,
                        topicTitle = effectiveTitle ?: topicName,
                        onBack = { navController.popBackStack() },
                        onOpenContactInfo = {
                            navController.navigate(Screen.ContactInfo.createRoute(topicName, topicTitleArg.ifBlank { topicName }))
                        }
                    )
                }
                composable(
                    route = Screen.ContactInfo.route,
                    arguments = listOf(
                        navArgument("topicName") { type = NavType.StringType },
                        navArgument("topicTitle") { type = NavType.StringType }
                    )
                ) { backStackEntry ->
                    val topicName = backStackEntry.arguments?.getString("topicName") ?: ""
                    val topicTitle = backStackEntry.arguments?.getString("topicTitle") ?: ""
                    ContactInfoScreen(
                        topicName = topicName,
                        topicTitle = topicTitle,
                        onBack = { navController.popBackStack() },
                        onNavigateToChat = {
                            navController.navigate(Screen.Chat.createRoute(topicName, topicTitle)) {
                                popUpTo(Screen.ContactInfo.route) { inclusive = true }
                            }
                        }
                    )
                }
                composable(Screen.CreateGroup.route) {
                    CreateGroupScreen(
                        onGroupCreated = { topicName ->
                            navController.navigate(Screen.Chat.createRoute(topicName, topicName)) {
                                popUpTo(Screen.CreateGroup.route) { inclusive = true }
                            }
                        },
                        onBack = { navController.popBackStack() }
                    )
                }
                composable(Screen.NewChat.route) {
                    NewChatScreen(
                        onChatSelected = { contactInfo ->
                            navController.navigate(Screen.Chat.createRoute(contactInfo.topicName, contactInfo.displayName)) {
                                popUpTo(Screen.Chats.route)
                            }
                        },
                        onCreateGroup = {
                            navController.navigate(Screen.CreateGroup.route)
                        },
                        onCreateChannel = {
                            // TODO: Navigate to CreateChannel
                        },
                        onBack = { navController.popBackStack() }
                    )
                }

                // --- Calls Graph ---
                composable(Screen.Calls.route) {
                    CallsScreen()
                }

                // --- Settings Graph ---
                composable(Screen.Settings.route) {
                    SettingsScreen(
                        onNavigateToProfile = {
                            navController.navigate(Screen.Profile.route)
                        },
                        onLogout = onLogoutRequired
                    )
                }
                composable(Screen.Profile.route) {
                    ProfileScreen(
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}
