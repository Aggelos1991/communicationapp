#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "ps aux | grep 'cloudflared tunnel' | grep -v grep\r"
expect "#"
send "kill %1 2>/dev/null; pkill cloudflared 2>/dev/null; echo 'Killed old tunnel'\r"
expect "#"
send "nohup cloudflared tunnel --url http://localhost:3001 > /tmp/tunnel.log 2>&1 &\r"
expect "#"
send "sleep 8\r"
expect "#"
send "cat /tmp/tunnel.log | grep -E 'trycloudflare.com|https://'\r"
expect "#"
send "exit\r"
expect eof
