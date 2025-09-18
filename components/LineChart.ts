export interface LineChartProps {
	points: { date: Date, value: number }[];
	selectedX?: number | null;
	onSelect?: (x: number) => void;
	onWidthChange?: (w: number) => void;
	height?: number;
	pad?: number;
}

export class LineChart {
	private canvas: HTMLCanvasElement;
	private props: LineChartProps;
	private width: number = 0;
	private height: number = 20;
	private pad: number = 0;

	constructor(canvas: HTMLCanvasElement, props: LineChartProps) {
		this.canvas = canvas;
		this.props = props;
		this.height = props.height || 20;
		this.pad = props.pad || 0;
		
		this.setupCanvas();
		this.render();
	}

	private setupCanvas(): void {
		// 设置Canvas尺寸
		const rect = this.canvas.getBoundingClientRect();
		this.canvas.width = rect.width;
		this.canvas.height = rect.height;
		this.width = this.canvas.width;
		
		// 通知宽度变化
		if (this.props.onWidthChange) {
			this.props.onWidthChange(this.width);
		}
	}

	render(): void {
		if (this.props.points.length < 2) return;
		
		const ctx = this.canvas.getContext('2d');
		if (!ctx) return;
		
		// 计算数值范围
		const values = this.props.points.map(p => p.value);
		const minValue = Math.min(...values);
		const maxValue = Math.max(...values);
		const range = maxValue - minValue;
		
		// 如果数据范围很小，使用线性缩放；否则使用对数缩放
		const useLogScale = range > 100;
		
		const getX = (i: number) => this.pad + (this.width - 2 * this.pad) * i / (this.props.points.length - 1);
		const getY = (v: number) => {
			if (useLogScale) {
				const logValue = Math.log(v + 1);
				const logMin = Math.log(minValue + 1);
				const logMax = Math.log(maxValue + 1);
				return this.height - this.pad - ((logValue - logMin) / Math.max(logMax - logMin, 0.5)) * (this.height - 2 * this.pad);
			} else {
				return this.height - this.pad - ((v - minValue) / Math.max(range, 0.5)) * (this.height - 2 * this.pad);
			}
		};
		const getColorByValue = (v: number) => {
			if (range === 0) return 'rgb(255,255,0)';
			const t = (v - minValue) / range;
			if (t <= 0.5) {
				const r = Math.round(2 * t * 255);
				return `rgb(${r},255,0)`;
			} else {
				const g = Math.round((1 - 2 * (t - 0.5)) * 255);
				return `rgb(255,${g},0)`;
			}
		};
		
		// 清空画布
		ctx.clearRect(0, 0, this.width, this.height);
		ctx.lineWidth = 1;
		
		// 绘制折线
		for (let i = 0; i < this.props.points.length - 1; i++) {
			const p1 = this.props.points[i];
			const p2 = this.props.points[i + 1];
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
		
		// 绘制选中线
		if (this.props.selectedX !== null && this.props.selectedX !== undefined) {
			const selectedX = this.props.selectedX;
			ctx.beginPath();
			ctx.strokeStyle = '#FFD600';
			ctx.lineWidth = 1;
			ctx.moveTo(selectedX, 0);
			ctx.lineTo(selectedX, this.height);
			ctx.stroke();
		}
	}

	// 更新数据点
	updatePoints(points: { date: Date, value: number }[]): void {
		this.props.points = points;
		this.render();
	}

	// 更新选中位置
	updateSelection(selectedX: number | null): void {
		this.props.selectedX = selectedX;
		this.render();
	}

	// 获取点击位置对应的数据点
	getPointByX(x: number): { date: Date, value: number } | null {
		if (this.props.points.length < 2) return null;
		const ratio = Math.max(0, Math.min(1, (x - this.pad) / (this.width - 2 * this.pad)));
		const index = Math.round(ratio * (this.props.points.length - 1));
		return this.props.points[index] || null;
	}
}
