package ru.lastochka.messenger.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Size
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/**
 * Утилита для сжатия изображений перед отправкой.
 *
 * Стратегия:
 * - Максимальная сторона: 1920px (Full HD) — достаточно для просмотра на любом экране
 * - Качество JPEG: 85% — хороший баланс качество/размер
 * - Если изображение < 1MB — не сжимаем
 * - Сохраняем ориентацию (EXIF)
 */
object ImageCompressor {

    private const val MAX_SIDE = 1920
    private const val JPEG_QUALITY = 85
    private const val NO_COMPRESS_THRESHOLD = 1_000_000L // 1MB

    /**
     * Сжать изображение из Uri. Возвращает временный файл со сжатым JPEG.
     */
    fun compressImage(context: Context, uri: Uri): CompressedImage {
        val inputStream = context.contentResolver.openInputStream(uri)
            ?: throw IllegalArgumentException("Cannot open URI: $uri")

        // Сначала читаем размеры без декодирования
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeStream(inputStream, null, options)
        inputStream.close()

        val originalWidth = options.outWidth
        val originalHeight = options.outHeight
        val originalSize = context.contentResolver.openInputStream(uri)?.use { it.available().toLong() } ?: 0L

        // Если маленькое — не сжимаем
        if (originalSize < NO_COMPRESS_THRESHOLD && originalSize > 0) {
            return CompressedImage(
                file = uriToFile(context, uri),
                mimeType = context.contentResolver.getType(uri) ?: "image/jpeg",
                originalSize = originalSize,
                compressedSize = originalSize,
                wasCompressed = false
            )
        }

        // Вычисляем inSampleSize для декодирования
        val targetSize = calculateTargetSize(originalWidth, originalHeight)
        val inSampleSize = calculateInSampleSize(options, targetSize.width, targetSize.height)

        // Декодируем с уменьшением
        val decodeOptions = BitmapFactory.Options().apply {
            this.inSampleSize = inSampleSize
            this.inPreferredConfig = Bitmap.Config.RGB_565 // Экономим память
        }

        val decodeStream = context.contentResolver.openInputStream(uri)
        val bitmap = BitmapFactory.decodeStream(decodeStream, null, decodeOptions)
            ?: throw IllegalStateException("Failed to decode bitmap")
        decodeStream?.close()

        // Проверяем ориентацию (EXIF)
        val orientation = getOrientation(context, uri)

        // Поворачиваем если нужно
        val rotatedBitmap = rotateBitmapIfNeeded(bitmap, orientation)
        if (rotatedBitmap !== bitmap) {
            bitmap.recycle()
        }

        // Если после downsampling всё ещё больше MAX_SIDE — дожимаем
        val rotatedWidth = rotatedBitmap.width
        val rotatedHeight = rotatedBitmap.height
        val finalBitmap = if (rotatedWidth > MAX_SIDE || rotatedHeight > MAX_SIDE) {
            val scale = MAX_SIDE.toFloat() / maxOf(rotatedWidth, rotatedHeight)
            val scaledWidth = (rotatedWidth * scale).toInt()
            val scaledHeight = (rotatedHeight * scale).toInt()
            val scaled = Bitmap.createScaledBitmap(rotatedBitmap, scaledWidth, scaledHeight, true)
            if (scaled !== rotatedBitmap) rotatedBitmap.recycle()
            scaled
        } else {
            rotatedBitmap
        }

        // Сохраняем в JPEG
        val compressedFile = File.createTempFile("compressed_", ".jpg", context.cacheDir)
        val outputStream = FileOutputStream(compressedFile)
        finalBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, outputStream)
        outputStream.flush()
        outputStream.close()
        finalBitmap.recycle()

        val compressedSize = compressedFile.length()

        return CompressedImage(
            file = compressedFile,
            mimeType = "image/jpeg",
            originalSize = originalSize,
            compressedSize = compressedSize,
            wasCompressed = true
        )
    }

    /**
     * Сжать изображение из File (для камеры).
     */
    fun compressImageFile(context: Context, file: File): CompressedImage {
        val uri = android.net.Uri.fromFile(file)
        return compressImage(context, uri)
    }

    private fun calculateTargetSize(width: Int, height: Int): Size {
        val maxSide = MAX_SIDE
        return if (width <= maxSide && height <= maxSide) {
            Size(width, height)
        } else {
            val ratio = if (width > height) maxSide.toFloat() / width else maxSide.toFloat() / height
            Size((width * ratio).toInt(), (height * ratio).toInt())
        }
    }

    private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val (height, width) = Pair(options.outHeight, options.outWidth)
        var inSampleSize = 1

        if (height > reqHeight || width > reqWidth) {
            val halfHeight = height / 2
            val halfWidth = width / 2
            while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }

    private fun getOrientation(context: Context, uri: Uri): Int {
        return try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                val exif = ExifInterface(input)
                exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            } ?: ExifInterface.ORIENTATION_NORMAL
        } catch (e: Exception) {
            ExifInterface.ORIENTATION_NORMAL
        }
    }

    private fun rotateBitmapIfNeeded(bitmap: Bitmap, orientation: Int): Bitmap {
        val matrix = android.graphics.Matrix()
        var needsRotation = false

        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> {
                matrix.postRotate(90f)
                needsRotation = true
            }
            ExifInterface.ORIENTATION_ROTATE_180 -> {
                matrix.postRotate(180f)
                needsRotation = true
            }
            ExifInterface.ORIENTATION_ROTATE_270 -> {
                matrix.postRotate(270f)
                needsRotation = true
            }
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> {
                matrix.postScale(-1f, 1f)
                needsRotation = true
            }
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> {
                matrix.postScale(1f, -1f)
                needsRotation = true
            }
            else -> return bitmap
        }

        return if (needsRotation) {
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } else {
            bitmap
        }
    }

    private fun uriToFile(context: Context, uri: Uri): File {
        // Для file:// URI — используем путь напрямую
        if (uri.scheme == "file") {
            val path = uri.path
                ?: throw IllegalArgumentException("URI has null path: $uri")
            return File(path)
        }

        val tempFile = File.createTempFile("original_", ".tmp", context.cacheDir)
        context.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(tempFile).use { output ->
                input.copyTo(output)
            }
        }
        return tempFile
    }

    private fun maxOf(a: Int, b: Int) = if (a > b) a else b
}

/**
 * Результат сжатия изображения.
 */
data class CompressedImage(
    val file: File,
    val mimeType: String,
    val originalSize: Long,
    val compressedSize: Long,
    val wasCompressed: Boolean
) {
    val compressionRatio: Float
        get() = if (originalSize > 0) compressedSize.toFloat() / originalSize else 1f

    val compressionPercent: Int
        get() = ((1f - compressionRatio) * 100).toInt()
}
