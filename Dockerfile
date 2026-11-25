# Stage 1: render the site into dist/ (bin/build.py, standard library only).
FROM python:3.13-alpine AS build
# The commit being built; ends up in /version.txt so bin/site can tell what's live.
ARG GIT_SHA=dev
WORKDIR /src
COPY bin/ bin/
COPY templates/ templates/
COPY content/ content/
COPY posts/ posts/
COPY fonts/ fonts/
COPY pdfs/ pdfs/
COPY styles.css app.js ./
RUN GIT_SHA="$GIT_SHA" python3 bin/build.py

# Stage 2: plain static files served by nginx, with the site's own config.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/ /usr/share/nginx/html/
EXPOSE 80
