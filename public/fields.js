/* Static catalogs used by the filter builder. Loaded before app.js. */
window.FS = window.FS || {};

// Broad Sound Taxonomy (category / subcategory names as used by the `category` and `subcategory` filters).
FS.TAXONOMY = [
  { code: 'm', name: 'Music', desc: 'Music excerpts, including melodies, singing, loops, fillers, drones, and short musical snippets.', sub: [
    { code: 'm-sp', name: 'Solo percussion', ex: 'rhythmic patterns, drum loop' },
    { code: 'm-si', name: 'Solo instrument', ex: 'isolated melody, solo singing' },
    { code: 'm-m', name: 'Multiple instruments', ex: 'orchestra, band, duet' },
    { code: 'm-other', name: 'Other', ex: '' },
  ] },
  { code: 'is', name: 'Instrument samples', desc: 'Single notes from musical instruments, various versions of the same note, and scales.', sub: [
    { code: 'is-p', name: 'Percussion', ex: 'drum, snare, gong, bell, xylophone' },
    { code: 'is-s', name: 'String', ex: 'guitar, violin, harp, mandolin' },
    { code: 'is-w', name: 'Wind', ex: 'woodwind, brass, flute, trumpet' },
    { code: 'is-k', name: 'Piano / Keyboard instruments', ex: 'piano, harpsichord, organ' },
    { code: 'is-e', name: 'Synths / Electronic', ex: 'synthesizers, electronic samples' },
    { code: 'is-other', name: 'Other', ex: '' },
  ] },
  { code: 'sp', name: 'Speech', desc: 'Sounds where human voice is prominent.', sub: [
    { code: 'sp-s', name: 'Solo speech', ex: 'talking, script reading' },
    { code: 'sp-c', name: 'Conversation / Crowd', ex: 'playground, people talking' },
    { code: 'sp-p', name: 'Processed / Synthetic', ex: 'phone/radio, robotic voice, TTS' },
    { code: 'sp-other', name: 'Other', ex: '' },
  ] },
  { code: 'fx', name: 'Sound effects', desc: 'Isolated sound effects or sound events, each happening one at a time.', sub: [
    { code: 'fx-o', name: 'Objects / House appliances', ex: 'tools, weapons, clothes' },
    { code: 'fx-v', name: 'Vehicles', ex: 'car passing by, bike, plane, ship' },
    { code: 'fx-m', name: 'Other mechanisms, engines, machines', ex: 'drill, lawn mower, chainsaw' },
    { code: 'fx-h', name: 'Human sounds and actions', ex: 'breath, heartbeat, walking, clapping' },
    { code: 'fx-a', name: 'Animals', ex: 'cat, insect, sheep, growl' },
    { code: 'fx-n', name: 'Natural elements and explosions', ex: 'wind gust, fire, water splash, explosion' },
    { code: 'fx-ex', name: 'Experimental', ex: 'reversed, weird effects' },
    { code: 'fx-el', name: 'Electronic / Design', ex: 'sci-fi, laser, whoosh, UI, notification' },
    { code: 'fx-other', name: 'Other', ex: '' },
  ] },
  { code: 'ss', name: 'Soundscapes', desc: 'Ambiances, field-recordings with multiple events and sound environments.', sub: [
    { code: 'ss-n', name: 'Nature', ex: 'forest, seaside, river, farmland' },
    { code: 'ss-i', name: 'Indoors', ex: 'room tone, office, factory, bar' },
    { code: 'ss-u', name: 'Urban', ex: 'city ambience, airport, busy road' },
    { code: 'ss-s', name: 'Synthetic / Artificial', ex: 'imaginary places, synthesized ambiences' },
    { code: 'ss-other', name: 'Other', ex: '' },
  ] },
];

FS.LICENSES = [
  { value: 'Creative Commons 0', short: 'CC0', desc: 'Public domain, no attribution required' },
  { value: 'Attribution', short: 'CC BY', desc: 'Attribution required, commercial use OK' },
  { value: 'Attribution NonCommercial', short: 'CC BY-NC', desc: 'Attribution required, non-commercial only' },
  { value: 'Sampling+', short: 'Sampling+', desc: 'Legacy license on old uploads' },
];

