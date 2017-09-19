gs-extensions-drop-down-terminal
================================

Drop Down Terminal extension for the Gnome Shell

Screenshots
-----------

### Terminal
![Terminal](https://github.com/zzrough/gs-extensions-drop-down-terminal/raw/master/screenshot-term.png)

### Preferences
![Preferences](https://github.com/zzrough/gs-extensions-drop-down-terminal/raw/master/screenshot-prefs-1.png)
![Preferences](https://github.com/zzrough/gs-extensions-drop-down-terminal/raw/master/screenshot-prefs-2.png)

Additional shortcuts
--------------------

On top of the main shortcut to display/hide the terminal, there are additional shortcuts that can not be changed:

* Ctrl-Shift-C: copy
* Ctrl-Shift-V: paste

Additional configuration and tips
---------------------------------

See the wiki [for more configuration and tips](https://github.com/zzrough/gs-extensions-drop-down-terminal/wiki).


Bug reporting
-------------

Use the [Github issue tracker](https://github.com/zzrough/gs-extensions-drop-down-terminal/issues) to report issues
or ask for features **matching the vision** of this extension, in the next paragraph.

Vision
------

I want a terminal that fits in the gnome-shell spirit: elegant, fast, simple, straight to the point.

It is an extension (easy to install), it provides a nice default shortcut, a fast, but non-disruptive animation,
does not consume anything if never used, etc. but **it will not get all the features of gnome-terminal**, that really is
not the point. Use guake or yakuake instead if you want a full-fledged equivalent (albeit looking less integrated).

Of course, I'm opened to suggestions, but please do not ask for ultra advanced settings nobody will ever need,
the code is already complex enough for reviewers to handle.

The only "controversial" feature I'm enclined to add at this point is multiple tabs support, because I myself am
used to it, but even I can open a gnome-terminal with multiple tabs already for long working sessions: that
complements this extension quite well. But it will not impact regular users with no tab: the terminal must remain
slick by default.

As a side note, a lot of things can **not** be done with bindings and thus extensions.
