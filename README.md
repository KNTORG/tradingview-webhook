# Trade Alert Speaker

**Turn your Google Home into a real-time trading alert system.**

Receive TradingView webhook alerts and instantly speak them through your Google Home / Chromecast speakers. No cloud services, no subscriptions — runs entirely on your local network.

---

## Features

- **Instant Webhook Processing** — Responds to TradingView in under 1 second; casting happens in the background so alerts never time out
- **Google Home TTS** — Text-to-speech via Chromecast protocol with automatic retry on failure
- **Per-Speaker Schedules** — Set active hours per speaker per day (supports overnight ranges like 22:00–06:00)
- **Global Time Override** — One-click override that applies to all days, disabling individual daily schedules
- **Auto-Discovery** — Finds Google Home speakers on your network via mDNS (Avahi or Bonjour)
- **Real-Time Dashboard** — Live-updating alert feed via Server-Sent Events with automatic polling fallback
- **Send Test Alerts** — One-click test button on the dashboard to verify the full pipeline
- **CSV Export** — Export alert history with date range filtering
- **Built-in Auth** — Session-based login with configurable credentials
- **Container Health Checks** — Built-in `/api/health` endpoint for orchestrator monitoring
- **Configurable Timezone** — Set `TZ` environment variable to match your locale
- **Lightweight** — ~335 MB Docker image based on Alpine Linux

## Quick Start

### 1. Build the container

```bash
# Docker
docker build -t trade-alert-speaker -f Containerfile .

# Podman
podman build -t trade-alert-speaker -f Containerfile .
```

### 2. Run

```bash
docker run -d \
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

### 4. Add speakers

Go to **Settings** and click **Discover Speakers** to find Google Home devices on your network. Click **Add** next to each speaker you want to use, then adjust the active schedules.

If discovery doesn't find your speakers, you can add them manually with their IP address.

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

This app was designed with TrueNAS Scale in mind.

### Using a Private Registry

```bash
# Build and push to your private registry
podman build -t 192.168.x.x:5000/trade-alert-speaker:latest -f Containerfile .
podman push --tls-verify=false 192.168.x.x:5000/trade-alert-speaker:latest
```

### TrueNAS App Configuration

1. **Image**: `192.168.x.x:5000/trade-alert-speaker:latest`
2. **Network**: Host Network (required for mDNS speaker discovery)
3. **Environment Variables**:
   - `WEBHOOK_SECRET` = your secret token
   - `TZ` = your timezone (e.g., `Asia/Bangkok`)
   - `SECURE_COOKIES` = `false` (unless using HTTPS)
4. **Storage**: Add a Host Path Volume:
   - Host Path: `/mnt/your-pool/trade-alert-speaker/data`
   - Container Path: `/app/data`

### Speaker Discovery on TrueNAS

The app uses `avahi-browse` to discover speakers through the host's Avahi daemon. For this to work, mount the D-Bus socket:

- **Host Path Volume**: `/run/dbus/system_bus_socket` → `/run/dbus/system_bus_socket`

If Avahi discovery doesn't work, speakers can be added manually with their IP address.

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
| `DATABASE_URL` | `file:/app/data/alerts.db` | SQLite database path |
| `PORT` | `12345` | HTTP server port |
| `SECURE_COOKIES` | *(not set)* | Set to `true` to enable secure cookies (HTTPS only) |

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
| `GET` | `/api/schedules` | Session | List speaker schedules |
| `POST` | `/api/schedules` | Session | Create schedule rule |
| `PUT` | `/api/schedules/:id` | Session | Update schedule rule |
| `DELETE` | `/api/schedules/:id` | Session | Delete schedule rule |
| `GET` | `/api/speakers` | Session | Discover speakers via mDNS |
| `POST` | `/api/test-speak` | Session | Send test TTS to a speaker |
| `POST` | `/api/auth/login` | None | Login |
| `POST` | `/api/auth/logout` | Session | Logout |

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [Prisma 6](https://www.prisma.io/) + SQLite
- **Chromecast**: [castv2-client](https://github.com/thibauts/node-castv2-client)
- **TTS**: [google-tts-api](https://github.com/nicois/google-tts-api)
- **mDNS**: [bonjour-service](https://github.com/onlxltd/bonjour-service) + avahi-tools
- **Container**: Alpine Linux, multi-stage build, ~335 MB image

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to SQLite
npx prisma db push

# Start dev server
npm run dev
```

Open http://localhost:3000

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## License

MIT
