[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=7SN5R9UBSZ7LE)

<div align="center"><img src='https://github.com/bigbn/drop-down-terminal-x/raw/master/head.png' /></div>

*This is a fork from https://github.com/zzrough/gs-extensions-drop-down-terminal*

## A GNOME Shell drop down terminal with extra feautures

Includes

- Tabs support
- Multi-monitor support
- Font scaling support
- [Focus out] / [Escape pressed] events for hide
- Custom shortcuts
- SSH ~/.config hosts fast acess 

[<img src="https://github.com/bigbn/drop-down-terminal-x/raw/master/get.png" height="100">](https://extensions.gnome.org/extension/1509/drop-down-terminal-x)

![Terminal](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/animated.gif)

### Manual installation

    $ git clone https://github.com/bigbn/gs-extensions-drop-down-terminal.git /tmp/drop-down-terminal
    $ cp -R /tmp/drop-down-terminal/drop-down-terminal-x@bigbn.pro ~/.local/share/gnome-shell/extensions/


### Shortcuts file format
You can create file `~/.config/drop-down-terminal-x/shortcuts` with such format:

    # You can define any actions you want
    ["Projects"]    :   cd /home/bigbn/projects
    ["MyIP"]        :   curl -s http://whatismijnip.nl | cut -d " " -f 5
   
There is two parts divided by colon:
right part is a command,
left one is a JSON array.

It contains human readable name of launcher (maybe some new properties like icon, "open" mode and etc will appear in future).

These items displayed as executable actions under special button at right corner.

Line started with # interpreted as comment and will be ignored by parser.


![Shortucts](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/shortcuts.png)


Screenshots
-----------

### Terminal
![Terminal](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/screenshot-term.png)

### Preferences
![General settings](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/screenshot-prefs-1.png)
![Position](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/screenshot-prefs-2.png)
![Terminal preferences](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/screenshot-prefs-3.png)
![Tabs preferences](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/screenshot-prefs-4.png)
![Tabs renaming](https://raw.githubusercontent.com/bigbn/gs-extensions-drop-down-terminal/master/screenshot-rename-4.png)
