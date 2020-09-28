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
const Mainloop = imports.mainloop

imports.gi.versions.Gdk = '3.0'
imports.gi.versions.GdkX11 = '3.0'
imports.gi.versions.Gtk = '3.0'

const Clutter = imports.gi.Clutter
const Cogl = imports.gi.Cogl
const Gdk = imports.gi.Gdk
const GdkX11 = imports.gi.GdkX11
const Gio = imports.gi.Gio
const GLib = imports.gi.GLib
const Gtk = imports.gi.Gtk
const Meta = imports.gi.Meta
const Pango = imports.gi.Pango
const St = imports.gi.St
const Shell = imports.gi.Shell

const Main = imports.ui.main
const ModalDialog = imports.ui.modalDialog

const _ = Gettext.gettext
const Config = imports.misc.config
const ExtensionSystem = imports.ui.extensionSystem
const ExtensionUtils = imports.misc.extensionUtils
const Me = imports.misc.extensionUtils.getCurrentExtension()
const Util = imports.misc.util
const Convenience = Me.imports.convenience

// constants
const ANIMATION_CONFLICT_EXTENSION_UUIDS = [
  'window-open-animation-rotate-in@mengzhuo.org',
  'window-open-animation-slide-in@mengzhuo.org',
  'window-open-animation-scale-in@mengzhuo.org'
]

const TERMINAL_WINDOW_ACTOR_NAME = 'dropDownTerminalXWindow'
const TERMINAL_WINDOW_WM_CLASS = 'DropDownTerminalXWindow'

const FIRST_START_SETTING_KEY = 'first-start'
const ENABLE_ANIMATION_SETTING_KEY = 'enable-animation'
const OPENING_ANIMATION_TIME_SETTING_KEY = 'opening-animation-time'
const CLOSING_ANIMATION_TIME_SETTING_KEY = 'closing-animation-time'
const TERMINAL_SIZE_SETTING_KEY = 'terminal-size'
const TERMINAL_LEFT_PADDING_SETTING_KEY = 'terminal-left-padding'
const TERMINAL_RIGHT_PADDING_SETTING_KEY = 'terminal-right-padding'
const TERMINAL_TOP_PADDING_SETTING_KEY = 'terminal-top-padding'
const TERMINAL_BOTTOM_PADDING_SETTING_KEY = 'terminal-bottom-padding'
const TOGGLE_SHORTCUT_SETTING_KEY = 'other-shortcut'
const ENABLE_TOGGLE_ON_SCROLL_SETTING_KEY = 'enable-toggle-on-scroll'
const TERMINAL_POSITION_SETTING_KEY = 'terminal-position'
const MULTI_MONITOR_MODE_SETTING_KEY = 'multi-monitor-mode'

const NEW_TAB_SHORTCUT_SETTING_KEY = 'new-tab-shortcut'
const PREV_TAB_SHORTCUT_SETTING_KEY = 'prev-tab-shortcut'
const NEXT_TAB_SHORTCUT_SETTING_KEY = 'next-tab-shortcut'
const CLOSE_TAB_SHORTCUT_SETTING_KEY = 'close-tab-shortcut'

const INCREASE_TEXT_SHORTCUT_SETTING_KEY = 'increase-text-shortcut'
const DECREASE_TEXT_SHORTCUT_SETTING_KEY = 'decrease-text-shortcut'
const FULLSCREEN_SHORTCUT_SETTING_KEY = 'toggle-fullscreen-shortcut'
const CAPTURE_FOCUS_SETTING_KEY = 'capture-focus-shortcut'

const PRIMARY_MONITOR_SETTING_KEY = 'primary-monitor'

const TOP_EDGE = 0
const LEFT_EDGE = 1
const RIGHT_EDGE = 2
const BOTTOM_EDGE = 3

const SHELL_VERSION = 10 * parseFloat('0.' + Config.PACKAGE_VERSION.split('.').join('')).toFixed(10)

const console = {
  log: (...args) => {
    print(args.map((msg) => String(msg)).join('\t'))
  }
}

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
        <method name="ToggleFullscreen">
            <arg name="enable" type="b" direction="in"/>
        </method>
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

// window border effect class
//
// we should use a delegate to avoid the GType crashes (https://bugzilla.gnome.org/show_bug.cgi?id=688973)
// but we can't since the Clutter.Effect is abstract, so let's add a crappy hack there
if (window.__DDTInstance === undefined) window.__DDTInstance = 1

