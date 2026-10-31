package com.ronagayan.nfcmaster

import android.net.Uri
import android.nfc.FormatException
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

/** A human readable view of one NDEF record. */
class ParsedRecord(
    val typeRes: Int,
    val typeKey: String,
    val body: String,
    val details: List<Pair<Int, String>> = emptyList(),
    val actionUri: String? = null,
    val meta: String = ""
)

object NdefParser {
    private const val WSC_MIME = "application/vnd.wfa.wsc"
    private const val BT_OOB_MIME = "application/vnd.bluetooth.ep.oob"

    fun parseMessage(msg: NdefMessage?): List<ParsedRecord> = msg?.records?.map { parseOne(it) } ?: emptyList()

    fun parseOne(r: NdefRecord): ParsedRecord {
        val size = r.payload?.size ?: 0
        val meta = "$size B"
        return try {
            when (r.tnf) {
                NdefRecord.TNF_EMPTY -> ParsedRecord(R.string.rt_empty, "empty", "", meta = meta)
                NdefRecord.TNF_WELL_KNOWN -> parseWellKnown(r, meta)
                NdefRecord.TNF_MIME_MEDIA -> parseMime(r, meta)
                NdefRecord.TNF_ABSOLUTE_URI -> {
                    val uri = String(r.type, Charsets.UTF_8)
                    classifyUri(uri, meta)
                }
                NdefRecord.TNF_EXTERNAL_TYPE -> {
                    val type = String(r.type, Charsets.UTF_8)
                    if (type.equals("android.com:pkg", ignoreCase = true)) {
                        val pkg = String(r.payload, Charsets.UTF_8)
                        ParsedRecord(R.string.rt_app, "aar", pkg, actionUri = "market://details?id=$pkg", meta = meta)
                    } else {
                        ParsedRecord(R.string.rt_external, "ext", textOrHex(r.payload), listOf(R.string.f_type to type), meta = meta)
                    }
                }
                else -> ParsedRecord(R.string.rt_raw, "raw", Hex.encode(r.payload, " "), listOf(R.string.f_tnf to r.tnf.toString(), R.string.f_type to Hex.encode(r.type)), meta = meta)
            }
        } catch (e: Exception) {
            ParsedRecord(R.string.rt_raw, "raw", Hex.encode(r.payload, " "), listOf(R.string.f_tnf to r.tnf.toString()), meta = meta)
        }
    }

    private fun parseWellKnown(r: NdefRecord, meta: String): ParsedRecord {
        val type = r.type
        return when {
            type.contentEquals(NdefRecord.RTD_TEXT) -> {
                val p = r.payload
                val status = p[0].toInt() and 0xFF
                val utf16 = (status and 0x80) != 0
                val langLen = status and 0x3F
                val lang = String(p, 1, langLen, Charsets.US_ASCII)
                val text = String(p, 1 + langLen, p.size - 1 - langLen, if (utf16) Charsets.UTF_16 else Charsets.UTF_8)
                ParsedRecord(R.string.rt_text, "text", text, listOf(R.string.i_lang to lang), meta = meta)
            }
            type.contentEquals(NdefRecord.RTD_URI) -> {
                val uri = r.toUri()?.toString() ?: ""
                classifyUri(uri, meta)
            }
            type.contentEquals(NdefRecord.RTD_SMART_POSTER) -> {
                val inner = try { NdefMessage(r.payload) } catch (e: FormatException) { null }
                var uri = ""
                var title = ""
                inner?.records?.forEach { ir ->
                    val pr = parseOne(ir)
                    if (pr.typeKey == "text") title = pr.body
                    else if (pr.actionUri != null) uri = pr.actionUri
                }
                ParsedRecord(R.string.rt_smart_poster, "sp", if (title.isNotEmpty()) "$title\n$uri" else uri, actionUri = uri.ifEmpty { null }, meta = meta)
            }
            else -> ParsedRecord(R.string.rt_raw, "raw", textOrHex(r.payload), listOf(R.string.f_type to String(type, Charsets.UTF_8)), meta = meta)
        }
    }

