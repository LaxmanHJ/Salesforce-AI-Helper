export async function executeSoql(soql, sessionId, instanceUrl) {
    // Note: sessionId is now retrieved in the background script, but we keep the signature for compatibility if needed.
    // instanceUrl is crucial.

    if (!instanceUrl) {
        // Fallback: try to use current origin if it looks like a salesforce domain
        instanceUrl = window.location.origin;
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'EXECUTE_SOQL',
            soql,
            instanceUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response);
            }
        });
    });
}
