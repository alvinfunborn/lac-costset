import { App, Plugin, TFile, Notice } from 'obsidian';
import { LacCostSetSettings, DEFAULT_SETTINGS } from './types';
import { AssetRepository } from './repositories/AssetRepository';
import { AssetManagerView } from './components/AssetManagerView';
import { AssetFormModal } from './components/modals/AssetFormModal';
import { LacCostSetSettingTab } from './components/settings/LacCostSetSettingTab';


// 主插件类
export default class LacCostSetPlugin extends Plugin {
	settings: LacCostSetSettings;
	assetRepository: AssetRepository;

	async onload() {
		await this.loadSettings();

		// 初始化AssetRepository（使用设置中的入口文件路径）
		this.assetRepository = new AssetRepository(this.app, this.settings.entryFile || 'costset/costset.md');

		// 注册视图
		this.registerView('lac-costset-view', (leaf) => new AssetManagerView(leaf, this.assetRepository));

		// 避免启动时自动恢复本插件的视图（在布局恢复完成后清理）
		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.detachLeavesOfType('lac-costset-view');
		});

		// 添加文件菜单项
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (!this.settings.enableContextMenu) return;
				if (file instanceof TFile && file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('用 LaC.CostSet 打开')
							.setIcon('package')
							.onClick(() => {
								// 使用 setViewState 打开视图，确保显示标准标题栏与导航
								const leaf = this.app.workspace.getLeaf('tab');
								leaf.setViewState({
									type: 'lac-costset-view',
									state: { filePath: file.path },
									active: true
								});
								this.app.workspace.revealLeaf(leaf);
							});
					});
				}
			})
		);

		// 删除其他命令，仅保留“打开LaC.CostSet”
		this.addCommand({
			id: 'open-lac-costset',
			name: '打开LaC.CostSet',
			callback: async () => {
				const entryPath = this.settings.entryFile || 'costset/costset.md';
				const ensureFolderExists = async (folderPath: string) => {
					const folder = this.app.vault.getAbstractFileByPath(folderPath);
					if (!folder) {
						await this.app.vault.createFolder(folderPath);
					}
				};

				// 1) 若入口文件不存在：创建并写入示例内容（含示例资产文件）
				const entryFile = this.app.vault.getAbstractFileByPath(entryPath);
				if (!entryFile) {
					const parts = entryPath.split('/');
					const folderPath = parts.slice(0, -1).join('/') || '';
					if (folderPath) await ensureFolderExists(folderPath);

					// 写入示例入口内容（含必要 TOML 头部 + 演示双链）
					const sampleEntry = `# LaC.CostSet 入口\n\n# 以下为入口元数据（TOML）\n# 要求：type = \"root\" 且 renders 包含 \"costset\"\n\ntype = \"root\"\nrenders = [\"costset\"]\n\n# 以下为示例资产，您可以删除并替换为自己的资产：\n\n[[演示-键盘]]\n[[演示-耳机]]\n[[演示-路由器]]\n`;
					await this.app.vault.adapter.write(entryPath, sampleEntry);

					// 在同目录创建示例资产文件（TOML 内容）
					const makeAssetToml = (name: string, icon: string, price: number, from: string, to?: string, recycle?: number, tags?: string[]) => {
						const lines: string[] = [];
						lines.push(`name = "${name}"`);
						lines.push('');
						lines.push('[style]');
						lines.push(`icon = "${icon}"`);
						lines.push('');
						lines.push('[detail]');
						lines.push(`price = ${price}`);
						lines.push(`active_from = "${from}"`);
						lines.push(`active_to = "${to || ''}"`);
						lines.push(`recycle_price = ${recycle ?? 0}`);
						lines.push(`tags = [${(tags || []).map(t => `"${t}"`).join(', ')}]`);
						lines.push('');
						return lines.join('\n');
					};

					const assetsFolder = folderPath || 'costset';
					await ensureFolderExists(assetsFolder);
					const assetDefs = [
						{ id: '演示-键盘', icon: '⌨️', price: 399, from: '2024-01-01', to: '', recycle: 0, tags: ['数码', '键盘'] },
						{ id: '演示-耳机', icon: '🎧', price: 599, from: '2024-03-15', to: '', recycle: 0, tags: ['数码', '耳机'] },
						{ id: '演示-路由器', icon: '📶', price: 329, from: '2023-11-20', to: '', recycle: 50, tags: ['网络'] }
					];
					for (const a of assetDefs) {
						const filePath = `${assetsFolder}/${a.id}.md`;
						const exists = this.app.vault.getAbstractFileByPath(filePath);
						if (!exists) {
							await this.app.vault.adapter.write(filePath, makeAssetToml(a.id, a.icon, a.price, a.from, a.to, a.recycle, a.tags));
						}
					}
				}

				// 2) 校验入口文件格式：应为 TOML（或可经临时转换为可解析的 TOML），且 type = "root" 且 renders 包含 "costset"
				let invalid = false;
				try {
					const f = this.app.vault.getAbstractFileByPath(entryPath);
					if (f && f instanceof TFile) {
						const raw = await this.app.vault.read(f);
						// 将 [[...]] 临时替换为 "..."，避免影响 TOML 判断
						const tomlCandidate = raw.replace(/\[\[([^\]]+)\]\]/g, (_m, p1) => `"${String(p1).trim()}"`);
						// 是否包含任意 TOML 键值语句
						const hasTomlKv = /(^|\n)\s*[A-Za-z0-9_.]+\s*=\s*[^\n]+/m.test(tomlCandidate);
						// 提取并校验 type
						const typeMatch = tomlCandidate.match(/(^|\n)\s*type\s*=\s*"([^"]*)"/m);
						const typeVal = typeMatch?.[2] || '';
						// 提取并校验 renders（数组）
						const rendersMatch = tomlCandidate.match(/(^|\n)\s*renders\s*=\s*\[([\s\S]*?)\]/m);
						let rendersHasCostset = false;
						if (rendersMatch && rendersMatch[2]) {
							const arrText = rendersMatch[2];
							rendersHasCostset = /\"costset\"/i.test(arrText) || /(^|,|\s)costset(,|\s|$)/i.test(arrText);
						}
						invalid = !hasTomlKv || typeVal !== 'root' || !rendersHasCostset;
					} else {
						invalid = true;
					}
				} catch (_) {
					invalid = true;
				}
				if (invalid) new Notice('入口文件内容格式不正确：需为 TOML，且 type = "root"，renders 必须包含 "costset"');

				// 3) 使用配置的入口文件打开 LaC.CostSet 视图（通过 setViewState 确保标准导航）
				this.assetRepository = new AssetRepository(this.app, entryPath);
				const leaf = this.app.workspace.getLeaf('tab');
				await leaf.setViewState({
					type: 'lac-costset-view',
					state: { filePath: entryPath },
					active: true
				});
				this.app.workspace.revealLeaf(leaf);
			}
		});


		// 添加设置标签
		this.addSettingTab(new LacCostSetSettingTab(this.app, this));

		// 添加状态栏项
		this.addStatusBarItem().setText('Lac-CostSet');
	}

	onunload() {
		// 清理资源
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}