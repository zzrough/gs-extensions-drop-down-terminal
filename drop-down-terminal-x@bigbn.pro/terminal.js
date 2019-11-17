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
const Lang = imports.lang
const Gettext = imports.gettext.domain('drop-down-terminal-x')
const _ = Gettext.gettext
const Mainloop = imports.mainloop

imports.gi.versions.Gdk = '3.0'
imports.gi.versions.GdkX11 = '3.0'
imports.gi.versions.Gtk = '3.0'

const Pango = imports.gi.Pango
const Gdk = imports.gi.Gdk
const GdkX11 = imports.gi.GdkX11
const Gio = imports.gi.Gio
const GLib = imports.gi.GLib
const Gtk = imports.gi.Gtk
const Vte = imports.gi.Vte

const Convenience = imports.convenience

// dbus interface
const DropDownTerminalXIface =
   `<node>                                                        
    <interface name="pro.bigbn.DropDownTerminalX">  
        <property name="Pid" type="i" access="read"/>             
        <method name="SetGeometry">                               
            <arg name="x" type="i" direction="in"/>               
            <arg name="y" type="i" direction="in"/>               
            <arg name="width" type="i" direction="in"/>           
            <arg name="height" type="i" direction="in"/>          
        </method>                                                 
        <method name="Toggle"/> 
        <method name="GetVisibilityState">
          <arg name="state" type="b" direction="out"/>
        </method>                                  
        <method name="Focus"/>                                    
        <method name="NewTab"/>                                    
        <method name="PrevTab"/>                                    
        <method name="NextTab"/>                                    
        <method name="CloseTab"/>                                    
        <method name="IncreaseFontSize"/>                                    
        <method name="DecreaseFontSize"/>                                    
        <method name="Quit"/>                                     
        <signal name="Failure">                                   
            <arg type="s" name="name"/>                           
            <arg type="s" name="cause"/>                          
        </signal>  
        <signal name="VisibilityStateChanged">                                   
            <arg type="b" name="state"/>
        </signal>
        <signal name="SettingsRequested">      
            <arg type="b" name="state"/>                           
        </signal>                                                
    </interface>                                                  
    </node>`

// uimanager popup information
const PopupUi =
   `<ui>                               
        <popup name="TerminalPopup">   
            <menuitem action="Copy"/>  
            <menuitem action="Paste"/> 
            <menuitem action="Close"/> 
        </popup>                       
    </ui>`

// constants for the location of the extension
const EXTENSION_ID = 'drop-down-terminal-x'
const EXTENSION_UUID = EXTENSION_ID + '@bigbn.pro'
const EXTENSION_PATH = ARGV[0] || GLib.get_home_dir() + '/.local/share/gnome-shell/extensions/' + EXTENSION_UUID

// constants for the settings
const FONT_NAME_SETTING_KEY = 'monospace-font-name'
const TRANSPARENCY_LEVEL_SETTING_KEY = 'transparency-level'
const TRANSPARENT_TERMINAL_SETTING_KEY = 'transparent-terminal'
const SCROLLBAR_VISIBLE_SETTING_KEY = 'scrollbar-visible'
const SCROLL_ON_OUTPUT_SETTING_KEY = 'scroll-on-output'
const TERMINAL_CURSOR_SETTING_KEY = 'terminal-cursor'
const COLOR_FOREGROUND_SETTING_KEY = 'foreground-color'
const COLOR_BACKGROUND_SETTING_KEY = 'background-color'
const RUN_CUSTOM_COMMAND_SETTING_KEY = 'run-custom-command'
const CUSTOM_COMMAND_SETTING_KEY = 'custom-command'
const ENABLE_AUDIBLE_BELL_KEY = 'enable-audible-bell'
const ENABLE_TABS_SETTING_KEY = 'enable-tabs'
const HIDE_ON_UNFOCUS_SETTING_KEY = 'hide-on-unfocus'
const HIDE_ON_ESCAPE_SETTING_KEY = 'hide-on-escape'
const TABS_POSITION_SETTING_KEY = 'tabs-position'
const MOTR_VERSION_SETTING_KEY = 'motr-version'

// gnome desktop wm settings
const WM_PREFERENCES_SCHEMA = 'org.gnome.desktop.wm.preferences'
const WM_FOCUS_MODE_SETTING_KEY = 'focus-mode'
const FOCUS_MODE_CLICK = 'click'
const FOCUS_MODE_MOUSE = 'mouse'
const FOCUS_MODE_SLOPPY = 'sloppy'

// constants borrowed from gnome-terminal
const ForegroundColor = Convenience.parseRgbaColor('#aaaaaaaaaaaa')
const BackgroundColor = Convenience.parseRgbaColor('#000000000000')

const TangoPalette = [
  Convenience.parseRgbaColor('#000000000000'),
  Convenience.parseRgbaColor('#cccc00000000'),
  Convenience.parseRgbaColor('#4e4e9a9a0606'),
  Convenience.parseRgbaColor('#c4c4a0a00000'),
  Convenience.parseRgbaColor('#34346565a4a4'),
  Convenience.parseRgbaColor('#757550507b7b'),
  Convenience.parseRgbaColor('#060698209a9a'),
  Convenience.parseRgbaColor('#d3d3d7d7cfcf'),
  Convenience.parseRgbaColor('#555557575353'),
  Convenience.parseRgbaColor('#efef29292929'),
  Convenience.parseRgbaColor('#8a8ae2e23434'),
  Convenience.parseRgbaColor('#fcfce9e94f4f'),
  Convenience.parseRgbaColor('#72729f9fcfcf'),
  Convenience.parseRgbaColor('#adad7f7fa8a8'),
  Convenience.parseRgbaColor('#3434e2e2e2e2'),
  Convenience.parseRgbaColor('#eeeeeeeeecec')
]

