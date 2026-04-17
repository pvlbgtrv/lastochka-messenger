package ru.lastochka.messenger.viewmodel

import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import ru.lastochka.messenger.data.SessionRepository

/**
 * Тесты для AuthViewModel.
 * Проверяем login, register, validation.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class AuthViewModelTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var sessionRepository: SessionRepository
    private lateinit var viewModel: AuthViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        sessionRepository = mockk(relaxed = true)
        viewModel = AuthViewModel(sessionRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `login success changes state to Success`() = testScope.runTest {
        coEvery { sessionRepository.login("testuser", "password123") } returns Result.success(Unit)

        viewModel.login("testuser", "password123")

        val state = viewModel.uiState.value
        Assert.assertTrue(state is AuthUiState.Success)
    }

    @Test
    fun `login failure changes state to Error`() = testScope.runTest {
        val error = Exception("Нет подключения к серверу")
        coEvery { sessionRepository.login("testuser", "password123") } returns Result.failure<Unit>(error)

        viewModel.login("testuser", "password123")

        val state = viewModel.uiState.value
        Assert.assertTrue(state is AuthUiState.Error)
        Assert.assertEquals("Нет подключения к серверу", (state as AuthUiState.Error).message)
    }

    @Test
    fun `register success changes state to Success`() = testScope.runTest {
        coEvery { sessionRepository.register("newuser", "password123", "New User") } returns Result.success(Unit)

        viewModel.register("newuser", "password123", "New User")

        val state = viewModel.uiState.value
        Assert.assertTrue(state is AuthUiState.Success)
    }

    @Test
    fun `register failure changes state to Error`() = testScope.runTest {
        coEvery {
            sessionRepository.register("existing", "password123", "Existing")
        } returns Result.failure<Unit>(Exception("User already exists"))

        viewModel.register("existing", "password123", "Existing")

        val state = viewModel.uiState.value
        Assert.assertTrue(state is AuthUiState.Error)
    }

    @Test
    fun `register with full profile success`() = testScope.runTest {
        coEvery {
            sessionRepository.registerWithFullProfile("user", "pass", "User", "user@test.com", "+79001234567")
        } returns Result.success(Unit)

        viewModel.registerWithFullProfile("user", "pass", "User", "user@test.com", "+79001234567")

        val state = viewModel.uiState.value
        Assert.assertTrue(state is AuthUiState.Success)
    }

    @Test
    fun `reset state returns Idle`() = testScope.runTest {
        coEvery { sessionRepository.login("user", "pass") } returns Result.failure(Exception("Error"))
        viewModel.login("user", "pass")

        Assert.assertTrue(viewModel.uiState.value is AuthUiState.Error)

        viewModel.resetState()

        Assert.assertTrue(viewModel.uiState.value is AuthUiState.Idle)
    }

    @Test
    fun `check username availability`() = testScope.runTest {
        coEvery { sessionRepository.tinodeClient.checkUsername("freeuser") } returns Result.success(true)

        var result: Boolean? = null
        viewModel.checkUsername("freeuser") { isAvailable ->
            result = isAvailable
        }

        Assert.assertTrue(result == true)
    }

    @Test
    fun `check username taken`() = testScope.runTest {
        coEvery { sessionRepository.tinodeClient.checkUsername("taken") } returns Result.success(false)

        var result: Boolean? = null
        viewModel.checkUsername("taken") { isAvailable ->
            result = isAvailable
        }

        Assert.assertFalse(result == true)
    }

    @Test
    fun `empty password login returns error`() = testScope.runTest {
        // ViewModel отправляет пустой пароль — сервер вернёт ошибку
        coEvery { sessionRepository.login("", "") } returns Result.failure<Unit>(Exception("Ошибка входа"))

        viewModel.login("", "")

        val state = viewModel.uiState.value
        Assert.assertTrue(state is AuthUiState.Error)
    }
}
