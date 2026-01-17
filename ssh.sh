#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239 {*}$argv
expect "password:" { send "vpc4hxJ9c7sT\r"; interact }
