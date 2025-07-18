import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { debounce } from 'lodash-es'
import { supabase } from '@/integrations/supabase/client'

// Types --------------------------------------------------------------------

export interface Cluster {
  gh6: string
  centroid: { type: 'Point'; coordinates: [number, number] }
  total: number
  vibe_counts: Record<string, number>
  fillRgb?: [number, number, number]
  totalNorm?: number
}

// Hook ---------------------------------------------------------------------

export const useClusters = (
  bbox: [number, number, number, number] | null,
  precision = 6
) => {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)

  /** ---- stable key: precision + bbox rounded to 3 dp ---- */
  const key = useMemo(() => {
    if (!bbox) return null
    const k = bbox.map(n => n.toFixed(3)).join(',')
    return `${precision}:${k}`
  }, [bbox, precision])

  /** ---- keep channel instance across renders ---- */
  const channelRef = useRef<RealtimeChannel | null>(null)
  const abortRef = useRef<AbortController | undefined>(undefined)
  const lastDataRef = useRef<Cluster[]>([])

  /** ---- process clusters with visual properties ---- */
  const processClusterData = useCallback((data: any[]) => {
    const processedClusters = (data || []).map((cluster: any) => ({
      ...cluster,
      fillRgb: [100, 150, 255] as [number, number, number], // Default blue
      totalNorm: cluster.total / Math.max(...(data || []).map((c: any) => c.total), 1)
    }))
    
    setClusters(processedClusters)
    lastDataRef.current = processedClusters
    setLastUpdateTime(new Date())
    return processedClusters
  }, [])

  /** ---- subscribe once per key change ---- */
  useEffect(() => {
    if (!key || clusters.length > 300) return // Guard rail: skip for large datasets or no key

    // unsubscribe old channel if key changes
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
      setIsRealTimeConnected(false)
    }

    const ch = supabase
      .channel(`clusters-${key}`)
      .on(
        'broadcast',
        { event: 'clusters_updated' },
        (payload) => {
          try {
            const { checksum } = payload.payload ?? {}
            if (checksum) {
              if (import.meta.env.DEV) {
                console.log('[useClusters] Checksum changed → refetching clusters')
              }
              // Trigger debounced fetch
              if (bbox) {
                debouncedFetch(bbox)
              }
            }
          } catch (e) {
            console.error('[useClusters] Error processing broadcast:', e)
          }
        }
      )
      .subscribe(status => {
        if (import.meta.env.DEV) {
          console.log('[useClusters] Subscription status:', status)
        }
        setIsRealTimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      setIsRealTimeConnected(false)
    }
  }, [key, clusters.length])

  /** ---- debounced edge-function fetch ---- */
  const fetchClusters = useCallback(async (box: [number, number, number, number]) => {
    // Cancel previous request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      if (import.meta.env.DEV) console.log(`[useClusters] Fetching clusters for bbox: ${box.join(',')}, precision: ${precision}`)

      const { data, error } = await supabase.functions.invoke('clusters', {
        body: { bbox: box, precision },
      })

      if (error) {
        console.error('[useClusters] Error:', error)
        setError(error.message || 'Failed to fetch clusters')
        setClusters([])
        return
      }

      if (import.meta.env.DEV) console.log(`[useClusters] Received ${data?.length || 0} clusters`)
      
      processClusterData(data)
      setError(null)

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[useClusters] Fetch error:', err)
        setError(err.message || 'Failed to fetch clusters')
        setClusters([])
      }
    } finally {
      setLoading(false)
    }
  }, [precision, processClusterData])

  const debouncedFetch = useMemo(
    () =>
      debounce(fetchClusters, 500), // 500 ms debounce
    [fetchClusters]
  )

  useEffect(() => {
    if (!bbox) return
    debouncedFetch.cancel()                  // reset debounce when bbox changes
    debouncedFetch(bbox)                     // fetch with new bbox
  }, [bbox, debouncedFetch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      debouncedFetch.cancel()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      setIsRealTimeConnected(false)
    }
  }, [debouncedFetch])

  return { 
    clusters, 
    loading, 
    error, 
    isRealTimeConnected, 
    lastUpdateTime 
  }
}