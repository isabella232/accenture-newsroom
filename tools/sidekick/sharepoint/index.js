/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { PublicClientApplication } from './msal-browser-2.14.2.js';

const GRAPHQL_ENDPOINT = 'https://graph.microsoft.com/v1.0';

export default class SharepointSDK {
  #domain;

  #domainId;

  #siteId;

  #rootPath;

  #connectAttempts;

  constructor(options) {
    this.#domain = options.domain;
    this.#domainId = options.domainId;
    this.#siteId = options.siteId;
    this.#rootPath = options.rootPath || '';
    this.#connectAttempts = 0;
  }

  async #checkIsSignedIn() {
    // eslint-disable-next-line no-console
    console.assert(this.accessToken, 'You need to sign-in first');
  }

  #setRequestOptions(method = 'GET') {
    this.#checkIsSignedIn();

    const headers = new Headers();
    headers.append('Authorization', `Bearer ${this.accessToken}`);
    headers.append('Accept', 'application/json');
    headers.append('Content-Type', 'application/json');

    return {
      method,
      headers,
    };
  }

  get baseUri() {
    return `${GRAPHQL_ENDPOINT}/sites/${this.#domain},${this.#domainId},${this.#siteId}/drive/root:${this.#rootPath}`;
  }

  async signIn(clientId, authority) {
    const publicClientApplication = new PublicClientApplication({
      auth: { clientId, authority },
    });

    await publicClientApplication.loginPopup({
      redirectUri: `${window.location.origin}/tools/sidekick/sharepoint/auth.html`,
    });

    const account = publicClientApplication.getAllAccounts()[0];

    const accessTokenRequest = {
      scopes: ['User.Read', 'Files.ReadWrite.All', 'Sites.ReadWrite.All'],
      account,
    };

    try {
      const res = await publicClientApplication.acquireTokenSilent(accessTokenRequest);
      this.accessToken = res.accessToken;
    } catch (error) {
      // Acquire token silent failure, and send an interactive request
      if (error.name === 'InteractionRequiredAuthError') {
        try {
          const res = await publicClientApplication.acquireTokenPopup(accessTokenRequest);
          // Acquire token interactive success
          this.accessToken = res.accessToken;
        } catch (err) {
          this.#connectAttempts += 1;
          if (this.#connectAttempts === 1) {
            // Retry to connect once
            this.signIn();
          }
          // Give up
          throw new Error(`Cannot connect to Sharepoint: ${err.message}`);
        }
      }
    }
  }

  async testConnection() {
    this.#checkIsSignedIn();

    const options = this.#setRequestOptions('GET');

    const res = await fetch(this.baseUri, options);
    if (!res.ok) {
      throw new Error('Could not connect to Sharepoint');
    }
    return res.json();
  }

  async listFiles(folderPath) {
    this.#checkIsSignedIn();

    const options = this.#setRequestOptions('GET');

    const res = await fetch(`${this.baseUri}${folderPath}:/children`, options);
    if (!res.ok) {
      throw new Error(`Could not list files: ${folderPath}`);
    }
    return res.json();
  }

  async createFolder(folderPath) {
    this.#checkIsSignedIn();

    const options = this.#setRequestOptions('PATCH');
    options.body = JSON.stringify({ folder: {} });

    const res = await fetch(`${this.baseUri}${folderPath}`, options);
    if (!res.ok) {
      throw new Error(`Could not create folder: ${folderPath}`);
    }
    return res.json();
  }

  async getTableCells(workbookPath, tableName) {
    this.#checkIsSignedIn();

    const options = this.#setRequestOptions('GET');

    const res = await fetch(`${this.baseUri}${workbookPath}:/workbook/tables/${tableName}/range`, options);
    if (!res.ok) {
      throw new Error(`Could not get table cells: ${workbookPath}`);
    }
    return res.json();
  }

  async appendRowsToTable(workbookPath, tableName, rows) {
    this.#checkIsSignedIn();

    const options = this.#setRequestOptions('POST');
    options.body = JSON.stringify({
      values: rows,
    });

    const res = await fetch(`${this.baseUri}${workbookPath}:/workbook/tables/${tableName}/rows/add`, options);
    if (!res.ok) {
      throw new Error(`Could not append rows to table: ${workbookPath}`);
    }
    return res.json();
  }

  async updateRowInTable(workbookPath, tableName, rowIndex, data) {
    this.#checkIsSignedIn();

    const options = this.#setRequestOptions('PATCH');
    options.body = JSON.stringify({
      values: data,
    });

    const res = await fetch(`${this.baseUri}${workbookPath}:/workbook/tables/${tableName}/rows/itemAt(index=${rowIndex})`, options);
    if (!res.ok) {
      throw new Error(`Could not update row in table: ${workbookPath}`);
    }
    return res.json();
  }

  async deleteRowInTable(workbookPath, tableName, rowIndex) {
    this.#checkIsSignedIn();

    const options = this.#setRequestOptions('DELETE');

    const res = await fetch(`${this.baseUri}${workbookPath}:/workbook/tables/${tableName}/rows/itemAt(index=${rowIndex})`, options);
    if (!res.ok) {
      throw new Error(`Could not delete row in table: ${workbookPath}`);
    }
  }
}
