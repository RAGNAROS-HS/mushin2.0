---
title: Mushin
status: active
date: 2026-02-23
summary: This very website
description: Mushin — hugokatzer.tech as plain static files in an nginx container, built by GitHub Actions, pushed to GHCR and run with Docker Compose on a VPS.
format: html
---

    <p>Mushin is this website: <a href="https://hugokatzer.tech/">hugokatzer.tech</a>. It is plain HTML, CSS and a few small files of vanilla JavaScript, with no framework and no theme. One standard-library Python script, <code>bin/build.py</code>, wraps every page in the same shell and renders the project pages and track writeups from Markdown into <code>dist/</code>. What I care about more is how it gets from a commit to a running server, because that part is ordinary operations work.</p>

    <h2>How it runs</h2>
    <ul>
      <li><strong>Image:</strong> a two-stage <code>Dockerfile</code>: a Python stage runs the build, then <code>dist/</code> is copied into <code>nginx:alpine</code>. That is the whole container. A bad objective id or an unknown tree species fails the build, so it never goes live.</li>
      <li><strong>Build:</strong> on every push to <code>main</code>, a GitHub Actions workflow builds the image and pushes it to GitHub Container Registry, tagged both <code>latest</code> and with the commit SHA.</li>
      <li><strong>Server:</strong> a rented VPS runs the container with Docker Compose (<code>compose.prod.yaml</code>), published on port 3000. A reverse proxy in front of it terminates TLS for the domain.</li>
      <li><strong>Deploy:</strong> manual and deliberate: I pull the new image and recreate the container.</li>
    </ul>

<pre><code># on the VPS
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d</code></pre>

    <p>Because every build is also tagged with its commit SHA, an older version can be pinned and pulled back if a change goes wrong.</p>

    <h2>Local development</h2>

    <p><code>compose.yaml</code> builds the same image locally. A <code>compose.override.yaml</code>, which Compose merges automatically, bind-mounts <code>dist/</code> into the container, so a rerun of the build shows up on refresh without rebuilding the image.</p>

<pre><code>python3 bin/build.py              # render into dist/
docker compose up -d --build      # dev: dist/ live on localhost:3000
docker compose -f compose.yaml up -d --build   # the real image, no mount</code></pre>

    <h2>The beaver</h2>

    <p>The pixel beaver, his trees and what he builds are drawn in the browser from text sprite maps and small procedural generators (<code>pixel.js</code>), with no image files. The site is split in two: a plain about page for the CV, and <a href="../woods/index.html">the woods</a>, where each track (a weekly cert log, or notes) is a stand of its own tree species, every objective a tree, felled once passed, its log going into that track's build. The books I read live in the lodge. The beaver comes from the logo of an earlier project, <a href="stumberg.html">Stumberg</a>.</p>

    <div class="note">
      <p>Previously, Mushin was a Hugo static site deployed by SFTP to a Cloudpanel VPS. Version 2.0 dropped the generator and moved to a container image, which is simpler to run and to roll back.</p>
    </div>
