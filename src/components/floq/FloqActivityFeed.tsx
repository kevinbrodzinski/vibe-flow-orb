import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivityTracking } from '@/hooks/useActivityTracking';
import { useAuth } from '@/providers/AuthProvider';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Zap, 
  Clock, 
  Heart,
  MessageSquare,
  Crown,
  X,
  Trash2,
  Calendar,
  Mail,
  Activity,
  MapPin,
  Rocket
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LazyAvatar } from '@/components/ui/lazy-avatar';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type FlockEventType = Database['public']['Enums']['flock_event_type_enum'];

interface FloqActivityItem {
  id: string;
  event_type: FlockEventType;
  created_at: string;
  user_id: string | null;
  metadata: any;
  // Joined user profile data
  user_profile?: {
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
}

interface FloqActivityFeedProps {
  floqId: string;
  className?: string;
}

export const FloqActivityFeed: React.FC<FloqActivityFeedProps> = ({ 
  floqId, 
  className 
}) => {
  // Note: Activity tracking is now handled by parent component (JoinedFloqView)
  // to ensure it fires when tab becomes visible, not just on mount
  const { data: activities = [], isLoading, error, refetch } = useQuery({
    queryKey: ['floq-activity-feed', floqId],
    queryFn: async (): Promise<FloqActivityItem[]> => {
      const { data, error } = await supabase
        .from('flock_history')
        .select(`
          id,
          event_type,
          created_at,
          user_id,
          metadata,
          profiles:user_id(display_name, username, avatar_url)
        `)
        .eq('floq_id', floqId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        user_profile: item.profiles ? {
          display_name: (item.profiles as any).display_name || 'Unknown',
          username: (item.profiles as any).username || 'unknown',
          avatar_url: (item.profiles as any).avatar_url || null
        } : null,
      }));
    },
    enabled: !!floqId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    refetchIntervalInBackground: false, // Mobile battery optimization
  });

  // Set up real-time subscription for new activity events
  useEffect(() => {
    if (!floqId) return;

    console.log('Setting up real-time subscription for floq activity:', floqId);
    
    const channel = supabase
      .channel(`flock-history-${floqId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'flock_history',
          filter: `floq_id=eq.${floqId}`
        },
        (payload) => {
          console.log('Real-time activity event received:', payload);
          // Refetch the activity data to get the latest events with profile data
          refetch();
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [floqId, refetch]);

  const getEventIcon = (eventType: FlockEventType) => {
    switch (eventType) {
      case 'joined':
        return <UserPlus className="w-4 h-4" />;
      case 'left':
        return <UserMinus className="w-4 h-4" />;
      case 'created':
        return <Crown className="w-4 h-4" />;
      case 'vibe_changed':
        return <Zap className="w-4 h-4" />;
      case 'activity_detected':
        return <Activity className="w-4 h-4" />;
      case 'location_changed':
        return <MapPin className="w-4 h-4" />;
      case 'merged':
      case 'split':
        return <Users className="w-4 h-4" />;
      case 'ended':
        return <X className="w-4 h-4" />;
      case 'deleted':
        return <Trash2 className="w-4 h-4" />;
      case 'boosted':
        return <Rocket className="w-4 h-4" />;
      case 'plan_created':
        return <Calendar className="w-4 h-4" />;
      case 'invited':
        return <Mail className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getEventColor = (eventType: FlockEventType) => {
    switch (eventType) {
      case 'joined':
        return 'text-secondary';
      case 'left':
        return 'text-muted-foreground';
      case 'created':
        return 'text-primary';
      case 'vibe_changed':
        return 'text-accent';
      case 'activity_detected':
        return 'text-accent';
      case 'location_changed':
        return 'text-accent';
      case 'merged':
      case 'split':
        return 'text-accent';
      case 'ended':
        return 'text-destructive';
      case 'deleted':
        return 'text-destructive';
      case 'boosted':
        return 'text-warning';
      case 'plan_created':
        return 'text-secondary';
      case 'invited':
        return 'text-secondary';
      default:
        return 'text-muted-foreground';
    }
  };

  const getEventDescription = (activity: FloqActivityItem) => {
    const userName = activity.user_profile?.display_name || 
                     activity.user_profile?.username || 
                     'Someone';

    switch (activity.event_type) {
      case 'joined':
        return `${userName} joined the floq`;
      case 'left':
        return `${userName} left the floq`;
      case 'created':
        return `${userName} created this floq`;
      case 'vibe_changed':
        const metadata = activity.metadata || {};
        const newVibe = metadata.new_vibe;
        if (newVibe) {
          return `${userName} changed vibe to ${newVibe}`;
        }
        return `${userName} changed the vibe`;
      case 'activity_detected':
        return `${userName} is active`;
      case 'location_changed':
        return `${userName} moved location`;
      case 'merged':
        return `This floq was merged`;
      case 'split':
        return `This floq was split`;
      case 'ended':
        return `${userName} ended the floq`;
      case 'deleted':
        return `${userName} deleted the floq`;
      case 'boosted':
        return `${userName} boosted this floq`;
      case 'plan_created':
        return `${userName} created a plan`;
      case 'invited':
        return `${userName} invited someone to join`;
      default:
        return `${userName} ${activity.event_type}`;
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes === 1) return '1 minute ago';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    return `${diffInDays} days ago`;
  };

  if (isLoading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="space-y-3">
          <h3 className="text-sm font-medium mb-3">Activity Feed</h3>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 animate-pulse">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-3 bg-muted rounded w-3/4" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="text-center py-4">
          <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load activity</p>
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex flex-col items-center py-12 text-muted">
          <span className="text-4xl">🎯</span>
          <p className="mt-2">No activity yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Activity Feed</h3>
        <Badge variant="secondary" className="text-xs">
          {activities.length} events
        </Badge>
      </div>
      
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {activities.map((activity) => {
          const iconElement = getEventIcon(activity.event_type);
          const iconColor = getEventColor(activity.event_type);

          return (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className={cn("mt-0.5 flex-shrink-0", iconColor)}>
                {iconElement}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">
                  {getEventDescription(activity)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRelativeTime(activity.created_at)}
                </p>
              </div>

              {/* Show avatar for user events */}
              {activity.user_profile && activity.event_type !== 'activity_detected' && (
                <LazyAvatar
                  avatarPath={activity.user_profile.avatar_url}
                  displayName={activity.user_profile.display_name}
                  size={24}
                  className="border border-border/40 flex-shrink-0"
                />
              )}

              {/* Show vibe badge for vibe changes */}
              {activity.event_type === 'vibe_changed' && activity.metadata?.new_vibe && (
                <Badge 
                  variant="outline" 
                  className="text-xs capitalize flex-shrink-0"
                >
                  {activity.metadata.new_vibe}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};