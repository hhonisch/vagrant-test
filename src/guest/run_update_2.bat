@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
set MYDIR=%~dp0
set MYDIR=%MYDIR:~0,-1%

echo *****************************
echo *** Updating VM: Script 2
echo *****************************

rem Set default values
set OPT_DEBUG=
set EXIT_CODE=0

rem Parse options
if "%~1"=="" goto skip_getopts
:getopts
if /I "%~1"=="DEBUG" set OPT_DEBUG=1
shift
if not "%~1"=="" goto getopts
:skip_getopts


rem Install Windows updates
echo.
echo *** Installing Windows updates
CScript //NoLogo "%MYDIR%\toolbox.wsf" /cmd:installwindowsupdates
set UPDATE_RESULT=%ERRORLEVEL%
rem Script indicates success
if %UPDATE_RESULT% equ 0 (
  echo Update script indicates success
  goto finished
)
rem Script indicates success + reboot
if %UPDATE_RESULT% equ 2 (
  echo Update script indicates success + reboot + continue
  set EXIT_CODE=2
  goto finished
)
rem Treat other exit codes as error
set EXIT_CODE=1

:finished
rem Finished
echo ************************************************************
echo *** Finished updating VM: Script 2 (%EXIT_CODE%)
echo ************************************************************
goto end

:error
set ERROR_OCCURRED=1
set EXIT_CODE=1
echo ************************************************************
echo *** ERROR while updating VM: Script 2 (%EXIT_CODE%)
echo ************************************************************

:end
cmd /c exit %EXIT_CODE%
