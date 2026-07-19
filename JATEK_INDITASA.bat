@echo off
setlocal
set "GAME=%~dp0Fociskartyak2026.html"

if not exist "%GAME%" (
  echo HIBA: A Fociskartyak2026.html fajl nem talalhato.
  echo Csomagold ki a teljes jatekmappat, majd inditsd ujra ezt a fajlt.
  pause
  exit /b 1
)

start "" "%GAME%"
endlocal
