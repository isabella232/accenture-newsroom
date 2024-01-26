import {
  annotateElWithAnalyticsTracking,
  createAnnotatedLinkEl,
  createEl,
  getPlaceholder,
  getSiteFromHostName,
  sanitizeName,
} from '../../scripts/scripts.js';
import {
  decorateIcons,
  getMetadata,
  loadScript,
  fetchPlaceholders,
} from '../../scripts/lib-franklin.js';
import {
  ANALYTICS_LINK_TYPE_DOWNLOADABLE,
  ANALYTICS_LINK_TYPE_ENGAGEMENT,
  ANALYTICS_LINK_TYPE_SHARE_INTENT,
  ANALYTICS_MODULE_DOWNLOAD_ARTICLE,
  ANALYTICS_MODULE_INDUSTRY_TAGS,
  ANALYTICS_MODULE_SHARE,
  ANALYTICS_MODULE_SUBJECT_TAGS,
  ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
  INVALID_TAG_ERROR,
} from '../../scripts/constants.js';

async function generatePDF(pageName) {
  // Source HTMLElement or a string containing HTML.
  const main = document.querySelector('main').cloneNode(true);
  const heroContainer = main.querySelector('.section.hero-container');
  const asideContainer = main.querySelector('.aside-container');
  heroContainer.remove();
  asideContainer.remove();

  const { html2pdf } = window;
  const opt = {
    margin: [30, 30, 30, 30],
    filename: `${pageName}.pdf`,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, letterRendering: true },
    jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };
  html2pdf().set(opt).from(main).save();
}

/**
 * Converts the given tagName to camelCase and look up the value in the placeholders object.
 * If the value is not found, the defaultValue is returned.
 * @param {*} tagName
 * @param {*} placeholders
 * @param {*} defaultValue
 * @returns
 */

const getTaxonomy = async () => {
  const resp = await fetch('/tags.json');
  const tagsJson = await resp.json();
  return tagsJson.data;
};

const getTagTitleHandler = (sTag, oTaxonomy) => {
  const sDomain = window.location.origin;

  for (let i = 0; i < oTaxonomy.length; i += 1) {
    if (oTaxonomy[i].value === sTag) {
      return { tagTitle: oTaxonomy[i].text, valid: true };
    }
  }

  if (!sDomain.includes('https://newsroom')) {
    const sInvalidTag = `${sTag} ${INVALID_TAG_ERROR}`;
    return { tagTitle: sInvalidTag, valid: false };
  }

  return { tagTitle: sTag, valid: true };
};

const getReduceTags = (oTaxonomy, sCategory) => {
  const sCategoryCapital = sCategory.charAt(0).toUpperCase() + sCategory.slice(1);
  return oTaxonomy.reduce((oAccumulated, oObject) => {
    // eslint-disable-next-line no-unused-expressions
    oAccumulated[sCategory] || (oAccumulated[sCategory] = []);
    oAccumulated[sCategory].push({
      value: oObject[`${sCategoryCapital} Value`],
      text: oObject[`${sCategoryCapital} Text`],
    });
    return oAccumulated;
  }, {});
};

function getPrefixForTags(siteName, category) {
  const siteNamePrefixMapping = {
    us: '',
    uk: '/english-uk',
    de: '/de',
    fr: '/fr',
    it: '/it',
    es: '/es',
    sg: '/asia-pacific',
    pt: '/pt',
    jp: '/jp',
    br: '/br',
  };
  let categoryMapping = category;
  if (siteName === 'fr') {
    categoryMapping = category === 'industries' ? 'secteurs-dactivit' : 'sujet';
  }
  if (siteName === 'it') {
    categoryMapping = category === 'subjects' ? 'argomento' : 'industries';
  }
  return `${siteNamePrefixMapping[siteName] || ''}/${categoryMapping}`;
}

