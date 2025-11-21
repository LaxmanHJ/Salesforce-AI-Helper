
// Wait for page to fully load
window.addEventListener('load', function () {
  console.log('Salesforce Helper Extension Loaded!');

  // Add a custom button to Salesforce
  addCustomButton();

  // Listen for URL changes (Salesforce is a single-page app)
  observeUrlChanges();
});

// Function to add a custom button
function addCustomButton() {
  // Check if button already exists
  if (document.getElementById('sf-helper-btn')) return;

  // Create the button
  const button = document.createElement('button');
  button.id = 'sf-helper-btn';
  button.className = 'sf-helper-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Salesforce Quick Helper');
  button.title = 'Salesforce Quick Helper';
  button.innerHTML = '🚀 Quick Helper';
  // Ensure styles are loaded from the extension stylesheet (`button.css`).
  // Inject the stylesheet once using a reliably-deterministic URL from the
  // extension runtime. Fall back to a relative path if runtime helpers are
  // not available (useful during local dev).
  if (!document.getElementById('sf-helper-css')) {
    const link = document.createElement('link');
    link.id = 'sf-helper-css';
    link.rel = 'stylesheet';
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        link.href = chrome.runtime.getURL('button.css');
      } else if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getURL) {
        link.href = browser.runtime.getURL('button.css');
      } else {
        // Fallback to relative path when running outside of the extension
        link.href = 'button.css';
      }
    } catch (e) {
      link.href = 'button.css';
    }
    document.head.appendChild(link);
  }

  // Add click handler (unchanged behavior)
  button.addEventListener('click', function () {
    showHelperModal();
  });

  // Append to body to avoid being hidden/clipped by Salesforce elements
  // (there's an early-return above if element already exists to prevent dupes)
  document.body.appendChild(button);
}

// Load React and ReactDOM if not already loaded
async function loadReact() {
  if (window.React && window.ReactDOM) return;

  console.log('Loading React...');
  try {
    // We use dynamic imports to load the libraries from the extension
    await import(chrome.runtime.getURL('lib/react.development.js'));
    await import(chrome.runtime.getURL('lib/react-dom.development.js'));
    console.log('React loaded!');
  } catch (e) {
    console.error('Failed to load React:', e);
    throw e;
  }
}

// Fetch User Info via Background Service
async function fetchUserInfo() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'FETCH_USER_INFO',
      instanceUrl: window.location.href
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        resolve(null); // Resolve null to avoid breaking the flow
      } else if (response && response.error) {
        console.error('UserInfo error:', response.error);
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

// Function to show a modal with helpful information (React Version)
async function showHelperModal() {
  try {
    await loadReact();

    // Import the Modal component dynamically
    const { Modal } = await import(chrome.runtime.getURL('src/content/Modal.js'));
    const htmModule = await import(chrome.runtime.getURL('lib/htm.js'));
    const htm = htmModule.default;

    // Bind htm to React
    const h = htm.bind(window.React.createElement);

    // Get current URL information
    const url = window.location.href;
    const recordId = extractRecordId(url);

    // Create or get modal container
    let modalContainer = document.getElementById('sf-helper-react-root');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'sf-helper-react-root';
      document.body.appendChild(modalContainer);
    }

    // Mount the React app
    const root = window.ReactDOM.createRoot(modalContainer);

    const handleClose = () => {
      root.unmount();
      modalContainer.remove();
    };

    // State
    let userInfo = null;

    // Function to render the modal with current state
    const renderModal = (loadingState = true) => {
      root.render(h`<${Modal} 
        url=${url} 
        recordId=${recordId} 
        userInfo=${userInfo}
        loading=${loadingState}
        onClose=${handleClose} 
      />`);
    };

    // Initial render with loading state
    renderModal(true);

    // Fetch Data via background
    fetchUserInfo().then(info => {
      userInfo = info;
      // Re-render with data
      renderModal(false);
    });

  } catch (e) {
    console.error('Error showing modal:', e);
    alert('Failed to load the helper modal. Please reload the page.');
  }
}

// Extract Record ID from URL
function extractRecordId(url) {
  // Match 15 or 18 character Salesforce IDs
  const match = url.match(/\/([a-zA-Z0-9]{15,18})\//);
  return match ? match[1] : null;
}

// Open Salesforce Developer Console in a new tab
function openDevConsole() {
  try {
    const baseUrl = window.location.origin;
    // ApexCSIPage is a common entry for the developer console
    const devConsoleUrl = `${baseUrl} / _ui / common / apex / debug / ApexCSIPage`;
    window.open(devConsoleUrl, '_blank');
  } catch (e) {
    console.error('Failed to open Dev Console:', e);
  }
}



// Observe URL changes in Salesforce (SPA navigation)
function observeUrlChanges() {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('URL changed to:', url);
      // Re-add button if needed
      setTimeout(addCustomButton, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
}