import { readBlockConfig, fetchPlaceholders } from '../../scripts/lib-franklin.js';
import {
  fetchIndex,
  ffetchArticles,
  ABSTRACT_REGEX,
  annotateElWithAnalyticsTracking,
  createFilterYear,
  addEventListenerToFilterYear,
  getPlaceholder,
  getCountry,
  getDateLocales,
  validateInputDate,
} from '../../scripts/scripts.js';
import {
  ANALYTICS_MODULE_SEARCH,
  ANALYTICS_TEMPLATE_ZONE_BODY,
  ANALYTICS_LINK_TYPE_SEARCH_ACTIVITY,
  ANALYTICS_MODULE_TOP_NAV,
  ANALYTICS_LINK_TYPE_SEARCH_INTENT,
  ANALYTICS_MODULE_YEAR_FILTER,
  ANALYTICS_LINK_TYPE_FILTER,
  ANALYTICS_MODULE_ARCHIVE_NAV,
  ANALYTICS_LINK_TYPE_NAV_PAGINATE,
  ANALYTICS_MODULE_SEARCH_LIST,
  ANALYTICS_MODULE_MOBILE_FILTER,
  ANALYTICS_MODULE_ARTICLE_LIST,
  ANALYTICS_LINK_TYPE_INLINE_LINK,
  ANALYTICS_LINK_TYPE_CONTENT_MODULE,
  ANALYTICS_LINK_TYPE_ENGAGEMENT,
  ANALYTICS_MODULE_CONTENT_CARDS,
} from '../../scripts/constants.js';

const MAX_CHARS_IN_CARD_DESCRIPTION = 800;

