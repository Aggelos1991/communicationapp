#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "root@"
send "cd /opt/invoice-tracker\r"
expect "root@"
send "cat > cors-fix.js << 'EOFJS'\nconst allowedOrigins = ['http://localhost:5173', 'http://localhost:3002', 'http://46.62.134.239'];\nmodule.exports = {\n  origin: function(origin, callback) {\n    if (!origin || allowedOrigins.includes(origin)) {\n      callback(null, true);\n    } else {\n      callback(null, true); // Allow all for now\n    }\n  },\n  credentials: true\n};\nEOFJS\r"
expect "root@"
send "systemctl restart invoice-tracker\r"
expect "root@"
send "exit\r"
expect eof
