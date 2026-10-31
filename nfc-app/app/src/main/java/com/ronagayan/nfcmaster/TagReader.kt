package com.ronagayan.nfcmaster

import android.nfc.NdefMessage
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.MifareUltralight
import android.nfc.tech.Ndef
import android.nfc.tech.NfcA
import android.nfc.tech.NfcB
import android.nfc.tech.NfcF
import android.nfc.tech.NfcV
import java.io.IOException

class TagDetails(
    val uid: String,
    val techs: List<String>,
    val tagTypeRes: Int,
    val chip: String?,
    val manufacturer: String?,
    val ndefType: String?,
    val ndefSize: Int?,
    val maxSize: Int?,
    val writable: Boolean?,
    val canLock: Boolean?,
    val message: NdefMessage?,
    val extras: List<Pair<Int, String>>,
    val dump: String?
) {
    val hasNdef: Boolean get() = message != null && message.records.isNotEmpty() && !(message.records.size == 1 && message.records[0].tnf == android.nfc.NdefRecord.TNF_EMPTY)
}

/** Identification data for NXP NTAG / Ultralight EV1 chips derived from GET_VERSION. */
class NtagInfo(val name: String, val totalPages: Int, val cfgPage: Int?, val userEnd: Int)

object TagReader {

    fun manufacturer(uid: ByteArray?): String? {
        if (uid == null || uid.isEmpty()) return null
        return when (uid[0].toInt() and 0xFF) {
            0x01 -> "Motorola"; 0x02 -> "STMicroelectronics"; 0x03 -> "Hitachi"; 0x04 -> "NXP Semiconductors"
            0x05 -> "Infineon"; 0x06 -> "Cylink"; 0x07 -> "Texas Instruments"; 0x08 -> if (uid.size == 4) "Random UID (phone / HCE)" else "Fujitsu"
            0x09 -> "Matsushita"; 0x0A -> "NEC"; 0x0B -> "Oki"; 0x0C -> "Toshiba"; 0x0D -> "Mitsubishi"
            0x0E -> "Samsung"; 0x0F -> "Hyundai"; 0x10 -> "LG"; 0x11 -> "Emosyn"; 0x12 -> "INSIDE Secure"
            0x13 -> "ORGA"; 0x14 -> "Sharp"; 0x15 -> "ATMEL"; 0x16 -> "EM Microelectronic"; 0x17 -> "KSW"
            0x18 -> "ZMD"; 0x19 -> "XICOR"; 0x1A -> "Sony"; 0x1B -> "Malaysia Microelectronic"; 0x1C -> "Emosyn"
            0x1D -> "Shanghai Fudan"; 0x1E -> "Magellan"; 0x1F -> "Melexis"; 0x20 -> "Renesas"; 0x21 -> "TAG Systems"
            0x22 -> "Transcore"; 0x23 -> "Shanghai Belling"; 0x24 -> "Masktech"; 0x25 -> "Innovision"; 0x26 -> "Hitachi ULSI"
            0x27 -> "Cypak"; 0x28 -> "Ricoh"; 0x29 -> "ASK"; 0x2A -> "Unicore"; 0x2B -> "Dallas / Maxim"; 0x2C -> "Impinj"
            0x2D -> "RightPlug"; 0x2E -> "Broadcom"; 0x2F -> "MStar"; 0x30 -> "BeeDar"; 0x31 -> "RFIDsec"; 0x32 -> "Schweizer"
            0x33 -> "AMIC"; 0x34 -> "Mikron"; 0x35 -> "Fraunhofer"; 0x36 -> "IDS Microchip"; 0x37 -> "Kovio"; 0x38 -> "HMT"
            0x39 -> "Silicon Craft"; 0x3A -> "Advanced Film Device"; 0x3B -> "Nitecrest"; 0x3C -> "Verayo"; 0x3D -> "HID Global"
            0x3E -> "Productivity Engineering"; 0x3F -> "Austriamicrosystems"; 0x40 -> "Gemalto"; 0x41 -> "Renesas"; 0x42 -> "3Alogics"
            0x43 -> "Top TroniQ"; 0x44 -> "Gentag"; 0x45 -> "Invengo"; 0x46 -> "Guangzhou Sysur"; 0x47 -> "CEITEC"; 0x48 -> "Shanghai Quanray"
            0x49 -> "MediaTek"; 0x4A -> "Angstrem"; 0x4B -> "Celisic"; 0x4C -> "LEGIC"; 0x4D -> "Balluff"; 0x4E -> "Oberthur"
            0x4F -> "Silterra"; 0x50 -> "DELTA"; 0x51 -> "Giesecke & Devrient"; 0x52 -> "Shenzhen China Vision"; 0x53 -> "Shanghai Feiju"
            0x54 -> "Intel"; 0x55 -> "Microsensys"; 0x56 -> "Sonix"; 0x57 -> "Qualcomm"; 0x58 -> "Realtek"; 0x59 -> "Freevision"
            0x5A -> "Giantec"; 0x5B -> "JSC Angstrem-T"; 0x5C -> "STARCHIP"; 0x5D -> "SPIRTECH"; 0x5E -> "GANTNER"; 0x5F -> "Nordic Semiconductor"
            0x60 -> "Verisiti"; 0x61 -> "Wearlinks"; 0x62 -> "Userstar"; 0x63 -> "Pragmatic"; 0x64 -> "Associação do Laboratório"
            0x65 -> "Tendyron"; 0x66 -> "MUTO Smart"; 0x67 -> "ON Semiconductor"; 0x68 -> "TÜBİTAK BİLGEM"; 0x69 -> "Huada Semiconductor"
            0x6A -> "SEVENEY"; 0x6B -> "ISSM"; 0x6C -> "Wisesec"; 0x7E -> "Holtek"
            else -> null
        }
    }

