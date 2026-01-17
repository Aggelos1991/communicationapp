#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "cd /opt/invoice-tracker\r"
expect "#"
send "cat > cors-update.txt << 'ENDCORS'\napp.use(cors({\n  origin: function(origin, callback) {\n    const allowedOrigins = \[\n      'http://localhost:3000',\n      'http://localhost:3001',\n      'http://localhost:3002',\n      'http://localhost:3003',\n      'http://localhost:5173',\n      'https://apcommunicationsaniikos.netlify.app'\n    \];\n    if (!origin || allowedOrigins.indexOf(origin) !== -1) {\n      callback(null, true);\n    } else {\n      callback(null, true);\n    }\n  },\n  credentials: true\n}));\nENDCORS\r"
expect "#"
send "cat cors-update.txt\r"
expect "#"
send "exit\r"
expect eof
