-- Row Level Security Policies for dashboards table
CREATE POLICY "Users can view their own dashboards"
  ON dashboards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dashboards"
  ON dashboards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards"
  ON dashboards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards"
  ON dashboards FOR DELETE
  USING (auth.uid() = user_id);

-- Row Level Security Policies for check_results table
CREATE POLICY "Users can view check results for their dashboards"
  ON check_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = check_results.dashboard_id
      AND dashboards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create check results for their dashboards"
  ON check_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM dashboards
      WHERE dashboards.id = check_results.dashboard_id
      AND dashboards.user_id = auth.uid()
    )
  );

-- Row Level Security Policies for page_results table
CREATE POLICY "Users can view page results for their dashboards"
  ON page_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM check_results
      JOIN dashboards ON dashboards.id = check_results.dashboard_id
      WHERE check_results.id = page_results.check_result_id
      AND dashboards.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create page results for their dashboards"
  ON page_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM check_results
      JOIN dashboards ON dashboards.id = check_results.dashboard_id
      WHERE check_results.id = page_results.check_result_id
      AND dashboards.user_id = auth.uid()
    )
  );