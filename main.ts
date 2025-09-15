import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { CalendarClient, CalendarEvent, CalendarSettings } from './calendar-auth';

interface ObsToCalendarSettings extends CalendarSettings {
	clientId: string;
	tenantId: string;
	cacheFile: string;
	defaultDuration: number;
	autoDetectDate: boolean;
}

const DEFAULT_SETTINGS: ObsToCalendarSettings = {
	clientId: '22f7857f-57d1-4dee-9a37-febb154d27fc',
	tenantId: 'c7456ad7-22b5-4ab9-8696-facf5875d387',
	cacheFile: 'token_cache.json',
	defaultDuration: 60,
	autoDetectDate: true
};

export default class ObsToCalendarPlugin extends Plugin {
	settings: ObsToCalendarSettings;
	calendarClient: CalendarClient;

	async onload() {
		await this.loadSettings();
		this.calendarClient = new CalendarClient(this.settings);

		// Add command to create meeting from selection or modal
		this.addCommand({
			id: 'create-calendar-meeting',
			name: 'Create calendar meeting',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.createMeetingFromEditor(editor, view);
			}
		});

		// Add command to create meeting with quick input
		this.addCommand({
			id: 'quick-calendar-meeting',
			name: 'Quick calendar meeting',
			callback: () => {
				new MeetingInputModal(this.app, this.calendarClient, this.settings).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new ObsToCalendarSettingTab(this.app, this));

		console.log('Obs to Calendar plugin loaded');
	}

	onunload() {
		console.log('Obs to Calendar plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.calendarClient = new CalendarClient(this.settings);
	}

	private async createMeetingFromEditor(editor: Editor, view: MarkdownView) {
		const selection = editor.getSelection();
		const currentFile = view.file;
		
		if (selection) {
			// Try to parse selection as meeting details
			const meeting = this.parseMeetingFromText(selection, currentFile);
			if (meeting) {
				const success = await this.calendarClient.createMeeting(meeting);
				if (success) {
					// Optionally mark the text as processed
					editor.replaceSelection(selection + ' ✅');
				}
				return;
			}
		}

		// If no valid selection, open modal with auto-detected date
		const autoDate = this.settings.autoDetectDate ? this.extractDateFromFile(currentFile) : undefined;
		new MeetingInputModal(this.app, this.calendarClient, this.settings, autoDate).open();
	}

	private parseMeetingFromText(text: string, file: TFile | null): CalendarEvent | null {
		// Pattern matching for meeting details in text
		const lines = text.split('\n').map(line => line.trim()).filter(line => line);
		
		let title = '';
		let time = '';
		let summary = '';
		let date = '';

		// Try to extract date from current file if possible
		if (file && this.settings.autoDetectDate) {
			date = this.extractDateFromFile(file) || '';
		}

		for (const line of lines) {
			// Look for time patterns (HH:MM, H:MM AM/PM)
			const timeMatch = line.match(/\b(\d{1,2}[:\.]?\d{2})\s*(AM|PM)?\b/i);
			if (timeMatch && !time) {
				time = timeMatch[0];
			}

			// Look for date patterns (YYYY-MM-DD, DD/MM/YYYY, etc.)
			const dateMatch = line.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})\b/);
			if (dateMatch && !date) {
				date = dateMatch[0];
			}

			// First non-time/date line becomes title
			if (!title && !timeMatch && !dateMatch && line.length > 3) {
				title = line;
			} else if (title && line !== title && !timeMatch && !dateMatch) {
				summary += (summary ? ' ' : '') + line;
			}
		}

		if (title && time && date) {
			return { title, date, time, summary };
		}

		return null;
	}

	private extractDateFromFile(file: TFile | null): string | null {
		if (!file) return null;

		// Try to extract date from filename (common daily notes patterns)
		const filename = file.basename;
		
		// YYYY-MM-DD format
		const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
		if (dateMatch) {
			return dateMatch[1];
		}

		// DD-MM-YYYY or DD/MM/YYYY format
		const altDateMatch = filename.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
		if (altDateMatch) {
			return altDateMatch[1];
		}

		// If no date in filename, use today
		return new Date().toISOString().split('T')[0];
	}
}

class MeetingInputModal extends Modal {
	calendarClient: CalendarClient;
	settings: ObsToCalendarSettings;
	autoDate?: string;

