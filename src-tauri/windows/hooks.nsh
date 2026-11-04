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
; Two things the stock script gets wrong for us:
;   1. it checks for a running app *after* the old version was supposed to be
;      removed, and a running npcc.exe cannot be deleted, so an upgrade started
;      while the app is open quietly keeps the previous binary;
;   2. the uninstaller only removes the WebView2 profile when the "delete app
;      data" box is ticked, which a silent uninstall can never tick.

; Runs inside "Section Install", right after SetOutPath $INSTDIR and before
; anything is copied, so $INSTDIR still points at the previous installation.
; User data lives in %APPDATA%\com.npcc.app and is not touched here.
!macro NSIS_HOOK_PREINSTALL
  ${If} $INSTDIR != ""
    ; Stop the running copy before touching the directory. Restart Manager does
    ; the work: it terminates silently in a silent install and asks first when
    ; the user is watching. Without this the deletes below silently fail and the
    ; shortcut keeps launching the version that was just replaced.
    !insertmacro CheckIfAppIsRunning "$INSTDIR\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
    ; Give Windows a moment to drop the image file handles.
    Sleep 600

    ${If} ${FileExists} "$INSTDIR\uninstall.exe"
      DetailPrint "Removing the previous installation of ${PRODUCTNAME}..."
      ; Silent, in-place uninstall. _?=$INSTDIR stops the uninstaller from
      ; copying itself to %TEMP%; in that mode it cannot delete its own
      ; directory, which is why the directory is wiped right after. /UPDATE must
      ; NOT be passed: it keeps the registry entries and the shortcuts, and this
      ; installer rewrites both anyway.
      ; /NPCC_UPGRADE is ours: it tells NSIS_HOOK_POSTUNINSTALL this is an
      ; upgrade, not a farewell, so the WebView2 profile stays.
      ClearErrors
      ExecWait '"$INSTDIR\uninstall.exe" /S _?=$INSTDIR /NPCC_UPGRADE' $R9
      Sleep 400
    ${EndIf}

    ; Remove what is left (a stale exe from an interrupted upgrade, old plugin
    ; DLLs, old icon resources). The empty check plus the length check keep an
    ; unset or root $INSTDIR from turning this into "delete the drive".
    StrLen $R8 "$INSTDIR"
    ${If} $R8 > 3
      RMDir /r "$INSTDIR"
    ${EndIf}

    ; The uninstaller took the directory with it; recreate the output path.
    CreateDirectory "$INSTDIR"
    SetOutPath "$INSTDIR"

    ; Last line of defence. If npcc.exe survived, this install would ship the
    ; previous version a second time, so fail loudly instead of pretending.
    ${If} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
      Delete "$INSTDIR\${MAINBINARYNAME}.exe"
      ${If} ${FileExists} "$INSTDIR\${MAINBINARYNAME}.exe"
        Abort "The previous ${PRODUCTNAME} executable could not be replaced. Close ${PRODUCTNAME} and run the installer again."
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

; Runs at the end of "Section Uninstall", after the stock deletes.
!macro NSIS_HOOK_POSTUNINSTALL
  ; Our own marker: the uninstaller was launched by NSIS_HOOK_PREINSTALL, so the
  ; new version is installing right now and reuses the WebView2 profile.
  ${GetOptions} $CMDLINE "/NPCC_UPGRADE" $R9
  ${If} $R9 == ""
    SetShellVarContext current

    ; The renderer runs inside %LOCALAPPDATA%\com.npcc.app\EBWebView (hundreds of
    ; cache files). The stock script deletes it only together with the app data
    ; checkbox, so a normal uninstall used to leave it behind forever.
    RMDir /r "$LOCALAPPDATA\${BUNDLEID}"

    ; HKCU\Software\Npcc\Npcc holds the install location and the installer
    ; language; the stock script only clears it together with the app data.
    DeleteRegKey SHCTX "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty SHCTX "${MANUKEY}"

    ; %APPDATA%\com.npcc.app (settings / session / recent) is deliberately kept:
    ; it holds the user's drafts. The interactive uninstaller still offers the
    ; "delete app data" box for a full wipe. Silent uninstall keeps the data,
    ; because a silent uninstall cannot ask.
  ${EndIf}
!macroend
