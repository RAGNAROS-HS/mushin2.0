---
title: Tosach
status: limbo
date: 2026-01-27
summary: Scene text recognition with a CRNN
description: Tosach — a CRNN implementation for end-to-end scene text recognition in TensorFlow/Keras. Architecture built, dataset prepared, training not yet run.
format: html
---

    <p>Implementation of the CRNN (Convolutional Recurrent Neural Network) architecture from <a href="https://arxiv.org/abs/1507.05717">Shi et al., 2015</a> for end-to-end scene text recognition using TensorFlow/Keras.</p>

    <blockquote>
      <p><strong>Status: limbo</strong> — the architecture is implemented and the dataset is prepared, but training has not been run yet. I went to great lengths to read up on the background material and set it up, but the scope of the project became too large. The dataset is huge and the compute required is equally extensive. I deployed the legacy approach of per-letter recognition, but the proper fully fledged CRNN is yet to be trained. I'll probably complete it once I am up for the challenge of getting VertexAI to work. For now I'm pursuing smaller scale projects.</p>
    </blockquote>

    <h2>Overview</h2>

    <p>The model recognises text in natural scene images by combining:</p>
    <ul>
      <li><strong>CNN</strong> (VGG-style) for visual feature extraction</li>
      <li><strong>Bidirectional LSTM</strong> for sequence modelling</li>
      <li><strong>CTC loss</strong> for sequence-to-label transcription without character-level annotations</li>
    </ul>

    <h2>Project Structure</h2>

    <div class="tbl">
    <table>
      <thead><tr><th>File</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><code>train_crnn.py</code></td><td>CRNN model architecture + training pipeline</td></tr>
        <tr><td><code>synthtiger_loader.py</code></td><td>Data loader for the SynthTiger dataset (tf.data)</td></tr>
        <tr><td><code>extract_synthtiger.py</code></td><td>Memory-efficient extractor for the large SynthTiger zip</td></tr>
        <tr><td><code>study_content.txt</code></td><td>Extracted text from the reference paper</td></tr>
        <tr><td><code>study.pdf</code></td><td>Original paper (Shi et al., 2015)</td></tr>
        <tr><td><code>legacy/</code></td><td>Earlier prototype (deprecated)</td></tr>
      </tbody>
    </table>
    </div>

    <h2>Dataset</h2>

    <p><strong>SynthTiger v1.0</strong> — synthetic text images with ground truth labels. The dataset is ~38GB and must be extracted before training.</p>

<pre><code>pip install stream-unzip
python extract_synthtiger.py</code></pre>

    <h2>Architecture (from the paper)</h2>

<pre><code>Input (W × 32 grayscale)
  → 7 Conv layers (64 → 512 maps) + BatchNorm + MaxPool
  → Map-to-Sequence
  → 2× Bidirectional LSTM (256 hidden units)
  → CTC Transcription
  → Predicted text</code></pre>

    <h2>Legacy</h2>

    <p>The <code>legacy/</code> folder contains an earlier prototype that used a simpler per-character classification approach:</p>
    <ul>
      <li><strong>Simple CNN</strong> (Conv2D → MaxPool → Dense) trained on 28×28 grayscale character images from a Kaggle OCR dataset</li>
      <li><strong>Per-character pipeline</strong>: segment individual characters → classify each with the CNN → concatenate results</li>
      <li>Abandoned in favour of the CRNN approach, which handles full words end-to-end without character segmentation</li>
    </ul>

    <div class="tbl">
    <table>
      <thead><tr><th>File</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td><code>model_training.py</code></td><td>CNN classifier training (62 classes: A–Z, a–z, 0–9)</td></tr>
        <tr><td><code>data_process.py</code></td><td>Sorts character images into class folders</td></tr>
        <tr><td><code>run_inference.py</code></td><td>Runs predictions on validation samples</td></tr>
        <tr><td><code>idea.md</code></td><td>Original project plan</td></tr>
      </tbody>
    </table>
    </div>
