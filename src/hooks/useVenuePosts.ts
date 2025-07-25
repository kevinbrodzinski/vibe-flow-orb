import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VenuePost {
  id: string;
  content_type: string;
  text_content: string;
  vibe: string;
  mood_tags: string[];
  created_at: string;
  view_count: number;
  reaction_count: number;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

export const useVenuePosts = (venueId: string | null) => {
  return useQuery({
    queryKey: ["venue-posts", venueId],
    queryFn: async (): Promise<VenuePost[]> => {
      if (!venueId) {
        throw new Error("Venue ID is required");
      }

      const { data, error } = await supabase.functions.invoke(
        "get-venue-intelligence",
        {
          body: { venue_id: venueId, mode: "posts" }
        }
      );

      if (error) {
        console.error('useVenuePosts error:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!venueId,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: (failureCount, error) => {
      console.log('useVenuePosts retry attempt:', failureCount, error?.message);
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });
};