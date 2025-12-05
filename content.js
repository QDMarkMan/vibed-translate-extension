// Content script for LLM Translator

let lastSelectionRange = null;
let floatingIcon = null;
let translationPopup = null;
let copyStatusTimer = null;
let inlineModeEnabled = false;
let inlineTranslationEl = null; // Tracks most recent inline node (loading or result)
const POPUP_VARIANT = 'llm-modern-v2';
let shouldInsertInline = true;

// Load inline mode preference once
chrome.storage.sync.get({ inlineMode: false }, (items) => {
  inlineModeEnabled = !!items.inlineMode;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.inlineMode) {
    inlineModeEnabled = !!changes.inlineMode.newValue;
  }
});

function flashCopyState(btn, message = 'Copied') {
  if (!btn) return;
  const originalTitle = btn.getAttribute('data-title') || btn.getAttribute('title') || '';
  btn.classList.add('llm-is-copied');
  btn.setAttribute('title', message);
  if (copyStatusTimer) clearTimeout(copyStatusTimer);
  copyStatusTimer = setTimeout(() => {
    btn.classList.remove('llm-is-copied');
    if (originalTitle) btn.setAttribute('title', originalTitle);
  }, 1200);
}

function copyTextToClipboard(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    flashCopyState(btn);
  }).catch((err) => {
    console.error('Copy failed:', err);
  });
}

function collectTranslationText() {
  if (!translationPopup) return '';
  const cards = Array.from(translationPopup.querySelectorAll('.llm-result-card'));
  if (cards.length) {
    const lines = cards.map(card => {
      const textEl = card.querySelector('.llm-result-text');
      return textEl ? textEl.textContent.trim() : '';
    }).filter(Boolean);
    return lines.join('\n\n');
  }
  const bodyText = translationPopup.querySelector('.llm-translator-body');
  return bodyText ? bodyText.textContent.trim() : '';
}

function getFirstSuccessfulResult(results) {
  if (Array.isArray(results)) {
    const found = results.find(r => r && !r.error && r.result);
    return found ? found.result : '';
  }
  return typeof results === 'string' ? results : '';
}

function removeInlineTranslation(node) {
  const target = node || inlineTranslationEl;
  if (target && target.parentNode) {
    target.parentNode.removeChild(target);
  }
  if (!node) inlineTranslationEl = null;
}

function createInlineAnchor() {
  if (!lastSelectionRange) captureSelectionIfNeeded();
  if (!lastSelectionRange) return null;
  try {
    const range = lastSelectionRange.cloneRange();
    range.collapse(false);
    const anchor = document.createElement('span');
    anchor.className = 'llm-inline-anchor';
    anchor.style.display = 'inline-block';
    anchor.style.width = '0';
    anchor.style.height = '0';
    anchor.style.lineHeight = '0';
    range.insertNode(anchor);
    return anchor;
  } catch (e) {
    console.error('Inline anchor insertion failed', e);
    return null;
  }
}

