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
  $questionResponse = Invoke-API -Method POST -Path "/api/v1/presentations/$createdID/questions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ position = 1; text = "Choose"; question_type = "multiple"; question_time = 30; max_point = 100; min_point = 0; partial_scoring = $true; faster_answers_more_points = $false; options = @(@{ text = "A"; is_correct = $true }, @{ text = "B"; is_correct = $true }, @{ text = "C"; is_correct = $false }) } | ConvertTo-Json -Compress -Depth 4) -ExpectedStatus 201
  $questionID = ($questionResponse.Content | ConvertFrom-Json).id
  $createdRead = Invoke-API -Method GET -Path "/api/v1/presentations/$createdID" -Client $loginClient -ExpectedStatus 200
  if (($createdRead.Content | ConvertFrom-Json).slides.Count -ne 2) { throw "Created presentation did not contain both slides" }

  $createSessionRequest = [guid]::NewGuid().ToString()
  $liveCreated = Invoke-API -Method POST -Path "/api/v1/live/sessions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $createSessionRequest; presentation_id = $createdID } | ConvertTo-Json -Compress) -ExpectedStatus 201
  $liveSession = $liveCreated.Content | ConvertFrom-Json
  Invoke-API -Method POST -Path "/api/v1/live/sessions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $createSessionRequest; presentation_id = $createdID } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null

  $startRequest = [guid]::NewGuid().ToString()
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $startRequest; expected_state_version = 1; action = "start" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = $startRequest; expected_state_version = 1; action = "start" } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null

  $participantHandler = [System.Net.Http.HttpClientHandler]::new()
  $participantHandler.UseProxy = $false
  $participantCookies = [System.Net.CookieContainer]::new()
  $participantHandler.CookieContainer = $participantCookies
  $participantClient = [System.Net.Http.HttpClient]::new($participantHandler)
  $participantClient.Timeout = [TimeSpan]::FromSeconds(10)
  $joinRequest = [guid]::NewGuid().ToString()
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/join" -Client $participantClient -Body (@{ request_id = $joinRequest; display_name = "Live Player"; avatar = "P" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/join" -Client $participantClient -Body (@{ request_id = $joinRequest; display_name = "Live Player"; avatar = "P" } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null

  $burstJoinClients = @()
  $burstJoinTasks = @()
  for ($burstIndex = 0; $burstIndex -lt 16; $burstIndex++) {
    $burstHandler = [System.Net.Http.HttpClientHandler]::new()
    $burstHandler.UseProxy = $false
    $burstClient = [System.Net.Http.HttpClient]::new($burstHandler)
    $burstPayload = @{ request_id = [guid]::NewGuid().ToString(); display_name = "Burst Player $burstIndex"; avatar = "B" } | ConvertTo-Json -Compress
    $burstContent = [System.Net.Http.StringContent]::new($burstPayload, [System.Text.Encoding]::UTF8, "application/json")
    $burstJoinClients += @{ Client = $burstClient; Handler = $burstHandler; Content = $burstContent }
    $burstJoinTasks += $burstClient.PostAsync("$apiBaseUrl/api/v1/live/sessions/$($liveSession.id)/join", $burstContent)
  }
  [System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$burstJoinTasks)
  foreach ($burstTask in $burstJoinTasks) {
    $burstResponse = $burstTask.GetAwaiter().GetResult()
    if ([int]$burstResponse.StatusCode -ne 201) { throw "Concurrent join burst returned $([int]$burstResponse.StatusCode)" }
    $burstResponse.Dispose()
  }
  foreach ($burstResource in $burstJoinClients) {
    $burstResource.Content.Dispose()
    $burstResource.Client.Dispose()
    $burstResource.Handler.Dispose()
  }

  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 2; action = "open_question"; slide_id = $questionID } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  $answerRequest = [guid]::NewGuid().ToString()
  $answer = Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/answers" -Client $participantClient -Body (@{ request_id = $answerRequest; question_slide_id = $questionID; selected_option_indexes = @(0, 1) } | ConvertTo-Json -Compress) -ExpectedStatus 201
  if (($answer.Content | ConvertFrom-Json).score_delta -ne 100) { throw "Correct multiple answer was not scored at 100" }
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/answers" -Client $participantClient -Body (@{ request_id = $answerRequest; question_slide_id = $questionID; selected_option_indexes = @(0, 1) } | ConvertTo-Json -Compress) -ExpectedStatus 200 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/answers" -Client $participantClient -Body (@{ request_id = [guid]::NewGuid().ToString(); question_slide_id = $questionID; selected_option_indexes = @(0) } | ConvertTo-Json -Compress) -ExpectedStatus 409 | Out-Null
  $snapshot = Invoke-API -Method GET -Path "/api/v1/live/sessions/$($liveSession.id)/snapshot" -Client $participantClient -ExpectedStatus 200
  $snapshotPayload = $snapshot.Content | ConvertFrom-Json
  if (($snapshotPayload.scores.PSObject.Properties.Value | Measure-Object -Sum).Sum -ne 100) { throw "Snapshot score was not 100" }
  if ($snapshotPayload.participant_count -ne 17 -or $snapshotPayload.last_event_id -lt 1) { throw "Snapshot did not include its participant count and SSE recovery cursor" }
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 3; action = "close_question" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null
  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 4; action = "show_leaderboard" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null

  $eventRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, "$apiBaseUrl/api/v1/live/sessions/$($liveSession.id)/events")
  $eventResponse = $participantClient.SendAsync($eventRequest, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  if ([int]$eventResponse.StatusCode -ne 200 -or $eventResponse.Content.Headers.ContentType.MediaType -ne "text/event-stream") {
    throw "SSE endpoint did not return a successful event stream"
  }
  $eventReader = [System.IO.StreamReader]::new($eventResponse.Content.ReadAsStreamAsync().GetAwaiter().GetResult())
  $firstEventIDLine = $eventReader.ReadLineAsync().GetAwaiter().GetResult()
  $firstEventNameLine = $eventReader.ReadLineAsync().GetAwaiter().GetResult()
  if ($firstEventIDLine -notmatch '^id: ([0-9]+)$') {
    throw "SSE initial replay did not contain a durable event ID"
  }
  $firstEventID = [long]$Matches[1]
  if ($firstEventNameLine -notmatch '^event: session\.created$') {
    throw "SSE initial replay did not start with the durable session.created event"
  }
  $eventReader.Dispose()
  $eventResponse.Dispose()
  $eventRequest.Dispose()

  $resumeRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, "$apiBaseUrl/api/v1/live/sessions/$($liveSession.id)/events")
  $resumeRequest.Headers.Add("Last-Event-ID", $firstEventID.ToString())
  $resumeResponse = $participantClient.SendAsync($resumeRequest, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  $resumeReader = [System.IO.StreamReader]::new($resumeResponse.Content.ReadAsStreamAsync().GetAwaiter().GetResult())
  $resumedEventIDLine = $resumeReader.ReadLineAsync().GetAwaiter().GetResult()
  if ($resumedEventIDLine -notmatch '^id: ([0-9]+)$' -or [long]$Matches[1] -le $firstEventID) {
    throw "SSE Last-Event-ID replay did not resume after the acknowledged event"
  }
  $resumedEventNames = @()
  for ($lineNumber = 0; $lineNumber -lt 100; $lineNumber++) {
    $eventLine = $resumeReader.ReadLineAsync().GetAwaiter().GetResult()
    if ($eventLine -match '^event: (.+)$') {
      $resumedEventNames += $Matches[1]
      if ($Matches[1] -eq 'leaderboard.updated') { break }
    }
  }
  if ($resumedEventNames -notcontains 'answer.stats' -or $resumedEventNames -notcontains 'leaderboard.updated') {
    throw "SSE replay did not contain the aggregated answer.stats and leaderboard.updated events"
  }
  $resumeReader.Dispose()
  $resumeResponse.Dispose()
  $resumeRequest.Dispose()

  Invoke-API -Method POST -Path "/api/v1/live/sessions/$($liveSession.id)/actions" -Client $loginClient -Headers @{ "X-CSRF-Token" = $loginCSRF } -Body (@{ request_id = [guid]::NewGuid().ToString(); expected_state_version = 5; action = "end" } | ConvertTo-Json -Compress) -ExpectedStatus 201 | Out-Null

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
  if ($participantClient) { $participantClient.Dispose() }
  if ($participantHandler) { $participantHandler.Dispose() }
  Pop-Location
}
