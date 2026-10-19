import type { DataSourceParser } from './types'
import { csvParser } from '../csv/parser'
import { jsonParser } from '../json/parser'

export const parsers: DataSourceParser[] = [jsonParser, csvParser]

export const findParser = (fileName: string, mimeType?: string) =>
  parsers.find((parser) => parser.accepts(fileName, mimeType))
