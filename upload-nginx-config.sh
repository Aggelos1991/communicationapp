#!/usr/bin/expect -f
set timeout 30
spawn scp -o StrictHostKeyChecking=no nginx-invoice-api.conf root@46.62.134.239:/etc/nginx/sites-available/invoice-api
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect eof
