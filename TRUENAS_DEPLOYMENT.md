# TrueNAS SCALE Deployment Guide

Follow these steps to deploy **Trade Alert Speaker** as a Custom App on TrueNAS SCALE.

## 1. Build and Push the Container Image
Using your local registry at `192.168.7.17:5000`.

```bash
# Login to your local registry
podman login 192.168.7.17:5000 -u kanatera -p [password] --tls-verify=false

# Build the optimized image
podman build -t localhost/trade-alert-speaker:latest .

# Tag and Push to your local registry
podman tag localhost/trade-alert-speaker:latest 192.168.7.17:5000/trade-alert-speaker:latest
podman push 192.168.7.17:5000/trade-alert-speaker:latest --tls-verify=false
```

## 2. Configure TrueNAS SCALE App
1. Go to **Apps** -> **Discover Apps** -> **Custom App**.
2. **Application Name:** `trade-alert-speaker`

### Container Image
- **Image Repository:** `192.168.7.17:5000/trade-alert-speaker`
- **Image Tag:** `latest`

### Container Environment Variables
Add the following:
- `WEBHOOK_SECRET`: Your long random secret (configured in the app settings later).
- `TZ`: `Asia/Bangkok`
- `PORT`: `12345`
- `DATABASE_URL`: `file:/app/data/alerts.db`

### Networking
- **Host Network:** **Enabled** (Highly recommended for mDNS/Bonjour auto-discovery of Google Home speakers).
- **Port Forwarding:** Add a portal for port `12345`.

### Storage (Crucial for Persistence)
You must mount a persistent volume so your schedules and logs aren't lost on restart.
1. **Host Path Configuration:**
   - **Mount Path:** `/app/data`
   - **Host Path:** `/mnt/your-pool/your-dataset/trade-speaker-data`
2. Ensure the Host Path has permissions for UID `1001` (the `nextjs` user in the container).

## 3. Post-Deployment & Usage Notes

### Application Features
- **Global Time Overlay:** You can configure a "Global Overlay" (🌍) in the Settings page for a speaker. When enabled, this schedule applies every day and overrides the individual daily rules.
- **Manual IP Configuration:** If Host Network mode is disabled and auto-discovery fails, you can manually enter the static IP of your Google Home speakers in the app settings. Providing an IP address also dramatically speeds up the response time when casting audio.

### TradingView Webhook Configuration
The app supports both JSON and Plain Text payloads.

1. **Webhook URL:** `http://[your-truenas-ip]:12345/api/webhook/[your-secret]`
2. **Message:** You can now send raw text directly from TradingView without formatting it as JSON.
   - *Example:* `BTCUSD Crossing {{close}} - Strong Buy Alert!`

### TrueNAS Specific Issues
- **Insecure Registry:** Since the local registry uses no TLS, TrueNAS may need to be configured to allow insecure registries if it fails to pull the image.
