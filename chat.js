(function () {
  'use strict';

  const WIDGET_ID = 'chatx-widget';
  const SCRIPT_TAG = document.currentScript;
  const SERVER_URL = SCRIPT_TAG?.getAttribute('data-server') || 'http://localhost:3001';
  const SERVER_ORIGIN = SERVER_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
  const POSITION = SCRIPT_TAG?.getAttribute('data-position') || 'right';
  const PRIMARY_COLOR = SCRIPT_TAG?.getAttribute('data-color') || '#43a047';
  const GREETING = SCRIPT_TAG?.getAttribute('data-greeting') || 'Hi! How can we help you today?';
  const DEPARTMENT = SCRIPT_TAG?.getAttribute('data-department') || null;
  const COMPANY_NAME = SCRIPT_TAG?.getAttribute('data-company') || 'Default Company';
  const SOUND_PATHS = (() => {
    const attr = SCRIPT_TAG?.getAttribute('data-sound-path');
    const normalize = (path) => (path.startsWith('/') ? path : `/${path}`);
    if (attr) return [normalize(attr)];
    return [
      '/sounds/notification-reply-001.mp3',
      '/sound/notification-reply-001.mp3',
    ];
  })();
  const CUSTOM_SOUND_URL = SCRIPT_TAG?.getAttribute('data-sound-url');
  const SOUND_SOURCES = (() => {
    const sources = [];
    if (CUSTOM_SOUND_URL) sources.push(CUSTOM_SOUND_URL);
    const backendUrl = SERVER_URL.replace(/\/$/, '');
    SOUND_PATHS.forEach(path => sources.push(`${backendUrl}${path}`));
    return sources.filter((src, index, arr) => src && arr.indexOf(src) === index);
  })();

  let socket = null;
  let visitorId = null;
  let chatId = null;
  let sessionId = getOrCreateSessionId();
  let isOpen = false;
  let isConnected = false;
  let messages = [];
  let agentTyping = false;
  let currentChatStatus = null;
  let notificationSound = null;
  let notificationSoundSourceIndex = 0;
  let pendingChatsCount = 0;
  let userQueuePosition = 1;
  let agentJoined = false;
  let agentJoinMonitor = null;
  let whmcsData = null;
  let showWhmcsLogin = false;
  let selectedDepartmentId = null;
  let selectedDepartmentName = null;
  const imageBlobCache = new Map();
  let imageIdCounter = 0;
  let chatStartTimeoutId = null;
  let isRestoringSession = false;
  let initialStateLoaded = false;
  let viewHistory = [];
  let offlineCheckTimeoutId = null;
  let lastOnlineState = true;
  let agentStatusPollInterval = null;
  let cachedAgentAvatars = null;
  let avatarsFetchedAt = 0;
  const AVATAR_CACHE_TTL = 30000;

  let widgetSettings = {
    organizationId: null,
    logoUrl: null,
    greetingTitle: 'Hi there \u{1F44B}',
    greetingSubtitle: 'Ask us anything, or share your valuable feedback with us.',
    startButtonText: 'Start Live Chat',
    chatCardTitle: 'Start a new chat',
    chatCardText: 'Our agents typically reply in a few seconds.',
    primaryColor: PRIMARY_COLOR,
    headerBgColor: PRIMARY_COLOR,
    headerTextColor: '#ffffff',
    agentBubbleBgColor: '#f3f4f6',
    agentBubbleTextColor: '#1f2937',
    visitorBubbleBgColor: PRIMARY_COLOR,
    visitorBubbleTextColor: '#ffffff',
    sendButtonBgColor: PRIMARY_COLOR,
    sendButtonTextColor: '#ffffff',
    launcherBgColor: PRIMARY_COLOR,
    launcherIconColor: '#ffffff',
    position: POSITION,
    popupTitle: 'Live Chat Online',
    popupText: 'Click here and start chatting with us!',
    helpJsonUrl: null,
    isEnabled: true,
  };

  let helpArticles = [];
  const CHEVRON_RIGHT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>';

  function resolveAssetUrl(assetUrl) {
    if (!assetUrl) return null;
    if (assetUrl.startsWith('http://') || assetUrl.startsWith('https://')) {
      return assetUrl;
    }
    return `${SERVER_ORIGIN}${assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`}`;
  }

  // Fetch widget settings from server using company name
  async function fetchWidgetSettings() {
    try {
      const response = await fetch(`${SERVER_URL}/api/settings/widget-public?company=${encodeURIComponent(COMPANY_NAME)}`);
      if (response.ok) {
        const data = await response.json();
        widgetSettings = {
          organizationId: data.organizationId || null,
          logoUrl: data.logoUrl || null,
          greetingTitle: data.greetingTitle || 'Hi there \u{1F44B}',
          greetingSubtitle: data.greetingSubtitle || 'Ask us anything, or share your valuable feedback with us.',
          startButtonText: data.startButtonText || 'Start Live Chat',
          chatCardTitle: data.chatCardTitle || 'Start a new chat',
          chatCardText: data.chatCardText || 'Our agents typically reply in a few seconds.',
          primaryColor: data.primaryColor || PRIMARY_COLOR,
          headerBgColor: data.headerBgColor || data.primaryColor || PRIMARY_COLOR,
          headerTextColor: data.headerTextColor || '#ffffff',
          agentBubbleBgColor: data.agentBubbleBgColor || '#f3f4f6',
          agentBubbleTextColor: data.agentBubbleTextColor || '#1f2937',
          visitorBubbleBgColor: data.visitorBubbleBgColor || data.primaryColor || PRIMARY_COLOR,
          visitorBubbleTextColor: data.visitorBubbleTextColor || '#ffffff',
          sendButtonBgColor: data.sendButtonBgColor || data.primaryColor || PRIMARY_COLOR,
          sendButtonTextColor: data.sendButtonTextColor || '#ffffff',
          launcherBgColor: data.launcherBgColor || data.primaryColor || PRIMARY_COLOR,
          launcherIconColor: data.launcherIconColor || '#ffffff',
          position: data.position || POSITION,
          popupTitle: data.popupTitle || 'Live Chat Online',
          popupText: data.popupText || 'Click here and start chatting with us!',
          helpJsonUrl: data.helpJsonUrl || null,
          isEnabled: data.isEnabled !== false,
        };
        //console.log('ChatX: Widget settings loaded from server for company:', COMPANY_NAME);
        // Update the widget UI with new settings
        applyWidgetSettings();
        // Fetch help articles if URL is provided
        if (widgetSettings.helpJsonUrl) {
          fetchHelpArticles();
        }
      }
    } catch (error) {
      //console.log('ChatX: Could not fetch widget settings, using defaults');
    }
  }

  // Fetch help articles from JSON URL
  async function fetchHelpArticles() {
    if (!widgetSettings.helpJsonUrl) return;

    //console.log('ChatX: Fetching help articles from:', widgetSettings.helpJsonUrl);
    try {
      const response = await fetch(widgetSettings.helpJsonUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        helpArticles = data.articles || [];
        //console.log('ChatX: Help articles loaded:', helpArticles.length);
        // Update the UI with loaded articles
        updateHelpArticlesUI();
      } else {
        //console.log('ChatX: Help articles fetch failed with status:', response.status);
      }
    } catch (error) {
      //console.log('ChatX: Could not fetch help articles:', error.message);
    }
  }

  // Update help list and docs view with articles from JSON
  function updateHelpArticlesUI() {
    //console.log('ChatX: Updating help UI with', helpArticles.length, 'articles');

    // Update home help list
    const homeHelpList = document.querySelector('.chatx-home-help-list');
    //console.log('ChatX: Found homeHelpList:', !!homeHelpList);
    if (homeHelpList && helpArticles.length > 0) {
      homeHelpList.innerHTML = helpArticles.slice(0, 4).map(article => `
        <a class="chatx-home-help-item" href="${article.url || '#'}" target="_blank">
          <span>${article.title}</span>
          ${CHEVRON_RIGHT_ICON}
        </a>
      `).join('');
      //console.log('ChatX: Home help list updated');
    }

    // Update docs article list
    const docsArticleList = document.querySelector('.chatx-docs-article-list');
    //console.log('ChatX: Found docsArticleList:', !!docsArticleList);
    if (docsArticleList && helpArticles.length > 0) {
      docsArticleList.innerHTML = helpArticles.map(article => `
        <a class="chatx-docs-article" href="${article.url || '#'}" target="_blank">
          <div class="chatx-docs-article-content">
            <div class="chatx-docs-article-text">
              <div class="chatx-docs-article-title">${article.title}</div>
              <div class="chatx-docs-article-desc">${article.description || ''}</div>
            </div>
            <div class="chatx-docs-article-arrow">
              ${CHEVRON_RIGHT_ICON}
            </div>
          </div>
        </a>
      `).join('');
      //console.log('ChatX: Docs article list updated');
    }
  }

  // Search help articles
  function searchHelpArticles(query) {
    if (!query || query.trim() === '') {
      updateHelpArticlesUI();
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    const filtered = helpArticles.filter(article =>
      article.title.toLowerCase().includes(lowerQuery) ||
      (article.description && article.description.toLowerCase().includes(lowerQuery))
    );

    // Update home help list with filtered results
    const homeHelpList = document.querySelector('.chatx-home-help-list');
    if (homeHelpList) {
      if (filtered.length > 0) {
        homeHelpList.innerHTML = filtered.slice(0, 4).map(article => `
          <a class="chatx-home-help-item" href="${article.url || '#'}" target="_blank">
            <span>${article.title}</span>
            ${CHEVRON_RIGHT_ICON}
          </a>
        `).join('');
      } else {
        homeHelpList.innerHTML = '<div class="chatx-no-results">No results found</div>';
      }
    }

    // Update docs article list with filtered results
    const docsArticleList = document.querySelector('.chatx-docs-article-list');
    if (docsArticleList) {
      if (filtered.length > 0) {
        docsArticleList.innerHTML = filtered.map(article => `
          <a class="chatx-docs-article" href="${article.url || '#'}" target="_blank">
            <div class="chatx-docs-article-content">
              <div class="chatx-docs-article-text">
                <div class="chatx-docs-article-title">${article.title}</div>
                <div class="chatx-docs-article-desc">${article.description || ''}</div>
              </div>
              <div class="chatx-docs-article-arrow">
                ${CHEVRON_RIGHT_ICON}
              </div>
            </div>
          </a>
        `).join('');
      } else {
        docsArticleList.innerHTML = '<div class="chatx-no-results">No results found</div>';
      }
    }
  }

  function getFullLogoUrl(logoUrl) {
    return resolveAssetUrl(logoUrl);
  }

  // Apply widget settings to the DOM
  function applyWidgetSettings() {
    // Update logo
    const logoImg = document.querySelector('.chatx-home-logo img');
    if (logoImg && widgetSettings.logoUrl) {
      logoImg.src = getFullLogoUrl(widgetSettings.logoUrl);
    }

    // Update greeting texts
    const greetingLarge = document.querySelector('.chatx-home-greeting-large');
    if (greetingLarge) {
      greetingLarge.textContent = widgetSettings.greetingTitle;
    }

    const greetingSmall = document.querySelector('.chatx-home-greeting-small');
    if (greetingSmall) {
      greetingSmall.textContent = widgetSettings.greetingSubtitle;
    }

    // Update chat card
    const cardTitle = document.querySelector('.chatx-home-card-title');
    if (cardTitle) {
      cardTitle.textContent = widgetSettings.chatCardTitle;
    }

    const cardText = document.querySelector('.chatx-home-card-text');
    if (cardText) {
      cardText.textContent = widgetSettings.chatCardText;
    }

    // Update start button (preserve the icon)
    const startBtn = document.getElementById('chatx-home-start');
    if (startBtn) {
      const svgIcon = startBtn.querySelector('svg');
      if (svgIcon) {
        startBtn.innerHTML = '';
        startBtn.appendChild(svgIcon);
        startBtn.appendChild(document.createTextNode(' ' + widgetSettings.startButtonText));
      }
    }

    // Update mini popup
    const popupTitle = document.querySelector('.chatx-mini-popup-title');
    if (popupTitle) {
      popupTitle.textContent = widgetSettings.popupTitle;
    }

    const popupText = document.querySelector('.chatx-mini-popup-text');
    if (popupText) {
      popupText.textContent = widgetSettings.popupText;
    }

    // Apply color settings dynamically
    applyColorSettings();
  }

  // Apply color settings to the widget
  function applyColorSettings() {
    const root = document.getElementById(WIDGET_ID);
    if (!root) return;

    // Set CSS custom properties for dynamic colors
    root.style.setProperty('--chatx-primary', widgetSettings.primaryColor);
    root.style.setProperty('--chatx-header-bg', widgetSettings.headerBgColor);
    root.style.setProperty('--chatx-header-text', widgetSettings.headerTextColor);
    root.style.setProperty('--chatx-agent-bubble-bg', widgetSettings.agentBubbleBgColor);
    root.style.setProperty('--chatx-agent-bubble-text', widgetSettings.agentBubbleTextColor);
    root.style.setProperty('--chatx-visitor-bubble-bg', widgetSettings.visitorBubbleBgColor);
    root.style.setProperty('--chatx-visitor-bubble-text', widgetSettings.visitorBubbleTextColor);
    root.style.setProperty('--chatx-send-btn-bg', widgetSettings.sendButtonBgColor);
    root.style.setProperty('--chatx-send-btn-text', widgetSettings.sendButtonTextColor);
    root.style.setProperty('--chatx-launcher-bg', widgetSettings.launcherBgColor);
    root.style.setProperty('--chatx-launcher-icon', widgetSettings.launcherIconColor);

    // Update launcher button color
    const launcherBtn = document.querySelector('.chatx-button');
    if (launcherBtn) {
      launcherBtn.style.backgroundColor = widgetSettings.launcherBgColor;
      const svgs = launcherBtn.querySelectorAll('svg');
      svgs.forEach(svg => svg.style.fill = widgetSettings.launcherIconColor);
    }

    // Update chat header color
    const chatHeader = document.getElementById('chatx-header');
    if (chatHeader) {
      chatHeader.style.background = `linear-gradient(135deg, ${widgetSettings.headerBgColor}, ${widgetSettings.headerBgColor})`;
      chatHeader.style.color = widgetSettings.headerTextColor;
    }

    // Update send button color
    const sendBtn = document.getElementById('chatx-send');
    if (sendBtn) {
      sendBtn.style.backgroundColor = widgetSettings.sendButtonBgColor;
      sendBtn.style.color = widgetSettings.sendButtonTextColor;
    }

    // Update mini popup icon background
    const popupIcon = document.querySelector('.chatx-mini-popup-icon');
    if (popupIcon) {
      popupIcon.style.backgroundColor = widgetSettings.primaryColor;
    }

    // Update message bubbles (existing ones)
    document.querySelectorAll('.chatx-message.chatx-agent .chatx-bubble').forEach(bubble => {
      bubble.style.backgroundColor = widgetSettings.agentBubbleBgColor;
      bubble.style.color = widgetSettings.agentBubbleTextColor;
    });

    document.querySelectorAll('.chatx-message.chatx-visitor .chatx-bubble').forEach(bubble => {
      bubble.style.backgroundColor = widgetSettings.visitorBubbleBgColor;
      bubble.style.color = widgetSettings.visitorBubbleTextColor;
    });
  }

  // Initialize notification sound
  function initNotificationSound(forceRetry = false) {
    if (notificationSound && !forceRetry) {
      return;
    }

    if (notificationSoundSourceIndex >= SOUND_SOURCES.length) {
      ////console.log('ChatX: Sound file not found, using fallback');
      return;
    }

    const source = SOUND_SOURCES[notificationSoundSourceIndex];
    notificationSound = new Audio(source);
    notificationSound.volume = 0.8;
    notificationSound.preload = 'auto';

    notificationSound.onerror = () => {
      ////console.log(`ChatX: Sound file not found at ${source}, trying next source`);
      notificationSound = null;
      notificationSoundSourceIndex += 1;
      initNotificationSound(true);
    };
  }

  // Track if audio has been unlocked by user interaction
  let audioUnlocked = false;

  // Unlock audio on user interaction (required by browser autoplay policy)
  function unlockAudio() {
    if (audioUnlocked) return;

    initNotificationSound();
    if (notificationSound) {
      // Save current volume and set to 0 for silent unlock
      const originalVolume = notificationSound.volume;
      notificationSound.volume = 0;
      notificationSound.currentTime = 0;

      const playPromise = notificationSound.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Immediately pause and restore volume
            notificationSound.pause();
            notificationSound.volume = originalVolume;
            notificationSound.currentTime = 0;
            audioUnlocked = true;
            //console.log('ChatX: Audio unlocked for notifications');
          })
          .catch((e) => {
            notificationSound.volume = originalVolume;
            //console.log('ChatX: Audio unlock failed:', e.message);
          });
      }
    }
  }

  // Play notification sound for agent messages
  function playNotificationSound() {
    try {
      initNotificationSound();
      if (notificationSound) {
        // Reset to beginning for each new message
        notificationSound.currentTime = 0;
        notificationSound.volume = 0.8;
        const playPromise = notificationSound.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              //console.log('ChatX: Notification sound played successfully');
            })
            .catch((e) => {
              //console.log('ChatX: Sound play blocked (user interaction required):', e.message);
              // Try to unlock audio for next time
              audioUnlocked = false;
            });
        }
      }
    } catch (e) {
      console.error('ChatX: Sound error:', e);
    }
  }

  // Play idle warning sound (tong sound) when visitor is inactive
  let idleWarningSound = null;
  function playIdleWarningSound() {
    try {
      if (!idleWarningSound) {
        const backendUrl = SERVER_URL.replace(/\/$/, '');
        // Try to load idle warning sound (tong sound)
        const idleSoundPaths = [
          `${backendUrl}/sounds/idle-warning.mp3`,
          `${backendUrl}/sounds/tong.mp3`,
          `${backendUrl}/sounds/notification-reply-001.mp3`, // Fallback to regular notification
        ];

        idleWarningSound = new Audio();
        idleWarningSound.volume = 0.8;

        // Try loading sounds in order
        let loadAttempt = 0;
        const tryLoadSound = () => {
          if (loadAttempt < idleSoundPaths.length) {
            idleWarningSound.src = idleSoundPaths[loadAttempt];
            loadAttempt++;
          }
        };

        idleWarningSound.onerror = () => {
          tryLoadSound();
        };

        tryLoadSound();
      }

      if (idleWarningSound && idleWarningSound.src) {
        idleWarningSound.currentTime = 0;
        const playPromise = idleWarningSound.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              //console.log('ChatX: Idle warning sound played successfully');
            })
            .catch((e) => {
              //console.log('ChatX: Idle sound play blocked:', e.message);
              // Fallback to regular notification sound
              playNotificationSound();
            });
        }
      } else {
        // Fallback to regular notification sound
        playNotificationSound();
      }
    } catch (e) {
      console.error('ChatX: Idle sound error:', e);
      playNotificationSound(); // Fallback
    }
  }

  // Get or create a persistent session ID (stored in localStorage for visitor identification)
  // Use organization-specific key to prevent cross-organization session conflicts
  function getOrCreateSessionId() {
    const storageKey = `chatx_session_id_${COMPANY_NAME.toLowerCase().replace(/\s+/g, '_')}`;
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(storageKey, id);
    }
    return id;
  }

  // Styles
  const styles = `
    .material-symbols-outlined {
      font-family: 'Material Symbols Outlined';
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: 'liga';
    }
    
    #${WIDGET_ID} {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      font-size: 14px;
      line-height: 1.4;
      --chatx-primary: ${PRIMARY_COLOR};
      --chatx-header-bg: ${PRIMARY_COLOR};
      --chatx-header-text: #ffffff;
      --chatx-agent-bubble-bg: #f3f4f6;
      --chatx-agent-bubble-text: #1f2937;
      --chatx-visitor-bubble-bg: ${PRIMARY_COLOR};
      --chatx-visitor-bubble-text: #ffffff;
      --chatx-send-btn-bg: ${PRIMARY_COLOR};
      --chatx-send-btn-text: #ffffff;
      --chatx-launcher-bg: ${PRIMARY_COLOR};
      --chatx-launcher-icon: #ffffff;
    }

    #${WIDGET_ID} * {
      box-sizing: border-box;
    }

    .chatx-button {
      position: fixed;
      bottom: 20px;
      ${POSITION}: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--chatx-launcher-bg, ${PRIMARY_COLOR});
      color: var(--chatx-launcher-icon, white);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55), box-shadow 0.3s ease;
      z-index: 999998;
      animation: chatx-button-entrance 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .chatx-button:hover {
      transform: scale(1.1);
      box-shadow: 0 8px 25px rgba(0,0,0,0.25);
    }

    .chatx-button:active {
      transform: scale(0.95);
    }

    .chatx-button.chatx-button-pulse {
      animation: chatx-button-pulse 2s infinite;
    }

    .chatx-button svg {
      width: 28px;
      height: 28px;
      transition: transform 0.3s ease, opacity 0.2s ease;
    }

    /* Font Awesome icon styles for toggle button */
    .chatx-button i {
      font-size: 24px;
      transition: transform 0.3s ease, opacity 0.2s ease;
    }

    /* Icon states for toggle button */
    .chatx-button .chatx-icon-default {
      display: block;
    }
    .chatx-button .chatx-icon-hover {
      display: none;
    }
    .chatx-button .chatx-icon-close {
      display: none;
    }
    .chatx-button:hover .chatx-icon-default {
      display: none;
    }
    .chatx-button:hover .chatx-icon-hover {
      display: block;
    }
    .chatx-button:hover .chatx-icon-close {
      display: none;
    }
    .chatx-button.chatx-open .chatx-icon-default,
    .chatx-button.chatx-open .chatx-icon-hover {
      display: none;
    }
    .chatx-button.chatx-open .chatx-icon-close {
      display: block;
    }
    .chatx-button.chatx-open:hover .chatx-icon-close {
      display: block;
    }

    /* Minimized popup notification */
    .chatx-mini-popup {
      position: fixed;
      bottom: 90px;
      ${POSITION}: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      padding: 16px 40px 16px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 999997;
      cursor: pointer;
      transform: translateY(20px) scale(0.9);
      opacity: 0;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
      pointer-events: none;
      max-width: 300px;
    }

    .chatx-mini-popup.show {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: auto;
    }

    .chatx-mini-popup-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 20px;
      height: 20px;
      border: none;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: color 0.2s ease, background 0.2s ease;
    }

    .chatx-mini-popup-close:hover {
      color: #6b7280;
      background: #f3f4f6;
    }

    .chatx-mini-popup-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${PRIMARY_COLOR}15;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .chatx-mini-popup-icon svg {
      width: 22px;
      height: 22px;
      color: #ffffff;
    }

    .chatx-mini-popup-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .chatx-mini-popup-title {
      font-weight: 600;
      font-size: 16px;
      color: #1f2937;
    }

    .chatx-mini-popup-text {
      font-size: 15px;
      color: #6b7280;
      line-height: 1.4;
    }

    .chatx-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #e53935;
      color: white;
      font-size: 12px;
      font-weight: bold;
      min-width: 20px;
      height: 20px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
    }

    .chatx-window {
      position: fixed;
      bottom: 90px;
      ${POSITION}: 20px;
      width: 400px;
      height: min(680px, (100% - 104px));
      background: white;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      transform: scale(0.9) translateY(20px);
      opacity: 0;
      transform-origin: bottom ${POSITION};
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
    }

    .chatx-window.open {
      display: flex;
      transform: scale(1) translateY(0);
      opacity: 1;
      animation: chatx-window-slide-up 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    .chatx-window.closing {
      animation: chatx-window-zoom-out 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    /* Wiggle animation class for button */
    .chatx-button-wiggle {
      animation: chatx-wiggle 0.6s ease-in-out;
    }

    /* Attention pulse animation class */
    .chatx-button-attention {
      animation: chatx-attention-pulse 2s ease-in-out infinite;
    }

    .chatx-header {
      background: white;
      color: #1f2937;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f3f4f6;
    }

    .chatx-header-info {
      display: flex;
      align-items: center;
      flex: 1;
    }

    .chatx-header-back {
      background: none;
      border: none;
      color: #374151;
      cursor: pointer;
      padding: 8px;
      margin-right: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      transition: background 0.2s;
    }

    .chatx-header-info {
      min-width: 0;
      flex: 1;
    }

    .chatx-header-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chatx-header-status {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chatx-header-back:hover {
      background: #f3f4f6;
    }

    .chatx-header-back svg {
      width: 20px !important;
      height: 20px !important;
      fill: #374151 !important;
      display: block !important;
      max-width: none !important;
      max-height: none !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    .chatx-header-back svg path {
      fill: #374151 !important;
    }

    .chatx-header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      overflow: hidden;
    }

    .chatx-header-avatar img {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      border-radius: 50% !important;
      display: block !important;
      max-width: none !important;
      max-height: none !important;
      visibility: visible !important;
      opacity: 1 !important;
    }

    .chatx-header-avatar svg {
      fill: #6b7280;
    }

    .chatx-header-title {
      font-weight: 600;
      font-size: 16px;
      color: #111827;
    }

    .chatx-header-status {
      font-size: 12px;
      color: #6b7280;
    }

    .chatx-close {
      background: none;
      border: none;
      color: #6b7280;
      cursor: pointer;
      padding: 4px;
      opacity: 0.8;
      width: 30px;
    }

    .chatx-close:hover {
      opacity: 1;
    }

    .chatx-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f5f7f9;
    }

    .chatx-message {
      margin-bottom: 16px;
      display: flex;
      align-items: flex-start;
    }

    .chatx-message:not(.chatx-new-message) {
      animation: chatx-message-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .chatx-message.visitor:not(.chatx-new-message) {
      justify-content: flex-end;
      animation: chatx-message-slide-in-right 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .chatx-message.visitor {
      justify-content: flex-end;
    }

    .chatx-message.chatx-new-message {
      animation: chatx-message-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .chatx-message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 10px;
      flex-shrink: 0;
      color: #666;
      font-size: 14px;
      overflow: hidden;
      position: relative;
    }

    .chatx-message-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .chatx-message-avatar svg {
      width: 18px;
      height: 18px;
      fill: #666;
    }

    .chatx-message-content {
      display: flex;
      flex-direction: column;
      max-width: 75%;
    }

    .chatx-message-sender {
      font-size: 12px;
      font-weight: 600;
      color: ${PRIMARY_COLOR};
      margin-bottom: 4px;
    }

    .chatx-message.visitor .chatx-message-sender {
      text-align: right;
      color: #666;
    }

    .chatx-message-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      word-wrap: break-word;
      position: relative;
    }

    .chatx-message.agent .chatx-message-bubble {
      background: var(--chatx-agent-bubble-bg, white);
      color: var(--chatx-agent-bubble-text, #1f2937);
      border-top-left-radius: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .chatx-message-text {
      display: inline;
    }

    /* Typewriter cursor effect */
    .chatx-message-text:empty::after {
      content: '|';
      animation: chatx-blink 0.7s infinite;
      color: var(--chatx-primary, ${PRIMARY_COLOR});
      font-weight: normal;
    }

    @keyframes chatx-blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }

    .chatx-message.visitor .chatx-message-bubble {
      background: var(--chatx-visitor-bubble-bg, ${PRIMARY_COLOR});
      color: var(--chatx-visitor-bubble-text, white);
      border-top-right-radius: 4px;
    }

    .chatx-message-sender {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .chatx-staff-badge {
      display: inline-flex;
      align-items: center;
      background: var(--chatx-primary, ${PRIMARY_COLOR});
      color: white;
      font-size: 9px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chatx-message-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-top: 4px;
      gap: 4px;
    }

    .chatx-message-time {
      font-size: 10px;
      opacity: 0.6;
    }

    .chatx-message-status {
      font-family: 'Material Symbols Outlined';
      font-size: 16px;
      font-weight: normal;
      font-style: normal;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: 'liga';
      opacity: 0.7;
      margin-left: 4px;
      vertical-align: middle;
    }

    .chatx-message-status.read {
      color: #90EE90;
      opacity: 1;
    }

    .chatx-system-message {
      text-align: center;
      margin: 16px 0;
    }

    .chatx-system-message-text {
      color: #666;
      font-size: 13px;
      font-weight: 500;
      background: #f5f8ff;
      border: 1px solid #e3f2fd;
      padding: 8px 16px;
      border-radius: 16px;
      display: inline-block;
      position: relative;
    }

    .chatx-agent-joined {
      text-align: center;
      margin: 24px 0;
      padding: 0 20px;
      animation: chatx-agent-joined-entrance 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .chatx-chat-idle {
      text-align: center;
      margin: 16px 0;
      padding: 0 20px;
    }

    .chatx-chat-idle .chatx-system-message-text {
      color: #856404;
      background: #fff3cd;
      border: 1px solid #ffc107;
      font-size: 12px;
      padding: 6px 12px;
    }

    .chatx-agent-joined-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--chatx-primary, ${PRIMARY_COLOR}), var(--chatx-primary, ${PRIMARY_COLOR}));
      margin: 0 auto 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(67, 160, 71, 0.3);
      border: 3px solid white;
      animation: chatx-avatar-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both;
    }

    .chatx-agent-joined-avatar svg {
      width: 28px;
      height: 28px;
      fill: white;
    }

    .chatx-agent-joined-avatar img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .chatx-agent-joined-name {
      font-weight: 600;
      color: #333;
      font-size: 14px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .chatx-agent-joined-text {
      color: #666;
      font-size: 12px;
      line-height: 1.5;
    }

    .chatx-typing {
      display: flex;
      align-items: center;
      padding: 10px 14px;
      background: white;
      border-radius: 16px;
      border-top-left-radius: 4px;
      max-width: 80px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }

    .chatx-typing-dot {
      width: 6px;
      height: 6px;
      background: #90a4ae;
      border-radius: 50%;
      margin: 0 2px;
      animation: chatx-bounce 1.4s infinite ease-in-out;
    }

    .chatx-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .chatx-typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes chatx-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    @keyframes chatx-button-entrance {
      0% {
        transform: scale(0) rotate(-180deg);
        opacity: 0;
      }
      100% {
        transform: scale(1) rotate(0);
        opacity: 1;
      }
    }

    @keyframes chatx-button-pulse {
      0% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 ${PRIMARY_COLOR}66;
      }
      70% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 15px ${PRIMARY_COLOR}00;
      }
      100% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 ${PRIMARY_COLOR}00;
      }
    }

    /* ThriveDesk-style smooth slide up with fade */
    @keyframes chatx-window-slide-up {
      0% {
        transform: scale(0.9) translateY(20px);
        opacity: 0;
      }
      100% {
        transform: scale(1) translateY(0);
        opacity: 1;
      }
    }

    @keyframes chatx-window-zoom-out {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(0);
        opacity: 0;
      }
    }

    @keyframes chatx-message-slide-in {
      0% {
        transform: translateX(-20px);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes chatx-message-slide-in-right {
      0% {
        transform: translateX(20px);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes chatx-message-pop {
      0% {
        transform: scale(0.8);
        opacity: 0;
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes chatx-agent-joined-entrance {
      0% {
        transform: translateY(20px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }

    @keyframes chatx-avatar-pop {
      0% {
        transform: scale(0);
      }
      50% {
        transform: scale(1.2);
      }
      100% {
        transform: scale(1);
      }
    }

    @keyframes chatx-shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }

    /* ThriveDesk-style wiggle animation for attention */
    @keyframes chatx-wiggle {
      0%, 100% { transform: rotate(0deg); }
      10%, 30%, 50%, 70% { transform: rotate(-3deg); }
      20%, 40%, 60% { transform: rotate(3deg); }
      80% { transform: rotate(-2deg); }
      90% { transform: rotate(2deg); }
    }

    /* Attention-grabbing pulse with scale */
    @keyframes chatx-attention-pulse {
      0% {
        transform: scale(1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 ${PRIMARY_COLOR}66;
      }
      50% {
        transform: scale(1.05);
        box-shadow: 0 6px 20px rgba(0,0,0,0.2), 0 0 0 10px ${PRIMARY_COLOR}00;
      }
      100% {
        transform: scale(1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 0 0 0 ${PRIMARY_COLOR}00;
      }
    }

    /* Smooth fade and slide up (ThriveDesk style) */
    @keyframes chatx-fade-slide-up {
      0% {
        opacity: 0;
        transform: translateY(20px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Staggered content animation */
    @keyframes chatx-stagger-in {
      0% {
        opacity: 0;
        transform: translateY(15px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Slide down from top (for header) */
    @keyframes chatx-slide-down {
      0% {
        opacity: 0;
        transform: translateY(-20px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Slide up from bottom with fade (for cards) */
    @keyframes chatx-slide-up-fade {
      0% {
        opacity: 0;
        transform: translateY(30px);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes chatx-notification-badge {
      0% {
        transform: scale(0);
      }
      50% {
        transform: scale(1.3);
      }
      100% {
        transform: scale(1);
      }
    }

    .chatx-badge {
      animation: chatx-notification-badge 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .chatx-button-shake {
      animation: chatx-shake 0.6s ease-in-out;
    }

    .chatx-input-area {
      padding: 12px 16px 8px;
      background: white;
      border-top: 1px solid #e0e0e0;
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }

    .chatx-footer {
      flex-shrink: 0;
      background: #f9fafb;
    }

    .chatx-file-upload {
      background: #f5f5f5;
      color: #666;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background-color 0.2s;
      padding: 0;
    }

    .chatx-file-upload svg {
      width: 20px;
      height: 20px;
      fill: #666;
      pointer-events: none;
    }

    .chatx-file-upload:hover {
      background: #e0e0e0;
    }

    .chatx-file-input {
      display: none;
    }

    .chatx-image-preview {
      max-width: 200px;
      max-height: 150px;
      border-radius: 8px;
      margin-top: 8px;
      border: 1px solid #e0e0e0;
    }

    .chatx-file-error {
      color: #f44336;
      font-size: 12px;
      margin-top: 4px;
    }

    .chatx-input {
      flex: 1;
      border: 1px solid #e0e0e0;
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 14px;
      outline: none;
      resize: none;
      max-height: 100px;
      font-family: inherit;
    }

    .chatx-input:focus {
      border-color: var(--chatx-primary, ${PRIMARY_COLOR});
    }

    .chatx-send {
      background: var(--chatx-send-btn-bg, ${PRIMARY_COLOR});
      color: var(--chatx-send-btn-text, white);
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .chatx-send:hover {
      opacity: 0.9;
    }

    .chatx-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chatx-emoji-container {
      position: relative;
    }

    .chatx-emoji-btn {
      background: #f5f5f5;
      color: #666;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background-color 0.2s;
      padding: 0;
    }

    .chatx-emoji-btn:hover {
      background: #e0e0e0;
    }

    .chatx-emoji-picker {
      position: absolute;
      bottom: 50px;
      left: 0;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 1000;
      width: 320px;
      height: 350px;
      overflow: hidden;
    }

    .chatx-emoji-picker emoji-picker {
      width: 100%;
      height: 100%;
      --num-columns: 8;
      --emoji-size: 1.3rem;
      --border-radius: 12px;
      --border-size: 0;
    }

    .chatx-prechat {
      padding: 24px;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .chatx-prechat-header {
      margin-bottom: 24px;
      text-align: center;
    }

    .chatx-prechat-header p {
      margin: 0;
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
    }

    .chatx-prechat-form {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chatx-prechat-field {
      position: relative;
    }

    .chatx-prechat-field input,
    .chatx-prechat-field textarea {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 15px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
      transition: all 0.2s ease;
      color: #1e293b;
      box-sizing: border-box;
    }

    .chatx-prechat-field input:hover,
    .chatx-prechat-field textarea:hover {
      border-color: #cbd5e1;
    }

    .chatx-prechat-field input:focus,
    .chatx-prechat-field textarea:focus {
      border-color: ${PRIMARY_COLOR};
      box-shadow: 0 0 0 4px ${PRIMARY_COLOR}15;
    }

    .chatx-prechat-field input::placeholder,
    .chatx-prechat-field textarea::placeholder {
      color: #94a3b8;
    }

    .chatx-prechat-field textarea {
      min-height: 80px;
      resize: none;
      max-height: 120px;
    }

    /* Custom Department Dropdown */
    .chatx-dropdown {
      position: relative;
    }

    .chatx-dropdown-toggle {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 15px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.2s ease;
      color: #94a3b8;
    }

    .chatx-dropdown-toggle:hover {
      border-color: #cbd5e1;
    }

    .chatx-dropdown-toggle.has-value {
      color: #1e293b;
    }

    .chatx-dropdown-toggle:focus,
    .chatx-dropdown.open .chatx-dropdown-toggle {
      border-color: ${PRIMARY_COLOR};
      box-shadow: 0 0 0 4px ${PRIMARY_COLOR}15;
    }

    .chatx-dropdown-arrow {
      width: 18px;
      height: 18px;
      transition: transform 0.25s ease;
      color: #64748b;
    }

    .chatx-dropdown.open .chatx-dropdown-arrow {
      transform: rotate(180deg);
    }

    .chatx-dropdown-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.12);
      z-index: 100;
      display: none;
      max-height: 200px;
      overflow-y: auto;
      animation: chatx-dropdown-appear 0.2s ease;
    }

    @keyframes chatx-dropdown-appear {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .chatx-dropdown.open .chatx-dropdown-menu {
      display: block;
    }

    .chatx-dropdown-item {
      padding: 12px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.15s ease;
    }

    .chatx-dropdown-item:hover {
      background: #f1f5f9;
    }

    .chatx-dropdown-item:first-child {
      border-radius: 10px 10px 0 0;
    }

    .chatx-dropdown-item:last-child {
      border-radius: 0 0 10px 10px;
    }

    .chatx-dropdown-item-name {
      font-size: 14px;
      color: #334155;
      font-weight: 500;
    }

    .chatx-dropdown-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .chatx-dropdown-badge.online {
      background: linear-gradient(135deg, var(--chatx-primary, ${PRIMARY_COLOR}), var(--chatx-primary, ${PRIMARY_COLOR}));
      color: white;
    }

    .chatx-dropdown-badge.offline {
      background: #f1f5f9;
      color: #64748b;
    }

    .chatx-prechat-submit {
      background: linear-gradient(135deg, var(--chatx-primary, ${PRIMARY_COLOR}) 0%, var(--chatx-primary, ${PRIMARY_COLOR}) 100%);
      color: white;
      border: none;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
      transition: all 0.25s ease;
      box-shadow: 0 4px 15px rgba(67, 160, 71, 0.25);
    }

    .chatx-prechat-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(67, 160, 71, 0.35);
    }

    .chatx-prechat-submit:active {
      transform: translateY(0);
      box-shadow: 0 2px 10px rgba(67, 160, 71, 0.25);
    }

    .chatx-prechat-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;
      padding: 12px 16px;
      color: #dc2626;
      font-size: 14px;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .chatx-prechat-error::before {
      display: none;
    }

    .chatx-powered {
      padding: 6px 20px;
      text-align: center;
      background: #f9fafb;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .chatx-powered span {
      font-size: 11px;
      color: #9ca3af;
    }

    .chatx-powered img {
      height: 16px;
      vertical-align: middle;
    }

    .chatx-end-chat {
      background: none;
      border: none;
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      margin-right: 8px;
      transition: background 0.2s;
      width: 65px;
    }

    .chatx-end-chat:hover {
      background: rgba(220, 38, 38, 0.1);
      color: #b91c1c;
    }

    .chatx-chat-ended {
      text-align: center;
      padding: 20px;
      background: #f9fafb;
      flex: 1;
      overflow-y: auto;
      display: none !important;
    }

    .chatx-chat-ended-info {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 16px;
    }

    .chatx-inline-rating {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      margin: 16px 12px;
      text-align: center;
      border: 1px solid #e5e7eb;
    }

    .chatx-inline-rating .chatx-chat-ended-info {
      color: #6b7280;
      font-size: 12px;
      margin-bottom: 12px;
    }

    .chatx-inline-rating .chatx-rating-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .chatx-inline-rating .chatx-rating-subtitle {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 16px;
    }

    .chatx-inline-rating .chatx-rating-buttons {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-bottom: 16px;
    }

    .chatx-inline-rating .chatx-rating-btn {
      width: 90px;
      height: 90px;
      border-radius: 12px;
      border: none;
      background: #f3f4f6;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      gap: 0;
    }

    .chatx-inline-rating .chatx-rating-btn:hover {
      transform: scale(1.05);
    }

    .chatx-inline-rating .chatx-rating-btn.positive:hover {
      background: rgba(67, 160, 71, 0.15);
    }

    .chatx-inline-rating .chatx-rating-btn.negative:hover {
      background: rgba(220, 53, 69, 0.15);
    }

    .chatx-inline-rating .chatx-rating-btn.selected.positive {
      background: rgba(67, 160, 71, 0.2);
      box-shadow: 0 0 0 2px ${PRIMARY_COLOR};
    }

    .chatx-inline-rating .chatx-rating-btn.selected.negative {
      background: rgba(220, 53, 69, 0.2);
      box-shadow: 0 0 0 2px #dc3545;
    }

    .chatx-inline-rating .chatx-rating-btn svg {
      width: 56px;
      height: 56px;
    }

    .chatx-inline-rating .chatx-rating-btn.positive {
      color: ${PRIMARY_COLOR};
    }

    .chatx-inline-rating .chatx-rating-btn.negative {
      color: #dc3545;
    }

    .chatx-inline-rating .chatx-rating-label {
      display: none;
    }

    .chatx-inline-rating .chatx-rating-comment {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      resize: none;
      margin-bottom: 12px;
      font-family: inherit;
    }

    .chatx-inline-rating .chatx-rating-submit {
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
      width: 100%;
      margin-bottom: 16px;
    }

    .chatx-inline-rating .chatx-rating-success {
      background: #4caf50;
      color: white;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      font-weight: 500;
      margin-top: 12px;
    }

    .chatx-inline-rating .chatx-rating-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .chatx-input-area.hidden {
      display: none !important;
    }

    .chatx-rating-title {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .chatx-rating-subtitle {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 16px;
    }

    .chatx-rating-buttons {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .chatx-rating-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 2px solid #e5e7eb;
      background: white;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      gap: 4px;
    }

    .chatx-rating-btn:hover {
      border-color: ${PRIMARY_COLOR};
      transform: scale(1.05);
    }

    .chatx-rating-btn.selected {
      border-color: ${PRIMARY_COLOR};
      background: rgba(67, 160, 71, 0.1);
    }

    .chatx-rating-btn.selected.negative {
      border-color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .chatx-rating-btn svg {
      width: 20px;
      height: 20px;
    }

    .chatx-rating-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chatx-rating-btn.positive svg {
      fill: ${PRIMARY_COLOR};
    }

    .chatx-rating-btn.positive .chatx-rating-label {
      color: ${PRIMARY_COLOR};
    }

    .chatx-rating-btn.negative svg {
      fill: #ef4444;
    }

    .chatx-rating-btn.negative .chatx-rating-label {
      color: #ef4444;
    }

    .chatx-rating-comment {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      resize: none;
      margin-bottom: 12px;
      font-family: inherit;
    }

    .chatx-rating-comment:focus {
      outline: none;
      border-color: ${PRIMARY_COLOR};
    }

    .chatx-rating-submit {
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
      width: 100%;
      margin-bottom: 16px;
    }

    .chatx-rating-submit:hover {
      opacity: 0.9;
    }

    .chatx-rating-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .chatx-rating-success {
      background: #4caf50;
      color: white;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      font-weight: 500;
      margin-top: 12px;
    }

    .chatx-rating-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }

    .chatx-transcript-btn {
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }

    .chatx-rating-or {
      color: #9ca3af;
      font-size: 13px;
    }

    .chatx-new-chat-btn {
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .chatx-new-chat-btn:hover {
      opacity: 0.9;
    }

    /* End Chat Confirmation Modal */
    .chatx-confirm-modal {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: chatx-fade-in 0.2s ease;
    }

    @keyframes chatx-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .chatx-confirm-dialog {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin: 20px;
      max-width: 300px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      animation: chatx-scale-in 0.2s ease;
    }

    @keyframes chatx-scale-in {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .chatx-confirm-text {
      font-size: 16px;
      color: #374151;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .chatx-confirm-buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .chatx-confirm-btn {
      padding: 10px 28px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
      min-width: 80px;
    }

    .chatx-confirm-btn.yes {
      background: ${PRIMARY_COLOR};
      color: white;
    }

    .chatx-confirm-btn.yes:hover {
      opacity: 0.9;
    }

    .chatx-confirm-btn.no {
      background: ${PRIMARY_COLOR};
      color: white;
    }

    .chatx-confirm-btn.no:hover {
      opacity: 0.9;
    }

    .chatx-whmcs-login {
      padding: 20px;
      background: white;
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .chatx-whmcs-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .chatx-whmcs-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .chatx-whmcs-subtitle {
      font-size: 14px;
      color: #6b7280;
      line-height: 1.5;
    }

    .chatx-org-selection {
      margin-bottom: 20px;
    }

    .chatx-org-title {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 8px;
    }

    .chatx-org-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chatx-org-option {
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      background: white;
    }

    .chatx-org-option:hover {
      border-color: ${PRIMARY_COLOR};
      background: rgba(67, 160, 71, 0.05);
    }

    .chatx-org-option.selected {
      border-color: ${PRIMARY_COLOR};
      background: rgba(67, 160, 71, 0.1);
    }

    .chatx-org-name {
      font-weight: 500;
      color: #1f2937;
      font-size: 14px;
    }

    .chatx-whmcs-form {
      flex: 1;
    }

    .chatx-whmcs-field {
      margin-bottom: 16px;
    }

    .chatx-whmcs-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 6px;
    }

    .chatx-whmcs-input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      background: white;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .chatx-whmcs-input:focus {
      border-color: ${PRIMARY_COLOR};
      box-shadow: 0 0 0 2px ${PRIMARY_COLOR}20;
    }

    .chatx-whmcs-submit {
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
      transition: opacity 0.2s, transform 0.2s;
    }

    .chatx-whmcs-submit:hover {
      opacity: 0.9;
    }

    .chatx-whmcs-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .chatx-whmcs-error {
      color: #ef4444;
      font-size: 13px;
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 6px;
    }

    .chatx-whmcs-loading {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .chatx-offline-request {
      display: flex;
      flex-direction: column;
      padding: 24px;
      flex: 1;
      overflow-y: auto;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    }

    .chatx-offline-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .chatx-offline-field {
      display: flex;
      flex-direction: column;
    }

    .chatx-offline-input,
    .chatx-offline-textarea {
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 15px;
      font-family: inherit;
      outline: none;
      background: #ffffff;
      transition: all 0.2s ease;
      box-sizing: border-box;
      color: #1e293b;
    }

    .chatx-offline-input {
      width: 100%;
      height: 50px;
    }

    .chatx-offline-input:hover,
    .chatx-offline-textarea:hover {
      border-color: #cbd5e1;
    }

    .chatx-offline-input:focus,
    .chatx-offline-textarea:focus {
      border-color: ${PRIMARY_COLOR};
      box-shadow: 0 0 0 4px ${PRIMARY_COLOR}15;
    }

    .chatx-offline-input::placeholder,
    .chatx-offline-textarea::placeholder {
      color: #94a3b8;
    }

    .chatx-offline-textarea {
      width: 100%;
      min-height: 100px;
      resize: none;
      font-family: inherit;
    }

    .chatx-offline-error {
      color: #dc2626;
      font-size: 13px;
      padding: 12px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      display: none;
      margin-top: 4px;
    }

    .chatx-offline-success {
      color: #059669;
      font-size: 13px;
      padding: 12px 14px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 10px;
      text-align: center;
      display: none;
      margin-top: 4px;
    }

    .chatx-offline-submit {
      background: linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_COLOR} 100%);
      color: white;
      border: none;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
      height: 52px;
      transition: all 0.25s ease;
      box-shadow: 0 4px 15px ${PRIMARY_COLOR}40;
    }

    .chatx-offline-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px ${PRIMARY_COLOR}50;
    }

    .chatx-offline-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .chatx-offline-thankyou {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px 24px;
      flex: 1;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    }

    .chatx-offline-thankyou-icon {
      margin-bottom: 24px;
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, ${PRIMARY_COLOR}20 0%, ${PRIMARY_COLOR}10 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: chatx-success-pop 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    @keyframes chatx-success-pop {
      0% { transform: scale(0); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    .chatx-offline-thankyou-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px 0;
    }

    .chatx-offline-thankyou-message {
      font-size: 15px;
      color: #64748b;
      margin: 0 0 28px 0;
      line-height: 1.6;
    }

    .chatx-offline-goback {
      background: #ffffff;
      color: #475569;
      border: 2px solid #e2e8f0;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .chatx-offline-goback:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
      transform: translateY(-1px);
    }

    .chatx-whmcs-back {
      background: transparent;
      color: #6b7280;
      border: 1px solid #d1d5db;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      margin-top: 12px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chatx-whmcs-back:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
      color: #374151;
    }

    .chatx-whmcs-success {
      text-align: center;
      padding: 20px;
    }

    .chatx-whmcs-success-icon {
      width: 64px;
      height: 64px;
      background: #dcfce7;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .chatx-whmcs-success-icon svg {
      color: #22c55e;
    }

    .chatx-whmcs-success-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .chatx-whmcs-success-info {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 16px;
    }

    .chatx-whmcs-user-info {
      background: #f3f4f6;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: left;
    }

    .chatx-whmcs-user-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 13px;
    }

    .chatx-whmcs-user-label {
      color: #6b7280;
    }

    .chatx-whmcs-user-value {
      color: #1f2937;
      font-weight: 500;
    }

    .chatx-whmcs-start-chat {
      background: ${PRIMARY_COLOR};
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      transition: opacity 0.2s;
    }

    .chatx-whmcs-start-chat:hover {
      opacity: 0.9;
    }

    .chatx-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top: 2px solid currentColor;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .chatx-greeting {
      background: white;
      padding: 12px 14px;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      max-width: 80%;
      margin-bottom: 12px;
    }

    @media (max-width: 480px) {
      .chatx-window {
        width: calc(100% - 20px);
        height: calc(100% - 100px);
        bottom: 80px;
        ${POSITION}: 10px;
        border-radius: 12px;
      }

      .chatx-button {
        bottom: 15px;
        ${POSITION}: 15px;
        width: 56px;
        height: 56px;
      }
    }

    /* Image Modal */
    .chatx-image-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999999;
      animation: chatx-modal-fade-in 0.2s ease;
    }

    @keyframes chatx-modal-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .chatx-image-modal-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
    }

    .chatx-image-modal-close {
      position: absolute;
      top: -40px;
      right: -40px;
      width: 36px;
      height: 36px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .chatx-image-modal-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .chatx-image-modal-close svg {
      width: 24px;
      height: 24px;
      color: white;
    }

    .chatx-image-modal img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }

    .chatx-image-modal-download {
      position: absolute;
      bottom: -50px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.2s;
      text-decoration: none;
    }

    .chatx-image-modal-download:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .chatx-image-preview {
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .chatx-image-preview:hover {
      opacity: 0.85;
    }

    .chatx-image-loading {
      min-width: 100px;
      min-height: 75px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: chatx-image-loading-shimmer 1.5s infinite;
    }

    @keyframes chatx-image-loading-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (max-width: 480px) {
      .chatx-image-modal-close {
        top: 10px;
        right: 10px;
      }

      .chatx-image-modal-download {
        bottom: 20px;
      }
    }

    /* --- New Design Styles --- */
    .chatx-home-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 10;
      overflow-y: auto;
    }

    .chatx-view-hidden {
      display: none !important;
    }

    .chatx-home-header {
      padding: 32px 24px 0;
      background: white;
      animation: chatx-slide-down 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    .chatx-home-logo {
      margin-bottom: 24px;
    }

    .chatx-home-logo img {
      height: 32px;
      width: auto;
      display: block;
    }

    .chatx-home-greeting-small {
      color: #1f2937;
      display: block;
      font-size: 16px;
      font-weight: 400;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
      margin-bottom: 8px;
    }

    .chatx-home-greeting-large {
      color: #1f2937;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    /* Conversation Card */
    .chatx-home-card {
      margin: 0 15px 15px;
      padding: 15px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border: 1px solid #f3f4f6;
      opacity: 0;
      animation: chatx-slide-up-fade 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    /* Staggered animation delays for cards */
    .chatx-home-card:nth-child(1) {
      animation-delay: 0.1s;
    }
    .chatx-home-card:nth-child(2) {
      animation-delay: 0.2s;
    }
    .chatx-home-card:nth-child(3) {
      animation-delay: 0.3s;
    }
    .chatx-home-card:nth-child(4) {
      animation-delay: 0.4s;
    }

    .chatx-home-card:hover{
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.06);
    }

    .chatx-home-card-title {
      font-size: 16px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 8px;
    }

    .chatx-home-card-text {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 20px;
    }

    .chatx-home-avatars {
      display: flex;
      margin-bottom: 20px;
      padding-left: 8px;
    }

    .chatx-home-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid white;
      margin-left: -12px;
      background: #e0e0e0;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .chatx-home-avatar:first-child {
      margin-left: 0;
    }

    .chatx-home-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .chatx-home-start-btn{

    width: 60%;
    background: #111827;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.2s;
}
    
    .chatx-home-start-btn svg{
      width: 20px;
      height: 20px;
    }

    .chatx-home-start-btn:hover {
      background: #000000;
    }

    /* Help Center */
    .chatx-home-help {
      padding: 0 24px;
      flex: 1;
      overflow-y: auto;
      opacity: 0;
      animation: chatx-slide-up-fade 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
    }

    .chatx-home-search {
      position: relative;
      margin-bottom: 16px;
    }

    .chatx-home-search input {
      width: 100%;
      padding: 14px 16px 14px 46px;
      background: #f3f4f6;
      border: 1px solid transparent;
      border-radius: 12px;
      font-size: 14px;
      color: #1f2937;
      outline: none;
      transition: all 0.2s;
    }
    
    .chatx-home-search input:focus {
      background: white;
      border-color: #e5e7eb;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }

    .chatx-home-search svg {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 20px;
      color: #6b7280;
    }

    .chatx-home-help-list {
      display: flex;
      flex-direction: column;
    }

    .chatx-home-help-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 0;
      color: #374151;
      text-decoration: none;
      font-size: 14px;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
    }

    .chatx-home-help-item:last-child {
      border-bottom: none;
    }

    .chatx-home-help-item:hover {
      color: ${PRIMARY_COLOR};
    }
    
    .chatx-home-help-item svg {
      color: #9ca3af;
      width: 16px;
      height: 16px;
    }

    .chatx-no-results {
      padding: 20px 0;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }

    /* Bottom Nav */
    .chatx-bottom-nav {
      padding: 12px 24px;
      border-top: 1px solid #f3f4f6;
      display: flex;
      justify-content: space-around;
      background: white;
      width: 100%;
      opacity: 0;
      animation: chatx-slide-up-fade 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.6s forwards;
      /* Position fixed at bottom of widget container (which is absolute/flex) */
      /* Since chatx-home-view is flex column, just stick it at bottom */
    }

    .chatx-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #9ca3af;
      cursor: pointer;
      font-size: 11px;
      gap: 4px;
      border: none;
      background: none;
      min-width: 60px;
      transition: color 0.2s;
    }

    .chatx-nav-item.active {
      color: #111827;
      font-weight: 600;
    }
    
    .chatx-nav-item:hover {
      color: #4b5563;
    }

    .chatx-nav-item svg {
      width: 24px;
      height: 24px;
    }

    /* --- DOCS VIEW STYLES --- */
    .chatx-docs-view {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: white;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 10;
    }

    .chatx-docs-header {
      padding: 20px 16px;
      background: white;
      border-bottom: 1px solid #f3f4f6;
      animation: chatx-slide-down 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    .chatx-docs-search-bar {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .chatx-docs-back {
      background: none;
      border: none;
      color: #374151;
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .chatx-docs-back:hover {
      background: #f3f4f6;
    }

    .chatx-docs-back svg {
      width: 20px;
      height: 20px;
    }

    .chatx-docs-search-input {
      flex: 1;
      padding: 12px 16px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      color: #374151;
      outline: none;
      transition: all 0.2s;
    }

    .chatx-docs-search-input:focus {
      background: white;
      border-color: #43a047;
      box-shadow: 0 0 0 3px rgba(67, 160, 71, 0.1);
    }

    .chatx-docs-search-input::placeholder {
      color: #9ca3af;
    }

    .chatx-docs-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px 16px;
      opacity: 0;
      animation: chatx-slide-up-fade 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards;
    }

    .chatx-docs-section-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 20px;
    }

    .chatx-docs-article-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .chatx-docs-article {
      display: block;
      padding: 16px 0;
      border-bottom: 1px solid #f3f4f6;
      cursor: pointer;
      transition: background 0.2s;
      opacity: 0;
      animation: chatx-slide-up-fade 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      text-decoration: none;
      color: inherit;
    }

    .chatx-docs-article:nth-child(1) { animation-delay: 0.15s; }
    .chatx-docs-article:nth-child(2) { animation-delay: 0.2s; }
    .chatx-docs-article:nth-child(3) { animation-delay: 0.25s; }
    .chatx-docs-article:nth-child(4) { animation-delay: 0.3s; }
    .chatx-docs-article:nth-child(5) { animation-delay: 0.35s; }
    .chatx-docs-article:nth-child(6) { animation-delay: 0.4s; }

    .chatx-docs-article:last-child {
      border-bottom: none;
    }

    .chatx-docs-article:hover {
      background: #f9fafb;
    }

    .chatx-docs-article-content {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .chatx-docs-article-text {
      flex: 1;
    }

    .chatx-docs-article-title {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 6px;
      line-height: 1.4;
    }

    .chatx-docs-article-desc {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .chatx-docs-article-arrow {
      color: #d1d5db;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .chatx-docs-article-arrow svg {
      width: 16px;
      height: 16px;
    }

    .chatx-docs-article:hover .chatx-docs-article-arrow {
      color: #43a047;
    }
    
    /* Tweaks to existing elements to fit new structure */
    .chatx-messages {
        /* When in chat view, it takes up full space */
    }
  `;

  // HTML Templates
  function createWidget() {
    const container = document.createElement('div');
    container.id = WIDGET_ID;
    // Icons - Material Symbols
    const ICONS = {
      home: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M240-200h147v-240h186v240h147v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H526v-240h-92v240H160Zm320-353ZM360-640h240q0-50-35-85t-85-35q-50 0-85 35t-35 85Z"/></svg>',
      docs: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg>',
      send: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v140l240 60-240 60v140Zm0 0v-400 400Z"/></svg>',
      close: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>',
      search: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>',
      chevronRight: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>',
      back: '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>'
    };

    container.innerHTML = `
      <style>${styles}</style>
      
      <button class="chatx-button" id="chatx-toggle">
        <!-- Default: Simple speech bubble (outline) -->
        <svg class="chatx-icon-default" xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
        </svg>
        <!-- Hover: Speech bubble with dots -->
        <svg class="chatx-icon-hover" xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          <circle cx="8" cy="10" r="1.5" fill="white"/>
          <circle cx="12" cy="10" r="1.5" fill="white"/>
          <circle cx="16" cy="10" r="1.5" fill="white"/>
        </svg>
        <!-- Open: Close X icon -->
        <svg class="chatx-icon-close" xmlns="http://www.w3.org/2000/svg" height="28" width="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <!-- Minimized Popup Notification -->
      <div class="chatx-mini-popup" id="chatx-mini-popup">
        <button class="chatx-mini-popup-close" id="chatx-mini-popup-close">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="chatx-mini-popup-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
            <path d="M7 9h10v2H7zm0-3h10v2H7z"/>
          </svg>
        </div>
        <div class="chatx-mini-popup-content">
          <div class="chatx-mini-popup-title">Live Chat Online</div>
          <div class="chatx-mini-popup-text">Click here and start chatting with us!</div>
        </div>
      </div>

      <div class="chatx-window" id="chatx-window">
        
        <!-- HOME VIEW -->
        <div class="chatx-home-view" id="chatx-home-view">
            <div class="chatx-home-header">
                <button class="chatx-close" id="chatx-home-close" style="position: absolute; right: 16px; top: 16px; color: #9ca3af;">
                    ${ICONS.close}
                </button>
                <div class="chatx-home-logo">
                    <img src="https://assets.thrivedesk.com/92c063c7e487440895a9d53fd8d771f7/images/2J5lBOdhnLUMXrC8lxUgyqdqdhezaovcdgrQvAME.png" alt="Company Logo">
                </div>
                <div class="chatx-home-greeting-large">Hi there \u{1F44B}</div>
                <div class="chatx-home-greeting-small">Ask us anything, or share your valuable feedback with us.</div>
                
            </div>

            <div class="chatx-home-card">
                <div class="chatx-home-card-title">Start a new chat</div>
                <div class="chatx-home-card-text">Our agents typically reply in a few seconds.</div>
                
                <div class="chatx-home-avatars" id="chatx-home-avatars">
                    <!-- Dynamic agent avatars will be loaded here -->
                </div>

                <button class="chatx-home-start-btn" id="chatx-home-start">
                    ${ICONS.send}
                    Start Live Chat
                </button>
            </div>

            <div class="chatx-home-help">
                <div class="chatx-home-search">
                    ${ICONS.search}
                    <input type="text" placeholder="Search our help center">
                </div>
                
                <div class="chatx-home-help-list">
                    <a class="chatx-home-help-item">
                        <span>How To Split Conversations</span>
                        ${ICONS.chevronRight}
                    </a>
                    <a class="chatx-home-help-item">
                        <span>Adding Custom Fields to Ticket</span>
                        ${ICONS.chevronRight}
                    </a>
                    <a class="chatx-home-help-item">
                        <span>Forward email to Inbox</span>
                        ${ICONS.chevronRight}
                    </a>
                    <a class="chatx-home-help-item">
                        <span>AppSumo</span>
                        ${ICONS.chevronRight}
                    </a>
                </div>
            </div>

            <div class="chatx-bottom-nav">
                <button class="chatx-nav-item active" id="chatx-nav-home">
                    ${ICONS.home}
                    <span>Home</span>
                </button>
                <button class="chatx-nav-item" id="chatx-nav-docs">
                    ${ICONS.docs}
                    <span>Docs</span>
                </button>
            </div>
        </div>

        <!-- DOCS VIEW -->
        <div class="chatx-docs-view chatx-view-hidden" id="chatx-docs-view">
            <div class="chatx-docs-header">
                <div class="chatx-docs-search-bar">
                    <button class="chatx-docs-back" id="chatx-docs-back">
                        ${ICONS.back}
                    </button>
                    <input type="text" class="chatx-docs-search-input" placeholder="Search our help center...">
                </div>
            </div>

            <div class="chatx-docs-content">
                <h2 class="chatx-docs-section-title">Browse Collection</h2>
                
                <div class="chatx-docs-article-list">
                    <div class="chatx-docs-article">
                        <div class="chatx-docs-article-content">
                            <div class="chatx-docs-article-text">
                                <div class="chatx-docs-article-title">How To Split Conversations</div>
                                <div class="chatx-docs-article-desc">The Split Conversation feature is designed to help support agents manage and organize customer communication more efficiently. When a single...</div>
                            </div>
                            <div class="chatx-docs-article-arrow">
                                ${ICONS.chevronRight}
                            </div>
                        </div>
                    </div>

                    <div class="chatx-docs-article">
                        <div class="chatx-docs-article-content">
                            <div class="chatx-docs-article-text">
                                <div class="chatx-docs-article-title">Adding Custom Fields to Ticket</div>
                                <div class="chatx-docs-article-desc">Custom Fields allow you to collect, organize and use additional data on your tickets (or conversations) beyond the standard fields...</div>
                            </div>
                            <div class="chatx-docs-article-arrow">
                                ${ICONS.chevronRight}
                            </div>
                        </div>
                    </div>

                    <div class="chatx-docs-article">
                        <div class="chatx-docs-article-content">
                            <div class="chatx-docs-article-text">
                                <div class="chatx-docs-article-title">Forward email to ThriveDesk Inbox with Cloudflare</div>
                                <div class="chatx-docs-article-desc">Cloudflare DNS alone cannot forward emails (DNS can only point mail to servers, not redirect it).But Cloudflare does provide Email...</div>
                            </div>
                            <div class="chatx-docs-article-arrow">
                                ${ICONS.chevronRight}
                            </div>
                        </div>
                    </div>

                    <div class="chatx-docs-article">
                        <div class="chatx-docs-article-content">
                            <div class="chatx-docs-article-text">
                                <div class="chatx-docs-article-title">AppSumo</div>
                                <div class="chatx-docs-article-desc">This guide will help you understand what's included in each tier, how to make the most of your deal, and...</div>
                            </div>
                            <div class="chatx-docs-article-arrow">
                                ${ICONS.chevronRight}
                            </div>
                        </div>
                    </div>

                    <div class="chatx-docs-article">
                        <div class="chatx-docs-article-content">
                            <div class="chatx-docs-article-text">
                                <div class="chatx-docs-article-title">Create a New Ticket</div>
                                <div class="chatx-docs-article-desc">Sometimes you may need to create a ticket on behalf of a customer - for example, when they call you...</div>
                            </div>
                            <div class="chatx-docs-article-arrow">
                                ${ICONS.chevronRight}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="chatx-bottom-nav">
                <button class="chatx-nav-item" id="chatx-docs-nav-home">
                    ${ICONS.home}
                    <span>Home</span>
                </button>
                <button class="chatx-nav-item active" id="chatx-docs-nav-docs">
                    ${ICONS.docs}
                    <span>Docs</span>
                </button>
            </div>
        </div>

        <!-- CHAT VIEW (Contains Header, Messages, Input, Prechat, etc) -->
        <div id="chatx-chat-view" class="chatx-view-hidden" style="display: flex; flex-direction: column; height: 100%;">
            <div class="chatx-header">
              <button class="chatx-header-back" id="chatx-chat-back">
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>
              </button>
              <div class="chatx-header-info">
                <div class="chatx-header-avatar" id="chatx-header-avatar">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
                    <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-164q-59 0-99.5-40.5T340-580q0-59 40.5-99.5T480-720q59 0 99.5 40.5T620-580q0 59-40.5 99.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q53 0 100-15.5t86-44.5q-39-29-86-44.5T480-280q-53 0-100 15.5T294-220q39 29 86 44.5T480-160Zm0-360q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm0-60Zm0 360Z"/>
                  </svg>
                </div>
                <div>
                  <div class="chatx-header-title">Chat Support</div>
                  <div class="chatx-header-status" id="chatx-status">We're here to help</div>
                </div>
              </div>
              <button class="chatx-end-chat" id="chatx-end-chat" style="display:none;">End Chat</button>
              <button class="chatx-close" id="chatx-close">
                <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
                  <path d="M240-440v-80h480v80H240Z"/>
                </svg>
              </button>
            </div>
    
            <div class="chatx-prechat" id="chatx-prechat">
              <div class="chatx-prechat-header">
                <p>Welcome to our LiveChat! Please fill in the form below before starting the chat</p>
              </div>
              <div class="chatx-prechat-form">
                <div class="chatx-prechat-field">
                  <input type="text" id="chatx-name" placeholder="Your Name" required>
                </div>
                <div class="chatx-prechat-field">
                  <input type="email" id="chatx-email" placeholder="Your Email" required>
                </div>
                <div class="chatx-prechat-field">
                  <div class="chatx-dropdown" id="chatx-dept-dropdown">
                    <input type="hidden" id="chatx-department" value="">
                    <button type="button" class="chatx-dropdown-toggle" id="chatx-dept-toggle">
                      <span id="chatx-dept-text">Chat Department</span>
                      <svg class="chatx-dropdown-arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 8l4 4 4-4"/>
                      </svg>
                    </button>
                    <div class="chatx-dropdown-menu" id="chatx-dept-menu">
                      <!-- Departments will be loaded dynamically -->
                    </div>
                  </div>
                </div>
                <div class="chatx-prechat-field">
                  <textarea id="chatx-initial-message" placeholder="Your Message"></textarea>
                </div>
                <div class="chatx-prechat-error" id="chatx-prechat-error" style="display:none;"></div>
                <button class="chatx-prechat-submit" id="chatx-start">Start The Chat</button>
              </div>
            </div>
    
            <div class="chatx-offline-request" id="chatx-offline-request" style="display:none;">
              <div class="chatx-prechat-header">
                <p>All agents are currently offline. Please leave your message and we'll get back to you shortly.</p>
              </div>
              <div class="chatx-offline-form" id="chatx-offline-form">
                <div class="chatx-offline-field">
                  <input type="text" class="chatx-offline-input" id="chatx-offline-name" placeholder="Your Name" required>
                </div>
                <div class="chatx-offline-field">
                  <input type="email" class="chatx-offline-input" id="chatx-offline-email" placeholder="Your Email" required>
                </div>
                <div class="chatx-offline-field">
                  <input type="text" class="chatx-offline-input" id="chatx-offline-subject" placeholder="Subject" required>
                </div>
                <div class="chatx-offline-field">
                  <textarea class="chatx-offline-textarea" id="chatx-offline-message" placeholder="Your Message" required></textarea>
                </div>
                <div class="chatx-offline-error" id="chatx-offline-error"></div>
                <button class="chatx-offline-submit" id="chatx-offline-submit">Send Request</button>
              </div>
              <div class="chatx-offline-thankyou" id="chatx-offline-thankyou" style="display:none;">
                <div class="chatx-offline-thankyou-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${PRIMARY_COLOR}" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <h3 class="chatx-offline-thankyou-title">Thank You!</h3>
                <p class="chatx-offline-thankyou-message">We received your message and will respond to you shortly via email.</p>
                <button class="chatx-offline-goback" id="chatx-offline-goback">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                  Go Back
                </button>
              </div>
            </div>
    
            <div class="chatx-whmcs-login" id="chatx-whmcs-login" style="display:none;">
              <div class="chatx-whmcs-header">
                <div class="chatx-whmcs-subtitle">Welcome to our LiveChat! Please login to your ExonHost account before starting the chat with Support Team.</div>
              </div>
    
              <div class="chatx-whmcs-form">
                <div class="chatx-whmcs-field">
                  <label class="chatx-whmcs-label" for="chatx-whmcs-email">Email:</label>
                  <input type="email" class="chatx-whmcs-input" id="chatx-whmcs-email" placeholder="Enter your Portal email" required>
                </div>
                <div class="chatx-whmcs-field">
                  <label class="chatx-whmcs-label" for="chatx-whmcs-password">Password:</label>
                  <input type="password" class="chatx-whmcs-input" id="chatx-whmcs-password" placeholder="Enter your Portal password" required>
                </div>
                <div class="chatx-whmcs-error" id="chatx-whmcs-error" style="display:none;"></div>
                <button class="chatx-whmcs-submit" id="chatx-whmcs-submit">
                  <span id="chatx-whmcs-submit-text">Login</span>
                </button>
                <button class="chatx-whmcs-back" id="chatx-whmcs-back" type="button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                  Go Back
                </button>
              </div>
            </div>
    
            <div class="chatx-messages" id="chatx-messages" style="display:none;">
            </div>
    
            <div class="chatx-footer" id="chatx-footer" style="display:none;">
              <div class="chatx-input-area" id="chatx-input-area">
                <input type="file" class="chatx-file-input" id="chatx-file-input" accept=".jpg,.jpeg,.png" />
                <button class="chatx-file-upload" id="chatx-file-upload" type="button">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#1f1f1f"><path d="M330-240q-104 0-177-73T80-490q0-104 73-177t177-73h370q75 0 127.5 52.5T880-560q0 75-52.5 127.5T700-380H350q-46 0-78-32t-32-78q0-46 32-78t78-32h370v80H350q-13 0-21.5 8.5T320-490q0 13 8.5 21.5T350-460h350q42-1 71-29.5t29-70.5q0-42-29-71t-71-29H330q-71-1-120.5 49T160-490q0 70 49.5 119T330-320h390v80H330Z"/></svg>
                </button>
                <div class="chatx-emoji-container">
                  <button class="chatx-emoji-btn" id="chatx-emoji-btn" type="button">
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#666"><path d="M620-520q25 0 42.5-17.5T680-580q0-25-17.5-42.5T620-640q-25 0-42.5 17.5T560-580q0 25 17.5 42.5T620-520Zm-280 0q25 0 42.5-17.5T400-580q0-25-17.5-42.5T340-640q-25 0-42.5 17.5T280-580q0 25 17.5 42.5T340-520Zm140 260q68 0 123.5-38.5T684-400H276q25 63 80.5 101.5T480-260Zm0 180q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Z"/></svg>
                  </button>
                  <div class="chatx-emoji-picker" id="chatx-emoji-picker" style="display:none;"></div>
                </div>
                <textarea class="chatx-input" id="chatx-input" placeholder="Type a message..." rows="1"></textarea>
                <button class="chatx-send" id="chatx-send" disabled>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
              <div class="chatx-powered" id="chatx-powered">
                <span>Powered by</span>
                <img src="https://www.purpleit.com/wp-content/uploads/2020/11/cropped-logo-1-150x46.png" alt="Purple IT">
              </div>
            </div>
    
            <div class="chatx-chat-ended" id="chatx-chat-ended" style="display:none;">
              <div class="chatx-chat-ended-info" id="chatx-chat-ended-info"></div>
              <div class="chatx-rating-title">Rate This Conversation!</div>
              <div class="chatx-rating-subtitle">Please click on one of the options below to rate your experience.</div>
              <div class="chatx-rating-buttons">
                <button class="chatx-rating-btn positive" id="chatx-rating-positive" data-rating="1">
                  <svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
                  <span class="chatx-rating-label">Good</span>
                </button>
                <button class="chatx-rating-btn negative" id="chatx-rating-negative" data-rating="0">
                  <svg viewBox="0 0 24 24"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
                  <span class="chatx-rating-label">Bad</span>
                </button>
              </div>
              <textarea class="chatx-rating-comment" id="chatx-rating-comment" placeholder="Leave a comment (optional)" rows="3" style="display:none;"></textarea>
              <button class="chatx-rating-submit" id="chatx-rating-submit" disabled style="display:none;">Submit Rating</button>
              <div class="chatx-rating-success" id="chatx-rating-success" style="display:none;">Review submitted successfully!</div>
              <div class="chatx-rating-actions">
                <button class="chatx-transcript-btn" id="chatx-transcript">Send Transcript</button>
                <span class="chatx-rating-or">OR</span>
                <button class="chatx-new-chat-btn" id="chatx-new-chat">Start New Chat</button>
              </div>
            </div>
        </div>
      </div>
    `;

    // Load Material Symbols font via link tag (more reliable than @import)
    if (!document.querySelector('link[href*="Material+Symbols+Outlined"]')) {
      const fontLink = document.createElement('link');
      fontLink.rel = 'stylesheet';
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
      document.head.appendChild(fontLink);
    }

    document.body.appendChild(container);

    // Initial State: Show Home
    showHome();

    bindNewEvents();
    // Legacy bindEvents might be called elsewhere or we might need it for existing chat functionality
    // If bindEvents() is defined later, we should potentially call it if it binds socket events.
    // But we are rewiring UI events.
    if (typeof bindEvents === 'function') bindEvents();

    // Initialize forms to correct state
    initializeForms();

    // Connect socket on page load to check for active chats
    // This allows auto-opening the widget if there's an active chat
    connectSocket();
  }

  // --- View Helper Functions ---

  function updateHomeButtonText(isOnline) {
    const btn = document.getElementById('chatx-home-start');
    if (!btn) return;

    // We can reuse the existing icon or just update the text node
    // The button HTML is: <button ...>${ICONS.send} Text</button>
    // So we should preserve the icon.

    // Simple way: re-set innerHTML with the icon and new text
    const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';

    if (isOnline) {
      btn.innerHTML = `${icon} Start Live Chat`;
    } else {
      btn.innerHTML = `${icon} Send us a message`;
    }
  }

  // Update chat button icon based on widget state
  function updateChatButtonIcon(isWidgetOpen) {
    const button = document.getElementById('chatx-toggle');
    const miniPopup = document.getElementById('chatx-mini-popup');
    if (!button) return;

    // Use class-based icon switching instead of replacing innerHTML
    if (isWidgetOpen) {
      button.classList.add('chatx-open');
      // Hide mini popup when widget opens
      if (miniPopup) {
        miniPopup.classList.remove('show');
      }
    } else {
      button.classList.remove('chatx-open');
    }

    // Update isOpen state
    isOpen = isWidgetOpen;
  }


  function showHome() {
    const homeView = document.getElementById('chatx-home-view');
    const chatView = document.getElementById('chatx-chat-view');
    const docsView = document.getElementById('chatx-docs-view');

    if (homeView && chatView) {
      homeView.classList.remove('chatx-view-hidden');
      chatView.classList.add('chatx-view-hidden');
      if (docsView) docsView.classList.add('chatx-view-hidden');

      // Clear history when going home
      viewHistory = [];
    }
  }

  function showPrechat() {
    // Don't show prechat form if there's an active chat - keep showing the chat
    if (chatId && (currentChatStatus === 'active' || currentChatStatus === 'pending')) {
      //console.log('ChatX: showPrechat blocked - active chat in progress');
      showChat(); // Show the chat view instead
      return;
    }

    const homeView = document.getElementById('chatx-home-view');
    const chatView = document.getElementById('chatx-chat-view');
    const docsView = document.getElementById('chatx-docs-view');

    if (homeView && chatView) {
      homeView.classList.add('chatx-view-hidden');
      chatView.classList.remove('chatx-view-hidden');
      if (docsView) docsView.classList.add('chatx-view-hidden');

      // Add to history if coming from home
      if (viewHistory.length === 0 || viewHistory[viewHistory.length - 1] !== 'prechat') {
        viewHistory.push('prechat');
      }

      // Show Prechat Form specifically within Chat View
      showPrechatForm();

      // Check offline status to ensure correct form is shown
      checkIfAllDepartmentsOffline();
    }
  }

  // Smart back button - goes to previous view based on history
  function goBack() {
    // Check if WHMCS login is visible
    const whmcsLogin = document.getElementById('chatx-whmcs-login');
    const prechat = document.getElementById('chatx-prechat');

    if (whmcsLogin && whmcsLogin.style.display !== 'none') {
      // If on WHMCS login, go back to prechat form
      whmcsLogin.style.display = 'none';
      if (prechat) {
        prechat.style.display = 'block';
      }
      return;
    }

    // If on prechat form or in chat view, go back to home
    if (viewHistory.length > 0) {
      viewHistory.pop(); // Remove current view
    }
    showHome();
  }

  function showChat() {
    const homeView = document.getElementById('chatx-home-view');
    const chatView = document.getElementById('chatx-chat-view');
    const docsView = document.getElementById('chatx-docs-view');

    if (homeView && chatView) {
      homeView.classList.add('chatx-view-hidden');
      chatView.classList.remove('chatx-view-hidden');
      if (docsView) docsView.classList.add('chatx-view-hidden');

      // Hide prechat, show messages
      document.getElementById('chatx-prechat').style.display = 'none';
      document.getElementById('chatx-messages').style.display = 'block';
      document.getElementById('chatx-footer').style.display = 'block';
    }
  }

  function showDocs() {
    const homeView = document.getElementById('chatx-home-view');
    const chatView = document.getElementById('chatx-chat-view');
    const docsView = document.getElementById('chatx-docs-view');

    if (homeView && docsView) {
      homeView.classList.add('chatx-view-hidden');
      docsView.classList.remove('chatx-view-hidden');
      if (chatView) chatView.classList.add('chatx-view-hidden');
    }
  }

  function bindNewEvents() {
    // Home Screen Events
    document.getElementById('chatx-home-start')?.addEventListener('click', showPrechat);

    // Bottom nav - Home view
    document.getElementById('chatx-nav-home')?.addEventListener('click', showHome);
    document.getElementById('chatx-nav-docs')?.addEventListener('click', showDocs);

    // Docs view events
    document.getElementById('chatx-docs-back')?.addEventListener('click', showHome);
    document.getElementById('chatx-docs-nav-home')?.addEventListener('click', showHome);
    document.getElementById('chatx-docs-nav-docs')?.addEventListener('click', showDocs);

    // Search input handlers
    const homeSearchInput = document.querySelector('.chatx-home-search input');
    if (homeSearchInput) {
      homeSearchInput.addEventListener('input', (e) => {
        searchHelpArticles(e.target.value);
      });
    }

    const docsSearchInput = document.querySelector('.chatx-docs-search-input');
    if (docsSearchInput) {
      docsSearchInput.addEventListener('input', (e) => {
        searchHelpArticles(e.target.value);
      });
    }

    // Chat view back button - smart navigation
    document.getElementById('chatx-chat-back')?.addEventListener('click', goBack);

    // Toggle button - open/close widget
    document.getElementById('chatx-toggle')?.addEventListener('click', () => {
      const widgetWindow = document.getElementById('chatx-window');
      if (!widgetWindow) return;

      if (widgetWindow.classList.contains('open')) {
        // Close widget
        widgetWindow.classList.add('closing');
        setTimeout(() => {
          widgetWindow.classList.remove('open', 'closing');
          widgetWindow.style.display = 'none';
          updateChatButtonIcon(false);
        }, 200);
      } else {
        // Open widget
        widgetWindow.style.display = 'flex';
        // Small delay to allow display change to take effect before animation
        setTimeout(() => {
          widgetWindow.classList.add('open');
          updateChatButtonIcon(true);
        }, 10);
      }
    });

    document.getElementById('chatx-home-close')?.addEventListener('click', () => {
      const widgetWindow = document.getElementById('chatx-window');
      if (!widgetWindow) return;

      widgetWindow.classList.add('closing');
      setTimeout(() => {
        widgetWindow.classList.remove('open', 'closing');
        widgetWindow.style.display = 'none';
        updateChatButtonIcon(false);
      }, 200);
    });
  }

  // Socket.IO connection
  function connectSocket() {
    if (socket && isConnected) return;

    // Load Socket.IO client
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.onload = () => {
      socket = io(SERVER_URL + '/chat', {
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        isConnected = true;
        //console.log('ChatX: Connected to server with sessionId:', sessionId);

        // Register visitor with persistent sessionId
        // Server will check database for any active chats for this visitor
        socket.emit('visitor:connect', {
          sessionId: sessionId,
          currentPage: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
        });

        // Request departments list after connecting
        socket.emit('departments:get');
        //console.log('ChatX: Requesting departments');

        // Fetch online agents for home page avatars via HTTP API
        fetchAgentAvatars();

        // Start polling agent status every second
        startAgentStatusPolling();
      });

      socket.on('disconnect', () => {
        isConnected = false;
        ////console.log('ChatX: Disconnected from server');

        // Stop polling when disconnected
        stopAgentStatusPolling();
      });

      socket.on('visitor:connected', (data) => {
        visitorId = data.visitor.id;
        //console.log('ChatX: Visitor registered with ID:', visitorId);
        //console.log('ChatX: Now listening for messages:read events on visitor room');

        // Set a fallback timeout - if chats:history is not received within 2 seconds,
        // mark initial state as loaded anyway (new visitors won't receive chats:history)
        setTimeout(() => {
          if (!initialStateLoaded) {
            //console.log('ChatX: No chat history received, marking initial state as loaded');
            initialStateLoaded = true;
          }
        }, 2000);
      });

      socket.on('chat:started', (chat) => {
        chatId = chat.id;
        currentChatStatus = chat.status || 'pending';
        agentJoined = false;
        showChatArea();
        showQueueStatus();
        startAgentJoinMonitoring(); // Start monitoring for agent join events
        //console.log('ChatX: Chat started', chatId, currentChatStatus);

        // If chat has initial messages from server, show them (this includes our initial message)
        if (chat.messages && chat.messages.length > 0) {
          chat.messages.forEach(msg => addMessage(msg));
          // Clear pending message since server already sent it back
          window.chatxPendingInitialMessage = null;
        }
      });

      // Listen for queue/pending chats updates
      socket.on('chats:pending', (chats) => {
        ////console.log('ChatX: Received pending chats count:', chats?.length || 0);
        if (chats && Array.isArray(chats)) {
          pendingChatsCount = chats.length;
          // Calculate this user's position in queue
          const userChatIndex = chats.findIndex(c => c.id === chatId);
          if (userChatIndex !== -1) {
            userQueuePosition = userChatIndex + 1;
            ////console.log('ChatX: User queue position:', userQueuePosition);
            // Update queue status if visible
            if (currentChatStatus === 'pending' && !agentJoined) {
              showQueueStatus();
            }
          }
        }
      });

      // Handle chat history from database - restore active/pending chats
      socket.on('chats:history', (chats) => {
        //console.log('ChatX: Received chat history from database:', chats?.length || 0, 'chats');

        // Mark initial state as loaded - this allows offline detection to proceed
        initialStateLoaded = true;

        if (chats && chats.length > 0) {
          // Log all chat statuses for debugging
          //console.log('ChatX: Chat statuses:', chats.map(c => ({ id: c.id, status: c.status })));

          // Find any chat that is NOT closed (active, pending, or any other non-closed status)
          const activeChat = chats.find(c => c.status !== 'closed');

          if (activeChat) {
            //console.log('ChatX: Restoring chat from database:', activeChat.id, 'Status:', activeChat.status);
            //console.log('ChatX: Agent join events:', activeChat.agentJoinEvents);
            isRestoringSession = true;

            // Update state
            chatId = activeChat.id;
            currentChatStatus = activeChat.status;

            // Restore visitor info for transcript feature
            if (activeChat.visitor) {
              window.chatxVisitorName = activeChat.visitor.name || 'Visitor';
              window.chatxVisitorEmail = activeChat.visitor.email;
            }

            // Clear any existing messages and restore from server
            messages = [];
            const container = document.getElementById('chatx-messages');
            if (container) {
              container.innerHTML = '';
            }

            // Join the chat room
            socket.emit('chat:rejoin', {
              chatId: activeChat.id,
              sessionId: sessionId
            });

            // Restore agent info first (for header)
            if (activeChat.agent) {
              window.chatxCurrentAgent = activeChat.agent;
              updateHeaderAvatar(activeChat.agent);

              const statusEl = document.getElementById('chatx-status');
              if (statusEl) {
                statusEl.textContent = activeChat.agent.name + ' is here to help';
              }
            }

            // Restore messages and agent join events in chronological order
            if (activeChat.messages && activeChat.messages.length > 0) {
              // Create a timeline combining messages and agent join events
              const timeline = [];

              // Add messages to timeline
              activeChat.messages.forEach(msg => {
                timeline.push({
                  type: 'message',
                  timestamp: new Date(msg.createdAt).getTime(),
                  data: msg
                });
              });

              // Add agent join events to timeline (from database)
              if (activeChat.agentJoinEvents && activeChat.agentJoinEvents.length > 0) {
                activeChat.agentJoinEvents.forEach(event => {
                  timeline.push({
                    type: 'agent_joined',
                    timestamp: new Date(event.joinedAt).getTime(),
                    data: {
                      agentId: event.agentId,
                      agentName: event.agentName,
                      joinedAt: event.joinedAt
                    }
                  });
                });
              }

              // Sort timeline by timestamp
              timeline.sort((a, b) => a.timestamp - b.timestamp);

              // Track which agents we've shown joined notifications for
              const shownAgentJoins = new Set();

              // Render timeline in chronological order
              timeline.forEach(item => {
                if (item.type === 'message') {
                  addMessage(item.data, true);

                  // Update header to reflect the agent of the current message
                  // This ensures that after a transfer, the header shows the NEW agent (if they spoke),
                  // rather than remaining stuck on the first agent.
                  if (item.data.senderType === 'agent' && item.data.agent) {
                    window.chatxCurrentAgent = item.data.agent;
                    updateHeaderAvatar(item.data.agent);
                    const statusEl = document.getElementById('chatx-status');
                    if (statusEl) {
                      statusEl.textContent = item.data.agent.name + ' is here to help';
                    }
                  }
                } else if (item.type === 'agent_joined') {
                  // Show agent joined notification if not already shown for this agent
                  if (!shownAgentJoins.has(item.data.agentId)) {
                    shownAgentJoins.add(item.data.agentId);
                    // Create agent object for showAgentJoined
                    const agentInfo = {
                      id: item.data.agentId,
                      name: item.data.agentName,
                      avatar: activeChat.agent?.id === item.data.agentId ? activeChat.agent.avatar : null
                    };
                    showAgentJoined(agentInfo, false);
                  }
                }
              });
            } else if (activeChat.agent) {
              // No messages but agent assigned, show agent joined
              showAgentJoined(activeChat.agent, false);
            }

            // Show chat area
            showChatArea();

            // Explicitly switch to Chat View (hide Home View)
            const homeView = document.getElementById('chatx-home-view');
            const chatView = document.getElementById('chatx-chat-view');
            const docsView = document.getElementById('chatx-docs-view');

            if (homeView && chatView) {
              homeView.classList.add('chatx-view-hidden');
              chatView.classList.remove('chatx-view-hidden');
              if (docsView) docsView.classList.add('chatx-view-hidden');
              // Update history to reflect we are in chat
              viewHistory = ['prechat', 'chat'];
            }

            // Show queue status if pending
            if (activeChat.status === 'pending') {
              showQueueStatus();
            }

            // Always start monitoring to handle missing agent join events or status updates
            startAgentJoinMonitoring();

            // Auto-open widget if chat is active or pending
            if ((activeChat.status === 'active' || activeChat.status === 'pending') && !isOpen) {
              setTimeout(() => {
                const widgetWindow = document.getElementById('chatx-window');
                // Ensure display is flex before animating
                if (widgetWindow) {
                  widgetWindow.style.display = 'flex';
                  // Open animation
                  setTimeout(() => {
                    openWidget();
                  }, 50);
                } else {
                  openWidget();
                }
              }, 500);
            }

            isRestoringSession = false;
            //console.log('ChatX: Session restored successfully from database');
          } else {
            //console.log('ChatX: All chats are closed, showing pre-chat form');
          }
        }
      });

      // Handle chat rejoin response
      socket.on('chat:rejoined', (data) => {
        //console.log('ChatX: Successfully rejoined chat:', data);
        if (data.success && data.chat) {
          // Update state with server response
          chatId = data.chat.id;
          currentChatStatus = data.chat.status;

          // Update UI based on chat status
          if (data.chat.status === 'active' && data.chat.agent) {
            window.chatxCurrentAgent = data.chat.agent;
            updateHeaderAvatar(data.chat.agent);

            const statusEl = document.getElementById('chatx-status');
            if (statusEl) {
              statusEl.textContent = data.chat.agent.name + ' is here to help';
            }
          }

          //console.log('ChatX: Chat rejoined successfully');
        }
      });

      socket.on('chat:agent-assigned', (chat) => {
        //console.log('ChatX: Agent assigned event received for chat:', chat?.id);

        // Check if this event is for the current chat
        if (chatId !== chat?.id) {
          return;
        }

        // Update chat status to active
        currentChatStatus = 'active';

        // Ensure chat area is visible
        const messagesContainer = document.getElementById('chatx-messages');

        if (messagesContainer && messagesContainer.style.display === 'none') {
          //console.log('ChatX: Showing chat area for agent assignment');
          showChatArea();

          // After showing chat area, ensure agent joined is displayed if we have agent info
          setTimeout(() => {
            if (chat.agent && !agentJoined) {
              //console.log('ChatX: Showing agent joined after chat area is visible');
              showAgentJoined(chat.agent, true);
            }
          }, 50);
        }

        const statusEl = document.getElementById('chatx-status');
        if (chat.agent) {
          // Update header status
          if (statusEl) {
            statusEl.textContent = chat.agent.name + ' is here to help';
          }

          // Update header avatar with agent's photo
          updateHeaderAvatar(chat.agent);

          // Store current agent info globally
          window.chatxCurrentAgent = chat.agent;
          window.chatxCurrentChat = chat;

          // Update any existing agent messages with correct name
          const existingAgentMessages = document.querySelectorAll('.chatx-message.agent .chatx-message-sender');
          existingAgentMessages.forEach(senderEl => {
            if (senderEl.textContent.includes('Agent')) {
              senderEl.innerHTML = `${escapeHtml(chat.agent.name)} <span class="chatx-staff-badge">Staff</span>`;
            }
          });

          // Show agent joined notification immediately
          //console.log('ChatX: Triggering agent joined notification:', chat.agent.name);
          setTimeout(() => {
            showAgentJoined(chat.agent, true);
          }, 50);
        }
      });

      // Additional backup listener for chat status changes
      socket.on('chat:status-changed', (data) => {
        if (data.chatId === chatId && data.status === 'active' && data.agent && !agentJoined) {
          // Update chat status to active
          currentChatStatus = 'active';

          // Update header
          const statusEl = document.getElementById('chatx-status');
          if (statusEl) {
            statusEl.textContent = data.agent.name + ' is here to help';
          }

          // Update header avatar
          updateHeaderAvatar(data.agent);

          // Store agent info
          window.chatxCurrentAgent = data.agent;

          // Show agent joined notification
          showAgentJoined(data.agent, true);
        }
      });

      // Handle chat status response from polling
      socket.on('chat:status:response', (data) => {
        if (data.chatId === chatId && data.chat) {
          // If chat has an agent and we haven't shown the notification yet
          if (data.chat.agent && !agentJoined) {
            //console.log('ChatX: Agent found via status poll:', data.chat.agent.name);

            // Update status
            currentChatStatus = data.chat.status;

            // Store agent info
            window.chatxCurrentAgent = data.chat.agent;
            window.chatxCurrentChat = data.chat;

            // Update header
            const statusEl = document.getElementById('chatx-status');
            if (statusEl) {
              statusEl.textContent = data.chat.agent.name + ' is here to help';
            }

            // Update avatar
            updateHeaderAvatar(data.chat.agent);

            // Show agent joined notification
            showAgentJoined(data.chat.agent, true);
          }
        }
      });

      // Handle messages poll response - sync messages from server
      socket.on('messages:poll:response', (data) => {
        if (data.chatId === chatId) {
          // Check for agent assignment
          if (data.agent && !agentJoined) {
            //console.log('ChatX: Agent found via messages poll:', data.agent.name);

            // Update status
            currentChatStatus = data.status || 'active';

            // Store agent info
            window.chatxCurrentAgent = data.agent;

            // Update header
            const statusEl = document.getElementById('chatx-status');
            if (statusEl) {
              statusEl.textContent = data.agent.name + ' is here to help';
            }

            // Update avatar
            updateHeaderAvatar(data.agent);

            // Show agent joined notification
            showAgentJoined(data.agent, true);
          }

          // Sync any new messages we might have missed
          if (data.messages && data.messages.length > 0) {
            const container = document.getElementById('chatx-messages');
            data.messages.forEach(msg => {
              // Check if message already exists in DOM
              const existingMsg = container.querySelector(`[data-msg-id="${msg.id}"]`);
              if (!existingMsg && msg.id) {
                // Check if this message is already in our local array
                const alreadyHave = messages.find(m => m.id === msg.id);
                if (!alreadyHave) {
                  //console.log('ChatX: Adding missed message:', msg.id);
                  addMessage(msg, true);
                }
              }
            });
          }
        }
      });

      socket.on('message:new', (message) => {
        //console.log('ChatX: Received message:new', message.id, message.senderType, message.content?.substring(0, 30));
        if (message.chatId === chatId) {
          // Update agent info if message contains agent data
          if (message.senderType === 'agent' && message.agent) {
            window.chatxCurrentAgent = message.agent;

            // Update header status if agent name is different
            const statusEl = document.getElementById('chatx-status');
            if (statusEl && !statusEl.textContent.includes(message.agent.name)) {
              statusEl.textContent = message.agent.name + ' is here to help';
            }

            // Update header avatar with agent's photo
            updateHeaderAvatar(message.agent);

            // Check if we need to show agent joined notification
            // This is a fallback since chat:agent-assigned event might not be working
            const container = document.getElementById('chatx-messages');
            const hasAgentJoined = container && container.querySelector('.chatx-agent-joined');
            const hasOtherAgentMessages = container && container.querySelectorAll('.chatx-message.agent').length > 0;

            if (!hasAgentJoined && !hasOtherAgentMessages) {
              ////console.log('ChatX: First agent message received, showing agent joined notification');
              ////console.log('ChatX: Agent from message:', message.agent);

              // Show agent joined notification since the event didn't work
              showAgentJoined(message.agent, true);

              // Update chat status to active
              currentChatStatus = 'active';
            }
          }

          addMessage(message);
          // Play notification sound for agent messages
          if (message.senderType === 'agent') {
            playNotificationSound();

            // If widget is open and visible, mark message as read immediately
            if (isOpen) {
              setTimeout(() => {
                markChatMessagesAsRead();
              }, 500); // Small delay to ensure message is added to array
            }

            // Add pulse animation to button if widget is closed
            if (!isOpen) {
              const button = document.getElementById('chatx-toggle');
              if (button) {
                button.classList.add('chatx-button-pulse');
                // Also add a shake animation for attention
                button.classList.add('chatx-button-shake');
                setTimeout(() => {
                  button.classList.remove('chatx-button-shake');
                }, 600);
              }
            }
          }
        }
      });

      socket.on('messages:read', (data) => {
        //console.log('ChatX: Received messages:read event:', data);
        if (data.chatId === chatId) {
          if (data.readBy === 'agent') {
            // Agent read our (visitor's) messages - update visitor message status
            //console.log('ChatX: Agent read our messages, updating status');
            if (data.messageIds && data.messageIds.length > 0) {
              updateMessageReadStatus(data.messageIds);
            } else {
              // If no specific messageIds, mark all visitor messages as read
              //console.log('ChatX: No specific messageIds, marking all visitor messages as read');
              const visitorMsgs = messages.filter(m => m.senderType === 'visitor' && !m.isRead);
              if (visitorMsgs.length > 0) {
                updateMessageReadStatus(visitorMsgs.map(m => m.id).filter(Boolean));
              }
            }
          } else if (data.readBy === 'visitor') {
            // We (visitor) read agent's messages - this is our own confirmation
            //console.log('ChatX: Confirmation that we read agent messages');
          } else if (data.all) {
            // Mark all messages as read (legacy support)
            //console.log('ChatX: Marking all visitor messages as read (all flag)');
            const allStatuses = document.querySelectorAll('.chatx-message.visitor .chatx-message-status');
            allStatuses.forEach(statusElement => {
              statusElement.classList.add('read');
              statusElement.textContent = 'done_all';
            });
            // Update messages array
            messages.forEach(msg => {
              if (msg.senderType === 'visitor') {
                msg.isRead = true;
              }
            });
          } else if (data.messageIds) {
            // Generic message IDs without readBy (legacy support)
            //console.log('ChatX: Generic messageIds update (legacy)');
            updateMessageReadStatus(data.messageIds);
          }
        }
      });

      socket.on('typing:start', (data) => {
        if (data.chatId === chatId && data.userType === 'agent') {
          showTypingIndicator();
        }
      });

      socket.on('typing:stop', () => {
        hideTypingIndicator();
      });

      // Handle agent joining the chat
      socket.on('agent:joined-chat', (data) => {
        if (data.chatId === chatId && data.agentName) {
          //console.log('ChatX: Agent joined chat:', data);
          addSystemMessage(`${data.agentName} joined the chat`);
        }
      });

      // Handle chat transfer accepted
      socket.on('chat:transfer-accepted', (data) => {
        if (data.chatId === chatId) {
          //console.log('ChatX: Chat transferred:', data);
          addSystemMessage(`Chat transferred from ${data.fromAgentName} to ${data.targetAgentName}`);
        }
      });

      // Handle auto-transfer (when agent doesn't respond in time)
      socket.on('chat:auto-transfer', (data) => {
        if (data.chatId === chatId) {
          //console.log('ChatX: Auto-transfer:', data);
          addSystemMessage(data.message || 'Your chat is being transferred to another agent. Please wait while they join the conversation.');
        }
      });

      // Handle chat becoming inactive due to inactivity
      socket.on('chat:inactive', (data) => {
        if (data.chatId === chatId) {
          //console.log('ChatX: Chat marked as inactive:', data);
          addIdleSystemMessage('Chat is idle due to inactivity. It will auto-close if no new message arrives.');
        }
      });

      // Handle user idle warning (visitor inactivity) - plays notification sound
      socket.on('chat:idle-warning', (data) => {
        if (data.chatId === chatId) {
          //console.log('ChatX: Idle warning received:', data);
          // Play notification sound if enabled
          if (data.playSound) {
            playIdleWarningSound();
          }
        }
      });

      socket.on('chat:closed', (data) => {
        //console.log('ChatX: Chat closed', data);
        // Store the chat ID before clearing it
        const closedChatId = chatId || data.chatId;
        window.chatxClosedChatId = closedChatId;

        currentChatStatus = 'closed';
        chatId = null;

        // If visitor already ended the chat, don't overwrite their "ended by You" message
        if (window.chatxVisitorEndedChat) {
          window.chatxVisitorEndedChat = false; // Reset flag
          return;
        }

        showChatEnded(data.agent || window.chatxCurrentAgent);
      });

      socket.on('connect_error', (error) => {
        console.error('ChatX: Connection error', error);
      });

      // Load departments
      socket.on('departments:list', (departments) => {
        ////console.log('ChatX: Departments received', departments);
        handleDepartmentAvailabilityChange(departments);
      });

      // Handle real-time department availability updates
      socket.on('departments:availability-update', (departments) => {
        ////console.log('ChatX: Department availability updated (real-time)', departments);
        ////console.log('ChatX: Current department menu element exists:', !!document.getElementById('chatx-dept-menu'));
        handleDepartmentAvailabilityChange(departments);
      });

      // Real-time ban notification: admin banned this visitor while chatting
      socket.on('visitor:banned', (data) => {
        disableChatInputForBan({
          reason: data && data.reason,
          banType: data && data.banType,
          banExpiresAt: data && data.banExpiresAt,
        });
      });
    }; // Close script.onload arrow function
    document.head.appendChild(script);
  }

  // Handle department availability changes with debouncing for offline detection
  function handleDepartmentAvailabilityChange(depts) {
    //console.log('ChatX: handleDepartmentAvailabilityChange', { chatId, currentChatStatus, initialStateLoaded, depts: depts?.map(d => ({ name: d.name, online: d.online })) });
    const hasOnlineDepartments = depts?.some(d => d.online);

    // Always render departments immediately (UI should update)
    renderDepartments(depts);

    // If agents are now online
    if (hasOnlineDepartments) {
      // Clear any pending offline check
      if (offlineCheckTimeoutId) {
        clearTimeout(offlineCheckTimeoutId);
        offlineCheckTimeoutId = null;
      }

      // If we were showing offline form and agents are back online, auto-recover
      if (!lastOnlineState && initialStateLoaded) {
        //console.log('ChatX: Agents back online - auto-recovering');
        lastOnlineState = true;

        // Only switch view if we're not in an active chat
        if (!chatId || (currentChatStatus !== 'active' && currentChatStatus !== 'pending')) {
          const preChatForm = document.getElementById('chatx-prechat');
          const offlineForm = document.getElementById('chatx-offline-request');
          if (preChatForm) preChatForm.style.display = 'flex';
          if (offlineForm) offlineForm.style.display = 'none';
          updateHomeButtonText(true);
        }
      }
    } else {
      // All agents offline - debounce before showing offline form
      // This prevents flicker when agents briefly disconnect (e.g., page refresh)
      // Also wait for initial state to be loaded to avoid race conditions with chat restoration
      if (!offlineCheckTimeoutId) {
        offlineCheckTimeoutId = setTimeout(() => {
          offlineCheckTimeoutId = null;

          // Wait for initial state to be loaded before showing offline form
          if (!initialStateLoaded) {
            //console.log('ChatX: Offline check deferred - initial state not yet loaded');
            return;
          }

          // Re-check if still offline
          const stillOffline = departments.length > 0 && departments.every(dept => !dept.online);

          if (stillOffline) {
            //console.log('ChatX: All agents confirmed offline after debounce', { chatId, currentChatStatus });
            lastOnlineState = false;

            // Only clear chat state and show offline form if no active chat
            if (!chatId || (currentChatStatus !== 'active' && currentChatStatus !== 'pending')) {
              clearChatState();
              checkIfAllDepartmentsOffline();
            } else {
              //console.log('ChatX: Active chat in progress, not showing offline form');
            }
          }
        }, 3000); // 3 second debounce - allows agent dashboard refresh
      }
    }
  }

  // Default departments (used if server doesn't respond)
  let departments = [
    { id: 'support', name: 'Support', online: true },
    { id: 'sales', name: 'Sales', online: true }
  ];

  function renderDepartments(depts) {
    if (depts && depts.length > 0) {
      departments = depts;
    }
    const menu = document.getElementById('chatx-dept-menu');
    if (!menu) return;

    const dropdown = document.getElementById('chatx-dept-dropdown');
    const isDropdownOpen = dropdown && dropdown.classList.contains('open');

    menu.innerHTML = departments.map(dept => `
            <div class="chatx-dropdown-item" data-value="${dept.id}" data-name="${dept.name}">
                <span class="chatx-dropdown-item-name">${dept.name}</span>
                <span class="chatx-dropdown-badge ${dept.online ? 'online' : 'offline'}">${dept.online ? 'Online' : 'Offline'}</span>
            </div>
        `).join('');

    // Add click handlers to items
    menu.querySelectorAll('.chatx-dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const value = item.getAttribute('data-value');
        const name = item.getAttribute('data-name');
        selectDepartment(value, name);
      });
    });

    // Preserve dropdown open state after re-rendering
    if (isDropdownOpen && dropdown) {
      dropdown.classList.add('open');
    }

    // NOTE: Don't call checkIfAllDepartmentsOffline() here - it's handled by handleDepartmentAvailabilityChange with debouncing

    // Update home page avatars with online agents
    updateHomeAvatars(departments);

    ////console.log('ChatX: Departments rendered/updated', departments);
  }

  // Update home page avatars with dynamic agent data
  function updateHomeAvatars(departments) {
    const avatarsContainer = document.getElementById('chatx-home-avatars');
    if (!avatarsContainer) return;

    // Check if any department has agent data
    const hasAgentData = departments && departments.some(dept => dept.agents && dept.agents.length > 0);

    // If departments don't include agent data, don't overwrite existing avatars
    // (avatars are loaded separately via fetchAgentAvatars API call)
    if (!hasAgentData) {
      //console.log('ChatX: Departments do not include agent data, skipping avatar update');
      return;
    }

    // Collect online agents from all departments
    const onlineAgents = [];
    if (departments && departments.length > 0) {
      departments.forEach(dept => {
        if (dept.online && dept.agents && dept.agents.length > 0) {
          dept.agents.forEach(agent => {
            if (agent.status === 'online' && onlineAgents.length < 3) {
              onlineAgents.push(agent);
            }
          });
        }
      });
    }

    if (onlineAgents.length === 0) {
      avatarsContainer.innerHTML = `
        <div class="chatx-home-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      `;
      return;
    }

    const avatarHTML = onlineAgents.map(agent => {
      const avatarUrl = resolveAssetUrl(agent.avatar);

      return `
        <div class="chatx-home-avatar">
          ${avatarUrl
          ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agent.name || 'Agent')}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
               <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40" style="display:none;">
                 <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
               </svg>`
          : `<svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
                 <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
               </svg>`
        }
        </div>
      `;
    }).join('');

    avatarsContainer.innerHTML = avatarHTML;
    //console.log('ChatX: Updated home avatars with', onlineAgents.length, 'online agents');
  }

  function updateHomeAvatarsFromAgents(agents) {
    const avatarsContainer = document.getElementById('chatx-home-avatars');
    if (!avatarsContainer || !agents || !Array.isArray(agents)) {
      return;
    }

    const onlineAgents = agents.filter(agent => {
      if (!agent?.avatar || agent?.isActive === false) {
        return false;
      }
      const status = (agent.status || '').toLowerCase();
      return status !== 'offline' && status !== 'inactive';
    });

    if (onlineAgents.length === 0) {
      avatarsContainer.innerHTML = `
        <div class="chatx-home-avatar">
          <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      `;
      return;
    }

    const avatarHTML = onlineAgents.map(agent => {
      const avatarUrl = resolveAssetUrl(agent.avatar);

      return `
        <div class="chatx-home-avatar">
          ${avatarUrl
          ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agent.name || 'Agent')}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
               <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40" style="display:none;">
                 <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
               </svg>`
          : `<svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
                 <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
               </svg>`
        }
        </div>
      `;
    }).join('');

    avatarsContainer.innerHTML = avatarHTML;
  }

  function fetchAgentAvatars(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedAgentAvatars && (now - avatarsFetchedAt) < AVATAR_CACHE_TTL) {
      updateHomeAvatarsFromAgents(cachedAgentAvatars);
      return;
    }

    const orgId = widgetSettings.organizationId;
    const avatarsUrl = orgId
      ? `${SERVER_URL}/api/agents/avatars?organizationId=${encodeURIComponent(orgId)}`
      : `${SERVER_URL}/api/agents/avatars`;

    fetch(avatarsUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      })
      .then(agents => {
        cachedAgentAvatars = agents;
        avatarsFetchedAt = Date.now();
        updateHomeAvatarsFromAgents(agents);
      })
      .catch(error => {
        const avatarsContainer = document.getElementById('chatx-home-avatars');
        if (avatarsContainer) {
          avatarsContainer.innerHTML = `
            <div class="chatx-home-avatar">
              <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          `;
        }
      });
  }

  function checkIfAllDepartmentsOffline() {
    //console.log('ChatX: checkIfAllDepartmentsOffline called', { chatId, currentChatStatus, departments: departments.map(d => ({ name: d.name, online: d.online })) });

    // Don't interfere with the view if there's an active, pending, or recently closed chat
    if (chatId && (currentChatStatus === 'active' || currentChatStatus === 'pending')) {
      //console.log('ChatX: Skipping offline check - active chat in progress');
      return;
    }

    // Don't interfere if showing the chat ended screen
    if (currentChatStatus === 'closed') {
      //console.log('ChatX: Skipping offline check - chat ended screen is showing');
      return;
    }

    const allOffline = departments.length > 0 && departments.every(dept => !dept.online);
    //console.log('ChatX: allOffline =', allOffline);
    const preChatForm = document.getElementById('chatx-prechat');
    const offlineForm = document.getElementById('chatx-offline-request');

    if (allOffline) {
      // Hide normal form, show offline form
      if (preChatForm) preChatForm.style.display = 'none';
      if (offlineForm) offlineForm.style.display = 'flex';

      // Update Home Screen Button for Offline
      updateHomeButtonText(false);

      ////console.log('ChatX: All departments offline, showing offline request form');
    } else {
      // Show normal form, hide offline form
      if (preChatForm) preChatForm.style.display = 'flex';
      if (offlineForm) offlineForm.style.display = 'none';

      // Update Home Screen Button for Online
      updateHomeButtonText(true);

      ////console.log('ChatX: At least one department online, showing normal form');
    }
  }

  function initializeForms() {
    // Ensure only pre-chat form is visible initially
    document.getElementById('chatx-prechat').style.display = 'flex';
    document.getElementById('chatx-whmcs-login').style.display = 'none';
    document.getElementById('chatx-offline-request').style.display = 'none';

    // Reset all form fields — preserve name/email if host page already auto-logged the user in
    if (window.chatxAutoLoggedIn && whmcsData) {
      document.getElementById('chatx-name').value = whmcsData.name || '';
      document.getElementById('chatx-email').value = whmcsData.email || '';
      document.getElementById('chatx-name').setAttribute('readonly', true);
      document.getElementById('chatx-email').setAttribute('readonly', true);
    } else {
      document.getElementById('chatx-name').value = '';
      document.getElementById('chatx-email').value = '';
      document.getElementById('chatx-name').removeAttribute('readonly');
      document.getElementById('chatx-email').removeAttribute('readonly');
    }
    document.getElementById('chatx-initial-message').value = '';

    // Reset department selection
    selectedDepartmentId = null;
    selectedDepartmentName = null;
    document.getElementById('chatx-department').value = '';
    document.getElementById('chatx-dept-text').textContent = 'Chat Department';
    document.getElementById('chatx-dept-toggle').classList.remove('has-value');

    // Reset WHMCS state
    showWhmcsLogin = false;
    whmcsData = null;

    // Reset pre-chat header
    const prechatHeader = document.querySelector('.chatx-prechat-header p');
    if (prechatHeader) {
      prechatHeader.textContent = 'Welcome to our LiveChat! Please fill in the form below before starting the chat';
    }
  }

  function selectDepartment(value, name) {
    document.getElementById('chatx-department').value = value;
    document.getElementById('chatx-dept-text').textContent = name;
    document.getElementById('chatx-dept-toggle').classList.add('has-value');
    document.getElementById('chatx-dept-dropdown').classList.remove('open');

    // Store selected department for later use
    selectedDepartmentId = value;
    selectedDepartmentName = name;

    // Show WHMCS login form if support department is selected (check by name)
    if (name.toLowerCase() === 'support') {
      // If host page already auto-logged the user in, skip the WHMCS login form
      if (window.chatxAutoLoggedIn && whmcsData) {
        showWhmcsLogin = false;
        showWhmcsSuccess(whmcsData);
        return;
      }
      showWhmcsLogin = true;
      document.getElementById('chatx-prechat').style.display = 'none';
      document.getElementById('chatx-whmcs-login').style.display = 'flex';
      document.getElementById('chatx-offline-request').style.display = 'none';
    } else {
      showWhmcsLogin = false;
      document.getElementById('chatx-whmcs-login').style.display = 'none';
      document.getElementById('chatx-prechat').style.display = 'flex';
      document.getElementById('chatx-offline-request').style.display = 'none';
    }
  }

  async function handleWhmcsLogin() {
    const email = document.getElementById('chatx-whmcs-email').value.trim();
    const password = document.getElementById('chatx-whmcs-password').value;
    const errorDiv = document.getElementById('chatx-whmcs-error');
    const submitBtn = document.getElementById('chatx-whmcs-submit');
    const submitText = document.getElementById('chatx-whmcs-submit-text');

    if (!email || !password) {
      showWhmcsError('Please enter both email and password.');
      return;
    }

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitText.innerHTML = '<div class="chatx-whmcs-loading"><div class="chatx-spinner"></div>Authenticating...</div>';

    try {
      const response = await fetch(`${SERVER_URL}/api/whmcs/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          companyName: COMPANY_NAME
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        whmcsData = result.data;
        // Auto-fill name and email from WHMCS data
        document.getElementById('chatx-name').value = result.data.name || '';
        document.getElementById('chatx-email').value = result.data.email || email;

        // Show success screen with user info
        showWhmcsSuccess(result.data);
      } else {
        showWhmcsError(result.message || 'Authentication failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('WHMCS authentication error:', error);
      showWhmcsError('Connection failed. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitText.textContent = 'Login';
    }
  }

  function showWhmcsSuccess(userData) {
    // Hide WHMCS login form and show pre-chat form with logged-in status
    document.getElementById('chatx-whmcs-login').style.display = 'none';
    document.getElementById('chatx-prechat').style.display = 'flex';

    // Add logged-in status message to pre-chat form
    const prechatHeader = document.querySelector('.chatx-prechat-header p');
    if (prechatHeader) {
      prechatHeader.innerHTML = `
        Welcome to our LiveChat! Please fill in the form below before starting the chat
        <div style="background-color: #4caf50; color: white; padding: 8px 12px; margin-top: 10px; border-radius: 4px; font-size: 14px; font-weight: bold; display: inline-flex; align-items: center;">
          <span class="material-symbols-outlined" style="margin-right: 8px; font-size: 18px;">check_circle</span>
          You are currently logged in dashboard
          <button style="background: none; border: none; color: white; margin-left: 8px; font-weight: bold; cursor: pointer; padding: 0;" onclick="document.getElementById('chatx-whmcs-login').style.display = 'flex'; document.getElementById('chatx-prechat').style.display = 'none';" title="Logout">Log Out</button>
        </div>
      `;
    }

    // Pre-fill the form fields with WHMCS data
    document.getElementById('chatx-name').value = userData.name || '';
    document.getElementById('chatx-email').value = userData.email || '';

    // Set department to Support
    document.getElementById('chatx-department').value = selectedDepartmentId || 'support';
    document.getElementById('chatx-dept-text').textContent = selectedDepartmentName || 'Support';
    document.getElementById('chatx-dept-toggle').classList.add('has-value');

    // Make fields readonly to prevent editing since user is authenticated
    document.getElementById('chatx-name').setAttribute('readonly', true);
    document.getElementById('chatx-email').setAttribute('readonly', true);

    // Update button text
    const startButton = document.getElementById('chatx-start');
    if (startButton) {
      startButton.textContent = 'Start The Chat';
    }

    // Store WHMCS data for later use
    whmcsData = userData;
  }

  function goBackFromWhmcs() {
    showWhmcsLogin = false;
    whmcsData = null;

    // Reset pre-chat form to original state
    const prechatHeader = document.querySelector('.chatx-prechat-header p');
    if (prechatHeader) {
      prechatHeader.textContent = 'Welcome to our LiveChat! Please fill in the form below before starting the chat';
    }

    // Clear and enable form fields
    document.getElementById('chatx-name').value = '';
    document.getElementById('chatx-email').value = '';
    document.getElementById('chatx-name').removeAttribute('readonly');
    document.getElementById('chatx-email').removeAttribute('readonly');

    // Reset department selection
    selectedDepartmentId = null;
    selectedDepartmentName = null;
    document.getElementById('chatx-department').value = '';
    document.getElementById('chatx-dept-text').textContent = 'Chat Department';
    document.getElementById('chatx-dept-toggle').classList.remove('has-value');

    // Reset WHMCS login form
    const loginContainer = document.getElementById('chatx-whmcs-login');
    loginContainer.innerHTML = `
      <div class="chatx-whmcs-header">
        <div class="chatx-whmcs-title">Portal Login Required</div>
        <div class="chatx-whmcs-subtitle">Please login with your Portal credentials to access support</div>
      </div>

      <div class="chatx-whmcs-form">
        <div class="chatx-whmcs-field">
          <label class="chatx-whmcs-label" for="chatx-whmcs-email">Email:</label>
          <input type="email" class="chatx-whmcs-input" id="chatx-whmcs-email" placeholder="Enter your Portal email" required>
        </div>
        <div class="chatx-whmcs-field">
          <label class="chatx-whmcs-label" for="chatx-whmcs-password">Password:</label>
          <input type="password" class="chatx-whmcs-input" id="chatx-whmcs-password" placeholder="Enter your Portal password" required>
        </div>
        <div class="chatx-whmcs-error" id="chatx-whmcs-error" style="display:none;"></div>
        <button class="chatx-whmcs-submit" id="chatx-whmcs-submit">
          <span id="chatx-whmcs-submit-text">Login</span>
        </button>
        <button class="chatx-whmcs-back" id="chatx-whmcs-back" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px;">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Go Back
        </button>
      </div>
    `;

    // Re-attach event listeners
    document.getElementById('chatx-whmcs-submit').addEventListener('click', handleWhmcsLogin);
    document.getElementById('chatx-whmcs-back').addEventListener('click', goBackFromWhmcs);

    // Show pre-chat form and hide WHMCS form
    document.getElementById('chatx-whmcs-login').style.display = 'none';
    document.getElementById('chatx-prechat').style.display = 'flex';
    document.getElementById('chatx-offline-request').style.display = 'none';
  }

  function showWhmcsError(message) {
    const errorDiv = document.getElementById('chatx-whmcs-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  // Image modal functions
  function openImageModal(imageUrl, imageName) {
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'chatx-image-modal';
    modal.id = 'chatx-image-modal';
    modal.innerHTML = `
      <div class="chatx-image-modal-content">
        <button class="chatx-image-modal-close" id="chatx-image-modal-close">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        <img src="${imageUrl}" alt="${imageName}" />
        
      </div>
    `;

    // Add to page
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeImageModal();
      }
    });

    // Close button handler
    document.getElementById('chatx-image-modal-close').addEventListener('click', closeImageModal);

    // Close on Escape key
    document.addEventListener('keydown', handleImageModalKeydown);
  }

  function closeImageModal() {
    const modal = document.getElementById('chatx-image-modal');
    if (modal) {
      modal.remove();
    }
    document.removeEventListener('keydown', handleImageModalKeydown);
  }

  function handleImageModalKeydown(e) {
    if (e.key === 'Escape') {
      closeImageModal();
    }
  }

  // Event bindings
  let eventsAttached = false;
  function bindEvents() {
    // Prevent duplicate event listeners
    if (eventsAttached) {
      ////console.log('ChatX: Events already attached');
      return;
    }
    eventsAttached = true;

    // Toggle button
    document.getElementById('chatx-toggle').addEventListener('click', () => {
      const widget = document.getElementById('chatx-window');
      const button = document.getElementById('chatx-toggle');
      const miniPopup = document.getElementById('chatx-mini-popup');

      if (!isOpen) {
        // Opening the widget
        isOpen = true;
        if (widget) {
          widget.classList.add('open');
        }
        // Add open class to button for icon change
        if (button) {
          button.classList.add('chatx-open');
          button.classList.remove('chatx-button-pulse');
        }
        // Hide mini popup when widget opens
        if (miniPopup) {
          miniPopup.classList.remove('show');
        }

        // Unlock audio on first user interaction (browser autoplay policy)
        unlockAudio();

        if (!socket) {
          connectSocket();
        }

        // Mark messages as read when opening widget with active chat
        if (socket && chatId && currentChatStatus === 'active') {
          markChatMessagesAsRead();
        }
      } else {
        // Closing the widget with animation
        if (widget) {
          widget.classList.add('closing');
          setTimeout(() => {
            widget.classList.remove('open', 'closing');
            isOpen = false;
            // Remove open class from button
            if (button) {
              button.classList.remove('chatx-open');
            }
          }, 250); // Match the animation duration
        } else {
          isOpen = false;
          if (button) {
            button.classList.remove('chatx-open');
          }
        }
      }
    });

    // Mini popup click - open widget
    document.getElementById('chatx-mini-popup').addEventListener('click', (e) => {
      if (e.target.closest('#chatx-mini-popup-close')) return;
      document.getElementById('chatx-toggle').click();
    });

    // Mini popup close button
    document.getElementById('chatx-mini-popup-close').addEventListener('click', (e) => {
      e.stopPropagation();
      const miniPopup = document.getElementById('chatx-mini-popup');
      miniPopup.classList.remove('show');
      // Store dismissal in session
      sessionStorage.setItem('chatx_mini_popup_dismissed', 'true');
    });

    // Offline request form submit
    document.getElementById('chatx-offline-submit').addEventListener('click', submitOfflineRequest);

    // Offline request go back button
    document.getElementById('chatx-offline-goback').addEventListener('click', () => {
      // Hide thank you screen and show form again
      document.getElementById('chatx-offline-thankyou').style.display = 'none';
      document.getElementById('chatx-offline-form').style.display = 'flex';
      document.querySelector('#chatx-offline-request .chatx-prechat-header').style.display = 'block';
      // Hide offline request and show pre-chat form
      document.getElementById('chatx-offline-request').style.display = 'none';
      document.getElementById('chatx-prechat').style.display = 'flex';
    });

    // Close button
    document.getElementById('chatx-close').addEventListener('click', () => {
      closeWidget();
    });

    // Start chat button
    document.getElementById('chatx-start').addEventListener('click', startChat);


    // Department dropdown toggle
    const deptToggle = document.getElementById('chatx-dept-toggle');
    const deptDropdown = document.getElementById('chatx-dept-dropdown');

    deptToggle.addEventListener('click', (e) => {
      e.preventDefault();
      deptDropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!deptDropdown.contains(e.target)) {
        deptDropdown.classList.remove('open');
      }
    });

    // Render default departments
    renderDepartments(departments);

    // Input field
    const input = document.getElementById('chatx-input');
    let typingTimeout = null;

    input.addEventListener('input', () => {
      document.getElementById('chatx-send').disabled = !input.value.trim();
      autoGrow(input);

      if (socket && chatId) {
        // Send typing event with actual text content for real-time preview
        socket.emit('typing:start', { chatId, text: input.value });

        // Clear existing timeout
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }

        // Stop typing indicator after 2 seconds of no input
        typingTimeout = setTimeout(() => {
          socket.emit('typing:stop', { chatId });
        }, 2000);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Handle paste for clipboard images
    input.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items || !chatId) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault(); // Prevent pasting image data as text

          const file = item.getAsFile();
          if (!file) continue;

          // Validate file size (5MB limit)
          const maxSize = 5 * 1024 * 1024;
          if (file.size > maxSize) {
            alert('File size must be less than 5MB.');
            return;
          }

          // Upload the pasted image
          const formData = new FormData();
          const fileName = `clipboard-image-${Date.now()}.png`;
          formData.append('file', file, fileName);

          const sendBtn = document.getElementById('chatx-send');
          const originalText = sendBtn.innerHTML;
          sendBtn.innerHTML = '\u23F3';
          sendBtn.disabled = true;

          fetch(`${SERVER_URL}/api/messages/upload`, {
            method: 'POST',
            body: formData
          })
            .then(response => response.json())
            .then(result => {
              if (result.success) {
                socket.emit('message:send', {
                  chatId: chatId,
                  content: `\u{1F4F7} ${fileName}`,
                  fileUrl: result.url,
                  fileName: fileName,
                  fileType: file.type
                });
              } else {
                alert('Failed to upload image. Please try again.');
              }
            })
            .catch(error => {
              console.error('Upload error:', error);
              alert('Failed to upload image. Please try again.');
            })
            .finally(() => {
              sendBtn.innerHTML = originalText;
              sendBtn.disabled = !input.value.trim();
            });

          return; // Only handle the first image
        }
      }
    });

    // Send button
    document.getElementById('chatx-send').addEventListener('click', sendMessage);

    // File upload button
    document.getElementById('chatx-file-upload').addEventListener('click', () => {
      ////console.log('📎 File upload button clicked');
      const fileInput = document.getElementById('chatx-file-input');
      ////console.log('🎯 File input element:', fileInput);
      fileInput.click();
    });

    // File input handler
    document.getElementById('chatx-file-input').addEventListener('change', handleFileUpload);

    // Emoji picker
    initEmojiPicker();
    document.getElementById('chatx-emoji-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const picker = document.getElementById('chatx-emoji-picker');
      picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
      const picker = document.getElementById('chatx-emoji-picker');
      const btn = document.getElementById('chatx-emoji-btn');
      if (picker && !picker.contains(e.target) && !btn.contains(e.target)) {
        picker.style.display = 'none';
      }
    });

    // End chat button
    document.getElementById('chatx-end-chat').addEventListener('click', endChat);

    // New chat button
    document.getElementById('chatx-new-chat').addEventListener('click', startNewChat);

    // WHMCS login button
    document.getElementById('chatx-whmcs-submit').addEventListener('click', handleWhmcsLogin);

    // WHMCS go back button
    document.getElementById('chatx-whmcs-back').addEventListener('click', goBackFromWhmcs);

    // Rating buttons
    document.getElementById('chatx-rating-positive').addEventListener('click', function () {
      selectRating(1, this);
    });
    document.getElementById('chatx-rating-negative').addEventListener('click', function () {
      selectRating(0, this);
    });

    // Submit rating
    document.getElementById('chatx-rating-submit').addEventListener('click', submitRating);

    // Send transcript
    document.getElementById('chatx-transcript').addEventListener('click', sendTranscript);

    // Image click handler - use event delegation on messages container
    document.getElementById('chatx-messages').addEventListener('click', (e) => {
      const img = e.target.closest('.chatx-image-preview');
      if (img && img.dataset.fullImage) {
        openImageModal(img.dataset.fullImage, img.dataset.imageName || 'Image');
      }
    });

    // Track page changes
    window.addEventListener('popstate', updateVisitorPage);

    // Send initial page visit
    setTimeout(updateVisitorPage, 1000);

    // Also track hash changes for SPAs
    window.addEventListener('hashchange', updateVisitorPage);
  }

  function selectRating(rating, button) {
    window.chatxSelectedRating = rating;
    document.querySelectorAll('.chatx-rating-btn').forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');

    // Show comment textarea and submit button when rating is selected
    document.getElementById('chatx-rating-comment').style.display = 'block';
    document.getElementById('chatx-rating-submit').style.display = 'block';
    document.getElementById('chatx-rating-submit').disabled = false;
  }

  function submitRating() {
    const rating = window.chatxSelectedRating;
    const comment = document.getElementById('chatx-rating-comment').value.trim();
    const closedChatId = window.chatxClosedChatId;

    ////console.log('ChatX: Submitting rating - Rating:', rating, 'Chat ID:', closedChatId);

    if (rating === null || rating === undefined) {
      alert('Please select a rating first');
      return;
    }

    if (!closedChatId) {
      console.error('ChatX: No chat ID for rating. chatId:', chatId, 'closedChatId:', closedChatId);
      alert('Unable to submit rating. Chat ID not found.');
      return;
    }

    const submitBtn = document.getElementById('chatx-rating-submit');
    const successMsg = document.getElementById('chatx-rating-success');

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Send rating to server via socket.io (doesn't require auth)
    if (socket && socket.connected) {
      ////console.log('ChatX: Sending rating via socket.io');
      socket.emit('chat:rate', { chatId: closedChatId, rating, comment }, (response) => {
        ////console.log('ChatX: Rating response', response);
        if (response && response.success) {
          ////console.log('ChatX: Rating submitted successfully');
          // Hide button and show success message
          submitBtn.style.display = 'none';
          successMsg.style.display = 'block';
          // Disable rating buttons and comment
          document.querySelectorAll('.chatx-rating-btn').forEach(btn => btn.disabled = true);
          document.getElementById('chatx-rating-comment').disabled = true;
        } else {
          console.error('ChatX: Rating submission failed', response);
          alert('Failed to submit rating. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Rating';
        }
      });
    } else {
      // Fallback: Try REST API without auth header
      fetch(SERVER_URL + '/api/chats/rate/' + closedChatId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating, comment }),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to submit rating');
          }
          return response.json();
        })
        .then(data => {
          ////console.log('ChatX: Rating submitted successfully', data);
          // Hide button and show success message
          submitBtn.style.display = 'none';
          successMsg.style.display = 'block';
          // Disable rating buttons and comment
          document.querySelectorAll('.chatx-rating-btn').forEach(btn => btn.disabled = true);
          document.getElementById('chatx-rating-comment').disabled = true;
        })
        .catch(error => {
          console.error('ChatX: Rating error', error);
          alert('Failed to submit rating. Please try again.');
          // Re-enable button
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Rating';
        });
    }
  }

  function sendTranscript() {
    const closedChatId = window.chatxClosedChatId;
    const visitorEmail = window.chatxVisitorEmail;
    const visitorName = window.chatxVisitorName || 'Visitor';

    if (!closedChatId) {
      alert('Unable to send transcript. Chat ID not found.');
      return;
    }

    if (!visitorEmail) {
      alert('Unable to send transcript. Email not found.');
      return;
    }

    // Format the transcript from messages array
    const transcript = formatTranscriptForEmail(visitorName);

    // Update button to show loading state
    const transcriptBtn = document.getElementById('chatx-transcript');
    const originalText = transcriptBtn.textContent;
    transcriptBtn.textContent = 'Sending...';
    transcriptBtn.disabled = true;

    // Send transcript to server
    fetch(`${SERVER_URL}/api/chats/${closedChatId}/send-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: visitorEmail,
        transcript: transcript
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          transcriptBtn.textContent = 'Transcript Sent!';
          transcriptBtn.style.backgroundColor = '#22c55e';
          setTimeout(() => {
            transcriptBtn.textContent = originalText;
            transcriptBtn.style.backgroundColor = '';
            transcriptBtn.disabled = false;
          }, 3000);
        } else {
          throw new Error(data.message || 'Failed to send transcript');
        }
      })
      .catch(error => {
        console.error('ChatX: Error sending transcript:', error);
        alert(error.message || 'Failed to send transcript. Please try again.');
        transcriptBtn.textContent = originalText;
        transcriptBtn.disabled = false;
      });
  }

  // Format messages array into HTML transcript for email
  function formatTranscriptForEmail(visitorName) {
    const agentName = window.chatxCurrentAgent?.name || 'Agent';
    let transcript = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">`;
    transcript += `<h2 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">Chat Transcript</h2>`;
    transcript += `<p style="color: #666;">Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>`;
    transcript += `<div style="margin-top: 20px;">`;

    messages.forEach(msg => {
      if (msg.senderType === 'private_note') return; // Skip private notes

      const isVisitor = msg.senderType === 'visitor';
      const senderName = isVisitor ? visitorName : (msg.agent?.name || agentName);
      const time = formatTime(msg.createdAt);
      const bgColor = isVisitor ? '#e3f2fd' : '#f5f5f5';
      const borderColor = isVisitor ? '#2196f3' : '#9e9e9e';

      transcript += `
        <div style="margin-bottom: 15px; padding: 12px; background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 4px;">
          <div style="font-weight: bold; color: #333; margin-bottom: 5px;">${escapeHtml(senderName)} <span style="font-weight: normal; color: #999; font-size: 12px;">${time}</span></div>
          <div style="color: #444;">${escapeHtml(msg.content || '')}</div>
        </div>
      `;
    });

    transcript += `</div></div>`;
    return transcript;
  }

  function autoGrow(element) {
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 100) + 'px';
  }

  // Initialize emoji picker using emoji-picker-element library
  function initEmojiPicker() {
    const pickerContainer = document.getElementById('chatx-emoji-picker');
    if (!pickerContainer) return;

    // Load emoji-picker-element script dynamically
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js';
    script.onload = () => {
      // Create the emoji picker element
      const emojiPicker = document.createElement('emoji-picker');
      emojiPicker.classList.add('light');
      pickerContainer.appendChild(emojiPicker);

      // Listen for emoji selection
      emojiPicker.addEventListener('emoji-click', (event) => {
        const emoji = event.detail.unicode;
        const input = document.getElementById('chatx-input');
        if (input && emoji) {
          const start = input.selectionStart;
          const end = input.selectionEnd;
          const text = input.value;
          input.value = text.substring(0, start) + emoji + text.substring(end);
          input.selectionStart = input.selectionEnd = start + emoji.length;
          input.focus();
          document.getElementById('chatx-send').disabled = !input.value.trim();
          pickerContainer.style.display = 'none';
        }
      });
    };
    document.head.appendChild(script);
  }

  function submitOfflineRequest() {
    const name = document.getElementById('chatx-offline-name').value.trim();
    const email = document.getElementById('chatx-offline-email').value.trim();
    const subject = document.getElementById('chatx-offline-subject').value.trim();
    const message = document.getElementById('chatx-offline-message').value.trim();
    const errorDiv = document.getElementById('chatx-offline-error');
    const submitBtn = document.getElementById('chatx-offline-submit');

    // Clear previous messages
    errorDiv.style.display = 'none';

    // Validation
    if (!name) {
      errorDiv.textContent = 'Please enter your name';
      errorDiv.style.display = 'block';
      document.getElementById('chatx-offline-name').focus();
      return;
    }

    if (!email) {
      errorDiv.textContent = 'Please enter your email';
      errorDiv.style.display = 'block';
      document.getElementById('chatx-offline-email').focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorDiv.textContent = 'Please enter a valid email';
      errorDiv.style.display = 'block';
      document.getElementById('chatx-offline-email').focus();
      return;
    }

    if (!subject) {
      errorDiv.textContent = 'Please enter a subject';
      errorDiv.style.display = 'block';
      document.getElementById('chatx-offline-subject').focus();
      return;
    }

    if (!message) {
      errorDiv.textContent = 'Please enter your message';
      errorDiv.style.display = 'block';
      document.getElementById('chatx-offline-message').focus();
      return;
    }

    // Disable submit button
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';

    // Submit offline request to server
    const offlineData = {
      visitorName: name,
      visitorEmail: email,
      subject: subject,
      message: message,
      companyName: COMPANY_NAME,
      currentPage: window.location.href,
      timestamp: new Date().toISOString(),
    };

    ////console.log('ChatX: Submitting offline request:', offlineData);
    ////console.log('ChatX: Socket connected?', isConnected, 'Socket exists?', !!socket);

    // Send via socket if connected, otherwise via HTTP
    if (socket && isConnected) {
      ////console.log('ChatX: Using Socket.IO to send offline request');
      socket.emit('offline:request', offlineData, (response) => {
        ////console.log('ChatX: Offline request callback response:', response);
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (response && response.success) {
          ////console.log('ChatX: Offline request successful');
          // Clear form
          document.getElementById('chatx-offline-name').value = '';
          document.getElementById('chatx-offline-email').value = '';
          document.getElementById('chatx-offline-subject').value = '';
          document.getElementById('chatx-offline-message').value = '';
          // Hide form and show thank you screen
          document.getElementById('chatx-offline-form').style.display = 'none';
          document.querySelector('.chatx-prechat-header').style.display = 'none';
          document.getElementById('chatx-offline-thankyou').style.display = 'flex';
        } else {
          ////console.log('ChatX: Offline request failed:', response?.message);
          errorDiv.textContent = response?.message || 'Failed to send request. Please try again.';
          errorDiv.style.display = 'block';
        }
      });
    } else {
      // Fallback: Send via HTTP POST
      ////console.log('ChatX: Using HTTP to send offline request to:', SERVER_URL + '/api/offline-requests');
      fetch(SERVER_URL + '/api/offline-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(offlineData)
      })
        .then(response => {
          ////console.log('ChatX: HTTP Response status:', response.status);
          return response.json();
        })
        .then(data => {
          ////console.log('ChatX: HTTP Response data:', data);
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;

          if (data.success) {
            ////console.log('ChatX: Offline request successful');
            // Clear form
            document.getElementById('chatx-offline-name').value = '';
            document.getElementById('chatx-offline-email').value = '';
            document.getElementById('chatx-offline-subject').value = '';
            document.getElementById('chatx-offline-message').value = '';
            // Hide form and show thank you screen
            document.getElementById('chatx-offline-form').style.display = 'none';
            document.querySelector('#chatx-offline-request .chatx-prechat-header').style.display = 'none';
            document.getElementById('chatx-offline-thankyou').style.display = 'flex';
          } else {
            ////console.log('ChatX: Offline request failed:', data.message);
            errorDiv.textContent = data.message || 'Failed to send request. Please try again.';
            errorDiv.style.display = 'block';
          }
        })
        .catch(error => {
          console.error('ChatX: Offline request error:', error);
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          errorDiv.textContent = 'Failed to send request. Please try again.';
          errorDiv.style.display = 'block';
        });
    }
  }

  // Track ban state for the current visitor (set after ban-check API call)
  let visitorBanned = false;
  let visitorBanInfo = null;

  function formatBanMessage(info) {
    if (!info) return 'You are banned from using this chat.';
    let msg = 'You are banned from using this chat.';
    if (info.reason) msg += ' Reason: ' + info.reason;
    if (info.banType === 'temporary' && info.banExpiresAt) {
      try {
        msg += ' (until ' + new Date(info.banExpiresAt).toLocaleString() + ')';
      } catch (e) { }
    }
    return msg;
  }

  async function checkBan(email) {
    try {
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      if (widgetSettings.organizationId) params.append('organizationId', widgetSettings.organizationId);
      const response = await fetch(`${SERVER_URL}/api/ban-users/check?` + params.toString());
      if (!response.ok) return { banned: false };
      return await response.json();
    } catch (e) {
      return { banned: false };
    }
  }

  function disableChatInputForBan(info) {
    visitorBanned = true;
    visitorBanInfo = info;
    const input = document.getElementById('chatx-input');
    const sendBtn = document.getElementById('chatx-send');
    const fileBtn = document.getElementById('chatx-file-upload');
    const fileInput = document.getElementById('chatx-file-input');
    if (input) {
      input.disabled = true;
      input.placeholder = 'You are banned';
    }
    if (sendBtn) sendBtn.disabled = true;
    if (fileBtn) {
      fileBtn.disabled = true;
      fileBtn.style.opacity = '0.4';
      fileBtn.style.pointerEvents = 'none';
    }
    if (fileInput) fileInput.disabled = true;

    // Show a banner in the messages area
    const messagesContainer = document.getElementById('chatx-messages-container') || document.getElementById('chatx-messages');
    if (messagesContainer && !document.getElementById('chatx-ban-notice')) {
      const notice = document.createElement('div');
      notice.id = 'chatx-ban-notice';
      notice.style.cssText = 'background:#fee2e2;color:#991b1b;padding:10px 14px;margin:8px;border-radius:6px;font-size:13px;text-align:center;';
      notice.textContent = formatBanMessage(info);
      messagesContainer.appendChild(notice);
    }
  }

  async function startChat() {
    const name = document.getElementById('chatx-name').value.trim();
    const email = document.getElementById('chatx-email').value.trim();
    const departmentId = document.getElementById('chatx-department').value;
    const initialMessage = document.getElementById('chatx-initial-message').value.trim();
    const errorDiv = document.getElementById('chatx-prechat-error');

    ////console.log('ChatX: Starting chat...', { name, email, departmentId, visitorId, socket: !!socket });

    // Unlock audio on user interaction (starting chat is a key user gesture)
    unlockAudio();

    if (errorDiv) errorDiv.style.display = 'none';

    if (!name) {
      document.getElementById('chatx-name').focus();
      return;
    }

    if (!email) {
      document.getElementById('chatx-email').focus();
      return;
    }

    if (!departmentId) {
      alert('Please select a department');
      return;
    }

    // Check if visitor is banned (by email; backend will also match IP)
    const banResult = await checkBan(email);
    if (banResult && banResult.banned) {
      visitorBanned = true;
      visitorBanInfo = banResult;
      if (errorDiv) {
        errorDiv.textContent = formatBanMessage(banResult);
        errorDiv.style.display = 'flex';
      } else {
        alert(formatBanMessage(banResult));
      }
      return;
    }

    // Check if department is online
    const selectedDept = departments.find(d => d.id === departmentId);
    if (selectedDept && !selectedDept.online) {
      if (errorDiv) {
        errorDiv.textContent = `Sorry, no agents are available for ${selectedDept.name} at this time. Please try again later.`;
        errorDiv.style.display = 'flex';
      } else {
        alert(`Sorry, no agents are available for ${selectedDept.name} at this time.`);
      }
      return;
    }

    if (!socket) {
      console.error('ChatX: Socket not connected');
      alert('Connection error. Please try again.');
      return;
    }

    // doStartChat now handles both cases: with or without visitorId
    doStartChat(name, email, departmentId, initialMessage);
  }

  function doStartChat(name, email, department, initialMessage) {
    ////console.log('ChatX: doStartChat called', { visitorId, department, initialMessage, isConnected });

    if (!socket || !isConnected) {
      console.error('ChatX: Socket not connected!');
      alert('Connection error. Please try again.');
      return;
    }

    // Store visitor info for transcript feature
    window.chatxVisitorName = name;
    window.chatxVisitorEmail = email;

    // Store the initial message to show after chat starts
    window.chatxPendingInitialMessage = initialMessage;

    // Clear any existing timeout
    if (chatStartTimeoutId) {
      clearTimeout(chatStartTimeoutId);
    }

    // Update visitor info with name and email first
    socket.emit('visitor:connect', {
      sessionId: sessionId,
      name: name,
      email: email,
      currentPage: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
    });

    // Function to actually start the chat
    const emitChatStart = () => {
      // Don't start a new chat if one was already restored from history
      if (chatId) {
        ////console.log('ChatX: Skipping chat:start - chat already exists:', chatId);
        return;
      }

      // Check if visitorId is available now
      if (!visitorId) {
        ////console.log('ChatX: Visitor ID still not available, retrying in 100ms...');
        chatStartTimeoutId = setTimeout(emitChatStart, 100);
        return;
      }

      // Only include initialMessage if user actually typed something
      const chatStartData = {
        visitorId: visitorId,
        departmentId: department,
        organizationId: widgetSettings.organizationId,
      };

      if (initialMessage) {
        chatStartData.initialMessage = initialMessage;
      }

      ////console.log('ChatX: Emitting chat:start', chatStartData);
      socket.emit('chat:start', chatStartData);
    };

    // Wait a bit for visitor:connected to be processed, then start chat
    chatStartTimeoutId = setTimeout(emitChatStart, 300);
  }

  function showChatArea() {
    document.getElementById('chatx-prechat').style.display = 'none';
    document.getElementById('chatx-whmcs-login').style.display = 'none';
    document.getElementById('chatx-messages').style.display = 'block';
    document.getElementById('chatx-footer').style.display = 'block';
    document.getElementById('chatx-chat-ended').style.display = 'none';
    document.getElementById('chatx-end-chat').style.display = 'block';

    // Show input area (in case it was hidden when chat ended)
    const inputArea = document.getElementById('chatx-input-area');
    if (inputArea) {
      inputArea.classList.remove('hidden');
    }

    // Remove inline rating if exists
    const inlineRating = document.getElementById('chatx-inline-rating');
    if (inlineRating) inlineRating.remove();

    // Show queue status if agent hasn't joined yet
    showQueueStatus();
  }

  function showQueueStatus() {
    const container = document.getElementById('chatx-messages');
    if (!container) return;

    // Only show if agent hasn't joined
    if (agentJoined) {
      document.getElementById('chatx-queue-status')?.remove();
      return;
    }

    // Remove existing queue message
    const existingQueue = document.getElementById('chatx-queue-status');
    if (existingQueue) existingQueue.remove();

    // Create queue status message
    const queueDiv = document.createElement('div');
    queueDiv.id = 'chatx-queue-status';
    queueDiv.style.cssText = `
      padding: 20px;
      text-align: center;
      background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
      border-radius: 8px;
      margin: 20px auto;
      max-width: 90%;
      font-size: 14px;
    `;

    const mainText = document.createElement('p');
    mainText.style.cssText = 'margin: 0 0 12px 0; color: #333; font-weight: 500;';
    mainText.textContent = 'One of our representatives will be with you shortly. Thank you for your patience.';

    const queueText = document.createElement('p');
    queueText.style.cssText = 'margin: 0; color: #666; font-size: 13px;';
    queueText.textContent = `You are number ${userQueuePosition} in the queue.`;

    queueDiv.appendChild(mainText);
    queueDiv.appendChild(queueText);
    container.appendChild(queueDiv);
  }

  function hideQueueStatus() {
    document.getElementById('chatx-queue-status')?.remove();
  }

  function showChatEnded(agent, endedByVisitor = false) {
    // Save chatId before it gets cleared (for agent-ended chats)
    if (chatId && !window.chatxClosedChatId) {
      window.chatxClosedChatId = chatId;
    }

    document.getElementById('chatx-prechat').style.display = 'none';
    document.getElementById('chatx-messages').style.display = 'block'; // Keep messages visible
    document.getElementById('chatx-footer').style.display = 'block'; // Keep footer visible for powered by
    document.getElementById('chatx-chat-ended').style.display = 'none'; // Hide separate rating page
    document.getElementById('chatx-end-chat').style.display = 'none';

    // Hide only the input area (attachment, emoji, input, send button)
    const inputArea = document.getElementById('chatx-input-area');
    if (inputArea) {
      inputArea.classList.add('hidden');
    }

    // Reset header status
    const statusEl = document.getElementById('chatx-status');
    if (statusEl) {
      statusEl.textContent = 'Chat ended';
    }

    // Show chat ended info
    const agentName = agent?.name || window.chatxCurrentAgent?.name || 'Agent';
    const endTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let endedInfoText;
    if (endedByVisitor) {
      endedInfoText = `Chat Ended By You at ${endTime} | You ended the chat`;
    } else {
      endedInfoText = `Chat Ended By ${agentName} at ${endTime} | Agent Ended chat`;
    }

    // Add inline rating to messages container
    addInlineRating(endedInfoText);

    // Scroll to bottom to show rating
    const messagesContainer = document.getElementById('chatx-messages');
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    }
  }

  function addInlineRating(endedInfoText) {
    const messagesContainer = document.getElementById('chatx-messages');
    if (!messagesContainer) return;

    // Remove existing inline rating if any
    const existingRating = document.getElementById('chatx-inline-rating');
    if (existingRating) existingRating.remove();

    // Create inline rating element
    const ratingDiv = document.createElement('div');
    ratingDiv.id = 'chatx-inline-rating';
    ratingDiv.className = 'chatx-inline-rating';
    ratingDiv.innerHTML = `
      <div class="chatx-chat-ended-info">${endedInfoText}</div>
      <div class="chatx-rating-title">Rate This Conversation!</div>
      <div class="chatx-rating-subtitle">Please click on one of the options below to rate your experience.</div>
      <div class="chatx-rating-buttons">
        <button class="chatx-rating-btn positive" data-rating="1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          <span class="chatx-rating-label">Good</span>
        </button>
        <button class="chatx-rating-btn negative" data-rating="0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
          </svg>
          <span class="chatx-rating-label">Bad</span>
        </button>
      </div>
      <textarea class="chatx-rating-comment" placeholder="Leave a comment (optional)" rows="3" style="display:none;"></textarea>
      <button class="chatx-rating-submit" disabled style="display:none;">Submit Rating</button>
      <div class="chatx-rating-success" style="display:none;">Review submitted successfully!</div>
      <div class="chatx-rating-actions">
        <button class="chatx-transcript-btn">Send Transcript</button>
        <span class="chatx-rating-or">OR</span>
        <button class="chatx-new-chat-btn">Start New Chat</button>
      </div>
    `;

    messagesContainer.appendChild(ratingDiv);

    // Reset rating state
    window.chatxSelectedRating = null;

    // Bind events for inline rating
    bindInlineRatingEvents(ratingDiv);
  }

  function bindInlineRatingEvents(container) {
    const ratingButtons = container.querySelectorAll('.chatx-rating-btn');
    const commentBox = container.querySelector('.chatx-rating-comment');
    const submitBtn = container.querySelector('.chatx-rating-submit');
    const successMsg = container.querySelector('.chatx-rating-success');
    const transcriptBtn = container.querySelector('.chatx-transcript-btn');
    const newChatBtn = container.querySelector('.chatx-new-chat-btn');

    ratingButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remove selected from all buttons
        ratingButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        window.chatxSelectedRating = parseInt(btn.dataset.rating);

        // Show comment box and submit button
        commentBox.style.display = 'block';
        submitBtn.style.display = 'block';
        submitBtn.disabled = false;

        // Scroll to show the comment box
        const messagesContainer = document.getElementById('chatx-messages');
        if (messagesContainer) {
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 100);
        }
      });
    });

    submitBtn.addEventListener('click', () => {
      if (window.chatxSelectedRating === null || window.chatxSelectedRating === undefined) return;

      // Use saved chatId since the main chatId is cleared when chat ends
      const ratingChatId = window.chatxClosedChatId || chatId;
      if (!ratingChatId) return;

      const comment = commentBox.value.trim();

      // Disable form
      ratingButtons.forEach(btn => btn.disabled = true);
      commentBox.disabled = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      // Submit rating
      socket.emit('chat:rate', {
        chatId: ratingChatId,
        rating: window.chatxSelectedRating,
        comment: comment || null
      });

      // Show success (we'll assume it succeeds since there's no callback)
      setTimeout(() => {
        submitBtn.style.display = 'none';
        commentBox.style.display = 'none';
        successMsg.style.display = 'block';

        // Scroll to show success message
        const messagesContainer = document.getElementById('chatx-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 500);
    });

    transcriptBtn.addEventListener('click', () => {
      const transcriptChatId = window.chatxClosedChatId || chatId;
      if (!transcriptChatId) return;
      socket.emit('chat:sendTranscript', { chatId: transcriptChatId });
      transcriptBtn.textContent = 'Transcript Sent!';
      transcriptBtn.disabled = true;
      setTimeout(() => {
        transcriptBtn.textContent = 'Send Transcript';
        transcriptBtn.disabled = false;
      }, 3000);
    });

    newChatBtn.addEventListener('click', () => {
      startNewChat();
    });
  }

  function showPrechatForm() {
    // Don't show prechat form if there's an active chat - keep showing the chat
    if (chatId && (currentChatStatus === 'active' || currentChatStatus === 'pending')) {
      //console.log('ChatX: showPrechatForm blocked - active chat in progress');
      return;
    }

    // Show prechat form - needed for Start New Chat functionality
    document.getElementById('chatx-prechat').style.display = 'block';
    document.getElementById('chatx-messages').style.display = 'none';
    document.getElementById('chatx-footer').style.display = 'none';
    document.getElementById('chatx-chat-ended').style.display = 'none';
    document.getElementById('chatx-end-chat').style.display = 'none';

    // Ensure input area is visible for next chat (remove hidden class)
    const inputArea = document.getElementById('chatx-input-area');
    if (inputArea) {
      inputArea.classList.remove('hidden');
    }

    // Remove inline rating if exists
    const inlineRating = document.getElementById('chatx-inline-rating');
    if (inlineRating) inlineRating.remove();

    // Reset header status
    const statusEl = document.getElementById('chatx-status');
    if (statusEl) {
      statusEl.textContent = "We're here to help";
    }

    // Clear agent info
    window.chatxCurrentAgent = null;

    // Clear form — preserve name/email when auto-logged in
    if (window.chatxAutoLoggedIn && whmcsData) {
      document.getElementById('chatx-name').value = whmcsData.name || '';
      document.getElementById('chatx-email').value = whmcsData.email || '';
      document.getElementById('chatx-name').setAttribute('readonly', true);
      document.getElementById('chatx-email').setAttribute('readonly', true);
    } else {
      document.getElementById('chatx-name').value = '';
      document.getElementById('chatx-email').value = '';
    }
    document.getElementById('chatx-department').value = '';
    document.getElementById('chatx-dept-text').textContent = 'Chat Department';
    document.getElementById('chatx-dept-toggle').classList.remove('has-value');
    document.getElementById('chatx-initial-message').value = '';

    // Check if all departments are offline and show appropriate form
    checkIfAllDepartmentsOffline();
  }

  // Helper function to open widget
  function openWidget() {
    if (!isOpen) {
      isOpen = true;
      const widget = document.getElementById('chatx-window');
      if (widget) {
        widget.classList.add('open');
        ////console.log('ChatX: Widget opened');
      }

      // Unlock audio on first user interaction (browser autoplay policy)
      unlockAudio();

      // Connect socket if not already connected
      if (!socket) {
        connectSocket();
      }

      // Mark messages as read if there's an active chat
      if (socket && chatId && currentChatStatus === 'active') {
        markChatMessagesAsRead();
      }
    }
  }

  // Helper function to close widget
  function closeWidget() {
    const widget = document.getElementById('chatx-window');
    const button = document.getElementById('chatx-toggle');
    if (widget && isOpen) {
      widget.classList.add('closing');
      setTimeout(() => {
        widget.classList.remove('open', 'closing');
        isOpen = false;
        // Remove open class from button
        if (button) {
          button.classList.remove('chatx-open');
        }
        ////console.log('ChatX: Widget closed');
      }, 250); // Match the animation duration
    } else {
      isOpen = false;
      if (button) {
        button.classList.remove('chatx-open');
      }
    }
    stopAgentJoinMonitoring(); // Stop monitoring when widget is closed
  }

  // Helper function to clear chat state (used when all agents offline and no active chat)
  function clearChatState() {
    // Reset all chat-related state
    chatId = null;
    currentChatStatus = null;
    messages = [];
    agentJoined = false;
    whmcsData = null;
    selectedDepartmentId = null;
    selectedDepartmentName = null;
    pendingChatsCount = 0;
    userQueuePosition = 1;

    // Clear stored agent info
    window.chatxCurrentAgent = null;
    window.chatxCurrentChat = null;

    // Stop monitoring
    stopAgentJoinMonitoring();

    // Clear any pending timeouts
    if (chatStartTimeoutId) {
      clearTimeout(chatStartTimeoutId);
      chatStartTimeoutId = null;
    }

    // Clear chat messages container if it exists
    const container = document.getElementById('chatx-messages');
    if (container) {
      container.innerHTML = '';
    }

    // Reset header to default state
    resetHeaderAvatar();
    const statusEl = document.getElementById('chatx-status');
    if (statusEl) {
      statusEl.textContent = "We're here to help";
    }

    ////console.log('ChatX: Chat state cleared');
  }

  function showEndChatConfirm() {
    // Remove existing modal if any
    const existingModal = document.getElementById('chatx-confirm-modal');
    if (existingModal) existingModal.remove();

    const widget = document.getElementById('chatx-window');
    if (!widget) return;

    const modal = document.createElement('div');
    modal.id = 'chatx-confirm-modal';
    modal.className = 'chatx-confirm-modal';
    modal.innerHTML = `
      <div class="chatx-confirm-dialog">
        <div class="chatx-confirm-text">Are you sure you want to end this chat?</div>
        <div class="chatx-confirm-buttons">
          <button class="chatx-confirm-btn yes" id="chatx-confirm-yes">Yes</button>
          <button class="chatx-confirm-btn no" id="chatx-confirm-no">No</button>
        </div>
      </div>
    `;

    widget.appendChild(modal);

    // Bind events
    document.getElementById('chatx-confirm-yes').addEventListener('click', () => {
      modal.remove();
      confirmEndChat();
    });

    document.getElementById('chatx-confirm-no').addEventListener('click', () => {
      modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  function confirmEndChat() {
    if (!socket || !chatId) return;

    const closedChatId = chatId;
    window.chatxClosedChatId = closedChatId;
    window.chatxVisitorEndedChat = true; // Flag to prevent socket handler from overwriting
    ////console.log('ChatX: Saved closed chat ID for rating:', closedChatId);

    socket.emit('chat:close', { chatId: chatId });
    currentChatStatus = 'closed';
    chatId = null;
    stopAgentJoinMonitoring(); // Stop monitoring when chat ends
    showChatEnded(null, true); // true = ended by visitor
  }

  function endChat() {
    if (!socket || !chatId) return;
    showEndChatConfirm();
  }

  function startNewChat() {
    // Reset state
    chatId = null;
    currentChatStatus = null;
    messages = [];
    agentJoined = false;
    window.chatxClosedChatId = null; // Clear saved chat ID
    window.chatxSelectedRating = null; // Clear rating selection
    window.chatxVisitorEndedChat = false; // Clear visitor ended flag
    stopAgentJoinMonitoring(); // Stop any previous monitoring

    // Clear messages container DOM
    const messagesContainer = document.getElementById('chatx-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }

    // Reset header avatar to default
    resetHeaderAvatar();

    // Reset header status
    const statusEl = document.getElementById('chatx-status');
    if (statusEl) {
      statusEl.textContent = "We're here to help";
    }

    // Show prechat form
    showPrechatForm();
  }

  async function sendMessage() {
    const input = document.getElementById('chatx-input');
    const content = input.value.trim();

    if (!content || !socket || !chatId) return;

    // Block immediately if we already know visitor is banned
    if (visitorBanned) {
      disableChatInputForBan(visitorBanInfo);
      return;
    }

    // Re-check ban status (covers IP-only bans applied during the session)
    const banResult = await checkBan(window.chatxVisitorEmail || '');
    if (banResult && banResult.banned) {
      disableChatInputForBan(banResult);
      return;
    }

    // Unlock audio on user interaction (sending message is a user gesture)
    unlockAudio();

    // Disable send button to prevent double-sending
    const sendBtn = document.getElementById('chatx-send');
    if (sendBtn.disabled && sendBtn.dataset.sending === 'true') {
      return; // Already sending
    }
    sendBtn.disabled = true;
    sendBtn.dataset.sending = 'true';

    // Stop typing indicator
    socket.emit('typing:stop', { chatId });

    socket.emit('message:send', {
      chatId: chatId,
      content: content,
    });

    // Clear input immediately (message will be added when server confirms via message:new)
    input.value = '';
    input.style.height = 'auto';

    // Re-enable button after short delay
    setTimeout(() => {
      sendBtn.disabled = !input.value.trim();
      delete sendBtn.dataset.sending;
    }, 300);
  }

  async function handleFileUpload(event) {
    ////console.log('🎯 File upload triggered', event.target.files);
    const file = event.target.files[0];
    if (!file) return;

    // Block attachments for banned visitors
    if (visitorBanned) {
      disableChatInputForBan(visitorBanInfo);
      event.target.value = '';
      return;
    }
    const banResult = await checkBan(window.chatxVisitorEmail || '');
    if (banResult && banResult.banned) {
      disableChatInputForBan(banResult);
      event.target.value = '';
      return;
    }

    ////console.log('📁 File selected:', file.name, file.type, file.size);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please select only JPG or PNG images.');
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('File size must be less than 5MB.');
      return;
    }

    ////console.log('✅ File validation passed');

    // Create FormData and upload
    const formData = new FormData();
    formData.append('file', file);

    // Show upload progress (optional)
    const sendBtn = document.getElementById('chatx-send');
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = '\u23F3';
    sendBtn.disabled = true;

    ////console.log('🚀 Uploading to:', `${SERVER_URL}/api/messages/upload`);

    fetch(`${SERVER_URL}/api/messages/upload`, {
      method: 'POST',
      body: formData
    })
      .then(response => {
        ////console.log('📡 Upload response status:', response.status);
        return response.json();
      })
      .then(result => {
        ////console.log('✅ Upload result:', result);
        if (result.success) {
          // Send message with file attachment
          socket.emit('message:send', {
            chatId: chatId,
            content: `\u{1F4F7} ${result.originalName}`,
            fileUrl: result.url,
            fileName: result.originalName,
            fileType: result.mimeType
          });
        } else {
          alert('Failed to upload image. Please try again.');
        }
      })
      .catch(error => {
        console.error('❌ Upload error:', error);
        alert('Failed to upload image. Please try again.');
      })
      .finally(() => {
        // Reset button
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
        // Clear file input
        event.target.value = '';
      });
  }

  // Function to convert URLs to clickable links
  function linkifyText(text) {
    if (!text) return text;

    // URL regex pattern - improved to avoid matching ellipsis (...) and invalid domains
    // Matches: https://... or http://... or www.domain.com or domain.com (but not ...com or .com)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[a-zA-Z0-9][^\s]*|(?<![.\-])\b[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}(?:[^\s]*)?)/gi;

    return text.replace(urlRegex, function (url) {
      // Skip if it looks like an ellipsis or starts with dots
      if (url.match(/^\.+/) || url.match(/\.{2,}/)) {
        return url;
      }
      let href = url;
      // Add http:// if missing
      if (!href.match(/^https?:\/\//)) {
        href = 'http://' + href;
      }
      return '<a href="' + href + '" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">' + url + '</a>';
    });
  }

  // Fetch image and convert to blob URL (hides actual server URL)
  async function fetchImageAsBlob(imageUrl) {
    // Check cache first
    if (imageBlobCache.has(imageUrl)) {
      return imageBlobCache.get(imageUrl);
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      imageBlobCache.set(imageUrl, blobUrl);
      return blobUrl;
    } catch (error) {
      console.error('ChatX: Error fetching image as blob:', error);
      return null;
    }
  }

  // Load image as blob and update img element
  function loadImageAsBlob(imgElement, originalUrl, imageName) {
    fetchImageAsBlob(originalUrl).then(blobUrl => {
      if (blobUrl && imgElement) {
        imgElement.src = blobUrl;
        imgElement.dataset.fullImage = blobUrl;
        imgElement.dataset.originalUrl = originalUrl; // Keep for download
        imgElement.classList.remove('chatx-image-loading');
      }
    });
  }

  function formatMessageContent(message) {
    let content = '';

    // If message has a file attachment, display the image
    if (message.fileUrl && message.fileType && message.fileType.startsWith('image/')) {
      const imageUrl = `${SERVER_URL}${message.fileUrl}`;
      const imageName = message.fileName || 'Image';
      const imageId = `chatx-img-${++imageIdCounter}`;
      // Use placeholder initially, will be replaced with blob URL
      content += `<img id="${imageId}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${imageName}" class="chatx-image-preview chatx-image-loading" data-original-url="${imageUrl}" data-image-name="${imageName}" style="max-width: 200px; max-height: 150px; border-radius: 8px; margin-top: 8px; border: 1px solid #e0e0e0; background: #f0f0f0;" />`;
      // Schedule blob loading after DOM update
      setTimeout(() => {
        const imgEl = document.getElementById(imageId);
        if (imgEl) {
          loadImageAsBlob(imgEl, imageUrl, imageName);
        }
      }, 0);
      if (message.content && !message.content.startsWith('\u{1F4F7}')) {
        // First escape HTML, then apply linkify
        const escapedContent = escapeHtml(message.content);
        content += `<br/>${linkifyText(escapedContent)}`;
      }
    } else if (message.content) {
      // First escape HTML, then apply linkify
      const escapedContent = escapeHtml(message.content);
      content = linkifyText(escapedContent);
    }

    return content;
  }

  // Typewriter effect for agent messages
  function typewriterEffect(element, html, speed = 15) {
    // Parse HTML to extract text and tags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // If content has images or complex HTML, show instantly
    if (tempDiv.querySelector('img') || tempDiv.querySelector('a')) {
      element.innerHTML = html;
      return Promise.resolve();
    }

    const text = tempDiv.textContent || '';
    element.innerHTML = '';

    return new Promise((resolve) => {
      let index = 0;
      const container = document.getElementById('chatx-messages');

      function type() {
        if (index < text.length) {
          element.textContent += text.charAt(index);
          index++;
          // Keep scrolling to bottom during typing
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
          setTimeout(type, speed);
        } else {
          // After typing, restore full HTML (for links etc)
          element.innerHTML = html;
          resolve();
        }
      }

      type();
    });
  }

  function addMessage(message, isRestoring = false) {
    // Filter out private notes - they should not be visible to visitors
    if (message.senderType === 'private_note') {
      ////console.log('ChatX: Filtering out private note from visitor view');
      return;
    }

    // Handle system messages as status messages (not bubbles)
    if (message.senderType === 'system') {
      addSystemMessage(message.content);
      return;
    }

    const container = document.getElementById('chatx-messages');
    if (!container) {
      console.error('ChatX: Messages container not found in addMessage!');
      return;
    }

    // Prevent duplicate messages
    if (message.id && container.querySelector(`[data-msg-id="${message.id}"]`)) {
      ////console.log('ChatX: Skipping duplicate message', message.id);
      return;
    }

    // Add to messages array for tracking (avoid duplicates)
    if (message.id && !messages.find(m => m.id === message.id)) {
      messages.push(message);
      //console.log('ChatX: Added message to array with ID:', message.id, 'isRead:', message.isRead);
    }

    ////console.log('ChatX: Adding message to DOM:', message.senderType, message.content?.substring(0, 30));

    const isVisitor = message.senderType === 'visitor';
    const agentName = message.agent?.name || window.chatxCurrentAgent?.name || 'Agent';
    const agentAvatar = message.agent?.avatar || window.chatxCurrentAgent?.avatar;
    const visitorName = 'You';

    // Create new message element
    const div = document.createElement('div');
    div.className = 'chatx-message ' + (isVisitor ? 'visitor' : 'agent');

    // Add animation class for new messages (not restoring from history)
    if (!isRestoring) {
      div.classList.add('chatx-new-message');
    }

    if (message.id) {
      div.setAttribute('data-msg-id', message.id);
    }
    div.setAttribute('data-timestamp', new Date(message.createdAt).getTime());

    if (isVisitor) {
      div.innerHTML = `
              <div class="chatx-message-content">
                <div class="chatx-message-sender">${visitorName}</div>
                <div class="chatx-message-bubble">
                  ${formatMessageContent(message)}
                  <div class="chatx-message-meta">
                    <span class="chatx-message-time">${formatTime(message.createdAt)}</span>
                    <span class="chatx-message-status ${message.isRead ? 'read' : ''}">
                      ${message.isRead ? 'done_all' : 'done'}
                    </span>
                  </div>
                </div>
              </div>
            `;
    } else {
      const avatarUrl = resolveAssetUrl(agentAvatar);

      const messageContentId = `chatx-msg-content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const formattedContent = formatMessageContent(message);

      div.innerHTML = `
              <div class="chatx-message-avatar">
                ${avatarUrl
          ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                   <svg viewBox="0 0 24 24" style="display:none;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
          : `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
        }
              </div>
              <div class="chatx-message-content">
                <div class="chatx-message-sender">
                  ${escapeHtml(agentName)}
                  <span class="chatx-staff-badge">Staff</span>
                </div>
                <div class="chatx-message-bubble">
                  <span id="${messageContentId}" class="chatx-message-text"></span>
                  <div class="chatx-message-meta">
                    <span class="chatx-message-time">${formatTime(message.createdAt)}</span>
                  </div>
                </div>
              </div>
            `;

      // Apply typewriter effect for new agent messages (not restoring)
      if (!isRestoring && formattedContent) {
        hideTypingIndicator();
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;

        // Start typewriter effect
        const contentEl = document.getElementById(messageContentId);
        if (contentEl) {
          typewriterEffect(contentEl, formattedContent, 12);
        }
        return; // Exit early since we already appended
      } else {
        // For restored messages, show content immediately
        const contentEl = div.querySelector(`#${messageContentId}`);
        if (contentEl) {
          contentEl.innerHTML = formattedContent;
        }
      }
    }

    hideTypingIndicator();
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addSystemMessage(text) {
    const container = document.getElementById('chatx-messages');
    if (!container) {
      console.error('ChatX: Messages container not found in addSystemMessage!');
      return;
    }

    // Prevent duplicate system messages with the same text
    const existingMessages = container.querySelectorAll('.chatx-system-message .chatx-system-message-text');
    for (const existing of existingMessages) {
      if (existing.textContent.trim() === text.trim()) {
        //console.log('ChatX: Skipping duplicate system message:', text);
        return;
      }
    }

    const div = document.createElement('div');
    div.className = 'chatx-system-message';
    div.innerHTML = `
      <div class="chatx-system-message-text">
        ${escapeHtml(text)}
      </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addIdleSystemMessage(text) {
    const container = document.getElementById('chatx-messages');
    if (!container) {
      console.error('ChatX: Messages container not found in addIdleSystemMessage!');
      return;
    }

    const div = document.createElement('div');
    div.className = 'chatx-system-message chatx-chat-idle';
    div.innerHTML = `
      <div class="chatx-system-message-text">
        ${escapeHtml(text)}
      </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function updateMessageReadStatus(messageIds) {
    if (!Array.isArray(messageIds)) {
      messageIds = [messageIds];
    }

    //console.log('ChatX: Updating read status for messages:', messageIds);

    messageIds.forEach(messageId => {
      // Update in-memory messages array
      const message = messages.find(msg => msg.id === messageId);
      if (message) {
        message.isRead = true;
        //console.log(`ChatX: Updated in-memory message ${messageId} to read`);
      }

      // Update DOM - find message element regardless of type (visitor or agent)
      const messageElement = document.querySelector(`[data-msg-id="${messageId}"]`);
      if (messageElement) {
        const statusElement = messageElement.querySelector('.chatx-message-status');
        if (statusElement) {
          statusElement.classList.add('read');
          statusElement.textContent = 'done_all';
          //console.log(`ChatX: Updated DOM for message ${messageId} - now shows double checkmark`);
        } else {
          //console.log(`ChatX: No status element found for message ${messageId}`);
        }
      } else {
        //console.log(`ChatX: Message element not found in DOM for ${messageId}`);
      }
    });
  }

  function updateHeaderAvatar(agent) {
    const avatarContainer = document.getElementById('chatx-header-avatar');
    if (!avatarContainer) return;

    const agentAvatar = agent?.avatar;
    const agentName = agent?.name || 'Agent';

    if (agentAvatar) {
      const avatarUrl = resolveAssetUrl(agentAvatar);

      avatarContainer.innerHTML = `
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:none;">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
        </svg>
      `;
    }
  }

  // Reset header avatar to default icon
  function resetHeaderAvatar() {
    const avatarContainer = document.getElementById('chatx-header-avatar');
    if (!avatarContainer) return;

    avatarContainer.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>
    `;
  }

  function markChatMessagesAsRead() {
    if (!socket || !chatId) {
      //console.log('ChatX: markChatMessagesAsRead - no socket or chatId');
      return;
    }

    // Only mark as read if the browser tab is actively visible
    // This prevents marking messages as read when the customer is on another tab
    if (document.visibilityState !== 'visible') {
      return;
    }

    // Get all unread agent messages from the messages array
    const unreadAgentMessages = messages.filter(msg =>
      msg.senderType === 'agent' && !msg.isRead && msg.id
    );

    //console.log('ChatX: markChatMessagesAsRead - found', unreadAgentMessages.length, 'unread agent messages');

    if (unreadAgentMessages.length > 0) {
      const messageIds = unreadAgentMessages.map(msg => msg.id);
      //console.log(`ChatX: Marking ${messageIds.length} agent messages as read:`, messageIds);

      socket.emit('messages:read', {
        chatId: chatId,
        messageIds: messageIds
      });

      // Update local state
      unreadAgentMessages.forEach(msg => {
        msg.isRead = true;
      });
    }
  }

  function showAgentJoined(agent, force = false, insertBeforeElement = null) {
    const container = document.getElementById('chatx-messages');
    if (!container) return;

    // Check for explicit "Agent Joined" messages to prevent grouping/layout issues
    // No visibility check needed anymore as we are just appending to DOM flow

    const agentName = agent?.name || 'Agent';

    // Agent has joined - hide queue status
    agentJoined = true;
    hideQueueStatus();
    stopAgentJoinMonitoring();

    // Check if we already have a join message for this agent
    // This prevents duplicates on refresh/restore and polling
    const existingMessages = container.querySelectorAll('.chatx-agent-joined');
    let alreadyShown = false;
    existingMessages.forEach(msg => {
      if (msg.textContent.includes(agentName)) {
        alreadyShown = true;
      }
    });

    if (alreadyShown && !force) {
      return;
    }

    // If force is true, we only show if NOT already shown to avoid moving it to bottom
    // The previous logic removed it and re-added it, causing the "footer" effect.
    if (force && alreadyShown) {
      return;
    }

    const div = document.createElement('div');
    // Use system message class for styling, plus specific class for tracking
    div.className = 'chatx-system-message chatx-agent-joined';
    div.innerHTML = `
      <div class="chatx-system-message-text">
        ${escapeHtml(agentName)} joined the chat
      </div>
    `;

    // If insertBeforeElement is provided, use it
    if (insertBeforeElement && insertBeforeElement.parentNode === container) {
      container.insertBefore(div, insertBeforeElement);
    } else {
      // Intelligent positioning: Try to find the first message from this agent
      // and insert the "Joined" message before it. This fixes the "footer" issue on refresh.
      let inserted = false;
      const agentMessages = container.querySelectorAll('.chatx-message.agent');

      for (let i = 0; i < agentMessages.length; i++) {
        const msg = agentMessages[i];
        const sender = msg.querySelector('.chatx-message-sender');
        // Check if this message is from the joining agent
        // (Using generous text matching since name might have badges etc)
        if (sender && sender.textContent.includes(agentName)) {
          container.insertBefore(div, msg);
          inserted = true;
          ////console.log('ChatX: Inserted join message before first agent message');
          break;
        }
      }

      // If no agent messages found (or agent hasn't spoken yet), append to end
      if (!inserted) {
        container.appendChild(div);
      }
    }
    container.scrollTop = container.scrollHeight;
  }

  // Monitor for agent join status and show notification if missed
  function checkAndShowAgentJoinIfNeeded() {
    // Check if we have a chat ID and agent info is available
    if (chatId && window.chatxCurrentAgent && !agentJoined) {
      const container = document.getElementById('chatx-messages');
      const hasAgentJoinedMessage = container && container.querySelector('.chatx-agent-joined');

      if (!hasAgentJoinedMessage) {
        //console.log('ChatX: Detected missing agent joined notification, showing now');
        // Update status to active since we have an agent
        currentChatStatus = 'active';
        // Show the agent joined notification
        showAgentJoined(window.chatxCurrentAgent, true);

        // Persist to DB: If we had to force-show this, it means the DB likely missed the event
        // (e.g. auto-assignment). Emit event to ensure it's saved for history.
        if (socket && socket.connected) {
          ////console.log('ChatX: Emitting missing agent:joined-chat event');
          socket.emit('agent:joined-chat', {
            chatId: chatId,
            agentId: window.chatxCurrentAgent.id,
            agentName: window.chatxCurrentAgent.name,
            joinedAt: new Date().toISOString()
          });
        }
      }
    }

    // Poll server for chat status every interval to check if agent assigned
    if (chatId && !agentJoined && socket && socket.connected) {
      socket.emit('chat:status', { chatId: chatId });
    }

    // Also poll for new messages to ensure we don't miss any
    if (chatId && socket && socket.connected) {
      socket.emit('messages:poll', { chatId: chatId });
    }
  }

  // Start monitoring for agent join events - poll every 1 second
  function startAgentJoinMonitoring() {
    if (agentJoinMonitor) return;
    //console.log('ChatX: Starting agent join monitoring (1s interval)');
    // Run immediately once
    checkAndShowAgentJoinIfNeeded();
    // Then poll every 1 second
    agentJoinMonitor = setInterval(checkAndShowAgentJoinIfNeeded, 1000);
  }

  // Stop monitoring for agent join events
  function stopAgentJoinMonitoring() {
    if (agentJoinMonitor) {
      //console.log('ChatX: Stopping agent join monitoring');
      clearInterval(agentJoinMonitor);
      agentJoinMonitor = null;
    }
  }

  // Start polling agent status every second
  function startAgentStatusPolling() {
    if (agentStatusPollInterval) return; // Already polling
    //console.log('ChatX: Starting agent status polling (1s interval)');

    agentStatusPollInterval = setInterval(() => {
      if (socket && isConnected) {
        socket.emit('departments:get');
        // Avatar refresh is handled by cache TTL inside fetchAgentAvatars
        fetchAgentAvatars();
      }
    }, 30000); // Poll every 30 seconds
  }

  // Stop polling agent status
  function stopAgentStatusPolling() {
    if (agentStatusPollInterval) {
      //console.log('ChatX: Stopping agent status polling');
      clearInterval(agentStatusPollInterval);
      agentStatusPollInterval = null;
    }
  }

  // Note: addSystemMessage is defined earlier in the file with deduplication logic

  function showTypingIndicator() {
    const container = document.getElementById('chatx-messages');
    let indicator = document.getElementById('chatx-typing-indicator');

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'chatx-typing-indicator';
      indicator.className = 'chatx-message agent';

      const agentAvatar = window.chatxCurrentAgent?.avatar;
      const agentName = window.chatxCurrentAgent?.name || 'Agent';
      const avatarUrl = resolveAssetUrl(agentAvatar);

      indicator.innerHTML = `
        <div class="chatx-message-avatar">
          ${avatarUrl
          ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(agentName)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
             <svg viewBox="0 0 24 24" style="display:none;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
          : `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
        }
        </div>
        <div class="chatx-typing">
          <div class="chatx-typing-dot"></div>
          <div class="chatx-typing-dot"></div>
          <div class="chatx-typing-dot"></div>
        </div>
      `;
      container.appendChild(indicator);
      container.scrollTop = container.scrollHeight;
    }
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById('chatx-typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function updateVisitorPage() {
    if (socket && visitorId) {
      socket.emit('visitor:page', { page: window.location.href });
    }
  }

  // Utilities
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  // Debug function to test agent joined manually
  window.testAgentJoined = function () {
    ////console.log('===== Testing Agent Joined Manually =====');
    const testAgent = { name: 'Test Agent', id: 'test-123' };
    showAgentJoined(testAgent, true);
  };

  // Debug function to test with current agent
  window.testCurrentAgent = function () {
    ////console.log('===== Testing Current Agent =====');
    if (window.chatxCurrentAgent) {
      ////console.log('Found current agent:', window.chatxCurrentAgent);
      showAgentJoined(window.chatxCurrentAgent, true);
    } else {
      ////console.log('No current agent found');
      // Try to use the admin user from the message
      const adminAgent = { name: 'Admin User', id: 'admin-user' };
      showAgentJoined(adminAgent, true);
    }
  };

  // Debug function to check widget state
  window.debugWidgetState = function () {
    ////console.log('===== Widget Debug State =====');
    ////console.log('chatId:', chatId);
    ////console.log('currentChatStatus:', currentChatStatus);
    ////console.log('socket connected:', socket?.connected);
    ////console.log('messages container:', document.getElementById('chatx-messages'));
    ////console.log('agent joined elements:', document.querySelectorAll('.chatx-agent-joined').length);
    ////console.log('window.chatxCurrentAgent:', window.chatxCurrentAgent);
    ////console.log('===== End Debug State =====');
  };

  // ===== Public Auto-Login API =====
  // Use from your portal page after the user is logged in:
  //   ChatXWidget.autoLogin({ email, password, name, clientId })   // verifies via WHMCS
  //   ChatXWidget.autoLogin({ email, name, clientId })             // trusts the host page (no password)
  //   ChatXWidget.logout()
  function applyAutoLogin(userData) {
    whmcsData = userData;
    window.chatxAutoLoggedIn = true;

    const nameField = document.getElementById('chatx-name');
    const emailField = document.getElementById('chatx-email');
    if (nameField) {
      nameField.value = userData.name || '';
      nameField.setAttribute('readonly', true);
    }
    if (emailField) {
      emailField.value = userData.email || '';
      emailField.setAttribute('readonly', true);
    }

    // If a support department was already selected, switch to "logged in" success view
    if ((selectedDepartmentName || '').toLowerCase() === 'support') {
      const loginEl = document.getElementById('chatx-whmcs-login');
      if (loginEl && loginEl.style.display !== 'none') {
        showWhmcsSuccess(userData);
      }
    }
  }

  window.ChatXWidget = window.ChatXWidget || {};
  window.ChatXWidget.autoLogin = async function (data) {
    if (!data || !data.email) return { success: false, message: 'email is required' };

    if (data.password) {
      try {
        const response = await fetch(`${SERVER_URL}/api/whmcs/authenticate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            companyName: COMPANY_NAME,
          }),
        });
        const result = await response.json();
        if (result && result.success) {
          applyAutoLogin(result.data);
          return { success: true, data: result.data };
        }
        return { success: false, message: (result && result.message) || 'Authentication failed' };
      } catch (e) {
        return { success: false, message: e.message };
      }
    }

    applyAutoLogin({
      name: data.name || '',
      email: data.email,
      clientId: data.clientId,
      userId: data.userId,
    });
    return { success: true, data: whmcsData };
  };

  window.ChatXWidget.logout = function () {
    whmcsData = null;
    window.chatxAutoLoggedIn = false;
    const nameField = document.getElementById('chatx-name');
    const emailField = document.getElementById('chatx-email');
    if (nameField) {
      nameField.value = '';
      nameField.removeAttribute('readonly');
    }
    if (emailField) {
      emailField.value = '';
      emailField.removeAttribute('readonly');
    }
    const prechatHeader = document.querySelector('.chatx-prechat-header p');
    if (prechatHeader) {
      prechatHeader.textContent = 'Welcome to our LiveChat! Please fill in the form below before starting the chat';
    }
  };

  // Process any auto-login data the host page set BEFORE the widget loaded
  function processQueuedAutoLogin() {
    // 1) Script-tag attributes (simple integration)
    const attrEmail = SCRIPT_TAG?.getAttribute('data-auto-email');
    const attrPassword = SCRIPT_TAG?.getAttribute('data-auto-password');
    const attrName = SCRIPT_TAG?.getAttribute('data-auto-name');
    const attrClientId = SCRIPT_TAG?.getAttribute('data-auto-client-id');
    if (attrEmail) {
      window.ChatXWidget.autoLogin({
        email: attrEmail,
        password: attrPassword || undefined,
        name: attrName || undefined,
        clientId: attrClientId || undefined,
      });
      return;
    }

    // 2) Pre-init global object: window.ChatXAutoLogin = { email, password, name, clientId }
    if (window.ChatXAutoLogin && window.ChatXAutoLogin.email) {
      window.ChatXWidget.autoLogin(window.ChatXAutoLogin);
    }
  }

  // Initialize
  function initializeWidget() {
    // Create the widget - always fresh start on page load
    createWidget();

    // Mark widget as initialized
    window.chatxInitialized = true;

    //console.log('ChatX: Widget initialized - fresh session');

    // Apply auto-login data set before/at script load (so name/email pre-fill on first open)
    processQueuedAutoLogin();

    // Fetch widget settings from server and apply them
    fetchWidgetSettings();

    // Start periodic wiggle animation to attract attention
    startButtonWiggleAnimation();

    // Show mini popup after delay if not dismissed
    showMiniPopupWithDelay();

    // When browser tab becomes visible again, flush any unread agent messages
    // so the customer sees the read receipts update when they return to the tab
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && isOpen && socket && chatId && currentChatStatus === 'active') {
        markChatMessagesAsRead();
      }
    });
  }

  // Show mini popup notification after a delay
  function showMiniPopupWithDelay() {
    // Check if user has dismissed it this session
    if (sessionStorage.getItem('chatx_mini_popup_dismissed') === 'true') {
      return;
    }

    // Show popup after 3 seconds if widget is not open
    setTimeout(() => {
      if (!isOpen) {
        const miniPopup = document.getElementById('chatx-mini-popup');
        if (miniPopup) {
          miniPopup.classList.add('show');
        }
      }
    }, 3000);
  }

  // Periodic wiggle animation for the chat button
  function startButtonWiggleAnimation() {
    const button = document.getElementById('chatx-toggle');
    if (!button) return;

    // Wiggle every 8 seconds when widget is closed
    setInterval(() => {
      if (!isOpen) {
        button.classList.add('chatx-button-wiggle');
        // Remove class after animation completes (0.6s)
        setTimeout(() => {
          button.classList.remove('chatx-button-wiggle');
        }, 600);
      }
    }, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }
})();
