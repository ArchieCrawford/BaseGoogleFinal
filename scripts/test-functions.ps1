param(
  [string]$SUPABASE_URL = $env:SUPABASE_URL,
  [string]$ANON = $env:ANON,
  [string]$WEBHOOK_SECRET = $env:WEBHOOK_SECRET
)

if (-not $SUPABASE_URL) { $SUPABASE_URL = Read-Host "SUPABASE_URL (https://xxxx.supabase.co)" }
if (-not $ANON) { $ANON = Read-Host "ANON (Supabase anon key)" }
if (-not $WEBHOOK_SECRET) { $WEBHOOK_SECRET = Read-Host "WEBHOOK_SECRET" }

$logUrl = "$SUPABASE_URL/functions/v1/log"
$fcUrl  = "$SUPABASE_URL/functions/v1/farcaster-webhook"

function Post-Json($url, $headers, $bodyObj) {
  $json = ($bodyObj | ConvertTo-Json -Depth 20)
  try {
    $resp = Invoke-WebRequest -Method Post -Uri $url -Headers $headers -ContentType "application/json" -Body $json -UseBasicParsing
    Write-Host "`nPOST $url"
    Write-Host "Status: $($resp.StatusCode)"
    Write-Host "Body:`n$($resp.Content)"
    return $true
  } catch {
    Write-Host "`nPOST $url"
    if ($_.Exception.Response) {
      try {
        $status = $_.Exception.Response.StatusCode.value__
      } catch { $status = "unknown" }
      Write-Host "Status: $status"
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Body:`n$body"
      } catch {
        Write-Host "Body: <could not read response body>"
      }
    } else {
      Write-Host "Error: $($_.Exception.Message)"
    }
    return $false
  }
}

$ok1 = Post-Json $logUrl @{
  Authorization = "Bearer $ANON"
} @{
  source = "app/test_log"
  type = "test_log"
  ts = (Get-Date).ToString("o")
  payload = @{ hello = "world" }
}

$ok2 = Post-Json $fcUrl @{
  "x-webhook-secret" = $WEBHOOK_SECRET
} @{
  type = "post"
  data = @{
    cast = @{
      hash = ("0x" + ([Guid]::NewGuid().ToString("N")).PadRight(64,'0').Substring(0,64))
      timestamp = (Get-Date).ToString("o")
      text = "manual test cast about base 0x1111111111111111111111111111111111111111"
      author = @{ fid = 123; username = "bigarch" }
    }
  }
}

Write-Host "`nDone. If both calls returned 200 + ok:true, run SQL:"
Write-Host "select count(*) from raw_events;"
Write-Host "select doc_type, count(*) from search_docs group by 1;"
