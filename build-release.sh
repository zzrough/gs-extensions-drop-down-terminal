#!/bin/bash
SRC_DIR="drop-down-terminal-x@bigbn.pro"
DIST_DIR="dist"

rm -r ${DIST_DIR} 2>/dev/null
mkdir ${DIST_DIR} 2>/dev/null

cp -r ${SRC_DIR}/* ${DIST_DIR}
babel "${SRC_DIR}/convenience.js" > "${DIST_DIR}/convenience.js"
babel "${SRC_DIR}/extension.js" > "${DIST_DIR}/extension.js"
babel "${SRC_DIR}/prefs.js" > "${DIST_DIR}/prefs.js"
babel "${SRC_DIR}/terminal.js" > "${DIST_DIR}/terminal.js"