const UserCharsPattern = '-[:alnum:]'
const UserCharsClassPattern = '[' + UserCharsPattern + ']'
const PassCharsClassPattern = "[-[:alnum:]\\Q,?;.:/!%$^*&~\"#'\\E]"
const HostCharsClassPattern = '[-[:alnum:]]'
const HostPattern = HostCharsClassPattern + '+(\\.' + HostCharsClassPattern + '+)*'
const PortPattern = '(?:\\:[[:digit:]]{1,5})?'
const PathCharsClassPattern = '[-[:alnum:]\\Q_$.+!*,;@&=?/~#%\\E]'
const PathTermClassPattern = "[^\\Q]'.}>) \t\r\n,\"\\E]"
const SchemePattern = '(?:news:|telnet:|nntp:|file:\\/|https?:|ftps?:|sftp:|webcal:)'
const UserPassPattern = UserCharsClassPattern + '+(?:' + PassCharsClassPattern + '+)?'
const UrlPathPattern = '(?:(/' + UserCharsClassPattern + '+(?:[(]' +
                               UserCharsClassPattern + '*[)])*' +
                               UserCharsClassPattern + '*)*' + PathTermClassPattern + ')?'

const UriFlavor = {
  AsIs: 0,
  DefaultToHttp: 1,
  VoipCall: 2,
  Email: 3
}

const UriHandlingProperties = [
  { pattern: SchemePattern + '//(?:' + UserPassPattern + '\\@)?' + HostPattern + PortPattern + UrlPathPattern, flavor: UriFlavor.AsIs },
  { pattern: '(?:www|ftp)' + HostCharsClassPattern + '*\\.' + HostPattern + PortPattern + UrlPathPattern, flavor: UriFlavor.DefaultToHttp },
  { pattern: '(?:callto:|h323:|sip:)' + UserCharsClassPattern + '[' + UserCharsPattern + '.]*(?:' + PortPattern + '/[a-z0-9]+)?\\@' + HostPattern, flavor: UriFlavor.VoipCall },
  { pattern: '(?:mailto:)?' + UserCharsClassPattern + '[' + UserCharsPattern + '.]*\\@' + HostCharsClassPattern + '+\\.' + HostPattern, flavor: UriFlavor.EMail },
  { pattern: "(?:news:|man:|info:)[[:alnum:]\\Q^_{|}~!\"#$%&'()*+,./;:=?`\\E]+", flavor: UriFlavor.AsIs }
]

const sshConfigPath = GLib.build_pathv('/', [GLib.get_home_dir(), '.ssh/config'])
const shortcutsConfigFilePath = GLib.build_pathv('/', [GLib.get_home_dir(), '.config/drop-down-terminal-x/shortcuts'])