    fun classifyUri(uri: String, meta: String): ParsedRecord {
        val lower = uri.lowercase()
        return when {
            lower.startsWith("tel:") -> ParsedRecord(R.string.rt_phone, "phone", uri.substring(4), actionUri = uri, meta = meta)
            lower.startsWith("sms:") || lower.startsWith("smsto:") -> {
                val u = Uri.parse(uri)
                val number = uri.substringAfter(':').substringBefore('?')
                val body = try { u.getQueryParameter("body") } catch (e: Exception) { null }
                ParsedRecord(R.string.rt_sms, "sms", number, listOfNotNull(body?.let { R.string.f_message to it }), actionUri = uri, meta = meta)
            }
            lower.startsWith("mailto:") -> {
                val u = Uri.parse(uri)
                val to = uri.substringAfter(':').substringBefore('?')
                val details = ArrayList<Pair<Int, String>>()
                try {
                    u.getQueryParameter("subject")?.let { details.add(R.string.f_subject to it) }
                    u.getQueryParameter("body")?.let { details.add(R.string.f_body to it) }
                } catch (_: Exception) {
                }
                ParsedRecord(R.string.rt_email, "email", to, details, actionUri = uri, meta = meta)
            }
            lower.startsWith("geo:") -> ParsedRecord(R.string.rt_geo, "geo", uri.substring(4), actionUri = uri, meta = meta)
            else -> ParsedRecord(R.string.rt_uri, "uri", uri, actionUri = uri, meta = meta)
        }
    }

    private fun parseMime(r: NdefRecord, meta: String): ParsedRecord {
        val mime = String(r.type, Charsets.US_ASCII)
        val p = r.payload
        return when {
            mime.equals(WSC_MIME, ignoreCase = true) -> parseWifi(p, meta)
            mime.equals("text/vcard", true) || mime.equals("text/x-vcard", true) -> {
                val text = String(p, Charsets.UTF_8)
                val name = Regex("(?m)^FN:(.*)$").find(text)?.groupValues?.get(1)?.trim() ?: ""
                val tel = Regex("(?m)^TEL[^:]*:(.*)$").find(text)?.groupValues?.get(1)?.trim()
                val email = Regex("(?m)^EMAIL[^:]*:(.*)$").find(text)?.groupValues?.get(1)?.trim()
                val details = ArrayList<Pair<Int, String>>()
                tel?.let { details.add(R.string.f_phone to it) }
                email?.let { details.add(R.string.f_email to it) }
                details.add(R.string.f_data to text)
                ParsedRecord(R.string.rt_vcard, "vcard", name.ifEmpty { text.lines().firstOrNull() ?: "" }, details, actionUri = tel?.let { "tel:$it" }, meta = meta)
            }
            mime.equals(BT_OOB_MIME, ignoreCase = true) -> {
                val mac = if (p.size >= 8) (7 downTo 2).joinToString(":") { String.format("%02X", p[it]) } else ""
                var name = ""
                var i = 8
                while (i + 1 < p.size) {
                    val len = p[i].toInt() and 0xFF
                    if (len == 0) break
                    val t = p[i + 1].toInt() and 0xFF
                    if ((t == 0x09 || t == 0x08) && i + 1 + len <= p.size) name = String(p, i + 2, len - 1, Charsets.UTF_8)
                    i += len + 1
                }
                ParsedRecord(R.string.rt_bluetooth, "bt", if (name.isNotEmpty()) "$name ($mac)" else mac, listOf(R.string.f_mac to mac), meta = meta)
            }
            mime.startsWith("text/", ignoreCase = true) -> ParsedRecord(R.string.rt_mime, "mime", String(p, Charsets.UTF_8), listOf(R.string.f_mime to mime), meta = meta)
            else -> ParsedRecord(R.string.rt_mime, "mime", textOrHex(p), listOf(R.string.f_mime to mime), meta = meta)
        }
    }

