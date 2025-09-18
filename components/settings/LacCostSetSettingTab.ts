import { App, PluginSettingTab, Setting } from 'obsidian';
import LacCostSetPlugin from '../../main';
import { AssetRepository } from '../../repositories/AssetRepository';

// 设置标签
export class LacCostSetSettingTab extends PluginSettingTab {
	plugin: LacCostSetPlugin;

	constructor(app: App, plugin: LacCostSetPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Lac.CostSet 设置' });
		
		// —— 格式与用法说明 ——
		containerEl.createEl('p', { 
			text: '重要：入口文件与资产文件的“内容格式为 TOML”，文件扩展名可为 .md。允许 # 开头的注释。唯一的非 TOML 例外是：文件正文中的 [[资产文件名]] 双链可省略引号，插件在解析时会临时为其加上引号后按 TOML 处理。除这点外，不应混入普通 Markdown 文本。',
			cls: 'setting-item-description'
		});
		const entryExample = `# 入口文件最小示例\n\n# 顶部 TOML：必须满足\n# type = \"root\"\n# renders = [\"costset\"]\n\ntype = \"root\"\nrenders = [\"costset\"]\n\n# 正文：用双链列出资产文件名（不需要扩展名）\n\n[[键盘]]\n[[耳机]]\n`;
		containerEl.createEl('pre', { text: entryExample, cls: 'setting-item-description' });
		containerEl.createEl('p', { 
			text: '资产文件同样是 Markdown，但内容以 TOML 字段为主（插件会保留你写的注释）。以下为最小示例：',
			cls: 'setting-item-description'
		});
		const assetExample = `name = \"键盘\"\n\n[style]\nicon = \"⌨️\"\n\n[detail]\nprice = 399\nactive_from = \"2024-01-01\"\nactive_to = \"\"\nrecycle_price = 0\ntags = [\"数码\", \"键盘\"]\n`;
		containerEl.createEl('pre', { text: assetExample, cls: 'setting-item-description' });
		containerEl.createEl('p', { 
			text: '用法：在“入口文件”上右键 → 选择“用 LaC.CostSet 打开”。也可在命令面板执行“打开LaC.CostSet”（将使用下方配置的入口文件）。',
			cls: 'setting-item-description'
		});

		new Setting(containerEl)
			.setName('入口文件')
			.setDesc('作为资产入口的 Markdown 文件路径，例如 costset/costset.md')
			.addText(text => text
				.setPlaceholder('costset/costset.md')
				.setValue(this.plugin.settings.entryFile || 'costset/costset.md')
				.onChange(async (value) => {
					this.plugin.settings.entryFile = value?.trim() || 'costset/costset.md';
					await this.plugin.saveSettings();
					// 立即用新的入口文件重建仓库
					this.plugin.assetRepository = new AssetRepository(this.app, this.plugin.settings.entryFile);
				}));

		new Setting(containerEl)
			.setName('启用右键菜单 “用 LaC.CostSet 打开”')
			.setDesc('在 Markdown 文件的右键菜单中显示入口')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableContextMenu)
				.onChange(async (value) => {
					this.plugin.settings.enableContextMenu = !!value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('默认排序')
			.setDesc('打开视图时的初始排序方式')
			.addDropdown(drop => {
				drop.addOption('none', '文本顺序');
				drop.addOption('dailyDesc', '日均价格');
				drop.addOption('priceDesc', '价格');
				drop.addOption('dateDesc', '购入日期');
				drop.setValue(this.plugin.settings.defaultSort || 'none');
				drop.onChange(async (value) => {
					const v = (value as any) as 'none' | 'dailyDesc' | 'priceDesc' | 'dateDesc';
					this.plugin.settings.defaultSort = v;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('默认图标')
			.setDesc('新资产的默认图标，仅支持 1 个 Emoji')
			.addText(text => {
				const sanitizeToFirstEmoji = (input: string): string => {
					const m = (input || '').match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/);
					return m ? m[0] : '';
				};
				text
					.setPlaceholder('📦')
					.setValue(this.plugin.settings.defaultIcon)
					.onChange(async (value) => {
						const first = sanitizeToFirstEmoji(value);
						if ((text as any).inputEl && (text as any).inputEl.value !== first) {
							(text as any).inputEl.value = first;
						}
						this.plugin.settings.defaultIcon = first;
						await this.plugin.saveSettings();
					});
				const inputEl = (text as any).inputEl as HTMLInputElement;
				if (inputEl) {
					inputEl.addEventListener('paste', () => {
						setTimeout(() => {
							const first = sanitizeToFirstEmoji(inputEl.value || '');
							if (inputEl.value !== first) inputEl.value = first;
							this.plugin.settings.defaultIcon = first;
							this.plugin.saveSettings();
						}, 0);
					});
				}
			});
	}
}
