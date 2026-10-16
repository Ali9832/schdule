$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$data = Get-Content -LiteralPath 'public/data/master-items.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$map = @{}
foreach ($item in $data.items) { $map[$item.id] = $item }
$destination = Join-Path $PWD 'public/data/NOVA_Merged_Categories.xlsx'
Copy-Item -LiteralPath 'public/data/NOVA_User_Reviewed_Categories.xlsx' -Destination $destination -Force
$zip = [IO.Compression.ZipFile]::Open($destination, [IO.Compression.ZipArchiveMode]::Update)
try {
    $entry = $zip.GetEntry('xl/sharedStrings.xml')
    $reader = [IO.StreamReader]::new($entry.Open())
    [xml]$stringsXml = $reader.ReadToEnd(); $reader.Dispose()
    $strings = @($stringsXml.SelectNodes('//*[local-name()="si"]') | ForEach-Object { ($_.SelectNodes('.//*[local-name()="t"]') | ForEach-Object { $_.InnerText }) -join '' })
    $entry = $zip.GetEntry('xl/worksheets/sheet1.xml')
    $reader = [IO.StreamReader]::new($entry.Open())
    [xml]$sheet = $reader.ReadToEnd(); $reader.Dispose()
    $ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    function Set-Cell($cell, [string]$text) {
        while ($cell.HasChildNodes) { [void]$cell.RemoveChild($cell.FirstChild) }
        $cell.SetAttribute('t','inlineStr')
        $inline = $sheet.CreateElement('x','is',$ns)
        $value = $sheet.CreateElement('x','t',$ns); $value.InnerText = $text
        [void]$inline.AppendChild($value); [void]$cell.AppendChild($inline)
    }
    $body = $sheet.SelectSingleNode('//*[local-name()="sheetData"]')
    $headers = @($body.ChildNodes | Select-Object -First 3)
    Set-Cell $headers[0].FirstChild 'بانک آیتم‌ها — دسته‌بندی تلفیقی نوا و نسخه بازبینی‌شده کاربر'
    Set-Cell $headers[1].FirstChild "۳٬۲۴۸ آیتم؛ $($data.categories.Count) دسته؛ $(@($data.macroTitles.PSObject.Properties).Count) حوزه؛ $($data.comparisonSummary.workbookCorrections) اصلاح نسبت به فایل کاربر. عنوان‌ها و منابع اصلی حفظ شده‌اند."
    $itemRows = @{}
    foreach ($row in @($body.ChildNodes | Select-Object -Skip 3)) {
        $idCell = $row.SelectSingleNode('./*[starts-with(@r,"B")]')
        if (-not $idCell) { continue }
        $idValue = $idCell.SelectSingleNode('./*[local-name()="v"]').InnerText
        $id = if ($idCell.t -eq 's') { $strings[[int]$idValue] } else { $idValue }
        $item = $map[$id]; if (-not $item) { throw "Unknown workbook ID $id" }
        $updates = @{ A=$item.status; C=$item.macro; D=$item.h; E=$item.category; H=$item.text; R=$(if ($item.classification.needsReview) {'نیازمند بررسی'} else {'تطبیق تلفیقی'}); S=$item.classification.decision; T=$item.classification.reason }
        foreach ($cell in $row.ChildNodes) {
            $column = $cell.r -replace '\d',''
            if ($updates.ContainsKey($column)) { Set-Cell $cell $updates[$column] }
        }
        $itemRows[$id] = $row
        [void]$body.RemoveChild($row)
    }
    $rowNumber = 4
    foreach ($category in $data.categories) {
        foreach ($item in $data.items | Where-Object h -eq $category.h) {
            $row = $itemRows[$item.id]
            $row.SetAttribute('r',[string]$rowNumber)
            foreach ($cell in $row.ChildNodes) { $cell.SetAttribute('r',(($cell.r -replace '\d','') + $rowNumber)) }
            [void]$body.AppendChild($row); $rowNumber++
        }
    }
    if ($rowNumber -ne 3252) { throw 'Export row count mismatch' }
    $entry.Delete()
    $newEntry = $zip.CreateEntry('xl/worksheets/sheet1.xml')
    $writer = [IO.StreamWriter]::new($newEntry.Open(),[Text.UTF8Encoding]::new($false))
    try { $sheet.Save($writer) } finally { $writer.Dispose() }
} finally { $zip.Dispose() }
Write-Output 'Merged Excel exported with 3248 rows.'
