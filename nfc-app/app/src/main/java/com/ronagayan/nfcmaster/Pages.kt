package com.ronagayan.nfcmaster

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.nfc.NdefMessage
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

private fun pulse(view: View): AnimatorSet {
    val sx = ObjectAnimator.ofFloat(view, View.SCALE_X, 0.85f, 1.12f)
    val sy = ObjectAnimator.ofFloat(view, View.SCALE_Y, 0.85f, 1.12f)
    val a = ObjectAnimator.ofFloat(view, View.ALPHA, 0.9f, 0.05f)
    for (o in listOf(sx, sy, a)) { o.repeatCount = ValueAnimator.INFINITE; o.repeatMode = ValueAnimator.RESTART; o.duration = 1500 }
    return AnimatorSet().apply { playTogether(sx, sy, a); start() }
}

private fun infoRow(ctx: Context, label: String, value: String): View {
    val row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, Ui.dp(ctx, 5), 0, Ui.dp(ctx, 5)) }
    val l = TextView(ctx).apply {
        text = label; setTextAppearance(R.style.Caption)
        layoutParams = LinearLayout.LayoutParams(Ui.dp(ctx, 120), LinearLayout.LayoutParams.WRAP_CONTENT)
    }
    val v = TextView(ctx).apply {
        text = value; setTextAppearance(R.style.Body); setTextIsSelectable(true)
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }
    row.addView(l); row.addView(v)
    return row
}

fun card(ctx: Context, title: CharSequence?, hint: CharSequence? = null): LinearLayout {
    val c = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundResource(R.drawable.bg_card)
        val p = Ui.dp(ctx, 16); setPadding(p, p, p, p)
        elevation = Ui.dp(ctx, 1).toFloat()
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = Ui.dp(ctx, 12) }
    }
    if (title != null) c.addView(TextView(ctx).apply { text = title; setTextAppearance(R.style.CardTitle) })
    if (hint != null) c.addView(TextView(ctx).apply { text = hint; setTextAppearance(R.style.Caption); setPadding(0, Ui.dp(ctx, 2), 0, Ui.dp(ctx, 4)) })
    return c
}

// =============================================================================================

class ReadPage(private val act: MainActivity) {
    private val status: TextView = act.findViewById(R.id.read_nfc_status)
    private val idle: View = act.findViewById(R.id.read_idle_card)
    private val results: View = act.findViewById(R.id.read_results)
    private val chip: TextView = act.findViewById(R.id.read_tag_type_chip)
    private val infoRows: LinearLayout = act.findViewById(R.id.read_info_rows)
    private val records: LinearLayout = act.findViewById(R.id.read_records)
    private val ndefSummary: TextView = act.findViewById(R.id.read_ndef_summary)
    private val dumpCard: View = act.findViewById(R.id.read_dump_card)
    private val dump: TextView = act.findViewById(R.id.read_dump)
    private val enableBtn: Button = act.findViewById(R.id.read_enable_nfc)
    private var details: TagDetails? = null

    init {
        pulse(act.findViewById(R.id.read_pulse))
        enableBtn.setOnClickListener { act.openNfcSettings() }
        act.findViewById<View>(R.id.read_again).setOnClickListener { reset() }
        act.findViewById<View>(R.id.read_copy_uid).setOnClickListener { details?.let { Ui.copy(act, it.uid) } }
        act.findViewById<View>(R.id.read_share).setOnClickListener { details?.let { Ui.share(act, TagOps.describe(act, it), act.getString(R.string.tag_info)) } }
        act.findViewById<View>(R.id.read_clone).setOnClickListener {
            val msg = details?.message
            if (msg == null || !details!!.hasNdef) { Ui.toast(act, R.string.no_last_scan); return@setOnClickListener }
            act.startOp(TagOp.Write(msg, false), act.getString(R.string.clone_to_tag), act.getString(R.string.approach_tag_write))
        }
        act.findViewById<View>(R.id.read_emulate).setOnClickListener {
            val msg = details?.message
            if (msg == null || !details!!.hasNdef) { Ui.toast(act, R.string.no_last_scan); return@setOnClickListener }
            act.emulatePage.setMessage(msg)
            act.selectTab(MainActivity.TAB_EMULATE)
        }
    }

