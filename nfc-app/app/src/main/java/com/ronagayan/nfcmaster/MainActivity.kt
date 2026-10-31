package com.ronagayan.nfcmaster

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.Activity
import android.app.AlertDialog
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.cardemulation.CardEmulation
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.Executors

class MainActivity : Activity() {

    companion object {
        const val TAB_READ = 0
        const val TAB_WRITE = 1
        const val TAB_EMULATE = 2
        const val TAB_HISTORY = 3
        const val TAB_TOOLS = 4
    }

    var nfc: NfcAdapter? = null
    val handler = Handler(Looper.getMainLooper())
    private val executor = Executors.newSingleThreadExecutor()

    @Volatile var pendingOp: TagOp? = null
    private var scanDialog: ScanDialog? = null
    var lastDetails: TagDetails? = null
    var currentTab = TAB_READ
    var readerActive = false

    lateinit var readPage: ReadPage
    lateinit var writePage: WritePage
    lateinit var emulatePage: EmulatePage
    lateinit var historyPage: HistoryPage
    lateinit var toolsPage: ToolsPage

    private lateinit var pageViews: List<View>
    private lateinit var navItems: List<Triple<View, ImageView, TextView>>

    private val adapterReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            updateNfcState()
            updateReaderMode()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        nfc = NfcAdapter.getDefaultAdapter(this)
        Emulation.load(this)

        pageViews = listOf(findViewById(R.id.page_read), findViewById(R.id.page_write), findViewById(R.id.page_emulate), findViewById(R.id.page_history), findViewById(R.id.page_tools))
        navItems = listOf(
            Triple(findViewById(R.id.nav_read), findViewById(R.id.nav_read_icon), findViewById(R.id.nav_read_label)),
            Triple(findViewById(R.id.nav_write), findViewById(R.id.nav_write_icon), findViewById(R.id.nav_write_label)),
            Triple(findViewById(R.id.nav_emulate), findViewById(R.id.nav_emulate_icon), findViewById(R.id.nav_emulate_label)),
            Triple(findViewById(R.id.nav_history), findViewById(R.id.nav_history_icon), findViewById(R.id.nav_history_label)),
            Triple(findViewById(R.id.nav_tools), findViewById(R.id.nav_tools_icon), findViewById(R.id.nav_tools_label))
        )
        navItems.forEachIndexed { i, (v, _, _) -> v.setOnClickListener { selectTab(i) } }

        readPage = ReadPage(this)
        writePage = WritePage(this)
        emulatePage = EmulatePage(this)
        historyPage = HistoryPage(this)
        toolsPage = ToolsPage(this)

