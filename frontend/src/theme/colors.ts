export const BaseColors = {
  primary: '#0E3A3A',
  primaryLight: '#115150',
  primaryHover: '#115150',
  teal: '#1C5959',
  accent: '#0F7772',
  ai: '#0F7772',
  success: '#2F7D65',
  warning: '#B87925',
  danger: '#B64A4A',
  info: '#347A82',
  white: '#FFFFFF',
  backgroundLight: '#F7F6F2',
  surfaceLight: '#FFFFFF',
  surfaceWarmLight: '#F5F3E6',
  backgroundDark: '#060f12',
  surfaceDark: '#0f171a',
  surfaceHighlightDark: 'rgb(31, 48, 53)',
  textPrimaryLight: '#021D1D',
  textSecondaryLight: '#52605F',
  textMutedLight: '#7B8583',
  textPrimaryDark: '#f4f8f7',
  textSecondaryDark: '#c5d5d2',
  borderLight: '#E4E5E1',
  borderDark: 'rgba(200, 225, 221, 0.22)',
} as const




export type BaseColorKey = keyof typeof BaseColors