    fun setStatus(text: String, showEnable: Boolean) {
        status.text = text
        enableBtn.visibility = if (showEnable) View.VISIBLE else View.GONE
    }

    fun reset() {
        details = null
        results.visibility = View.GONE
        idle.visibility = View.VISIBLE
    }

    fun show(d: TagDetails) {
        details = d
        idle.visibility = View.GONE
        results.visibility = View.VISIBLE
        chip.text = act.getString(d.tagTypeRes)
        infoRows.removeAllViews()
        infoRows.addView(infoRow(act, act.getString(R.string.i_uid), d.uid))
        d.chip?.let { infoRows.addView(infoRow(act, act.getString(R.string.i_chip), it)) }
        d.manufacturer?.let { infoRows.addView(infoRow(act, act.getString(R.string.i_manufacturer), it)) }
        infoRows.addView(infoRow(act, act.getString(R.string.i_techs), d.techs.joinToString(", ")))
        d.ndefType?.let { infoRows.addView(infoRow(act, act.getString(R.string.i_ndef_type), it)) }
        if (d.maxSize != null) infoRows.addView(infoRow(act, act.getString(R.string.i_size), "${d.ndefSize ?: 0} / ${d.maxSize} B"))
        d.writable?.let { infoRows.addView(infoRow(act, act.getString(R.string.i_writable), act.getString(if (it) R.string.yes else R.string.no))) }
        d.canLock?.let { infoRows.addView(infoRow(act, act.getString(R.string.i_can_lock), act.getString(if (it) R.string.yes else R.string.no))) }
        for ((k, v) in d.extras) infoRows.addView(infoRow(act, act.getString(k), v))

        records.removeAllViews()
        val msg = d.message
        if (msg == null || !d.hasNdef) {
            ndefSummary.text = act.getString(R.string.no_ndef)
        } else {
            ndefSummary.text = act.getString(R.string.records_count, msg.records.size, msg.toByteArray().size)
            msg.records.forEachIndexed { i, r ->
                RecordViews.bind(act, records, r, i, listOf(act.getString(R.string.share) to { Ui.share(act, RecordViews.fullText(act, NdefParser.parseOne(r))) }))
            }
        }
        if (d.dump.isNullOrBlank()) {
            dumpCard.visibility = View.GONE
        } else {
            dumpCard.visibility = View.VISIBLE
            dump.text = d.dump
        }
    }
}

// =============================================================================================

class WritePage(private val act: MainActivity) {
    val composer = RecordComposer(act, act.findViewById(R.id.write_records), act.findViewById(R.id.write_empty), act.findViewById(R.id.write_size))
    private val lock: CheckBox = act.findViewById(R.id.write_lock)
    private val bulk: CheckBox = act.findViewById(R.id.write_bulk)

    init {
        composer.render()
        act.findViewById<View>(R.id.write_add).setOnClickListener { composer.addViaPicker() }
        act.findViewById<View>(R.id.write_go).setOnClickListener { write() }
        act.findViewById<View>(R.id.op_erase).setOnClickListener {
            Forms.confirm(act, act.getString(R.string.op_erase), act.getString(R.string.erase_confirm)) {
                act.startOp(TagOp.Erase, act.getString(R.string.op_erase), act.getString(R.string.approach_tag_write), bulk.isChecked)
            }
        }
        act.findViewById<View>(R.id.op_format).setOnClickListener {
            Forms.confirm(act, act.getString(R.string.op_format), act.getString(R.string.format_confirm)) {
                act.startOp(TagOp.Format, act.getString(R.string.op_format), act.getString(R.string.approach_tag_write), bulk.isChecked)
            }
        }
        act.findViewById<View>(R.id.op_lock).setOnClickListener {
            Forms.confirm(act, act.getString(R.string.lock_confirm_title), act.getString(R.string.lock_confirm_body), R.string.op_lock) {
                act.startOp(TagOp.Lock, act.getString(R.string.op_lock), act.getString(R.string.approach_tag_write), bulk.isChecked)
            }
        }
        act.findViewById<View>(R.id.op_clone).setOnClickListener {
            val d = act.lastDetails
            if (d?.message == null || !d.hasNdef) { Ui.toast(act, R.string.no_last_scan); return@setOnClickListener }
            composer.set(d.message.records.toList())
            Ui.toast(act, act.getString(R.string.records_count, d.message.records.size, d.message.toByteArray().size))
        }
    }

