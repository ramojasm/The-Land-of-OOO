const CHARDLE_URL = 'https://chardle.com/database/adventuretime';
const CHARDLE_PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(CHARDLE_URL)}`;
const API_URL = 'https://adventure-time-api-lg.vercel.app/apiV1/info';
const FANDOM_API_URL = 'https://adventuretime.fandom.com/api.php';
const FANDOM_CATEGORY = 'Category:Characters';
const FANDOM_BATCH_SIZE = 50;
const MAX_FANDOM_ENTRIES = 300;
const FEATURED_CHARACTER_NAMES = [
  'Finn', 'Jake', 'Princess Bubblegum', 'Marceline', 'BMO', 'Ice King',
  'Lady Rainicorn', 'Flame Princess', 'Lumpy Space Princess', 'Peppermint Butler',
  'Tree Trunks', 'The Lich', 'Prismo', 'Peppermint Butler', 'Gunter',
  'Susan Strong', 'Billy', 'Hunson Abadeer', 'Magic Man', 'Earl of Lemongrab'
];
const CHARACTER_CATEGORIES = [
  ['candy', 'Candy People'],
  ['human', 'Humans'],
  ['princess', 'Princesses'],
  ['wizard', 'Wizards'],
  ['vampire', 'Vampires'],
  ['animal', 'Animals'],
  ['creature', 'Creatures']
];
const VAMPIRE_CHARACTER_NAMES = new Set(['hunson abadeer', 'marceline', 'marceline abadeer']);
const WIZARD_CHARACTER_NAMES = new Set(['ice king']);

function hasPrincessInName(name) {
  return characterNameKey(name).includes('princess');
}

function isWizardEntry(entry) {
  const values = [
    entry.name,
    entry.type,
    entry.species,
    entry.raw?.type,
    entry.raw?.species,
    entry.category
  ].filter(Boolean).join(' ').toLowerCase();
  return WIZARD_CHARACTER_NAMES.has(characterNameKey(entry.name)) || values.includes('wizard');
}
const FALLBACK_ENTRIES = [
  { name: 'Finn', type: 'Human', image: '', description: 'A brave human hero with a strong sense of adventure and an even stronger sense of friendship.', location: 'Tree Fort' },
  { name: 'Jake', type: 'Dog', image: '', description: "Finn's magical best friend, known for stretching, shape-shifting, and relaxed wisdom.", location: 'Tree Fort' },
  { name: 'Marceline', type: 'Vampire', image: '', description: 'A thousand-year-old vampire queen and musician with a taste for bass lines and big feelings.', location: 'The Nightosphere' },
  { name: 'Princess Bubblegum', type: 'Princess', image: '', description: 'The scientist and ruler of the Candy Kingdom, always investigating the next strange mystery.', location: 'Candy Kingdom' },
  { name: 'BMO', type: 'Living Game System', image: '', description: 'A small living game console, filmmaker, detective, and treasured friend.', location: 'Tree Fort' },
  { name: 'Ice King', type: 'Wizard', image: '', description: 'A lonely ice wizard with a crown, a penguin companion, and more history than he remembers.', location: 'Ice Kingdom' }
];

const state = { entries: [], filter: 'all', query: '' };
const elements = {
  grid: document.querySelector('#card-grid'),
  search: document.querySelector('#search-input'),
  filters: document.querySelector('#filter-group'),
  count: document.querySelector('#result-count'),
  status: document.querySelector('#status-message'),
  retry: document.querySelector('#retry-button'),
  random: document.querySelector('#random-button'),
  dialog: document.querySelector('#detail-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  dialogClose: document.querySelector('#dialog-close'),
  updated: document.querySelector('#last-updated'),
  recordLabel: document.querySelector('#record-label')
};

function firstValue(record, keys, fallback = '') {
  for (const key of keys) {
    if (record && record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return fallback;
}

function characterNameKey(name) {
  return String(name).trim().toLowerCase();
}

function localCharacterImage(name) {
  const match = Array.isArray(LOCAL_CHARDLE_ENTRIES)
    ? LOCAL_CHARDLE_ENTRIES.find(entry => characterNameKey(entry.name) === characterNameKey(name))
    : null;
  return match?.image || '';
}

function withCharacterImage(entry) {
  const savedImage = localCharacterImage(entry.name);
  return { ...entry, image: savedImage || entry.image };
}

function normalizePayload(payload) {
  const possibleLists = [payload, payload?.data, payload?.characters, payload?.results, payload?.info];
  const list = possibleLists.find(Array.isArray) || (payload && typeof payload === 'object' ? [payload] : []);
  return list.filter(item => item && typeof item === 'object').map((item, index) => {
    const name = firstValue(item, ['name', 'character', 'title'], `Unknown resident ${index + 1}`);
    const type = firstValue(item, ['species', 'type', 'category', 'race'], 'Resident');
    const image = firstValue(item, ['image', 'img', 'imageUrl', 'photo', 'picture'], '');
    const description = firstValue(item, ['description', 'bio', 'about', 'quote'], 'No field notes have been recorded for this resident yet.');
    const location = firstValue(item, ['location', 'home', 'place', 'origin'], 'Unknown territory');
    return withCharacterImage({ raw: item, name: String(name), type: String(type), image: String(image), description: String(description), location: String(location) });
  });
}

function normalizeChardlePage(markup) {
  const documentFragment = new DOMParser().parseFromString(markup, 'text/html');
  const rows = [...documentFragment.querySelectorAll('tbody tr')];
  return rows.map(row => {
    const cells = [...row.querySelectorAll('td')];
    const values = cells.map(cell => cell.textContent.trim());
    const image = row.querySelector('img')?.getAttribute('src') || '';
    if (values.length < 9 || !values[1] || !image) return null;
    const [, name, gender, species, alignment, hair, skin, location, firstSeason] = values;
    return withCharacterImage({
      raw: { name, gender, species, alignment, hair, skin, location, firstSeason, image },
      name,
      type: species || 'Resident',
      image,
      description: `${gender} ${alignment} character with ${hair.toLowerCase()} hair and ${skin.toLowerCase()} skin. First seen in ${firstSeason}.`,
      location: location || 'Unknown territory'
    });
  }).filter(Boolean);
}

function organizeEntries(entries) {
  const featuredNames = new Set(FEATURED_CHARACTER_NAMES.map(name => name.toLowerCase()));
  return entries.map(entry => ({
    ...withCharacterImage(entry),
    group: featuredNames.has(entry.name.toLowerCase()) ? 'featured' : 'other',
    category: hasPrincessInName(entry.name)
      ? 'Princesses'
      : isWizardEntry(entry)
      ? 'Wizards'
      : VAMPIRE_CHARACTER_NAMES.has(characterNameKey(entry.name))
      ? 'Vampires'
      : entry.category || 'Other'
  })).sort((a, b) => {
    if (a.group !== b.group) return a.group === 'featured' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function classifyFandomPage(page) {
  const categoryText = (page.categories || []).map(category => category.title).join(' ').toLowerCase();
  const title = page.title.toLowerCase();
  const match = CHARACTER_CATEGORIES.find(([keyword]) => categoryText.includes(keyword) || title.includes(keyword));
  return match ? match[1] : 'Other';
}

async function fandomRequest(params) {
  const url = `${FANDOM_API_URL}?${new URLSearchParams({ ...params, format: 'json', origin: '*' })}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Fandom returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.info || 'Fandom returned an API error.');
  return payload;
}

