-- paisa — authoritative schema (idempotent).
-- Safe to run on every startup: CREATE EXTENSION / TABLE / INDEX IF NOT EXISTS.

-- gen_random_uuid() lives in pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform    text NOT NULL,
    date        date NOT NULL,
    order_id    text,
    item_total  numeric(10, 2) NOT NULL DEFAULT 0,
    total_paid  numeric(10, 2) NOT NULL DEFAULT 0,
    source      text NOT NULL CHECK (source IN ('pdf', 'image', 'manual')),
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name        text NOT NULL,
    mrp         numeric(10, 2),
    discount    numeric(10, 2) NOT NULL DEFAULT 0,
    paid        numeric(10, 2) NOT NULL,
    category    text NOT NULL
);

-- ---------------------------------------------------------------------------
-- charges  (NEVER folded into items / category budgets; Platform Fees tab only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charges (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type        text NOT NULL CHECK (
                    type IN ('delivery', 'handling', 'platform_fee',
                             'packaging', 'rain_fee', 'taxes', 'other')),
    amount      numeric(10, 2) NOT NULL
);

-- ---------------------------------------------------------------------------
-- budgets  (one limit per category per month)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category      text NOT NULL,
    month         date NOT NULL,
    limit_amount  numeric(10, 2) NOT NULL,
    UNIQUE (category, month)
);

-- ---------------------------------------------------------------------------
-- push_subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint     text UNIQUE NOT NULL,
    p256dh       text NOT NULL,
    auth         text NOT NULL,
    notify_hour  int NOT NULL DEFAULT 22,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- category_corrections  (learned overrides; item_key = lower(trim(name)))
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category_corrections (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_key    text UNIQUE NOT NULL,
    category    text NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_order_id   ON items (order_id);
CREATE INDEX IF NOT EXISTS idx_items_category   ON items (category);
CREATE INDEX IF NOT EXISTS idx_charges_order_id ON charges (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_date      ON orders (date);