// terminal class
const DropDownTerminalX = new Lang.Class({
  Name: 'DropDownTerminalX',
  tabs: [],

  _init: function () {
    // initializes the state
    this._customCommandArgs = []
    this._visible = false

    // loads the custom CSS to mimick the shell style
    const provider = new Gtk.CssProvider()

    if (Convenience.GTK_VERSION >= 31790) {
      provider.load_from_file(Gio.File.new_for_path(EXTENSION_PATH + '/gtk.css'))
    } else if (Convenience.GTK_VERSION >= 31590) {
      provider.load_from_file(Gio.File.new_for_path(EXTENSION_PATH + '/gtk-3-16.css'))
    } else {
      provider.load_from_file(Gio.File.new_for_path(EXTENSION_PATH + '/gtk-3-14.css'))
    }

    Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

    this._window = this._createWindow()

    // Notebook - is the default gnome tabs widget
    this.notebook = new Gtk.Notebook()
    this.notebook.set_tab_pos(Gtk.PositionType.BOTTOM)
    this.notebook.set_show_border(true)
    this.notebook.set_scrollable(true)
    this.notebook.show()

    const plusImage = new Gtk.Image()
    plusImage.set_from_icon_name('document-new-symbolic', Gtk.IconSize.SMALL_TOOLBAR)

    const shorcutImage = new Gtk.Image()
    shorcutImage.set_from_icon_name('view-more-symbolic', Gtk.IconSize.SMALL_TOOLBAR)

    const SSHImage = new Gtk.Image()
    SSHImage.set_from_icon_name('utilities-terminal-symbolic', Gtk.IconSize.SMALL_TOOLBAR)

    const settingsImage = new Gtk.Image()
    settingsImage.set_from_icon_name('document-properties-symbolic', Gtk.IconSize.SMALL_TOOLBAR)

    const plusButton = new Gtk.Button({ image: plusImage })
    plusButton.connect('clicked', () => this.addTab())

    const shortcutsButton = new Gtk.Button({ image: shorcutImage })
    shortcutsButton.connect('clicked', () => this.openShortcutSelector(shortcutsButton))

    const SSHButton = new Gtk.Button({ image: SSHImage })
    SSHButton.connect('clicked', () => this.openSSHSelector(SSHButton))

    const settingsButton = new Gtk.Button({ image: settingsImage })
    settingsButton.connect('clicked', () => {
      this._bus.emit_signal('SettingsRequested', GLib.Variant.new('(b)', [this._window.visible]))
    })

    const box = new Gtk.HBox({
      homogeneous: true
    })

    box.pack_start(settingsButton, true, true, 0)
    box.pack_start(shortcutsButton, true, true, 0)
    box.pack_start(SSHButton, true, true, 0)
    box.pack_start(plusButton, true, true, 0)

    this.notebook.set_action_widget(box, Gtk.PackType.END)

    this._window.add(this.notebook)

    box.show()

    plusButton.show()

    if (GLib.file_test(shortcutsConfigFilePath, GLib.FileTest.EXISTS)) shortcutsButton.show()
    if (GLib.file_test(sshConfigPath, GLib.FileTest.EXISTS)) SSHButton.show()

    settingsButton.show()

    // gets the settings
    this._settings = Convenience.getSettings(EXTENSION_PATH, EXTENSION_ID)
    this._interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' })

    this._updateTabsSupport()
    this._updateTabsPosition()

    this._updateUnfocusSupport()

    const reApplyPrefs = () => this._applyToAllTabs((tab) => Convenience.runInGdk(() => this._updateBehaviour(tab)))
    const updateCommand = () => this._applyToAllTabs((tab) => this._updateCustomCommand(tab))
    const updateBellSettings = () => this._applyToAllTabs((tab) => this._updateAudibleIndicator(tab));

    [
      SCROLLBAR_VISIBLE_SETTING_KEY,
      SCROLL_ON_OUTPUT_SETTING_KEY,
      TRANSPARENCY_LEVEL_SETTING_KEY,
      TRANSPARENT_TERMINAL_SETTING_KEY,
      COLOR_FOREGROUND_SETTING_KEY,
      COLOR_BACKGROUND_SETTING_KEY
    ].forEach(Lang.bind(this, function (key) {
      this._settings.connect('changed::' + key, reApplyPrefs)
    }));

    [
      RUN_CUSTOM_COMMAND_SETTING_KEY,
      CUSTOM_COMMAND_SETTING_KEY
    ].forEach(Lang.bind(this, function (key) {
      this._settings.connect('changed::' + key, updateCommand)
    }))

    this._settings.connect('changed::' + ENABLE_TABS_SETTING_KEY, Lang.bind(this, this._updateTabsSupport))
    this._settings.connect('changed::' + HIDE_ON_UNFOCUS_SETTING_KEY, Lang.bind(this, this._updateUnfocusSupport))
    this._settings.connect('changed::' + HIDE_ON_ESCAPE_SETTING_KEY, Lang.bind(this, this._updateEscapeSupport))
    this._settings.connect('changed::' + ENABLE_AUDIBLE_BELL_KEY, Lang.bind(this, updateBellSettings))
    this._settings.connect('changed::' + TABS_POSITION_SETTING_KEY, Lang.bind(this, this._updateTabsPosition))

    // connect to gnome settings changes
    this._desktopSettings = Convenience.getInstalledSettings(WM_PREFERENCES_SCHEMA)
    if (this._desktopSettings != null) {
      this._desktopSettings.connect('changed::' + WM_FOCUS_MODE_SETTING_KEY, Lang.bind(this, this._updateFocusMode))
    }

    // asks the session bus to own the interface name
    Gio.DBus.session.own_name('pro.bigbn.DropDownTerminalX',
      Gio.BusNameOwnerFlags.NONE,
      null,
      null
    )

    // exports the interface
    this._bus = Gio.DBusExportedObject.wrapJSObject(DropDownTerminalXIface, this)
    this._bus.export(Gio.DBus.session, '/pro/bigbn/DropDownTerminalX')

    this.addTab()
  },

  get Pid () {
    return Convenience.getPid()
  },

  getSSHConfigHosts () {
    const sshConfigPath = GLib.build_pathv('/', [GLib.get_home_dir(), '.ssh/config'])
    const [ok, contents] = GLib.file_get_contents(sshConfigPath)
    if (ok) {
      const hosts = String(contents)
        .split('\n')
        .filter((line) => {
          line = line.trim().toLowerCase()
          const [key] = line.split(/\s+/)
          return key === 'host'
        })
        .map((line) => {
          const [, value] = line.split(/\s+/)
          return value
        })
        .filter(host => host.trim() !== '*')

      return hosts
    } else return []
  },

  getDDTXConfig () {
    const [ok, contents] = GLib.file_get_contents(shortcutsConfigFilePath)
    if (ok) {
      try {
        const shortcuts = String(contents)
          .split('\n')
          .filter(line => line.trim() && !line.trim().startsWith('#'))
          .map((line) => {
            let [key, ...action] = line.split(/\s?:\s?/)
            action = action.join(':')

            const def = JSON.parse(key)
            const [name, icon, keybindings] = def
            return {
              name,
              icon,
              keybindings,
              action
            }
          })
          .filter(({ name, action }) => name && action)

        return shortcuts
      } catch (e) {
        const messageDialog = new Gtk.MessageDialog({
          transient_for: this._window,
          modal: true,
          buttons: Gtk.ButtonsType.OK,
          message_type: Gtk.MessageType.WARNING,
          title: 'Unable to parse shortcuts file',
          text: e.message
        })

        messageDialog.connect('response', () => messageDialog.destroy())
        messageDialog.show()
        return []
      }
    } else return []
  },

  openShortcutSelector (button) {
    const [, currentHeight] = this._window.get_size()
    const scrollArea = new Gtk.ScrolledWindow()

    const list = new Gtk.ListBox()
    const actions = this.getDDTXConfig()

    actions.forEach(({ name, action }) => {
      const row = new Gtk.ListBoxRow()
      row.data = action

      const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 5 })
      vbox.pack_start(new Gtk.Label({ label: ' ' + name, xalign: 0 }), true, true, 5)
      row.add(vbox)
      list.add(row)
    })

    list.connect('row-activated', (widget, row) => {
      popover.popdown() // TODO: Dispose any related data
      const action = row.data
      const tab = this.addTab(action.split(/\s+/))
      this.Focus()
    })

    scrollArea.set_size_request(200, currentHeight - 100)
    scrollArea.add_with_viewport(list)

    const popover = new Gtk.Popover()
    popover.set_position(Gtk.PositionType.BOTTOM)
    popover.set_relative_to(button)
    popover.add(scrollArea)
    popover.show_all()
    popover.popup()
  },

  openSSHSelector (button) {
    const [, currentHeight] = this._window.get_size()
    const scrollArea = new Gtk.ScrolledWindow()

    const list = new Gtk.ListBox() // { selection_mode: Gtk.SelectionMode.NONE })
    const hosts = this.getSSHConfigHosts()

    hosts.forEach((host) => {
      const row = new Gtk.ListBoxRow()
      row.data = host

      const vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 5 })
      vbox.pack_start(new Gtk.Label({ label: ' ' + host, xalign: 0 }), true, true, 5)
      row.add(vbox)
      list.add(row)
    })

    list.connect('row-activated', (widget, row) => {
      popover.popdown() // TODO: Dispose any related data
      const host = row.data
      const tab = this.addTab(['ssh', host, '-v'])
      this.Focus()
    })

    scrollArea.set_size_request(200, currentHeight - 100)
    scrollArea.add_with_viewport(list)

    const popover = new Gtk.Popover()
    popover.set_position(Gtk.PositionType.BOTTOM)
    popover.set_relative_to(button)
    popover.add(scrollArea)
    popover.show_all()
    popover.popup()
  },

  _applyToAllTabs: function (cb) {
    this.tabs.forEach(Lang.bind(this, cb))
  },

  _addUriMatchers: function (tab) {
    // adds the uri matchers
    this._uriHandlingPropertiesbyTag = {}
    UriHandlingProperties.forEach(Lang.bind(this, function (hp) {
      const regex = GLib.Regex.new(hp.pattern, GLib.RegexCompileFlags.CASELESS | GLib.RegexCompileFlags.OPTIMIZE, 0)
      const tag = tab.terminal.match_add_gregex(regex, 0)
      tab.terminal.match_set_cursor_type(tag, Gdk.CursorType.HAND2)
      this._uriHandlingPropertiesbyTag[tag] = hp
    }))
  },

  _getTabName (tabNumber, tabLabel = 'shell') {
    return `${tabNumber}: [${tabLabel}]`
  },

  _buildRenameForm (onSave = () => {}) {
    const vbox = new Gtk.VBox({ homogeneous: false, orientation: Gtk.Orientation.HORIZONTAL, spacing: 5 })
    const entry = new Gtk.Entry()
    const saveButton = new Gtk.Button({ label: 'OK' })

    vbox.pack_start(entry, true, true, 0)
    vbox.pack_start(saveButton, true, true, 0)
    entry.connect('activate', () => onSave(entry.get_text()))
    saveButton.connect('clicked', () => onSave(entry.get_text()))
    return vbox
  },

  _changeTabLabel (tab) {
    const labelText = tab.name || String(tab.terminal.get_window_title()).replace(':~', '')
    const [prompt, path] = labelText.split(':')
    const dirs = path ? path.split('/') : [null]
    let lastDir = dirs[dirs.length - 1]
    if (lastDir && lastDir.length > 30) lastDir = lastDir.substring(0, 30) + '...'
    tab.label.set_label(this._getTabName(tab.number, [prompt, lastDir].filter(s => s).join(' ')))
  },

  addTab (commandArgs = []) {
    const tab = this._createTerminalTab()
    tab.number = this.tabs.length ? Math.max(...(this.tabs.map(tab => tab.number))) + 1 : 1
    const tabName = this._getTabName(tab.number)
    const eventBox = new Gtk.EventBox()

    tab.label = new Gtk.Label({ halign: Gtk.Align.CENTER, label: tabName, valign: Gtk.Align.CENTER })

    tab.popover = new Gtk.Popover()
    const form = this._buildRenameForm((newName) => {
      tab.name = newName
      this._changeTabLabel(tab)
      tab.popover.popdown()
    })
    tab.popover.add(form)
    tab.popover.set_position(Gtk.PositionType.BOTTOM)

    eventBox.add(tab.label)
    tab.label.show()

    tab.terminal.popup = this._createPopupAndActions(tab)

    this.tabs.push(tab)
    this.notebook.append_page(tab.container, eventBox)
    this.notebook.set_tab_reorderable(tab.container, true)

    tab.terminal.connect('window-title-changed', () => this._changeTabLabel(tab))

    // CLose tab on middle mouse button click
    eventBox.connect('button-press-event', (widget, event) => {
      const [isNumberDelivered, button] = event.get_button()
      if (button === Gdk.BUTTON_MIDDLE) {
        if (this.notebook.get_n_pages() === 1) return this._forkUserShell(tab.terminal)
        const pageNum = this.notebook.page_num(tab.container)
        this._removeTab(pageNum)
      }

      if (event.get_event_type() === Gdk.EventType.DOUBLE_BUTTON_PRESS || button === Gdk.BUTTON_SECONDARY) {
        tab.popover.set_relative_to(eventBox)
        tab.popover.show_all()
        tab.popover.popup()
      }
    })

    tab.container.show()
    tab.terminal.show()
    this.notebook.set_current_page(this.notebook.get_n_pages() - 1)

    this._updateFont(tab)
    this._updateBehaviour(tab)
    this._updateCustomCommand(tab)
    this._addUriMatchers(tab)

    this._forkUserShell(tab.terminal, commandArgs)
    this._updateFocusMode(tab)
    return tab
  },

  _createTerminalTab () {
    const terminal = this._createTerminalView()

    const onExit = terminal.connect('child-exited', () => {
      if (this.notebook.get_n_pages() === 1) return this._forkUserShell(terminal)
      const pageNum = this.notebook.get_current_page()
      this._removeTab(pageNum)
    })

    const onRelease = terminal.connect('button-release-event', this._terminalButtonReleased.bind(this))
    const onPress = terminal.connect('button-press-event', this._terminalButtonPressed.bind(this))
    const onRefresh = terminal.connect('refresh-window', this._refreshWindow.bind(this))

    const container = new Gtk.ScrolledWindow({
      hadjustment: terminal.get_hadjustment(),
      vadjustment: terminal.get_vadjustment()
    })

    const actionGroup = new Gtk.ActionGroup({ name: 'Main' })
    container.add(terminal)

    return {
      terminal,
      actionGroup,
      container,
      eventHandlers: {
        onExit,
        onRelease,
        onPress,
        onRefresh
      }
    }
  },

  SetGeometry: function (x, y, width, height) {
    const [currentX, currentY] = this._window.get_position()
    const [currentWidth, currentHeight] = this._window.get_size()

    Convenience.runInGdk(Lang.bind(this, function () {
      if (x != currentX || y != currentY) {
        this._window.move(x, y)
      }

      if (width != currentWidth || height != currentHeight) {
        this._window.resize(width, height)
      }
    }))
  },

  NewTab () {
    if (!this._window.visible) return
    if (!this._isTabsEnabled) return
    this.addTab()
  },

  PrevTab () {
    if (!this._window.visible) return
    if (!this._isTabsEnabled) return
    this.notebook.prev_page()
  },

  NextTab () {
    if (!this._isTabsEnabled) return
    this.notebook.next_page()
  },

  CloseTab () {
    if (!this._window.visible) return
    if (!this._isTabsEnabled) return
    if (this.notebook.get_n_pages() === 1) return this._forkUserShell(this.tabs[0].terminal)
    const pageNum = this.notebook.get_current_page()
    this._removeTab(pageNum)
  },

  IncreaseFontSize () {
    if (!this._window.visible) return
    const terminal = this._getCurrentTerminal()
    terminal.set_font_scale(terminal.get_font_scale() + 0.1)
  },

  DecreaseFontSize () {
    if (!this._window.visible) return
    const terminal = this._getCurrentTerminal()
    terminal.set_font_scale(terminal.get_font_scale() - 0.1)
  },

  Toggle: function () {
    // update the window visibility in the UI thread since this callback happens in the gdbus thread
    Convenience.runInGdk(() => {
      if (this._window.visible) {
        this._window.hide()
        this._bus.emit_signal('VisibilityStateChanged', GLib.Variant.new('(b)', [this._window.visible]))
      } else {
        this._window.show()
        this._bus.emit_signal('VisibilityStateChanged', GLib.Variant.new('(b)', [this._window.visible]))
      }
      return false
    })
  },

  GetVisibilityState () {
    return this._window.visible
  },

  _jentlyHide () {
    Convenience.runInGdk(Lang.bind(this, function () {
      this._window.hide()
      this._bus.emit_signal('VisibilityStateChanged', GLib.Variant.new('(b)', [this._window.visible]))
      return false
    }))
  },

  Focus: function () {
    // present the window in the UI thread since this callback happens in the gdbus thread
    Convenience.runInGdk(Lang.bind(this, function () {
      if (this._window.visible) {
        let time = 0

        try {
          time = GdkX11.x11_get_server_time(this._window.window)
        } catch (e) {
          log('could not get x11 server time (cause: ' + e + ')') // not using logError as this is more an information than a real error
        }

        this._window.present_with_time(time)
      }
    }))
  },

  Quit: function () {
    Gtk.main_quit()
  },

  _getCurrentTerminal () {
    const pageNum = this.notebook.get_current_page()
    const terminal = this.tabs[pageNum].terminal
    return terminal
  },

  _createTerminalView: function () {
    const terminal = new Vte.Terminal()

    const enableBell = this._settings.get_boolean(ENABLE_AUDIBLE_BELL_KEY)
    terminal.set_audible_bell(enableBell)

    const cursorShape = this._settings.get_enum(TERMINAL_CURSOR_SETTING_KEY)
    const scrollOnOutput = this._settings.get_boolean(SCROLL_ON_OUTPUT_SETTING_KEY)
    terminal.set_cursor_shape(cursorShape)

    terminal.set_can_focus(true)
    terminal.set_allow_bold(true)

    terminal.set_scroll_on_output(scrollOnOutput)
    terminal.set_scroll_on_keystroke(true)
    terminal.set_scrollback_lines(8096)

    if (Vte.TerminalEraseBinding) {
      terminal.set_backspace_binding(Vte.TerminalEraseBinding.ASCII_DELETE)
      terminal.set_delete_binding(Vte.TerminalEraseBinding.DELETE_SEQUENCE)
    }

    if (terminal.set_word_chars) {
      terminal.set_word_chars('-A-Za-z0-9_$.+!*(),;:@&=?/~#%')
    }

    terminal.set_encoding('UTF-8')
    // FIXME: we get weird colors when we apply tango colors
    //
    // terminal.set_colors(ForegroundColor, BackgroundColor, TangoPalette, TangoPalette.length);

    return terminal
  },

  _removeTab (pageNum) {
    this.notebook.remove_page(pageNum)
    const removedTabs = this.tabs.splice(pageNum, 1)
    let removedTab = null
    if (removedTabs.length) {
      removedTab = removedTabs[0]
      for (const eventId in removedTab.eventHandlers) {
        removedTab.terminal.disconnect(removedTab.eventHandlers[eventId])
      }
      removedTab.terminal.popup.destroy()
      removedTab.terminal.destroy()
      removedTab.container.destroy()
    }
    return removedTab
  },

  _createWindow: function () {
    const screen = Gdk.Screen.get_default()
    const window = new Gtk.Window({ type: Gtk.WindowType.TOPLEVEL })

    window.set_title('Drop Down Terminal')
    window.set_icon_name('utilities-terminal')
    window.set_wmclass('Drop Down Terminal', 'DropDownTerminalXWindow')
    window.set_decorated(false)
    window.set_skip_taskbar_hint(true)
    window.set_skip_pager_hint(true)
    window.set_resizable(true)
    window.set_keep_above(true)
    window.set_accept_focus(true)
    window.set_deletable(false)
    window.stick()

    if (Convenience.GTK_VERSION >= 31800) {
      window.set_type_hint(Gdk.WindowTypeHint.DOCK)
    } else {
      window.set_type_hint(Gdk.WindowTypeHint.DROPDOWN_MENU)
    }

    window.set_visual(screen.get_rgba_visual())

    window.connect('enter_notify_event', Lang.bind(this, this._windowMouseEnter))
    window.connect('delete-event', () => {
      window.hide()
      this._bus.emit_signal('VisibilityStateChanged', GLib.Variant.new('(b)', [window.visible]))
      return true
    })
    window.connect('destroy', Gtk.main_quit)
    window.connect('focus-out-event', () => {
      if (this._isHideOnUnfocusEnabled) this._jentlyHide()
      return true
    })

    window.connect('key-press-event', (widget, event, user_data) => {
      if (this._isHideOnEscapeEnabled) {
        const [success, keyval] = event.get_keyval() // integer
        const keyname = Gdk.keyval_name(keyval) // string keyname
        if (keyname === 'Escape') this._jentlyHide()
      }
    })

    return window
  },

  _createPopupAndActions: function (tab) {
    // get some shortcuts
    const group = tab.actionGroup

    // creates the actions and fills the action group
    this._createAction('Copy', 'Copy', Gtk.STOCK_COPY, '<shift><control>C', group, () => {
      const terminal = this._getCurrentTerminal()
      terminal.copy_clipboard()
    })
    this._createAction('Paste', 'Paste', Gtk.STOCK_PASTE, '<shift><control>V', group, () => {
      const terminal = this._getCurrentTerminal()
      terminal.paste_clipboard()
    })
    this._createAction('Close', 'Close', Gtk.STOCK_STOP, '<shift><control>D', group, () => {
      if (this.notebook.get_n_pages() === 1) return this._forkUserShell(tab.terminal)
      const pageNum = this.notebook.page_num(tab.container)
      this._removeTab(pageNum)
    })

    // creates the UI manager
    const uiManager = new Gtk.UIManager()
    uiManager.add_ui_from_string(PopupUi, PopupUi.length)
    uiManager.insert_action_group(group, 0)

    // hooks the accel group up
    this._window.add_accel_group(uiManager.get_accel_group())

    return uiManager.get_widget('/TerminalPopup')
  },

  _forkUserShell (terminal, commandArgs = []) {
    terminal.reset(false, true)

    const args = this._getCommandArgs()

    let success, pid

    this.showMOTR(terminal)

    try {
      if (terminal.spawn_sync) { // 0.37.0
        [success, pid] = terminal.spawn_sync(Vte.PtyFlags.DEFAULT, GLib.get_home_dir(), args, this._getCommandEnv(),
          GLib.SpawnFlags.SEARCH_PATH, null, null)
      } else {
        [success, pid] = terminal.fork_command_full(Vte.PtyFlags.DEFAULT, GLib.get_home_dir(), args, this._getCommandEnv(),
          GLib.SpawnFlags.SEARCH_PATH, null)
      }

      if (commandArgs.length) {
        const extraCommand = commandArgs.join(' ') + '\n'
        this.setTimeout(() => terminal.feed_child(extraCommand, extraCommand.length), 250)
      }

      terminal._lastForkFailed = false
    } catch (e) {
      logError(e)

      terminal._lastForkFailed = true

      const cause = e.name + ' - ' + e.message

      this._bus.emit_signal('Failure',
        GLib.Variant.new('(ss)', ['ForkUserShellFailed', "Could not start the shell command line '" + args.join(' ') + "'."]))

      throw {
        name: 'ForkUserShellFailed',
        message: "Could not start the shell from command line '" + args.join(' ') +
                                                                         "' (cause: " + cause + ')'
      }
    }

    if (terminal.get_pty) { // 0.37.0
      // (nothing, the default is the user choice at build-time, which defaults to xterm anyway)
    } else {
      terminal.get_pty_object().set_term('xterm')
    }
  },

  showMOTR (terminal) {
    const currentVersion = '1.3.0'
    const lastVersion = this._settings.get_string(MOTR_VERSION_SETTING_KEY).trim()

    if (lastVersion !== currentVersion) {
      terminal.feed('\n\r')
      terminal.feed(' ▒█▄░▒█ █▀▀█ ▀█░█▀ █▀▀ █▀▄▀█ █▀▀▄ █▀▀ █▀▀█ 　 █▀█ █▀▀█ ▄█░ ▄▀▀▄ \n\r')
      terminal.feed(' ▒█▒█▒█ █░░█ ░█▄█░ █▀▀ █░▀░█ █▀▀▄ █▀▀ █▄▄▀ 　 ░▄▀ █▄▀█ ░█░ ▀▄▄█ \n\r')
      terminal.feed(' ▒█░░▀█ ▀▀▀▀ ░░▀░░ ▀▀▀ ▀░░░▀ ▀▀▀░ ▀▀▀ ▀░▀▀ 　 █▄▄ █▄▄█ ▄█▄ ░▄▄▀ \n\r')
      terminal.feed('\n\r')
      terminal.feed('  Release notes for 1.3.0\n\r')
      terminal.feed('\n\r')
      terminal.feed('  - Added support for the ~/.ssh/config file.\n\r')
      terminal.feed('    Now you can get quick access to any your ssh host in one click; \n\r')
      terminal.feed('\n\r')
      terminal.feed('  - Added support for ~/.config/drop-down-terminal-x/shortcuts file \n\r')
      terminal.feed('    Now you can define any action that will become available in a special drop-down list for quick launch. \n\r')
      terminal.feed('    This small improvement can improve your productivity \n\r')
      terminal.feed('    See file format at https://github.com/bigbn/drop-down-terminal-x')
      terminal.feed('\n\r')
      terminal.feed('\n\r')
      terminal.feed('  Thank you for choosing drop-down-terminal-x! \n\r')
      terminal.feed('\n\r')
      terminal.feed('\n\r')

      this._settings.set_string(MOTR_VERSION_SETTING_KEY, currentVersion)
    }
  },

  setTimeout (func, millis /* , ... args */) {
    let args = []
    if (arguments.length > 2) {
      args = args.slice.call(arguments, 2)
    }

    const id = Mainloop.timeout_add(millis, () => {
      func.apply(null, args)
      return false // Stop repeating
    }, null)

    return id
  },

  _refreshWindow: function () {
    const rect = this._window.window.get_frame_extents()
    this._window.window.invalidate_rect(rect, true)
  },

  _updateFont: function (tab) {
    const fontDescStr = this._interfaceSettings.get_string(FONT_NAME_SETTING_KEY)
    const fontDesc = Pango.FontDescription.from_string(fontDescStr)

    tab.terminal.set_font(fontDesc)
  },

  _updateBehaviour: function (tab) {
    const isTransparent = this._settings.get_boolean(TRANSPARENT_TERMINAL_SETTING_KEY)
    const transparencyLevel = this._settings.get_uint(TRANSPARENCY_LEVEL_SETTING_KEY) / 100.0
    const hasScrollbar = this._settings.get_boolean(SCROLLBAR_VISIBLE_SETTING_KEY)
    const scrollOnOutput = this._settings.get_boolean(SCROLL_ON_OUTPUT_SETTING_KEY)

    // updates the colors
    //
    // Note: to follow the deprecation scheme, we try first the _rgba variants as vte < 0.38
    //       already has the non-rgba-suffixed one but it was working with GdkColor back then,
    //       and passing a GdkRGBA would raise an exception
    const fgColor = Convenience.parseRgbaColor(this._settings.get_string(COLOR_FOREGROUND_SETTING_KEY))
    const bgColor = Convenience.parseRgbaColor(this._settings.get_string(COLOR_BACKGROUND_SETTING_KEY))

    if (tab.terminal.set_color_foreground_rgba) { // removed in vte 0.38
      tab.terminal.set_color_foreground_rgba(fgColor)
    } else {
      tab.terminal.set_color_foreground(fgColor)
    }

    // Note: by applying the transparency only to the background colour of the terminal, the text stays
    //       readable in any case
    bgColor.alpha = isTransparent ? transparencyLevel : bgColor.alpha

    if (tab.terminal.set_color_background_rgba) { // removed in vte 0.38
      tab.terminal.set_color_background_rgba(bgColor)
    } else {
      tab.terminal.set_color_background(bgColor)
    }

    tab.terminal.set_scroll_on_output(scrollOnOutput)
    tab.container.set_policy(Gtk.PolicyType.AUTOMATIC,
      hasScrollbar ? Gtk.PolicyType.ALWAYS : Gtk.PolicyType.NEVER)
  },

  _updateTabsSupport: function () {
    if (this._settings.get_boolean(ENABLE_TABS_SETTING_KEY)) {
      this._isTabsEnabled = true
      this.notebook.set_show_tabs(true)
    } else {
      this._isTabsEnabled = false
      this.notebook.set_show_tabs(false)
    }
  },

  _updateTabsPosition () {
    const position = this._settings.get_uint(TABS_POSITION_SETTING_KEY)
    const mapping = {
      0: Gtk.PositionType.TOP,
      3: Gtk.PositionType.BOTTOM,
      1: Gtk.PositionType.LEFT,
      2: Gtk.PositionType.RIGHT
    }

    this.notebook.set_tab_pos(mapping[position])
  },

  _updateUnfocusSupport: function () {
    if (this._settings.get_boolean(HIDE_ON_UNFOCUS_SETTING_KEY)) {
      this._isHideOnUnfocusEnabled = true
    } else {
      this._isHideOnUnfocusEnabled = false
    }
  },

  _updateEscapeSupport: function () {
    if (this._settings.get_boolean(HIDE_ON_ESCAPE_SETTING_KEY)) {
      this._isHideOnEscapeEnabled = true
    } else {
      this._isHideOnEscapeEnabled = false
    }
  },

  _updateAudibleIndicator: function (tab) {
    const enableBell = this._settings.get_boolean(ENABLE_AUDIBLE_BELL_KEY)
    tab.terminal.set_audible_bell(enableBell)
  },

  _updateCustomCommand: function (tab) {
    // get the custom command
    let command

    if (this._settings.get_boolean(RUN_CUSTOM_COMMAND_SETTING_KEY)) {
      command = this._settings.get_string(CUSTOM_COMMAND_SETTING_KEY).trim()
    } else {
      command = ''
    }

    // parses the command line
    this._customCommandArgs = command ? command.split(/\s+/) : []

    // tries to fork the shell again if it fails last time (the user might be trying different values,
    // we do not want the terminal to get stuck)
    if (tab.terminal._lastForkFailed) {
      this._forkUserShell(tab.terminal)
    }
  },

  _updateFocusMode: function (tab) {
    this._focusMode = this._desktopSettings ? this._desktopSettings.get_string(WM_FOCUS_MODE_SETTING_KEY)
      : FOCUS_MODE_CLICK
  },

  _windowMouseEnter: function (window, event) {
    if (this._focusMode != FOCUS_MODE_CLICK) {
      this.Focus()
    }
  },

  _terminalButtonPressed: function (terminal, event) {
    if (this._focusMode == FOCUS_MODE_CLICK) {
      this.Focus()
    }
  },

  _terminalButtonReleased: function (terminal, event) {
    const [has_state, state] = event.get_state()
    const [is_button, button] = event.get_button()

    // opens hovered link on ctrl+left-click
    if (is_button && button == Gdk.BUTTON_PRIMARY && (state & Gdk.ModifierType.CONTROL_MASK)) {
      const [preserved, x, y] = event.get_coords()

      const border = new Gtk.Border()
      terminal.style_get_property('inner-border', border)

      const column = (x - border.left) / terminal.get_char_width()
      const row = (y - border.top) / terminal.get_char_height()

      const [match, tag] = terminal.match_check(column, row)

      if (match) {
        const properties = this._uriHandlingPropertiesbyTag[tag]
        this._openUri(match, properties.flavor, event.get_screen(), event.get_time())
      }

      return true
    }

    // opens the popup menu on right click (not using event.triggers_context_menu to avoid eating
    // Shift-F10 for Midnight Commander or an app like that)
    //
    // Note: we do not update the paste sensitivity as this requires API not available (Gdk.Atom and SELECTION_CLIPBOARD)
    //       thus we do not handle copy sensitivity either (this makes more sense and is less code)
    if (is_button && button == Gdk.BUTTON_SECONDARY) {
      terminal.popup.popup(null, null, null, button, event.get_time())
      return true
    }

    return false
  },

  _openUri: function (uri, flavor, screen, time) {
    if (flavor == UriFlavor.DefaultToHttp) {
      uri = 'http:' + uri
    } else if (flavor == UriFlavor.Email && !uri.match(/^mailto:/i)) {
      uri = 'mailto:' + uri
    }

    Gtk.show_uri(screen, uri, time)
  },

  _getCommandArgs () {
    // custom command
    if (this._customCommandArgs.length > 0) {
      return this._customCommandArgs
    }

    // user shell
    try {
      const [parsed, args] = GLib.shell_parse_argv(Vte.get_user_shell())
      if (parsed) return args
    } catch (e) {
      log(e)
      // nothing: we continue silently as this is totally expected
    }

    // falls back to the classic Bourne shell
    return ['/bin/sh']
  },

  _getCommandEnv: function () {
    // builds the environment
    const env = {}

    GLib.listenv().forEach(function (name) {
      env[name] = GLib.getenv(name)
    })

    delete env.COLUMNS
    delete env.LINES
    delete env.GNOME_DESKTOP_ICON

    env.COLORTERM = 'drop-down-terminal-x'
    env.TERM = 'xterm-256color'

    // gets an array of key=value pairs
    const envArray = []

    for (const key in env) {
      envArray.push(key + '=' + (env[key] ? env[key] : ''))
    }

    return envArray
  },

  _createAction: function (name, label, stockId, accel, actionGroup, callback) {
    const action = new Gtk.Action({ name: name, label: label, stock_id: stockId })
    action.connect('activate', callback)
    actionGroup.add_action_with_accel(action, accel)

    return action
  }
})

// sets a nice program name and initializes gtk
Gtk.init(null, 0)

// sets the setting to prefer a dark theme
Gtk.Settings.get_default()['gtk-application-prefer-dark-theme'] = true

// creates the terminal
const terminal = new DropDownTerminalX()
GLib.set_prgname('drop-down-terminal-x')

// starts the main loop
Gtk.main()
