import {
  ANALYTICS_LINK_TYPE_NAV_PAGINATE,
  ANALYTICS_TEMPLATE_ZONE_BODY,
  ANALYTICS_MODULE_SEARCH_PAGINATION,
  ANALYTICS_MODULE_CONTENT,
  ANALYTICS_MODULE_FACT,
  ANALYTICS_LINK_TYPE_CONTENT_MODULE,
  ANALYTICS_MODULE_YEAR_FILTER,
  ANALYTICS_LINK_TYPE_FILTER,
  INVALID_TAG_ERROR,
} from './constants.js';
import ffetch from './ffetch.js';
import {
  sampleRUM,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForLCP,
  loadBlock,
  loadBlocks,
  loadCSS,
  getMetadata,
  loadScript,
  fetchPlaceholders,
  decorateBlock,
} from './lib-franklin.js';

const LCP_BLOCKS = []; // add your LCP blocks to the list

// regex to find abstract paragraph
export const ABSTRACT_REGEX = /(.*?);.*?(\d{4})|(.*?)(\d{4})\s*(–|-|‒|:)\s*/;

export const isMobile = () => window.innerWidth < 600;

export function getSiteFromHostName(hostname = window.location.hostname) {
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

export function getCountry() {
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

export function getLanguage(country) {
  const countryToLanguageMapping = {
    us: 'en',
    uk: 'en',
    de: 'de',
    fr: 'fr',
    it: 'it',
    es: 'es',
    sg: 'en',
    pt: 'pt',
    jp: 'ja',
    br: 'pt',
  };
  return countryToLanguageMapping[country] || 'en';
}

export function getDateLocales(country) {
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

/**
 * Removes Diacritics (accented characters) from a string
 * @param {*} name
 * @returns
 */
export function sanitizeName(name) {
  return name ? decodeURIComponent(name.trim()).toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') : '';
}

export function getPlaceholder(key, placeholders) {
  if (placeholders && placeholders[key]) {
    return placeholders[key];
  }
  return key;
}

export function createTag(tag, attributes, html) {
  const el = document.createElement(tag);
  if (html) {
    if (html instanceof HTMLElement
      || html instanceof SVGElement
      || html instanceof DocumentFragment) {
      el.append(html);
    } else if (Array.isArray(html)) {
      el.append(...html);
    } else {
      el.insertAdjacentHTML('beforeend', html);
    }
  }
  if (attributes) {
    Object.entries(attributes).forEach(([key, val]) => {
      el.setAttribute(key, val);
    });
  }
  return el;
}

/**
 * Sets the Content-Security-Policy meta tag to the document based on JSON file
 */
async function setCSP() {
  const resp = await fetch(`${window.hlx.codeBasePath}/scripts/csp.json`);
  const json = await resp.json();
  const directives = Object.keys(json);
  const policy = directives.map((directive) => `${directive} ${json[directive].join(' ')}`).join('; ');
  const meta = document.createElement('meta');
  meta.setAttribute('http-equiv', 'Content-Security-Policy');
  meta.setAttribute('content', policy);
  document.addEventListener('securitypolicyviolation', (e) => sampleRUM('csperror', { source: `${e.documentURI}:${e.lineNumber}:${e.columnNumber}`, target: e.blockedURI }));
  document.head.appendChild(meta);
}

/**
 * Annotates given link element with click tracking attributes
 *
 * @param {*} el
 * @param {*} elName
 * @param {*} moduleName
 * @param {*} templateZone
 * @param {*} linkType
 * @returns
 */

export function annotateElWithAnalyticsTracking(el, elName, moduleName, templateZone, linkType) {
  if (!el) return;
  el.setAttribute('data-analytics-link-name', elName);
  el.setAttribute('data-analytics-module-name', moduleName);
  el.setAttribute('data-analytics-template-zone', templateZone);
  el.setAttribute('data-analytics-link-type', linkType);
}

/**
 * Creates link element with click tracking attributes
 * @param {*} href
 * @param {*} text
 * @param {*} moduleName
 * @param {*} templateZone
 * @param {*} linkType
 * @returns annotate anchor tag
 */

export function createAnnotatedLinkEl(href, text, moduleName, templateZone, linkType) {
  const link = document.createElement('a');
  link.href = href;
  link.innerText = text;
  link.title = text;
  annotateElWithAnalyticsTracking(link, text, moduleName, templateZone, linkType);
  return link;
}

function collapseFilterYearWhenOutofFocus(event) {
  if (!event.target.closest('#filter-year')) {
    const filterYear = document.querySelector('#filter-year');
    const yearDropdown = filterYear.querySelector('.filter-year-dropdown');
    const isExpanded = yearDropdown.getAttribute('aria-expanded');
    if (isExpanded) {
      yearDropdown.setAttribute('aria-expanded', 'false');
    }
  }
}

function filterYearEventHandler(event) {
  const yearDropdown = event.target.querySelector('.filter-year-dropdown');
  const isExpanded = yearDropdown.getAttribute('aria-expanded');
  if (isExpanded === 'true') {
    yearDropdown.setAttribute('aria-expanded', 'false');
    window.removeEventListener('click', collapseFilterYearWhenOutofFocus);
  } else {
    yearDropdown.setAttribute('aria-expanded', 'true');
    window.addEventListener('click', collapseFilterYearWhenOutofFocus);
  }
}

export function addEventListenerToFilterYear(yearPicker, url) {
  yearPicker.removeEventListener('click', filterYearEventHandler);
  yearPicker.addEventListener('click', filterYearEventHandler);
  const yearItems = yearPicker.querySelectorAll('.filter-year-item');
  yearItems.forEach((item) => {
    item.addEventListener('click', () => {
      const year = item.getAttribute('value');
      const yearUrl = `${url}?year=${year}`;
      window.location.href = yearUrl;
    });
  });
}

export async function createFilterYear(years, currentYear, url) {
  const placeholders = await fetchPlaceholders();
  const pYear = getPlaceholder('year', placeholders);
  const filterYear = document.createElement('div');
  filterYear.id = 'filter-year';
  filterYear.name = 'year';
  let options = years.map((y) => (`
    <div class="filter-year-item" value="${y}" data-analytics-link-name="${y}"
    data-analytics-module-name=${ANALYTICS_MODULE_YEAR_FILTER} data-analytics-template-zone="${ANALYTICS_TEMPLATE_ZONE_BODY}"
    data-analytics-link-type="${ANALYTICS_LINK_TYPE_FILTER}">${y}</div>
    `)).join('');
  options = `<div class="filter-year-item" value=""
    data-analytics-link-name="year"
    data-analytics-module-name=${ANALYTICS_MODULE_YEAR_FILTER} data-analytics-template-zone="${ANALYTICS_TEMPLATE_ZONE_BODY}"
    data-analytics-link-type="${ANALYTICS_LINK_TYPE_FILTER}">${pYear}</div> ${options}`;
  filterYear.innerHTML = `
  ${currentYear || pYear}
  <div class="filter-year-dropdown">
    ${options}
  </div>
  `;
  addEventListenerToFilterYear(filterYear, url);
  return filterYear;
}

/**
 * Traverse the whole json structure in data and replace '0' with empty string
 * @param {*} data
 * @returns updated data
 */
function replaceEmptyValues(data) {
  Object.keys(data).forEach((key) => {
    if (typeof data[key] === 'object') {
      replaceEmptyValues(data[key]);
    } else if (data[key] === '0') {
      data[key] = '';
    }
  });
  return data;
}

function skipInternalPaths(jsonData) {
  const internalPaths = ['/search', '/'];
  const regexp = [/drafts\/.*/, /\/industries\/.*/, /\/subjects\/.*/];
  const templates = ['category'];
  return jsonData.filter((row) => {
    if (internalPaths.includes(row.path)) {
      return false;
    }
    if (regexp.some((r) => r.test(row.path))) {
      return false;
    }
    if (templates.includes(row.template)) {
      return false;
    }
    return true;
  });
}

export async function fetchIndex(indexURL = '/query-index.json', sheet = 'articles', limit = 1000, offset = 0) {
  try {
    const resp = await fetch(`${indexURL}?sheet=${sheet}&limit=${limit}&offset=${offset}`);
    const json = await resp.json();
    replaceEmptyValues(json.data);
    skipInternalPaths(json.data);
    window.queryIndex = window.queryIndex || {};
    window.queryIndex[indexURL] = json;
    return json;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`error while fetching ${indexURL}`, e);
    return [];
  }
}

/**
 * Iterates the {limit} number of articles from the query index and store the
 * iterator and articles in window object
 * @param {*} indexURL
 * @param {*} sheet
 * @param {*} limit
 * @param {*} filter
 * @returns
 */
export async function ffetchArticles(indexURL = '/query-index.json', sheet = 'articles', limit = 100, filter = null) {
  let ffetchIterator;
  if (filter) {
    ffetchIterator = await ffetch(indexURL)
      .sheet(sheet)
      .filter(filter);
  } else {
    ffetchIterator = await ffetch(indexURL)
      .sheet(sheet);
  }
  const articles = [];
  for (let i = 0; i < limit; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const article = await ffetchIterator.next();
    if (article.done) {
      break;
    }
    articles.push(article.value);
  }
  window.articles = articles;
  window.ffetchIterator = ffetchIterator;
  return articles;
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

function findArticleIndex(queryIndex, path) {
  let articleIndex = -1;
  for (let i = 0; i < queryIndex.length; i += 1) {
    if (queryIndex[i].path === path) {
      articleIndex = i;
      break;
    }
  }
  return articleIndex;
}

async function addPrevNextLinksToArticles() {
  const template = getMetadata('template');
  const heroBlock = document.querySelector('.hero.block');
  if (template !== 'Article' || !heroBlock) {
    return;
  }
  const placeholders = await fetchPlaceholders();
  const pPrevious = getPlaceholder('previous', placeholders);
  const pNext = getPlaceholder('next', placeholders);
  const pNextTitle = getPlaceholder('nextTitle', placeholders);
  const pNextTitleTooltip = pNextTitle === 'nextTitle' ? 'Next' : pNextTitle;
  const pPreviousTitle = getPlaceholder('previousTitle', placeholders);
  const pPreviousTitleTooltip = pPreviousTitle === 'previousTitle' ? 'Previous' : pPreviousTitle;
  const queryIndex = await ffetchArticles('/query-index.json', 'articles', 100);
  // iterate queryIndex to find current article and add prev/next links
  const currentArticlePath = window.location.pathname;
  let currentArticleIndex = findArticleIndex(queryIndex, currentArticlePath);
  let prevArticle;
  let nextArticle;
  if (currentArticleIndex === -1) {
    // eslint-disable-next-line no-restricted-syntax
    for await (const article of window.ffetchIterator) {
      window.articles.push(article);
      if (article.path === currentArticlePath) {
        currentArticleIndex = window.articles.length - 1;
        nextArticle = window.articles[currentArticleIndex - 1];
        const a = await window.ffetchIterator.next();
        if (!a.done) {
          window.articles.push(a.value);
          prevArticle = a.value;
        } else {
          prevArticle = '';
        }
        break;
      }
    }
  } else if (currentArticleIndex === queryIndex.length - 1) {
    const a = await window.ffetchIterator.next();
    if (!a.done) {
      window.articles.push(a.value);
      prevArticle = a.value;
    } else {
      prevArticle = '';
    }
    nextArticle = queryIndex[currentArticleIndex - 1];
  } else {
    prevArticle = queryIndex[currentArticleIndex + 1];
    nextArticle = queryIndex[currentArticleIndex - 1];
  }

  const heroLinkContainer = heroBlock.querySelector('.hero-link-container');
  let prevLink = '';
  let nextLink = '';
  if (prevArticle) {
    prevLink = createEl('a', { href: prevArticle.path, class: 'prev', title: pPreviousTitleTooltip }, pPrevious);
  } else {
    prevLink = createEl('a', { href: '#', class: 'prev disabled', title: pPreviousTitleTooltip }, pPrevious);
  }
  if (nextArticle) {
    nextLink = createEl('a', { href: nextArticle.path, class: 'next', title: pNextTitleTooltip }, pNext);
  } else {
    nextLink = createEl('a', { href: '#', class: 'next disabled', title: pNextTitleTooltip }, pNext);
  }
  annotateElWithAnalyticsTracking(
    prevLink,
    'Prev',
    ANALYTICS_MODULE_SEARCH_PAGINATION,
    ANALYTICS_TEMPLATE_ZONE_BODY,
    ANALYTICS_LINK_TYPE_NAV_PAGINATE,
  );
  annotateElWithAnalyticsTracking(
    nextLink,
    'Next',
    ANALYTICS_MODULE_SEARCH_PAGINATION,
    ANALYTICS_TEMPLATE_ZONE_BODY,
    ANALYTICS_LINK_TYPE_NAV_PAGINATE,
  );
  heroLinkContainer.append(prevLink);
  heroLinkContainer.append(nextLink);
}

const scanAllTextNodes = (element) => {
  const allChildNodes = element.childNodes;
  allChildNodes.forEach((oNode) => {
    if (oNode.nodeType !== Node.TEXT_NODE) {
      scanAllTextNodes(oNode);
      return;
    }
    if (oNode.nodeValue.trim() === '') {
      return;
    }
    if (oNode.nodeValue !== '# # #') {
      return;
    }
    const span = document.createElement('span');
    span.classList.add('article-end-divider');
    span.textContent = oNode.nodeValue;
    element.replaceChild(span, oNode);
  });
};

const centerArticleDivider = (main) => {
  const template = getMetadata('template');
  if (template !== 'Article') {
    return;
  }
  const sectionArticles = main.querySelectorAll('.section');
  sectionArticles.forEach((section) => {
    if (!section.nextElementSibling) {
      return;
    }
    if (!section.nextElementSibling.classList.contains('aside-container')) {
      return;
    }

    const defaultWrappers = section.querySelectorAll('.default-content-wrapper');
    const lastDefaultWrapper = defaultWrappers[defaultWrappers.length - 1];
    if (!lastDefaultWrapper) {
      return;
    }
    scanAllTextNodes(lastDefaultWrapper);
  });
};

const pdfLinkHandler = () => {
  const sectionLinks = document.querySelectorAll('main > .section a');

  const addTargetAttribute = (link) => {
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }
    if (!href.includes('.pdf')) {
      return;
    }
    link.setAttribute('target', '_blank');
  };

  sectionLinks.forEach((link) => {
    addTargetAttribute(link);
  });
};

function annotateArticleSections() {
  const template = getMetadata('template');
  if (template !== 'Article') {
    return;
  }
  // add abstract and date classes
  const abstractSection = document.querySelector('main > .section:not(.hero-container)');
  abstractSection.classList.add('abstract');
  const h1 = abstractSection.querySelector('h1');
  if (h1) {
    const date = h1.previousSibling;
    if (date) {
      date.classList.add('date');
    }
  }
  // annotate links
  const articleSections = document.querySelectorAll('main > .section');
  const excludeSections = ['hero-container', 'aside-container'];
  articleSections.forEach((section) => {
    const sectionClassList = Array.from(section.classList);
    if (sectionClassList.some((c) => excludeSections.includes(c))) {
      return;
    }
    if (window.location.pathname.startsWith('/help-faq')) {
      section.querySelectorAll('a').forEach((link) => {
        annotateElWithAnalyticsTracking(
          link,
          link.innerText,
          ANALYTICS_MODULE_FACT,
          ANALYTICS_TEMPLATE_ZONE_BODY,
          ANALYTICS_LINK_TYPE_CONTENT_MODULE,
        );
      });
    } else {
      section.querySelectorAll('a').forEach((link) => {
        annotateElWithAnalyticsTracking(
          link,
          link.innerText,
          ANALYTICS_MODULE_CONTENT,
          ANALYTICS_TEMPLATE_ZONE_BODY,
          ANALYTICS_LINK_TYPE_CONTENT_MODULE,
        );
      });
    }
  });
}

/**
 * Builds aside block and attaches it to main in a new section.
 * @param {Element} main The container element
 */
function buildAsideBlock(main) {
  const template = getMetadata('template');
  if (template === 'Article') {
    const section = document.createElement('div');
    section.append(buildBlock('aside', { elems: [] }));
    main.append(section);
  }
}

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const template = getMetadata('template');
  if (template === 'home' || window.location.pathname === '/') {
    return;
  }
  const section = document.createElement('div');
  section.append(buildBlock('hero', { elems: [] }));
  main.prepend(section);
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildAsideBlock(main);
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    // article processing
    annotateArticleSections();
    pdfLinkHandler();
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

// Add custom event that will trigger if the jQuery is loaded
export async function loadjQueryScript() {
  const jqueryReadyEvent = new Event('jQueryReady');
  const sJquerySrc = '/scripts/jquery-3.5.1.min.js';

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`head > script[src="${sJquerySrc}"]`)) {
      const script = document.createElement('script');
      script.src = sJquerySrc;
      const loaded = () => {
        document.dispatchEvent(jqueryReadyEvent);
        resolve();
      };
      script.onload = loaded;
      script.onerror = reject;
      document.head.append(script);
    } else {
      resolve();
    }
  });
}

