export type LocaleSetting = 'auto' | 'zh' | 'en';

let currentLocale: 'zh' | 'en' = 'zh';

export function resolveLocale(locale: LocaleSetting | undefined): 'zh' | 'en' {
	if (!locale || locale === 'auto') {
		try {
			const lang = (navigator.language || '').toLowerCase();
			return lang.startsWith('zh') ? 'zh' : 'en';
		} catch (_) {
			return 'en';
		}
	}
	return locale;
}

export function setLocale(locale: LocaleSetting | 'zh' | 'en'): void {
	currentLocale = resolveLocale(locale as any);
}

export function getCurrentLocale(): 'zh' | 'en' {
	return currentLocale;
}

type Dict = Record<string, { zh: string; en: string }>

const dict: Dict = {
    // Currency
    'currency.symbol': { zh: '¥', en: '$' },
	// Common
	'common.confirm': { zh: '确定', en: 'Confirm' },
	'common.cancel': { zh: '取消', en: 'Cancel' },
	'common.delete': { zh: '删除', en: 'Delete' },
	'common.save': { zh: '保存', en: 'Save' },
	'common.back': { zh: '返回', en: 'Back' },
	'common.add': { zh: '添加', en: 'Add' },
	'common.search': { zh: '搜索', en: 'Search' },

	// Menu / Command
	'menu.openWith': { zh: '用 LaC.CostSet 打开', en: 'Open with LaC.CostSet' },
	'command.open': { zh: '打开', en: 'Open' },
	'notice.invalidEntry': {
		zh: '入口文件内容格式不正确：需为 TOML，且 type = "root"，renders 必须包含 "costset"',
		en: 'Entry file invalid: must be TOML with type = "root" and renders must include "costset"'
	},
	'notice.saveFailed': { zh: '保存失败: {msg}', en: 'Save failed: {msg}' },

	// Settings
	'settings.title': { zh: 'Lac.CostSet 设置', en: 'Lac.CostSet Settings' },
	'settings.guide.1': {
		zh: '重要：入口文件与资产文件的“内容格式为 TOML”，文件扩展名可为 .md。允许 # 开头的注释。唯一的非 TOML 例外是：文件正文中的 [[资产文件名]] 双链可省略引号，插件在解析时会临时为其加上引号后按 TOML 处理。除这点外，不应混入普通 Markdown 文本。',
		en: 'Important: Entry and asset files must be TOML content (extension can be .md). Comments starting with # are allowed. The only non-TOML exception: [[asset filename]] wikilinks in the body can omit quotes; the plugin will temporarily quote them for TOML parsing. No other regular Markdown should be mixed.'
	},
	'settings.entry.example': {
		zh: '# 入口文件最小示例\n\n# 顶部 TOML：必须满足\n# type = "root"\n# renders = ["costset"]\n\ntype = "root"\nrenders = ["costset"]\n\n# 正文：用双链列出资产文件名（不需要扩展名）\n\n[[键盘]]\n[[耳机]]\n',
		en: '# Minimal entry file example\n\n# Top TOML must include\n# type = "root"\n# renders = ["costset"]\n\ntype = "root"\nrenders = ["costset"]\n\n# Body: list asset filenames using wikilinks (no extension)\n\n[[keyboard]]\n[[headphones]]\n'
	},
	'settings.asset.desc': {
		zh: '资产文件同样是 Markdown，但内容以 TOML 字段为主（插件会保留你写的注释）。以下为最小示例：',
		en: 'Asset files are also Markdown, but mainly TOML fields (comments are preserved). Minimal example:'
	},
	'settings.asset.example': {
		zh: 'name = "键盘"\n\n[style]\nicon = "⌨️"\n\n[detail]\nprice = 399\nactive_from = "2024-01-01"\nactive_to = ""\nrecycle_price = 0\ntags = ["数码", "键盘"]\n',
		en: 'name = "Keyboard"\n\n[style]\nicon = "⌨️"\n\n[detail]\nprice = 399\nactive_from = "2024-01-01"\nactive_to = ""\nrecycle_price = 0\ntags = ["Digital", "Keyboard"]\n'
	},
	'settings.usage': {
		zh: '用法：在“入口文件”上右键 → 选择“用 LaC.CostSet 打开”。也可在命令面板执行“打开LaC.CostSet”（将使用下方配置的入口文件）。',
		en: 'Usage: Right-click on the entry file → choose "Open with LaC.CostSet". Or run the command "Open LaC.CostSet" (uses the configured entry file below).'
	},
	'settings.entryFile.name': { zh: '入口文件', en: 'Entry file' },
	'settings.entryFile.desc': { zh: '作为资产入口的 Markdown 文件路径，例如 costset/costset.md', en: 'Path to the Markdown entry file, e.g., costset/costset.md' },
	'settings.contextMenu.name': { zh: '启用右键菜单 “用 LaC.CostSet 打开”', en: 'Enable context menu "Open with LaC.CostSet"' },
	'settings.contextMenu.desc': { zh: '在 Markdown 文件的右键菜单中显示入口', en: 'Show entry in Markdown file context menu' },
	'settings.defaultSort.name': { zh: '默认排序', en: 'Default sort' },
	'settings.defaultSort.desc': { zh: '打开视图时的初始排序方式', en: 'Initial sort when opening the view' },
	'settings.defaultSort.option.none': { zh: '文本顺序', en: 'Text order' },
	'settings.defaultSort.option.dailyDesc': { zh: '日均价格', en: 'Daily cost' },
	'settings.defaultSort.option.priceDesc': { zh: '价格', en: 'Price' },
	'settings.defaultSort.option.dateDesc': { zh: '购入日期', en: 'Purchase date' },
	'settings.defaultIcon.name': { zh: '默认图标', en: 'Default icon' },
	'settings.defaultIcon.desc': { zh: '新资产的默认图标，仅支持 1 个 Emoji', en: 'Default icon for new assets (single Emoji only)' },
	'settings.defaultIcon.placeholder': { zh: '📦', en: '📦' },
	'settings.locale.name': { zh: '语言', en: 'Language' },
	'settings.locale.desc': { zh: '界面语言', en: 'Interface language' },
	'settings.locale.option.auto': { zh: '跟随系统', en: 'Auto' },
	'settings.locale.option.zh': { zh: '中文', en: 'Chinese' },
	'settings.locale.option.en': { zh: '英文', en: 'English' },

	// AssetManagerView
	'view.hint.openFromMenu': { zh: '从文件的右键菜单中选择 “用 LaC.CostSet 打开”。', en: 'Use file context menu: "Open with LaC.CostSet".' },
	'view.selectRoot.title': { zh: '选择资产根文件', en: 'Select root asset file' },
	'view.selectRoot.desc': { zh: '请选择一个包含资产引用的文件作为入口', en: 'Please choose a file containing asset references as entry' },
	'view.empty': { zh: '暂无资产', en: 'No assets' },
	'view.toNow': { zh: '至今', en: 'Present' },
	'view.usedDays': { zh: '已用{days}天', en: '{days} days used' },
	'view.daily': { zh: '日均', en: 'Daily' },
	'view.price': { zh: '价格', en: 'Price' },
	'view.recyclePrice': { zh: '回收价', en: 'Recycle' },
	'view.back': { zh: '返回', en: 'Back' },
	'view.search.aria': { zh: '搜索', en: 'Search' },
	'view.search.placeholder': { zh: '搜索名称或标签', en: 'Search name or tags' },
	'view.sort.title': { zh: '排序', en: 'Sort' },
	'view.sort.title.dailyDesc': { zh: '按日均成本 (降序)', en: 'By daily cost (desc)' },
	'view.sort.title.priceDesc': { zh: '按价格 (降序)', en: 'By price (desc)' },
	'view.sort.title.dateDesc': { zh: '按购入日期 (降序)', en: 'By purchase date (desc)' },
	'view.sort.menu.dailyDesc': { zh: '按日均成本', en: 'By daily cost' },
	'view.sort.menu.priceDesc': { zh: '按价格', en: 'By price' },
	'view.sort.menu.dateDesc': { zh: '按购入日期', en: 'By purchase date' },
	'view.add': { zh: '添加', en: 'Add' },
	'view.confirmDeleteAsset': { zh: '确定要删除资产 "{name}" 吗？', en: 'Delete asset "{name}"?' },

	// Top summary
	'top.total': { zh: '总成本 ', en: 'Total ' },
	'top.recycle': { zh: '可回收 ', en: 'Recyclable ' },
	'date.pick': { zh: '选择日期', en: 'Pick date' },
	'date.year': { zh: '年', en: '' },
	'date.month': { zh: '月', en: '' },
	'date.day': { zh: '日', en: '' },

	// Confirm modal
	'confirm.title': { zh: '确认操作', en: 'Confirm' },

	// Form modal
	'form.name': { zh: '名称', en: 'Name' },
	'form.icon': { zh: '图标', en: 'Icon' },
	'form.price': { zh: '价格', en: 'Price' },
	'form.purchaseOn': { zh: '购入于', en: 'Purchased on' },
	'form.purchaseDate': { zh: '购入日期', en: 'Purchase date' },
	'form.endDate': { zh: '到期', en: 'End date' },
	'form.endDatePlaceholder': { zh: '(计划)报废/回收/到期时间', en: 'Planned scrap/recycle/end date' },
	'form.recyclePrice': { zh: '回收价', en: 'Recycle price' },
	'form.tags': { zh: '标签', en: 'Tags' },
	'form.assetName.placeholder': { zh: '资产名称', en: 'Asset name' },
	'form.icon.placeholder': { zh: '请输入一个 Emoji 作为图标', en: 'Please enter one Emoji as icon' },
	'form.price.placeholder': { zh: '购入价格（元）', en: 'Purchase price' },
	'form.recycle.placeholder': { zh: '回收价格（元）', en: 'Recycle price' },
	'form.tags.placeholder': { zh: '输入标签，回车确认', en: 'Type tags and press Enter' },
	'form.action.cancel': { zh: '取消', en: 'Cancel' },
	'form.action.delete': { zh: '删除', en: 'Delete' },
	'form.action.save': { zh: '保存', en: 'Save' },
	'form.error.nameRequired': { zh: '请填写名称', en: 'Please enter a name' },
	'form.error.priceInvalid': { zh: '请填写有效的价格', en: 'Please enter a valid price' },
	'form.error.fromRequired': { zh: '请选择购入日期', en: 'Please select a purchase date' },
	'form.error.toBeforeFrom': { zh: '到期日期需不早于购入日期', en: 'End date must not be earlier than purchase date' },
	'form.error.recycleInvalid': { zh: '回收价格格式不正确', en: 'Invalid recycle price format' },
	'form.error.recycleGtPrice': { zh: '回收价不能大于价格', en: 'Recycle price must not exceed price' },

	// Tag panel
	'tags.search.placeholder': { zh: '搜索标签', en: 'Search tags' },
	'tags.selectAll': { zh: '全选', en: 'Select all' },
	'tags.deselectAll': { zh: '取消全选', en: 'Deselect all' },
};

function formatVars(input: string, vars?: Record<string, string | number>): string {
	if (!vars) return input;
	return input.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''));
}

export function t(key: string, vars?: Record<string, string | number>, locale?: 'zh' | 'en'): string {
	const lang = locale || currentLocale;
	const entry = (dict as any)[key] as { zh: string; en: string } | undefined;
	if (!entry) return key;
	const raw = (entry as any)[lang] ?? entry.en ?? key;
	return formatVars(raw, vars);
}


