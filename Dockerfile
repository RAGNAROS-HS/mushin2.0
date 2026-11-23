# Stage 1: render the site into dist/ (bin/build.py, standard library only).
FROM python:3.13-alpine AS build
WORKDIR /src
COPY bin/ bin/
COPY templates/ templates/
COPY content/ content/
COPY tracks/ tracks/
COPY img/ img/
COPY pdfs/ pdfs/
COPY styles.css *.js ./
RUN python3 bin/build.py

# Stage 2: the site is plain static files served by nginx.
FROM nginx:alpine
COPY --from=build /src/dist/ /usr/share/nginx/html/
EXPOSE 80
