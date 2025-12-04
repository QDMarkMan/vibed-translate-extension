// Background service worker

// Initialize context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate \"%s\"",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-selection") {
    // Send message to content script to show loading/result
    chrome.tabs.sendMessage(tab.id, {
      action: "showTranslationPopup",
      text: info.selectionText,
      position: "context-menu" // Content script will need to handle positioning
    });

    translateText(info.selectionText).then(results => {
      chrome.tabs.sendMessage(tab.id, {
        action: "updateTranslationPopup",
        text: info.selectionText,
        results: results // Now sending an array of results
      });
    }).catch(err => {
      chrome.tabs.sendMessage(tab.id, {
        action: "updateTranslationPopup",
        error: err.message
      });
    });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translateText") {
    translateText(request.text).then(results => {
      sendResponse({ success: true, data: results });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === "analyzeVocab") {
    analyzeVocab(request.text).then(result => {
      sendResponse({ success: true, data: result });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      models: [], // Array of { provider, apiUrl, apiKey, modelName }
      targetLang: 'Chinese',
      inlineMode: false,
      translationPrompt: '',
      vocabPrompt: '',
      // Legacy fallbacks
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      modelName: 'gpt-3.5-turbo'
    }, (items) => {
      // Normalize settings: if models is empty but legacy exists, use legacy
      if (items.models.length === 0 && items.apiKey) {
        items.models = [{
          provider: 'openai',
          apiUrl: items.apiUrl,
          apiKey: items.apiKey,
          modelName: items.modelName
        }];
      }
      resolve(items);
    });
  });
}

async function callLLM(modelConfig, messages) {
  if (!modelConfig.apiKey) {
    throw new Error(`API Key missing for model ${modelConfig.modelName}`);
  }

  try {
    const response = await fetch(modelConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.modelName,
        messages: messages,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API Error (${modelConfig.modelName}): ${response.status} ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error(`LLM Call Failed (${modelConfig.modelName}):`, error);
    throw error;
  }
}

async function translateText(text) {
  const settings = await getSettings();
  const translationPrompt = settings.translationPrompt?.trim() ||
    `You are a professional translator. Translate the following text into ${settings.targetLang}. Only provide the translation, no explanations.`;

  if (settings.models.length === 0) {
    throw new Error("No models configured. Please check extension settings.");
  }

  const messages = [
    {
      role: "system",
      content: translationPrompt
    },
    {
      role: "user",
      content: text
    }
  ];

  // Parallel execution for all configured models
  const promises = settings.models.map(async (model) => {
    try {
      const result = await callLLM(model, messages);
      return { modelName: model.modelName, result: result };
    } catch (e) {
      return { modelName: model.modelName, error: e.message };
    }
  });

  return await Promise.all(promises);
}

async function analyzeVocab(text) {
  const settings = await getSettings();

  if (settings.models.length === 0) {
    throw new Error("No models configured.");
  }

  // Use the first model for vocab analysis to avoid redundancy
  const primaryModel = settings.models[0];

  // Prompt for vocabulary extraction
  const prompt = (settings.vocabPrompt?.trim() || `
Identify advanced or difficult vocabulary (CEFR B2/C1/C2 level) in the following text. 
For each word, provide the translation in ${settings.targetLang} and a brief definition.
Return the result as a valid JSON array of objects with keys: "word", "translation", "definition".
If no advanced words are found, return an empty array [].
Do not include markdown formatting like \`\`\`json. Just the raw JSON string.

Text:
"${text}"
`).replace('{{text}}', text);

  const messages = [
    { role: "system", content: "You are a language learning assistant. Output valid JSON only." },
    { role: "user", content: prompt }
  ];

  const result = await callLLM(primaryModel, messages);
  try {
    // Clean up potential markdown code blocks if the model adds them
    const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanResult);
  } catch (e) {
    console.error("Failed to parse JSON from LLM:", result);
    return [];
  }
}
