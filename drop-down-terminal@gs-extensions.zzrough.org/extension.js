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
const System = imports.system;
const Gettext = imports.gettext.domain('drop-down-terminal');

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const GdkX11 = imports.gi.GdkX11;
const Gtk = imports.gi.Gtk;
const Vte = imports.gi.Vte;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;

const _ = Gettext.gettext;
const Config = imports.misc.config;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;


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


// constants
const TOGGLE_TERMINAL_KEYBINDING_KEY = "toggle-terminal";
const DEBUG = false;


// helper to only log in debug mode
function debug(text) { DEBUG && log("[DDT] " + text); }


// extension class
const DropDownTerminalExtension = new Lang.Class({
    Name: 'DropDownTerminalExtension',

    _init: function() {
        // initializes the child pid member early
        this._childPid = null;
    },

    enable: function() {
        // binds the key to open/close the terminal
        let settings = Convenience.getSettings(Me.path, Me.metadata.id);

        this._bindKey(settings);

        // rebinds the key on dynamic changes
        settings.connect("changed::" + TOGGLE_TERMINAL_KEYBINDING_KEY, Lang.bind(this, function() {
            this._unbindKey();
            this._bindKey(settings);
        }));
    },

    disable: function() {
        // quit and/or kill the child process if it exists
        if (this._childPid !== null) {
            try {
                // starts by asking to quit gracefully
                this._quitingChild = true;
                this._dbusProxy.QuitRemote();

                // if the remote call succeeded, we forget about this process
                this._childPid = null;
            } catch (e) {
                debug("error asking the terminal to quit gracefully (cause: " + e.name + " - " + e.message + ")");

                // quiting failed, so mark it and kills the process
                this._quitingChild = false;
                this._killChild();
            }
        }

        // destroys the dbus proxy aggressively
        delete this._dbusProxy;
        this._dbusProxy = null;

        // unbinds the shortcut key
        this._unbindKey();
    },

    _toggle: function() {
        debug("asked to toggle");

        // checks if there is not an instance of a previous child, mainly because it survived a shell restart
        // (the shell reexec itself thus not letting the extensions a chance to properly shut down)
        //
        // Note: we use pgrep since the shell itself uses pkill and mention it being somewhat portable
        //       and this is easier than letting a pidfile in XDG_RUNTIME_DIR
        if (this._childPid === null) {
            let forkedCommandArgs = this._getForkCommandArgs();
            let args = ["pgrep",
                        "-P", "" + System.getpid(),
                        "-n", "-f",
                        forkedCommandArgs.join(' ')];               

            try {
                let [success, stdout, stderr, exitCode] = GLib.spawn_sync(null, args, null, GLib.SpawnFlags.SEARCH_PATH, null, null);

                if (success && exitCode == 0) {
                    this._childPid = parseInt(stdout);
                    this._connectToChildDBus();
                }
            } catch (e) {
                debug("could not check if a previous terminal is running (" + e.name + " - " + e.message + ")");
            }
        }

        // forks if the child does not exist (never started or killed)
        if (this._childPid === null) {
            debug("forking and connecting to the terminal dbus interface");
            this._forkChild();
            this._connectToChildDBus();
        }

        // calls the toggling command on the interface
        this._dbusProxy.ToggleRemote();
    },

    _forkChild: function() {
        // resets the child finishing flags
        this._quitingChild = false;
        this._killingChild = false;

        // finds the forking arguments
        let args = this._getForkCommandArgs();

        // forks the process
        debug("forking '" + args.join(" ") + "'");

        var success, pid;

        try {
            [success, pid] = GLib.spawn_async(null, args, null,
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

    _connectToChildDBus: function() {
        // creates a dbus proxy on the interface exported by the child process
        let DropDownTerminalDBusProxy = Gio.DBusProxy.makeProxyWrapper(DropDownTerminalIface);

        this._dbusProxy = new DropDownTerminalDBusProxy(Gio.DBus.session, 'org.zzrough.GsExtensions.DropDownTerminal', '/org/zzrough/GsExtensions/DropDownTerminal');

        // connects to the Failure signal to report errors
        this._dbusProxy.connectSignal('Failure', Lang.bind(this, function(proxy, sender, [name, cause]) {
            debug("failure reported by the terminal: " + cause);

            if (name == "ForkUserShellFailed") {
                Main.notifyError(_("Drop Down Terminal failed to start"),
                                 _("The user shell could not be spawn in the terminal.") + "\n\n" + _("You can activate the debug mode to nail down the issue"));
            } else {
                Main.notifyError(_("An error occured in the Drop Down Terminal"),
                                 cause + "\n\n" + _("You can activate the debug mode to nail down the issue"));
            }
        }));
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

        // resets the child pid
        this._childPid = null;

        // destroys the dbus proxy aggressively
        delete this._dbusProxy;
        this._dbusProxy = null;
    },

    _bindKey: function(settings) {
        global.display.add_keybinding(TOGGLE_TERMINAL_KEYBINDING_KEY, settings, Meta.KeyBindingFlags.NONE,
                                      Lang.bind(this, this._toggle));
    },

    _unbindKey: function() {
        global.display.remove_keybinding(TOGGLE_TERMINAL_KEYBINDING_KEY);
    },

    _getForkCommandArgs: function() {
        return ["gjs", GLib.build_filenamev([Me.path, "terminal.js"])];
    }
});


// extension init hook
function init() {
    return new DropDownTerminalExtension();
}

