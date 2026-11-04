; Injected through bundle.windows.nsis.installerHooks in tauri.conf.json.
;
; [ASCII ONLY] makensis reads .nsh files with the ANSI code page unless they
; carry a UTF-8 BOM, so non-ASCII text here turns into mojibake or a compile
; error. Keep every comment and string below in plain English.
;
; Why uninstall first: the file list of a new version differs from the old one.
; Overlaying files leaves stale binaries and icon resources behind, and Explorer
; keeps showing the cached old icon. Running the previous uninstaller first
; gives the new version a clean directory.
;
; NSIS_HOOK_PREINSTALL runs inside "Section Install", right after
; SetOutPath $INSTDIR and before anything is copied, so $INSTDIR still points at
; the previous installation. User data lives in %APPDATA%\com.npcc.app and is
; not touched here.

!macro NSIS_HOOK_PREINSTALL
  ${If} $INSTDIR != ""
  ${AndIf} ${FileExists} "$INSTDIR\uninstall.exe"
    DetailPrint "Removing the previous installation of ${PRODUCTNAME}..."

    ; Silent, in-place uninstall. _?=$INSTDIR stops the uninstaller from copying
    ; itself to %TEMP%; in that mode it cannot delete its own directory, which is
    ; why the directory is wiped right after. /UPDATE must NOT be passed: it
    ; keeps the registry entries and the shortcuts.
    ClearErrors
    ExecWait '"$INSTDIR\uninstall.exe" /S _?=$INSTDIR' $R9

    ; Remove leftovers the old uninstaller did not know about (old plugin DLLs,
    ; icon resources, ...). The $INSTDIR guard above makes sure an empty value
    ; can never turn this into "delete drive root".
    RMDir /r "$INSTDIR"

    ; The uninstaller took the directory with it; recreate the output path.
    CreateDirectory "$INSTDIR"
    SetOutPath "$INSTDIR"
  ${EndIf}
!macroend