async function loadJQueryDateRangePicker() {
  const filterInput = document.querySelector('#newslist-filter-input');
  if (!filterInput) {
    return;
  }
  await loadScript('/scripts/moment.min.js');
  await loadjQueryScript();
  await loadScript('/scripts/jquery.daterangepicker-20190409.js');
  await loadCSS('/styles/daterangepicker.css');

  const filterSubmit = filterInput.closest('form').querySelector('input[type="submit"]');
  const url = new URL(window.location);
  let usp = new URLSearchParams(url.search);
  if (filterInput) {
    filterInput.removeAttribute('disabled');
    filterSubmit.removeAttribute('disabled');
    // eslint-disable-next-line no-undef
    const $filter = $('#newslist-filter-input');
    $filter.dateRangePicker(
      {
        singleMonth: true,
        showShortcuts: false,
        showTopbar: false,
        format: 'MM/DD/YY',
        separator: ' - ',
        monthSelect: true,
        yearSelect: true,
        extraClass: 'landing-picker',
      // eslint-disable-next-line prefer-arrow-callback
      },
    )
      .bind('datepicker-change', (evt, obj) => {
        const fullDtFrm = `${(obj.date1.getMonth() + 1)}/${obj.date1.getDate()}/${obj.date1.getFullYear()}`;
        const fullDtTo = `${(obj.date2.getMonth() + 1)}/${obj.date2.getDate()}/${obj.date2.getFullYear()}`;
        usp = new URLSearchParams();
        usp.set('from_date', fullDtFrm);
        usp.set('to_date', fullDtTo);
        const closestForm = $filter.closest('form');
        const formUrl = closestForm.length > 0 ? closestForm.attr('action') : window.location.pathname;
        window.location.href = `${formUrl}?${usp.toString()}`;
      })
      .bind('datepicker-open', () => {
        // eslint-disable-next-line no-undef
        if (!$('#clear-date-range').length) {
          // eslint-disable-next-line no-undef
          $('.date-picker-wrapper .month-wrapper').append(
            '<button id="clear-date-range" class="clearDateRange" name="clearDateRange" data-analytics-content-type="search intent" data-analytics-link-type="search intent" data-analytics-template-zone="body" data-analytics-module-name="nws-search-date-filter" data-analytics-link-name="clear" >Clear</button>',
          );
          // eslint-disable-next-line no-undef
          $('.clearDateRange').on('click', () => {
            // eslint-disable-next-line no-undef
            $('#newslist-filter-input').data('dateRangePicker').clear();
            const urlNoParamStr = window.location.toString().replace(window.location.search, '');
            window.location = urlNoParamStr;
          });
        }
        // eslint-disable-next-line no-undef
        const testL = $('#newslist-filter-input').offset().left;
        // eslint-disable-next-line no-undef
        $('.date-picker-wrapper').css('left', testL);
      });
  }
  const datePicker = document.querySelector('.date-picker-wrapper');
  datePicker.classList.add('date-picker-wrapper-custom');
  const paramDateFrom = usp.get('from_date');
  const paramDateTo = usp.get('to_date');
  if (paramDateFrom && paramDateTo) {
    // eslint-disable-next-line no-undef
    $('#newslist-filter-input').data('dateRangePicker')
      // eslint-disable-next-line no-undef
      .setStart(moment(paramDateFrom.toString()).format('MM/DD/YY'))
      // eslint-disable-next-line no-undef
      .setEnd(moment(paramDateTo.toString()).format('MM/DD/YY'));
  }

  function displayDatePicker(e) {
    e.stopPropagation();
    e.preventDefault();
    const stateOC = document.querySelector('.date-picker-wrapper').style.display === 'none';
    if (stateOC) {
      // eslint-disable-next-line no-undef
      $('#newslist-filter-input').data('dateRangePicker').open();
    } else {
      // eslint-disable-next-line no-undef
      $('#newslist-filter-input').data('dateRangePicker').close();
    }
  }

  const filterButton = document.querySelector('#filter-form > input[type=submit]');
  if (filterButton) {
    filterButton.addEventListener('click', displayDatePicker);
  }
}

