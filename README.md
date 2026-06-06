# Trade Alert Speaker

**Turn your Google Home or LG TV into a real-time trading alert system.**

Receive TradingView webhook alerts and instantly broadcast them through Google Home / Chromecast speakers (TTS) or display them as overlay notifications on an LG webOS TV. No cloud services, no subscriptions — runs entirely on your local network.

---

## Features

- **Instant Webhook Processing** — Responds to TradingView in under 1 second; casting happens in the background so alerts never time out
- **LG TV Toast Notifications** — Overlay alert on your LG C2/webOS TV without interrupting what's playing; TV takes priority over speakers when on
- **Google Home TTS** — Text-to-speech via Chromecast protocol; used as fallback when TV is off or TV schedule is inactive
- **TV-First Routing** — When TV schedule is active: TV on → alert on TV only; TV off → falls back to active speakers automatically
- **Per-Channel Schedules** — Set active hours per device per day (supports overnight ranges like 22:00–06:00)
- **Global Time Override** — One-click override that applies to all days, disabling individual daily schedules
- **Quiet Hours / Do Not Disturb** — Global mute windows (e.g. Mon–Fri 11:00–12:00) that silence every channel during meetings; alerts still arrive and are logged as `muted`, just not announced
- **Auto-Discovery** — Finds Google Home speakers on your network via mDNS (Avahi or Bonjour)
- **Real-Time Dashboard** — Live-updating alert feed via Server-Sent Events with automatic polling fallback
- **Send Test Alerts** — One-click test button on the dashboard to verify the full pipeline
- **CSV Export** — Export alert history with date range filtering
- **Built-in Auth** — Session-based login with configurable credentials
- **Configurable Timezone** — Set timezone via UI; takes effect immediately without restart
- **Container Health Checks** — Built-in `/api/health` endpoint for orchestrator monitoring
- **Lightweight** — ~335 MB Docker image based on Alpine Linux

## Quick Start

### 1. Build the container

```bash
podman build --format docker -t trade-alert-speaker -f Containerfile .
```

### 2. Run

```bash
podman run -d \
  --name trade-alert-speaker \
  --network host \
  -e WEBHOOK_SECRET=$(openssl rand -hex 16) \
  -e TZ=Asia/Bangkok \
  -v ./data:/app/data \
  trade-alert-speaker
```

### 3. Open the dashboard

Visit **http://your-server-ip:12345** and log in with the default credentials:

| | |
|---|---|
| **Username** | `admin` |
| **Password** | `admin` |

> Change these immediately in **Settings > Dashboard Security**.

### 4. Add output channels

**LG TV (optional, recommended as primary):**
- Go to **Settings → Add LG TV**
- Enter your TV's name and IP address
- Click **Pair TV** — accept the "Allow access?" prompt on the TV screen within 60 seconds
- Adjust the active schedule (default: Mon–Sun 08:00–22:00)

**Google Home speakers (fallback):**
- Go to **Settings → Discover Speakers** to find devices on your network
- Click **Add** next to each speaker, then adjust the active schedule

### 5. Configure TradingView

In your TradingView alert settings:

- **Webhook URL**: `http://your-server-ip:12345/api/webhook/YOUR_SECRET`
- **Message body** (JSON):
  ```json
  {"text": "{{exchange}}:{{ticker}} — {{strategy.order.action}} at {{close}}"}
  ```
- Or use **plain text** — the app accepts both formats.

### 6. Test it

Click **Send Test Alert** on the dashboard to verify everything works end-to-end.

---

## TrueNAS Scale Deployment

See [TRUENAS_DEPLOYMENT.md](TRUENAS_DEPLOYMENT.md) for the full deployment guide.

---

## Architecture

