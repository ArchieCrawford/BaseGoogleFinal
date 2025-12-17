$SUPABASE_URL = "https://knwhxuzratzlspwohusl.supabase.co"
$ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtud2h4dXpyYXR6bHNwd29odXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MjM3OTgsImV4cCI6MjA4MTM5OTc5OH0.X2Zl5g4B3btZYvUkPjqMbTPtgW3X5v22yoTySALxqqQ"
$WEBHOOK_SECRET = "ffba2a2963ab9d2fd3725e7598942b118d28cf926e6f6fb84b09a644c6a3a25b"

if (-not $ANON) { throw "ANON env var is missing. Set `$env:ANON first." }
if (-not $WEBHOOK_SECRET) { throw "WEBHOOK_SECRET env var is missing. Set `$env:WEBHOOK_SECRET first." }

$hash = "0x" + ("1" * 64)

$bodyObj = @{
  type = "post"
  data = @{
    cast = @{
      hash = $hash
      timestamp = (Get-Date).ToString("o")
      text = "test about base 0x1111111111111111111111111111111111111111"
      author = @{ fid = 1; username = "bigarch" }
    }
  }
}

$headers = @{
  "Authorization"   = "Bearer $ANON"
  "x-webhook-secret" = $WEBHOOK_SECRET
}

$body = $bodyObj | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
  -Uri "$SUPABASE_URL/functions/v1/farcaster-webhook" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body