function nearestBlockFromNode(node) {
  let cur = node;
  while (cur && cur !== document.body) {
    const tag = (cur.tagName || '').toUpperCase();
    const display = window.getComputedStyle(cur).display;
    if (
      ['P', 'DIV', 'LI', 'ARTICLE', 'SECTION', 'HEADER', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(tag) ||
      display === 'block' || display === 'flex' || display === 'grid'
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return document.body;
}

function placeInlineNode(node) {
  if (!lastSelectionRange) return false;
  const endNode = lastSelectionRange.endContainer.nodeType === 1
    ? lastSelectionRange.endContainer
    : lastSelectionRange.endContainer.parentElement;
  const targetBlock = endNode ? nearestBlockFromNode(endNode) : document.body;
  if (targetBlock && targetBlock.parentNode) {
    targetBlock.parentNode.insertBefore(node, targetBlock.nextSibling);
    return true;
  }
  return false;
}

function showInlineLoading() {
  const anchor = createInlineAnchor();
  const wrapper = document.createElement('div');
  wrapper.className = 'llm-inline-translation';

  const textNode = document.createElement('div');
  textNode.className = 'llm-inline-text llm-inline-loading';
  textNode.textContent = 'Translating...';

  wrapper.appendChild(textNode);

  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
    anchor.remove();
  } else {
    // Fallback: place after nearest block
    if (!placeInlineNode(wrapper)) {
      document.body.appendChild(wrapper);
    }
  }
  inlineTranslationEl = wrapper;
}

function insertInlineTranslation(text, force = false) {
  if ((!inlineModeEnabled && !force) || !text) return;
  const anchor = createInlineAnchor();
  const existingLoading = inlineTranslationEl && inlineTranslationEl.querySelector('.llm-inline-loading')
    ? inlineTranslationEl
    : null;

  const translationNode = document.createElement('div');
  translationNode.className = 'llm-inline-translation';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'llm-inline-close';
  closeBtn.setAttribute('aria-label', 'Close inline translation');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeInlineTranslation(translationNode);
  });

  const textNode = document.createElement('div');
  textNode.className = 'llm-inline-text';
  textNode.textContent = text;

  // Copy limited text styles for consistency but clamp sizing
  const styleSource = (anchor && anchor.parentElement)
    || (lastSelectionRange
      ? nearestBlockFromNode(
        lastSelectionRange.endContainer.nodeType === 1
          ? lastSelectionRange.endContainer
          : lastSelectionRange.endContainer.parentElement
      )
      : document.body);
  const styles = window.getComputedStyle(styleSource || document.body);
  const baseSize = parseFloat(styles.fontSize) || 15;
  const clampedSize = Math.min(Math.max(baseSize, 13), 18);
  textNode.style.fontFamily = styles.fontFamily;
  textNode.style.color = styles.color || '#0f172a';
  textNode.style.fontSize = `${clampedSize}px`;
  textNode.style.lineHeight = '1.6';
  textNode.style.whiteSpace = 'pre-wrap';

  translationNode.appendChild(closeBtn);
  translationNode.appendChild(textNode);

  inlineTranslationEl = translationNode;

  if (existingLoading && existingLoading.parentNode) {
    existingLoading.parentNode.replaceChild(translationNode, existingLoading);
    if (anchor && anchor.parentNode) anchor.remove();
    return;
  }

  if (anchor && anchor.parentNode) {
    anchor.parentNode.insertBefore(translationNode, anchor.nextSibling);
    anchor.remove();
  } else if (!placeInlineNode(translationNode)) {
    document.body.appendChild(translationNode);
  }
}

function triggerInlineTranslation() {
  captureSelectionIfNeeded();
  const text = getActiveSelectionText();
  if (!text) return;

  shouldInsertInline = true;
  showInlineLoading();
  chrome.runtime.sendMessage({ action: "translateText", text }, (response) => {
    if (response && response.success) {
      const resultText = getFirstSuccessfulResult(response.data);
      insertInlineTranslation(resultText, true); // force inline even if setting off
    } else if (response && response.error) {
      console.error('Inline translation failed:', response.error);
    }
  });
}

// Inline SVGs to avoid broken images
function globeSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-languages-icon lucide-languages"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
  `;
}

function inlineSvg() {
  // return `
  // <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-waves-ladder-icon lucide-waves-ladder"><path d="M19 5a2 2 0 0 0-2 2v11"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M7 13h10"/><path d="M7 9h10"/><path d="M9 5a2 2 0 0 0-2 2v11"/></svg>
  // `;
  return `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 18C2.6 18.5 3.2 19 4.5 19C7 19 7 17 9.5 17C12.1 17 11.9 19 14.5 19C17 19 17 17 19.5 17C20.8 17 21.4 17.5 22 18" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <g clip-path="url(#clip0_556_5)">
    <path d="M7.125 6L10.875 9.75" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.5 9.75L10.25 6L11.5 4.125" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.25 4.125H12.75" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8.375 2.25H9" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17.75 14.75L14.625 8.5L11.5 14.75" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12.75 12.25H16.5" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <defs>
    <clipPath id="clip0_556_5">
    <rect width="15" height="15" fill="white" transform="translate(4 1)"/>
    </clipPath>
    </defs>
  </svg>
  `
}

