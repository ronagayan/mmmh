package com.ronagayan.nfcmaster

import android.content.ContentValues
import android.content.Context
import android.nfc.NdefMessage
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class HistoryEntry(
    val id: Long,
    val time: Long,
    val kind: String,
    val uid: String?,
    val techs: String?,
    val summary: String,
    val messageB64: String?,
    val info: String?
) {
    fun message(): NdefMessage? = messageB64?.let { try { NdefMessage(Base64.decode(it, Base64.NO_WRAP)) } catch (e: Exception) { null } }

    fun toJson(): JSONObject = JSONObject().put("id", id).put("time", time).put("kind", kind).put("uid", uid ?: JSONObject.NULL)
        .put("techs", techs ?: JSONObject.NULL).put("summary", summary).put("message", messageB64 ?: JSONObject.NULL).put("info", info ?: JSONObject.NULL)

    fun timeText(): String = SimpleDateFormat("dd/MM/yyyy HH:mm:ss", Locale.getDefault()).format(Date(time))

    fun kindRes(): Int = when (kind) {
        History.KIND_WRITE -> R.string.kind_write
        History.KIND_RECEIVED -> R.string.kind_received
        History.KIND_EMULATED -> R.string.kind_emulated
        else -> R.string.kind_read
    }

    companion object {
        private fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key)

        fun fromJson(o: JSONObject): HistoryEntry = HistoryEntry(
            o.optLong("id"), o.optLong("time"), o.optString("kind", History.KIND_READ),
            o.str("uid"), o.str("techs"), o.optString("summary", ""), o.str("message"), o.str("info")
        )

        fun fromMessage(ctx: Context, kind: String, msg: NdefMessage?, uid: String?, techs: String?, info: String? = null): HistoryEntry {
            val now = System.currentTimeMillis()
            val summary = NdefParser.summary(msg).ifEmpty { ctx.getString(R.string.no_ndef) }
            val b64 = msg?.let { Base64.encodeToString(it.toByteArray(), Base64.NO_WRAP) }
            return HistoryEntry(now, now, kind, uid, techs, summary, b64, info)
        }

        fun fromDetails(ctx: Context, d: TagDetails): HistoryEntry =
            fromMessage(ctx, History.KIND_READ, d.message, d.uid, d.techs.joinToString(", "), TagOps.describe(ctx, d))
    }
}

object History {
    const val KIND_READ = "read"
    const val KIND_WRITE = "write"
    const val KIND_RECEIVED = "received"
    const val KIND_EMULATED = "emulated"
    private const val MAX = 500

    private var cache: ArrayList<HistoryEntry>? = null

    private fun file(ctx: Context) = File(ctx.filesDir, "history.json")

    @Synchronized
    fun all(ctx: Context): List<HistoryEntry> {
        cache?.let { return ArrayList(it) }
        val list = ArrayList<HistoryEntry>()
        val f = file(ctx)
        if (f.exists()) {
            try {
                val arr = JSONArray(f.readText())
                for (i in 0 until arr.length()) list.add(HistoryEntry.fromJson(arr.getJSONObject(i)))
            } catch (_: Exception) {
            }
        }
        cache = list
        return ArrayList(list)
    }

    @Synchronized
    private fun persist(ctx: Context) {
        val arr = JSONArray()
        cache?.forEach { arr.put(it.toJson()) }
        try { file(ctx).writeText(arr.toString()) } catch (_: Exception) {}
    }

    @Synchronized
    fun add(ctx: Context, e: HistoryEntry) {
        all(ctx)
        cache!!.add(0, e)
        while (cache!!.size > MAX) cache!!.removeAt(cache!!.size - 1)
        persist(ctx)
    }

    @Synchronized
    fun delete(ctx: Context, id: Long) {
        all(ctx)
        cache!!.removeAll { it.id == id }
        persist(ctx)
    }

    @Synchronized
    fun clear(ctx: Context) {
        cache = ArrayList()
        persist(ctx)
    }

    fun exportText(ctx: Context): String {
        val arr = JSONArray()
        all(ctx).forEach { e ->
            val o = e.toJson()
            o.put("timeText", e.timeText())
            val recs = JSONArray()
            NdefParser.parseMessage(e.message()).forEach { p ->
                val r = JSONObject().put("type", p.typeKey).put("content", p.body)
                p.details.forEach { (k, v) -> r.put(ctx.resources.getResourceEntryName(k), v) }
                recs.put(r)
            }
            o.put("records", recs)
            arr.put(o)
        }
        return arr.toString(2)
    }

    /** Saves the export to the Downloads folder. Returns the file name, or null on failure. */
    fun exportToDownloads(ctx: Context): String? {
        val name = "nfc_history_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date()) + ".json"
        val text = exportText(ctx)
        return try {
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                    put(MediaStore.MediaColumns.MIME_TYPE, "application/json")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = ctx.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return null
                ctx.contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) } ?: return null
                name
            } else {
                @Suppress("DEPRECATION")
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                dir.mkdirs()
                File(dir, name).writeText(text)
                name
            }
        } catch (e: Exception) {
            null
        }
    }
}
