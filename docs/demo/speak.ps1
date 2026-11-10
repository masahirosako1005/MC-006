# デモ用ナレーション読み上げ(Windows 標準の System.Speech)
# 使い方:
#   powershell -NoProfile -File docs/demo/speak.ps1 -Id N1            # narration.md の [N1] を読む
#   powershell -NoProfile -File docs/demo/speak.ps1 -Text "こんにちは"
#   ... -Mute                画面に出すだけ(音は出さない)
#   ... -Rate 1              速さ(-10〜10。既定 1)
#   ... -Voice "Haruka"      声の名前(一部一致。既定は日本語の声を自動選択)
#   ... -ListVoices          インストール済みの声を表示して終了
#   ... -Engine auto|voicevox|sapi   既定 auto(VOICEVOX が応答すれば VOICEVOX、無ければ SAPI にフォールバック)
#   ... -Speaker "春日部つむぎ"|<style id>   VOICEVOX の声(名前=ノーマルのスタイル、または数値の style id。既定 ずんだもん ノーマル=id 3)
#   ... -Speed 1.0 -Pitch 0 -Intonation 1.0 -VvUrl http://127.0.0.1:50021
#   ... -ListSpeakers        VOICEVOX の声を「名前 / スタイル / id」で表示して終了
# 読み上げが終わるまでブロックする。発話の重なりは、名前付き Mutex で防ぐ(-TimeoutSec 秒で諦める)。
param(
  [string]$Text = "",
  [string]$Id = "",
  [int]$Rate = 1,
  [string]$Voice = "",
  [switch]$Mute,
  [switch]$ListVoices,
  [int]$TimeoutSec = 40,
  [ValidateSet("auto","voicevox","sapi")][string]$Engine = "auto",
  [string]$Speaker = "ずんだもん",
  [double]$Speed = 1.3,
  [double]$Pitch = 0.0,
  [double]$Intonation = 1.0,
  [string]$VvUrl = "http://127.0.0.1:50021",
  [switch]$ListSpeakers
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech

function Get-Speakers {
  $r = Invoke-WebRequest -UseBasicParsing -Uri "$VvUrl/speakers" -TimeoutSec 2
  $json = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  return ($json | ConvertFrom-Json)
}
function Resolve-StyleId([string]$sp) {
  if ($sp -match '^\d+$') { return [int]$sp }
  $m = Get-Speakers | Where-Object { $_.name -like "*$sp*" } | Select-Object -First 1
  if (-not $m) { throw "VOICEVOX に声 '$sp' が無い" }
  $st = $m.styles | Where-Object { $_.name -eq "ノーマル" } | Select-Object -First 1
  if (-not $st) { $st = $m.styles | Select-Object -First 1 }
  return [int]$st.id
}
# VOICEVOX で合成して再生完了までブロック。成功 $true、失敗(不通/タイムアウト)は $false
function Invoke-VoiceVox([string]$t) {
  $tmp = Join-Path $env:TEMP ("demo-speak-{0}.wav" -f [guid]::NewGuid().ToString("N"))
  try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri "$VvUrl/version" -TimeoutSec 2
    $sid = Resolve-StyleId $Speaker
    $q = Invoke-WebRequest -UseBasicParsing -Method Post -TimeoutSec 30 -Uri ("$VvUrl/audio_query?speaker=$sid&text=" + [uri]::EscapeDataString($t))
    $qj = [System.Text.Encoding]::UTF8.GetString($q.RawContentStream.ToArray()) | ConvertFrom-Json
    $qj.speedScale = $Speed; $qj.pitchScale = $Pitch; $qj.intonationScale = $Intonation
    $qj.prePhonemeLength = 0.1; $qj.postPhonemeLength = 0.1
    $body = [System.Text.Encoding]::UTF8.GetBytes(($qj | ConvertTo-Json -Depth 10 -Compress))
    $null = Invoke-WebRequest -UseBasicParsing -Method Post -TimeoutSec 30 -Uri "$VvUrl/synthesis?speaker=$sid" -ContentType "application/json; charset=utf-8" -Body $body -OutFile $tmp
    $pl = New-Object System.Media.SoundPlayer($tmp)
    try { $pl.PlaySync() } finally { $pl.Dispose() }
    return $true
  } catch {
    Write-Warning ("VOICEVOX 失敗: " + $_.Exception.Message)
    return $false
  } finally { if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue } }
}

if ($ListSpeakers) {
  Get-Speakers | ForEach-Object { $n = $_.name; $_.styles | ForEach-Object { "{0} / {1} / {2}" -f $n, $_.name, $_.id } }
  exit 0
}

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
  if ($Engine -ne "sapi") {
    if (Invoke-VoiceVox $Text) { exit 0 }
    if ($Engine -eq "voicevox") { Write-Warning "VOICEVOX で読めなかった"; exit 4 }
    Write-Output "(VOICEVOX が応答しないため、SAPI にフォールバック)"
  }
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
