import { AssetFormModal } from './modals/AssetFormModal';
import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import { ConfirmModal } from './modals/ConfirmModal';
import { AssetRepository } from '../repositories/AssetRepository';
import { Asset } from '../models/Asset';
import { TopSummary, TopSummaryProps } from './TopSummary';
import { LineChart, LineChartProps } from './LineChart';
import { TagPanel, TagPanelProps } from './TagPanel';
import { t } from '../i18n';

// 资产管理器视图
export class AssetManagerView extends ItemView {
	private assetRepository: AssetRepository;
	private assets: Asset[] = [];
	private filePath?: string;
	private topSummaryComponent?: TopSummary;
	private tagPanelComponent?: TagPanel;
	private selectedDate?: Date; // 当前选择的日期
	private selectedTags: string[] = []; // 当前选择的标签
	private actionBarEl?: HTMLElement; // 顶部统计下方的按钮卡片
	private searchQuery: string = '';
    private sortMode: 'none' | 'dailyDesc' | 'priceDesc' | 'dateDesc' = 'none';

	constructor(leaf: WorkspaceLeaf, assetRepository: AssetRepository, filePath?: string) {
		super(leaf);
		this.assetRepository = assetRepository;
		this.filePath = filePath;
		this.selectedDate = new Date(); // 初始化为当前日期
	}

	getViewType(): string {
		return 'lac-costset-view';
	}

	getDisplayText(): string {
		return 'LaC.CostSet';
	}

	getIcon(): string {
		return 'package';
	}

	async onOpen() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('page-root');

		// 确保窄宽度下标题栏的菜单/返回按钮不被主题隐藏
		this.injectHeaderFixStyles();

		// 初始化默认排序自设置
		try {
			const plugin = (this.app as any).plugins?.plugins?.['lac-costset'];
			if (plugin && plugin.settings && plugin.settings.defaultSort) {
				this.sortMode = plugin.settings.defaultSort;
			}
		} catch (_) {}

		// 如果传入了文件路径，直接使用该文件
        if (this.filePath) {
			this.useFile(this.filePath);
			return;
		}

		// 若未传入文件路径：不要弹出文件列表，显示轻量提示
		const hint = containerEl.createDiv();
		hint.style.padding = '16px';
		hint.style.opacity = '0.8';
		hint.textContent = t('view.hint.openFromMenu');
		return;

