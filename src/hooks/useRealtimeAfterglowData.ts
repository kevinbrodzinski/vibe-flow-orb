import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/providers/AuthProvider'
import { Database } from '@/integrations/supabase/types'
import { useToast } from '@/hooks/use-toast'

type DailyAfterglowRow = Database['public']['Tables']['daily_afterglow']['Row'];

interface GenerationProgress {
  step: string
  progress: number
  status: 'in_progress' | 'completed' | 'error'
  message?: string
}

export function useRealtimeAfterglowData(date: string) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [afterglow, setAfterglow] = useState<DailyAfterglowRow | null>(null)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!user || !date) return

    // Subscribe to daily_afterglow changes
    const afterglowChannel = supabase
      .channel(`afterglow-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_afterglow',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if ((payload.new as any)?.date !== date) return // Secondary filter for date
          
          console.log('Afterglow changed:', payload)
          setAfterglow(payload.new as DailyAfterglowRow)
          setIsGenerating(false)
          setGenerationProgress(null)
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Afterglow Ready! ✨",
              description: "Your daily afterglow has been generated and is ready to view.",
            })
          } else if (payload.eventType === 'UPDATE' && payload.new.regenerated_at !== payload.old?.regenerated_at) {
            toast({
              title: "Afterglow Updated! 🔄",
              description: "Your afterglow has been refreshed with new data.",
            })
          }
        }
      )
      .subscribe()

    // Subscribe to generation progress updates
    const progressChannel = supabase
      .channel(`progress-${user.id}`)
      .on(
        'broadcast',
        { event: 'afterglow_progress' },
        (payload) => {
          const progress = payload.payload as GenerationProgress
          console.log('Generation progress:', progress)
          setGenerationProgress(progress)
          
          if (progress.status === 'completed') {
            setIsGenerating(false)
            setGenerationProgress(null)
          } else if (progress.status === 'error') {
            setIsGenerating(false)
            setGenerationProgress(null)
            toast({
              title: "Generation Failed",
              description: String(progress.message || "Failed to generate afterglow. Please try again."),
              variant: "destructive"
            })
          }
        }
      )
      .on(
        'broadcast',
        { event: 'ai_summary_generated' },
        (payload) => {
          console.log('AI summary generated:', payload)
          
          // Update the afterglow with the new AI summary
          setAfterglow(prev => prev ? {
            ...prev,
            ai_summary: payload.payload.ai_summary,
            ai_summary_generated_at: new Date().toISOString()
          } : prev)
        }
      )
      .subscribe()

    return () => {
      afterglowChannel && void supabase.removeChannel(afterglowChannel)
      progressChannel && void supabase.removeChannel(progressChannel)
    }
  }, [user?.id, date, toast])

  // Separate effect for moments subscription that depends on afterglow.id
  useEffect(() => {
    if (!afterglow?.id) return

    const momentsChannel = supabase
      .channel(`moments-${afterglow.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'afterglow_moments',
          filter: `daily_afterglow_id=eq.${afterglow.id}`
        },
        (payload) => {
          console.log('New moment added:', payload)
          setAfterglow(prev => {
            if (!prev) return prev
            const currentMoments = Array.isArray(prev.moments) ? prev.moments : [];
            return {
              ...prev,
              moments: [...currentMoments, JSON.stringify(payload.new)]
            }
          })
          
          toast({
            title: "New Moment Added! 🎭",
            description: String(payload.new.title) + " has been added to your afterglow.",
          })
        }
      )
      .subscribe()

    return () => {
      momentsChannel && void supabase.removeChannel(momentsChannel)
    }
  }, [afterglow?.id, toast])

  const startGeneration = (): void => {
    setIsGenerating(true)
    setGenerationProgress({
      step: 'Initializing',
      progress: 0,
      status: 'in_progress',
      message: 'Starting afterglow generation...'
    })
  }

  // On-demand refresh function
  const refresh = useCallback(async () => {
    if (!user) return;

    console.log('Manually refreshing afterglow...');
    setIsGenerating(true);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('generate-daily-afterglow', {
        body: { user_id: user.id, date, force_regenerate: true }
      });

      if (error) {
        console.error('Error generating afterglow:', error);
        toast({
          title: "Generation Failed",
          description: "Failed to generate afterglow. Please try again.",
          variant: "destructive"
        });
      } else {
        console.log('Afterglow generation triggered:', result);
        toast({
          title: "Regenerating...",
          description: "Your afterglow is being refreshed with the latest data."
        });
      }
    } catch (error) {
      console.error('Failed to trigger afterglow generation:', error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  }, [user?.id, date, toast]);

  // Check if data is stale
  const isStale = (afterglow as any)?.is_stale || false;

  return {
    afterglow,
    setAfterglow,
    generationProgress,
    isGenerating,
    startGeneration,
    refresh,
    isStale,
    loading: isGenerating && !afterglow
  }
}