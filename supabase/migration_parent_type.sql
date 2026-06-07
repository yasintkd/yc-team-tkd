ALTER TABLE athletes ADD COLUMN IF NOT EXISTS parent_type text CHECK (parent_type IS NULL OR parent_type IN ('anne', 'baba'));
