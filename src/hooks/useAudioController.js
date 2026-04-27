import { useCallback, useEffect, useRef, useState } from 'react'

export function useAudioController() {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const togglePlayback = useCallback(async () => {
    const element = audioRef.current

    if (!element) {
      return
    }

    if (element.paused) {
      try {
        await element.play()
        setIsPlaying(true)
      } catch {
        setIsPlaying(false)
      }

      return
    }

    element.pause()
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    const element = audioRef.current

    if (!element) {
      return undefined
    }

    const handlePause = () => setIsPlaying(false)
    const handlePlay = () => setIsPlaying(true)

    element.addEventListener('pause', handlePause)
    element.addEventListener('play', handlePlay)

    return () => {
      element.pause()
      element.removeEventListener('pause', handlePause)
      element.removeEventListener('play', handlePlay)
    }
  }, [])

  return {
    audioRef,
    isPlaying,
    togglePlayback,
  }
}
