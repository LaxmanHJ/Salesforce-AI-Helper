import { config } from '../config.js';

export async function generateSoql(query, recordId, history = []) {
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error('Please configure your Gemini API Key in src/config.js');
    }

    // Format history for context
    const historyContext = history.map(msg => {
        if (msg.role === 'user') return `User: ${msg.text}`;
        if (msg.role === 'system') return `System (Executed SOQL): ${msg.text.replace('Executing: ', '')}`;
        if (msg.role === 'assistant') return `Assistant: ${msg.text}`;
        return '';
    }).filter(Boolean).join('\n');

    const prompt = `
    You are a Salesforce SOQL expert. Convert the following natural language query into a valid SOQL query.
    
    Context:
    - Current Record ID: ${recordId || 'N/A'}
    - Return ONLY the raw SOQL query. Do not include markdown formatting (no \`\`\`), explanations, or extra text.
    - If the query implies "this" record (e.g., "this account"), filter by Id = '${recordId}'.
    - Use standard Salesforce objects (Account, Contact, Opportunity, etc.) unless specified otherwise.
    - Limit results to 20 unless specified.

    Conversation History:
    ${historyContext}

    User Query: "${query}"
  `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to call Gemini API');
        }

        const data = await response.json();
        let soql = data.candidates[0].content.parts[0].text.trim();

        // Cleanup potential markdown code blocks if the model ignores instructions
        soql = soql.replace(/^```sql\n?/, '').replace(/^```\n?/, '').replace(/```$/, '').trim();

        return soql;
    } catch (error) {
        console.error('LLM Service Error:', error);
        throw error;
    }
}

export async function listModels() {
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error('Please configure your Gemini API Key in src/config.js');
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to list models');
        }
        const data = await response.json();
        return data.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).map(m => m.name);
    } catch (error) {
        console.error('List Models Error:', error);
        throw error;
    }
}
