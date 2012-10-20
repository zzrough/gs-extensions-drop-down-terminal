v1 (2012-09-05)
- initial, basic version

v2 (2012-09-22)
- support for 3.5.92 (3.6 was already targetd in v1)

v3 (2012-10-06)
- added an animation
- added a border to mimick the shell style
- added preferences (animation, height, shortcut)
- fixed the default key to really be the Above_Tab key, not F12 (thanks to Obsidien for spotting that)
- fixed the focus issue (way~~~~~~~~~ better) (the cursor is still not in block form though)
- fixed link activation
- stop opening directly the terminal in the child process by watching the bus name appearance.
  this simplifies shell restart survival a lot

v4 (2012-10-19)
- feature: [multihead support, always open on the primary monitor (github #1)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/1)
- feature: copy/paste via popupmenu + shortcuts (ctrl-shift-C/V)
- feature: show preferences on first startup
- bugfix: [use the system monospace font (github #3)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/3)
- bugfix: [ZSH (github #2)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/2)

