function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

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
imports.gi.versions.Gdk = '3.0';
imports.gi.versions.GdkX11 = '3.0';
imports.gi.versions.Gtk = '3.0';
const Pango = imports.gi.Pango;
const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Vte = imports.gi.Vte;
const Convenience = imports.convenience; // dbus interface

const DropDownTerminalXIface = '<node>                                                        \
    <interface name="pro.bigbn.DropDownTerminalX">  \
        <property name="Pid" type="i" access="read"/>             \
        <method name="SetGeometry">                               \
            <arg name="x" type="i" direction="in"/>               \
            <arg name="y" type="i" direction="in"/>               \
            <arg name="width" type="i" direction="in"/>           \
            <arg name="height" type="i" direction="in"/>          \
        </method>                                                 \
        <method name="Toggle"/>                                   \
        <method name="Focus"/>                                    \
        <method name="Quit"/>                                     \
        <signal name="Failure">                                   \
            <arg type="s" name="name"/>                           \
            <arg type="s" name="cause"/>                          \
        </signal>                                                 \
    </interface>                                                  \
    </node>'; // uimanager popup information

const PopupUi = '<ui>                               \
        <popup name="TerminalPopup">   \
            <menuitem action="Copy"/>  \
            <menuitem action="Paste"/> \
            <menuitem action="Close"/> \
        </popup>                       \
    </ui>'; // constants for the location of the extension

const EXTENSION_ID = 'drop-down-terminal-x';
const EXTENSION_UUID = EXTENSION_ID + '@bigbn.pro';
const EXTENSION_PATH = ARGV[0] || GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/' + EXTENSION_UUID; // constants for the settings

const FONT_NAME_SETTING_KEY = 'monospace-font-name';
const TRANSPARENCY_LEVEL_SETTING_KEY = 'transparency-level';
const TRANSPARENT_TERMINAL_SETTING_KEY = 'transparent-terminal';
const SCROLLBAR_VISIBLE_SETTING_KEY = 'scrollbar-visible';
const TERMINAL_CURSOR_SETTING_KEY = 'terminal-cursor';
const COLOR_FOREGROUND_SETTING_KEY = 'foreground-color';
const COLOR_BACKGROUND_SETTING_KEY = 'background-color';
const RUN_CUSTOM_COMMAND_SETTING_KEY = 'run-custom-command';
const CUSTOM_COMMAND_SETTING_KEY = 'custom-command';
const ENABLE_AUDIBLE_BELL_KEY = 'enable-audible-bell';
const ENABLE_TABS_SETTING_KEY = 'enable-tabs'; // gnome desktop wm settings

const WM_PREFERENCES_SCHEMA = 'org.gnome.desktop.wm.preferences';
const WM_FOCUS_MODE_SETTING_KEY = 'focus-mode';
const FOCUS_MODE_CLICK = 'click';
const FOCUS_MODE_MOUSE = 'mouse';
const FOCUS_MODE_SLOPPY = 'sloppy'; // constants borrowed from gnome-terminal