FS.TYPES = ['wav', 'aiff', 'aif', 'flac', 'ogg', 'mp3', 'm4a'];

FS.SORTS = [
  { value: 'score', label: 'Релевантность' },
  { value: 'created_desc', label: 'Сначала новые' },
  { value: 'created_asc', label: 'Сначала старые' },
  { value: 'downloads_desc', label: 'Больше скачиваний' },
  { value: 'downloads_asc', label: 'Меньше скачиваний' },
  { value: 'rating_desc', label: 'Выше рейтинг' },
  { value: 'rating_asc', label: 'Ниже рейтинг' },
  { value: 'duration_desc', label: 'Длиннее' },
  { value: 'duration_asc', label: 'Короче' },
];

FS.SIMILARITY_SPACES = [
  { value: '', label: 'По умолчанию' },
  { value: 'laion_clap', label: 'LAION-CLAP (семантика + звучание)' },
  { value: 'freesound_classic', label: 'Freesound classic (низкоуровневые признаки)' },
];

FS.NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Fields usable in `filter` (marked "yes" in the API docs). `kind` drives the widget.
FS.FIELDS = [
  // --- general metadata ---
  { name: 'id', kind: 'integer', group: 'Метаданные', label: 'ID звука' },
  { name: 'name', kind: 'text', group: 'Метаданные', label: 'Слово в названии' },
  { name: 'description', kind: 'text', group: 'Метаданные', label: 'Слово в описании' },
  { name: 'comment', kind: 'text', group: 'Метаданные', label: 'Слово в комментариях' },
  { name: 'created', kind: 'date', group: 'Метаданные', label: 'Дата загрузки' },
  { name: 'filesize', kind: 'integer', group: 'Метаданные', label: 'Размер файла (байт)' , range: [10000, 2000000000], log: true, unit: 'байт' },
  { name: 'bitrate', kind: 'numeric', group: 'Метаданные', label: 'Битрейт (kbps, ненадёжно)' , range: [8, 6000], log: true, unit: 'kbps' },
  { name: 'md5', kind: 'string', group: 'Метаданные', label: 'MD5 файла' },
  { name: 'num_comments', kind: 'integer', group: 'Метаданные', label: 'Число комментариев' , range: [0, 200], step: 1 },
  { name: 'is_remix', kind: 'boolean', group: 'Метаданные', label: 'Является ремиксом' },
  { name: 'was_remixed', kind: 'boolean', group: 'Метаданные', label: 'Имеет ремиксы' },
  { name: 'is_geotagged', kind: 'boolean', group: 'Метаданные', label: 'Есть геотег' },
  { name: 'gen_ai_preference', kind: 'string', group: 'Метаданные', label: 'Предпочтение по gen-AI', values: ['no-additional-preferences', 'open-source-models', 'noncommercial-open-source-models', 'no-gen-ai'] },

  // --- rhythm / tempo ---
  { name: 'bpm', kind: 'integer', group: 'Ритм', label: 'BPM' , range: [0, 300], step: 1 },
  { name: 'bpm_confidence', kind: 'numeric', group: 'Ритм', label: 'Уверенность BPM (0–1)' , range: [0, 1], step: 0.01 },
  { name: 'beat_count', kind: 'integer', group: 'Ритм', label: 'Число битов' , range: [0, 1000], step: 1 },
  { name: 'beat_loudness', kind: 'numeric', group: 'Ритм', label: 'Громкость битов' , range: [0, 1], step: 0.01 },
  { name: 'onset_count', kind: 'integer', group: 'Ритм', label: 'Число онсетов' , range: [0, 2000], step: 1 },
  { name: 'loopable', kind: 'boolean', group: 'Ритм', label: 'Зацикливается (loopable)' },
  { name: 'single_event', kind: 'boolean', group: 'Ритм', label: 'Одно событие' },

  // --- pitch / tonality ---
  { name: 'pitch', kind: 'numeric', group: 'Высота', label: 'Основная частота, Гц (средняя)' , range: [20, 8000], log: true, unit: 'Гц' },
  { name: 'pitch_min', kind: 'numeric', group: 'Высота', label: 'Мин. частота, Гц' , range: [20, 8000], log: true, unit: 'Гц' },
  { name: 'pitch_max', kind: 'numeric', group: 'Высота', label: 'Макс. частота, Гц' , range: [20, 8000], log: true, unit: 'Гц' },
  { name: 'pitch_var', kind: 'numeric', group: 'Высота', label: 'Дисперсия частоты' , range: [0, 100000], log: true },
  { name: 'pitch_confidence', kind: 'numeric', group: 'Высота', label: 'Уверенность высоты (0–1)' , range: [0, 1], step: 0.01 },
  { name: 'pitch_salience', kind: 'numeric', group: 'Высота', label: 'Тональность-выраженность (salience)' , range: [0, 1], step: 0.01 },
  { name: 'note_name', kind: 'string', group: 'Высота', label: 'Нота (например A4)' },
  { name: 'note_midi', kind: 'integer', group: 'Высота', label: 'MIDI-нота' , range: [0, 127], step: 1 },
  { name: 'note_confidence', kind: 'numeric', group: 'Высота', label: 'Уверенность ноты (0–1)' , range: [0, 1], step: 0.01 },
  { name: 'tonality', kind: 'string', group: 'Высота', label: 'Тональность (например C minor)' },
  { name: 'tonality_confidence', kind: 'numeric', group: 'Высота', label: 'Уверенность тональности' , range: [0, 1], step: 0.01 },
  { name: 'inharmonicity', kind: 'numeric', group: 'Высота', label: 'Негармоничность' , range: [0, 1], step: 0.01 },
  { name: 'dissonance', kind: 'numeric', group: 'Высота', label: 'Диссонанс' , range: [0, 1], step: 0.01 },
  { name: 'hpcp_crest', kind: 'numeric', group: 'Высота', label: 'HPCP crest' , range: [0, 40], step: 0.1 },
  { name: 'hpcp_entropy', kind: 'numeric', group: 'Высота', label: 'HPCP entropy' , range: [0, 6], step: 0.01 },

  // --- timbre (AudioCommons) ---
  { name: 'brightness', kind: 'numeric', group: 'Тембр', label: 'Яркость (brightness)' , range: [0, 100], step: 1 },
  { name: 'hardness', kind: 'numeric', group: 'Тембр', label: 'Жёсткость (hardness)' , range: [0, 100], step: 1 },
  { name: 'depth', kind: 'numeric', group: 'Тембр', label: 'Глубина (depth)' , range: [0, 100], step: 1 },
  { name: 'warmth', kind: 'numeric', group: 'Тембр', label: 'Теплота (warmth)' , range: [0, 100], step: 1 },
  { name: 'boominess', kind: 'numeric', group: 'Тембр', label: 'Гулкость (boominess)' , range: [0, 100], step: 1 },
  { name: 'sharpness', kind: 'numeric', group: 'Тембр', label: 'Резкость (sharpness)' , range: [0, 100], step: 1 },
  { name: 'roughness', kind: 'numeric', group: 'Тембр', label: 'Шероховатость (roughness)' , range: [0, 100], step: 1 },
  { name: 'reverbness', kind: 'boolean', group: 'Тембр', label: 'Есть реверберация' },

  // --- loudness / dynamics ---
  { name: 'loudness', kind: 'numeric', group: 'Громкость', label: 'Громкость, LUFS (EBU R128)' , range: [-70, 0], step: 1, unit: 'LUFS' },
  { name: 'dynamic_range', kind: 'numeric', group: 'Громкость', label: 'Динамический диапазон, LU' , range: [0, 40], step: 0.5, unit: 'LU' },
  { name: 'silence_rate', kind: 'numeric', group: 'Громкость', label: 'Доля тишины (0–1)' , range: [0, 1], step: 0.01 },
  { name: 'start_time', kind: 'numeric', group: 'Громкость', label: 'Начало звука, с' , range: [0, 60], step: 0.1, unit: 'с' },
  { name: 'duration_effective', kind: 'numeric', group: 'Громкость', label: 'Эффективная длительность, с' , range: [0.05, 3600], log: true, unit: 'с' },
  { name: 'log_attack_time', kind: 'numeric', group: 'Громкость', label: 'log10 времени атаки' , range: [-5, 2], step: 0.1 },
  { name: 'decay_strength', kind: 'numeric', group: 'Громкость', label: 'Сила затухания' , range: [0, 1], step: 0.01 },
  { name: 'amplitude_peak_ratio', kind: 'numeric', group: 'Громкость', label: 'Позиция пика (0 — в начале, 1 — в конце)' , range: [0, 1], step: 0.01 },
  { name: 'temporal_centroid', kind: 'numeric', group: 'Громкость', label: 'Временной центроид, с' , range: [0, 600], log: false, step: 0.1, unit: 'с' },
  { name: 'temporal_centroid_ratio', kind: 'numeric', group: 'Громкость', label: 'Временной центроид (доля)' , range: [0, 1], step: 0.01 },
  { name: 'temporal_decrease', kind: 'numeric', group: 'Громкость', label: 'Спад амплитуды' },
  { name: 'temporal_skewness', kind: 'numeric', group: 'Громкость', label: 'Асимметрия во времени' },
  { name: 'temporal_spread', kind: 'numeric', group: 'Громкость', label: 'Разброс во времени' },

  // --- spectrum ---
  { name: 'spectral_centroid', kind: 'numeric', group: 'Спектр', label: 'Спектральный центроид, Гц' , range: [50, 16000], log: true, unit: 'Гц' },
  { name: 'spectral_complexity', kind: 'numeric', group: 'Спектр', label: 'Спектральная сложность' , range: [0, 60], step: 0.5 },
  { name: 'spectral_crest', kind: 'numeric', group: 'Спектр', label: 'Spectral crest' , range: [0, 100], step: 0.5 },
  { name: 'spectral_energy', kind: 'numeric', group: 'Спектр', label: 'Спектральная энергия' },
  { name: 'spectral_entropy', kind: 'numeric', group: 'Спектр', label: 'Спектральная энтропия' , range: [0, 12], step: 0.1 },
  { name: 'spectral_flatness', kind: 'numeric', group: 'Спектр', label: 'Плоскость спектра (шумность)' , range: [0, 1], step: 0.01 },
  { name: 'spectral_rolloff', kind: 'numeric', group: 'Спектр', label: 'Roll-off, Гц' , range: [50, 16000], log: true, unit: 'Гц' },
  { name: 'spectral_skewness', kind: 'numeric', group: 'Спектр', label: 'Асимметрия спектра' },
  { name: 'spectral_spread', kind: 'numeric', group: 'Спектр', label: 'Разброс спектра' },
  { name: 'zero_crossing_rate', kind: 'numeric', group: 'Спектр', label: 'Zero-crossing rate' , range: [0, 1], step: 0.01 },
];

