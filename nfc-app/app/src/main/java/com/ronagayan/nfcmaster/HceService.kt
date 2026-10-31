package com.ronagayan.nfcmaster

import android.nfc.NdefMessage
import android.nfc.cardemulation.HostApduService
import android.os.Bundle

/**
 * Emulates an NFC Forum Type 4 Tag (NDEF application, mapping version 2.0) so that any phone or
 * reader can read the emulated NDEF message, and optionally write a message back.
 */
class HceService : HostApduService() {

    companion object {
        private val AID_V2 = Hex.decode("D2760000850101")
        private val AID_V1 = Hex.decode("D2760000850100")
        private val SW_OK = byteArrayOf(0x90.toByte(), 0x00)
        private val SW_FILE_NOT_FOUND = byteArrayOf(0x6A, 0x82.toByte())
        private val SW_INS_NOT_SUPPORTED = byteArrayOf(0x6D, 0x00)
        private val SW_WRONG_LENGTH = byteArrayOf(0x67, 0x00)
        private val SW_WRONG_P1P2 = byteArrayOf(0x6B, 0x00)
        private val SW_SECURITY = byteArrayOf(0x69, 0x82.toByte())
        private val SW_CLA_NOT_SUPPORTED = byteArrayOf(0x6E, 0x00)
        private const val FILE_NONE = 0
        private const val FILE_CC = 1
        private const val FILE_NDEF = 2
        private const val MAX_NDEF_FILE = 0x7FFF
    }

    private var appSelected = false
    private var legacyAid = false
    private var selectedFile = FILE_NONE
    private var readCounted = false
    private var writeBuffer: ByteArray? = null
    private var writeTouched = false

    override fun onCreate() {
        super.onCreate()
        Emulation.load(this)
    }

    private fun cc(): ByteArray {
        val writable = Emulation.writable
        return byteArrayOf(
            0x00, 0x0F,                 // CCLEN
            if (legacyAid) 0x10 else 0x20, // mapping version 1.0 / 2.0 depending on the selected AID
            0x00, 0xFF.toByte(),        // MLe
            0x00, 0xFF.toByte(),        // MLc
            0x04, 0x06,                 // NDEF file control TLV
            0xE1.toByte(), 0x04,        // file id
            (MAX_NDEF_FILE shr 8).toByte(), (MAX_NDEF_FILE and 0xFF).toByte(),
            0x00,                       // read access granted
            if (writable) 0x00 else 0xFF.toByte()
        )
    }

    private fun currentNdef(): ByteArray = writeBuffer ?: Emulation.ndefFile()

