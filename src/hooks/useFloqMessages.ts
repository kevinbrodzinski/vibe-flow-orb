
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { FloqMessageRow } from '@/types/database'

export function useFloqMessages(floqId: string) {
  return useInfiniteQuery({
    queryKey: ['floq-messages', floqId],
    queryFn: async ({ pageParam = 0 }) => {
      const limit = 20
      const offset = pageParam * limit

      const { data, error } = await supabase
        .from('floq_messages')
        .select(`
          id,
          body,
          emoji,
          created_at,
          sender_id,
          profiles!inner(username, display_name, avatar_url)
        `)
        .eq('floq_id', floqId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
        .returns<FloqMessageRow[]>()

      if (error) throw error

      // Map to expected format
      return (data || []).map(msg => ({
        id: msg.id,
        body: msg.body || '',
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        profiles: msg.profiles
      }))
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 20 ? allPages.length : undefined
    },
    enabled: !!floqId,
  })
}

export function useSendFloqMessage() {
  return useMutation({
    mutationFn: async (p: { floqId: string; body: string; emoji?: string }) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')
      
      const { error } = await supabase.from('floq_messages').insert({
        floq_id: p.floqId,
        body: p.body,
        emoji: p.emoji ?? null,
        sender_id: user.user.id,
      })
      if (error) throw error
    },
  })
}
