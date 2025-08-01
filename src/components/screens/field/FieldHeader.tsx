import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Compass } from "lucide-react";
import { AvatarDropdown } from "@/components/AvatarDropdown";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationsSheet } from "@/components/notifications/NotificationsSheet";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

interface FieldHeaderProps {
  className?: string;
  style?: React.CSSProperties;
  onNavigate?: () => void;
  showMiniMap?: boolean;
  onToggleMiniMap?: () => void;
  venueCount?: number;
  onOpenVenues?: () => void;
}

export const FieldHeader = ({ 
  className,
  style,
  onNavigate,
  showMiniMap,
  onToggleMiniMap,
  venueCount = 0,
  onOpenVenues
}: FieldHeaderProps) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  return (
    <header 
      className={cn(
        "flex items-center justify-between px-6 pt-safe-top h-16",
        "pointer-events-auto relative",
        "bg-background/60 backdrop-blur-xl",
        "border-b border-border/20",
        className
      )}
      style={style}
    >
      {/* Left: Empty space for balance */}
      <div className="w-[120px]" />
      
      {/* Center: Logo */}
      <div 
        className="text-2xl font-light tracking-wide text-primary cursor-pointer"
        onClick={() => {
          track('posthog_test', { 
            source: 'field_header',
            timestamp: new Date().toISOString(),
            test: true
          });
          // Analytics event sent
        }}
      >
        floq
      </div>
      
      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        
        {onToggleMiniMap && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onToggleMiniMap}
            className={cn(
              "p-2 transition-colors",
              showMiniMap ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Compass className="w-4 h-4" />
          </Button>
        )}
        {/* Nearby venues icon with badge */}
        {onOpenVenues && (
          <button
            aria-label={`${venueCount} venues nearby`}
            onClick={onOpenVenues}
            className="relative text-primary hover:text-primary/80 transition-colors p-2"
          >
            <MapPin className="w-5 h-5" />
            {venueCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive text-[10px] font-semibold leading-none text-destructive-foreground shadow">
                {venueCount > 9 ? '9+' : venueCount}
              </span>
            )}
          </button>
        )}
        
        <NotificationBell 
          onClick={() => setNotificationsOpen(true)}
          className="pointer-events-auto"
        />
        
        <AvatarDropdown />
      </div>
      
      <NotificationsSheet 
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />
    </header>
  );
};