    private fun write() {
        val msg = composer.message()
        if (msg == null) { Ui.toast(act, R.string.nothing_to_write); return }
        val go = { act.startOp(TagOp.Write(msg, lock.isChecked), act.getString(R.string.write_to_tag), act.getString(R.string.approach_tag_write), bulk.isChecked) }
        if (lock.isChecked) Forms.confirm(act, act.getString(R.string.lock_confirm_title), act.getString(R.string.lock_confirm_body), R.string.write_to_tag) { go() } else go()
    }
}

// =============================================================================================

class EmulatePage(private val act: MainActivity) {
    private val statusText: TextView = act.findViewById(R.id.emu_status)
    private val statusDetail: TextView = act.findViewById(R.id.emu_status_detail)
    private val toggle: Button = act.findViewById(R.id.emu_toggle)
    private val writable: CheckBox = act.findViewById(R.id.emu_writable)
    private val log: TextView = act.findViewById(R.id.emu_log)
    private val stats: TextView = act.findViewById(R.id.emu_stats)
    private val pulseView: View = act.findViewById(R.id.emu_pulse)
    private var anim: AnimatorSet? = null
    private var syncing = false

    val composer = RecordComposer(act, act.findViewById(R.id.emu_records), act.findViewById(R.id.emu_empty), act.findViewById(R.id.emu_size)) { onContentChanged() }

    private val listener: (String, String?) -> Unit = { event, detail ->
        when (event) {
            Emulation.EVT_RECEIVED -> {
                Emulation.message?.let { syncing = true; composer.set(it.records.toList()); syncing = false }
                Ui.toast(act, act.getString(R.string.emu_received) + (if (detail.isNullOrEmpty()) "" else ": $detail"))
                Feedback.scanned(act)
                refresh()
            }
            Emulation.EVT_READ -> { Feedback.scanned(act); refresh() }
            else -> refresh()
        }
    }

    init {
        Emulation.load(act)
        syncing = true
        Emulation.message?.let { composer.set(it.records.toList()) } ?: composer.render()
        writable.isChecked = Emulation.writable
        syncing = false
        toggle.setOnClickListener { toggleEmulation() }
        writable.setOnCheckedChangeListener { _, _ -> onContentChanged() }
        act.findViewById<View>(R.id.emu_add).setOnClickListener { composer.addViaPicker() }
        act.findViewById<View>(R.id.emu_use_last).setOnClickListener {
            val d = act.lastDetails
            if (d?.message == null || !d.hasNdef) { Ui.toast(act, R.string.no_last_scan); return@setOnClickListener }
            setMessage(d.message)
        }
        act.findViewById<View>(R.id.emu_clear_log).setOnClickListener { Emulation.clearLog() }
    }

    fun setMessage(msg: NdefMessage) {
        composer.set(msg.records.toList())
    }

    private fun onContentChanged() {
        if (syncing) return
        Emulation.setContent(act, composer.message(), writable.isChecked)
    }

    private fun toggleEmulation() {
        if (!act.hasHce()) { Ui.toast(act, R.string.hce_unsupported); return }
        if (act.nfc == null) { Ui.toast(act, R.string.nfc_unavailable); return }
        if (act.nfc?.isEnabled != true) { Ui.toast(act, R.string.nfc_disabled); act.openNfcSettings(); return }
        if (Emulation.enabled) {
            Emulation.setEnabled(act, false)
        } else {
            if (composer.records.isEmpty() && !writable.isChecked) { Ui.toast(act, R.string.emu_need_content); return }
            Emulation.setContent(act, composer.message(), writable.isChecked)
            Emulation.setEnabled(act, true)
            Thread { History.add(act, HistoryEntry.fromMessage(act, History.KIND_EMULATED, composer.message(), null, "HCE")) }.start()
        }
        act.selectTab(MainActivity.TAB_EMULATE)
        refresh()
    }

    fun onResume() {
        Emulation.listeners.add(listener)
        refresh()
    }

    fun onPause() {
        Emulation.listeners.remove(listener)
    }

