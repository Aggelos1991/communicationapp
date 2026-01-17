#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "mysql << 'EOSQL'\nDROP USER IF EXISTS 'invoice_user'@'%';\nCREATE USER 'invoice_user'@'%' IDENTIFIED WITH mysql_native_password BY 'InvoiceDB2024';\nGRANT ALL PRIVILEGES ON invoice_tracker.* TO 'invoice_user'@'%';\nFLUSH PRIVILEGES;\nSELECT user, host FROM mysql.user WHERE user='invoice_user';\nEOSQL\r"
expect "#"
send "exit\r"
expect eof
