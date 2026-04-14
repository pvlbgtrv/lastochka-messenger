package ru.lastochka.messenger.ui.screens.groups

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.lastochka.messenger.data.ContactInfo
import ru.lastochka.messenger.ui.components.AvatarSmall
import ru.lastochka.messenger.viewmodel.CreateGroupViewModel

/**
 * Экран создания группы.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateGroupScreen(
    onGroupCreated: (String) -> Unit,
    onBack: () -> Unit,
    viewModel: CreateGroupViewModel = hiltViewModel()
) {
    val groupName by viewModel.groupName.collectAsState()
    val description by viewModel.description.collectAsState()
    val contacts by viewModel.contacts.collectAsState()
    val selectedMembers by viewModel.selectedMembers.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Новая группа") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Назад")
                    }
                },
                actions = {
                    TextButton(
                        onClick = {
                            viewModel.createGroup { topicName ->
                                onGroupCreated(topicName)
                            }
                        },
                        enabled = groupName.isNotBlank() && !isLoading
                    ) {
                        Text("Создать", fontWeight = FontWeight.Bold)
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Group Name Input
            OutlinedTextField(
                value = groupName,
                onValueChange = viewModel::updateGroupName,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                label = { Text("Название группы") },
                placeholder = { Text("Введите название") },
                leadingIcon = { Icon(Icons.Default.Group, null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
            )

            // Description Input
            OutlinedTextField(
                value = description,
                onValueChange = viewModel::updateDescription,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                label = { Text("Описание (необязательно)") },
                placeholder = { Text("О чем эта группа?") },
                leadingIcon = { Icon(Icons.Default.Info, null) },
                minLines = 2,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Divider()

            // Members Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Участники", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (selectedMembers.isNotEmpty()) {
                    Text("${selectedMembers.size} выбрано", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                }
            }

            // Members List
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(contacts, key = { it.topicName }) { contact ->
                    MemberItem(
                        contact = contact,
                        isSelected = selectedMembers.contains(contact),
                        onClick = { viewModel.toggleMember(contact) }
                    )
                }
            }
        }
    }
}

@Composable
fun MemberItem(contact: ContactInfo, isSelected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AvatarSmall(name = contact.displayName, avatarUrl = contact.avatar)
        
        Spacer(modifier = Modifier.width(16.dp))
        
        Text(
            text = contact.displayName,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        if (isSelected) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = "Selected",
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp)
            )
        } else {
            Icon(
                imageVector = Icons.Default.RadioButtonUnchecked,
                contentDescription = "Unselected",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}