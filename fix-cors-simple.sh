#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "cd /opt/invoice-tracker\r"
expect "#"
send "cp index.js index.js.backup\r"
expect "#"
send "sed -i \"s|origin: process.env.FRONTEND_URL.*|origin: true,|\" index.js\r"
expect "#"
send "systemctl restart invoice-tracker\r"
expect "#"
send "sleep 2\r"
expect "#"
send "systemctl status invoice-tracker | head -5\r"
expect "#"
send "exit\r"
expect eof
