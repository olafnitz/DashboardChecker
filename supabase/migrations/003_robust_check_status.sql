-- Migration to support robust check states and page counting
ALTER TABLE check_results DROP CONSTRAINT IF EXISTS check_results_overall_status_check;
ALTER TABLE check_results ADD CONSTRAINT check_results_overall_status_check CHECK (overall_status IN ('ok', 'error', 'running', 'incomplete'));
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS total_pages INTEGER;
ALTER TABLE check_results ADD COLUMN IF NOT EXISTS completed_pages INTEGER DEFAULT 0;
