import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { App as ObsidianApp } from 'obsidian';
import { t } from '../../i18n';
import { AssetRepository } from '../../repositories/AssetRepository';
import { Asset } from '../../models/Asset';
import { TopSummary } from '../ui/TopSummary';
import { TagPanel } from '../ui/TagPanel';
import { AssetFormModal as LegacyAssetFormModal } from '../modals/AssetFormModal';

export type SortMode = 'none' | 'dailyDesc' | 'priceDesc' | 'dateDesc';

export interface AppProps {
    app: ObsidianApp;
    repository: AssetRepository;
    onBack?: () => void;
}

export const AppRoot: React.FC<AppProps> = ({ app, repository, onBack }) => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortMode, setSortMode] = useState<SortMode>('none');
    const [isSortOpen, setSortOpen] = useState<boolean>(false);
    const sortBtnRef = useRef<HTMLButtonElement | null>(null);
    // 弹窗改为调用旧版 DOM Modal，避免样式偏差
    const openAssetModal = useCallback((asset?: Asset) => {
        new LegacyAssetFormModal(app as any, repository, asset, async () => {
            const list = await repository.loadAll();
            setAssets(list);
        }).open();
    }, [app, repository]);

    useEffect(() => {
        let mounted = true;
        repository.loadAll().then((list: Asset[]) => {
            if (mounted) setAssets(list);
        });
        try {
            const plugin = (app as unknown as { plugins?: { plugins?: Record<string, any> } }).plugins?.plugins?.['lac-costset'];
            if (plugin?.settings?.defaultSort) setSortMode(plugin.settings.defaultSort as SortMode);
        } catch (_) {}
        return () => { mounted = false; };
    }, [repository, app]);

    const applyTagFilter = useCallback((input: Asset[]) => {
        if (!selectedTags || selectedTags.length === 0) return input;
        return input.filter((a: Asset) => a.tags?.some((tg: string) => selectedTags.includes(tg)));
    }, [selectedTags]);

    const filteredAssets = useMemo<Asset[]>(() => {
        const calcDate = selectedDate;
        let list = assets.filter((a: Asset) => a.activeFrom <= calcDate);
        if (selectedTags.length > 0) list = applyTagFilter(list);
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter((a: Asset) => (a.name || '').toLowerCase().includes(q) || (a.tags || []).some((tg: string) => (tg || '').toLowerCase().includes(q)));
        }
        if (sortMode !== 'none') {
            list = [...list].sort((a: Asset, b: Asset) => {
                if (sortMode === 'dailyDesc') {
                    return b.getDailyCost(calcDate) - a.getDailyCost(calcDate);
                }
                if (sortMode === 'priceDesc') return Number(b.price || 0) - Number(a.price || 0);
                if (sortMode === 'dateDesc') return (b.activeFrom?.getTime?.() || 0) - (a.activeFrom?.getTime?.() || 0);
                return 0;
            });
        }
        return list;
    }, [assets, selectedDate, selectedTags, searchQuery, sortMode, applyTagFilter]);

    const activeAssets = useMemo<Asset[]>(() => {
        const calcDate = selectedDate;
        return assets.filter((asset: Asset) => asset.isActive(calcDate) && !asset.hidden);
    }, [assets, selectedDate]);

    const filteredActiveAssets = useMemo<Asset[]>(() => applyTagFilter(activeAssets), [activeAssets, applyTagFilter]);

    const totals = useMemo(() => {
        const calcDate = selectedDate;
        const totalCost = filteredActiveAssets.reduce((sum: number, a: Asset) => sum + a.price, 0);
        const totalRecycle = filteredActiveAssets.reduce((sum: number, a: Asset) => sum + a.recyclePrice, 0);
        const totalDailyCost = filteredActiveAssets.reduce((sum: number, a: Asset) => sum + a.getDailyCost(calcDate), 0);
        return { totalDailyCost, totalCost, totalRecycle };
    }, [filteredActiveAssets, selectedDate]);

    const trendPoints = useMemo(() => {
        const now = new Date();
        if (assets.length === 0) return [] as { date: Date, value: number }[];
        // 用全量资产决定时间范围
        const minDate = new Date(Math.min(...assets.map((a: Asset) => a.activeFrom.getTime())));
        const maxActiveTo = Math.max(...assets.map((a: Asset) => a.activeTo?.getTime?.() || now.getTime()));
        const maxDate = new Date(maxActiveTo);

        const baseCount = 30;            // 阶段一：基础采样点数
        const refinePerSegment = 30;     // 阶段二：每段插入的中间点个数

        const computeTotalAt = (d: Date): number => {
            let list = assets.filter((a: Asset) => a.isActive(d) && !a.hidden);
            list = applyTagFilter(list);
            return list.reduce((sum: number, a: Asset) => sum + a.getDailyCost(d), 0);
        };

        // 阶段一：均匀取 baseCount 个点
        const basePts: { date: Date, value: number }[] = [];
        for (let i = 0; i < baseCount; i++) {
            const t = minDate.getTime() + (maxDate.getTime() - minDate.getTime()) * i / Math.max(baseCount - 1, 1);
            const d = new Date(t);
            basePts.push({ date: d, value: computeTotalAt(d) });
        }

        // 阶段二：在相邻两点之间插入 refinePerSegment 个点
        const refined: { date: Date, value: number }[] = [];
        for (let i = 0; i < basePts.length - 1; i++) {
            const a = basePts[i];
            const b = basePts[i + 1];
            refined.push(a); // 先放入起点
            const start = a.date.getTime();
            const end = b.date.getTime();
            const segCount = Math.max(refinePerSegment, 0);
            for (let k = 1; k <= segCount; k++) {
                const ratio = k / (segCount + 1);
                const t = start + (end - start) * ratio;
                const d = new Date(t);
                refined.push({ date: d, value: computeTotalAt(d) });
            }
        }
        if (basePts.length > 0) refined.push(basePts[basePts.length - 1]); // 补最后一个端点

        return refined;
    }, [assets, applyTagFilter]);

    const onSaveAsset = useCallback(async (data: Asset) => {
        await repository.saveAsset(data);
        const list = await repository.loadAll();
        setAssets(list);
    }, [repository]);

    // 点击外部关闭排序菜单
    useEffect(() => {
        if (!isSortOpen) return;
        const onDocClick = (ev: MouseEvent) => {
            const target = ev.target as Node | null;
            if (!target) return;
            const btn = sortBtnRef.current;
            const menu = document.querySelector('.lac-sort-menu');
            if (menu && (menu.contains(target) || (btn && btn.contains(target)))) return;
            setSortOpen(false);
        };
        document.addEventListener('mousedown', onDocClick, true);
        return () => document.removeEventListener('mousedown', onDocClick, true);
    }, [isSortOpen]);

    return (
        <>
            <div className="top-summary">
                <TopSummary
                    totalDailyCost={totals.totalDailyCost}
                    totalCost={totals.totalCost}
                    totalRecycle={totals.totalRecycle}
                    tags={Array.from(new Set(assets.flatMap((a: Asset) => a.tags || []))).sort((a: string, b: string) => new Intl.Collator('zh', { sensitivity: 'base', numeric: true }).compare(a, b))}
                    selectedTags={selectedTags}
                    onTagClick={(tag: string | string[]) => {
                        if (Array.isArray(tag)) setSelectedTags([...new Set(tag)]);
                        else setSelectedTags((prev: string[]) => prev.includes(tag) ? prev.filter((tg: string) => tg !== tag) : [...prev, tag]);
                    }}
                    trendPoints={trendPoints}
                    selectedDate={selectedDate}
                    onDatePick={(dateStr: string) => {
                        const d = new Date(dateStr);
                        setSelectedDate(d);
                    }}
                />
            </div>

            <div className="lac-actionbar-card">
                {onBack && (
                    <button className="lac-icon-btn back" title={t('common.back') || 'Back'} onClick={() => onBack?.()} />
                )}
                <div className="lac-actionbar-search">
                    <div className="search-wrap">
                        <button className="lac-icon-btn search-icon" aria-label={t('view.search.aria')} onClick={() => {}} />
                        <input
                            className=""
                            type="text"
                            placeholder={t('view.search.placeholder')}
                            value={searchQuery}
                            onChange={(e: any) => setSearchQuery((e.target as HTMLInputElement).value || '')}
                        />
                    </div>
                </div>
                <div className="lac-actionbar-actions">
                    <button ref={sortBtnRef} className="lac-icon-btn sort" title={t('view.sort.title')}
                        onClick={() => setSortOpen((v) => !v)}
                    />
                    {isSortOpen && (
                        <div className="lac-sort-menu" role="menu">
                            {(['dailyDesc','priceDesc','dateDesc'] as SortMode[]).map((mode: SortMode) => (
                                <div key={mode}
                                    className={`menu-item${sortMode===mode ? ' active' : ''}`}
                                    role="menuitem"
                                    onClick={() => {
                                        const next = sortMode === mode ? 'none' : mode;
                                        setSortMode(next as SortMode);
                                        setSortOpen(false);
                                        try {
                                            const plugin = (app as unknown as { plugins?: { plugins?: Record<string, any> } }).plugins?.plugins?.['lac-costset'];
                                            if (plugin) {
                                                plugin.settings = plugin.settings || {};
                                                plugin.settings.defaultSort = next;
                                                if (typeof plugin.saveSettings === 'function') plugin.saveSettings();
                                            }
                                        } catch (_) {}
                                    }}
                                >
                                    {t(`view.sort.menu.${mode}`)}
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="lac-icon-btn add" title={t('view.add')}
                        onClick={() => openAssetModal(undefined)}
                    />
                </div>
            </div>

            <div className="assets-container">
                {filteredAssets.length === 0 && (
                    <p></p>
                )}
                {filteredAssets.map((asset: Asset) => {
                    const isExpired = !!(asset.activeTo && asset.activeTo <= selectedDate);
                    const endText = isExpired ? asset.activeTo!.toISOString().split('T')[0] : t('view.toNow');
                    return (
                        <div key={asset.id} className={`asset-card${asset.hidden ? ' hidden' : ''}${isExpired ? ' asset-card--expired' : ''}`} onClick={() => openAssetModal(asset)}>
                            <div className="asset-info">
                                <div className="asset-title">{asset.icon} {asset.name}</div>
                                <div className="asset-date">{t('view.usedDays', { days: asset.getUsageDays(selectedDate) })} ({asset.activeFrom.toISOString().split('T')[0]} ~ {asset.activeTo ? endText : t('view.toNow')})</div>
                                <div className="asset-labels-scroll">
                                    {(asset.tags || []).map((tag: string) => (
                                        <span key={tag} className="tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="asset-costs">
                                <div className="asset-costs-line">
                                    <div className="asset-price">{t('view.daily')}&nbsp;</div>
                                    <div className="asset-dailycost">{t('currency.symbol')}{asset.getDailyCost(selectedDate).toFixed(2)}</div>
                                </div>
                                <div className="asset-price">{t('view.price')} {t('currency.symbol')}{asset.price}</div>
                                <div className="asset-price">{t('view.recyclePrice')} {t('currency.symbol')}{asset.recyclePrice}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 新建使用旧版 DOM Modal */}
        </>
    );
};


