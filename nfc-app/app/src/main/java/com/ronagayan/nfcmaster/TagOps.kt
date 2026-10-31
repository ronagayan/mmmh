package com.ronagayan.nfcmaster

import android.content.Context
import android.nfc.FormatException
import android.nfc.NdefMessage
import android.nfc.Tag
import android.nfc.TagLostException
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import android.nfc.tech.NfcA
import android.nfc.tech.NfcB
import android.nfc.tech.NfcF
import android.nfc.tech.NfcV
import android.nfc.tech.TagTechnology
import java.io.IOException

sealed class TagOp {
    class Write(val message: NdefMessage, val lock: Boolean) : TagOp()
    object Erase : TagOp()
    object Format : TagOp()
    object Lock : TagOp()
    object Info : TagOp()
    class Transceive(val tech: String, val cmd: ByteArray) : TagOp()
    object NtagVersion : TagOp()
    object NtagSignature : TagOp()
    object NtagCounter : TagOp()
    object NtagDump : TagOp()
    class NtagSetPassword(val pwd: ByteArray, val pack: ByteArray, val protectRead: Boolean, val startPage: Int) : TagOp()
    class NtagRemovePassword(val pwd: ByteArray) : TagOp()
    object ClassicDump : TagOp()
    object NfcVDump : TagOp()
}

class OpResult(val ok: Boolean, val message: String, val details: String? = null, val tagDetails: TagDetails? = null)

object TagOps {

