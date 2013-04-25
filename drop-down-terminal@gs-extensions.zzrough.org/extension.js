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
const Gettext = imports.gettext.domain("drop-down-terminal");
const Mainloop = imports.mainloop;

const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const Shell = imports.gi.Shell;

const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Tweener = imports.ui.tweener;

const _ = Gettext.gettext;
const Config = imports.misc.config;
const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;


// constants
const ANIMATION_CONFLICT_EXTENSION_UUIDS = [
    "window-open-animation-rotate-in@mengzhuo.org",
    "window-open-animation-slide-in@mengzhuo.org",
    "window-open-animation-scale-in@mengzhuo.org"
];

const TERMINAL_WINDOW_ACTOR_NAME = "dropDownTerminalWindow";
const TERMINAL_WINDOW_WM_CLASS = "DropDownTerminalWindow";
const DEBUG = false;

const FIRST_START_SETTING_KEY = "first-start";
const ENABLE_ANIMATION_SETTING_KEY = "enable-animation";
const OPENING_ANIMATION_TIME_SETTING_KEY = "opening-animation-time";
const CLOSING_ANIMATION_TIME_SETTING_KEY = "closing-animation-time";
const TERMINAL_HEIGHT_SETTING_KEY = "terminal-height";
const REAL_SHORTCUT_SETTING_KEY = "real-shortcut";

const SHELL_VERSION = 10 * parseFloat("0." + Config.PACKAGE_VERSION.split(".").join("")).toFixed(10);

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


// helper to only log in debug mode
function debug(text) { DEBUG && log("[DDT] " + text); }


// window border effect class
//
// we should use a delegate to avoid the GType crashes (https://bugzilla.gnome.org/show_bug.cgi?id=688973)
// but we can't since the Clutter.Effect is abstract, so let's add a crappy hack there
if (window.__DDTInstance === undefined) {
    window.__DDTInstance = 1;
}

const GraySouthBorderEffect = new Lang.Class({
    Name: "GraySouthBorderEffect-" + window.__DDTInstance++,
    Extends: Clutter.Effect,

    _init: function() {
        this.parent();

        this._width = 2;
        this._color = new Cogl.Color();
        this._color.init_from_4ub(0xa5, 0xa5, 0xa5, 0xff);
    },

    vfunc_paint: function() {
        let actor = this.get_actor();
        let geom = actor.get_allocation_geometry();

        actor.continue_paint();

        Cogl.set_source_color(this._color);
        Cogl.rectangle(0, geom.height, geom.width, geom.height - this._width);
    },
});


// missing dependencies dialog
const MissingVteDialog = new Lang.Class({
    Name: "MissingDepsDialog",

    _init: function() {
        this._delegate = new ModalDialog.ModalDialog({styleClass: "modal-dialog"});

        this._delegate.setButtons([{ label:   _("Close"),
                                     action:  Lang.bind(this._delegate, this._delegate.close),
                                     key:     Clutter.Escape,
                                     default: true
                                   }]);

        let errorIcon = new St.Icon({ icon_name: "dialog-error-symbolic",
                                      icon_size: 24,
                                      style_class: "run-dialog-error-icon" });

        let titleLabel = new St.Label({ text: _("Vte library missing") });
        let messageLabel = new St.Label({ text:  _("The 'Drop Down Terminal' extension requires the Vte library (version >= 0.31) and its gir typelib.\n" +
                                                   "\n" +
                                                   "Please install:\n" +
                                                   "    - on Fedora/Arch: the 'vte3' package (you certainly uninstalled it)\n" +
                                                   "    - on Debian/Ubuntu: the 'gir-1.2-vte-2.90' package (not installed by default)\n" +
                                                   "\n" +
                                                   "Then, log out.") });
        messageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        messageLabel.clutter_text.line_wrap = true;

        let titleBox = new St.BoxLayout();
        titleBox.add(errorIcon);
        titleBox.add(new St.Label({ text: '  ' }));
        titleBox.add(titleLabel, { x_fill: true });

        let box = new St.BoxLayout({ vertical: true });
        box.add(titleBox);
        box.add(new St.Label({ text: '  ' }));
        box.add(messageLabel);

        this._delegate.contentLayout.add(box);
    },

    open: function() {
        this._delegate.open();
    }
});


