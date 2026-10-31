package com.ronagayan.nfcmaster

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.text.InputType
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

object Buttons {
    fun small(ctx: Context, text: CharSequence, danger: Boolean = false, onClick: () -> Unit): Button {
        val b = Button(ctx)
        b.text = text
        b.isAllCaps = false
        b.textSize = 13f
        b.setBackgroundResource(if (danger) R.drawable.bg_btn_danger else R.drawable.bg_btn_secondary)
        b.setTextColor(ctx.getColor(if (danger) R.color.error else R.color.primary))
        b.minHeight = Ui.dp(ctx, 36)
        b.minimumHeight = Ui.dp(ctx, 36)
        b.setPadding(Ui.dp(ctx, 12), 0, Ui.dp(ctx, 12), 0)
        b.stateListAnimator = null
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        lp.marginEnd = Ui.dp(ctx, 6)
        b.layoutParams = lp
        b.setOnClickListener { onClick() }
        return b
    }

    fun wide(ctx: Context, text: CharSequence, primary: Boolean = false, danger: Boolean = false, onClick: () -> Unit): Button {
        val b = Button(ctx)
        b.text = text
        b.isAllCaps = false
        b.textSize = 14f
        b.setBackgroundResource(if (primary) R.drawable.bg_btn_primary else if (danger) R.drawable.bg_btn_danger else R.drawable.bg_btn_secondary)
        b.setTextColor(ctx.getColor(if (primary) R.color.on_primary else if (danger) R.color.error else R.color.primary))
        b.minHeight = Ui.dp(ctx, 44)
        b.minimumHeight = Ui.dp(ctx, 44)
        b.stateListAnimator = null
        val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        lp.topMargin = Ui.dp(ctx, 8)
        b.layoutParams = lp
        b.setOnClickListener { onClick() }
        return b
    }
}

object RecordViews {

    fun open(ctx: Context, uri: String) {
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            Ui.toast(ctx, R.string.no_app_for_link)
        }
    }

    fun fullText(ctx: Context, p: ParsedRecord): String {
        val sb = StringBuilder(p.body)
        for ((k, v) in p.details) {
            if (k == R.string.f_data && v == p.body) continue
            sb.append('\n').append(ctx.getString(k)).append(": ").append(v)
        }
        return sb.toString()
    }

    /** Inflates a record card into [parent]. [extraActions] are appended after the default open/copy actions. */
    fun bind(ctx: Context, parent: ViewGroup, record: NdefRecord, index: Int, extraActions: List<Pair<CharSequence, () -> Unit>> = emptyList(), danger: Set<CharSequence> = emptySet()): View {
        val v = LayoutInflater.from(ctx).inflate(R.layout.item_record, parent, false)
        val p = NdefParser.parseOne(record)
        v.findViewById<TextView>(R.id.rec_type).text = ctx.getString(p.typeRes)
        v.findViewById<TextView>(R.id.rec_meta).text = "#${index + 1} · ${p.meta}"
        val body = v.findViewById<TextView>(R.id.rec_body)
        val shownDetails = p.details.filter { !(it.first == R.string.f_data && p.typeKey == "vcard") }
        val text = StringBuilder(p.body)
        for ((k, value) in shownDetails) text.append('\n').append(ctx.getString(k)).append(": ").append(value)
        body.text = text.toString()
        val actions = v.findViewById<LinearLayout>(R.id.rec_actions)
        p.actionUri?.let { uri -> actions.addView(Buttons.small(ctx, ctx.getString(R.string.open)) { open(ctx, uri) }) }
        actions.addView(Buttons.small(ctx, ctx.getString(R.string.copy)) { Ui.copy(ctx, fullText(ctx, p)) })
        for ((label, action) in extraActions) actions.addView(Buttons.small(ctx, label, danger.contains(label)) { action() })
        parent.addView(v)
        return v
    }
}

/** Keeps a list of records and renders them into a container with remove buttons. */
class RecordComposer(private val ctx: Context, private val container: LinearLayout, private val emptyView: View, private val sizeView: TextView?, private val onChange: () -> Unit = {}) {
    val records = ArrayList<NdefRecord>()

