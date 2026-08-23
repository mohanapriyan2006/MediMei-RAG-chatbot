import { BaseColors } from './colors'
import type { ThemeColors } from './types'

export const darkTheme: ThemeColors = {
  mode: 'dark',
  background: BaseColors.backgroundDark,
  backgroundSecondary: BaseColors.surfaceDark,
  surface: BaseColors.surfaceDark,
  surfaceElevated: BaseColors.surfaceDark,
  surfaceHover: BaseColors.surfaceHighlightDark,
  surfaceHighlight: BaseColors.surfaceHighlightDark,
  foreground: BaseColors.textPrimaryDark,
  foregroundMuted: BaseColors.textSecondaryDark,
  border: BaseColors.borderDark,
  borderSubtle: BaseColors.borderDark,
  primary: '#38b2ac',
  primaryHover: '#4fd1c5',
  primaryMuted: 'rgba(56, 178, 172, 0.2)',
  ai: BaseColors.ai,
  success: BaseColors.success,
  warning: BaseColors.warning,
  danger: BaseColors.danger,
}
