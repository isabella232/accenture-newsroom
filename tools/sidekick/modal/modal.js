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

import { loadCSS } from '../../../scripts/lib-franklin.js';

/**
 * Creates a modal with id modalId, or if that id already exists, returns the existing modal.
 * To show the modal, call `modal.showModal()`.
 * @param modalId
 * @param createContent Callback called when the modal is first opened; should return html string
 * for the modal content
 * @param addEventListeners Optional callback called when the modal is first opened;
 * should add event listeners to body if needed
 * @returns {Promise<HTMLElement>} The <dialog> element, after loading css
 */
export default async function createDialog(modalId, header, content, footer, type) {
  await loadCSS('/tools/sidekick/modal/modal.css');

  let dialogElement = document.getElementById(modalId);
  if (!dialogElement) {
    dialogElement = document.createElement('dialog');
    dialogElement.id = modalId;
    dialogElement.classList.add('aem-Dialog');
    if (type) {
      dialogElement.classList.add(type);
    }

    let headerHTML;
    if (typeof header === 'function') {
      headerHTML = header(dialogElement);
    } else if (typeof header === 'string') {
      headerHTML = header;
    } else if (header instanceof HTMLElement) {
      headerHTML = header.outerHTML;
    }

    let contentHTML;
    if (typeof content === 'function') {
      contentHTML = content(dialogElement);
    } else if (typeof content === 'string') {
      contentHTML = content;
    } else if (content instanceof HTMLElement) {
      contentHTML = content.outerHTML;
    }

    let footerHTML;
    if (typeof footer === 'function') {
      footerHTML = footer(dialogElement);
    } else if (typeof footer === 'string') {
      footerHTML = footer;
    } else if (footer instanceof HTMLElement) {
      footerHTML = footer.outerHTML;
    }

    dialogElement.innerHTML = `
      <section>
        <form class="form" method="dialog">
          ${(header || footer) ? `
            <header>
              <button type="button" value="close">
                <span class="icon icon-x"></span>
              </button>
              ${headerHTML}
            </header>` : ''}
          <div class="aem-Dialog-content">${contentHTML}</div>
          ${footer ? `<footer>${footerHTML}</footer>` : ''}
        </form>
      </section>`;

    document.body.appendChild(dialogElement);

    dialogElement.querySelectorAll('header button, footer button').forEach((btn) => {
      if (btn.type !== 'submit') {
        btn.type = null;
        btn.setAttribute('formnovalidate', true);
      }
      if (!btn.value) {
        btn.value = btn.name;
      }
    });
  }
  return dialogElement;
}
