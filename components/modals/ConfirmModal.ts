export class ConfirmModal {
    private maskEl?: HTMLElement;
    private modalEl?: HTMLElement;

    private message: string;
    private confirmText: string;
    private cancelText: string;
    private danger: boolean;

    constructor(message: string, confirmText: string = '确定', cancelText: string = '取消', danger: boolean = false) {
        this.message = message;
        this.confirmText = confirmText;
        this.cancelText = cancelText;
        this.danger = danger;
    }

    open(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.injectStylesOnce();

            this.maskEl = document.createElement('div');
            this.maskEl.className = 'date-picker-mask';

            this.modalEl = document.createElement('div');
            this.modalEl.className = 'date-picker-modal';

            const content = document.createElement('div');
            content.className = 'date-picker-content';

            const title = document.createElement('div');
            title.className = 'date-picker-title';
            title.textContent = '确认操作';

            const msgEl = document.createElement('div');
            msgEl.className = 'confirm-message';
            msgEl.textContent = this.message;

            const actions = document.createElement('div');
            actions.className = 'date-picker-actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'date-picker-btn date-picker-btn-cancel';
            cancelBtn.textContent = this.cancelText;

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'date-picker-btn date-picker-btn-confirm';
            confirmBtn.textContent = this.confirmText;
            if (this.danger) confirmBtn.classList.add('danger');

            actions.appendChild(cancelBtn);
            actions.appendChild(confirmBtn);
            content.appendChild(title);
            content.appendChild(msgEl);
            content.appendChild(actions);
            this.modalEl.appendChild(content);
            this.maskEl.appendChild(this.modalEl);
            document.body.appendChild(this.maskEl);

            const close = (result: boolean) => {
                if (this.maskEl && this.maskEl.parentElement) {
                    this.maskEl.parentElement.removeChild(this.maskEl);
                }
                this.maskEl = undefined;
                this.modalEl = undefined;
                resolve(result);
            };

            this.maskEl.addEventListener('click', (e) => { if (e.target === this.maskEl) close(false); });
            cancelBtn.addEventListener('click', () => close(false));
            confirmBtn.addEventListener('click', () => close(true));
        });
    }

    private injectStylesOnce() {
        const STYLE_ID = 'lac-confirm-modal-styles';
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .date-picker-modal .confirm-message { color: #F5F6FA; line-height: 1.6; padding: 8px 0 16px; }
            .date-picker-modal .date-picker-btn.danger { background: #7a1e1e; color: #fff; }
            .date-picker-modal .date-picker-btn.danger:hover { background: #992525; }
        `;
        document.head.appendChild(style);
    }
}


