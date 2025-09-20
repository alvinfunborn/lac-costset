import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';

export interface TagPanelProps {
  tags: string[];
  selectedTags: string[];
  onTagClick: (tag: string | string[]) => void;
  maxHeight?: string;
}

export const TagPanel: React.FC<TagPanelProps> = ({ tags, selectedTags, onTagClick, maxHeight }) => {
  const [panelVisible, setPanelVisible] = useState<boolean>(false);
  const [panelSelected, setPanelSelected] = useState<string[]>(selectedTags);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const labelsScrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef<number>(0);
  const maxHeightRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);

  // 自定义滚动条状态
  const innerScrollRef = useRef<HTMLDivElement | null>(null);
  const [thumbHeight, setThumbHeight] = useState<number>(0);
  const [thumbTop, setThumbTop] = useState<number>(0);
  const [barVisible, setBarVisible] = useState<boolean>(false);
  const hideTimerRef = useRef<number | null>(null);
  const draggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartScrollTopRef = useRef<number>(0);

  useEffect(() => { setPanelSelected(selectedTags); }, [selectedTags]);

  // 设置maxHeight CSS变量
  useEffect(() => {
    if (maxHeightRef.current && maxHeight) {
      maxHeightRef.current.style.setProperty('--max-height', maxHeight);
    }
  }, [maxHeight]);

  // 设置滚动条thumb CSS变量
  useEffect(() => {
    if (thumbRef.current) {
      thumbRef.current.style.setProperty('--thumb-height', `${thumbHeight}px`);
      thumbRef.current.style.setProperty('--thumb-top', `${thumbTop}px`);
    }
  }, [thumbHeight, thumbTop]);

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

  // 计算自定义滚动条尺寸与位置
  const recalcScrollbar = useCallback(() => {
    const el = innerScrollRef.current;
    if (!el) return;
    const { clientHeight, scrollHeight, scrollTop } = el;
    if (scrollHeight <= clientHeight || clientHeight === 0) {
      setThumbHeight(0);
      setThumbTop(0);
      return;
    }
    const h = Math.max(16, (clientHeight / scrollHeight) * clientHeight);
    const maxTop = clientHeight - h;
    const t = maxTop * (scrollTop / (scrollHeight - clientHeight));
    setThumbHeight(h);
    setThumbTop(t);
  }, []);

  useEffect(() => {
    recalcScrollbar();
    const el = innerScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      recalcScrollbar();
      setBarVisible(true);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => setBarVisible(false), 700);
    };
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    const onResize = () => recalcScrollbar();
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', onResize);
    };
  }, [recalcScrollbar]);

  // 拖拽拇指
  const onThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const el = innerScrollRef.current;
    if (!el) return;
    draggingRef.current = true;
    dragStartYRef.current = e.clientY ?? 0;
    dragStartScrollTopRef.current = el.scrollTop;
    setBarVisible(true);
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const { clientHeight, scrollHeight } = el;
      const startY = dragStartYRef.current || 0;
      const deltaY = ev.clientY - startY;
      const h = Math.max(16, (clientHeight / scrollHeight) * clientHeight);
      const maxTop = clientHeight - h;
      const scrollable = Math.max(scrollHeight - clientHeight, 1);
      const pixelsPerScroll = maxTop / scrollable;
      const startTop = dragStartScrollTopRef.current ?? 0;
      el.scrollTop = startTop + (deltaY / Math.max(pixelsPerScroll, 0.0001));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      hideTimerRef.current = window.setTimeout(() => setBarVisible(false), 500);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setPanelSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const confirmAndClose = useCallback(() => {
    onTagClick(panelSelected);
    setPanelVisible(false);
  }, [onTagClick, panelSelected]);

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        maxHeightRef.current = el;
      }}
      className={`top-summary-labels${maxHeight ? ' with-max-height' : ''}`}
      onClick={(e) => { 
        // 如果点击的是容器本身或者内部的空白区域，则弹出面板
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('labels-scroll-inner')) {
          setPanelSelected(selectedTags); 
          setPanelVisible(true); 
        }
      }}
    >
      <div ref={innerScrollRef} className="labels-scroll-inner">
        {tags.map(tag => (
          <span key={tag}
            className={`top-summary-label${selectedTags.includes(tag) ? ' selected' : ''}`}
            onClick={(ev) => { ev.stopPropagation(); onTagClick(tag); }}>
            {tag}
          </span>
        ))}
      </div>

      {/* 自定义滚动条 */}
      {thumbHeight > 0 && (
        <div className={`labels-scrollbar${barVisible ? ' visible' : ''}`} aria-hidden="true">
          <div
            ref={thumbRef}
            className="labels-scrollbar-thumb"
            onMouseDown={onThumbMouseDown}
          />
        </div>
      )}

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
