[CmdletBinding()]
param(
  [switch]$StopAfter,
  [switch]$SkipBuild,
  [switch]$SkipComposeStartup
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeArgs = @("compose", "--env-file", "apps/api/.env.example")
$apiBaseUrl = "http://localhost:8080"
$email = "auth-integration-$([guid]::NewGuid().ToString('N').Substring(0, 16))@example.test"
$password = "integration-password-2026"
$registerPayload = @{ email = $email; display_name = "Integration User"; password = $password } | ConvertTo-Json -Compress

function Invoke-API {
  param(
    [Parameter(Mandatory)] [string]$Method,
    [Parameter(Mandatory)] [string]$Path,
    [Parameter(Mandatory)] [System.Net.Http.HttpClient]$Client,
    [hashtable]$Headers = @{},
    [string]$Body,
    [int]$ExpectedStatus = 200
  )

  $request = [System.Net.Http.HttpRequestMessage]::new(
    [System.Net.Http.HttpMethod]::new($Method), "$apiBaseUrl$Path"
  )
  foreach ($header in $Headers.GetEnumerator()) {
    [void]$request.Headers.TryAddWithoutValidation($header.Key, [string]$header.Value)
  }
  if ($PSBoundParameters.ContainsKey("Body")) {
    $request.Content = [System.Net.Http.StringContent]::new(
      $Body, [System.Text.Encoding]::UTF8, "application/json"
    )
  }

  try {
    $response = $Client.SendAsync($request).GetAwaiter().GetResult()
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne $ExpectedStatus) {
      throw "$Method $Path returned $([int]$response.StatusCode), expected $ExpectedStatus. Body: $content"
    }
    return [PSCustomObject]@{ StatusCode = [int]$response.StatusCode; Content = $content }
  } finally {
    $request.Dispose()
    if ($response) { $response.Dispose() }
  }
}

