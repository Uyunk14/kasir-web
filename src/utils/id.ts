/**
 * Utility untuk ID generator offline-safe dan format nomor invoice
 */

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9)
}

export function generateInvoiceNumber(prefix = 'INV'): string {
  const date = new Date()
  const y = date.getFullYear().toString().slice(-2)
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}${y}${m}${d}-${rand}`
}
