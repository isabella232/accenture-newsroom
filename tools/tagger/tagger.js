function renderItems(cat, catId, taxonomy) {
  let html = '';
  const oCategoryTags = taxonomy[cat];
  oCategoryTags.forEach((tag) => {
    if (tag.value.trim() !== '' && tag.text.trim() !== '') {
      html += `
      <span class="path">
        <span data-title="${tag.value}" class="tag cat-${catId % 8}">${tag.text}</span>
      </span>
    `;
    }
  });
  return html;
}

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

function initTaxonomy(taxonomy) {
  let html = '';
  const subjectsTags = getReduceTags(taxonomy, 'subjects');
  const industriesTags = getReduceTags(taxonomy, 'industries');
  const tagsJson = { ...subjectsTags, ...industriesTags };

  Object.keys(tagsJson).forEach((cat, idx) => {
    const sCategory = cat.charAt(0).toUpperCase() + cat.slice(1);
    html += '<div class="category">';
    html += `<h2>${sCategory}</h2>`;
    html += renderItems(cat, idx, tagsJson);
    html += '</div>';
  });

  const results = document.getElementById('results');
  results.innerHTML = html;
}

async function getTaxonomy() {
  const resp = await fetch('/tags.json');
  const tagsJson = await resp.json();
  return tagsJson.data;
}

function filter() {
  const searchTerm = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('#results .tag').forEach((tag) => {
    const tagText = tag.innerText;
    const offset = tagText.toLowerCase().indexOf(searchTerm);
    if (offset >= 0) {
      const before = tagText.substring(0, offset);
      const term = tagText.substring(offset, offset + searchTerm.length);
      const after = tagText.substring(offset + searchTerm.length);
      tag.innerHTML = `${before}<span class="highlight">${term}</span>${after}`;
      tag.closest('.path').classList.remove('filtered');
    } else {
      tag.closest('.path').classList.add('filtered');
    }
  });
}

function toggleTag(target) {
  target.classList.toggle('selected');
  // eslint-disable-next-line no-use-before-define
  displaySelected();
  const selEl = document.getElementById('selected');
  const copyButton = selEl.querySelector('button.copy');
  copyButton.disabled = false;
}

function displaySelected() {
  const selEl = document.getElementById('selected');
  const selTagsEl = selEl.querySelector('.selected-tags');
  const toCopyBuffer = [];

  selTagsEl.innerHTML = '';
  const selectedTags = document.querySelectorAll('#results .path.selected');
  if (selectedTags.length > 0) {
    selectedTags.forEach((path) => {
      const clone = path.cloneNode(true);
      clone.classList.remove('filtered', 'selected');
      const tag = clone.querySelector('.tag');
      clone.addEventListener('click', () => {
        toggleTag(path);
      });
      toCopyBuffer.push(tag.dataset.title);
      selTagsEl.append(clone);
    });

    selEl.classList.remove('hidden');
  } else {
    selEl.classList.add('hidden');
  }

  const copybuffer = document.getElementById('copybuffer');
  copybuffer.value = toCopyBuffer.join(', ');
}

async function init() {
  const tax = await getTaxonomy();

  initTaxonomy(tax);

  const selEl = document.getElementById('selected');
  const copyButton = selEl.querySelector('button.copy');
  copyButton.addEventListener('click', () => {
    const copyText = document.getElementById('copybuffer');
    navigator.clipboard.writeText(copyText.value);

    copyButton.disabled = true;
  });

  selEl.querySelector('button.clear').addEventListener('click', () => {
    const selectedTags = document.querySelectorAll('#results .path.selected');
    selectedTags.forEach((tag) => {
      toggleTag(tag);
    });
  });

  document.querySelector('#search').addEventListener('keyup', filter);

  document.addEventListener('click', (e) => {
    const target = e.target.closest('.category .path');
    if (target) {
      toggleTag(target);
    }
  });
}

init();
