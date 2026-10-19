import { useEffect, useRef, useState } from 'react'
import type { ECharts } from 'echarts'
import * as echarts from 'echarts'
import type { ChartConfig, ChartType, Aggregation } from '../domain/chart/types'
import { createChartOption } from '../domain/chart/echarts'
import { validateChartConfig } from '../domain/chart/logic'
import type { DatasetCandidate, ParsedSource } from '../domain/data/types'
import { downloadJson } from '../services/download'
import { parseFile } from '../services/file'

type Step = 1 | 2 | 3 | 4
type Notice = { tone: 'error' | 'warning' | 'success'; text: string }

const chartLabels: Record<ChartType, string> = { line: '折线图', bar: '柱状图', scatter: '散点图', pie: '饼图', table: '数据表' }
const aggregationLabels: Record<Aggregation, string> = { none: '不聚合', sum: '求和', average: '平均值', max: '最大值', min: '最小值', count: '计数' }

const initialConfig = (fields: DatasetCandidate['fields']): ChartConfig => ({
  type: 'line',
  axis: { dimension: '', values: fields.filter((field) => field.type === 'number').map((field) => field.name), dateAxis: false, aggregation: 'none', showDataPoints: true },
  visibleColumns: fields.map((field) => field.name),
})

const displayCell = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '空值'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<ECharts | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [source, setSource] = useState<ParsedSource | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [config, setConfig] = useState<ChartConfig | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(false)
  const [chartError, setChartError] = useState<string[]>([])
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const selectedDataset = source?.datasets.find((dataset) => dataset.id === selectedId) ?? null
  const fields = selectedDataset?.fields ?? []
  const updateConfig = (patch: Partial<ChartConfig>) => setConfig((current) => current ? { ...current, ...patch } : current)

  const handleFile = async (file: File) => {
    setNotice(null)
    setLoading(true)
    try {
      const parsed = await parseFile(file)
      setSource(parsed)
      setSelectedId('')
      setConfig(null)
      setStep(2)
      setChartError([])
      if (parsed.warnings.length) setNotice({ tone: 'warning', text: parsed.warnings.join(' ') })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : '文件解析失败，请检查文件内容。' })
    } finally {
      setLoading(false)
    }
  }

  const chooseFile = (file: File | undefined) => {
    if (!file) return
    if (source) setPendingFile(file)
    else void handleFile(file)
  }

  const confirmReplace = (replace: boolean) => {
    if (replace && pendingFile) {
      setSource(null)
      setSelectedId('')
      setConfig(null)
      setStep(1)
      void handleFile(pendingFile)
    }
    setPendingFile(null)
  }

  const chooseDataset = (id: string) => {
    setSelectedId(id)
    const dataset = source?.datasets.find((candidate) => candidate.id === id)
    if (dataset) setConfig(initialConfig(dataset.fields))
    setNotice(null)
  }

  const goConfig = () => {
    if (!selectedDataset) {
      setNotice({ tone: 'error', text: '请先选择一个数据集。' })
      return
    }
    setStep(3)
    setNotice(null)
  }

  const renderChart = () => {
    if (!selectedDataset || !config) return
    const result = validateChartConfig(selectedDataset, fields, config)
    if (!result.valid) {
      setChartError(result.errors)
      setNotice({ tone: 'error', text: '图表配置还需要修正。' })
      return
    }
    setChartError([])
    setNotice(null)
    setStep(4)
  }

  useEffect(() => {
    if (step !== 4 || !chartRef.current || !selectedDataset || !config || config.type === 'table') return
    try {
      instanceRef.current?.dispose()
      const instance = echarts.init(chartRef.current)
      instance.setOption(createChartOption(selectedDataset, config))
      instanceRef.current = instance
      const resize = () => instance.resize()
      window.addEventListener('resize', resize)
      return () => {
        window.removeEventListener('resize', resize)
        instance.dispose()
        instanceRef.current = null
      }
    } catch {
      setChartError(['图表渲染失败。请返回配置，减少字段或调整数据范围后重试。'])
    }
  }, [step, selectedDataset, config])

  const downloadPng = () => {
    if (!instanceRef.current) return
    const link = document.createElement('a')
    link.href = instanceRef.current.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
    link.download = `${source?.fileName ?? 'chart'}.png`
    link.click()
  }

  const exportConfig = () => {
    if (!source || !selectedDataset || !config) return
    downloadJson({
      source: { format: source.format, fileName: source.fileName, fileSize: source.fileSize },
      dataset: { id: selectedDataset.id, path: selectedDataset.path, recordCount: selectedDataset.recordCount },
      chart: config,
    }, 'universal-data-viewer-config.json')
  }

  const resetZoom = () => instanceRef.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })

  const updateType = (type: ChartType) => {
    if (!selectedDataset) return
    const next = initialConfig(fields)
    if (config) {
      next.visibleColumns = config.visibleColumns
      next.axis!.dimension = config.axis?.dimension ?? ''
      next.axis!.dateAxis = config.axis?.dateAxis ?? false
      next.axis!.aggregation = config.axis?.aggregation ?? 'none'
      next.axis!.showDataPoints = config.axis?.showDataPoints ?? true
      next.axis!.values = fields
        .filter((field) => field.type === 'number' && config.visibleColumns.includes(field.name) && field.name !== config.axis?.dimension)
        .map((field) => field.name)
    }
    next.type = type
    const visibleFields = fields.filter((field) => next.visibleColumns.includes(field.name))
    const numericFields = visibleFields.filter((field) => field.type === 'number')
    if (type === 'scatter') next.scatter = { x: numericFields[0]?.name ?? '', y: numericFields[1]?.name ?? numericFields[0]?.name ?? '' }
    if (type === 'pie') next.pie = { category: next.axis?.dimension || (visibleFields.find((field) => field.type !== 'number')?.name ?? ''), value: numericFields[0]?.name ?? '', aggregation: 'sum' }
    updateConfig(next)
    setChartError([])
  }

  const toggleDataPoints = (showDataPoints: boolean) => {
    if (!config?.axis) return
    updateConfig({ axis: { ...config.axis, showDataPoints } })
  }

  const canAccessStep = (target: Step) => {
    if (target === 1) return true
    if (target === 2) return Boolean(source)
    if (target === 3) return Boolean(source && selectedDataset && config)
    return Boolean(source && selectedDataset && config && validateChartConfig(selectedDataset, fields, config).valid)
  }

  const isStepComplete = (target: Step) => {
    if (target === 1) return Boolean(source)
    if (target === 2) return Boolean(selectedDataset)
    if (target === 3) return Boolean(selectedDataset && config && validateChartConfig(selectedDataset, fields, config).valid)
    return false
  }

  const navigateToStep = (target: Step) => {
    if (!canAccessStep(target)) return
    setStep(target)
    setNotice(null)
  }

  const renderStep = () => {
    if (step === 1) return <UploadStep loading={loading} onFile={chooseFile} inputRef={inputRef} />
    if (step === 2 && source) return <DatasetStep source={source} selectedId={selectedId} config={config} onSelect={chooseDataset} onUpdate={updateConfig} onContinue={goConfig} />
    if (step === 3 && selectedDataset && config) return <ConfigStep dataset={selectedDataset} config={config} fields={fields} chartLabels={chartLabels} aggregationLabels={aggregationLabels} onType={updateType} onUpdate={updateConfig} errors={chartError} onGenerate={renderChart} onBack={() => setStep(2)} />
    if (step === 4 && selectedDataset && config) return <ResultStep dataset={selectedDataset} config={config} fields={fields} chartLabels={chartLabels} chartRef={chartRef} errors={chartError} onReset={resetZoom} onDownload={downloadPng} onExport={exportConfig} onToggleDataPoints={toggleDataPoints} />
    return null
  }

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark">UDV</div>
      <div><p className="eyebrow">PRIVATE IN-BROWSER ANALYSIS</p><h1>Universal Data Viewer</h1></div>
    </header>
    <nav className="steps" aria-label="工作流进度">{[['1', '打开文件'], ['2', '选择数据集'], ['3', '配置视图'], ['4', '查看结果']].map(([number, label], index) => { const target = (index + 1) as Step; const complete = isStepComplete(target); return <button className={`step ${step === target ? 'active' : ''} ${complete ? 'done' : ''}`} disabled={!canAccessStep(target)} key={number} onClick={() => navigateToStep(target)} type="button" aria-current={step === target ? 'step' : undefined}><span>{complete ? '✓' : number}</span>{label}</button> })}</nav>
    {notice && <div className={`notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
    {renderStep()}
    {pendingFile && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="replace-title"><p className="eyebrow">REPLACE WORKSPACE</p><h2 id="replace-title">替换当前文件？</h2><p>当前数据集、字段配置和图表结果将被清空。新文件只会在你确认后解析。</p><div className="actions"><button className="button button-quiet" type="button" onClick={() => confirmReplace(false)}>取消</button><button className="button button-primary" type="button" onClick={() => confirmReplace(true)}>确认替换</button></div></div></div>}
  </main>
}

function UploadStep({ loading, onFile, inputRef }: { loading: boolean; onFile: (file: File | undefined) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [dragging, setDragging] = useState(false)
  return <section className="panel upload-panel"><div className="panel-kicker">STEP 01 / START HERE</div><h2>把数据带进来</h2><label className={`drop-zone ${dragging ? 'dragging' : ''}`} htmlFor="file-input" onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onFile(event.dataTransfer.files[0]) }}><span className="upload-icon">↑</span><strong>{loading ? '正在解析文件…' : '选择数据文件'}</strong><span>或将文件拖到此处</span><small>UTF-8 CSV（逗号分隔、首行表头）或标准 JSON</small></label><input ref={inputRef} id="file-input" className="visually-hidden" type="file" accept=".json,.csv,application/json,text/csv" onChange={(event) => { onFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></section>
}

function DatasetStep({ source, selectedId, config, onSelect, onUpdate, onContinue }: { source: ParsedSource; selectedId: string; config: ChartConfig | null; onSelect: (id: string) => void; onUpdate: (patch: Partial<ChartConfig>) => void; onContinue: () => void }) {
  const selected = source.datasets.find((dataset) => dataset.id === selectedId)
  const columns = selected?.fields.map((field) => field.name) ?? []
  const updatePreviewFields = (visibleColumns: string[]) => {
    if (!config) return
    const dimension = config.axis?.dimension && visibleColumns.includes(config.axis.dimension) ? config.axis.dimension : ''
    const numericFields = selected?.fields.filter((field) => field.type === 'number' && visibleColumns.includes(field.name) && field.name !== dimension).map((field) => field.name) ?? []
    const axis = config.axis ? { ...config.axis, dimension, values: numericFields } : config.axis
    onUpdate({ visibleColumns, axis })
  }
  const selectDimension = (dimension: string) => {
    if (!config?.axis) return
    const values = selected?.fields.filter((field) => field.type === 'number' && config.visibleColumns.includes(field.name) && field.name !== dimension).map((field) => field.name) ?? []
    onUpdate({ axis: { ...config.axis, dimension, values } })
  }
  return <section className="panel"><div className="panel-kicker">STEP 02 / CHOOSE DATASET</div><div className="panel-heading"><div><h2>选择要查看的数据集</h2><p className="lead">JSON 中的多个数组会分别列出，请明确选择，不会自动合并。</p></div><span className="count-badge">{source.datasets.length} 个候选</span></div><div className="dataset-list">{source.datasets.map((dataset) => <label className={`dataset-card ${selectedId === dataset.id ? 'selected' : ''}`} key={dataset.id}><input type="radio" name="dataset" checked={selectedId === dataset.id} onChange={() => onSelect(dataset.id)} /><div><strong>{dataset.label}</strong><span className="path">{dataset.path}</span><p>{dataset.recordCount.toLocaleString()} 条记录 · {dataset.fields.length} 个字段</p><div className="field-chips">{dataset.fields.slice(0, 6).map((field) => <span key={field.name}>{field.name} <em>{field.type}</em></span>)}{dataset.fields.length > 6 && <span>+{dataset.fields.length - 6}</span>}</div></div><span className="radio-mark" /></label>)}</div>{selected && <div className="preview-section"><div className="preview-heading"><div><h3>数据预览</h3><span>点击表头选择维度 / 时间轴字段</span></div></div>{config && <TableColumnConfig fields={selected.fields} visible={config.visibleColumns} onChange={updatePreviewFields} />}<DataTable rows={selected.preview} columns={config?.visibleColumns ?? columns} total={selected.recordCount} dimension={config?.axis?.dimension} onDimensionChange={selectDimension} />{config?.axis && <div className="preview-actions"><div className="inline-controls"><label className="toggle"><input type="checkbox" checked={config.axis.dateAxis} onChange={(event) => onUpdate({ axis: { ...config.axis!, dateAxis: event.target.checked } })} /><span />X轴为日期</label><Select label="重复维度值" value={config.axis.aggregation} options={aggregationLabels} onChange={(aggregation) => onUpdate({ axis: { ...config.axis!, aggregation: aggregation as Aggregation } })} /></div><button className="button button-primary" disabled={!selectedId} type="button" onClick={onContinue}>进入图表配置 <span>→</span></button></div>}</div>}</section>
}

function ConfigStep({ dataset, config, fields, chartLabels, aggregationLabels, onType, onUpdate, onToggleValue, errors, onGenerate, onBack }: { dataset: DatasetCandidate; config: ChartConfig; fields: DatasetCandidate['fields']; chartLabels: Record<ChartType, string>; aggregationLabels: Record<Aggregation, string>; onType: (type: ChartType) => void; onUpdate: (patch: Partial<ChartConfig>) => void; onToggleValue?: (name: string) => void; errors: string[]; onGenerate: () => void; onBack: () => void }) {
  const numericFields = fields.filter((field) => field.type === 'number')
  if (config.type === 'line' || config.type === 'bar') return <section className="panel"><div className="panel-kicker">STEP 03 / CONFIGURE VIEW</div><div className="panel-heading"><div><h2>配置你的视图</h2><p className="lead">表头选择维度，显示列中的数值字段自动作为图表数据。</p></div><span className="count-badge">{dataset.recordCount.toLocaleString()} 条记录</span></div><div className="config-section"><h3>选择图表类型</h3><div className="chart-type-grid">{(Object.keys(chartLabels) as ChartType[]).map((type) => <button className={`chart-type ${config.type === type ? 'selected' : ''}`} type="button" key={type} onClick={() => onType(type)}><span className={`chart-glyph ${type}`} />{chartLabels[type]}</button>)}</div></div>{errors.length > 0 && <div className="inline-errors" role="alert">{errors.map((error) => <span key={error}>• {error}</span>)}</div>}<div className="actions split"><button className="button button-quiet" type="button" onClick={onBack}>← 返回数据选择</button><button className="button button-primary" type="button" onClick={onGenerate}>生成视图 <span>→</span></button></div></section>
  return <section className="panel"><div className="panel-kicker">STEP 03 / CONFIGURE VIEW</div><div className="panel-heading"><div><h2>配置你的视图</h2><p className="lead">当前图表类型无需额外字段配置。</p></div><span className="count-badge">{dataset.recordCount.toLocaleString()} 条记录</span></div><div className="config-section"><h3>选择图表类型</h3><div className="chart-type-grid">{(Object.keys(chartLabels) as ChartType[]).map((type) => <button className={`chart-type ${config.type === type ? 'selected' : ''}`} type="button" key={type} onClick={() => onType(type)}><span className={`chart-glyph ${type}`} />{chartLabels[type]}</button>)}</div></div>{errors.length > 0 && <div className="inline-errors" role="alert">{errors.map((error) => <span key={error}>• {error}</span>)}</div>}<div className="actions split"><button className="button button-quiet" type="button" onClick={onBack}>← 返回数据选择</button><button className="button button-primary" type="button" onClick={onGenerate}>生成视图 <span>→</span></button></div></section>
  // @ts-ignore The early return above handles line and bar configurations.
  return <section className="panel"><div className="panel-kicker">STEP 03 / CONFIGURE VIEW</div><div className="panel-heading"><div><h2>配置你的视图</h2><p className="lead">每个关键字段都需要明确选择，系统不会猜测你的意图。</p></div><span className="count-badge">{dataset.recordCount.toLocaleString()} 条记录</span></div><div className="config-section"><h3>选择图表类型</h3><div className="chart-type-grid">{(Object.keys(chartLabels) as ChartType[]).map((type) => <button className={`chart-type ${config.type === type ? 'selected' : ''}`} type="button" key={type} onClick={() => onType(type)}><span className={`chart-glyph ${type}`} />{chartLabels[type]}</button>)}</div></div>{(config.type === 'line' || config.type === 'bar') && config.axis && <div className="config-section field-layout"><FieldSelect label="维度 / 时间轴字段" value={config.axis.dimension} fields={fields} placeholder="请选择字段" onChange={(dimension) => onUpdate({ axis: { ...config.axis!, dimension } })} /><div><label>数值字段（可多选）</label><div className="check-list">{numericFields.length ? numericFields.map((field) => <label className="check-row" key={field.name}><input type="checkbox" checked={config.axis!.values.includes(field.name)} onChange={() => onToggleValue(field.name)} /><span>{field.name}</span><em>{field.type}</em></label>) : <p className="muted">数据集中没有推断为 number 的字段。</p>}</div></div><div className="inline-controls"><label className="toggle"><input type="checkbox" checked={config.axis.dateAxis} onChange={(event) => onUpdate({ axis: { ...config.axis!, dateAxis: event.target.checked } })} /><span />将维度作为日期轴</label><Select label="重复维度值" value={config.axis.aggregation} options={aggregationLabels} onChange={(aggregation) => onUpdate({ axis: { ...config.axis!, aggregation: aggregation as Aggregation } })} /></div></div>}{config.type === 'scatter' && config.scatter && <div className="config-section field-layout"><FieldSelect label="X 轴字段" value={config.scatter.x} fields={numericFields} placeholder="选择数值字段" onChange={(x) => onUpdate({ scatter: { ...config.scatter!, x } })} /><FieldSelect label="Y 轴字段" value={config.scatter.y} fields={numericFields} placeholder="选择数值字段" onChange={(y) => onUpdate({ scatter: { ...config.scatter!, y } })} /><FieldSelect label="系列字段（可选）" value={config.scatter.series ?? ''} fields={fields} placeholder="不按系列拆分" onChange={(series) => onUpdate({ scatter: { ...config.scatter!, series: series || undefined } })} /></div>}{config.type === 'pie' && config.pie && <div className="config-section field-layout"><FieldSelect label="分类字段" value={config.pie.category} fields={fields} placeholder="选择分类字段" onChange={(category) => onUpdate({ pie: { ...config.pie!, category } })} /><FieldSelect label="数值字段" value={config.pie.value} fields={numericFields} placeholder="选择数值字段" onChange={(value) => onUpdate({ pie: { ...config.pie!, value } })} /><Select label="分类聚合" value={config.pie.aggregation} options={aggregationLabels} exclude="none" onChange={(aggregation) => onUpdate({ pie: { ...config.pie!, aggregation: aggregation as Exclude<Aggregation, 'none'> } })} /></div>}{config.type === 'table' && <TableColumnConfig fields={fields} visible={config.visibleColumns} onToggle={(name) => onUpdate({ visibleColumns: config.visibleColumns.includes(name) ? config.visibleColumns.filter((item) => item !== name) : [...config.visibleColumns, name] })} />} {errors.length > 0 && <div className="inline-errors" role="alert"><strong>配置需要修正</strong>{errors.map((error) => <span key={error}>• {error}</span>)}</div>}<div className="actions split"><button className="button button-quiet" type="button" onClick={onBack}>← 返回预览</button><button className="button button-primary" type="button" onClick={onGenerate}>生成视图 <span>→</span></button></div></section>
}

function FieldSelect({ label, value, fields, placeholder, onChange }: { label: string; value: string; fields: DatasetCandidate['fields']; placeholder: string; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{fields.map((field) => <option key={field.name} value={field.name}>{field.name} · {field.type}</option>)}</select></label> }
function Select({ label, value, options, exclude, onChange }: { label: string; value: string; options: Record<string, string>; exclude?: string; onChange: (value: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{Object.entries(options).filter(([key]) => key !== exclude).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> }

type ColumnTreeNode = { label: string; path: string; field?: DatasetCandidate['fields'][number]; children: ColumnTreeNode[] }

const splitColumnPath = (name: string) => name.split('.').filter(Boolean)

const buildColumnTree = (fields: DatasetCandidate['fields']): ColumnTreeNode[] => {
  const roots: ColumnTreeNode[] = []
  fields.forEach((field) => {
    let nodes = roots
    const parts = splitColumnPath(field.name)
    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('.')
      let node = nodes.find((item) => item.path === path)
      if (!node) {
        node = { label: part, path, children: [] }
        nodes.push(node)
      }
      if (index === parts.length - 1) node.field = field
      nodes = node.children
    })
  })
  return roots
}

function TableColumnConfig({ fields, visible, onChange, onToggle }: { fields: DatasetCandidate['fields']; visible: string[]; onChange?: (columns: string[]) => void; onToggle?: (name: string) => void }) {
  const [filter, setFilter] = useState('')
  const normalizedFilter = filter.trim().toLocaleLowerCase()
  const filteredFields = fields.filter((field) => field.name.toLocaleLowerCase().includes(normalizedFilter))
  const filteredNames = filteredFields.map((field) => field.name)
  const allFilteredSelected = filteredNames.length > 0 && filteredNames.every((name) => visible.includes(name))
  const columnTree = buildColumnTree(filteredFields)

  const updateColumns = (columns: string[]) => {
    if (onChange) {
      onChange(columns)
      return
    }
    const changed = fields.filter((field) => visible.includes(field.name) !== columns.includes(field.name))
    changed.forEach((field) => onToggle?.(field.name))
  }

  const toggleColumn = (name: string) => {
    updateColumns(visible.includes(name) ? visible.filter((item) => item !== name) : [...visible, name])
  }

  const updateFilteredColumns = (selected: boolean) => {
    const next = selected
      ? [...visible, ...filteredNames.filter((name) => !visible.includes(name))]
      : visible.filter((name) => !filteredNames.includes(name))
    updateColumns(next)
  }

  const renderTree = (nodes: ColumnTreeNode[], depth = 0): React.ReactNode[] => nodes.flatMap((node) => {
    if (!node.children.length && node.field) {
      return [<label className="check-row column-leaf" style={{ paddingLeft: `${depth * 18}px` }} key={node.field.name}><input type="checkbox" checked={visible.includes(node.field.name)} onChange={() => toggleColumn(node.field!.name)} /><span>{node.label}</span><em>{node.field.type}</em></label>]
    }
    return [<div className="column-group" style={{ paddingLeft: `${depth * 18}px` }} key={node.path}><span>{node.label}</span>{renderTree(node.children, depth + 1)}</div>]
  })

  return <div className="config-section"><h3>显示列</h3><p className="muted">默认显示全部字段，可隐藏不需要的列。</p><div className="column-toolbar"><input className="column-filter" type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="筛选字段" aria-label="筛选字段" /><div className="column-actions"><button className="button button-quiet" type="button" onClick={() => updateFilteredColumns(true)} disabled={allFilteredSelected || filteredNames.length === 0}>全选</button><button className="button button-quiet" type="button" onClick={() => updateFilteredColumns(false)} disabled={filteredNames.every((name) => !visible.includes(name))}>取消全选</button></div></div><div className="column-grid">{filteredFields.length ? renderTree(columnTree) : <p className="muted column-empty">没有匹配的字段。</p>}</div></div>
}

function ResultStep({ dataset, config, fields, chartLabels, chartRef, errors, onReset, onDownload, onExport, onToggleDataPoints }: { dataset: DatasetCandidate; config: ChartConfig; fields: DatasetCandidate['fields']; chartLabels: Record<ChartType, string>; chartRef: React.RefObject<HTMLDivElement | null>; errors: string[]; onReset: () => void; onDownload: () => void; onExport: () => void; onToggleDataPoints: (showDataPoints: boolean) => void }) {
  const visibleColumns = config.visibleColumns.length ? config.visibleColumns : fields.map((field) => field.name)
  return <section className="panel result-panel"><div className="panel-kicker">STEP 04 / RESULT</div><div className="result-heading"><div><h2>{chartLabels[config.type]}</h2><p className="lead">{dataset.path} · {dataset.recordCount.toLocaleString()} 条记录</p></div><div className="toolbar"><button className="button button-quiet" type="button" onClick={onExport}>导出配置 JSON</button>{config.type !== 'table' && <><button className="button button-quiet" type="button" onClick={onReset}>重置缩放</button>{config.type === 'line' && config.axis && <button className={`button button-quiet chart-point-toggle ${config.axis.showDataPoints ? 'is-pressed' : ''}`} type="button" aria-pressed={config.axis.showDataPoints} onClick={() => onToggleDataPoints(!config.axis!.showDataPoints)}>数据点</button>}<button className="button button-quiet" type="button" onClick={onDownload}>下载 PNG</button></>}</div></div>{errors.length > 0 && <div className="inline-errors result-errors" role="alert"><strong>图表渲染失败</strong>{errors.map((error) => <span key={error}>• {error}</span>)}</div>}{config.type === 'table' ? <DataTable rows={dataset.preview} columns={visibleColumns} total={dataset.recordCount} /> : <div ref={chartRef} className="chart-canvas" aria-label={`${chartLabels[config.type]}图表`} />}{config.type !== 'table' && <p className="chart-help">可使用鼠标滚轮、拖拽框选或底部滑块缩放图表。图表展示全部记录，表格仅显示前 100 行。</p>}</section>
}
function DataTable({ rows, columns, total, dimension, onDimensionChange }: { rows: DatasetCandidate['rows']; columns: string[]; total: number; dimension?: string; onDimensionChange?: (column: string) => void }) { return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th className={dimension === column ? 'selected-dimension' : undefined} key={column}><button className="table-header-button" type="button" onClick={() => onDimensionChange?.(column)} aria-pressed={dimension === column}>{column}</button></th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{displayCell(row[column])}</td>)}</tr>)}</tbody></table><p className="table-note">显示前 {Math.min(rows.length, 100)} 行，共 {total.toLocaleString()} 行。此处是预览，不是数据截断。</p></div> }

export { App }