async function loadFandomEntries() {
  const members = [];
  let continuation = {};
  do {
    const payload = await fandomRequest({
      action: 'query',
      list: 'categorymembers',
      cmtitle: FANDOM_CATEGORY,
      cmtype: 'page',
      cmlimit: '500',
      ...continuation
    });
    members.push(...(payload.query?.categorymembers || []));
    continuation = payload.continue || null;
  } while (continuation);

  if (!members.length) throw new Error('Fandom returned no character pages.');

  const entries = [];
  const featuredNames = new Set(FEATURED_CHARACTER_NAMES.map(name => name.toLowerCase()));
  const featuredMembers = members.filter(member => featuredNames.has(member.title.toLowerCase()));
  const otherMembers = members.filter(member => !featuredNames.has(member.title.toLowerCase()));
  const selectedMembers = [...featuredMembers, ...otherMembers].slice(0, MAX_FANDOM_ENTRIES);
  for (let index = 0; index < selectedMembers.length; index += FANDOM_BATCH_SIZE) {
    const batch = selectedMembers.slice(index, index + FANDOM_BATCH_SIZE);
    const payload = await fandomRequest({
      action: 'query',
      pageids: batch.map(member => member.pageid).join('|'),
      prop: 'pageimages|images|extracts|categories',
      cllimit: 'max',
      imlimit: '5',
      piprop: 'thumbnail',
      pithumbsize: '500',
      exintro: '1',
      explaintext: '1',
      exchars: '300'
    });
    const pages = Object.values(payload.query?.pages || {});
    const imageTitles = pages
      .filter(page => !page.thumbnail?.source)
      .flatMap(page => (page.images || []).map(image => image.title))
      .filter(Boolean);
    const imageUrls = imageTitles.length ? await fandomImageUrls(imageTitles) : new Map();
    entries.push(...pages.map(page => ({
      name: page.title,
      type: 'Character',
      image: page.thumbnail?.source
        || page.images?.map(image => imageUrls.get(image.title)).find(Boolean)
        || '',
      description: page.extract || 'No field notes have been recorded for this character yet.',
      location: 'Land of Ooo',
      category: classifyFandomPage(page),
      raw: page
    })));
  }
  return organizeEntries(entries.filter(entry => entry.image));
}

