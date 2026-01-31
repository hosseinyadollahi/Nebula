# راهنمای جامع استقرار (Deployment) کلاینت Nebula SSH

این راهنما مراحل کامل راه‌اندازی این اپلیکیشن روی یک سرور لینوکسی (مانند Ubuntu 20.04/22.04) را پوشش می‌دهد.

---

## ۱. پیش‌نیازها (Prerequisites)

ابتدا باید نرم‌افزارهای لازم را روی سرور نصب کنید.

### به‌روزرسانی سیستم
```bash
sudo apt update && sudo apt upgrade -y
```

### نصب Node.js (نسخه LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```
با دستور `node -v` و `npm -v` نصب را تایید کنید.

### نصب Nginx
```bash
sudo apt install -y nginx
```

---

## ۲. آماده‌سازی پروژه

پروژه را روی سرور کلون کنید یا فایل‌ها را آپلود نمایید. سپس مراحل زیر را در پوشه اصلی پروژه انجام دهید:

### نصب وابستگی‌ها
```bash
npm install
```

### بیلد کردن پروژه (Build)
این مرحله کدهای React را به فایل‌های استاتیک HTML/JS/CSS تبدیل می‌کند و در پوشه `dist` قرار می‌دهد. این کار برای امنیت و کارایی ضروری است تا کدهای خام روی سرور نباشند.
```bash
npm run build
```

---

## ۳. اجرای سرویس (Node.js Service)

برای اینکه برنامه همیشه در حال اجرا باشد (حتی بعد از ریستارت سرور)، از `PM2` یا `Systemd` استفاده می‌کنیم. در اینجا روش استاندارد **Systemd** توضیح داده شده است.

### ایجاد فایل سرویس
یک فایل سرویس جدید بسازید:
```bash
sudo nano /etc/systemd/system/nebula.service
```

محتوای زیر را در آن قرار دهید (مسیرها را مطابق سرور خود تغییر دهید):

```ini
[Unit]
Description=Nebula SSH Client Web Service
After=network.target

[Service]
# کاربری که سرویس با آن اجرا می‌شود (مثلاً root یا ubuntu)
User=ubuntu
# مسیر پروژه
WorkingDirectory=/home/ubuntu/nebula-ssh-client
# دستور اجرا
ExecStart=/usr/bin/node server/index.js
# Environment Variables
Environment=NODE_ENV=production
Environment=PORT=8080
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### فعال‌سازی سرویس
```bash
sudo systemctl daemon-reload
sudo systemctl start nebula
sudo systemctl enable nebula
```
بررسی وضعیت:
```bash
sudo systemctl status nebula
```

---

## ۴. تنظیمات Nginx (Reverse Proxy)

وب‌سرور Nginx به عنوان یک لایه امنیتی و مدیریت کننده ترافیک جلوی برنامه Node.js قرار می‌گیرد.

یک فایل کانفیگ جدید بسازید:
```bash
sudo nano /etc/nginx/sites-available/nebula
```

محتوای زیر را قرار دهید:

```nginx
server {
    listen 80;
    server_name your-domain.com; # دامنه یا IP سرور خود را وارد کنید

    # تنظیمات امنیتی پایه
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    location / {
        proxy_pass http://127.0.0.1:8080; # پورت تعریف شده در کانفیگ سرور
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # لاگ‌گیری دقیق برای این سرویس
        access_log /var/log/nginx/nebula_access.log;
        error_log /var/log/nginx/nebula_error.log;
    }
}
```

### فعال‌سازی سایت
```bash
sudo ln -s /etc/nginx/sites-available/nebula /etc/nginx/sites-enabled/
sudo nginx -t # تست سالم بودن کانفیگ
sudo systemctl restart nginx
```

---

## ۵. امنیت و فایروال (UFW)

فقط پورت‌های ضروری (SSH, HTTP, HTTPS) را باز بگذارید.

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## ۶. نکات میکروسرویس و توسعه

*   **معماری:** فایل‌های سرور در پوشه `server/` به صورت ماژولار (`routes`, `middleware`, `config`) جدا شده‌اند. اگر قصد اضافه کردن قابلیت واقعی SSH (WebSocket) را دارید، باید در `routes.js` یا یک فایل سرویس جداگانه WebSocket Server را راه‌اندازی کنید.
*   **جلوگیری از تغییرات تصادفی:** چون ما از `npm run build` استفاده می‌کنیم، فایل‌های اجرایی نهایی در پوشه `dist` هستند که Read-only در نظر گرفته می‌شوند. تغییر در کدهای `src` تاثیری روی سایت زنده ندارد مگر اینکه دوباره دستور بیلد اجرا شود.

---

## ۷. فعال‌سازی HTTPS (پیشنهادی)

برای دریافت گواهینامه رایگان SSL از Certbot استفاده کنید:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
