import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

// Cache user ID to avoid repeated auth calls
let cachedUserId: string | null = null

async function getCurrentUserId() {
  if (cachedUserId) return cachedUserId
  
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    cachedUserId = user.id
  }
  return cachedUserId
}

// Hook to get check-in status for a specific stop
export function useCheckInStatus(planId: string, stopId: string) {
  return useQuery({
    queryKey: ['check-in-status', planId, stopId],
    queryFn: async () => {
      const userId = await getCurrentUserId()
      if (!userId) return null

      const { data, error } = await supabase
        .from('plan_check_ins')
        .select('*')
        .eq('plan_id', planId)
        .eq('stop_id', stopId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching check-in status:', error)
        throw error
      }

      return data
    },
    enabled: !!planId && !!stopId,
  })
}