    fun refresh() {
        val on = Emulation.enabled
        val supported = act.hasHce()
        statusText.text = act.getString(if (on) R.string.emu_on else R.string.emu_off)
        statusDetail.text = when {
            !supported -> act.getString(R.string.hce_unsupported)
            on -> act.getString(R.string.emu_on_detail)
            else -> act.getString(R.string.emu_off_detail)
        }
        toggle.text = act.getString(if (on) R.string.stop_emulation else R.string.start_emulation)
        toggle.isEnabled = supported
        stats.text = act.getString(R.string.emu_stats, Emulation.readCount, Emulation.writeCount)
        log.text = Emulation.logText()
        if (on && anim == null) { pulseView.visibility = View.VISIBLE; anim = pulse(pulseView) }
        if (!on && anim != null) { anim?.cancel(); anim = null; pulseView.alpha = 0.35f; pulseView.scaleX = 1f; pulseView.scaleY = 1f }
        if (!on && anim == null) pulseView.alpha = 0.35f
    }
}

// =============================================================================================

class HistoryPage(private val act: MainActivity) {
    private val list: LinearLayout = act.findViewById(R.id.history_list)
    private val empty: View = act.findViewById(R.id.history_empty)
    private val search: EditText = act.findViewById(R.id.history_search)

    init {
        search.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) { refresh() }
        })
        act.findViewById<View>(R.id.history_clear).setOnClickListener {
            Forms.confirm(act, act.getString(R.string.clear_history), act.getString(R.string.clear_history_confirm), R.string.delete) {
                History.clear(act); refresh(); Ui.toast(act, R.string.history_cleared)
            }
        }
        act.findViewById<View>(R.id.history_export).setOnClickListener {
            val name = History.exportToDownloads(act)
            if (name != null) Ui.toast(act, act.getString(R.string.history_exported, name))
            else Ui.share(act, History.exportText(act), "nfc_history.json")
        }
    }

    fun refresh() {
        val q = search.text.toString().trim().lowercase()
        val entries = History.all(act).filter { q.isEmpty() || it.summary.lowercase().contains(q) || (it.uid ?: "").lowercase().contains(q) || (it.info ?: "").lowercase().contains(q) }
        list.removeAllViews()
        empty.visibility = if (entries.isEmpty()) View.VISIBLE else View.GONE
        for (e in entries.take(300)) list.addView(itemView(e))
    }

    private fun itemView(e: HistoryEntry): View {
        val c = card(act, null)
        val header = LinearLayout(act).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        header.addView(TextView(act).apply {
            text = act.getString(e.kindRes())
            setBackgroundResource(if (e.kind == History.KIND_READ) R.drawable.bg_chip_primary else R.drawable.bg_chip)
            setTextColor(act.getColor(if (e.kind == History.KIND_READ) R.color.on_primary else R.color.primary))
            textSize = 12f; setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(Ui.dp(act, 10), Ui.dp(act, 3), Ui.dp(act, 10), Ui.dp(act, 3))
        })
        header.addView(TextView(act).apply {
            text = e.timeText(); setTextAppearance(R.style.Caption)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = Ui.dp(act, 8) }
        })
        c.addView(header)
        c.addView(TextView(act).apply { text = e.summary; setTextAppearance(R.style.Body); setPadding(0, Ui.dp(act, 8), 0, 0); maxLines = 3 })
        if (!e.uid.isNullOrEmpty()) c.addView(TextView(act).apply { text = "UID ${e.uid}" + (if (e.techs.isNullOrEmpty()) "" else " · ${e.techs}"); setTextAppearance(R.style.Caption); setPadding(0, Ui.dp(act, 4), 0, 0) })
        c.setOnClickListener { showActions(e) }
        return c
    }

    private fun showActions(e: HistoryEntry) {
        val msg = e.message()
        val hasMsg = msg != null && msg.records.isNotEmpty()
        val items = ArrayList<Pair<String, () -> Unit>>()
        items.add(act.getString(R.string.details) to { Forms.showText(act, e.timeText(), e.info ?: (e.summary + (if (hasMsg) "\n\n" + NdefParser.parseMessage(msg).joinToString("\n") { "[" + act.getString(it.typeRes) + "] " + RecordViews.fullText(act, it) } else "")), mono = false) })
        if (hasMsg) {
            items.add(act.getString(R.string.write_again) to { act.startOp(TagOp.Write(msg!!, false), act.getString(R.string.write_to_tag), act.getString(R.string.approach_tag_write)) })
            items.add(act.getString(R.string.tab_emulate) to { act.emulatePage.setMessage(msg!!); act.selectTab(MainActivity.TAB_EMULATE) })
            items.add(act.getString(R.string.add_record) to { act.writePage.composer.set(msg!!.records.toList()); act.selectTab(MainActivity.TAB_WRITE) })
            NdefParser.parseMessage(msg).firstOrNull { it.actionUri != null }?.actionUri?.let { uri -> items.add(act.getString(R.string.open) to { RecordViews.open(act, uri) }) }
        }
        items.add(act.getString(R.string.share) to { Ui.share(act, e.info ?: e.summary) })
        items.add(act.getString(R.string.delete) to { History.delete(act, e.id); refresh() })
        Forms.choose(act, e.summary.take(80), items.map { it.first }) { i -> items[i].second() }
    }
}

