# ⚡ PromptForge

**Turn vague ideas into precise, structured AI prompts.**

PromptForge is an AI-powered prompt engineering agent that takes your raw project requirements, asks smart clarifying questions, and generates a structured sequence of copy-paste-ready prompts you can feed into any AI assistant.

## ✨ Features

- 🎙️ **Voice Input** — Speak your requirements using browser speech recognition
- 🧠 **Smart Clarification** — AI asks targeted questions to understand your project deeply
- 📋 **Structured Prompts** — Get ordered, step-by-step prompts ready to paste into any AI
- 📑 **Copy All** — One-click to copy the entire prompt sequence
- 🔐 **Secure API Key** — Your key is stored locally and proxied server-side (never exposed in client code)
- 🌙 **Dark Mode** — Beautiful, premium dark interface

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

### Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) and add your API key via the ⚙ settings icon.

### Deploy to Vercel

1. Push to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Optionally set `ANTHROPIC_API_KEY` as an environment variable in Vercel project settings (so users don't need to enter their own key)
4. Deploy — done!

## 🏗️ Tech Stack

- **React 18** + **Vite** — Fast, modern frontend
- **Vercel Serverless Functions** — Secure API proxy
- **Claude API** — Anthropic's Claude for prompt generation
- **Web Speech API** — Browser-native voice input

## 📁 Project Structure

```
PromptForge/
├── api/
│   └── claude.js          # Vercel serverless proxy
├── src/
│   ├── index.jsx          # Main app component
│   └── main.jsx           # React entry point
├── index.html             # HTML shell
├── vite.config.js         # Vite configuration
├── vercel.json            # Vercel routing config
└── package.json
```

## 📄 License

MIT
