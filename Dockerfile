# Stage 1: render ~/log from log/entries/*.md (standard library only).
FROM python:3.13-alpine AS log
WORKDIR /src
COPY bin/ bin/
COPY log/ log/
RUN python3 bin/build_log.py

# Stage 2: the site is plain static files served by nginx.
FROM nginx:alpine

COPY index.html styles.css app.js pixel.js /usr/share/nginx/html/
COPY projects/ /usr/share/nginx/html/projects/
COPY img/ /usr/share/nginx/html/img/
COPY pdfs/ /usr/share/nginx/html/pdfs/
COPY --from=log /src/log/ /usr/share/nginx/html/log/

EXPOSE 80
