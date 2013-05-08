// Copyright (C) 2012 Stéphane Démurget <stephane.demurget@free.fr>

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// Author: Stéphane Démurget <stephane.demurget@free.fr>

const Lang = imports.lang;

const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Vte = imports.gi.Vte;

const Convenience = imports.convenience;


// dbus interface
const DropDownTerminalIface =
    <interface name="org.zzrough.GsExtensions.DropDownTerminal">
        <property name="Pid" type="i" access="read"/>
        <method name="SetGeometry">
		    <arg name="x" type="i" direction="in"/>
		    <arg name="y" type="i" direction="in"/>
		    <arg name="width" type="i" direction="in"/>
		    <arg name="height" type="i" direction="in"/>
    	</method>
        <method name="Toggle"/>
        <method name="Focus"/>
        <method name="Quit"/>
        <signal name="Failure">
            <arg type="s" name="name"/>
            <arg type="s" name="cause"/>
        </signal>
    </interface>;


// uimanager popup information
const PopupUi =
    <ui>
        <popup name="TerminalPopup">
            <menuitem action="Copy"/>
            <menuitem action="Paste"/>
        </popup>
    </ui>.toXMLString();



// helper function that simply calls #parse on a new Gdk.RGBA instance
// to easily create an Gdk.RGBA color
function parseRgbaColor(spec) { let col = new Gdk.RGBA(); col.parse(spec); return col; }


// constants for the location of the extension
const EXTENSION_ID = "drop-down-terminal";
const EXTENSION_UUID = EXTENSION_ID + "@gs-extensions.zzrough.org";
const EXTENSION_PATH = ARGV[0] || GLib.get_home_dir() + "/.local/share/gnome-shell/extensions/" + EXTENSION_UUID;


// constants for the settings
const FONT_NAME_SETTING_KEY = "monospace-font-name";
const TRANSPARENCY_LEVEL_SETTING_KEY = "transparency-level";
const TRANSPARENT_TERMINAL_SETTING_KEY = "transparent-terminal";
const SCROLLBAR_VISIBLE_SETTING_KEY = "scrollbar-visible";
const RUN_CUSTOM_COMMAND_SETTING_KEY = "run-custom-command";
const CUSTOM_COMMAND_SETTING_KEY = "custom-command";


// constants borrowed from gnome-terminal
const ForegroundColor = parseRgbaColor("#aaaaaaaaaaaa");
const BackgroundColor = parseRgbaColor("#000000000000");

const TangoPalette = [
    parseRgbaColor("#000000000000"),
    parseRgbaColor("#cccc00000000"),
    parseRgbaColor("#4e4e9a9a0606"),
    parseRgbaColor("#c4c4a0a00000"),
    parseRgbaColor("#34346565a4a4"),
    parseRgbaColor("#757550507b7b"),
    parseRgbaColor("#060698209a9a"),
    parseRgbaColor("#d3d3d7d7cfcf"),
    parseRgbaColor("#555557575353"),
    parseRgbaColor("#efef29292929"),
    parseRgbaColor("#8a8ae2e23434"),
    parseRgbaColor("#fcfce9e94f4f"),
    parseRgbaColor("#72729f9fcfcf"),
    parseRgbaColor("#adad7f7fa8a8"),
    parseRgbaColor("#3434e2e2e2e2"),
    parseRgbaColor("#eeeeeeeeecec")
];

const UserCharsPattern = "-[:alnum:]";
const UserCharsClassPattern = "[" + UserCharsPattern + "]";
const PassCharsClassPattern = "[-[:alnum:]\\Q,?;.:/!%$^*&~\"#'\\E]";
const HostCharsClassPattern = "[-[:alnum:]]";
const HostPattern = HostCharsClassPattern + "+(\\." + HostCharsClassPattern + "+)*";
const PortPattern = "(?:\\:[[:digit:]]{1,5})?";
const PathCharsClassPattern = "[-[:alnum:]\\Q_$.+!*,;@&=?/~#%\\E]";
const PathTermClassPattern = "[^\\Q]'.}>) \t\r\n,\"\\E]";
const SchemePattern = "(?:news:|telnet:|nntp:|file:\\/|https?:|ftps?:|sftp:|webcal:)";
const UserPassPattern = UserCharsClassPattern + "+(?:" + PassCharsClassPattern + "+)?";
const UrlPathPattern = "(?:(/" + UserCharsClassPattern + "+(?:[(]"
                               + UserCharsClassPattern + "*[)])*"
                               + UserCharsClassPattern + "*)*" + PathTermClassPattern + ")?";

