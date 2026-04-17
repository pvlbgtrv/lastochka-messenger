package ru.lastochka.messenger.ui.screens.chatlist

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Snackbar
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.lastochka.messenger.R
import ru.lastochka.messenger.ui.components.ChatItem
import ru.lastochka.messenger.viewmodel.ChatListViewModel

@Composable
fun ChatListScreen(
    onChatClick: (String, String) -> Unit,
    onNewChat: () -> Unit,
    onCreateGroup: () -> Unit,
    darkMode: Boolean,
    onToggleDarkMode: () -> Unit,
    onLogout: () -> Unit,
    viewModel: ChatListViewModel = hiltViewModel()
) {
    val contacts by viewModel.filteredContacts.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val totalUnread by viewModel.totalUnread.collectAsState()

    val pinned = remember(contacts) { contacts.filter { it.pinned } }
    val unpinned = remember(contacts) { contacts.filterNot { it.pinned } }
    var showMenu by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.reloadContacts()
    }

    LaunchedEffect(error) {
        if (error == "SESSION_EXPIRED") {
            viewModel.clearError()
            onLogout()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = if (darkMode) {
                    Brush.linearGradient(
                        listOf(Color(0xFF0A0F18), Color(0xFF0E1621), Color(0xFF111B27))
                    )
                } else {
                    Brush.linearGradient(
                        listOf(Color(0xFFF8F9FC), Color(0xFFF0F2F7), Color(0xFFE8ECF3))
                    )
                }
            )
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 12.dp, top = 18.dp, bottom = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Image(
                        painter = painterResource(id = R.drawable.logo_splash),
                        contentDescription = "Логотип",
                        modifier = Modifier
                            .height(44.dp)
                            .padding(top = 2.dp, bottom = 2.dp),
                        contentScale = ContentScale.Fit
                    )
                    Text(
                        text = "$totalUnread непрочитанных",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Box {
                    IconButton(onClick = { showMenu = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "Меню")
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text(if (darkMode) "Светлый режим" else "Ночной режим") },
                            leadingIcon = {
                                Icon(
                                    imageVector = if (darkMode) Icons.Default.LightMode else Icons.Default.DarkMode,
                                    contentDescription = null
                                )
                            },
                            onClick = {
                                showMenu = false
                                onToggleDarkMode()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Создать группу") },
                            onClick = {
                                showMenu = false
                                onCreateGroup()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Новый чат") },
                            onClick = {
                                showMenu = false
                                onNewChat()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Выйти") },
                            onClick = {
                                showMenu = false
                                onLogout()
                            }
                        )
                    }
                }
            }

            OutlinedTextField(
                value = searchQuery,
                onValueChange = viewModel::onSearchQueryChanged,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                placeholder = { Text("Поиск...") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.6f),
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedBorderColor = Color.Transparent,
                    focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
                )
            )

            Box(modifier = Modifier.fillMaxSize()) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.primary
                    )
                } else if (contacts.isEmpty()) {
                    EmptyChatsState(searchQuery = searchQuery)
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(top = 6.dp, bottom = 88.dp)
                    ) {
                        if (pinned.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Закрепленные",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.labelMedium,
                                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 2.dp)
                                )
                            }
                            items(pinned, key = { it.topicName }) { contact ->
                                ChatItem(
                                    contact = contact,
                                    onClick = { onChatClick(contact.topicName, contact.displayName) }
                                )
                            }
                        }

                        if (unpinned.isNotEmpty()) {
                            item {
                                Text(
                                    text = if (pinned.isEmpty()) "Все чаты" else "Остальные",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.labelMedium,
                                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 2.dp)
                                )
                            }
                            items(unpinned, key = { it.topicName }) { contact ->
                                ChatItem(
                                    contact = contact,
                                    onClick = { onChatClick(contact.topicName, contact.displayName) }
                                )
                            }
                        }
                    }
                }
            }
        }

        FloatingActionButton(
            onClick = onNewChat,
            containerColor = MaterialTheme.colorScheme.primary,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(16.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = "Новый чат", tint = Color.White)
        }

        if (error != null) {
            Snackbar(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 16.dp, vertical = 24.dp),
                containerColor = MaterialTheme.colorScheme.error,
                contentColor = Color.White
            ) {
                Text(error ?: "")
            }
        }
    }
}

@Composable
private fun HeaderCircleButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    label: String
) {
    IconButton(
        onClick = onClick,
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.7f))
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun EmptyChatsState(searchQuery: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(bottom = 72.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(76.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Send,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(30.dp)
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = if (searchQuery.isBlank()) "Нет чатов" else "Ничего не найдено",
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