    /** Sends GET_VERSION (0x60) over NfcA. Returns null when the chip does not support it. */
    fun ntagInfo(nfcA: NfcA): Pair<NtagInfo, ByteArray>? {
        return try {
            val v = nfcA.transceive(byteArrayOf(0x60))
            if (v == null || v.size < 8) return null
            val vendor = v[1].toInt() and 0xFF
            val type = v[2].toInt() and 0xFF
            val sub = v[3].toInt() and 0xFF
            val major = v[4].toInt() and 0xFF
            val storage = v[6].toInt() and 0xFF
            val info = when {
                vendor == 0x04 && type == 0x04 -> when (storage) {
                    0x0B -> NtagInfo("NTAG210", 20, 0x10, 0x0F)
                    0x0E -> NtagInfo("NTAG212", 41, 0x25, 0x24)
                    0x0F -> NtagInfo("NTAG213", 45, 0x29, 0x27)
                    0x11 -> NtagInfo("NTAG215", 135, 0x83, 0x81)
                    0x13 -> NtagInfo("NTAG216", 231, 0xE3, 0xE1)
                    else -> NtagInfo("NTAG (unknown size 0x%02X)".format(storage), 45, null, 0x27)
                }
                vendor == 0x04 && type == 0x03 -> when (storage) {
                    0x0B -> NtagInfo("MIFARE Ultralight EV1 (MF0UL11)", 20, 0x10, 0x0F)
                    0x0E -> NtagInfo("MIFARE Ultralight EV1 (MF0UL21)", 41, 0x25, 0x24)
                    else -> NtagInfo("MIFARE Ultralight EV1", 20, null, 0x0F)
                }
                vendor == 0x04 && type == 0x01 -> NtagInfo("NTAG I2C v$major", 231, null, 0xE1)
                else -> NtagInfo("Unknown (vendor 0x%02X type 0x%02X sub 0x%02X)".format(vendor, type, sub), 16, null, 0x0F)
            }
            info to v
        } catch (e: Exception) {
            null
        }
    }