    fun set(list: List<NdefRecord>) {
        records.clear(); records.addAll(list); render()
    }

    fun add(r: NdefRecord) {
        records.add(r); render()
    }

    fun clear() {
        records.clear(); render()
    }

    fun message(): NdefMessage? = if (records.isEmpty()) null else RecordBuilder.fromRecords(records)

    fun size(): Int = message()?.toByteArray()?.size ?: 0

    fun render() {
        container.removeAllViews()
        emptyView.visibility = if (records.isEmpty()) View.VISIBLE else View.GONE
        sizeView?.text = ctx.getString(R.string.message_size, size())
        records.forEachIndexed { i, r ->
            val remove = ctx.getString(R.string.remove)
            RecordViews.bind(ctx, container, r, i, listOf(remove to { records.removeAt(i); render() }), setOf(remove))
        }
        onChange()
    }

    fun addViaPicker() = RecordPicker.pick(ctx) { add(it) }
}

object RecordPicker {
    private val TYPES = listOf(
        R.string.rt_text, R.string.rt_uri, R.string.rt_phone, R.string.rt_sms, R.string.rt_email, R.string.rt_wifi,
        R.string.rt_contact, R.string.rt_geo, R.string.rt_app, R.string.rt_bluetooth, R.string.rt_smart_poster,
        R.string.rt_mime, R.string.rt_external, R.string.rt_raw
    )

    fun pick(ctx: Context, onRecord: (NdefRecord) -> Unit) {
        Forms.choose(ctx, ctx.getString(R.string.choose_record_type), TYPES.map { ctx.getString(it) }) { i -> form(ctx, TYPES[i], onRecord) }
    }

    private fun build(block: () -> NdefRecord, ctx: Context, onRecord: (NdefRecord) -> Unit): Boolean {
        return try {
            onRecord(block()); true
        } catch (e: Exception) {
            Ui.toast(ctx, ctx.getString(R.string.error_prefix, e.message ?: e.toString())); false
        }
    }

