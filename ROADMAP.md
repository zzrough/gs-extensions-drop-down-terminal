v24
- bugfix: there is a slight 1px border on the scrollbar gutter (I tried removing it, works within gtk-inspector but not at runtime)

v25
- feature: [better height preference UI (github #5)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/5)
- feature: customizable font
- feature: detect active pid and ask before exiting the shell? (or detach it?)
- feature: remove the border when height = 100%
- code: investigate argb colors not working

v26
- feature: prompt to kill the possible active pid on logout to avoid loosing something
- bugfix: [when switching Workspaces DD Terminal flashes in and out (github #4)](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues/4)
- code: investigate how to have proper theming of the border (using the generic popup border or at least make it customisable through CSS)

v27
- feature (maybe): autohide (asked by step-2, koji3)
- feature (maybe): multi tabs (13 votes for, 10 votes against)
- feature (maybe): allow custom width (suggested by Dreamsorcerer)
- feature (maybe): dnd (already tried, not that simple)
- bugfix: investigate the focus issue preventing using the BLOCK cursor

future
- feature: pause the child process if term closed and no active pid (for powersaving, maybe an additional pref?)
