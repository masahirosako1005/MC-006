# デモ用ナレーション読み上げ(Windows 標準の System.Speech)
# 使い方:
#   powershell -NoProfile -File docs/demo/speak.ps1 -Id N1            # narration.md の [N1] を読む
#   powershell -NoProfile -File docs/demo/speak.ps1 -Text "こんにちは"
#   ... -Mute                画面に出すだけ(音は出さない)
#   ... -Rate 1              速さ(-10〜10。既定 1)
#   ... -Voice "Haruka"      声の名前(一部一致。既定は日本語の声を自動選択)
#   ... -ListVoices          インストール済みの声を表示して終了
# 読み上げが終わるまでブロックする。発話の重なりは、名前付き Mutex で防ぐ(-TimeoutSec 秒で諦める)。
param(
  [string]$Text = "",
  [string]$Id = "",
  [int]$Rate = 1,
  [string]$Voice = "",
  [switch]$Mute,
  [switch]$ListVoices,
  [int]$TimeoutSec = 40
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech

if ($ListVoices) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.GetInstalledVoices() | ForEach-Object { "{0} {1} enabled={2}" -f $_.VoiceInfo.Name, $_.VoiceInfo.Culture, $_.Enabled }
  $s.Dispose(); exit 0
}

if ($Id -ne "") {
  $file = Join-Path $PSScriptRoot "narration.md"
  $hit = Get-Content -Path $file -Encoding UTF8 | Where-Object { $_ -match "^\s*-\s*\[$([regex]::Escape($Id))\]\s*(.+)$" } | Select-Object -First 1
  if (-not $hit) { Write-Error "narration.md に [$Id] が無い"; exit 2 }
  $Text = ([regex]::Match($hit, "^\s*-\s*\[[^\]]+\]\s*(.+)$")).Groups[1].Value.Trim()
}
if ($Text -eq "") { Write-Error "-Text か -Id が必要"; exit 2 }

Write-Output ("[ナレーション{0}] {1}" -f ($(if ($Id) { " $Id" } else { "" })), $Text)
if ($Mute) { exit 0 }

$mutex = New-Object System.Threading.Mutex($false, "Local\DemoSpeakMutex")
$got = $false
try {
  $got = $mutex.WaitOne([TimeSpan]::FromSeconds($TimeoutSec))
  if (-not $got) { Write-Warning "前の発話が終わらないため、読み上げをスキップした"; exit 3 }
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $voices = $synth.GetInstalledVoices() | Where-Object { $_.Enabled }
  $pick = $null
  if ($Voice -ne "") { $pick = $voices | Where-Object { $_.VoiceInfo.Name -like "*$Voice*" } | Select-Object -First 1 }
  if (-not $pick) { $pick = $voices | Where-Object { $_.VoiceInfo.Culture.Name -eq "ja-JP" } | Select-Object -First 1 }
  if ($pick) { $synth.SelectVoice($pick.VoiceInfo.Name) } else { Write-Warning "日本語の声が無い。既定の声で読む" }
  $synth.Rate = [Math]::Max(-10, [Math]::Min(10, $Rate))
  $synth.Volume = 100
  $synth.SetOutputToDefaultAudioDevice()
  $null = $synth.SpeakAsync($Text)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($synth.State -eq [System.Speech.Synthesis.SynthesizerState]::Speaking) {
    if ($sw.Elapsed.TotalSeconds -gt $TimeoutSec) { $synth.SpeakAsyncCancelAll(); Write-Warning "タイムアウト"; break }
    Start-Sleep -Milliseconds 100
  }
  $synth.Dispose()
} finally {
  if ($got) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
