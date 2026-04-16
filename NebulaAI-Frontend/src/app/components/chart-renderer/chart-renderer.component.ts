import {
  Component, Input, OnChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit, SimpleChanges
} from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface ChartSpec {
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter'
      | 'horizontal_bar' | 'stacked_bar' | 'composed';
  title: string;
  x_key: string;
  y_key: string;
  y_key_2?: string | null;
  y_keys?: string[] | null;
  series_key?: string | null;
  data: Record<string, any>[];
}

const TYPE_ALIASES: Record<string, string> = {
  hbar:'horizontal_bar', horizontal:'horizontal_bar',
  column:'bar', stack:'stacked_bar', stacks:'stacked_bar', stacked:'stacked_bar',
};
const ALLOWED_TYPES = new Set([
  'bar','line','area','pie','scatter','horizontal_bar','stacked_bar','composed',
]);

function isNumericLike(v: any): boolean {
  return v !== null && v !== '' && !Number.isNaN(Number(v));
}

export function normalizeChartSpec(raw: any): ChartSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  let data = raw.data;
  if (!Array.isArray(data)) {
    if (Array.isArray(raw.rows))        data = raw.rows;
    else if (Array.isArray(raw.series)) data = raw.series;
    else if (Array.isArray(raw.points)) data = raw.points;
    else return null;
  }
  if (data.length === 0) return null;

  let type = String(raw.type ?? 'bar').toLowerCase().trim();
  type = TYPE_ALIASES[type] || type;
  if (!ALLOWED_TYPES.has(type)) type = 'bar';

  const sample       = data[0] || {};
  const keys         = Object.keys(sample);
  const numericKeys  = keys.filter(k => isNumericLike(sample[k]));
  const categoryKeys = keys.filter(k => !isNumericLike(sample[k]));

  const inferredXKey = categoryKeys[0] || keys[0] || 'x';
  const inferredYKey = numericKeys[0]  || keys[1] || keys[0] || 'y';

  const x_key      = raw.x_key      && keys.includes(raw.x_key)      ? raw.x_key      : inferredXKey;
  const y_key      = raw.y_key      && keys.includes(raw.y_key)      ? raw.y_key      : inferredYKey;
  const y_key_2    = raw.y_key_2    && keys.includes(raw.y_key_2)    ? raw.y_key_2    : null;
  const series_key = raw.series_key && keys.includes(raw.series_key) ? raw.series_key : null;
  const y_keys     = Array.isArray(raw.y_keys)
    ? raw.y_keys.map(String).filter((k: string) => keys.includes(k))
    : null;

  return { type: type as ChartSpec['type'],
           title: raw.title != null ? String(raw.title) : 'Chart',
           x_key, y_key, y_key_2, y_keys, series_key, data };
}

function pivotData(
  data: Record<string,any>[],
  xKey: string, yKey: string, seriesKey: string
): { pivoted: Record<string,any>[]; seriesNames: string[] } {
  const seriesNames = [...new Set(data.map(r => String(r[seriesKey])))];
  const dates       = [...new Set(data.map(r => String(r[xKey])))].sort();
  const pivoted = dates.map(date => {
    const row: Record<string,any> = { [xKey]: date };
    for (const s of seriesNames) {
      const match = data.find(r => String(r[xKey]) === date && String(r[seriesKey]) === s);
      row[s] = match ? Number(match[yKey]) : 0;
    }
    return row;
  });
  return { pivoted, seriesNames };
}

const PALETTE = [
  '#0ea5e9','#06b6d4','#6366f1','#8b5cf6',
  '#10b981','#f59e0b','#f43f5e','#ec4899',
];

