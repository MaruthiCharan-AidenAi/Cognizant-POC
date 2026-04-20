# Analytics Chatbot — API Response Bodies

All endpoints are served from `http://localhost:8000` (dev). The frontend Vite proxy forwards `/auth`, `/chat`, `/drill-down`, `/mock-data`, `/suggestions`, `/health` to the backend.

| Endpoint | Method | Transport | Auth |
|----------|--------|-----------|------|
| `/auth/login` | POST | JSON | Google JWT (header) |
| `/chat` | POST | SSE stream | Google JWT |
| `/drill-down` | POST | SSE stream | Google JWT |
| `/mock-data` | GET | JSON | None |
| `/suggestions` | GET | JSON | Google JWT |
| `/health` | GET | JSON | None |

---

## Authentication

### `POST /auth/login`

**Request headers**
```
Authorization: Bearer <google-oauth-jwt>
Content-Type: application/json
```

**Success — `200 OK`**
```json
{
  "status": "ok",
  "email": "user@example.com",
  "role": "seller",
  "region": "India",
  "name": "Aarav Singh",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

**Error — `401 Unauthorized`** (missing / invalid JWT)
```json
{
  "error": "401",
  "detail": "Missing or invalid Authorization header"
}
```

**Error — `403 Forbidden`** (email not in `user_access` table)
```json
{
  "error": "403",
  "detail": "Email not registered"
}
```

**Error — `500 Internal Server Error`** (BigQuery / cert fetch failure)
```json
{
  "error": "internal_error",
  "detail": "An unexpected error occurred"
}
```

---

## Chat (SSE stream)

### `POST /chat`

**Request**
```json
{
  "message": "Show me revenue by pod for Q1 2025",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response** — `text/event-stream`

The response is an SSE stream. Each event is a JSON object on a `data:` line, terminated by `\n\n`.
`token` events are now emitted at **character granularity** for smoother live typing in the UI.

```
data: {"type":"token","content":"H"}

data: {"type":"token","content":"e"}

data: {"type":"token","content":"r"}

data: {"type":"token","content":"e"}

data: {"type":"token","content":" "}

data: {"type":"token","content":"i"}

data: {"type":"token","content":"s"}

data: {"type":"token","content":" "}

data: {"type":"token","content":"t"}

data: {"type":"token","content":"h"}

data: {"type":"token","content":"e"}

data: {"type":"token","content":" "}

data: {"type":"token","content":"r"}

data: {"type":"token","content":"e"}

data: {"type":"token","content":"v"}

data: {"type":"token","content":"e"}

data: {"type":"token","content":"n"}

data: {"type":"token","content":"u"}

data: {"type":"token","content":"e"}

data: {"type":"token","content":"```chart\n{\"type\":\"bar\",\"title\":\"Revenue QTD by Pod\",\"x_key\":\"pod\",\"y_key\":\"revenue_qtd\",\"data\":[{\"pod\":\"Alpha Pod\",\"revenue_qtd\":182000}]}\n```"}

data: {"type":"assumption","text":"Assumed current quarter is Q1 2025 based on today's date."}

data: {"type":"confidence","score":87,"level":"HIGH"}

data: {"type":"done"}
```

#### SSE chunk types

| `type` | Fields | Description |
|--------|--------|-------------|
| `token` | `content: string` | Incremental text delta, typically **one character per event**. Concatenate all `content` values in order to build the full response. The final text may contain a ` ```chart ` code fence with a JSON chart spec. |
| `confidence` | `score: int (0–100)`, `level: "HIGH"\|"MEDIUM"\|"LOW"` | Emitted once near end of stream. Score ≥80 → HIGH, ≥60 → MEDIUM, else LOW. |
| `assumption` | `text: string` | One assumption the model made. May appear 0–N times. |
| `done` | — | End-of-stream marker. Always the last event. |
| `error` | `error: string`, `detail: string`, `retry_after?: int` | Stream-level error. Always followed by a `done` event. |

#### Embedded chart spec (inside `token` content)

When the model produces a chart, it embeds a fenced code block inside the token stream:

````
```chart
{
  "type": "bar",
  "title": "Revenue QTD by Pod",
  "x_key": "pod",
  "y_key": "revenue_qtd",
  "data": [
    { "pod": "Alpha Pod", "revenue_qtd": 182000 },
    { "pod": "Beta Pod",  "revenue_qtd": 145000 }
  ]
}
```
````

Supported `type` values: `bar`, `line`, `area`, `pie`, `scatter`, `horizontal_bar`, `stacked_bar`, `composed`.

**Error — `401`** (bad JWT, non-streaming JSON response)
```json
{ "error": "401", "detail": "Missing or invalid Authorization header" }
```

**Error — `429`** (rate limited, inside SSE stream)
```
data: {"type":"error","error":"rate_limited","detail":"Too many requests. Please wait a moment and try again.","retry_after":30}

data: {"type":"done"}
```

---

## Drill-Down (SSE stream)

### `POST /drill-down`

Triggered when the user clicks a chart segment. Returns an **SSE stream** — same format as `/chat` — with `token` chunks emitted at character granularity. Charts appear progressively as chart fences are completed in the stream.

**Request headers**
```
Authorization: Bearer <google-oauth-jwt>
Content-Type: application/json
```

**Request body**
```json
{
  "message": "Drill down into 'Alpha Pod' (value: 182000) from chart 'Revenue QTD by Pod'.",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "drill_context": {
    "chart_title": "Revenue QTD by Pod",
    "clicked_label": "Alpha Pod",
    "clicked_value": 182000,
    "filters": { "pod": "Alpha Pod" },
    "original_chart_type": "bar"
  }
}
```

`drill_context` fields:

| Field | Type | Description |
|-------|------|-------------|
| `chart_title` | string | Title of the chart that was clicked |
| `clicked_label` | string | X-axis label / pie slice name of the clicked segment |
| `clicked_value` | number \| null | Y-axis value of the clicked segment |
| `filters` | object | Key-value pairs carried as active filter context |
| `original_chart_type` | string | Chart type of the parent chart |

**Response** — `text/event-stream`

Same SSE chunk format as `/chat`. The token stream may contain ` ```chart ` fences that are parsed and rendered progressively.

```
data: {"type":"token","content":"*"}

data: {"type":"token","content":"*"}

data: {"type":"token","content":"A"}

data: {"type":"token","content":"l"}

data: {"type":"token","content":"p"}

data: {"type":"token","content":"h"}

data: {"type":"token","content":"a"}

data: {"type":"token","content":"```chart\n{\"type\":\"horizontal_bar\",...}\n```"}

data: {"type":"assumption","text":"Assumed current quarter is Q1 2025 based on today's date."}

data: {"type":"confidence","score":82,"level":"HIGH"}

data: {"type":"done"}
```

See [SSE chunk types](#sse-chunk-types) in the `/chat` section — identical format.

**Error — `401`**
```json
{ "error": "401", "detail": "Missing or invalid Authorization header" }
```

**Error (inside stream)**
```
data: {"type":"error","error":"stream_error","detail":"Drill-down stream failed. Please retry."}
data: {"type":"done"}
```

---

## Mock Data

### `GET /mock-data`

No authentication required. Returns synthetic chart specs covering all 8 chart types using seller-schema column names and realistic value ranges.

**Response — `200 OK`**
```json
{
  "summary": "Here is a full demo of all supported chart types using synthetic data that mirrors the seller analytics schema. Each chart is clickable for drill-down.",
  "charts": [
    {
      "type": "bar",
      "title": "Revenue QTD by Pod",
      "x_key": "pod",
      "y_key": "revenue_qtd",
      "data": [
        { "pod": "Alpha Pod",   "revenue_qtd": 182000 },
        { "pod": "Beta Pod",    "revenue_qtd": 145000 },
        { "pod": "Gamma Pod",   "revenue_qtd": 210000 },
        { "pod": "Delta Pod",   "revenue_qtd": 98000  },
        { "pod": "Epsilon Pod", "revenue_qtd": 173000 },
        { "pod": "Zeta Pod",    "revenue_qtd": 230000 }
      ]
    },
    {
      "type": "line",
      "title": "Daily Revenue Trend — Last 28 Days",
      "x_key": "date",
      "y_key": "revenue_yesterday",
      "data": [
        { "date": "2025-03-24", "revenue_yesterday": 12400 },
        { "date": "2025-03-25", "revenue_yesterday": 13100 }
      ]
    },
    {
      "type": "area",
      "title": "Rolling QTD Revenue by Quarter",
      "x_key": "year_quarter",
      "y_key": "rolling_qtd_revenue",
      "data": [
        { "year_quarter": "2024Q1", "rolling_qtd_revenue": 520000 },
        { "year_quarter": "2024Q2", "rolling_qtd_revenue": 610000 }
      ]
    },
    {
      "type": "pie",
      "title": "Sessions by Status",
      "x_key": "status",
      "y_key": "session_count",
      "data": [
        { "status": "Completed", "session_count": 1842 },
        { "status": "Answered",  "session_count": 934  },
        { "status": "Meet",      "session_count": 421  },
        { "status": "No-Show",   "session_count": 178  },
        { "status": "Cancelled", "session_count": 95   }
      ]
    },
    {
      "type": "horizontal_bar",
      "title": "Points Attainment % by Program",
      "x_key": "program",
      "y_key": "attainment_pct",
      "data": [
        { "program": "Google Ads Search",  "attainment_pct": 87  },
        { "program": "Performance Max",    "attainment_pct": 102 },
        { "program": "YouTube Ads",        "attainment_pct": 91  }
      ]
    },
    {
      "type": "stacked_bar",
      "title": "Revenue by Market — QTD vs Forecast vs Target",
      "x_key": "market",
      "y_keys": ["revenue_qtd", "capped_revenue_eoq_forecast", "revenue_target"],
      "data": [
        { "market": "North India", "revenue_qtd": 145000, "capped_revenue_eoq_forecast": 180000, "revenue_target": 200000 },
        { "market": "South India", "revenue_qtd": 132000, "capped_revenue_eoq_forecast": 155000, "revenue_target": 170000 }
      ]
    },
    {
      "type": "scatter",
      "title": "OSAT Score vs Revenue QTD (per Seller)",
      "x_key": "revenue_qtd",
      "y_key": "osat_score",
      "data": [
        { "seller_name": "Aarav Singh", "revenue_qtd": 24000, "osat_score": 4.2 },
        { "seller_name": "Meera Joshi", "revenue_qtd": 51000, "osat_score": 4.9 }
      ]
    },
    {
      "type": "composed",
      "title": "Revenue QTD vs Attainment Rate by Pod",
      "x_key": "pod",
      "y_key": "revenue_qtd",
      "y_key_2": "attainment_pct",
      "data": [
        { "pod": "Alpha Pod", "revenue_qtd": 182000, "attainment_pct": 91  },
        { "pod": "Zeta Pod",  "revenue_qtd": 230000, "attainment_pct": 115 }
      ]
    }
  ]
}
```

> **Note:** The full response includes all 8 chart objects with complete data arrays. The example above shows abbreviated `data` arrays for brevity.

---

## Suggestions

### `GET /suggestions`

**Request headers**
```
Authorization: Bearer <google-oauth-jwt>
```

**Response — `200 OK`**
```json
{
  "role": "seller",
  "region": "India",
  "suggestions": [
    "Which companies are furthest below their revenue target this quarter?",
    "Show actual revenue vs target by pod for the current quarter.",
    "Which pods have the lowest session completion rate right now?",
    "What is the revenue trend by quarter, and where did momentum change?"
  ]
}
```

---

## Health

### `GET /health`

No authentication required.

**Response — `200 OK`**
```json
{
  "status": "ok",
  "version": "0.2.0",
  "engine": "google-adk"
}
```

---

## Shared error envelope

All JSON error responses (including auth failures on SSE endpoints before the stream starts) use this shape:

```json
{
  "error": "<code>",
  "detail": "<human-readable message>",
  "retry_after": 30
}
```

`retry_after` is only present on `429` responses.

| HTTP status | `error` value | When |
|-------------|--------------|------|
| 401 | `"401"` | Missing / expired / invalid Google JWT |
| 403 | `"403"` | Email not in `user_access` table |
| 429 | `"rate_limited"` | Gemini quota exceeded |
| 500 | `"internal_error"` | Unhandled server exception |
| 503 | `"503"` | Google cert service / BigQuery unavailable |

---

## Chart spec reference

All endpoints that return charts use this shape (embedded in SSE token stream or in `/mock-data`):

```json
{
  "type": "bar | line | area | pie | scatter | horizontal_bar | stacked_bar | composed",
  "title": "Chart Title",
  "x_key": "category_column",
  "y_key": "numeric_column",
  "y_key_2": "second_numeric_column",
  "y_keys": ["col1", "col2", "col3"],
  "data": [
    { "<x_key>": "...", "<y_key>": 0, ... }
  ]
}
```

| Field | Required for | Notes |
|-------|-------------|-------|
| `type` | all | One of 8 values above. Aliases: `hbar`→`horizontal_bar`, `column`→`bar`, `stacked`→`stacked_bar` |
| `title` | all | Display title above the chart |
| `x_key` | all except pie | Category axis column name; inferred if omitted |
| `y_key` | all except stacked_bar | Numeric axis column name; inferred if omitted |
| `y_key_2` | `composed` | Second numeric series (rendered as line on right Y-axis) |
| `y_keys` | `stacked_bar` | Array of numeric column names for each stack segment |
| `data` | all | Array of row objects; must be non-empty |