	constructor(app: App, calendarClient: CalendarClient, settings: ObsToCalendarSettings, autoDate?: string) {
		super(app);
		this.calendarClient = calendarClient;
		this.settings = settings;
		this.autoDate = autoDate;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Create Calendar Meeting' });

		let title = '';
		let date = this.autoDate || new Date().toISOString().split('T')[0];
		let time = '';
		let summary = '';
		let duration = this.settings.defaultDuration;

		// Title input
		const titleSetting = new Setting(contentEl)
			.setName('Meeting Title')
			.addText(text => {
				text.setPlaceholder('Enter meeting title...')
					.setValue(title)
					.onChange((value) => {
						title = value;
					});
				// Focus the title input
				setTimeout(() => text.inputEl.focus(), 100);
			});

		// Date input
		new Setting(contentEl)
			.setName('Date')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(date)
				.onChange((value) => {
					date = value;
				}));

		// Time input
		new Setting(contentEl)
			.setName('Time')
			.addText(text => text
				.setPlaceholder('HH:MM or H:MM AM/PM')
				.setValue(time)
				.onChange((value) => {
					time = value;
				}));

		// Duration input
		new Setting(contentEl)
			.setName('Duration (minutes)')
			.addText(text => text
				.setPlaceholder('60')
				.setValue(duration.toString())
				.onChange((value) => {
					duration = parseInt(value) || 60;
				}));

		// Summary input
		new Setting(contentEl)
			.setName('Summary (optional)')
			.addTextArea(text => text
				.setPlaceholder('Meeting description...')
				.setValue(summary)
				.onChange((value) => {
					summary = value;
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv('modal-button-container');
		
		const createButton = buttonContainer.createEl('button', {
			text: 'Create Meeting',
			cls: 'mod-cta'
		});
		
		const cancelButton = buttonContainer.createEl('button', {
			text: 'Cancel'
		});

		createButton.addEventListener('click', async () => {
			if (!title.trim()) {
				new Notice('❌ Please enter a meeting title');
				return;
			}
			if (!date.trim()) {
				new Notice('❌ Please enter a date');
				return;
			}
			if (!time.trim()) {
				new Notice('❌ Please enter a time');
				return;
			}

			const meeting: CalendarEvent = {
				title: title.trim(),
				date: date.trim(),
				time: time.trim(),
				summary: summary.trim(),
				duration: duration
			};

			const success = await this.calendarClient.createMeeting(meeting);
			if (success) {
				this.close();
			}
		});

		cancelButton.addEventListener('click', () => {
			this.close();
		});

		// Handle Enter key in title field
		contentEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && e.ctrlKey) {
				createButton.click();
			} else if (e.key === 'Escape') {
				this.close();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ObsToCalendarSettingTab extends PluginSettingTab {
	plugin: ObsToCalendarPlugin;

	constructor(app: App, plugin: ObsToCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Obs to Calendar Settings' });

		new Setting(containerEl)
			.setName('Client ID')
			.setDesc('Azure App Registration Client ID')
			.addText(text => text
				.setPlaceholder('Enter Client ID...')
				.setValue(this.plugin.settings.clientId)
				.onChange(async (value) => {
					this.plugin.settings.clientId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Tenant ID')
			.setDesc('Azure Tenant ID')
			.addText(text => text
				.setPlaceholder('Enter Tenant ID...')
				.setValue(this.plugin.settings.tenantId)
				.onChange(async (value) => {
					this.plugin.settings.tenantId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Duration')
			.setDesc('Default meeting duration in minutes')
			.addText(text => text
				.setPlaceholder('60')
				.setValue(this.plugin.settings.defaultDuration.toString())
				.onChange(async (value) => {
					this.plugin.settings.defaultDuration = parseInt(value) || 60;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-detect Date')
			.setDesc('Automatically detect date from current note filename')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoDetectDate)
				.onChange(async (value) => {
					this.plugin.settings.autoDetectDate = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Usage Instructions' });
		
		const instructions = containerEl.createEl('div');
		instructions.innerHTML = `
			<p><strong>Commands:</strong></p>
			<ul>
				<li><strong>Create calendar meeting</strong> - Parse selected text or open input modal</li>
				<li><strong>Quick calendar meeting</strong> - Open input modal directly</li>
			</ul>
			<p><strong>Text Format (for parsing):</strong></p>
			<pre>Meeting Title
09:00
2025-09-15
Optional meeting description</pre>
			<p><strong>Supported Date Formats:</strong> YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY</p>
			<p><strong>Supported Time Formats:</strong> HH:MM, H:MM AM/PM, HH.MM</p>
		`;
	}
}