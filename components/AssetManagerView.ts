import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AssetRepository } from '../repositories/AssetRepository';
import { AppRoot } from './ui/App';
import { t } from '../i18n';

export class AssetManagerView extends ItemView {
	private assetRepository: AssetRepository;
	private filePath?: string;
	private reactRoot?: Root;

	constructor(leaf: WorkspaceLeaf, assetRepository: AssetRepository, filePath?: string) {
		super(leaf);
		this.assetRepository = assetRepository;
		this.filePath = filePath;
	}

	getViewType(): string { return 'lac-costset-view'; }
	getDisplayText(): string {
		if (this.filePath) {
			const base = this.filePath.split('/').pop() || this.filePath;
			const name = base.replace(/\.md$/i, '');
			return `LaC.CostSet — ${name}`;
		}
		return 'LaC.CostSet';
	}
	getIcon(): string { return 'package'; }

	private showCenteredNotice(msgKey: string, duration = 5000) {
		new Notice(t(msgKey), duration);
	}

	async onOpen() {
		const { containerEl } = this;
		containerEl.empty();
		try {
			const ok = await this.assetRepository.isValidEntry();
			if (!ok) {
				this.showCenteredNotice('notice.invalidEntry');
				try { this.leaf.detach(); } catch (_) {}
				return;
			}
		} catch (_) {
			this.showCenteredNotice('notice.invalidEntry');
			try { this.leaf.detach(); } catch (_) {}
			return;
		}

		const mount = containerEl.createDiv({ cls: 'lac-react-root' });
		this.reactRoot = createRoot(mount);
		this.reactRoot.render(React.createElement(AppRoot, { app: this.app, repository: this.assetRepository, onBack: () => { try { this.leaf.detach(); } catch (_) {} } }));
	}

	async onClose() {
		if (this.reactRoot) {
			this.reactRoot.unmount();
			this.reactRoot = undefined;
		}
		this.containerEl.empty();
	}

	getState(): any { return { filePath: this.filePath }; }

	async setState(state: any): Promise<void> {
        const nextPath = state?.filePath as string | undefined;
        if (nextPath && nextPath !== this.filePath) {
            this.filePath = nextPath;
			const repo = new AssetRepository(this.app, nextPath);
			const ok = await repo.isValidEntry();
			if (!ok) {
				this.showCenteredNotice('notice.invalidEntry');
				try { this.leaf.detach(); } catch (_) {}
				return;
			}
			this.assetRepository = repo;
			if (this.reactRoot) {
				this.reactRoot.render(React.createElement(AppRoot, { app: this.app, repository: this.assetRepository, onBack: () => { try { this.leaf.detach(); } catch (_) {} } }));
			}
		}
	}
}
