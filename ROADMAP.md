v6
- bugfix: [terminal lost after screen is locked (github #6)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/6)

v7
- feature: [better height preference UI (github #5)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/5)
- feature: [opaque terminal (github #12)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/12)
- feature: detect active pid and ask before exiting the shell? (or detach it?)
- feature: use settings from gnome-terminal
- feature: option to show the scrollbar, suggested by bhaveekdesai)
- bugfix: [use gnome shell style context menu (github #11)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/11)
- code: use the settings directly in the terminal app (especially the font)
- code: investigate argb colors not working

v8
- feature: prompt to kill the possible active pid on logout to avoid loosing something
- bugfix: [when switching Workspaces DD Terminal flashes in and out (github #4)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/4)
- bugfix: [no focus given on ctrl-alt-tab (github #8)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/8)
- code: investigate how to have proper theming of the border (using the generic popup border or at least make it customisable through CSS)

v9
- feature (maybe): autohide (asked by step-2)
- feature (maybe): multi tabs (2 votes for, 2 votes against, andyfitz: tabs would just clutter it up)
- bugfix: investigate the focus issue preventing using the BLOCK cursor
- bugfix (maybe): [add icon/name to panel (github #7)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/7)

future:
- feature: pause the child process if term closed and no active pid (for powersaving, maybe an additional pref?)
