declare module 'pdfjs-dist' {
  export function getDocument(src: { data: ArrayBuffer | Uint8Array } | string | { url: string }): {
    promise: Promise<PDFDocumentProxy>
  }

  export interface PDFDocumentProxy {
    numPages: number
    getPage(pageNumber: number): Promise<PDFPageProxy>
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>
  }

  export interface TextContent {
    items: Array<{ str?: string; [key: string]: unknown }>
  }

  export const GlobalWorkerOptions: {
    workerSrc: string
    workerPort?: Worker
  }
}