package com.ronagayan.nfcmaster

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.widget.Toast

object Hex {
    private const val DIGITS = "0123456789ABCDEF"

    fun encode(bytes: ByteArray?, sep: String = ""): String {
        if (bytes == null) return ""
        val sb = StringBuilder(bytes.size * 3)
        for ((i, b) in bytes.withIndex()) {
            if (i > 0 && sep.isNotEmpty()) sb.append(sep)
            val v = b.toInt() and 0xFF
            sb.append(DIGITS[v shr 4]).append(DIGITS[v and 0x0F])
        }
        return sb.toString()
    }

    fun decode(s: String): ByteArray {
        val clean = s.replace(Regex("[^0-9A-Fa-f]"), "")
        require(clean.length % 2 == 0) { "odd hex length" }
        return ByteArray(clean.length / 2) { i -> clean.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    fun isHex(s: String): Boolean = s.replace(Regex("[\\s:,-]"), "").matches(Regex("([0-9A-Fa-f]{2})*"))

    /** Formats bytes as rows of [blockSize] bytes with an address column and ASCII view. */
    fun dump(bytes: ByteArray, blockSize: Int = 4, startBlock: Int = 0, label: String = "pg"): String {
        val sb = StringBuilder()
        var i = 0
        var block = startBlock
        while (i < bytes.size) {
            val end = minOf(i + blockSize, bytes.size)
            val chunk = bytes.copyOfRange(i, end)
            sb.append(label).append(' ').append(String.format("%03d", block)).append(" [").append(String.format("%02X", block)).append("]  ")
            sb.append(encode(chunk, " "))
            sb.append("  |")
            for (b in chunk) {
                val c = b.toInt() and 0xFF
                sb.append(if (c in 32..126) c.toChar() else '.')
            }
            sb.append("|\n")
            i = end
            block++
        }
        return sb.toString().trimEnd()
    }
}

object Prefs {
    const val VIBRATE = "vibrate"
    const val SOUND = "sound"
    const val AUTO_OPEN = "auto_open"
    const val KEEP_SCREEN = "keep_screen"
    const val SKIP_NDEF = "skip_ndef"
    const val NO_SOUNDS = "no_platform_sounds"
    const val READ_DUMP = "read_dump"

    fun get(ctx: Context): SharedPreferences = ctx.getSharedPreferences("nfcmaster", Context.MODE_PRIVATE)

    fun bool(ctx: Context, key: String, def: Boolean): Boolean = get(ctx).getBoolean(key, def)

    fun set(ctx: Context, key: String, value: Boolean) = get(ctx).edit().putBoolean(key, value).apply()

    fun defaultFor(key: String): Boolean = when (key) {
        VIBRATE, SOUND, KEEP_SCREEN, READ_DUMP -> true
        else -> false
    }
}

object Feedback {
    fun scanned(ctx: Context) {
        if (Prefs.bool(ctx, Prefs.VIBRATE, true)) {
            try {
                @Suppress("DEPRECATION")
                val v = ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE))
                else @Suppress("DEPRECATION") v.vibrate(60)
            } catch (_: Exception) {
            }
        }
        if (Prefs.bool(ctx, Prefs.SOUND, true)) {
            try {
                val tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70)
                tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 120)
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ tg.release() }, 400)
            } catch (_: Exception) {
            }
        }
    }
}

object Ui {
    fun toast(ctx: Context, msg: CharSequence) = Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show()
    fun toast(ctx: Context, res: Int) = Toast.makeText(ctx, res, Toast.LENGTH_SHORT).show()

    fun copy(ctx: Context, text: String, label: String = "NFC") {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText(label, text))
        toast(ctx, R.string.copied)
    }

    fun share(ctx: Context, text: String, subject: String = "NFC") {
        val i = Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, subject).putExtra(Intent.EXTRA_TEXT, text)
        ctx.startActivity(Intent.createChooser(i, subject))
    }

    fun dp(ctx: Context, v: Int): Int = (v * ctx.resources.displayMetrics.density + 0.5f).toInt()
}
