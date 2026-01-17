# MySQL Workbench - Cloud Database Connection

## Connection Details

Use these settings to connect MySQL Workbench to your cloud database:

### Connection Settings:

**Connection Name:** `Invoice Tracker Cloud`
**Connection Method:** `Standard (TCP/IP)`
**Hostname:** `46.62.134.239`
**Port:** `3306`
**Username:** `invoice_user`
**Password:** `InvoiceSecure2024!`
**Default Schema:** `invoice_tracker`

---

## Step-by-Step Setup

### 1. Open MySQL Workbench

### 2. Create New Connection
- Click the **"+"** button next to "MySQL Connections"

### 3. Fill in Connection Details

```
Connection Name: Invoice Tracker Cloud
Hostname: 46.62.134.239
Port: 3306
Username: invoice_user
Default Schema: invoice_tracker
```

### 4. Set Password
- Click **"Store in Keychain..."** (Mac) or **"Store in Vault..."** (Windows)
- Enter password: `InvoiceSecure2024!`

### 5. Test Connection
- Click **"Test Connection"** button
- You should see: "Successfully made the MySQL connection"

### 6. Connect
- Click **"OK"** to save
- Double-click the connection to open it

---

## What You Can Do

Once connected, you can:

✅ **View live data** - See all tables (users, invoices, profiles, evidence, attachments, payment_validations)
✅ **Run queries** - Execute SELECT, INSERT, UPDATE commands
✅ **Monitor changes** - See data updated in real-time from any laptop
✅ **Export data** - Backup or download data as CSV/SQL
✅ **Browse tables** - Click through all rows and columns
✅ **Create reports** - Run analytics queries on your data

---

## Example Queries

### View All Users
```sql
SELECT * FROM users;
```

### View All Invoices with Details
```sql
SELECT * FROM invoices_with_metadata;
```

### Count Total Invoices
```sql
SELECT COUNT(*) as total_invoices FROM invoices;
```

### View Latest Invoices
```sql
SELECT invoice_number, vendor, amount, current_stage, created_at
FROM invoices
ORDER BY created_at DESC
LIMIT 10;
```

### Check Who Created Invoices
```sql
SELECT created_by, COUNT(*) as invoice_count
FROM invoices
GROUP BY created_by;
```

---

## Real-Time Updates

### ✅ YES - Data is synchronized across all devices:

1. **Someone adds invoice from laptop A** → You see it in Workbench instantly (refresh query)
2. **You update data in Workbench** → Everyone sees the change in the app
3. **App on Netlify updates data** → Workbench shows the new data
4. **Your Mac is closed** → Workbench still connects because server runs 24/7

All connections point to the same cloud MySQL database, so everyone sees the same data in real-time.

---

## Troubleshooting

### Can't Connect?

**Error: "Can't connect to MySQL server"**

Check firewall is allowing MySQL port:
```bash
ssh root@46.62.134.239
ufw status | grep 3306
# Should show: 3306/tcp ALLOW Anywhere
```

**Error: "Access denied"**

Double-check:
- Username: `invoice_user` (not root)
- Password: `InvoiceSecure2024!`
- You copied password exactly (no extra spaces)

### Connection Timeout?

Your IP might need to be whitelisted. By default, MySQL allows connections from anywhere (0.0.0.0).

To verify:
```bash
ssh root@46.62.134.239
mysql -e "SELECT user, host FROM mysql.user WHERE user='invoice_user';"
# Should show: invoice_user | %
# The "%" means "allow from any IP"
```

---

## Security Notes

⚠️ **Your database is currently publicly accessible** (from any IP on the internet)

This is convenient but has security risks. For production, consider:

### Option 1: Restrict to Your IP Only
```sql
-- On server
mysql -u root -p
DROP USER 'invoice_user'@'%';
CREATE USER 'invoice_user'@'YOUR_IP_ADDRESS' IDENTIFIED BY 'InvoiceSecure2024!';
GRANT ALL PRIVILEGES ON invoice_tracker.* TO 'invoice_user'@'YOUR_IP_ADDRESS';
FLUSH PRIVILEGES;
```

### Option 2: Use SSH Tunnel (Most Secure)

Instead of direct connection, tunnel through SSH:

**In MySQL Workbench:**
- Connection Method: `Standard TCP/IP over SSH`
- SSH Hostname: `46.62.134.239:22`
- SSH Username: `root`
- SSH Password: `vpc4hxJ9c7sT`
- MySQL Hostname: `127.0.0.1` (localhost on server)
- MySQL Port: `3306`
- MySQL Username: `invoice_user`
- MySQL Password: `InvoiceSecure2024!`

This encrypts the connection and doesn't expose MySQL port publicly.

---

## Alternative Tools

If you don't have MySQL Workbench, you can also use:

### 1. TablePlus (Mac/Windows)
- Beautiful modern UI
- Free version available
- Same connection settings

### 2. DBeaver (Free, Open Source)
- Works on Mac/Windows/Linux
- Supports many databases
- Same connection settings

### 3. Command Line
```bash
ssh root@46.62.134.239
mysql -u invoice_user -p
# Password: InvoiceSecure2024!
USE invoice_tracker;
SHOW TABLES;
SELECT * FROM invoices;
```

---

## Quick Reference

**Server IP:** 46.62.134.239
**MySQL Port:** 3306
**Database:** invoice_tracker
**Username:** invoice_user
**Password:** InvoiceSecure2024!

**SSH Access (for troubleshooting):**
```bash
ssh root@46.62.134.239
# Password: vpc4hxJ9c7sT
```

---

## Data Flow

```
┌─────────────────────┐
│  MySQL Workbench    │────┐
│  (Your Computer)    │    │
└─────────────────────┘    │
                           │
┌─────────────────────┐    │     ┌──────────────────────┐
│  Netlify Frontend   │────┼────►│  Hetzner Server      │
│  (Cloud)            │    │     │  46.62.134.239       │
└─────────────────────┘    │     │                      │
                           │     │  ┌────────────────┐  │
┌─────────────────────┐    │     │  │ MySQL Database │  │
│  Laptop A           │────┤     │  │ invoice_tracker│  │
│  (npm run dev)      │    │     │  └────────────────┘  │
└─────────────────────┘    │     │                      │
                           │     │  ┌────────────────┐  │
┌─────────────────────┐    │     │  │ Backend API    │  │
│  Laptop B           │────┘     │  │ Port 3001      │  │
│  (npm run dev)      │          │  └────────────────┘  │
└─────────────────────┘          └──────────────────────┘
```

All devices connect to the same cloud MySQL → Everyone sees the same data in real-time!

---

**Congratulations!** 🎉 Your invoice tracker is now fully cloud-based with:
- ✅ 24/7 accessible database
- ✅ Multi-device synchronization
- ✅ Netlify-hosted frontend
- ✅ MySQL Workbench access for data analysis
