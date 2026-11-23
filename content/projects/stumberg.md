---
title: Stumberg
group: ml
order: 6
status: discontinued
date: 2025-12-03
summary: Agentic AI assistant with tool use and RAG
summary_pl: Agentowy asystent AI z użyciem narzędzi i RAG
description: Stumberg — a personal AI agent built on LangGraph with four modes, persistent PostgreSQL-backed conversations, file context and a dedicated search subagent.
format: html
---

    <p>Stumberg is my crown jewel. It is my largest personal project so far, and the first in this series. The original idea was to replicate the functionality of ChatGPT but tailored to my needs. I hated repeating myself all the time and trying to curb its agreeable responses, so I set out on this journey.</p>

    <p>The final product was a working agent with multiple modes, persistent conversations, file context, and a search subagent, all tailored to me. Although I will admit that I have discontinued use and maintenance of the project, as the scope just grew larger and larger — upkeep of APIs, bugfixing and so on all take lots of time, time which I wanted to spend learning other new things.</p>

    <p>Also the usage was not that practical: booting up a Docker container and running on localhost is not ideal. If I were to revisit this project I would definitely prioritise having CI/CD and a proper deployment pipeline.</p>

    <p>The idea of Stumberg was somewhat revived in my project <a href="goswin.html">Goswin</a>.</p>

    <h2>Features</h2>

    <div class="tbl">
    <table>
      <thead><tr><th>Feature</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><strong>Multi-Mode Operation</strong></td><td>Four distinct modes with tailored system prompts, model selection, and tool access</td></tr>
        <tr><td><strong>Persistent Conversations</strong></td><td>PostgreSQL-backed state with thread-based history and automatic checkpointing</td></tr>
        <tr><td><strong>File Context</strong></td><td>Per-conversation uploads (txt, md, py, json, pdf) injected into system prompts</td></tr>
        <tr><td><strong>Search Subagent</strong></td><td>Dedicated subagent with web, Reddit, subreddit, and r/BuyItForLife search</td></tr>
        <tr><td><strong>Vector Search (RAG)</strong></td><td>Pinecone-powered semantic retrieval for knowledge base querying</td></tr>
        <tr><td><strong>Weather</strong></td><td>Real-time, location-based weather via Open-Meteo</td></tr>
      </tbody>
    </table>
    </div>

    <h2>Modes</h2>

    <div class="tbl">
    <table>
      <thead><tr><th>Mode</th><th>Model</th><th>Purpose</th></tr></thead>
      <tbody>
        <tr><td><strong>Personal</strong></td><td>GPT-4o</td><td>Shopping &amp; lifestyle — Reddit + r/BuyItForLife integration</td></tr>
        <tr><td><strong>Work</strong></td><td>GPT-4o</td><td>Factual research &amp; study — no assumptions</td></tr>
        <tr><td><strong>Code</strong></td><td>GPT-4o</td><td>Code creation, debugging &amp; optimisation — full output, no fluff</td></tr>
        <tr><td><strong>Fast</strong></td><td>GPT-4.1-nano</td><td>Ultra-fast, minimal responses</td></tr>
      </tbody>
    </table>
    </div>

    <h2>Architecture</h2>

    <p>A LangGraph state machine with the following flow:</p>

<pre><code>Streamlit UI
    │
    ▼
Agent Graph ──────────────► PostgreSQL (checkpointer)
    │
    ▼