async function fandomImageUrls(titles) {
  const payload = await fandomRequest({
    action: 'query',
    titles: [...new Set(titles)].join('|'),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '500'
  });
  return new Map(Object.values(payload.query?.pages || {}).map(page => [
    page.title,
    page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || ''
  ]));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function isImageSource(value) {
  return /^(?:https?:\/\/|\/|\.{0,2}\/|images\/)/i.test(String(value).trim());
}

function imageMarkup(entry, className = 'card-image', loading = 'lazy') {
  const image = entry.image || localCharacterImage(entry.name);
  const fallback = localCharacterImage(entry.name);
  if (image && isImageSource(image)) {
    const fallbackMarkup = fallback && fallback !== image ? `this.onerror=null;this.src='${escapeHtml(fallback)}'` : `this.onerror=null;this.parentElement.innerHTML='✦'`;
    return `<div class="${className}"><img src="${escapeHtml(image)}" alt="${escapeHtml(entry.name)}" loading="${loading}" decoding="async" referrerpolicy="no-referrer" onerror="${fallbackMarkup}"></div>`;
  }
  return `<div class="${className}" aria-hidden="true">✦</div>`;
}

function filteredEntries() {
  return state.entries.filter(entry => {
    const matchesFilter = state.filter === 'all'
      || (state.filter === 'Princesses'
        ? hasPrincessInName(entry.name)
        : state.filter === 'Wizards'
        ? isWizardEntry(entry)
        : state.filter === 'Vampires'
        ? VAMPIRE_CHARACTER_NAMES.has(characterNameKey(entry.name))
        : entry.group === state.filter || entry.category === state.filter);
    const haystack = `${entry.name} ${entry.type} ${entry.location} ${entry.description}`.toLowerCase();
    return matchesFilter && haystack.includes(state.query.toLowerCase());
  });
}

function renderCards() {
  const entries = filteredEntries();
  elements.count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} on record`;
  if (!entries.length) {
    elements.grid.innerHTML = '<div class="empty-state">No matching field notes. Try another search or clear the filter.</div>';
    return;
  }
  elements.grid.innerHTML = entries.map((entry, index) => `
    <article class="character-card" style="animation-delay: ${Math.min(index * 35, 350)}ms">
      ${imageMarkup(entry, 'card-image', index < 24 ? 'eager' : 'lazy')}
      <p class="card-kicker">${escapeHtml(entry.category)} · ${entry.group === 'featured' ? 'Featured' : 'Other'}</p>
      <h3 class="card-name">${escapeHtml(entry.name)}</h3>
      <div class="card-footer"><span>${escapeHtml(entry.location)}</span><button class="view-button" type="button" data-index="${state.entries.indexOf(entry)}">View notes →</button></div>
    </article>`).join('');

  elements.grid.querySelectorAll('.view-button').forEach(button => button.addEventListener('click', () => openDetails(state.entries[Number(button.dataset.index)])));
}

function renderFilters() {
  const filters = [
    ['all', 'All characters'],
    ['featured', 'Featured characters'],
    ['other', 'Other characters'],
    ...CHARACTER_CATEGORIES.map(([value, label]) => [label, label])
  ];
  elements.filters.innerHTML = filters.map(([value, label]) => `<button class="filter-button${state.filter === value ? ' is-active' : ''}" type="button" data-filter="${value}">${label}</button>`).join('');
  elements.filters.querySelectorAll('.filter-button').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    renderFilters();
    renderCards();
  }));
}

function openDetails(entry) {
  const species = firstValue(entry, ['species', 'type'], 'Unknown species');
  const origin = firstValue(entry, ['origin', 'location'], 'Unknown origin');
  elements.dialogContent.innerHTML = `
    <div class="detail-hero">${imageMarkup(entry)}<div><p class="eyebrow">Field notes</p><h2 class="detail-title">${escapeHtml(entry.name)}</h2></div></div>
    <p class="detail-copy">${escapeHtml(entry.description)}</p>
    <div class="detail-meta"><div><span>Species</span><strong>${escapeHtml(species)}</strong></div><div><span>Origin</span><strong>${escapeHtml(origin)}</strong></div></div>`;
  elements.dialog.showModal();
}

function showError(message) {
  state.entries = organizeEntries(FALLBACK_ENTRIES.map(entry => ({ ...entry, raw: entry })));
  renderFilters();
  renderCards();
  elements.status.textContent = `${message} Showing offline field notes for now. Retry to reconnect to the live atlas.`;
  elements.status.classList.add('is-visible');
  elements.retry.classList.add('is-visible');
  elements.updated.textContent = 'Offline field notes';
  elements.recordLabel.textContent = `${state.entries.length} RECORDS`;
}

function showLocalChardleRecords(message) {
  state.entries = organizeEntries(LOCAL_CHARDLE_ENTRIES.filter(entry => entry.image).map(entry => ({
    ...entry,
    raw: entry,
    description: `${entry.gender} ${entry.alignment} character with ${entry.hair.toLowerCase()} hair and ${entry.skin.toLowerCase()} skin. First seen in ${entry.firstSeason}.`
  })));
  renderFilters();
  renderCards();
  elements.status.textContent = `${message} Showing the locally saved Chardle character list.`;
  elements.status.classList.add('is-visible');
  elements.retry.classList.add('is-visible');
  elements.updated.textContent = `${state.entries.length} local Chardle records`;
  elements.recordLabel.textContent = `${state.entries.length} RECORDS`;
}

async function loadAtlas() {
  elements.status.classList.remove('is-visible');
  elements.retry.classList.remove('is-visible');
  elements.count.textContent = 'Connecting to the atlas...';
  try {
    state.entries = await loadFandomEntries();
    renderFilters();
    renderCards();
    elements.updated.textContent = `${state.entries.length} Fandom character records synced`;
    elements.recordLabel.textContent = `${state.entries.length.toLocaleString()} RECORDS`;
  } catch (fandomError) {
    try {
      const chardleResponse = await fetch(CHARDLE_PROXY_URL, { headers: { Accept: 'text/html' } });
      if (!chardleResponse.ok) throw new Error(`Chardle returned HTTP ${chardleResponse.status}.`);
      state.entries = organizeEntries(normalizeChardlePage(await chardleResponse.text()));
      if (!state.entries.length) throw new Error('Chardle returned no recognizable entries.');
      renderFilters();
      renderCards();
      elements.updated.textContent = `${state.entries.length} Chardle records synced`;
      elements.recordLabel.textContent = `${state.entries.length} RECORDS`;
    } catch (chardleError) {
      try {
        const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`The API returned HTTP ${response.status}.`);
        const payload = await response.json();
        state.entries = organizeEntries(normalizePayload(payload));
        if (!state.entries.length) throw new Error('The API returned no recognizable entries.');
        renderFilters();
        renderCards();
        elements.updated.textContent = `Synced ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        elements.recordLabel.textContent = `${state.entries.length} RECORDS`;
      } catch (apiError) {
        if (Array.isArray(LOCAL_CHARDLE_ENTRIES) && LOCAL_CHARDLE_ENTRIES.length) {
          showLocalChardleRecords(`${fandomError.message} ${chardleError.message} ${apiError.message}`);
        } else {
          showError(`${fandomError.message} ${chardleError.message} ${apiError.message}`);
        }
      }
    }
  }
}

elements.search.addEventListener('input', event => { state.query = event.target.value.trim(); renderCards(); });
elements.retry.addEventListener('click', loadAtlas);
elements.random.addEventListener('click', () => {
  const entries = filteredEntries();
  if (entries.length) openDetails(entries[Math.floor(Math.random() * entries.length)]);
});
elements.dialogClose.addEventListener('click', () => elements.dialog.close());
elements.dialog.addEventListener('click', event => { if (event.target === elements.dialog) elements.dialog.close(); });
loadAtlas();
