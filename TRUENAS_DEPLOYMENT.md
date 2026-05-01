# TrueNAS SCALE Deployment Guide

Follow these steps to deploy **Trade Alert Speaker** as a Custom App on TrueNAS SCALE.

## 1. Build and Push the Container Image

```bash
podman build --format docker -t 192.168.7.17:5000/trade-alert-speaker:<version> .
podman login --tls-verify=false -u kanatera 192.168.7.17:5000
podman push --tls-verify=false 192.168.7.17:5000/trade-alert-speaker:<version>
```

- Always use `--format docker` — OCI format silently drops the `HEALTHCHECK` instruction.
- Always use `--tls-verify=false` — the private registry has SSL disabled.

## 2. Configure TrueNAS SCALE App

1. Go to **Apps → Discover Apps → Custom App**.
2. **Application Name:** `trade-alert-speaker`

### Container Image
- **Image Repository:** `192.168.7.17:5000/trade-alert-speaker`
- **Image Tag:** `<version>` (e.g. `1.7`)

### Container Environment Variables

| Variable | Value |
|----------|-------|
| `WEBHOOK_SECRET` | Your long random secret (set in app Settings later) |
| `TZ` | `Asia/Bangkok` (or your timezone) |
| `PORT` | `12345` |
| `DATABASE_URL` | `file:/app/data/alerts.db` |

### Networking
- **Host Network:** **Enabled** — required for mDNS/Bonjour auto-discovery of Google Home speakers, and for LG TV pairing (WSS on port 3001).
- **Port Forwarding:** Add a portal for port `12345`.

### Storage (Crucial for Persistence)

Mount a persistent volume so schedules, logs, and LG TV pairing keys survive restarts and upgrades:

| Setting | Value |
|---------|-------|
| **Mount Path** | `/app/data` |
| **Host Path** | `/mnt/your-pool/your-dataset/trade-speaker-data` |

Ensure the host path has permissions for UID `1001` (the `nextjs` user in the container).

> **LG TV pairing keys** are stored in this same `/app/data` directory as `lgtv-key-<ip>.json` files. As long as the volume is mounted, you will not need to re-pair after updating the image.

### D-Bus socket (for Avahi speaker discovery)

To enable `avahi-browse` speaker discovery, mount the D-Bus socket:

| Host Path | Container Path |
|-----------|----------------|
| `/run/dbus/system_bus_socket` | `/run/dbus/system_bus_socket` |

If this mount is unavailable or Avahi discovery doesn't work, speakers can be added manually with their IP address.

---

## 3. Post-Deployment Setup

### LG TV (primary output channel)

1. Open the app at `http://your-truenas-ip:12345`
2. Go to **Settings → Add LG TV**
3. Enter the TV's name and IP address
4. Click **Pair TV** — an "Allow access?" prompt will appear on the TV screen; accept it within 60 seconds
5. Adjust the active schedule (default: Mon–Sun 08:00–22:00)

**How TV routing works:**
- TV schedule active + TV on → alert displays as toast overlay on TV, speakers skipped
- TV schedule active + TV off → alert falls back to active Google Home speakers
- TV schedule inactive → alert goes to speakers only

**Notes:**
- LG C2 and newer webOS TVs require WSS on port 3001 (not plain WS on 3000)
- Toast notifications overlay the current content without interruption (60-character limit)
- Confirmed working on LG C2 with webOS 22, 23, and 24

### Google Home speakers (fallback)

Go to **Settings → Discover Speakers** to auto-discover speakers on the network, or add them manually by IP.

### TradingView Webhook Configuration

- **Webhook URL:** `http://your-truenas-ip:12345/api/webhook/your-secret`
- **Message format** (JSON): `{"text": "{{exchange}}:{{ticker}} — {{strategy.order.action}} at {{close}}"}`
- Plain text is also accepted.

---

## 4. Upgrading

When deploying a new image version:

1. Update the **Image Tag** in the TrueNAS app configuration
2. The container will automatically run `prisma migrate deploy` on startup — existing data and settings are preserved
3. LG TV pairing keys in `/app/data` persist across upgrades — no need to re-pair

### Schema migrations

New versions may add columns to the SQLite database. All migrations use safe defaults (e.g. `channelType` defaults to `"chromecast"` for existing speaker schedules), so no data is lost on upgrade.

---

## 5. Insecure Registry

Since the local registry uses no TLS, TrueNAS may need to be configured to allow insecure registries if it fails to pull the image. Add `192.168.7.17:5000` to the insecure registries list in TrueNAS network settings.
