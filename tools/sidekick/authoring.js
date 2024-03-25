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
import {
  decorateBlocks,
  decorateSections,
  fetchPlaceholders,
  loadBlocks,
} from '../../scripts/lib-franklin.js';
// eslint-disable-next-line import/no-cycle
import { getPlaceholder, getSiteFromHostName } from '../../scripts/scripts.js';
import {
  acknowledge,
  confirm,
  notify,
  wait,
} from './ui.js';
import { preview } from './admin.js';

const getGeoPath = () => {
  const sGeo = getSiteFromHostName();
  if (sGeo === 'us') {
    return 'en';
  }
  return sGeo;
};

// The Sharepoint configuration
const SHAREPOINT_CONFIG = {
  authority: 'https://login.microsoftonline.com/e0793d39-0939-496d-b129-198edd916feb',
  clientId: 'd52049b8-514c-49c7-acd6-55e3a6f14ebf',
  domain: 'ts.accenture.com',
  domainId: '627f3086-805e-4a45-9800-af5f9c0cfb03', // AdobePlatformAuthor"
  siteId: '47d42eab-993d-4993-ab4f-6f4c83e5a684', // Newsroom
  rootPath: `/sites/accenture/newsroom/${getGeoPath()}`,
};

// The path to the crontab file in the content
const CRONTAB_PATH = '/.helix/crontab.xlsx';

// Later.js full month names for proper parsing
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'Oktober', 'November', 'December'];

// Minimum delay for a publish later job (10 mins)
const DELAY = 10 * 60 * 1000;

// The SDK singleton instance
// eslint-disable-next-line no-underscore-dangle
let _sdk;

/**
 * Formats the datetime into a human readable string.
 * @param {Date} datetime the date to format
 * @param {String} [timeZone] the timezone to use for formatting
 * @returns a human readable string for the date.
 */
function formatDateTime(datetime, timeZone) {
  return new Intl.DateTimeFormat('default', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZone,
  }).format(datetime);
}
/**
 * Gets the list of cron jobs from the crontab file.
 * @param {Onject} sdk An instance of the sharepoint SDK
 * @param {string} tableName The name of the table to query
 * @returns an array of arrays containing the table values
 */
async function getCronJobs(sdk, tableName) {
  const crontab = await sdk.getTableCells('/.helix/crontab.xlsx', tableName);
  return crontab.values;
}

/**
 * Formats the given data into a cronjob entry.
 * @param {Object} data The data to format
 * @param {Date} data.datetime The date and time to run this job on
 * @param {String} data.url The URL of the page to publish
 * @returns an array of arrays containing job data in the crontab format
 */
function formatCronJobData({ datetime, url }) {
  const pad = (n) => n.toString().padStart(2, '0');
  const sOrigin = window.location.origin;
  return [[
    `at ${pad(datetime.getUTCHours())}:${pad(datetime.getUTCMinutes())} on the ${datetime.getUTCDate()} day of ${MONTHS[datetime.getUTCMonth()]} in ${datetime.getUTCFullYear()}`,
    `publish ${new URL(url).pathname}`,
    `${sOrigin}${new URL(url).pathname}`,
    '',
  ]];
}

/**
 * Parses a cronjob entry into a usable object.
 * @param {Array} data The cronjob entry to parse
 * @returns an object containing the parsed data and
 *          having `datetime`, `action` and `url` properties
 */
const parseCronJobDataToLocal = ([datetime, action]) => {
  const [, hh, mm, apm, dd, mmm, yyyy] = datetime.match(/at (\d+):(\d+)([ap]m)? on the (\d+) day of (\w+) in (\d+)/);
  let iHours;
  const iParseHour = parseInt(hh, 10);
  if (apm) {
    iHours = apm === 'pm' ? iParseHour + 12 : iParseHour;
  } else {
    iHours = iParseHour;
  }
  const localDate = new Date(Date.UTC(yyyy, MONTHS.indexOf(mmm), dd, iHours, mm));
  return {
    datetime: localDate,
    url: `${window.location.origin}${action.split(' ').pop()}`,
    action: action.split(' ').shift(),
  };
};

