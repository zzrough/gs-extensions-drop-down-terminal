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

v5 (2012-10-25)
- feature: check for dependencies at startup (asked by l300lvl -- Debian distributes gir files in their own packages)
- feature: custom command (suggested by sequentious, to be able to always run 'mutt' or 'screen' for instance)
- bugfix: [terminal on wrong monitor (github #10)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/10)
- bugfix: better animation depending on monitor position (animate the height instead of the position if there is a monitor above the primary one)
- bugfix: glitch at animation startup (the window can be briefly seen at the wrong location)
- code: investigate if the inner-border can be retrieved

v6 (2012-11-05)
- support for 3.7.1
- bugfix: [terminal lost after screen is locked (github #6)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/6)

v7 (2012-12-08)
- support for 3.7.2
- feature: [opaque terminal (github #12)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/12)
- feature: option to show the scrollbar (suggested by bhaveekdesai)
- bugfix: set the opacity of the terminal instead of the window to improve text readibility
- bugfix: [use gnome shell style context menu (github #11)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/11)
- code: use settings directly instead of the dbus API

v8 (2012-12-17)
- bugfix: [Screen unlock makes terminal appear (github #21)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/21)

v9 (2013-03-25)
- support from 3.7.3 up to 3.8
- workaround for a gtk allocation regression [b.g.o #696187](https://bugzilla.gnome.org/show_bug.cgi?id=696187)
- workaround for a mutter 3.7.90 change (possibly the frame sync)
- feature: improve the ctrl-alt-tab look to match the shell high-res symbolic icons
- feature: way faster opening (an invisible animation was delaying the opening animation for 0.25s)
- feature: proper transparency for the terminal+scrollbar thanks to the new gtk 3.7 opacity handling
- feature: [Separate opening and closing animation (github #27)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/27)
- feature: [Customizable transparency level (github #30)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/30)
- bugfix: [no focus given on ctrl-alt-tab (github #8)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/8)
- bugfix: [Small gap above terminal (github #15)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/15)

v10 (2013-04-21)
- bugfix: [Allow a block or underline cursor in the terminal (github #36)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/36)
- bugfix: [Switch focus faster (github #38)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/38)

v11 (2013-04-28)
- bugfix: [Error upgrading extension (github #40)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/40)
- code: make the gtk allocation regression fix conditional ; the story is not finished yet see b.g.o. #696882

v12 (2013-05-08)
- bugfix: [Height change doesn''t work on 3.8.1 (github #41)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/41)

v13 (2013-09-25)
- support up to 3.10
- disable use of very recently deprecated methods in Vte as the methods are not visible from GJS

v14 (2014-03-26)
- support up to 3.12
- fix terminal jumping to secondary monitor (thanks to Martin Pöhlmann!)
- tentative fix for transparency loss with utter failure

v15 (2014-09-23)
- support up to 3.14
