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
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const Gtk = imports.gi.Gtk;
const Vte = imports.gi.Vte;


// dbus interface
const DropDownTerminalIface =
    <interface name="org.zzrough.GsExtensions.DropDownTerminal">
        <method name="Toggle"/>
        <method name="Quit"/>
        <signal name="Failure">
            <arg type="s" name="name"/>
            <arg type="s" name="cause"/>
        </signal>
    </interface>;


// helper function that simply calls #parse on a new Gdk.RGBA instance
// to easily create an Gdk.RGBA color
function parseRgbaColor(spec) { col = new Gdk.RGBA(); col.parse(spec); return col; }


// constants for the keybinding
const ToggleTerminalKeybindingId = "toggle-terminal";


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
    Name: 'DropDownTerminal',

    _init: function() {
        // creates the UI
        this._terminal = this._createTerminal();
        this._window = this._createWindow();
        this._window.add(this._terminal);

        // adds the uri matchers
        this._uriHandlingPropertiesbyTag = {};

        UriHandlingProperties.forEach(Lang.bind(this, function(hp) {
            let regex = GLib.Regex.new(hp.pattern, GLib.RegexCompileFlags.CASELESS | GLib.RegexCompileFlags.OPTIMIZE, 0);

            let tag = this._terminal.match_add_gregex(regex, 0);
            this._terminal.match_set_cursor_type(tag, Gdk.CursorType.HAND2);

            this._uriHandlingPropertiesbyTag[tag] = hp;
        }));

        // asks the session bus to own the interface name
        Gio.DBus.session.own_name('org.zzrough.GsExtensions.DropDownTerminal',
            Gio.BusNameOwnerFlags.NONE,
            null,
            null
        );

        // exports the interface
        this._bus = Gio.DBusExportedObject.wrapJSObject(DropDownTerminalIface, this);
        this._bus.export(Gio.DBus.session, "/org/zzrough/GsExtensions/DropDownTerminal");

        // forks the user shell
        this._forkUserShell();

        // initial toggling to show the terminal
        this.Toggle();
    },

    Toggle: function() {
        // update the window visibility in the UI thread since this callback happens in the gdbus thread
        Gdk.threads_add_idle(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, function() {
            if (this._window.visible) {
                this._window.hide();
            } else {
                this._window.show_all();
                this._window.present();
            }

            return false;
        }));
    },

    Quit: function() {
        Gtk.main_quit();
    },

    _createTerminal: function() {
        let terminal = new Vte.Terminal();

        terminal.set_can_focus(true);
        terminal.set_background_transparent(false);
        terminal.set_opacity(0.95 * 0xffff);
        terminal.set_allow_bold(true);
        terminal.set_scroll_on_output(true);
        terminal.set_scroll_on_keystroke(true);
        terminal.set_font_from_string("Monospace 10");
        terminal.set_scrollback_lines(1024);
        terminal.set_backspace_binding(Vte.TerminalEraseBinding.ASCII_DELETE);
        terminal.set_delete_binding(Vte.TerminalEraseBinding.DELETE_SEQUENCE);
        terminal.set_word_chars("-A-Za-z0-9_$.+!*(),;:@&=?/~#%");
        terminal.set_encoding("UTF-8");

        terminal.connect("eof", Lang.bind(this, this._forkUserShell));
        terminal.connect("child-exited", Lang.bind(this, this._forkUserShell));
        terminal.connect("button-press-event", Lang.bind(this, this._terminalButtonPressed));
        terminal.connect("refresh-window", Lang.bind(this, this._refreshWindow));

        // FIXME: we get weird colors when we apply tango colors
        //
        // terminal.set_colors_rgba(ForegroundColor, BackgroundColor, TangoPalette, TangoPalette.length);

        // FIXME: the default (BLOCK) is better but incorrectly shows the terminal being unfocused if:
        //
        //          - the user hover mouse on the terminal when opened (without even clicking it)
        //          - close and reopened it
        //          - the cursor looks like the "unfocused block" (a rectangle not filled up)
        //
        //        It might be a regression from vte3/gtk3 since we configure/use the terminal+window
        //        the same as guake (gtk2) which always draws the focus correctly.
        //
        //        The internal "has_focus" flag of the terminal is not correctly updated, because in this
        //        very case no "focus-[in|out]-event" is emitted.
        //
        //        Certainly related: when cursor blink mode is on and the mouse is hover on the terminal,
        //        blinking stops!
        //
        //        Maybe it is https://bugzilla.gnome.org/show_bug.cgi?id=623406#c5
        //
        //        But it does not seem to impact g-t, so this might be because we hide our own window?
        terminal.set_cursor_shape(Vte.TerminalCursorShape.IBEAM);

        return terminal;
    },

    _createWindow: function() {
        let window = new Gtk.Window({type : Gtk.WindowType.TOPLEVEL});

        window.set_title("Drop Down Terminal");
        window.set_icon_name("utilities-terminal");
        window.set_decorated(false);
        window.set_skip_taskbar_hint(true);
        window.set_skip_pager_hint(true);
        window.set_resizable(false);
        window.set_keep_above(true);
        window.set_accept_focus(true);
        window.set_deletable(false);
        window.stick();
        window.move(0, 27);
        window.set_size_request(Gdk.Screen.get_default().get_width(), 400);
        window.resize(Gdk.Screen.get_default().get_width(), 400);
        window.set_visual(Gdk.Screen.get_default().get_rgba_visual());
        window.set_opacity(0.95);

        window.connect("delete-event", function() { window.hide(); return true; });
        window.connect("destroy", Gtk.main_quit);

        return window;
    },

    _forkUserShell: function() {
        let [parsed, args] = GLib.shell_parse_argv(Vte.get_user_shell());

        if (!parsed) {
            args = ["/bin/bash"];
        }

        this._terminal.reset(false, true);

        var sucess, pid;

        try {
            [success, pid] = this._terminal.fork_command_full(Vte.PtyFlags.DEFAULT, null, args, null, 
                GLib.SpawnFlags.CHILD_INHERITS_STDIN | GLib.SpawnFlags.SEARCH_PATH
                                                     | GLib.SpawnFlags.FILE_AND_ARGV_ZERO,
                null, null, null);
        } catch (e) {
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

    _terminalButtonPressed: function(terminal, event) {
        let [is_button, button] = event.get_button();

        if (is_button && button == 1) { // left button
            let [preserved, x, y] = event.get_coords();

            // FIXME: could not get the inner-border (the gvalue should be a returned value)
            //        to mimick gnome-terminal (term.get_padding is deprecated)
            //
            // let innerBorder = term.style_get_property('inner-border');
            // let paddingTop = (innerBorder ? innerBorder.top : 0);
            // let paddingLeft = (innerBorder ? innerBorder.left : 0);

            let paddingTop = 0;
            let paddingLeft = 0;

            let column = (x - paddingLeft) / terminal.get_char_width();
            let row = (y - paddingTop) / terminal.get_char_height();

            let [match, tag] = terminal.match_check(column, row);

            if (match) {
                let properties = this._uriHandlingPropertiesbyTag[tag];

                self._openUri(event.get_screen(), match, properties.flavor, event.get_time());
            }
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
    }
});


// initializes gtk
Gtk.init(null, 0);

// creates the terminal
terminal = new DropDownTerminal();

// starts the main loop
Gtk.main();

