import Dexie, { type Table } from 'dexie'
import type {
  User,
  StoreSetting,
  Category,
  Product,
  Barcode,
  ProductUnit,
  Customer,
  Supplier,
  Shift,
  Sale,
  SaleItem,
  SalePayment,
  StockMovement,
  Expense,
  Debt,
  DebtPayment,
  Purchase,
  PurchaseItem,
  Return,
  ReturnItem,
  SyncOutbox
} from '../types'

export class KasirDatabase extends Dexie {
  users!: Table<User, string>
  store_settings!: Table<StoreSetting, string>
  categories!: Table<Category, string>
  products!: Table<Product, string>
  barcodes!: Table<Barcode, string>
  product_units!: Table<ProductUnit, string>
  customers!: Table<Customer, string>
  suppliers!: Table<Supplier, string>
  shifts!: Table<Shift, string>
  sales!: Table<Sale, string>
  sale_items!: Table<SaleItem, string>
  sale_payments!: Table<SalePayment, string>
  stock_movements!: Table<StockMovement, string>
  expenses!: Table<Expense, string>
  debts!: Table<Debt, string>
  debt_payments!: Table<DebtPayment, string>
  purchases!: Table<Purchase, string>
  purchase_items!: Table<PurchaseItem, string>
  returns!: Table<Return, string>
  return_items!: Table<ReturnItem, string>
  sync_outbox!: Table<SyncOutbox, string>

  constructor() {
    super('KasirKelontongDB')

    this.version(1).stores({
      users: 'id, email, pin_hash, role, synced',
      store_settings: 'id',
      categories: 'id, name, synced',
      products: 'id, category_id, name, sku, is_bulk, current_stock, min_stock, synced, updated_at',
      barcodes: 'id, product_id, code, synced',
      product_units: 'id, product_id, unit_name, barcode, synced',
      customers: 'id, name, phone, total_debt, synced',
      suppliers: 'id, name, phone, synced',
      shifts: 'id, user_id, status, opened_at, closed_at, synced',
      sales: 'id, invoice_no, user_id, shift_id, customer_id, status, created_at, synced',
      sale_items: 'id, sale_id, product_id, synced',
      sale_payments: 'id, sale_id, method, synced',
      stock_movements: 'id, product_id, type, ref_type, created_at, synced',
      expenses: 'id, user_id, shift_id, category, created_at, synced',
      debts: 'id, customer_id, sale_id, status, created_at, synced',
      debt_payments: 'id, debt_id, customer_id, paid_at, synced',
      purchases: 'id, supplier_id, user_id, purchase_date, synced',
      purchase_items: 'id, purchase_id, product_id, synced',
      returns: 'id, sale_id, user_id, created_at, synced',
      return_items: 'id, return_id, product_id, synced',
      sync_outbox: 'id, table_name, record_id, action, created_at'
    })
  }
}

export const db = new KasirDatabase()
