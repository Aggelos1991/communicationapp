#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "mysql -u invoice_user -p'InvoiceSecure2024!' -e 'SELECT 1;'\r"
expect "#"
send "exit\r"
expect eof
