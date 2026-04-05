-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create check_results table
CREATE TABLE IF NOT EXISTS check_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  overall_status TEXT NOT NULL CHECK (overall_status IN ('ok', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create page_results table
CREATE TABLE IF NOT EXISTS page_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  check_result_id UUID NOT NULL REFERENCES check_results(id) ON DELETE CASCADE,
  page_name TEXT,
  page_number INTEGER,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_description TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_check_results_dashboard_id ON check_results(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_check_results_timestamp ON check_results(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_page_results_check_result_id ON page_results(check_result_id);

-- Enable Row Level Security
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_results ENABLE ROW LEVEL SECURITY;