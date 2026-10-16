param([string]$Source)
$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$previousDatabase = $env:NOVA_IMPORT_DATABASE_URL
$previousPassword = $env:NOVA_IMPORT_PASSWORD
Push-Location -LiteralPath $projectPath
try {
    if (-not $Source) { $Source = Join-Path $projectPath '.local\memory-3001.json' }
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "Source snapshot not found: $Source. Use -Source to select your transfer JSON." }
    $Source = (Resolve-Path -LiteralPath $Source).Path
    Write-Host 'NOVA PostgreSQL import: preview, transaction dry run, then optional commit.'
    & node 'scripts/import-local-to-postgres.mjs' '--source' $Source
    if ($LASTEXITCODE -ne 0) { throw 'Local validation failed.' }
    $email = Read-Host 'Target NOVA account email'
    $databaseSecret = Read-Host 'PostgreSQL connection URL' -AsSecureString
    $env:NOVA_IMPORT_DATABASE_URL = [System.Net.NetworkCredential]::new('', $databaseSecret).Password
    $createUser = (Read-Host 'Create a new NOVA account? [Y/n]') -notmatch '^(n|no)$'
    if ($createUser) {
        $passwordSecret = Read-Host 'Password for the new account (8+ characters)' -AsSecureString
        $env:NOVA_IMPORT_PASSWORD = [System.Net.NetworkCredential]::new('', $passwordSecret).Password
    }
    $initializeSchema = (Read-Host 'Initialize/update NOVA schema in this database? [Y/n]') -notmatch '^(n|no)$'
    $importArguments = @('scripts/import-local-to-postgres.mjs','--source',$Source,'--email',$email)
    if ($createUser) { $importArguments += '--create-user' }
    if ($initializeSchema) { $importArguments += '--init-schema' }
    & node @importArguments '--dry-run'
    if ($LASTEXITCODE -ne 0) { throw 'Database dry run failed. No import committed.' }
    $confirmation = Read-Host 'Dry run passed. Type IMPORT to commit the displayed data to this account'
    if ($confirmation -ceq 'IMPORT') {
        & node @importArguments '--apply'
        if ($LASTEXITCODE -ne 0) { throw 'Import failed; see the transaction result above.' }
    } else { Write-Host 'Finished without committing any import.' }
} finally {
    $env:NOVA_IMPORT_DATABASE_URL = $previousDatabase
    $env:NOVA_IMPORT_PASSWORD = $previousPassword
    Pop-Location
}
