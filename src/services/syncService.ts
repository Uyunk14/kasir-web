import { pb } from './pocketbase'
import { db } from '../db/db'

export interface SyncStatus {
  isSyncing: boolean
  lastSyncTime: string | null
  unsyncedCount: number
  error: string | null
}

let syncListeners: ((status: SyncStatus) => void)[] = []
let currentStatus: SyncStatus = {
  isSyncing: false,
  lastSyncTime: localStorage.getItem('kasir_last_sync') || null,
  unsyncedCount: 0,
  error: null
}

function notifyListeners() {
  syncListeners.forEach(cb => cb({ ...currentStatus }))
}

export function onSyncStatusChange(cb: (status: SyncStatus) => void) {
  syncListeners.push(cb)
  cb({ ...currentStatus })
  return () => {
    syncListeners = syncListeners.filter(l => l !== cb)
  }
}

/**
 * Hitung jumlah data yang belum tersinkronisasi
 */
export async function getUnsyncedCount(): Promise<number> {
  try {
    const [p, c, s, e, d] = await Promise.all([
      db.products.filter(item => !item.synced).count(),
      db.customers.filter(item => !item.synced).count(),
      db.sales.filter(item => !item.synced).count(),
      db.expenses.filter(item => !item.synced).count(),
      db.debts.filter(item => !item.synced).count()
    ])
    const count = p + c + s + e + d
    currentStatus.unsyncedCount = count
    notifyListeners()
    return count
  } catch (e) {
    return 0
  }
}

/**
 * Sinkronisasi data lokal ke server PocketBase
 */
export async function syncAllToPocketBase(): Promise<{ success: boolean; message?: string }> {
  if (!navigator.onLine) {
    return { success: false, message: 'Tidak ada koneksi internet (Offline)' }
  }

  currentStatus.isSyncing = true
  currentStatus.error = null
  notifyListeners()

  try {
    // 1. Sinkron Kategori
    const unsyncedCats = await db.categories.filter(c => !c.synced).toArray()
    for (const cat of unsyncedCats) {
      try {
        await pb.collection('categories').create({
          id: cat.id.length === 15 ? cat.id : undefined,
          name: cat.name
        }, { requestKey: null })
        await db.categories.update(cat.id, { synced: true })
      } catch (err: any) {
        // Jika sudah ada, update
        if (err.status === 400 || err.status === 409) {
          await db.categories.update(cat.id, { synced: true })
        }
      }
    }

    // 2. Sinkron Produk
    const unsyncedProducts = await db.products.filter(p => !p.synced).toArray()
    for (const prod of unsyncedProducts) {
      try {
        await pb.collection('products').create({
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          is_bulk: prod.is_bulk,
          cost_price: prod.cost_price,
          sell_price: prod.sell_price,
          wholesale_price: prod.wholesale_price || 0,
          current_stock: prod.current_stock,
          min_stock: prod.min_stock,
          category_id: prod.category_id
        }, { requestKey: null })
        await db.products.update(prod.id, { synced: true })
      } catch (err: any) {
        if (err.status === 400 || err.status === 409) {
          await db.products.update(prod.id, { synced: true })
        }
      }
    }

    // 3. Sinkron Pelanggan
    const unsyncedCustomers = await db.customers.filter(c => !c.synced).toArray()
    for (const cust of unsyncedCustomers) {
      try {
        await pb.collection('customers').create({
          name: cust.name,
          phone: cust.phone,
          address: cust.address || '',
          total_debt: cust.total_debt,
          credit_limit: cust.credit_limit
        }, { requestKey: null })
        await db.customers.update(cust.id, { synced: true })
      } catch (err: any) {
        if (err.status === 400 || err.status === 409) {
          await db.customers.update(cust.id, { synced: true })
        }
      }
    }

    // 4. Sinkron Penjualan (Sales)
    const unsyncedSales = await db.sales.filter(s => !s.synced).toArray()
    for (const sale of unsyncedSales) {
      try {
        await pb.collection('sales').create({
          invoice_no: sale.invoice_no,
          user_id: sale.user_id,
          user_name: sale.user_name,
          shift_id: sale.shift_id,
          customer_id: sale.customer_id || '',
          customer_name: sale.customer_name || '',
          subtotal: sale.subtotal,
          discount: sale.discount,
          total: sale.total,
          paid_amount: sale.paid_amount,
          change_amount: sale.change_amount,
          debt_amount: sale.debt_amount,
          payment_summary: sale.payment_summary,
          status: sale.status,
          created_at: sale.created_at
        }, { requestKey: null })
        await db.sales.update(sale.id, { synced: true })
      } catch (err: any) {
        if (err.status === 400 || err.status === 409) {
          await db.sales.update(sale.id, { synced: true })
        }
      }
    }

    // 5. Sinkron Pengeluaran (Expenses)
    const unsyncedExpenses = await db.expenses.filter(e => !e.synced).toArray()
    for (const exp of unsyncedExpenses) {
      try {
        await pb.collection('expenses').create({
          user_id: exp.user_id,
          shift_id: exp.shift_id,
          category: exp.category,
          amount: exp.amount,
          notes: exp.notes,
          created_at: exp.created_at
        }, { requestKey: null })
        await db.expenses.update(exp.id, { synced: true })
      } catch (err: any) {
        if (err.status === 400 || err.status === 409) {
          await db.expenses.update(exp.id, { synced: true })
        }
      }
    }

    const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    currentStatus.lastSyncTime = now
    currentStatus.unsyncedCount = 0
    localStorage.setItem('kasir_last_sync', now)

    return { success: true }
  } catch (err: any) {
    console.error('PocketBase sync error:', err)
    currentStatus.error = err.message || 'Gagal sinkronisasi'
    return { success: false, message: err.message }
  } finally {
    currentStatus.isSyncing = false
    notifyListeners()
  }
}

