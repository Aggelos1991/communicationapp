#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "mysql -e \"ALTER USER 'invoice_user'@'%' IDENTIFIED WITH mysql_native_password BY 'InvoiceSecure2024!';\"\r"
expect "#"
send "mysql -e \"FLUSH PRIVILEGES;\"\r"
expect "#"
send "echo 'MySQL user updated with native password authentication'\r"
expect "#"
send "exit\r"
expect eof
