import { findParser } from '../parsers/core/registry'
import { DataParseError, type ParsedSource } from '../domain/data/types'

export const MAX_FILE_SIZE = 20 * 1024 * 1024

export const parseFile = async (file: File): Promise<ParsedSource> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new DataParseError('文件超过 20 MB 限制。', [{ code: 'file-too-large', message: '请选择更小的 JSON 或 CSV 文件。' }])
  }
  const parser = findParser(file.name, file.type)
  if (!parser) throw new DataParseError('不支持的文件格式。', [{ code: 'unsupported-format', message: '请选择扩展名为 .json 或 .csv 的文件。' }])
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new DataParseError('文件不是有效的 UTF-8 文本。', [{ code: 'invalid-utf8', message: '请将文件转换为 UTF-8 编码后重试。' }])
  }
  return parser.parse(text, file.name, file.size)
}
