/* ====================================================================== */
/*  AFTERGLOW – TREND & SPARKLINE QUERIES                                 */
/* ====================================================================== */

-- ==============================================================
-- 1. Weekly energy / social trend over the last 8 calendar weeks
-- ==============================================================

CREATE OR REPLACE FUNCTION public.get_afterglow_weekly_trends (
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  week_start      date,
  avg_energy      numeric(10,2),
  avg_social      numeric(10,2),
  day_count       integer,
  energy_trend    text,
  social_trend    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH weekly_stats AS (
    SELECT
      date_trunc('week', da.date)::date               AS week_start,
      AVG(da.energy_score)::numeric(10,2)             AS avg_energy,
      AVG(da.social_intensity)::numeric(10,2)         AS avg_social,
      COUNT(*)                                        AS day_count
    FROM  daily_afterglow da
    WHERE da.user_id = p_user_id
      AND da.date >= CURRENT_DATE - INTERVAL '8 weeks'
    GROUP BY 1
  ),
  trend_analysis AS (
    SELECT
      ws.*,
      LAG(ws.avg_energy) OVER (ORDER BY ws.week_start)  AS prev_energy,
      LAG(ws.avg_social) OVER (ORDER BY ws.week_start)  AS prev_social
    FROM weekly_stats ws
  )
  SELECT
    ta.week_start,
    ta.avg_energy,
    ta.avg_social,
    ta.day_count,
    CASE
      WHEN ta.prev_energy IS NULL                     THEN 'stable'
      WHEN ta.avg_energy  >= ta.prev_energy + 5       THEN 'improving'
      WHEN ta.avg_energy  <= ta.prev_energy - 5       THEN 'declining'
      ELSE 'stable'
    END                                               AS energy_trend,
    CASE
      WHEN ta.prev_social IS NULL                     THEN 'stable'
      WHEN ta.avg_social  >= ta.prev_social + 5       THEN 'improving'
      WHEN ta.avg_social  <= ta.prev_social - 5       THEN 'declining'
      ELSE 'stable'
    END                                               AS social_trend
  FROM trend_analysis ta
  ORDER BY ta.week_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_afterglow_weekly_trends(uuid) TO authenticated;



-- ==============================================================
-- 2. Daily spark-line data for the last 30 days + rolling 7-day mean
-- ==============================================================

CREATE OR REPLACE FUNCTION public.get_afterglow_daily_trends (
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  day                date,
  energy_score       integer,
  social_intensity   integer,
  total_moments      integer,
  rolling_energy_7d  numeric(10,2),
  rolling_social_7d  numeric(10,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH daily_data AS (
    SELECT
      da.date                                         AS day,
      COALESCE(da.energy_score,0)                     AS energy_score,
      COALESCE(da.social_intensity,0)                 AS social_intensity,
      (
        SELECT COUNT(*)
        FROM   afterglow_moments am
        WHERE  am.daily_afterglow_id = da.id
      )                                               AS total_moments
    FROM  daily_afterglow da
    WHERE da.user_id = p_user_id
      AND da.date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY da.date
  )
  SELECT
    dd.day,
    dd.energy_score,
    dd.social_intensity,
    dd.total_moments,
    AVG(dd.energy_score)::numeric(10,2)  OVER (
      ORDER BY dd.day
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    )                                   AS rolling_energy_7d,
    AVG(dd.social_intensity)::numeric(10,2) OVER (
      ORDER BY dd.day
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    )                                   AS rolling_social_7d
  FROM daily_data dd
  ORDER BY dd.day;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_afterglow_daily_trends(uuid) TO authenticated;


/* ======================================================================
   Index note: both functions rely on daily_afterglow (user_id, date)
   – you already have idx_daily_afterglow_user_date covering this.
   ====================================================================== */