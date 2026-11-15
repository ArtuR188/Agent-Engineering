# Лабораторна робота 1 — Agent Engineering

## Задеплоєний ендпоінт із трасуванням (Крок 10)

- **Адреса ендпоінта (Vercel):** `https://agent-engineering-kappa.vercel.app/api/agent`
- **Перевірка стану (Healthcheck):** `https://agent-engineering-kappa.vercel.app/api/health`
- **Система трасування:** Langfuse Cloud (`functionId: "lab01-agent"`, модель `gemini-3.5-flash-lite` з `src/models.ts`)
- **Скріншоти трас із токенами й вартістю:** [`docs/lab1/traces/`](./traces/)

### Команда виклику (PowerShell)

```powershell
$url = '[https://agent-engineering-kappa.vercel.app/api/agent](https://agent-engineering-kappa.vercel.app/api/agent)'
'Котра зараз година?', 'Скільки хвилин лишилось до півночі?', 'Привітайся одним реченням' | ForEach-Object {
  $body = @{ prompt =$_ } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Method Post -Uri $url -ContentType 'application/json; charset=utf-8' -Body$body | ConvertTo-Json -Compress -Depth 5
  } catch {
    'HTTP ' + [int]$_.Exception.Response.StatusCode + ' :: ' +$_.ErrorDetails.Message
  }
}
```

### Команда виклику (Git Bash / curl)

```bash
URL='[https://agent-engineering-kappa.vercel.app/api/agent](https://agent-engineering-kappa.vercel.app/api/agent)'
for p in 'Котра зараз година?' 'Скільки хвилин лишилось до півночі?' 'Привітайся одним реченням'; do
  printf '{"prompt":"%s"}' "$p" | curl -s -X POST "$URL" -H 'Content-Type: application/json; charset=utf-8' --data-binary @-; echo
done
```

### Результати трьох контрольних викликів

| № | Запит (`prompt`) | Виклик інструмента | Вхідні токени (`inputTokens`) | Вихідні токени (`outputTokens`) | Усього токенів (`totalTokens`) | Вартість за прайсом (`$0.30 / $2.50 за 1M`) |
|---|---|---|---:|---:|---:|---:|
| 1 | `Котра зараз година?` | `getTime` | 151 | 17 | 168 | `$0.000088` |
| 2 | `Скільки хвилин лишилось до півночі?` | `getTime` | 165 | 35 | 200 | `$0.000137` |
| 3 | `Привітайся одним реченням` | — | 52 | 9 | 61 | `$0.000038` |