    fun form(ctx: Context, typeRes: Int, onRecord: (NdefRecord) -> Unit) {
        val title = ctx.getString(typeRes)
        val lang = java.util.Locale.getDefault().language.ifBlank { "en" }
        when (typeRes) {
            R.string.rt_text -> Forms.show(ctx, title, listOf(
                Field("text", R.string.f_text, multiline = true),
                Field("lang", R.string.f_language, default = lang, required = false)
            )) { v -> build({ RecordBuilder.text(v["text"]!!, v["lang"]!!) }, ctx, onRecord) }

            R.string.rt_uri -> Forms.show(ctx, title, listOf(Field("url", R.string.f_url, default = "https://", inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI))) { v ->
                build({ RecordBuilder.uri(v["url"]!!) }, ctx, onRecord)
            }

            R.string.rt_phone -> Forms.show(ctx, title, listOf(Field("phone", R.string.f_phone, inputType = InputType.TYPE_CLASS_PHONE))) { v ->
                build({ RecordBuilder.phone(v["phone"]!!) }, ctx, onRecord)
            }

            R.string.rt_sms -> Forms.show(ctx, title, listOf(
                Field("phone", R.string.f_phone, inputType = InputType.TYPE_CLASS_PHONE),
                Field("body", R.string.f_message, required = false, multiline = true)
            )) { v -> build({ RecordBuilder.sms(v["phone"]!!, v["body"]!!) }, ctx, onRecord) }

            R.string.rt_email -> Forms.show(ctx, title, listOf(
                Field("to", R.string.f_email, inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS),
                Field("subject", R.string.f_subject, required = false),
                Field("body", R.string.f_body, required = false, multiline = true)
            )) { v -> build({ RecordBuilder.email(v["to"]!!, v["subject"]!!, v["body"]!!) }, ctx, onRecord) }

            R.string.rt_wifi -> Forms.show(ctx, title, listOf(
                Field("ssid", R.string.f_ssid),
                Field("pass", R.string.f_password, required = false),
                Field("auth", R.string.f_auth, Field.CHOICE, listOf("WPA2" to "WPA2 / WPA3 Personal", "MIXED" to "WPA / WPA2 mixed", "WPA" to "WPA Personal", "WEP" to "WEP", "OPEN" to "Open (no password)"), default = "WPA2")
            )) { v -> build({ RecordBuilder.wifi(v["ssid"]!!, v["pass"]!!, v["auth"]!!) }, ctx, onRecord) }

            R.string.rt_contact -> Forms.show(ctx, title, listOf(
                Field("name", R.string.f_name, inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS),
                Field("phone", R.string.f_phone, inputType = InputType.TYPE_CLASS_PHONE, required = false),
                Field("email", R.string.f_email, inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, required = false),
                Field("org", R.string.f_org, required = false),
                Field("url", R.string.f_website, required = false, inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI),
                Field("note", R.string.f_note, required = false, multiline = true)
            )) { v -> build({ RecordBuilder.vcard(v["name"]!!, v["phone"]!!, v["email"]!!, v["org"]!!, v["url"]!!, v["note"]!!) }, ctx, onRecord) }

            R.string.rt_geo -> Forms.show(ctx, title, listOf(
                Field("lat", R.string.f_lat, inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL or InputType.TYPE_NUMBER_FLAG_SIGNED),
                Field("lon", R.string.f_lon, inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL or InputType.TYPE_NUMBER_FLAG_SIGNED)
            )) { v -> build({ RecordBuilder.geo(v["lat"]!!, v["lon"]!!) }, ctx, onRecord) }

            R.string.rt_app -> Forms.show(ctx, title, listOf(Field("pkg", R.string.f_package, default = "com."))) { v ->
                build({ RecordBuilder.app(v["pkg"]!!) }, ctx, onRecord)
            }

            R.string.rt_bluetooth -> Forms.show(ctx, title, listOf(
                Field("mac", R.string.f_mac),
                Field("name", R.string.f_device_name, required = false)
            )) { v -> build({ RecordBuilder.bluetooth(v["mac"]!!, v["name"]!!) }, ctx, onRecord) }

            R.string.rt_smart_poster -> Forms.show(ctx, title, listOf(
                Field("url", R.string.f_url, default = "https://", inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI),
                Field("title", R.string.f_title),
                Field("lang", R.string.f_language, default = lang, required = false)
            )) { v -> build({ RecordBuilder.smartPoster(v["url"]!!, v["title"]!!, v["lang"]!!) }, ctx, onRecord) }

            R.string.rt_mime -> Forms.show(ctx, title, listOf(
                Field("mime", R.string.f_mime, default = "text/plain"),
                Field("data", R.string.f_data, multiline = true)
            )) { v -> build({ RecordBuilder.mime(v["mime"]!!, v["data"]!!.toByteArray(Charsets.UTF_8)) }, ctx, onRecord) }

            R.string.rt_external -> Forms.show(ctx, title, listOf(
                Field("domain", R.string.f_domain),
                Field("type", R.string.f_type),
                Field("data", R.string.f_data, multiline = true, required = false)
            )) { v -> build({ RecordBuilder.external(v["domain"]!!, v["type"]!!, v["data"]!!.toByteArray(Charsets.UTF_8)) }, ctx, onRecord) }

            R.string.rt_raw -> Forms.show(ctx, title, listOf(
                Field("tnf", R.string.f_tnf, Field.CHOICE, listOf("1" to "Well known (1)", "2" to "MIME (2)", "3" to "Absolute URI (3)", "4" to "External (4)", "5" to "Unknown (5)"), default = "1"),
                Field("type", R.string.f_type_hex, required = false),
                Field("payload", R.string.f_payload_hex, required = false)
            )) { v ->
                build({
                    RecordBuilder.raw(v["tnf"]!!.toShort(), v["type"]!!.toByteArray(Charsets.US_ASCII), Hex.decode(v["payload"]!!))
                }, ctx, onRecord)
            }
        }
    }
}