@Component({
  selector: 'app-chart-renderer',
  standalone: true,
  imports: [NgIf, NgFor],
  templateUrl: './chart-renderer.component.html',
  styleUrl:    './chart-renderer.component.css',
})
export class ChartRendererComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() spec!: ChartSpec;
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  get title(): string { return this.spec?.title || ''; }

  /** Dynamic canvas width — expands for large datasets so bars/points don't crush */
  get canvasWidth(): number {
    if (!this.spec) return 600;
    const count = this.spec.series_key
      // long format: unique x values
      ? new Set(this.spec.data.map(r => r[this.spec.x_key])).size
      : this.spec.data.length;

    const PX_PER_POINT = 22;   // pixels allocated per data point
    const MIN_WIDTH    = 500;
    const MAX_WIDTH    = 4000;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, count * PX_PER_POINT));
  }

  // ✅ AfterViewInit fires when canvas is in DOM
  ngAfterViewInit(): void {
    this.viewReady = true;
    // Spec may already be set — render now
    if (this.spec) {
      this.destroyChart();
      this.render();
    }
  }

  // ✅ OnChanges fires when @Input spec changes
  ngOnChanges(c: SimpleChanges): void {
    if (!c['spec'] || !this.viewReady) return;
    this.destroyChart();
    // Small delay ensures canvas dimensions are calculated
    setTimeout(() => this.render(), 50);
  }

  ngOnDestroy(): void { this.destroyChart(); }

  private render(): void {
    if (!this.spec || !this.canvasRef?.nativeElement) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const s = this.spec;
    let chartData    = [...s.data];
    let seriesNames: string[] = [];
    let useSeries = false;

    // ── Pivot long → wide if series_key present ──────────
    if (s.series_key) {
      const result  = pivotData(s.data, s.x_key, s.y_key, s.series_key);
      chartData     = result.pivoted;
      seriesNames   = result.seriesNames;
      useSeries     = true;
    }

    // Coerce numerics
    const sample = chartData[0] || {};
    const keys   = Object.keys(sample);
    chartData = chartData.map(row => {
      const out: any = { ...row };
      for (const k of keys) if (isNumericLike(row[k])) out[k] = Number(row[k]);
      return out;
    });

    const labels  = chartData.map(r => String(r[s.x_key] ?? ''));
    let chartType = s.type;

    // stacked_bar keys
    let stackKeys = useSeries ? seriesNames : (s.y_keys?.filter(k => keys.includes(k)) ?? null);
    if (chartType === 'stacked_bar' && !useSeries) {
      if (!stackKeys || stackKeys.length < 2)
        stackKeys = keys.filter(k => k !== s.x_key && isNumericLike(sample[k]));
      if (!stackKeys || stackKeys.length < 2) { chartType = 'bar'; stackKeys = null; }
    }

    // composed y2
    let y_key_2 = s.y_key_2;
    if (chartType === 'composed' && !y_key_2)
      y_key_2 = keys.find(k => k !== s.x_key && k !== s.y_key && isNumericLike(sample[k])) ?? null;
    if (chartType === 'composed' && !y_key_2) chartType = 'bar';

    let config: any;

    // ── Multi-series line / area / bar (series_key) ──────
    if (useSeries && ['line','area','bar','stacked_bar'].includes(chartType)) {
      const isBar     = chartType === 'bar';
      const isStacked = chartType === 'stacked_bar';
      const isFill    = chartType === 'area';
      config = {
        type: isBar || isStacked ? 'bar' : 'line',
        data: {
          labels,
          datasets: seriesNames.map((name, i) => ({
            label:           name,
            data:            chartData.map(r => Number(r[name] ?? 0)),
            borderColor:     PALETTE[i % PALETTE.length],
            backgroundColor: PALETTE[i % PALETTE.length] + (isBar||isStacked ? 'cc' : isFill ? '33' : '22'),
            borderWidth:     isBar||isStacked ? 1.5 : 2,
            tension:         0.4,
            fill:            isFill,
            pointRadius:     isBar||isStacked ? 0 : 2,
            borderRadius:    isBar||isStacked ? 4 : 0,
            ...(isStacked ? { stack: 'stack' } : {}),
          })),
        },
        options: isStacked
          ? { ...this.baseOptions({}), scales: {
              x: { ...this.baseScales().x, stacked: true },
              y: { ...this.baseScales().y, stacked: true },
            }}
          : this.baseOptions({}),
      };
    }

    // ── PIE ─────────────────────────────────────────────
    else if (chartType === 'pie') {
      config = {
        type: 'pie',
        data: { labels, datasets: [{
          data:            chartData.map(r => Number(r[s.y_key])),
          backgroundColor: PALETTE.map(c => c+'cc'), borderColor:'#fff', borderWidth:2,
        }]},
        options: this.baseOptions({ legendPos:'right', noScales:true }),
      };
    }

    // ── SCATTER ─────────────────────────────────────────
    else if (chartType === 'scatter') {
      config = {
        type: 'scatter',
        data: { datasets: [{
          label: s.title,
          data:  chartData.map(r => ({ x:Number(r[s.x_key]), y:Number(r[s.y_key]) })),
          backgroundColor: PALETTE[0]+'99', borderColor:PALETTE[0],
          borderWidth:1.5, pointRadius:5,
        }]},
        options: this.baseOptions({}),
      };
    }

    // ── HORIZONTAL BAR ──────────────────────────────────
    else if (chartType === 'horizontal_bar') {
      config = {
        type:'bar',
        data:{ labels, datasets:[{
          label:s.y_key, data:chartData.map(r=>Number(r[s.y_key])),
          backgroundColor:PALETTE[0]+'cc', borderColor:PALETTE[0], borderWidth:1.5, borderRadius:4,
        }]},
        options:{ ...this.baseOptions({}), indexAxis:'y' },
      };
    }

    // ── STACKED BAR (wide) ──────────────────────────────
    else if (chartType === 'stacked_bar' && stackKeys) {
      config = {
        type:'bar',
        data:{ labels, datasets: stackKeys.map((k,i)=>({
          label:k, data:chartData.map(r=>Number(r[k])),
          backgroundColor:PALETTE[i%PALETTE.length]+'cc',
          borderColor:PALETTE[i%PALETTE.length], borderWidth:1, stack:'stack',
        }))},
        options:{ ...this.baseOptions({}), scales:{
          x:{ ...this.baseScales().x, stacked:true },
          y:{ ...this.baseScales().y, stacked:true },
        }},
      };
    }

    // ── COMPOSED ────────────────────────────────────────
    else if (chartType === 'composed' && y_key_2) {
      config = {
        type:'bar',
        data:{ labels, datasets:[
          { type:'bar'  as any, label:s.y_key, data:chartData.map(r=>Number(r[s.y_key])),
            backgroundColor:PALETTE[0]+'cc', borderColor:PALETTE[0], yAxisID:'y' },
          { type:'line' as any, label:y_key_2, data:chartData.map(r=>Number(r[y_key_2!])),
            borderColor:PALETTE[4], backgroundColor:'transparent',
            borderWidth:2, tension:0.4, yAxisID:'y1', pointRadius:3 },
        ]},
        options:{ ...this.baseOptions({}), scales:{ ...this.baseScales(),
          y1:{ type:'linear', position:'right', grid:{drawOnChartArea:false},
               ticks:{font:{size:11},color:'#6b7280'} } } },
      };
    }

    // ── AREA ────────────────────────────────────────────
    else if (chartType === 'area') {
      config = {
        type:'line',
        data:{ labels, datasets:[{
          label:s.y_key, data:chartData.map(r=>Number(r[s.y_key])),
          borderColor:PALETTE[0], backgroundColor:PALETTE[0]+'33',
          borderWidth:2, tension:0.4, fill:true, pointRadius:3,
        }]},
        options: this.baseOptions({}),
      };
    }

    // ── LINE ────────────────────────────────────────────
    else if (chartType === 'line') {
      config = {
        type:'line',
        data:{ labels, datasets:[{
          label:s.y_key, data:chartData.map(r=>Number(r[s.y_key])),
          borderColor:PALETTE[0], backgroundColor:PALETTE[0]+'22',
          borderWidth:2, tension:0.4, fill:false, pointRadius:3,
        }]},
        options: this.baseOptions({}),
      };
    }

    // ── BAR (default) ───────────────────────────────────
    else {
      config = {
        type:'bar',
        data:{ labels, datasets:[{
          label:s.y_key, data:chartData.map(r=>Number(r[s.y_key])),
          backgroundColor:PALETTE[0]+'cc', borderColor:PALETTE[0],
          borderWidth:1.5, borderRadius:5,
        }]},
        options: this.baseOptions({}),
      };
    }

    // Set canvas pixel dimensions to match container
    const el = this.canvasRef.nativeElement;
    el.style.width  = '100%';
    el.style.height = '100%';

    this.chart = new Chart(ctx, config);
  }

  private baseOptions(e: { legendPos?: string; noScales?: boolean } = {}): any {
    return {
      responsive:true, maintainAspectRatio:false, animation:{duration:500},
      plugins:{
        legend:{ display:true, position: e.legendPos||'top',
          labels:{font:{size:11,family:'DM Sans,Inter,sans-serif'},
                  color:'#374151',boxWidth:12,boxHeight:12,padding:10} },
        title:{ display:false },
        tooltip:{ backgroundColor:'rgba(12,35,64,0.9)',
          titleFont:{size:12,family:'DM Sans,Inter,sans-serif'},
          bodyFont:{size:12,family:'DM Sans,Inter,sans-serif'},
          padding:10, cornerRadius:8,
          borderColor:'rgba(14,165,233,0.2)', borderWidth:1 },
      },
      scales: e.noScales ? {} : this.baseScales(),
    };
  }

  private baseScales(): any {
    return {
      x:{ grid:{color:'rgba(14,165,233,0.07)',drawBorder:false},
          ticks:{font:{size:10,family:'DM Sans,Inter,sans-serif'},color:'#6b7280',
                 maxRotation:45,autoSkip:true,maxTicksLimit:15},
          border:{display:false} },
      y:{ grid:{color:'rgba(14,165,233,0.09)',drawBorder:false},
          ticks:{font:{size:11,family:'DM Sans,Inter,sans-serif'},color:'#6b7280'},
          border:{display:false}, beginAtZero:true },
    };
  }

  private destroyChart(): void {
    if (this.chart) { this.chart.destroy(); this.chart = null; }
  }
}