// Create the floating icon element
function createFloatingIcon() {
  const wrapper = document.createElement('div');
  wrapper.className = 'llm-translator-icon-group';
  wrapper.style.display = 'none';

  const popupIcon = document.createElement('div');
  popupIcon.className = 'llm-translator-icon';
  popupIcon.setAttribute('aria-label', 'Translate selection');
  popupIcon.innerHTML = globeSvg();

  const inlineIcon = document.createElement('div');
  inlineIcon.className = 'llm-translator-icon';
  inlineIcon.setAttribute('aria-label', 'Inline translate');
  // inlineIcon.innerHTML = `
  //   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5a2 2 0 0 0-2 2v11"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M7 13h10"/><path d="M7 9h10"/><path d="M9 5a2 2 0 0 0-2 2v11"/></svg>
  // `;
  inlineIcon.innerHTML = inlineSvg();

  wrapper.appendChild(popupIcon);
  wrapper.appendChild(inlineIcon);
  document.body.appendChild(wrapper);

  popupIcon.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent losing selection
    e.stopPropagation();
    const text = getSelectedText();
    captureSelectionIfNeeded();
    if (text) {
      showTranslationPopup(text, popupIcon.getBoundingClientRect(), { allowInline: false });
      hideFloatingIcon();
    }
  });

  inlineIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerInlineTranslation();
    hideFloatingIcon();
  });

  // Prevent mouseup from clearing selection
  [popupIcon, inlineIcon].forEach(icon => {
    icon.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    icon.addEventListener('mouseup', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  return wrapper;
}

// Create the translation popup element
function createTranslationPopup() {
  const popup = document.createElement('div');
  popup.className = 'llm-translator-popup';
  popup.dataset.variant = POPUP_VARIANT;
  popup.style.display = 'none';
  popup.innerHTML = `
        <div class="llm-translator-header">
            <div class="llm-title-group">
              <div class="llm-header-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
              </div>
              <div class="llm-header-text">
                <span class="llm-header-title">Translation</span>
                <span class="llm-header-subtitle">Drag to move</span>
              </div>
            </div>
            <div class="llm-header-actions">
              <button class="llm-btn-icon llm-copy-all" type="button" title="Copy all">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button class="llm-btn-icon llm-translator-close" type="button" title="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
        </div>
        <div class="llm-translator-body">
            <div class="llm-loading">
              <div class="llm-spinner"></div>
              <span>Translating...</span>
            </div>
        </div>
    `;
  document.body.appendChild(popup);

  const closeBtn = popup.querySelector('.llm-translator-close');
  closeBtn.addEventListener('click', () => {
    hideTranslationPopup();
  });

  const copyBtn = popup.querySelector('.llm-copy-all');
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const text = collectTranslationText();
    copyTextToClipboard(text, copyBtn);
  });

  // Make Draggable
  const header = popup.querySelector('.llm-translator-header');
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  popup._resetDrag = function () {
    xOffset = 0;
    yOffset = 0;
    setTranslate(0, 0, popup);
  };

  header.addEventListener("mousedown", dragStart);
  document.addEventListener("mouseup", dragEnd);
  document.addEventListener("mousemove", drag);

  function dragStart(e) {
    if (e.target.closest('.llm-header-actions')) return;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (header.contains(e.target)) {
      isDragging = true;
    }
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      xOffset = currentX;
      yOffset = currentY;

      setTranslate(currentX, currentY, popup);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }

  return popup;
}

function getSelectedText() {
  return window.getSelection().toString().trim();
}

function getActiveSelectionText() {
  const selText = getSelectedText();
  if (selText) return selText;
  if (lastSelectionRange) return lastSelectionRange.toString().trim();
  return '';
}

function captureSelectionIfNeeded() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0 && selection.toString().trim()) {
    lastSelectionRange = selection.getRangeAt(0).cloneRange();
  }
}

function showFloatingIcon(rect) {
  if (!floatingIcon) floatingIcon = createFloatingIcon();
  captureSelectionIfNeeded();

  floatingIcon.style.display = 'flex';
  floatingIcon.style.top = `${rect.bottom + window.scrollY + 10}px`;
  floatingIcon.style.left = `${rect.right + window.scrollX + 10}px`;
}

function hideFloatingIcon() {
  if (floatingIcon) floatingIcon.style.display = 'none';
}

