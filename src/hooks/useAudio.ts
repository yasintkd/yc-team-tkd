export const useAudio = () => {
  const play = (name: string, isAdmin: boolean) => {
    if (!isAdmin) return
    const audio = new Audio(`/sounds/${name}.mp3`)
    audio.play().catch(() => {})
  }
  
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  }

  return { play, vibrate }
}
