param(
    [Parameter(Mandatory = $true)]
    [string]$BackendUrl,

    [Parameter(Mandatory = $true)]
    [string]$FrontendOrigin,

    [string]$DiagnosticEmail = "test@example.com"
)

function Invoke-DiagnosticRequest {
    param(
        [string]$Method = "GET",
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [switch]$UseCookies
    )

    $invokeParams = @{
        Uri         = $Url
        Method      = $Method
        Headers     = $Headers
        UseBasicParsing = $true
        ErrorAction = 'SilentlyContinue'
    }

    if ($UseCookies) {
        $cookieJar = Join-Path $env:TEMP "zdg-deploy-diagnostics.cookies"
        $invokeParams.Cookies = New-Object System.Net.CookieContainer
        if (Test-Path $cookieJar) { Remove-Item $cookieJar -Force }
        $invokeParams.Cookies = New-Object System.Net.CookieContainer
    }

    if ($Body) {
        $invokeParams.Body = $Body
        $invokeParams.ContentType = 'application/json'
    }

    try {
        Write-Host "Requesting: $Method $Url"
        Invoke-RestMethod @invokeParams
    } catch {
        Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Yellow
        if ($_.Exception.Response) {
            $responseStream = $_.Exception.Response.GetResponseStream()
            if ($responseStream) {
                $reader = New-Object System.IO.StreamReader($responseStream)
                Write-Host $reader.ReadToEnd()
            }
        }
    }
}

Write-Host "=== Deploy diagnostics ==="
Write-Host "BackendUrl: $BackendUrl"
Write-Host "FrontendOrigin: $FrontendOrigin"
Write-Host "DiagnosticEmail: $DiagnosticEmail"

$base = $BackendUrl.TrimEnd('/')

Write-Host "`n--- /api/health ---"
Invoke-DiagnosticRequest -Url "$base/api/health"

Write-Host "`n--- /api/auth/providers ---"
Invoke-DiagnosticRequest -Url "$base/api/auth/providers"

Write-Host "`n--- /api/auth/csrf ---"
Invoke-DiagnosticRequest -Url "$base/api/auth/csrf" -Headers @{ Origin = $FrontendOrigin }

Write-Host "`n--- /api/ping with Origin ---"
Invoke-DiagnosticRequest -Url "$base/api/ping" -Headers @{ Origin = $FrontendOrigin }

Write-Host "`n--- /api/auth/send-otp ---"
Invoke-DiagnosticRequest -Method 'POST' -Url "$base/api/auth/send-otp" -Headers @{ Origin = $FrontendOrigin } -Body (ConvertTo-Json @{ email = $DiagnosticEmail })

Write-Host "`nDiagnostics complete. Paste the output here, redacting any secrets if needed."