    private fun parseWifi(p: ByteArray, meta: String): ParsedRecord {
        var ssid = ""
        var key = ""
        var auth = ""
        fun walk(data: ByteArray, start: Int, end: Int) {
            var i = start
            while (i + 4 <= end) {
                val t = ((data[i].toInt() and 0xFF) shl 8) or (data[i + 1].toInt() and 0xFF)
                val l = ((data[i + 2].toInt() and 0xFF) shl 8) or (data[i + 3].toInt() and 0xFF)
                val vs = i + 4
                val ve = minOf(vs + l, end)
                when (t) {
                    0x100E -> walk(data, vs, ve)
                    0x1045 -> ssid = String(data, vs, ve - vs, Charsets.UTF_8)
                    0x1027 -> key = String(data, vs, ve - vs, Charsets.UTF_8)
                    0x1003 -> if (ve - vs >= 2) {
                        val a = ((data[vs].toInt() and 0xFF) shl 8) or (data[vs + 1].toInt() and 0xFF)
                        auth = when (a) {
                            0x0001 -> "Open"; 0x0002 -> "WPA-Personal"; 0x0004 -> "Shared (WEP)"; 0x0008 -> "WPA-Enterprise"
                            0x0010 -> "WPA2-Enterprise"; 0x0020 -> "WPA2-Personal"; 0x0022 -> "WPA/WPA2-Personal"; else -> String.format("0x%04X", a)
                        }
                    }
                }
                i = ve
            }
        }
        walk(p, 0, p.size)
        val details = ArrayList<Pair<Int, String>>()
        details.add(R.string.i_ssid to ssid)
        details.add(R.string.i_password to key)
        details.add(R.string.i_security to auth)
        return ParsedRecord(R.string.rt_wifi, "wifi", ssid, details, meta = meta)
    }

    fun textOrHex(p: ByteArray?): String {
        if (p == null || p.isEmpty()) return ""
        val printable = p.all { val c = it.toInt() and 0xFF; c in 32..126 || c == 10 || c == 13 || c == 9 || c >= 0x80 }
        return if (printable) {
            try {
                val s = String(p, Charsets.UTF_8)
                if (s.contains('\uFFFD')) Hex.encode(p, " ") else s
            } catch (e: Exception) { Hex.encode(p, " ") }
        } else Hex.encode(p, " ")
    }

    fun summary(msg: NdefMessage?): String {
        if (msg == null || msg.records.isEmpty()) return ""
        return msg.records.joinToString(" · ") { r -> parseOne(r).body.replace('\n', ' ').take(60) }
    }
}

object RecordBuilder {
    const val WSC_MIME = "application/vnd.wfa.wsc"
    const val BT_OOB_MIME = "application/vnd.bluetooth.ep.oob"

    fun text(text: String, lang: String): NdefRecord {
        val l = lang.ifBlank { "en" }.toByteArray(Charsets.US_ASCII)
        val t = text.toByteArray(Charsets.UTF_8)
        val payload = ByteArray(1 + l.size + t.size)
        payload[0] = (l.size and 0x3F).toByte()
        System.arraycopy(l, 0, payload, 1, l.size)
        System.arraycopy(t, 0, payload, 1 + l.size, t.size)
        return NdefRecord(NdefRecord.TNF_WELL_KNOWN, NdefRecord.RTD_TEXT, ByteArray(0), payload)
    }

    fun uri(uri: String): NdefRecord = NdefRecord.createUri(uri.trim())

    fun phone(number: String): NdefRecord = uri("tel:" + number.replace(" ", ""))

    fun sms(number: String, body: String): NdefRecord {
        val base = "sms:" + number.replace(" ", "")
        return uri(if (body.isBlank()) base else base + "?body=" + Uri.encode(body))
    }

    fun email(to: String, subject: String, body: String): NdefRecord {
        val sb = StringBuilder("mailto:").append(to.trim())
        val params = ArrayList<String>()
        if (subject.isNotBlank()) params.add("subject=" + Uri.encode(subject))
        if (body.isNotBlank()) params.add("body=" + Uri.encode(body))
        if (params.isNotEmpty()) sb.append('?').append(params.joinToString("&"))
        return uri(sb.toString())
    }

    fun geo(lat: String, lon: String): NdefRecord = uri("geo:${lat.trim()},${lon.trim()}")

    fun app(pkg: String): NdefRecord = NdefRecord.createApplicationRecord(pkg.trim())

    fun mime(type: String, data: ByteArray): NdefRecord = NdefRecord.createMime(type.trim(), data)

    fun external(domain: String, type: String, data: ByteArray): NdefRecord = NdefRecord.createExternal(domain.trim(), type.trim(), data)

    fun raw(tnf: Short, type: ByteArray, payload: ByteArray): NdefRecord = NdefRecord(tnf, type, ByteArray(0), payload)

