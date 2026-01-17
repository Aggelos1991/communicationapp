# Cloud Deployment - Complete ✅

## Server Details

**Server IP:** `46.62.134.239`
**Location:** Helsinki, Finland (Hetzner)
**OS:** Ubuntu 24.04 LTS
**Specs:** CX23 (2 vCPU, 4GB RAM, 40GB SSD)

---

## What's Running on Your Server

### 1. MySQL Database
- **Port:** 3306
- **Database:** invoice_tracker
- **User:** invoice_user
- **Password:** InvoiceSecure2024!
- **Status:** ✅ Running with remote access enabled

### 2. Backend API (Node.js + Express)
- **Port:** 3001
- **URL:** http://46.62.134.239:3001
- **Status:** ✅ Running as systemd service
- **Auto-start:** Enabled (starts on server boot)

---

## Migrated Data

✅ **3 users** migrated from local MySQL
✅ **1 invoice** migrated with evidence and attachments
✅ All passwords and data preserved

**Your users:**
- aggelosmc@gmail.com (Admin)
- test@example.com (Staff)
- test-1768649543338@example.com (Finance Manager)

---

## How to Access Your App

### From ANY Computer (Not Just Your Mac):

1. **Start the frontend locally:**
   ```bash
   cd /path/to/fincomms---invoice-tracker(2)
   npm run dev
   ```

2. **Open browser:**
   ```
   http://localhost:5173
   ```

3. **Login with your existing credentials**
   - The app will connect to the cloud backend automatically
   - All data is stored on the cloud server

### Frontend Configuration

Your `.env` file is now pointing to the cloud:
```
VITE_API_BASE_URL=http://46.62.134.239:3001
```

This means:
- ✅ MySQL runs 24/7 on cloud server
- ✅ Backend API runs 24/7 on cloud server
- ✅ You only need to run the frontend (React app) locally
- ✅ When your Mac is closed, the database and backend stay online
- ✅ Other people can access the data by running the frontend on their computers

---

## Server Management Commands

### SSH Access
```bash
ssh root@46.62.134.239
# Password: vpc4hxJ9c7sT
```

### Check Backend Status
```bash
ssh root@46.62.134.239 "systemctl status invoice-tracker"
```

### View Backend Logs
```bash
ssh root@46.62.134.239 "journalctl -u invoice-tracker -f"
```

### Restart Backend
```bash
ssh root@46.62.134.239 "systemctl restart invoice-tracker"
```

### Access MySQL
```bash
ssh root@46.62.134.239
mysql -u invoice_user -p
# Password: InvoiceSecure2024!
USE invoice_tracker;
SHOW TABLES;
```

### Backup Database
```bash
ssh root@46.62.134.239 "mysqldump -u invoice_user -p'InvoiceSecure2024!' invoice_tracker > /root/backup-$(date +%Y%m%d).sql"
```

---

## What Happens When You Close Your Mac

### ✅ WORKS:
- Cloud MySQL database stays online
- Backend API stays online
- Other users can access data (if they run frontend)
- All data remains accessible

### ❌ STOPS:
- Only your local frontend (http://localhost:5173)
- But others can still run their own frontend pointing to your cloud backend

---

## Files Created on Server

```
/opt/invoice-tracker/           # Backend application
├── index.js                    # Main entry point
├── config/                     # Database config
├── routes/                     # API routes
├── middleware/                 # Auth middleware
├── uploads/                    # File uploads
├── .env                        # Production config
└── node_modules/               # Dependencies

/etc/systemd/system/invoice-tracker.service  # Auto-start service
```

---

## API Endpoints (Cloud)

**Base URL:** `http://46.62.134.239:3001`

All endpoints documented in README_NEW.md still work:
- POST /api/auth/register
- POST /api/auth/login
- GET /api/invoices
- POST /api/invoices
- etc.

---

## Security Notes

### ✅ Implemented:
- MySQL user with limited privileges (not root)
- Strong database password
- JWT authentication for API
- Firewall configured (ufw)
- Backend runs as systemd service with auto-restart

### ⚠️ TODO for Production:
- [ ] Set up HTTPS/SSL certificate (use Let's Encrypt)
- [ ] Change server root password from default
- [ ] Set up SSH key authentication (disable password auth)
- [ ] Configure automated database backups
- [ ] Set up monitoring/alerts
- [ ] Add rate limiting to API
- [ ] Deploy frontend to cloud (Netlify/Vercel) instead of running locally

---

## Costs

**Hetzner CX23 Server:** ~€6-8/month (~$7-9/month)

This includes:
- MySQL database hosting
- Backend API hosting
- 20TB monthly traffic
- Backups (if enabled in Hetzner panel)

---

## Troubleshooting

### Backend Not Responding
```bash
ssh root@46.62.134.239 "systemctl restart invoice-tracker && systemctl status invoice-tracker"
```

### Check MySQL is Running
```bash
ssh root@46.62.134.239 "systemctl status mysql"
```

### Frontend Can't Connect
1. Check VITE_API_BASE_URL in `.env` = `http://46.62.134.239:3001`
2. Test backend: `curl http://46.62.134.239:3001/api/invoices`
3. Should return: `{"error":"Access token required"}`

### Import More Data
```bash
# Export from local
docker exec mysql-dev mysqldump -u appuser -p'apppass' appdb > export.sql

# Upload and import
scp export.sql root@46.62.134.239:/tmp/
ssh root@46.62.134.239 "mysql invoice_tracker < /tmp/export.sql"
```

---

## Next Steps (Optional)

1. **Deploy Frontend to Cloud:**
   - Push code to GitHub
   - Deploy to Vercel/Netlify (free)
   - Update FRONTEND_URL in server .env
   - Result: Fully cloud-hosted app accessible from anywhere

2. **Set Up HTTPS:**
   ```bash
   # Install Nginx and Certbot
   ssh root@46.62.134.239
   apt install nginx certbot python3-certbot-nginx

   # Configure domain (you'll need a domain name)
   ```

3. **Automated Backups:**
   ```bash
   # Add cron job for daily backups
   ssh root@46.62.134.239
   crontab -e
   # Add: 0 2 * * * mysqldump -u invoice_user -p'InvoiceSecure2024!' invoice_tracker > /root/backup-$(date +\%Y\%m\%d).sql
   ```

---

## Summary

🎉 **Your app is now cloud-ready!**

- ✅ Database and backend run 24/7 on Hetzner server
- ✅ Your Mac can be closed, data stays accessible
- ✅ Other computers can connect by running the frontend
- ✅ All existing data migrated successfully
- ✅ Automatic restart if server reboots

**To use the app from any computer:**
1. Clone the project
2. Run `npm install` and `npm run dev`
3. Login with existing credentials
4. All data syncs with cloud MySQL

---

**Support:** Check logs with `ssh root@46.62.134.239 "journalctl -u invoice-tracker -f"`