const SouthBorderEffect = new Lang.Class({
  Name: 'SouthBorderEffect-' + window.__DDTInstance++,
  Extends: Clutter.Effect,

  _init () {
    this.parent()
    this._color = new Cogl.Color()
    this._color.init_from_4ub(0x1c, 0x1f, 0x1f, 0xff)
    this._width = 1
  },

  vfunc_paint (paintContext) {
    const actor = this.get_actor()
    if (paintContext.get_framebuffer) {
      const framebuffer = paintContext.get_framebuffer();
      const coglContext = framebuffer.get_context();      
      const alloc = actor.get_allocation_box()
      actor.continue_paint(paintContext)
      let pipeline = new Cogl.Pipeline(coglContext);
      pipeline.set_color(this._color)
      framebuffer.draw_rectangle(pipeline, 0, alloc.get_height(), alloc.get_width(), alloc.get_height() - this._width)
    } else {
      const geom = actor.get_allocation_geometry();
      actor.continue_paint();
      Cogl.set_source_color(this._color);
      Cogl.rectangle(0, geom.height, geom.width, geom.height - this._width);
    }    
  }
})

// missing dependencies dialog
const MissingVteDialog = new Lang.Class({
  Name: 'MissingDepsDialog',

  _init () {
    this._delegate = new ModalDialog.ModalDialog({ styleClass: 'modal-dialog' })

    this._delegate.setButtons([{
      label: _('Close'),
      action: Lang.bind(this._delegate, this._delegate.close),
      key: Clutter.Escape,
      default: true
    }])

    const errorIcon = new St.Icon({
      icon_name: 'dialog-error-symbolic',
      icon_size: 24,
      style_class: 'run-dialog-error-icon'
    })

    const titleLabel = new St.Label({ text: _('Vte library missing') })
    const messageLabel = new St.Label({
      text: _("The 'Drop Down Terminal' extension requires the Vte library (version >= 0.31) and its gir typelib.\n" +
                                                   '\n' +
                                                   'Please install:\n' +
                                                   "    - on Fedora/Arch: the 'vte3' package (you certainly uninstalled it)\n" +
                                                   "    - on Debian/Ubuntu: the 'gir-1.2-vte-2.*' package (not installed by default)\n" +
                                                   "    - on openSUSE: the 'typelib-1_0-Vte-2.*' package (not installed by default)\n" +
                                                   '\n' +
                                                   'Then, log out.')
    })
    messageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE
    messageLabel.clutter_text.line_wrap = true

    const titleBox = new St.BoxLayout()
    titleBox.add(errorIcon)
    titleBox.add(new St.Label({ text: '  ' }))
    titleBox.add(titleLabel, { x_fill: true })

    const box = new St.BoxLayout({ vertical: true })
    box.add(titleBox)
    box.add(new St.Label({ text: '  ' }))
    box.add(messageLabel)

    this._delegate.contentLayout.add(box)
  },

  open () {
    this._delegate.open()
  }
})

