# Host nginx on the VPS (one-time, needs sudo)

The host nginx on `websitevps` terminates TLS and proxies to the site's
container on `127.0.0.1:3000`. Its site config currently lives inline in
`/etc/nginx/nginx.conf`, written partly by certbot. As of 2026-11-25:

- `https://hugokatzer.tech` (no www) fails with a certificate error, because
  the certificate only covers `www.hugokatzer.tech`;
- `http://hugokatzer.tech` returns 404, because no server block matches the
  bare domain;
- there's no HSTS header, and the proxy doesn't pass `X-Forwarded-Proto`.

The canonical address is **`https://www.hugokatzer.tech`**. Everything else
301s to it.

## 1. Back up the current config

```sh
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak-$(date +%F)
```

## 2. Get a certificate that covers both names

This expands the existing `www` certificate to include the bare domain.
Certbot keeps renewing it as before.

```sh
sudo certbot certonly --nginx --cert-name www.hugokatzer.tech \
  -d www.hugokatzer.tech -d hugokatzer.tech
```

## 3. Replace the hugokatzer.tech server blocks

In `/etc/nginx/nginx.conf`, delete the two `server { ... }` blocks for
`www.hugokatzer.tech`: the `listen 443 ssl` one with `proxy_pass
http://127.0.0.1:3000`, and the `listen 80` one that returns 404. Leave the
`rss.hugokatzer.tech` blocks alone. Then put this in
`/etc/nginx/sites-available/hugokatzer.tech`:

```nginx
# http (both names) -> https://www
server {
    listen 80;
    listen [::]:80;
    server_name hugokatzer.tech www.hugokatzer.tech;
    return 301 https://www.hugokatzer.tech$request_uri;
}

# https bare domain -> https://www
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name hugokatzer.tech;
    ssl_certificate /etc/letsencrypt/live/www.hugokatzer.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.hugokatzer.tech/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    return 301 https://www.hugokatzer.tech$request_uri;
}

# the site
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name www.hugokatzer.tech;
    ssl_certificate /etc/letsencrypt/live/www.hugokatzer.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.hugokatzer.tech/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Two details to check before saving:
- If `ls /etc/letsencrypt/ssl-dhparams.pem` finds nothing, drop the two
  `ssl_dhparam` lines.
- `rss.hugokatzer.tech` already has `listen [::]:443 ssl ipv6only=on`. Only
  one server block per port may carry `ipv6only=on`, and the blocks above
  don't, so nothing clashes.

Then enable the file and reload:

```sh
sudo ln -s /etc/nginx/sites-available/hugokatzer.tech /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` checks the syntax before anything goes live. If it complains,
nothing has changed yet. If something breaks after the reload, restore the
backup from step 1 and reload again.

## 4. Check

From your laptop:

```sh
curl -sI http://hugokatzer.tech/x       | grep -i location   # https://www.hugokatzer.tech/x
curl -sI https://hugokatzer.tech/x      | grep -i location   # https://www.hugokatzer.tech/x
curl -sI https://www.hugokatzer.tech/   | grep -i strict     # Strict-Transport-Security
curl -s -m 5 http://76.13.130.84:3000/ || echo closed        # closed, after the first bin/site deploy
```

Port 3000 closes once `bin/site deploy` has run the new `compose.prod.yaml`,
which binds the container to `127.0.0.1` only.
