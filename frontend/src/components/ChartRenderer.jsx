import { useSyncExternalStore } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

function subscribeNarrowScreen(cb) {
  const mq = window.matchMedia('(max-width: 639px)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function getNarrowScreen() {
  return window.matchMedia('(max-width: 639px)').matches
}
function getServerNarrowScreen() {
  return false
}
function useIsNarrowScreen() {
  return useSyncExternalStore(subscribeNarrowScreen, getNarrowScreen, getServerNarrowScreen)
}

const SERIES_COLORS = ['#1a73e8', '#34a853', '#fbbc05', '#ea4335', '#9334e6', '#00acc1', '#ab47bc', '#00897b']

const TYPE_ALIASES = {
  hbar: 'horizontal_bar',
  horizontal: 'horizontal_bar',
  column: 'bar',
  stack: 'stacked_bar',
  stacks: 'stacked_bar',
  stacked: 'stacked_bar',
}

const ALLOWED_TYPES = new Set([
  'bar',
  'line',
  'area',
  'pie',
  'scatter',
  'horizontal_bar',
  'stacked_bar',
  'composed',
])

function isNumericLike(value) {
  return value !== null && value !== '' && !Number.isNaN(Number(value))
}

/** Accept raw model output; coerce type, data arrays, and keys. */
export function normalizeChartSpec(raw) {
  if (!raw || typeof raw !== 'object') return null
  let data = raw.data
  if (!Array.isArray(data)) {
    if (Array.isArray(raw.rows)) data = raw.rows
    else if (Array.isArray(raw.series)) data = raw.series
    else if (Array.isArray(raw.points)) data = raw.points
    else return null
  }
  if (data.length === 0) return null

  let type = String(raw.type ?? 'bar').toLowerCase().trim()
  type = TYPE_ALIASES[type] || type
  if (!ALLOWED_TYPES.has(type)) type = 'bar'

  return {
    type,
    title: raw.title != null ? String(raw.title) : 'Chart',
    x_key: raw.x_key,
    y_key: raw.y_key,
    y_key_2: raw.y_key_2,
    y_keys: Array.isArray(raw.y_keys) ? raw.y_keys.map(String) : null,
    data,
  }
}

export default function ChartRenderer({ spec: rawSpec }) {
  const isNarrow = useIsNarrowScreen()
  const spec = normalizeChartSpec(rawSpec)
  if (!spec) return null

  const { data } = spec
  let chartType = spec.type
  const sample = data[0] || {}
  const keys = Object.keys(sample)
  const numericKeys = keys.filter((key) => isNumericLike(sample[key]))
  const categoryKeys = keys.filter((key) => !isNumericLike(sample[key]))

  const inferredXKey = categoryKeys[0] || keys[0] || 'x'
  const inferredYKey = numericKeys[0] || keys[1] || keys[0] || 'y'

  const xKey = spec.x_key && keys.includes(spec.x_key) ? spec.x_key : inferredXKey
  let yKey = spec.y_key && keys.includes(spec.y_key) ? spec.y_key : inferredYKey

  const title = spec.title || 'Chart'
  const chartData = data.map((row) => {
    const out = { ...row }
    for (const k of keys) {
      if (isNumericLike(row[k])) out[k] = Number(row[k])
    }
    return out
  })

  const chartHeight = isNarrow ? 252 : 300
  const yAxisW = isNarrow ? 40 : 48
  const yAxisRightW = isNarrow ? 34 : 48
  const hBarCategoryW = isNarrow ? 92 : 100
  const manyXTicks = chartData.length > (isNarrow ? 5 : 9)
  const xAxisTickProps =
    manyXTicks && isNarrow
      ? { angle: -32, textAnchor: 'end', height: 58, tick: { fontSize: 8 } }
      : { tick: { fontSize: isNarrow ? 10 : 11 } }
  const legendStyle = {
    fontSize: isNarrow ? 10 : 12,
    paddingTop: 6,
  }

  const commonProps = {
    data: chartData,
    margin: isNarrow
      ? { top: 8, right: 6, left: 2, bottom: manyXTicks ? 10 : 6 }
      : { top: 12, right: 16, left: 4, bottom: 8 },
  }

  let stackKeys =
    spec.y_keys?.filter((k) => keys.includes(k) && isNumericLike(sample[k])) ?? null
  if (chartType === 'stacked_bar') {
    if (!stackKeys || stackKeys.length < 2) {
      stackKeys = numericKeys.filter((k) => k !== xKey)
    }
    if (stackKeys.length < 2) {
      yKey = stackKeys[0] || yKey
      chartType = 'bar'
    }
  }

  let yKey2 = spec.y_key_2 && keys.includes(spec.y_key_2) ? spec.y_key_2 : null
  if (chartType === 'composed' && !yKey2) {
    yKey2 = numericKeys.find((k) => k !== yKey) ?? null
  }
  if (chartType === 'composed' && !yKey2) {
    chartType = 'bar'
  }

  const chartWrap = (child) => (
    <div className="mt-3 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-gcp-gray-200 bg-gcp-gray-50 p-2 sm:rounded-xl sm:p-3">
      <p className="mb-2 break-words text-xs font-semibold text-gcp-gray-700">{title}</p>
      <div className="w-full min-w-[260px] sm:min-w-0" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%" debounce={80}>
          {child}
        </ResponsiveContainer>
      </div>
    </div>
  )

  if (chartType === 'line') {
    return chartWrap(
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} {...xAxisTickProps} minTickGap={isNarrow ? 6 : 10} />
        <YAxis tick={{ fontSize: isNarrow ? 10 : 11 }} width={yAxisW} />
        <Tooltip />
        <Legend wrapperStyle={legendStyle} />
        <Line type="monotone" dataKey={yKey} stroke="#1a73e8" strokeWidth={2} dot={false} />
      </LineChart>
    )
  }

  if (chartType === 'area') {
    return chartWrap(
      <AreaChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} {...xAxisTickProps} minTickGap={isNarrow ? 6 : 10} />
        <YAxis tick={{ fontSize: isNarrow ? 10 : 11 }} width={yAxisW} />
        <Tooltip />
        <Legend wrapperStyle={legendStyle} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke="#1a73e8"
          fill="#1a73e8"
          fillOpacity={0.35}
        />
      </AreaChart>
    )
  }

  if (chartType === 'pie') {
    return chartWrap(
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Tooltip />
        <Legend wrapperStyle={legendStyle} />
        <Pie
          data={chartData}
          dataKey={yKey}
          nameKey={xKey}
          cx="50%"
          cy="50%"
          outerRadius={isNarrow ? '68%' : 100}
          label={!isNarrow}
        >
          {chartData.map((_, idx) => (
            <Cell key={`cell-${idx}`} fill={SERIES_COLORS[idx % SERIES_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    )
  }

  if (chartType === 'scatter') {
    const xNum = isNumericLike(sample[xKey])
    return chartWrap(
      <ScatterChart margin={commonProps.margin}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type={xNum ? 'number' : 'category'}
          dataKey={xKey}
          name={xKey}
          {...xAxisTickProps}
          minTickGap={isNarrow ? 6 : 10}
        />
        <YAxis type="number" dataKey={yKey} name={yKey} tick={{ fontSize: isNarrow ? 10 : 11 }} width={yAxisW} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Legend wrapperStyle={legendStyle} />
        <Scatter name={title} data={chartData} fill="#1a73e8" />
      </ScatterChart>
    )
  }

  if (chartType === 'horizontal_bar') {
    return chartWrap(
      <BarChart layout="vertical" {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: isNarrow ? 10 : 11 }} />
        <YAxis
          dataKey={xKey}
          type="category"
          width={hBarCategoryW}
          tick={{ fontSize: isNarrow ? 9 : 10 }}
        />
        <Tooltip />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey={yKey} fill="#1a73e8" radius={[0, 4, 4, 0]} />
      </BarChart>
    )
  }

  if (chartType === 'stacked_bar' && stackKeys) {
    return chartWrap(
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} {...xAxisTickProps} minTickGap={isNarrow ? 6 : 10} />
        <YAxis tick={{ fontSize: isNarrow ? 10 : 11 }} width={yAxisW} />
        <Tooltip />
        <Legend wrapperStyle={legendStyle} />
        {stackKeys.map((k, idx) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="stack"
            fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
          />
        ))}
      </BarChart>
    )
  }

  if (chartType === 'composed' && yKey2) {
    return chartWrap(
      <ComposedChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} {...xAxisTickProps} minTickGap={isNarrow ? 6 : 10} />
        <YAxis yAxisId="left" tick={{ fontSize: isNarrow ? 10 : 11 }} width={yAxisW} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: isNarrow ? 10 : 11 }} width={yAxisRightW} />
        <Tooltip />
        <Legend wrapperStyle={legendStyle} />
        <Bar yAxisId="left" dataKey={yKey} fill="#1a73e8" name={yKey} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={yKey2}
          stroke="#ea4335"
          strokeWidth={2}
          dot={false}
          name={yKey2}
        />
      </ComposedChart>
    )
  }

  return chartWrap(
    <BarChart {...commonProps}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={xKey} {...xAxisTickProps} minTickGap={isNarrow ? 6 : 10} />
      <YAxis tick={{ fontSize: isNarrow ? 10 : 11 }} width={yAxisW} />
      <Tooltip />
      <Legend wrapperStyle={legendStyle} />
      <Bar dataKey={yKey} fill="#1a73e8" radius={[4, 4, 0, 0]} />
    </BarChart>
  )
}
