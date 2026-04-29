-- Migration: replace kb_category PG enum with kb_categories FK table
-- Run this once on any existing DB that already has knowledge_documents rows.
-- On a fresh DB, just restart the backend — create_all + seed handles everything.

-- 1. Create the new table (if not already created by create_all)
CREATE TABLE IF NOT EXISTS kb_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(50)  UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 2. Seed initial categories
INSERT INTO kb_categories (slug, name, sort_order) VALUES
    ('integrations', 'Integrations', 1),
    ('automations',  'Automations',  2),
    ('issues',       'Issues',       3)
ON CONFLICT (slug) DO NOTHING;

-- 3. Add the new FK column
ALTER TABLE knowledge_documents
    ADD COLUMN IF NOT EXISTS kb_category_id UUID
        REFERENCES kb_categories(id) ON DELETE SET NULL;

-- 4. Backfill from the old enum column
UPDATE knowledge_documents kd
   SET kb_category_id = kc.id
  FROM kb_categories kc
 WHERE kc.slug = kd.category::text
   AND kd.kb_category_id IS NULL;

-- 5. Drop the old enum column
ALTER TABLE knowledge_documents DROP COLUMN IF EXISTS category;

-- 6. Drop the PG enum type (only safe after the column is gone)
DROP TYPE IF EXISTS kb_category;
