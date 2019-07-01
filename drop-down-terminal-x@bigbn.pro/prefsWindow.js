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
// ['grave'] //RT

const Lang = imports.lang
const Gettext = imports.gettext.domain('drop-down-terminal-x')

const GLib = imports.gi.GLib
const GObject = imports.gi.GObject
const Gio = imports.gi.Gio
const Gtk = imports.gi.Gtk
const Gdk = imports.gi.Gdk

const _ = Gettext.gettext

// setting keys
const ENABLE_ANIMATION_SETTING_KEY = 'enable-animation'
const OPENING_ANIMATION_TIME_SETTING_KEY = 'opening-animation-time'
const CLOSING_ANIMATION_TIME_SETTING_KEY = 'closing-animation-time'
const TRANSPARENT_TERMINAL_SETTING_KEY = 'transparent-terminal'
const SCROLLBAR_VISIBLE_SETTING_KEY = 'scrollbar-visible'
const TERMINAL_SIZE_SETTING_KEY = 'terminal-size'
const TERMINAL_LEFT_PADDING_SETTING_KEY = 'terminal-left-padding'
const TERMINAL_RIGHT_PADDING_SETTING_KEY = 'terminal-right-padding'
const TERMINAL_TOP_PADDING_SETTING_KEY = 'terminal-top-padding'
const TERMINAL_BOTTOM_PADDING_SETTING_KEY = 'terminal-bottom-padding'
const TERMINAL_POSITION_SETTING_KEY = 'terminal-position'
const TERMINAL_CURSOR_SETTING_KEY = 'terminal-cursor'
const TRANSPARENCY_LEVEL_SETTING_KEY = 'transparency-level'
const TOGGLE_SHORTCUT_SETTING_KEY = 'other-shortcut'
const ENABLE_TOGGLE_ON_SCROLL_SETTING_KEY = 'enable-toggle-on-scroll'
const FOREGROUND_COLOR_SETTING_KEY = 'foreground-color'
const BACKGROUND_COLOR_SETTING_KEY = 'background-color'
const RUN_CUSTOM_COMMAND_SETTING_KEY = 'run-custom-command'
const CUSTOM_COMMAND_SETTING_KEY = 'custom-command'
const ENABLE_AUDIBLE_BELL_KEY = 'enable-audible-bell'
const ENABLE_TABS_SETTING_KEY = 'enable-tabs'
const HIDE_ON_UNFOCUS_SETTING_KEY = 'hide-on-unfocus'
const HIDE_ON_ESCAPE_SETTING_KEY = 'hide-on-escape'

const NEW_TAB_SHORTCUT_SETTING_KEY = 'new-tab-shortcut'
const PREV_TAB_SHORTCUT_SETTING_KEY = 'prev-tab-shortcut'
const NEXT_TAB_SHORTCUT_SETTING_KEY = 'next-tab-shortcut'
const CLOSE_TAB_SHORTCUT_SETTING_KEY = 'close-tab-shortcut'

const INCREASE_TEXT_SHORTCUT_SETTING_KEY = 'increase-text-shortcut'
const DECREASE_TEXT_SHORTCUT_SETTING_KEY = 'decrease-text-shortcut'

const PRIMARY_MONITOR_SETTING_KEY = 'primary-monitor'
const MULTI_MONITOR_MODE_SETTING_KEY = 'multi-monitor-mode'

// tree view columns
const COLUMN_KEY = 0
const COLUMN_MODS = 1

