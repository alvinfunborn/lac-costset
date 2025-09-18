import { App, TFile } from 'obsidian';
import { Asset } from '../models/Asset';

// AssetRepository类 - 使用Obsidian API
export class AssetRepository {
	private app: App;
	private rootFilePath: string;

	constructor(app: App, rootFilePath: string) {
		this.app = app;
		this.rootFilePath = rootFilePath;
	}

	// 获取资产文件夹路径（从根文件路径推导）
	private getAssetsFolder(): string {
		const pathParts = this.rootFilePath.split('/');
		if (pathParts.length > 1) {
			return pathParts.slice(0, -1).join('/');
		}
		return 'assets'; // 默认文件夹
	}

	// 加载所有资产
	async loadAll(): Promise<Asset[]> {
		const rootFile = this.app.vault.getAbstractFileByPath(this.rootFilePath);
		if (!rootFile || !(rootFile instanceof TFile)) {
			return [];
		}

		try {
			const content = await this.app.vault.read(rootFile);
			const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
			const linkTargets = matches
				.map(m => m.replace(/^\[\[|\]\]$/g, ''))
				.map(s => s.split('|')[0]?.trim())
				.filter(Boolean) as string[];
			
			const assets: Asset[] = [];
			for (const target of linkTargets) {
				let file: TFile | null = null;
				try {
					file = this.app.metadataCache.getFirstLinkpathDest(target, this.rootFilePath) as TFile | null;
				} catch (_) {
					file = null;
				}
				if (!file) continue;

                        try {
                                        const fileContent = await this.app.vault.read(file);                                                                    
                                        const data = this.parseToml(this.quoteWikilinksForToml(fileContent));                                                   
					const assetId = file.basename || target;
					const asset = new Asset(assetId, data);
					// hidden 字段仅内存使用，加载时默认关闭
					asset.hidden = false;
					assets.push(asset);
				} catch (e) {
					console.error(`Failed to load asset ${target}:`, e);
				}
			}
			return assets;
		} catch (e) {
			console.error('Failed to load assets:', e);
			return [];
		}
	}

	// 保存资产（仅修改与 costset 相关的键：name、style.icon、detail.*、hidden）
	async saveAsset(asset: Asset): Promise<void> {
		let targetFile: TFile | null = null;
		try {
			targetFile = this.app.metadataCache.getFirstLinkpathDest(asset.id, this.rootFilePath) as TFile | null;
		} catch (_) {
			targetFile = null;
		}

		// 不再扫描子目录或遍历文件：仅依赖 Obsidian 的双链解析

			if (!targetFile) {
			// 目标文件不存在：在根文件同目录下创建新文件
			let fileName = `${asset.id}.md`;
			let filePath = `${this.getAssetsFolder()}/${fileName}`;
			// 确保文件夹存在
			const folder = this.app.vault.getAbstractFileByPath(this.getAssetsFolder());
			if (!folder) {
				await this.app.vault.createFolder(this.getAssetsFolder());
			}
						const initialContent = this.dequoteWikilinks(asset.toTomlString());
			try {
							await this.app.vault.create(filePath, initialContent);                                                                    
			} catch (e) {
				// 尝试使用 encode 后的文件名再次创建
				fileName = `${encodeURIComponent(asset.id)}.md`;
				filePath = `${this.getAssetsFolder()}/${fileName}`;
							await this.app.vault.create(filePath, initialContent);                                                                    
			}
		} else {
			// 纯 TOML 重写模式：读取→解析→仅改相关键→整体重写；注释置顶保留
			const existing = await this.app.vault.read(targetFile);
					const rewritten = this.rewriteTomlWithCommentsTop(existing, asset);                                                                     
					await this.app.vault.modify(targetFile, this.dequoteWikilinks(rewritten));     
		}

		// 更新根文件中对该资产的双链引用
		await this.updateRootFile(asset.id, true);
	}

	// 删除资产
	async deleteAsset(id: string): Promise<void> {
		// 更新根文件
		await this.updateRootFile(id, false);
	}

	// 注意：hidden 字段不持久化（仅内存使用），此处不提供 setHidden