    fun read(tag: Tag, withDump: Boolean): TagDetails {
        val techs = tag.techList.map { it.substringAfterLast('.') }
        val uidBytes = tag.id
        val uid = Hex.encode(uidBytes, ":")
        val extras = ArrayList<Pair<Int, String>>()
        var chip: String? = null
        var tagTypeRes = R.string.t_generic
        var dump: String? = null

        NfcA.get(tag)?.let { a ->
            extras.add(R.string.i_atqa to Hex.encode(a.atqa.reversedArray(), " "))
            extras.add(R.string.i_sak to String.format("0x%02X", a.sak))
        }
        NfcB.get(tag)?.let { b ->
            extras.add(R.string.i_appdata to Hex.encode(b.applicationData, " "))
            extras.add(R.string.i_protinfo to Hex.encode(b.protocolInfo, " "))
        }
        NfcF.get(tag)?.let { f ->
            extras.add(R.string.i_sys_code to Hex.encode(f.systemCode, " "))
            extras.add(R.string.i_pmm to Hex.encode(f.manufacturer, " "))
            tagTypeRes = R.string.t_type3
        }
        NfcV.get(tag)?.let { v ->
            extras.add(R.string.i_dsfid to String.format("0x%02X", v.dsfId))
            extras.add(R.string.i_resp_flags to String.format("0x%02X", v.responseFlags))
            tagTypeRes = R.string.t_type5
        }
        IsoDep.get(tag)?.let { iso ->
            iso.historicalBytes?.let { if (it.isNotEmpty()) extras.add(R.string.i_hist to Hex.encode(it, " ")) }
            iso.hiLayerResponse?.let { if (it.isNotEmpty()) extras.add(R.string.i_hilayer to Hex.encode(it, " ")) }
            tagTypeRes = if (uidBytes.size == 4 && (uidBytes[0].toInt() and 0xFF) == 0x08) R.string.t_phone else R.string.t_type4
        }
        MifareClassic.get(tag)?.let { mc ->
            chip = "MIFARE Classic " + when (mc.type) {
                MifareClassic.TYPE_PLUS -> "Plus"; MifareClassic.TYPE_PRO -> "Pro"; else -> "1K/4K"
            }
            extras.add(R.string.i_classic_size to "${mc.size} B, ${mc.sectorCount} sectors, ${mc.blockCount} blocks")
            tagTypeRes = R.string.t_classic
        }
        MifareUltralight.get(tag)?.let { ul ->
            chip = when (ul.type) {
                MifareUltralight.TYPE_ULTRALIGHT -> "MIFARE Ultralight"
                MifareUltralight.TYPE_ULTRALIGHT_C -> "MIFARE Ultralight C"
                else -> "Ultralight-compatible"
            }
            tagTypeRes = R.string.t_type2
        }

        // Chip identification via GET_VERSION for NfcA (NTAG / Ultralight EV1)
        var ntag: NtagInfo? = null
        val nfcA = NfcA.get(tag)
        if (nfcA != null && IsoDep.get(tag) == null && MifareClassic.get(tag) == null) {
            try {
                nfcA.connect()
                ntagInfo(nfcA)?.let { (info, raw) ->
                    ntag = info
                    chip = info.name
                    extras.add(R.string.ntag_version to Hex.encode(raw, " "))
                    tagTypeRes = R.string.t_type2
                }
            } catch (_: Exception) {
            } finally {
                try { nfcA.close() } catch (_: Exception) {}
            }
        }

        // NDEF
        var ndefType: String? = null
        var ndefSize: Int? = null
        var maxSize: Int? = null
        var writable: Boolean? = null
        var canLock: Boolean? = null
        var message: NdefMessage? = null
        Ndef.get(tag)?.let { ndef ->
            ndefType = ndef.type
            maxSize = ndef.maxSize
            try {
                ndef.connect()
                writable = ndef.isWritable
                canLock = ndef.canMakeReadOnly()
                message = ndef.cachedNdefMessage ?: ndef.ndefMessage
            } catch (_: Exception) {
                message = ndef.cachedNdefMessage
            } finally {
                try { ndef.close() } catch (_: Exception) {}
            }
            ndefSize = message?.toByteArray()?.size ?: 0
            if (ndefType == Ndef.NFC_FORUM_TYPE_1) tagTypeRes = R.string.t_generic
            if (ndefType == Ndef.NFC_FORUM_TYPE_2) tagTypeRes = R.string.t_type2
            if (ndefType == Ndef.NFC_FORUM_TYPE_3) tagTypeRes = R.string.t_type3
            if (ndefType == Ndef.NFC_FORUM_TYPE_4 && tagTypeRes != R.string.t_phone) tagTypeRes = R.string.t_type4
        }

        if (withDump) {
            dump = try { readDump(tag, ntag) } catch (e: Exception) { null }
        }

        return TagDetails(uid, techs, tagTypeRes, chip, manufacturer(uidBytes), ndefType, ndefSize, maxSize, writable, canLock, message, extras, dump)
    }

    fun readDump(tag: Tag, ntag: NtagInfo?): String? {
        MifareClassic.get(tag)?.let { return classicDump(it) }
        NfcV.get(tag)?.let { return nfcVDump(it) }
        val ul = MifareUltralight.get(tag)
        val a = NfcA.get(tag)
        if (ul != null || (a != null && IsoDep.get(tag) == null)) return ultralightDump(tag, ntag)
        return null
    }

    fun ultralightDump(tag: Tag, info: NtagInfo?): String {
        val a = NfcA.get(tag) ?: throw IOException("NfcA")
        val out = java.io.ByteArrayOutputStream()
        var pages = 0
        try {
            a.connect()
            a.timeout = 600
            val limit = info?.totalPages ?: 256
            var page = 0
            while (page < limit) {
                val r = try { a.transceive(byteArrayOf(0x30, page.toByte())) } catch (e: IOException) { null }
                if (r == null || r.size < 16) break
                val remaining = minOf(16, (limit - page) * 4)
                out.write(r, 0, remaining)
                pages += remaining / 4
                page += 4
            }
        } finally {
            try { a.close() } catch (_: Exception) {}
        }
        val bytes = out.toByteArray()
        val header = StringBuilder()
        if (info != null) header.append(info.name).append(" · ").append(info.totalPages).append(" pages · user memory pages 04-").append(String.format("%02X", info.userEnd)).append('\n')
        header.append(pages).append(" pages read (").append(bytes.size).append(" bytes)\n\n")
        return header.toString() + Hex.dump(bytes, 4, 0, "pg")
    }

