import htm from '../../lib/htm.js';
import { generateSoql } from '../services/llmService.js';
import { executeSoql } from '../services/salesforceService.js';

const h = htm.bind(window.React.createElement);

export function ChatBox({ recordId, sessionId, userInfo }) {
  const [query, setQuery] = React.useState('');
  const [messages, setMessages] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // Determine object type from ID prefix
  const getObjectType = (id) => {
    if (!id) return null;
    if (id.startsWith('001')) return 'Account';
    if (id.startsWith('003')) return 'Contact';
    if (id.startsWith('006')) return 'Opportunity';
    if (id.startsWith('500')) return 'Case';
    return null;
  };

  const objectType = getObjectType(recordId);

  const suggestions = React.useMemo(() => {
    const base = ['Show 5 recent accounts', 'Show my open tasks'];
    if (objectType === 'Account') {
      return ['Show contacts for this account', 'Show open opportunities', ...base];
    }
    if (objectType === 'Contact') {
      return ['Show cases for this contact', 'Show account details', ...base];
    }
    return base;
  }, [objectType]);

  const handleSend = async (textOverride) => {
    // Ensure we only use textOverride if it's a string (ignore events)
    const textToSend = (typeof textOverride === 'string' ? textOverride : query) || '';

    if (!textToSend.trim()) return;

    const userMessage = { role: 'user', text: textToSend };
    // Optimistically add user message
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setQuery('');
    setLoading(true);

    try {
      if (textToSend.toLowerCase() === 'list models') {
        const { listModels } = await import('../services/llmService.js');
        const models = await listModels();
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: 'Available Models:',
          data: models
        }]);
        setLoading(false);
        return;
      }

      // 1. Generate SOQL
      const thinkingMsg = { role: 'system', text: 'Thinking... (Generating SOQL)' };
      setMessages(prev => [...prev, thinkingMsg]);

      // Pass history (excluding the just-added user message and the thinking message)
      const history = messages;
      const soql = await generateSoql(textToSend, recordId, history);

      // Update thinking message
      setMessages(prev => prev.map(msg =>
        msg === thinkingMsg ? { role: 'system', text: `Executing: ${soql}` } : msg
      ));

      // 2. Execute SOQL
      // Try to get instance URL from userInfo
      let instanceUrl = null;
      if (userInfo && userInfo.urls && userInfo.urls.rest) {
        // urls.rest usually looks like "https://instance.salesforce.com/services/data/v{version}/"
        // We want the base "https://instance.salesforce.com"
        const match = userInfo.urls.rest.match(/^(https:\/\/[^/]+)/);
        if (match) instanceUrl = match[1];
      }

      // Fallback: if on lightning.force.com, try to switch to my.salesforce.com
      if (!instanceUrl && window.location.hostname.includes('.lightning.force.com')) {
        // This is a guess, but often works. Better to rely on userInfo.
        // Or just try relative path if userInfo failed.
      }

      const result = await executeSoql(soql, sessionId, instanceUrl);

      const resultMsg = {
        role: 'assistant',
        text: `Found ${result.totalSize} records.`,
        data: result.records
      };

      setMessages(prev => [...prev, resultMsg]);

    } catch (error) {
      setMessages(prev => [...prev, { role: 'error', text: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return h`
    <div className="sf-helper-chat" style=${{
      marginTop: '20px',
      borderTop: '1px solid #eee',
      paddingTop: '20px'
    }}>
      <h3 style=${{ fontSize: '16px', marginBottom: '10px', color: '#0070d2' }}>AI Data Query</h3>

      <div className="suggestions" style=${{ marginBottom: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        ${suggestions.map(s => h`
          <button
            key=${s}
            onClick=${() => handleSend(s)}
            disabled=${loading}
            style=${{
        padding: '4px 8px',
        fontSize: '11px',
        backgroundColor: '#f3f2f2',
        border: '1px solid #ddd',
        borderRadius: '10px',
        cursor: 'pointer',
        color: '#0070d2'
      }}
          >
            ${s}
          </button>
        `)}
      </div>

      <div className="chat-history" style=${{
      maxHeight: '300px',
      overflowY: 'auto',
      marginBottom: '10px',
      backgroundColor: '#f4f6f9',
      padding: '10px',
      borderRadius: '4px',
      border: '1px solid #d8dde6'
    }}>
        ${messages.length === 0 && h`
          <div style=${{ color: '#747474', fontStyle: 'italic', textAlign: 'center' }}>
            Ask me anything about this record or your org data...
          </div>
        `}
        
        ${messages.map((msg, index) => h`
          <div key=${index} style=${{ marginBottom: '10px' }}>
            <div style=${{
        fontWeight: 'bold',
        color: msg.role === 'user' ? '#0070d2' : (msg.role === 'error' ? '#c23934' : '#54698d'),
        marginBottom: '4px'
      }}>
              ${msg.role === 'user' ? 'You' : (msg.role === 'error' ? 'Error' : 'Helper')}
            </div>
            
            <div style=${{ whiteSpace: 'pre-wrap' }}>${msg.text}</div>
            
            ${msg.data && msg.data.length > 0 && h`
              <div style=${{
          marginTop: '5px',
          overflowX: 'auto',
          backgroundColor: 'white',
          padding: '5px',
          border: '1px solid #eee'
        }}>
                <pre style=${{ fontSize: '11px', margin: 0 }}>${JSON.stringify(msg.data, null, 2)}</pre>
              </div>
            `}
          </div>
        `)}
        
        ${loading && h`
          <div style=${{ color: '#747474', fontStyle: 'italic' }}>Processing...</div>
        `}
      </div>

      <div style=${{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          value=${query}
          onInput=${(e) => setQuery(e.target.value)}
          onKeyDown=${handleKeyDown}
          placeholder="e.g., Show contacts for this account..."
          disabled=${loading}
          style=${{
      flex: 1,
      padding: '8px',
      border: '1px solid #d8dde6',
      borderRadius: '4px'
    }}
        />
        <button 
          onClick=${() => handleSend()}
          disabled=${loading}
          style=${{
      padding: '8px 16px',
      backgroundColor: '#0070d2',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1
    }}
        >
          Send
        </button>
      </div>
    </div>
  `;
}
