import React, { useEffect, useRef } from 'react';

export interface LineChartPoint { date: Date; value: number }

export interface LineChartProps {
  points: LineChartPoint[];
  selectedX?: number | null;
  onSelect?: (x: number) => void;
  onWidthChange?: (w: number) => void;
  height?: number;
  pad?: number;
}

export const LineChart: React.FC<LineChartProps> = ({ points, selectedX, onSelect, onWidthChange, height = 20, pad = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return; // 等待有宽度再绘制
    canvas.width = rect.width;
    canvas.height = height;
    const width = canvas.width;
    const chartHeight = height;
    if (onWidthChange) onWidthChange(width);

    const values = points.map(p => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    const useLogScale = range > 100;
    const getX = (i: number) => pad + (width - 2 * pad) * i / (points.length - 1);
    const getY = (v: number) => {
      if (useLogScale) {
        const logValue = Math.log(v + 1);
        const logMin = Math.log(minValue + 1);
        const logMax = Math.log(maxValue + 1);
        return chartHeight - pad - ((logValue - logMin) / Math.max(logMax - logMin, 0.5)) * (chartHeight - 2 * pad);
      }
      return chartHeight - pad - ((v - minValue) / Math.max(range, 0.5)) * (chartHeight - 2 * pad);
    };

    // 使用对数压缩进行颜色映射：最低值绿色，最高值红色，中间渐变
    const getColorByValue = (v: number) => {
      const logMin = Math.log(minValue + 1);
      const logMax = Math.log(maxValue + 1);
      if (logMax === logMin) return 'rgb(255,255,0)';
      const t = (Math.log(v + 1) - logMin) / (logMax - logMin);
      if (t <= 0.5) {
        const r = Math.round(2 * t * 255);
        return `rgb(${r},255,0)`; // 绿色到黄色
      }
      const g = Math.round((1 - 2 * (t - 0.5)) * 255);
      return `rgb(255,${g},0)`; // 黄色到红色
    };

    ctx.clearRect(0, 0, width, chartHeight);
    ctx.lineWidth = 1;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const x1 = getX(i);
      const y1 = getY(p1.value);
      const x2 = getX(i + 1);
      const y2 = getY(p2.value);
      ctx.beginPath();
      ctx.strokeStyle = getColorByValue(p1.value);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (selectedX !== null && selectedX !== undefined) {
      ctx.beginPath();
      ctx.strokeStyle = '#FFD600';
      ctx.lineWidth = 1;
      ctx.moveTo(selectedX, 0);
      ctx.lineTo(selectedX, chartHeight);
      ctx.stroke();
    }
  };

  // 设置canvas高度CSS变量
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.setProperty('--canvas-height', `${height}px`);
    }
  }, [height]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onClick = (ev: MouseEvent) => {
      const x = (ev as MouseEvent & { offsetX?: number }).offsetX ?? (ev.clientX - canvas.getBoundingClientRect().left);
      onSelect?.(x);
    };
    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [points, selectedX, onSelect, height, pad]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ResizeObserverCtor = (window as any).ResizeObserver as any;
    const ro = typeof ResizeObserverCtor === 'function' ? new ResizeObserverCtor(() => {
      draw();
    }) : null;
    if (ro) {
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [points, selectedX, height, pad]);

  return (
    <div ref={containerRef} className="top-summary-chart">
      <canvas ref={canvasRef} className="line-chart-canvas" />
    </div>
  );
};

