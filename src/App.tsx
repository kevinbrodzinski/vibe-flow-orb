
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/providers/AuthProvider";
import { BannerProvider } from "@/providers/BannerProvider";
import { VibeRealtime } from "@/providers/VibeRealtime";
import { usePresenceChannel } from "@/hooks/usePresenceChannel";
import { PlanInviteProvider } from "@/components/providers/PlanInviteProvider";
import { NetworkStatusBanner } from "@/components/ui/NetworkStatusBanner";
import { supabase } from "@/integrations/supabase/client";
import { clusterWorker } from "@/lib/clusterWorker";

import { EnvironmentDebugPanel } from "@/components/EnvironmentDebugPanel";
import { useEnvironmentDebug } from "@/hooks/useEnvironmentDebug";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import SharedAfterglow from "./pages/SharedAfterglow";
import SharedPlan from "./pages/SharedPlan";
import { PlanInvite } from "./pages/PlanInvite";

const queryClient = new QueryClient();

const App = () => {
  const { isDebugPanelOpen, setIsDebugPanelOpen, environmentConfig } = useEnvironmentDebug();
  
  // Auto-join presence channels for all users
  usePresenceChannel();

  // Pre-warm the clustering worker
  useEffect(() => {
    // Empty call warms the Comlink proxy & spins the worker
    clusterWorker.cluster([], 11);
  }, []);

  // Realtime subscription for floq messages
  useEffect(() => {
    const channel = supabase
      .channel('floq_messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'floq_messages' },
        (payload) => {
          // Only handle INSERT events to avoid crashes on DELETE where payload.new is null
          if (payload.eventType !== 'INSERT') return
          
          queryClient.setQueryData(['floq-msgs', payload.new.floq_id], (d: any) => {
            if (!d) return d
            // avoid dupes
            if (d.pages[0].some((m: any) => m.id === payload.new.id)) return d
            d.pages[0].unshift(payload.new)
            return { ...d }
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel);
    }
  }, []);
  
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <VibeRealtime />
        <BannerProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <NetworkStatusBanner />
            <BrowserRouter>
              <PlanInviteProvider />
              <Routes>
                {/* Public shared routes - no auth required */}
                <Route path="/a/:slug" element={<SharedAfterglow />} />
                <Route path="/share/:slug" element={<SharedPlan />} />
                <Route path="/invite/:slug" element={<PlanInvite />} />
                {/* Settings route */}
                <Route path="/settings/profile" element={<Settings />} />
                {/* Main app routes (field, floqs, etc.) are handled inside Index */}
                <Route path="/*" element={<Index />} />
              </Routes>
              {/* Environment Debug Panel - Ctrl+Shift+E to toggle */}
              <EnvironmentDebugPanel 
                isOpen={isDebugPanelOpen} 
                onClose={() => setIsDebugPanelOpen(false)}
                debugConfig={environmentConfig}
                onConfigChange={(config) => {
                  // Update environment config - this would typically sync to localStorage
                  Object.keys(config).forEach(key => {
                    if (config[key] !== environmentConfig[key]) {
                      // Handle config changes if needed
                    }
                  });
                }}
              />
            </BrowserRouter>
          </TooltipProvider>
        </BannerProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
