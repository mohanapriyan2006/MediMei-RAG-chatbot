export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif']

export function isValidDocument(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext) || file.type.startsWith('image/') || file.type === 'application/pdf'
}

export function isValidPdf(file: File): boolean {
  return isValidDocument(file)
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
