# Trade Alert Speaker 🔊

Receive TradingView webhook alerts and speak them through your Google Home speakers.

## Features

- **Webhook Receiver** — Accepts TradingView alert webhooks with secret token authentication
- **Google Home TTS** — Casts text-to-speech to your Google Home speakers via Chromecast protocol
- **Per-Speaker Schedules** — Configure time ranges per speaker per day of week
- **Dashboard** — View all incoming alerts with status (spoken/silenced/failed)
- **Database Maintenance** — Purge old messages and reclaim disk space

## Quick Start (Podman)

### 1. Generate a webhook secret

```bash
openssl rand -hex 16
# Example output: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
```

### 2. Build the container

```bash
podman build -t trade-alert-speaker -f Containerfile .
```

### 3. Run the container

```bash
podman run -d \
  --name trade-alert-speaker \
  --network host \
  -e WEBHOOK_SECRET=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6 \
  -e TZ=Asia/Bangkok \
  -v ./data:/app/data:Z \
  trade-alert-speaker
```

Or use podman-compose:

```bash
# Edit WEBHOOK_SECRET in podman-compose.yml first
podman-compose up -d
```

### 4. Open the dashboard

Visit `http://your-truenas-ip:12345`

### 5. Configure speakers

1. Go to **Settings** page
2. Click **"Discover Speakers"** to find Google Home devices on your network
3. Click **"Add →"** next to each speaker to create default schedules
4. Adjust time ranges as needed

### 6. Set up TradingView webhook

In your TradingView alert settings:
- **Webhook URL**: `http://your-truenas-ip:12345/api/webhook/YOUR_SECRET`
- **Message body**:
```json
{"text": "Sell {{exchange}}:{{ticker}}"}
```

## Architecture

```
TradingView → POST /api/webhook/:secret → Store in SQLite
                                        → Check speaker schedules
                                        → If active: Cast TTS via Chromecast
                                        → If inactive: Log as "silenced"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_SECRET` | *(required)* | Secret token for webhook URL |
| `TZ` | `Asia/Bangkok` | Timezone for schedule matching |
| `DATABASE_URL` | `file:/app/data/alerts.db` | SQLite database path |
| `PORT` | `12345` | HTTP server port |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhook/:secret` | Receive TradingView alerts |
| `GET` | `/api/messages?page=1&limit=20` | List messages (paginated) |
| `GET` | `/api/messages/purge` | Get DB stats |
| `DELETE` | `/api/messages/purge?olderThanDays=30` | Purge old messages |
| `GET` | `/api/schedules` | List speaker schedules |
| `POST` | `/api/schedules` | Create schedule rule |
| `PUT` | `/api/schedules/:id` | Update schedule rule |
| `DELETE` | `/api/schedules/:id` | Delete schedule rule |
| `GET` | `/api/speakers` | Discover speakers on network |
| `POST` | `/api/test-speak` | Send test message to speaker |

## Important Notes

- **Host networking required**: The container must use `--network host` for mDNS speaker discovery to work
- **Same network**: The container must be on the same network as your Google Home speakers
- **Manual IP fallback**: If mDNS discovery doesn't work, you can manually enter speaker IPs in Settings

## Tech Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4
- Prisma + SQLite
- castv2-client (Chromecast protocol)
- google-tts-api (Text-to-Speech)
- bonjour-service (mDNS discovery)
