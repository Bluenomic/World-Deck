param([int]$AppPid,[string]$Folder)
$ErrorActionPreference="Stop"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$AppPid)
$dialog=$null
for($attempt=0;$attempt -lt 60;$attempt++){
  $windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)
  foreach($window in $windows){if($window.Current.Name -match 'Pilih Folder|Select Folder|Choose Folder'){$dialog=$window;break}}
  if($dialog){break};Start-Sleep -Milliseconds 200
}
if(!$dialog){throw 'Native folder dialog unavailable'}
$editCondition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
# Activate the address field only in the dialog belonging to this test process.
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 1000
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class NativeSmokeFocus {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr handle);
 [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr handle, int id);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr handle, System.Text.StringBuilder text, int length);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr handle, int message, IntPtr wParam, IntPtr lParam);
}
"@
[NativeSmokeFocus]::SetForegroundWindow([IntPtr]$dialog.Current.NativeWindowHandle) | Out-Null
if([System.Windows.Automation.AutomationElement]::FocusedElement.Current.ProcessId -ne $AppPid){throw 'Fixture dialog does not have focus'}
[System.Windows.Forms.SendKeys]::SendWait('%d')
Start-Sleep -Milliseconds 250
$chosen=[System.Windows.Automation.AutomationElement]::FocusedElement
if($chosen.Current.ProcessId -ne $AppPid){throw 'Fixture address does not have focus'}
if($Folder -match '[+^%~(){}\[\]]'){throw 'Fixture path contains unsupported SendKeys characters'}
[System.Windows.Forms.SendKeys]::SendWait('^a')
[System.Windows.Forms.SendKeys]::SendWait($Folder)
if([System.Windows.Automation.AutomationElement]::FocusedElement.Current.ProcessId -ne $AppPid){throw 'Fixture address does not have focus'}
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 500
$buttons=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,(New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)))
$select=$null
foreach($button in $buttons){if($button.Current.Name -match '^Select Folder$|^Pilih Folder$|^Choose Folder$'){$select=$button;break}}
if($select){$select.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()}
else {
  $buttonHandle=[NativeSmokeFocus]::GetDlgItem([IntPtr]$dialog.Current.NativeWindowHandle,1)
  $label=New-Object System.Text.StringBuilder(256)
  [NativeSmokeFocus]::GetWindowText($buttonHandle,$label,256) | Out-Null
  if($buttonHandle -eq [IntPtr]::Zero -or $label.ToString() -notmatch 'Select|Folder|Pilih|Open'){throw 'Native selection button unavailable'}
  [NativeSmokeFocus]::SendMessage($buttonHandle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
}
Write-Output 'Selected fixture folder'
