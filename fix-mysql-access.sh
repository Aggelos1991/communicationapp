#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "mysql -e \"GRANT ALL PRIVILEGES ON invoice_tracker.* TO 'invoice_user'@'%'; FLUSH PRIVILEGES;\"\r"
expect "#"
send "mysql -e \"SELECT user, host FROM mysql.user WHERE user='invoice_user';\"\r"
expect "#"
send "exit\r"
expect eof
