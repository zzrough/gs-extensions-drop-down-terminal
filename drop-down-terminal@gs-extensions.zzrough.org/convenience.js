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
const MainLoop = imports.mainloop;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const ExtensionUtils = imports.misc.extensionUtils;


function getSettings(extensionPath, extensionId) {
    let defaultSource = Gio.SettingsSchemaSource.get_default();
    let source = Gio.SettingsSchemaSource.new_from_directory(extensionPath, defaultSource, false); // trusted = false

    let schemaId = 'org.zzrough.gs-extensions.' + extensionId;
    let schema = source.lookup(schemaId, false); // recursive = false

    if (!schema) {
       throw new Error("Schema " + schemaId + " could not be found in the path " + extensionPath); 
    }

    return new Gio.Settings({
        settings_schema: schema
    });
}


/*
 * Throttles a function call in the mainloop.
 *
 * This delays the call of the function @func and compresses calls to a maximum of one in the
 * given @interval.
 *
 * This is especially useful to delay the application of a setting.
 *
 * @interval: the application interval in milliseconds
 * @func: the delegate function to call in the mainloop
 * @funcScope: the execution scope of the function
 */
function throttle(interval, func, funcScope) {
    if (func._throttlingId !== undefined) {
        MainLoop.source_remove(func._throttlingId);
    }

    func._throttlingId = MainLoop.timeout_add(interval, function() {
        Lang.bind(funcScope, func)();
        delete func._throttlingId;

        return false;
    });
}

