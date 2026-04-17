package ru.lastochka.messenger.util

import kotlinx.coroutines.delay
import kotlin.math.min
import kotlin.math.pow

/**
 * Утилита для выполнения операций с retry логикой и exponential backoff.
 *
 * Пример использования:
 * ```
 * val result = retryWithBackoff(
 *     maxRetries = 3,
 *     initialDelayMs = 1000L,
 *     maxDelayMs = 10000L,
 *     backoffFactor = 2.0
 * ) {
 *     tinodeClient.login(username, password)
 * }
 * ```
 *
 * @param maxRetries Максимальное количество попыток (не считая первую)
 * @param initialDelayMs Начальная задержка в мс (по умолчанию 1 секунда)
 * @param maxDelayMs Максимальная задержка в мс (по умолчанию 30 секунд)
 * @param backoffFactor Множитель для экспоненциального роста (по умолчанию 2.0)
 * @param shouldRetry Предикат для определения стоит ли повторять попытку
 * @param block Выполняемая операция
 * @return Результат операции или последнюю ошибку
 */
suspend fun <T> retryWithBackoff(
    maxRetries: Int = 3,
    initialDelayMs: Long = 1_000L,
    maxDelayMs: Long = 30_000L,
    backoffFactor: Double = 2.0,
    shouldRetry: (Throwable) -> Boolean = { true },
    block: suspend () -> T
): Result<T> {
    var lastError: Throwable? = null
    
    repeat(maxRetries + 1) { attempt ->
        try {
            val result = block()
            return Result.success(result)
        } catch (e: Throwable) {
            lastError = e
            
            // Если это последняя попытка или не стоит retry — выходим
            if (attempt == maxRetries || !shouldRetry(e)) {
                return Result.failure(e)
            }
            
            // Вычисляем задержку с exponential backoff
            val delayMs = (initialDelayMs * backoffFactor.pow(attempt)).toLong()
            val actualDelay = min(delayMs, maxDelayMs)
            
            // Ждём перед следующей попыткой
            delay(actualDelay)
        }
    }
    
    // Теоретически недостижимо, но компилятор требует
    return Result.failure(lastError ?: RuntimeException("Unknown error"))
}

/**
 * Класс для конфигурации retry политики.
 */
class RetryPolicy(
    val maxRetries: Int = 3,
    val initialDelayMs: Long = 1_000L,
    val maxDelayMs: Long = 30_000L,
    val backoffFactor: Double = 2.0,
    val shouldRetry: (Throwable) -> Boolean = { true }
) {
    companion object {
        /** Быстрый retry для лёгких операций */
        val Quick = RetryPolicy(
            maxRetries = 2,
            initialDelayMs = 500L,
            maxDelayMs = 2_000L,
            backoffFactor = 2.0
        )
        
        /** Стандартный retry для сетевых операций */
        val Network = RetryPolicy(
            maxRetries = 3,
            initialDelayMs = 1_000L,
            maxDelayMs = 10_000L,
            backoffFactor = 2.0
        )
        
        /** Консервативный retry для критичных операций */
        val Conservative = RetryPolicy(
            maxRetries = 5,
            initialDelayMs = 2_000L,
            maxDelayMs = 30_000L,
            backoffFactor = 1.5
        )
    }
    
    suspend operator fun <T> invoke(block: suspend () -> T): Result<T> {
        return retryWithBackoff(
            maxRetries = maxRetries,
            initialDelayMs = initialDelayMs,
            maxDelayMs = maxDelayMs,
            backoffFactor = backoffFactor,
            shouldRetry = shouldRetry,
            block = block
        )
    }
}