FS.FIELD_BY_NAME = Object.fromEntries(FS.FIELDS.map((f) => [f.name, f]));

// Fields requested for every search result.
FS.RESULT_FIELDS = [
  'id', 'name', 'username', 'tags', 'license', 'duration', 'type', 'samplerate', 'bitdepth', 'channels',
  'filesize', 'created', 'avg_rating', 'num_ratings', 'num_downloads', 'num_comments', 'previews', 'images',
  'pack', 'url', 'description', 'category', 'subcategory', 'score',
].join(',');

// Extra descriptor fields shown on cards when present (requested separately so a missing field cannot break the search).
FS.RESULT_DESCRIPTOR_FIELDS = ['bpm', 'note_name', 'tonality', 'loopable'];

FS.DURATION_PRESETS = [
  { label: '< 1 с', min: '', max: '1' },
  { label: '1–5 с', min: '1', max: '5' },
  { label: '5–30 с', min: '5', max: '30' },
  { label: '30 с – 2 мин', min: '30', max: '120' },
  { label: '> 2 мин', min: '120', max: '' },
];

FS.DATE_PRESETS = [
  { label: 'Неделя', days: 7 },
  { label: 'Месяц', days: 30 },
  { label: 'Год', days: 365 },
  { label: '5 лет', days: 365 * 5 },
];
