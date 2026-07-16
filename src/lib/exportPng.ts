/**
 * Shared utilities for PNG export on iOS Safari / PWA
 */

export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 2)
  )
}

export async function downloadPng(canvas: HTMLCanvasElement, fileName: string) {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('PNG oluşturulamadı.')

  if (isIOS() && navigator.share) {
    try {
      const file = new File([blob], fileName, { type: 'image/png' })
      await navigator.share({
        files: [file],
        title: fileName,
      })
      return
    } catch (shareErr) {
      if (shareErr instanceof Error && shareErr.name !== 'AbortError') {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
      }
      return
    }
  }

  if ('download' in HTMLAnchorElement.prototype) {
    const link = document.createElement('a')
    link.download = fileName
    link.href = URL.createObjectURL(blob)
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), 10000)
  } else {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }
}