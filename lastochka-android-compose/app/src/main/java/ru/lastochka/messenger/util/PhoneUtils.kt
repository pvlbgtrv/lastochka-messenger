package ru.lastochka.messenger.util

/**
 * Форматирование телефона в формат +7 (XXX) XXX-XX-XX
 * Возвращает Pair(formattedText, newCursorPos) для корректной работы курсора
 */
fun formatPhoneNumberWithCursor(text: String, cursorPosition: Int): Pair<String, Int> {
    // Извлекаем только цифры из всего текста
    val fullDigits = text.filter { it.isDigit() }

    // Если начинается с 8, заменяем на 7
    val cleaned = if (fullDigits.startsWith("8") && fullDigits.length >= 1) {
        "7" + fullDigits.substring(1)
    } else {
        fullDigits
    }

    // Ограничиваем 11 цифрами (7 + 10)
    val digits = if (cleaned.length > 11) cleaned.substring(0, 11) else cleaned

    // Извлекаем только цифры до позиции курсора в исходном тексте
    val beforeCursor = text.substring(0, cursorPosition.coerceAtMost(text.length)).filter { it.isDigit() }
    val digitsBeforeCursor = beforeCursor.length.coerceAtMost(digits.length)

    // Строим форматированную строку +7 (XXX) XXX-XX-XX
    val formatted = buildString {
        if (digits.isEmpty()) return@buildString

        append("+7")
        if (digits.length > 1) {
            append(" (")
            val end = 1 + (digits.length - 1).coerceAtMost(3)
            append(digits.substring(1, end))
        }
        if (digits.length > 4) {
            append(") ")
            val end = 4 + (digits.length - 4).coerceAtMost(3)
            append(digits.substring(4, end))
        }
        if (digits.length > 7) {
            append("-")
            val end = 7 + (digits.length - 7).coerceAtMost(2)
            append(digits.substring(7, end))
        }
        if (digits.length > 9) {
            append("-")
            val end = 9 + (digits.length - 9).coerceAtMost(2)
            append(digits.substring(9, end))
        }
    }

    // Вычисляем позицию курсора в отформатированной строке
    val newCursorPos = when {
        digitsBeforeCursor == 0 -> 0
        digitsBeforeCursor == 1 -> 2  // после "+7"
        digitsBeforeCursor <= 4 -> 4 + (digitsBeforeCursor - 1)  // внутри "(XXX"
        digitsBeforeCursor <= 7 -> 9 + (digitsBeforeCursor - 4)  // внутри " XXX"
        digitsBeforeCursor <= 9 -> 13 + (digitsBeforeCursor - 7) // внутри "-XX"
        else -> 16 + (digitsBeforeCursor - 9)                    // внутри "-XX"
    }

    // Не даём курсору выйти за пределы строки
    val clampedCursor = newCursorPos.coerceAtMost(formatted.length)

    return Pair(formatted, clampedCursor)
}

/**
 * Простое форматирование (без управления курсором)
 */
fun formatPhoneNumber(input: String): String {
    return formatPhoneNumberWithCursor(input, input.length).first
}

/**
 * Проверка валидности email
 */
fun isValidEmail(email: String): Boolean {
    if (email.isBlank()) return false
    val pattern = Regex("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")
    return pattern.matches(email.trim())
}

/**
 * Проверка валидности телефона (11 цифр, начинается с 7)
 */
fun isValidPhoneNumber(phone: String): Boolean {
    val cleaned = phone.filter { it.isDigit() }
    return cleaned.length == 11 && cleaned.startsWith("7")
}

/**
 * Очистка номера телефона (только цифры)
 */
fun cleanPhoneNumber(phone: String): String {
    return phone.filter { it.isDigit() }
}
