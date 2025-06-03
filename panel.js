document.addEventListener('DOMContentLoaded', function() {
  const targetInput = document.getElementById('target');
  const scanButton = document.getElementById('scanButton');
  const scanSelect = document.getElementById('scanSelect');
  const eventTypeSelect = document.getElementById('eventTypeSelect');
  const deadlySelect = document.getElementById('deadly');
  const moduleSelect = document.getElementById('modDeps');
  const flagSelect = document.getElementById('flagSelect');
  const resultsContainer = document.getElementById('results');
  const burpsuite = document.getElementById('burpsuite');
  const viewPreset = document.getElementById('viewPreset');
  const strictScope = document.getElementById('strictScope');
  const getUrlsBtn = document.getElementById('getUrlsBtn');
  const getOutfileBtn = document.getElementById('getOutfileBtn');
  const clearOutputBtn = document.getElementById('clearOutputBtn');
  const clearHostsBtn = document.getElementById('clearHostsBtn');
  const getOutputBtn = document.getElementById('getOutputBtn');
  const getHostsBtn = document.getElementById('getHostsBtn');

  // Load previous results from storage with delay and error handling
  setTimeout(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        chrome.storage.local.get(['lastScan'], function(result) {
          if (result.lastScan) {
            displayResults(result.lastScan);
          }
        });
      } catch (error) {
        console.error('Failed to access chrome.storage.local:', error);
      }
    }
  }, 100);

  // Listen for updates from background.js
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "updateOutput") {
        resultsContainer.innerHTML = `<pre>${message.data}</pre>`;
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
      } else if (message.type === "updateHosts") {
        const hostsArea = document.getElementById('hostsArea');
        if (hostsArea) {
          hostsArea.textContent = message.data;
        }
      }
    });
  }

  scanButton.addEventListener('click', function() {
    const target = targetInput.value.trim();
    if (!target) {
      alert('Please enter a target domain');
      return;
    }

    resultsContainer.innerHTML = '<div class="loading">Scanning target...</div>';

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: "runScan",
        target: target,
        scanType: scanSelect.value,
        deadly: deadlySelect.value.trim(),
        eventType: eventTypeSelect.value.trim() || "*",
        moddep: moduleSelect.value.trim(),
        flagType: flagSelect.value.trim(),
        burp: burpsuite.checked,
        viewtype: viewPreset.checked,
        scope: strictScope.checked
      });
    }
  });

  getUrlsBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "getURLS" });
    }
  });

  getOutfileBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "getOutfile" });
    }
  });

  clearOutputBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "clearOutput" });
    }
  });

  clearHostsBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "clearHosts" });
    }
  });

  getOutputBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "getOutput" });
    }
  });

  getHostsBtn.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "getHosts" });
    }
  });
});
