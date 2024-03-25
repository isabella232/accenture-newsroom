/* eslint-disable prefer-destructuring */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

/**
 * Sanitizes a string for use as class name.
 * @param {string} name The unsanitized string
 * @returns {string} The class name
 */
export function toClassName(name) {
  return typeof name === 'string'
    ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    : '';
}

/**
 * Sanitizes a string for use as a js property name.
 * @param {string} name The unsanitized string
 * @returns {string} The camelCased name
 */
function toCamelCase(name) {
  return toClassName(name).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Gets placeholders object.
 * @param {string} [prefix] Location of placeholders
 * @returns {object} Window placeholders object
 */
async function fetchPlaceholders(prefix = 'default') {
  window.placeholders = window.placeholders || {};
  const loaded = window.placeholders[`${prefix}-loaded`];
  if (!loaded) {
    window.placeholders[`${prefix}-loaded`] = new Promise((resolve, reject) => {
      fetch(`${prefix === 'default' ? '' : prefix}/placeholders.json`)
        .then((resp) => {
          if (resp.ok) {
            return resp.json();
          }
          throw new Error(`${resp.status}: ${resp.statusText}`);
        }).then((json) => {
          const placeholders = {};
          json.data
            .filter((placeholder) => placeholder.Key)
            .forEach((placeholder) => {
              placeholders[toCamelCase(placeholder.Key)] = placeholder.Text;
            });
          window.placeholders[prefix] = placeholders;
          resolve();
        }).catch((error) => {
          // error loading placeholders
          window.placeholders[prefix] = {};
          reject(error);
        });
    });
  }
  await window.placeholders[`${prefix}-loaded`];
  return window.placeholders[prefix];
}

function getPlaceholder(key, placeholders) {
  if (placeholders && placeholders[key]) {
    return placeholders[key];
  }
  return key;
}

// DOM helper
export function createEl(name, attributes = {}, content = '', parentEl = null) {
  const el = document.createElement(name);

  Object.keys(attributes).forEach((key) => {
    el.setAttribute(key, attributes[key]);
  });
  if (content) {
    if (typeof content === 'string') {
      el.innerHTML = content;
    } else if (content instanceof NodeList) {
      content.forEach((itemEl) => {
        el.append(itemEl);
      });
    } else if (content instanceof HTMLCollection) {
      Array.from(content).forEach((itemEl) => {
        el.append(itemEl);
      });
    } else {
      el.append(content);
    }
  }
  if (parentEl) {
    parentEl.append(el);
  }
  return el;
}

function getLocale() {
  return (navigator.languages && navigator.languages.length)
    ? navigator.languages[0] : navigator.language;
}

function showAlert() {
  const alertBox = document.getElementById('custom-alert');
  alertBox.style.display = 'block';
  setTimeout(() => {
    alertBox.style.display = 'none';
  }, 4000); // Dismiss after 4 seconds
}

function writeToClipboard(blob) {
  const data = [new ClipboardItem({ [blob.type]: blob })];
  navigator.clipboard.write(data);
}

function getSiteFromHostName(hostname = window.location.hostname) {
  const allowedSites = ['uk', 'de', 'fr', 'it', 'es', 'sg', 'pt', 'jp', 'br'];
  if (hostname === 'localhost') {
    return 'us';
  }
  // handle franklin hostnames
  const franklinHostName = 'accenture-newsroom';
  if (hostname.includes(franklinHostName)) {
    for (let i = 0; i < allowedSites.length; i += 1) {
      if (hostname.includes(`${franklinHostName}-${allowedSites[i]}`)) {
        return allowedSites[i];
      }
    }
    return 'us';
  }
  // handle main hostnames
  const mainHostName = 'newsroom.accenture';
  if (hostname.includes(mainHostName)) {
    const remainingHostName = hostname.replace(`${mainHostName}`, '');
    for (let i = 0; i < allowedSites.length; i += 1) {
      if (remainingHostName.includes(`${allowedSites[i]}`)) {
        return allowedSites[i];
      }
    }
  }
  return 'us';
}

function getCountry() {
  const siteToCountryMapping = {
    us: 'us',
    uk: 'gb',
    de: 'de',
    fr: 'fr',
    it: 'it',
    es: 'sp',
    sg: 'sg',
    pt: 'pt',
    jp: 'jp',
    br: 'br',
  };
  const site = getSiteFromHostName();
  return siteToCountryMapping[site];
}

function getDateLocales(country) {
  const countryDateLocales = {
    us: 'en-US',
    gb: 'en-US',
    de: 'de-DE',
    fr: 'fr-FR',
    it: 'it-IT',
    sp: 'es-ES',
    sg: 'en-US',
    pt: 'pt-PT',
    jp: 'ja-JP',
    br: 'pt-BR',
  };
  return countryDateLocales[country] || 'en-US';
}

// Tranlationg date to locally
function getHumanReadableDate(dateString) {
  if (!dateString) return dateString;
  const date = new Date(parseInt(dateString, 10));
  // Condition of date and time format per Geo
  const country = getCountry();
  let yearFormat;
  let monthFormat;
  let dayFormat;
  switch (country) {
    case 'sg':
      monthFormat = 'short';
      yearFormat = 'numeric';
      dayFormat = '2-digit';
      break;
    case 'jp':
      yearFormat = 'numeric';
      monthFormat = 'numeric';
      dayFormat = '2-digit';
      break;
    case 'sp':
      yearFormat = 'numeric';
      monthFormat = 'long';
      dayFormat = '2-digit';
      break;
    default:
      yearFormat = 'numeric';
      monthFormat = 'long';
      dayFormat = '2-digit';
      break;
  }
  // display the date in GMT timezone
  const localedate = date.toLocaleDateString(getDateLocales(country), {
    timeZone: 'GMT',
    year: yearFormat,
    month: monthFormat,
    day: dayFormat,
  });

  if (country === 'fr') {
    return `le ${localedate}`;
  }
  return localedate;
}
// Creating category list for subject or industry
function dropdownWriter(item, categorylist) {
  if (!item && item.length > 0) {
    return;
  }
  const checkbox = document.createElement('input');
  checkbox.classList.add('checkbox');
  checkbox.type = 'checkbox';
  checkbox.value = item[1];

  const span = document.createElement('span');
  span.classList.add('tag-Label');
  span.appendChild(checkbox);
  span.appendChild(document.createTextNode(item[0]));

  if (item[0] !== '') {
    categorylist.appendChild(span);
  }
}

function populateDropdown(data, textKey, valueKey, dropdownElement) {
  // Sort the data array alphabetically based on the text key
  const sortedOptions = data.sort((a, b) => a[textKey].localeCompare(b[textKey]));
  // retructure the data array to be an array of arrays
  const OptionsList = sortedOptions.map((item) => [item[textKey], item[valueKey]]);
  OptionsList.forEach((item) => {
    dropdownWriter(item, dropdownElement);
  });
}

async function populateTags() {
  // Replace with your JSON endpoint
  const tags = '/tags.json';
  const url = new URL(tags, window.location.origin);
  const resp = await fetch(url.toString());
  const response = await resp.json();
  if (response) {
    const { data } = response;
    const selectSubjects = document.getElementById('dropdown-subjects');
    populateDropdown(data, 'Subjects Text', 'Subjects Value', selectSubjects);

    const selectIndustries = document.getElementById('dropdown-industries');
    populateDropdown(data, 'Industries Text', 'Industries Value', selectIndustries);
  }
}

// Collection of selected Categories
function getSelectedCategories(categoryDropdownList) {
  const checkCategoryList = categoryDropdownList.querySelectorAll('.checkbox');
  const selectedCategories = [];
  checkCategoryList.forEach((checkCategory) => {
    if (checkCategory.checked) {
      selectedCategories.push(checkCategory.value);
    }
  });
  return selectedCategories;
}

// Date Formatter for publishdate in medata table
function getFormatedDate(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');// Adding leading zero and slicing last two digits
  const day = (date.getDate()).toString().padStart(2, '0');
  const hours = (date.getHours()).toString().padStart(2, '0');
  const minutes = (date.getMinutes()).toString().padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function processForm() {
  const publishDate = document.getElementById('publishDate').value || getFormatedDate(new Date());// metadate Table
  const publishDateMetadata = publishDate.replace('T', ' ');
  const publishDateObj = new Date(publishDate);
  const formattedDateLong = getHumanReadableDate(publishDateObj.getTime());// Article Header Date
  const title = document.getElementById('title').value;
  const subTitle = document.getElementById('subtitle').value;
  const rawAbstract = document.querySelector('form div#abstract .ql-editor').innerHTML;
  const abstract = rawAbstract.replace(/<p>&nbsp;<\/p>/g, '');
  const rawBody = document.querySelector('form div#body .ql-editor').innerHTML;
  const body = rawBody.replace(/<p>&nbsp;<\/p>/g, '');
  const subjectsDropdown = document.getElementById('dropdown-subjects');
  const subjects = getSelectedCategories(subjectsDropdown).join(', ');
  const industriesDropdown = document.getElementById('dropdown-industries');
  const industries = getSelectedCategories(industriesDropdown).join(', ');

  // create the html to paste into the word doc
  const htmlToPaste = `
    ${formattedDateLong || ''}
    <h1>${title || ''}</h1>
    <h6>${subTitle || ''}</h6>
    <br>
    ${abstract || ''}
    ---
    ${body || ''}
    <table border="1">
      <tr bgcolor="#f7caac">
        <td colspan="2">Metadata</td>
      </tr>
      <tr>
        <td>Template</td>
        <td>Article</td>
      </tr>
     
      <tr>
        <td width="20%">Title</td>
        <td>${title || ''}</td>
      </tr>
      <tr>
        <td width="20%">Description</td>
        <td>${abstract || ''}</td>
      </tr>
      <tr>
        <td width="20%">Subtitle</td>
        <td>${subTitle || ''}</td>
      </tr>
      <tr>
      <td width="20%">PublishedDate</td>
      <td>${publishDateMetadata || ''}</td>
      </tr>
      <tr>
        <td width="20%">Subjects</td>
        <td>${subjects || ''}</td>
      </tr>
      <tr>
        <td width="20%">Industries</td>
        <td>${industries || ''}</td>
      </tr>
      <tr>
        <td width="20%">Keywords</td>
        <td></td>
      </tr>
    </table>
  `;
  writeToClipboard(new Blob([htmlToPaste], { type: 'text/html' }));
  showAlert();
}
// Form Creation
function addForm(placeholders) {
  // const placeholders =  await fetchPlaceholders();placeholders
  const formContainer = document.getElementById('metadata-form');
  // Create form element
  const form = document.createElement('form');
  const inputlabel = ['Publish Date', 'Title', 'Subtitle', 'Abstract', 'Body', 'Subject Tags', 'Industry Tags'];
  const keyValuePair = {
    Subject: 'dropdown-subjects',
    Industry: 'dropdown-industries',
  };

  inputlabel.forEach((labelText) => {
    // for complex id
    const labelTextcc = toCamelCase(labelText);
    let attributeName;
    if (labelText.includes('Subject Tags')) {
      // attributeName = dropdownLabel[0];
      attributeName = keyValuePair.Subject;
    } else if (labelText.includes('Industry Tags')) {
      attributeName = keyValuePair.Industry;
    } else {
      attributeName = toCamelCase(labelText);
    }

    // label
    const label = document.createElement('label');
    const plabeltext = getPlaceholder(labelTextcc, placeholders);
    label.innerText = plabeltext === labelTextcc ? labelText : plabeltext;
    label.setAttribute('for', attributeName);
    const space = document.createElement('br');
    label.appendChild(space);

    // input
    if (labelText.includes('Publish Date') || labelText.includes('Title') || labelText.includes('Subtitle')) {
      const input = document.createElement('input');
      input.setAttribute('type', attributeName.includes('publishDate') ? 'datetime-local' : 'text');
      input.setAttribute('id', attributeName);
      input.setAttribute('name', attributeName);
      form.appendChild(label);
      form.appendChild(input);
    } else {
      const input = document.createElement('div');
      input.setAttribute('id', attributeName);
      input.setAttribute('name', attributeName);
      form.appendChild(label);
      form.appendChild(input);
      form.appendChild(space);
    }
  });
  formContainer.appendChild(form);
}

async function populateTranslation() {
  const placeholders = await fetchPlaceholders();
  const defaultIntruction = 'Use this tool to enter relevant metadata and paste the content into Word pre-formatted.';
  // Translation getter
  const ptitle = getPlaceholder('metadataHelper', placeholders);
  const pMessage = getPlaceholder('metadateSubtitle', placeholders);
  const pCopyButtonText = getPlaceholder('copyToClipboard', placeholders);
  const pAlertText = getPlaceholder('metadataCopiedToTheClipboard', placeholders);

  // Condition for placeholder
  const ptitleTs = ptitle === 'metadataHelper' ? 'Metadata Helper' : ptitle;
  const pMessageTs = pMessage === 'metadateSubtitle' ? defaultIntruction : pMessage;
  const pCopyButtonTextTs = pCopyButtonText === 'copyToClipboard' ? 'Copy to Clipboard' : pCopyButtonText;
  const pAlertTextTs = pAlertText === 'metadataCopiedToTheClipboard' ? 'Metadata copied to the clipboard' : pAlertText;

  // Html markup creation
  const metadataIntro = document.getElementById('intro');
  const metadataTitle = document.createElement('h1');
  metadataTitle.setAttribute('id', 'pick-your-tags');
  metadataTitle.textContent = ptitleTs;
  const message = document.createElement('p');
  message.textContent = pMessageTs;
  metadataIntro.appendChild(metadataTitle);
  metadataIntro.appendChild(message);
  addForm(placeholders);
  // Copy button
  const metadatabtn = document.getElementById('metadata-button');
  const copyBtn = document.createElement('button');
  copyBtn.innerText = pCopyButtonTextTs;
  copyBtn.setAttribute('id', 'copy-to-clipboard');
  // alert message
  const alertMessage = document.createElement('div');
  alertMessage.innerText = pAlertTextTs;
  alertMessage.setAttribute('id', 'custom-alert');
  metadatabtn.appendChild(copyBtn);
  metadatabtn.appendChild(alertMessage);
}

async function init() {
  await populateTranslation();
  await populateTags();
  const rteOptions = {
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        ['link'],
        ['clean'],
      ],
    },
    theme: 'snow',
  };
  const abstractContainer = document.querySelector('form div#abstract');
  const abstractEditor = await new Quill(abstractContainer, rteOptions);
  const bodyContainer = document.querySelector('form div#body');
  const bodyEditor = await new Quill(bodyContainer, rteOptions);
  const copyButton = document.getElementById('copy-to-clipboard');
  copyButton.addEventListener('click', () => {
    processForm();
  });
}

await init();
