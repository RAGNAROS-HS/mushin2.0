---
title: Why I moved from AI to Infrastructure
date: 2026-11-25
tags: [career, linux]
---
I had begun studying AI because I saw during my stay at Swapfiets just how prevalent it was becoming, and since then, that same progression has become more and more apparent.

At Swapfiets, I saw how so many people were reaching for AI for increasingly complex jobs. Customer service messages were being redirected to an in-house AI chatbot, the list goes on. Suffice it to say that at the time, I lacked a clear picture of what I wanted to do, and it was looking like AI was here to stay. Might as well hop on the bandwagon before it's too late.

What I didn't anticipate was how many times I would have to start over before figuring out what I actually wanted to do.

AI began fun. Classical ML, evolutionary robotics, which border on science fiction (think of Stanisław Lem's *Niezwyciężony*), all exciting and futuristic.

Working through my master's in this field, I picked up everything from the fundamentals to higher-level concepts like hybrid intelligence (as the VU likes to call it). It was really eye-opening and gave me solid insight into how models are developed, tested and, at their core, how they learn and work.

But as I got deeper and deeper into the study, it really dawned on me just how much of the work revolves around picking through data and fighting against randomness.

Random. A word that should spark more fear in us than it actually does. So much of AI and data work is done to fight it, to best it, to wrangle and use it to our benefit, all using maths and perfecting algorithms and formulas by tiny bits at a time.

And it's this exact deepening of knowledge that triggered me to rethink the direction I was going in. Did I really want to work on developing the latest and greatest in AI?

I somehow could not picture myself going in that direction. I couldn't muster the enthusiasm needed to plunge into it and completely immerse myself in the field.

For a while, I felt quite lost. AI was creeping in more and more, and I was learning it, yet my future was still up in the air.

But then I had a solid sit-down session with myself to really find out what I would WANT to work on, and similar to how one would develop a business idea, I started with what really ticks me off.

All throughout uni, you go through the following process:

- Open up your new assignment.
- Spend a day or two trying to figure out how in the world the staff envisions you to run it on your machine.
- Spend another couple of hours dealing with "but it works for me" style issues.

This was even more apparent in the AI master's. Courses and assignments were structured with seemingly zero regard for "production". There was no vision for deployment, dependency management or environment control.

Both CS and AI, at least in the academic environment in which I had encountered the two, suffered from a lack of "realness" in my eyes. You finish a CS degree with tonnes of scripts and assignments produced. But again, there is that chasm between those programs and a real working system.

I wanted to feel like I could actually do something by myself that works and runs for somebody. Infrastructure, in one meaning of the word or another, seemed inevitable.

And I thought that's how things were. Everyone from students to CTOs all reinstall Python from scratch to run a new framework, go down version rabbit holes and deal with pip dependency resolutions.

But who knew, that's not the case.

The rather simple thought of me wanting to remedy this critical annoyance led me to Docker. I picked up Nigel Poulton's book (*Docker Deep Dive*) and found it pretty neat.

Docker alone fixed so many problems. I was in shock, as though I had struck gold.

For the first time in a while, I found myself learning something not because I felt I had to, but rather because I genuinely wanted to understand it.

That interest led to further questions. How do I actually run containers in production? Boom, Kubernetes. Okay, but how do I have these servers running and configured in the first place? Ansible, Terraform.

And soon enough, I was way over my head in all of these high-level abstraction technologies.

I was learning more and more, and understanding proportionally less.

I realised I had started this whole thing from the wrong side. I had no grasp of the processes that this whole stack depended on.

I thought Golang would be the solution, but here again, I was met with the wall of the OS. So it was time to go, with my tail between my legs, back to the rather dreaded (during my bachelor's) Operating Systems class at my uni.

Coincidentally, this class is taught by Herbert Bos, whose connection with MINIX is a whole other rabbit hole ([click here](https://www.usenix.org/publications/login/june-2010-volume-35-number-3/minix-3-status-report-and-current-research) if you want to find out more).

This is where I began to understand what appealed to me so much about infrastructure.

The way I experienced AI was as a never-ending chase, clobbering abstraction layer on abstraction layer, bettering your scores, but at the same time distancing myself further and further from how the basic underlying computer systems work.

In infrastructure, I found that I could dig the other way. You go down in abstraction, deeper and deeper, until you hit a rock bottom of your liking. In my case, system calls. And once your foothold of understanding at that root is established, you go onwards and upwards to the more complex and abstract systems.

This was the missing link for me in AI. I wanted that foothold, something I could understand at its root and then build upon, something I could truly tinker with.

I had to start over.

Not with anything glamorous, not with flashy Kubernetes clusters (although these too I play around with from time to time), but with Unix basics.

I picked RHCSA as a goal for myself. It seemed hands-on, attainable and recognised in the field.

I was blasting my way through Van Vugt's Red Hat 10 EX200 prep book when I yet again had a grave realisation. I was long past my prime scripting days, my syntax was rusty, thinking was being outsourced to AI, and every error was a lookup.

Setting foot in Bash was a real awakening about the extent to which AI had penetrated my workflow.

Even without asking for code, the ease of having an explanation to any concept you are struggling with just being there is infectious, and it seems harmless. After all, you are writing the code yourself. But that reliance on explanations weighs heavily on one's mind.

It feels gratifying to breeze through chapters upon chapters, seemingly understanding everything. But when stripped of external help and faced with a blank shell, you realise what independent problem-solving should actually feel like.

I had made the switch in terms of my learning material, but there was still the overhanging shadow of the learning method itself.

I could feel the slippery slope of AI again, and this time I had to put my foot down. No more.

I took out my bookmark and started over (again), opening up the book from scratch, hammering in not only the suggested examples but coming back to tinkering, playing around and scripting in my own free, non-study time.

I encourage everybody to give coding without external help a shot (in the case of Bash, just man pages at your disposal). The way you interact with the material and concepts feels completely different. It's a struggle - one many of us have grown accustomed to avoiding, yet one that is so crucial to learning.

Progress is slow and yet real, I feel that every page I turn is genuinely practised. Sure, I get stuck, I find man pages a bit ambiguous at times, and searching `man -k` with the right magic word is a bit of a hassle, but I feel infinitely better doing this than looking down the barrel of AI model development.

Can an AI write a Bash script 10x better than me right now?

Absolutely.

But the way I see it, it doesn't matter. If I never learn the basics, I can never hope to keep up with or control to any degree what these coding models produce.

There is a difference between being able to produce something and being able to understand it. Somewhere along the way, I had started confusing the two.

Looking back, I've had to start over three times. First to figure out what I wanted to learn, then to figure out where I needed to start learning, and finally to rethink how I was learning in the first place.

This post, although long-winded, was meant to illustrate that it's never too late to start over. Frankly, often it's the best thing to do, even on the task level.

You feel you are pursuing the wrong field? Rethink your direction.

You feel you are learning the wrong way? Drop it and start over.

Learning a technology that you can't understand to its root? Go one layer below.

**Start over. Go slow. Practise yourself.**
