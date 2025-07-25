import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAISummary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const summaryMutation = useMutation({
    mutationFn: async (afterglowId: string) => {
      if (!afterglowId) {
        throw new Error("Afterglow ID is required");
      }

      // Add 10s timeout for OpenAI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const { data, error } = await supabase.functions.invoke('generate-intelligence', {
          body: { mode: 'afterglow', afterglow_id: afterglowId }
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error('AI summary error:', error);
          throw new Error('Unable to generate AI summary');
        }

        if (!data?.ai_summary) {
          throw new Error('Invalid response from AI service');
        }

        return data.ai_summary;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          toast({
            title: "Timed out",
            description: "OpenAI took too long. Try again.",
            variant: "destructive"
          });
          throw new Error('Request timeout - please try again');
        }
        throw error;
      }
    },
    onSuccess: (summary, afterglowId) => {
      toast({
        title: "Summary Generated",
        description: "AI summary has been created for your afterglow!",
      });
      
      // Invalidate afterglow queries using consistent key format
      queryClient.invalidateQueries({ queryKey: ['afterglow'] });
    },
    onError: (error) => {
      toast({
        title: "Summary Generation Failed",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    }
  });

  return {
    generateSummary: (id: string) => summaryMutation.mutateAsync(id),
    isGenerating: summaryMutation.isPending
  };
}