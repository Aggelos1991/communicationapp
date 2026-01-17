#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "systemctl restart invoice-tracker\r"
expect "#"
send "sleep 3\r"
expect "#"
send "systemctl status invoice-tracker --no-pager | head -10\r"
expect "#"
send "journalctl -u invoice-tracker -n 5 --no-pager\r"
expect "#"
send "exit\r"
expect eof
