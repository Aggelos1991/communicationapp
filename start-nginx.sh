#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "ln -sf /etc/nginx/sites-available/invoice-api /etc/nginx/sites-enabled/\r"
expect "#"
send "nginx -t\r"
expect "#"
send "systemctl restart nginx\r"
expect "#"
send "sleep 2\r"
expect "#"
send "curl -k https://localhost/health\r"
expect "#"
send "netstat -tlnp | grep 443\r"
expect "#"
send "exit\r"
expect eof
