'use strict';
import wd from 'wd';
import { LT_AUTH_ERROR, PROCESS_ENVIRONMENT, AUTOMATION_DASHBOARD_URL, AUTOMATION_HUB_URL, _connect, _destroy, _getBrowserList, _parseCapabilities, _saveFile, _updateJobStatus } from './util';

const WEB_DRIVER_PING_INTERVAL = 5 * 60 * 1000;

wd.configureHttp({
    timeout: 9 * 60 * 1000,
    
    retries: 3,
    
    retryDelay: 30 * 1000
});

export default {
    // Multiple browsers support
    isMultiBrowser: true,
    
    browserNames: [],
    
    openedBrowsers: { },
    async _startBrowser (id, url, capabilities) {
        const webDriver = wd.promiseChainRemote(AUTOMATION_HUB_URL, 80, PROCESS_ENVIRONMENT.LT_USERNAME, PROCESS_ENVIRONMENT.LT_ACCESS_KEY);
        const pingWebDriver = () => webDriver.eval('');

        webDriver.once('status', () => {
            webDriver.pingIntervalId = setInterval(pingWebDriver, WEB_DRIVER_PING_INTERVAL);
        });
        this.openedBrowsers[id] = webDriver;
    
        try {
            await webDriver
            .init(capabilities)
            .get(url);
        }
        catch (err) {
            await _destroy();
            throw err;
        }
    },
    async _takeScreenshot (id, screenshotPath) {
        const base64Data = await this.openedBrowsers[id].takeScreenshot();
        
        await _saveFile(screenshotPath, base64Data);
    },
    // Required - must be implemented
    // Browser control
    async openBrowser (id, pageUrl, browserName) {
        if (!PROCESS_ENVIRONMENT.LT_USERNAME || !PROCESS_ENVIRONMENT.LT_ACCESS_KEY)
            throw new Error(LT_AUTH_ERROR);
        await _connect();
        const capabilities = await _parseCapabilities(id, browserName);

        await this._startBrowser(id, pageUrl, capabilities);
        const sessionUrl = ` ${AUTOMATION_DASHBOARD_URL}/logs/?sessionID=${this.openedBrowsers[id].sessionID} `;
        
        this.setUserAgentMetaInfo(id, sessionUrl);
    },

    async closeBrowser (/*id*/) {

    },


    // Optional - implement methods you need, remove other methods
    // Initialization
    async init () {
        this.browserNames = await _getBrowserList();
    },
    async dispose () {
        for (const key in this.openedBrowsers) {
            clearInterval(this.openedBrowsers[key].pingIntervalId);
            await this.openedBrowsers[key].quit();
        }
        await _destroy();
    },
    // Browser names handling
    async getBrowserList () {
        return this.browserNames;
    },

    async isValidBrowserName (/* browserName */) {
        return true;
    },
    

    // Extra methods
    async resizeWindow (id, width, height) {
        const _windowHandle = await this.openedBrowsers[id].windowHandle();
        
        await this.openedBrowsers[id].windowSize(_windowHandle, width, height);
    },

    async maximizeWindow (id) {
        const _windowHandle = await this.openedBrowsers[id].windowHandle();
        
        await this.openedBrowsers[id].maximize(_windowHandle);
    },

    async takeScreenshot (id, screenshotPath) {
        await this._takeScreenshot(id, screenshotPath);
    },
    
    async reportJobResult (id, jobResult, jobData) {
        if (this.openedBrowsers[id] && this.openedBrowsers[id].sessionID) {
            const sessionID = this.openedBrowsers[id].sessionID;
            
            return await _updateJobStatus(sessionID, jobResult, jobData, this.JOB_RESULT);
        }
        return null;
    }
};
