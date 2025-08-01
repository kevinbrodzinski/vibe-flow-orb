import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VenueEnergyMetrics {
  venue_id: string;
  energy_level: number;
  vibe_diversity_score: number;
  dominant_vibe: string;
  people_count: number;
  avg_session_minutes: number;
  active_floq_count: number;
  total_floq_members: number;
  socialTexture: {
    energyPulse: number;
    moodDescription: string;
    socialDynamics: {
      crowdSize: string;
      vibeStability: number;
      sessionIntensity: string;
    };
    timingInsights: {
      recommendation: string;
      trend?: string;
    };
  };
}

export const useVenueEnergy = (venueId: string | null) => {
  return useQuery({
    queryKey: ["venue-energy", venueId],
    queryFn: async (): Promise<VenueEnergyMetrics> => {
      if (!venueId) {
        throw new Error("Venue ID is required");
      }

      console.log('useVenueEnergy calling edge function for:', venueId);

      const { data, error } = await supabase.functions.invoke(
        "get-venue-intelligence",
        {
          body: { venue_id: venueId, mode: "energy" }
        }
      );

      if (error) {
        console.error('useVenueEnergy error:', error);
        throw error;
      }

      if (!data) {
        console.error('useVenueEnergy: no data returned');
        throw new Error("No data returned from venue energy function");
      }

      console.log('useVenueEnergy success:', data.name, data.people_count, 'people');
      return data;
    },
    enabled: !!venueId,
    staleTime: 10000, // 10 seconds
    refetchInterval: 25000, // 25 seconds - slightly faster refresh
    retry: (failureCount, error) => {
      console.log('useVenueEnergy retry attempt:', failureCount, error?.message);
      // Retry up to 2 times, but not for 404s
      if (error?.message?.includes('not found')) return false;
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
};