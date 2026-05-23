@echo off
cd /d "%~dp0.."
set HOST=127.0.0.1
set PORT=3000
"C:\Program Files\nodejs\node.exe" "deploy\serve-build.js" > build-server-current.log 2> build-server-current.err.log