/**
 * Returns a string with the message about the current timezone.
 * @returns a message with the current timezone
 */
function getTimezoneMessage(placeholders) {
  const tzOffset = new Date().getTimezoneOffset();
  const template = getPlaceholder('Times are in {{tzName}} timezone ({{tzOffset}}).', placeholders);
  return template
    .replace('{{tzName}}', Intl.DateTimeFormat().resolvedOptions().timeZone)
    .replace('{{tzOffset}}', `GMT${tzOffset < 0 ? `+${-tzOffset / 60}` : `-${tzOffset / 60}`}`);
}

/**
 * Adds a new publish entry to the crontab file.
 * @param {Onject} sdk An instance of the sharepoint SDK
 * @param {string} tableName The name of the table to query
 * @param {Object} data The data to format
 * @param {Date} data.datetime The date and time to run this job on
 * @param {String} data.url The URL of the page to publish
 */
async function addPublishJob(sdk, tableName, data) {
  const rows = formatCronJobData(data);
  await sdk.appendRowsToTable(CRONTAB_PATH, tableName, rows);
}

/**
 * Updates an existing entry in the crontab file.
 * @param {Onject} sdk An instance of the sharepoint SDK
 * @param {string} tableName The name of the table to query
 * @param {Object} data The data to format
 * @param {Date} data.datetime The date and time to run this job on
 * @param {String} data.url The URL of the page to publish
 * @param {Number} index The index in the table to be updated
 */
async function updatePublishJob(sdk, tableName, data, index) {
  const rows = formatCronJobData(data);
  await sdk.updateRowInTable(CRONTAB_PATH, tableName, index, rows);
}

/**
 * Gets an authenticate SDK instance.
 * @returns an authenticated SDk instance
 */
async function getSdk() {
  if (_sdk) {
    return _sdk;
  }

  const spConfig = {
    domain: SHAREPOINT_CONFIG.domain,
    domainId: SHAREPOINT_CONFIG.domainId,
    siteId: SHAREPOINT_CONFIG.siteId,
    rootPath: SHAREPOINT_CONFIG.rootPath,
  };

  const { default: SharepointSDK } = await import(`${window.location.origin}/tools/sidekick/sharepoint/index.js`);
  _sdk = new SharepointSDK(spConfig);

  await _sdk.signIn(SHAREPOINT_CONFIG.clientId, SHAREPOINT_CONFIG.authority);
  return _sdk;
}

/**
 * Get the modal Fragment from the form component
 * @param {String} [html] HTML string response from /tools/sidekick/publish-later.plain.html
 * @param {Object} [existingEntry] The existing publish later entry, if any
 * @param {Object} [oDateData] Object dates
 * @returns Fragment of modal dialog
 */
const getPublishLaterModalFragment = async (html, existingEntry, oDateData) => {
  const { currentTime, datetimeCrontab } = oDateData;
  const fragment = document.createElement('div');
  fragment.innerHTML = html;

  const link = fragment.querySelector('a[href*=".json"]');
  if (link && existingEntry) {
    if (currentTime < datetimeCrontab) {
      link.href = `${link.href}?sheet=edit`;
      link.textContent = link.href;
    }
  }

  decorateSections(fragment);
  decorateBlocks(fragment);
  await loadBlocks(fragment);
  return fragment;
};

/**
 * Get the existing datetime from the cronjobdata
 * @param {Object} [existingEntry] The existing publish later entry, if any
 * @returns UTC date from the cronjobdata or null
 */
const getDateTimeParseCronJobData = (existingEntry) => {
  if (!existingEntry) {
    return null;
  }
  try {
    const oTzOffset = new Date().getTimezoneOffset();
    const { datetime } = parseCronJobDataToLocal(existingEntry);
    return new Date(datetime - oTzOffset * 60000);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse existing schedule', err);
  }
  return null;
};

