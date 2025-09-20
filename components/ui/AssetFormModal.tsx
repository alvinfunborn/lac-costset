import React, { useMemo, useState } from 'react';
import type { App as ObsidianApp } from 'obsidian';
import { t } from '../../i18n';
import { Asset } from '../../models/Asset';
import { AssetRepository } from '../../repositories/AssetRepository';

interface Props {
  app: ObsidianApp;
  repository: AssetRepository;
  asset?: Asset | null;
  onSaved?: () => void;
  onClose: () => void;
}

export const AssetFormModal: React.FC<Props> = ({ app, repository, asset, onSaved, onClose }) => {
  const [name, setName] = useState<string>(asset?.name || '');
  const [icon, setIcon] = useState<string>(asset?.icon || getDefaultIcon());
  const [price, setPrice] = useState<string>(asset ? String(asset.price) : '');
  const [from, setFrom] = useState<string>(asset?.activeFrom ? formatDate(asset.activeFrom) : '');
  const [to, setTo] = useState<string>(asset?.activeTo ? formatDate(asset.activeTo) : '');
  const [recycle, setRecycle] = useState<string>(asset ? String(asset.recyclePrice) : '');
  const [tags, setTags] = useState<string[]>(asset?.tags || []);

  function getDefaultIcon(): string {
    try {
      const plugin = (app as unknown as { plugins?: { plugins?: Record<string, any> } }).plugins?.plugins?.['lac-costset'];
      return plugin?.settings?.defaultIcon || '📦';
    } catch (_) {
      return '📦';
    }
  }

  function formatDate(d: Date): string {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
  }

  function clampMoneyTwoDecimals(v: string): string {
    const only = (v || '').replace(/[^\d.]/g, '');
    const m = only.match(/^(\d+)(?:\.(\d*))?$/);
    if (!m) return '';
    const intPart = m[1];
    const decPart = (m[2] || '').slice(0, 2);
    return decPart ? `${intPart}.${decPart}` : intPart;
  }

  const onSubmit = async (e: any) => {
    e.preventDefault();
    const nameVal = (name || '').trim();
    const priceNum = Number(clampMoneyTwoDecimals(price));
    if (!nameVal || !Number.isFinite(priceNum)) return;
    const fromDate = new Date(from);
    let toDate: Date | undefined = to ? new Date(to) : undefined;
    if (toDate && toDate.getTime() < fromDate.getTime()) return;
    const recycleNum = Number(clampMoneyTwoDecimals(recycle || '0')) || 0;
    if (recycleNum > priceNum) return;

    const data = new Asset({
      id: asset?.id || nameVal,
      name: nameVal,
      icon: icon || '📦',
      price: priceNum,
      activeFrom: fromDate,
      activeTo: toDate,
      recycle_price: recycleNum,
      tags
    });
    await repository.saveAsset(data);
    onSaved?.();
    onClose();
  };

  return (
    <div className="date-picker-mask" onClick={(e: any) => { if (e.currentTarget === e.target) onClose(); }}>
      <div className="date-picker-modal asset-form-modal" role="dialog" aria-modal="true">
        <div className="date-picker-content">
          <form className="asset-form asset-form--horizontal" onSubmit={onSubmit}>
            <div className="form-group">
              <label className="label-required">{t('form.name')}</label>
              <div className="form-field">
                <input type="text" placeholder={t('form.assetName.placeholder')} value={name} onChange={(e: any) => setName((e.target as HTMLInputElement).value)} />
              </div>
            </div>
            <div className="form-group">
              <label>{t('form.icon')}</label>
              <div className="form-field">
                <input type="text" placeholder={`😊${t('form.icon.placeholder')}`} value={icon} onChange={(e: any) => {
                  const m = ((e.target as HTMLInputElement).value || '').match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/);
                  setIcon(m ? m[0] : '');
                }} />
              </div>
            </div>
            <div className="form-group">
              <label className="label-required">{t('form.price')}</label>
              <div className="form-field">
                <input type="number" placeholder={t('form.price.placeholder')} value={price} onChange={(e: any) => setPrice(clampMoneyTwoDecimals((e.target as HTMLInputElement).value))} />
              </div>
            </div>
            <div className="form-group">
              <label className="label-required">{t('form.purchaseOn')}</label>
              <div className="form-field">
                <input type="date" placeholder={t('form.purchaseDate')} value={from} onChange={(e: any) => setFrom((e.target as HTMLInputElement).value)} />
              </div>
            </div>
            <div className="form-group">
              <label>{t('form.endDate')}</label>
              <div className="form-field">
                <div className="input-with-clear">
                  <input type="date" placeholder={t('form.endDatePlaceholder')} value={to} onChange={(e: any) => setTo((e.target as HTMLInputElement).value)} />
                  {to && <button type="button" className="input-clear" onClick={() => setTo('')}>×</button>}
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>{t('form.recyclePrice')}</label>
              <div className="form-field">
                <input type="number" placeholder={t('form.recycle.placeholder')} value={recycle} onChange={(e: any) => setRecycle(clampMoneyTwoDecimals((e.target as HTMLInputElement).value))} />
              </div>
            </div>
            <div className="form-group">
              <label>{t('form.tags')}</label>
              <div className="form-field">
                <div className="tags-input">
                  {tags.map((tag: string) => (
                    <span key={tag} className="tag-chip">{tag}<button type="button" className="remove" onClick={() => setTags(tags.filter((tg: string) => tg !== tag))}>×</button></span>
                  ))}
                  <input type="text" placeholder={t('form.tags.placeholder')} onKeyDown={(e: any) => {
                    if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ',' || (e as KeyboardEvent).key === '，') {
                      e.preventDefault();
                      const input = e.currentTarget as HTMLInputElement;
                      const raw = (input.value || '').trim();
                      if (!raw) return;
                      raw.split(/[，,\s]+/).map((s: string) => s.trim()).filter(Boolean).forEach((p: string) => {
                        if (!tags.includes(p)) setTags((prev: string[]) => [...prev, p]);
                      });
                      input.value = '';
                    }
                  }} />
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="form-btn form-btn-secondary" onClick={onClose}>{t('form.action.cancel')}</button>
              {asset && <button type="button" className="form-btn form-btn-danger" onClick={async () => {
                await repository.deleteAsset(asset.id);
                onSaved?.();
                onClose();
              }}>{t('form.action.delete')}</button>}
              <button type="submit" className="form-btn form-btn-primary">{t('form.action.save')}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
