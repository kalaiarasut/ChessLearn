-- 1. Create bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references discussion_posts(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique (user_id, post_id)
);

-- Enable RLS for bookmarks
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own bookmarks"
ON bookmarks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks"
ON bookmarks FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can select their own bookmarks"
ON bookmarks FOR SELECT
USING (auth.uid() = user_id);

-- 2. Add hashtags array column to discussion_posts
ALTER TABLE discussion_posts
ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}'::text[];

-- 3. Create function and trigger to populate hashtags
CREATE OR REPLACE FUNCTION extract_hashtags()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL THEN
    NEW.hashtags := ARRAY(
      SELECT DISTINCT lower(match[1])
      FROM regexp_matches(NEW.content, '#([A-Za-z0-9_]+)', 'g') AS match
    );
  ELSE
    NEW.hashtags := '{}'::text[];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_hashtags_trigger ON discussion_posts;
CREATE TRIGGER update_hashtags_trigger
BEFORE INSERT OR UPDATE OF content ON discussion_posts
FOR EACH ROW
EXECUTE FUNCTION extract_hashtags();

-- Retroactively populate hashtags for existing posts
UPDATE discussion_posts
SET hashtags = ARRAY(
  SELECT DISTINCT lower(match[1])
  FROM regexp_matches(content, '#([A-Za-z0-9_]+)', 'g') AS match
)
WHERE content IS NOT NULL;

-- 4. Create get_trending_hashtags RPC
CREATE OR REPLACE FUNCTION get_trending_hashtags(limit_count int)
RETURNS TABLE (hashtag text, count bigint) AS $$
BEGIN
  RETURN QUERY
  SELECT h.hashtag, COUNT(*) AS count
  FROM discussion_posts p,
       unnest(p.hashtags) AS h(hashtag)
  WHERE p.created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY h.hashtag
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
