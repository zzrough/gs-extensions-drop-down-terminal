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

