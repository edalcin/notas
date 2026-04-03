-- Normalize all hashtag names to lowercase and merge case-insensitive duplicates.
-- Keeps the row with the lowest id as the canonical record for each lowercase name.

-- Step 1: Re-link note_hashtags from duplicate rows to the canonical (min id) row.
-- INSERT OR IGNORE avoids PK conflicts when the note is already linked to the canonical id.
INSERT OR IGNORE INTO note_hashtags (note_id, hashtag_id)
SELECT nh.note_id,
       (SELECT MIN(h2.id) FROM hashtags h2 WHERE LOWER(h2.name) = LOWER(h.name)) AS canonical_id
FROM note_hashtags nh
JOIN hashtags h ON nh.hashtag_id = h.id
WHERE h.id != (SELECT MIN(h2.id) FROM hashtags h2 WHERE LOWER(h2.name) = LOWER(h.name));

-- Step 2: Delete note_hashtags rows that still point to non-canonical ids.
DELETE FROM note_hashtags
WHERE hashtag_id IN (
    SELECT id FROM hashtags h
    WHERE h.id != (SELECT MIN(h2.id) FROM hashtags h2 WHERE LOWER(h2.name) = LOWER(h.name))
);

-- Step 3: Delete the non-canonical hashtag rows.
-- Uses GROUP BY to avoid the correlated-subquery column-scope ambiguity in SQLite.
DELETE FROM hashtags
WHERE id NOT IN (
    SELECT MIN(id) FROM hashtags GROUP BY LOWER(name)
);

-- Step 4: Lowercase the canonical rows that still have mixed-case names.
UPDATE hashtags SET name = LOWER(name) WHERE name != LOWER(name);
