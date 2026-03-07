/**
 * End-to-end encryption using ECDH key exchange + AES-GCM.
 *
 * Key pairs are stored in IndexedDB (private key never leaves the device).
 * Public keys are uploaded to the profiles table so the other party can
 * derive the same shared secret independently — no key is ever transmitted.
 *
 * Limitation: if a user clears site data or switches devices, old encrypted
 * messages become unreadable. The app handles this gracefully by showing
 * "[encrypted on another device]" for undecryptable messages.
 */

const DB_NAME = 'mmmh-keys'
const STORE = 'keys'

// ── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE)
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = (e) => resolve(e.target.result ?? null)
    req.onerror = (e) => reject(e.target.error)
  })
}

async function idbPut(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = (e) => reject(e.target.error)
  })
}

// ── Key management ───────────────────────────────────────────────────────────

/**
 * Returns the stored ECDH key pair, generating one if it doesn't exist.
 * extractable:false keeps the private key inside the browser — exportKey
 * on the private key will throw, but the public key can always be exported.
 */
export async function getOrCreateKeyPair() {
  const existing = await idbGet('keyPair')
  if (existing) return existing

  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // private key not extractable
    ['deriveKey'],
  )
  await idbPut('keyPair', keyPair)
  return keyPair
}

/** Serialises a CryptoKey public key to a base64 string for DB storage. */
export async function exportPublicKey(publicKey) {
  const raw = await crypto.subtle.exportKey('raw', publicKey)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

// ── Shared key derivation ────────────────────────────────────────────────────

/**
 * Derives the AES-GCM shared key from our private key + the other party's
 * public key (base64). Both sides independently arrive at the same key.
 */
export async function deriveSharedKey(myPrivateKey, theirPublicKeyB64) {
  const raw = Uint8Array.from(atob(theirPublicKeyB64), (c) => c.charCodeAt(0))
  const theirPublicKey = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ── Encrypt / decrypt ────────────────────────────────────────────────────────

/** Encrypts plaintext → base64(12-byte IV ‖ ciphertext). */
export async function encryptMessage(sharedKey, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    new TextEncoder().encode(plaintext),
  )
  const buf = new Uint8Array(12 + ciphertext.byteLength)
  buf.set(iv)
  buf.set(new Uint8Array(ciphertext), 12)
  return btoa(String.fromCharCode(...buf))
}

/** Decrypts base64(IV ‖ ciphertext) → plaintext. Throws on tampered data. */
export async function decryptMessage(sharedKey, ciphertextB64) {
  const buf = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.slice(0, 12) },
    sharedKey,
    buf.slice(12),
  )
  return new TextDecoder().decode(decrypted)
}
