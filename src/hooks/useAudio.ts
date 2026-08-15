export const useAudio = () => {
  const play = (name: string) => {
    const audio = new Audio(`/sounds/${name}.mp3`)
    audio.play().catch(() => {})
  }
  return { play }
}