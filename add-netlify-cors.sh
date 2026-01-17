#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "cd /opt/invoice-tracker\r"
expect "#"
send "grep -n 'app.use(cors' index.js\r"
expect "#"
send "exit\r"
expect eof
