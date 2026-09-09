export type UserRole = 'owner' | 'cashier'

export interface User {
  id: string
  name: string
  email: string
  pin_hash: string
  password_hash?: string
  role: UserRole
  created_at: string
  synced: boolean
}

export interface StoreSetting {
  id: string
  store_name: string
  owner_name: string
  phone: string
  address: string
  receipt_footer: string
  is_configured: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  synced: boolean
}

export interface Product {
  id: string
  category_id: string
  category_name?: string
  name: string
  sku: string
  unit: string
  is_bulk: boolean // True untuk barang timbangan / curah desimal (mis. 1.5 kg)
  cost_price: number // Harga modal (hanya pemilik)
  sell_price: number // Harga jual
  wholesale_price?: number // Harga grosir opsional
  current_stock: number // Mendukung desimal untuk curah
  min_stock: number // Peringatan stok menipis
  needs_stock_audit?: boolean // Penanda konflik stok offline
  synced: boolean
  updated_at: string
}

export interface Barcode {
  id: string
  product_id: string
  code: string
  synced: boolean
}

export interface ProductUnit {
  id: string
  product_id: string
  unit_name: string // misal: Dus, Pak, Renteng
  conversion: number // Konversi ke satuan dasar (misal 1 dus = 24 pcs)
  price: number
  barcode?: string
  synced: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  address?: string
  total_debt: number
  credit_limit: number
  synced: boolean
}

export interface Supplier {
  id: string
  name: string
  phone: string
  address?: string
  synced: boolean
}

export interface Shift {
  id: string
  user_id: string
  user_name: string
  opening_cash: number
  closing_cash?: number | null
  expected_cash?: number | null
  difference?: number | null
  notes?: string
  opened_at: string
  closed_at?: string | null
  status: 'open' | 'closed'
  synced: boolean
}

export type PaymentMethod = 'cash' | 'qris' | 'transfer' | 'debt'

export interface SalePayment {
  id: string
  sale_id: string
  method: PaymentMethod
  amount: number
  synced: boolean
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  unit: string
  quantity: number // desimal didukung
  price: number
  cost: number
  discount: number
  subtotal: number
  synced: boolean
}

export interface Sale {
  id: string
  invoice_no: string
  user_id: string
  user_name: string
  shift_id: string
  customer_id?: string | null
  customer_name?: string | null
  subtotal: number
  discount: number
  total: number
  paid_amount: number
  change_amount: number
  debt_amount: number
  payment_summary: string
  status: 'completed' | 'cancelled' | 'hold'
  synced: boolean
  created_at: string
}

export interface StockMovement {
  id: string
  product_id: string
  product_name?: string
  type: 'in' | 'out' | 'adjustment' | 'return'
  quantity: number
  ref_type: 'sale' | 'purchase' | 'opname' | 'return'
  ref_id?: string
  notes?: string
  synced: boolean
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  shift_id: string
  category: string
  amount: number
  notes: string
  synced: boolean
  created_at: string
}

export interface Debt {
  id: string
  customer_id: string
  customer_name?: string
  sale_id: string
  invoice_no?: string
  amount: number
  paid: number
  status: 'active' | 'paid'
  synced: boolean
  created_at: string
}

export interface DebtPayment {
  id: string
  debt_id: string
  customer_id: string
  amount: number
  method: PaymentMethod
  notes?: string
  synced: boolean
  paid_at: string
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  product_name: string
  quantity: number
  cost_price: number
  subtotal: number
  synced: boolean
}

export interface Purchase {
  id: string
  supplier_id: string
  supplier_name: string
  user_id: string
  invoice_no: string
  total: number
  synced: boolean
  purchase_date: string
}

export interface ReturnItem {
  id: string
  return_id: string
  product_id: string
  quantity: number
  price: number
  synced: boolean
}

export interface Return {
  id: string
  sale_id: string
  invoice_no?: string
  user_id: string
  amount: number
  reason: string
  synced: boolean
  created_at: string
}

export interface SyncOutbox {
  id: string
  table_name: string
  record_id: string
  action: 'create' | 'update' | 'delete'
  payload: string
  created_at: string
}
