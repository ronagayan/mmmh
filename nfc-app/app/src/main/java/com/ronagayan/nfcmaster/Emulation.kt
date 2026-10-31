package com.ronagayan.nfcmaster

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.nfc.NdefMessage
import android.os.Handler
import android.os.Looper
import android.util.Base64
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Process-wide state shared between the UI and [HceService]. Persisted in SharedPreferences so the
 * service can restore it even when Android starts it in a fresh process.
 */
object Emulation {
    const val EVT_LOG = "log"
    const val EVT_STATE = "state"
    const val EVT_READ = "read"
    const val EVT_RECEIVED = "received"
    const val EVT_READER = "reader"

    private const val PREF = "emulation"
    private val main = Handler(Looper.getMainLooper())
    private val time = SimpleDateFormat("HH:mm:ss", Locale.US)

    @Volatile var loaded = false
    @Volatile var enabled = false
    @Volatile var writable = false
    @Volatile var message: NdefMessage? = null
    @Volatile var readCount = 0
    @Volatile var writeCount = 0
    val log = ArrayList<String>()
    val listeners = CopyOnWriteArrayList<(String, String?) -> Unit>()

    @Synchronized
    fun load(ctx: Context) {
        if (loaded) return
        val p = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        enabled = p.getBoolean("enabled", false)
        writable = p.getBoolean("writable", false)
        readCount = p.getInt("reads", 0)
        writeCount = p.getInt("writes", 0)
        val b64 = p.getString("message", null)
        message = if (b64 != null) try { NdefMessage(Base64.decode(b64, Base64.NO_WRAP)) } catch (e: Exception) { null } else null
        loaded = true
    }

    private fun save(ctx: Context) {
        val p = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).edit()
        p.putBoolean("enabled", enabled).putBoolean("writable", writable).putInt("reads", readCount).putInt("writes", writeCount)
        val m = message
        if (m == null) p.remove("message") else p.putString("message", Base64.encodeToString(m.toByteArray(), Base64.NO_WRAP))
        p.apply()
    }

    fun setContent(ctx: Context, msg: NdefMessage?, writableMode: Boolean) {
        load(ctx)
        message = msg
        writable = writableMode
        save(ctx)
        emit(EVT_STATE, null)
    }

    fun setEnabled(ctx: Context, on: Boolean) {
        load(ctx)
        enabled = on
        save(ctx)
        val pm = ctx.packageManager
        val cn = ComponentName(ctx, HceService::class.java)
        pm.setComponentEnabledSetting(
            cn,
            if (on) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
        )
        addLog(ctx.getString(if (on) R.string.emu_started else R.string.emu_stopped))
        emit(EVT_STATE, null)
    }

    fun isServiceEnabled(ctx: Context): Boolean {
        val s = ctx.packageManager.getComponentEnabledSetting(ComponentName(ctx, HceService::class.java))
        return s == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
    }

    fun countRead(ctx: Context) {
        readCount++
        save(ctx)
        emit(EVT_READ, null)
    }

    fun received(ctx: Context, msg: NdefMessage) {
        writeCount++
        message = msg
        save(ctx)
        Thread {
            History.add(ctx, HistoryEntry.fromMessage(ctx, History.KIND_RECEIVED, msg, null, "HCE"))
        }.start()
        emit(EVT_RECEIVED, NdefParser.summary(msg))
    }

    fun addLog(line: String) {
        synchronized(log) {
            log.add(time.format(Date()) + "  " + line)
            while (log.size > 300) log.removeAt(0)
        }
        emit(EVT_LOG, line)
    }

    fun clearLog() {
        synchronized(log) { log.clear() }
        emit(EVT_LOG, null)
    }

    fun logText(): String = synchronized(log) { log.joinToString("\n") }

    fun emit(event: String, detail: String?) {
        main.post { for (l in listeners) l(event, detail) }
    }

    /** NDEF file content: 2 byte NLEN followed by the message. */
    fun ndefFile(): ByteArray {
        val m = message?.toByteArray() ?: ByteArray(0)
        val out = ByteArray(2 + m.size)
        out[0] = (m.size shr 8).toByte()
        out[1] = m.size.toByte()
        System.arraycopy(m, 0, out, 2, m.size)
        return out
    }
}
