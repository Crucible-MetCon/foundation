import {
  pgTable,
  serial,
  text,
  numeric,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

export const pmxTrades = pgTable(
  "pmx_trades",
  {
    id: serial("id").primaryKey(),
    docNumber: text("doc_number").unique(),
    tradeDate: timestamp("trade_date", { mode: "date" }),
    valueDate: timestamp("value_date", { mode: "date" }),
    symbol: text("symbol").notNull(), // XAUUSD, USDZAR
    side: text("side").notNull(), // BUY, SELL
    quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),
    price: numeric("price", { precision: 18, scale: 8 }).notNull(),
    narration: text("narration"),
    settleCurrency: text("settle_currency"),
    settleAmount: numeric("settle_amount", { precision: 18, scale: 4 }),
    orderId: text("order_id"), // MetCon trade number
    clordId: text("clord_id"),
    fncNumber: text("fnc_number"),
    traderName: text("trader_name"),
    sourceSystem: text("source_system"), // PMX, StoneX, Manual
    restTradeId: text("rest_trade_id"),
    fixTradeId: text("fix_trade_id"),
    rawPayload: jsonb("raw_payload"), // Full API response
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_pmx_trade_date").on(t.tradeDate),
    index("idx_pmx_symbol").on(t.symbol),
    index("idx_pmx_order_id").on(t.orderId),
    index("idx_pmx_fnc_number").on(t.fncNumber),
    index("idx_pmx_doc_number").on(t.docNumber),
  ]
);