		this.loadAssets();
	}

	async onClose() {
		const { containerEl } = this;
		containerEl.empty();
	}

	private async useFile(filePath: string) {
		// 重新初始化AssetRepository
		const plugin = (this.app as any).plugins.plugins['lac-costset'];
		if (plugin) {
			plugin.assetRepository = new AssetRepository(this.app, filePath);
			this.assetRepository = plugin.assetRepository;
			
			this.loadAssets();
		}
	}

	private async loadAssets() {
		this.assets = await this.assetRepository.loadAll();
		this.renderAssets();
	}

	private showFileSelector() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: t('view.selectRoot.title') });
		containerEl.createEl('p', { text: t('view.selectRoot.desc') });

		const files = this.app.vault.getMarkdownFiles();
		const fileList = containerEl.createDiv('file-list');
		
		files.forEach(file => {
			const fileItem = fileList.createDiv('file-item');
			fileItem.createEl('div', { text: file.path });
			fileItem.addEventListener('click', async () => {
				// 重新初始化AssetRepository
				const plugin = (this.app as any).plugins.plugins['lac-costset'];
				if (plugin) {
					plugin.assetRepository = new AssetRepository(this.app, file.path);
					this.assetRepository = plugin.assetRepository;
					
					this.loadAssets();
				}
			});
		});
	}

	private renderAssets() {
		const { containerEl } = this;
		
		// 清空容器，避免重复追加 TopSummary 与列表
		containerEl.empty();
		containerEl.addClass('page-root');
		
		// 创建顶部统计区域
		this.renderTopSummary(containerEl);
		// 顶部统计下方的操作条
		this.renderActionBar(containerEl);
		
		const assetsContainer = containerEl.createDiv('assets-container');
		this.renderAssetCards(assetsContainer);
	}

	private renderAssetCards(assetsContainer: HTMLElement) {
		assetsContainer.empty();
		if (this.assets.length === 0) {
			assetsContainer.createEl('p', { text: t('view.empty') });
			return;
		}
		const calcDate = this.selectedDate || new Date();
		let visibleAssets = this.assets.filter(a => a.activeFrom <= calcDate);
		if (this.selectedTags.length > 0) {
			visibleAssets = visibleAssets.filter(a => a.tags?.some(t => this.selectedTags.includes(t)));
		}
		// 搜索过滤：名称或标签包含
		if (this.searchQuery && this.searchQuery.trim()) {
			const q = this.searchQuery.trim().toLowerCase();
			visibleAssets = visibleAssets.filter(a => {
				const nameHit = (a.name || '').toLowerCase().includes(q);
				const tagHit = (a.tags || []).some(t => (t || '').toLowerCase().includes(q));
				return nameHit || tagHit;
			});
		}
        // 排序
        if (this.sortMode !== 'none') {
            visibleAssets = [...visibleAssets].sort((a, b) => {
                if (this.sortMode === 'dailyDesc') {
                    const aCost = a.getDailyCost(calcDate);
                    const bCost = b.getDailyCost(calcDate);
                    return bCost - aCost; // 日均成本降序
                }
                if (this.sortMode === 'priceDesc') {
                    return Number(b.price || 0) - Number(a.price || 0); // 价格降序
                }
                if (this.sortMode === 'dateDesc') {
                    const at = a.activeFrom?.getTime?.() || 0;
                    const bt = b.activeFrom?.getTime?.() || 0;
                    return bt - at; // 购入日期（activeFrom）降序
                }
                return 0;
            });
        }
		visibleAssets.forEach(asset => {
			const isExpired = !!(asset.activeTo && asset.activeTo <= calcDate);
			const endText = isExpired ? asset.activeTo!.toISOString().split('T')[0] : t('view.toNow');
			const assetEl = assetsContainer.createDiv('asset-card');
			if (isExpired) assetEl.addClass('asset-card--expired');
			if (asset.hidden) assetEl.addClass('hidden');
			assetEl.innerHTML = `
				<div class="asset-info">
					<div class="asset-title">${asset.icon} ${asset.name}</div>
					<div class="asset-date">${t('view.usedDays', { days: asset.getUsageDays(calcDate) })} (${asset.activeFrom.toISOString().split('T')[0]} ~ ${asset.activeTo ? endText : t('view.toNow')})</div>
					<div class="asset-labels-scroll">
						${asset.tags.map(tag => `<span class=\"tag\">${tag}</span>`).join('')}
					</div>
				</div>
				<div class="asset-costs">
					<div class="asset-costs-line">
						<div class="asset-price">${t('view.daily')}&nbsp;</div>
						<div class="asset-dailycost">¥${asset.getDailyCost(calcDate).toFixed(2)}</div>
					</div>
					<div class="asset-price">${t('view.price')} ${this.getCurrencySymbol()}${asset.price}</div>
					<div class="asset-price">${t('view.recyclePrice')} ${this.getCurrencySymbol()}${asset.recyclePrice}</div>
				</div>
			`;
			let didLongPress = false;
			assetEl.addEventListener('click', (e) => {
				if (didLongPress) {
					didLongPress = false;
					e.preventDefault();
					e.stopPropagation();
					return;
				}
				new AssetFormModal(this.app, this.assetRepository, asset, () => this.loadAssets()).open();
			});

			// 长按隐藏/恢复显示，仅内存切换；仅刷新顶部数字，不刷新图表
			let pressTimer: number | null = null;
			const startPress = (ev?: MouseEvent | TouchEvent) => {
				// 仅响应鼠标左键
				if (ev && 'button' in ev && typeof ev.button === 'number' && ev.button !== 0) return;
				if (pressTimer) window.clearTimeout(pressTimer);
				pressTimer = window.setTimeout(() => {
					didLongPress = true;
					asset.hidden = !asset.hidden;
					assetEl.classList.toggle('hidden', asset.hidden);
					this.refreshTopNumbersOnly();
				}, 500);
			};
			const cancelPress = () => { if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = null; } };
			assetEl.addEventListener('mousedown', startPress);
			assetEl.addEventListener('touchstart', startPress, { passive: true } as any);
			assetEl.addEventListener('mouseup', cancelPress);
			assetEl.addEventListener('mouseleave', cancelPress);
			assetEl.addEventListener('touchend', cancelPress);
			assetEl.addEventListener('contextmenu', async (e) => {
				e.preventDefault();
				const ok = await new ConfirmModal(t('view.confirmDeleteAsset', { name: asset.name }), t('common.delete'), t('common.cancel'), true).open();
				if (!ok) return;
				await this.assetRepository.deleteAsset(asset.id);
				this.loadAssets();
			});
		});
	}

	// 仅刷新顶部数字 (排除 hidden 资产)，不刷新图表、不重建列表
	private refreshTopNumbersOnly() {
		if (!this.topSummaryComponent) return;
		const calcDate = this.selectedDate || new Date();
		const activeAssets = this.assets.filter(a => a.isActive(calcDate) && !a.hidden);
		const filteredActiveAssets = this.applyTagFilter(activeAssets);
		const totalCost = filteredActiveAssets.reduce((sum, a) => sum + a.price, 0);
		const totalRecycle = filteredActiveAssets.reduce((sum, a) => sum + a.recyclePrice, 0);
		const totalDailyCost = filteredActiveAssets.reduce((sum, a) => sum + a.getDailyCost(calcDate), 0);
		this.topSummaryComponent.updateNumbers(totalDailyCost, totalCost, totalRecycle);
	}

	// 顶部统计下方的操作条（搜索 / 排序 / 添加）
	private renderActionBar(containerEl: HTMLElement) {
		this.injectActionBarStyles();
		const bar = containerEl.createDiv('lac-actionbar-card');
		this.actionBarEl = bar;

		// 窄屏返回按钮（避免系统标题栏隐藏时无处返回）
		const backBtn = bar.createDiv({ cls: 'lac-icon-btn back', attr: { title: t('view.back') } });
		backBtn.innerHTML = this.svgBack();
		backBtn.addEventListener('click', (e) => {
			e.preventDefault();
			// 直接关闭当前叶子（标签），等效“返回/关闭”
			try { this.leaf.detach(); } catch (_) {}
		});

		// 左侧：搜索输入（内嵌图标按钮）
		const searchWrap = bar.createDiv('lac-actionbar-search');
		const searchIconBtn = searchWrap.createEl('button', { cls: 'lac-icon-btn search-icon', attr: { type: 'button', 'aria-label': t('view.search.aria') } });
		searchIconBtn.innerHTML = this.svgSearch();
		const searchInput = searchWrap.createEl('input', { attr: { type: 'text', placeholder: t('view.search.placeholder') } }) as HTMLInputElement;
		if (this.searchQuery) searchInput.value = this.searchQuery;
		searchIconBtn.addEventListener('click', () => searchInput.focus());
		searchInput.addEventListener('input', () => {
			this.searchQuery = searchInput.value || '';
			this.refreshAssetListOnly();
		});

		// 右侧：操作按钮区（排序、添加）
		const actions = bar.createDiv('lac-actionbar-actions');
		const sortBtn = actions.createDiv({ cls: 'lac-icon-btn sort', attr: { title: t('view.sort.title') } });
		sortBtn.innerHTML = this.svgSort();
		const applySortBtnState = () => {
			sortBtn.classList.toggle('active', this.sortMode !== 'none');
			sortBtn.setAttr('data-mode', this.sortMode);
			sortBtn.setAttr('aria-pressed', String(this.sortMode !== 'none'));
			const title = this.sortMode === 'dailyDesc' ? t('view.sort.title.dailyDesc')
				: this.sortMode === 'priceDesc' ? t('view.sort.title.priceDesc')
				: this.sortMode === 'dateDesc' ? t('view.sort.title.dateDesc')
				: t('view.sort.title');
            sortBtn.setAttr('title', title);
		};
		applySortBtnState();
        sortBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.openSortMenu(sortBtn, (mode) => {
                this.sortMode = mode;
                applySortBtnState();
                this.refreshAssetListOnly();
            });
        });

		const addBtn = actions.createDiv({ cls: 'lac-icon-btn add', attr: { title: t('view.add') } });
		addBtn.innerHTML = this.svgPlus();
		addBtn.addEventListener('click', () => {
			new AssetFormModal(this.app, this.assetRepository, undefined, () => this.loadAssets()).open();
		});
	}

	private refreshAssetListOnly() {
		const { containerEl } = this;
		const listEl = containerEl.querySelector('.assets-container');
		if (listEl) {
			(listEl as HTMLElement).remove();
			const newList = containerEl.createDiv('assets-container');
			this.renderAssetCards(newList);
		}
	}

	private injectActionBarStyles() {
		const STYLE_ID = 'lac-costset-actionbar-styles';
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			/* 按钮卡片：与 top-summary / asset-card 同风格，仅高度更小 */
			.lac-actionbar-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 10px; margin: 0px 14px 8px; border-radius: 8px; background: #23262F; box-shadow: 0 2px 8px rgba(0,0,0,0.18); }
			.lac-actionbar-search { position: relative; flex: 1; min-width: 0; }
			.lac-actionbar-search input { width: 100%; height: 30px; padding: 4px 8px 4px 30px; border-radius: 8px; border: 1px solid #3A3D46; background: #2A2D36; color: #F5F6FA; font-size: 13px; line-height: 20px; }
			.lac-actionbar-search input::placeholder { color: #A0A3B1; }
			.lac-actionbar-search .search-icon { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; padding: 0; border: none; background: transparent; color: #C9CBD3; }
			.lac-actionbar-actions { display: flex; align-items: center; gap: 8px; }
			.lac-icon-btn { width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: none !important; outline: none !important; background: transparent !important; box-shadow: none !important; color: #C9CBD3; cursor: pointer; }
			.lac-icon-btn.add { color: #f3e700; }
			.lac-icon-btn.back { display: inline-flex; color: #C9CBD3; }
			.lac-icon-btn:hover { filter: brightness(1.05); }
			.lac-icon-btn svg { width: 20px; height: 20px; display:block; }
			.lac-icon-btn svg * { stroke: currentColor !important; fill: none !important; stroke-width: 2 !important; }
			.lac-icon-btn.active { background: #2F3139; }
			/* 隐藏态样式（对齐 costsetapp） */
			.asset-card.hidden { opacity: 0.3; filter: grayscale(0.5); }
            /* 排序菜单 */
            .lac-sort-menu { position: fixed; min-width: 160px; background: #23262F; color: #F5F6FA; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 18px rgba(0,0,0,0.35); border: 1px solid #3A3D46; z-index: 9999; }
            .lac-sort-menu .menu-item { padding: 10px 14px; cursor: pointer; border-top: 1px solid #2E313A; transition: background 120ms ease, color 120ms ease; }
            .lac-sort-menu .menu-item:first-child { border-top: none; }
            .lac-sort-menu .menu-item:hover { background: rgba(255, 214, 0, 0.12); color: inherit; }
            .lac-sort-menu .menu-item.active { color: #FFD700; }

			/* 小于 720px 时紧凑布局 */
			@media (max-width: 720px) {
				.lac-actionbar-card { gap: 8px; }
				.lac-actionbar-search input { padding-left: 30px; }
			}
		`;
		document.head.appendChild(style);
	}

	private injectHeaderFixStyles() {
		const STYLE_ID = 'lac-costset-header-styles';
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			/* 仅作用于本视图：保证窄宽时也显示标题栏菜单/返回区域 */
			.workspace-leaf[data-type="lac-costset-view"] .view-header { display: flex !important; }
			.workspace-leaf[data-type="lac-costset-view"] .view-header .view-actions { display: inline-flex !important; gap: 6px; }
			.workspace-leaf[data-type="lac-costset-view"] .view-header-title-container { min-width: 0; }
			.workspace-leaf[data-type="lac-costset-view"] .view-header-title { max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			@media (max-width: 720px) {
				.workspace-leaf[data-type="lac-costset-view"] .view-header-title { max-width: 45%; }
			}
			@media (max-width: 560px) {
				.workspace-leaf[data-type="lac-costset-view"] .view-header-title { max-width: 35%; }
			}
		`;
		document.head.appendChild(style);
	}

    private openSortMenu(anchorEl: HTMLElement, onSelect: (mode: 'none' | 'dailyDesc' | 'priceDesc' | 'dateDesc') => void) {
        // 若已存在先清理
        this.closeExistingSortMenu();

        const rect = anchorEl.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.className = 'lac-sort-menu';

        const buildItem = (label: string, value: 'none' | 'dailyDesc' | 'priceDesc' | 'dateDesc') => {
            const item = document.createElement('div');
            item.className = 'menu-item' + (this.sortMode === value ? ' active' : '');
            item.textContent = label;
            item.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const next = this.sortMode === value ? 'none' : value;
                onSelect(next as any);
                this.closeExistingSortMenu();
            });
            return item;
        };

		menu.appendChild(buildItem(t('view.sort.menu.dailyDesc'), 'dailyDesc'));
		menu.appendChild(buildItem(t('view.sort.menu.priceDesc'), 'priceDesc'));
		menu.appendChild(buildItem(t('view.sort.menu.dateDesc'), 'dateDesc'));

        document.body.appendChild(menu);
        // 定位到按钮下方
        const top = rect.bottom + 6;
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - 180);
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;

        const onDocClick = (ev: MouseEvent) => {
            if (!menu.contains(ev.target as Node)) this.closeExistingSortMenu();
        };
        const onEsc = (ev: KeyboardEvent) => {
            if (ev.key === 'Escape') this.closeExistingSortMenu();
        };
        document.addEventListener('mousedown', onDocClick, { once: true });
        document.addEventListener('keydown', onEsc, { once: true });
        (menu as any)._cleanup = () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onEsc);
        };
    }

    // 让视图可被 setViewState 恢复与导航：保存/应用状态
    getState(): any {
        return { filePath: this.filePath };
    }

    async setState(state: any, result: any): Promise<void> {
        const nextPath = state?.filePath as string | undefined;
        if (nextPath && nextPath !== this.filePath) {
            this.filePath = nextPath;
            await this.useFile(nextPath);
            return;
        }
        // 若无路径，清空并提示
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('page-root');
        const hint = containerEl.createDiv();
        hint.style.padding = '16px';
        hint.style.opacity = '0.8';
        hint.textContent = '从文件的右键菜单中选择 “用 LaC.CostSet 打开”。';
    }

    private closeExistingSortMenu() {
        const existing = document.querySelector('.lac-sort-menu') as HTMLElement | null;
        if (existing) {
            const cleanup = (existing as any)._cleanup as (() => void) | undefined;
            if (cleanup) cleanup();
            existing.remove();
        }
    }

	private svgSearch(): string {
		return `
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
				<line x1="20" y1="20" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		`;
	}

	private svgPlus(): string {
		return `
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		`;
	}

	private svgSort(): string {
		return `
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M8 9l4-4 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M16 15l-4 4-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		`;
	}

	private svgBack(): string {
		return `
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
		`;
	}

	private renderTopSummary(containerEl: HTMLElement) {
		// 计算统计数据
		const calcDate = this.selectedDate || new Date();
		const activeAssets = this.assets.filter(asset => asset.isActive(calcDate) && !asset.hidden);
		const filteredActiveAssets = this.applyTagFilter(activeAssets);
		const totalCost = filteredActiveAssets.reduce((sum, asset) => sum + asset.price, 0);
		const totalRecycle = filteredActiveAssets.reduce((sum, asset) => sum + asset.recyclePrice, 0);
		const totalDailyCost = filteredActiveAssets.reduce((sum, asset) => sum + asset.getDailyCost(calcDate), 0);
		
		// 获取所有标签（从全部资产收集），并进行固定顺序排序（中文、忽略大小写、数值顺序）
		const allTags = new Set<string>();
		this.assets.forEach(asset => {
			(asset.tags || []).forEach(tag => allTags.add(tag));
		});
		const collator = new Intl.Collator('zh', { sensitivity: 'base', numeric: true });
		const tagsArray = Array.from(allTags).sort((a, b) => collator.compare(a, b));

		// 计算年份范围：从最早资产年份到未来7年
		const currentYear = new Date().getFullYear();
		const maxYear = currentYear + 7; // 未来7年
		
		let minYear = currentYear; // 默认最小年份为当前年份
		if (this.assets.length > 0) {
			// 找到所有资产中的最早年份
			const earliestYear = Math.min(...this.assets.map(asset => asset.activeFrom.getFullYear()));
			minYear = earliestYear;
		}

		// 计算图表数据 - 使用两步渲染策略（基于筛选后的资产）
		const trendPoints = this.calcTrendPoints(filteredActiveAssets, 30);

		console.log('渲染顶部统计区域:', { 
			activeAssets: activeAssets.length, 
			totalCost, 
			totalRecycle, 
			totalDailyCost, 
			tagsArray,
			yearRange: { minYear, maxYear }
		});

		// 创建TopSummary组件
		const topSummaryEl = containerEl.createDiv();
		const topSummaryProps: TopSummaryProps = {
			totalDailyCost,
			totalCost,
			totalRecycle,
			tags: tagsArray,
			selectedTags: this.selectedTags,
			onTagClick: (tag: string | string[]) => {
				// 支持单个标签切换或批量设置
				if (Array.isArray(tag)) {
					this.selectedTags = [...new Set(tag)];
				} else {
					if (this.selectedTags.includes(tag)) {
						this.selectedTags = this.selectedTags.filter(t => t !== tag);
					} else {
						this.selectedTags = [...this.selectedTags, tag];
					}
				}
				// 重新渲染页面以反映筛选
				this.renderAssets();
			},
			trendPoints,
			selectedDate: this.selectedDate,
			onChartSelect: (x: number) => {
				console.log('图表选择:', x);
				// 后续可以添加图表交互功能
			},
			onChartWidth: (w: number) => {
				console.log('图表宽度:', w);
			},
			onDatePick: (dateStr: string) => {
				console.log('日期选择:', dateStr);
				// 处理日期选择逻辑：仅更新竖线与数字，不重算折线
				const selectedDate = new Date(dateStr);
				this.selectedDate = selectedDate; // 更新状态
				if (this.topSummaryComponent) {
					this.topSummaryComponent.updateSelection(null, selectedDate);
					// 同步更新顶部数字
					const calcDate = selectedDate;
					const activeAssets = this.assets.filter(asset => asset.isActive(calcDate) && !asset.hidden);
					const filteredActiveAssets = this.applyTagFilter(activeAssets);
					const totalCost = filteredActiveAssets.reduce((sum, asset) => sum + asset.price, 0);
					const totalRecycle = filteredActiveAssets.reduce((sum, asset) => sum + asset.recyclePrice, 0);
					const totalDailyCost = filteredActiveAssets.reduce((sum, asset) => sum + asset.getDailyCost(calcDate), 0);
					this.topSummaryComponent.updateNumbers(totalDailyCost, totalCost, totalRecycle);
				}
				// 仅刷新列表
				const { containerEl } = this;
				const listEl = containerEl.querySelector('.assets-container');
				if (listEl) {
					// 重新渲染整个视图会重建图表，这里只重建列表区域
					(listEl as HTMLElement).remove();
					const newList = containerEl.createDiv('assets-container');
					this.renderAssetCards(newList);
				} else {
					// 若首次进入，正常整体渲染
					this.renderAssets();
				}
			},
			minYear,
			maxYear
		};

		this.topSummaryComponent = new TopSummary(topSummaryEl, topSummaryProps);
		this.topSummaryComponent.render();

		// 异步细化图表（基于当前筛选后的资产）
		this.renderChartWithProgressiveRefinement(filteredActiveAssets);
		
		console.log('顶部统计区域已创建:', topSummaryEl);
	}

	private getCurrencySymbol(): string {
		const { t } = require('../i18n');
		return t('currency.symbol');
	}

	// 渐进式细化渲染（参考costsetapp实现）
	private renderChartWithProgressiveRefinement(assets: Asset[]) {
		if (assets.length === 0) return;
		
		// 计算所有资产的 active_to 最大值
		let maxActiveTo = 0;
		assets.forEach(a => {
			const to = a.activeTo;
			if (to) {
				const t = to.getTime();
				if (t && t > maxActiveTo) maxActiveTo = t;
			}
		});
		const now = new Date();
		const maxDate = maxActiveTo && maxActiveTo > now.getTime() ? new Date(maxActiveTo) : now;
		
		// 第一步：初始点并行
		const initialPoints = this.calcTrendPoints(assets, 30, undefined, maxDate);
		if (this.topSummaryComponent) {
			this.topSummaryComponent.updateChart(initialPoints);
		}
		
		// 第二步：异步细化并行 - 30*30个点
		setTimeout(async () => {
			const segPromises: Promise<{ date: Date; value: number; }[]>[] = [];
			for (let i = 0; i < initialPoints.length - 1; i++) {
				segPromises.push(
					Promise.resolve(this.calcTrendPoints(assets, 30, initialPoints[i].date, initialPoints[i + 1].date)).then(segPoints => {
						if (i > 0) return segPoints.slice(1); // 避免重复点
						return segPoints;
					})
				);
			}
			const segResults = await Promise.all(segPromises);
			const finePoints = segResults.flat();
			if (this.topSummaryComponent) {
				this.topSummaryComponent.updateChart(finePoints);
			}
		}, 500);
	}

	// 将标签筛选应用到给定资产集
	private applyTagFilter(input: Asset[]): Asset[] {
		if (!this.selectedTags || this.selectedTags.length === 0) return input;
		return input.filter(a => a.tags?.some(t => this.selectedTags.includes(t)));
	}

	private calcTrendPoints(assets: Asset[], count: number, fromDate?: Date, toDate?: Date): { date: Date, value: number }[] {
		if (assets.length === 0) return [];
		
		const now = new Date();
		const minDate = fromDate || new Date(Math.min(...assets.map(a => a.activeFrom.getTime())));
		const maxActiveTo = Math.max(...assets.map(a => {
			const to = a.activeTo;
			if (to) {
				const t = to.getTime();
				if (!isNaN(t)) return t;
			}
			return now.getTime();
		}));
		const maxDate = toDate || new Date(maxActiveTo);
		
		const points: { date: Date, value: number }[] = [];
		for (let i = 0; i < count; i++) {
			const t = minDate.getTime() + (maxDate.getTime() - minDate.getTime()) * i / (count - 1);
			const date = new Date(t);
			let totalCost = 0;
			
			// 计算在该时间点活跃的资产的日均成本总和
			assets.forEach(a => {
				const cost = this.calcDailyCost(a.price, a.recyclePrice, a.activeFrom, a.activeTo, date);
				if (isFinite(cost)) totalCost += cost;
			});
			
			points.push({ date, value: totalCost });
		}
		return points;
	}

	// 计算日均成本（参考costsetapp算法）
	private calcDailyCost(price: number, recycle: number, from: Date, to: Date | null | undefined, now: Date): number {
		if (!from) return 0;
		const days = Math.floor((now.getTime() - from.getTime()) / 86400000) + 1;
		if (!to || to > now) {
			recycle = 0;
		}
		if (!isFinite(days) || days <= 0) return 0;
		const result = (Number(price) - Number(recycle || 0)) / days;
		return isFinite(result) ? result : 0;
	}

}