function Wait-ForReady {
  param([System.Net.Http.HttpClient]$Client)
  $deadline = (Get-Date).AddSeconds(90)
  $lastError = $null
  do {
    try {
      $response = $Client.GetAsync("$apiBaseUrl/readyz").GetAwaiter().GetResult()
      try {
        if ([int]$response.StatusCode -eq 200) { return }
        $lastError = "GET /readyz returned $([int]$response.StatusCode)"
      } finally {
        $response.Dispose()
      }
    } catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  throw "API did not become ready within 90 seconds: $lastError"
}

Push-Location $repoRoot
try {
  if (-not $SkipComposeStartup) {
    $upArgs = $composeArgs + @("up", "-d")
    if (-not $SkipBuild) { $upArgs += "--build" }
    & docker @upArgs
    if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }
  }
  $cookieJar = [System.Net.CookieContainer]::new()
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.UseProxy = $false
  $handler.CookieContainer = $cookieJar
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(10)
  Wait-ForReady -Client $client

  $register = Invoke-API -Method POST -Path "/api/v1/auth/register" -Client $client -Body $registerPayload -ExpectedStatus 201
  $registeredUser = $register.Content | ConvertFrom-Json
  if ($registeredUser.email -ne $email) { throw "Register response returned the wrong account" }

  Invoke-API -Method GET -Path "/api/v1/auth/me" -Client $client -ExpectedStatus 200 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/register" -Client $client -Body $registerPayload -ExpectedStatus 409 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/login" -Client $client -Body (@{ email = $email; password = "wrong-password" } | ConvertTo-Json -Compress) -ExpectedStatus 401 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/logout" -Client $client -ExpectedStatus 403 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/auth/logout" -Client $client -Headers @{ "X-CSRF-Token" = "invalid" } -ExpectedStatus 403 | Out-Null

  $csrfCookie = $cookieJar.GetCookies($apiBaseUrl)["proslides_csrf"]
  if ($null -eq $csrfCookie -or [string]::IsNullOrWhiteSpace($csrfCookie.Value)) {
    throw "Registration response did not establish a CSRF cookie"
  }
  Invoke-API -Method POST -Path "/api/v1/auth/logout" -Client $client -Headers @{ "X-CSRF-Token" = $csrfCookie.Value } -ExpectedStatus 204 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/auth/me" -Client $client -ExpectedStatus 401 | Out-Null

  $loginCookieJar = [System.Net.CookieContainer]::new()
  $loginHandler = [System.Net.Http.HttpClientHandler]::new()
  $loginHandler.UseProxy = $false
  $loginHandler.CookieContainer = $loginCookieJar
  $loginClient = [System.Net.Http.HttpClient]::new($loginHandler)
  $loginClient.Timeout = [TimeSpan]::FromSeconds(10)
  Invoke-API -Method POST -Path "/api/v1/auth/login" -Client $loginClient -Body (@{ email = $email.ToUpperInvariant(); password = $password } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/auth/me" -Client $loginClient -ExpectedStatus 200 | Out-Null
  $loginCSRF = $loginCookieJar.GetCookies($apiBaseUrl)["proslides_csrf"].Value
  $created = Invoke-API -Method POST -Path "/api/v1/presentations" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ title = "Created through API" } | ConvertTo-Json -Compress) -ExpectedStatus 201
  $createdID = ($created.Content | ConvertFrom-Json).id
  Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/slides" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ position = 0; kind = "content"; content = @{ text = "Created through API" } } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  $createdRead = Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200
  if (($createdRead.Content | ConvertFrom-Json).slides.Count -ne 1) { throw "Created presentation did not contain its slide" }

  $presentationSQL = "INSERT INTO presentations (owner_id, title) VALUES ('$($registeredUser.id)', 'Integration presentation') RETURNING id::text;"
  $presentationID = (& docker @composeArgs exec -T postgres psql -U proslides -d proslides -q -t -A -v ON_ERROR_STOP=1 -c $presentationSQL).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($presentationID)) {
    throw "Could not create the presentation integration fixture"
  }
  $slidesSQL = "INSERT INTO slides (presentation_id, position, kind, content) VALUES ('$presentationID', 0, 'content', jsonb_build_object('text', 'first')), ('$presentationID', 1, 'content', jsonb_build_object('text', 'second'));"
  & docker @composeArgs exec -T postgres psql -U proslides -d proslides -v ON_ERROR_STOP=1 -c $slidesSQL | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create the slide integration fixtures" }
  $presentation = Invoke-API -Method GET -Path "/api/v1/presentations/$presentationID" -Client $loginClient -ExpectedStatus 200
  $presentationPayload = $presentation.Content | ConvertFrom-Json
  if ($presentationPayload.slides.Count -ne 2 -or $presentationPayload.slides[0].position -ne 0) {
    throw "Presentation response did not return ordered slides"
  }

  $otherHandler = [System.Net.Http.HttpClientHandler]::new()
  $otherHandler.UseProxy = $false
  $otherClient = [System.Net.Http.HttpClient]::new($otherHandler)
  $otherClient.Timeout = [TimeSpan]::FromSeconds(10)
  $otherEmail = "presentation-reader-$([guid]::NewGuid().ToString('N').Substring(0, 16))@example.test"
  Invoke-API -Method POST -Path "/api/v1/auth/register" -Client $otherClient -Body (@{ email = $otherEmail; display_name = "Other User"; password = $password } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method GET -Path "/api/v1/presentations/$presentationID" -Client $otherClient -ExpectedStatus 404 | Out-Null

  Write-Host "Authentication Compose integration matrix passed."
} finally {
  if ($StopAfter) {
    & docker @composeArgs down
    if ($LASTEXITCODE -ne 0) { throw "docker compose down failed" }
  }
  if ($client) { $client.Dispose() }
  if ($handler) { $handler.Dispose() }
  if ($loginClient) { $loginClient.Dispose() }
  if ($loginHandler) { $loginHandler.Dispose() }
  if ($otherClient) { $otherClient.Dispose() }
  if ($otherHandler) { $otherHandler.Dispose() }
  Pop-Location
}