    override fun processCommandApdu(apdu: ByteArray?, extras: Bundle?): ByteArray {
        if (apdu == null || apdu.size < 4) return SW_WRONG_LENGTH
        val ins = apdu[1].toInt() and 0xFF
        val p1 = apdu[2].toInt() and 0xFF
        val p2 = apdu[3].toInt() and 0xFF
        if (!Emulation.enabled) return SW_FILE_NOT_FOUND

        when (ins) {
            0xA4 -> { // SELECT
                if (p1 == 0x04) {
                    val lc = if (apdu.size >= 5) apdu[4].toInt() and 0xFF else 0
                    val aid = if (apdu.size >= 5 + lc) apdu.copyOfRange(5, 5 + lc) else ByteArray(0)
                    return if (aid.contentEquals(AID_V2) || aid.contentEquals(AID_V1)) {
                        if (!appSelected) Emulation.addLog(getString(R.string.emu_reader_connected))
                        Emulation.emit(Emulation.EVT_READER, "connected")
                        appSelected = true
                        legacyAid = aid.contentEquals(AID_V1)
                        selectedFile = FILE_NONE
                        SW_OK
                    } else {
                        Emulation.addLog("SELECT unknown AID " + Hex.encode(aid))
                        SW_FILE_NOT_FOUND
                    }
                }
                if (p1 == 0x00 && apdu.size >= 7) {
                    val fid = ((apdu[5].toInt() and 0xFF) shl 8) or (apdu[6].toInt() and 0xFF)
                    return when (fid) {
                        0xE103 -> { selectedFile = FILE_CC; Emulation.addLog("SELECT CC file"); SW_OK }
                        0xE104 -> { selectedFile = FILE_NDEF; Emulation.addLog("SELECT NDEF file"); SW_OK }
                        else -> { Emulation.addLog("SELECT unknown file %04X".format(fid)); SW_FILE_NOT_FOUND }
                    }
                }
                return SW_WRONG_P1P2
            }
            0xB0 -> { // READ BINARY
                val offset = (p1 shl 8) or p2
                var le = if (apdu.size >= 5) apdu[4].toInt() and 0xFF else 0
                if (le == 0) le = 256
                val file = when (selectedFile) {
                    FILE_CC -> cc()
                    FILE_NDEF -> currentNdef()
                    else -> return SW_FILE_NOT_FOUND
                }
                if (offset > file.size) return SW_WRONG_P1P2
                val len = minOf(le, file.size - offset)
                val out = ByteArray(len + 2)
                System.arraycopy(file, offset, out, 0, len)
                out[len] = SW_OK[0]; out[len + 1] = SW_OK[1]
                if (selectedFile == FILE_NDEF) {
                    Emulation.addLog("READ NDEF offset=$offset len=$len")
                    if (offset + len >= file.size && file.size > 2 && !readCounted) {
                        readCounted = true
                        Emulation.countRead(this)
                        Emulation.addLog(getString(R.string.emu_read_complete))
                    }
                } else {
                    Emulation.addLog("READ CC")
                }
                return out
            }
            0xD6 -> { // UPDATE BINARY
                if (!Emulation.writable) return SW_SECURITY
                if (selectedFile != FILE_NDEF) return SW_FILE_NOT_FOUND
                val offset = (p1 shl 8) or p2
                val lc = if (apdu.size >= 5) apdu[4].toInt() and 0xFF else 0
                if (apdu.size < 5 + lc) return SW_WRONG_LENGTH
                val data = apdu.copyOfRange(5, 5 + lc)
                if (offset + lc > MAX_NDEF_FILE) return SW_WRONG_P1P2
                var buf = writeBuffer ?: currentNdef().copyOf()
                if (buf.size < offset + lc) buf = buf.copyOf(offset + lc)
                System.arraycopy(data, 0, buf, offset, lc)
                writeBuffer = buf
                writeTouched = true
                Emulation.addLog("WRITE offset=$offset len=$lc")
                if (offset == 0 && lc >= 2) {
                    val nlen = ((buf[0].toInt() and 0xFF) shl 8) or (buf[1].toInt() and 0xFF)
                    if (nlen > 0 && buf.size >= 2 + nlen) {
                        val msgBytes = buf.copyOfRange(2, 2 + nlen)
                        try {
                            val msg = NdefMessage(msgBytes)
                            Emulation.addLog(getString(R.string.emu_received) + ": " + NdefParser.summary(msg))
                            Emulation.received(this, msg)
                            writeBuffer = null
                        } catch (e: Exception) {
                            Emulation.addLog("Received invalid NDEF: " + e.message)
                        }
                    }
                }
                return SW_OK
            }
            else -> {
                Emulation.addLog("Unsupported INS %02X".format(ins))
                return SW_INS_NOT_SUPPORTED
            }
        }
    }

    override fun onDeactivated(reason: Int) {
        if (appSelected) {
            Emulation.addLog(getString(R.string.emu_reader_left) + (if (reason == DEACTIVATION_LINK_LOSS) " (link loss)" else " (deselected)"))
            Emulation.emit(Emulation.EVT_READER, "disconnected")
        }
        appSelected = false
        legacyAid = false
        selectedFile = FILE_NONE
        readCounted = false
        writeBuffer = null
        writeTouched = false
    }
}
