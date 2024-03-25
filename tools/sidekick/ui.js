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

/**
 * Shows a modal dialog.
 * @param {String} modalId An id for the dialog
 * @param {String|HTMLElement|Function} header The header to be used for the dialog.
 *          (can be a string, an HTMLElement or a function returning an HTML string)
 * @param {String|HTMLElement|Function} content The header to be used for the dialog.
 *          (can be a string, an HTMLElement or a function returning an HTML string)
 * @param {String|HTMLElement|Function} footer The header to be used for the dialog.
 *          (can be a string, an HTMLElement or a function returning an HTML string)
 * @param {String} type The dialog type which will be added as a class to the dialog for
 *                      granular styling (i.e. 'info', 'warning', 'error')
 * @returns a promise that the dialog was closed with the value of the button that was clicked
 *          if we have a footer, or a `HTMLDialogElement` that needs to be manually closed if
 *          the footer is null.
 */
export async function showModal(modalId, header, content, footer, type = 'info') {
  const { default: createDialog } = await import('./modal/modal.js');
  const modal = await createDialog(modalId, header, content, footer, type);
  modal.showModal();
  if (footer) {
    return new Promise((resolve) => {
      modal.addEventListener('close', () => {
        modal.remove();
        resolve(modal.returnValue);
      });
    });
  }
  return modal;
}

/**
 * Shows a notification message that need to be manually closed.
 * @param {String} message The message for the notification that we want to show to the user
 * @param {String} type The notification type which will be added as a class to the dialog for
 *                      granular styling (i.e. 'info', 'warning', 'error')
 * @returns a `HTMLDialogElement` that needs to be manually closed and removed.
 */
export async function wait(message, type) {
  const modal = await showModal('wait', null, `<p>${message}</p>`, null, type);
  return modal;
}

/**
 * Shows a notification message that automatically disappears after a few seconds.
 * @param {String} message The message for the notification that we want to show to the user
 * @param {String} type The notification type which will be added as a class to the dialog for
 *                      granular styling (i.e. 'info', 'warning', 'error')
 * @param {Number} [duration=3000] The duration to show the notification in milliseconds
 *                                 (defaults to 3000)
 * @returns a promise that the notification dialog was closed.
 */
export async function notify(message, type, duration = 3000) {
  const modal = await showModal('notify', null, `<p>${message}</p>`, null, type);
  return new Promise((resolve) => {
    setTimeout(() => {
      modal.close();
      modal.remove();
      resolve();
    }, duration);
  });
}

/**
 * Shows a modal dialog that asks the user to acknoledge an message.
 * @param {String} title The title for the dialog
 * @param {String} message The main message for the dialog that we want the user to acknoledge
 * @param {String} type The message type which will be added as a class to the dialog for
 *                      granular styling (i.e. 'info', 'warning', 'error')
 * @param {String} btnLabel The label for the confirmation button (i.e. 'Ok', 'Close')
 * @returns a promise that resolves to true if the user acknowledges, false otherwise
 */
export async function acknowledge(title, message, type, btnLabel = 'Ok') {
  return showModal(
    'acknowledge',
    `<h1>${title}</h1>`,
    `<p>${message}</p>`,
    `<button class="button" value="true">${btnLabel}</button>`,
    type,
  );
}

/**
 * Shows a modal dialog that asks the user to confirm an action.
 * @param {String} title The title for the dialog
 * @param {String} message The main message for the dialog that we want the user to confirm
 * @param {String} type The message type which will be added as a class to the dialog for
 *                      granular styling (i.e. 'info', 'warning', 'error')
 * @param {String} yesLabel The label for the positive confirmation button (i.e. 'Yes', 'Confirm')
 * @param {String} noLabel The label for the negative confirmation button (i.e. 'No', 'Cancel')
 * @returns a promise that resolves to true if the user confirms, false otherwise
 */
export async function confirm(title, message, type, yesLabel = 'Yes', noLabel = 'No') {
  return showModal(
    'confirm',
    `<h1>${title}</h1>`,
    `<p>${message}</p>`,
    `<button class="button cta" value="true">${yesLabel}</button>
    <button class="button secondary" value="false">${noLabel}</button>`,
    type,
  );
}