// =============================================================================================

class ToolsPage(private val act: MainActivity) {
    private val root: LinearLayout = act.findViewById(R.id.tools_root)
    private lateinit var statusText: TextView

    init { build() }

    private fun build() {
        // NFC status
        val status = card(act, act.getString(R.string.nfc_status))
        statusText = TextView(act).apply { setTextAppearance(R.style.Body); setPadding(0, Ui.dp(act, 6), 0, 0) }
        status.addView(statusText)
        status.addView(Buttons.wide(act, act.getString(R.string.open_nfc_settings)) { act.openNfcSettings() })
        root.addView(status)

        // Identify
        val identify = card(act, act.getString(R.string.tool_tag_info), act.getString(R.string.tool_tag_info_hint))
        identify.addView(Buttons.wide(act, act.getString(R.string.tool_tag_info), primary = true) { act.startOp(TagOp.Info, act.getString(R.string.tool_tag_info), act.getString(R.string.approach_tag_read)) })
        root.addView(identify)

        // NTAG tools
        val ntag = card(act, act.getString(R.string.ntag_tools), act.getString(R.string.ntag_tools_hint))
        ntag.addView(Buttons.wide(act, act.getString(R.string.ntag_version)) { act.startOp(TagOp.NtagVersion, act.getString(R.string.ntag_version), act.getString(R.string.approach_tag_read)) })
        ntag.addView(Buttons.wide(act, act.getString(R.string.ntag_dump)) { act.startOp(TagOp.NtagDump, act.getString(R.string.ntag_dump), act.getString(R.string.approach_tag_read)) })
        ntag.addView(Buttons.wide(act, act.getString(R.string.ntag_signature)) { act.startOp(TagOp.NtagSignature, act.getString(R.string.ntag_signature), act.getString(R.string.approach_tag_read)) })
        ntag.addView(Buttons.wide(act, act.getString(R.string.ntag_counter)) { act.startOp(TagOp.NtagCounter, act.getString(R.string.ntag_counter), act.getString(R.string.approach_tag_read)) })
        ntag.addView(Buttons.wide(act, act.getString(R.string.ntag_set_password)) { setPasswordForm() })
        ntag.addView(Buttons.wide(act, act.getString(R.string.ntag_remove_password), danger = true) { removePasswordForm() })
        root.addView(ntag)

        // Classic / NfcV
        val classic = card(act, act.getString(R.string.classic_tools))
        classic.addView(Buttons.wide(act, act.getString(R.string.classic_dump)) { act.startOp(TagOp.ClassicDump, act.getString(R.string.classic_dump), act.getString(R.string.approach_tag_read)) })
        root.addView(classic)
        val nfcv = card(act, act.getString(R.string.nfcv_tools))
        nfcv.addView(Buttons.wide(act, act.getString(R.string.nfcv_dump)) { act.startOp(TagOp.NfcVDump, act.getString(R.string.nfcv_dump), act.getString(R.string.approach_tag_read)) })
        root.addView(nfcv)

        // APDU console
        val apdu = card(act, act.getString(R.string.apdu_console), act.getString(R.string.apdu_console_hint))
        apdu.addView(Buttons.wide(act, act.getString(R.string.send_command), primary = true) { consoleForm() })
        root.addView(apdu)

        // Settings
        val settings = card(act, act.getString(R.string.settings))
        for ((key, res) in listOf(
            Prefs.VIBRATE to R.string.setting_vibrate, Prefs.SOUND to R.string.setting_sound, Prefs.AUTO_OPEN to R.string.setting_auto_open,
            Prefs.KEEP_SCREEN to R.string.setting_keep_screen, Prefs.READ_DUMP to R.string.setting_read_dump,
            Prefs.SKIP_NDEF to R.string.setting_skip_ndef, Prefs.NO_SOUNDS to R.string.setting_no_platform_sounds
        )) {
            settings.addView(CheckBox(act).apply {
                text = act.getString(res)
                isChecked = Prefs.bool(act, key, Prefs.defaultFor(key))
                setOnCheckedChangeListener { _, checked ->
                    Prefs.set(act, key, checked)
                    if (key == Prefs.KEEP_SCREEN) act.applyKeepScreen()
                    if (key == Prefs.SKIP_NDEF || key == Prefs.NO_SOUNDS) act.updateReaderMode()
                }
            })
        }
        root.addView(settings)

        // About
        val about = card(act, act.getString(R.string.about))
        val version = try { act.packageManager.getPackageInfo(act.packageName, 0).versionName } catch (e: Exception) { "" }
        about.addView(TextView(act).apply { text = act.getString(R.string.app_name) + " " + version + "\n\n" + act.getString(R.string.about_body); setTextAppearance(R.style.Body); setPadding(0, Ui.dp(act, 6), 0, 0) })
        root.addView(about)
    }