/**
 * Conditions for the buttons of modal to disable or enable.
 * @param {Object} [oModalFragment] Modal Fragment from getPublishLaterModalFragment method
 * @param {Object} [oDateData] Object dates
 * @returns Html string of footer of modal dialog
 */
const modalFooterHandler = (oModalFragment, oDateData) => {
  const { currentTime, datetimeCrontab, minDate } = oDateData;
  const footer = [...oModalFragment.querySelectorAll('button')].map((btn) => {
    btn.parentElement.remove();
    btn.classList.add(btn.type === 'submit' ? 'cta' : 'secondary');
    if (datetimeCrontab < minDate && btn.type === 'submit') {
      btn.setAttribute('disabled', true);
      btn.classList.add('disabled');
    }
    if (btn.type === 'submit' && currentTime >= datetimeCrontab) {
      btn.removeAttribute('disabled');
      btn.classList.remove('disabled');
    }
    return btn.outerHTML;
  }).join('') || null;

  return footer;
};

/**
 * Conditions for the input of modal to disable or enable.
 * @param {Object} [oModalFragment] Modal Fragment from getPublishLaterModalFragment method
 * @param {Object} [oDateData] Object dates
 * @param {Object} [placeholders] Object contains of translations
 * @returns void
 */
const modalInputHandler = (oModalFragment, oDateData, placeholders) => {
  const { currentTime, datetimeCrontab, minDate } = oDateData;
  const input = oModalFragment.querySelector('input[type="datetime-local"]');
  if (!input) {
    return;
  }
  const tzLabel = document.createElement('small');
  tzLabel.textContent = getTimezoneMessage(placeholders);
  input.after(tzLabel);

  input.setAttribute('min', minDate.toISOString().slice(0, -8));

  if (!datetimeCrontab) {
    return;
  }

  input.setAttribute('value', datetimeCrontab.toISOString().slice(0, -8));

  // if less than 10 mins before scheduled pub then disabled the update buttton
  if (datetimeCrontab < minDate) {
    input.setAttribute('disabled', true);
  }

  // if the page is already publish and has a record on the crontab file
  if (currentTime >= datetimeCrontab) {
    input.setAttribute('min', minDate.toISOString().slice(0, -8));
    input.removeAttribute('disabled');
    input.setAttribute('value', '');
    input.classList.remove('disabled');
  }
};

/**
 * Gets an object consist of the dates needed for publish modal
 * @param {Object} [existingEntry] The existing publish later entry, if any
 * @returns Dates Object
 */
const getDateData = (existingEntry) => {
  const oTzOffset = new Date().getTimezoneOffset();
  const oMinDate = new Date(Date.now() - oTzOffset * 60000 + DELAY);
  const oCurrentTime = new Date(Date.now() - oTzOffset * 60000);
  const oDatetimeCrontab = getDateTimeParseCronJobData(existingEntry);

  return {
    tzOffset: oTzOffset,
    minDate: oMinDate,
    currentTime: oCurrentTime,
    datetimeCrontab: oDatetimeCrontab,
  };
};

/**
 * Loads and formats the publish later modal.
 * @param {Object} [existingEntry] The existing publish later entry, if any
 * @returns The formatted modal dialog
 */
async function getPublishLaterModal(existingEntry) {
  const placeholders = await fetchPlaceholders();
  const response = await fetch('/tools/sidekick/publish-later.plain.html');
  const sResHtml = await response.text();

  const oDateData = getDateData(existingEntry);

  const oModalFragment = await getPublishLaterModalFragment(sResHtml, existingEntry, oDateData);
  const header = oModalFragment.querySelector('h1,h2,h3');

  modalInputHandler(oModalFragment, oDateData, placeholders);

  const footer = modalFooterHandler(oModalFragment, oDateData);
  const content = oModalFragment.querySelector('form').innerHTML;

  const { default: createDialog } = await import('./modal/modal.js');
  const dialog = await createDialog('dialog-modal', header, content, footer);
  dialog.classList.add('publishlater');
  return dialog;
}