function getHumanReadableDate(dateString) {
  if (!dateString) return dateString;
  const date = new Date(parseInt(dateString, 10));
  const specialCountries = ['pt', 'br', 'sp'];
  // display the date in GMT timezone
  const country = getCountry();
  const localedate = date.toLocaleDateString(getDateLocales(country), {
    timeZone: 'GMT',
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
  if (specialCountries.includes(country)) {
    // de means 'of' in pt/br/sp, replacing with empty string
    return localedate.replace(/de /g, '');
  }
  return localedate;
}

/**
 * Removes the heading and list elements from the given element
 *
 * @param {*} element
 */
function cleanDescription(element) {
  const elementsToRemove = ['h1', 'h2', 'h3', 'h6', 'ul'];
  elementsToRemove.forEach((e) => {
    const el = element.querySelector(e);
    if (el) {
      el.remove();
    }
  });
  return element.innerHTML;
}

/**
 * In the longdescrptionextracted field, iterate over all the child nodes and
 * check if the content matches with the regex, then return it as description.
 * Oterwise return the description field.
 * @param {*} queryIndexEntry
 * @returns
 */
function getDescription(queryIndexEntry) {
  const { longdescriptionextracted } = queryIndexEntry;
  const div = document.createElement('div');
  div.innerHTML = longdescriptionextracted;
  const longdescriptionElements = Array.from(div.querySelectorAll('p'));
  const matchingParagraph = longdescriptionElements.find((p) => ABSTRACT_REGEX.test(p.innerText));
  const oBr = matchingParagraph?.querySelector('br');
  if (oBr) {
    oBr.remove();
  }
  let longdescription = matchingParagraph ? matchingParagraph.outerHTML : '';
  if (longdescription === '') {
    // obtain the description with out regex matching
    longdescription = cleanDescription(div);
  }
  if (queryIndexEntry.description.length > longdescription.length) {
    longdescription = `<p>${queryIndexEntry.description}</p>`;
  } else if (longdescription.length > MAX_CHARS_IN_CARD_DESCRIPTION) {
    if (matchingParagraph) {
      longdescription = `<p>${matchingParagraph.innerHTML.substring(0, MAX_CHARS_IN_CARD_DESCRIPTION)}...</p>`;
    } else {
      longdescription = `<p>${longdescription.substring(0, MAX_CHARS_IN_CARD_DESCRIPTION)}...</p>`;
    }
  }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = longdescription;
  return wrapper.innerHTML;
}

function filterByQuery(article, query) {
  if (!query) return true;
  const queryTokens = query.split(' ').map((t) => t.toLowerCase());
  const title = article.title.toLowerCase();
  // use the longdescriptionextracted field even though it has the html tags in it,
  // DOM manipulation in getDescrption function is very expensive to use for every
  // article filtering
  const longdescription = article.longdescriptionextracted.toLowerCase();
  return queryTokens.every((token) => {
    if (title.includes(token) || longdescription.includes(token)) {
      return true;
    }
    return false;
  });
}

function ifArticleBetweenDates(article, fromDate, toDate) {
  if (!fromDate || !toDate) return true;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (from > to) return false;
  const date = new Date(parseInt(article.publisheddateinseconds * 1000, 10));
  // ignore the time part of the date
  date.setHours(0, 0, 0, 0);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return date >= from && date <= to;
}

/**
 * appends the given param to the existing params of the url
 */
function addParam(name, value) {
  const usp = new URLSearchParams(window.location.search);
  if (name && value) {
    usp.set(name, value);
  }
  if (!value) {
    usp.delete(name);
  }
  return `${window.location.pathname}?${usp.toString()}`;
}

/**
 * Creates start, mid and end groups of page numbers for pagination
 * @param {*} totalPages
 * @param {*} currentPage
 * @returns
 */
function getPaginationGroups(totalPages, currentPage) {
  const MAX_ENTRIES = 7;
  if (totalPages <= MAX_ENTRIES) {
    const r = [];
    for (let i = 1; i <= totalPages; i += 1) {
      r.push(i);
    }
    return [r, [], []];
  }

  const start = [];
  const mid = [];
  const end = [];

  // Include initial pages
  if (currentPage < 5) {
    for (let i = 1; i < Math.min(totalPages, 5); i += 1) {
      start.push(i);
    }
  } else {
    start.push(1);
    start.push(2);
  }

  // Include middle page numbers with current, previous, and next page numbers
  if (currentPage >= 5 && currentPage < totalPages) {
    for (let i = currentPage - 1; i <= Math.min(currentPage + 1, totalPages); i += 1) {
      mid.push(i);
    }
  }

  // Include last two page numbers
  if (currentPage < totalPages - 2) {
    end.push(totalPages - 1);
    end.push(totalPages);
  }
  const result = [start, mid, end];
  if (result.length < MAX_ENTRIES) {
    let diff = MAX_ENTRIES - (start.length + mid.length + end.length);
    // add a few more numbers from the previous of zero set
    if (end.length === 0) {
      let midSetFirstElement = mid[0];
      if (!midSetFirstElement) {
        mid.push(currentPage);
        midSetFirstElement = currentPage;
        diff -= 1;
      }
      for (let i = 1; i <= diff; i += 1) {
        // add to the start of mid array
        mid.unshift(midSetFirstElement - i);
      }
    } else if (mid.length === 0) {
      const startSetSize = start.length;
      for (let i = 1; i <= diff; i += 1) {
        start.push(startSetSize + i);
      }
    }
  }

  return result;
}

function getYears(index) {
  const years = [];
  index.forEach((e) => {
    const date = new Date(parseInt(e.publisheddateinseconds * 1000, 10));
    const year = date.getFullYear();
    if (!years.includes(year)) {
      years.push(year);
    }
  });
  return years;
}

/**
 * cache the years of all the articles in window object so that we
 * can show these years in years filter
 * @param {*} article
 * @param {*} year
 * @returns
 */
function filterByYear(article, year) {
  if (!year) return true;
  const date = new Date(parseInt(article.publisheddateinseconds * 1000, 10));
  window.categoryArticleYears = window.categoryArticleYears || [date.getFullYear()];
  if (!window.categoryArticleYears.includes(date.getFullYear())) {
    window.categoryArticleYears.push(date.getFullYear());
  }
  return date.getFullYear() === parseInt(year, 10);
}

function addEventListenerToFilterForm(block) {
  if (window.innerWidth > 768) {
    return;
  }
  const filterForm = block.querySelector('#filter-form');
  const filterFormLabel = filterForm.querySelector('label');
  const filterArrow = filterForm.querySelector('.newslist-filter-arrow');
  const filterInput = filterForm.querySelector('#newslist-filter-input');
  const filterFormSubmit = filterForm.querySelector('input[type="submit"]');
  const filterYear = filterForm.querySelector('#filter-year');
  annotateElWithAnalyticsTracking(
    filterFormLabel,
    'filter now expand',
    ANALYTICS_MODULE_MOBILE_FILTER,
    ANALYTICS_TEMPLATE_ZONE_BODY,
    ANALYTICS_LINK_TYPE_FILTER,
  );
  filterFormLabel.addEventListener('click', (e) => {
    e.preventDefault();
    const isActive = filterArrow.classList.contains('active');
    if (isActive) {
      filterArrow.classList.remove('active');
      filterInput.style.display = 'none';
      filterFormSubmit.style.display = 'none';
      if (filterYear) {
        filterYear.style.display = 'none';
      }
    } else {
      filterArrow.classList.add('active');
      filterInput.style.display = 'inline';
      filterFormSubmit.style.display = 'inline';
      if (filterYear) {
        filterYear.style.display = 'inline-block';
      }
    }
  });
}

function ifArticleBelongsToCategories(article, key, value) {
  const values = article[key.trim()].toLowerCase().split(',').map((v) => v.trim());
  if (values.includes(value.trim().toLowerCase())) {
    return true;
  }
  return false;
}

function updatePagination(paginationContainer, totalResults, pageOffset) {
  if (totalResults > 10) {
    const totalPages = Math.ceil(totalResults / 10);
    const paginationGroups = getPaginationGroups(totalPages, pageOffset);
    for (let i = 0; i < paginationGroups.length; i += 1) {
      const pageGroup = paginationGroups[i];
      pageGroup.forEach((pageNumber) => {
        const pageUrl = addParam('page', pageNumber);
        const pageLink = document.createElement('a');
        pageLink.classList.add('pagination-link');
        pageLink.setAttribute('href', pageUrl);
        pageLink.setAttribute('title', pageNumber);
        pageLink.innerText = pageNumber;
        if (pageNumber === pageOffset) {
          pageLink.classList.add('current-page');
        }
        paginationContainer.append(pageLink);
      });
      if (i < paginationGroups.length - 1 && paginationGroups[i + 1].length > 0) {
        const ellipsis = document.createElement('a');
        ellipsis.setAttribute('href', '#');
        ellipsis.setAttribute('tabIndex', '-1');
        ellipsis.classList.add('pagination-ellipsis');
        ellipsis.innerText = '...';
        ellipsis.addEventListener('click', (e) => e.preventDefault());
        paginationContainer.append(ellipsis);
      }
    }
    const prev = document.createElement('a');
    if (pageOffset === 1) {
      prev.setAttribute('aria-disabled', 'true');
      prev.setAttribute('href', '#');
    } else {
      prev.setAttribute('href', addParam('page', pageOffset - 1));
    }
    prev.classList.add('pagination-prev');
    prev.setAttribute('title', 'Prev');
    prev.innerHTML = '<span class="pagination-prev-arrow"/>';
    paginationContainer.prepend(prev);
    const next = document.createElement('a');
    if (pageOffset === totalPages) {
      next.setAttribute('aria-disabled', 'true');
      next.setAttribute('href', '#');
    } else {
      next.setAttribute('href', addParam('page', pageOffset + 1));
    }
    next.innerHTML = '<span class="pagination-next-arrow"/>';
    next.classList.add('pagination-next');
    next.setAttribute('title', 'Next');
    paginationContainer.append(next);
    paginationContainer.querySelectorAll('a').forEach((link) => {
      if (link.textContent === '...') {
        return;
      }
      annotateElWithAnalyticsTracking(
        link,
        link.textContent || link.title,
        ANALYTICS_MODULE_ARCHIVE_NAV,
        ANALYTICS_TEMPLATE_ZONE_BODY,
        ANALYTICS_LINK_TYPE_NAV_PAGINATE,
      );
    });
  }
}

function updateSearchSubHeader(block, start, end, totalResults) {
  const searchSubHeader = block.querySelector('.search-sub-header-right');
  if (searchSubHeader) {
    searchSubHeader.innerHTML = `
    ${totalResults > 0 ? `Showing ${start + 1} - ${Math.min(end, totalResults)} of ${totalResults} results` : ''}
    `;
  }
}

async function updateYearsDropdown(block, articles) {
  const placeholders = await fetchPlaceholders();
  const pYear = getPlaceholder('year', placeholders);
  const years = window.categoryArticleYears || getYears(articles);
  let options = years.map((y) => (`<div class="filter-year-item" value="${y}"  data-analytics-link-name="${y}"
  data-analytics-module-name=${ANALYTICS_MODULE_YEAR_FILTER} data-analytics-template-zone="${ANALYTICS_TEMPLATE_ZONE_BODY}"
  data-analytics-link-type="${ANALYTICS_LINK_TYPE_FILTER}">${y}</div>`)).join('');
  options = `<div class="filter-year-item" value="" data-analytics-link-name="YEAR"
  data-analytics-module-name=${ANALYTICS_MODULE_YEAR_FILTER} data-analytics-template-zone="${ANALYTICS_TEMPLATE_ZONE_BODY}"
  data-analytics-link-type="${ANALYTICS_LINK_TYPE_FILTER}">${pYear}</div> ${options}`;
  const yearsDropdown = block.querySelector('.filter-year-dropdown');
  yearsDropdown.innerHTML = options;
  addEventListenerToFilterYear(document.getElementById('filter-year'), window.location.pathname);
}

function ValidateSearchFormData(keyword) {
  if (typeof keyword === 'undefined' || keyword === null) {
    return '';
  }
  let sanitizedKeyword = keyword.replace(/[`%$^*()_+=[\]{}\\|<>/~!@#&]/g, '');
  sanitizedKeyword = sanitizedKeyword.slice(0, 60);
  return sanitizedKeyword.trim();
}

export default async function decorate(block) {
  const limit = 10;
  // get request parameter page as limit
  const usp = new URLSearchParams(window.location.search);
  const fromDate = validateInputDate(usp.get('from_date'));
  const toDate = validateInputDate(usp.get('to_date'));
  const year = usp.get('year');
  const pageOffset = parseInt(usp.get('page'), 10) || 1;
  const offset = (Math.max(pageOffset, 1) - 1) * 10;
  let start = offset;
  let end = offset + limit;
  let totalResults = -1;
  const cfg = readBlockConfig(block);
  const key = Object.keys(cfg)[0];
  const value = Object.values(cfg)[0];
  const isSearch = key === 'query';
  const placeholders = await fetchPlaceholders();
  const pSearch = getPlaceholder('search', placeholders);
  const pKeywords = getPlaceholder('keywords', placeholders);
  const pFilterNews = getPlaceholder('filterNews', placeholders);
  const pDateRange = getPlaceholder('dateRange', placeholders);
  const pReadMore = getPlaceholder('readMore', placeholders);
  let shortIndex;
  const newsListContainer = document.createElement('div');
  newsListContainer.classList.add('newslist-container');

  if (isSearch) {
    newsListContainer.classList.add('search-results-container');
    const query = ValidateSearchFormData(usp.get('q')) || '';
    if (query) {
      shortIndex = await ffetchArticles('/query-index.json', 'articles', end, (article) => filterByQuery(article, query));
    } else {
      shortIndex = [];
    }
    const searchHeader = document.createElement('div');
    searchHeader.classList.add('search-header-container');
    const form = `
      <form action="/search" method="get" id="search-form">
        <input type="text" id="search-input" title="${pKeywords}" placeholder="${pKeywords}" name="q" value="" size="40" maxlength="60">
        <input type="submit" title="${pSearch}" value="${pSearch}">
      </form>
    `;
    if (query) {
      searchHeader.innerHTML = `
      ${form}
      <h2></h2>
      <div class="search-sub-header">
        <h3> ${shortIndex.length > 0 ? 'ALL RESULTS' : '0 RESULTS WERE FOUND'} </h3>
        <div class="search-sub-header-right">
          ${`Showing ${start + 1} - ${Math.min(end, shortIndex.length)} results`}
        </div>
      </div>
      `;
      const heading = searchHeader.querySelector('h2');
      const searchInput = searchHeader.querySelector('#search-input');
      heading.textContent = `Results for "${query}"`;
      searchInput.setAttribute('value', query);
    } else if (usp.get('q') === null) {
      searchHeader.innerHTML = form;
    } else {
      searchHeader.innerHTML = `
      <div class="search-error">
        <img class="search-error-icon" src="/icons/error.png" alt="Search Error">
        <div class="search-error-content">
          <h4>Errors Occurred</h4>
          <ul>
            <li>At least one keyword is required.</li>
          </ul>
        </div>
      </div>
      <a class="search-error-back" href="/search" title="Back" data-analytics-link-name="back" data-analytics-link-type="call to action"
        data-analytics-content-type="call to action" data-analytics-template-zone="body"
        data-analytics-module-name="nws-search">
        Back
      </a>
      `;
    }
    const submitAction = searchHeader.querySelector('input[type="submit"]');
    annotateElWithAnalyticsTracking(
      submitAction,
      'search',
      ANALYTICS_MODULE_SEARCH,
      ANALYTICS_TEMPLATE_ZONE_BODY,
      ANALYTICS_LINK_TYPE_SEARCH_ACTIVITY,
    );
    const searchInput = searchHeader.querySelector('#search-input');
    annotateElWithAnalyticsTracking(
      searchInput,
      '',
      ANALYTICS_MODULE_TOP_NAV,
      ANALYTICS_TEMPLATE_ZONE_BODY,
      ANALYTICS_LINK_TYPE_SEARCH_ACTIVITY,
    );
    newsListContainer.append(searchHeader);
  } else if (key && value) {
    if (fromDate && toDate) {
      shortIndex = await ffetchArticles(
        '/query-index.json',
        'articles',
        end,
        (article) => ifArticleBelongsToCategories(article, key, value)
          && ifArticleBetweenDates(article, fromDate, toDate),
      );
    } else if (year) {
      shortIndex = await ffetchArticles(
        '/query-index.json',
        'articles',
        end,
        (article) => ifArticleBelongsToCategories(article, key, value)
          && filterByYear(article, year),
      );
    } else {
      shortIndex = await ffetchArticles(
        '/query-index.json',
        'articles',
        end,
        (article) => ifArticleBelongsToCategories(article, key, value),
      );
    }
    const years = getYears(shortIndex);
    const filterYear = await createFilterYear(years, year, window.location.pathname);
    // prepend filter form and year picker
    const newsListHeader = document.createElement('div');
    newsListHeader.classList.add('newslist-header-container');
    newsListHeader.innerHTML = `
      <form action="${window.location.pathname}" method="get" id="filter-form">
        <label for="newslist-filter-input">${pFilterNews}
          <span class="newslist-filter-arrow"></span>
        </label>
        <input type="text" id="newslist-filter-input" title="${pDateRange}" name="date" value="" size="40" placeholder="${pDateRange}" maxlength="60" disabled>
        <input type="submit" value="" aria-label="calendar" disabled>
      </form>
    `;
    newsListHeader.querySelector('#filter-form').append(filterYear);
    newsListContainer.append(newsListHeader);
  } else {
    if (fromDate && toDate) {
      shortIndex = await ffetchArticles(
        '/query-index.json',
        'articles',
        end,
        (article) => ifArticleBetweenDates(article, fromDate, toDate),
      );
    } else {
      const rawIndex = await fetchIndex('/query-index.json', 'articles', limit, offset);
      shortIndex = rawIndex.data;
      start = 0;
      end = limit;
      totalResults = rawIndex.total;
    }
    // prepend search form and date picker
    const newsListHeader = document.createElement('div');
    newsListHeader.classList.add('newslist-header-container');
    newsListHeader.innerHTML = `
      <form action="/search" method="get" id="newslist-search-form">
        <label for="newslist-search-input">${pSearch}</label>
        <input type="text" id="newslist-search-input" title="${pKeywords}" name="q" value="" size="40" maxlength="60">
        <input type="submit" value="${pSearch}">
      </form>

      <form action="${window.location.pathname}" method="get" id="filter-form">
        <label for="newslist-filter-input">${pFilterNews}
          <span class="newslist-filter-arrow"></span>
        </label>
        <input type="text" id="newslist-filter-input" title="${pDateRange}" name="date" value="" placeholder="${pDateRange}" size="40" maxlength="60" disabled>
        <input type="submit" value="" aria-label="calendar" disabled>
      </form>
    `;
    const searchSubmitAction = newsListHeader.querySelector('#newslist-search-form input[type="submit"]');
    annotateElWithAnalyticsTracking(
      searchSubmitAction,
      'initiated search - click/tap',
      ANALYTICS_MODULE_SEARCH,
      ANALYTICS_TEMPLATE_ZONE_BODY,
      ANALYTICS_LINK_TYPE_SEARCH_INTENT,
    );
    newsListContainer.append(newsListHeader);
  }

  const range = document.createRange();
  for (let i = start; i < end && i < shortIndex.length; i += 1) {
    const e = shortIndex[i];
    let itemHtml;
    if (isSearch) {
      itemHtml = `
      <div class="search-results-item">
        <div class="search-results-item-published-date">
          ${getHumanReadableDate(e.publisheddateinseconds * 1000)}
        </div>
        <div class="search-results-item-title">
          <a href="${e.path}" title="${e.title}" target="_blank">${e.title}</a>
        </div>
        <div class="search-results-item-content">${getDescription(e)}</div>
      </div>

      `;
    } else {
      itemHtml = `
        <div class="newslist-item">
          <div class="newslist-item-title">
            <h3>
              <a href="${e.path}" title="${e.title}">${e.title}</a>
            </h3>
          </div>
          <div class="newslist-item-description">
            ${getDescription(e)}
          </div>
          <div class="newslist-item-footer">
            <a href="${e.path}" title="${pReadMore}">${pReadMore}
              <span class="read-more-arrow"></span>
              <span class="sr-only"> Read more about ${e.title}</span>
            </a>
            <div class="newslist-item-publisheddate">
              ${getHumanReadableDate(e.publisheddateinseconds * 1000)}
            </div>
          </div>
        </div>
      `;
    }
    const item = range.createContextualFragment(itemHtml);
    item.querySelectorAll('a:not(.newslist-item-description a), a:not(.search-results-item-content a)').forEach((link) => {
      // special handling for read more links
      let readMoreLinkName = '';
      if (link.closest('.newslist-item-footer')) {
        readMoreLinkName = `read more: ${e.title.toLowerCase()}`;
      }
      annotateElWithAnalyticsTracking(
        link,
        readMoreLinkName || link.textContent,
        isSearch ? ANALYTICS_MODULE_SEARCH_LIST : ANALYTICS_MODULE_CONTENT_CARDS,
        ANALYTICS_TEMPLATE_ZONE_BODY,
        isSearch ? ANALYTICS_LINK_TYPE_SEARCH_ACTIVITY : ANALYTICS_LINK_TYPE_ENGAGEMENT,
      );
    });
    item.querySelectorAll('.newslist-item-description a, .search-results-item-content a').forEach((link) => {
      annotateElWithAnalyticsTracking(
        link,
        link.textContent,
        isSearch ? ANALYTICS_MODULE_SEARCH_LIST : ANALYTICS_MODULE_ARTICLE_LIST,
        ANALYTICS_TEMPLATE_ZONE_BODY,
        isSearch ? ANALYTICS_LINK_TYPE_INLINE_LINK : ANALYTICS_LINK_TYPE_CONTENT_MODULE,
      );
    });
    newsListContainer.append(item);
  }
  block.innerHTML = newsListContainer.outerHTML;

  if (!isSearch) {
    addEventListenerToFilterForm(block);
  }

  // add pagination information
  const paginationContainer = document.createElement('div');
  paginationContainer.classList.add('newslist-pagination-container');
  if (totalResults !== -1) {
    updatePagination(paginationContainer, totalResults, pageOffset);
  } else {
    document.addEventListener('ffetch-articles-completed', async (event) => {
      updatePagination(paginationContainer, event.detail.length, pageOffset);
      if (isSearch) {
        updateSearchSubHeader(block, start, end, event.detail.length);
      }
      if (key && value) {
        await updateYearsDropdown(block, event.detail);
      }
    });
  }
  block.append(paginationContainer);
}