const ForegroundColor = Convenience.parseRgbaColor('#aaaaaaaaaaaa');
const BackgroundColor = Convenience.parseRgbaColor('#000000000000');
const TangoPalette = [Convenience.parseRgbaColor('#000000000000'), Convenience.parseRgbaColor('#cccc00000000'), Convenience.parseRgbaColor('#4e4e9a9a0606'), Convenience.parseRgbaColor('#c4c4a0a00000'), Convenience.parseRgbaColor('#34346565a4a4'), Convenience.parseRgbaColor('#757550507b7b'), Convenience.parseRgbaColor('#060698209a9a'), Convenience.parseRgbaColor('#d3d3d7d7cfcf'), Convenience.parseRgbaColor('#555557575353'), Convenience.parseRgbaColor('#efef29292929'), Convenience.parseRgbaColor('#8a8ae2e23434'), Convenience.parseRgbaColor('#fcfce9e94f4f'), Convenience.parseRgbaColor('#72729f9fcfcf'), Convenience.parseRgbaColor('#adad7f7fa8a8'), Convenience.parseRgbaColor('#3434e2e2e2e2'), Convenience.parseRgbaColor('#eeeeeeeeecec')];
const UserCharsPattern = '-[:alnum:]';
const UserCharsClassPattern = '[' + UserCharsPattern + ']';
const PassCharsClassPattern = "[-[:alnum:]\\Q,?;.:/!%$^*&~\"#'\\E]";
const HostCharsClassPattern = '[-[:alnum:]]';
const HostPattern = HostCharsClassPattern + '+(\\.' + HostCharsClassPattern + '+)*';
const PortPattern = '(?:\\:[[:digit:]]{1,5})?';
const PathCharsClassPattern = '[-[:alnum:]\\Q_$.+!*,;@&=?/~#%\\E]';
const PathTermClassPattern = "[^\\Q]'.}>) \t\r\n,\"\\E]";
const SchemePattern = '(?:news:|telnet:|nntp:|file:\\/|https?:|ftps?:|sftp:|webcal:)';
const UserPassPattern = UserCharsClassPattern + '+(?:' + PassCharsClassPattern + '+)?';
const UrlPathPattern = '(?:(/' + UserCharsClassPattern + '+(?:[(]' + UserCharsClassPattern + '*[)])*' + UserCharsClassPattern + '*)*' + PathTermClassPattern + ')?';
const UriFlavor = {
  AsIs: 0,
  DefaultToHttp: 1,
  VoipCall: 2,
  Email: 3
};
const UriHandlingProperties = [{
  pattern: SchemePattern + '//(?:' + UserPassPattern + '\\@)?' + HostPattern + PortPattern + UrlPathPattern,
  flavor: UriFlavor.AsIs
}, {
  pattern: '(?:www|ftp)' + HostCharsClassPattern + '*\\.' + HostPattern + PortPattern + UrlPathPattern,
  flavor: UriFlavor.DefaultToHttp
}, {
  pattern: '(?:callto:|h323:|sip:)' + UserCharsClassPattern + '[' + UserCharsPattern + '.]*(?:' + PortPattern + '/[a-z0-9]+)?\\@' + HostPattern,
  flavor: UriFlavor.VoipCall
}, {
  pattern: '(?:mailto:)?' + UserCharsClassPattern + '[' + UserCharsPattern + '.]*\\@' + HostCharsClassPattern + '+\\.' + HostPattern,
  flavor: UriFlavor.EMail
}, {
  pattern: "(?:news:|man:|info:)[[:alnum:]\\Q^_{|}~!\"#$%&'()*+,./;:=?`\\E]+",
  flavor: UriFlavor.AsIs
}]; // terminal class

