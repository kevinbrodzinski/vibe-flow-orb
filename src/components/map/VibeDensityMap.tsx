import React, { useState, useEffect, useMemo, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { createDensityLayer, usePulseLayer, createHaloLayer } from './DeckLayers'
import { ClusterLegend } from './ClusterLegend'
import { useClusters } from '@/hooks/useClusters'
import { useHotspots } from '@/hooks/useHotspots'
import { usePulseTime } from '@/hooks/usePulseTime'
import { getEnvironmentConfig } from '@/lib/environment'
import { Button } from '@/components/ui/button'
import { X, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react'
import type { Cluster } from '@/hooks/useClusters'

// Type assertion for DeckGL component
const DeckGLComponent = DeckGL as any

const INITIAL_VIEW_STATE = {
  longitude: -122.4,
  latitude: 37.8,
  zoom: 11,
  pitch: 45,
  bearing: 0
}

interface Props {
  isOpen: boolean
  onClose: () => void
  userLocation?: { lat: number; lng: number } | null
}

export const VibeDensityMap = ({ isOpen, onClose, userLocation }: Props) => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)

  // Calculate bounding box from current viewport with clamping
  const bbox = useMemo(() => {
    const { longitude, latitude, zoom } = viewState
    const latDelta = 180 / Math.pow(2, zoom) * 2
    const lngDelta = 360 / Math.pow(2, zoom) * 2
    
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
    
    return [
      clamp(longitude - lngDelta, -180, 180),
      clamp(latitude - latDelta, -85, 85),
      clamp(longitude + lngDelta, -180, 180),
      clamp(latitude + latDelta, -85, 85)
    ] as [number, number, number, number]
  }, [viewState])

  const precision = useMemo(() => {
    const zoom = viewState.zoom
    if (zoom <= 8) return 4
    if (zoom <= 10) return 5
    if (zoom <= 12) return 6
    if (zoom <= 14) return 7
    return 8
  }, [viewState.zoom])

  const { clusters, loading, error } = useClusters(bbox, precision)

  // Simple mock preferences - you can replace this with actual user preferences
  const prefs = useMemo(() => ({
    social: 0.2,
    chill: 0.1,
    hype: -0.1,
    focus: 0.3,
    explore: 0.0,
    create: 0.2,
    relax: 0.1,
    exercise: -0.2
  }), [])

  const handleClusterClick = useCallback((cluster: Cluster) => {
    setSelectedCluster(cluster)
    setViewState(prev => ({
      ...prev,
      longitude: cluster.centroid.coordinates[0],
      latitude: cluster.centroid.coordinates[1],
      zoom: Math.min(prev.zoom + 1, 16)
    }))
  }, [])

  const pulseLayer = usePulseLayer(clusters, prefs)
  const { hotspots } = useHotspots()
  const haloTime = usePulseTime(2.5) // Faster pulse for hotspots
  const env = getEnvironmentConfig()

  const layers = useMemo(() => {
    const base = createDensityLayer(clusters, prefs, handleClusterClick)
    const halo = env.hotSpotHalos ? createHaloLayer(hotspots, haloTime, prefs) : null
    return [base, pulseLayer, halo].filter(Boolean)
  }, [clusters, prefs, handleClusterClick, pulseLayer, hotspots, haloTime, env.hotSpotHalos])

  // Conditional rendering AFTER all hooks
  if (!isOpen) return null

  return (
    <div className="fixed inset-4 z-40 bg-background rounded-2xl border border-border shadow-2xl">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-background/90 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between rounded-t-2xl">
        <div>
          <h2 className="text-lg font-semibold">Vibe Density Map</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${clusters.length} cluster${clusters.length === 1 ? '' : 's'} in view`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Container */}
      <div className="absolute inset-0 pt-16 rounded-b-2xl overflow-hidden">
        <DeckGLComponent
          viewState={viewState}
          controller={true}
          layers={layers}
          onViewStateChange={({viewState}) => setViewState(viewState)}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Legend */}
        <ClusterLegend 
          clusters={clusters}
          className="absolute bottom-4 left-4"
        />

        {/* Cluster Details */}
        {selectedCluster && (
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm rounded-xl p-4 border border-border max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Cluster Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCluster(null)}
                className="p-1 h-6 w-6"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Total People:</span> {selectedCluster.total}</p>
              <div>
                <span className="text-muted-foreground">Vibes:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(selectedCluster.vibe_counts).map(([vibe, count]) => (
                    <span
                      key={vibe}
                      className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
                    >
                      {vibe}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute top-20 left-4 right-4 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">Failed to load clusters: {error}</p>
          </div>
        )}
      </div>
    </div>
  )
}