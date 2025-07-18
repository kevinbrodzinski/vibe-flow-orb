import { useState } from 'react'
import { motion, PanInfo } from 'framer-motion'
import { Plus, GripVertical } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { MobileGestureEnhancements } from '@/components/MobileGestureEnhancements'
import { TimelineGrid } from './TimelineGrid'
import { cn } from '@/lib/utils'
import type { PlanStop } from '@/types/plan'

interface MobileTimelineGridProps {
  planId: string
  planStatus: string
  startTime?: string
  endTime?: string
  activeParticipants?: any[]
  connectionStatus?: 'connecting' | 'connected' | 'disconnected' | 'error'
  isOptimistic?: boolean
  isDragOperationPending?: boolean
  onStopReorder?: (stopId: string, newIndex: number) => void
  onStopSelect?: (stopId: string) => void
  selectedStopIds?: string[]
  recentVotes?: any[]
}

export function MobileTimelineGrid({
  planId,
  planStatus,
  startTime,
  endTime, 
  activeParticipants,
  connectionStatus,
  isOptimistic,
  isDragOperationPending,
  onStopReorder,
  onStopSelect,
  selectedStopIds = [],
  recentVotes = []
}: MobileTimelineGridProps) {
  const isMobile = useIsMobile()
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null)
  const [showCompactView, setShowCompactView] = useState(false)

  if (!isMobile) {
    return (
      <TimelineGrid 
        planId={planId}
        planStatus={planStatus}
        startTime={startTime}
        endTime={endTime}
        activeParticipants={activeParticipants}
        connectionStatus={connectionStatus}
        isOptimistic={isOptimistic}
        isDragOperationPending={isDragOperationPending}
        
      />
    )
  }

  return (
    <MobileGestureEnhancements
      onSwipeLeft={() => setShowCompactView(!showCompactView)}
      onSwipeRight={() => setShowCompactView(!showCompactView)}
      onLongPress={() => onStopSelect?.(selectedStopIds[0] || '')}
      className="w-full min-h-fit"
    >
      <div className={cn(
        "space-y-3 p-4 min-h-fit",
        showCompactView && "space-y-2"
      )}>
        {/* Mobile Header */}
        <div className="flex items-center justify-between bg-card/80 rounded-xl p-3 border sticky top-0 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowCompactView(!showCompactView)}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <GripVertical size={16} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-medium">
              {showCompactView ? 'Compact' : 'Timeline'}
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Swipe ← → to toggle view
          </div>
        </div>

        {/* Mobile Timeline Content */}
        {showCompactView ? (
          <MobileCompactTimeline 
            planId={planId}
            onStopSelect={onStopSelect}
            selectedStopIds={selectedStopIds}
          />
        ) : (
          <MobileExpandedTimeline 
            planId={planId}
            startTime={startTime}
            endTime={endTime}
            onStopReorder={onStopReorder}
            onStopSelect={onStopSelect}
            selectedStopIds={selectedStopIds}
            draggedStopId={draggedStopId}
            setDraggedStopId={setDraggedStopId}
          />
        )}
      </div>
    </MobileGestureEnhancements>
  )
}

// Compact mobile view - scrollable cards
function MobileCompactTimeline({ 
  planId, 
  onStopSelect, 
  selectedStopIds 
}: { 
  planId: string
  onStopSelect?: (stopId: string) => void
  selectedStopIds: string[]
}) {
  return (
    <div className="space-y-2 pb-safe-area-inset-bottom">
      <button
        className="flex flex-col items-center justify-center h-32 rounded-2xl border-2 border-dashed border-muted/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="w-5 h-5 mb-1" />
        <span className="text-sm">Add your first stop</span>
      </button>
    </div>
  )
}

// Expanded mobile view - drag and drop timeline
function MobileExpandedTimeline({ 
  planId,
  startTime,
  endTime,
  onStopReorder,
  onStopSelect,
  selectedStopIds,
  draggedStopId,
  setDraggedStopId
}: { 
  planId: string
  startTime?: string
  endTime?: string
  onStopReorder?: (stopId: string, newIndex: number) => void
  onStopSelect?: (stopId: string) => void
  selectedStopIds: string[]
  draggedStopId: string | null
  setDraggedStopId: (id: string | null) => void
}) {
  return (
    <div className="space-y-4 pb-safe-area-inset-bottom">
      <div className="flex flex-col items-center py-12 text-muted">
        <span className="text-4xl">📍</span>
        <p className="mt-2">No stops yet</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="btn-primary mt-4 px-4 py-2"
        >
          Add your first stop
        </motion.button>
      </div>
    </div>
  )
}