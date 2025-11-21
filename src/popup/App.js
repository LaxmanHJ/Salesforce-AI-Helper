import htm from '../../lib/htm.js';

const h = htm.bind(React.createElement);

function App() {
  const handleOpenCurrent = async () => {
    console.log('Open Current Record clicked');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        const event = new CustomEvent('sf-helper-show-modal');
        window.dispatchEvent(event);
      }
    });
    window.close();
  };

  const handleOpenSetup = async () => {
    console.log('Open Setup clicked');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const baseUrl = new URL(tab.url).origin;
    chrome.tabs.create({ url: `${baseUrl}/lightning/setup/SetupOneHome/home` });
  };

  const handleOpenDevConsole = async () => {
    console.log('Open Developer Console clicked');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const baseUrl = new URL(tab.url).origin;
    chrome.tabs.create({ url: `${baseUrl}/_ui/common/apex/debug/ApexCSIPage` });
  };

  return h`
    <div style=${{ padding: '16px', fontFamily: 'sans-serif', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

      <div style=${{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <img src="../../icons/icon48.png" alt="Logo" style=${{ width: '32px', height: '32px' }} />
        <h2 style=${{ margin: 0, fontSize: '18px' }}>Salesforce Helper 1.0.0</h2>
      </div>
      
      <button className="btn" onClick=${handleOpenCurrent} style=${{ padding: '8px', cursor: 'pointer' }}>
        Show Data
      </button>
      <button className="btn" onClick=${handleOpenSetup} style=${{ padding: '8px', cursor: 'pointer' }}>
        Open Setup
      </button>
      <button className="btn" onClick=${handleOpenDevConsole} style=${{ padding: '8px', cursor: 'pointer' }}>
        Open Dev Console
      </button>
    </div>
  `;
}

// Mount the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h`<${App} />`);
