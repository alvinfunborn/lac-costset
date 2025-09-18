import { Asset } from '../models/Asset';
import { TagPanel, TagPanelProps } from './TagPanel';
import { t } from '../i18n';

export interface TopSummaryProps {
	totalDailyCost: number;
	totalCost: number;
	totalRecycle: number;
	tags: string[];
	selectedTags: string[];
	onTagClick: (tag: string | string[]) => void;
	trendPoints: { date: Date, value: number }[];
	selectedDate?: Date;
	selectedX?: number | null;
	onChartSelect?: (x: number) => void;
	onChartWidth?: (w: number) => void;
	onDatePick?: (dateStr: string) => void;
	minDateStr?: string;
	maxDateStr?: string;
	minYear?: number;
	maxYear?: number;
}

export class TopSummary {
	private containerEl: HTMLElement;
	private props: TopSummaryProps;
	private chartComponent?: any; // LineChart组件引用
	private tagPanelComponent?: TagPanel;

	constructor(containerEl: HTMLElement, props: TopSummaryProps) {
		this.containerEl = containerEl;
		this.props = props;
	}

	private formatDateLocal(date: Date): string {
		const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
		return d.toISOString().split('T')[0];
	}

	render(): void {
		this.containerEl.empty();
		this.containerEl.addClass('top-summary');

		// 创建数字区域
		this.renderNumbers();
		
		// 创建标签区域
		this.renderLabels();
		
		// 创建图表区域
		this.renderChart();
	}

	private renderNumbers(): void {
		const numbersEl = this.containerEl.createDiv('top-summary-numbers');
		
		// 左侧日均成本
		const dailyEl = numbersEl.createDiv('top-summary-daily');
		const dateEl = dailyEl.createDiv('top-summary-date');
		dateEl.textContent = this.formatDateLocal(this.props.selectedDate || new Date());
		dateEl.addClass('clickable');
		dateEl.addEventListener('click', () => {
			this.showDatePicker();
		});
		const dailyCostEl = dailyEl.createDiv('top-summary-dailycost');
		dailyCostEl.textContent = `${this.getCurrencySymbol()}${this.props.totalDailyCost.toFixed(2)}`;

		// 右侧汇总
		const summaryEl = numbersEl.createDiv('top-summary-summary');
		
		const totalEl = summaryEl.createDiv('top-summary-total');
		const totalMetaEl = totalEl.createSpan('top-summary-meta');
		totalMetaEl.textContent = t('top.total');
		const totalCostEl = totalEl.createSpan('top-summary-totalcost');
		totalCostEl.textContent = `${this.getCurrencySymbol()}${this.props.totalCost.toLocaleString()}`;

		const recycleEl = summaryEl.createDiv('top-summary-total');
		const recycleMetaEl = recycleEl.createSpan('top-summary-meta');
		recycleMetaEl.textContent = t('top.recycle');
		const recycleCostEl = recycleEl.createSpan('top-summary-totalcost');
		recycleCostEl.textContent = `${this.getCurrencySymbol()}${this.props.totalRecycle.toLocaleString()}`;
	}

	private renderLabels(): void {
		const labelsEl = this.containerEl.createDiv('top-summary-labels');
		const panelProps: TagPanelProps = {
			tags: this.props.tags,
			selectedTags: this.props.selectedTags,
			onTagClick: this.props.onTagClick,
			maxHeight: '48px'
		};
		this.tagPanelComponent = new TagPanel(labelsEl, panelProps);
		this.tagPanelComponent.render();
	}

	private getCurrencySymbol(): string {
		return t('currency.symbol');
	}

	private renderChart(): void {
		const chartEl = this.containerEl.createDiv('top-summary-chart');
		const canvas = chartEl.createEl('canvas') as HTMLCanvasElement;
		canvas.id = 'trend-canvas';
		canvas.width = 100;
		canvas.height = 20;

		// 渲染图表
		this.renderChartCanvas(canvas);
	}

