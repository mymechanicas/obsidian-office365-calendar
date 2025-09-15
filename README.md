# Obs to Calendar Plugin

Create Office 365 calendar events directly from your Obsidian notes with a simple hotkey or command.

## Features

- **Hotkey Integration**: Create meetings instantly with Ctrl+P commands
- **Smart Date Detection**: Automatically detects dates from daily note filenames
- **Text Parsing**: Parse meeting details from selected text
- **Multiple Formats**: Supports various date/time formats
- **Device Code Authentication**: Secure Microsoft authentication flow

## Installation

### Development Installation

1. Copy the plugin folder to your Obsidian vault:
   ```bash
   cp -r obsidian-calendar-plugin /path/to/your/vault/.obsidian/plugins/
   ```

2. Install dependencies:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins/obsidian-calendar-plugin
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Enable the plugin in Obsidian Settings > Community Plugins

### Azure Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Create new registration or use existing one
4. Set **"Allow public client flows"** to **Yes** in Authentication settings
5. Add API permissions: `Calendars.ReadWrite` and `User.Read`
6. Copy Client ID and Tenant ID to plugin settings

## Usage

### Commands

- **Create calendar meeting** (Ctrl+P) - Parse selected text or open input modal
- **Quick calendar meeting** (Ctrl+P) - Open input modal directly

### Text Format for Parsing

Select text in this format and run "Create calendar meeting":

```
Team Standup
09:00
2025-09-15
Daily team synchronization meeting
```

### Supported Formats

**Dates:**
- `2025-09-15` (YYYY-MM-DD)
- `15/09/2025` (DD/MM/YYYY)
- `15-09-2025` (DD-MM-YYYY)
- `15.09.2025` (DD.MM.YYYY)

**Times:**
- `09:00` (24-hour)
- `9:00 AM` (12-hour)
- `14:30` (24-hour)
- `2:30 PM` (12-hour)

### Auto Date Detection

When enabled, the plugin automatically detects dates from:
- Daily note filenames (2025-09-15.md)
- Current date as fallback

## Workflow Examples

### Daily Notes Integration

1. Create daily note: `2025-09-15.md`
2. Write meeting details:
   ```
   ## Meetings
   
   Client Call
   10:00
   Discuss project requirements
   ```
3. Select the text and run "Create calendar meeting"
4. Meeting appears in your Office 365 calendar ✅

### Quick Meeting Creation

1. Press Ctrl+P → "Quick calendar meeting"
2. Fill in the modal:
   - Title: "Client Call"
   - Date: 2025-09-15 (auto-filled)
   - Time: 10:00
   - Duration: 60 minutes
   - Summary: "Discuss project requirements"
3. Click "Create Meeting"

## Settings

- **Client ID**: Your Azure app registration client ID
- **Tenant ID**: Your Azure tenant ID
- **Default Duration**: Default meeting length in minutes
- **Auto-detect Date**: Extract date from current note filename

## Authentication

First time usage:
1. Run any command that creates a meeting
2. A notice will show with device code and URL
3. Go to https://microsoft.com/devicelogin
4. Enter the device code
5. Sign in with your Microsoft account
6. Future usage will be automatic

## Development

```bash
# Install dependencies
npm install

# Development build (with watching)
npm run dev

# Production build
npm run build
```

## Troubleshooting

- **Authentication issues**: Ensure "Allow public client flows" is enabled in Azure
- **Permission errors**: Check that Calendars.ReadWrite permission is granted
- **Date parsing**: Use supported date formats (YYYY-MM-DD recommended)
- **Plugin not loading**: Check console for errors, rebuild if necessary