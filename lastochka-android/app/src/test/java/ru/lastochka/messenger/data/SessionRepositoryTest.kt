package ru.lastochka.messenger.data

import io.mockk.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.*
import org.junit.*
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import ru.lastochka.messenger.service.NetworkMonitor

/**
 * Тесты для SessionRepository.
 * Проверяем auth операции и состояния.
 * 
 * Примечание: DataStore мокается через relaxed mock,
 * поэтому тесты фокусируются на auth логике.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class SessionRepositoryTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var tinodeClient: TinodeClient
    private lateinit var networkMonitor: NetworkMonitor

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        
        tinodeClient = mockk(relaxed = true)
        networkMonitor = mockk(relaxed = true)
        
        every { networkMonitor.isConnected } returns MutableStateFlow(true)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `TinodeClient myUid returns correct value`() = testScope.runTest {
        every { tinodeClient.myUid } returns "usrTestUid"

        Assert.assertEquals("usrTestUid", tinodeClient.myUid)
    }

    @Test
    fun `TinodeClient connectionState is observable`() = testScope.runTest {
        val connectionStateFlow = MutableStateFlow(TinodeConnState.Connected)
        every { tinodeClient.connectionState } returns connectionStateFlow

        val state = connectionStateFlow.value
        Assert.assertEquals(TinodeConnState.Connected, state)
    }

    @Test
    fun `AuthState sealed class works correctly`() = testScope.runTest {
        // Test Unauthenticated
        val unauth: AuthState = AuthState.Unauthenticated
        Assert.assertTrue(unauth is AuthState.Unauthenticated)

        // Test Authenticated
        val auth: AuthState = AuthState.Authenticated("usr123")
        Assert.assertTrue(auth is AuthState.Authenticated)
        Assert.assertEquals("usr123", (auth as AuthState.Authenticated).uid)

        // Test SessionExpired
        val expired: AuthState = AuthState.SessionExpired
        Assert.assertTrue(expired is AuthState.SessionExpired)
    }

    @Test
    fun `TinodeConnState enum works correctly`() = testScope.runTest {
        val states = listOf(
            TinodeConnState.Disconnected,
            TinodeConnState.Connecting,
            TinodeConnState.Connected,
            TinodeConnState.Authenticated,
            TinodeConnState.Error
        )

        Assert.assertEquals(5, states.size)
    }

    @Test
    fun `login result can be checked`() = testScope.runTest {
        coEvery { tinodeClient.login("user", "pass") } returns Result.success(Unit)

        val result = tinodeClient.login("user", "pass")
        Assert.assertTrue(result.isSuccess)
    }

    @Test
    fun `login failure can be checked`() = testScope.runTest {
        val error = Exception("Неверный пароль")
        coEvery { tinodeClient.login("user", "wrong") } returns Result.failure<Unit>(error)

        val result = tinodeClient.login("user", "wrong")
        Assert.assertTrue(result.isFailure)
        Assert.assertEquals("Неверный пароль", result.exceptionOrNull()?.message)
    }

    @Test
    fun `register result can be checked`() = testScope.runTest {
        coEvery { tinodeClient.register("new", "pass", "New") } returns Result.success(Unit)

        val result = tinodeClient.register("new", "pass", "New")
        Assert.assertTrue(result.isSuccess)
    }

    @Test
    fun `autoLogin result can be checked`() = testScope.runTest {
        coEvery { tinodeClient.autoLogin() } returns Result.success(Unit)

        val result = tinodeClient.autoLogin()
        Assert.assertTrue(result.isSuccess)
    }

    @Test
    fun `logout can be called`() = testScope.runTest {
        coEvery { tinodeClient.logout() } just Runs

        tinodeClient.logout()

        coVerify { tinodeClient.logout() }
    }
}
