# Gyazo Fast

A lightweight GJS script that captures a screenshot via the XDG Desktop Portal and uploads it to a Gyazo-compatible server.

## Features

- Screenshot capture using XDG Desktop Portal (Wayland-native)
- Upload to self-hosted or official Gyazo server
- Auto-copy uploaded URL to clipboard (`wl-copy`)
- Desktop notification on success
- Opens the uploaded image in your default browser

## Requirements

- **GNOME 42+** (GJS 1.72+)
- **libsoup 3.0** — `gir1.2-soup-3.0` (Debian/Ubuntu) or `libsoup3` (Fedora/Arch)
- **wl-copy** — from `wl-clipboard` package (Wayland) **or** **xclip** (X11)
- **notify-send** — from `libnotify` package

## Configuration

Create a config file at `~/.gyazo.config.yml`:

```yaml
host: gyazo.example.com
cgi: /api/upload-image
http_port: 443
use_ssl: yes
mark_important: yes
save_screenshot: yes
screenshot_dir: ~/Pictures/Screenshots
```

| Key              | Description                          | Example                |
|------------------|--------------------------------------|------------------------|
| `host`           | Gyazo server hostname                | `gyazo.example.com`    |
| `cgi`            | Upload API endpoint path             | `/api/upload-image`    |
| `http_port`      | Server port (omit for default)       | `443`                  |
| `use_ssl`        | Use HTTPS (`yes` / `no`)             | `yes`                  |
| `mark_important` | Mark uploads as important (`yes` / `no`) | `yes`              |
| `save_screenshot`| Save screenshot locally (`yes` / `no`)   | `yes`              |
| `screenshot_dir` | Local save directory (default: XDG portal default path) | `~/Pictures/Screenshots` |

## Usage

```bash
gjs gyazo-fast.js
```

Or make it executable:

```bash
chmod +x gyazo-fast.js
./gyazo-fast.js
```

## How It Works

1. Opens the GNOME screenshot portal (interactive mode)
2. User selects area / window / full screen
3. Captured image is uploaded to the configured Gyazo server via multipart POST
4. The returned URL is copied to clipboard, shown in a notification, and opened in the default browser

## Keyboard Shortcut

### GNOME (Settings UI)

1. Open **Settings → Keyboard → Custom Shortcuts**
2. Click **Add Shortcut**
3. Set:
   - **Name:** Gyazo Screenshot
   - **Command:** `gjs /full/path/to/gyazo-fast.js`
   - **Shortcut:** e.g. `Super+Shift+S`

### GNOME (CLI)

```bash
# Find the next available custom shortcut slot
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings \
  "['/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/']"

gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/ \
  name 'Gyazo Screenshot'

gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/ \
  command 'gjs /full/path/to/gyazo-fast.js'

gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/ \
  binding '<Super><Shift>s'
```

## License

MIT