    fun smartPoster(uri: String, title: String, lang: String): NdefRecord {
        val inner = NdefMessage(arrayOf(uri(uri), text(title, lang)))
        return NdefRecord(NdefRecord.TNF_WELL_KNOWN, NdefRecord.RTD_SMART_POSTER, ByteArray(0), inner.toByteArray())
    }

    fun vcard(name: String, phone: String, email: String, org: String, url: String, note: String): NdefRecord {
        val sb = StringBuilder()
        sb.append("BEGIN:VCARD\r\nVERSION:3.0\r\n")
        sb.append("N:").append(name.trim().replace(";", "\\;")).append(";;;;\r\n")
        sb.append("FN:").append(name.trim()).append("\r\n")
        if (org.isNotBlank()) sb.append("ORG:").append(org.trim()).append("\r\n")
        if (phone.isNotBlank()) sb.append("TEL;TYPE=CELL:").append(phone.trim()).append("\r\n")
        if (email.isNotBlank()) sb.append("EMAIL:").append(email.trim()).append("\r\n")
        if (url.isNotBlank()) sb.append("URL:").append(url.trim()).append("\r\n")
        if (note.isNotBlank()) sb.append("NOTE:").append(note.trim().replace("\n", "\\n")).append("\r\n")
        sb.append("END:VCARD\r\n")
        return mime("text/vcard", sb.toString().toByteArray(Charsets.UTF_8))
    }

    /** auth: "OPEN", "WPA2", "WPA", "WEP", "MIXED" */
    fun wifi(ssid: String, password: String, auth: String): NdefRecord {
        val (authType, encType) = when (auth) {
            "OPEN" -> 0x0001 to 0x0001
            "WEP" -> 0x0001 to 0x0002
            "WPA" -> 0x0002 to 0x0004
            "MIXED" -> 0x0022 to 0x000C
            else -> 0x0020 to 0x0008
        }
        val cred = ByteArrayOutputStream()
        cred.write(tlv(0x1026, byteArrayOf(1)))
        cred.write(tlv(0x1045, ssid.toByteArray(Charsets.UTF_8)))
        cred.write(tlv(0x1003, byteArrayOf((authType shr 8).toByte(), authType.toByte())))
        cred.write(tlv(0x100F, byteArrayOf((encType shr 8).toByte(), encType.toByte())))
        cred.write(tlv(0x1027, password.toByteArray(Charsets.UTF_8)))
        cred.write(tlv(0x1020, ByteArray(6) { 0xFF.toByte() }))
        val payload = ByteArrayOutputStream()
        payload.write(tlv(0x100E, cred.toByteArray()))
        return mime(WSC_MIME, payload.toByteArray())
    }

    private fun tlv(type: Int, value: ByteArray): ByteArray {
        val out = ByteArray(4 + value.size)
        out[0] = (type shr 8).toByte(); out[1] = type.toByte()
        out[2] = (value.size shr 8).toByte(); out[3] = value.size.toByte()
        System.arraycopy(value, 0, out, 4, value.size)
        return out
    }

    fun bluetooth(mac: String, name: String): NdefRecord {
        val macBytes = Hex.decode(mac.replace(":", "").replace("-", ""))
        require(macBytes.size == 6) { "MAC must be 6 bytes" }
        val nameBytes = name.trim().toByteArray(Charsets.UTF_8)
        val eir = if (nameBytes.isNotEmpty()) byteArrayOf((nameBytes.size + 1).toByte(), 0x09) + nameBytes else ByteArray(0)
        val total = 2 + 6 + eir.size
        val out = ByteArray(total)
        out[0] = total.toByte(); out[1] = (total shr 8).toByte()
        for (i in 0 until 6) out[2 + i] = macBytes[5 - i]
        System.arraycopy(eir, 0, out, 8, eir.size)
        return mime(BT_OOB_MIME, out)
    }

    fun emptyMessage(): NdefMessage = NdefMessage(NdefRecord(NdefRecord.TNF_EMPTY, null, null, null))

    fun fromRecords(records: List<NdefRecord>): NdefMessage = NdefMessage(records.toTypedArray())
}

fun ByteArray.toUtf8(): String = String(this, Charset.forName("UTF-8"))
