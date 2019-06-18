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
const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const DropDownTerminalSettingsWidget = Me.imports.prefsWindow.DropDownTerminalSettingsWidget; // preferences init hook

function init() {} // preferences widget building hook


function buildPrefsWidget() {
  let widget = new DropDownTerminalSettingsWidget({
    path: Me.path,
    metadata: Me.metadata,
    convenience: Convenience
  });
  widget.show_all();
  return widget;
}