        selectTab(savedInstanceState?.getInt("tab") ?: TAB_READ)
        handleIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putInt("tab", currentTab)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action = intent?.action ?: return
        if (action == NfcAdapter.ACTION_NDEF_DISCOVERED || action == NfcAdapter.ACTION_TECH_DISCOVERED || action == NfcAdapter.ACTION_TAG_DISCOVERED) {
            @Suppress("DEPRECATION")
            val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            if (tag != null) {
                selectTab(TAB_READ)
                onTag(tag)
            }
            intent.action = null
        }
    }

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(NfcAdapter.ACTION_ADAPTER_STATE_CHANGED)
        if (android.os.Build.VERSION.SDK_INT >= 33) registerReceiver(adapterReceiver, filter, Context.RECEIVER_EXPORTED)
        else registerReceiver(adapterReceiver, filter)
        updateNfcState()
        updateReaderMode()
        applyKeepScreen()
        emulatePage.onResume()
        historyPage.refresh()
        toolsPage.refresh()
    }

    override fun onPause() {
        super.onPause()
        try { unregisterReceiver(adapterReceiver) } catch (_: Exception) {}
        disableReader()
        emulatePage.onPause()
    }

    fun applyKeepScreen() {
        if (Prefs.bool(this, Prefs.KEEP_SCREEN, true)) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    fun selectTab(i: Int) {
        currentTab = i
        pageViews.forEachIndexed { idx, v -> v.visibility = if (idx == i) View.VISIBLE else View.GONE }
        navItems.forEachIndexed { idx, (_, icon, label) ->
            val color = getColor(if (idx == i) R.color.nav_active else R.color.nav_inactive)
            icon.imageTintList = android.content.res.ColorStateList.valueOf(color)
            label.setTextColor(color)
            label.setTypeface(null, if (idx == i) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
        }
        updateReaderMode()
        updatePreferredService()
        if (i == TAB_HISTORY) historyPage.refresh()
        if (i == TAB_EMULATE) emulatePage.refresh()
        if (i == TAB_TOOLS) toolsPage.refresh()
    }

    // ---- NFC state -------------------------------------------------------------------------

    fun hasHce(): Boolean = packageManager.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)

    fun nfcStatusText(): String = when {
        nfc == null -> getString(R.string.nfc_unavailable)
        !nfc!!.isEnabled -> getString(R.string.nfc_disabled)
        currentTab == TAB_EMULATE -> getString(R.string.nfc_paused)
        else -> getString(R.string.nfc_ready)
    }

    fun updateNfcState() {
        readPage.setStatus(nfcStatusText(), nfc != null && !nfc!!.isEnabled)
        emulatePage.refresh()
    }

    fun openNfcSettings() {
        try {
            startActivity(Intent(Settings.ACTION_NFC_SETTINGS))
        } catch (e: Exception) {
            try { startActivity(Intent(Settings.ACTION_WIRELESS_SETTINGS)) } catch (_: Exception) {}
        }
    }

    private val readerCallback = NfcAdapter.ReaderCallback { tag -> onTag(tag) }

    fun updateReaderMode() {
        val adapter = nfc ?: return
        if (currentTab == TAB_EMULATE && pendingOp == null) {
            disableReader()
            return
        }
        if (!adapter.isEnabled) return
        var flags = NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V or NfcAdapter.FLAG_READER_NFC_BARCODE
        if (Prefs.bool(this, Prefs.SKIP_NDEF, false)) flags = flags or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
        if (Prefs.bool(this, Prefs.NO_SOUNDS, false)) flags = flags or NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS
        val extras = Bundle().apply { putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250) }
        try {
            adapter.enableReaderMode(this, readerCallback, flags, extras)
            readerActive = true
        } catch (_: Exception) {
        }
    }

    private fun disableReader() {
        if (!readerActive) return
        try { nfc?.disableReaderMode(this) } catch (_: Exception) {}
        readerActive = false
    }

    private fun updatePreferredService() {
        val adapter = nfc ?: return
        if (!hasHce()) return
        try {
            val ce = CardEmulation.getInstance(adapter)
            val cn = ComponentName(this, HceService::class.java)
            if (currentTab == TAB_EMULATE && Emulation.enabled) ce.setPreferredService(this, cn) else ce.unsetPreferredService(this)
        } catch (_: Exception) {
        }
    }

    // ---- tag handling ----------------------------------------------------------------------

    fun onTag(tag: Tag) {
        val op = pendingOp
        executor.execute {
            if (op == null) {
                val details = try {
                    TagReader.read(tag, Prefs.bool(this, Prefs.READ_DUMP, true))
                } catch (e: Exception) {
                    handler.post { Ui.toast(this, getString(R.string.read_failed, e.message ?: e.toString())) }
                    return@execute
                }
                History.add(this, HistoryEntry.fromDetails(this, details))
                handler.post {
                    Feedback.scanned(this)
                    lastDetails = details
                    if (currentTab != TAB_READ) selectTab(TAB_READ)
                    readPage.show(details)
                    if (Prefs.bool(this, Prefs.AUTO_OPEN, false)) {
                        val uri = NdefParser.parseMessage(details.message).firstOrNull { it.actionUri != null }?.actionUri
                        if (uri != null && (uri.startsWith("http://") || uri.startsWith("https://"))) RecordViews.open(this, uri)
                    }
                }
            } else {
                val result = TagOps.perform(this, tag, op)
                if (result.ok && op is TagOp.Write) {
                    val d = try { TagReader.read(tag, false) } catch (e: Exception) { null }
                    History.add(this, HistoryEntry.fromMessage(this, History.KIND_WRITE, op.message, d?.uid ?: Hex.encode(tag.id, ":"), d?.techs?.joinToString(", ")))
                }
                if (result.tagDetails != null) lastDetails = result.tagDetails
                handler.post {
                    Feedback.scanned(this)
                    scanDialog?.showResult(result)
                }
            }
        }
    }

    /** Starts a tag operation: shows the "touch a tag" dialog and performs [op] on the next tag. */
    fun startOp(op: TagOp, title: CharSequence, message: CharSequence, bulk: Boolean = false) {
        if (nfc == null) { Ui.toast(this, R.string.nfc_unavailable); return }
        if (!nfc!!.isEnabled) { Ui.toast(this, R.string.nfc_disabled); openNfcSettings(); return }
        pendingOp = op
        scanDialog?.dismissQuietly()
        scanDialog = ScanDialog(this, title, message, bulk).also { it.show() }
        updateReaderMode()
    }

    fun onScanDialogClosed() {
        pendingOp = null
        scanDialog = null
        updateReaderMode()
    }

    // ---- scan dialog -----------------------------------------------------------------------

    inner class ScanDialog(ctx: Context, title: CharSequence, message: CharSequence, private val bulk: Boolean) {
        private val view = LayoutInflater.from(ctx).inflate(R.layout.dialog_scan, null)
        private val dialog: AlertDialog
        private var anim: AnimatorSet? = null
        private var count = 0
        private var finished = false

        init {
            view.findViewById<TextView>(R.id.scan_title).text = title
            view.findViewById<TextView>(R.id.scan_message).text = message
            dialog = AlertDialog.Builder(ctx).setView(view).setNegativeButton(R.string.cancel, null).create()
            dialog.setOnDismissListener { stopAnim(); onScanDialogClosed() }
        }

        fun show() {
            dialog.show()
            startAnim()
        }

        fun dismissQuietly() {
            try { dialog.dismiss() } catch (_: Exception) {}
        }

        private fun startAnim() {
            val pulse = view.findViewById<View>(R.id.scan_pulse)
            val sx = ObjectAnimator.ofFloat(pulse, View.SCALE_X, 0.8f, 1.15f)
            val sy = ObjectAnimator.ofFloat(pulse, View.SCALE_Y, 0.8f, 1.15f)
            val a = ObjectAnimator.ofFloat(pulse, View.ALPHA, 1f, 0.1f)
            for (o in listOf(sx, sy, a)) { o.repeatCount = ValueAnimator.INFINITE; o.repeatMode = ValueAnimator.RESTART; o.duration = 1200 }
            anim = AnimatorSet().apply { playTogether(sx, sy, a); start() }
        }

        private fun stopAnim() { anim?.cancel(); anim = null }

        fun showResult(res: OpResult) {
            if (finished) return
            val result = view.findViewById<TextView>(R.id.scan_result)
            result.visibility = View.VISIBLE
            result.text = res.message
            result.setTextColor(getColor(if (res.ok) R.color.success else R.color.error))
            if (res.details != null) {
                finished = true
                pendingOp = null
                dismissQuietly()
                Forms.showText(this@MainActivity, res.message, res.details)
                return
            }
            if (bulk && res.ok) {
                count++
                val counter = view.findViewById<TextView>(R.id.scan_counter)
                counter.visibility = View.VISIBLE
                counter.text = getString(R.string.written_count, count)
                view.findViewById<TextView>(R.id.scan_message).text = getString(R.string.scan_another)
                return
            }
            finished = true
            pendingOp = null
            stopAnim()
            view.findViewById<View>(R.id.scan_pulse).visibility = View.INVISIBLE
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setText(R.string.done)
        }
    }
}