    fun refresh() {
        statusText.text = act.nfcStatusText() + "\n" + act.getString(R.string.hce_supported, act.getString(if (act.hasHce()) R.string.yes else R.string.no))
    }

    private fun consoleForm() {
        Forms.show(act, act.getString(R.string.apdu_console), listOf(
            Field("tech", R.string.f_tech, Field.CHOICE, listOf("NfcA" to "NfcA (ISO 14443-3A)", "IsoDep" to "IsoDep (ISO 14443-4 APDU)", "NfcV" to "NfcV (ISO 15693)", "NfcB" to "NfcB", "NfcF" to "NfcF (FeliCa)"), default = "NfcA"),
            Field("cmd", R.string.f_apdu_hex, default = "60")
        ), R.string.send_command) { v ->
            val cmd = try { Hex.decode(v["cmd"]!!) } catch (e: Exception) { Ui.toast(act, R.string.invalid_input); return@show false }
            if (cmd.isEmpty()) { Ui.toast(act, R.string.invalid_input); return@show false }
            act.startOp(TagOp.Transceive(v["tech"]!!, cmd), act.getString(R.string.apdu_console), act.getString(R.string.approach_tag_read))
            true
        }
    }

    private fun setPasswordForm() {
        Forms.show(act, act.getString(R.string.ntag_set_password), listOf(
            Field("pwd", R.string.f_pwd_hex),
            Field("pack", R.string.f_pack_hex, default = "0000"),
            Field("start", R.string.f_start_page, default = "04"),
            Field("read", R.string.f_protect_read, Field.CHECK, default = "false")
        )) { v ->
            val pwd = try { Hex.decode(v["pwd"]!!) } catch (e: Exception) { ByteArray(0) }
            val pack = try { Hex.decode(v["pack"]!!) } catch (e: Exception) { ByteArray(0) }
            val start = v["start"]!!.trim().toIntOrNull(16)
            if (pwd.size != 4 || pack.size != 2 || start == null || start !in 0..0xFF) { Ui.toast(act, R.string.invalid_input); return@show false }
            Forms.confirm(act, act.getString(R.string.ntag_set_password), act.getString(R.string.confirm_set_password)) {
                act.startOp(TagOp.NtagSetPassword(pwd, pack, v["read"] == "true", start), act.getString(R.string.ntag_set_password), act.getString(R.string.approach_tag_write))
            }
            true
        }
    }

    private fun removePasswordForm() {
        Forms.show(act, act.getString(R.string.ntag_remove_password), listOf(Field("pwd", R.string.f_pwd_hex))) { v ->
            val pwd = try { Hex.decode(v["pwd"]!!) } catch (e: Exception) { ByteArray(0) }
            if (pwd.size != 4) { Ui.toast(act, R.string.invalid_input); return@show false }
            act.startOp(TagOp.NtagRemovePassword(pwd), act.getString(R.string.ntag_remove_password), act.getString(R.string.approach_tag_write))
            true
        }
    }
}