	private renderChartCanvas(canvas: HTMLCanvasElement): void {
		if (this.props.trendPoints.length < 2) return;
		
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		
		// 设置Canvas尺寸
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width;
		canvas.height = rect.height;
		
		const width = canvas.width;
		const height = canvas.height;
		const pad = 0;
		
		// 计算数值范围
		const values = this.props.trendPoints.map(p => p.value);
		const minValue = Math.min(...values);
		const maxValue = Math.max(...values);
		const range = maxValue - minValue;
		
		// 如果数据范围很小，使用线性缩放；否则使用对数缩放
		const useLogScale = range > 100;
		
		const getX = (i: number) => pad + (width - 2 * pad) * i / (this.props.trendPoints.length - 1);
		const getY = (v: number) => {
			if (useLogScale) {
				const logValue = Math.log(v + 1);
				const logMin = Math.log(minValue + 1);
				const logMax = Math.log(maxValue + 1);
				return height - pad - ((logValue - logMin) / Math.max(logMax - logMin, 0.5)) * (height - 2 * pad);
			} else {
				return height - pad - ((v - minValue) / Math.max(range, 0.5)) * (height - 2 * pad);
			}
		};
		const getColorByValue = (v: number) => {
			// 使用对数缩放计算颜色（参考costsetapp实现）
			const logValue = Math.log(v + 1);
			const logMin = Math.log(minValue + 1);
			const logMax = Math.log(maxValue + 1);
			
			if (logMax === logMin) return 'rgb(255,255,0)'; // 如果只有一个值，显示黄色
			
			const t = (logValue - logMin) / (logMax - logMin);
			
			// 分段渐变：前半段绿色到黄色，后半段黄色到红色
			if (t <= 0.5) {
				const r = Math.round(2 * t * 255); // 红色分量：0 -> 255
				return `rgb(${r},255,0)`; // 绿色到黄色
			} else {
				const g = Math.round((1 - 2 * (t - 0.5)) * 255); // 绿色分量：255 -> 0
				return `rgb(255,${g},0)`; // 黄色到红色
			}
		};
		
		// 清空画布
		ctx.clearRect(0, 0, width, height);
		ctx.lineWidth = 1;
		
		// 绘制折线
		for (let i = 0; i < this.props.trendPoints.length - 1; i++) {
			const p1 = this.props.trendPoints[i];
			const p2 = this.props.trendPoints[i + 1];
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
		
		// 绘制选中线（当前日期）
		// 支持两种方式：
		// 1) 外部直接传入 selectedX 像素
		// 2) 外部仅传入 selectedDate，我们在这里按时间比例计算 X
		let selectedXToDraw: number | null = null;
		if (this.props.selectedX !== null && this.props.selectedX !== undefined) {
			selectedXToDraw = this.props.selectedX;
		} else if (this.props.selectedDate) {
			try {
				const times = this.props.trendPoints.map(p => p.date.getTime());
				const minTime = Math.min(...times);
				const maxTime = Math.max(...times);
				const cur = this.props.selectedDate.getTime();
				const denom = Math.max(maxTime - minTime, 1);
				const ratio = (cur - minTime) / denom;
				selectedXToDraw = pad + (width - 2 * pad) * Math.min(Math.max(ratio, 0), 1);
			} catch (_) {
				selectedXToDraw = null;
			}
		}

		if (selectedXToDraw !== null && selectedXToDraw !== undefined) {
			ctx.beginPath();
			ctx.strokeStyle = '#FFD600';
			ctx.lineWidth = 1;
			ctx.moveTo(selectedXToDraw, 0);
			ctx.lineTo(selectedXToDraw, height);
			ctx.stroke();
		}

		// 绑定点击事件：将点击位置映射为日期并更新选择
		if (!(canvas as any)._lac_click_bound) {
			(canvas as any)._lac_click_bound = true;
			canvas.addEventListener('click', (ev: MouseEvent) => {
				const x = (ev as any).offsetX ?? (ev.clientX - canvas.getBoundingClientRect().left);
				const usableWidth = Math.max(width - 2 * pad, 1);
				const ratio = Math.min(Math.max((x - pad) / usableWidth, 0), 1);
				const idx = Math.round(ratio * (this.props.trendPoints.length - 1));
				const clampedIdx = Math.min(Math.max(idx, 0), this.props.trendPoints.length - 1);
				const pickedDate = this.props.trendPoints[clampedIdx].date;

				this.updateSelection(x, pickedDate);
				// 通知外层刷新（复用现有 onDatePick 流程）
				if (this.props.onDatePick) {
					this.props.onDatePick(this.formatDateLocal(pickedDate));
				}
				// 可选：也把像素位置回传
				if (this.props.onChartSelect) {
					this.props.onChartSelect(x);
				}
			});
		}
	}

	// 更新图表数据
	updateChart(trendPoints: { date: Date, value: number }[]): void {
		this.props.trendPoints = trendPoints;
		const canvas = this.containerEl.querySelector('#trend-canvas') as HTMLCanvasElement;
		if (canvas) {
			this.renderChartCanvas(canvas);
		}
	}

	// 更新选中状态
	updateSelection(selectedX: number | null, selectedDate?: Date): void {
		this.props.selectedX = selectedX;
		if (selectedDate) {
			this.props.selectedDate = selectedDate;
			const dateLabel = this.containerEl.querySelector('.top-summary-date') as HTMLElement | null;
			if (dateLabel) {
				dateLabel.textContent = this.formatDateLocal(selectedDate);
			}
		}
		const canvas = this.containerEl.querySelector('#trend-canvas') as HTMLCanvasElement;
		if (canvas) {
			this.renderChartCanvas(canvas);
		}
	}

	// 只更新数字（不重绘图表数据）
	updateNumbers(totalDailyCost: number, totalCost: number, totalRecycle: number): void {
		this.props.totalDailyCost = totalDailyCost;
		this.props.totalCost = totalCost;
		this.props.totalRecycle = totalRecycle;

		const daily = this.containerEl.querySelector('.top-summary-dailycost') as HTMLElement | null;
		if (daily) daily.textContent = `${this.getCurrencySymbol()}${totalDailyCost.toFixed(2)}`;

		const totals = this.containerEl.querySelectorAll('.top-summary-totalcost');
		if (totals && totals.length > 0) {
			const totalEl = totals[0] as HTMLElement;
			if (totalEl) totalEl.textContent = `${this.getCurrencySymbol()}${totalCost.toLocaleString()}`;
			const recycleEl = totals[1] as HTMLElement | undefined as any;
			if (recycleEl) (recycleEl as HTMLElement).textContent = `${this.getCurrencySymbol()}${totalRecycle.toLocaleString()}`;
		}
	}

	// 显示日期选择器
	private showDatePicker(): void {
		// 创建遮罩层
		const mask = document.createElement('div');
		mask.className = 'date-picker-mask';
		
		// 创建日期选择器弹窗
		const picker = document.createElement('div');
		picker.className = 'date-picker-modal';
		
		// 创建日期选择器内容
		const content = document.createElement('div');
		content.className = 'date-picker-content';
		
		// 创建标题
		const title = document.createElement('div');
		title.className = 'date-picker-title';
		title.textContent = t('date.pick');
		
		// 创建三列滚轮选择器
		const wheelContainer = document.createElement('div');
		wheelContainer.className = 'date-wheel-container';
		
		// 获取当前日期（与顶部显示的日期保持一致）
		const currentDate = this.props.selectedDate || new Date();
		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		const currentDay = currentDate.getDate();
		
		// 创建年份列（不循环）
		const yearColumn = this.createWheelColumn(t('date.year'), this.generateYears(currentYear), currentYear, (year) => {
			this.updateDaysColumn(dayColumn, year, monthColumn.selectedValue);
		}, false);

		// 创建月份列（循环滚动）
		const monthColumn = this.createWheelColumn(t('date.month'), this.generateMonths(), currentMonth, (month) => {
			this.updateDaysColumn(dayColumn, yearColumn.selectedValue, month);
		}, true);

		// 创建日期列（循环滚动）
		const dayColumn = this.createWheelColumn(t('date.day'), this.generateDays(currentYear, currentMonth), currentDay, undefined, true);
		
		wheelContainer.appendChild(yearColumn.element);
		wheelContainer.appendChild(monthColumn.element);
		wheelContainer.appendChild(dayColumn.element);
		
		// 创建按钮区域
		const actions = document.createElement('div');
		actions.className = 'date-picker-actions';
		
		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'date-picker-btn date-picker-btn-cancel';
		cancelBtn.textContent = t('common.cancel');
		
		const confirmBtn = document.createElement('button');
		confirmBtn.className = 'date-picker-btn date-picker-btn-confirm';
		confirmBtn.textContent = t('common.confirm');
		
		// 组装结构
		actions.appendChild(cancelBtn);
		actions.appendChild(confirmBtn);
		content.appendChild(title);
		content.appendChild(wheelContainer);
		content.appendChild(actions);
		picker.appendChild(content);
		mask.appendChild(picker);
		
		// 添加到页面
		document.body.appendChild(mask);
		
		// 事件处理
		const closePicker = () => {
			document.body.removeChild(mask);
		};
		
		mask.addEventListener('click', (e) => {
			if (e.target === mask) {
				closePicker();
			}
		});
		
		cancelBtn.addEventListener('click', closePicker);
		
		confirmBtn.addEventListener('click', () => {
			const year = yearColumn.selectedValue;
			const month = monthColumn.selectedValue;
			const day = dayColumn.selectedValue;
			const selectedDateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
			
			if (this.props.onDatePick) {
				this.props.onDatePick(selectedDateStr);
			}
			closePicker();
		});
	}

	// 生成年份数组
	private generateYears(currentYear: number): number[] {
		const minYear = this.props.minYear || (currentYear - 5);
		const maxYear = this.props.maxYear || (currentYear + 5);
		
		const years = [];
		for (let i = minYear; i <= maxYear; i++) {
			years.push(i);
		}
		return years;
	}

	// 生成月份数组
	private generateMonths(): number[] {
		return Array.from({ length: 12 }, (_, i) => i + 1);
	}

	// 生成日期数组
	private generateDays(year: number, month: number): number[] {
		const daysInMonth = new Date(year, month, 0).getDate();
		return Array.from({ length: daysInMonth }, (_, i) => i + 1);
	}

	// 创建滚轮列
	private createWheelColumn(suffix: string, values: number[], selectedValue: number, onChange?: (value: number) => void, isInfinite: boolean = false): { element: HTMLElement, selectedValue: number } {
		const column = document.createElement('div');
		column.className = 'date-wheel-column';
		
		const container = document.createElement('div');
		container.className = 'date-wheel-items';
		
		let selectedIndex = values.indexOf(selectedValue);
		let currentSelectedValue = selectedValue;
		const api = { element: column, selectedValue: currentSelectedValue };
		const itemHeight = 40; // CSS中定义的item高度
		
		if (isInfinite) {
			// 循环滚动：创建多个重复的选项项
			const repeatCount = 5; // 重复5次，总共15组数据
			const totalItems = values.length * repeatCount;
			
			// 计算初始滚动位置（让选中项在中间，并确保有足够的上下滚动空间）
			// 使用中间组（第3组，索引为2）作为起始位置
			const middleGroupIndex = 2; // 第3组（0,1,2,3,4中的2）
			const initialScrollTop = middleGroupIndex * values.length * itemHeight + selectedIndex * itemHeight;
			
			// 创建重复的选项项
			for (let repeat = 0; repeat < repeatCount; repeat++) {
				values.forEach((value, index) => {
					const item = document.createElement('div');
					item.className = 'date-wheel-item';
					item.textContent = `${value.toString().padStart(2, '0')}${suffix}`;
					item.dataset.value = value.toString();
					item.dataset.index = (repeat * values.length + index).toString();
					item.dataset.realValue = value.toString();
					
					container.appendChild(item);
				});
			}
			
			// 设置容器高度和初始滚动位置
			container.style.height = `${totalItems * itemHeight}px`;
			// 先标记选中项（中间组对应索引）
			const initialItemIndex = middleGroupIndex * values.length + selectedIndex;
			const items = Array.from(container.querySelectorAll('.date-wheel-item')) as HTMLElement[];
			if (items[initialItemIndex]) {
				items.forEach((el, idx) => el.classList.toggle('selected', idx === initialItemIndex));
			}
			// 等一帧再设置scrollTop，避免首次无法向上滚的问题
			requestAnimationFrame(() => {
				container.scrollTop = initialScrollTop;
			});
			
			// 滚动事件处理（循环滚动）
			let isScrolling = false;
			container.addEventListener('scroll', () => {
				if (isScrolling) return;
				
				const scrollTop = container.scrollTop;
				const currentIndex = Math.round(scrollTop / itemHeight);
				const realIndex = ((currentIndex % values.length) + values.length) % values.length;
				const realValue = values[realIndex];
				
				// 更新选中状态
				container.querySelectorAll('.date-wheel-item').forEach((item, index) => {
					const itemRealIndex = index % values.length;
					item.classList.toggle('selected', itemRealIndex === realIndex);
				});
				
				selectedIndex = realIndex;
				currentSelectedValue = realValue;
				api.selectedValue = realValue;
				
				// 触发变化回调
				if (onChange) {
					onChange(currentSelectedValue);
				}
				
				// 循环滚动逻辑：当滚动到边界时，重置位置
				const maxScrollTop = (repeatCount - 1) * values.length * itemHeight;
				const minScrollTop = values.length * itemHeight;
				
				if (scrollTop >= maxScrollTop) {
					isScrolling = true;
					// 从第5组跳转到第2组（保持相对位置）
					const offset = scrollTop - maxScrollTop;
					container.scrollTop = values.length * itemHeight + offset;
					setTimeout(() => { isScrolling = false; }, 50);
				} else if (scrollTop <= 0) {
					isScrolling = true;
					// 从第1组跳转到第4组（保持相对位置）
					const offset = scrollTop;
					container.scrollTop = (repeatCount - 2) * values.length * itemHeight + offset;
					setTimeout(() => { isScrolling = false; }, 50);
				}
			});

			// 允许直接点击选择
			container.addEventListener('click', (ev) => {
				const target = ev.target as HTMLElement;
				const itemEl = target && target.closest ? (target.closest('.date-wheel-item') as HTMLElement | null) : null;
				if (!itemEl) return;
				const clickedIndex = Number(itemEl.dataset.index || '0');
				const realIndex = ((clickedIndex % values.length) + values.length) % values.length;
				const middleIndex = middleGroupIndex * values.length + realIndex;
				container.scrollTop = middleIndex * itemHeight;
				selectedIndex = realIndex;
				currentSelectedValue = values[realIndex];
				api.selectedValue = currentSelectedValue;
				if (onChange) onChange(currentSelectedValue);
			});
			
		} else {
			// 普通滚动：年份列不需要循环
			values.forEach((value, index) => {
				const item = document.createElement('div');
				item.className = 'date-wheel-item';
				item.textContent = `${value.toString().padStart(2, '0')}${suffix}`;
				item.dataset.value = value.toString();
				item.dataset.index = index.toString();
				
				if (value === currentSelectedValue) {
					item.classList.add('selected');
				}
				
				container.appendChild(item);
			});
			
			// 滚动事件处理（普通滚动）
			container.addEventListener('scroll', () => {
				const scrollTop = container.scrollTop;
				const newIndex = Math.round(scrollTop / itemHeight);
				
				if (newIndex !== selectedIndex && newIndex >= 0 && newIndex < values.length) {
					// 更新选中状态
					container.querySelectorAll('.date-wheel-item').forEach((item, index) => {
						item.classList.toggle('selected', index === newIndex);
					});
					
					selectedIndex = newIndex;
					currentSelectedValue = values[newIndex];
					api.selectedValue = currentSelectedValue;
					
					// 触发变化回调
					if (onChange) {
						onChange(currentSelectedValue);
					}
				}
			});

			// 允许直接点击选择
			container.addEventListener('click', (ev) => {
				const target = ev.target as HTMLElement;
				const itemEl = target && target.closest ? (target.closest('.date-wheel-item') as HTMLElement | null) : null;
				if (!itemEl) return;
				const idx = Number(itemEl.dataset.index || '0');
				// 立即更新选中样式
				container.querySelectorAll('.date-wheel-item').forEach((el, i) => {
					el.classList.toggle('selected', i === idx);
				});
				container.scrollTop = idx * itemHeight;
				selectedIndex = idx;
				currentSelectedValue = values[idx];
				api.selectedValue = currentSelectedValue;
				if (onChange) onChange(currentSelectedValue);
			});
			
			// 初始滚动到选中位置
			setTimeout(() => {
				container.scrollTop = selectedIndex * itemHeight;
			}, 0);
		}
		
		column.appendChild(container);
		
		return api;
	}

	// 更新日期列
	private updateDaysColumn(dayColumn: { element: HTMLElement, selectedValue: number }, year: number, month: number): void {
		const container = dayColumn.element.querySelector('.date-wheel-items') as HTMLElement;
		const currentDay = dayColumn.selectedValue;
		const newDays = this.generateDays(year, month);
		
		// 清空现有内容
		container.innerHTML = '';
		
		// 重新创建日期选项（循环滚动）
		const maxDay = Math.max(...newDays);
		const selectedDay = Math.min(currentDay, maxDay);
		const selectedIndex = newDays.indexOf(selectedDay);
		const itemHeight = 40;
		
		// 循环滚动：创建多个重复的选项项
		const repeatCount = 5; // 重复5次
		const totalItems = newDays.length * repeatCount;
		
		// 计算初始滚动位置（让选中项在中间，使用第3组作为起始位置）
		const middleGroupIndex = 2; // 第3组（0,1,2,3,4中的2）
		const initialScrollTop = middleGroupIndex * newDays.length * itemHeight + selectedIndex * itemHeight;
		
		// 创建重复的日期选项项
		for (let repeat = 0; repeat < repeatCount; repeat++) {
			newDays.forEach((day, index) => {
				const item = document.createElement('div');
				item.className = 'date-wheel-item';
				item.textContent = `${day.toString().padStart(2, '0')}日`;
				item.dataset.value = day.toString();
				item.dataset.index = (repeat * newDays.length + index).toString();
				item.dataset.realValue = day.toString();
				
				container.appendChild(item);
			});
		}
		
		// 设置容器高度和初始滚动位置
		container.style.height = `${totalItems * itemHeight}px`;
		// 先标记选中项（中间组对应索引）
		const initialItemIndexDay = middleGroupIndex * newDays.length + selectedIndex;
		const dayItems = Array.from(container.querySelectorAll('.date-wheel-item')) as HTMLElement[];
		if (dayItems[initialItemIndexDay]) {
			dayItems.forEach((el, idx) => el.classList.toggle('selected', idx === initialItemIndexDay));
		}
		requestAnimationFrame(() => {
			container.scrollTop = initialScrollTop;
		});
		
		// 更新选中值
		dayColumn.selectedValue = selectedDay;
		
		// 重新绑定滚动事件（循环滚动）
		let isScrolling = false;
		container.addEventListener('scroll', () => {
			if (isScrolling) return;
			
			const scrollTop = container.scrollTop;
			const currentIndex = Math.round(scrollTop / itemHeight);
			const realIndex = currentIndex % newDays.length;
			const realValue = newDays[realIndex];
			
			// 更新选中状态
			container.querySelectorAll('.date-wheel-item').forEach((item, index) => {
				const itemRealIndex = index % newDays.length;
				item.classList.toggle('selected', itemRealIndex === realIndex);
			});
			
			dayColumn.selectedValue = realValue;
			
			// 循环滚动逻辑：当滚动到边界时，重置位置
			const maxScrollTop = (repeatCount - 1) * newDays.length * itemHeight;
			const minScrollTop = newDays.length * itemHeight;
			
			if (scrollTop >= maxScrollTop) {
				isScrolling = true;
				// 从第5组跳转到第2组（保持相对位置）
				const offset = scrollTop - maxScrollTop;
				container.scrollTop = newDays.length * itemHeight + offset;
				setTimeout(() => { isScrolling = false; }, 50);
			} else if (scrollTop <= 0) {
				isScrolling = true;
				// 从第1组跳转到第4组（保持相对位置）
				const offset = scrollTop;
				container.scrollTop = (repeatCount - 2) * newDays.length * itemHeight + offset;
				setTimeout(() => { isScrolling = false; }, 50);
			}
		});
	}
}
