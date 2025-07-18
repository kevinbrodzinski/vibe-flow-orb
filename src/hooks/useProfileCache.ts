import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SearchedUser } from '@/hooks/useUserSearch';
import { getEnvironmentConfig } from '@/lib/environment';
import { Profile } from '@/types/profile';

export function useProfileCache() {
  const queryClient = useQueryClient();

  const primeProfiles = (users: SearchedUser[]) => {
    users.forEach(user => {
      queryClient.setQueryData(['profile:v2', user.id], {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      });
    });
  };

  return {
    primeProfiles,
  };
}

export function useProfile(userId: string) {
  const env = getEnvironmentConfig();
  
  if (env.presenceMode === 'offline' || env.presenceMode === 'mock') {
    // Return mock profile with deterministic but varied data
    const names = ['Alex Chen', 'Jordan Smith', 'Casey Williams', 'Morgan Davis'];
    const usernames = ['alex_chen', 'jordan_smith', 'casey_williams', 'morgan_davis'];
    const index = Math.abs(userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % names.length;
    
    const mockProfile: Profile = {
      id: userId,
      username: usernames[index],
      display_name: names[index],
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
    };

    return {
      data: mockProfile,
      isLoading: false,
      error: null,
      isError: false,
      isSuccess: true,
    };
  }

  // Live mode - implement real profile fetching using React Query
  return useQuery({
    queryKey: ['profile:v2', userId],
    queryFn: async (): Promise<Profile> => {
      if (import.meta.env.DEV) {
        console.log(`🔍 [PROFILE] Fetching profile for user: ${userId}`);
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV) {
          console.error(`❌ [PROFILE] Error fetching profile for ${userId}:`, error);
        }
        throw error;
      }
      
      if (!data) {
        if (import.meta.env.DEV) {
          console.warn(`⚠️ [PROFILE] No profile found for user: ${userId}`);
        }
        throw new Error(`Profile not found for user ${userId}`);
      }
      
      if (import.meta.env.DEV) {
        console.log(`✅ [PROFILE] Successfully fetched profile for ${userId}:`, data.username);
      }
      return data as Profile;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}