-- Migration: Add vocabulary_meanings table to support multiple word types and meanings
-- Copy toàn bộ file này và chạy trong Supabase SQL Editor

-- Vocabulary meanings table (for multiple word types and meanings per word)
CREATE TABLE IF NOT EXISTS vocabulary_meanings (
  id SERIAL PRIMARY KEY,
  vocabulary_id INTEGER NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  word_type TEXT NOT NULL, -- noun, verb, adjective, adverb, etc.
  english_definition TEXT,
  vietnamese_meaning TEXT,
  example_sentence TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_vocabulary_meanings_vocab ON vocabulary_meanings(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_meanings_type ON vocabulary_meanings(word_type);

-- Migrate existing data (optional - if you want to preserve old data)
-- This will create a meaning entry for each existing vocabulary entry
INSERT INTO vocabulary_meanings (vocabulary_id, word_type, english_definition, vietnamese_meaning, example_sentence)
SELECT 
  id,
  'general' as word_type,
  english_definition,
  vietnamese_meaning,
  example_sentence
FROM vocabulary
WHERE english_definition IS NOT NULL 
   OR vietnamese_meaning IS NOT NULL 
   OR example_sentence IS NOT NULL;

