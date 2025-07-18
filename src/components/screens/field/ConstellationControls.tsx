import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { ConstellationGestureSystem } from "@/components/ConstellationGestureSystem";
import isEqual from 'react-fast-compare';

interface ConstellationControlsProps {
  timeState: string;
  constellationMode: boolean;
  onConstellationToggle: () => void;
  onConstellationAction: (action: any) => void;
  onOrbitalAdjustment: (direction: 'expand' | 'contract', intensity: number) => void;
  onEnergyShare: (fromId: string, toId: string, energy: number) => void;
}

export const ConstellationControls = memo(({
  timeState,
  constellationMode,
  onConstellationToggle,
  onConstellationAction,
  onOrbitalAdjustment,
  onEnergyShare
}: ConstellationControlsProps) => {
  return (
    <>
      {/* Constellation Gesture System */}
      <ConstellationGestureSystem 
        onConstellationAction={onConstellationAction}
        onOrbitalAdjustment={onOrbitalAdjustment}
        onEnergyShare={onEnergyShare}
        isActive={constellationMode}
      />

      {/* Constellation Mode Toggle */}
      <div className="absolute top-32 right-4 pointer-events-auto">
        <Button
          variant={constellationMode ? "default" : "outline"}
          size="sm"
          className="bg-card/80 backdrop-blur-xl border border-border/30 min-h-[44px] min-w-[44px]"
          onClick={onConstellationToggle}
        >
          <Star className="w-4 h-4 mr-2" />
          {constellationMode ? 'Field View' : 'Constellation'}
        </Button>
      </div>
    </>
  );
}, isEqual);

ConstellationControls.displayName = 'ConstellationControls';