import { App, Notice } from 'obsidian';
import { ConfirmModal } from './ConfirmModal';
import { AssetRepository } from '../../repositories/AssetRepository';
import { Asset } from '../../models/Asset';

// 资产表单弹窗（复用日期/标签弹窗风格）
export class AssetFormModal {
	private app: App;
	private assetRepository: AssetRepository;
	private asset?: Asset;
	private maskEl?: HTMLElement;
	private modalEl?: HTMLElement;
    private onSaved?: () => void;

	constructor(app: App, assetRepository: AssetRepository, asset?: Asset, onSaved?: () => void) {
		this.app = app;
		this.assetRepository = assetRepository;
		this.asset = asset;
        this.onSaved = onSaved;
	}

	open() {
		// 遮罩
		this.maskEl = document.createElement('div');
		this.maskEl.className = 'date-picker-mask';

		// 弹窗容器（复用日期选择器样式并加自定义标识）
		this.modalEl = document.createElement('div');
		this.modalEl.className = 'date-picker-modal asset-form-modal';
		// 注入一次性的横向表单样式，降低整体高度
		this.injectAssetFormStyles();

		const content = document.createElement('div');
		content.className = 'date-picker-content';
		(content.style as any).gap = '0px';

		// 去掉标题显示

		// 表单
		const form = document.createElement('form');
		form.className = 'asset-form asset-form--horizontal';
		form.style.display = 'grid';
		(form.style as any).gridTemplateColumns = '1fr';
		form.style.rowGap = '0px';
		(form.style as any).gap = '0px';

		// —— 表单校验工具 ——
		const ensureErrorEl = (group: HTMLElement): HTMLElement => {
			let err = group.querySelector('.field-error') as HTMLElement | null;
			if (!err) {
				const field = group.querySelector('.form-field') as HTMLElement | null;
				err = document.createElement('div');
				err.className = 'field-error';
				if (field) field.appendChild(err);
				else group.appendChild(err);
			}
			return err;
		};
		const setError = (group: HTMLElement, message: string) => {
			group.classList.add('has-error');
			const input = group.querySelector('input, textarea, select') as HTMLElement | null;
			if (input) (input as any).setAttribute('aria-invalid', 'true');
			ensureErrorEl(group).textContent = message;
		};
		const clearError = (group: HTMLElement) => {
			group.classList.remove('has-error');
			const input = group.querySelector('input, textarea, select') as HTMLElement | null;
			if (input) (input as any).setAttribute('aria-invalid', 'false');
			const err = group.querySelector('.field-error') as HTMLElement | null;
			if (err) err.remove();
		};

		// 名称
		const nameGroup = document.createElement('div');
		nameGroup.className = 'form-group';
		{
			const lbl = this.createLabel('名称');
			lbl.classList.add('label-required');
			nameGroup.appendChild(lbl);
		}
		const nameInput = document.createElement('input');
		nameInput.type = 'text';
		nameInput.placeholder = '资产名称';
		if (this.asset) nameInput.value = this.asset.name;
		{
			const field = document.createElement('div');
			field.className = 'form-field';
			field.appendChild(nameInput);
			nameGroup.appendChild(field);
		}
		this.applyRowLayout(nameGroup);
		form.appendChild(nameGroup);
		const validateName = () => {
			const v = (nameInput.value || '').trim();
			if (!v) { setError(nameGroup, '请填写名称'); return false; }
			clearError(nameGroup); return true;
		};
		nameInput.addEventListener('input', validateName);
		nameInput.addEventListener('blur', validateName);

		// 图标
		const iconGroup = document.createElement('div');
		iconGroup.className = 'form-group';
		iconGroup.appendChild(this.createLabel('图标'));
		const iconInput = document.createElement('input');
		iconInput.type = 'text';
		iconInput.placeholder = '😊请输入一个 Emoji 作为图标';
		if (this.asset) iconInput.value = this.asset.icon; else {
			try {
				const plugin = (this.app as any).plugins?.plugins?.['lac-costset'];
				const fallback = '📦';
				iconInput.value = (plugin && plugin.settings && plugin.settings.defaultIcon) ? plugin.settings.defaultIcon : fallback;
			} catch (_) {
				iconInput.value = '📦';
			}
		}
		const enforceSingleEmoji = () => {
			const first = this.getFirstEmojiGrapheme(iconInput.value || '');
			iconInput.value = first || '';
		};
		iconInput.addEventListener('input', enforceSingleEmoji);
		iconInput.addEventListener('paste', (e) => { setTimeout(enforceSingleEmoji, 0); });
		{
			const field = document.createElement('div');
			field.className = 'form-field';
			field.appendChild(iconInput);
			iconGroup.appendChild(field);
		}
		this.applyRowLayout(iconGroup);
		form.appendChild(iconGroup);

		// 价格
		const priceGroup = document.createElement('div');
		priceGroup.className = 'form-group';
		{
			const lbl = this.createLabel('价格');
			lbl.classList.add('label-required');
			priceGroup.appendChild(lbl);
		}
		const priceInput = document.createElement('input') as HTMLInputElement;
		priceInput.type = 'number';
		priceInput.placeholder = '购入价格（元）';
		priceInput.step = '0.01';
		if (this.asset) priceInput.value = this.asset.price.toString();
		// 与 costsetapp 对齐：输入与失焦时净化为合法数字格式
		const sanitizeNumeric = (el: HTMLInputElement) => {
			el.value = this.sanitizeNumericString(el.value || '');
		};
		const limitTwoDecimals = (el: HTMLInputElement) => {
			el.value = this.clampTwoDecimalsString(el.value || '');
		};
		priceInput.addEventListener('input', () => sanitizeNumeric(priceInput));
		priceInput.addEventListener('blur', () => { sanitizeNumeric(priceInput); limitTwoDecimals(priceInput); });
		{
			const field = document.createElement('div');
			field.className = 'form-field';
			field.appendChild(priceInput);
			priceGroup.appendChild(field);
		}
		this.applyRowLayout(priceGroup);
		form.appendChild(priceGroup);
		const validatePrice = () => {
			const str = (priceInput.value || '').trim();
			const num = this.parseMoney(str);
			if (num === null) { setError(priceGroup, '请填写有效的价格'); return false; }
			clearError(priceGroup); return true;
		};
		priceInput.addEventListener('input', validatePrice);
		priceInput.addEventListener('blur', validatePrice);

		// 开始日期
		const fromGroup = document.createElement('div');
		fromGroup.className = 'form-group';
		{
			const lbl = this.createLabel('购入于');
			lbl.classList.add('label-required');
			fromGroup.appendChild(lbl);
		}
		const fromInput = document.createElement('input') as HTMLInputElement;
		fromInput.type = 'text';
		fromInput.readOnly = true;
		fromInput.placeholder = '购入日期';
		fromInput.value = this.asset ? this.formatDateLocal(this.asset.activeFrom) : '';
		fromInput.addEventListener('click', () => {
			this.openDatePicker(fromInput.value ? new Date(fromInput.value) : (this.asset?.activeFrom || new Date()), (picked) => {
				fromInput.value = this.formatDateLocal(picked);
				clearError(fromGroup);
			});
		});
		{
			const field = document.createElement('div');
			field.className = 'form-field';
			field.appendChild(fromInput);
			fromGroup.appendChild(field);
		}
		this.applyRowLayout(fromGroup);
		form.appendChild(fromGroup);
		const validateFrom = () => {
			if (!fromInput.value) { setError(fromGroup, '请选择购入日期'); return false; }
			clearError(fromGroup); return true;
		};
		fromInput.addEventListener('blur', validateFrom);

		// 结束日期
		const toGroup = document.createElement('div');
		toGroup.className = 'form-group';
		toGroup.appendChild(this.createLabel('到期'));
		const toInput = document.createElement('input') as HTMLInputElement;
		toInput.type = 'text';
		toInput.readOnly = true;
		toInput.placeholder = '(计划)报废/回收/到期时间';
		toInput.value = (this.asset && this.asset.activeTo) ? this.formatDateLocal(this.asset.activeTo) : '';
		let clearBtn: HTMLButtonElement | undefined;
		const updateToClear = () => { if (clearBtn) clearBtn.style.display = toInput.value ? 'inline-flex' : 'none'; };
		toInput.addEventListener('click', () => {
			this.openDatePicker(toInput.value ? new Date(toInput.value) : (this.asset?.activeTo || new Date()), (picked) => {
				toInput.value = this.formatDateLocal(picked);
				updateToClear();
				// 校验区间
				if (fromInput.value) {
					const fd = new Date(fromInput.value);
					const td = new Date(toInput.value);
					if (td.getTime() < fd.getTime()) setError(toGroup, '到期日期需不早于购入日期'); else clearError(toGroup);
				}
			});
		});
		{
			const field = document.createElement('div');
			field.className = 'form-field';
			const wrap = document.createElement('div');
			wrap.className = 'input-with-clear';
			wrap.appendChild(toInput);
			clearBtn = document.createElement('button');
			clearBtn.type = 'button';
			clearBtn.className = 'input-clear';
			clearBtn.textContent = '×';
			clearBtn.addEventListener('click', (e) => {
				e.preventDefault(); e.stopPropagation();
				toInput.value = '';
				updateToClear();
			});
			wrap.appendChild(clearBtn);
			field.appendChild(wrap);
			toGroup.appendChild(field);
		}
		this.applyRowLayout(toGroup);
		form.appendChild(toGroup);
		// 初始化清除按钮可见性
		updateToClear();

		// 回收价格
		const recycleGroup = document.createElement('div');
		recycleGroup.className = 'form-group';
		recycleGroup.appendChild(this.createLabel('回收价'));
		const recycleInput = document.createElement('input') as HTMLInputElement;
		recycleInput.type = 'number';
		recycleInput.placeholder = '回收价格（元）';
		recycleInput.step = '0.01';
		if (this.asset) recycleInput.value = this.asset.recyclePrice.toString();
		recycleInput.addEventListener('input', () => sanitizeNumeric(recycleInput));
		recycleInput.addEventListener('blur', () => { sanitizeNumeric(recycleInput); limitTwoDecimals(recycleInput); });
		{
			const field = document.createElement('div');
			field.className = 'form-field';
			field.appendChild(recycleInput);
			recycleGroup.appendChild(field);
		}
		this.applyRowLayout(recycleGroup);
		form.appendChild(recycleGroup);


		// 标签（chips + 回车确认）
		const tagsGroup = document.createElement('div');
		tagsGroup.className = 'form-group';
		tagsGroup.appendChild(this.createLabel('标签'));
		let currentTags: string[] = this.asset ? [...(this.asset.tags || [])] : [];
		const tagsWrapper = document.createElement('div');
		tagsWrapper.className = 'tags-input';
		const tagsInput = document.createElement('input') as HTMLInputElement;
		tagsInput.type = 'text';
		tagsInput.placeholder = '输入标签，回车确认';
		tagsWrapper.appendChild(tagsInput);
		{
			const field = document.createElement('div');
			field.className = 'form-field';
			field.appendChild(tagsWrapper);
			tagsGroup.appendChild(field);
		}
		this.applyRowLayout(tagsGroup);
		form.appendChild(tagsGroup);

		const normalize = (t: string) => t.trim();
		const addTag = (raw: string) => {
			const pieces = raw.split(/[，,\s]+/).map(normalize).filter(Boolean);
			pieces.forEach(p => { if (!currentTags.includes(p)) currentTags.push(p); });
			syncChips();
			tagsInput.value = '';
		};
		const removeTag = (value: string) => {
			currentTags = currentTags.filter(t => t !== value);
			syncChips();
		};
		const syncChips = () => {
			Array.from(tagsWrapper.querySelectorAll('.tag-chip')).forEach(el => el.remove());
			currentTags.forEach(tag => {
				const chip = document.createElement('span');
				chip.className = 'tag-chip';
				chip.textContent = tag;
				const rm = document.createElement('button');
				rm.type = 'button';
				rm.className = 'remove';
				rm.textContent = '×';
				rm.addEventListener('click', () => removeTag(tag));
				chip.appendChild(rm);
				tagsWrapper.insertBefore(chip, tagsInput);
			});
		};

		// 初始渲染已存在标签
		syncChips();

		// 输入交互：Enter 或逗号提交；Backspace 删除最后一个
		tagsInput.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
				e.preventDefault();
				if (tagsInput.value.trim()) addTag(tagsInput.value);
			}
			if (e.key === 'Backspace' && !tagsInput.value && currentTags.length > 0) {
				e.preventDefault();
				removeTag(currentTags[currentTags.length - 1]);
			}
		});
		tagsInput.addEventListener('blur', () => {
			if (tagsInput.value.trim()) addTag(tagsInput.value);
		});

		// 操作按钮
		const actions = document.createElement('div');
		actions.className = 'form-actions';
		const cancelBtn = document.createElement('button');
		cancelBtn.type = 'button';
		cancelBtn.textContent = '取消';
		cancelBtn.className = 'form-btn form-btn-secondary';
		const deleteBtn = document.createElement('button');
		deleteBtn.type = 'button';
		deleteBtn.textContent = '删除';
		deleteBtn.className = 'form-btn form-btn-danger';
		const saveBtn = document.createElement('button');
		saveBtn.type = 'submit';
		saveBtn.textContent = '保存';
		saveBtn.className = 'form-btn form-btn-primary';
		actions.appendChild(cancelBtn);
		if (this.asset) actions.appendChild(deleteBtn);
		actions.appendChild(saveBtn);
		form.appendChild(actions);

		content.appendChild(form);
		this.modalEl.appendChild(content);
		this.maskEl.appendChild(this.modalEl);
		document.body.appendChild(this.maskEl);

		// 事件
		const close = () => this.close();
		this.maskEl.addEventListener('click', (e) => { if (e.target === this.maskEl) close(); });
		cancelBtn.addEventListener('click', close);
		if (this.asset) {
			deleteBtn.addEventListener('click', async () => {
				if (!this.asset) return;
				const ok = await new ConfirmModal(`确定要删除资产 "${this.asset.name}" 吗？`, '删除', '取消', true).open();
				if (!ok) return;
				await this.assetRepository.deleteAsset(this.asset.id);
				if (this.onSaved) this.onSaved();
				close();
			});
		}
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			// 清理过往错误
			clearError(nameGroup); clearError(priceGroup); clearError(fromGroup); clearError(toGroup); clearError(recycleGroup);
			// 基础必填与格式校验
			const nameVal = (nameInput.value || '').trim();
			const priceStr = (priceInput.value || '').trim();
			const priceNum = this.parseMoney(priceStr);
			let valid = true;
			if (!nameVal) { setError(nameGroup, '请填写名称'); valid = false; }
			if (priceNum === null) { setError(priceGroup, '请填写有效的价格'); valid = false; }
			if (!fromInput.value) { setError(fromGroup, '请选择购入日期'); valid = false; }
			if (!valid) {
				const firstErr = [nameGroup, priceGroup, fromGroup].find(g => g.classList.contains('has-error')) as HTMLElement | undefined;
				if (firstErr) {
					(firstErr.querySelector('input') as HTMLInputElement | null)?.focus();
					firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
				return;
			}
			const fromDate = new Date(fromInput.value);
			const priceValue = priceNum as number;
			let toDate: Date | undefined = undefined;
			if (toInput.value) {
				const d = new Date(toInput.value);
				if (d.getTime() < fromDate.getTime()) { setError(toGroup, '到期日期需不早于购入日期'); (toGroup.querySelector('input') as HTMLInputElement | null)?.focus(); return; }
				toDate = d;
			}
			const recycleStr = (recycleInput.value || '').trim();
			const recycleNum = recycleStr ? this.parseMoney(recycleStr) : 0;
			if (recycleStr && recycleNum === null) { setError(recycleGroup, '回收价格格式不正确'); return; }
			if ((recycleNum || 0) > priceValue) { setError(recycleGroup, '回收价不能大于价格'); return; }

			const assetData = {
				id: this.asset?.id || nameVal,
				name: nameVal,
				icon: iconInput.value || '📦',
				price: priceValue,
				activeFrom: fromDate,
				activeTo: toDate,
				recyclePrice: recycleNum || 0,
				tags: currentTags
			};
			try {
				const asset = new Asset(assetData);
				await this.assetRepository.saveAsset(asset);
				if (this.onSaved) this.onSaved();
				close();
			} catch (error: any) {
				new Notice('保存失败: ' + error.message);
			}
		});
	}

	private injectAssetFormStyles() {
		const STYLE_ID = 'asset-form-inline-styles';
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			/* 到期输入清除按钮 */
			.date-picker-modal.asset-form-modal .input-with-clear { position: relative; }
			.date-picker-modal.asset-form-modal .input-with-clear .input-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 14px; line-height: 18px; }
			/* 弹窗容器更紧凑 */
			.date-picker-modal.asset-form-modal { max-height: 80vh; overflow: auto; }
			.date-picker-modal.asset-form-modal .date-picker-content { padding: 16px 20px; display: flex; flex-direction: column; gap: 0 !important; }
			.date-picker-modal.asset-form-modal .date-picker-title { font-size: 14px; margin-bottom: 6px; }

			/* 横向表单布局，压缩垂直空白 */
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal { font-size: 15.5px; display: grid !important; grid-template-columns: 1fr; row-gap: 8px !important; column-gap: 0 !important; gap: 8px !important; }
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal .form-group { display: grid !important; grid-template-columns: 64px 1fr; align-items: center; column-gap: 8px; row-gap: 0; margin: 0 !important; padding: 0 !important; }
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal label { min-width: 64px; margin: 0; text-align: right; justify-self: end; }
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal .form-field { width: 100%; margin: 0 !important; padding: 0 !important; }
			/* 压缩输入控件高度与内边距 */
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal input[type="text"],
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal input[type="number"] { height: 32px; padding: 4px 10px; font-size: 15.5px; line-height: 1.45; }
			/* 标签输入与 chip 更紧凑 */
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal .tags-input { display: flex; flex-wrap: wrap; gap: 4px; }
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal .tag-chip { font-size: 12px; height: 18px; line-height: 18px; padding: 0 6px; border-radius: 4px; }
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal .tag-chip .remove { width: 16px; height: 16px; line-height: 16px; font-size: 12px; margin-left: 4px; }
			.date-picker-modal.asset-form-modal .asset-form.asset-form--horizontal .tags-input input { flex: 1; min-width: 120px; height: 28px; padding: 4px 10px; font-size: 14.5px; }

			/* 必填与错误样式 */
			.date-picker-modal.asset-form-modal .label-required::after { content: ' *'; color: #ff4d4f; margin-left: 2px; }
			.date-picker-modal.asset-form-modal .form-group.has-error input[type="text"],
			.date-picker-modal.asset-form-modal .form-group.has-error input[type="number"] { border-color: #ff4d4f !important; box-shadow: 0 0 0 1px #ff4d4f inset; }
			.date-picker-modal.asset-form-modal .field-error { margin-top: 4px; color: #ff8587; font-size: 12px; line-height: 1.3; }
			.date-picker-modal.asset-form-modal .field-error:empty { display: none; margin-top: 0; }

			/* 操作按钮区更紧凑 */
			.date-picker-modal.asset-form-modal .form-actions { margin-top: 12px; gap: 16px; display: flex; justify-content: center; }
			.date-picker-modal.asset-form-modal .form-btn { height: 34px; padding: 0 14px; font-size: 14px; }
		`;
		document.head.appendChild(style);
	}

	private applyRowLayout(group: HTMLElement) {
		group.style.display = 'grid';
		(group.style as any).gridTemplateColumns = '72px 1fr';
		group.style.alignItems = 'center';
		group.style.columnGap = '8px';
		group.style.rowGap = '0px';
		group.style.margin = '0';
		const label = group.querySelector('label') as HTMLElement | null;
		if (label) {
			label.style.minWidth = '72px';
			label.style.display = 'inline-block';
			label.style.margin = '0';
		}
		const field = group.querySelector('.form-field') as HTMLElement | null;
		if (field) {
			field.style.width = '100%';
		}
	}

	close() {
		if (this.maskEl && this.maskEl.parentElement) {
			this.maskEl.parentElement.removeChild(this.maskEl);
		}
		this.maskEl = undefined;
		this.modalEl = undefined;
	}

	private formatDateLocal(date: Date): string {
		const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
		return d.toISOString().split('T')[0];
	}

	// —— 金额字符串处理（成熟逻辑）——
	private sanitizeNumericString(value: string): string {
		let v = (value || '').replace(/[^\d.]/g, ''); // 仅数字和点
		v = v.replace(/^\./, ''); // 去除开头的点
		v = v.replace(/\.(?=.*\.)/g, ''); // 只保留一个点
		return v;
	}

	private clampTwoDecimalsString(value: string): string {
		const m = (value || '').match(/^(\d+)(?:\.(\d*))?$/);
		if (!m) return '';
		const intPart = m[1];
		const decPart = (m[2] || '').slice(0, 2);
		return decPart ? `${intPart}.${decPart}` : intPart;
	}

	private parseMoney(value: string): number | null {
		const sanitized = this.sanitizeNumericString(value);
		const clamped = this.clampTwoDecimalsString(sanitized);
		if (clamped === '') return null;
		const num = Number(clamped);
		return Number.isFinite(num) && num >= 0 ? num : null;
	}

	// 与 costsetapp 对齐：用 surrogate pair 匹配获取第一个 emoji
	private getFirstEmojiGrapheme(input: string): string {
		const emojiRegex = /[\uD800-\uDBFF][\uDC00-\uDFFF]/; // costsetapp 同款实现
		const m = (input || '').match(emojiRegex);
		return m ? m[0] : '';
	}

	// 弹出日期选择器（复用日期/标签弹窗风格）
	private openDatePicker(currentDate: Date, onConfirm: (picked: Date) => void) {
		// 创建遮罩层
		const mask = document.createElement('div');
		mask.className = 'date-picker-mask';

		// 创建日期选择器弹窗
		const picker = document.createElement('div');
		picker.className = 'date-picker-modal';

		// 创建日期选择器内容
		const content = document.createElement('div');
		content.className = 'date-picker-content';

		// 标题
		const title = document.createElement('div');
		title.className = 'date-picker-title';
		title.textContent = '选择日期';

		// 三列滚轮
		const wheelContainer = document.createElement('div');
		wheelContainer.className = 'date-wheel-container';

		const currentYear = currentDate.getFullYear();
		const currentMonth = currentDate.getMonth() + 1;
		const currentDay = currentDate.getDate();

		const yearColumn = this.createWheelColumn('年', this.generateYears(currentYear), currentYear, (year) => {
			this.updateDaysColumn(dayColumn, year, monthColumn.selectedValue);
		}, false);
		const monthColumn = this.createWheelColumn('月', this.generateMonths(), currentMonth, (month) => {
			this.updateDaysColumn(dayColumn, yearColumn.selectedValue, month);
		}, true);
		const dayColumn = this.createWheelColumn('日', this.generateDays(currentYear, currentMonth), currentDay, undefined, true);

		wheelContainer.appendChild(yearColumn.element);
		wheelContainer.appendChild(monthColumn.element);
		wheelContainer.appendChild(dayColumn.element);

		// 按钮
		const actions = document.createElement('div');
		actions.className = 'date-picker-actions';
		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'date-picker-btn date-picker-btn-cancel';
		cancelBtn.textContent = '取消';
		const confirmBtn = document.createElement('button');
		confirmBtn.className = 'date-picker-btn date-picker-btn-confirm';
		confirmBtn.textContent = '确定';

		actions.appendChild(cancelBtn);
		actions.appendChild(confirmBtn);
		content.appendChild(title);
		content.appendChild(wheelContainer);
		content.appendChild(actions);
		picker.appendChild(content);
		mask.appendChild(picker);
		document.body.appendChild(mask);

		const closePicker = () => { document.body.removeChild(mask); };
		mask.addEventListener('click', (e) => { if (e.target === mask) closePicker(); });
		cancelBtn.addEventListener('click', closePicker);
		confirmBtn.addEventListener('click', () => {
			const year = yearColumn.selectedValue;
			const month = monthColumn.selectedValue;
			const day = dayColumn.selectedValue;
			const picked = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
			onConfirm(picked);
			closePicker();
		});
	}

	private generateYears(currentYear: number): number[] {
		const minYear = 1900;
		const nowYear = new Date().getFullYear();
		const maxYear = nowYear + 7;
		const years: number[] = [];
		for (let i = minYear; i <= maxYear; i++) years.push(i);
		return years;
	}

	private generateMonths(): number[] {
		return Array.from({ length: 12 }, (_, i) => i + 1);
	}

	private generateDays(year: number, month: number): number[] {
		const daysInMonth = new Date(year, month, 0).getDate();
		return Array.from({ length: daysInMonth }, (_, i) => i + 1);
	}

	private createWheelColumn(suffix: string, values: number[], selectedValue: number, onChange?: (value: number) => void, isInfinite: boolean = false): { element: HTMLElement, selectedValue: number } {
		const column = document.createElement('div');
		column.className = 'date-wheel-column';
		const container = document.createElement('div');
		container.className = 'date-wheel-items';

		let selectedIndex = values.indexOf(selectedValue);
		let currentSelectedValue = selectedValue;
		const api = { element: column, selectedValue: currentSelectedValue };
		const itemHeight = 40;

		if (isInfinite) {
			const repeatCount = 5;
			const totalItems = values.length * repeatCount;
			const middleGroupIndex = 2;
			const initialScrollTop = middleGroupIndex * values.length * itemHeight + selectedIndex * itemHeight;
			for (let repeat = 0; repeat < repeatCount; repeat++) {
				values.forEach((value, index) => {
					const item = document.createElement('div');
					item.className = 'date-wheel-item';
					item.textContent = `${value.toString().padStart(2, '0')}${suffix}`;
					item.dataset.value = value.toString();
					item.dataset.index = (repeat * values.length + index).toString();
					item.dataset.realValue = value.toString();
					container.appendChild(item);
				});
			}
			container.style.height = `${totalItems * itemHeight}px`;
			const initialItemIndex = middleGroupIndex * values.length + selectedIndex;
			const items = Array.from(container.querySelectorAll('.date-wheel-item')) as HTMLElement[];
			if (items[initialItemIndex]) {
				items.forEach((el, idx) => el.classList.toggle('selected', idx === initialItemIndex));
			}
			requestAnimationFrame(() => {
				container.scrollTop = initialScrollTop;
			});
			let isScrolling = false;
			container.addEventListener('scroll', () => {
				if (isScrolling) return;
				const scrollTop = container.scrollTop;
				const currentIndex = Math.round(scrollTop / itemHeight);
				const realIndex = ((currentIndex % values.length) + values.length) % values.length;
				const realValue = values[realIndex];
				container.querySelectorAll('.date-wheel-item').forEach((item, index) => {
					const itemRealIndex = index % values.length;
					item.classList.toggle('selected', itemRealIndex === realIndex);
				});
				selectedIndex = realIndex;
				currentSelectedValue = realValue;
				(api as any).selectedValue = realValue;
				if (onChange) onChange(currentSelectedValue);
				const maxScrollTop = (repeatCount - 1) * values.length * itemHeight;
				if (scrollTop >= maxScrollTop) {
					isScrolling = true;
					const offset = scrollTop - maxScrollTop;
					container.scrollTop = values.length * itemHeight + offset;
					setTimeout(() => { isScrolling = false; }, 50);
				} else if (scrollTop <= 0) {
					isScrolling = true;
					const offset = scrollTop;
					container.scrollTop = (repeatCount - 2) * values.length * itemHeight + offset;
					setTimeout(() => { isScrolling = false; }, 50);
				}
			});

			// 允许直接点击选择
			container.addEventListener('click', (ev) => {
				const target = ev.target as HTMLElement;
				const itemEl = target && target.closest ? (target.closest('.date-wheel-item') as HTMLElement | null) : null;
				if (!itemEl) return;
				const clickedIndex = Number(itemEl.dataset.index || '0');
				const realIndex = ((clickedIndex % values.length) + values.length) % values.length;
				const middleIndex = middleGroupIndex * values.length + realIndex;
				container.scrollTop = middleIndex * itemHeight;
				selectedIndex = realIndex;
				currentSelectedValue = values[realIndex];
				(api as any).selectedValue = currentSelectedValue;
				if (onChange) onChange(currentSelectedValue);
			});
		} else {
			values.forEach((value, index) => {
				const item = document.createElement('div');
				item.className = 'date-wheel-item';
				item.textContent = `${value.toString().padStart(2, '0')}${suffix}`;
				item.dataset.value = value.toString();
				item.dataset.index = index.toString();
				if (value === currentSelectedValue) item.classList.add('selected');
				container.appendChild(item);
			});
			container.addEventListener('scroll', () => {
				const scrollTop = container.scrollTop;
				const newIndex = Math.round(scrollTop / itemHeight);
				if (newIndex !== selectedIndex && newIndex >= 0 && newIndex < values.length) {
					container.querySelectorAll('.date-wheel-item').forEach((item, index) => {
						item.classList.toggle('selected', index === newIndex);
					});
					selectedIndex = newIndex;
					currentSelectedValue = values[newIndex];
					(api as any).selectedValue = currentSelectedValue;
					if (onChange) onChange(currentSelectedValue);
				}
			});
			// 允许直接点击选择
			container.addEventListener('click', (ev) => {
				const target = ev.target as HTMLElement;
				const itemEl = target && target.closest ? (target.closest('.date-wheel-item') as HTMLElement | null) : null;
				if (!itemEl) return;
				const idx = Number(itemEl.dataset.index || '0');
				// 立即更新选中样式
				container.querySelectorAll('.date-wheel-item').forEach((el, i) => {
					el.classList.toggle('selected', i === idx);
				});
				container.scrollTop = idx * itemHeight;
				selectedIndex = idx;
				currentSelectedValue = values[idx];
				(api as any).selectedValue = currentSelectedValue;
				if (onChange) onChange(currentSelectedValue);
			});
			setTimeout(() => { container.scrollTop = selectedIndex * itemHeight; }, 0);
		}

		column.appendChild(container);
		return api as any;
	}

	private updateDaysColumn(dayColumn: { element: HTMLElement, selectedValue: number }, year: number, month: number): void {
		const container = dayColumn.element.querySelector('.date-wheel-items') as HTMLElement;
		const currentDay = dayColumn.selectedValue;
		const newDays = this.generateDays(year, month);
		container.innerHTML = '';
		const repeatCount = 5;
		const itemHeight = 40;
		const middleGroupIndex = 2;
		const maxDay = Math.max(...newDays);
		const selectedDay = Math.min(currentDay, maxDay);
		const selectedIndex = newDays.indexOf(selectedDay);
		for (let repeat = 0; repeat < repeatCount; repeat++) {
			newDays.forEach((day, index) => {
				const item = document.createElement('div');
				item.className = 'date-wheel-item';
				item.textContent = `${day.toString().padStart(2, '0')}日`;
				item.dataset.value = day.toString();
				item.dataset.index = (repeat * newDays.length + index).toString();
				item.dataset.realValue = day.toString();
				container.appendChild(item);
			});
		}
		container.style.height = `${newDays.length * repeatCount * itemHeight}px`;
		const initialItemIndexDay = middleGroupIndex * newDays.length + selectedIndex;
		const dayItems = Array.from(container.querySelectorAll('.date-wheel-item')) as HTMLElement[];
		if (dayItems[initialItemIndexDay]) {
			dayItems.forEach((el, idx) => el.classList.toggle('selected', idx === initialItemIndexDay));
		}
		requestAnimationFrame(() => { container.scrollTop = middleGroupIndex * newDays.length * itemHeight + selectedIndex * itemHeight; });
		let isScrolling = false;
		container.addEventListener('scroll', () => {
			if (isScrolling) return;
			const scrollTop = container.scrollTop;
			const currentIndex = Math.round(scrollTop / itemHeight);
			const realIndex = currentIndex % newDays.length;
			const realValue = newDays[realIndex];
			container.querySelectorAll('.date-wheel-item').forEach((item, index) => {
				const itemRealIndex = index % newDays.length;
				item.classList.toggle('selected', itemRealIndex === realIndex);
			});
			(dayColumn as any).selectedValue = realValue;
			const maxScrollTop = (repeatCount - 1) * newDays.length * itemHeight;
			if (scrollTop >= maxScrollTop) {
				isScrolling = true;
				const offset = scrollTop - maxScrollTop;
				container.scrollTop = newDays.length * itemHeight + offset;
				setTimeout(() => { isScrolling = false; }, 50);
			} else if (scrollTop <= 0) {
				isScrolling = true;
				const offset = scrollTop;
				container.scrollTop = (repeatCount - 2) * newDays.length * itemHeight + offset;
				setTimeout(() => { isScrolling = false; }, 50);
			}
		});

		// 允许直接点击选择某一天
		container.addEventListener('click', (ev) => {
			const target = ev.target as HTMLElement;
			const itemEl = target && target.closest ? (target.closest('.date-wheel-item') as HTMLElement | null) : null;
			if (!itemEl) return;
			const clickedIndex = Number(itemEl.dataset.index || '0');
			const realIndex = clickedIndex % newDays.length;
			const middleIndex = middleGroupIndex * newDays.length + realIndex;
			container.scrollTop = middleIndex * itemHeight;
			(dayColumn as any).selectedValue = newDays[realIndex];
		});
	}
	private createLabel(text: string): HTMLElement {
		const el = document.createElement('label');
		el.textContent = text;
		return el;
	}
}
