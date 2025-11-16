document.getElementById('openCurrent').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  chrome.scripting.executeScript({
    target: {tabId: tab.id},
    function: () => {
      const event = new CustomEvent('sf-helper-show-modal');
      window.dispatchEvent(event);
    }
  });
  window.close();
});

document.getElementById('openSetup').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const baseUrl = new URL(tab.url).origin;
  chrome.tabs.create({url: `${baseUrl}/lightning/setup/SetupOneHome/home`});
});

document.getElementById('openDevConsole').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  const baseUrl = new URL(tab.url).origin;
  chrome.tabs.create({url: `${baseUrl}/_ui/common/apex/debug/ApexCSIPage`});
});