	// 更新根文件
	private async updateRootFile(assetId: string, isAdd: boolean): Promise<void> {
		const rootPath = this.rootFilePath;
		let rootContent = '';

		try {
			const rootFile = this.app.vault.getAbstractFileByPath(rootPath);
			if (rootFile && rootFile instanceof TFile) {
				rootContent = await this.app.vault.read(rootFile);
			}
		} catch (e) {
			// 文件不存在，创建新文件
		}

			if (isAdd) {
					// 添加资产引用：若已存在任意形式的双链（[[id]] 或 [[id|alias]]）则不重复添加
					const hasAnyLink = new RegExp(`\\[\\[${assetId}(\\|[^\\]]+)?\\]\\]`).test(rootContent);
					if (!hasAnyLink) {
							rootContent += `\n[[${assetId}]]`;
					}
			} else {
					// 删除资产引用：同时移除 [[id]] 与 [[id|alias]] 的整行或行内片段
					rootContent = rootContent.replace(new RegExp(`\\[\\[${assetId}(\\|[^\\]]+)?\\]\\]`, 'g'), '');
					rootContent = rootContent.replace(/\n{3,}/g, '\n\n').trimEnd();
			}

		const existingRoot = this.app.vault.getAbstractFileByPath(rootPath);
		if (existingRoot && existingRoot instanceof TFile) {
			await this.app.vault.modify(existingRoot, rootContent);
		} else {
			await this.app.vault.create(rootPath, rootContent);
		}
	}

	// 解析TOML内容（支持嵌套节名，如 [costset.detail]）
	private parseToml(content: string): any {
		const lines = content.split('\n');
		const result: any = {};
		let currentPath: string[] = [];

		const ensurePath = (root: any, path: string[]): any => {
			let node = root;
			for (const part of path) {
				if (!node[part] || typeof node[part] !== 'object') node[part] = {};
				node = node[part];
			}
			return node;
		};

		for (const raw of lines) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) continue;
			if (line.startsWith('[') && line.endsWith(']')) {
				const section = line.slice(1, -1).trim();
				currentPath = section.split('.').map(s => s.trim()).filter(Boolean);
				ensurePath(result, currentPath);
				continue;
			}
			const eq = line.indexOf('=');
			if (eq === -1) continue;
			const cleanKey = line.slice(0, eq).trim();
			let cleanValue = line.slice(eq + 1).trim();

			let parsedValue: any = cleanValue;
			if (cleanValue.startsWith('"') && cleanValue.endsWith('"')) {
				parsedValue = cleanValue.slice(1, -1);
			} else if (cleanValue === 'true' || cleanValue === 'false') {
				parsedValue = cleanValue === 'true';
			} else if (cleanValue.startsWith('[') && cleanValue.endsWith(']')) {
				const arrayContent = cleanValue.slice(1, -1).trim();
				parsedValue = arrayContent ? arrayContent.split(',').map(item => item.trim().replace(/^"|"$/g, '')) : [];
			} else if (!isNaN(Number(cleanValue))) {
				parsedValue = Number(cleanValue);
			}

