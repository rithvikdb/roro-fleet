@echo off
cd /d "%~dp0.."
set BROWSER=none
set PORT=5181
set HOST=127.0.0.1
set CI=true
"C:\Program Files\nodejs\node.exe" "node_modules\react-scripts\scripts\start.js" > dev-server-5181-current.log 2> dev-server-5181-current.err.log
