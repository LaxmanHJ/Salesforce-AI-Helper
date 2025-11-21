import htm from '../../lib/htm.js';

// Bind htm to React.createElement (assumes React is globally available or passed in)
const h = htm.bind(window.React.createElement);

export function Modal({ url, recordId, orgId, userName, onClose }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(recordId);
    alert('Record ID copied to clipboard!');
  };

  const handleOpenSetup = () => {
    window.open('/lightning/setup/SetupOneHome/home', '_blank');
  };

  const handleOpenDevConsole = () => {
    const baseUrl = window.location.origin;
    window.open(`${baseUrl}/_ui/common/apex/debug/ApexCSIPage`, '_blank');
  };

  // Close on outside click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return h`
    <div className="sf-helper-modal" onClick=${handleBackdropClick} style=${{
      display: 'block', // Override CSS to ensure visibility
      position: 'fixed',
      zIndex: 99999,
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      overflow: 'auto',
      backgroundColor: 'rgba(0,0,0,0.4)'
    }}>
      <div className="sf-helper-modal-content" style=${{
      backgroundColor: '#fefefe',
      margin: '15% auto',
      padding: '20px',
      border: '1px solid #888',
      width: '80%',
      maxWidth: '500px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
        <span className="sf-helper-close" onClick=${onClose} style=${{
      color: '#aaa',
      float: 'right',
      fontSize: '28px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}>×</span>
        
        <h2 style=${{ marginTop: 0, color: '#0070d2' }}>Salesforce Quick Helper (React)</h2>
        
        <div className="sf-helper-info" style=${{ margin: '20px 0' }}>
          <p><strong>Current URL:</strong><br/>${url}</p>
          
          ${recordId && h`
            <p><strong>Record ID:</strong><br/>${recordId}</p>
          `}
          
          ${orgId && h`
            <p><strong>Org ID:</strong><br/>${orgId}</p>
          `}
          
          <p><strong>User:</strong><br/>${userName}</p>
          
          <hr style=${{ border: '0', borderTop: '1px solid #eee', margin: '15px 0' }}/>
          <p><em>This modal is now powered by React!</em></p>
        </div>

        <div className="sf-helper-actions" style=${{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          ${recordId && h`
            <button onClick=${handleCopy} style=${{
        padding: '8px 16px',
        backgroundColor: '#fff',
        border: '1px solid #dddbda',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>
              Copy Record ID
            </button>
          `}
          
          <button onClick=${handleOpenSetup} style=${{
      padding: '8px 16px',
      backgroundColor: '#0070d2',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}>
            Open Setup
          </button>

          <button onClick=${handleOpenDevConsole} style=${{
      padding: '8px 16px',
      backgroundColor: '#0070d2',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}>
            Open Dev Console
          </button>
        </div>
      </div>
    </div>
  `;
}
