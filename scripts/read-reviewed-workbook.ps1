$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source = (Get-ChildItem -LiteralPath 'C:\Users\MOJTABA\Downloads' -Filter '%D8%A2*.xlsx' | Select-Object -First 1).FullName
if (-not $source) { throw 'Reviewed workbook not found' }
$archive = [IO.Compression.ZipFile]::OpenRead($source)
function Read-Entry($name) {
    $entry = $archive.GetEntry($name)
    if (-not $entry) { return $null }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}
try {
    [xml]$shared = Read-Entry 'xl/sharedStrings.xml'
    $strings = @($shared.SelectNodes('//*[local-name()="si"]') | ForEach-Object { ($_.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '' })
    [xml]$sheet = Read-Entry 'xl/worksheets/sheet1.xml'
    $rows = @($sheet.SelectNodes('//*[local-name()="sheetData"]/*') | ForEach-Object {
        $values = [ordered]@{}
        foreach ($cell in $_.ChildNodes) {
            $column = $cell.r -replace '\d',''
            $value = $cell.SelectSingleNode('./*[local-name()="v"]')
            if ($cell.t -eq 's') { $values[$column] = $strings[[int]$value.InnerText] }
            elseif ($cell.t -eq 'inlineStr') { $values[$column] = ($cell.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '' }
            else { $values[$column] = if ($value) { $value.InnerText } else { '' } }
        }
        if ($values['B'] -match '^(MI-|N115-)') { [pscustomobject]$values }
    })
    $rows | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath 'docs/user-bank-review.json' -Encoding UTF8
} finally { $archive.Dispose() }
Copy-Item -LiteralPath $source -Destination 'public/data/NOVA_User_Reviewed_Categories.xlsx'
Write-Output "Imported $($rows.Count) rows from user workbook."
