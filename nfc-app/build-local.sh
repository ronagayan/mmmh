#!/usr/bin/env bash
# Builds a signed APK without the Android Gradle Plugin, using only:
#   aapt2 (resources), kotlinc (sources), dx or d8 (dex), zipalign, apksigner.
# Required env (defaults shown):
#   ANDROID_JAR  - path to android.jar for API 34
#   KOTLINC      - path to kotlinc binary
#   DX           - path to dx/dalvik-exchange (or set D8 to a d8 binary)
#   OUT          - output directory
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ANDROID_JAR="${ANDROID_JAR:-$HERE/../.sdk/android-34.jar}"
KOTLINC="${KOTLINC:-kotlinc}"
DX="${DX:-dalvik-exchange}"
D8="${D8:-}"
OUT="${OUT:-$HERE/build-local}"
KEYSTORE="$HERE/keystore/release.jks"
VERSION_NAME="${VERSION_NAME:-1.0.1}"
VERSION_CODE="${VERSION_CODE:-2}"
APP="$HERE/app/src/main"

rm -rf "$OUT"; mkdir -p "$OUT/res" "$OUT/gen" "$OUT/classes" "$OUT/dex"
echo "== aapt2 compile"
aapt2 compile --dir "$APP/res" -o "$OUT/res/res.zip"
echo "== aapt2 link"
sed 's|<manifest xmlns:android="http://schemas.android.com/apk/res/android">|<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.ronagayan.nfcmaster">|' "$APP/AndroidManifest.xml" > "$OUT/AndroidManifest.xml"
aapt2 link -o "$OUT/unsigned.apk" -I "$ANDROID_JAR" --manifest "$OUT/AndroidManifest.xml" \
  --java "$OUT/gen" --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --auto-add-overlay "$OUT/res/res.zip"
echo "== javac R.java"
javac -source 8 -target 8 -d "$OUT/classes" -cp "$ANDROID_JAR" $(find "$OUT/gen" -name '*.java') 2>&1 | grep -v "^warning: \[options\]" || true
echo "== kotlinc"
"$KOTLINC" -jvm-target 1.8 -Xlambdas=class -Xsam-conversions=class -Xno-call-assertions -Xno-param-assertions -Xno-receiver-assertions \
  -no-stdlib -no-reflect -cp "$ANDROID_JAR:$OUT/classes:$(dirname "$KOTLINC")/../lib/kotlin-stdlib.jar" \
  -d "$OUT/classes" $(find "$APP/java" -name '*.kt')
echo "== dex"
STDLIB="$(dirname "$KOTLINC")/../lib/kotlin-stdlib.jar"
cp "$STDLIB" "$OUT/stdlib.jar"
zip -q -d "$OUT/stdlib.jar" 'META-INF/versions/*' 'META-INF/*.kotlin_module' 'META-INF/*.version' >/dev/null 2>&1 || true
if [ -n "$D8" ]; then
  "$D8" --release --min-api 24 --lib "$ANDROID_JAR" --output "$OUT/dex" "$OUT/classes" "$OUT/stdlib.jar"
else
  (cd "$OUT/classes" && jar cf "$OUT/app-classes.jar" .)
  "$DX" --dex --min-sdk-version=26 --multi-dex --output="$OUT/dex" "$OUT/app-classes.jar" "$OUT/stdlib.jar"
fi
echo "== package"
cp "$OUT/unsigned.apk" "$OUT/unaligned.apk"
(cd "$OUT/dex" && zip -q -j "$OUT/unaligned.apk" ./*.dex)
zipalign -f -p 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"
echo "== sign"
apksigner sign --ks "$KEYSTORE" --ks-pass pass:nfcmaster --key-pass pass:nfcmaster --ks-key-alias nfcmaster \
  --out "$OUT/NFC-Master.apk" "$OUT/aligned.apk"
apksigner verify --print-certs "$OUT/NFC-Master.apk" | head -3
ls -la "$OUT/NFC-Master.apk"