// settings widget
var DropDownTerminalSettingsWidget = new GObject.Class({
  Name: 'DropDownTerminal.Prefs.DropDownTerminalSettingsWidget',
  GTypeName: 'DropDownTerminalSettingsWidget',
  Extends: Gtk.Box,

  _init: function ({ path, metadata, convenience }) {
    this.parent()

    log(_('Tabs'))

    this._convenience = convenience

    this.orientation = Gtk.Orientation.VERTICAL
    this.spacign = 0

    // creates the settings
    this._settings = this._convenience.getSettings(path, metadata.id)

    // creates the ui builder and add the main resource file
    let uiFilePath = path + '/prefs.gtkbuilder'
    let builder = this.builder = new Gtk.Builder()

    if (builder.add_from_file(uiFilePath) === 0) {
      log('could not load the ui file: %s'.format(uiFilePath))

      let label = new Gtk.Label({
        label: _('Could not load the preferences UI file'),
        vexpand: true
      })

      this.pack_start(label, true, true, 0)
    } else {
      // gets the interesting builder objects
      let mainNotebook = builder.get_object('main-notebook')
      let enableAnimationCheckButton = builder.get_object('enable-animation-checkbutton')
      let openingAnimationTimeSpinButton = builder.get_object('opening-animation-time-spinbutton')
      let closingAnimationTimeSpinButton = builder.get_object('closing-animation-time-spinbutton')
      let transparentTerminalCheckButton = builder.get_object('transparent-terminal-checkbutton')
      let scrollbarVisibleCheckButton = builder.get_object('scrollbar-visible-checkbutton')
      let terminalSizeEntry = builder.get_object('terminal-size-entry')
      let terminalSizeResetButton = builder.get_object('terminal-size-reset-button')
      let terminalLeftPaddingEntry = builder.get_object('terminal-left-padding-entry')
      let terminalLeftPaddingResetButton = builder.get_object('terminal-left-padding-reset-button')
      let terminalRightPaddingEntry = builder.get_object('terminal-right-padding-entry')
      let terminalRightPaddingResetButton = builder.get_object('terminal-right-padding-reset-button')
      let terminalTopPaddingEntry = builder.get_object('terminal-top-padding-entry')
      let terminalTopPaddingResetButton = builder.get_object('terminal-top-padding-reset-button')
      let terminalBottomPaddingEntry = builder.get_object('terminal-bottom-padding-entry')
      let terminalBottomPaddingResetButton = builder.get_object('terminal-bottom-padding-reset-button')
      let transparencyLevelSpinButton = builder.get_object('transparency-level-spinbutton')
      let enableToggleOnScrollCheckButton = builder.get_object('enable-toggle-on-scroll-checkbutton')
      let foregroundColorResetButton = builder.get_object('foreground-color-reset-button')
      let backgroundColorResetButton = builder.get_object('background-color-reset-button')
      let positionComboBox = builder.get_object('position-combobox')
      let cursorComboBox = builder.get_object('cursor-combobox')
      let enableAudibleBellCheckButton = builder.get_object('enable-audible-bell-checkbutton')
      let enableTabsCheckButton = builder.get_object('enable-tabs-checkbutton')
      let enableHideOnUnfocusButton = builder.get_object('hide-on-unfocus-checkbutton')
      let enableHideOnEscapeButton = builder.get_object('hide-on-escape-checkbutton')

      this._foregroundColorButton = builder.get_object('foreground-color-button')
      this._backgroundColorButton = builder.get_object('background-color-button')

      this._makeShortcutEdit('other-shortcut-treeview', 'shortcut-liststore', TOGGLE_SHORTCUT_SETTING_KEY)
      this._makeShortcutEdit('new-tab-shortcut-treeview', 'new-tab-shortcut-liststore', NEW_TAB_SHORTCUT_SETTING_KEY)
      this._makeShortcutEdit('prev-tab-shortcut-treeview', 'prev-tab-shortcut-liststore', PREV_TAB_SHORTCUT_SETTING_KEY)
      this._makeShortcutEdit('next-tab-shortcut-treeview', 'next-tab-shortcut-liststore', NEXT_TAB_SHORTCUT_SETTING_KEY)
      this._makeShortcutEdit('close-tab-shortcut-treeview', 'close-tab-shortcut-liststore', CLOSE_TAB_SHORTCUT_SETTING_KEY)
      this._makeShortcutEdit('increase-text-shortcut-treeview', 'increase-text-shortcut-liststore', INCREASE_TEXT_SHORTCUT_SETTING_KEY)
      this._makeShortcutEdit('decrease-text-shortcut-treeview', 'decrease-text-shortcut-liststore', DECREASE_TEXT_SHORTCUT_SETTING_KEY)

      this._initMonitorWidgets()

      this._runCustomCommandCheckButton = builder.get_object('run-custom-command-checkbutton')
      this._customCommandBox = builder.get_object('custom-command-box')
      this._customCommandEntry = builder.get_object('custom-command-entry')

      // packs the main box
      this.pack_start(mainNotebook, true, true, 0)
      // gives a hint on invalid window height input (does not prevent from writing a wrong value)
      terminalSizeEntry.connect('changed', () => this._validatePaddingValue(terminalSizeEntry, true));

      [ terminalLeftPaddingEntry,
        terminalRightPaddingEntry,
        terminalTopPaddingEntry,
        terminalBottomPaddingEntry
      ].forEach(view => view.connect('changed', () => this._validatePaddingValue(view)))

      // binds the animation enablement setting
      this._settings.bind(ENABLE_ANIMATION_SETTING_KEY, enableAnimationCheckButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the animation time settings
      openingAnimationTimeSpinButton.connect('value-changed', Lang.bind(this, function (button) {
        this._settings.set_uint(OPENING_ANIMATION_TIME_SETTING_KEY, button.get_value_as_int())
      }))
      openingAnimationTimeSpinButton.set_value(this._settings.get_uint(OPENING_ANIMATION_TIME_SETTING_KEY))

      closingAnimationTimeSpinButton.connect('value-changed', Lang.bind(this, function (button) {
        this._settings.set_uint(CLOSING_ANIMATION_TIME_SETTING_KEY, button.get_value_as_int())
      }))
      closingAnimationTimeSpinButton.set_value(this._settings.get_uint(CLOSING_ANIMATION_TIME_SETTING_KEY))

      // binds the terminal transparency setting
      this._settings.bind(TRANSPARENT_TERMINAL_SETTING_KEY, transparentTerminalCheckButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the scrollbar visibility setting
      this._settings.bind(SCROLLBAR_VISIBLE_SETTING_KEY, scrollbarVisibleCheckButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the tabs state setting
      this._settings.bind(ENABLE_TABS_SETTING_KEY, enableTabsCheckButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the unfocus state setting
      this._settings.bind(HIDE_ON_UNFOCUS_SETTING_KEY, enableHideOnUnfocusButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the hide on escape state setting
      this._settings.bind(HIDE_ON_ESCAPE_SETTING_KEY, enableHideOnEscapeButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the terminal height setting
      this._settings.bind(TERMINAL_SIZE_SETTING_KEY, terminalSizeEntry, 'text', Gio.SettingsBindFlags.DEFAULT)
      terminalSizeResetButton.connect('clicked', Lang.bind(this, function () { this._settings.reset(TERMINAL_SIZE_SETTING_KEY) }))

      // binds the terminal padding setting
      this._settings.bind(TERMINAL_LEFT_PADDING_SETTING_KEY, terminalLeftPaddingEntry, 'text', Gio.SettingsBindFlags.DEFAULT)
      terminalLeftPaddingResetButton.connect('clicked', Lang.bind(this, function () { this._settings.reset(TERMINAL_LEFT_PADDING_SETTING_KEY) }))

      // binds the terminal padding setting
      this._settings.bind(TERMINAL_RIGHT_PADDING_SETTING_KEY, terminalRightPaddingEntry, 'text', Gio.SettingsBindFlags.DEFAULT)
      terminalRightPaddingResetButton.connect('clicked', Lang.bind(this, function () { this._settings.reset(TERMINAL_RIGHT_PADDING_SETTING_KEY) }))

      // binds the terminal padding setting
      this._settings.bind(TERMINAL_TOP_PADDING_SETTING_KEY, terminalTopPaddingEntry, 'text', Gio.SettingsBindFlags.DEFAULT)
      terminalTopPaddingResetButton.connect('clicked', Lang.bind(this, function () { this._settings.reset(TERMINAL_TOP_PADDING_SETTING_KEY) }))

      // binds the terminal padding setting
      this._settings.bind(TERMINAL_BOTTOM_PADDING_SETTING_KEY, terminalBottomPaddingEntry, 'text', Gio.SettingsBindFlags.DEFAULT)
      terminalBottomPaddingResetButton.connect('clicked', Lang.bind(this, function () { this._settings.reset(TERMINAL_BOTTOM_PADDING_SETTING_KEY) }))

      // binds the toggle on scroll setting
      this._settings.bind(ENABLE_TOGGLE_ON_SCROLL_SETTING_KEY, enableToggleOnScrollCheckButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the custom command settings
      this._settings.bind(RUN_CUSTOM_COMMAND_SETTING_KEY, this._runCustomCommandCheckButton, 'active', Gio.SettingsBindFlags.DEFAULT)
      this._settings.bind(CUSTOM_COMMAND_SETTING_KEY, this._customCommandEntry, 'text', Gio.SettingsBindFlags.DEFAULT)

      this._runCustomCommandCheckButton.connect('notify::active', Lang.bind(this, this._runCustomCommandCheckButtonToggled))
      this._customCommandEntry.connect('changed', Lang.bind(this, this._checkCustomCommandEntry))

      this._runCustomCommandCheckButtonToggled()
      this._checkCustomCommandEntry()

      // binds the terminal bett setting
      this._settings.bind(ENABLE_AUDIBLE_BELL_KEY, enableAudibleBellCheckButton, 'active', Gio.SettingsBindFlags.DEFAULT)

      // binds the color settings
      this._foregroundColorButton.connect('color-set', Lang.bind(this, function () {
        this._settings.set_string(FOREGROUND_COLOR_SETTING_KEY, this._foregroundColorButton.rgba.to_string())
        this._updateForegroundColorButton()
      }))

      this._backgroundColorButton.connect('color-set', Lang.bind(this, function () {
        this._settings.set_string(BACKGROUND_COLOR_SETTING_KEY, this._backgroundColorButton.rgba.to_string())
        this._updateBackgroundColorButton()
      }))

      foregroundColorResetButton.connect('clicked', Lang.bind(this, function () {
        this._settings.reset(FOREGROUND_COLOR_SETTING_KEY)
        this._updateForegroundColorButton()
      }))

      backgroundColorResetButton.connect('clicked', Lang.bind(this, function () {
        this._settings.reset(BACKGROUND_COLOR_SETTING_KEY)
        this._updateBackgroundColorButton()
      }))

      this._updateForegroundColorButton()
      this._updateBackgroundColorButton()

      // binds the transparency level
      transparencyLevelSpinButton.connect('value-changed', Lang.bind(this, function (button) {
        this._settings.set_uint(TRANSPARENCY_LEVEL_SETTING_KEY, button.get_value_as_int())
      }))

      transparencyLevelSpinButton.set_value(this._settings.get_uint(TRANSPARENCY_LEVEL_SETTING_KEY))

      // binds the terminal position setting
      // this._settings.bind(TERMINAL_POSITION_SETTING_KEY, positionComboBox, "active", Gio.SettingsBindFlags.DEFAULT);
      positionComboBox.set_active(this._settings.get_enum(TERMINAL_POSITION_SETTING_KEY))
      positionComboBox.connect('changed', Lang.bind(this, function (widget) {
        this._settings.set_enum(TERMINAL_POSITION_SETTING_KEY, widget.get_active())
      }))

      // binds the terminal cursor type setting
      cursorComboBox.set_active(this._settings.get_enum(TERMINAL_CURSOR_SETTING_KEY))
      cursorComboBox.connect('changed', Lang.bind(this, function (widget) {
        this._settings.set_enum(TERMINAL_CURSOR_SETTING_KEY, widget.get_active())
      }))
    }
  },

  _makeShortcutEdit (widgetId, storeId, settingKey, defaultValue) {
    let view = this.builder.get_object(widgetId)
    let store = this.builder.get_object(storeId)
    let renderer = new Gtk.CellRendererAccel({ editable: true })
    let column = new Gtk.TreeViewColumn()
    let iter = store.append()

    let updateShortcutRow = (accel) => {
      let [key, mods] = accel ? Gtk.accelerator_parse(accel) : [0, 0]
      store.set(iter, [COLUMN_KEY, COLUMN_MODS], [key, mods])
    }

    renderer.connect('accel-edited', (renderer, path, key, mods, hwCode) => {
      let accel = Gtk.accelerator_name(key, mods)
      updateShortcutRow(accel)
      this._settings.set_strv(settingKey, [accel])
    })

    renderer.connect('accel-cleared', (renderer, path) => {
      updateShortcutRow(null)
      this._settings.set_strv(settingKey, [])
    })

    this._settings.connect('changed::' + settingKey, () => {
      updateShortcutRow(this._settings.get_strv(settingKey)[0])
    })

    column.pack_start(renderer, true)
    column.add_attribute(renderer, 'accel-key', COLUMN_KEY)
    column.add_attribute(renderer, 'accel-mods', COLUMN_MODS)

    view.append_column(column)
    updateShortcutRow(this._settings.get_strv(settingKey)[0])
  },

  _validatePaddingValue (view, strictMode) {
    let match = view.get_text().trim().match(/^([0-9]\d*)\s*(px|%)$/i)
    let valid = (match !== null)

    if (valid) {
      let value = parseInt(match[1])
      let type = match[2]

      if (type.toLowerCase() === 'px') {
        valid = strictMode ? (value > 0) : (value >= 0)
      } else {
        valid = strictMode ? (value > 0 && value <= 100) : (value >= 0 && value <= 100)
      }
    }

    view['secondary-icon-name'] = valid ? null : 'dialog-warning-symbolic'
    view['secondary-icon-tooltip-text'] = valid ? null : _('Invalid syntax or range')
  },

  _updateForegroundColorButton: function () {
    this._foregroundColorButton.set_rgba(this._convenience.parseRgbaColor(this._settings.get_string(FOREGROUND_COLOR_SETTING_KEY)))
  },

  _updateBackgroundColorButton: function () {
    this._backgroundColorButton.set_rgba(this._convenience.parseRgbaColor(this._settings.get_string(BACKGROUND_COLOR_SETTING_KEY)))
  },

  _runCustomCommandCheckButtonToggled: function () {
    this._customCommandBox.set_sensitive(this._runCustomCommandCheckButton.get_active())
    this._checkCustomCommandEntry()
  },

  _checkCustomCommandEntry: function () {
    let runCustomCommand = this._runCustomCommandCheckButton.get_active()
    let error = null

    if (runCustomCommand) {
      let customCommand = this._customCommandEntry.get_text().trim()

      try {
        let [parsed, args] = GLib.shell_parse_argv(customCommand)
        if (!parsed) {
          error = _('no argument found')
        }
      } catch (e) {
        error = e.message
      }
    }

    this._customCommandEntry['secondary-icon-name'] = error ? 'dialog-warning-symbolic' : null
    this._customCommandEntry['secondary-icon-tooltip-text'] = error ? `Error parsing command: ${error}` : null
  },

  _initMonitorWidgets () {
    let monitorComboxbox = this.builder.get_object('monitor-combobox')
    let monitorListstore = this.builder.get_object('monitors-liststore')
    let multyMonitorCheckbox = this.builder.get_object('multi-monitor-checkbox')
    let primaryMonitorIndex = this._settings.get_string(PRIMARY_MONITOR_SETTING_KEY)
    let monitors = []

    monitorListstore.set(monitorListstore.append(), [0, 1], ['-1', _('Default (Primary monitor)')])
    for (let i = 0, monitorNum = Gdk.Screen.get_default().get_n_monitors(); i < monitorNum; ++i) {
      monitorListstore.set(monitorListstore.append(), [0, 1], [String(i), _('Monitor') + ' ' + (i + 1)])
      monitors.push(i)
    }

    monitorComboxbox.set_id_column(0)
    monitorComboxbox.set_sensitive(!multyMonitorCheckbox.get_active())
    multyMonitorCheckbox.connect('toggled', () => monitorComboxbox.set_sensitive(!multyMonitorCheckbox.get_active()))

    monitorComboxbox.set_id_column(0)
    monitorComboxbox.set_active_id(primaryMonitorIndex)

    monitorComboxbox.connect('changed', (entry) => {
      let [success, iter] = monitorComboxbox.get_active_iter()
      if (!success) return
      let monitorIndex = monitorListstore.get_value(iter, 0)
      this._settings.set_string(PRIMARY_MONITOR_SETTING_KEY, monitorIndex)
    })

    /*
    if (monitors.length === 1) {
      multyMonitorCheckbox.set_sensitive(false)
      monitorComboxbox.set_sensitive(false)
    }
    */

    let renderer = new Gtk.CellRendererText()
    monitorComboxbox.pack_start(renderer, true)
    monitorComboxbox.add_attribute(renderer, 'text', 1)

    this._settings.bind(MULTI_MONITOR_MODE_SETTING_KEY, multyMonitorCheckbox, 'active', Gio.SettingsBindFlags.DEFAULT)
  }
})
