$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$file = Join-Path $repo '.env.staging.local'
if (!(Test-Path -LiteralPath $file)) { throw 'staging env not found' }
$content = [IO.File]::ReadAllText($file)
if ($content -notmatch 'https://fwqucffxdmbdczspkcyr.supabase.co') { throw 'staging boundary mismatch' }
$secure = Read-Host 'Stripe TEST secret key (sk_test_... only; hidden)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ($key -notmatch '^sk_test_[A-Za-z0-9]{16,}$') { throw 'Only a Stripe test secret key is accepted' }
  $content = [regex]::Replace($content, '(?m)^STRIPE_TEST_SECRET_KEY=.*\r?\n?', '')
  [IO.File]::WriteAllText($file, $content.TrimEnd() + [Environment]::NewLine + 'STRIPE_TEST_SECRET_KEY=' + $key + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
  Write-Output 'Stripe test key saved to Git-ignored staging configuration. No value printed.'
} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $key = $null; $secure.Dispose() }
