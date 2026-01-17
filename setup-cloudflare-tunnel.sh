#!/usr/bin/expect -f
set timeout 60
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb\r"
expect "#"
send "dpkg -i cloudflared.deb\r"
expect "#"
send "cloudflared tunnel --url http://localhost:3001 &\r"
expect "#"
send "sleep 5\r"
expect "#"
send "ps aux | grep cloudflared | grep -v grep\r"
expect "#"
send "exit\r"
expect eof
