export const POCKETBASE_SCHEMA_JSON = JSON.stringify([
  {
    "name": "categories",
    "type": "base",
    "system": false,
    "schema": [
      {
        "name": "name",
        "type": "text",
        "required": true,
        "presentable": true
      }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  },
  {
    "name": "products",
    "type": "base",
    "system": false,
    "schema": [
      { "name": "name", "type": "text", "required": true, "presentable": true },
      { "name": "sku", "type": "text" },
      { "name": "unit", "type": "text" },
      { "name": "is_bulk", "type": "bool" },
      { "name": "cost_price", "type": "number" },
      { "name": "sell_price", "type": "number", "required": true },
      { "name": "wholesale_price", "type": "number" },
      { "name": "current_stock", "type": "number" },
      { "name": "min_stock", "type": "number" },
      { "name": "category_id", "type": "text" }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  },
  {
    "name": "customers",
    "type": "base",
    "system": false,
    "schema": [
      { "name": "name", "type": "text", "required": true, "presentable": true },
      { "name": "phone", "type": "text" },
      { "name": "address", "type": "text" },
      { "name": "total_debt", "type": "number" },
      { "name": "credit_limit", "type": "number" }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  },
  {
    "name": "suppliers",
    "type": "base",
    "system": false,
    "schema": [
      { "name": "name", "type": "text", "required": true, "presentable": true },
      { "name": "phone", "type": "text" },
      { "name": "address", "type": "text" }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  },
  {
    "name": "shifts",
    "type": "base",
    "system": false,
    "schema": [
      { "name": "user_id", "type": "text" },
      { "name": "user_name", "type": "text" },
      { "name": "opening_cash", "type": "number" },
      { "name": "closing_cash", "type": "number" },
      { "name": "expected_cash", "type": "number" },
      { "name": "difference", "type": "number" },
      { "name": "notes", "type": "text" },
      { "name": "opened_at", "type": "date" },
      { "name": "closed_at", "type": "date" },
      { "name": "status", "type": "text" }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  },
  {
    "name": "sales",
    "type": "base",
    "system": false,
    "schema": [
      { "name": "invoice_no", "type": "text", "required": true, "presentable": true },
      { "name": "user_id", "type": "text" },
      { "name": "user_name", "type": "text" },
      { "name": "shift_id", "type": "text" },
      { "name": "customer_id", "type": "text" },
      { "name": "customer_name", "type": "text" },
      { "name": "subtotal", "type": "number" },
      { "name": "discount", "type": "number" },
      { "name": "total", "type": "number", "required": true },
      { "name": "paid_amount", "type": "number" },
      { "name": "change_amount", "type": "number" },
      { "name": "debt_amount", "type": "number" },
      { "name": "payment_summary", "type": "text" },
      { "name": "status", "type": "text" }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  },
  {
    "name": "expenses",
    "type": "base",
    "system": false,
    "schema": [
      { "name": "user_id", "type": "text" },
      { "name": "shift_id", "type": "text" },
      { "name": "category", "type": "text" },
      { "name": "amount", "type": "number", "required": true },
      { "name": "notes", "type": "text" }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  },
  {
    "name": "debts",
    "type": "base",
    "system": false,
    "schema": [
      { "name": "customer_id", "type": "text" },
      { "name": "customer_name", "type": "text" },
      { "name": "sale_id", "type": "text" },
      { "name": "invoice_no", "type": "text" },
      { "name": "amount", "type": "number", "required": true },
      { "name": "paid", "type": "number" },
      { "name": "status", "type": "text" }
    ],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": ""
  }
], null, 2)
