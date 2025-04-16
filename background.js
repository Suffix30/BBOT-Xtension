// Toggle sidebar when toolbar button is clicked
browser.browserAction.onClicked.addListener(() => {
    browser.sidebarAction.toggle();
  });
  
  const URLs = /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g;
  const logOutputs = /\/home\/[^\/]+\/\.bbot\/scans\/[^\/]+\/\S+/g;
  
  let port = null;
  let scanOutput = "";
  let subdomains = "";
  let hosts = new Set();
  let stream = 1;
  
  function connectNative() {
      port = browser.runtime.connectNative("bbot_host");
  
      port.onMessage.addListener((message) => {
          if (message.type === "scanResult") {
              scanOutput += message.data + "\n";
              if (stream == 1) {
                  browser.runtime.sendMessage({ type: "updateOutput", data: scanOutput });
              } else {
                  console.log("Streaming paused");
              }
          } else if (message.type === "error") {
              scanOutput += `[ERROR] ${message.data}\n`;
              browser.runtime.sendMessage({ type: "updateOutput", data: scanOutput });
          }
      });
  
      port.onDisconnect.addListener(() => {
          console.log("Disconnected from bbot_host");
          port = null;
      });
  }
  
  function extractInfo(scanOutput) {
      console.log("Raw Scan Output:", scanOutput);
      const markers = scanOutput.match(URLs) || [];
      const uniqueMarkers = [...new Set(markers)];
      console.log("Extracted Markers (Unique):", uniqueMarkers);
      return { markers: uniqueMarkers };
  }
  
  function extractOutput(scanOutput) {
      console.log("Raw Scan Output:", scanOutput);
      const outputs = scanOutput.match(logOutputs) || [];
      const uniqueOutputs = [...new Set(outputs)];
      return { outputs: uniqueOutputs };
  }
  
  function fetchSubdomains(filePath) {
      return new Promise((resolve, reject) => {
          browser.runtime.sendNativeMessage("bbot_host", { command: "getSubdomains", subdomains: filePath })
              .then(response => {
                  if (response.error) {
                      console.error("Error loading subdomains:", response.error);
                      reject("Failed to load subdomains.");
                  } else {
                      console.log("Subdomains:", response.data);
                      subdomains = response.data;
                      resolve(response.data);
                  }
              })
              .catch(error => {
                  console.error("Native Message Error:", error);
                  reject("Error communicating with bbot_host.");
              });
      });
  }
  
  connectNative();
  
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!port) {
          connectNative();
      }
      
      if (msg.type === "runCommand") {
          port.postMessage({
              command: "shell",
              script: `cd ${msg.cwd || '.'} && ${msg.command}`
          });
      } else if (msg.type === "deployBbot") {
          port.postMessage({
              command: "shell",
              script: "cd /home/net/Desktop/BBOT-Grok-1 && chmod +x deploy.sh && ./deploy.sh"
          });
      }
  
      if (msg.type === "runScan") {
          hosts.add(msg.target);
          const eventType = msg.eventType ? msg.eventType : "*";
  
          port.postMessage({
              command: "scan",
              target: msg.target,
              scantype: msg.scanType,
              deadly: msg.deadly,
              eventtype: eventType,
              moddep: msg.moddep,
              flagtype: msg.flagType,
              burp: msg.burp,
              viewtype: msg.viewtype,
              scope: msg.scope
          });
      } else if (msg.type === "getOutput") {
          stream = 1;
          browser.runtime.sendMessage({ type: "updateOutput", data: scanOutput });
      } else if (msg.type === "getHosts") {
          browser.runtime.sendMessage({ type: "updateHosts", data: Array.from(hosts).join('\n') });
      } else if (msg.type === "clearOutput") {
          scanOutput = "";
          browser.runtime.sendMessage({ type: "updateOutput", data: scanOutput });
      } else if (msg.type === "clearHosts") {
          hosts.clear();
          browser.runtime.sendMessage({ type: "updateHosts", data: "" });
      } else if (msg.type === "getURLS") {
          const extractedData = extractInfo(scanOutput);
          let formattedOutput = `Extracted Markers:\n${extractedData.markers.join('\n')}`;
          console.log("Extracted Data Sent:", formattedOutput);
          browser.runtime.sendMessage({ type: "updateURLs", data: formattedOutput });
      } else if (msg.type === "getOutfile") {
          const extractedData = extractOutput(scanOutput);
          let formattedOutput = `Extracted Outfile:\n${extractedData.outputs.join('\n')}`;
          console.log("Extracted Data Sent:", formattedOutput);
          browser.runtime.sendMessage({ type: "updateOutfiles", data: formattedOutput });
      } else if (msg.type === "runCommand") {
          port.postMessage({
              command: "shell",
              script: `cd ${msg.cwd || '.'} && ${msg.command}`
          });
      } else if (msg.type === "killScan") {
          port.postMessage({ command: "killScan" });
      } else if (msg.type === "getSubdomains") {
          fetchSubdomains(msg.subdomains)
              .then(data => browser.runtime.sendMessage({ type: "updateSubdomains", data: data }))
              .catch(error => browser.runtime.sendMessage({ type: "updateSubdomains", data: error }));
      } else if (msg.type === "toggleStream") {
          stream = msg.stream ? 1 : 0;
          console.log(stream == 1 ? "Streaming enabled" : "Streaming disabled");
          if (stream == 1) {
              browser.runtime.sendMessage({ type: "updateOutput", data: scanOutput });
          }
      }
  });