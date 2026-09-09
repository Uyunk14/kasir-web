/**
 * Utility Cetak Struk: Web Bluetooth ESC/POS (58mm), Print Window & WhatsApp Share
 */

import type { Sale, SaleItem, SalePayment, StoreSetting } from '../types'

// Format mata uang Rupiah
export function formatRupiah(amount: number): string {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

// 58mm thermal printer standard: 32 columns wide
const LINE_WIDTH = 32

function padLine(left: string, right: string): string {
  const spaceCount = Math.max(1, LINE_WIDTH - left.length - right.length)
  return left + ' '.repeat(spaceCount) + right
}

function divider(char = '-'): string {
  return char.repeat(LINE_WIDTH)
}

export function centerText(text: string): string {
  if (text.length >= LINE_WIDTH) return text.substring(0, LINE_WIDTH)
  const leftPad = Math.floor((LINE_WIDTH - text.length) / 2)
  return ' '.repeat(leftPad) + text
}

/**
 * Generate formatted text receipt for WhatsApp or preview
 */
export function generateTextReceipt(
  store: StoreSetting | null,
  sale: Sale,
  items: SaleItem[],
  payments: SalePayment[]
): string {
  const storeName = store?.store_name || 'TOKO KELONTONG'
  const storePhone = store?.phone ? `WA: ${store.phone}` : ''
  const storeAddress = store?.address || ''
  const dateStr = new Date(sale.created_at).toLocaleString('id-ID')

  let lines: string[] = [
    `*${storeName.toUpperCase()}*`,
    storeAddress,
    storePhone,
    divider('='),
    `No: ${sale.invoice_no}`,
    `Tgl: ${dateStr}`,
    `Kasir: ${sale.user_name}`,
    ...(sale.customer_name ? [`Pelanggan: ${sale.customer_name}`] : []),
    divider('-')
  ]

  items.forEach(item => {
    const qtyUnit = `${item.quantity} ${item.unit} x ${item.price.toLocaleString('id-ID')}`
    lines.push(item.product_name)
    lines.push(padLine(`  ${qtyUnit}`, item.subtotal.toLocaleString('id-ID')))
  })

  lines.push(divider('-'))
  lines.push(padLine('Subtotal:', sale.subtotal.toLocaleString('id-ID')))
  if (sale.discount > 0) {
    lines.push(padLine('Diskon:', `-${sale.discount.toLocaleString('id-ID')}`))
  }
  lines.push(padLine('*TOTAL:*', `*Rp ${sale.total.toLocaleString('id-ID')}*`))

  payments.forEach(p => {
    const methodLabel = p.method === 'cash' ? 'Tunai' : p.method === 'qris' ? 'QRIS' : p.method === 'debt' ? 'Kasbon' : 'Transfer'
    lines.push(padLine(`Bayar (${methodLabel}):`, p.amount.toLocaleString('id-ID')))
  })

  if (sale.change_amount > 0) {
    lines.push(padLine('Kembalian:', sale.change_amount.toLocaleString('id-ID')))
  }
  if (sale.debt_amount > 0) {
    lines.push(padLine('*Sisa Kasbon:*', `*Rp ${sale.debt_amount.toLocaleString('id-ID')}*`))
  }

  lines.push(divider('='))
  lines.push(store?.receipt_footer || 'Terima kasih atas kunjungan Anda')

  return lines.filter(Boolean).join('\n')
}

/**
 * Kirim struk via WhatsApp
 */
export function shareReceiptToWhatsApp(
  phone: string | undefined,
  store: StoreSetting | null,
  sale: Sale,
  items: SaleItem[],
  payments: SalePayment[]
) {
  const text = generateTextReceipt(store, sale, items, payments)
  const encoded = encodeURIComponent(text)
  
  let targetPhone = phone?.replace(/\D/g, '') || ''
  if (targetPhone.startsWith('0')) {
    targetPhone = '62' + targetPhone.substring(1)
  }

  const url = targetPhone
    ? `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`
  
  window.open(url, '_blank')
}

/**
 * Generate ESC/POS raw bytes for Bluetooth 58mm Thermal Printer
 */
export function generateEscPosBytes(
  store: StoreSetting | null,
  sale: Sale,
  items: SaleItem[],
  payments: SalePayment[]
): Uint8Array {
  const commands: number[] = []

  // Initialize printer
  commands.push(0x1B, 0x40)

  // Align Center
  commands.push(0x1B, 0x61, 0x01)
  // Bold on, Double height/width for Store Name
  commands.push(0x1B, 0x45, 0x01, 0x1D, 0x21, 0x11)
  pushAscii(commands, (store?.store_name || 'KASIR TOKO') + '\n')
  
  // Normal text
  commands.push(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00)
  if (store?.address) pushAscii(commands, store.address + '\n')
  if (store?.phone) pushAscii(commands, 'Telp: ' + store.phone + '\n')
  pushAscii(commands, divider('=') + '\n')

  // Align Left
  commands.push(0x1B, 0x61, 0x00)
  pushAscii(commands, `No  : ${sale.invoice_no}\n`)
  pushAscii(commands, `Tgl : ${new Date(sale.created_at).toLocaleString('id-ID')}\n`)
  pushAscii(commands, `Kasir: ${sale.user_name}\n`)
  if (sale.customer_name) {
    pushAscii(commands, `Plg : ${sale.customer_name}\n`)
  }
  pushAscii(commands, divider('-') + '\n')

  // Items
  items.forEach(item => {
    pushAscii(commands, `${item.product_name}\n`)
    const qtyPrice = `  ${item.quantity} ${item.unit} x ${item.price.toLocaleString('id-ID')}`
    const sub = item.subtotal.toLocaleString('id-ID')
    pushAscii(commands, padLine(qtyPrice, sub) + '\n')
  })

  pushAscii(commands, divider('-') + '\n')
  pushAscii(commands, padLine('Subtotal:', sale.subtotal.toLocaleString('id-ID')) + '\n')
  if (sale.discount > 0) {
    pushAscii(commands, padLine('Diskon:', `-${sale.discount.toLocaleString('id-ID')}`) + '\n')
  }
  
  // Bold Total
  commands.push(0x1B, 0x45, 0x01)
  pushAscii(commands, padLine('TOTAL:', 'Rp ' + sale.total.toLocaleString('id-ID')) + '\n')
  commands.push(0x1B, 0x45, 0x00)

  payments.forEach(p => {
    const methodLabel = p.method === 'cash' ? 'Tunai' : p.method === 'qris' ? 'QRIS' : p.method === 'debt' ? 'Kasbon' : 'Transfer'
    pushAscii(commands, padLine(`Bayar (${methodLabel}):`, p.amount.toLocaleString('id-ID')) + '\n')
  })

  if (sale.change_amount > 0) {
    pushAscii(commands, padLine('Kembalian:', sale.change_amount.toLocaleString('id-ID')) + '\n')
  }
  if (sale.debt_amount > 0) {
    pushAscii(commands, padLine('Sisa Kasbon:', 'Rp ' + sale.debt_amount.toLocaleString('id-ID')) + '\n')
  }

  // Footer
  pushAscii(commands, divider('=') + '\n')
  commands.push(0x1B, 0x61, 0x01)
  pushAscii(commands, (store?.receipt_footer || 'Terima kasih atas kunjungan Anda') + '\n')
  
  // Feed 3 lines & cut paper
  pushAscii(commands, '\n\n\n')
  commands.push(0x1D, 0x56, 0x41, 0x00)

  return new Uint8Array(commands)
}

function pushAscii(arr: number[], str: string) {
  for (let i = 0; i < str.length; i++) {
    arr.push(str.charCodeAt(i))
  }
}

/**
 * Print via Web Bluetooth (Printer Thermal 58mm)
 */
export async function printViaBluetooth(
  store: StoreSetting | null,
  sale: Sale,
  items: SaleItem[],
  payments: SalePayment[]
): Promise<{ success: boolean; message?: string }> {
  const nav = navigator as any
  if (!nav.bluetooth) {
    return {
      success: false,
      message: 'Web Bluetooth tidak didukung pada browser ini. Gunakan Chrome di Android/PC.'
    }
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [
        { services: ['000018f0-0000-1000-8000-00805f9b34fb'] },
        { services: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] },
        { services: [0xffe0] },
        { services: [0x18f0] }
      ],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 0xffe0, 0x18f0, 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
    })

    const server = await device.gatt?.connect()
    if (!server) throw new Error('Gagal menghubungkan printer bluetooth')

    // Find primary printing service and characteristic
    const services = await server.getPrimaryServices()
    let writeChar: any = null

    for (const s of services) {
      const chars = await s.getCharacteristics()
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          writeChar = c
          break
        }
      }
      if (writeChar) break
    }

    if (!writeChar) {
      throw new Error('Karakteristik cetak printer bluetooth tidak ditemukan')
    }

    const data = generateEscPosBytes(store, sale, items, payments)
    // Send in chunks of 100 bytes for bluetooth throughput
    const chunkSize = 100
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      if (writeChar.writeValueWithoutResponse) {
        await writeChar.writeValueWithoutResponse(chunk)
      } else {
        await writeChar.writeValue(chunk)
      }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Bluetooth print error:', err)
    return { success: false, message: err.message || 'Gagal cetak bluetooth' }
  }
}
