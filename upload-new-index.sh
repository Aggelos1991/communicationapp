#!/usr/bin/expect -f
set timeout 60
spawn scp -o StrictHostKeyChecking=no server/index-updated.js root@46.62.134.239:/opt/invoice-tracker/index.js
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect {
    "100%" {
        puts "\nFile uploaded"
    }
    eof
}