			if (currentPath.length > 0) {
				const node = ensurePath(result, currentPath);
				node[cleanKey] = parsedValue;
			} else {
				result[cleanKey] = parsedValue;
			}
		}

		return result;
	}

	// 纯 TOML 重写模式：解析→修改→stringify；将原有注释置顶保留
	private rewriteTomlWithCommentsTop(existing: string, asset: Asset): string {
		const commentLines: string[] = [];
		const otherLines: string[] = [];
		for (const raw of existing.split('\n')) {
			const t = raw.trim();
			if (t.startsWith('#')) commentLines.push(raw);
			else otherLines.push(raw);
		}
                // 使用已有轻量 parser 读取为对象
                const parsed = this.parseToml(this.quoteWikilinksForToml(otherLines.join('\n'))) || {};     

		// 应用仅 costset 相关的字段更新
		(parsed as any)['name'] = asset.name;
		if (!parsed['style'] || typeof parsed['style'] !== 'object') parsed['style'] = {};
		parsed['style']['icon'] = asset.icon;
		if (!parsed['detail'] || typeof parsed['detail'] !== 'object') parsed['detail'] = {};
		parsed['detail']['price'] = Number(asset.price) || 0;
		parsed['detail']['active_from'] = asset.activeFrom ? asset.activeFrom.toISOString().split('T')[0] : '';
		parsed['detail']['active_to'] = asset.activeTo ? asset.activeTo.toISOString().split('T')[0] : '';
		parsed['detail']['recycle_price'] = Number(asset.recyclePrice) || 0;
		parsed['detail']['tags'] = Array.isArray(asset.tags) ? asset.tags : [];

		const tomlBody = this.stringifyToml(parsed);
		const commentBlock = commentLines.length > 0 ? commentLines.join('\n') + '\n\n' : '';
		return commentBlock + tomlBody;
	}

	// 将 JS 对象稳定地序列化为 TOML 文本（支持多层节名）
	private stringifyToml(obj: any): string {
		// 拆分为顶层标量/数组 与 嵌套对象
		const isPlainObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
		const keys = Object.keys(obj || {});
		const scalarKeys = keys.filter(k => !isPlainObject(obj[k]));
		const objectKeys = keys.filter(k => isPlainObject(obj[k]));

		const lines: string[] = [];
		// 优先输出 name
		if (scalarKeys.includes('name')) {
			lines.push(this.renderTomlKeyValue('name', obj['name']));
		}
		// 其他顶层标量按字母序
		scalarKeys
			.filter(k => k !== 'name')
			.sort((a, b) => a.localeCompare(b))
			.forEach(k => lines.push(this.renderTomlKeyValue(k, obj[k])));

		// 节输出顺序：style, detail 优先，其它按字母序
		const sectionOrder = ['style', 'detail'];
		const orderedObjectKeys = [
			...sectionOrder.filter(k => objectKeys.includes(k)),
			...objectKeys.filter(k => !sectionOrder.includes(k)).sort((a, b) => a.localeCompare(b))
		];

		for (const k of orderedObjectKeys) {
			lines.push('');
			this.renderTomlSection(lines, [k], obj[k]);
		}

		return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
	}

	private renderTomlSection(out: string[], path: string[], value: any): void {
		out.push(`[${path.join('.')}]`);
		const isPlainObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
		const keys = Object.keys(value || {});
		const scalarKeys = keys.filter(k => !isPlainObject(value[k]));
		const objectKeys = keys.filter(k => isPlainObject(value[k]));
		// 先输出标量键（按字母序）
		scalarKeys.sort((a, b) => a.localeCompare(b)).forEach(k => {
			out.push(this.renderTomlKeyValue(k, value[k]));
		});
		// 嵌套对象作为子节 [a.b]
		const orderedObjectKeys = objectKeys.sort((a, b) => a.localeCompare(b));
		for (const k of orderedObjectKeys) {
			out.push('');
			this.renderTomlSection(out, [...path, k], value[k]);
		}
	}

	private renderTomlKeyValue(key: string, val: any): string {
		return `${key} = ${this.tomlValue(val)}`;
	}

	private tomlValue(val: any): string {
		if (val === null || val === undefined) return '""';
		if (Array.isArray(val)) {
			return `[${val.map(v => this.tomlValue(v)).join(', ')}]`;
		}
		switch (typeof val) {
			case 'number':
				return Number.isFinite(val) ? String(val) : '0';
			case 'boolean':
				return val ? 'true' : 'false';
			case 'string':
			default:
				return `"${String(val).replace(/\\/g, '\\\\').replace(/\"/g, '\\"')}"`;
		}
	}

        // 将裸的 [[...]] 或 [[...|alias]] 包裹为可被 TOML 解析的字符串
        private quoteWikilinksForToml(content: string): string {
                return content.replace(/\[\[[^\]]+\]\]/g, (match: string, offset: number, full: string) => {
                        const before = offset > 0 ? full[offset - 1] : '';
                        const after = offset + match.length < full.length ? full[offset + match.length] : '';
                        if ((before === '"' && after === '"') || (before === '\'' && after === '\'')) {
                                return match; // already quoted
                        }
                        return `"${match}"`;
                });
        }

        // 将 "[[...]]" 或 '[[...]]' 形式还原为裸的双链
        private dequoteWikilinks(content: string): string {
                return content.replace(/(["'])\[\[[^\]]+\]\]\1/g, (match: string) => match.slice(1, -1));
        }
}
