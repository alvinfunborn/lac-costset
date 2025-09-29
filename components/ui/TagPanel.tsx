import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';

export interface TagPanelProps {
  tags: string[];
  selectedTags: string[];
  onTagClick: (tag: string | string[]) => void;
}

export const TagPanel: React.FC<TagPanelProps> = ({ tags, selectedTags, onTagClick }) => {
  const [panelVisible, setPanelVisible] = useState<boolean>(false);
  const [panelSelected, setPanelSelected] = useState<string[]>(selectedTags);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const labelsScrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef<number>(0);

  useEffect(() => { setPanelSelected(selectedTags); }, [selectedTags]);



  const visibleTags = useMemo(() => {
    const lower = (searchKeyword || '').toLowerCase();
    if (!lower) return tags;
    return tags.filter(tg => (tg || '').toLowerCase().includes(lower));
  }, [tags, searchKeyword]);

  useEffect(() => {
    if (!panelVisible) return;
    const el = labelsScrollRef.current;
    if (!el) return;
    el.scrollTop = savedScrollTopRef.current || 0;
  }, [panelVisible, searchKeyword, panelSelected, visibleTags.length]);


  const toggleTag = useCallback((tag: string) => {
    setPanelSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const confirmAndClose = useCallback(() => {
    onTagClick(panelSelected);
    setPanelVisible(false);
  }, [onTagClick, panelSelected]);

  return (
    <div
      ref={rootRef}
      className="top-summary-labels"
      onClick={(e) => { 
        // 如果点击的是容器本身，则弹出面板
        if (e.target === e.currentTarget) {
          setPanelSelected(selectedTags); 
          setPanelVisible(true); 
        }
      }}
    >
      {tags.map(tag => (
        <span key={tag}
          className={`top-summary-label${selectedTags.includes(tag) ? ' selected' : ''}`}
          onClick={(ev) => { ev.stopPropagation(); onTagClick(tag); }}>
          {tag}
        </span>
      ))}

      {panelVisible && (
        <div className="top-summary-panel-mask" onClick={confirmAndClose}>
          <div className="top-summary-panel" onClick={(e) => e.stopPropagation()}>
            <input className="top-summary-panel-search" type="text"
              placeholder={t('tags.search.placeholder')}
              value={searchKeyword}
              onChange={(e) => { savedScrollTopRef.current = labelsScrollRef.current?.scrollTop || 0; setSearchKeyword((e.target as HTMLInputElement).value || ''); }}
            />
            <div className="top-summary-panel-labels" ref={labelsScrollRef}>
              {visibleTags.map((tag) => (
                <span key={tag}
                  className={`top-summary-panel-label${panelSelected.includes(tag) ? ' selected' : ''}`}
                  onClick={() => { savedScrollTopRef.current = labelsScrollRef.current?.scrollTop || 0; toggleTag(tag); }}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="top-summary-panel-actions">
              <span className="panel-btn" onClick={() => { savedScrollTopRef.current = labelsScrollRef.current?.scrollTop || 0; setPanelSelected([...tags]); }}>{t('tags.selectAll')}</span>
              <span className="panel-btn" onClick={() => { savedScrollTopRef.current = labelsScrollRef.current?.scrollTop || 0; setPanelSelected([]); }}>{t('tags.deselectAll')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
