' 3D-ULPIN-MVP Silent Windows Startup Launcher
' Runs start_backend.bat in the background with zero visible CMD windows.

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

strScriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
strBatPath = FSO.BuildPath(strScriptDir, "start_backend.bat")

' 0 = Hide window, False = don't wait for completion
WshShell.Run """" & strBatPath & """", 0, False