// extension class
const DropDownTerminalXExtension = new Lang.Class({
  Name: 'DropDownTerminalXExtension',

  _init () {
    // retrieves the settings
    this.fullscreenEnabled = false
    this._settings = Convenience.getSettings(Me.path, Me.metadata.id)
  },

  enable () {
    // initializes the child pid and bus proxy members early as it used to know if it has been spawn already
    this._childPid = null

    // initializes other members used to toggle the terminal
    this._busProxy = null
    this._windowActor = null
    this._firstDisplay = true
    this._currentMonitor = null

    // initializes if we should toggle on bus name appearance
    this._toggleOnBusNameAppearance = false

    // check dependencies
    this._checkDependencies()

    // animation setup
    this._display = global.screen ? global.screen.get_display() : global.display
    this._windowCreatedHandlerId = this._display.connect('window-created', Lang.bind(this, this._windowCreated))
    this._actorMappedHandlerId = global.window_manager.connect('map', Lang.bind(this, this._windowMapped))

    // geometry update on monitor configuration change or panel size change
    this._monitorsChangedHandlerId = Main.layoutManager.connect('monitors-changed', () => {
      Convenience.throttle(100, this, this._updateWindowGeometry) // throttles at 10Hz (it's an "heavy weight" setting)
    })

    this._panelAllocationNotificationHandlerId = Main.layoutManager.panelBox.connect('notify::allocation', () => {
      Convenience.throttle(100, this, this._updateWindowGeometry) // throttles at 10Hz (it's an "heavy weight" setting)
    })
    
    this._connectPanelScrollEvent()
    const busRun = (actionName, ...args) => this._busProxy && this._busProxy[actionName](...args)

    this.bindings = [
      [TOGGLE_SHORTCUT_SETTING_KEY, this._toggle, true],
      [NEW_TAB_SHORTCUT_SETTING_KEY, () => busRun('NewTabRemote')],
      [PREV_TAB_SHORTCUT_SETTING_KEY, () => busRun('PrevTabRemote')],
      [NEXT_TAB_SHORTCUT_SETTING_KEY, () => busRun('NextTabRemote')],
      [CLOSE_TAB_SHORTCUT_SETTING_KEY, () => busRun('CloseTabRemote')],
      [INCREASE_TEXT_SHORTCUT_SETTING_KEY, () => busRun('IncreaseFontSizeRemote')],
      [DECREASE_TEXT_SHORTCUT_SETTING_KEY, () => busRun('DecreaseFontSizeRemote')],
      [CAPTURE_FOCUS_SETTING_KEY, () => busRun('FocusRemote')],
      [FULLSCREEN_SHORTCUT_SETTING_KEY, () => {
        this.fullscreenEnabled = !this.fullscreenEnabled
        this._updateWindowGeometry(this.fullscreenEnabled)
        busRun('ToggleFullscreenRemote', this.fullscreenEnabled)
      }]
    ]

    // honours setting changes
    this._settingChangedHandlerIds = [
      this._settings.connect('changed::' + ENABLE_TOGGLE_ON_SCROLL_SETTING_KEY, Lang.bind(this, this._updateToggleOnScroll)),
      // -------------------------
      ...[
        ENABLE_ANIMATION_SETTING_KEY,
        OPENING_ANIMATION_TIME_SETTING_KEY,
        CLOSING_ANIMATION_TIME_SETTING_KEY
      ].map((key) => {
        return this._settings.connect('changed::' + key, () => this._updateAnimationProperties())
      }),

      // -------------------------

      ...[
        [TERMINAL_SIZE_SETTING_KEY, 'size changed'],
        [PRIMARY_MONITOR_SETTING_KEY, 'primary monitor changed'],
        [TERMINAL_LEFT_PADDING_SETTING_KEY, 'left padding changed'],
        [TERMINAL_RIGHT_PADDING_SETTING_KEY, 'right padding changed'],
        [TERMINAL_TOP_PADDING_SETTING_KEY, 'top padding changed'],
        [TERMINAL_BOTTOM_PADDING_SETTING_KEY, 'bottom padding changed'],
        [TERMINAL_POSITION_SETTING_KEY, 'position changed'],
        [MULTI_MONITOR_MODE_SETTING_KEY, 'multi monitor mode changed']
      ].map(([key, message]) => {
        return this._settings.connect('changed::' + key, () => {
          if (this._windowActor !== null) {
            this._windowActor.remove_clip()
            Convenience.throttle(100, this, () => {
              this._updateCurrentMonitor()
              this._updateWindowGeometry()
            }) // throttles at 10Hz (it's an "heavy weight" setting)
          }
        })
      }),

      // -------------------------
      ...this.bindings.map(([key, action, isGlobal]) => {
        return this._settings.connect('changed::' + key, () => {
          if (this.visible || isGlobal) {
            this._unbindShortcut(key)
            this._bindShortcut(key, action)
          }
        })
      })
    ]

    // applies the settings initially
    this._updateCurrentMonitor()
    this._updateAnimationProperties()
    this._updateToggleOnScroll()
    this._updateWindowGeometry()

    // Applying bindging only for global shortcuts (toggle)
    this.temporaryBindings = this.bindings.filter(([key, action, isGlobal]) => !isGlobal)
    this.bindings.filter(([key, action, isGlobal]) => isGlobal).forEach(([key, action]) => this._bindShortcut(key, action))

    // registers the bus name watch
    this._busWatchId = Gio.DBus.session.watch_name('pro.bigbn.DropDownTerminalX',
      Gio.BusNameWatcherFlags.NONE,
      Lang.bind(this, this._busNameAppeared),
      Lang.bind(this, this._busNameVanished),
      null, null)

    // change the ctrl-alt-tab popup switcher to ignore our window as we will handle it ourself
    // (for the look and also because the focus switching needs a hack in our case)
    this._oldCtrlAltTabManagerPopupFunc = Main.ctrlAltTabManager.popup

    Main.ctrlAltTabManager.popup = Lang.bind(this, function (backward, binding, mask) {
      const oldGetTabList = this._display.get_tab_list

      this._display.get_tab_list = Lang.bind(this, function (type, screen, workspace) {
        let windows = Lang.bind(this._display, oldGetTabList)(type, screen, workspace)
        windows = windows.filter((win) => win.get_wm_class() !== TERMINAL_WINDOW_WM_CLASS)
        return windows
      })

      Lang.bind(Main.ctrlAltTabManager, this._oldCtrlAltTabManagerPopupFunc)(backward, binding, mask)

      this._display.get_tab_list = oldGetTabList
    })

    const focusManager = global.focus_manager
    this._oldFocusManagerAddGroupFunc = focusManager.add_group
    this._oldFocusManagerRemoveGroupFunc = focusManager.remove_group

    // finds our window out if we come back from the locking screen for instance
    const windowActors = global.get_window_actors()

    for (const i in windowActors) {
      if (windowActors[i].get_meta_window().get_wm_class() === TERMINAL_WINDOW_WM_CLASS) {
        this._setWindowActor(windowActors[i])
        break
      }
    }

    // handles the first start
    this._handleFirstStart()
  },

  disable () {
    // unbinds the shortcut
    this.bindings.forEach(([key]) => this._unbindShortcut(key))

    // removes the ctrl-alt-tab group
    if (this._windowActor !== null) {
      Main.ctrlAltTabManager.removeGroup(this._windowActor)
    }

    // restores the monkey patched functions
    Main.ctrlAltTabManager.popup = this._oldCtrlAltTabManagerPopupFunc
    global.focus_manager.add_group = this._oldFocusManagerAddGroupFunc
    global.focus_manager.remove_group = this._oldFocusManagerRemoveGroupFunc

    // issue #6: Terminal lost after screen is locked
    //
    // gnome-shell 3.6 introduces a new screen shield that disables all extensions: this is not a problem
    // for almost all extensions but this is a real killer for this one as the terminal must quit on disable!
    //
    // the extension already rebinds with the terminal on enable, so we just need not to quit the terminal
    // if the screen is getting locked
    const lockingScreen = (Main.sessionMode.currentMode === 'unlock-dialog' || // unlock-dialog == shield/curtain (before lock-screen w/ gdm)
                             Main.sessionMode.currentMode === 'lock-screen') // lock-screen == lock screen (after unlock-dialog or w/o gdm)

    // checks if there is not an instance of a previous child, mainly because it survived a shell restart
    // (the shell reexec itself thus not letting the extensions a chance to properly shut down)
    if (this._childPid === null && this._busProxy !== null) this._childPid = this._busProxy.Pid

    // quit and/or kill the child process if it exists, except if we are going to the lock
    // screen, as the user will obviously unlock and he expects his terminal back
    if (!lockingScreen && this._childPid !== null) {
      try {
        // starts by asking to quit gracefully
        this._quitingChild = true
        this._busProxy.QuitRemote()

        // if the remote call succeeded, we forget about this process
        this._childPid = null
      } catch (e) {
        console.log('error asking the terminal to quit gracefully (cause: ' + e.name + ' - ' + e.message + ')')

        // quiting failed, so mark it and kills the process
        this._quitingChild = false
        this._killChild()
      }
    }

    // unregister the bus name watch
    Gio.DBus.session.unwatch_name(this._busWatchId)
    this._busWatchId = null

    // disconnects the setting listeners
    for (const i in this._settingChangedHandlerIds) {
      this._settings.disconnect(this._settingChangedHandlerIds[i])
    }

    this._settingChangedHandlerIds = null

    // disconnects signals and clears refs related to screen handling
    global.window_manager.disconnect(this._actorMappedHandlerId)
    Main.layoutManager.disconnect(this._monitorsChangedHandlerId)
    Main.layoutManager.panelBox.disconnect(this._panelAllocationNotificationHandlerId)
    
    this._disconnectPanelScrollEvent()
    this._display.disconnect(this._windowCreatedHandlerId)
    this._actorMappedHandlerId = null
    this._monitorsChangedHandlerId = null
    this._panelAllocationNotificationHandlerId = null
    this._panelScrollEventHandlerId = null
    this._windowCreatedHandlerId = null
    this._windowActor = null
    this._display = null
  },

  _toggle () {
    console.log('Asked to toggle')

    // checks if there is not an instance of a previous child, mainly because it survived a shell restart
    // (the shell reexec itself thus not letting the extensions a chance to properly shut down)
    if (this._childPid === null && this._busProxy !== null) {
      this._childPid = this._busProxy.Pid
    }

    // forks if the child does not exist (never started or killed)
    if (this._childPid === null) {
      console.log('forking and connecting to the terminal dbus interface')

      this._toggleOnBusNameAppearance = true
      this._forkChild()
    }

    // Make sure the current monitor is updated
    if (this._windowActor === null) {
      this._updateCurrentMonitor()
    }

    // FIXME: pull request #69, we should really not have to do that as we already monitor
    //        the "monitors-changed" signal
    this._updateWindowGeometry(this.fullscreenEnabled)
    
    // the bus proxy might not be ready, in this case we will be called later once the bus name appears
    if (this._busProxy !== null) {
      // if the actor is set, this means the terminal is opened, so we will handle closing
      if (this._windowActor) {
        const terminalPosition = this._settings.get_enum(TERMINAL_POSITION_SETTING_KEY)
        let targetY = this._windowY
        let targetX = this._windowX
        const animationTime = this._shouldAnimateWindow() ? this._closingAnimationTimeMillis / 1000.0 : 0

        switch (terminalPosition) {
          case LEFT_EDGE:
            targetX = this._windowX - this._windowActor.width
            break
          case RIGHT_EDGE:
            targetX = this._windowX + this._windowActor.width
            break
          case BOTTOM_EDGE:
            targetY = this._windowY + this._windowActor.height
            break
          case TOP_EDGE:
            targetY = this._windowY - this._windowActor.height
            break
        }

        moveActor(this._windowActor, {
          x: targetX,
          y: targetY,
          duration: animationTime,
          transition: 'easeInExpo',
          onUpdate: Lang.bind(this, this._updateClip),
          onComplete: Lang.bind(this, function () {
            // unregisters the ctrl-alt-tab group
            Main.ctrlAltTabManager.removeGroup(this._windowActor)

            // clears the window actor ref since we use it to know the window visibility
            this._windowActor = null

            // requests toggling asynchronously
            this._busProxy.ToggleRemote()
          })
        })
      } else {
        this._busProxy.ToggleRemote()
      }
    }
  },

  _panelScrolled (actor, event) {
    // checks if toggle on scroll is enabled
    const source = event.get_source()
    if (source !== actor) return

    if (!this._toggleOnScrollEnabled) return
    const direction = event.get_scroll_direction()

    if (direction !== Clutter.ScrollDirection.DOWN && direction !== Clutter.ScrollDirection.UP) return
    if (direction === Clutter.ScrollDirection.DOWN && this.visible) return
    if (direction === Clutter.ScrollDirection.UP && !this.visible) return

    this._toggle()
  },

  _updateAnimationProperties () {
    this._animationEnabled = this._settings.get_boolean(ENABLE_ANIMATION_SETTING_KEY)
    this._openingAnimationTimeMillis = this._settings.get_uint(OPENING_ANIMATION_TIME_SETTING_KEY)
    this._closingAnimationTimeMillis = this._settings.get_uint(CLOSING_ANIMATION_TIME_SETTING_KEY)
  },

  _updateToggleOnScroll () {
    this._toggleOnScrollEnabled = this._settings.get_boolean(ENABLE_TOGGLE_ON_SCROLL_SETTING_KEY)
  },

  _updateCurrentMonitor () {
    const screenProxy = global.screen || global.display
    let monitorIndex = Number(this._settings.get_string(PRIMARY_MONITOR_SETTING_KEY))
    const multiMonitorMode = this._settings.get_boolean(MULTI_MONITOR_MODE_SETTING_KEY)
    // Get current monitor index based on cursor position
    if (multiMonitorMode) {
      const gdkDisplay = Gdk.Display.get_default()
      const [, mouseX, mouseY] = gdkDisplay.get_device_manager().get_client_pointer().get_position()
      const {x, y, width, height} = gdkDisplay.get_monitor_at_point(mouseX, mouseY).get_geometry()
      monitorIndex = screenProxy.get_monitor_index_for_rect(new Meta.Rectangle({x, y, width, height}))
    }
    if (monitorIndex === -1) monitorIndex = screenProxy.get_primary_monitor()
    this._currentMonitor = Main.layoutManager.monitors[monitorIndex] || Main.layoutManager.primaryMonitor
  },

  _updateWindowGeometry (fullscreen) {
    console.log('Updating window geometry', fullscreen)

    const terminalPosition = this._settings.get_enum(TERMINAL_POSITION_SETTING_KEY)

    // computes the window geometry except the height
    const sizeSpec = this._settings.get_string(TERMINAL_SIZE_SETTING_KEY)
    const leftPaddingSpec = this._settings.get_string(TERMINAL_LEFT_PADDING_SETTING_KEY)
    const rightPaddingSpec = this._settings.get_string(TERMINAL_RIGHT_PADDING_SETTING_KEY)
    const topPaddingSpec = this._settings.get_string(TERMINAL_TOP_PADDING_SETTING_KEY)
    const bottomPaddingSpec = this._settings.get_string(TERMINAL_BOTTOM_PADDING_SETTING_KEY)

    const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor
    const workarea = Main.layoutManager.getWorkAreaForMonitor(this._currentMonitor.index)

    const x1 = workarea.x / scaleFactor
    const y1 = workarea.y / scaleFactor
    const screenHeight = workarea.height / scaleFactor
    const screenWidth = workarea.width / scaleFactor

    const x2 = x1 + screenWidth
    const y2 = y1 + screenHeight

    const leftPadding = this._evaluateSizeSpec(this._currentMonitor, leftPaddingSpec, false)
    const rightPadding = this._evaluateSizeSpec(this._currentMonitor, rightPaddingSpec, false)
    const topPadding = this._evaluateSizeSpec(this._currentMonitor, topPaddingSpec, true)
    const bottomPadding = this._evaluateSizeSpec(this._currentMonitor, bottomPaddingSpec, true)

    switch (terminalPosition) {
      case LEFT_EDGE: {
        this._windowX = x1
        this._windowY = y1
        this._windowWidth = this._evaluateSizeSpec(this._currentMonitor, sizeSpec, false)
        this._windowHeight = screenHeight
        break
      }
      case RIGHT_EDGE: {
        const width = this._evaluateSizeSpec(this._currentMonitor, sizeSpec, false)
        this._windowX = x2 - width
        this._windowY = y1
        this._windowWidth = width
        this._windowHeight = screenHeight
        break
      }
      case BOTTOM_EDGE: {
        const height = this._evaluateSizeSpec(this._currentMonitor, sizeSpec, true)
        this._windowX = x1
        this._windowY = y2 - height
        this._windowWidth = screenWidth
        this._windowHeight = height
        break
      }
      default:
      case TOP_EDGE:
        this._windowX = x1
        this._windowY = y1
        this._windowWidth = screenWidth
        this._windowHeight = this._evaluateSizeSpec(this._currentMonitor, sizeSpec, true)
        break
    }

    this._windowX = this._windowX + leftPadding
    this._windowY = this._windowY + topPadding
    this._windowWidth = this._windowWidth - leftPadding - rightPadding
    this._windowHeight = this._windowHeight - topPadding - bottomPadding

    if (fullscreen) {
      this._windowX = workarea.x
      this._windowY = workarea.y
      this._windowWidth = workarea.width
      this._windowHeight = workarea.height
    }

    // applies the change dynamically if the terminal is already spawn
    if (this._busProxy !== null && this._windowHeight !== null) {
      this._busProxy.SetGeometryRemote(this._windowX, this._windowY, this._windowWidth, this._windowHeight)
    } else if (this._windowActor != null) this._windowActor.set_position(this._windowX, this._windowY)
    return false
  },

  _bindShortcut (key, action) {
    // introduced in 3.16
    if (Main.wm.addKeybinding && Shell.ActionMode) Main.wm.addKeybinding(key, this._settings, Meta.KeyBindingFlags.NONE, Shell.ActionMode.NORMAL, action.bind(this))
    // introduced in 3.7.5
    else if (Main.wm.addKeybinding && Shell.KeyBindingMode) Main.wm.addKeybinding(key, this._settings, Meta.KeyBindingFlags.NONE, Shell.KeyBindingMode.NORMAL | Shell.KeyBindingMode.MESSAGE_TRAY, action.bind(this))
  },

  _unbindShortcut (key) {
    if (Main.wm.removeKeybinding) Main.wm.removeKeybinding(key)
    else global.display.remove_keybinding(key)
  },

  _windowCreated (display, window) {
    // filter out the terminal window using its wmclass
    if (String(window.get_wm_class()) !== TERMINAL_WINDOW_WM_CLASS) {
      return
    }

    // gets and decorates the actor
    // the opening sequence will be animated when the window will be mapped, in _windowMapped
    this._setWindowActor(window.get_compositor_private())
  },

  _windowMapped (wm, actor) {
    // filter out the actor using its name
    if (String(actor.get_name()) !== TERMINAL_WINDOW_ACTOR_NAME) {
      return
    }

    // a lambda to request the focus asynchronously
    const requestFocusAsync = Lang.bind(this, function () {
      if (this._busProxy !== null) {
        this._busProxy.FocusRemote()
      }
    })

    // requests the focus asynchronously
    requestFocusAsync()

    // a lambda to complete the opening sequence
    const completeOpening = Lang.bind(this, function () {
      // registers a ctrl-alt-tab group
      Main.ctrlAltTabManager.addGroup(this._windowActor, _('Drop Down Terminal'), 'utilities-terminal-symbolic',
        { focusCallback: Lang.bind(this, requestFocusAsync) })
    })

    // animate the opening sequence if applicable
    if (this._shouldAnimateWindow() && this._openingAnimationTimeMillis > 0) {
      // FIXME: we should reset those on monitors-changed
      //
      // to avoid an animation glitch where we could briefly see the window at its target position before the animation starts,
      // we initialize the animation in this thread -at actor mapping time- so the window is not yet visible and can be placed out of the screen
      //
      // Update: starting from mutter 3.7.90, there is no animation at all if the actor is not displayed (out of the screen) at map time.
      //         This might be a side-effect of the new frame synchronization changes. To work around that until I figure out a better fix,
      //         schedule the whole animation in the next frame (idle_add) and make the actor transparent until the animation starts
      //         (to avoid the brief window appearance which is the original issue).
      //
      //         Tonic: I added a workaround by making sure at least one pixel is on the screen.
      this._windowActor.opacity = 0

      Mainloop.idle_add(Lang.bind(this, function () {
        const terminalPosition = this._settings.get_enum(TERMINAL_POSITION_SETTING_KEY)

        this._windowActor.opacity = 255

        // Workaround animation bug by making sure the window is partially on screen.
        const workaround = 1

        switch (terminalPosition) {
          case LEFT_EDGE:
            this._windowActor.set_position(this._windowX - this._windowActor.width + workaround, this._windowY)
            break
          case RIGHT_EDGE:
            this._windowActor.set_position(this._windowX + this._windowActor.width - workaround, this._windowY)
            break
          case BOTTOM_EDGE:
            this._windowActor.set_position(this._windowX, this._windowY + this._windowActor.height - workaround)
            break
          default:
          case TOP_EDGE:
            this._windowActor.set_position(this._windowX, this._windowY - this._windowActor.height + workaround)
            break
        }
        
        moveActor(this._windowActor, {
          y: this._windowY,
          x: this._windowX,
          onUpdate: Lang.bind(this, this._updateClip),
          scale_y: 1.0,
          duration: this._openingAnimationTimeMillis / 1000.0,
          transition: 'easeOutExpo',
          onComplete: completeOpening
        })
      }))
    } else {
      completeOpening()
    }
  },

  _forkChild () {
    // resets the child finishing flags
    this._quitingChild = false
    this._killingChild = false

    // finds the forking arguments
    const args = ['gjs', GLib.build_filenamev([Me.path, 'terminal.js']), Me.path]

    // forks the process
    console.log("forking '" + args.join(' ') + "'")

    let success, pid

    try {
      [success, pid] = GLib.spawn_async(null, args, this._getCommandEnv(),
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null)
    } catch (err) {
      log(err.message)
      log('--------')
      log(JSON.stringify(this._getCommandEnv()))
      // beautify the most common error message
      if (err.code == GLib.SpawnError.G_SPAWN_ERROR_NOENT) {
        err.message = _('gjs not found in PATH')
      }

      console.log('failed to fork the terminal script (' + err.code + ', ' + err.message + ')')

      // The exception from gjs contains an error string like:
      //   Error invoking GLib.spawn_command_line_async: Failed to
      //   execute child process "foo" (No such file or directory)
      // We are only interested in the part in the parentheses. (And
      // we can't pattern match the text, since it gets localized.)
      err.message = err.message.replace(/.*\((.+)\)/, '$1')

      Main.notifyError(_('Drop Down Terminal failed to start'), _('Cause: %s').format(err.message))

      throw err
    }

    // keep the child pid around
    this._childPid = pid

    // adds a watch to know when the child process ends
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this._childExited))
  },

  _killChild () {
    if (this._childPid !== null) {
      // we are killing the child ourself, so set the flag telling this is intended
      this._killingChild = true

      const args = ['kill', '-9', '' + this._childPid]

      try {
        GLib.spawn_sync(null, args, null, GLib.SpawnFlags.SEARCH_PATH, null, null)
      } catch (e) {
        logError(e, 'Failed to kill process ' + this._childPid)
        Main.notifyError(_('Could not kill the Drop Down Terminal'),
          _('The terminal process could not be terminated.') + '\n\n' + _('You can activate the debug mode to nail down the issue'))
      }
    }
  },

  _childExited: function (pid, status) {
    // closes the process
    GLib.spawn_close_pid(pid)

    // check the exit status
    if (!this._quitingChild && !this._killingChild) {
      console.log('terminal exited abruptly with status ' + status)

      Main.notifyError(_('Drop Down Terminal ended abruptly'), _('You can activate the debug mode to nail down the issue'))
    }

    // forgets the child and the bus proxy
    this._forgetChild()
  },

  _busNameAppeared (connection, name, nameOwner) {
    // creates a dbus proxy on the interface exported by the child process
    const DropDownTerminalXDBusProxy = Gio.DBusProxy.makeProxyWrapper(DropDownTerminalXIface)

    this._busProxy = new DropDownTerminalXDBusProxy(Gio.DBus.session, 'pro.bigbn.DropDownTerminalX', '/pro/bigbn/DropDownTerminalX')

    // connects to the Failure signal to report errors
    this._busProxy.connectSignal('Failure', Lang.bind(this, function (proxy, sender, [name, cause]) {
      console.log('failure reported by the terminal: ' + cause)

      if (name === 'ForkUserShellFailed') {
        Main.notifyError(_('Drop Down Terminal failed to start'),
          _('The user shell could not be spawn in the terminal.') + '\n\n' + _('You can activate the debug mode to nail down the issue'))
      } else {
        Main.notifyError(_('An error occured in the Drop Down Terminal'),
          cause + '\n\n' + _('You can activate the debug mode to nail down the issue'))
      }
    }))

    this._busProxy.connectSignal('VisibilityStateChanged', (proxy, sender, [visible]) => {
      this.visible = visible
      if (visible) {
        this.temporaryBindings.forEach(([key, action]) => this._bindShortcut(key, action))
        this._busProxy && this._busProxy.ToggleFullscreenRemote(this.fullscreenEnabled)
      } else {
        this.temporaryBindings.forEach(([key, action]) => this._unbindShortcut(key))
      }
    })

    this._busProxy.connectSignal('SettingsRequested', (proxy, sender, [visible]) => {
      Util.spawn(['gnome-shell-extension-prefs', Me.metadata.uuid])
    })

    // applies the geometry if applicable
    if (this._windowHeight !== null) {
      this._busProxy.SetGeometryRemote(this._windowX, this._windowY, this._windowWidth, this._windowHeight)
    }

    // initial toggling if explicitely asked to, since we we can also be called on a shell restart
    // (the shell reexec itself thus not letting the extensions a chance to properly shut down)
    if (this._toggleOnBusNameAppearance) {
      this._toggle()
      this._toggleOnBusAppearance = false
    }
  },

  _busNameVanished (connection, name) {
    // forgets the bus proxy and the child entirely since they will be automatically picked
    // up again once available, even if that means spawning the child again if necessary
    this._forgetChild()
  },

  _forgetChild () {
    // destroys the dbus proxy aggressively
    delete this._busProxy
    this._busProxy = null

    // forgets about the child pid too, it will be find out again at the next toggle if the bus is
    // activated meanwhile
    this._childPid = null
  },

  _setWindowActor (actor) {
    // adds a gray border on south of the actor to mimick the shell borders
    actor.clear_effects()
    actor.add_effect(new SouthBorderEffect())

    // sets a distinctive name for the actor
    actor.set_name(TERMINAL_WINDOW_ACTOR_NAME)

    // keeps the ref
    this._windowActor = actor
  },

  _evaluateSizeSpec (monitor, heightSpec, vertical) {
    // updates the height from the height spec, so it's picked
    const match = heightSpec.trim().match(/^([1-9]\d*)\s*(px|%)$/i)

    if (match === null) {
      return null
    }

    const value = parseInt(match[1])
    const type = match[2]

    if (type.toLowerCase() === 'px') {
      return (value >= 0) ? value : null
    } else {
      if (value < 0 || value > 100) {
        return null
      }

      const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor

      if (vertical) {
        const monitorHeight = monitor.height / scaleFactor
        const panelHeight = Main.layoutManager.panelBox.height
        return parseInt((monitorHeight - panelHeight) * value / 100.0)
      } else {
        const monitorWidth = monitor.width / scaleFactor
        return parseInt(monitorWidth * value / 100.0)
      }
    }
  },

  _updateClip () {
    const monitor = this._currentMonitor
    if (!this._windowActor || !this._windowActor.hasOwnProperty('allocation')) return
    const a = this._windowActor.allocation
    const clip = new Clutter.ActorBox({
      x1: Math.max(monitor.x, a.x1),
      y1: Math.max(monitor.y, a.y1),
      x2: Math.min(monitor.x + monitor.width, a.x2),
      y2: Math.min(monitor.y + monitor.height, a.y2)
    })

    clip.x1 -= this._windowActor.x
    clip.x2 -= this._windowActor.x
    clip.y1 -= this._windowActor.y
    clip.y2 -= this._windowActor.y

    this._windowActor.set_clip(clip.x1, clip.y1, clip.x2 - clip.x1, clip.y2 - clip.y1)
  },

  _shouldAnimateWindow () {
    if (!this._animationEnabled || !Main.wm._shouldAnimate()) {
      return false
    }

    if (Main.extensionManager) {
      // since gnome 3.36
      for (const extUUID in Main.extensionManager.getUuids()) {
        const ext = Main.extensionManager.lookup(extUUID)
        if (ext && ANIMATION_CONFLICT_EXTENSION_UUIDS.indexOf(ext.uuid) >= 0 && ext.state == ExtensionSystem.ExtensionState.ENABLED) {
          return false
        }
      }  
    } else {
      // for legacy versions 
      for (const ext in ExtensionUtils.extensions) {
        if (ANIMATION_CONFLICT_EXTENSION_UUIDS.indexOf(ext.uuid) >= 0 && ext.state == ExtensionSystem.ExtensionState.ENABLED) {
          return false
        }
      }
    }
    
    return true
  },

  _getCommandEnv () {
    // builds the environment
    const env = {}

    GLib.listenv().forEach(function (name) {
      env[name] = GLib.getenv(name)
    })

    env.GJS_PATH = Me.path

    // gets an array of key=value pairs
    const envArray = []

    for (const key in env) {
      envArray.push(key + '=' + (env[key] ? env[key] : ''))
    }

    return envArray
  },

  _handleFirstStart () {
    // checks the first start key
    if (!this._settings.get_boolean(FIRST_START_SETTING_KEY)) {
      return
    }

    // opens the preferences up
    try {
      GLib.spawn_command_line_async('gnome-shell-extension-prefs ' + Me.uuid)
    } catch (err) {
      logError(err, 'Could not start gnome-shell-extension-prefs')
      Main.notifyError(_('Error while opening the preferences'), _('gnome-shell-extension-prefs could not be started, check your session log for more details'))
    }

    // updates the first start key
    this._settings.set_boolean(FIRST_START_SETTING_KEY, false)
  },

  _checkDependencies () {
    try {
      imports.gi.Vte
    } catch (e) {
      // creates and opens the dialog after 1 second
      Mainloop.timeout_add_seconds(1, function () {
        new MissingVteDialog().open()
        return false
      })

      logError(e, 'Vte could not be imported')
      throw e
    }
  },

  _connectPanelScrollEvent() {
    Main.panel.connect 
      ? this._panelScrollEventHandlerId = Main.panel.connect('scroll-event', Lang.bind(this, this._panelScrolled))
      : this._panelScrollEventHandlerId = Main.panel.actor.connect('scroll-event', Lang.bind(this, this._panelScrolled)) //can be dropped when debian-stable reaches 3.36
  },

  _disconnectPanelScrollEvent() {
    Main.panel.disconnect 
      ? Main.panel.disconnect(this._panelScrollEventHandlerId)
      : Main.panel.actor.disconnect(this._panelScrollEventHandlerId) // can be dropped when debian-stable reaches 3.36
  }
})

// extension init hook
function init () {
  return new DropDownTerminalXExtension()
}