    fun perform(ctx: Context, tag: Tag, op: TagOp): OpResult {
        return try {
            when (op) {
                is TagOp.Write -> write(ctx, tag, op.message, op.lock)
                TagOp.Erase -> write(ctx, tag, RecordBuilder.emptyMessage(), false).let { if (it.ok) OpResult(true, ctx.getString(R.string.tag_erased)) else it }
                TagOp.Format -> format(ctx, tag)
                TagOp.Lock -> lock(ctx, tag)
                TagOp.Info -> {
                    val d = TagReader.read(tag, false)
                    OpResult(true, ctx.getString(R.string.tag_info), describe(ctx, d), d)
                }
                is TagOp.Transceive -> transceive(ctx, tag, op.tech, op.cmd)
                TagOp.NtagVersion -> ntagVersion(ctx, tag)
                TagOp.NtagSignature -> ntagSimple(ctx, tag, byteArrayOf(0x3C, 0x00), ctx.getString(R.string.ntag_signature))
                TagOp.NtagCounter -> ntagCounter(ctx, tag)
                TagOp.NtagDump -> {
                    val a = NfcA.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "NfcA"))
                    var info: NtagInfo? = null
                    try { a.connect(); info = TagReader.ntagInfo(a)?.first } catch (_: Exception) {} finally { try { a.close() } catch (_: Exception) {} }
                    OpResult(true, ctx.getString(R.string.memory_dump), TagReader.ultralightDump(tag, info))
                }
                is TagOp.NtagSetPassword -> ntagSetPassword(ctx, tag, op)
                is TagOp.NtagRemovePassword -> ntagRemovePassword(ctx, tag, op.pwd)
                TagOp.ClassicDump -> {
                    val mc = MifareClassic.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "MifareClassic"))
                    OpResult(true, ctx.getString(R.string.classic_dump), TagReader.classicDump(mc))
                }
                TagOp.NfcVDump -> {
                    val v = NfcV.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "NfcV"))
                    OpResult(true, ctx.getString(R.string.nfcv_dump), TagReader.nfcVDump(v))
                }
            }
        } catch (e: TagLostException) {
            OpResult(false, ctx.getString(R.string.tag_lost))
        } catch (e: IOException) {
            OpResult(false, ctx.getString(R.string.error_prefix, e.message ?: "I/O"))
        } catch (e: FormatException) {
            OpResult(false, ctx.getString(R.string.error_prefix, "NDEF format: " + e.message))
        } catch (e: Exception) {
            OpResult(false, ctx.getString(R.string.error_prefix, e.toString()))
        }
    }

    fun describe(ctx: Context, d: TagDetails): String {
        val sb = StringBuilder()
        sb.append(ctx.getString(R.string.i_uid)).append(": ").append(d.uid).append('\n')
        sb.append(ctx.getString(R.string.i_techs)).append(": ").append(d.techs.joinToString(", ")).append('\n')
        d.chip?.let { sb.append(ctx.getString(R.string.i_chip)).append(": ").append(it).append('\n') }
        d.manufacturer?.let { sb.append(ctx.getString(R.string.i_manufacturer)).append(": ").append(it).append('\n') }
        sb.append(ctx.getString(R.string.i_tag_type)).append(": ").append(ctx.getString(d.tagTypeRes)).append('\n')
        d.ndefType?.let { sb.append(ctx.getString(R.string.i_ndef_type)).append(": ").append(it).append('\n') }
        if (d.maxSize != null) sb.append(ctx.getString(R.string.i_size)).append(": ").append(d.ndefSize ?: 0).append(" / ").append(d.maxSize).append(" B\n")
        d.writable?.let { sb.append(ctx.getString(R.string.i_writable)).append(": ").append(ctx.getString(if (it) R.string.yes else R.string.no)).append('\n') }
        d.canLock?.let { sb.append(ctx.getString(R.string.i_can_lock)).append(": ").append(ctx.getString(if (it) R.string.yes else R.string.no)).append('\n') }
        for ((k, v) in d.extras) sb.append(ctx.getString(k)).append(": ").append(v).append('\n')
        val parsed = NdefParser.parseMessage(d.message)
        if (parsed.isNotEmpty()) {
            sb.append('\n').append(ctx.getString(R.string.ndef_records)).append(":\n")
            parsed.forEachIndexed { i, p ->
                sb.append(i + 1).append(". [").append(ctx.getString(p.typeRes)).append("] ").append(p.body).append('\n')
                for ((k, v) in p.details) sb.append("   ").append(ctx.getString(k)).append(": ").append(v).append('\n')
            }
        }
        return sb.toString().trimEnd()
    }

    private fun write(ctx: Context, tag: Tag, msg: NdefMessage, lock: Boolean): OpResult {
        val size = msg.toByteArray().size
        val ndef = Ndef.get(tag)
        if (ndef != null) {
            try {
                ndef.connect()
                if (!ndef.isWritable) return OpResult(false, ctx.getString(R.string.tag_not_writable))
                if (ndef.maxSize in 1 until size) return OpResult(false, ctx.getString(R.string.tag_too_small, size, ndef.maxSize))
                ndef.writeNdefMessage(msg)
                if (lock) {
                    if (ndef.canMakeReadOnly()) {
                        ndef.makeReadOnly()
                        return OpResult(true, ctx.getString(R.string.write_and_locked))
                    }
                    return OpResult(true, ctx.getString(R.string.write_success) + "\n" + ctx.getString(R.string.tag_cannot_lock))
                }
                return OpResult(true, ctx.getString(R.string.write_success))
            } finally {
                try { ndef.close() } catch (_: Exception) {}
            }
        }
        val formatable = NdefFormatable.get(tag)
        if (formatable != null) {
            try {
                formatable.connect()
                if (lock) formatable.formatReadOnly(msg) else formatable.format(msg)
                return OpResult(true, ctx.getString(if (lock) R.string.write_and_locked else R.string.write_success))
            } finally {
                try { formatable.close() } catch (_: Exception) {}
            }
        }
        return OpResult(false, ctx.getString(R.string.tag_not_ndef))
    }

    private fun format(ctx: Context, tag: Tag): OpResult {
        if (Ndef.get(tag) != null) {
            return write(ctx, tag, RecordBuilder.emptyMessage(), false).let { if (it.ok) OpResult(true, ctx.getString(R.string.tag_already_formatted) + "\n" + ctx.getString(R.string.tag_erased)) else it }
        }
        val f = NdefFormatable.get(tag) ?: return OpResult(false, ctx.getString(R.string.tag_not_ndef))
        try {
            f.connect()
            f.format(RecordBuilder.emptyMessage())
            return OpResult(true, ctx.getString(R.string.tag_formatted))
        } finally {
            try { f.close() } catch (_: Exception) {}
        }
    }

    private fun lock(ctx: Context, tag: Tag): OpResult {
        val ndef = Ndef.get(tag) ?: return OpResult(false, ctx.getString(R.string.tag_not_ndef))
        try {
            ndef.connect()
            if (!ndef.isWritable) return OpResult(false, ctx.getString(R.string.tag_already_locked))
            if (!ndef.canMakeReadOnly()) return OpResult(false, ctx.getString(R.string.tag_cannot_lock))
            return if (ndef.makeReadOnly()) OpResult(true, ctx.getString(R.string.tag_locked)) else OpResult(false, ctx.getString(R.string.tag_cannot_lock))
        } finally {
            try { ndef.close() } catch (_: Exception) {}
        }
    }

    private fun transceive(ctx: Context, tag: Tag, techName: String, cmd: ByteArray): OpResult {
        val tech: TagTechnology = when (techName) {
            "IsoDep" -> IsoDep.get(tag)
            "NfcB" -> NfcB.get(tag)
            "NfcF" -> NfcF.get(tag)
            "NfcV" -> NfcV.get(tag)
            else -> NfcA.get(tag)
        } ?: return OpResult(false, ctx.getString(R.string.op_unsupported, techName))
        try {
            tech.connect()
            val start = System.nanoTime()
            val resp: ByteArray = when (tech) {
                is IsoDep -> { tech.timeout = 3000; tech.transceive(cmd) }
                is NfcA -> { tech.timeout = 1500; tech.transceive(cmd) }
                is NfcB -> tech.transceive(cmd)
                is NfcF -> { tech.timeout = 1500; tech.transceive(cmd) }
                is NfcV -> tech.transceive(cmd)
                else -> ByteArray(0)
            }
            val ms = (System.nanoTime() - start) / 1_000_000
            val sb = StringBuilder()
            sb.append("> ").append(Hex.encode(cmd, " ")).append('\n')
            sb.append("< ").append(Hex.encode(resp, " ")).append('\n')
            sb.append(resp.size).append(" bytes · ").append(ms).append(" ms")
            if (tech is IsoDep && resp.size >= 2) {
                val sw = ((resp[resp.size - 2].toInt() and 0xFF) shl 8) or (resp[resp.size - 1].toInt() and 0xFF)
                sb.append(" · SW=").append(String.format("%04X", sw)).append(if (sw == 0x9000) " (OK)" else "")
            }
            val ascii = NdefParser.textOrHex(resp)
            if (ascii != Hex.encode(resp, " ")) sb.append("\n\nASCII: ").append(ascii)
            return OpResult(true, ctx.getString(R.string.result), sb.toString())
        } finally {
            try { tech.close() } catch (_: Exception) {}
        }
    }

    private fun ntagVersion(ctx: Context, tag: Tag): OpResult {
        val a = NfcA.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "NfcA"))
        try {
            a.connect()
            val r = TagReader.ntagInfo(a) ?: return OpResult(false, ctx.getString(R.string.not_ntag))
            val (info, raw) = r
            val sb = StringBuilder()
            sb.append(ctx.getString(R.string.i_chip)).append(": ").append(info.name).append('\n')
            sb.append("GET_VERSION: ").append(Hex.encode(raw, " ")).append('\n')
            sb.append("Vendor: 0x%02X · Product: 0x%02X · Subtype: 0x%02X\n".format(raw[1], raw[2], raw[3]))
            sb.append("Version: %d.%d · Storage: 0x%02X · Protocol: 0x%02X\n".format(raw[4], raw[5], raw[6], raw[7]))
            sb.append("Pages: ").append(info.totalPages).append(" (").append(info.totalPages * 4).append(" B)")
            info.cfgPage?.let { cfg ->
                sb.append("\nConfig pages: 0x%02X-0x%02X".format(cfg, cfg + 3))
                try {
                    val c0 = a.transceive(byteArrayOf(0x30, cfg.toByte()))
                    if (c0 != null && c0.size >= 8) {
                        val auth0 = c0[3].toInt() and 0xFF
                        val access = c0[4].toInt() and 0xFF
                        sb.append("\nAUTH0: 0x%02X".format(auth0)).append(if (auth0 == 0xFF) " (no password)" else " (protected from page 0x%02X)".format(auth0))
                        sb.append("\nACCESS: 0x%02X".format(access)).append(if (access and 0x80 != 0) " (read+write protected)" else " (write protected only)")
                        sb.append("\nAUTHLIM: ").append(access and 0x07)
                        sb.append("\nCounter enabled: ").append(if (access and 0x10 != 0) "yes" else "no")
                    }
                } catch (_: Exception) {
                }
            }
            return OpResult(true, ctx.getString(R.string.ntag_version), sb.toString())
        } finally {
            try { a.close() } catch (_: Exception) {}
        }
    }

    private fun ntagSimple(ctx: Context, tag: Tag, cmd: ByteArray, title: String): OpResult {
        val a = NfcA.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "NfcA"))
        try {
            a.connect()
            val r = a.transceive(cmd)
            return OpResult(true, title, Hex.encode(r, " ") + "\n(" + r.size + " bytes)")
        } finally {
            try { a.close() } catch (_: Exception) {}
        }
    }

    private fun ntagCounter(ctx: Context, tag: Tag): OpResult {
        val a = NfcA.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "NfcA"))
        try {
            a.connect()
            val r = a.transceive(byteArrayOf(0x39, 0x02))
            if (r.size < 3) return OpResult(false, ctx.getString(R.string.error_prefix, "NAK " + Hex.encode(r)))
            val v = (r[0].toInt() and 0xFF) or ((r[1].toInt() and 0xFF) shl 8) or ((r[2].toInt() and 0xFF) shl 16)
            return OpResult(true, ctx.getString(R.string.ntag_counter), "NFC counter = $v\n(" + Hex.encode(r, " ") + ")")
        } finally {
            try { a.close() } catch (_: Exception) {}
        }
    }

    private fun ntagSetPassword(ctx: Context, tag: Tag, op: TagOp.NtagSetPassword): OpResult {
        val a = NfcA.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "NfcA"))
        try {
            a.connect()
            val info = TagReader.ntagInfo(a)?.first ?: return OpResult(false, ctx.getString(R.string.not_ntag))
            val cfg = info.cfgPage ?: return OpResult(false, ctx.getString(R.string.not_ntag))
            val c0 = a.transceive(byteArrayOf(0x30, cfg.toByte()))
            val auth0 = c0[3].toInt() and 0xFF
            if (auth0 != 0xFF && auth0 <= cfg) {
                // already protected: must authenticate with the new password (assume same) first
                try { a.transceive(byteArrayOf(0x1B) + op.pwd) } catch (e: IOException) { return OpResult(false, ctx.getString(R.string.auth_failed)) }
            }
            a.transceive(byteArrayOf(0xA2.toByte(), (cfg + 2).toByte()) + op.pwd)
            a.transceive(byteArrayOf(0xA2.toByte(), (cfg + 3).toByte(), op.pack[0], op.pack[1], 0, 0))
            // keep AUTHLIM / NFC_CNT_EN / VCTID etc. from the current ACCESS page, only set PROT
            val access = ((c0[4].toInt() and 0x7F) or (if (op.protectRead) 0x80 else 0x00)).toByte()
            a.transceive(byteArrayOf(0xA2.toByte(), (cfg + 1).toByte(), access, c0[5], c0[6], c0[7]))
            a.transceive(byteArrayOf(0xA2.toByte(), cfg.toByte(), c0[0], c0[1], c0[2], op.startPage.toByte()))
            return OpResult(true, ctx.getString(R.string.password_set), ctx.getString(R.string.protected_hint, "0x%02X".format(op.startPage)))
        } finally {
            try { a.close() } catch (_: Exception) {}
        }
    }

    private fun ntagRemovePassword(ctx: Context, tag: Tag, pwd: ByteArray): OpResult {
        val a = NfcA.get(tag) ?: return OpResult(false, ctx.getString(R.string.op_unsupported, "NfcA"))
        try {
            a.connect()
            val info = TagReader.ntagInfo(a)?.first ?: return OpResult(false, ctx.getString(R.string.not_ntag))
            val cfg = info.cfgPage ?: return OpResult(false, ctx.getString(R.string.not_ntag))
            val pack = try { a.transceive(byteArrayOf(0x1B) + pwd) } catch (e: IOException) { return OpResult(false, ctx.getString(R.string.auth_failed)) }
            if (pack == null || pack.size < 2) return OpResult(false, ctx.getString(R.string.auth_failed))
            val c0 = a.transceive(byteArrayOf(0x30, cfg.toByte()))
            a.transceive(byteArrayOf(0xA2.toByte(), cfg.toByte(), c0[0], c0[1], c0[2], 0xFF.toByte()))
            a.transceive(byteArrayOf(0xA2.toByte(), (cfg + 1).toByte(), (c0[4].toInt() and 0x7F).toByte(), c0[5], c0[6], c0[7]))
            return OpResult(true, ctx.getString(R.string.password_removed), "PACK: " + Hex.encode(pack, " "))
        } finally {
            try { a.close() } catch (_: Exception) {}
        }
    }
}
