// Saves options to chrome.storage
const DEFAULT_TRANSLATION_PROMPT = (targetLang) =>
  `You are a professional translator. Translate the following text into ${targetLang}. Only provide the translation, no explanations.`;
const DEFAULT_VOCAB_PROMPT = (targetLang) =>
  `Identify advanced or difficult vocabulary (CEFR B2/C1/C2 level) in the following text. For each word, provide the translation in ${targetLang} and a brief definition. Return a valid JSON array of objects with keys: "word", "translation", "definition".`;

const saveOptions = () => {
  const targetLang = document.getElementById('targetLang').value;
  const inlineMode = document.getElementById('inlineMode').checked;
  const translationPrompt = document.getElementById('translationPrompt').value;
  const vocabPrompt = document.getElementById('vocabPrompt').value;

  const modelItems = document.querySelectorAll('.model-item');
  const models = [];

  modelItems.forEach(item => {
    const provider = item.querySelector('.model-provider').value;
    const apiUrl = item.querySelector('.model-url').value;
    const apiKey = item.querySelector('.model-key').value;
    const modelName = item.querySelector('.model-name').value;
    const enabled = item.querySelector('.model-enabled').checked;

    if (apiKey && modelName) { // Only save if key and name are present
      models.push({ provider, apiUrl, apiKey, modelName, enabled });
    }
  });

  chrome.storage.sync.set(
    { targetLang, models, inlineMode, translationPrompt, vocabPrompt },
    () => {
      const status = document.getElementById('status');
      status.textContent = 'Options saved.';
      status.className = 'status success';
      setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 2000);
    }
  );
};

const createModelElement = (modelData = {}) => {
  const template = document.getElementById('modelItemTemplate');
  const clone = template.content.cloneNode(true);
  const item = clone.querySelector('.model-item');

  const enabledCheckbox = item.querySelector('.model-enabled');
  const providerSelect = item.querySelector('.model-provider');
  const urlInput = item.querySelector('.model-url');
  const keyInput = item.querySelector('.model-key');
  const nameInput = item.querySelector('.model-name');
  const removeBtn = item.querySelector('.remove-btn');

  // Set values
  enabledCheckbox.checked = modelData.enabled !== false; // Default to enabled
  providerSelect.value = modelData.provider || 'openai';
  urlInput.value = modelData.apiUrl || 'https://api.openai.com/v1/chat/completions';
  keyInput.value = modelData.apiKey || '';
  nameInput.value = modelData.modelName || 'gpt-3.5-turbo';

  // Update visual state
  if (!enabledCheckbox.checked) {
    item.classList.add('disabled');
  }

  // Event listeners
  enabledCheckbox.addEventListener('change', () => {
    item.classList.toggle('disabled', !enabledCheckbox.checked);
  });

  removeBtn.addEventListener('click', () => {
    item.remove();
  });

  providerSelect.addEventListener('change', () => {
    if (providerSelect.value === 'openai') {
      urlInput.value = 'https://api.openai.com/v1/chat/completions';
    } else {
      urlInput.value = '';
    }
  });

  document.getElementById('modelList').appendChild(item);
};

const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      targetLang: 'Chinese',
      models: [],
      // Legacy support
      apiProvider: null,
      apiUrl: null,
      apiKey: null,
      modelName: null,
      inlineMode: false,
      translationPrompt: '',
      vocabPrompt: ''
    },
    (items) => {
      document.getElementById('targetLang').value = items.targetLang;
      document.getElementById('inlineMode').checked = items.inlineMode;
      document.getElementById('translationPrompt').value = items.translationPrompt || DEFAULT_TRANSLATION_PROMPT(items.targetLang);
      document.getElementById('vocabPrompt').value = items.vocabPrompt || DEFAULT_VOCAB_PROMPT(items.targetLang);

      // Migrate legacy settings if models array is empty but legacy fields exist
      if (items.models.length === 0 && items.apiKey) {
        createModelElement({
          provider: items.apiProvider,
          apiUrl: items.apiUrl,
          apiKey: items.apiKey,
          modelName: items.modelName
        });
      } else if (items.models.length > 0) {
        items.models.forEach(model => createModelElement(model));
      } else {
        // Add one empty default
        createModelElement();
      }
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);
document.getElementById('addModelBtn').addEventListener('click', () => createModelElement());
