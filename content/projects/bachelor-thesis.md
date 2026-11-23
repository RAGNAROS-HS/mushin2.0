---
title: Bachelor Thesis
group: ml
order: 1
status: complete
date: 2025-06-01
summary: Detecting collapsed buildings with UNET++
summary_pl: Wykrywanie zawalonych budynków siecią UNET++
description: Bachelor thesis — detecting collapsed buildings from satellite imagery using UNET++ and shadow-based heuristics, plus an honest post-mortem of what went wrong.
format: html
---

    <p>My bachelor's degree concluded with this project — detecting collapsed buildings using UNET++ and shadow-based heuristics from satellite imagery. It is quite expansive, so I highly recommend reading through the thesis itself if you'd like to understand it in its entirety:</p>

    <div class="note">
      <p>📄 <a href="../pdfs/Thesis_Hugo_SK.pdf">Thesis_Hugo_SK.pdf</a> — the full document.</p>
    </div>

    <hr>

    <h2>Notes &amp; Reflections</h2>

    <p>But I can give some notes of my own, since some time has passed since I handed this in (as of the time of writing this).</p>

    <p>Firstly I would say that this thesis was a giant jump in terms of data volume and project scope from anything I had done before. I managed to cobble it together, but if I were to do it all again, much would be different:</p>

    <hr>

    <h2>Lessons Learned</h2>

    <ul>
      <li><strong>Trusted my predecessor too much</strong> — since someone had given a quite successful crack at it the previous year, I thought that I would simply run what they made and expand upon it. But in the end I lost lots of time trying to fix or interpret what they did, rather than pursue my own original direction.</li>
      <li><strong>Did not analyse my data enough</strong> — sure, some graphs and distributions are shown, but I should have spent at least triple the amount of time delving deep into the images, keeping the data imbalance in mind.</li>
      <li><strong>Got lost in my own code</strong> — having such a large scope I ended up forgetting, not understanding and/or patching together code snippets from sources which I did not fully understand. I spent significant amounts of time walking in circles just because I had not built a solid foundation of understanding.</li>
      <li><strong>Didn't carve out a test set early</strong> — with the data volume being staggeringly high, lots was wasted on errored or faulty transformations of this dataset. More dry runs and end-to-end runs on small fragments were definitely in order.</li>
      <li><strong>Didn't use LaTeX</strong> — it seemed too daunting and impractical, but over the last couple of months I've grown to like it and appreciate its efficiency and looks. Will definitely use Overleaf LaTeX next time.</li>
    </ul>

    <hr>

    <h2>Takeaway</h2>

    <p>You might read all these and think — oh my god, this dude had no idea what he was doing. And you would be right. But in the end, I learned so much from these failures and shortcomings. Every time I see a dataset, or every time I inherit some architecture or review an AI code snippet, this project comes to mind. It has taught me to be more thoughtful, careful, and most importantly — patient. Taking a step back and not rushing saves you time in the long run.</p>
