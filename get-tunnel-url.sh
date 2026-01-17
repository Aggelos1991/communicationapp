#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "sleep 3\r"
expect "#"
send "journalctl -u cloudflared -n 50 --no-pager 2>/dev/null || tail -20 /var/log/syslog | grep cloudflared || ps aux | grep cloudflared\r"
expect "#"
send "exit\r"
expect eof
