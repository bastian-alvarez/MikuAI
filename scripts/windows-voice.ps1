param([ValidateSet('voices', 'speak')][string]$Mode = 'voices')
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$synth = $null
$stream = $null
try {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled } | ForEach-Object {
        @{ name = $_.VoiceInfo.Name; language = $_.VoiceInfo.Culture.Name; gender = $_.VoiceInfo.Gender.ToString() }
    })
    if ($Mode -eq 'voices') {
        ConvertTo-Json -InputObject $voices -Compress
    } else {
        $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
        if ([string]::IsNullOrWhiteSpace($request.text) -or $request.text.Length -gt 250) { throw 'Invalid text' }
        if ($request.voice -and ($voices.name -contains $request.voice)) {
            $synth.SelectVoice($request.voice)
        } else {
            $preferred = $voices | Sort-Object @{ Expression = { if ($_.language -like 'es-*') { 0 } else { 1 } } }, @{ Expression = { if ($_.gender -eq 'Female') { 0 } else { 1 } } } | Select-Object -First 1
            if ($preferred) { $synth.SelectVoice($preferred.name) }
        }
        $synth.Rate = [Math]::Max(-3, [Math]::Min(5, [int]$request.rate))
        $stream = New-Object System.IO.MemoryStream
        $synth.SetOutputToWaveStream($stream)
        $synth.Speak([string]$request.text)
        $synth.SetOutputToNull()
        @{ audio = [Convert]::ToBase64String($stream.ToArray()); voice = $synth.Voice.Name } | ConvertTo-Json -Compress
    }
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    if ($stream) { $stream.Dispose() }
    if ($synth) { $synth.Dispose() }
}