const preflightListener = async () => {
  const section = createTag('div');
  const wrapper = createTag('div');
  section.appendChild(wrapper);
  const preflightBlock = buildBlock('preflight', '');
  wrapper.appendChild(preflightBlock);
  decorateBlock(preflightBlock);
  await loadBlock(preflightBlock);
  const { default: getModal } = await import('../blocks/modal/modal.js');
  const customModal = await getModal('dialog-modal', () => section.innerHTML, (modal) => {
    modal.querySelector('button[name="close"]')?.addEventListener('click', () => modal.close());
  });
  customModal.showModal();
};

const hasInvalidTags = () => {
  const oAsideComponent = document.querySelector('.aside-container');
  let bHasInvalidTags = false;
  if (!oAsideComponent) {
    return false;
  }
  const oIndustry = oAsideComponent.querySelector('.tags .industry');
  const oSubject = oAsideComponent.querySelector('.tags .subject');
  const aAllTagsText = [];
  if (oIndustry) {
    const oIndustryTags = oIndustry.querySelectorAll('.industry-tag a');
    oIndustryTags.forEach((oLink) => aAllTagsText.push(oLink.innerText));
  }
  if (oSubject) {
    const oSubjectTags = oSubject.querySelectorAll('.subject-tag a');
    oSubjectTags.forEach((oLink) => aAllTagsText.push(oLink.innerText));
  }

  aAllTagsText.forEach((sTags) => {
    if (sTags.includes(INVALID_TAG_ERROR)) {
      bHasInvalidTags = true;
    }
  });
  return bHasInvalidTags;
};

