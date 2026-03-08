/** Max sizes and limits */
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5 MB
export const MAX_CAPTION_LENGTH = 500
export const MAX_COMMENT_LENGTH = 300
export const MAX_NICKNAME_LENGTH = 32

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** Escape SQL LIKE wildcards so user input is matched literally */
export function escapeIlike(str) {
  return str.replace(/[%_\\]/g, (c) => '\\' + c)
}

/** Validate an image file — returns null if OK, or an error string */
export function validateImageFile(file, maxSize = MAX_FILE_SIZE) {
  if (!file) return 'No file selected'
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, WebP, and GIF images are allowed'
  }
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / 1024 / 1024)
    return `File is too large (max ${mb} MB)`
  }
  return null
}