```
TradingView Alert
     │
     ▼
POST /api/webhook/:secret ──► Validate secret
     │                              │
     ▼                              ▼ (instant response)
Store in SQLite              Return 200 to TradingView
     │
     ▼ (background)
Is LG TV schedule active?
     │
     ├─ Yes: try LG TV toast ──► TV on  ──► Mark as "spoken" (done)
     │                      └──► TV off ──► fall through to speakers
     │
     └─ No / TV off
         │
         ▼
     Check speaker schedules
         │
         ├─ No active speakers ──► Mark as "silenced"
         │
         └─ Active speakers found
             │
             ├─ Generate TTS audio (google-tts-api)
             ├─ Cast to each speaker (castv2-client)
             ├─ Success ──► Mark as "spoken"
             └─ Failure ──► Retry queue (3 attempts, 30s apart)
                            └─► Mark as "failed" after exhausting retries
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_SECRET` | *(required)* | Secret token for webhook URL authentication |
| `TZ` | `Asia/Bangkok` | Timezone for schedule matching and display |
| `NEXT_PUBLIC_TZ` | `Asia/Bangkok` | Timezone for client-side display (set same as `TZ`) |
| `DATABASE_URL` | `file:/app/data/alerts.db` | SQLite database path (also determines LG TV key file location) |
| `PORT` | `12345` | HTTP server port |
| `SECURE_COOKIES` | *(not set)* | Set to `true` to enable secure cookies (HTTPS only) |

### Health check & `PORT` overrides

The container's `HEALTHCHECK` probes `http://127.0.0.1:${PORT}/api/health`. Two things matter when running under host networking (required for mDNS):

- **Override the port via the `PORT` env var, not a port mapping.** With host networking there is no host→container remap, so if `12345` is taken on the host, set `PORT=55555` (or similar). The healthcheck follows `$PORT` automatically.
- **The probe uses `127.0.0.1`, not `localhost`.** Under Docker, `localhost` can resolve to IPv6 `::1`, but the server binds IPv4 only (`HOSTNAME=0.0.0.0`) — a `localhost` probe would fail and the orchestrator (e.g. TrueNAS) would keep the app stuck on "Deploying" even though it works.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/webhook/:secret` | Secret | Receive TradingView alerts |
| `GET` | `/api/health` | None | Health check (DB connectivity) |
| `GET` | `/api/messages?page=1&limit=20` | Session | Paginated message list |
| `GET` | `/api/messages/stream` | None | SSE stream for real-time updates |
| `GET` | `/api/messages/export` | Session | CSV export with date filtering |
| `GET` | `/api/messages/purge` | Session | Database statistics |
| `DELETE` | `/api/messages/purge?olderThanDays=30` | Session | Purge old messages |
| `GET` | `/api/schedules?channelType=` | Session | List schedules (filter by `chromecast` or `lgtv`) |
| `POST` | `/api/schedules` | Session | Create schedule rule |
| `PUT` | `/api/schedules/:id` | Session | Update schedule rule |
| `DELETE` | `/api/schedules/:id` | Session | Delete schedule rule |
| `GET` | `/api/settings/mute` | Session | List global Quiet Hours windows |
| `POST` | `/api/settings/mute` | Session | Replace Quiet Hours windows |
| `POST` | `/api/lgtv/pair` | Session | Pair LG TV and create default schedules |
| `GET` | `/api/lgtv/pair?ip=` | Session | Check TV pairing status |
| `POST` | `/api/lgtv/test` | Session | Send test toast to LG TV |
| `GET` | `/api/speakers` | Session | Discover Chromecast speakers via mDNS |
| `POST` | `/api/test-speak` | Session | Send test TTS to a speaker |
| `POST` | `/api/auth/login` | None | Login |
| `POST` | `/api/auth/logout` | Session | Logout |

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [Prisma 6](https://www.prisma.io/) + SQLite
- **LG TV**: [lgtv2](https://github.com/hobbyquaker/lgtv2) — webOS SSAP over WSS (port 3001)
- **Chromecast**: [castv2-client](https://github.com/thibauts/node-castv2-client)
- **TTS**: [google-tts-api](https://github.com/nicois/google-tts-api)
- **mDNS**: [bonjour-service](https://github.com/onlxltd/bonjour-service) + avahi-tools
- **Container**: Alpine Linux, multi-stage build, ~335 MB image

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client and apply schema
DATABASE_URL="file:./dev.db" npm run db:migrate

# Start dev server
npm run dev
```

Open http://localhost:12345

## License

MIT