const getContentDate = () => {
  const sPublishDate = document.querySelector('meta[name=publisheddate]').content || '';
  const oDateObject = new Date(sPublishDate);
  if (oDateObject.toDateString() === 'Invalid Date') {
    return 'Invalid Date';
  }
  const extractedDate = sPublishDate.split(' ')[0];
  return extractedDate;
};

// Set event for the publish button for confirmation message
const publishConfirmationPopUp = (oPublishButtons) => {
  const oSidekick = document.querySelector('helix-sidekick');
  // Add plugin listeners here
  if (!oSidekick) {
    return;
  }
  oPublishButtons.forEach((oPublishBtn) => {
    // eslint-disable-next-line func-names, consistent-return
    oPublishBtn.addEventListener('mousedown', function (e) {
      if (hasInvalidTags()) {
        // eslint-disable-next-line no-alert
        alert(`Publishing Error: Unable to publish page. Invalid tags detected. Please review and correct the tags before attempting to publish again.\nContent Date is ${getContentDate()}\n`);
        e.stopImmediatePropagation();
        return;
      }
      // eslint-disable-next-line no-restricted-globals, no-alert
      if (confirm(` Are you sure you want to publish this content live?\n Content Date is ${getContentDate()}`)) {
        // continue publishing
        this.click();
      } else {
        // avoid publishing
        e.stopImmediatePropagation();
      }
    });
  });
};

