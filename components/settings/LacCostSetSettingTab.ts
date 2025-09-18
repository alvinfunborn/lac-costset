import { App, PluginSettingTab, Setting } from 'obsidian';
import LacCostSetPlugin from '../../main';
import { AssetRepository } from '../../repositories/AssetRepository';
import { t } from '../../i18n';

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

		containerEl.createEl('h2', { text: t('settings.title') });
		
		// —— 格式与用法说明 ——
		containerEl.createEl('p', { text: t('settings.guide.1'), cls: 'setting-item-description' });
		const entryExample = t('settings.entry.example');
		containerEl.createEl('pre', { text: entryExample, cls: 'setting-item-description' });
		containerEl.createEl('p', { text: t('settings.asset.desc'), cls: 'setting-item-description' });
		const assetExample = t('settings.asset.example');
		containerEl.createEl('pre', { text: assetExample, cls: 'setting-item-description' });
		containerEl.createEl('p', { text: t('settings.usage'), cls: 'setting-item-description' });

		new Setting(containerEl)
			.setName(t('settings.entryFile.name'))
			.setDesc(t('settings.entryFile.desc'))
			.addText(text => text
				.setPlaceholder('LaC/CostSet/costset.md')
				.setValue(this.plugin.settings.entryFile || 'LaC/CostSet/costset.md')
				.onChange(async (value) => {
					this.plugin.settings.entryFile = value?.trim() || 'LaC/CostSet/costset.md';
					await this.plugin.saveSettings();
					// 立即用新的入口文件重建仓库
					this.plugin.assetRepository = new AssetRepository(this.app, this.plugin.settings.entryFile);
				}));

		new Setting(containerEl)
			.setName(t('settings.contextMenu.name'))
			.setDesc(t('settings.contextMenu.desc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableContextMenu)
				.onChange(async (value) => {
					this.plugin.settings.enableContextMenu = !!value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(t('settings.defaultSort.name'))
			.setDesc(t('settings.defaultSort.desc'))
			.addDropdown(drop => {
				drop.addOption('none', t('settings.defaultSort.option.none'));
				drop.addOption('dailyDesc', t('settings.defaultSort.option.dailyDesc'));
				drop.addOption('priceDesc', t('settings.defaultSort.option.priceDesc'));
				drop.addOption('dateDesc', t('settings.defaultSort.option.dateDesc'));
				drop.setValue(this.plugin.settings.defaultSort || 'none');
				drop.onChange(async (value) => {
					const v = (value as any) as 'none' | 'dailyDesc' | 'priceDesc' | 'dateDesc';
					this.plugin.settings.defaultSort = v;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName(t('settings.defaultIcon.name'))
			.setDesc(t('settings.defaultIcon.desc'))
			.addText(text => {
				const sanitizeToFirstEmoji = (input: string): string => {
					const m = (input || '').match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/);
					return m ? m[0] : '';
				};
				text
					.setPlaceholder(t('settings.defaultIcon.placeholder'))
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

		// 语言设置
		new Setting(containerEl)
			.setName(t('settings.locale.name'))
			.setDesc(t('settings.locale.desc'))
			.addDropdown(drop => {
				// 语言选项使用自我描述：中文/English
				drop.addOption('auto', t('settings.locale.option.auto'));
				drop.addOption('zh', '中文');
				drop.addOption('en', 'English');
				drop.setValue(this.plugin.settings.locale || 'auto');
				drop.onChange(async (value) => {
					this.plugin.settings.locale = (value as any);
					await this.plugin.saveSettings();
					// 立即刷新当前设置页，应用语言
					this.display();
				});
			});
	}
}
