import type { ParsedSource } from '../../domain/data/types'

export interface DataSourceParser {
  format: ParsedSource['format']
  accepts(fileName: string, mimeType?: string): boolean
  parse(text: string, fileName: string, fileSize: number): ParsedSource
}