const DropDownTerminalX = new Lang.Class({
  Name: 'DropDownTerminalX',
  tabs: [],
  _init: function () {
    // initializes the state
    this._customCommandArgs = [];
    this._visible = false; // loads the custom CSS to mimick the shell style

    let provider = new Gtk.CssProvider();

    if (Convenience.GTK_VERSION >= 31790) {
      provider.load_from_file(Gio.File.new_for_path(EXTENSION_PATH + '/gtk.css'));
    } else if (Convenience.GTK_VERSION >= 31590) {
      provider.load_from_file(Gio.File.new_for_path(EXTENSION_PATH + '/gtk-3-16.css'));
    } else {
      provider.load_from_file(Gio.File.new_for_path(EXTENSION_PATH + '/gtk-3-14.css'));
    }

    Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    this._window = this._createWindow(); // Tabs shortcuts

    this._window.connect('key-press-event', Lang.bind(this, function (window, event) {
      if (!this._isTabsEnabled) return;
      let defaultMask = Gtk.accelerator_get_default_mod_mask();

      let _event$get_state = event.get_state(),
          _event$get_state2 = _slicedToArray(_event$get_state, 2),
          isModified = _event$get_state2[0],
          mask = _event$get_state2[1];

      let _event$get_keyval = event.get_keyval(),
          _event$get_keyval2 = _slicedToArray(_event$get_keyval, 2),
          isSymbol = _event$get_keyval2[0],
          key = _event$get_keyval2[1];

      if ((defaultMask & mask) === Gdk.ModifierType.CONTROL_MASK + Gdk.ModifierType.SHIFT_MASK) {
        switch (Gdk.keyval_to_upper(key)) {
          case Gdk.KEY_T:
            this.addTab();
            return Gdk.EVENT_STOP;
        }
      }

      if ((defaultMask & mask) === Gdk.ModifierType.MOD1_MASK) {
        switch (key) {
          case Gdk.KEY_Left:
            this.notebook.prev_page();
            return Gdk.EVENT_STOP;

          case Gdk.KEY_Right:
            this.notebook.next_page();
            return Gdk.EVENT_STOP;
        }
      }
    })); // Notebook - is the default gnome tabs widget


    this.notebook = new Gtk.Notebook();
    this.notebook.set_tab_pos(Gtk.PositionType.BOTTOM);
    this.notebook.set_show_border(true);
    this.notebook.set_scrollable(true);
    this.notebook.show();
    let plusButton = new Gtk.Button({
      label: '+'
    });
    plusButton.connect('clicked', Lang.bind(this, this.addTab));
    this.notebook.set_action_widget(plusButton, Gtk.PackType.END);

    this._window.add(this.notebook);

    plusButton.show(); // gets the settings

    this._settings = Convenience.getSettings(EXTENSION_PATH, EXTENSION_ID);
    this._interfaceSettings = new Gio.Settings({
      schema_id: 'org.gnome.desktop.interface'
    });

    this._updateTabsSupport();

    let updateAppearance = Lang.bind(this, function () {
      this._applyToAllTabs(function (tab) {
        Convenience.runInGdk(Lang.bind(this, function () {
          this._updateOpacityAndColors(tab);
        }));
      });
    });
    let updateCommand = Lang.bind(this, function () {
      this._applyToAllTabs(function (tab) {
        this._updateCustomCommand(tab);
      });
    });
    let updateBellSettings = Lang.bind(this, function () {
      this._applyToAllTabs(function (tab) {
        this._updateAudibleIndicator(tab);
      });
    });
    [SCROLLBAR_VISIBLE_SETTING_KEY, TRANSPARENCY_LEVEL_SETTING_KEY, TRANSPARENT_TERMINAL_SETTING_KEY, COLOR_FOREGROUND_SETTING_KEY, COLOR_BACKGROUND_SETTING_KEY].forEach(Lang.bind(this, function (key) {
      this._settings.connect('changed::' + key, updateAppearance);
    }));
    [RUN_CUSTOM_COMMAND_SETTING_KEY, CUSTOM_COMMAND_SETTING_KEY].forEach(Lang.bind(this, function (key) {
      this._settings.connect('changed::' + key, updateCommand);
    }));

    this._settings.connect('changed::' + ENABLE_TABS_SETTING_KEY, Lang.bind(this, this._updateTabsSupport));

    this._settings.connect('changed::' + ENABLE_AUDIBLE_BELL_KEY, Lang.bind(this, updateBellSettings)); // connect to gnome settings changes


    this._desktopSettings = Convenience.getInstalledSettings(WM_PREFERENCES_SCHEMA);

    if (this._desktopSettings != null) {
      this._desktopSettings.connect('changed::' + WM_FOCUS_MODE_SETTING_KEY, Lang.bind(this, this._updateFocusMode));
    } // asks the session bus to own the interface name


    Gio.DBus.session.own_name('pro.bigbn.DropDownTerminalX', Gio.BusNameOwnerFlags.NONE, null, null); // exports the interface

    this._bus = Gio.DBusExportedObject.wrapJSObject(DropDownTerminalXIface, this);

    this._bus.export(Gio.DBus.session, '/pro/bigbn/DropDownTerminalX');

    this.addTab();
  },

  get Pid() {
    return Convenience.getPid();
  },

  _applyToAllTabs: function (cb) {
    this.tabs.forEach(Lang.bind(this, cb));
  },
  _addUriMatchers: function (tab) {
    // adds the uri matchers
    this._uriHandlingPropertiesbyTag = {};
    UriHandlingProperties.forEach(Lang.bind(this, function (hp) {
      let regex = GLib.Regex.new(hp.pattern, GLib.RegexCompileFlags.CASELESS | GLib.RegexCompileFlags.OPTIMIZE, 0);
      let tag = tab.terminal.match_add_gregex(regex, 0);
      tab.terminal.match_set_cursor_type(tag, Gdk.CursorType.HAND2);
      this._uriHandlingPropertiesbyTag[tag] = hp;
    }));
  },
  _getTabName: function (tabNumber) {
    let tabLabel = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'shell';
    return "".concat(tabNumber, ": [").concat(tabLabel, "]");
  },
  _buildRenameForm: function () {
    let onSave = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};
    let vbox = new Gtk.VBox({
      homogeneous: false,
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 5
    });
    let entry = new Gtk.Entry();
    let saveButton = new Gtk.Button({
      label: 'OK'
    });
    vbox.pack_start(entry, true, true, 0);
    vbox.pack_start(saveButton, true, true, 0);
    entry.connect('activate', function () {
      return onSave(entry.get_text());
    });
    saveButton.connect('clicked', function () {
      return onSave(entry.get_text());
    });
    return vbox;
  },
  _changeTabLabel: function (tab) {
    let labelText = tab.name || String(tab.terminal.get_window_title()).replace(':~', '');

    let _labelText$split = labelText.split(':'),
        _labelText$split2 = _slicedToArray(_labelText$split, 2),
        prompt = _labelText$split2[0],
        path = _labelText$split2[1];

    let dirs = path ? path.split('/') : [null];
    let lastDir = dirs[dirs.length - 1];
    if (lastDir && lastDir.length > 30) lastDir = lastDir.substring(0, 30) + '...';
    tab.label.set_label(this._getTabName(tab.number, [prompt, lastDir].filter(function (s) {
      return s;
    }).join(' ')));
  },
  addTab: function () {
    var _this = this;

    let tab = this._createTerminalTab();

    tab.number = this.tabs.length ? Math.max.apply(Math, _toConsumableArray(this.tabs.map(function (tab) {
      return tab.number;
    }))) + 1 : 1;

    let tabName = this._getTabName(tab.number);

    let eventBox = new Gtk.EventBox();
    tab.label = new Gtk.Label({
      halign: Gtk.Align.CENTER,
      label: tabName,
      valign: Gtk.Align.CENTER
    });
    tab.popover = new Gtk.Popover();

    let form = this._buildRenameForm(function (newName) {
      tab.name = newName;

      _this._changeTabLabel(tab);

      tab.popover.popdown();
    });

    tab.popover.add(form);
    tab.popover.set_position(Gtk.PositionType.BOTTOM);
    eventBox.add(tab.label);
    tab.label.show();
    tab.terminal.popup = this._createPopupAndActions(tab);
    this.tabs.push(tab);
    this.notebook.append_page(tab.container, eventBox);
    this.notebook.set_tab_reorderable(tab.container, true);
    tab.terminal.connect('window-title-changed', function () {
      return _this._changeTabLabel(tab);
    }); // CLose tab on middle mouse button click

    eventBox.connect('button-press-event', function (widget, event) {
      let _event$get_button = event.get_button(),
          _event$get_button2 = _slicedToArray(_event$get_button, 2),
          isNumberDelivered = _event$get_button2[0],
          button = _event$get_button2[1];

      if (button === Gdk.BUTTON_MIDDLE) {
        if (_this.notebook.get_n_pages() === 1) return _this._forkUserShell(tab.terminal);

        let pageNum = _this.notebook.page_num(tab.container);

        _this._removeTab(pageNum);
      }

      if (event.get_event_type() === Gdk.EventType.DOUBLE_BUTTON_PRESS || button === Gdk.BUTTON_SECONDARY) {
        tab.popover.set_relative_to(eventBox);
        tab.popover.show_all();
        tab.popover.popup();
      }
    });
    tab.container.show();
    tab.terminal.show();
    this.notebook.set_current_page(this.notebook.get_n_pages() - 1);

    this._updateFont(tab);

    this._updateOpacityAndColors(tab);

    this._updateCustomCommand(tab);

    this._addUriMatchers(tab);

    this._forkUserShell(tab.terminal);

    this._updateFocusMode(tab);

    return tab;
  },
  _createTerminalTab: function () {
    var _this2 = this;

    let terminal = this._createTerminalView();

    let onExit = terminal.connect('child-exited', function () {
      if (_this2.notebook.get_n_pages() === 1) return _this2._forkUserShell(terminal);

      let pageNum = _this2.notebook.get_current_page();

      _this2._removeTab(pageNum);
    });
    let onRelease = terminal.connect('button-release-event', this._terminalButtonReleased.bind(this));
    let onPress = terminal.connect('button-press-event', this._terminalButtonPressed.bind(this));
    let onRefresh = terminal.connect('refresh-window', this._refreshWindow.bind(this));
    let container = new Gtk.ScrolledWindow({
      hadjustment: terminal.get_hadjustment(),
      vadjustment: terminal.get_vadjustment()
    });
    let actionGroup = new Gtk.ActionGroup({
      name: 'Main'
    });
    container.add(terminal);
    return {
      terminal: terminal,
      actionGroup: actionGroup,
      container: container,
      eventHandlers: {
        onExit: onExit,
        onRelease: onRelease,
        onPress: onPress,
        onRefresh: onRefresh
      }
    };
  },
  SetGeometry: function (x, y, width, height) {
    let _this$_window$get_pos = this._window.get_position(),
        _this$_window$get_pos2 = _slicedToArray(_this$_window$get_pos, 2),
        currentX = _this$_window$get_pos2[0],
        currentY = _this$_window$get_pos2[1];

    let _this$_window$get_siz = this._window.get_size(),
        _this$_window$get_siz2 = _slicedToArray(_this$_window$get_siz, 2),
        currentWidth = _this$_window$get_siz2[0],
        currentHeight = _this$_window$get_siz2[1];

    Convenience.runInGdk(Lang.bind(this, function () {
      if (x != currentX || y != currentY) {
        this._window.move(x, y);
      }

      if (width != currentWidth || height != currentHeight) {
        this._window.resize(width, height);
      }
    }));
  },
  Toggle: function () {
    // update the window visibility in the UI thread since this callback happens in the gdbus thread
    Convenience.runInGdk(Lang.bind(this, function () {
      this._window.visible ? this._window.hide() : this._window.show();
      return false;
    }));
  },
  Focus: function () {
    // present the window in the UI thread since this callback happens in the gdbus thread
    Convenience.runInGdk(Lang.bind(this, function () {
      if (this._window.visible) {
        let time = 0;

        try {
          time = GdkX11.x11_get_server_time(this._window.window);
        } catch (e) {
          log('could not get x11 server time (cause: ' + e + ')'); // not using logError as this is more an information than a real error
        }

        this._window.present_with_time(time);
      }
    }));
  },
  Quit: function () {
    Gtk.main_quit();
  },
  _createTerminalView: function () {
    let terminal = new Vte.Terminal();

    let enableBell = this._settings.get_boolean(ENABLE_AUDIBLE_BELL_KEY);

    terminal.set_audible_bell(enableBell);

    let cursorShape = this._settings.get_enum(TERMINAL_CURSOR_SETTING_KEY);

    terminal.set_cursor_shape(cursorShape);
    terminal.set_can_focus(true);
    terminal.set_allow_bold(true);
    terminal.set_scroll_on_output(true);
    terminal.set_scroll_on_keystroke(true);
    terminal.set_scrollback_lines(8096);

    if (Vte.TerminalEraseBinding) {
      terminal.set_backspace_binding(Vte.TerminalEraseBinding.ASCII_DELETE);
      terminal.set_delete_binding(Vte.TerminalEraseBinding.DELETE_SEQUENCE);
    }

    if (terminal.set_word_chars) {
      terminal.set_word_chars('-A-Za-z0-9_$.+!*(),;:@&=?/~#%');
    }

    terminal.set_encoding('UTF-8'); // FIXME: we get weird colors when we apply tango colors
    //
    // terminal.set_colors(ForegroundColor, BackgroundColor, TangoPalette, TangoPalette.length);

    return terminal;
  },
  _removeTab: function (pageNum) {
    this.notebook.remove_page(pageNum);
    let removedTabs = this.tabs.splice(pageNum, 1);
    let removedTab = null;

    if (removedTabs.length) {
      removedTab = removedTabs[0];

      for (let eventId in removedTab.eventHandlers) {
        removedTab.terminal.disconnect(removedTab.eventHandlers[eventId]);
      }

      removedTab.terminal.popup.destroy();
      removedTab.terminal.destroy();
      removedTab.container.destroy();
    }

    return removedTab;
  },
  _createWindow: function () {
    let screen = Gdk.Screen.get_default();
    let window = new Gtk.Window({
      type: Gtk.WindowType.TOPLEVEL
    });
    window.set_title('Drop Down Terminal');
    window.set_icon_name('utilities-terminal');
    window.set_wmclass('Drop Down Terminal', 'DropDownTerminalXWindow');
    window.set_decorated(false);
    window.set_skip_taskbar_hint(true);
    window.set_skip_pager_hint(true);
    window.set_resizable(true);
    window.set_keep_above(true);
    window.set_accept_focus(true);
    window.set_deletable(false);
    window.stick();

    if (Convenience.GTK_VERSION >= 31800) {
      window.set_type_hint(Gdk.WindowTypeHint.DOCK);
    } else {
      window.set_type_hint(Gdk.WindowTypeHint.DROPDOWN_MENU);
    }

    window.set_visual(screen.get_rgba_visual());
    window.connect('enter_notify_event', Lang.bind(this, this._windowMouseEnter));
    window.connect('delete-event', function () {
      window.hide();
      return true;
    });
    window.connect('destroy', Gtk.main_quit);
    return window;
  },
  _createPopupAndActions: function (tab) {
    var _this3 = this;

    // get some shortcuts
    let term = tab.terminal;
    let group = tab.actionGroup; // creates the actions and fills the action group

    this._createAction('Copy', 'Copy', Gtk.STOCK_COPY, '<shift><control>C', group, Lang.bind(term, term.copy_clipboard));

    this._createAction('Paste', 'Paste', Gtk.STOCK_PASTE, '<shift><control>V', group, Lang.bind(term, term.paste_clipboard));

    this._createAction('Close', 'Close', Gtk.STOCK_STOP, '<shift><control>D', group, function () {
      if (_this3.notebook.get_n_pages() === 1) return _this3._forkUserShell(tab.terminal);

      let pageNum = _this3.notebook.page_num(tab.container);

      _this3._removeTab(pageNum);
    }); // creates the UI manager


    let uiManager = new Gtk.UIManager();
    uiManager.add_ui_from_string(PopupUi, PopupUi.length);
    uiManager.insert_action_group(group, 0); // hooks the accel group up

    this._window.add_accel_group(uiManager.get_accel_group());

    return uiManager.get_widget('/TerminalPopup');
  },
  _forkUserShell: function (terminal) {
    terminal.reset(false, true);

    let args = this._getCommandArgs();

    let success, pid;

    try {
      if (terminal.spawn_sync) {
        // 0.37.0
        var _terminal$spawn_sync = terminal.spawn_sync(Vte.PtyFlags.DEFAULT, GLib.get_home_dir(), args, this._getCommandEnv(), GLib.SpawnFlags.SEARCH_PATH, null, null);

        var _terminal$spawn_sync2 = _slicedToArray(_terminal$spawn_sync, 2);

        success = _terminal$spawn_sync2[0];
        pid = _terminal$spawn_sync2[1];
      } else {
        var _terminal$fork_comman = terminal.fork_command_full(Vte.PtyFlags.DEFAULT, GLib.get_home_dir(), args, this._getCommandEnv(), GLib.SpawnFlags.SEARCH_PATH, null);

        var _terminal$fork_comman2 = _slicedToArray(_terminal$fork_comman, 2);

        success = _terminal$fork_comman2[0];
        pid = _terminal$fork_comman2[1];
      }

      terminal._lastForkFailed = false;
    } catch (e) {
      logError(e);
      terminal._lastForkFailed = true;
      let cause = e.name + ' - ' + e.message;

      this._bus.emit_signal('Failure', GLib.Variant.new('(ss)', ['ForkUserShellFailed', "Could not start the shell command line '" + args.join(' ') + "'."]));

      throw {
        name: 'ForkUserShellFailed',
        message: "Could not start the shell from command line '" + args.join(' ') + "' (cause: " + cause + ')'
      };
    }

    if (terminal.get_pty) {// 0.37.0
      // (nothing, the default is the user choice at build-time, which defaults to xterm anyway)
    } else {
      terminal.get_pty_object().set_term('xterm');
    }
  },
  _refreshWindow: function () {
    let rect = this._window.window.get_frame_extents();

    this._window.window.invalidate_rect(rect, true);
  },
  _updateFont: function (tab) {
    let fontDescStr = this._interfaceSettings.get_string(FONT_NAME_SETTING_KEY);

    let fontDesc = Pango.FontDescription.from_string(fontDescStr);
    tab.terminal.set_font(fontDesc);
  },
  _updateOpacityAndColors: function (tab) {
    let isTransparent = this._settings.get_boolean(TRANSPARENT_TERMINAL_SETTING_KEY);

    let transparencyLevel = this._settings.get_uint(TRANSPARENCY_LEVEL_SETTING_KEY) / 100.0;

    let hasScrollbar = this._settings.get_boolean(SCROLLBAR_VISIBLE_SETTING_KEY); // updates the colors
    //
    // Note: to follow the deprecation scheme, we try first the _rgba variants as vte < 0.38
    //       already has the non-rgba-suffixed one but it was working with GdkColor back then,
    //       and passing a GdkRGBA would raise an exception


    let fgColor = Convenience.parseRgbaColor(this._settings.get_string(COLOR_FOREGROUND_SETTING_KEY));
    let bgColor = Convenience.parseRgbaColor(this._settings.get_string(COLOR_BACKGROUND_SETTING_KEY));

    if (tab.terminal.set_color_foreground_rgba) {
      // removed in vte 0.38
      tab.terminal.set_color_foreground_rgba(fgColor);
    } else {
      tab.terminal.set_color_foreground(fgColor);
    } // Note: by applying the transparency only to the background colour of the terminal, the text stays
    //       readable in any case


    bgColor.alpha = isTransparent ? transparencyLevel : bgColor.alpha;

    if (tab.terminal.set_color_background_rgba) {
      // removed in vte 0.38
      tab.terminal.set_color_background_rgba(bgColor);
    } else {
      tab.terminal.set_color_background(bgColor);
    }

    tab.container.set_policy(Gtk.PolicyType.AUTOMATIC, hasScrollbar ? Gtk.PolicyType.ALWAYS : Gtk.PolicyType.NEVER);
  },
  _updateTabsSupport: function () {
    if (this._settings.get_boolean(ENABLE_TABS_SETTING_KEY)) {
      this._isTabsEnabled = true;
      this.notebook.set_show_tabs(true);
    } else {
      this._isTabsEnabled = false;
      this.notebook.set_show_tabs(false);
    }
  },
  _updateAudibleIndicator: function (tab) {
    let enableBell = this._settings.get_boolean(ENABLE_AUDIBLE_BELL_KEY);

    tab.terminal.set_audible_bell(enableBell);
  },
  _updateCustomCommand: function (tab) {
    // get the custom command
    let command;

    if (this._settings.get_boolean(RUN_CUSTOM_COMMAND_SETTING_KEY)) {
      command = this._settings.get_string(CUSTOM_COMMAND_SETTING_KEY).trim();
    } else {
      command = '';
    } // parses the command line


    this._customCommandArgs = command ? command.split(/\s+/) : []; // tries to fork the shell again if it fails last time (the user might be trying different values,
    // we do not want the terminal to get stuck)

    if (tab.terminal._lastForkFailed) {
      this._forkUserShell(tab.terminal);
    }
  },
  _updateFocusMode: function (tab) {
    this._focusMode = this._desktopSettings ? this._desktopSettings.get_string(WM_FOCUS_MODE_SETTING_KEY) : FOCUS_MODE_CLICK;
  },
  _windowMouseEnter: function (window, event) {
    if (this._focusMode != FOCUS_MODE_CLICK) {
      this.Focus();
    }
  },
  _terminalButtonPressed: function (terminal, event) {
    if (this._focusMode == FOCUS_MODE_CLICK) {
      this.Focus();
    }
  },
  _terminalButtonReleased: function (terminal, event) {
    let _event$get_state3 = event.get_state(),
        _event$get_state4 = _slicedToArray(_event$get_state3, 2),
        has_state = _event$get_state4[0],
        state = _event$get_state4[1];

    let _event$get_button3 = event.get_button(),
        _event$get_button4 = _slicedToArray(_event$get_button3, 2),
        is_button = _event$get_button4[0],
        button = _event$get_button4[1]; // opens hovered link on ctrl+left-click


    if (is_button && button == Gdk.BUTTON_PRIMARY && state & Gdk.ModifierType.CONTROL_MASK) {
      let _event$get_coords = event.get_coords(),
          _event$get_coords2 = _slicedToArray(_event$get_coords, 3),
          preserved = _event$get_coords2[0],
          x = _event$get_coords2[1],
          y = _event$get_coords2[2];

      let border = new Gtk.Border();
      terminal.style_get_property('inner-border', border);
      let column = (x - border.left) / terminal.get_char_width();
      let row = (y - border.top) / terminal.get_char_height();

      let _terminal$match_check = terminal.match_check(column, row),
          _terminal$match_check2 = _slicedToArray(_terminal$match_check, 2),
          match = _terminal$match_check2[0],
          tag = _terminal$match_check2[1];

      if (match) {
        let properties = this._uriHandlingPropertiesbyTag[tag];

        this._openUri(match, properties.flavor, event.get_screen(), event.get_time());
      }

      return true;
    } // opens the popup menu on right click (not using event.triggers_context_menu to avoid eating
    // Shift-F10 for Midnight Commander or an app like that)
    //
    // Note: we do not update the paste sensitivity as this requires API not available (Gdk.Atom and SELECTION_CLIPBOARD)
    //       thus we do not handle copy sensitivity either (this makes more sense and is less code)


    if (is_button && button == Gdk.BUTTON_SECONDARY) {
      terminal.popup.popup(null, null, null, button, event.get_time());
      return true;
    }

    return false;
  },
  _openUri: function (uri, flavor, screen, time) {
    if (flavor == UriFlavor.DefaultToHttp) {
      uri = 'http:' + uri;
    } else if (flavor == UriFlavor.Email && !uri.match(/^mailto:/i)) {
      uri = 'mailto:' + uri;
    }

    Gtk.show_uri(screen, uri, time);
  },
  _getCommandArgs: function () {
    // custom command
    if (this._customCommandArgs.length > 0) {
      return this._customCommandArgs;
    } // user shell


    try {
      let _GLib$shell_parse_arg = GLib.shell_parse_argv(Vte.get_user_shell()),
          _GLib$shell_parse_arg2 = _slicedToArray(_GLib$shell_parse_arg, 2),
          parsed = _GLib$shell_parse_arg2[0],
          args = _GLib$shell_parse_arg2[1];

      if (parsed) {
        return args;
      }
    } catch (e) {} // nothing: we continue silently as this is totally expected
    // falls back to the classic Bourne shell


    return ['/bin/sh'];
  },
  _getCommandEnv: function () {
    // builds the environment
    let env = {};
    GLib.listenv().forEach(function (name) {
      env[name] = GLib.getenv(name);
    });
    delete env['COLUMNS'];
    delete env['LINES'];
    delete env['GNOME_DESKTOP_ICON'];
    env['COLORTERM'] = 'drop-down-terminal-x';
    env['TERM'] = 'xterm-256color'; // gets an array of key=value pairs

    let envArray = [];

    for (let key in env) {
      envArray.push(key + '=' + (env[key] ? env[key] : ''));
    }

    return envArray;
  },
  _createAction: function (name, label, stockId, accel, actionGroup, callback) {
    let action = new Gtk.Action({
      name: name,
      label: label,
      stock_id: stockId
    });
    action.connect('activate', callback);
    actionGroup.add_action_with_accel(action, accel);
    return action;
  }
}); // sets a nice program name and initializes gtk

Gtk.init(null, 0); // sets the setting to prefer a dark theme

Gtk.Settings.get_default()['gtk-application-prefer-dark-theme'] = true; // creates the terminal

let terminal = new DropDownTerminalX();
GLib.set_prgname('drop-down-terminal-x'); // starts the main loop

Gtk.main();

