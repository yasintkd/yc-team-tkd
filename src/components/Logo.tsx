import { BRAND } from '../lib/brand'
import logoUrl from '../assets/logo-team-taekwondo.png'

type LogoVariant = 'full' | 'header' | 'login'

/**
 * Kaynak PNG boyutu önemli değil — en-boy oranı korunarak bu max değerlere sığdırılır.
 * Önerilen kaynak: yatay logo, ~800–2400px genişlik, < 1 MB, alfa kanallı PNG.
 */
const variantClass: Record<LogoVariant, string> = {
  full: 'max-h-14 w-auto max-w-full object-contain object-left',
  header: 'max-h-9 w-auto max-w-full object-contain object-left',
  login: 'mx-auto max-h-[5.5rem] w-auto max-w-full object-contain sm:max-h-24',
}

interface LogoProps {
  variant?: LogoVariant
  className?: string
}

export default function Logo({ variant = 'full', className = '' }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt={BRAND.name}
      className={`${variantClass[variant]} ${className}`.trim()}
      decoding="async"
      draggable={false}
    />
  )
}