// extension class
const DropDownTerminalExtension = new Lang.Class({
    Name: "DropDownTerminalExtension",

    _init: function() {
        // retrieves the settings
        this._settings = Convenience.getSettings(Me.path, Me.metadata.id);
    },

    enable: function() {
        // initializes the child pid and bus proxy members early as it used to know if it has been spawn already
        this._childPid = null;

        // initializes other members used to toggle the terminal
        this._busProxy = null;
        this._windowActor = null;
        this._firstDisplay = true;

        // initializes if we should toggle on bus name appearance 
        this._toggleOnBusNameAppearance = false;

        // check dependencies
        this._checkDependencies();

        // animation setup
        this._display = global.screen.get_display();
        this._windowCreatedHandlerId = this._display.connect("window-created", Lang.bind(this, this._windowCreated));
        this._actorMappedHandlerId = global.window_manager.connect("map", Lang.bind(this, this._windowMapped));

        // geometry update on monitor configuration change or panel size change
        this._monitorsChangedHandlerId = Main.layoutManager.connect("monitors-changed", Lang.bind(this, this._updateWindowGeometry));
        this._panelAllocationNotificationHandlerId = Main.panel.actor.connect("notify::allocation", Lang.bind(this, this._updateWindowGeometry));

        // applies the settings initially
        this._updateAnimationProperties();
        this._updateWindowGeometry();
        this._bindShortcut();

        // honours setting changes
        this._settingChangedHandlerIds = [
            this._settings.connect("changed::" + ENABLE_ANIMATION_SETTING_KEY, Lang.bind(this, this._updateAnimationProperties)),
            this._settings.connect("changed::" + OPENING_ANIMATION_TIME_SETTING_KEY, Lang.bind(this, this._updateAnimationProperties)),
            this._settings.connect("changed::" + CLOSING_ANIMATION_TIME_SETTING_KEY, Lang.bind(this, this._updateAnimationProperties)),

            this._settings.connect("changed::" + TERMINAL_HEIGHT_SETTING_KEY, Lang.bind(this, function() {
                Convenience.throttle(200, this, this._updateWindowGeometry); // throttles 200ms (it's an "heavy weight" setting)
            })),

            this._settings.connect("changed::" + REAL_SHORTCUT_SETTING_KEY, Lang.bind(this, function() {
                this._unbindShortcut();
                this._bindShortcut();
            }))
        ];

        // registers the bus name watch
        this._busWatchId = Gio.DBus.session.watch_name("org.zzrough.GsExtensions.DropDownTerminal",
                                                        Gio.BusNameWatcherFlags.NONE,
                                                        Lang.bind(this, this._busNameAppeared),
                                                        Lang.bind(this, this._busNameVanished),
                                                        null, null);

        // change the ctrl-alt-tab popup switcher to ignore our window as we will handle it ourself
        // (for the look and also because the focus switching needs a hack in our case)
        this._oldCtrlAltTabManagerPopupFunc = Main.ctrlAltTabManager.popup;

        Main.ctrlAltTabManager.popup = Lang.bind(this, function(backward, binding, mask) {
            let oldGetTabList = this._display.get_tab_list;

            this._display.get_tab_list = Lang.bind(this, function(type, screen, workspace) {
                let windows = Lang.bind(this._display, oldGetTabList)(type, screen, workspace);
                windows = windows.filter(function(win) { return win.get_wm_class() != TERMINAL_WINDOW_WM_CLASS; });
                return windows;
            });

            Lang.bind(Main.ctrlAltTabManager, this._oldCtrlAltTabManagerPopupFunc)(backward, binding, mask);

            this._display.get_tab_list = oldGetTabList;
        });

        let focusManager = global.focus_manager;
        this._oldFocusManagerAddGroupFunc = focusManager.add_group;
        this._oldFocusManagerRemoveGroupFunc = focusManager.remove_group;

        if (SHELL_VERSION < 3.73) {
            focusManager.add_group = Lang.bind(this, function(root) {
                if (root instanceof St.Widget)
                    Lang.bind(focusManager, this._oldFocusManagerAddGroupFunc)(root);
            });

            focusManager.remove_group = Lang.bind(this, function(root) {
                if (root instanceof St.Widget)
                    Lang.bind(focusManager, this._oldFocusManagerRemoveGroupFunc)(root);
            });
        }

        // finds our window out if we come back from the locking screen for instance
        let windowActors = global.get_window_actors();

        for (let i in windowActors) {
            if (windowActors[i].get_meta_window().get_wm_class() == TERMINAL_WINDOW_WM_CLASS) {
                this._setWindowActor(windowActors[i]);
                break;
            }
        }

        // handles the first start
        this._handleFirstStart();
    },

    disable: function() {
        // unbinds the shortcut
        this._unbindShortcut();

        // removes the ctrl-alt-tab group
        if (this._windowActor !== null) {
            Main.ctrlAltTabManager.removeGroup(this._windowActor);
        }

        // restores the monkey patched functions
        Main.ctrlAltTabManager.popup = this._oldCtrlAltTabManagerPopupFunc;
        global.focus_manager.add_group = this._oldFocusManagerAddGroupFunc
        global.focus_manager.remove_group = this._oldFocusManagerRemoveGroupFunc

        // issue #6: Terminal lost after screen is locked
        //
        // gnome-shell 3.6 introduces a new screen shield that disables all extensions: this is not a problem
        // for almost all extensions but this is a real killer for this one as the terminal must quit on disable!
        //
        // the extension already rebinds with the terminal on enable, so we just need not to quit the terminal
        // if the screen is getting locked
        let lockingScreen = (Main.sessionMode.currentMode == "unlock-dialog"    // unlock-dialog == shield/curtain (before lock-screen w/ gdm)
                             || Main.sessionMode.currentMode == "lock-screen"); // lock-screen == lock screen (after unlock-dialog or w/o gdm)

        // checks if there is not an instance of a previous child, mainly because it survived a shell restart
        // (the shell reexec itself thus not letting the extensions a chance to properly shut down)
        if (this._childPid === null && this._busProxy !== null) {
            this._childPid = this._busProxy["Pid"];
        }

        // quit and/or kill the child process if it exists, except if we are going to the lock
        // screen, as the user will obviously unlock and he expects his terminal back
        if (!lockingScreen && this._childPid !== null) {
            try {
                // starts by asking to quit gracefully
                this._quitingChild = true;
                this._busProxy.QuitRemote();

                // if the remote call succeeded, we forget about this process
                this._childPid = null;
            } catch (e) {
                debug("error asking the terminal to quit gracefully (cause: " + e.name + " - " + e.message + ")");

                // quiting failed, so mark it and kills the process
                this._quitingChild = false;
                this._killChild();
            }
        }

        // unregister the bus name watch
        Gio.DBus.session.unwatch_name(this._busWatchId);
        this._busWatchId = null;

        // disconnects the setting listeners
        for (let i in this._settingChangedHandlerIds) {
            this._settings.disconnect(this._settingChangedHandlerIds[i]);
        }

        this._settingChangedHandlerIds = null;

        // disconnects signals and clears refs related to screen handling
        global.window_manager.disconnect(this._actorMappedHandlerId);
        Main.layoutManager.disconnect(this._monitorsChangedHandlerId);
        Main.panel.actor.disconnect(this._panelAllocationNotificationHandlerId);
        this._display.disconnect(this._windowCreatedHandlerId);
        this._actorMappedHandlerId = null;
        this._monitorsChangedHandlerId = null;
        this._panelAllocationNotificationHandlerId = null;
        this._windowCreatedHandlerId = null;
        this._windowActor = null;
        this._display = null;
    },

    _toggle: function() {
        debug("asked to toggle");

        // checks if there is not an instance of a previous child, mainly because it survived a shell restart
        // (the shell reexec itself thus not letting the extensions a chance to properly shut down)
        if (this._childPid === null && this._busProxy !== null) {
            this._childPid = this._busProxy["Pid"];
        }

        // forks if the child does not exist (never started or killed)
        if (this._childPid === null) {
            debug("forking and connecting to the terminal dbus interface");

            this._toggleOnBusNameAppearance = true;
            this._forkChild();
        }

        // the bus proxy might not be ready, in this case we will be called later once the bus name appears
        if (this._busProxy !== null) {

            // if the actor is set, this means the terminal is opened, so we will handle closing
            if (this._windowActor !== null) {
                let targetY = this._hasMonitorAbove() ? this._windowActor.y : -this._windowActor.height;
                let targetScaleY = this._hasMonitorAbove() ? 0.0 : 1.0;
                let animationTime = this._shouldAnimateWindow() ? this._closingAnimationTimeMillis / 1000.0 : 0;

                Tweener.addTween(this._windowActor, {
                    y: targetY,
                    scale_y: targetScaleY,
                    time: animationTime,
                    transition: "easeInExpo",
                    onComplete: Lang.bind(this, function() {
                                    // unregisters the ctrl-alt-tab group
                                    Main.ctrlAltTabManager.removeGroup(this._windowActor);

                                    // clears the window actor ref since we use it to know the window visibility
                                    this._windowActor = null;

                                    // requests toggling asynchronously
                                    this._busProxy.ToggleRemote();
                                })
                });
            } else {
                this._busProxy.ToggleRemote();
            }
        }
    },

    _updateAnimationProperties: function() {
        this._animationEnabled = this._settings.get_boolean(ENABLE_ANIMATION_SETTING_KEY);
        this._openingAnimationTimeMillis = this._settings.get_uint(OPENING_ANIMATION_TIME_SETTING_KEY);
        this._closingAnimationTimeMillis = this._settings.get_uint(CLOSING_ANIMATION_TIME_SETTING_KEY);
    },

    _updateWindowGeometry: function() {
        // computes the window geometry except the height
        let panelBox = Main.layoutManager.panelBox;
        this._windowX = panelBox.x;
        this._windowY = panelBox.y + panelBox.height;
        this._windowWidth = panelBox.width;

        // computes and keep the window height for use when the terminal will be spawn (if it is not already)
        let heightSpec = this._settings.get_string(TERMINAL_HEIGHT_SETTING_KEY);
        this._windowHeight = this._computeWindowHeight(heightSpec);

        // applies the change dynamically if the terminal is already spawn
        if (this._busProxy !== null && this._windowHeight !== null) {
            this._busProxy.SetGeometryRemote(this._windowX, this._windowY, this._windowWidth, this._windowHeight);
        }

        if (this._windowActor != null) {
            this._windowActor.set_position(this._windowX, this._windowY);
        }

        return false;
    },

    _bindShortcut: function() {
        if (Main.wm.addKeybinding && Shell.KeyBindingMode) // introduced in 3.7.5
            Main.wm.addKeybinding(REAL_SHORTCUT_SETTING_KEY, this._settings, Meta.KeyBindingFlags.NONE,
                                  Shell.KeyBindingMode.NORMAL | Shell.KeyBindingMode.MESSAGE_TRAY,
                                  Lang.bind(this, this._toggle));
        else if (Main.wm.addKeybinding && Main.KeybindingMode) // introduced in 3.7.2
            Main.wm.addKeybinding(REAL_SHORTCUT_SETTING_KEY, this._settings, Meta.KeyBindingFlags.NONE,
                                  Main.KeybindingMode.NORMAL | Main.KeybindingMode.MESSAGE_TRAY,
                                  Lang.bind(this, this._toggle));
        else
            global.display.add_keybinding(REAL_SHORTCUT_SETTING_KEY, this._settings, Meta.KeyBindingFlags.NONE,
                                          Lang.bind(this, this._toggle));

    },

    _unbindShortcut: function() {
        if (Main.wm.removeKeybinding) // introduced in 3.7.2
            Main.wm.removeKeybinding(REAL_SHORTCUT_SETTING_KEY);
        else
            global.display.remove_keybinding(REAL_SHORTCUT_SETTING_KEY);
    },

    _windowCreated: function(display, window) {
        // filter out the terminal window using its wmclass
        if (window.get_wm_class() != TERMINAL_WINDOW_WM_CLASS) {
            return;
        }

        // gets and decorates the actor
        // the opening sequence will be animated when the window will be mapped, in _windowMapped
        this._setWindowActor(window.get_compositor_private());
    },

    _windowMapped: function(wm, actor) {
        // filter out the actor using its name
        if (actor.get_name() != TERMINAL_WINDOW_ACTOR_NAME) {
            return;
        }

        // a lambda to request the focus asynchronously
        let requestFocusAsync = Lang.bind(this, function() {
            if (this._busProxy !== null) {
                this._busProxy.FocusRemote();
            }
        });

        // requests the focus asynchronously
        requestFocusAsync();

        // a lambda to complete the opening sequence
        let completeOpening = Lang.bind(this, function() {
            // registers a ctrl-alt-tab group
            Main.ctrlAltTabManager.addGroup(this._windowActor, _("Drop Down Terminal"), 'utilities-terminal-symbolic',
                                            { focusCallback: Lang.bind(this, requestFocusAsync) });
        });

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
            this._windowActor.opacity = 0;

            Mainloop.idle_add(Lang.bind(this, function() {
                this._windowActor.opacity = 255;

                if (this._hasMonitorAbove()) {
                    this._windowActor.scale_y = 0.0;
                } else {
                    this._windowActor.set_position(this._windowX, -this._windowActor.height);
                }

                Tweener.addTween(this._windowActor, {
                    y: this._windowY,
                    scale_y: 1.0,
                    time: this._openingAnimationTimeMillis / 1000.0,
                    transition: "easeOutExpo",
                    onComplete: completeOpening
                });
            }));
        } else {
            completeOpening();
        }
    },

    _forkChild: function() {
        // resets the child finishing flags
        this._quitingChild = false;
        this._killingChild = false;

        // finds the forking arguments
        let args = ["gjs", GLib.build_filenamev([Me.path, "terminal.js"]), Me.path];

        // forks the process
        debug("forking '" + args.join(" ") + "'");

        let success, pid;

        try {
            [success, pid] = GLib.spawn_async(null, args, this._getCommandEnv(),
                                              GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                              null);
        } catch (err) {
            // beautify the most common error message
            if (err.code == GLib.SpawnError.G_SPAWN_ERROR_NOENT) {
                err.message = _("gjs not found in PATH");
            }

            debug("failed to fork the terminal script (" + err.code + ", " + err.message + ")");

            // The exception from gjs contains an error string like:
            //   Error invoking GLib.spawn_command_line_async: Failed to
            //   execute child process "foo" (No such file or directory)
            // We are only interested in the part in the parentheses. (And
            // we can't pattern match the text, since it gets localized.)
            err.message = err.message.replace(/.*\((.+)\)/, '$1');

            Main.notifyError(_("Drop Down Terminal failed to start"), _("Cause: %s").format(err.message));

            throw err;
        }

        // keep the child pid around
        this._childPid = pid;

        // adds a watch to know when the child process ends
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, this._childExited), null);
    },

    _killChild: function() {
        if (this._childPid !== null) {
            // we are killing the child ourself, so set the flag telling this is intended
            this._killingChild = true;

            let args = ["kill", "-9", "" + this._childPid];

            try {
                GLib.spawn_sync(null, args, null, GLib.SpawnFlags.SEARCH_PATH, null, null);
            } catch (e) {
                logError(e, "Failed to kill process " + this._childPid);
                Main.notifyError(_("Could not kill the Drop Down Terminal"),
                                 _("The terminal process could not be terminated.") + "\n\n" + _("You can activate the debug mode to nail down the issue"));
            }
        }
    },

    _childExited: function(pid, status) {
        // closes the process
        GLib.spawn_close_pid(pid);

        // check the exit status
        if (!this._quitingChild && !this._killingChild) {
            debug("terminal exited abruptly with status " + status);

            Main.notifyError(_("Drop Down Terminal ended abruptly"), _("You can activate the debug mode to nail down the issue"));
        }

        // forgets the child and the bus proxy
        this._forgetChild();
    },

    _busNameAppeared: function(connection, name, nameOwner) {
        // creates a dbus proxy on the interface exported by the child process
        let DropDownTerminalDBusProxy = Gio.DBusProxy.makeProxyWrapper(DropDownTerminalIface);

        this._busProxy = new DropDownTerminalDBusProxy(Gio.DBus.session, "org.zzrough.GsExtensions.DropDownTerminal", "/org/zzrough/GsExtensions/DropDownTerminal");

        // connects to the Failure signal to report errors
        this._busProxy.connectSignal("Failure", Lang.bind(this, function(proxy, sender, [name, cause]) {
            debug("failure reported by the terminal: " + cause);

            if (name == "ForkUserShellFailed") {
                Main.notifyError(_("Drop Down Terminal failed to start"),
                                 _("The user shell could not be spawn in the terminal.") + "\n\n" + _("You can activate the debug mode to nail down the issue"));
            } else {
                Main.notifyError(_("An error occured in the Drop Down Terminal"),
                                 cause + "\n\n" + _("You can activate the debug mode to nail down the issue"));
            }
        }));

        // applies the geometry if applicable
        if (this._windowHeight !== null) {
            this._busProxy.SetGeometrySync(this._windowX, this._windowY, this._windowWidth, this._windowHeight);
        }

        // initial toggling if explicitely asked to, since we we can also be called on a shell restart
        // (the shell reexec itself thus not letting the extensions a chance to properly shut down)
        if (this._toggleOnBusNameAppearance) {
            this._toggle();
            this._toggleOnBusAppearance = false;
        }
    },

    _busNameVanished: function(connection, name) {
        // forgets the bus proxy and the child entirely since they will be automatically picked
        // up again once available, even if that means spawning the child again if necessary
        this._forgetChild();
    },

    _forgetChild: function() {
        // destroys the dbus proxy aggressively
        delete this._busProxy;
        this._busProxy = null;

        // forgets about the child pid too, it will be find out again at the next toggle if the bus is
        // activated meanwhile
        this._childPid = null; 
    },

    _setWindowActor: function(actor) {
        // adds a gray border on south of the actor to mimick the shell borders
        actor.clear_effects();
        actor.add_effect(new GraySouthBorderEffect());

        // sets a distinctive name for the actor
        actor.set_name(TERMINAL_WINDOW_ACTOR_NAME);

        // keeps the ref
        this._windowActor = actor;
    },

    _computeWindowHeight: function(heightSpec) {
        // updates the height from the height spec, so it's picked 
        let match = heightSpec.trim().match(/^([1-9]\d*)\s*(px|%)$/i);

        if (match === null) {
            return null;
        }

        let value = parseInt(match[1]);
        let type = match[2];

        if (type.toLowerCase() == "px") {
            return (value > 0) ? value : null;
        } else {
            if (value <= 0 || value > 100) {
                return null;
            }

            let monitorHeight = Main.layoutManager.primaryMonitor.height;
            let panelHeight = Main.layoutManager.panelBox.height;

            return parseInt((monitorHeight - panelHeight) * value / 100.0);
        }
    },

    _hasMonitorAbove: function() {
        return Main.layoutManager.panelBox.y > 0;
    },

    _shouldAnimateWindow: function() {
        if (!this._animationEnabled || !Main.wm._shouldAnimate()) {
            return false;
        }

        for (let ext in ExtensionUtils.extensions) {
            if (ANIMATION_CONFLICT_EXTENSION_UUIDS.indexOf(ext.uuid) >= 0 && ext.state == ExtensionSystem.ExtensionState.ENABLED) {
                return false;
            }
        }

        return true;
    },

    _getCommandEnv: function() {
        // builds the environment
        let env = {};

        GLib.listenv().forEach(function(name) {
            env[name] = GLib.getenv(name);
        });

        env["GJS_PATH"] = Me.path;

        // gets an array of key=value pairs
        let envArray = [];

        for (let key in env) {
            envArray.push(key + "=" + (env[key] ? env[key] : ""));
        }

        return envArray;
    },

    _handleFirstStart: function() {
        // checks the first start key
        if (!this._settings.get_boolean(FIRST_START_SETTING_KEY)) {
            return;
        }

        // opens the preferences up
        try {
            GLib.spawn_command_line_async("gnome-shell-extension-prefs " + Me.uuid);
        } catch (err) {
            logError(err, "Could not start gnome-shell-extension-prefs");
            Main.notifyError(_("Error while opening the preferences"), _("gnome-shell-extension-prefs could not be started, check your session log for more details"));
        }

        // updates the first start key
        this._settings.set_boolean(FIRST_START_SETTING_KEY, false);
    },

    _checkDependencies: function() {
        try {
            imports.gi.Vte;
        } catch (e) {
            // creates and opens the dialog after 1 second 
            Mainloop.timeout_add_seconds(1, function() {
                new MissingVteDialog().open();            
                return false;
            });

            logError(e, "Vte could not be imported");
            throw e;
        }
    }
});


// extension init hook
function init() {
    return new DropDownTerminalExtension();
}

