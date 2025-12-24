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
You are a Salesforce SOQL expert. Convert the following natural language query into a valid, executable SOQL query.

CRITICAL RULES - MUST FOLLOW:

1. SYNTAX:
   - Return ONLY the raw SOQL query (no markdown, no backticks, no explanations)
   - Use proper SOQL capitalization for keywords: SELECT, FROM, WHERE, ORDER BY, LIMIT
   - Field names are case-insensitive but use proper capitalization (e.g., Name, Id, Email)
   - Always use single quotes for string values: WHERE Name = 'John'
   - Escape single quotes in strings: WHERE Name = 'O\\'Brien'

2. FIELD VALIDATION:
   - Use ONLY standard Salesforce fields that exist on the objects
   - Common fields: Id, Name, CreatedDate, LastModifiedDate, OwnerId, CreatedById
   - Account fields: Name, Industry, AnnualRevenue, BillingCity, BillingState, Phone, Website
   - Contact fields: FirstName, LastName, Email, Phone, Title, AccountId, MailingCity
   - Opportunity fields: Name, StageName, Amount, CloseDate, AccountId, Probability
   - Case fields: CaseNumber, Subject, Status, Priority, AccountId, ContactId
   - DO NOT assume custom fields exist unless the user explicitly mentions them

3. RELATIONSHIPS:
   - Parent relationship format: Account.Name, Owner.Name, CreatedBy.Email
   - Child relationships use plural: (SELECT Name FROM Contacts), (SELECT Name FROM Opportunities)
   - Maximum 1 level of parent relationships in SELECT: Contact.Account.Name is valid, but Contact.Account.Owner.Name is NOT
   - Child queries are NOT allowed in WHERE clauses

4. WHERE CLAUSE:
   - Use proper operators: =, !=, <, >, <=, >=, LIKE, IN, NOT IN
   - LIKE patterns: WHERE Name LIKE 'Acme%' (use % for wildcards)
   - IN clause: WHERE Id IN ('001...', '003...')
   - Date literals: TODAY, YESTERDAY, LAST_N_DAYS:7, THIS_MONTH, LAST_MONTH
   - Boolean: WHERE IsActive = true (not 'true')
   - NULL checks: WHERE Field__c = null OR Field__c != null

5. COMMON OBJECTS:
   - Account, Contact, Opportunity, Case, Lead, Task, Event, User, Profile
   - Use exact object names (case-sensitive): "Account" not "account" or "Accounts"

6. LIMIT:
   - Default to LIMIT 20 for general queries
   - Use LIMIT 200 for "all" or "list all" queries
   - User can specify: "show 5 accounts" = LIMIT 5

7. ORDER BY:
   - Add ORDER BY when logical: ORDER BY CreatedDate DESC, ORDER BY Name ASC
   - Recent records: ORDER BY CreatedDate DESC
   - Sort by name: ORDER BY Name ASC

8. RECORD ID CONTEXT:
   - Current Record ID: ${recordId || 'N/A'}
   - If query mentions "this record" or "this account": WHERE Id = '${recordId}'
   - Related records: WHERE AccountId = '${recordId}' (for contacts/opportunities of this account)

9. AVOID THESE ERRORS:
   - ❌ SELECT * FROM Account (use explicit field names)
   - ❌ SELECT Name, (SELECT * FROM Contacts) FROM Account (no * in child queries)
   - ❌ WHERE Name == 'Test' (use = not ==)
   - ❌ WHERE Name = "Test" (use single quotes not double quotes)
   - ❌ GROUP BY without aggregate function
   - ❌ Referencing fields that don't exist

CONVERSATION HISTORY:
${historyContext}

USER QUERY: "${query}"

Generate the SOQL query now:
  `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${config.GEMINI_API_KEY}`, {
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

export async function generateResultSummary(query, records, soql) {
    if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
        throw new Error('Please configure your Gemini API Key in src/config.js');
    }

    if (!records || records.length === 0) {
        return 'No records found.';
    }

    const prompt = `
You are a Salesforce data analyst. Summarize the following SOQL query results in natural language.

Original User Query: "${query}"
SOQL Executed: ${soql}
Results: ${JSON.stringify(records, null, 2)}

Provide a clear, concise summary that:
- Highlights key information and patterns
- Uses natural language (avoid technical jargon when possible)
- Mentions important field values
- Keeps it under 200 words
- Format as plain text (no markdown)
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${config.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate summary');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
        console.error('Summary Generation Error:', error);
        // Fallback to simple summary
        return `Found ${records.length} record(s). Could not generate detailed summary.`;
    }
}
