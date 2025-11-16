
// Wait for page to fully load
window.addEventListener('load', function() {
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
  button.addEventListener('click', function() {
    showHelperModal();
  });

  // Append to body to avoid being hidden/clipped by Salesforce elements
  // (there's an early-return above if element already exists to prevent dupes)
  document.body.appendChild(button);
}

// Function to show a modal with helpful information
function showHelperModal() {
  // Get current URL information
  const url = window.location.href;
  const recordId = extractRecordId(url);
  const orgId = extractOrgId();
  const userName = getUserName();
  
  // Create modal container
  const modal = document.createElement('div');
  modal.id = 'sf-helper-modal';
  modal.className = 'sf-helper-modal';
  
  // Fetch popup.html and extract the modal template
  const extensionUrl = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
    ? chrome.runtime.getURL('popup.html')
    : 'popup.html';
  
  fetch(extensionUrl)
    .then(response => response.text())
    .then(html => {
      // Parse the HTML to extract the template
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const template = doc.querySelector('#sf-helper-modal-template');
      
      if (template) {
        // Clone the template content
        const modalContent = template.content.cloneNode(true);
        modal.appendChild(modalContent);
        
        // Populate dynamic data
        const urlElement = modal.querySelector('#modal-url');
        const recordIdElement = modal.querySelector('#modal-record-id');
        const recordIdContainer = modal.querySelector('#modal-record-id-container');
        const orgIdElement = modal.querySelector('#modal-org-id');
        const orgIdContainer = modal.querySelector('#modal-org-id-container');
        const userElement = modal.querySelector('#modal-user');
        const copyBtn = modal.querySelector('#copy-record-id');
        
        // Set values
        if (urlElement) urlElement.textContent = url;
        if (recordIdElement && recordId) {
          recordIdElement.textContent = recordId;
          recordIdContainer.style.display = 'block';
        }
        if (orgIdElement && orgId) {
          orgIdElement.textContent = orgId;
          orgIdContainer.style.display = 'block';
        }
        if (userElement) userElement.textContent = userName;
        if (copyBtn && !recordId) copyBtn.disabled = true;
        
        // Add event listeners
        const closeBtn = modal.querySelector('.sf-helper-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function() {
            modal.remove();
          });
        }
        
        if (recordId && copyBtn) {
          copyBtn.addEventListener('click', function() {
            navigator.clipboard.writeText(recordId);
            alert('Record ID copied to clipboard!');
          });
        }
        
        const setupBtn = modal.querySelector('#open-setup');
        if (setupBtn) {
          setupBtn.addEventListener('click', function() {
            window.open('/lightning/setup/SetupOneHome/home', '_blank');
          });
        }
        
        // Close on outside click
        modal.addEventListener('click', function(e) {
          if (e.target === modal) {
            modal.remove();
          }
        });
      }
      
      document.body.appendChild(modal);
    })
    .catch(error => {
      console.error('Failed to load popup.html:', error);
      // Fallback: use inline HTML if fetch fails
      modal.innerHTML = `
        <div class="sf-helper-modal-content">
          <span class="sf-helper-close">&times;</span>
          <h2>Salesforce Quick Helper</h2>
          <div class="sf-helper-info">
            <p><strong>Current URL:</strong><br>${url}</p>
            ${recordId ? `<p><strong>Record ID:</strong><br>${recordId}</p>` : ''}
            ${orgId ? `<p><strong>Org ID:</strong><br>${orgId}</p>` : ''}
            <p><strong>User:</strong><br>${userName}</p>
            <hr>
            <p><em>This is a starter template. Customize it for your needs!</em></p>
          </div>
          <div class="sf-helper-actions">
            <button id="copy-record-id" ${!recordId ? 'disabled' : ''}>
              Copy Record ID
            </button>
            <button id="open-setup">Open Setup</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Add event listeners for fallback
      modal.querySelector('.sf-helper-close').addEventListener('click', function() {
        modal.remove();
      });
      
      if (recordId) {
        modal.querySelector('#copy-record-id').addEventListener('click', function() {
          navigator.clipboard.writeText(recordId);
          alert('Record ID copied to clipboard!');
        });
      }
      
      modal.querySelector('#open-setup').addEventListener('click', function() {
        window.open('/lightning/setup/SetupOneHome/home', '_blank');
      });
      
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          modal.remove();
        }
      });
    });
}

// Extract Record ID from URL
function extractRecordId(url) {
  // Match 15 or 18 character Salesforce IDs
  const match = url.match(/\/([a-zA-Z0-9]{15,18})\//);
  return match ? match[1] : null;
}

// Extract Org ID from cookies or page
function extractOrgId() {
  try {
    // Try to get from page context
    const orgIdElement = document.querySelector('[data-org-id]');
    if (orgIdElement) return orgIdElement.dataset.orgId;
    
    // Fallback: extract from URL subdomain
    const match = window.location.hostname.match(/([a-zA-Z0-9-]+)\..*salesforce\.com/);
    return match ? match[1] : 'Unknown';
  } catch (e) {
    return 'Unknown';
  }
}

// Get current user name
function getUserName() {
  try {
    const userElement = document.querySelector('.profile-name') ||
                       document.querySelector('[title*="User"]') ||
                       document.querySelector('.uiImage[alt]');
    return userElement ? (userElement.textContent || userElement.alt || 'Current User') : 'Current User';
  } catch (e) {
    return 'Current User';
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
  }).observe(document, {subtree: true, childList: true});
}