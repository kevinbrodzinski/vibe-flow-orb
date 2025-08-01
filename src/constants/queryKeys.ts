export const QK = {
  Spark: (id: string) => ['spark', 'v_friend_sparkline', 'v1', id] as const,
  VenueInsights: (ver = 'v1') => ['venue-insights', ver] as const,
  ProfileStats: (userId: string, ver = 'v1') => ['profile-stats', userId, ver] as const,
  AnnualRecap: (ver = 'v1') => ['annual-recap', ver] as const,
} as const;