/**
 * Tarik data terbaru dari PocketBase ke IndexedDB lokal (Pull)
 */
export async function pullFromPocketBase(): Promise<{ success: boolean; count?: number }> {
  if (!navigator.onLine) return { success: false }

  try {
    // Tarik produk dari PocketBase
    const remoteProducts = await pb.collection('products').getFullList({
      sort: '-created',
      requestKey: null
    })

    if (remoteProducts.length > 0) {
      for (const rp of remoteProducts) {
        const local = await db.products.where('name').equals(rp.name).first()
        if (!local) {
          await db.products.add({
            id: rp.id,
            name: rp.name,
            sku: rp.sku || '',
            unit: rp.unit || 'pcs',
            is_bulk: rp.is_bulk || false,
            cost_price: rp.cost_price || 0,
            sell_price: rp.sell_price || 0,
            wholesale_price: rp.wholesale_price || 0,
            current_stock: rp.current_stock || 0,
            min_stock: rp.min_stock || 5,
            category_id: rp.category_id || '',
            synced: true,
            updated_at: rp.updated || new Date().toISOString()
          })
        }
      }
    }

    return { success: true, count: remoteProducts.length }
  } catch (e) {
    console.error('Pull from PocketBase error:', e)
    return { success: false }
  }
}

/**
 * Setup Realtime SSE Listener dari PocketBase
 */
export function initRealtimeSubscriptions() {
  try {
    pb.collection('products').subscribe('*', async (e) => {
      if (e.action === 'create' || e.action === 'update') {
        const record = e.record
        const existing = await db.products.where('name').equals(record.name).first()
        if (existing) {
          await db.products.update(existing.id, {
            current_stock: record.current_stock,
            sell_price: record.sell_price,
            cost_price: record.cost_price,
            synced: true,
            updated_at: new Date().toISOString()
          })
        }
      } else if (e.action === 'delete') {
        const existing = await db.products.where('name').equals(e.record.name).first()
        if (existing) {
          await db.products.delete(existing.id)
        }
      }
    })
  } catch (err) {
    console.error('Failed to subscribe to PocketBase realtime:', err)
  }
}

// Auto-sync listener saat online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncAllToPocketBase()
    pullFromPocketBase()
  })

  // Timer berkala sync setiap 60 detik saat online
  setInterval(() => {
    if (navigator.onLine) {
      getUnsyncedCount().then(count => {
        if (count > 0) {
          syncAllToPocketBase()
        }
      })
    }
  }, 60000)
}
