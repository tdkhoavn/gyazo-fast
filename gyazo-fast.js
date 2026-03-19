#!/usr/bin/gjs

imports.gi.versions.Soup = '3.0';
const { Gio, GLib, Soup } = imports.gi;

const bus = Gio.DBus.session;
const loop = new GLib.MainLoop(null, false);
const httpSession = new Soup.Session();

// Promisify to enable await
Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

// --- 1. SIMPLE YAML CONFIG READER ---
function loadConfig(path) {
    try {
        let file = Gio.File.new_for_path(path);
        let [success, contents] = file.load_contents(null);
        if (!success) throw new Error("Config file not found.");

        let text = new TextDecoder().decode(contents);
        let config = {};
        
        // Simple key: value line parser
        text.split('\n').forEach(line => {
            let match = line.match(/^\s*(\w+):\s*(.+)$/);
            if (match) {
                let key = match[1];
                let value = match[2].trim();
                // Basic type conversion
                if (value === 'yes' || value === 'true') value = true;
                if (value === 'no' || value === 'false') value = false;
                config[key] = value;
            }
        });
        return config;
    } catch (e) {
        printerr("Config read error: " + e.message);
        return null;
    }
}

// --- 2. FILE PATH HANDLER ---
function getPathFromUri(uri) {
    let [path] = GLib.filename_from_uri(uri);
    return path;
}

// --- 3. UPLOAD LOGIC ---
async function uploadToGyazo(imagePath, config) {
    const protocol = config.use_ssl ? "https" : "http";
    const port = config.http_port ? `:${config.http_port}` : "";
    const uploadUrl = `${protocol}://${config.host}${port}${config.cgi}`;

    print(`🚀 Uploading to: ${uploadUrl}`);

    try {
        let file = Gio.File.new_for_path(imagePath);
        let [success, contents] = file.load_contents(null);
        if (!success) return;

        // 1. Create POST message
        let message = Soup.Message.new('POST', uploadUrl);

        // 2. Build multipart form
        let multipart = new Soup.Multipart(Soup.FORM_MIME_TYPE_MULTIPART);
        
        // Add image data to 'imagedata' field (Gyazo format)
        let bytes = GLib.Bytes.new(contents);
        multipart.append_form_file('imagedata', 'screenshot.png', 'image/png', bytes);
        
        if (config.mark_important) {
            multipart.append_form_string('important', 'true');
        }

        // --- SOUP 3.0 FIX ---
        // In Soup 3, to_message takes message headers and returns body bytes
        let bodyBytes = multipart.to_message(message.request_headers);
        message.set_request_body_from_bytes(null, bodyBytes);
        // -----------------------------

        // 3. Send request
        let result = await httpSession.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
        
        if (message.get_status() === Soup.Status.OK) {
            let responseUrl = new TextDecoder().decode(result.toArray()).trim();
            print("✅ Success: " + responseUrl);

            // Copy to clipboard, notify and open browser
            let sessionType = GLib.getenv('XDG_SESSION_TYPE');
            if (sessionType === 'x11') {
                let xclip = Gio.Subprocess.new(['xclip', '-selection', 'clipboard'], Gio.SubprocessFlags.STDIN_PIPE);
                xclip.get_stdin_pipe().write_bytes(GLib.Bytes.new(new TextEncoder().encode(responseUrl)), null);
                xclip.get_stdin_pipe().close(null);
            } else {
                Gio.Subprocess.new(['wl-copy', responseUrl], Gio.SubprocessFlags.NONE);
            }
            Gio.Subprocess.new(['notify-send', 'Gyazo Uploaded', responseUrl], Gio.SubprocessFlags.NONE);
            Gio.AppInfo.launch_default_for_uri(responseUrl, null);
        } else {
            printerr(`❌ Error ${message.get_status()}: ${message.get_reason_phrase()}`);
        }
    } catch (e) {
        printerr("❌ Upload error: " + e.message);
    }
}

// --- 4. LAUNCH SCREENSHOT PORTAL ---
function main() {
    // Path to your config file
    let configPath = GLib.build_filenamev([GLib.get_home_dir(), '.gyazo.config.yml']);
    let config = loadConfig(configPath);
    if (!config) return;

    let params = GLib.Variant.new('(sa{sv})', ['', { 'interactive': GLib.Variant.new('b', true) }]);

    bus.call('org.freedesktop.portal.Desktop', '/org/freedesktop/portal/desktop',
        'org.freedesktop.portal.Screenshot', 'Screenshot', params, null, 0, -1, null, (conn, res) => {
            
            let result = bus.call_finish(res);
            let [handlePath] = result.deep_unpack();

            bus.signal_subscribe('org.freedesktop.portal.Desktop', 'org.freedesktop.portal.Request',
                'Response', handlePath, null, 0, (c, s, o, i, sig, p) => {
                    
                    let [response, details] = p.deep_unpack();
                    if (response === 0 && details.uri) {
                        let imagePath = getPathFromUri(details.uri.deep_unpack());
                        
                        // Upload first, then handle local file
                        uploadToGyazo(imagePath, config).then(() => {
                            if (config.save_screenshot) {
                                // Move to custom dir if set, otherwise keep portal default
                                if (config.screenshot_dir) {
                                    let saveDir = config.screenshot_dir.replace(/^~/, GLib.get_home_dir());
                                    GLib.mkdir_with_parents(saveDir, 0o755);
                                    let timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                                    let destPath = GLib.build_filenamev([saveDir, `screenshot-${timestamp}.png`]);
                                    let src = Gio.File.new_for_path(imagePath);
                                    let dest = Gio.File.new_for_path(destPath);
                                    src.move(dest, Gio.FileCopyFlags.NONE, null, null);
                                    print(`💾 Saved: ${destPath}`);
                                } else {
                                    print(`💾 Saved: ${imagePath}`);
                                }
                            } else {
                                // Remove the portal's screenshot file
                                Gio.File.new_for_path(imagePath).delete(null);
                            }
                            loop.quit();
                        });
                    } else {
                        printerr('❌ Screenshot cancelled or failed.');
                        loop.quit();
                    }
                }
            );
        }
    );
}

main();
loop.run();