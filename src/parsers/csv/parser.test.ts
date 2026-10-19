import { describe, expect, it } from 'vitest'
import { parseCsv } from './parser'

describe('CSV parser', () => {
  it('uses the first row as headers and infers conservative types', () => {
    const result = parseCsv('name,score,active\nAda,2,true\nBob,,false', 'data.csv', 40)
    expect(result.datasets[0].rows).toEqual([
      { name: 'Ada', score: 2, active: true },
      { name: 'Bob', score: null, active: false },
    ])
  })

  it('warns about inconsistent column counts and preserves extra values', () => {
    const result = parseCsv('a,b\n1,2,3', 'data.csv', 20)
    expect(result.warnings[0]).toContain('第 2 行')
    expect(result.datasets[0].rows[0]).toMatchObject({ a: 1, b: 2, column_3: 3 })
  })
})