/**
 * Handles the publish later workflow and UI.
 * @param {Object} skConfig The Sidekick configuration
 */
export async function publishLater(skConfig) {
  const placeholders = await fetchPlaceholders();
  let modal = await wait(getPlaceholder('Please wait…', placeholders));

  let sdk;
  try {
    sdk = await getSdk();
    // eslint-disable-next-line no-console
    console.log('Connected to sharepoint');
  } catch (err) {
    modal.close();
    modal.remove();
    // eslint-disable-next-line no-console
    console.error('Could not log into Sharepoint', err);
    await acknowledge(
      getPlaceholder('Error', placeholders),
      getPlaceholder('Could not log into Sharepoint.', placeholders),
      'error',
    );
    return;
  }

  const { url } = skConfig.status.preview;

  let cronjobs;
  let existing;
  try {
    cronjobs = await getCronJobs(sdk, 'jobs');
    existing = cronjobs.find((job) => String(job[1]).endsWith(new URL(url).pathname));
  } catch (err) {
    modal.close();
    modal.remove();
    await acknowledge(
      getPlaceholder('Error', placeholders),
      getPlaceholder('Could not retrieve cron jobs.', placeholders),
      'error',
    );
    return;
  }

  modal.close();
  modal.remove();

  let index;
  if (existing) {
    index = cronjobs.indexOf(existing);
  }

  modal = await getPublishLaterModal(existing);
  modal.addEventListener('close', async (ev) => {
    modal.remove();

    if (modal.returnValue === 'submit') {
      modal = await wait(getPlaceholder('Publishing schedule…', placeholders));
      const formData = new FormData(ev.target.querySelector('form'));
      const datetime = new Date(formData.get('datetime'));

      try {
        if (existing) {
          await updatePublishJob(sdk, 'jobs', { datetime, url }, index - 1);
        } else {
          await addPublishJob(sdk, 'jobs', { datetime, url });
        }

        await preview(skConfig, CRONTAB_PATH.replace('.xlsx', '.json'));
        modal.close();
        modal.remove();
        await notify(getPlaceholder('Publishing scheduled successfully.', placeholders), 'success', 3000);
      } catch (err) {
        modal.close();
        modal.remove();
        if (existing) {
          await acknowledge(
            getPlaceholder('Publish Later', placeholders),
            getPlaceholder('Failed to update existing publishing schedule.', placeholders),
            'error',
          );
          // eslint-disable-next-line no-console
          console.error('Failed to update publishing job', err);
        } else {
          await acknowledge(
            getPlaceholder('Publish Later', placeholders),
            getPlaceholder('Failed to create publishing schedule.', placeholders),
            'error',
          );
          // eslint-disable-next-line no-console
          console.error('Failed to prepare publishing job', err);
        }
      }
      return;
    }

    if (modal.returnValue === 'delete') {
      const confirmed = await confirm(
        getPlaceholder('Delete schedule', placeholders),
        getPlaceholder('Are you sure you want to delete this publishing schedule?', placeholders),
        'error',
      );
      if (confirmed !== 'true') {
        return;
      }
      try {
        modal = await wait(getPlaceholder('Deleting schedule…', placeholders));
        await sdk.deleteRowInTable(CRONTAB_PATH, 'jobs', index - 1);
        await preview(skConfig, CRONTAB_PATH.replace('.xlsx', '.json'));
        modal.close();
        modal.remove();
        await notify(getPlaceholder('Publishing job deleted successfully.', placeholders), 'success', 3000);
      } catch (err) {
        modal.close();
        modal.remove();
        // eslint-disable-next-line no-console
        console.error('Failed to delete publishing job', err);
        await acknowledge(
          getPlaceholder('Publish Later', placeholders),
          getPlaceholder('Failed to delete existing publishing schedule.', placeholders),
          'error',
        );
      }
    }
  });

  modal.showModal();
}

/**
 * Enhances the page info dropdown with additional information about the publishing schedule.
 */
