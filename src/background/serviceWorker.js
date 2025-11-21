// Background Service Worker

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXECUTE_SOQL') {
        handleExecuteSoql(request).then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true; // Keep channel open for async response
    }
    if (request.action === 'FETCH_USER_INFO') {
        handleFetchUserInfo(request).then(sendResponse).catch(err => sendResponse({ error: err.message }));
        return true;
    }
});

async function getSessionId(url) {
    try {
        const urlObj = new URL(url);
        const currentDomain = urlObj.hostname;

        // 1. Try getting cookie from the current domain to get the Org ID
        let localCookie = await chrome.cookies.get({ url: url, name: 'sid' });
        let orgId = null;

        if (localCookie) {
            // Extract Org ID (first 15 chars or part before !)
            const parts = localCookie.value.split('!');
            if (parts.length > 0) {
                orgId = parts[0];
            }
        }

        // Known domains to search for the "real" API session
        const knownDomains = [
            'salesforce.com',
            'my.salesforce.com',
            'cloudforce.com',
            'force.com',
            'develop.my.salesforce.com' // Enhanced domains
        ];

        // Helper to find cookie in a domain
        const findCookieInDomain = async (domain, targetOrgId) => {
            const cookies = await chrome.cookies.getAll({ name: 'sid', domain: domain });
            if (!cookies || cookies.length === 0) return null;

            // If we have an Org ID, look for a match
            if (targetOrgId) {
                return cookies.find(c => c.value.startsWith(targetOrgId + '!') && c.domain !== 'help.salesforce.com');
            }

            // Otherwise, just return the first valid-looking one
            return cookies.find(c => c.domain !== 'help.salesforce.com');
        };

        // 2. Search for the best session
        let bestSession = null;

        // First, try to find a session on salesforce.com or my.salesforce.com that matches our Org ID
        if (orgId) {
            for (const domain of knownDomains) {
                const cookie = await findCookieInDomain(domain, orgId);
                if (cookie) {
                    bestSession = { sessionId: cookie.value, domain: cookie.domain };
                    break;
                }
            }
        }

        // 3. If still no session (or no local Org ID found), try a broader search
        if (!bestSession) {
            for (const domain of knownDomains) {
                const cookie = await findCookieInDomain(domain, null);
                if (cookie) {
                    bestSession = { sessionId: cookie.value, domain: cookie.domain };
                    break;
                }
            }
        }

        // 4. Fallback: If we found NOTHING else, but had a local cookie, try using that as a last resort.
        // (Even if it's lightning, it's better than nothing, though it failed before)
        if (!bestSession && localCookie) {
            return { sessionId: localCookie.value, domain: currentDomain };
        }

        return bestSession;
    } catch (e) {
        console.error('Failed to get cookie:', e);
        return null;
    }
}

async function handleExecuteSoql({ soql, instanceUrl }) {
    try {
        // Use the provided instanceUrl to help find the session, but prefer the session's domain for the actual call
        let sessionData = await getSessionId(instanceUrl || 'https://salesforce.com');

        if (!sessionData) {
            // Try to find ANY session if we don't have a target URL to start with
            sessionData = await getSessionId('https://salesforce.com');
        }

        if (!sessionData) {
            throw new Error('No session found. Please login to Salesforce.');
        }

        const sessionId = sessionData.sessionId;

        // CRITICAL FIX: Always use the domain where the session cookie lives.
        // Lightning domains (lightning.force.com) often block API calls (403 Forbidden).
        // The "Classic" or "My Domain" (salesforce.com / my.salesforce.com) where the cookie was found is the safe host.
        let targetDomain = sessionData.domain;
        if (targetDomain.startsWith('.')) targetDomain = targetDomain.substring(1);

        const encodedSoql = encodeURIComponent(soql);
        const queryUrl = `https://${targetDomain}/services/data/v60.0/query?q=${encodedSoql}`;

        const response = await fetch(queryUrl, {
            headers: {
                'Authorization': `Bearer ${sessionId}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData[0]?.message || 'SOQL Execution Failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Background SOQL Error:', error);
        throw error;
    }
}

async function handleFetchUserInfo({ instanceUrl }) {
    try {
        const sessionData = await getSessionId(instanceUrl);
        if (!sessionData) throw new Error('No session found');

        // CRITICAL FIX: Use the session domain, NOT the instanceUrl (which might be lightning)
        let targetDomain = sessionData.domain;
        if (targetDomain.startsWith('.')) targetDomain = targetDomain.substring(1);

        const response = await fetch(`https://${targetDomain}/services/oauth2/userinfo`, {
            headers: {
                'Authorization': `Bearer ${sessionData.sessionId}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }

        return await response.json();
    } catch (error) {
        console.error('Background UserInfo Error:', error);
        throw error;
    }
}
