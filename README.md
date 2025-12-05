# YourLingo

<img src="icons/icon128.png" width="100" align="right" alt="YourLingo Icon">

[中文文档](README_zh-CN.md)

YourLingo is a fast LLM-based translator that works across web pages and PDFs. Use your preferred OpenAI-compatible models to translate text, analyze vocabulary, and keep reading flow intact.

Translate web pages, PDF viewer text, and highlight vocabulary using the power of Large Language Models (LLMs). This Chrome extension lets you bring your own LLM provider (OpenAI, or any OpenAI-compatible API) to translate text, analyze vocabulary, and more, directly within your browser.

## Features

- **Context Menu Translation**: Select any text, right-click, and choose "Translate" to get an instant translation in a draggable popup.
- **Floating Action Icon**: Select text and click the floating icon for quick access to translation.
- **Floating Vocab Highlight**: Use the floating icon to instantly highlight advanced words in the current selection.
- **Inline Translation**: Optionally display translations directly inline with the text for a seamless reading experience.
- **Multi-Model Support**: Configure multiple LLM providers and models. Compare results or use different models for different tasks.
- **Vocabulary Highlighting**: (Experimental) Analyze and highlight advanced vocabulary (CEFR B2/C1/C2) on the page with definitions.
- **Customizable Prompts**: Fine-tune the system prompts used for translation and vocabulary extraction to suit your specific needs.
- **Modern UI**: A clean, "premium" aesthetic with dark mode support elements and smooth interactions.

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the directory containing this extension.

## Configuration

1. Click the extension icon in the Chrome toolbar and select **Options** (or right-click the icon and choose Options).
2. **General Settings**:
    - **Target Language**: Select your desired target language for translations.
    - **Custom Prompts**: (Optional) Override the default prompts for translation and vocabulary analysis.
    - **Inline Mode**: Enable/disable inline translations.
3. **Model Profiles**:
    - Add one or more LLM providers.
    - **Provider**: Choose "OpenAI" or "Custom" (for local LLMs like Ollama, LM Studio, or other compatible APIs).
    - **API Endpoint**: The full URL to the chat completions endpoint (e.g., `https://api.openai.com/v1/chat/completions`).
    - **API Key**: Your API key.
    - **Model Name**: The specific model to use (e.g., `gpt-4o`, `gpt-3.5-turbo`, `llama3`).
4. Click **Save Settings**.

## Usage

### Translating Text

1. Highlight any text on a webpage.
2. **Right-click** and select **Translate selection**.
3. OR, click the **floating icon** that appears near the selection.
4. A popup will appear with the translation. You can drag the popup to move it out of the way.

### Inline Translation

If enabled in settings:

1. Highlight text.
2. Click the **Inline Translate** icon (if available) or use the context menu.
3. The translation will be inserted directly into the text flow.

## Privacy

This extension communicates directly with the LLM API endpoints you configure. Your API keys are stored locally in your browser's sync storage. No data is sent to any third-party servers other than the LLM providers you explicitly configure.

## License

[MIT](LICENSE)
