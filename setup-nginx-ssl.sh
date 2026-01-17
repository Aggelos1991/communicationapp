#!/usr/bin/expect -f
set timeout 60
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "apt-get update && apt-get install -y nginx certbot python3-certbot-nginx\r"
expect "#"
send "systemctl stop nginx\r"
expect "#"
send "certbot certonly --standalone -d 46.62.134.239 --register-unsafely-without-email --agree-tos --non-interactive || echo 'Certbot failed - IP addresses not supported'\r"
expect "#"
send "exit\r"
expect eof
