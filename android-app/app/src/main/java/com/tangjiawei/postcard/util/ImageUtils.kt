package com.tangjiawei.postcard.util

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max

data class PreparedImage(val preview: Bitmap, val dataUrl: String)

object ImageUtils {
    fun prepareUpload(resolver: ContentResolver, uri: Uri, maxEdge: Int = 1024): PreparedImage {
        val orientation = runCatching {
            resolver.openInputStream(uri).use { input ->
                requireNotNull(input)
                ExifInterface(input).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            }
        }.getOrDefault(ExifInterface.ORIENTATION_NORMAL)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / sample > maxEdge * 2) sample *= 2
        val decoded = resolver.openInputStream(uri).use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: error("无法读取图片")
        val rotation = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        val oriented = if (rotation != 0f) {
            Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, Matrix().apply { postRotate(rotation) }, true)
                .also { if (it !== decoded) decoded.recycle() }
        } else decoded
        val scale = minOf(1f, maxEdge.toFloat() / max(oriented.width, oriented.height))
        val resized = if (scale < 1f) {
            Bitmap.createScaledBitmap(oriented, (oriented.width * scale).toInt(), (oriented.height * scale).toInt(), true)
                .also { if (it !== oriented) oriented.recycle() }
        } else oriented
        val bytes = ByteArrayOutputStream().use {
            resized.compress(Bitmap.CompressFormat.JPEG, 88, it)
            it.toByteArray()
        }
        return PreparedImage(resized, "data:image/jpeg;base64," + android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
    }

    fun decodeDataUrl(value: String): Bitmap? {
        if (!value.startsWith("data:image/")) return null
        val encoded = value.substringAfter(',', "")
        if (encoded.isEmpty()) return null
        return runCatching {
            val bytes = android.util.Base64.decode(encoded, android.util.Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }.getOrNull()
    }

    fun renderPostcard(image: Bitmap, sentence: String, date: String): Bitmap {
        val width = 1400
        val height = 900
        val imageWidth = (width * .52f).toInt()
        return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also { output ->
            val canvas = Canvas(output)
            canvas.drawColor(Color.rgb(243, 240, 232))
            val sourceRatio = image.width.toFloat() / image.height
            val targetRatio = imageWidth.toFloat() / height
            val source = if (sourceRatio > targetRatio) {
                val cropWidth = (image.height * targetRatio).toInt()
                Rect((image.width - cropWidth) / 2, 0, (image.width + cropWidth) / 2, image.height)
            } else {
                val cropHeight = (image.width / targetRatio).toInt()
                Rect(0, (image.height - cropHeight) / 2, image.width, (image.height + cropHeight) / 2)
            }
            canvas.drawBitmap(image, source, Rect(0, 0, imageWidth, height), Paint(Paint.ANTI_ALIAS_FLAG))

            val accent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(122, 90, 58) }
            accent.typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
            accent.textSize = 22f
            accent.textAlign = Paint.Align.RIGHT
            canvas.drawText("EDITORIAL", width - 52f, 62f, accent)

            val quote = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.rgb(43, 42, 40)
                textSize = 48f
                typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
            }
            drawWrappedText(canvas, sentence, quote, imageWidth + 80f, 250f, width - imageWidth - 130f, 68f)
            accent.textAlign = Paint.Align.LEFT
            accent.textSize = 24f
            canvas.drawText(date, imageWidth + 80f, height - 75f, accent)
        }
    }

    fun saveToGallery(context: Context, bitmap: Bitmap): Uri {
        val name = "postcard-${System.currentTimeMillis()}.png"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Postcard")
        }
        val uri = context.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: error("无法创建相册文件")
        context.contentResolver.openOutputStream(uri).use { stream ->
            requireNotNull(stream)
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        }
        return uri
    }

    fun shareFile(context: Context, bitmap: Bitmap): Uri {
        val directory = File(context.cacheDir, "shared").apply { mkdirs() }
        val file = File(directory, "postcard.png")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    }

    fun today(): String = SimpleDateFormat("yyyy.MM.dd", Locale.getDefault()).format(Date())

    private fun drawWrappedText(canvas: Canvas, value: String, paint: Paint, x: Float, y: Float, width: Float, lineHeight: Float) {
        var line = ""
        var currentY = y
        value.forEach { character ->
            val candidate = line + character
            if (paint.measureText(candidate) > width && line.isNotEmpty()) {
                canvas.drawText(line, x, currentY, paint)
                line = character.toString()
                currentY += lineHeight
            } else line = candidate
        }
        if (line.isNotEmpty()) canvas.drawText(line, x, currentY, paint)
    }
}
