@echo off
cd /d "%~dp0.."
set HOST=127.0.0.1
set PORT=3002
"C:\Program Files\nodejs\node.exe" "deploy\serve-build.js" > build-server-3002.log 2> build-server-3002.err.log
