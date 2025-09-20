// Asset实体类
export class Asset {
	id: string;
	name: string;
	icon: string;
	price: number;
	activeFrom: Date;
	activeTo?: Date;
	recyclePrice: number;
	tags: string[];
	hidden: boolean;

	constructor(idOrRawData: string | any, tomlData?: any) {
		if (typeof idOrRawData === 'string' && tomlData) {
			// TOML 模式（优先读取 [costset] 命名空间，兼容旧结构）
			this.id = idOrRawData;
			const src = tomlData.costset ? tomlData.costset : tomlData;
			this.name = src.name || '';
			// style.icon 兼容两种来源
			this.icon = src.style?.icon ?? tomlData.style?.icon ?? '📦';
			const detail = src.detail ?? tomlData.detail ?? {};
			this.price = Number(detail.price) || 0;
			this.activeFrom = this.parseDate(detail.active_from) || new Date();
			this.activeTo = this.parseDate(detail.active_to) || undefined;
			this.recyclePrice = Number(detail.recycle_price) || 0;
			this.tags = Array.isArray(detail.tags) ? detail.tags : (detail.tags || '').split(',').map((l: string) => l.trim()).filter((tag: string) => tag);
			this.hidden = !!(detail.hidden ?? src.hidden);
		} else if (typeof idOrRawData === 'object') {
			// 扁平对象模式
			this.id = idOrRawData.id || '';
			this.name = idOrRawData.name || '';
			this.icon = idOrRawData.icon || '📦';
			this.price = Number(idOrRawData.price) || 0;
			this.activeFrom = this.parseDate(idOrRawData.active_from || idOrRawData.activeFrom) || new Date();
			this.activeTo = this.parseDate(idOrRawData.active_to || idOrRawData.activeTo) || undefined;
			this.recyclePrice = Number(idOrRawData.recycle_price ?? idOrRawData.recyclePrice) || 0;
			this.tags = Array.isArray(idOrRawData.tags) ? idOrRawData.tags : (idOrRawData.tags || '').split(',').map((l: string) => l.trim()).filter((tag: string) => tag);
			this.hidden = !!idOrRawData.hidden;
		} else {
			throw new Error('Invalid asset data');
		}
	}

	private parseDate(dateStr: string): Date | undefined {
		if (!dateStr) return undefined;
		const date = new Date(dateStr);
		return isNaN(date.getTime()) ? undefined : date;
	}

	getName() { return this.name; }
	getPrice() { return this.price; }
	
	getDailyCost(now: Date = new Date()): number {
		const from = this.activeFrom;
		// 未来资产：日均成本为 0
		if (from.getTime() > now.getTime()) return 0;
		// 计算到达日期：若存在 activeTo，则与 now 取较早者；否则取 now
		const end = this.activeTo && this.activeTo.getTime() < now.getTime() ? this.activeTo : now;
		const days = Math.max(1, Math.floor((end.getTime() - from.getTime()) / 86400000));
		// 仅当资产已到期（activeTo 存在且不晚于 now）时，才计入回收价
		const hasExpired = !!this.activeTo && this.activeTo.getTime() <= now.getTime();
		const costBasis = hasExpired ? (this.price - this.recyclePrice) : this.price;
		return costBasis / days;
	}
	
	getUsageDays(now: Date = new Date()): number {
		const from = this.activeFrom;
		const end = this.activeTo && this.activeTo.getTime() < now.getTime() ? this.activeTo : now;
		return Math.max(1, Math.floor((end.getTime() - from.getTime()) / 86400000));
	}
	
	isActive(date: Date = new Date()): boolean {
		return this.activeFrom <= date && (!this.activeTo || date < this.activeTo);
	}

	toTomlString(): string {
		const formatDate = (date: Date | undefined): string => {
			if (!date) return '';
			return date.toISOString().split('T')[0];
		};

		return `name = "${this.name}"

[style]
icon = "${this.icon}"

[detail]
price = ${this.price}
active_from = "${formatDate(this.activeFrom)}"
active_to = "${formatDate(this.activeTo)}"
recycle_price = ${this.recyclePrice}
tags = [${this.tags.map(tag => `"${tag}"`).join(', ')}]
`;
	}

	// 仅输出 costset 命名空间的 TOML 片段（用于安全合并）
	toCostsetTomlSections(): string {
		const formatDate = (date: Date | undefined): string => {
			if (!date) return '';
			return date.toISOString().split('T')[0];
		};
		const tagsStr = this.tags.map(tag => `"${tag}"`).join(', ');
		return `[costset]
name = "${this.name}"
hidden = ${this.hidden ? 'true' : 'false'}

[costset.style]
icon = "${this.icon}"

[costset.detail]
price = ${this.price}
active_from = "${formatDate(this.activeFrom)}"
active_to = "${formatDate(this.activeTo)}"
recycle_price = ${this.recyclePrice}
tags = [${tagsStr}]
`;
	}
}
