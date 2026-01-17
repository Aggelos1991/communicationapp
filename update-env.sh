#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "sed -i 's|FRONTEND_URL=http://46.62.134.239|FRONTEND_URL=http://localhost:5173|' /opt/invoice-tracker/.env\r"
expect "#"
send "systemctl restart invoice-tracker\r"
expect "#"
send "sleep 3\r"
expect "#"
send "systemctl status invoice-tracker | head -8\r"
expect "#"
send "exit\r"
expect eof
