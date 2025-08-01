import { motion, AnimatePresence } from 'framer-motion'
import { User, Edit3 } from 'lucide-react'
import { usePlanPresence, type ParticipantPresence } from '@/hooks/usePlanPresence'
import { zIndex } from '@/constants/z'

interface LiveCursorsProps {
  planId: string
  enabled?: boolean
}

export function LiveCursors({ planId, enabled = true }: LiveCursorsProps) {
  const { participants } = usePlanPresence(planId, { silent: !enabled })

  return (
    <div {...zIndex('system')} className="fixed inset-0 pointer-events-none">
      <AnimatePresence>
        {participants.filter(p => p.isOnline).map((participant) => (
          <CursorIndicator key={participant.userId} participant={participant} />
        ))}
      </AnimatePresence>
    </div>
  )
}

interface CursorIndicatorProps {
  participant: ParticipantPresence
}

function CursorIndicator({ participant }: CursorIndicatorProps) {
  const cursorColor = getUserColor(participant.userId)
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        x: Math.random() * 100 + 50, // Simple positioning - you can enhance this
        y: Math.random() * 100 + 50
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ 
        type: 'spring',
        stiffness: 800,
        damping: 30,
        opacity: { duration: 0.2 }
      }}
      className="absolute pointer-events-none"
      style={{ left: 0, top: 0 }}
    >
      {/* Cursor pointer */}
      <motion.div
        className="relative"
        animate={{
          rotate: participant.currentActivity === 'timeline' ? [0, -5, 5, 0] : 0
        }}
        transition={{
          rotate: {
            duration: 0.5,
            repeat: participant.currentActivity === 'timeline' ? Infinity : 0,
            ease: 'easeInOut'
          }
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="drop-shadow-md"
        >
          <path
            d="M2 2L8 14L10.5 9.5L15 7L2 2Z"
            fill={cursorColor}
            stroke="white"
            strokeWidth="1"
          />
        </svg>
        
        {/* Activity indicator */}
        {participant.currentActivity === 'timeline' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: cursorColor }}
          >
            <Edit3 className="w-2 h-2 text-white" />
          </motion.div>
        )}
      </motion.div>

      {/* Username label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute top-6 left-2 px-2 py-1 rounded-md text-xs font-medium text-white shadow-lg whitespace-nowrap"
        style={{ backgroundColor: cursorColor }}
      >
        <User className="w-3 h-3 inline mr-1" />
        {participant.displayName}
        {participant.currentActivity === 'timeline' && (
          <span className="ml-1 opacity-75">editing</span>
        )}
      </motion.div>
    </motion.div>
  )
}

// Generate consistent colors for users
function getUserColor(userId: string): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#8B5CF6', // Violet
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#84CC16', // Lime
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#EC4899', // Pink
    '#6366F1'  // Indigo
  ]
  
  // Simple hash function to get consistent color
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff
  }
  
  return colors[Math.abs(hash) % colors.length]
}