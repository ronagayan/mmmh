# NFC Master (Android)

Read, write, clone and **emulate** NFC tags. The phone can act as an NFC tag (host card emulation,
NFC Forum Type 4 Tag) so a second phone can simply be tapped against it to read the content, or
write content back to it (receive mode).

## Features
- **Read**: UID, manufacturer, chip (NTAG213/215/216, Ultralight EV1, MIFARE Classic…), technologies,
  ATQA/SAK, NDEF type/size/writable/lockable, all NDEF records parsed (text, URL, phone, SMS, email,
  Wi‑Fi, vCard, location, app record, Bluetooth pairing, smart poster, MIME, external, raw), memory dump.
- **Write**: compose multi-record NDEF messages of any of the types above, lock after write, bulk mode
  (write the same message to many tags), erase, format, lock, clone the last scanned tag.
- **Emulate**: the phone becomes a Type 4 NDEF tag; optional writable/receive mode; live APDU log and counters.
- **History**: every scan/write/emulation/received message with search, re-write, re-emulate, share,
  export to Downloads as JSON.
- **Tools**: tag identification, NTAG tools (GET_VERSION, signature, counter, full dump, set/remove
  password), MIFARE Classic dump with default keys, ISO 15693 block dump, raw command console
  (NfcA / IsoDep / NfcV / NfcB / NfcF), settings (vibration, beep, auto-open links, keep screen on,
  raw tag mode, mute system sound), Hebrew + English UI, dark mode.

## Building
- **Android Studio / Gradle**: open `nfc-app/` and run `gradle assembleRelease`
  (also done automatically by `.github/workflows/nfc-apk.yml`, which publishes the APK as a release asset).
- **Without the Android SDK** (`build-local.sh`): needs `aapt2`, `zipalign`, `apksigner`, a Kotlin compiler,
  `dx`/`d8` and an `android.jar` for API 34:
  `ANDROID_JAR=... KOTLINC=... ./build-local.sh` → `build-local/NFC-Master.apk`.

The app uses framework APIs only (no AndroidX), which is what makes the SDK-less build possible.
The signing key in `keystore/` is a throw-away key created for this project so that local and CI builds
install over each other.
