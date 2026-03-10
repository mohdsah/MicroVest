/* ═══════════════════════════════════════════════════════════════
   MicroVest v9 — js/charts.js
   Shared Chart.js Helpers
   ─────────────────────────────────────────────────────────────
   Requires: Chart.js 4.x loaded before this file
   
   MvChart.line(canvasId, labels, data, opts)
   MvChart.bar(canvasId, labels, data, opts)
   MvChart.doughnut(canvasId, labels, data, opts)
   MvChart.sparkline(canvasId, data, color)
   MvChart.destroy(canvasId)
   MvChart.destroyAll()
   MvChart.updateTheme()      → call on themechange event
═══════════════════════════════════════════════════════════════ */

const MvChart = (() => {
  'use strict';

  const _registry = {};   // canvasId → Chart instance

  // ── Theme-aware colors ────────────────────────────────────
  function _css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  function colors() {
    const isLight = document.documentElement.classList.contains('theme-light');
    return {
      plasma:   _css('--plasma')       || '#6D28D9',
      torch:    _css('--torch')        || '#F59E0B',
      profit:   _css('--profit')       || '#10B981',
      loss:     _css('--loss')         || '#F43F5E',
      gold:     _css('--gold')         || '#F59E0B',
      sapphire: _css('--sapphire')     || '#3B82F6',
      ice:      _css('--ice')          || (isLight ? '#1E1B4B' : '#E2E8FF'),
      ice2:     _css('--ice-2')        || (isLight ? '#3730A3' : '#8B95BB'),
      ice3:     _css('--ice-3')        || (isLight ? '#6B7280' : '#3D4466'),
      border:   _css('--border-hi')    || 'rgba(255,255,255,0.07)',
      surface:  isLight ? 'rgba(240,244,255,0.97)' : 'rgba(18,18,40,0.9)',
    };
  }

  // ── Default plugin config ─────────────────────────────────
  function _defaults(title = '') {
    const c = colors();
    return {
      responsive:          true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      plugins: {
        legend:   { display: false },
        tooltip: {
          backgroundColor: 'rgba(3,3,10,0.9)',
          borderColor:     c.border,
          borderWidth:     1,
          titleColor:      c.ice,
          bodyColor:       c.ice2,
          padding:         12,
          cornerRadius:    10,
          titleFont:       { family:"'Plus Jakarta Sans',sans-serif", weight:'800', size:12 },
          bodyFont:        { family:"'JetBrains Mono',monospace", size:11 },
          callbacks: {
            label: (ctx) => ` RM ${parseFloat(ctx.parsed.y ?? ctx.parsed).toFixed(2)}`,
          },
        },
        ...(title ? {
          title: {
            display: true, text: title,
            color: c.ice2, padding: { bottom:12 },
            font: { family:"'Plus Jakarta Sans',sans-serif", size:11, weight:'700' },
          },
        } : {}),
      },
      scales: {
        x: {
          grid:   { color: c.border, drawBorder:false },
          ticks:  { color: c.ice3, font:{ size:10, family:"'JetBrains Mono',monospace" } },
          border: { display:false },
        },
        y: {
          grid:   { color: c.border, drawBorder:false },
          ticks:  { color: c.ice3, font:{ size:10, family:"'JetBrains Mono',monospace" },
                    callback: v => `RM ${v}` },
          border: { display:false },
        },
      },
    };
  }

  // ── Gradient helper ───────────────────────────────────────
  function _gradient(canvas, colorTop, colorBot) {
    const ctx  = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 200);
    grad.addColorStop(0,   colorTop);
    grad.addColorStop(1,   colorBot);
    return grad;
  }

  // ── Destroy helper ────────────────────────────────────────
  function destroy(canvasId) {
    if (_registry[canvasId]) {
      _registry[canvasId].destroy();
      delete _registry[canvasId];
    }
  }

  function destroyAll() {
    Object.keys(_registry).forEach(id => destroy(id));
  }

  // ── LINE CHART ────────────────────────────────────────────
  function line(canvasId, labels, data, opts = {}) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const c    = colors();
    const color = opts.color || c.plasma;
    const grad  = _gradient(canvas,
      color.replace(')', ',0.25)').replace('rgb(','rgba(').replace('#', 'rgba(').includes('rgba') ? color+'40' : color+'40',
      'rgba(0,0,0,0)'
    );

    const cfg = _defaults(opts.title);
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets:[{
          data,
          borderColor:     color,
          borderWidth:     2,
          backgroundColor: grad,
          fill:            true,
          tension:         0.4,
          pointRadius:     opts.points ?? 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
          pointBorderColor: 'transparent',
        }],
      },
      options: {
        ...cfg,
        ...(opts.noScales ? { scales:{ x:{display:false}, y:{display:false} } } : {}),
        ...(opts.noTooltip ? { plugins:{...cfg.plugins, tooltip:{enabled:false}} } : {}),
      },
    });
    _registry[canvasId] = chart;
    return chart;
  }

  // ── MULTI-LINE CHART ──────────────────────────────────────
  function multiLine(canvasId, labels, datasets, opts = {}) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const c = colors();
    const palette = [c.plasma, c.profit, c.torch, c.sapphire, c.loss];

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds, i) => ({
          label:            ds.label,
          data:             ds.data,
          borderColor:      ds.color || palette[i % palette.length],
          borderWidth:      2,
          backgroundColor:  'transparent',
          fill:             false,
          tension:          0.4,
          pointRadius:      2,
          pointHoverRadius: 5,
        })),
      },
      options: {
        ..._defaults(opts.title),
        plugins: {
          ..._defaults().plugins,
          legend: {
            display:  true,
            position: 'top',
            labels:   { color: c.ice2, font:{ size:11 }, boxWidth:12, padding:16 },
          },
        },
      },
    });
    _registry[canvasId] = chart;
    return chart;
  }

  // ── BAR CHART ─────────────────────────────────────────────
  function bar(canvasId, labels, data, opts = {}) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const c     = colors();
    const color = opts.color || c.plasma;

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets:[{
          data,
          backgroundColor: opts.colors || labels.map((_,i) =>
            [c.plasma, c.profit, c.torch, c.sapphire, c.loss, c.gold][i % 6] + 'CC'),
          borderRadius:    8,
          borderWidth:     0,
          hoverBackgroundColor: color,
        }],
      },
      options: _defaults(opts.title),
    });
    _registry[canvasId] = chart;
    return chart;
  }

  // ── DOUGHNUT / PIE ────────────────────────────────────────
  function doughnut(canvasId, labels, data, opts = {}) {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const c = colors();

    const chart = new Chart(canvas, {
      type: opts.pie ? 'pie' : 'doughnut',
      data: {
        labels,
        datasets:[{
          data,
          backgroundColor: [c.plasma, c.profit, c.torch, c.sapphire, c.loss, c.gold, '#A78BFA'],
          borderWidth:      2,
          borderColor:      c.surface,
          hoverOffset:      6,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout: opts.pie ? 0 : '68%',
        plugins: {
          legend: {
            display:  true,
            position: 'bottom',
            labels:   { color: c.ice2, font:{ size:11 }, padding:14, boxWidth:12 },
          },
          tooltip: _defaults().plugins.tooltip,
        },
        animation: { duration:600 },
      },
    });
    _registry[canvasId] = chart;
    return chart;
  }

  // ── SPARKLINE (tiny inline chart, no axes, no tooltip) ────
  function sparkline(canvasId, data, colorHex = '#6D28D9') {
    destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const isUp  = data.length > 1 && data[data.length-1] >= data[0];
    const color = colorHex === 'auto'
      ? (isUp ? colors().profit : colors().loss)
      : colorHex;

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(() => ''),
        datasets:[{
          data,
          borderColor:     color,
          borderWidth:     1.5,
          backgroundColor: 'transparent',
          fill:            false,
          tension:         0.4,
          pointRadius:     0,
          pointHoverRadius:0,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           { duration:400 },
        plugins:             { legend:{display:false}, tooltip:{enabled:false} },
        scales: {
          x: { display:false },
          y: { display:false },
        },
        events: [],
      },
    });
    _registry[canvasId] = chart;
    return chart;
  }

  // ── HEATMAP (activity grid using canvas) ──────────────────
  function heatmap(canvasId, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx   = canvas.getContext('2d');
    const c     = colors();
    const W     = canvas.width  || canvas.offsetWidth  || 360;
    const H     = canvas.height || canvas.offsetHeight || 120;
    canvas.width  = W;
    canvas.height = H;

    const COLS = opts.cols || 53;
    const ROWS = opts.rows || 7;
    const GAP  = opts.gap  || 2;
    const SIZE = Math.floor(Math.min((W-(COLS*GAP))/COLS, (H-(ROWS*GAP))/ROWS));

    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => d.value || 0), 1);

    data.forEach((d, i) => {
      const col = Math.floor(i / ROWS);
      const row = i % ROWS;
      const x   = col * (SIZE + GAP);
      const y   = row * (SIZE + GAP);
      const pct = (d.value || 0) / maxVal;
      const alpha = 0.08 + pct * 0.85;

      ctx.fillStyle = `rgba(109,40,217,${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.roundRect(x, y, SIZE, SIZE, 2);
      ctx.fill();
    });
  }

  // ── UPDATE THEME ──────────────────────────────────────────
  function updateTheme() {
    Object.values(_registry).forEach(chart => {
      if (!chart) return;
      const c = colors();
      // Update grid and tick colors
      if (chart.options.scales?.x) {
        chart.options.scales.x.grid.color  = c.border;
        chart.options.scales.x.ticks.color = c.ice3;
      }
      if (chart.options.scales?.y) {
        chart.options.scales.y.grid.color  = c.border;
        chart.options.scales.y.ticks.color = c.ice3;
      }
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = c.ice2;
      }
      chart.update('none');
    });
  }

  // ── LISTEN FOR THEME CHANGES ──────────────────────────────
  window.addEventListener('themechange', updateTheme);

  return { line, multiLine, bar, doughnut, sparkline, heatmap, destroy, destroyAll, updateTheme, colors };
})();
