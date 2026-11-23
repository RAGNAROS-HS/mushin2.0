---
title: Zamin
status: active
date: 2026-02-11
summary: ML algorithms written from scratch
description: Zamin — housing price prediction on the Boston Housing dataset three ways: hand-coded gradient descent, a Keras network, and an evolutionary algorithm.
format: html
---

    <p>This project explores <strong>housing price prediction</strong> on the Boston Housing dataset using multiple approaches — from hand-coded gradient descent to deep learning — to understand the fundamentals of regression at every level of abstraction.</p>

    <h2>Dataset</h2>

    <p><strong>Source:</strong> <a href="https://www.kaggle.com/datasets/altavish/boston-housing-dataset">Boston Housing (Kaggle)</a></p>

    <ul>
      <li><strong>506 samples</strong>, <strong>13 features</strong>, <strong>1 target</strong> (<code>MEDV</code> — median home value in $1000s)</li>
      <li><strong>Train/test split:</strong> 80/20 (random state 42)</li>
      <li><strong>Preprocessing:</strong> z-score standardisation (mean/std computed on the train set only, applied to both)</li>
    </ul>

    <h3>Features</h3>

    <div class="tbl">
    <table>
      <thead><tr><th>Feature</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><code>CRIM</code></td><td>Per capita crime rate by town</td></tr>
        <tr><td><code>ZN</code></td><td>Proportion of residential land zoned for lots &gt; 25k sqft</td></tr>
        <tr><td><code>INDUS</code></td><td>Proportion of non-retail business acres per town</td></tr>
        <tr><td><code>CHAS</code></td><td>Charles River dummy variable (1 if tract bounds river)</td></tr>
        <tr><td><code>NOX</code></td><td>Nitric oxide concentration (parts per 10 million)</td></tr>
        <tr><td><code>RM</code></td><td>Average number of rooms per dwelling</td></tr>
        <tr><td><code>AGE</code></td><td>Proportion of owner-occupied units built pre-1940</td></tr>
        <tr><td><code>DIS</code></td><td>Weighted distances to five Boston employment centres</td></tr>
        <tr><td><code>RAD</code></td><td>Index of accessibility to radial highways</td></tr>
        <tr><td><code>TAX</code></td><td>Full-value property tax rate per $10,000</td></tr>
        <tr><td><code>PTRATIO</code></td><td>Pupil-teacher ratio by town</td></tr>
        <tr><td><code>B</code></td><td>1000(Bk − 0.63)² where Bk is the proportion of Black residents</td></tr>
        <tr><td><code>LSTAT</code></td><td>Percentage lower status of the population</td></tr>
        <tr><td><strong>MEDV</strong></td><td><strong>Median value of owner-occupied homes ($1000s) — target</strong></td></tr>
      </tbody>
    </table>
    </div>

    <hr>

    <h2>Dataset Analysis</h2>

    <h3>Feature distributions</h3>

    <p>Histograms for all 14 variables in the dataset:</p>

    <div class="figs">
      <figure class="fig"><img loading="lazy" src="../img/CRIM.png" alt="CRIM distribution"><figcaption>CRIM</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/ZN.png" alt="ZN distribution"><figcaption>ZN</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/INDUS.png" alt="INDUS distribution"><figcaption>INDUS</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/CHAS.png" alt="CHAS distribution"><figcaption>CHAS</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/NOX.png" alt="NOX distribution"><figcaption>NOX</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/RM.png" alt="RM distribution"><figcaption>RM</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/AGE.png" alt="AGE distribution"><figcaption>AGE</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/DIS.png" alt="DIS distribution"><figcaption>DIS</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/RAD.png" alt="RAD distribution"><figcaption>RAD</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/TAX.png" alt="TAX distribution"><figcaption>TAX</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/PTRATIO.png" alt="PTRATIO distribution"><figcaption>PTRATIO</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/B.png" alt="B distribution"><figcaption>B</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/LSTAT.png" alt="LSTAT distribution"><figcaption>LSTAT</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/MEDV.png" alt="MEDV distribution"><figcaption>MEDV (target)</figcaption></figure>
    </div>

    <h3>Correlation analysis</h3>

    <div class="figs">
      <figure class="fig"><img loading="lazy" src="../img/corr_heatmap.png" alt="Correlation heatmap"><figcaption>Standard correlation heatmap</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/corr_clustermap.png" alt="Correlation clustermap"><figcaption>Hierarchical clustered correlation map</figcaption></figure>
    </div>

    <p><strong>Key correlations with MEDV (target):</strong></p>
    <ul>
      <li><strong>Strong positive:</strong> <code>RM</code> (rooms) — more rooms → higher price</li>
      <li><strong>Strong negative:</strong> <code>LSTAT</code> (lower status %) — higher LSTAT → lower price</li>
      <li><strong>Notable negatives:</strong> <code>PTRATIO</code>, <code>INDUS</code>, <code>TAX</code>, <code>CRIM</code></li>
    </ul>

    <hr>

    <h2>Methods Implemented</h2>

    <h3>1. Gradient descent — linear regression from scratch (<code>rawRun.py</code>)</h3>

    <p>A <strong>pure NumPy</strong> implementation with no ML library abstractions:</p>
    <ul>
      <li>Manual weight initialisation (<code>w ~ N(0, 0.01)</code>, <code>b = 0</code>)</li>
      <li>MSE loss with analytical gradient computation</li>
      <li>Convergence tolerance check (<code>tol = 1e-4</code>)</li>
      <li><strong>Hyperparameters:</strong> <code>α = 0.001</code>, <code>epochs = 1200</code></li>
    </ul>

