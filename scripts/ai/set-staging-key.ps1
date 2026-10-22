# Run locally. Never paste the key into chat. Writes only the ignored staging env.
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$envPath = Join-Path $taskRoot '.env.staging.local'
if (!(Test-Path -LiteralPath $envPath)) { throw 'Missing staging environment' }
$envText = [IO.File]::ReadAllText($envPath)
if ($envText -notmatch 'https://fwqucffxdmbdczspkcyr\.supabase\.co' -or $envText -match 'joedeuyrzimqyjapqpyh') { throw 'Staging boundary failed' }
$secret = Read-Host 'Staging OpenAI API key (hidden)' -AsSecureString
$secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
 $secretValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
 if ($secretValue -notmatch '^sk-[A-Za-z0-9_-]{20,}$') { throw 'Invalid key shape' }
 $envText = [regex]::Replace($envText,'(?m)^(OPENAI_API_KEY|AI_PROVIDER|AI_MODEL|AI_ENABLED)=.*(?:\r?\n|$)','')
 $envText = $envText.TrimEnd() + [Environment]::NewLine + 'OPENAI_API_KEY=' + $secretValue + [Environment]::NewLine + 'AI_PROVIDER=openai' + [Environment]::NewLine + 'AI_MODEL=gpt-4.1-mini-2025-04-14' + [Environment]::NewLine + 'AI_ENABLED=true' + [Environment]::NewLine
 [IO.File]::WriteAllText($envPath,$envText,[Text.UTF8Encoding]::new($false))
 Write-Host 'Saved to ignored staging environment. Do not send the key.'
} finally {
 [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
 $secretValue = $null
 $envText = $null
}