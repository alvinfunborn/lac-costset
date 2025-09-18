// 插件设置接口
export interface LacCostSetSettings {
	defaultIcon: string;
    entryFile: string;
    enableContextMenu: boolean; // 是否启用右键菜单“用 LaC.CostSet 打开”
    defaultSort: 'none' | 'dailyDesc' | 'priceDesc' | 'dateDesc'; // 默认排序
    locale?: 'auto' | 'zh' | 'en';
}

// 默认设置
export const DEFAULT_SETTINGS: LacCostSetSettings = {
    defaultIcon: '📦',
    entryFile: 'LaC/CostSet/costset.md',
    enableContextMenu: true,
    defaultSort: 'none',
    locale: 'auto'
}