function showTranslationPopup(text, rect, options = {}) {
  const allowInline = options.allowInline !== false;
  shouldInsertInline = allowInline;
  const existing = document.querySelector('.llm-translator-popup');
  if (existing && existing !== translationPopup) {
    existing.remove();
  }
  if (!translationPopup || !translationPopup.isConnected || translationPopup.dataset.variant !== POPUP_VARIANT) {
    translationPopup = createTranslationPopup();
  }

  if (!lastSelectionRange) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
      lastSelectionRange = sel.getRangeAt(0).cloneRange();
    }
  }

  const body = translationPopup.querySelector('.llm-translator-body');
  body.innerHTML = `
    <div class="llm-loading">
      <div class="llm-spinner"></div>
      <span>Thinking...</span>
    </div>
  `;

  translationPopup.style.display = 'flex';

  // Reset transform for new position calculation
  translationPopup.style.transform = 'none';
  // Reset drag offsets
  translationPopup._resetDrag && translationPopup._resetDrag();

  // Smart Positioning
  const popupWidth = 350;
  const popupHeight = 300; // Estimate
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = rect.bottom + window.scrollY + 15;
  let left = rect.left + window.scrollX;

  // Check right edge
  if (left + popupWidth > window.scrollX + viewportWidth) {
    left = (window.scrollX + viewportWidth) - popupWidth - 20;
  }
  // Check left edge
  if (left < window.scrollX) {
    left = window.scrollX + 20;
  }

  translationPopup.style.top = `${top}px`;
  translationPopup.style.left = `${left}px`;

  chrome.storage.sync.get({ inlineMode: inlineModeEnabled }, (cfg) => {
    inlineModeEnabled = !!cfg.inlineMode;

    // Request translation
    chrome.runtime.sendMessage({ action: "translateText", text: text }, (response) => {
      if (response && response.success) {
        renderResults(response.data, body);
        const resultText = getFirstSuccessfulResult(response.data);
        if (allowInline && inlineModeEnabled) {
          insertInlineTranslation(resultText);
        }
      } else {
        body.innerHTML = `<div style="color:red; padding:10px;">Error: ${response ? response.error : 'Unknown error'}</div>`;
      }
    });
  });
}

