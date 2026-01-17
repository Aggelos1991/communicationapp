#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "sed -i 's/DB_PASSWORD=.*/DB_PASSWORD=InvoiceDB2024/' /opt/invoice-tracker/.env\r"
expect "#"
send "systemctl restart invoice-tracker\r"
expect "#"
send "sleep 2\r"
expect "#"
send "echo 'Backend updated with new DB password'\r"
expect "#"
send "exit\r"
expect eof
