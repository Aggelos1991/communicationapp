#!/usr/bin/expect -f
set timeout 60
spawn ssh -o StrictHostKeyChecking=no root@46.62.134.239
expect "password:" 
send "vpc4hxJ9c7sT\r"
expect "#"
send "mkdir -p /etc/nginx/ssl\r"
expect "#"
send "openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/ssl/selfsigned.key -out /etc/nginx/ssl/selfsigned.crt -subj '/CN=46.62.134.239'\r"
expect "#"
send "cat > /etc/nginx/sites-available/invoice-api << 'ENDNGINX'\nserver {\n    listen 443 ssl;\n    server_name 46.62.134.239;\n\n    ssl_certificate /etc/nginx/ssl/selfsigned.crt;\n    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;\n\n    location / {\n        proxy_pass http://localhost:3001;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade \\$http_upgrade;\n        proxy_set_header Connection 'upgrade';\n        proxy_set_header Host \\$host;\n        proxy_cache_bypass \\$http_upgrade;\n        proxy_set_header X-Real-IP \\$remote_addr;\n        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \\$scheme;\n    }\n}\nENDNGINX\r"
expect "#"
send "ln -sf /etc/nginx/sites-available/invoice-api /etc/nginx/sites-enabled/\r"
expect "#"
send "nginx -t && systemctl restart nginx\r"
expect "#"
send "systemctl status nginx | head -5\r"
expect "#"
send "exit\r"
expect eof
