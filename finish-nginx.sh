#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "cat > /tmp/nginx-config << 'ENDCONFIG'\nserver {\n    listen 443 ssl;\n    server_name 46.62.134.239;\n    ssl_certificate /etc/nginx/ssl/selfsigned.crt;\n    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;\n    location / {\n        proxy_pass http://localhost:3001;\n        proxy_set_header Host \\$host;\n        proxy_set_header X-Real-IP \\$remote_addr;\n        add_header Access-Control-Allow-Origin * always;\n        add_header Access-Control-Allow-Methods \"GET, POST, PUT, DELETE, PATCH, OPTIONS\" always;\n        add_header Access-Control-Allow-Headers \"*\" always;\n        if (\\$request_method = OPTIONS) {\n            return 204;\n        }\n    }\n}\nENDCONFIG\r"
expect "#"
send "cp /tmp/nginx-config /etc/nginx/sites-available/invoice-api\r"
expect "#"
send "ln -sf /etc/nginx/sites-available/invoice-api /etc/nginx/sites-enabled/\r"
expect "#"
send "nginx -t\r"
expect "#"
send "systemctl restart nginx && echo 'Nginx restarted with HTTPS'\r"
expect "#"
send "curl -k https://localhost:443/health\r"
expect "#"
send "exit\r"
expect eof