function renderResults(results, container) {
  container.innerHTML = '';

  if (Array.isArray(results)) {
    results.forEach(item => {
      const card = document.createElement('div');
      card.className = 'llm-result-card';

      const title = document.createElement('span');
      title.className = 'llm-model-badge';
      title.textContent = item.modelName;

      const content = document.createElement('div');
      content.className = 'llm-result-content';
      if (item.error) {
        content.style.color = 'var(--error-color)';
        content.textContent = `Error: ${item.error}`;
      } else {
        content.textContent = item.result;
      }

      const footer = document.createElement('div');
      footer.className = 'llm-card-footer';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'llm-btn-icon llm-copy-card';
      copyBtn.setAttribute('title', 'Copy this result');
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      `;

      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!item.error) {
          copyTextToClipboard(item.result, copyBtn);
        }
      });
      footer.appendChild(copyBtn);

      card.appendChild(title);
      card.appendChild(content);
      if (!item.error) {
        card.appendChild(footer);
      }
      container.appendChild(card);
    });
  } else {
    // Fallback for single result (legacy or error)
    container.textContent = results;
  }
}

function hideTranslationPopup() {
  if (translationPopup) translationPopup.style.display = 'none';
}

// Event Listeners
document.addEventListener('mouseup', (e) => {
  // If clicking inside popup or icon, ignore
  if (e.target.closest('.llm-translator-popup') || e.target.closest('.llm-translator-icon-group') || e.target.closest('.llm-translator-icon') || e.target.closest('.llm-inline-translation')) {
    return;
  }

  setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      const range = selection.getRangeAt(0).cloneRange();
      lastSelectionRange = range;
      const rect = range.getBoundingClientRect();

      // Ensure icon exists and is in DOM
      if (!floatingIcon || !floatingIcon.isConnected) {
        if (floatingIcon) floatingIcon.remove(); // Remove old if detached
        floatingIcon = createFloatingIcon();
      }

      showFloatingIcon(rect);
    } else {
      hideFloatingIcon();
      // Keep inline translation visible until user closes it
    }
  }, 10);
}, true); // Use capture to ensure we get the event

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideTranslationPopup();
    if (inlineTranslationEl) {
      removeInlineTranslation(inlineTranslationEl);
    }
  }
});

// Handle messages from background and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showTranslationPopup") {
    // Context menu triggered
    let rect = { bottom: window.innerHeight / 2, right: window.innerWidth / 2, left: window.innerWidth / 2 }; // Default center

    if (lastSelectionRange) {
      // Try to use last known selection if it matches the text (simple heuristic)
      if (lastSelectionRange.toString().trim() === request.text) {
        rect = lastSelectionRange.getBoundingClientRect();
      }
    }

    showTranslationPopup(request.text, rect);
  }

  if (request.action === "updateTranslationPopup") {
    if (translationPopup) {
      const body = translationPopup.querySelector('.llm-translator-body');
      if (request.error) {
        body.innerHTML = `<div style="color:red">Error: ${request.error}</div>`;
      } else {
        renderResults(request.results, body);
        const resultText = getFirstSuccessfulResult(request.results);
        if (shouldInsertInline && inlineModeEnabled) {
          insertInlineTranslation(resultText);
        }
      }
    }
  }

  if (request.action === "translatePage") {
    translatePageContent();
  }

  if (request.action === "highlightVocab") {
    highlightPageVocab();
  }
});

// Full Page Translation Logic
async function translatePageContent() {
  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (node.parentElement.tagName === 'SCRIPT' ||
        node.parentElement.tagName === 'STYLE' ||
        node.parentElement.tagName === 'NOSCRIPT' ||
        node.parentElement.isContentEditable ||
        node.parentElement.closest('.llm-translator-popup') ||
        node.parentElement.closest('.llm-translator-icon') ||
        node.parentElement.closest('.llm-inline-translation')) {
        return NodeFilter.FILTER_REJECT;
      }
      if (node.textContent.trim().length > 20) { // Only translate substantial text
        return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    }
  });

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  // Process in chunks to avoid overwhelming the LLM
  // For MVP, we'll just take the first 10 significant nodes to demonstrate
  const nodesToTranslate = textNodes.slice(0, 10);

  for (const node of nodesToTranslate) {
    const originalText = node.textContent.trim();
    try {
      // Visual indicator that it's translating
      node.parentElement.style.opacity = '0.5';

      const response = await chrome.runtime.sendMessage({
        action: "translateText",
        text: originalText
      });

      if (response && response.success) {
        // For full page, we just take the first successful result if multiple are returned
        const resultText = Array.isArray(response.data)
          ? response.data.find(r => !r.error)?.result || originalText
          : response.data;

        node.textContent = resultText;
        node.parentElement.style.opacity = '1';
        node.parentElement.dataset.originalText = originalText; // Store original
      } else {
        console.error("Translation failed for node:", originalText, response?.error);
        node.parentElement.style.opacity = '1';
      }
    } catch (e) {
      console.error(e);
      node.parentElement.style.opacity = '1';
    }
  }
}

// Vocabulary Highlighting Logic
async function highlightPageVocab() {
  // We'll target paragraphs (p tags) for vocab highlighting to keep context
  const paragraphs = Array.from(document.querySelectorAll('p'));

  // Filter for substantial content
  const targetParagraphs = paragraphs.filter(p => p.innerText.length > 50);

  // Process in chunks to avoid overwhelming the LLM and UI
  const CHUNK_SIZE = 3;

  for (let i = 0; i < targetParagraphs.length; i += CHUNK_SIZE) {
    const chunk = targetParagraphs.slice(i, i + CHUNK_SIZE);

    // Process chunk in parallel
    await Promise.all(chunk.map(async (p) => {
      const originalText = p.innerText;
      if (p.classList.contains('llm-vocab-processed')) return; // Avoid double processing

      try {
        p.classList.add('llm-vocab-loading');
        p.classList.add('llm-vocab-processed');
        p.style.borderLeft = "3px solid #E879F9"; // Indicator (Pink)

        const response = await chrome.runtime.sendMessage({
          action: "analyzeVocab",
          text: originalText
        });

        if (response && response.success && Array.isArray(response.data)) {
          let html = p.innerHTML;
          // Sort by length descending to avoid replacing substrings of other words
          const words = response.data.sort((a, b) => b.word.length - a.word.length);

          words.forEach(item => {
            const regex = new RegExp(`\\b${escapeRegExp(item.word)}\\b`, 'gi');
            html = html.replace(regex, (match) => {
              const safeTranslation = item.translation || '';
              const safeDefinition = item.definition || '';
              return `<span class="llm-vocab-highlight">${match}<span class="llm-inline-vocab"> (${safeTranslation})</span><span class="llm-vocab-tooltip"><span class="llm-tooltip-title">${safeTranslation}</span><span class="llm-tooltip-def">${safeDefinition}</span></span></span>`;
            });
          });

          p.innerHTML = html;
          p.style.borderLeft = "none";
        }
      } catch (e) {
        console.error("Vocab analysis failed:", e);
        p.style.borderLeft = "3px solid var(--error-color)";
      } finally {
        p.classList.remove('llm-vocab-loading');
        if (p.style.borderLeft === "3px solid #E879F9") {
          p.style.borderLeft = "none";
        }
      }
    }));

    // Small delay between chunks to be nice to the browser/API
    if (i + CHUNK_SIZE < targetParagraphs.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