export async function enhancePageInfo() {
  const placeholders = await fetchPlaceholders();
  const sk = document.querySelector('helix-sidekick');
  const info = sk.shadowRoot.querySelector('.plugin.page-info');
  let container = info.querySelector('.crontab-date-container');
  let date = container?.querySelector('time');
  if (!container) {
    container = document.createElement('div');
    container.classList.add('crontab-date-container');

    const label = document.createElement('span');
    label.textContent = getPlaceholder('Scheduled: ', placeholders);
    container.append(label);

    date = document.createElement('time');
    date.textContent = getPlaceholder('…', placeholders);
    container.append(date);

    info.append(container);
  }

  let sdk;
  try {
    sdk = await getSdk();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Could not log into Sharepoint', err);
    return;
  }

  let cronjobs;
  let existing;
  try {
    const url = window.location.href;
    cronjobs = await getCronJobs(sdk, 'jobs');
    existing = cronjobs.find((job) => String(job[1]).endsWith(new URL(url).pathname));
  } catch (err) {
    await acknowledge(
      getPlaceholder('Error', placeholders),
      getPlaceholder('Could not retrieve cron jobs.', placeholders),
      'error',
    );
    return;
  }

  if (!existing) {
    date.textContent = getPlaceholder('Never', placeholders);
    return;
  }

  const { datetime } = parseCronJobDataToLocal(existing);
  date.setAttribute('datetime', datetime.toISOString());
  date.textContent = formatDateTime(datetime);
}

export async function publishLaterList() {
  const placeholders = await fetchPlaceholders();
  const modal = await wait(getPlaceholder('Please wait…', placeholders));

  let sdk;
  try {
    sdk = await getSdk();
    // eslint-disable-next-line no-console
    console.log('Connected to sharepoint');
  } catch (err) {
    modal.close();
    modal.remove();
    // eslint-disable-next-line no-console
    console.error('Could not log into Sharepoint', err);
    await acknowledge(
      getPlaceholder('Error', placeholders),
      getPlaceholder('Could not log into Sharepoint.', placeholders),
      'error',
    );
    return;
  }

  let cronjobs;
  try {
    cronjobs = await getCronJobs(sdk, 'jobs');
  } catch (err) {
    modal.close();
    modal.remove();
    await acknowledge(
      getPlaceholder('Error', placeholders),
      getPlaceholder('Could not retrieve cron jobs.', placeholders),
      'error',
    );
    return;
  }

  modal.close();
  modal.remove();

  const jobsList = cronjobs.slice(1).map((job) => {
    try {
      return parseCronJobDataToLocal(job);
    } catch (err) {
      return null;
    }
  }).filter((job) => job && job.datetime > Date.now() && job.action === 'publish')
    .sort((a, b) => a.datetime - b.datetime);

  const res = await fetch('/tools/sidekick/publish-later-list.plain.html');
  const html = await res.text();

  const fragment = document.createElement('div');
  fragment.innerHTML = html;

  const table = fragment.querySelector('.table');
  jobsList.forEach((job) => {
    const url = new URL(job.url);
    table.innerHTML += `<div>
      <div>${formatDateTime(job.datetime)}</div>
      <div><a href="${url.pathname}" target="_blank">${url.pathname}</a></div>
    </div>`;
  });

  const header = fragment.querySelector('h1,h2,h3');
  header.remove();

  decorateSections(fragment);
  decorateBlocks(fragment);
  await loadBlocks(fragment);

  const tzLabel = document.createElement('small');
  tzLabel.textContent = getTimezoneMessage();
  table.querySelector('table').after(tzLabel);

  if (!jobsList.length) {
    table.querySelector('table tbody').innerHTML += `<tr><td colspan="2"><em>${getPlaceholder('No scheduled jobs.', placeholders)}</em></td></tr>`;
  }

  const content = fragment.firstElementChild;
  const { default: createDialog } = await import('./modal/modal.js');
  const dialog = await createDialog('dialog-modal', header, content, null);
  dialog.classList.add('publishlater-all');
  dialog.showModal();

  dialog.addEventListener('close', () => {
    dialog.remove();
  });
}
