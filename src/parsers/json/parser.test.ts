import { describe, expect, it } from 'vitest'
import { parseJson } from './parser'

describe('JSON parser', () => {
  it('exposes separate nested array candidates', () => {
    const result = parseJson('{"users":[{"id":1}],"orders":[{"total":4}]}', 'data.json', 50)
    expect(result.datasets.map((dataset) => dataset.path)).toEqual(['$.users', '$.orders'])
  })

  it('supports object and scalar roots', () => {
    expect(parseJson('{"name":"Ada"}', 'object.json', 20).datasets[0].recordCount).toBe(1)
    expect(parseJson('42', 'value.json', 2).datasets[0].fields[0].name).toBe('value')
  })
})