// Handler for publish button to set observer-
// if the publish button is already loaded on the shadowroot
const publishConfirmationHandler = (oSidekick) => {
  if (!oSidekick) {
    return;
  }
  const oShadowRoot = oSidekick.shadowRoot;
  if (!oShadowRoot) {
    return;
  }

  // Options for the observer (which mutations to observe)
  const config = { childList: true, subtree: true };
  // Callback function to execute when mutations are observed
  const callback = (_mutationList, observer) => {
    const oPublishButtons = oSidekick.shadowRoot.querySelectorAll('button[title="Publish"]');
    if (oPublishButtons.length !== 0) {
      publishConfirmationPopUp(oPublishButtons);
      observer.disconnect();
    }
  };

  // Create an observer instance linked to the callback function
  const observer = new MutationObserver(callback);

  // Start observing the target node for configured mutations
  observer.observe(oShadowRoot, config);
};

// Observe helix-sidekick element if already loaded on the html body
const helixSideKickObserver = () => {
  // const oSidekick = document.querySelector('helix-sidekick');
  const sk = document.querySelector('helix-sidekick');
  if (sk) {
    // sidekick already loaded
    sk.addEventListener('custom:preflight', preflightListener);
    publishConfirmationHandler(sk);
  } else {
    // wait for sidekick to be loaded
    document.addEventListener('sidekick-ready', () => {
      const oAddedSidekick = document.querySelector('helix-sidekick');
      oAddedSidekick.addEventListener('custom:preflight', preflightListener);
      publishConfirmationHandler(oAddedSidekick);
    }, { once: true });
  }
};

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  helixSideKickObserver();
  await setCSP();
  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  centerArticleDivider(main);

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

async function completeFFetchIteration() {
  if (!window.articles || !window.ffetchIterator) {
    return false;
  }
  const template = getMetadata('template');
  const filterYearInput = document.querySelector('#filter-year');
  if (template === 'Category' && isMobile() && !filterYearInput) {
    return false;
  }
  // eslint-disable-next-line no-restricted-syntax
  for await (const article of window.ffetchIterator) {
    window.articles.push(article);
  }
  return true;
}

async function loadSemiDelayed() {
  if (await completeFFetchIteration()) {
    // trigger an event 'ffetch-articles-completed'
    const event = new CustomEvent('ffetch-articles-completed', { detail: window.articles });
    document.dispatchEvent(event);
  }
  addPrevNextLinksToArticles();
  loadJQueryDateRangePicker();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // article processing
  window.setTimeout(() => loadSemiDelayed(), 2000);
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
