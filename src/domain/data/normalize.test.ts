import { describe, expect, it } from 'vitest'
import { createDataset, describeFields } from './normalize'

describe('JSON normalization', () => {
  it('flattens nested objects and takes the field union', () => {
    const dataset = createDataset('x', '$.items', [{ user: { name: 'Ada' }, score: 2 }, { user: { id: 4 } }])
    expect(dataset.fields.map((field) => field.name)).toEqual(['user.name', 'score', 'user.id'])
    expect(dataset.rows[1]).toMatchObject({ 'user.id': 4, 'user.name': null, score: null })
  })

  it('infers nullable numeric and boolean fields', () => {
    expect(describeFields([{ count: 1, active: true }, { count: null, active: false }])).toEqual([
      { name: 'count', type: 'number', nullable: true, nonNullCount: 1 },
      { name: 'active', type: 'boolean', nullable: false, nonNullCount: 2 },
    ])
  })

  it('keeps parent and nested fields when records mix null and objects', () => {
    const dataset = createDataset('log', '$.body.list', [{ mqttInfo: null }, { mqttInfo: { port: 19883, host: '58.250.71.201' } }])
    expect(dataset.fields.map((field) => field.name)).toEqual(['mqttInfo.port', 'mqttInfo.host'])
    expect(dataset.rows[0]).toMatchObject({ 'mqttInfo.port': null, 'mqttInfo.host': null })
  })
})
