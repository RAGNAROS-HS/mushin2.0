---
title: Himantes
group: archive
order: 6
status: abandoned
date: 2026-01-22
summary: Pokémon type classifier and generator
summary_pl: Klasyfikator i generator typów Pokémon
description: Himantes — an abandoned multi-label Pokémon type classifier in PyTorch. A working pipeline that never generalised, and the post-mortem on why.
format: html
---

    <p><strong>STATUS: ABANDONED</strong></p>

    <blockquote>
      <p><strong>Post-mortem:</strong> this project has been discontinued. While a functional classification pipeline was established, the model struggled to generalise effectively. The primary blockers were:</p>
      <ol>
        <li><strong>High-variance anatomy</strong> — Pokémon designs exhibit extreme morphological diversity within the same type (e.g. <em>Charmander</em> vs. <em>Torkoal</em>), making visual patterns difficult for a standard CNN to capture without massive data.</li>
        <li><strong>Insufficient data</strong> — the available dataset provided too few examples per class to overcome the high variance, likely leading to overfitting or poor feature representation.</li>
      </ol>
    </blockquote>

    <h2>Project Overview</h2>

    <p>This project aimed to build a deep learning system to classify Pokémon types from images using PyTorch and Hugging Face's <code>datasets</code>. The goal was to train a custom CNN to predict up to two types for a given Pokémon image.</p>

    <h2>Implemented Features</h2>

    <h3>1. Data pipeline &amp; analysis</h3>
    <ul>
      <li><strong>Integration</strong>: integrated the <code>pranavs28/pokemon_types</code> dataset.</li>
      <li><strong>Distribution analysis</strong>: mapped class imbalances using <code>analyze_distribution.py</code> to understand the prevalence of types like Water/Normal vs. rarer types like Ice/Ghost.</li>
      <li><strong>Normalisation</strong>: calculated custom normalisation statistics (mean/std) specifically for this dataset using <code>normalization_calculator.py</code> to ensure optimal model convergence.
        <ul>
          <li>Mean: <code>[0.8412, 0.8291, 0.8151]</code></li>
          <li>Std: <code>[0.2417, 0.2473, 0.2593]</code></li>
        </ul>
      </li>
    </ul>

    <h3>2. Model architecture</h3>
    <ul>
      <li><strong>Custom CNN</strong>: a 6-layer convolutional neural network with
        <ul>
          <li>adaptive average pooling <code>(4,4)</code> to handle spatial feature variations,</li>
          <li>dropout (<code>0.5</code>) in fully connected layers to mitigate overfitting.</li>
        </ul>
      </li>
      <li><strong>Multi-label support</strong>: designed for 18 distinct types using a multi-hot encoding scheme.</li>
    </ul>

    <h3>3. Training strategy (<code>classifier_training.py</code>)</h3>
    <ul>
      <li><strong>Loss function</strong>: <code>BCEWithLogitsLoss</code> with <strong>calculated class weights</strong> (<code>pos_weights</code>) to counter the significant dataset imbalance (e.g. Water types being much more common than Ice).</li>
      <li><strong>Optimiser</strong>: SGD with momentum (<code>0.9</code>) for stable convergence.</li>
      <li><strong>Artifacts</strong>: saves the best model state to <code>pokemon_classifier.pth</code>.</li>
    </ul>

    <h3>4. Inference &amp; visualisation (<code>run_classifier.py</code>)</h3>
    <ul>
      <li><strong>Preprocessing</strong>: robust pipeline resizing images to 512×512 and applying the calculated normalisation.</li>
      <li><strong>Inference engine</strong>: loads the trained model and applies threshold-based prediction logic.</li>
      <li><strong>Visualiser</strong>: uses <code>extract_types()</code> and Matplotlib to display side-by-side comparisons of ground truth vs. predicted types.</li>
    </ul>

    <h2>Project Structure</h2>

<pre><code>Himantes/
├── classifier_training.py      # Main training script (model definition + training loop)
├── run_classifier.py           # Inference script for visualisation and testing
├── analyze_distribution.py     # Utility to analyse dataset class distribution
├── normalization_calculator.py # Script to compute dataset mean/std
├── requirements.txt            # Project dependencies
└── README.md                   # Project documentation</code></pre>

    <h2>Dependencies</h2>
    <ul>
      <li><code>torch</code> (PyTorch)</li>
      <li><code>datasets</code> (Hugging Face)</li>
      <li><code>torchvision</code></li>
      <li><code>matplotlib</code></li>
      <li><code>numpy</code></li>
    </ul>

    <h2>Usage (Historical)</h2>

    <h3>1. Train the model</h3>
<pre><code>python classifier_training.py</code></pre>

    <h3>2. Run inference (visualise results)</h3>
<pre><code>python run_classifier.py</code></pre>

    <h3>3. Utilities</h3>
<pre><code>python normalization_calculator.py
python analyze_distribution.py</code></pre>
