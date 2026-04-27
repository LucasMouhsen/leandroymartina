import { motion } from 'framer-motion'

const MotionButton = motion.button

export function AudioToggle({ isPlaying, onToggle }) {
  return (
    <MotionButton
      animate={{ y: 0, opacity: 1 }}
      aria-label={isPlaying ? 'Pausar música' : 'Activar música'}
      className="audio-toggle"
      initial={{ y: 24, opacity: 0 }}
      onClick={onToggle}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      type="button"
    >
      <span className="audio-toggle__icon" aria-hidden="true">
        {isPlaying ? 'II' : '▶'}
      </span>
      <span className="audio-toggle__label">
        {isPlaying ? 'Música activada' : 'Música en pausa'}
      </span>
    </MotionButton>
  )
}
