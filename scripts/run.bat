@echo off
REM Serves the pre-built File Search app over a local static server.
REM
REM Why this is needed instead of just double-clicking index.html: the app
REM loads its Web Worker and JS modules via the ES module system, which
REM Chrome/Edge refuse to run from a file:// URL (CORS blocks module loading
REM from a null origin). Any plain static file server works - this script
REM just finds one that's already on your machine.

cd /d "%~dp0"
if "%PORT%"=="" set PORT=8080

echo File Search - starting a local server on http://localhost:%PORT%
echo Open that URL in Chrome or Edge. Press Ctrl+C to stop.
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  python -m http.server %PORT%
  goto :eof
)

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  py -m http.server %PORT%
  goto :eof
)

where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  npx --yes serve -l %PORT% .
  goto :eof
)

echo No Python or Node/npx found. Install either one, or serve this folder
echo with any static file server of your choice.
exit /b 1