    private val CLASSIC_KEYS = listOf(
        MifareClassic.KEY_DEFAULT, MifareClassic.KEY_NFC_FORUM, MifareClassic.KEY_MIFARE_APPLICATION_DIRECTORY,
        ByteArray(6), Hex.decode("D3F7D3F7D3F7"), Hex.decode("A0B0C0D0E0F0"), Hex.decode("A1B1C1D1E1F1"),
        Hex.decode("4D3A99C351DD"), Hex.decode("1A982C7E459A"), Hex.decode("AABBCCDDEEFF"), Hex.decode("714C5C886E97"),
        Hex.decode("587EE5F9350F"), Hex.decode("A0478CC39091"), Hex.decode("533CB6C723F6"), Hex.decode("8FD0A4F256E9")
    )

    fun classicDump(mc: MifareClassic): String {
        val sb = StringBuilder()
        try {
            mc.connect()
            mc.timeout = 800
            sb.append("MIFARE Classic · ").append(mc.size).append(" B · ").append(mc.sectorCount).append(" sectors\n\n")
            for (s in 0 until mc.sectorCount) {
                var keyUsed: String? = null
                for (k in CLASSIC_KEYS) {
                    if (mc.authenticateSectorWithKeyA(s, k)) { keyUsed = "A:" + Hex.encode(k); break }
                    if (mc.authenticateSectorWithKeyB(s, k)) { keyUsed = "B:" + Hex.encode(k); break }
                }
                sb.append("--- sector ").append(s)
                if (keyUsed == null) {
                    sb.append(" (no known key)\n")
                    continue
                }
                sb.append(" key ").append(keyUsed).append('\n')
                val first = mc.sectorToBlock(s)
                for (b in first until first + mc.getBlockCountInSector(s)) {
                    val data = try { mc.readBlock(b) } catch (e: IOException) { null }
                    sb.append(String.format("blk %03d  ", b)).append(if (data == null) "read error" else Hex.encode(data, " ")).append('\n')
                }
            }
        } finally {
            try { mc.close() } catch (_: Exception) {}
        }
        return sb.toString().trimEnd()
    }

    fun nfcVDump(v: NfcV): String {
        val sb = StringBuilder()
        try {
            v.connect()
            var blocks = 256
            var blockSize = 4
            val info = try { v.transceive(byteArrayOf(0x02, 0x2B)) } catch (e: IOException) { null }
            if (info != null && info.size >= 10 && info[0].toInt() == 0) {
                val flags = info[1].toInt() and 0xFF
                var i = 10
                sb.append("UID: ").append(Hex.encode(info.copyOfRange(2, 10).reversedArray(), ":")).append('\n')
                if (flags and 0x01 != 0 && i < info.size) { sb.append("DSFID: ").append(String.format("0x%02X", info[i])).append('\n'); i++ }
                if (flags and 0x02 != 0 && i < info.size) { sb.append("AFI: ").append(String.format("0x%02X", info[i])).append('\n'); i++ }
                if (flags and 0x04 != 0 && i + 1 < info.size) {
                    blocks = (info[i].toInt() and 0xFF) + 1
                    blockSize = (info[i + 1].toInt() and 0x1F) + 1
                    sb.append("Memory: ").append(blocks).append(" blocks × ").append(blockSize).append(" B\n")
                    i += 2
                }
                if (flags and 0x08 != 0 && i < info.size) { sb.append("IC ref: ").append(String.format("0x%02X", info[i])).append('\n') }
                sb.append('\n')
            }
            val out = java.io.ByteArrayOutputStream()
            var n = 0
            for (b in 0 until blocks) {
                val r = try { v.transceive(byteArrayOf(0x02, 0x20, b.toByte())) } catch (e: IOException) { null }
                if (r == null || r.size < 2 || r[0].toInt() != 0) break
                out.write(r, 1, r.size - 1)
                n++
            }
            sb.append(n).append(" blocks read\n\n").append(Hex.dump(out.toByteArray(), blockSize, 0, "blk"))
        } finally {
            try { v.close() } catch (_: Exception) {}
        }
        return sb.toString().trimEnd()
    }
}
