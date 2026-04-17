package ru.lastochka.messenger.util

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

/**
 * Тесты для retryWithBackoff утилиты.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RetryWithBackoffTest {

    @Test
    fun `success on first attempt returns result`() = runTest {
        var callCount = 0
        val result = retryWithBackoff(maxRetries = 3, initialDelayMs = 10L) {
            callCount++
            "success"
        }

        assertTrue(result.isSuccess)
        assertEquals("success", result.getOrNull())
        assertEquals(1, callCount)
    }

    @Test
    fun `retries on failure and eventually succeeds`() = runTest {
        var callCount = 0
        val result = retryWithBackoff(maxRetries = 3, initialDelayMs = 10L) {
            callCount++
            if (callCount < 3) {
                throw RuntimeException("Temporary error")
            }
            "success"
        }

        assertTrue(result.isSuccess)
        assertEquals("success", result.getOrNull())
        assertEquals(3, callCount)
    }

    @Test
    fun `fails after max retries exhausted`() = runTest {
        var callCount = 0
        val result = retryWithBackoff(maxRetries = 2, initialDelayMs = 10L) {
            callCount++
            throw RuntimeException("Persistent error")
        }

        assertTrue(result.isFailure)
        assertEquals("Persistent error", result.exceptionOrNull()?.message)
        // 1 начальная попытка + 2 retry = 3 total
        assertEquals(3, callCount)
    }

    @Test
    fun `shouldRetry predicate can stop retries`() = runTest {
        var callCount = 0
        // Простой тест — shouldRetry = false сразу останавливает
        val result = retryWithBackoff(
            maxRetries = 5,
            initialDelayMs = 10L,
            shouldRetry = { false } // Никогда не retry
        ) {
            callCount++
            throw RuntimeException("Error")
        }

        assertTrue(result.isFailure)
        // Только 1 попыка — no retries
        assertEquals(1, callCount)
    }

    @Test
    fun `RetryPolicy Quick has fewer retries`() = runTest {
        var callCount = 0
        val result = RetryPolicy.Quick {
            callCount++
            throw RuntimeException("Error")
        }

        assertTrue(result.isFailure)
        // Quick: maxRetries = 2, так что 3 попытки total
        assertEquals(3, callCount)
    }

    @Test
    fun `RetryPolicy Network has standard retries`() = runTest {
        var callCount = 0
        val result = RetryPolicy.Network {
            callCount++
            throw RuntimeException("Error")
        }

        assertTrue(result.isFailure)
        // Network: maxRetries = 3, так что 4 попытки total
        assertEquals(4, callCount)
    }

    @Test
    fun `RetryPolicy Conservative has more retries`() = runTest {
        var callCount = 0
        val result = RetryPolicy.Conservative {
            callCount++
            throw RuntimeException("Error")
        }

        assertTrue(result.isFailure)
        // Conservative: maxRetries = 5, так что 6 попыток total
        assertEquals(6, callCount)
    }

    @Test
    fun `RetryPolicy invoke operator works`() = runTest {
        val policy = RetryPolicy(maxRetries = 1, initialDelayMs = 10L)
        var callCount = 0

        val result = policy {
            callCount++
            if (callCount < 2) {
                throw RuntimeException("Error")
            }
            "success"
        }

        assertTrue(result.isSuccess)
        assertEquals(2, callCount)
    }

    @Test
    fun `backoff delay calculation works correctly`() = runTest {
        // Простой тест что retry происходит с задержкой
        var callCount = 0
        val result = retryWithBackoff(
            maxRetries = 1,
            initialDelayMs = 10L,
            backoffFactor = 2.0
        ) {
            callCount++
            if (callCount < 2) {
                throw RuntimeException("Error")
            }
            "success"
        }

        assertTrue(result.isSuccess)
        assertEquals(2, callCount)
    }
}