export default async function decorate(block) {
  block.innerText = '';
  const pageUrl = window.location.href;
  const pageTitle = getMetadata('og:title');
  const pageName = pageUrl.split('/').pop();
  const placeholders = await fetchPlaceholders();
  const pShare = getPlaceholder('share', placeholders);
  const pDownloadPressRelease = getPlaceholder('downloadPressRelease', placeholders);
  const pIndustryTags = getPlaceholder('industryTags', placeholders);
  const pSubjectTags = getPlaceholder('subjectTags', placeholders);

  // Create social share icons
  const social = createEl('div', { class: 'social' });

  // Linkedin
  const linkedinShareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${pageUrl}&title=${pageTitle}`;
  const linkedinShare = createAnnotatedLinkEl(
    linkedinShareUrl,
    'linkedin',
    ANALYTICS_MODULE_SHARE,
    ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
    ANALYTICS_LINK_TYPE_SHARE_INTENT,
  );
  linkedinShare.innerHTML = '<span class="icon icon-social-linkedin" />';
  linkedinShare.setAttribute('onclick', "return !window.open(this.href, 'Linkedin', 'width=640,height=580')");
  createEl('div', { class: 'linkedin-share' }, linkedinShare, social);

  // Twitter
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURI(pageTitle)}&url=${pageUrl}`;
  const twitterShare = createAnnotatedLinkEl(
    twitterUrl,
    'twitter',
    ANALYTICS_MODULE_SHARE,
    ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
    ANALYTICS_LINK_TYPE_SHARE_INTENT,
  );
  twitterShare.innerHTML = '<span class="icon icon-social-twitter" />';
  twitterShare.setAttribute('onclick', "return !window.open(this.href, 'Twitter', 'width=640,height=580')");
  createEl('div', { class: 'twitter-share' }, twitterShare, social);

  // Facebook
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}&display=popup&ref=plugin&src=share_button`;
  const facebookShare = createAnnotatedLinkEl(
    facebookUrl,
    'facebook',
    ANALYTICS_MODULE_SHARE,
    ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
    ANALYTICS_LINK_TYPE_SHARE_INTENT,
  );
  facebookShare.innerHTML = '<span class="icon icon-social-facebook" />';
  facebookShare.setAttribute('onclick', "return !window.open(this.href, 'Facebook', 'width=640,height=580')");
  createEl('div', { class: 'facebook-share' }, facebookShare, social);

  // Email
  const emailUrl = `mailto:?subject=${pageTitle}&body=Read this from Accenture Newsroom: ${pageUrl}`;
  const emailShare = createAnnotatedLinkEl(
    emailUrl,
    'email',
    ANALYTICS_MODULE_SHARE,
    ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
    ANALYTICS_LINK_TYPE_SHARE_INTENT,
  );
  emailShare.innerHTML = '<span class="icon icon-social-email" />';
  emailShare.target = '_blank';
  createEl('div', { class: 'email-share' }, emailShare, social);

  // Print
  const printShare = createAnnotatedLinkEl(
    // eslint-disable-next-line no-script-url
    'javascript:void(0)',
    'print',
    ANALYTICS_MODULE_SHARE,
    ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
    ANALYTICS_LINK_TYPE_ENGAGEMENT,
  );
  printShare.innerHTML = '<span class="icon icon-social-print" />';
  printShare.setAttribute('onclick', 'window.print()');
  createEl('div', { class: 'print-share' }, printShare, social);

  await decorateIcons(social);
  const share = createEl('div', { class: 'share' }, social);
  const shareTitle = createEl('h4', {}, pShare);
  share.prepend(shareTitle);
  block.append(share);

  // PDF Download button
  const addPDF = getMetadata('pdf');
  if (addPDF && (addPDF === 'true')) {
    const pdfButton = createEl('a', { class: 'pdf-button button', title: ' Convert to PDF', 'data-analytics-download-fileName': `${pageName}` }, pDownloadPressRelease, share);
    annotateElWithAnalyticsTracking(
      pdfButton,
      pdfButton.textContent,
      ANALYTICS_MODULE_DOWNLOAD_ARTICLE,
      ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
      ANALYTICS_LINK_TYPE_DOWNLOADABLE,
    );

    pdfButton.addEventListener('click', async () => {
      // Add the html2pdf script
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', {
        integrity: 'sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==',
        crossorigin: 'anonymous',
        referrerpolicy: 'no-referrer',
      });
      if (window.html2pdf) {
        await generatePDF(pageName);
      }
    });
  }

  // Create Tags Elements
  const createTagsHandler = (
    sClassTag,
    sTagValues,
    aTagsCollection,
    sPrefix,
    oTagUL,
    sAnalyticsModuleName,
  ) => {
    sTagValues.split(',').forEach((sTag) => {
      const oTagTile = getTagTitleHandler(sTag.trim(), aTagsCollection);
      const cleanedUpValue = sanitizeName(sTag);
      const link = createEl('a', { href: `${sPrefix}/${cleanedUpValue}`, class: `${oTagTile.valid ? '' : 'invalid-tag'}` }, oTagTile.tagTitle.trim());
      annotateElWithAnalyticsTracking(
        link,
        link.textContent,
        sAnalyticsModuleName,
        ANALYTICS_TEMPLATE_ZONE_RIGHT_RAIL,
        ANALYTICS_LINK_TYPE_ENGAGEMENT,
      );
      createEl('li', { class: sClassTag }, link, oTagUL);
    });
  };

  // Tags
  const oTaxonomy = await getTaxonomy();
  const aSubjectsTagsCollection = getReduceTags(oTaxonomy, 'subjects').subjects || [];
  const aIndustriesTagsCollection = getReduceTags(oTaxonomy, 'industries').industries || [];
  const industryTagValues = getMetadata('industries');
  const subjectTagValues = getMetadata('subjects');
  const industryEl = industryTagValues ? createEl('div', { class: 'industry' }, `<h4>${pIndustryTags}</h4>`) : null;
  const subjectEl = subjectTagValues ? createEl('div', { class: 'subject' }, `<h4>${pSubjectTags}</h4>`) : null;
  const siteName = getSiteFromHostName(window.location.hostname);
  const industriesPrefix = getPrefixForTags(siteName, 'industries');
  const subjectsPrefix = getPrefixForTags(siteName, 'subjects');

  const industryUl = industryEl ? createEl('ul', {}, '', industryEl) : null;
  createTagsHandler('industry-tag', industryTagValues, aIndustriesTagsCollection, industriesPrefix, industryUl, ANALYTICS_MODULE_INDUSTRY_TAGS);

  const subjectUl = subjectEl ? createEl('ul', {}, '', subjectEl) : null;
  createTagsHandler('subject-tag', subjectTagValues, aSubjectsTagsCollection, subjectsPrefix, subjectUl, ANALYTICS_MODULE_SUBJECT_TAGS);

  const tags = createEl('div', { class: 'tags' });
  if (industryEl) {
    tags.append(industryEl);
  }
  if (subjectEl) {
    tags.append(subjectEl);
  }
  block.append(tags);
}
