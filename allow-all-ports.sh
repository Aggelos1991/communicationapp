#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "cat > /opt/invoice-tracker/cors-config.js << 'EOFJS'\nconst allowedOrigins = [\n  'http://localhost:3000',\n  'http://localhost:3001', \n  'http://localhost:3002',\n  'http://localhost:3003',\n  'http://localhost:5173',\n  'http://192.168.64.1:3000',\n  'http://192.168.64.1:3001',\n  'http://192.168.64.1:3002',\n  'http://192.168.64.1:3003'\n];\nmodule.exports = {\n  origin: function(origin, callback) {\n    if (!origin || allowedOrigins.includes(origin)) {\n      callback(null, true);\n    } else {\n      callback(null, true);\n    }\n  },\n  credentials: true\n};\nEOFJS\r"
expect "#"
send "cat /opt/invoice-tracker/cors-config.js\r"
expect "#"
send "exit\r"
expect eof