const UriFlavor = {
    AsIs: 0,
    DefaultToHttp: 1,
    VoipCall: 2,
    Email: 3
};

const UriHandlingProperties = [
    { pattern: SchemePattern + "//(?:" + UserPassPattern + "\\@)?" + HostPattern + PortPattern + UrlPathPattern, flavor: UriFlavor.AsIs },
    { pattern: "(?:www|ftp)" + HostCharsClassPattern + "*\\." + HostPattern + PortPattern + UrlPathPattern, flavor: UriFlavor.DefaultToHttp },
    { pattern: "(?:callto:|h323:|sip:)" + UserCharsClassPattern + "[" + UserCharsPattern + ".]*(?:" + PortPattern + "/[a-z0-9]+)?\\@" + HostPattern, flavor: UriFlavor.VoipCall },
    { pattern: "(?:mailto:)?" + UserCharsClassPattern + "[" + UserCharsPattern + ".]*\\@" + HostCharsClassPattern + "+\\." + HostPattern, flavor: UriFlavor.EMail },
    { pattern: "(?:news:|man:|info:)[[:alnum:]\\Q^_{|}~!\"#$%&'()*+,./;:=?`\\E]+", flavor: UriFlavor.AsIs }
];


// terminal class
const DropDownTerminal = new Lang.Class({
    Name: "DropDownTerminal",

    _init: function() {
        // initializes the state
        this._customCommandArgs = [];
        this._lastForkFailed = false;
        this._visible = false;

        // loads the custom CSS to mimick the shell style
        let provider = new Gtk.CssProvider();
        provider.load_from_file(Gio.File.new_for_path(EXTENSION_PATH + "/gtk.css"));
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

        // creates the widgets and lays them out
        this._actionGroup = new Gtk.ActionGroup({name: "Main"});
        this._terminal = this._createTerminal();
        this._terminalBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        this._terminalScrollbar = new Gtk.Scrollbar({ orientation: Gtk.Orientation.VERTICAL,
                                                      adjustment: this._terminal.get_vadjustment() });
        this._window = this._createWindow();
        this._popup = this._createPopupAndActions(this._window, this._actionGroup);

        this._terminalBox.pack_start(this._terminal, true, true, 0);
        this._terminalBox.pack_end(this._terminalScrollbar, false, false, 0);
        this._window.add(this._terminalBox);

        this._terminal.show();
        this._terminalBox.show();

        // gets the settings
        this._settings = Convenience.getSettings(EXTENSION_PATH, EXTENSION_ID);
        this._interfaceSettings = new Gio.Settings({schema: "org.gnome.desktop.interface"});

        // applies the settings initially
        this._updateFont();
        this._updateOpacityAndScrollbar();
        this._updateCustomCommand();

        // connect to the settings changes
        this._interfaceSettings.connect("changed::" + FONT_NAME_SETTING_KEY, Lang.bind(this, function() {
            Convenience.throttle(200, this, Convenience.gdkRunner(Lang.bind(this, this._updateFont)));
        }));

        this._settings.connect("changed::" + SCROLLBAR_VISIBLE_SETTING_KEY, Lang.bind(this, function() {
            Convenience.runInGdk(Lang.bind(this, this._updateOpacityAndScrollbar));
        }));

        this._settings.connect("changed::" + TRANSPARENCY_LEVEL_SETTING_KEY, Lang.bind(this, function() {
            Convenience.runInGdk(Lang.bind(this, this._updateOpacityAndScrollbar));
        }));

        this._settings.connect("changed::" + TRANSPARENT_TERMINAL_SETTING_KEY, Lang.bind(this, function() {
            Convenience.runInGdk(Lang.bind(this, this._updateOpacityAndScrollbar));
        }));

        this._settings.connect("changed::" + RUN_CUSTOM_COMMAND_SETTING_KEY, Lang.bind(this, this._updateCustomCommand)),
        this._settings.connect("changed::" + CUSTOM_COMMAND_SETTING_KEY, Lang.bind(this, this._updateCustomCommand)),

        // adds the uri matchers
        this._uriHandlingPropertiesbyTag = {};

        UriHandlingProperties.forEach(Lang.bind(this, function(hp) {
            let regex = GLib.Regex.new(hp.pattern, GLib.RegexCompileFlags.CASELESS | GLib.RegexCompileFlags.OPTIMIZE, 0);

            let tag = this._terminal.match_add_gregex(regex, 0);
            this._terminal.match_set_cursor_type(tag, Gdk.CursorType.HAND2);

            this._uriHandlingPropertiesbyTag[tag] = hp;
        }));

        // asks the session bus to own the interface name
        Gio.DBus.session.own_name("org.zzrough.GsExtensions.DropDownTerminal",
            Gio.BusNameOwnerFlags.NONE,
            null,
            null
        );

        // exports the interface
        this._bus = Gio.DBusExportedObject.wrapJSObject(DropDownTerminalIface, this);
        this._bus.export(Gio.DBus.session, "/org/zzrough/GsExtensions/DropDownTerminal");

        // forks the user shell early to detect a potential startup error
        this._forkUserShell();
    },

    get Pid() {
        return Convenience.getPid();
    },

    SetGeometry: function(x, y, width, height) {
        let [currentX, currentY] = this._window.get_position();
        let [currentWidth, currentHeight] = this._window.get_size();

        Convenience.runInGdk(Lang.bind(this, function() {
            if (x != currentX || y != currentY) {
                this._window.move(x, y);
            }

            if (width != currentWidth || height != currentHeight) {
                this._window.resize(width, height);

                if (Convenience.GTK_VERSION >= 30706 && Convenience.GTK_VERSION <= 30800) {
                    this._window.set_size_request(width, height); // workaround for a gtk+ regression (b.g.o #696187)
                }
            }
        }));
    },

    Toggle: function() {
        // update the window visibility in the UI thread since this callback happens in the gdbus thread
        Convenience.runInGdk(Lang.bind(this, function() {
            this._window.visible ? this._window.hide()
                                 : this._window.show();

            return false;
        }));
    },

    Focus: function() {
        // present the window in the UI thread since this callback happens in the gdbus thread
        Convenience.runInGdk(Lang.bind(this, function() {
            if (this._window.visible) {
                let time = 0;

                try {
                    time = GdkX11.x11_get_server_time(this._window.window);
                } catch (e) {
                    log("could not get x11 server time (cause: " + e + ")"); // not using logError as this is more an information than a real error
                }

                this._window.present_with_time(time);
            }
        }));
    },

    Quit: function() {
        Gtk.main_quit();
    },

    _createTerminal: function() {
        let terminal = new Vte.Terminal();

        terminal.set_can_focus(true);
        terminal.set_background_transparent(false);
        terminal.set_allow_bold(true);
        terminal.set_scroll_on_output(true);
        terminal.set_scroll_on_keystroke(true);
        terminal.set_scrollback_lines(8096);
        terminal.set_backspace_binding(Vte.TerminalEraseBinding.ASCII_DELETE);
        terminal.set_delete_binding(Vte.TerminalEraseBinding.DELETE_SEQUENCE);
        terminal.set_word_chars("-A-Za-z0-9_$.+!*(),;:@&=?/~#%");
        terminal.set_encoding("UTF-8");
        terminal.connect("eof", Lang.bind(this, this._forkUserShell));
        terminal.connect("child-exited", Lang.bind(this, this._forkUserShell));
        terminal.connect("button-release-event", Lang.bind(this, this._terminalButtonReleased));
        terminal.connect("refresh-window", Lang.bind(this, this._refreshWindow));

        // FIXME: we get weird colors when we apply tango colors
        //
        // terminal.set_colors_rgba(ForegroundColor, BackgroundColor, TangoPalette, TangoPalette.length);

        return terminal;
    },

    _createWindow: function() {
        let screen = Gdk.Screen.get_default();
        let window = new Gtk.Window({type : Gtk.WindowType.TOPLEVEL});

        window.set_title("Drop Down Terminal");
        window.set_icon_name("utilities-terminal");
        window.set_wmclass("Drop Down Terminal", "DropDownTerminalWindow");
        window.set_decorated(false);
        window.set_skip_taskbar_hint(true);
        window.set_skip_pager_hint(true);
        window.set_resizable(true);
        window.set_keep_above(true);
        window.set_accept_focus(true);
        window.set_deletable(false);
        window.stick();
        window.set_type_hint(Gdk.WindowTypeHint.DROPDOWN_MENU);

        if (Convenience.GTK_VERSION >= 30801) {
            // nothing, the size must be set explicitely using SetGeometry
        } else if (Convenience.GTK_VERSION >= 30706 && Convenience.GTK_VERSION <= 30800) {
            window.set_default_size(-1, -1); // workaround for a gtk+ regression (b.g.o #696187)
            window.set_size_request(screen.get_monitor_geometry(screen.get_primary_monitor()).width, 400); // ditto
        } else {
            window.set_default_size(screen.get_monitor_geometry(screen.get_primary_monitor()).width, 400);
        }

        window.set_visual(screen.get_rgba_visual());
        window.connect("delete-event", function() { window.hide(); return true; });
        window.connect("destroy", Gtk.main_quit);

        return window;
    },

    _createPopupAndActions: function() {
        // get some shortcuts
        let term = this._terminal;
        let group = this._actionGroup;

        // creates the actions and fills the action group
        this._createAction("Copy", "Copy", Gtk.STOCK_COPY, "<shift><control>C", group, Lang.bind(term, term.copy_clipboard));
        this._createAction("Paste", "Paste", Gtk.STOCK_PASTE, "<shift><control>V", group, Lang.bind(term, term.paste_clipboard));

        // creates the UI manager
        let uiManager = new Gtk.UIManager();
        uiManager.add_ui_from_string(PopupUi, PopupUi.length);
        uiManager.insert_action_group(group, 0);

        // hooks the accel group up
        this._window.add_accel_group(uiManager.get_accel_group());

        return uiManager.get_widget("/TerminalPopup");
    },

    _forkUserShell: function() {
        this._terminal.reset(false, true);

        let args = this._getCommandArgs();
        let success, pid;

        try {
            [success, pid] = this._terminal.fork_command_full(Vte.PtyFlags.DEFAULT, GLib.get_home_dir(), args, this._getCommandEnv(),
                                                              GLib.SpawnFlags.SEARCH_PATH, null);
            this._lastForkFailed = false;
        } catch (e) {
            this._lastForkFailed = true;

            let cause = e.name + " - " + e.message;

            this._bus.emit_signal("Failure",
                                   GLib.Variant.new("(ss)", ["ForkUserShellFailed", "Could not start the shell command line '" + args.join(" ") + "'."]));

            throw {
                name: "ForkUserShellFailed",
                message: "Could not start the shell from command line '" + args.join(" ")
                                                                         + "' (cause: " + cause + ")"
            }
        }

        this._terminal.get_pty_object().set_term("xterm");
    },

    _refreshWindow: function() {
        let rect = this._window.window.get_frame_extents();
        this._window.window.invalidate_rect(rect, true);
    },

    _updateFont: function() {
        this._terminal.set_font_from_string(this._interfaceSettings.get_string(FONT_NAME_SETTING_KEY));
    },

    _updateOpacityAndScrollbar: function() {
        let isTransparent = this._settings.get_boolean(TRANSPARENT_TERMINAL_SETTING_KEY);
        let transparencyLevel = this._settings.get_uint(TRANSPARENCY_LEVEL_SETTING_KEY) / 100.0;
        let hasScrollbar = this._settings.get_boolean(SCROLLBAR_VISIBLE_SETTING_KEY);

        this._terminal.set_background_image(null); // required to update the opacity after realize

        if (this._terminalScrollbar.set_opacity) { // 3.7.10+
            // starting from 3.7.10, all gtk widgets can have their opacity changed
            this._terminal.set_opacity((isTransparent ? transparencyLevel : 1.0) * 0xffff);
            this._terminalScrollbar.set_opacity(isTransparent ? transparencyLevel : 1.0);
        } else {
            // making the window transparent also makes the font transparent which make it a bit more difficult
            // to read, but making the terminal transparent prevents the scrollbar from being styled correctly
            //
            // we try to do the best we can by using terminal transparency if there is no scrollbar and falling
            // back to window transparency if there is one
            this._terminal.set_opacity(((isTransparent && !hasScrollbar) ? transparencyLevel : 1.0) * 0xffff);
            this._window.set_opacity((isTransparent && hasScrollbar) ? transparencyLevel : 1.0);
        }

        this._terminalScrollbar.visible = hasScrollbar;
    },

    _updateCustomCommand: function() {
        // get the custom command
        let command;

        if (this._settings.get_boolean(RUN_CUSTOM_COMMAND_SETTING_KEY)) {
            command = this._settings.get_string(CUSTOM_COMMAND_SETTING_KEY).trim();
        } else {
            command = "";
        }

        // parses the command line
        this._customCommandArgs = command ? command.split(/\s+/) : [];

        // tries to fork the shell again if it fails last time (the user might be trying different values,
        // we do not want the terminal to get stuck)
        if (this._lastForkFailed) {
            this._forkUserShell();
        }
    },

    _terminalButtonReleased: function(terminal, event) {
        let [has_state, state] = event.get_state();
        let [is_button, button] = event.get_button();

        // opens hovered link on ctrl+left-click
        if (is_button && button == Gdk.BUTTON_PRIMARY && (state & Gdk.ModifierType.CONTROL_MASK)) {
            let [preserved, x, y] = event.get_coords();

            let border = new Gtk.Border();
            terminal.style_get_property("inner-border", border);

            let column = (x - border.left) / terminal.get_char_width();
            let row = (y - border.top) / terminal.get_char_height();

            let [match, tag] = terminal.match_check(column, row);

            if (match) {
                let properties = this._uriHandlingPropertiesbyTag[tag];
                this._openUri(match, properties.flavor, event.get_screen(), event.get_time());
            }

            return true;
        }

        // opens the popup menu on right click (not using event.triggers_context_menu to avoid eating
        // Shift-F10 for Midnight Commander or an app like that)
        //
        // Note: we do not update the paste sensitivity as this requires API not available (Gdk.Atom and SELECTION_CLIPBOARD)
        //       thus we do not handle copy sensitivity either (this makes more sense and is less code) 
        if (is_button && button == Gdk.BUTTON_SECONDARY) {
            this._popup.popup(null, null, null, button, event.get_time());
            return true;
        }

        return false;
    },

    _openUri: function(uri, flavor, screen, time) {
        if (flavor == UriFlavor.DefaultToHttp) {
            uri = "http:" + uri;
        } else if (flavor == UriFlavor.Email && !uri.match(/^mailto:/i)) {
            uri = "mailto:" + uri;
        }

        Gtk.show_uri(screen, uri, time);
    },

    _getCommandArgs: function() {
        // custom command
        if (this._customCommandArgs.length > 0) {
            return this._customCommandArgs;
        }

        // user shell
        try {
            let [parsed, args] = GLib.shell_parse_argv(Vte.get_user_shell());

            if (parsed) {
                return args;
            }
        } catch (e) {
            // nothing: we continue silently as this is totally expected
        }

        // falls back to the classic Bourne shell
        return ["/bin/sh"];
    },

    _getCommandEnv: function() {
        // builds the environment
        let env = {};

        GLib.listenv().forEach(function(name) {
            env[name] = GLib.getenv(name);
        });

        delete env["COLUMNS"];
        delete env["LINES"];
        delete env["GNOME_DESKTOP_ICON"];

        env["COLORTERM"] = "drop-down-terminal";

        // gets an array of key=value pairs
        let envArray = [];

        for (let key in env) {
            envArray.push(key + "=" + (env[key] ? env[key] : ""));
        }

        return envArray;
    },

    _createAction: function(name, label, stockId, accel, actionGroup, callback) {
        let action = new Gtk.Action({name: name, label: label, stock_id: stockId});
        action.connect("activate", callback);
        actionGroup.add_action_with_accel(action, accel);

        return action;
    }
});


// sets a nice program name and initializes gtk
Gtk.init(null, 0);

// sets the setting to prefer a dark theme
Gtk.Settings.get_default()['gtk-application-prefer-dark-theme'] = true;

// creates the terminal
let terminal = new DropDownTerminal();
GLib.set_prgname("drop-down-terminal");

// starts the main loop
Gtk.main();

