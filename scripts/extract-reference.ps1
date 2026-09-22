$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent
$zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $root 'assets_for_reference/Canine_Mmode_Refer.docx'))
try {
    $reader = [IO.StreamReader]::new($zip.GetEntry('word/document.xml').Open())
    [xml]$xml = $reader.ReadToEnd()
    $reader.Dispose()
    $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    function Get-Text($element) { ($element.SelectNodes('.//w:t', $ns) | ForEach-Object { $_.'#text' }) -join '' }
    $records = @()
    foreach ($table in $xml.SelectNodes('//w:body/w:tbl', $ns)) {
        $rows = $table.SelectNodes('w:tr', $ns)
        for ($r = 0; $r -lt $rows.Count; $r += 2) {
            $headers = $rows[$r].SelectNodes('w:tc', $ns)
            $cells = $rows[$r + 1].SelectNodes('w:tc', $ns)
            for ($i = 0; $i -lt $headers.Count; $i++) {
                $weightText = Get-Text $headers[$i]
                if ($weightText -notmatch '([0-9]+(?:\.[0-9]+)?)') { continue }
                $weight = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
                $cellText = Get-Text $cells[$i]
                $ranges = [ordered]@{}
                foreach ($key in @('IVSd','LVDd','LVPWd','IVSs','LVDs','LVPWs')) {
                    if ($cellText -notmatch ($key + '\s*:\s*\(([^)]+)\)')) { throw "Missing $key at $weight" }
                    $ranges[$key] = $Matches[1]
                }
                $records += [ordered]@{ weight = $weight; ranges = $ranges }
            }
        }
    }
    $json = ConvertTo-Json -InputObject @($records) -Depth 5
    [IO.File]::WriteAllText((Join-Path $root 'reference-data.js'), "// Extracted verbatim. Do not silently repair source values.`nconst REFERENCE_DATA = $json;`nif (typeof module !== 'undefined') module.exports = REFERENCE_DATA;`n", [Text.UTF8Encoding]::new($false))
    Write-Output "Extracted $($records.Count) weight rows."
} finally { $zip.Dispose() }
