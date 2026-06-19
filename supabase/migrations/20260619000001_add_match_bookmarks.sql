-- Alter bookmarks table to support matches
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS match_id uuid references matches(id) on delete cascade;

-- Make post_id nullable
ALTER TABLE bookmarks ALTER COLUMN post_id DROP NOT NULL;

-- Add constraint to ensure either post_id or match_id is present
ALTER TABLE bookmarks ADD CONSTRAINT check_bookmark_target 
CHECK ((post_id IS NOT NULL AND match_id IS NULL) OR (post_id IS NULL AND match_id IS NOT NULL));

-- Ensure unique constraint for match bookmarks
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_id_match_id_key UNIQUE (user_id, match_id);
