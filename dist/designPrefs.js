imports.gi.versions.Gtk = '3.0'

const Lang = imports.lang
const Gtk = imports.gi.Gtk
const System = imports.system

imports.searchPath.unshift('.')

const convenience =  imports.convenience
const DropDownTerminalSettingsWidget = imports.prefsWindow.DropDownTerminalSettingsWidget

const Application = Lang.Class({
  Name: 'App',
  Extends: Gtk.Application,
  _init () {
    this.parent()
    log('initializing proxy')
  },

  vfunc_activate () {
    this.window = new Gtk.ApplicationWindow({
      application: this,
      title: 'Example Application Window',
      default_width: 300,
      default_height: 200
    })
    
    let settings = new DropDownTerminalSettingsWidget({
      path: '/home/bigbn/.local/share/gnome-shell/extensions/drop-down-terminal-x@bigbn.pro',
      metadata: {
        id: 'drop-down-terminal-x'
      },
      convenience
    })

    this.window.add(settings)    
    this.window.present()
    this.window.show_all()
    log('Done')
  }
})

let app = new Application()

app.run([System.programInvocationName].concat(ARGV))
