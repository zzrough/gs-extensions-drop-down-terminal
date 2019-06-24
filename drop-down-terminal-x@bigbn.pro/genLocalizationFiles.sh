xgettext -L Glade  --from-code=UTF-8  -o /tmp/prefsWindow.pot *.gtkbuilder
xgettext -L Python  --from-code=UTF-8  -o /tmp/js.pot *.js
msgcat /tmp/js.pot /tmp/prefsWindow.pot > /tmp/localeMerged.pot
rm /tmp/js.pot /tmp/prefsWindow.pot
msginit --input=/tmp/localeMerged.pot --output=po/ru.po