<pre><code># Core update rule (no libraries)
dw = (2 / m) * X_train.T @ (y_pred - y_train)
db = (2 / m) * sum(y_pred - y_train)
w -= α * dw
b -= α * db</code></pre>

    <h3>2. Neural network — Keras/TensorFlow (<code>NeuralNetwork.py</code>)</h3>

    <p>A <strong>3-hidden-layer</strong> dense network trained with the Adam optimiser:</p>

    <div class="tbl">
    <table>
      <thead><tr><th>Layer</th><th class="num">Units</th><th>Activation</th></tr></thead>
      <tbody>
        <tr><td>Input</td><td class="num">13</td><td>—</td></tr>
        <tr><td>Hidden 1</td><td class="num">22</td><td>ReLU</td></tr>
        <tr><td>Hidden 2</td><td class="num">22</td><td>ReLU</td></tr>
        <tr><td>Hidden 3</td><td class="num">22</td><td>ReLU</td></tr>
        <tr><td>Output</td><td class="num">1</td><td>Linear</td></tr>
      </tbody>
    </table>
    </div>

    <ul>
      <li><strong>Total parameters:</strong> 1,343</li>
      <li><strong>Optimiser:</strong> Adam</li>
      <li><strong>Loss:</strong> MSE</li>
      <li><strong>Batch size:</strong> 32, <strong>epochs:</strong> 50 (with early stopping, patience 20)</li>
    </ul>

    <h3>3. Evolutionary algorithm (work in progress)</h3>

    <p>Scaffolded in <code>EvolutionaryAlgorithm.py</code> — evolves neural network weights using:</p>
    <ul>
      <li><strong>Tournament selection</strong> (k=3)</li>
      <li><strong>Gaussian mutation</strong> (per-gene with configurable rate and sigma)</li>
      <li><strong>Uniform crossover</strong> (per-gene swap with configurable rate)</li>
    </ul>

    <blockquote>
      <p>⚠️ <strong>Status:</strong> skeleton implemented — <code>fitness()</code>, <code>ea_training_loop()</code> and <code>mutation()</code> are stubbed and awaiting completion.</p>
    </blockquote>

    <hr>

    <h2>Results Comparison</h2>

    <h3>Metrics</h3>

    <div class="tbl">
    <table>
      <thead><tr><th>Metric</th><th class="num">Gradient descent (linear)</th><th class="num">Neural network (Keras)</th><th class="num">Evolutionary algorithm</th></tr></thead>
      <tbody>
        <tr><th>MSE</th><td class="num">32.406</td><td class="num">12.957</td><td class="num">101.712</td></tr>
        <tr><th>RMSE</th><td class="num">5.692</td><td class="num">3.599</td><td class="num">10.085</td></tr>
        <tr><th>MAE</th><td class="num">3.378</td><td class="num">2.399</td><td class="num">7.748</td></tr>
        <tr><th>R²</th><td class="num">0.558</td><td class="num">0.823</td><td class="num">−0.387</td></tr>
      </tbody>
    </table>
    </div>

    <h3>Training loss curves</h3>

    <div class="figs">
      <figure class="fig"><img loading="lazy" src="../img/gd_loss.png" alt="Gradient descent loss curve"><figcaption>Gradient descent MSE convergence over ~1200 epochs</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/nn_loss.png" alt="Neural network loss curve"><figcaption>NN train/validation loss over ~50 epochs (with early stopping)</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/ea_loss.png" alt="Evolutionary algorithm fitness curve"><figcaption>EA fitness convergence over 50 generations</figcaption></figure>
    </div>

    <h3>Test set predictions — actual vs predicted</h3>

    <div class="figs">
      <figure class="fig"><img loading="lazy" src="../img/test_scatter.png" alt="Gradient descent predictions scatter"><figcaption>Gradient descent predictions</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/nn_test_scatter.png" alt="Neural network predictions scatter"><figcaption>Neural network predictions</figcaption></figure>
      <figure class="fig"><img loading="lazy" src="../img/ea_test_scatter.png" alt="Evolutionary algorithm predictions scatter"><figcaption>Evolutionary algorithm predictions</figcaption></figure>
    </div>

    <p>Points closer to the red dashed line (y = x) indicate better predictions. The neural network shows tighter clustering around the ideal line, especially in the mid-range values.</p>

    <hr>

    <h2>Project Structure</h2>

<pre><code>Zamin/
├── rawRun.py                 # Gradient descent linear regression (from scratch)
├── NeuralNetwork.py          # Neural network with Keras/TensorFlow
├── EvolutionaryAlgorithm.py  # Evolutionary algorithm for NN weight optimisation
├── dataPreProcess.py         # Dataset visualisation &amp; correlation analysis
├── housing.csv               # Boston Housing dataset (506 × 14)
├── stickyNote.txt            # Project notes &amp; core concepts
└── output/
    ├── dataanalysis/         # Histograms, heatmaps, correlation plots
    ├── linearreg/            # GD loss curves &amp; scatter plots
    ├── nn/                   # NN loss curves, scatter plots &amp; saved models
    └── ea/                   # EA convergence &amp; prediction plots</code></pre>

    <hr>

    <h2>Key Takeaways</h2>

    <p>The evolutionary algorithm failed spectacularly, I was rather surprised. I was expecting it to fall a bit short, but not underperform to this extent. Linear regression and the NN were a delight however — solid scores with very simple setups. I found the NN topology taken from the study to be straightforward to implement and logical.</p>

    <h2>Future Work</h2>

    <p>Lots of things could be improved: first and foremost add ridge regression to the linear algorithm, and for the NN add pruning. These are nice, but most of all I will be looking to implement these on a more sophisticated and real-world dataset. This project was great for the rapid feedback loop and small scale. Ramping up to something more fully fledged is the next step. Definitely more to come.</p>
