export type ScalarValue = string | number | boolean | null
export type CellValue = ScalarValue | string[] | Record<string, unknown>

export type FieldType = 'number' | 'boolean' | 'string' | 'date'

export interface FieldDescriptor {
  name: string
  type: FieldType
  nullable: boolean
  nonNullCount: number
}

export type DataRow = Record<string, CellValue>

export interface DatasetCandidate {
  id: string
  path: string
  label: string
  rows: DataRow[]
  fields: FieldDescriptor[]
  recordCount: number
  preview: DataRow[]
  warning?: string
}

export interface ParsedSource {
  format: 'json' | 'csv'
  fileName: string
  fileSize: number
  datasets: DatasetCandidate[]
  warnings: string[]
}

export interface ParseIssue {
  code: string
  message: string
  detail?: string
  line?: number
}

export class DataParseError extends Error {
  readonly issues: ParseIssue[]

  constructor(message: string, issues: ParseIssue[] = []) {
    super(message)
    this.name = 'DataParseError'
    this.issues = issues
  }
}
