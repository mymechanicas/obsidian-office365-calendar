import { ConfidentialClientApplication, PublicClientApplication, AuthenticationResult } from '@azure/msal-node';
import { Notice } from 'obsidian';

export interface CalendarSettings {
	clientId: string;
	tenantId: string;
	cacheFile: string;
}

export class CalendarAuth {
	private app: PublicClientApplication;
	private settings: CalendarSettings;
	private scopes = [
		'https://graph.microsoft.com/Calendars.ReadWrite',
		'https://graph.microsoft.com/User.Read'
	];

	constructor(settings: CalendarSettings) {
		this.settings = settings;
		this.app = new PublicClientApplication({
			auth: {
				clientId: settings.clientId,
				authority: `https://login.microsoftonline.com/${settings.tenantId}`,
			}
		});
	}

	async getAccessToken(): Promise<string | null> {
		try {
			// Try silent authentication first
			const accounts = await this.app.getTokenCache().getAllAccounts();
			if (accounts.length > 0) {
				const silentRequest = {
					account: accounts[0],
					scopes: this.scopes,
				};
				
				try {
					const response = await this.app.acquireTokenSilent(silentRequest);
					return response.accessToken;
				} catch (error) {
					console.log('Silent authentication failed, proceeding with device code flow');
				}
			}

			// Use device code flow for interactive authentication
			return await this.authenticateWithDeviceCode();
		} catch (error) {
			console.error('Authentication error:', error);
			new Notice('❌ Authentication failed: ' + error.message);
			return null;
		}
	}

	private async authenticateWithDeviceCode(): Promise<string | null> {
		try {
			const deviceCodeRequest = {
				scopes: this.scopes,
				deviceCodeCallback: (response: any) => {
					new Notice(`Go to: ${response.verificationUri}\nEnter code: ${response.userCode}`, 15000);
					console.log(`Go to ${response.verificationUri} and enter code: ${response.userCode}`);
				}
			};

			const response = await this.app.acquireTokenByDeviceCode(deviceCodeRequest);
			new Notice('✅ Authentication successful!');
			return response.accessToken;
		} catch (error) {
			console.error('Device code authentication failed:', error);
			new Notice('❌ Authentication failed: ' + error.message);
			return null;
		}
	}
}

export interface CalendarEvent {
	title: string;
	date: string;
	time: string;
	summary?: string;
	duration?: number; // in minutes, default 60
}

export class CalendarClient {
	private auth: CalendarAuth;

	constructor(settings: CalendarSettings) {
		this.auth = new CalendarAuth(settings);
	}

	async createMeeting(event: CalendarEvent): Promise<boolean> {
		const accessToken = await this.auth.getAccessToken();
		if (!accessToken) {
			return false;
		}

		try {
			const meetingDateTime = this.parseDateTime(event.date, event.time);
			if (!meetingDateTime) {
				new Notice('❌ Invalid date/time format');
				return false;
			}

			const endDateTime = new Date(meetingDateTime.getTime() + (event.duration || 60) * 60000);

			// Use local timezone instead of UTC to avoid conversion issues
			const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			
			const eventData = {
				subject: event.title,
				body: {
					contentType: 'Text',
					content: event.summary || `Meeting: ${event.title}`
				},
				start: {
					dateTime: this.formatLocalDateTime(meetingDateTime),
					timeZone: localTimeZone
				},
				end: {
					dateTime: this.formatLocalDateTime(endDateTime),
					timeZone: localTimeZone
				},
				isOnlineMeeting: true
			};

			const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(eventData)
			});

			if (response.ok) {
				const result = await response.json();
				new Notice(`✅ Meeting "${event.title}" created successfully!`);
				return true;
			} else {
				const error = await response.text();
				new Notice(`❌ Failed to create meeting: ${error}`);
				return false;
			}
		} catch (error) {
			console.error('Error creating meeting:', error);
			new Notice('❌ Error creating meeting: ' + error.message);
			return false;
		}
	}

	private formatLocalDateTime(date: Date): string {
		// Format as YYYY-MM-DDTHH:MM:SS (without timezone info)
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		
		return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
	}

	private parseDateTime(dateStr: string, timeStr: string): Date | null {
		try {
			// Parse date (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
			let date: Date;
			if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
				date = new Date(dateStr); // YYYY-MM-DD
			} else {
				// Try other formats
				const dateParts = dateStr.split(/[\/\-\.]/);
				if (dateParts.length === 3) {
					const [day, month, year] = dateParts;
					date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
				} else {
					throw new Error('Invalid date format');
				}
			}

			// Parse time (HH:MM, HH.MM, H:MM AM/PM)
			const timeParts = timeStr.match(/(\d{1,2})[:\.](\d{2})\s*(AM|PM)?/i);
			if (!timeParts) {
				throw new Error('Invalid time format');
			}

			let hours = parseInt(timeParts[1]);
			const minutes = parseInt(timeParts[2]);
			const ampm = timeParts[3];

			if (ampm) {
				if (ampm.toUpperCase() === 'PM' && hours !== 12) {
					hours += 12;
				} else if (ampm.toUpperCase() === 'AM' && hours === 12) {
					hours = 0;
				}
			}

			date.setHours(hours, minutes, 0, 0);
			return date;
		} catch (error) {
			console.error('Date/time parsing error:', error);
			return null;
		}
	}
}