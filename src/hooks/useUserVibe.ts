import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserVibe {
  vibe: string;
  started_at: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export function useUserVibe(userId: string | null) {
  return useQuery({
    queryKey: ['user-vibe', userId],
    queryFn: async (): Promise<UserVibe | null> => {
      if (!userId) return null;
      
      try {
        const { data, error } = await supabase
          .from('user_vibe_states')
          .select('vibe_tag, started_at, location')
          .eq('user_id', userId)
          .eq('active', true)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;
        
        if (data.location) {
          // Extract lat/lng from PostGIS geometry
          const coords = data.location as any;
          if (coords?.coordinates) {
            return {
              vibe: data.vibe_tag,
              started_at: data.started_at,
              location: {
                lng: coords.coordinates[0],
                lat: coords.coordinates[1]
              }
            };
          }
        }
        
        return {
          vibe: data.vibe_tag,
          started_at: data.started_at
        };
      } catch (error) {
        console.error('Error fetching user vibe:', error);
        return null;
      }
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute - vibe data changes frequently
  });
}