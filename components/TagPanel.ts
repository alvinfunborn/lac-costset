export interface TagPanelProps {
	tags: string[];
	selectedTags: string[];
	onTagClick: (tag: string | string[]) => void;
	maxHeight?: string;
}

export class TagPanel {
	private containerEl: HTMLElement;
	private props: TagPanelProps;
	private panelVisible: boolean = false;
	private panelSelected: string[] = [];
	private searchKeyword: string = '';
	private maskEl?: HTMLElement;
	private panelEl?: HTMLElement;
	private labelsEl?: HTMLElement;
	private searchEl?: HTMLInputElement;
    // i18n 延后加载，避免硬依赖：使用动态导入

	constructor(containerEl: HTMLElement, props: TagPanelProps) {
		this.containerEl = containerEl;
		this.props = props;
		this.panelSelected = [...props.selectedTags];
	}

	render(): void {
		this.containerEl.empty();
		this.containerEl.addClass('top-summary-labels');
		
		// 设置最大高度
		if (this.props.maxHeight) {
			this.containerEl.style.maxHeight = this.props.maxHeight;
			this.containerEl.style.overflowY = this.props.maxHeight !== 'auto' ? 'auto' : 'visible';
		}

		// 渲染标签列表
		this.renderTagList();
		
		// 渲染选择面板（如果可见）
		if (this.panelVisible) {
			this.renderSelectionPanel();
		}
	}

	private renderTagList(): void {
		this.props.tags.forEach(tag => {
			const labelEl = this.containerEl.createSpan('top-summary-label');
			labelEl.textContent = tag;
			
			if (this.props.selectedTags.includes(tag)) {
				labelEl.addClass('selected');
			}
			
			labelEl.addEventListener('click', (e) => {
				e.stopPropagation();
				this.props.onTagClick(tag);
			});
		});

		// 添加点击事件来显示选择面板
		this.containerEl.addEventListener('click', () => {
			this.showSelectionPanel();
		});
	}

	private showSelectionPanel(): void {
		this.panelVisible = true;
		this.panelSelected = [...this.props.selectedTags];
		this.render();
	}

	private hideSelectionPanel(): void {
		this.panelVisible = false;
		if (this.maskEl && this.maskEl.parentElement) {
			this.maskEl.parentElement.removeChild(this.maskEl);
		}
		this.maskEl = undefined;
		this.panelEl = undefined;
		this.labelsEl = undefined;
		this.searchEl = undefined;
		this.render();
	}

	private renderSelectionPanel(): void {
		// 复用遮罩层与面板，避免重建导致滚动丢失
		if (!this.maskEl) {
			this.maskEl = this.containerEl.createDiv('top-summary-panel-mask');
			this.maskEl.style.zIndex = '9999';
			this.maskEl.addEventListener('click', () => {
				this.confirmSelection();
			});
		}

		if (!this.panelEl) {
			this.panelEl = this.maskEl.createDiv('top-summary-panel');
			this.panelEl.style.zIndex = '10000';
			this.panelEl.addEventListener('click', (e) => {
				e.stopPropagation();
			});
		}

		// 搜索框：创建或复用，并绑定输入
		if (!this.searchEl) {
			this.searchEl = this.panelEl.createEl('input', {
				cls: 'top-summary-panel-search',
				placeholder: (require('../i18n') as any)?.t?.('tags.search.placeholder') || '搜索标签',
				type: 'text'
			}) as HTMLInputElement;
			this.searchEl.addEventListener('input', () => {
				this.searchKeyword = (this.searchEl?.value || '').trim();
				this.renderSelectionPanel();
			});
		}
		if (this.searchEl) {
			this.searchEl.value = this.searchKeyword;
		}

		// 标签列表（可滚动）
		const prevScrollTop = this.labelsEl ? this.labelsEl.scrollTop : 0;
		if (!this.labelsEl) {
			this.labelsEl = this.panelEl.createDiv('top-summary-panel-labels');
		} else {
			this.labelsEl.empty();
		}

		const lower = this.searchKeyword.toLowerCase();
		const visibleTags = lower ? this.props.tags.filter(t => t.toLowerCase().includes(lower)) : this.props.tags;
		visibleTags.forEach(tag => {
			const labelEl = this.labelsEl!.createSpan('top-summary-panel-label');
			labelEl.textContent = tag;
			if (this.panelSelected.includes(tag)) {
				labelEl.addClass('selected');
			}
			labelEl.addEventListener('click', () => {
				// 仅更新内容，不销毁面板，保留滚动位置
				this.toggleTagSelection(tag);
			});
		});
		// 恢复滚动位置
		if (this.labelsEl) {
			this.labelsEl.scrollTop = prevScrollTop;
		}

		// 底部操作按钮（若未创建则创建一次）
		let actionsEl = this.panelEl.querySelector('.top-summary-panel-actions') as HTMLElement | null;
		if (!actionsEl) {
			actionsEl = this.panelEl.createDiv('top-summary-panel-actions');
			actionsEl.style.padding = '8px 16px 12px 16px';
			const selectAllBtn = actionsEl.createSpan('panel-btn');
			selectAllBtn.textContent = (require('../i18n') as any)?.t?.('tags.selectAll') || '全选';
			selectAllBtn.addEventListener('click', () => {
				this.panelSelected = [...this.props.tags];
				this.renderSelectionPanel();
			});
			const deselectAllBtn = actionsEl.createSpan('panel-btn');
			deselectAllBtn.textContent = (require('../i18n') as any)?.t?.('tags.deselectAll') || '取消全选';
			deselectAllBtn.addEventListener('click', () => {
				this.panelSelected = [];
				this.renderSelectionPanel();
			});
		}
	}

	private toggleTagSelection(tag: string): void {
		if (this.panelSelected.includes(tag)) {
			this.panelSelected = this.panelSelected.filter(t => t !== tag);
		} else {
			this.panelSelected.push(tag);
		}
		this.renderSelectionPanel();
	}

	private confirmSelection(): void {
		this.props.onTagClick(this.panelSelected);
		this.hideSelectionPanel();
	}

	// 更新标签
	updateTags(tags: string[], selectedTags: string[]): void {
		this.props.tags = tags;
		this.props.selectedTags = selectedTags;
		this.render();
	}
}
