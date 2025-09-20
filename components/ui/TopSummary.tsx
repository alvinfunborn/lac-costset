import React, { useMemo, useState } from 'react';
import { t } from '../../i18n';
import { TagPanel } from './TagPanel';
import { LineChart } from './LineChart';

export interface TrendPoint { date: Date; value: number }

export interface TopSummaryProps {
  totalDailyCost: number;
  totalCost: number;
  totalRecycle: number;
  tags: string[];
  selectedTags: string[];
  onTagClick: (tag: string | string[]) => void;
  trendPoints: TrendPoint[];
  selectedDate?: Date;
  onDatePick?: (dateStr: string) => void;
  onOpenTagPanel?: () => void;
}

export const TopSummary: React.FC<TopSummaryProps> = ({ totalDailyCost, totalCost, totalRecycle, tags, selectedTags, onTagClick, trendPoints, selectedDate, onDatePick }) => {
  const currency = t('currency.symbol');
  const [chartWidth, setChartWidth] = useState<number>(0);
  const chartPad = 0;

  const selectedX = useMemo<number | null>(() => {
    if (!selectedDate || trendPoints.length < 2 || chartWidth <= 0) return null;
    try {
      const times = trendPoints.map(p => p.date.getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      const cur = selectedDate.getTime();
      const denom = Math.max(maxTime - minTime, 1);
      const ratio = (cur - minTime) / denom;
      return chartPad + (chartWidth - 2 * chartPad) * Math.min(Math.max(ratio, 0), 1);
    } catch {
      return null;
    }
  }, [selectedDate, trendPoints, chartWidth]);

  const openCustomDatePicker = () => {
    const now = new Date();
    const base = selectedDate || now;
    const yearsFromTrend = trendPoints.length > 0 ? new Date(Math.min(...trendPoints.map(p => p.date.getTime()))).getFullYear() : base.getFullYear();
    const minYear = Math.max(1900, yearsFromTrend);
    const maxYear = now.getFullYear() + 7;

    const mask = document.createElement('div');
    mask.className = 'date-picker-mask';

    const picker = document.createElement('div');
    picker.className = 'date-picker-modal';

    const content = document.createElement('div');
    content.className = 'date-picker-content';

    const title = document.createElement('div');
    title.className = 'date-picker-title';
    title.textContent = t('date.pick');

    const wheel = document.createElement('div');
    wheel.className = 'date-wheel-container';

    const yearValues = Array.from({ length: (maxYear - minYear + 1) }, (_, i) => minYear + i);
    const monthValues = Array.from({ length: 12 }, (_, i) => i + 1);
    const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();

    const createColumn = (suffix: string, values: number[], selected: number, onChange?: (v: number) => void, infinite = false) => {
      const col = document.createElement('div');
      col.className = 'date-wheel-column';
      const container = document.createElement('div');
      container.className = 'date-wheel-items';
      const itemHeight = 40;
      let selectedIndex = values.indexOf(selected);
      let selectedValue = selected;

      const markSelected = (realIndex: number) => {
        const items = Array.from(container.querySelectorAll('.date-wheel-item')) as HTMLElement[];
        items.forEach((it, idx) => {
          const logicalIdx = infinite ? (idx % values.length) : idx;
          it.classList.toggle('selected', logicalIdx === realIndex);
        });
      };

      if (infinite) {
        const repeat = 5; const mid = 2; const total = values.length * repeat;
        for (let r = 0; r < repeat; r++) values.forEach((v, idx) => {
          const item = document.createElement('div'); item.className = 'date-wheel-item';
          item.textContent = `${v.toString().padStart(2, '0')}${suffix}`; item.dataset.index = String(r * values.length + idx); (item as any).dataset.realValue = v;
          container.appendChild(item);
        });
        // 初始选中样式
        markSelected(selectedIndex);
        container.style.height = `${total * itemHeight}px`;
        const initIndex = mid * values.length + selectedIndex;
        requestAnimationFrame(() => { container.scrollTop = initIndex * itemHeight; });
        let isScrolling = false;
        container.addEventListener('scroll', () => {
          if (isScrolling) return;
          const curIdx = Math.round(container.scrollTop / itemHeight);
          const realIdx = ((curIdx % values.length) + values.length) % values.length;
          selectedIndex = realIdx; selectedValue = values[realIdx];
          markSelected(realIdx);
          if (onChange) onChange(selectedValue);
          const maxTop = (repeat - 1) * values.length * itemHeight;
          if (container.scrollTop >= maxTop) { isScrolling = true; const off = container.scrollTop - maxTop; container.scrollTop = values.length * itemHeight + off; setTimeout(() => isScrolling = false, 50); }
          else if (container.scrollTop <= 0) { isScrolling = true; const off = container.scrollTop; container.scrollTop = (repeat - 2) * values.length * itemHeight + off; setTimeout(() => isScrolling = false, 50); }
        });
        container.addEventListener('click', (ev) => {
          const itemEl = (ev.target as HTMLElement).closest('.date-wheel-item') as HTMLElement | null; if (!itemEl) return;
          const idx = Number(itemEl.dataset.index || '0'); const real = ((idx % values.length) + values.length) % values.length; const midIndex = mid * values.length + real;
          container.scrollTop = midIndex * itemHeight; selectedIndex = real; selectedValue = values[real]; markSelected(real); if (onChange) onChange(selectedValue);
        });
      } else {
        values.forEach((v, idx) => { const item = document.createElement('div'); item.className = 'date-wheel-item'; item.textContent = `${v.toString().padStart(2, '0')}${suffix}`; item.dataset.index = String(idx); container.appendChild(item); });
        markSelected(selectedIndex);
        requestAnimationFrame(() => { container.scrollTop = selectedIndex * itemHeight; });
        container.addEventListener('scroll', () => { const curIdx = Math.round(container.scrollTop / itemHeight); if (curIdx !== selectedIndex && curIdx >= 0 && curIdx < values.length) { selectedIndex = curIdx; selectedValue = values[curIdx]; markSelected(curIdx); if (onChange) onChange(selectedValue); } });
        container.addEventListener('click', (ev) => { const itemEl = (ev.target as HTMLElement).closest('.date-wheel-item') as HTMLElement | null; if (!itemEl) return; const idx = Number(itemEl.dataset.index || '0'); container.scrollTop = idx * itemHeight; selectedIndex = idx; selectedValue = values[idx]; markSelected(idx); if (onChange) onChange(selectedValue); });
      }
      col.appendChild(container); (col as any).selectedValue = selectedValue; return col as any;
    };

    let y = base.getFullYear(); let m = base.getMonth() + 1; let d = base.getDate();
    const yearCol = createColumn(t('date.year'), yearValues, Math.min(Math.max(y, minYear), maxYear), (val) => { y = val; updateDays(); }, false);
    const monthCol = createColumn(t('date.month'), monthValues, m, (val) => { m = val; updateDays(); }, true);
    const dayCol = createColumn(t('date.day'), Array.from({ length: daysIn(y, m) }, (_, i) => i + 1), Math.min(d, daysIn(y, m)), (val) => { d = val; }, true);

    const updateDays = () => {
      const container = dayCol.querySelector('.date-wheel-items') as HTMLElement;
      if (!container) return;
      while (container.firstChild) container.removeChild(container.firstChild);
      const count = daysIn(y, m); const values = Array.from({ length: count }, (_, i) => i + 1); const repeat = 5; const itemHeight = 40; const mid = 2; const sel = Math.min(d, count); const selIndex = values.indexOf(sel);
      for (let r = 0; r < repeat; r++) values.forEach((v, idx) => { const item = document.createElement('div'); item.className = 'date-wheel-item'; item.textContent = `${v.toString().padStart(2, '0')}${t('date.day')}`; item.dataset.index = String(r * values.length + idx); container.appendChild(item); });
      // 高亮
      const mark = (realIdx: number) => {
        const items = Array.from(container.querySelectorAll('.date-wheel-item')) as HTMLElement[];
        items.forEach((it, i) => it.classList.toggle('selected', (i % values.length) === realIdx));
      };
      mark(selIndex);
      container.style.height = `${values.length * repeat * itemHeight}px`;
      requestAnimationFrame(() => { container.scrollTop = mid * values.length * itemHeight + selIndex * itemHeight; });
      let isScrolling = false;
      container.addEventListener('scroll', () => {
        if (isScrolling) return;
        const curIdx = Math.round(container.scrollTop / itemHeight);
        const realIdx = curIdx % values.length;
        d = values[realIdx];
        mark(realIdx);
        const maxTop = (repeat - 1) * values.length * itemHeight;
        if (container.scrollTop >= maxTop) { isScrolling = true; const off = container.scrollTop - maxTop; container.scrollTop = values.length * itemHeight + off; setTimeout(() => isScrolling = false, 50); }
        else if (container.scrollTop <= 0) { isScrolling = true; const off = container.scrollTop; container.scrollTop = (repeat - 2) * values.length * itemHeight + off; setTimeout(() => isScrolling = false, 50); }
      });
      container.addEventListener('click', (ev) => { const el = (ev.target as HTMLElement).closest('.date-wheel-item') as HTMLElement | null; if (!el) return; const idx = Number(el.dataset.index || '0'); const real = idx % values.length; container.scrollTop = mid * values.length * itemHeight + real * itemHeight; d = values[real]; mark(real); });
    };

    wheel.appendChild(yearCol); wheel.appendChild(monthCol); wheel.appendChild(dayCol);

    const actions = document.createElement('div');
    actions.className = 'date-picker-actions';
    const cancelBtn = document.createElement('button'); cancelBtn.className = 'date-picker-btn date-picker-btn-cancel'; cancelBtn.textContent = t('common.cancel');
    const confirmBtn = document.createElement('button'); confirmBtn.className = 'date-picker-btn date-picker-btn-confirm'; confirmBtn.textContent = t('common.confirm');

    actions.appendChild(cancelBtn); actions.appendChild(confirmBtn);
    content.appendChild(title); content.appendChild(wheel); content.appendChild(actions);
    picker.appendChild(content); mask.appendChild(picker); document.body.appendChild(mask);

    const close = () => { if (mask.parentElement) mask.parentElement.removeChild(mask); };
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    cancelBtn.addEventListener('click', close);
    confirmBtn.addEventListener('click', () => { const picked = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); const iso = new Date(picked.getTime() - picked.getTimezoneOffset() * 60000).toISOString().split('T')[0]; onDatePick?.(iso); close(); });
  };

  return (
    <div>
      <div className="top-summary-numbers">
        <div className="top-summary-daily">
          <div className="top-summary-date clickable" onClick={openCustomDatePicker}>{new Date((selectedDate || new Date()).getTime() - (selectedDate || new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]}</div>
          <div className="top-summary-dailycost">{currency}{totalDailyCost.toFixed(2)}</div>
        </div>
        <div className="top-summary-summary">
          <div className="top-summary-total">
            <span className="top-summary-meta">{t('top.total')}</span>
            <span className="top-summary-totalcost">{currency}{totalCost.toLocaleString()}</span>
          </div>
          <div className="top-summary-total">
            <span className="top-summary-meta">{t('top.recycle')}</span>
            <span className="top-summary-totalcost">{currency}{totalRecycle.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <TagPanel tags={tags} selectedTags={selectedTags} onTagClick={onTagClick} />
      <LineChart
        points={trendPoints}
        selectedX={selectedX ?? undefined}
        onWidthChange={(w) => setChartWidth(w)}
        pad={chartPad}
        onSelect={(x) => {
          if (trendPoints.length < 2 || chartWidth <= 0) return;
          const usable = Math.max(chartWidth - 2 * chartPad, 1);
          const ratio = Math.min(Math.max((x - chartPad) / usable, 0), 1);
          const idx = Math.round(ratio * (trendPoints.length - 1));
          const clampedIdx = Math.min(Math.max(idx, 0), trendPoints.length - 1);
          const picked = trendPoints[clampedIdx].date;
          const iso = new Date(picked.getTime() - picked.getTimezoneOffset() * 60000).toISOString().split('T')[0];
          onDatePick?.(iso);
        }}
      />
    </div>
  );
};