Tool routing
    ├── Weather tool
    ├── Vector search
    └── Search subagent
            ├── Web search
            ├── Reddit search
            ├── Subreddit search
            └── BuyForLife search</code></pre>

    <h3>Tools</h3>

    <div class="tbl">
    <table>
      <thead><tr><th>Tool</th><th>Source</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><code>get_weather</code></td><td>Open-Meteo API</td><td>Real-time weather data</td></tr>
        <tr><td><code>retrieve_context</code></td><td>Pinecone</td><td>Vector search for RAG</td></tr>
        <tr><td><code>ask_search_agent</code></td><td>Search subagent</td><td>Delegates to the specialised search tools below</td></tr>
        <tr><td>↳ <code>general_search</code></td><td>LinkupClient</td><td>Web search</td></tr>
        <tr><td>↳ <code>reddit_search</code></td><td>PRAW</td><td>Reddit-wide search</td></tr>
        <tr><td>↳ <code>subreddit_search</code></td><td>PRAW</td><td>Targeted subreddit search</td></tr>
        <tr><td>↳ <code>buyforlife_search</code></td><td>PRAW</td><td>r/BuyItForLife scraping</td></tr>
      </tbody>
    </table>
    </div>

    <h2>Tech Stack</h2>

    <div class="tbl">
    <table>
      <thead><tr><th>Layer</th><th>Technology</th></tr></thead>
      <tbody>
        <tr><td><strong>Orchestration</strong></td><td>LangGraph</td></tr>
        <tr><td><strong>LLM Framework</strong></td><td>LangChain</td></tr>
        <tr><td><strong>UI</strong></td><td>Streamlit</td></tr>
        <tr><td><strong>Database</strong></td><td>PostgreSQL (<code>langgraph.checkpoint.postgres</code>)</td></tr>
        <tr><td><strong>Models</strong></td><td>GPT-4o, GPT-4.1-nano (OpenAI)</td></tr>
        <tr><td><strong>Vector DB</strong></td><td>Pinecone</td></tr>
        <tr><td><strong>Web Search</strong></td><td>LinkupClient</td></tr>
        <tr><td><strong>Reddit</strong></td><td>PRAW</td></tr>
        <tr><td><strong>Weather</strong></td><td>Open-Meteo API</td></tr>
        <tr><td><strong>Tracing</strong></td><td>LangSmith <em>(optional)</em></td></tr>
      </tbody>
    </table>
    </div>

    <h2>Project Structure</h2>

<pre><code>Stumberg/
├── app.py                  # Streamlit interface
├── main.py                 # CLI entry point
├── graph.py                # LangGraph agent graph
├── models.py               # Model configurations
├── prompts.py              # Mode-specific system prompts
├── schema.py               # AgentState definition
├── tools/
│   ├── search.py           # Search tool implementations
│   ├── weather.py          # Weather tool
│   └── vector_search.py    # Pinecone integration
├── subagents/
│   └── search_subagent.py  # Search delegation subgraph
├── middleware/
│   └── call_wrapping.py    # Call wrapping utilities
├── RAG_building_scripts/   # Vector store build utilities
├── Dockerfile
├── requirements.txt
├── langgraph.json          # LangGraph deployment config
└── ROADMAP.md</code></pre>

    <hr>

    <h2>Getting Started</h2>

    <h3>Prerequisites</h3>
    <ul>
      <li>Python 3.10+</li>
      <li>PostgreSQL</li>
      <li>OpenAI API key</li>
    </ul>

    <h3>Install</h3>
<pre><code>pip install -r requirements.txt</code></pre>

    <h3>Configure</h3>
    <p>Create a <code>.env</code> file:</p>
<pre><code># Required
OPENAI_API_KEY=your_key
DB_URI=postgresql://user:password@host:port/database

# Optional
PINECONE_API_KEY=your_key
LINKUP_API_KEY=your_key
LANGCHAIN_API_KEY=your_key
LANGCHAIN_PROJECT=your_project
CONVERSATION_DATA_PATH=/path/to/conversation/data</code></pre>

    <h3>Run</h3>
<pre><code># Streamlit UI
streamlit run app.py

# CLI
python main.py</code></pre>

    <h3>Docker</h3>
<pre><code>docker build -t stumberg-agent .
docker run -p 8501:8501 \
  -v /path/to/data:/host_e/conversation_data \
  --env-file .env \
  stumberg-agent</code></pre>

    <hr>

    <h2>License</h2>
    <p>Personal use and experimentation.</p>
