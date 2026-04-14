package ru.lastochka.messenger.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.*
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import ru.lastochka.messenger.R
import ru.lastochka.messenger.ui.theme.BrandPrimary
import ru.lastochka.messenger.util.formatPhoneNumberWithCursor
import ru.lastochka.messenger.util.isValidEmail
import ru.lastochka.messenger.util.isValidPhoneNumber
import ru.lastochka.messenger.util.cleanPhoneNumber
import ru.lastochka.messenger.viewmodel.AuthViewModel
import ru.lastochka.messenger.viewmodel.AuthUiState

/**
 * Экран регистрации (как в lastochka-ui RegisterForm).
 * Поля: Логин, Email, Телефон, Ваше имя (опционально), Пароль, Подтверждение пароля
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun RegisterScreen(
    onRegisterSuccess: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: AuthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val scope = rememberCoroutineScope()

    // Данные регистрации
    var login by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf(TextFieldValue("")) }
    var displayName by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordConfirm by remember { mutableStateOf("") }

    // Ошибки валидации
    var loginError by remember { mutableStateOf("") }
    var emailError by remember { mutableStateOf("") }
    var phoneError by remember { mutableStateOf("") }
    var passwordError by remember { mutableStateOf("") }

    // Статусы проверки доступности
    var isCheckingLogin by remember { mutableStateOf(false) }
    var loginAvailable by remember { mutableStateOf<Boolean?>(null) }

    var isCheckingEmail by remember { mutableStateOf(false) }
    var emailAvailable by remember { mutableStateOf<Boolean?>(null) }

    var isCheckingPhone by remember { mutableStateOf(false) }
    var phoneAvailable by remember { mutableStateOf<Boolean?>(null) }

    // Видимость паролей
    var passwordVisible by remember { mutableStateOf(false) }
    var passwordConfirmVisible by remember { mutableStateOf(false) }

    val focusManager = LocalFocusManager.current

    // Debounced проверка логина
    LaunchedEffect(login) {
        if (login.length >= 3) {
            delay(500)
            isCheckingLogin = true
            viewModel.checkUsername(login) { available ->
                loginAvailable = available
                if (available) loginError = ""
                else loginError = "Этот логин уже занят"
                isCheckingLogin = false
            }
        } else {
            loginAvailable = null
        }
    }

    // Debounced проверка email
    LaunchedEffect(email) {
        val trimmed = email.trim()
        if (isValidEmail(trimmed)) {
            delay(500)
            isCheckingEmail = true
            viewModel.checkEmailAvailability(trimmed) { available ->
                emailAvailable = available
                if (available) emailError = ""
                else emailError = "Этот email уже зарегистрирован"
                isCheckingEmail = false
            }
        } else {
            emailAvailable = null
        }
    }

    // Debounced проверка телефона
    LaunchedEffect(phone.text) {
        val cleaned = cleanPhoneNumber(phone.text)
        if (cleaned.length == 11 || phone.text.length >= 18) {
            delay(500)
            isCheckingPhone = true
            viewModel.checkPhoneAvailability(phone.text) { available ->
                phoneAvailable = available
                if (available) phoneError = ""
                else phoneError = "Этот номер уже зарегистрирован"
                isCheckingPhone = false
            }
        } else {
            phoneAvailable = null
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is AuthUiState.Success) {
            onRegisterSuccess()
        }
    }

    // Валидация формы
    fun validateForm(): Boolean {
        var isValid = true

        if (login.length < 3) {
            loginError = "Логин должен быть не менее 3 символов"
            isValid = false
        } else if (!login.matches(Regex("^[a-zA-Z0-9_]+$"))) {
            loginError = "Логин может содержать только буквы, цифры и подчёркивание"
            isValid = false
        } else if (loginAvailable == false) {
            loginError = "Этот логин уже занят"
            isValid = false
        }

        if (!isValidEmail(email)) {
            emailError = "Введите корректный email"
            isValid = false
        } else if (emailAvailable == false) {
            emailError = "Этот email уже зарегистрирован"
            isValid = false
        }

        if (!isValidPhoneNumber(phone.text)) {
            phoneError = "Введите корректный номер телефона"
            isValid = false
        } else if (phoneAvailable == false) {
            phoneError = "Этот номер уже зарегистрирован"
            isValid = false
        }

        if (password.length < 6) {
            passwordError = "Пароль должен быть не менее 6 символов"
            isValid = false
        } else if (password != passwordConfirm) {
            passwordError = "Пароли не совпадают"
            isValid = false
        }

        return isValid
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.register_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateToLogin) {
                        Icon(Icons.Default.ArrowBack, "Назад")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Логин
            OutlinedTextField(
                value = login,
                onValueChange = {
                    login = it.lowercase().filter { c -> c.isLetterOrDigit() || c == '_' }
                    loginError = ""
                },
                label = {
                    Text(
                        text = "${stringResource(R.string.register_username)} *",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.typography.bodyMedium.color
                    )
                },
                placeholder = { Text("username") },
                leadingIcon = { Icon(Icons.Default.AccountCircle, null) },
                trailingIcon = {
                    if (login.length >= 3) {
                        if (isCheckingLogin) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else if (loginAvailable == true) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color(0xFF4CAF50)
                            )
                        }
                    }
                },
                singleLine = true,
                isError = loginError.isNotEmpty(),
                supportingText = {
                    when {
                        loginError.isNotEmpty() -> Text(loginError, color = MaterialTheme.colorScheme.error)
                        login.length >= 3 && loginAvailable == true ->
                            Text(stringResource(R.string.register_username_available), color = Color(0xFF4CAF50))
                    }
                },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Email
            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                    emailError = ""
                    emailAvailable = null
                },
                label = {
                    Text(
                        text = "${stringResource(R.string.register_email)} *",
                        style = MaterialTheme.typography.bodyMedium
                    )
                },
                placeholder = { Text("example@mail.ru") },
                leadingIcon = { Icon(Icons.Default.Email, null) },
                trailingIcon = {
                    if (isValidEmail(email.trim())) {
                        if (isCheckingEmail) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else if (emailAvailable == true) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color(0xFF4CAF50)
                            )
                        }
                    }
                },
                singleLine = true,
                isError = emailError.isNotEmpty(),
                supportingText = {
                    when {
                        emailError.isNotEmpty() -> Text(emailError, color = MaterialTheme.colorScheme.error)
                        isValidEmail(email.trim()) && emailAvailable == true ->
                            Text(stringResource(R.string.register_email_available), color = Color(0xFF4CAF50))
                    }
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Телефон
            OutlinedTextField(
                value = phone,
                onValueChange = { newValue ->
                    val (formatted, newCursor) = formatPhoneNumberWithCursor(
                        newValue.text,
                        newValue.selection.start
                    )
                    phone = TextFieldValue(
                        text = formatted,
                        selection = TextRange(newCursor)
                    )
                    phoneError = ""
                    phoneAvailable = null
                },
                label = {
                    Text(
                        text = "${stringResource(R.string.register_phone)} *",
                        style = MaterialTheme.typography.bodyMedium
                    )
                },
                placeholder = { Text("+7 (999) 999-99-99") },
                leadingIcon = { Icon(Icons.Default.Phone, null) },
                trailingIcon = {
                    if (isValidPhoneNumber(phone.text)) {
                        if (isCheckingPhone) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp
                            )
                        } else if (phoneAvailable == true) {
                            Icon(
                                Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = Color(0xFF4CAF50)
                            )
                        }
                    }
                },
                singleLine = true,
                isError = phoneError.isNotEmpty(),
                supportingText = {
                    when {
                        phoneError.isNotEmpty() -> Text(phoneError, color = MaterialTheme.colorScheme.error)
                        isValidPhoneNumber(phone.text) && phoneAvailable == true ->
                            Text(stringResource(R.string.register_phone_available), color = Color(0xFF4CAF50))
                    }
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Phone,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Отображаемое имя (опционально)
            OutlinedTextField(
                value = displayName,
                onValueChange = { displayName = it },
                label = {
                    Text(
                        text = "${stringResource(R.string.register_name)} ${stringResource(R.string.register_name_optional)}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                },
                placeholder = { Text("Как к вам обращаться") },
                leadingIcon = { Icon(Icons.Default.Person, null) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Будет отображаться в списке контактов. Если не указать, будет использоваться логин.",
                style = MaterialTheme.typography.labelSmall,
                color = Color.Gray,
                modifier = Modifier.padding(start = 16.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Пароль
            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    passwordError = ""
                },
                label = {
                    Text(
                        text = "${stringResource(R.string.register_password)} *",
                        style = MaterialTheme.typography.bodyMedium
                    )
                },
                placeholder = { Text("Минимум 6 символов") },
                leadingIcon = { Icon(Icons.Default.Lock, null) },
                trailingIcon = {
                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = null
                        )
                    }
                },
                visualTransformation = if (passwordVisible)
                    androidx.compose.ui.text.input.VisualTransformation.None
                else
                    PasswordVisualTransformation(),
                singleLine = true,
                isError = passwordError.isNotEmpty(),
                supportingText = {
                    if (passwordError.isNotEmpty()) {
                        Text(passwordError, color = MaterialTheme.colorScheme.error)
                    }
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Подтверждение пароля
            OutlinedTextField(
                value = passwordConfirm,
                onValueChange = { passwordConfirm = it },
                label = {
                    Text(
                        text = "${stringResource(R.string.register_password_confirm)} *",
                        style = MaterialTheme.typography.bodyMedium
                    )
                },
                placeholder = { Text("Повторите пароль") },
                leadingIcon = { Icon(Icons.Default.Lock, null) },
                trailingIcon = {
                    IconButton(onClick = { passwordConfirmVisible = !passwordConfirmVisible }) {
                        Icon(
                            imageVector = if (passwordConfirmVisible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                            contentDescription = null
                        )
                    }
                },
                visualTransformation = if (passwordConfirmVisible)
                    androidx.compose.ui.text.input.VisualTransformation.None
                else
                    PasswordVisualTransformation(),
                singleLine = true,
                isError = passwordConfirm.isNotEmpty() && password != passwordConfirm,
                supportingText = {
                    when {
                        passwordError.isNotEmpty() -> Text(passwordError, color = MaterialTheme.colorScheme.error)
                        passwordConfirm.isNotEmpty() && password == passwordConfirm ->
                            Text("Пароли совпадают", color = Color(0xFF4CAF50))
                    }
                },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        focusManager.clearFocus()
                        scope.launch {
                            if (validateForm()) {
                                viewModel.registerWithFullProfile(
                                    username = login,
                                    password = password,
                                    displayName = displayName.trim().ifBlank { login },
                                    email = email.trim(),
                                    phone = cleanPhoneNumber(phone.text)
                                )
                            }
                        }
                    }
                ),
                modifier = Modifier.fillMaxWidth()
            )

            // Общая ошибка
            if (uiState is AuthUiState.Error) {
                Spacer(modifier = Modifier.height(16.dp))
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = Color(0xFFFEE2E2).copy(alpha = if (isSystemInDarkTheme()) 0.2f else 1f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = (uiState as AuthUiState.Error).message,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFDC2626),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Register button
            Button(
                onClick = {
                    scope.launch {
                        if (validateForm()) {
                            viewModel.registerWithFullProfile(
                                username = login,
                                password = password,
                                displayName = displayName.trim().ifBlank { login },
                                email = email.trim(),
                                phone = cleanPhoneNumber(phone.text)
                            )
                        }
                    }
                },
                enabled = uiState !is AuthUiState.Loading &&
                        !isCheckingLogin && !isCheckingEmail && !isCheckingPhone,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary)
            ) {
                if (uiState is AuthUiState.Loading) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White)
                } else {
                    Text(
                        text = stringResource(R.string.register_button),
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Terms text
            Text(
                text = stringResource(R.string.register_terms),
                style = MaterialTheme.typography.labelSmall,
                color = Color.Gray,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
            )

            // Login link
            TextButton(
                onClick = onNavigateToLogin,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = stringResource(R.string.register_have_account),
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandPrimary
                )
            }
        }
    }
}
