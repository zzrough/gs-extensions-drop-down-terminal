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
const MainLoop = imports.mainloop

imports.gi.versions.Gdk = '3.0'
imports.gi.versions.Gtk = '3.0'

const Gdk = imports.gi.Gdk
const Gio = imports.gi.Gio
const GLib = imports.gi.GLib
const Gtk = imports.gi.Gtk

var GLIB_VERSION = GLib.MAJOR_VERSION * 10000 +
                   GLib.MINOR_VERSION * 100 +
                   GLib.MICRO_VERSION

var GTK_VERSION = Gtk.MAJOR_VERSION * 10000 +
                  Gtk.MINOR_VERSION * 100 +
                  Gtk.MICRO_VERSION

function getSettings (extensionPath, extensionId) {
  let defaultSource = Gio.SettingsSchemaSource.get_default()
  let source = Gio.SettingsSchemaSource.new_from_directory(extensionPath, defaultSource, false) // trusted = false

  let schemaId = 'pro.bigbn.' + extensionId
  let schema = source.lookup(schemaId, false) // recursive = false

  if (!schema) {
    throw new Error('Schema ' + schemaId + ' could not be found in the path ' + extensionPath)
  }

  return new Gio.Settings({
    settings_schema: schema
  })
}

function getInstalledSettings (schema) {
  let installedSchemas = Gio.Settings.list_schemas()

  for (let i in installedSchemas) {
    if (installedSchemas[i] == schema) {
      return Gio.Settings.new(installedSchemas[i])
    }
  }

  return null
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
 * @scope: the execution scope of the function
 * @func: the delegate function to call in the mainloop
 * @args: the possible args, or null or undefined if no argument should be passed
 */
function throttle (interval, scope, func, args) {
  if (func._throttlingId !== undefined) {
    MainLoop.source_remove(func._throttlingId)
  }

  func._throttlingId = MainLoop.timeout_add(interval, function () {
    func.apply(scope, args)
    delete func._throttlingId

    return false
  })
}

/**
 * Adds the specified idle function to be processed by the GDK thread, with
 * the default priority (GLib.PRIORITY_DEFAULT_IDLE).
 *
 * @func: the function to execute within the GDK lock
 */
function runInGdk (func) {
  Gdk.threads_add_idle(GLib.PRIORITY_DEFAULT_IDLE, func)
}

/**
 * Creates a runner used to execute a function in the GDK thread.
 *
 * @func: the function to execute within the GDK lock
 */
function gdkRunner (func) {
  return function () {
    runInGdk(func)
  }
}

/**
 * Returns the pid of the active process.
 *
 * @return the pid
 */
function getPid () {
  return new Gio.Credentials().get_unix_pid()
}

/**
 * Parses a Gdk.RGBA color of the form "#rgb",
 * "#rrggbb", "#rrrgggbbb" or "#rrrrggggbbbb".
 *
 * @return the color parsed
 */
function parseRgbaColor (spec) {
  let col = new Gdk.RGBA()
  col.parse(spec)
  col.spec = spec
  return col
}

class Console {
  log (message, ...args) {
    print('------------')
    try {
      print(JSON.stringify(message))
    } catch (e) {
      for (let prop in message) print(prop)
    }
  }
}

var console = new Console()

var COLOR = (r, g, b) =>  parseRgbaColor('#'+[r, g, b].map(v=>v.toString(16).padStart(2, '0')).join(''))

var ColorSchemes = {
  "Black on light yellow": [COLOR (0x00, 0x00, 0x00), COLOR (0xff, 0xff, 0xdd)],
  "Black on white": [COLOR (0x00, 0x00, 0x00), COLOR (0xff, 0xff, 0xff)],
  "Gray on black": [COLOR (0xaa, 0xaa, 0xaa), COLOR (0x00, 0x00, 0x00)],  
  "Green on black": [COLOR (0x00, 0xff, 0x00), COLOR (0x00, 0x00, 0x00)],
  "White on black": [COLOR (0xff, 0xff, 0xff), COLOR (0x00, 0x00, 0x00)],
  "GNOME light": [COLOR (0x24, 0x1f, 0x31), COLOR (0xff, 0xff, 0xff)],    
  "GNOME dark": [COLOR (0xde, 0xdd, 0xda), COLOR (0x24, 0x1f, 0x31)],  
  "Tango light": [COLOR (0x2e, 0x34, 0x36), COLOR (0xee, 0xee, 0xec)],    
  "Tango dark": [COLOR (0xd3, 0xd7, 0xcf), COLOR (0x2e, 0x34, 0x36)],    
  "Solarized light": [COLOR (0x65, 0x7b, 0x83), COLOR (0xfd, 0xf6, 0xe3)],  
  "Solarized dark": [COLOR (0x83, 0x94, 0x96), COLOR (0x00, 0x2b, 0x36)],
};

var Palettes = {
  Gnome: [    
    COLOR (0x24, 0x1f, 0x31),  /* Dark 4 */
    COLOR (0xc0, 0x1c, 0x28),  /* Red 4 */
    COLOR (0x26, 0xa2, 0x69),  /* Green 5 */
    COLOR (0xb5, 0x83, 0x5a),  /* Brown 2 */
    COLOR (0x1e, 0x50, 0x98),  /* Linear blend 33% Dark 4 over Blue 5 */
    COLOR (0xa3, 0x47, 0xba),  /* Purple 3 */
    COLOR (0x30, 0xb7, 0xcb),  /* Linear addition Blue 5 + Green 5 */
    COLOR (0xde, 0xdd, 0xda),  /* Light 3 */
    COLOR (0x5e, 0x5c, 0x64),  /* Dark 2 */
    COLOR (0xed, 0x33, 0x3b),  /* Red 2 */
    COLOR (0x33, 0xd1, 0x7a),  /* Green 3 */
    COLOR (0xf8, 0xe4, 0x5c),  /* Yellow 2 */
    COLOR (0x1c, 0x71, 0xd8),  /* Blue 4 */
    COLOR (0xc0, 0x61, 0xcb),  /* Purple 2 */
    COLOR (0x38, 0xda, 0xf3),  /* Linear addition Blue 4 + Green 4 */
    COLOR (0xff, 0xff, 0xff)   /* Light 1 */    
  ],
  Tango: [
    COLOR (0x2e, 0x34, 0x36),
    COLOR (0xcc, 0x00, 0x00),
    COLOR (0x4e, 0x9a, 0x06),
    COLOR (0xc4, 0xa0, 0x00),
    COLOR (0x34, 0x65, 0xa4),
    COLOR (0x75, 0x50, 0x7b),
    COLOR (0x06, 0x98, 0x9a),
    COLOR (0xd3, 0xd7, 0xcf),
    COLOR (0x55, 0x57, 0x53),
    COLOR (0xef, 0x29, 0x29),
    COLOR (0x8a, 0xe2, 0x34),
    COLOR (0xfc, 0xe9, 0x4f),
    COLOR (0x72, 0x9f, 0xcf),
    COLOR (0xad, 0x7f, 0xa8),
    COLOR (0x34, 0xe2, 0xe2),
    COLOR (0xee, 0xee, 0xec)
  ],
  Linux: [
    COLOR (0x00, 0x00, 0x00),
    COLOR (0xaa, 0x00, 0x00),
    COLOR (0x00, 0xaa, 0x00),
    COLOR (0xaa, 0x55, 0x00),
    COLOR (0x00, 0x00, 0xaa),
    COLOR (0xaa, 0x00, 0xaa),
    COLOR (0x00, 0xaa, 0xaa),
    COLOR (0xaa, 0xaa, 0xaa),
    COLOR (0x55, 0x55, 0x55),
    COLOR (0xff, 0x55, 0x55),
    COLOR (0x55, 0xff, 0x55),
    COLOR (0xff, 0xff, 0x55),
    COLOR (0x55, 0x55, 0xff),
    COLOR (0xff, 0x55, 0xff),
    COLOR (0x55, 0xff, 0xff),
    COLOR (0xff, 0xff, 0xff)
  ],
  XTerm: [
    COLOR (0x00, 0x00, 0x00),
    COLOR (0xcd, 0x00, 0x00),
    COLOR (0x00, 0xcd, 0x00),
    COLOR (0xcd, 0xcd, 0x00),
    COLOR (0x00, 0x00, 0xee),
    COLOR (0xcd, 0x00, 0xcd),
    COLOR (0x00, 0xcd, 0xcd),
    COLOR (0xe5, 0xe5, 0xe5),
    COLOR (0x7f, 0x7f, 0x7f),
    COLOR (0xff, 0x00, 0x00),
    COLOR (0x00, 0xff, 0x00),
    COLOR (0xff, 0xff, 0x00),
    COLOR (0x5c, 0x5c, 0xff),
    COLOR (0xff, 0x00, 0xff),
    COLOR (0x00, 0xff, 0xff),
    COLOR (0xff, 0xff, 0xff)
  ],
  RXVT: [
    COLOR (0x00, 0x00, 0x00),
    COLOR (0xcd, 0x00, 0x00),
    COLOR (0x00, 0xcd, 0x00),
    COLOR (0xcd, 0xcd, 0x00),
    COLOR (0x00, 0x00, 0xcd),
    COLOR (0xcd, 0x00, 0xcd),
    COLOR (0x00, 0xcd, 0xcd),
    COLOR (0xfa, 0xeb, 0xd7),
    COLOR (0x40, 0x40, 0x40),
    COLOR (0xff, 0x00, 0x00),
    COLOR (0x00, 0xff, 0x00),
    COLOR (0xff, 0xff, 0x00),
    COLOR (0x00, 0x00, 0xff),
    COLOR (0xff, 0x00, 0xff),
    COLOR (0x00, 0xff, 0xff),
    COLOR (0xff, 0xff, 0xff)
  ],
  Solarized: [
    COLOR (0x07, 0x36, 0x42),  /*  0: base02  */
    COLOR (0xdc, 0x32, 0x2f),  /*  1: red     */
    COLOR (0x85, 0x99, 0x00),  /*  2: green   */
    COLOR (0xb5, 0x89, 0x00),  /*  3: yellow  */
    COLOR (0x26, 0x8b, 0xd2),  /*  4: blue    */
    COLOR (0xd3, 0x36, 0x82),  /*  5: magenta */
    COLOR (0x2a, 0xa1, 0x98),  /*  6: cyan    */
    COLOR (0xee, 0xe8, 0xd5),  /*  7: base2   */
    COLOR (0x00, 0x2b, 0x36),  /*  8: base03  */
    COLOR (0xcb, 0x4b, 0x16),  /*  9: orange  */
    COLOR (0x58, 0x6e, 0x75),  /* 10: base01  */
    COLOR (0x65, 0x7b, 0x83),  /* 11: base00  */
    COLOR (0x83, 0x94, 0x96),  /* 12: base0   */
    COLOR (0x6c, 0x71, 0xc4),  /* 13: violet  */
    COLOR (0x93, 0xa1, 0xa1),  /* 14: base1   */
    COLOR (0xfd, 0xf6, 0xe3)   /* 15: base3   */
  ]
}

