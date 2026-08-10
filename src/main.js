import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  AdaptivePerformance,
  QUALITY_PROFILES,
  detectDeviceQuality,
  isMobileDevice,
  loadGraphicsPreference,
  saveGraphicsPreference,
} from './performance.js';
import { BallisticPool, BeamPool, GlobPool, PaintPool, PoopPool } from './instanced-effects.js';
import { MassArmySystem } from './mass-army.js';
import { MultiplayerClient } from './multiplayer.js';
import './style.css';

const LANGUAGE_KEY = 'bibish-language-v1';
const COUNTRY_KEY = 'bibish-country-v1';
const AUDIO_SETTINGS_KEY = 'bibish-audio-volume-v1';
const PLAYER_NAME_MAX_LENGTH = 18;
let currentLanguage = localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'tr';
const I18N = {
  tr: {
    'loading.kicker': 'BIBISH SAHAYI HAZIRLIYOR', 'loading.start': 'Oyun çekirdeği başlatılıyor…', 'loading.cache': 'YEREL ÖNBELLEK · WEBGL2',
    'mobile.kicker': 'MASAÜSTÜ GEREKLİ', 'mobile.title': 'BU SAVAŞ CEBE SIĞMAZ', 'mobile.body': 'Bu oyun mobil cihazlarda çalışmaz. Lütfen bilgisayarda bir web tarayıcısından giriniz.',
    'session.kicker': 'TEK OTURUM SINIRI', 'session.title': 'BIBISH ZATEN AÇIK', 'session.body': 'Bu cihazda zaten aktif bir Bibish oturumu var. Önce diğer sekmeyi veya tarayıcıyı kapat.',
    'hud.front': 'CEPHE', 'hud.fortStatus': 'Karakol durumları', 'hud.collapse': 'K · DARALT', 'hud.expand': 'K · AÇ', 'hud.coordinates': 'HARİTA KOORDİNATLARI', 'hud.leaderboard': 'LİDER TABLOSU', 'hud.myStats': 'İSTATİSTİKLERİM', 'hud.combatFlow': 'SAVAŞ AKIŞI', 'hud.player': 'OYUNCU', 'hud.score': 'PUAN', 'hud.time': 'SÜRE', 'hud.kills': 'KILL', 'hud.deaths': 'ÖLÜM',
    'hud.mapControl': 'HARİTA KONTROL', 'hud.fieldMap': 'SAHA HARİTASI', 'hud.redPaint': '● Kırmızı boya', 'hud.bluePaint': '● Mavi boya', 'hud.position': '▲ Konumun', 'hud.health': 'CAN', 'hud.stamina': 'KOŞU', 'hud.shield': 'KALKAN · E',
    'spawn.title': 'DOĞUŞ ALANI SEÇ', 'spawn.initial': 'İmleci haritada gezdir; yalnızca dostların bulunduğu güvenli çemberlere doğabilirsin.', 'spawn.respawn': 'Dost bulunan ve düşman bulunmayan güvenli bir alan seç.', 'spawn.ready': 'İMLECİ HARİTADA GEZDİR · GEÇERLİ TAKIM ALANINA TIKLA', 'spawn.wait': 'DOĞUŞ HAZIRLANIYOR · {seconds} SN', 'spawn.invalid': 'BU ALAN DOĞUŞ İÇİN GÜVENLİ DEĞİL', 'spawn.selectedWait': 'ALAN SEÇİLDİ · {seconds} SN SONRA TEKRAR TIKLA', 'spawn.valid': 'GÜVENLİ TAKIM ALANI · {friends} DOST · DOĞMAK İÇİN TIKLA', 'spawn.noFriends': 'GEÇERSİZ · ÇEMBERİN İÇİNDE DOST BİRLİK YOK', 'spawn.enemies': 'GEÇERSİZ · ÇEMBERİN İÇİNDE {enemies} DÜŞMAN VAR', 'spawn.blocked': 'GEÇERSİZ · ARAZİ DOĞUŞA UYGUN DEĞİL',
    'mode.combat': 'SAVAŞ', 'mode.paint': 'BOYAMA', 'mode.combatHint': 'Sol tık ateş · Sağ tık dürbün', 'mode.paintHint': 'Sağ tık nişan · Sol tık boya',
    'controls.title': 'TÜM KONTROLLER', 'controls.move': 'WASD Hareket · SHIFT Koş', 'controls.stance': 'C Çömel · V Sürün · SPACE Zıpla / kalk', 'controls.mode': '1 / 2 Savaş / Boya', 'controls.scroll': 'SCROLL Silah / boya türü · Dürbün zoom', 'controls.quick': 'Q Hızlı seçim değiştir', 'controls.camera': 'Ç Kamera · YÖN TUŞLARI Kamerayı taşı', 'controls.shield': 'E Kalkanı kaldır / indir', 'controls.mouse': 'SAĞ TIK Nişan · SOL TIK Ateş / boya', 'controls.map': 'M Harita · K Lider tablosu', 'controls.escape': 'ESC Duraklat / tüm kontroller', 'controls.more': 'ESC · TÜM TUŞLAR',
    'menu.prototype': 'İLK OYNANABİLİR PROTOTİP', 'menu.lead': "Sabit Bibish Adası'ndaki tepeler, ormanlar ve on karakol için savaş. Düşmanı vur, kaleleri çoğunlukla ele geçir ve toprağı takımının rengine boya.",
    'menu.autoGraphics': 'GRAFİKLER OTOMATİK AYARLANDI', 'menu.autoGraphicsBody': 'profili cihazın için seçildi. Oyun yük altında çözünürlüğü kendisi dengeler.', 'menu.playerName': 'OYUNCU ADI', 'menu.namePlaceholder': 'Adını yaz', 'menu.country': 'ÜLKE BAYRAĞI', 'menu.countrySearch': 'Ülke ara…',
    'menu.chooseTeam': 'TAKIMINI SEÇ', 'menu.randomFort': 'kişi · rastgele karakol', 'menu.join': 'OYUNA GİR', 'menu.savedCareer': 'KAYITLI KARİYER', 'menu.resetScore': 'SKORUMU SIFIRLA',
    'guide.open': 'OYUN AMACI VE OYNANIŞ', 'guide.openHint': 'AMAÇ · MODLAR · TÜM TUŞLAR', 'guide.kicker': 'BIBISH SAHA REHBERİ', 'guide.title': 'AMAÇ VE OYNANIŞ',
    'guide.paintTitle': 'TOPRAĞI BOYA', 'guide.paintBody': '2 ile boya moduna geç. Bütün boyanabilir alan dolduğunda savaş biter.', 'guide.fortTitle': 'KALELERİ TUT', 'guide.fortBody': 'İçeride çoğunluk kurarak kaleyi ele geçir; takımına yeni doğuş noktası aç.', 'guide.combatTitle': 'CEPHEYİ TEMİZLE', 'guide.combatBody': 'Tüfek veya kılıçla rakibi durdur. İsabet, kill ve boyama puan kazandırır.',
    'guide.move': 'Hareket', 'guide.sprint': 'Koş', 'guide.jump': 'Zıpla / ayağa kalk', 'guide.crouch': 'Çömel', 'guide.prone': 'Sürün', 'guide.modes': 'Savaş / boya modu', 'guide.scroll': 'Silah, boya veya dürbün zoom', 'guide.quick': 'Hızlı ekipman değiştir', 'guide.shield': 'Kılıçtayken kalkan', 'guide.primary': 'Ateş / boya', 'guide.aim': 'Nişan / dürbün', 'guide.panels': 'Harita / lider tablosu', 'guide.camera': 'Serbest kamera', 'guide.pause': 'Duraklat / tüm tuşlar', 'guide.leftClick': 'SOL TIK', 'guide.rightClick': 'SAĞ TIK', 'guide.cameraKeys': 'Ç + YÖN',
    'team.red': 'KIRMIZI ORDU', 'team.blue': 'MAVİ ORDU', 'team.redShort': 'KIRMIZI', 'team.blueShort': 'MAVİ', 'team.redLetter': 'K', 'team.blueLetter': 'M',
    'common.settings': 'AYARLAR', 'common.apply': 'UYGULA', 'common.back': 'GERİ DÖN', 'common.cancel': 'VAZGEÇ',
    'pause.kicker': 'SAVAŞ BEKLİYOR', 'pause.title': 'DURAKLATILDI', 'pause.body': 'Fareyi tekrar oyuna kilitlemek için devam et.', 'pause.resume': 'DEVAM ET', 'pause.changeTeam': 'TAKIM DEĞİŞTİR',
    'settings.kicker': 'GÖRÜNTÜ, SES VE PERFORMANS', 'settings.title': 'OYUN AYARLARI', 'settings.detecting': 'Cihaz ölçülüyor…', 'settings.quality': 'Kalite profili', 'settings.qualityHelp': 'Otomatik mod cihazı ve gerçek FPS değerini izler.',
    'settings.dynamic': 'Dinamik çözünürlük', 'settings.dynamicHelp': "Yoğun sahnelerde FPS'i korumak için çözünürlüğü anlık dengeler.", 'settings.performance': 'Performans göstergesi', 'settings.performanceHelp': 'FPS, çizim çağrısı ve aktif kaliteyi gösterir.',
    'settings.volume': 'Ana ses seviyesi', 'settings.volumeHelp': 'Yön, mesafe ve yakınlık bilgisi kulaklık ve stereo hoparlörler için korunur.',
    'settings.priority': 'AAA hissi için öncelik sırası', 'settings.priorityHelp': 'Önce kontrol tepkisi ve kare hızı korunur; cihaz zorlanırsa efekt yoğunluğu, gölge ve iç çözünürlük otomatik azaltılır.',
    'quality.auto': 'Otomatik — Önerilen', 'quality.low': 'Düşük', 'quality.medium': 'Orta', 'quality.high': 'Yüksek', 'quality.ultra': 'Ultra',
    'end.kicker': 'BIBISH SAVAŞI TAMAMLANDI', 'end.restart': 'YENİDEN BAŞLA', 'reset.title': 'SKORLAR SIFIRLANSIN MI?', 'reset.body': 'Süre, puan, kill ve ölüm sayın kalıcı olarak sıfırlanacak.', 'reset.confirm': 'EVET, SIFIRLA',
    'footer.powered': 'MeMoDe tarafından', 'map.fixed': 'SABİT HARİTA · BIBISH ADASI', 'map.fixedLong': 'BIBISH ADASI · SABİT HARİTA',
    'waste.pee': 'ÇİŞ', 'waste.vomit': 'KUSMUK', 'waste.poop': 'KAKA', 'weapon.rifle': 'TÜFEK', 'weapon.sword': 'KILIÇ', 'weapon.ready': 'HAZIR', 'shield.lowered': 'HAZIR', 'shield.raised': 'AKTİF', 'scope.wheel': 'TEKER · ZOOM',
    'direction.n': 'KUZEY', 'direction.ne': 'KUZEYDOĞU', 'direction.e': 'DOĞU', 'direction.se': 'GÜNEYDOĞU', 'direction.s': 'GÜNEY', 'direction.sw': 'GÜNEYBATI', 'direction.w': 'BATI', 'direction.nw': 'KUZEYBATI',
  },
  en: {
    'loading.kicker': 'BIBISH IS PREPARING THE FIELD', 'loading.start': 'Starting the game core…', 'loading.cache': 'LOCAL CACHE · WEBGL2',
    'mobile.kicker': 'DESKTOP REQUIRED', 'mobile.title': 'THIS WAR WILL NOT FIT IN YOUR POCKET', 'mobile.body': 'This game is not available on mobile devices. Please open it in a desktop web browser.',
    'session.kicker': 'ONE SESSION LIMIT', 'session.title': 'BIBISH IS ALREADY OPEN', 'session.body': 'There is already an active Bibish session on this device. Close the other tab or browser first.',
    'hud.front': 'FRONT', 'hud.fortStatus': 'Fort status', 'hud.collapse': 'K · COLLAPSE', 'hud.expand': 'K · EXPAND', 'hud.coordinates': 'MAP COORDINATES', 'hud.leaderboard': 'LEADERBOARD', 'hud.myStats': 'MY STATS', 'hud.combatFlow': 'COMBAT FLOW', 'hud.player': 'PLAYER', 'hud.score': 'SCORE', 'hud.time': 'TIME', 'hud.kills': 'KILLS', 'hud.deaths': 'DEATHS',
    'hud.mapControl': 'MAP CONTROL', 'hud.fieldMap': 'FIELD MAP', 'hud.redPaint': '● Red paint', 'hud.bluePaint': '● Blue paint', 'hud.position': '▲ Your position', 'hud.health': 'HEALTH', 'hud.stamina': 'STAMINA', 'hud.shield': 'SHIELD · E',
    'spawn.title': 'SELECT A SPAWN AREA', 'spawn.initial': 'Move over the live map; you may spawn only inside safe circles occupied by allies.', 'spawn.respawn': 'Choose a safe area containing allies and no enemies.', 'spawn.ready': 'MOVE OVER THE MAP · CLICK A VALID TEAM AREA', 'spawn.wait': 'PREPARING RESPAWN · {seconds} S', 'spawn.invalid': 'THIS AREA IS NOT SAFE FOR SPAWNING', 'spawn.selectedWait': 'AREA SELECTED · CLICK AGAIN IN {seconds} S', 'spawn.valid': 'SAFE TEAM AREA · {friends} ALLIES · CLICK TO SPAWN', 'spawn.noFriends': 'INVALID · NO ALLIED UNITS INSIDE THE CIRCLE', 'spawn.enemies': 'INVALID · {enemies} ENEMIES INSIDE THE CIRCLE', 'spawn.blocked': 'INVALID · TERRAIN IS NOT SUITABLE FOR SPAWNING',
    'mode.combat': 'COMBAT', 'mode.paint': 'PAINT', 'mode.combatHint': 'Left click fire · Right click scope', 'mode.paintHint': 'Right click aim · Left click paint',
    'controls.title': 'ALL CONTROLS', 'controls.move': 'WASD Move · SHIFT Sprint', 'controls.stance': 'C Crouch · V Prone · SPACE Jump / stand', 'controls.mode': '1 / 2 Combat / Paint', 'controls.scroll': 'SCROLL Weapon / paint type · Scope zoom', 'controls.quick': 'Q Quick selection switch', 'controls.camera': 'Ç Camera · ARROW KEYS Move camera', 'controls.shield': 'E Raise / lower shield', 'controls.mouse': 'RIGHT CLICK Aim · LEFT CLICK Fire / paint', 'controls.map': 'M Map · K Leaderboard', 'controls.escape': 'ESC Pause / all controls', 'controls.more': 'ESC · ALL KEYS',
    'menu.prototype': 'FIRST PLAYABLE PROTOTYPE', 'menu.lead': 'Fight across the hills, forests and ten forts of the fixed Bibish Island. Shoot enemies, capture forts by majority and paint the land in your team color.',
    'menu.autoGraphics': 'GRAPHICS OPTIMIZED AUTOMATICALLY', 'menu.autoGraphicsBody': 'profile was selected for your device. The game balances resolution under load.', 'menu.playerName': 'PLAYER NAME', 'menu.namePlaceholder': 'Enter your name', 'menu.country': 'COUNTRY FLAG', 'menu.countrySearch': 'Search country…',
    'menu.chooseTeam': 'CHOOSE YOUR TEAM', 'menu.randomFort': 'players · random fort', 'menu.join': 'ENTER GAME', 'menu.savedCareer': 'SAVED CAREER', 'menu.resetScore': 'RESET MY SCORE',
    'guide.open': 'OBJECTIVE AND GAMEPLAY', 'guide.openHint': 'GOAL · MODES · ALL CONTROLS', 'guide.kicker': 'BIBISH FIELD GUIDE', 'guide.title': 'OBJECTIVE AND GAMEPLAY',
    'guide.paintTitle': 'PAINT THE LAND', 'guide.paintBody': 'Press 2 for paint mode. The battle ends when every paintable area is covered.', 'guide.fortTitle': 'HOLD THE FORTS', 'guide.fortBody': 'Outnumber enemies inside a fort to capture it and unlock a team spawn.', 'guide.combatTitle': 'CLEAR THE FRONT', 'guide.combatBody': 'Stop rivals with the rifle or sword. Hits, kills and painting award score.',
    'guide.move': 'Move', 'guide.sprint': 'Sprint', 'guide.jump': 'Jump / stand up', 'guide.crouch': 'Crouch', 'guide.prone': 'Prone', 'guide.modes': 'Combat / paint mode', 'guide.scroll': 'Weapon, paint or scope zoom', 'guide.quick': 'Quick equipment switch', 'guide.shield': 'Shield while using sword', 'guide.primary': 'Fire / paint', 'guide.aim': 'Aim / scope', 'guide.panels': 'Map / leaderboard', 'guide.camera': 'Free camera', 'guide.pause': 'Pause / all controls', 'guide.leftClick': 'LEFT CLICK', 'guide.rightClick': 'RIGHT CLICK', 'guide.cameraKeys': 'Ç + ARROWS',
    'team.red': 'RED ARMY', 'team.blue': 'BLUE ARMY', 'team.redShort': 'RED', 'team.blueShort': 'BLUE', 'team.redLetter': 'R', 'team.blueLetter': 'B',
    'common.settings': 'SETTINGS', 'common.apply': 'APPLY', 'common.back': 'GO BACK', 'common.cancel': 'CANCEL',
    'pause.kicker': 'THE WAR IS WAITING', 'pause.title': 'PAUSED', 'pause.body': 'Continue to lock the pointer back into the game.', 'pause.resume': 'CONTINUE', 'pause.changeTeam': 'CHANGE TEAM',
    'settings.kicker': 'DISPLAY, AUDIO AND PERFORMANCE', 'settings.title': 'GAME SETTINGS', 'settings.detecting': 'Measuring device…', 'settings.quality': 'Quality profile', 'settings.qualityHelp': 'Automatic mode monitors the device and real FPS.',
    'settings.dynamic': 'Dynamic resolution', 'settings.dynamicHelp': 'Balances resolution in real time to protect FPS in dense scenes.', 'settings.performance': 'Performance monitor', 'settings.performanceHelp': 'Shows FPS, draw calls and active quality.',
    'settings.volume': 'Master volume', 'settings.volumeHelp': 'Direction, distance and proximity cues are preserved for headphones and stereo speakers.',
    'settings.priority': 'Priority order for an AAA feel', 'settings.priorityHelp': 'Control response and frame rate are protected first; effect density, shadows and internal resolution scale down if needed.',
    'quality.auto': 'Automatic — Recommended', 'quality.low': 'Low', 'quality.medium': 'Medium', 'quality.high': 'High', 'quality.ultra': 'Ultra',
    'end.kicker': 'BIBISH BATTLE COMPLETE', 'end.restart': 'RESTART', 'reset.title': 'RESET SCORES?', 'reset.body': 'Your time, score, kills and deaths will be permanently reset.', 'reset.confirm': 'YES, RESET',
    'footer.powered': 'Powered by MeMoDe', 'map.fixed': 'FIXED MAP · BIBISH ISLAND', 'map.fixedLong': 'BIBISH ISLAND · FIXED MAP',
    'waste.pee': 'PEE', 'waste.vomit': 'VOMIT', 'waste.poop': 'POOP', 'weapon.rifle': 'RIFLE', 'weapon.sword': 'SWORD', 'weapon.ready': 'READY', 'shield.lowered': 'READY', 'shield.raised': 'ACTIVE', 'scope.wheel': 'WHEEL · ZOOM',
    'direction.n': 'NORTH', 'direction.ne': 'NORTHEAST', 'direction.e': 'EAST', 'direction.se': 'SOUTHEAST', 'direction.s': 'SOUTH', 'direction.sw': 'SOUTHWEST', 'direction.w': 'WEST', 'direction.nw': 'NORTHWEST',
  },
};

function t(key) {
  return I18N[currentLanguage][key] ?? I18N.tr[key] ?? key;
}
const localized = (turkish, english) => currentLanguage === 'tr' ? turkish : english;

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = currentLanguage === 'tr' ? 'Bibish — Açık Alan Savaşı' : 'Bibish — Open Field Battle';
  document.querySelector('meta[name="description"]')?.setAttribute('content', currentLanguage === 'tr'
    ? 'Bibish — takım tabanlı absürt açık alan savaşı.'
    : 'Bibish — an absurd team-based open-field battle.');
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-language]').forEach((button) => button.classList.toggle('active', button.dataset.language === currentLanguage));
  const fortStrip = document.querySelector('#fort-strip');
  if (fortStrip) {
    fortStrip.setAttribute('aria-label', t('hud.fortStatus'));
    [...fortStrip.querySelectorAll('.fort')].forEach((element, index) => {
      const isRedOrigin = index < 5;
      element.textContent = `${t(isRedOrigin ? 'team.redLetter' : 'team.blueLetter')}${index % 5 + 1}`;
    });
  }
  const battleScore = document.querySelector('#battle-score');
  const scoreTitle = battleScore?.querySelector('.score-title');
  if (scoreTitle) {
    const collapsed = battleScore.classList.contains('collapsed');
    scoreTitle.textContent = t(collapsed ? 'hud.myStats' : 'hud.leaderboard');
    scoreTitle.dataset.toggleLabel = t(collapsed ? 'hud.expand' : 'hud.collapse');
  }
  const poweredBy = document.querySelector('#powered-by');
  if (poweredBy) poweredBy.textContent = t('footer.powered');
}

applyStaticTranslations();

const duplicateSessionBlock = document.querySelector('#duplicate-session-block');
function blockDuplicateSession() {
  document.exitPointerLock?.();
  duplicateSessionBlock?.classList.remove('hidden');
}

const duplicateTestQuery = new URLSearchParams(window.location.search);
const bypassLocalTabLock = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  && (duplicateTestQuery.has('localLobbyTest') || duplicateTestQuery.has('loadtest') || duplicateTestQuery.has('stressFullRoster'));
if (!bypassLocalTabLock && navigator.locks?.request) {
  navigator.locks.request('bibish-single-active-session-v1', { mode: 'exclusive', ifAvailable: true }, (lock) => {
    if (!lock) {
      blockDuplicateSession();
      return undefined;
    }
    return new Promise((release) => window.addEventListener('pagehide', release, { once: true }));
  }).catch(() => {});
}

const ISO_COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ');

function countryFlag(code) {
  return String(code || 'TR').toUpperCase().replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt(0)));
}

function flagMarkup(code) {
  const safeCode = ISO_COUNTRY_CODES.includes(String(code).toUpperCase()) ? String(code).toLowerCase() : 'tr';
  return `<img class="country-flag" src="/flags/${safeCode}.svg" alt="" aria-hidden="true" draggable="false" />`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function enforcePlayerNameLimit() {
  // This helper lives outside the desktop-only game block, so resolve the
  // controls locally instead of closing over block-scoped DOM constants.
  const input = document.querySelector('#player-name');
  const counter = document.querySelector('#player-name-counter');
  const characters = Array.from(input?.value || '');
  if (input && characters.length > PLAYER_NAME_MAX_LENGTH) input.value = characters.slice(0, PLAYER_NAME_MAX_LENGTH).join('');
  if (counter) counter.textContent = `${Math.min(characters.length, PLAYER_NAME_MAX_LENGTH)} / ${PLAYER_NAME_MAX_LENGTH}`;
  return input?.value || '';
}

const MOBILE_BLOCKED = isMobileDevice();
const loadingScreen = document.querySelector('#loading-screen');
const loadingOperation = document.querySelector('#loading-operation');
const loadingFill = document.querySelector('#loading-fill');
const loadingPercent = document.querySelector('#loading-percent');

function setLoadingProgress(percent, operation) {
  const safePercent = THREE.MathUtils.clamp(Math.round(percent), 0, 100);
  loadingPercent.textContent = `${safePercent}%`;
  loadingFill.style.width = `${safePercent}%`;
  if (operation) loadingOperation.textContent = operation;
}

if (MOBILE_BLOCKED) {
  document.querySelector('#mobile-block').classList.remove('hidden');
  document.querySelector('#team-screen').classList.add('hidden');
  loadingScreen.classList.add('hidden');
} else {

const WORLD = {
  halfWidth: 720,
  halfDepth: 720,
};

// Sabit seed: Bibish Adası her yüklemede aynı araziyi ve aynı siperleri üretir.
const MAP_SEED = 0xB1B15A11;
// NPC savaşçıları görüş ve menzil içindeki karşı takım oyuncusunu hedefleyip yaralayabilir.
const NPC_PLAYER_COMBAT_ENABLED = false;

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const mapRandom = mulberry32(MAP_SEED);
const randomRange = (minimum, maximum) => minimum + mapRandom() * (maximum - minimum);

const PLAYER = {
  eyeHeight: 1.68,
  bodyHeight: 1.82,
  radius: 0.42,
  walkSpeed: 8.5,
  sprintSpeed: 14.5,
  crouchSpeed: 4.8,
  proneSpeed: 2.7,
  jumpSpeed: 8.2,
};
const SPAWN_SAFE_RADIUS = 48;

const STANCE = {
  stand: { eye: 1.68, body: 1.82, radius: 0.36 },
  crouch: { eye: 1.08, body: 1.25, radius: 0.3 },
  prone: { eye: 0.48, body: 0.72, radius: 0.24 },
};
const FORT_SUMMIT_HEIGHT = 31;
const PAINT_RADIUS_MULTIPLIER = 10;

const TEAM = {
  red: {
    name: 'KIRMIZI ORDU',
    color: 0xff315e,
    dark: 0x8e1633,
    soft: 0xff8aa3,
    spawn: new THREE.Vector3(0, 0, -320),
  },
  blue: {
    name: 'MAVİ ORDU',
    color: 0x28b8ff,
    dark: 0x0d638d,
    soft: 0x8fdcff,
    spawn: new THREE.Vector3(0, 0, 320),
  },
};

const fortLayout = [
  { team: 'red', index: 1, x: -510, z: -450 },
  { team: 'red', index: 2, x: -255, z: -490 },
  { team: 'red', index: 3, x: 0, z: -510 },
  { team: 'red', index: 4, x: 255, z: -490 },
  { team: 'red', index: 5, x: 510, z: -450 },
  { team: 'blue', index: 1, x: -510, z: 450 },
  { team: 'blue', index: 2, x: -255, z: 490 },
  { team: 'blue', index: 3, x: 0, z: 510 },
  { team: 'blue', index: 4, x: 255, z: 490 },
  { team: 'blue', index: 5, x: 510, z: 450 },
];

const terrainHills = Array.from({ length: 62 }, (_, index) => ({
  x: randomRange(-650, 650),
  z: randomRange(-650, 650),
  radius: randomRange(index % 5 === 0 ? 70 : 45, index % 5 === 0 ? 145 : 125),
  height: index % 5 === 0 ? randomRange(-24, -9) : randomRange(6, 26),
}));
const terrainHollows = Array.from({ length: 28 }, () => ({
  x: randomRange(-640, 640),
  z: randomRange(-640, 640),
  radius: randomRange(24, 72),
  depth: randomRange(4, 13),
}));

// Sabit, üst üste binen biyom alanları: örtüşmeler yumuşak geçiş ve karma bölgeler üretir.
const biomeLayout = [
  { type: 'forest', x: -500, z: -165, radius: 188, weight: 1.08 },
  { type: 'forest', x: -215, z: 155, radius: 176, weight: 1.14 },
  { type: 'forest', x: 215, z: -170, radius: 192, weight: 1.1 },
  { type: 'forest', x: 500, z: 175, radius: 178, weight: 1.08 },
  { type: 'forest', x: -72, z: 112, radius: 164, weight: 1.2, variant: 'jungleCanopy' },
  { type: 'rock', x: -555, z: 285, radius: 154, weight: 1.05 },
  { type: 'rock', x: -95, z: -345, radius: 164, weight: 1.08 },
  { type: 'rock', x: 340, z: 325, radius: 158, weight: 1.06 },
  { type: 'rock', x: 555, z: -285, radius: 152, weight: 1.04 },
  { type: 'rock', x: 185, z: 210, radius: 112, weight: 0.72, variant: 'jungleBoulders' },
  { type: 'grassland', x: -350, z: 405, radius: 258, weight: 1.16, variant: 'openMeadow' },
  { type: 'grassland', x: 25, z: 70, radius: 332, weight: 1.52, variant: 'elephantGrass' },
  { type: 'grassland', x: 380, z: -410, radius: 252, weight: 1.16, variant: 'openMeadow' },
  { type: 'grassland', x: -500, z: 25, radius: 178, weight: 1.02, variant: 'reedField' },
  { type: 'grassland', x: 485, z: -15, radius: 174, weight: 1.02, variant: 'reedField' },
  { type: 'mixed', x: -340, z: -35, radius: 188, weight: 1.12 },
  { type: 'mixed', x: 55, z: -225, radius: 180, weight: 1.08 },
  { type: 'mixed', x: 270, z: 115, radius: 190, weight: 1.12 },
  { type: 'mixed', x: -80, z: 350, radius: 194, weight: 1.08 },
  { type: 'mixed', x: 132, z: 82, radius: 174, weight: 1.24, variant: 'jungleEdge' },
];

const BIOME_INDEX = { forest: 0, rock: 1, grassland: 2, mixed: 3 };
const BIOME_COLORS = [
  [48, 78, 42],
  [102, 101, 91],
  [75, 128, 58],
  [77, 99, 51],
];
const biomeWeightScratch = new Float32Array(4);
const biomeColorScratch = new Float32Array(3);

function sampleBiomeWeights(x, z, output = biomeWeightScratch) {
  output.fill(0);
  for (const biome of biomeLayout) {
    const transitionRadius = biome.radius * 1.32;
    const normalizedSquared = ((x - biome.x) ** 2 + (z - biome.z) ** 2) / (transitionRadius * transitionRadius);
    if (normalizedSquared >= 1) continue;
    const falloff = 1 - normalizedSquared;
    output[BIOME_INDEX[biome.type]] += falloff * falloff * (biome.weight ?? 1);
  }
  return output;
}

function blendBiomeGroundColor(x, z, baseRed, baseGreen, baseBlue, output = biomeColorScratch) {
  const weights = sampleBiomeWeights(x, z);
  const total = weights[0] + weights[1] + weights[2] + weights[3];
  if (total < 0.001) {
    output[0] = baseRed;
    output[1] = baseGreen;
    output[2] = baseBlue;
    return output;
  }
  let targetRed = 0;
  let targetGreen = 0;
  let targetBlue = 0;
  for (let index = 0; index < weights.length; index += 1) {
    targetRed += BIOME_COLORS[index][0] * weights[index];
    targetGreen += BIOME_COLORS[index][1] * weights[index];
    targetBlue += BIOME_COLORS[index][2] * weights[index];
  }
  const influence = THREE.MathUtils.clamp(total * 0.38, 0, 0.72);
  output[0] = baseRed + (targetRed / total - baseRed) * influence;
  output[1] = baseGreen + (targetGreen / total - baseGreen) * influence;
  output[2] = baseBlue + (targetBlue / total - baseBlue) * influence;
  return output;
}

function sampleSceneryPosition(types = null, clusteredChance = 0.78) {
  const candidates = types ? biomeLayout.filter((biome) => types.includes(biome.type)) : biomeLayout;
  if (candidates.length && mapRandom() < clusteredChance) {
    const biome = candidates[Math.floor(mapRandom() * candidates.length)];
    const angle = randomRange(0, Math.PI * 2);
    const distance = Math.sqrt(mapRandom()) * biome.radius;
    return { x: biome.x + Math.cos(angle) * distance, z: biome.z + Math.sin(angle) * distance, biome };
  }
  return {
    x: randomRange(-WORLD.halfWidth + 40, WORLD.halfWidth - 40),
    z: randomRange(-WORLD.halfDepth + 40, WORLD.halfDepth - 40),
    biome: null,
  };
}

function grassOnlyBiomeAt(x, z, coreScale = 0.92) {
  return biomeLayout.find((biome) => (
    biome.type === 'grassland'
    && Math.hypot(x - biome.x, z - biome.z) <= biome.radius * coreScale
  )) || null;
}

function rawTerrainHeight(x, z) {
  let height = Math.sin(x * 0.018 + MAP_SEED * 0.00001) * 2.7;
  height += Math.cos(z * 0.015 - MAP_SEED * 0.000013) * 2.1;
  height += Math.sin((x + z) * 0.008) * 2.4;
  for (const hill of terrainHills) {
    const distanceSquared = (x - hill.x) ** 2 + (z - hill.z) ** 2;
    height += hill.height * Math.exp(-distanceSquared / (2 * hill.radius ** 2));
  }
  for (const hollow of terrainHollows) {
    const distanceSquared = (x - hollow.x) ** 2 + (z - hollow.z) ** 2;
    height -= hollow.depth * Math.exp(-distanceSquared / (2 * hollow.radius ** 2));
  }
  // Açık arazideki hiçbir doğal tepe kale zirvelerini geçmez.
  height = Math.min(height, 24);
  // Her karakol aynı en yüksek rakıma oturan, geniş ve doğal bir tepe üzerindedir.
  for (const fort of fortLayout) {
    const distanceSquared = (x - fort.x) ** 2 + (z - fort.z) ** 2;
    const distance = Math.sqrt(distanceSquared);
    if (distance < 190) {
      const normalized = distance / 190;
      const eased = normalized * normalized * (3 - 2 * normalized);
      const summit = FORT_SUMMIT_HEIGHT - eased * 22;
      height = Math.max(height, summit);
    }
  }
  const edge = Math.max(Math.abs(x) / WORLD.halfWidth, Math.abs(z) / WORLD.halfDepth);
  if (edge < 0.82) height = Math.max(height, -7);
  if (edge > 0.82) height -= ((edge - 0.82) / 0.18) ** 2 * 62;
  return height;
}

function proceduralTerrainHeightAt(x, z) {
  let height = rawTerrainHeight(x, z);
  for (const fort of fortLayout) {
    const distance = Math.hypot(x - fort.x, z - fort.z);
    if (distance < 74) {
      const centerHeight = rawTerrainHeight(fort.x, fort.z);
      const blend = 1 - THREE.MathUtils.smoothstep(distance, 52, 74);
      height = THREE.MathUtils.lerp(height, centerHeight, blend);
    }
  }
  return height;
}

// Aynı sabit araziyi bir kez örnekleyip bütün NPC/fizik sorgularında O(1) bilinear okuruz.
// Böylece 2.000 ajan her karede onlarca pahalı Gaussian hesabı yapmaz.
// Fizik ve görünen arazi aynı üçgen ızgarasını kullanır. Ayrı çözünürlükler dik eğimde
// kameranın görsel zeminin altına düşmesine neden oluyordu.
const TERRAIN_SEGMENTS = 128;
const TERRAIN_HEIGHT_GRID_SIZE = TERRAIN_SEGMENTS + 1;
const terrainHeightGrid = new Float32Array(TERRAIN_HEIGHT_GRID_SIZE * TERRAIN_HEIGHT_GRID_SIZE);
for (let gridZ = 0; gridZ < TERRAIN_HEIGHT_GRID_SIZE; gridZ += 1) {
  const z = -WORLD.halfDepth + gridZ / (TERRAIN_HEIGHT_GRID_SIZE - 1) * WORLD.halfDepth * 2;
  for (let gridX = 0; gridX < TERRAIN_HEIGHT_GRID_SIZE; gridX += 1) {
    const x = -WORLD.halfWidth + gridX / (TERRAIN_HEIGHT_GRID_SIZE - 1) * WORLD.halfWidth * 2;
    terrainHeightGrid[gridZ * TERRAIN_HEIGHT_GRID_SIZE + gridX] = proceduralTerrainHeightAt(x, z);
  }
}

function terrainHeightAt(x, z) {
  const normalizedX = THREE.MathUtils.clamp((x + WORLD.halfWidth) / (WORLD.halfWidth * 2), 0, 1) * (TERRAIN_HEIGHT_GRID_SIZE - 1);
  const normalizedZ = THREE.MathUtils.clamp((z + WORLD.halfDepth) / (WORLD.halfDepth * 2), 0, 1) * (TERRAIN_HEIGHT_GRID_SIZE - 1);
  const x0 = Math.floor(normalizedX);
  const z0 = Math.floor(normalizedZ);
  const x1 = Math.min(TERRAIN_HEIGHT_GRID_SIZE - 1, x0 + 1);
  const z1 = Math.min(TERRAIN_HEIGHT_GRID_SIZE - 1, z0 + 1);
  const tx = normalizedX - x0;
  const tz = normalizedZ - z0;
  const a = terrainHeightGrid[z0 * TERRAIN_HEIGHT_GRID_SIZE + x0];
  const b = terrainHeightGrid[z0 * TERRAIN_HEIGHT_GRID_SIZE + x1];
  const c = terrainHeightGrid[z1 * TERRAIN_HEIGHT_GRID_SIZE + x0];
  const d = terrainHeightGrid[z1 * TERRAIN_HEIGHT_GRID_SIZE + x1];
  // createGround ile aynı a-c-b / b-c-d üçgen bölünümü.
  if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
  return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}

for (const team of ['red', 'blue']) {
  const centerFort = fortLayout.find((fort) => fort.team === team && fort.index === 3);
  const gateDirection = team === 'red' ? 1 : -1;
  TEAM[team].spawn.set(centerFort.x, 0, centerFort.z + gateDirection * 44);
}

const WASTE_STYLE = {
  red: {
    pee: 0xf5b52d,
    vomit: 0xf06c38,
    poop: 0x75401f,
  },
  blue: {
    pee: 0xe5cf38,
    vomit: 0xe28348,
    poop: 0x65462c,
  },
};

const MODES = [
  { name: 'SAVAŞ', hint: 'Sol tık ateş · Sağ tık dürbün', cooldown: 0.55 },
  { name: 'BOYAMA', hint: 'Sağ tık nişan · Sol tık boya', cooldown: 0 },
];
const WASTE_TYPES = ['pee', 'vomit', 'poop'];
const WASTE_NAMES = { pee: 'ÇİŞ', vomit: 'KUSMUK', poop: 'KAKA' };
const DAMAGE_MODEL = Object.freeze({
  rifleBase: 39,
  rangeModifier: 0.86,
  rangeReference: 100,
  headMultiplier: 2.65,
  torsoMultiplier: 0.87,
  limbMultiplier: 0.59,
  nonHeadMaximum: 34,
  minimumDamage: 9,
});

const detectedDevice = detectDeviceQuality();
const graphicsPreference = loadGraphicsPreference();
let activeTier = graphicsPreference.mode === 'auto' ? detectedDevice.tier : graphicsPreference.mode;
let activeProfile = QUALITY_PROFILES[activeTier];
let audioVolumePercent = (() => {
  const stored = Number(localStorage.getItem(AUDIO_SETTINGS_KEY));
  return Number.isFinite(stored) ? THREE.MathUtils.clamp(Math.round(stored), 0, 100) : 50;
})();
let runtimeLodScale = 1;
let measuredFps = 60;
let settingsReturnScreen = 'team';

const gameRoot = document.querySelector('#game');
const teamScreen = document.querySelector('#team-screen');
const pauseScreen = document.querySelector('#pause-screen');
const hud = document.querySelector('#hud');
const teamBadge = document.querySelector('#team-badge');
const staminaFill = document.querySelector('#stamina-fill');
const staminaValue = document.querySelector('#stamina-value');
const locationName = document.querySelector('#location-name');
const locationDistance = document.querySelector('#location-distance');
const interactionHint = document.querySelector('#interaction-hint');
const toast = document.querySelector('#toast');
const settingsScreen = document.querySelector('#settings-screen');
const howToPlayScreen = document.querySelector('#how-to-play-screen');
const qualitySelect = document.querySelector('#quality-select');
const dynamicResolutionToggle = document.querySelector('#dynamic-resolution-toggle');
const statsToggle = document.querySelector('#stats-toggle');
const volumeRange = document.querySelector('#volume-range');
const volumeValue = document.querySelector('#volume-value');
const controlsMini = document.querySelector('#controls-mini');
const performanceStats = document.querySelector('#performance-stats');
const detectedQuality = document.querySelector('#detected-quality');
const settingsDeviceSummary = document.querySelector('#settings-device-summary');
const weaponElements = [...document.querySelectorAll('.weapon')];
const fortElements = [...document.querySelectorAll('.fort')];
const weaponStateElements = [...document.querySelectorAll('.weapon-state')];
const weaponResourceElements = [...document.querySelectorAll('.weapon-resource i')];
const minimapCanvas = document.querySelector('#minimap');
const minimapContext = minimapCanvas.getContext('2d');
const bigMap = document.querySelector('#big-map');
const bigMapCanvas = document.querySelector('#big-map-canvas');
const bigMapContext = bigMapCanvas.getContext('2d');
const bigMapTitle = document.querySelector('#big-map-title');
const spawnMapInstruction = document.querySelector('#spawn-map-instruction');
const spawnMapStatus = document.querySelector('#spawn-map-status');
const mapControlWidget = document.querySelector('#map-control-widget');
const mapControlValue = document.querySelector('#map-control-value');
const redScore = document.querySelector('#red-score');
const blueScore = document.querySelector('#blue-score');
const redScoreFill = document.querySelector('#red-score-fill');
const blueScoreFill = document.querySelector('#blue-score-fill');
const paintPercentages = document.querySelector('#paint-percentages');
const mapSeedLabel = document.querySelector('#map-seed-label');
const bigMapSeed = document.querySelector('#big-map-seed');
const redPlayerCount = document.querySelector('#red-player-count');
const bluePlayerCount = document.querySelector('#blue-player-count');
const leaderRedCount = document.querySelector('#leader-red-count');
const leaderBlueCount = document.querySelector('#leader-blue-count');
const menuRedCount = document.querySelector('#menu-red-count');
const menuBlueCount = document.querySelector('#menu-blue-count');
const playerScore = document.querySelector('#player-score');
const playerTime = document.querySelector('#player-time');
const playerKills = document.querySelector('#player-kills');
const playerDeaths = document.querySelector('#player-deaths');
const savedStats = document.querySelector('#saved-stats');
const resetStatsButton = document.querySelector('#reset-stats-button');
const resetConfirmation = document.querySelector('#reset-confirmation');
const battleScorePanel = document.querySelector('#battle-score');
const leaderboardTitle = battleScorePanel.querySelector('.score-title');
const leaderboard = document.querySelector('#leaderboard');
const killFeed = document.querySelector('#kill-feed');
const battleEvents = document.querySelector('#battle-events');
const playerNameInput = document.querySelector('#player-name');
const playerNameCounter = document.querySelector('#player-name-counter');
const countrySelect = document.querySelector('#country-select');
const countryPreview = document.querySelector('#country-preview');
const countryPicker = document.querySelector('#country-picker');
const countryTrigger = document.querySelector('#country-trigger');
const countrySelectedLabel = document.querySelector('#country-selected-label');
const countryMenu = document.querySelector('#country-menu');
const countrySearch = document.querySelector('#country-search');
const countryOptions = document.querySelector('#country-options');
const languageButtons = [...document.querySelectorAll('[data-language]')];
const joinGameButton = document.querySelector('#join-game-button');
const healthFill = document.querySelector('#health-fill');
const healthValue = document.querySelector('#health-value');
const shieldStatus = document.querySelector('#shield-status');
const shieldStateLabel = document.querySelector('#shield-state');
const scopeOverlay = document.querySelector('#scope-overlay');
const scopeZoomLabel = document.querySelector('#scope-zoom-label');
const damageIndicator = document.querySelector('#damage-indicator');
const npcLabelLayer = document.querySelector('#npc-label-layer');
const endScreen = document.querySelector('#end-screen');
const winnerTitle = document.querySelector('#winner-title');
const winnerReason = document.querySelector('#winner-reason');

const scene = new THREE.Scene();
// Hafif turkuaz-gri gökyüzü ve nemli ufuk, yoğun bitki örtüsüne savaş filmi atmosferi verir.
scene.background = new THREE.Color(0x82b9ca);
scene.fog = new THREE.FogExp2(0x82ad9f, activeProfile.fogDensity);

const gameViewportHeight = () => Math.max(1, window.innerHeight - 28);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / gameViewportHeight(), 0.06, activeProfile.far);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({
  antialias: activeTier === 'high' || activeTier === 'ultra',
  powerPreference: 'high-performance',
  stencil: false,
  precision: activeTier === 'performance' ? 'mediump' : 'highp',
});

const gl = renderer.getContext();
const debugRendererInfo = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = debugRendererInfo
  ? gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL)
  : 'Tarayıcı tarafından gizlendi';
detectedDevice.gpu = gpuName;
if (graphicsPreference.mode === 'auto' && /swiftshader|llvmpipe|software rasterizer/i.test(gpuName)) {
  detectedDevice.tier = 'performance';
  detectedDevice.label = QUALITY_PROFILES.performance.label;
  activeTier = 'performance';
  activeProfile = QUALITY_PROFILES.performance;
}
renderer.setPixelRatio(activeProfile.pixelRatio);
renderer.setSize(window.innerWidth, gameViewportHeight());
renderer.shadowMap.enabled = activeProfile.shadows;
renderer.shadowMap.type = activeTier === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = activeTier === 'performance' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
gameRoot.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xd7e6df, 0x354437, 1.68);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe0aa, 2.32);
sun.position.set(-170, 260, -140);
sun.castShadow = activeProfile.shadows;
sun.shadow.mapSize.set(activeProfile.shadowSize, activeProfile.shadowSize);
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
sun.shadow.camera.far = 900;
sun.shadow.bias = -0.00008;
sun.shadow.normalBias = activeTier === 'ultra' ? 0.085 : 0.11;
scene.add(sun);
scene.add(sun.target);
let shadowAnchorX = Number.POSITIVE_INFINITY;
let shadowAnchorZ = Number.POSITIVE_INFINITY;
let worldLodTimer = 0;
let visibleWorldChunks = 0;

const blockers = [];
const blockerGrid = new Map();
const BLOCKER_GRID_SIZE = 32;
const paintables = [];
const bulletSurfaces = [];
const worldLodObjects = [];
const walkSurfaces = [];
const ladderZones = [];
const fortData = [];
const staticMeshes = [];
const sceneryMetrics = { grass: 0, tallGrass: 0, grassProxies: 0, trees: 0, rocks: 0, bushes: 0 };
const friendlyFigures = new THREE.Group();
const bots = [];
const combatTargets = [];
let massArmy;
let multiplayer;
let groundMesh;
scene.add(friendlyFigures);

const bulletHolePool = new PaintPool(scene, 192, { offset: 0.008, opacity: 0.92, renderOrder: 3 });
const bulletHoles = [];
const beamPool = new BeamPool(scene, 112);
const globPool = new GlobPool(scene, 180);
const ballisticPool = new BallisticPool(scene, 72);
const poopPool = new PoopPool(scene, 48);
const paintAimMaterial = new THREE.MeshBasicMaterial({ color: TEAM.red.color, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide });
const paintAimMarker = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 28), paintAimMaterial);
paintAimMarker.visible = false;
paintAimMarker.renderOrder = 12;
scene.add(paintAimMarker);
const paintAimColumnMaterial = new THREE.MeshBasicMaterial({
  color: TEAM.red.color,
  transparent: true,
  opacity: 0.13,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});
const paintAimColumn = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 24, 1, true), paintAimColumnMaterial);
paintAimColumn.visible = false;
paintAimColumn.renderOrder = 11;
scene.add(paintAimColumn);
const paintAimGlow = new THREE.Mesh(
  new THREE.CircleGeometry(1, 32),
  new THREE.MeshBasicMaterial({ color: TEAM.red.color, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
);
paintAimGlow.rotation.x = -Math.PI / 2;
paintAimGlow.visible = false;
paintAimGlow.renderOrder = 11;
scene.add(paintAimGlow);

const PLAYER_STATS_KEY = 'bibish-player-stats-v1';
const DEATH_SCORE_PENALTY = 75;

function loadPlayerStats() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYER_STATS_KEY) || '{}');
    const clean = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;
    return { score: clean(parsed.score), kills: clean(parsed.kills), deaths: clean(parsed.deaths), elapsedSeconds: clean(parsed.elapsedSeconds) };
  } catch {
    return { score: 0, kills: 0, deaths: 0, elapsedSeconds: 0 };
  }
}

const persistedStats = loadPlayerStats();

const state = {
  team: null,
  started: false,
  settingsOpen: false,
  locked: false,
  selectedTeam: 'red',
  playerName: 'Bibishçi',
  mode: 0,
  weapon: 0,
  wasteIndex: 0,
  mouseLeft: false,
  mouseRight: false,
  firing: false,
  aiming: false,
  scopeZoom: 2.4,
  scopeLodBlend: 0,
  shieldActive: false,
  shieldHitTime: 0,
  leaderboardCollapsed: false,
  shotCooldown: 0,
  paintCadence: 0,
  paintCharging: false,
  paintTarget: null,
  soundCooldown: 0,
  health: 100,
  score: persistedStats.score,
  kills: persistedStats.kills,
  deaths: persistedStats.deaths,
  elapsedSeconds: persistedStats.elapsedSeconds,
  countryCode: localStorage.getItem(COUNTRY_KEY) || 'TR',
  lastDamageTime: 99,
  dead: false,
  respawnTimer: 0,
  matchEnded: false,
  stamina: 100,
  yaw: Math.PI,
  pitch: 0,
  feetY: 0,
  velocityY: 0,
  canJump: true,
  jumpQueued: 0,
  jumpGrace: 0.12,
  sprinting: false,
  stance: 'stand',
  stanceBlend: 0,
  currentEyeHeight: PLAYER.eyeHeight,
  currentBodyHeight: PLAYER.bodyHeight,
  currentRadius: STANCE.stand.radius,
  moveAmount: 0,
  stepPhase: 0,
  footstepTimer: 0,
  footstepEvents: 0,
  lastFootstepMode: 'none',
  lastFootstepVolume: 0,
  mapOpen: false,
  spawnSelecting: false,
  spawnSelectionReason: 'initial',
  selectedSpawnFortIndex: -1,
  hoveredSpawnFortIndex: -1,
  spawnFallbackPoint: null,
  spawnFallbackSelected: false,
  spawnHoverPoint: null,
  spawnSelectedPoint: null,
  spawnHoverValid: false,
  spawnHoverReason: 'spawn.ready',
  spawnHoverCounts: { red: 0, blue: 0 },
  spawnPointerUpdateAt: 0,
  thirdPerson: false,
  freeYaw: Math.PI,
  freePitch: -0.12,
  actionKind: 'idle',
  keys: new Set(),
  actionTime: 0,
  actionDuration: 0.34,
  toastTimer: 0,
  uiTimer: 0,
  locationTimer: 0,
  fortTimer: 0,
  fixedAccumulator: 0,
  statsSaveTimer: 0,
  collisionRecoveries: 0,
  cameraSafetyRecoveries: 0,
};

function updateCareerUI() {
  const score = Math.round(state.score);
  playerScore.textContent = score;
  playerTime.textContent = formatElapsedTime(state.elapsedSeconds);
  playerKills.textContent = state.kills;
  playerDeaths.textContent = state.deaths;
  savedStats.textContent = currentLanguage === 'tr'
    ? `${formatElapsedTime(state.elapsedSeconds)} · ${score} PUAN · ${state.kills} KILL · ${state.deaths} ÖLÜM`
    : `${formatElapsedTime(state.elapsedSeconds)} · ${score} SCORE · ${state.kills} KILLS · ${state.deaths} DEATHS`;
}

function formatElapsedTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return [hours, minutes, seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
}

function savePlayerStats() {
  try {
    localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify({
      score: Math.max(0, Math.round(state.score)),
      kills: Math.max(0, Math.round(state.kills)),
      deaths: Math.max(0, Math.round(state.deaths)),
      elapsedSeconds: Math.max(0, Math.round(state.elapsedSeconds)),
    }));
  } catch {
    // Gizli mod veya depolama kotası oyunun çalışmasını engellememeli.
  }
  updateCareerUI();
}

function qualityLabel(tier) {
  const key = tier === 'performance' ? 'quality.low' : tier === 'balanced' ? 'quality.medium' : tier === 'high' ? 'quality.high' : 'quality.ultra';
  return t(key);
}

let countryEntries = [];

function setCountry(code, persist = true) {
  const safeCode = ISO_COUNTRY_CODES.includes(String(code).toUpperCase()) ? String(code).toUpperCase() : 'TR';
  const entry = countryEntries.find((country) => country.code === safeCode);
  state.countryCode = safeCode;
  countrySelect.value = safeCode;
  countryPreview.style.backgroundImage = `url('/flags/${safeCode.toLowerCase()}.svg')`;
  countrySelectedLabel.textContent = `${safeCode} ${entry?.name || safeCode}`;
  countryOptions.querySelectorAll('.country-option').forEach((button) => {
    const active = button.dataset.code === safeCode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  if (persist) localStorage.setItem(COUNTRY_KEY, safeCode);
  if (teamBadge && state.started && state.team) teamBadge.innerHTML = `${flagMarkup(safeCode)} ${escapeHtml(state.playerName)} · ${TEAM[state.team].name}`;
}

function renderCountryOptions(query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase(currentLanguage);
  const visibleEntries = countryEntries.filter(({ code, name }) => (
    !normalizedQuery || code.toLowerCase().includes(normalizedQuery) || name.toLocaleLowerCase(currentLanguage).includes(normalizedQuery)
  ));
  countryOptions.replaceChildren(...visibleEntries.map(({ code, name }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `country-option${code === state.countryCode ? ' active' : ''}`;
    button.dataset.code = code;
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(code === state.countryCode));
    const flag = document.createElement('img');
    flag.className = 'country-flag';
    flag.src = `/flags/${code.toLowerCase()}.svg`;
    flag.loading = 'lazy';
    flag.decoding = 'async';
    flag.alt = '';
    flag.setAttribute('aria-hidden', 'true');
    const codeLabel = document.createElement('code');
    codeLabel.textContent = code;
    const nameLabel = document.createElement('span');
    nameLabel.textContent = name;
    button.append(flag, codeLabel, nameLabel);
    button.addEventListener('click', () => {
      setCountry(code);
      countryMenu.classList.add('hidden');
      countryTrigger.setAttribute('aria-expanded', 'false');
      countryTrigger.focus();
    });
    return button;
  }));
}

function populateCountrySelect() {
  const selected = ISO_COUNTRY_CODES.includes(String(state.countryCode).toUpperCase()) ? String(state.countryCode).toUpperCase() : 'TR';
  const names = new Intl.DisplayNames([currentLanguage], { type: 'region' });
  const collator = new Intl.Collator(currentLanguage);
  countryEntries = ISO_COUNTRY_CODES
    .map((code) => ({ code, name: names.of(code) || code }))
    .sort((a, b) => collator.compare(a.name, b.name));
  countrySelect.replaceChildren(...countryEntries.map(({ code, name }) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = `${code} ${name}`;
    return option;
  }));
  countrySearch.value = '';
  countryOptions.replaceChildren();
  setCountry(selected, false);
}

function updateDeviceSummary() {
  settingsDeviceSummary.textContent = currentLanguage === 'tr'
    ? `${detectedDevice.cores} mantıksal çekirdek · yaklaşık ${detectedDevice.memory} GB bellek · ${detectedDevice.gpu} · öneri: ${qualityLabel(detectedDevice.tier)}`
    : `${detectedDevice.cores} logical cores · about ${detectedDevice.memory} GB memory · ${detectedDevice.gpu} · recommendation: ${qualityLabel(detectedDevice.tier)}`;
}

function applyLanguage(language) {
  currentLanguage = language === 'en' ? 'en' : 'tr';
  localStorage.setItem(LANGUAGE_KEY, currentLanguage);
  TEAM.red.name = t('team.red');
  TEAM.blue.name = t('team.blue');
  MODES[0].name = t('mode.combat');
  MODES[0].hint = t('mode.combatHint');
  MODES[1].name = t('mode.paint');
  MODES[1].hint = t('mode.paintHint');
  WASTE_NAMES.pee = t('waste.pee');
  WASTE_NAMES.vomit = t('waste.vomit');
  WASTE_NAMES.poop = t('waste.poop');
  if (playerNameInput.value === 'Bibishçi' || playerNameInput.value === 'BibishPlayer') playerNameInput.value = currentLanguage === 'tr' ? 'Bibishçi' : 'BibishPlayer';
  enforcePlayerNameLimit();
  if (!state.started) state.playerName = playerNameInput.value;
  applyStaticTranslations();
  populateCountrySelect();
  detectedQuality.textContent = qualityLabel(activeTier);
  updateDeviceSummary();
  mapSeedLabel.textContent = t('map.fixed');
  bigMapSeed.textContent = t('map.fixedLong');
  fortData.forEach((fort) => { fort.name = currentLanguage === 'tr' ? `${fort.team === 'red' ? 'Kırmızı' : 'Mavi'} Karakol ${fort.index}` : `${fort.team === 'red' ? 'Red' : 'Blue'} Fort ${fort.index}`; });
  updateCareerUI();
  updateWeaponUI();
  if (state.spawnSelecting) updateSpawnSelectionCopy();
  if (teamBadge && state.started && state.team) teamBadge.innerHTML = `${flagMarkup(state.countryCode)} ${escapeHtml(state.playerName)} · ${TEAM[state.team].name}`;
}

languageButtons.forEach((button) => button.addEventListener('click', () => applyLanguage(button.dataset.language)));
countrySelect.addEventListener('change', () => {
  setCountry(countrySelect.value);
});
playerNameInput.addEventListener('input', enforcePlayerNameLimit);
enforcePlayerNameLimit();
countryTrigger.addEventListener('click', () => {
  const opening = countryMenu.classList.contains('hidden');
  countryMenu.classList.toggle('hidden', !opening);
  countryTrigger.setAttribute('aria-expanded', String(opening));
  if (opening) {
    renderCountryOptions(countrySearch.value);
    requestAnimationFrame(() => countrySearch.focus());
  }
});
countrySearch.addEventListener('input', () => renderCountryOptions(countrySearch.value));
countrySearch.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    countryMenu.classList.add('hidden');
    countryTrigger.setAttribute('aria-expanded', 'false');
    countryTrigger.focus();
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    countryOptions.querySelector('.country-option')?.focus();
  }
});
countryOptions.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Escape') {
    countryMenu.classList.add('hidden');
    countryTrigger.setAttribute('aria-expanded', 'false');
    countryTrigger.focus();
    return;
  }
  const buttons = [...countryOptions.querySelectorAll('.country-option')];
  const index = buttons.indexOf(document.activeElement);
  buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
});
document.addEventListener('pointerdown', (event) => {
  if (countryPicker.contains(event.target)) return;
  countryMenu.classList.add('hidden');
  countryTrigger.setAttribute('aria-expanded', 'false');
});

applyLanguage(currentLanguage);

updateCareerUI();

const playerPosition = new THREE.Vector3(0, 0, -350);
const detachedCameraPosition = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const groundRaycaster = new THREE.Raycaster();
const labelOcclusionRaycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const npcLabelProjection = new THREE.Vector3();
const npcLabelTarget = new THREE.Vector3();
const npcLabelDirection = new THREE.Vector3();
const npcOcclusionCandidates = new Set();
const rayDirection = new THREE.Vector3();
const rayRight = new THREE.Vector3();
const rayUp = new THREE.Vector3();
const scopeFocusDirection = new THREE.Vector3(0, 0, -1);
const scopeFocus = {
  active: false,
  viewActive: true,
  origin: camera.position,
  direction: scopeFocusDirection,
  maxDistance: 760,
  cosine: Math.cos(THREE.MathUtils.degToRad(3)),
  viewCosine: Math.cos(THREE.MathUtils.degToRad(72)),
  detailBudget: 88,
};

const TERRITORY_SIZE = 1024;
const territoryCells = new Uint8Array(TERRITORY_SIZE * TERRITORY_SIZE);
let paintableTerritoryCount = 0;
const territoryCounts = [0, 0, 0];
const mapBaseCanvas = document.createElement('canvas');
const territoryCanvas = document.createElement('canvas');
mapBaseCanvas.width = mapBaseCanvas.height = 320;
territoryCanvas.width = territoryCanvas.height = TERRITORY_SIZE;
const mapBaseContext = mapBaseCanvas.getContext('2d');
const territoryContext = territoryCanvas.getContext('2d');
const territoryImage = territoryContext.createImageData(TERRITORY_SIZE, TERRITORY_SIZE);
let territoryDirty = false;
let territoryDirtyMinX = TERRITORY_SIZE;
let territoryDirtyMinY = TERRITORY_SIZE;
let territoryDirtyMaxX = -1;
let territoryDirtyMaxY = -1;
let mapTimer = 0;
let lastBoardUpdate = -Infinity;

// Boya dokusu görsel olarak yeterince keskin kalırken her atışta 4 MB yerine ~2,25 MB yüklenir.
const TERRAIN_TEXTURE_SIZE = 1024;
const terrainPaintCanvas = document.createElement('canvas');
terrainPaintCanvas.width = terrainPaintCanvas.height = TERRAIN_TEXTURE_SIZE;
const terrainPaintContext = terrainPaintCanvas.getContext('2d', { alpha: false });
const terrainImage = terrainPaintContext.createImageData(TERRAIN_TEXTURE_SIZE, TERRAIN_TEXTURE_SIZE);

async function initializeTerrainData() {
  setLoadingProgress(10, localized('Sabit ada verisi ve boya hücreleri hazırlanıyor…', 'Preparing fixed island data and paint cells…'));
  const rowsPerChunk = 64;
  for (let py = 0; py < TERRAIN_TEXTURE_SIZE; py += 1) {
    const z = -WORLD.halfDepth + py / (TERRAIN_TEXTURE_SIZE - 1) * WORLD.halfDepth * 2;
    for (let px = 0; px < TERRAIN_TEXTURE_SIZE; px += 1) {
      const x = -WORLD.halfWidth + px / (TERRAIN_TEXTURE_SIZE - 1) * WORLD.halfWidth * 2;
      const height = terrainHeightAt(x, z);
      const cellIndex = py * TERRITORY_SIZE + px;
      if (height < -17.5) territoryCells[cellIndex] = 3;
      else paintableTerritoryCount += 1;
      const slope = THREE.MathUtils.clamp((height + 10) / 45, 0, 1);
      const dry = (Math.sin(x * 0.043) + Math.cos(z * 0.037)) * 0.5;
      let red = 101 + (77 - 101) * slope;
      let green = 119 + (105 - 119) * slope;
      let blue = 66 + (56 - 66) * slope;
      if (dry > 0.72) {
        red += (118 - red) * 0.28;
        green += (109 - green) * 0.28;
        blue += (79 - blue) * 0.28;
      }
      const biomeColor = blendBiomeGroundColor(x, z, red, green, blue);
      red = biomeColor[0];
      green = biomeColor[1];
      blue = biomeColor[2];
      const offset = cellIndex * 4;
      terrainImage.data[offset] = Math.round(red);
      terrainImage.data[offset + 1] = Math.round(green);
      terrainImage.data[offset + 2] = Math.round(blue);
      terrainImage.data[offset + 3] = 255;
    }
    if (py % rowsPerChunk === rowsPerChunk - 1) {
      setLoadingProgress(10 + py / TERRAIN_TEXTURE_SIZE * 36, localized('Vadi, tepe ve boya haritası işleniyor…', 'Processing valleys, hills and the paint map…'));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  territoryCounts[0] = paintableTerritoryCount;
  terrainPaintContext.putImageData(terrainImage, 0, 0);
}

await initializeTerrainData();
const terrainPaintTexture = new THREE.CanvasTexture(terrainPaintCanvas);
terrainPaintTexture.colorSpace = THREE.SRGBColorSpace;
terrainPaintTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
let terrainTextureDirty = false;

const worldMaterial = (parameters) => {
  if (activeTier !== 'performance') return new THREE.MeshStandardMaterial(parameters);
  const { roughness, metalness, ...lambertParameters } = parameters;
  return new THREE.MeshBasicMaterial(lambertParameters);
};
const materials = {
  ground: worldMaterial({ map: terrainPaintTexture, roughness: 1, side: THREE.DoubleSide }),
  concrete: worldMaterial({ color: 0x777a76, roughness: 0.92 }),
  concreteDark: worldMaterial({ color: 0x4d514f, roughness: 0.95 }),
  road: worldMaterial({ color: 0x5b5547, roughness: 1 }),
  bridge: worldMaterial({ color: 0x666866, roughness: 0.9 }),
  water: activeTier === 'performance'
    ? new THREE.MeshBasicMaterial({ color: 0x285660, depthTest: true, depthWrite: true })
    : new THREE.MeshPhysicalMaterial({ color: 0x285660, roughness: 0.26, metalness: 0.04, depthTest: true, depthWrite: true }),
  wood: worldMaterial({ color: 0x4c3528, roughness: 1 }),
  foliage: worldMaterial({ color: 0x354c35, roughness: 1 }),
  rock: worldMaterial({ color: 0x5e625c, roughness: 1 }),
};

const flagMaterials = {
  red: new THREE.MeshBasicMaterial({ color: TEAM.red.color, side: THREE.DoubleSide }),
  blue: new THREE.MeshBasicMaterial({ color: TEAM.blue.color, side: THREE.DoubleSide }),
};

const npcLabelElements = Array.from({ length: 1 }, () => {
  const element = document.createElement('div');
  element.className = 'npc-label';
  element.innerHTML = '<b></b><span><i></i></span>';
  npcLabelLayer.append(element);
  return element;
});

const killFeedEvents = [];
const KILL_FEED_MAX = 9;

function combatantIdentity(value, fallbackTeam = 'red') {
  if (!value) return { name: localized('Bilinmeyen', 'Unknown'), team: fallbackTeam, countryCode: '' };
  return {
    name: value.name || localized('Bilinmeyen', 'Unknown'),
    team: value.team === 'blue' ? 'blue' : 'red',
    countryCode: value.countryCode || '',
  };
}

function renderKillFeed() {
  if (!killFeed) return;
  killFeed.replaceChildren(...killFeedEvents.map((event) => {
    const row = document.createElement('div');
    row.className = 'kill-feed-entry';
    const killer = document.createElement('b');
    killer.className = event.killer.team;
    killer.textContent = `${event.killer.countryCode ? `${countryFlag(event.killer.countryCode)} ` : ''}${event.killer.name}`;
    const weapon = document.createElement('i');
    weapon.textContent = event.weapon === 'sword' ? '⚔' : '⌖';
    const victim = document.createElement('span');
    victim.className = event.victim.team;
    victim.textContent = `${event.victim.countryCode ? `${countryFlag(event.victim.countryCode)} ` : ''}${event.victim.name}`;
    row.append(killer, weapon, victim);
    return row;
  }));
}

function addKillFeed(killer, victim, weapon = 'rifle') {
  if (!killer || !victim) return;
  killFeedEvents.unshift({
    killer: combatantIdentity(killer),
    victim: combatantIdentity(victim, killer.team === 'red' ? 'blue' : 'red'),
    weapon,
  });
  killFeedEvents.length = Math.min(killFeedEvents.length, KILL_FEED_MAX);
  renderKillFeed();
}

function showBattleEvent(title, detail, team = null) {
  if (!battleEvents) return;
  const element = document.createElement('div');
  element.className = 'battle-event';
  const color = team && TEAM[team] ? TEAM[team].color : 0xf5d45b;
  element.style.setProperty('--event-color', `#${new THREE.Color(color).getHexString()}`);
  const heading = document.createElement('b');
  heading.textContent = title;
  const description = document.createElement('span');
  description.textContent = detail;
  element.append(heading, description);
  battleEvents.prepend(element);
  while (battleEvents.children.length > 3) battleEvents.lastElementChild.remove();
  window.setTimeout(() => element.remove(), 5200);
}

let adaptivePerformance;

function configureShadowQuality(tier, force = false) {
  const span = tier === 'ultra' ? 112 : tier === 'high' ? 132 : tier === 'balanced' ? 156 : 92;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.camera.near = 80;
  sun.shadow.camera.far = 560;
  sun.shadow.camera.updateProjectionMatrix();
  if (force) {
    shadowAnchorX = Number.POSITIVE_INFINITY;
    shadowAnchorZ = Number.POSITIVE_INFINITY;
  }
}

function updateLocalSunShadow(force = false) {
  if (!activeProfile.shadows) return;
  const snap = activeTier === 'ultra' ? 18 : activeTier === 'high' ? 24 : 32;
  const anchorX = Math.round(playerPosition.x / snap) * snap;
  const anchorZ = Math.round(playerPosition.z / snap) * snap;
  if (!force && anchorX === shadowAnchorX && anchorZ === shadowAnchorZ) return;
  shadowAnchorX = anchorX;
  shadowAnchorZ = anchorZ;
  sun.target.position.set(anchorX, terrainHeightAt(anchorX, anchorZ), anchorZ);
  sun.position.set(anchorX - 170, 260, anchorZ - 140);
  sun.target.updateMatrixWorld(true);
  sun.shadow.needsUpdate = true;
}

function updateWorldLod(delta, force = false) {
  worldLodTimer += delta;
  if (!force && worldLodTimer < (state.aiming ? 0.08 : 0.14)) return;
  worldLodTimer = 0;
  const baseDistance = activeTier === 'performance' ? 280 : activeTier === 'balanced' ? 500 : activeTier === 'high' ? 760 : 980;
  const scopeDistance = Math.min(activeProfile.far - 20, 350 + state.scopeZoom * 68);
  const protectedBaseDistance = Math.max(260, baseDistance * runtimeLodScale);
  const protectedScopeDistance = Math.max(protectedBaseDistance, scopeDistance * Math.max(0.72, runtimeLodScale));
  const distanceLimit = THREE.MathUtils.lerp(protectedBaseDistance, protectedScopeDistance, state.scopeLodBlend);
  let visible = 0;
  for (const entry of worldLodObjects) {
    const center = entry.sphere.center;
    const radius = entry.sphere.radius;
    const dx = center.x - camera.position.x;
    const dz = center.z - camera.position.z;
    const centerDistance = Math.hypot(dx, dz);
    if (entry.category === 'grassProxy') {
      const nearestDistance = Math.max(0, centerDistance - radius);
      const proxyStart = activeTier === 'performance' ? 135 : activeTier === 'balanced' ? 175 : activeTier === 'high' ? 215 : 255;
      const fadeIn = THREE.MathUtils.smoothstep(nearestDistance, proxyStart, proxyStart + 72);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(nearestDistance, activeProfile.far - 95, activeProfile.far - 18);
      const opacity = fadeIn * fadeOut * 0.92;
      entry.object.material.opacity = opacity;
      entry.object.visible = opacity > 0.025;
    } else if (entry.category === 'grass') {
      const isTallCover = entry.object.userData.grassKind === 'tall';
      const baseGrassDistance = isTallCover
        ? activeProfile.far - 18
        : activeProfile.far * (activeTier === 'performance' ? 0.62 : activeTier === 'balanced' ? 0.7 : activeTier === 'high' ? 0.76 : 0.8);
      // Dürbün açıkken her iki çim katmanı da dürbünün görebildiği son noktaya kadar çizilir.
      const scopeGrassDistance = activeProfile.far - 18;
      // Uzun ot bir oynanış siperi olduğu için adaptif LOD onu agresif biçimde silemez.
      const lodFloor = isTallCover ? 1 : 0.78;
      const scaledBaseDistance = baseGrassDistance * (lodFloor + runtimeLodScale * (1 - lodFloor));
      const protectedScopeDistance = scopeGrassDistance * Math.max(isTallCover ? 1 : 0.9, runtimeLodScale);
      const grassDistance = THREE.MathUtils.lerp(
        scaledBaseDistance,
        Math.max(scaledBaseDistance, protectedScopeDistance),
        state.scopeLodBlend,
      );
      const nearestDistance = Math.max(0, centerDistance - radius);
      const fadeStart = grassDistance * (isTallCover ? 0.84 : 0.76);
      const opacity = 1 - THREE.MathUtils.smoothstep(nearestDistance, fadeStart, grassDistance);
      entry.object.material.opacity = opacity;
      entry.object.visible = opacity > 0.025;
    } else {
      const maximumDistance = distanceLimit + radius;
      entry.object.visible = centerDistance <= maximumDistance;
    }
    if (entry.object.visible) visible += 1;
  }
  visibleWorldChunks = visible;
}

function updatePerformanceStats({ fps, drawCalls, triangles, pixelRatio, tier }) {
  measuredFps = fps;
  const desiredLodScale = fps < 16 ? 0.3 : fps < 26 ? 0.48 : fps < 42 ? 0.7 : fps < 54 ? 0.86 : 1;
  const response = desiredLodScale < runtimeLodScale ? 0.62 : 0.12;
  runtimeLodScale = THREE.MathUtils.lerp(runtimeLodScale, desiredLodScale, response);
  if (!graphicsPreference.showStats) return;
  performanceStats.textContent = currentLanguage === 'tr'
    ? `FPS ${fps} · ÇAĞRI ${drawCalls} · OYUNCU ${multiplayer?.getMetrics().serverPlayerCount || massArmy?.getMetrics().total || 0} · ${qualityLabel(tier).toUpperCase()} · ${pixelRatio.toFixed(2)}×`
    : `FPS ${fps} · DRAWS ${drawCalls} · PLAYERS ${multiplayer?.getMetrics().serverPlayerCount || massArmy?.getMetrics().total || 0} · ${qualityLabel(tier).toUpperCase()} · ${pixelRatio.toFixed(2)}×`;
}

function applyQuality(tier, reason = 'manual') {
  if (!QUALITY_PROFILES[tier]) return;
  activeTier = tier;
  activeProfile = QUALITY_PROFILES[tier];
  renderer.toneMapping = tier === 'performance' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  camera.far = activeProfile.far;
  camera.updateProjectionMatrix();
  scene.fog.density = activeProfile.fogDensity;
  renderer.shadowMap.enabled = activeProfile.shadows;
  renderer.shadowMap.type = tier === 'ultra' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  sun.castShadow = activeProfile.shadows;
  sun.shadow.bias = -0.00008;
  sun.shadow.normalBias = tier === 'ultra' ? 0.085 : tier === 'high' ? 0.1 : 0.12;
  if (sun.shadow.mapSize.x !== activeProfile.shadowSize) {
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapSize.set(activeProfile.shadowSize, activeProfile.shadowSize);
  }
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = activeProfile.shadows;
  configureShadowQuality(tier, true);
  renderer.setPixelRatio(activeProfile.pixelRatio);
  renderer.setSize(window.innerWidth, gameViewportHeight(), false);
  document.documentElement.dataset.quality = tier;
  detectedQuality.textContent = qualityLabel(tier);
  adaptivePerformance?.setTier(tier);
  massArmy?.setQuality(tier);
  updateWorldLod(1, true);
  updateLocalSunShadow(true);
  if (reason === 'runtime') showToast(currentLanguage === 'tr' ? `PERFORMANS KORUMASI · ${qualityLabel(tier).toUpperCase()}` : `PERFORMANCE PROTECTION · ${qualityLabel(tier).toUpperCase()}`);
}

function openSettings(source = 'team') {
  settingsReturnScreen = source;
  state.settingsOpen = true;
  state.firing = false;
  if (document.pointerLockElement) document.exitPointerLock();
  teamScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  settingsScreen.classList.remove('hidden');
  qualitySelect.value = graphicsPreference.mode;
  dynamicResolutionToggle.checked = graphicsPreference.dynamicResolution;
  statsToggle.checked = graphicsPreference.showStats;
  volumeRange.value = String(audioVolumePercent);
  volumeValue.textContent = `${audioVolumePercent}%`;
}

function closeSettings() {
  state.settingsOpen = false;
  settingsScreen.classList.add('hidden');
  if (state.started || settingsReturnScreen === 'pause') pauseScreen.classList.remove('hidden');
  else teamScreen.classList.remove('hidden');
  setControlHelpExpanded(state.started);
}

function openHowToPlay() {
  teamScreen.classList.add('hidden');
  howToPlayScreen.classList.remove('hidden');
}

function closeHowToPlay() {
  howToPlayScreen.classList.add('hidden');
  teamScreen.classList.remove('hidden');
}

function applySettings() {
  graphicsPreference.mode = qualitySelect.value;
  graphicsPreference.dynamicResolution = dynamicResolutionToggle.checked;
  graphicsPreference.showStats = statsToggle.checked;
  setAudioVolume(Number(volumeRange.value), true);
  saveGraphicsPreference(graphicsPreference);
  const tier = graphicsPreference.mode === 'auto' ? detectedDevice.tier : graphicsPreference.mode;
  applyQuality(tier, 'manual');
  adaptivePerformance.setDynamicResolution(graphicsPreference.dynamicResolution);
  performanceStats.classList.toggle('hidden', !graphicsPreference.showStats);
  closeSettings();
  showToast(`${localized('AYARLAR UYGULANDI', 'SETTINGS APPLIED')} · ${qualityLabel(activeTier).toUpperCase()} · ${audioVolumePercent}%`);
}

volumeRange.addEventListener('input', () => {
  setAudioVolume(Number(volumeRange.value), true);
});
volumeRange.value = String(audioVolumePercent);
volumeValue.textContent = `${audioVolumePercent}%`;
volumeRange.style.setProperty('--volume-percent', `${audioVolumePercent}%`);
volumeRange.setAttribute('aria-valuetext', `${audioVolumePercent}%`);

adaptivePerformance = new AdaptivePerformance(renderer, {
  tier: activeTier,
  dynamicResolution: graphicsPreference.dynamicResolution,
  onTierChange: (tier) => {
    if (graphicsPreference.mode === 'auto') applyQuality(tier, 'runtime');
  },
  onStats: updatePerformanceStats,
});

applyQuality(activeTier, 'initial');
performanceStats.classList.toggle('hidden', !graphicsPreference.showStats);
updateDeviceSummary();

function convexHullXZ(points) {
  const sorted = points
    .map((point) => ({ x: point.x, z: point.z }))
    .sort((a, b) => a.x - b.x || a.z - b.z)
    .filter((point, index, list) => index === 0 || Math.abs(point.x - list[index - 1].x) > 0.0001 || Math.abs(point.z - list[index - 1].z) > 0.0001);
  if (sorted.length <= 2) return sorted;
  const cross = (origin, a, b) => (a.x - origin.x) * (b.z - origin.z) - (a.z - origin.z) * (b.x - origin.x);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function addMesh(geometry, material, position, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  if (options.rotation) mesh.rotation.set(...options.rotation);
  if (options.scale) mesh.scale.set(...options.scale);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  mesh.userData.paintable = options.paintable === true;
  scene.add(mesh);
  if (options.paintable === true) paintables.push(mesh);
  if (options.merge !== false) staticMeshes.push(mesh);
  if (options.blocker) {
    const { x, z, y = 100 } = options.blocker;
    mesh.updateMatrixWorld(true);
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const visualBounds = geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    const collisionPoints = [];
    const positions = geometry.getAttribute('position');
    if (positions) {
      for (let index = 0; index < positions.count; index += 1) {
        collisionPoints.push(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld));
      }
    }
    // The declared blocker remains a minimum safety envelope, while the
    // actual mesh vertices replace the old oversized transformed AABB hull.
    for (const cornerX of [position.x - x / 2, position.x + x / 2]) {
      for (const cornerZ of [position.z - z / 2, position.z + z / 2]) collisionPoints.push({ x: cornerX, z: cornerZ });
    }
    const collisionSkin = 0.035;
    blockers.push({
      minX: Math.min(position.x - x / 2, visualBounds.min.x - collisionSkin),
      maxX: Math.max(position.x + x / 2, visualBounds.max.x + collisionSkin),
      minZ: Math.min(position.z - z / 2, visualBounds.min.z - collisionSkin),
      maxZ: Math.max(position.z + z / 2, visualBounds.max.z + collisionSkin),
      minY: Math.min(position.y - y / 2, visualBounds.min.y - collisionSkin),
      maxY: Math.max(position.y + y / 2, visualBounds.max.y + collisionSkin),
      kind: options.blocker.kind || 'solid',
      polygon: convexHullXZ(collisionPoints),
    });
  }
  if (options.walkable) {
    const { x, z, height } = options.walkable;
    walkSurfaces.push({
      minX: position.x - x / 2,
      maxX: position.x + x / 2,
      minZ: position.z - z / 2,
      maxZ: position.z + z / 2,
      height: height ?? position.y,
    });
  }
  return mesh;
}

function registerWorldLod(object, category = 'static') {
  if (!object?.geometry) return object;
  if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
  // Instanced grass keeps every blade transformation in instance matrices. The
  // geometry sphere only surrounds a single blade at the origin, while the
  // object's sphere surrounds the complete world chunk. Using the latter keeps
  // LOD culling anchored to the chunk's real map position.
  if (category === 'grass' && !object.boundingSphere) object.computeBoundingSphere?.();
  let sphere = category === 'grass' && object.boundingSphere
    ? object.boundingSphere
    : object.geometry.boundingSphere;
  if (category === 'grassProxy') {
    object.updateMatrixWorld(true);
    sphere = object.geometry.boundingSphere.clone().applyMatrix4(object.matrixWorld);
  }
  worldLodObjects.push({ object, category, sphere });
  return object;
}

function mergeStaticWorld() {
  const groups = new Map();
  const staticChunkSize = 220;
  for (const mesh of staticMeshes) {
    const chunkX = Math.floor((mesh.position.x + WORLD.halfWidth) / staticChunkSize);
    const chunkZ = Math.floor((mesh.position.z + WORLD.halfDepth) / staticChunkSize);
    const key = `${mesh.material.uuid}:${mesh.userData.paintable ? 'paint' : 'visual'}:${chunkX}:${chunkZ}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  }

  for (const meshes of groups.values()) {
    if (meshes.length < 2) {
      bulletSurfaces.push(meshes[0]);
      registerWorldLod(meshes[0]);
      continue;
    }
    const geometries = [];
    for (const mesh of meshes) {
      mesh.updateMatrixWorld(true);
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometries.push(geometry.applyMatrix4(mesh.matrixWorld));
    }
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((item) => item.dispose());
    if (!geometry) continue;

    const merged = new THREE.Mesh(geometry, meshes[0].material);
    merged.castShadow = meshes.some((mesh) => mesh.castShadow);
    merged.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
    scene.add(merged);
    registerWorldLod(merged);
    bulletSurfaces.push(merged);

    const meshSet = new Set(meshes);
    for (let index = paintables.length - 1; index >= 0; index -= 1) {
      if (meshSet.has(paintables[index])) paintables.splice(index, 1);
    }
    if (meshes[0].userData.paintable) paintables.push(merged);
    for (const mesh of meshes) {
      scene.remove(mesh);
      mesh.geometry.dispose();
    }
  }
  staticMeshes.length = 0;
}

function createGround() {
  const segmentCount = TERRAIN_SEGMENTS;
  const segmentsX = segmentCount;
  const segmentsZ = segmentCount;
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const lowColor = new THREE.Color(0x657742);
  const highColor = new THREE.Color(0x4d6938);
  const dirtColor = new THREE.Color(0x766d4f);

  for (let iz = 0; iz <= segmentsZ; iz += 1) {
    const z = -WORLD.halfDepth + (iz / segmentsZ) * WORLD.halfDepth * 2;
    for (let ix = 0; ix <= segmentsX; ix += 1) {
      const x = -WORLD.halfWidth + (ix / segmentsX) * WORLD.halfWidth * 2;
      const y = terrainHeightAt(x, z);
      positions.push(x, y, z);
      const normalSample = 14;
      tmpV1.set(
        terrainHeightAt(x - normalSample, z) - terrainHeightAt(x + normalSample, z),
        normalSample * 2,
        terrainHeightAt(x, z - normalSample) - terrainHeightAt(x, z + normalSample),
      ).normalize();
      normals.push(tmpV1.x, tmpV1.y, tmpV1.z);
      uvs.push(ix / segmentsX, 1 - iz / segmentsZ);
      const slopeTint = THREE.MathUtils.clamp((y + 10) / 45, 0, 1);
      const color = lowColor.clone().lerp(highColor, slopeTint);
      const dryPatch = (Math.sin(x * 0.043) + Math.cos(z * 0.037)) * 0.5;
      if (dryPatch > 0.72) color.lerp(dirtColor, 0.28);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let iz = 0; iz < segmentsZ; iz += 1) {
    for (let ix = 0; ix < segmentsX; ix += 1) {
      const a = iz * (segmentsX + 1) + ix;
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  groundMesh = new THREE.Mesh(geometry, materials.ground);
  // The terrain spans the full island; sampling a local shadow atlas on every terrain
  // fragment causes slope banding and is the largest fill-rate cost on weak GPUs.
  // Vertex normals still provide directional relief while props retain local shadows.
  groundMesh.receiveShadow = false;
  groundMesh.userData.paintable = true;
  scene.add(groundMesh);
  paintables.push(groundMesh);
  bulletSurfaces.push(groundMesh);

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2200), materials.water);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = -20;
  ocean.receiveShadow = false;
  ocean.renderOrder = -50;
  ocean.frustumCulled = true;
  ocean.userData.nonInteractive = true;
  scene.add(ocean);
}

function addWall(position, size, material = materials.concrete, walkable = true) {
  return addMesh(new THREE.BoxGeometry(size.x, size.y, size.z), material, position, {
    blocker: { x: size.x, y: size.y, z: size.z },
    walkable: walkable ? { x: size.x, z: size.z, height: position.y + size.y / 2 } : undefined,
  });
}

function createFlag(x, y, z, team, fortIndex) {
  const palette = TEAM[team];
  addMesh(new THREE.CylinderGeometry(0.16, 0.24, 16, 7), materials.wood, new THREE.Vector3(x, y + 8, z), {
    blocker: { x: 0.5, y: 16, z: 0.5 },
  });

  const flagMaterial = new THREE.MeshBasicMaterial({ color: palette.color, side: THREE.DoubleSide });
  const flag = addMesh(new THREE.PlaneGeometry(5.8, 3.2), flagMaterial, new THREE.Vector3(x + 2.9, y + 13.2, z), {
    merge: false,
  });

  const label = createTextSprite(`${team === 'red' ? 'K' : 'M'}${fortIndex}`, palette.color);
  label.position.set(x, y + 18, z);
  label.scale.set(8, 4, 1);
  scene.add(label);
  return { flag, label };
}

function createFort(x, z, team, index) {
  const groundY = terrainHeightAt(x, z);
  const teamColor = new THREE.Color(TEAM[team].color);
  const fortStone = materials.concrete.clone();
  const fortDark = materials.concreteDark.clone();
  const fortFoundation = materials.concreteDark.clone();
  fortStone.color.copy(teamColor).lerp(new THREE.Color(0x777a76), 0.28);
  fortDark.color.copy(teamColor).lerp(new THREE.Color(0x343a39), 0.38);
  fortFoundation.color.copy(teamColor).lerp(new THREE.Color(0x252a29), 0.46);
  const fortWall = (position, size, material = fortStone, walkable = true) => addWall(position, size, material, walkable);
  const half = 29;
  const wallHeight = 7.2;
  const wallThickness = 5.6;
  const gateSide = team === 'red' ? 1 : -1;
  const gateZ = z + gateSide * half;
  const backZ = z - gateSide * half;
  const gateWidth = 10;
  const frontSegmentLength = (half * 2 - gateWidth) / 2;
  const frontOffset = gateWidth / 2 + frontSegmentLength / 2;

  const foundation = addMesh(
    new THREE.BoxGeometry(60, 0.7, 60),
    fortFoundation,
    new THREE.Vector3(x, groundY - 0.42, z),
    { castShadow: false, walkable: { x: 60, z: 60, height: groundY } },
  );
  foundation.receiveShadow = true;

  // Kalın taş rampartların üstleri tek, kesintisiz bir yürüyüş hattıdır.
  fortWall(new THREE.Vector3(x, groundY + wallHeight / 2, backZ), new THREE.Vector3(half * 2, wallHeight, wallThickness));
  fortWall(new THREE.Vector3(x - frontOffset, groundY + wallHeight / 2, gateZ), new THREE.Vector3(frontSegmentLength, wallHeight, wallThickness));
  fortWall(new THREE.Vector3(x + frontOffset, groundY + wallHeight / 2, gateZ), new THREE.Vector3(frontSegmentLength, wallHeight, wallThickness));
  fortWall(new THREE.Vector3(x - half, groundY + wallHeight / 2, z), new THREE.Vector3(wallThickness, wallHeight, half * 2));
  fortWall(new THREE.Vector3(x + half, groundY + wallHeight / 2, z), new THREE.Vector3(wallThickness, wallHeight, half * 2));
  // Kapı kemerinin üzerindeki köprü ön sur yürüyüşünü tamamlar.
  fortWall(
    new THREE.Vector3(x, groundY + wallHeight - 0.7, gateZ),
    new THREE.Vector3(gateWidth, 1.4, wallThickness),
  );

  for (const dx of [-half, half]) {
    for (const dz of [-half, half]) {
      fortWall(new THREE.Vector3(x + dx, groundY + 4.4, z + dz), new THREE.Vector3(8.2, 8.8, 8.2), fortDark);
    }
  }

  // İç ve dış alçak korkuluklar oyuncuyu sur üstünde tutar; mazgallar aradan ateş etmeye izin verir.
  const parapetY = groundY + wallHeight + 0.48;
  const edgeOffset = wallThickness / 2 - 0.42;
  for (const edgeZ of [backZ - edgeOffset, backZ + edgeOffset]) {
    fortWall(new THREE.Vector3(x, parapetY, edgeZ), new THREE.Vector3(half * 2, 0.96, 0.72), fortDark, true);
  }
  for (const edgeX of [x - half - edgeOffset, x - half + edgeOffset, x + half - edgeOffset, x + half + edgeOffset]) {
    fortWall(new THREE.Vector3(edgeX, parapetY, z), new THREE.Vector3(0.72, 0.96, half * 2), fortDark, true);
  }
  for (const sideX of [-frontOffset, frontOffset]) {
    for (const edgeZ of [gateZ - edgeOffset, gateZ + edgeOffset]) {
      fortWall(new THREE.Vector3(x + sideX, parapetY, edgeZ), new THREE.Vector3(frontSegmentLength, 0.96, 0.72), fortDark, true);
    }
  }
  for (const edgeZ of [gateZ - edgeOffset, gateZ + edgeOffset]) {
    fortWall(new THREE.Vector3(x, parapetY, edgeZ), new THREE.Vector3(gateWidth, 0.96, 0.72), fortDark, true);
  }

  for (let offset = -24; offset <= 24; offset += 8) {
    fortWall(new THREE.Vector3(x + offset, groundY + wallHeight + 1.35, backZ - edgeOffset), new THREE.Vector3(3.3, 1.1, 1.25), fortDark, true);
    if (Math.abs(offset) > gateWidth / 2 + 1) {
      fortWall(new THREE.Vector3(x + offset, groundY + wallHeight + 1.35, gateZ + gateSide * edgeOffset), new THREE.Vector3(3.3, 1.1, 1.25), fortDark, true);
    }
    fortWall(new THREE.Vector3(x - half - edgeOffset, groundY + wallHeight + 1.35, z + offset), new THREE.Vector3(1.25, 1.1, 3.3), fortDark, true);
    fortWall(new THREE.Vector3(x + half + edgeOffset, groundY + wallHeight + 1.35, z + offset), new THREE.Vector3(1.25, 1.1, 3.3), fortDark, true);
  }

  // Taş örgü bantları ve iç payandalar geniş düz yüzeyleri kırarak surlara ölçek ve ağırlık verir.
  for (const bandHeight of [2.25, 4.7]) {
    const bandY = groundY + bandHeight;
    addMesh(new THREE.BoxGeometry(half * 2 - 1, 0.22, 0.18), fortDark, new THREE.Vector3(x, bandY, backZ + gateSide * (wallThickness / 2 + 0.08)));
    addMesh(new THREE.BoxGeometry(frontSegmentLength - 0.5, 0.22, 0.18), fortDark, new THREE.Vector3(x - frontOffset, bandY, gateZ - gateSide * (wallThickness / 2 + 0.08)));
    addMesh(new THREE.BoxGeometry(frontSegmentLength - 0.5, 0.22, 0.18), fortDark, new THREE.Vector3(x + frontOffset, bandY, gateZ - gateSide * (wallThickness / 2 + 0.08)));
    addMesh(new THREE.BoxGeometry(0.18, 0.22, half * 2 - 1), fortDark, new THREE.Vector3(x - half + wallThickness / 2 + 0.08, bandY, z));
    addMesh(new THREE.BoxGeometry(0.18, 0.22, half * 2 - 1), fortDark, new THREE.Vector3(x + half - wallThickness / 2 - 0.08, bandY, z));
  }
  for (const offset of [-18, -6, 6, 18]) {
    fortWall(new THREE.Vector3(x + offset, groundY + 2.6, backZ + gateSide * (wallThickness / 2 + 0.48)), new THREE.Vector3(1.1, 5.2, 1.05), fortDark, false);
    if (Math.abs(offset) > gateWidth / 2 + 1) fortWall(new THREE.Vector3(x + offset, groundY + 2.6, gateZ - gateSide * (wallThickness / 2 + 0.48)), new THREE.Vector3(1.1, 5.2, 1.05), fortDark, false);
    fortWall(new THREE.Vector3(x - half + wallThickness / 2 + 0.48, groundY + 2.6, z + offset), new THREE.Vector3(1.05, 5.2, 1.1), fortDark, false);
    fortWall(new THREE.Vector3(x + half - wallThickness / 2 - 0.48, groundY + 2.6, z + offset), new THREE.Vector3(1.05, 5.2, 1.1), fortDark, false);
  }

  const flagParts = createFlag(x, groundY, z + gateSide * 4, team, index);

  // İki geniş temas bölgeli dikey tahta merdiven: yaklaşınca W/SPACE ile kolayca tutunulur.
  const buildLadder = (axis, side) => {
    const isXWall = axis === 'x';
    const wallCoordinate = (isXWall ? x : z) + side * (half - wallThickness / 2 - 0.72);
    const centerAlongWall = isXWall ? z : (side === gateSide ? x - frontOffset : x);
    for (const railOffset of [-0.82, 0.82]) {
      addMesh(
        new THREE.CylinderGeometry(0.14, 0.14, wallHeight + 1, 7),
        materials.wood,
        new THREE.Vector3(
          isXWall ? wallCoordinate : centerAlongWall + railOffset,
          groundY + wallHeight / 2,
          isXWall ? centerAlongWall + railOffset : wallCoordinate,
        ),
      );
    }
    for (let rung = 0; rung <= 11; rung += 1) {
      addMesh(
        new THREE.CylinderGeometry(0.1, 0.1, 1.8, 7),
        materials.wood,
        new THREE.Vector3(
          isXWall ? wallCoordinate - side * 0.08 : centerAlongWall,
          groundY + 0.38 + rung * 0.62,
          isXWall ? centerAlongWall : wallCoordinate - side * 0.08,
        ),
        { rotation: isXWall ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2] },
      );
    }
    ladderZones.push({
      minX: isXWall ? wallCoordinate - 2.8 : centerAlongWall - 8.5,
      maxX: isXWall ? wallCoordinate + 2.8 : centerAlongWall + 8.5,
      minZ: isXWall ? centerAlongWall - 8.5 : wallCoordinate - 2.8,
      maxZ: isXWall ? centerAlongWall + 8.5 : wallCoordinate + 2.8,
      snapX: isXWall ? wallCoordinate - side * 0.12 : centerAlongWall,
      snapZ: isXWall ? centerAlongWall : wallCoordinate - side * 0.12,
      exitX: isXWall ? x + side * (half - 1.1) : centerAlongWall,
      exitZ: isXWall ? centerAlongWall : z + side * (half - 1.1),
      bottom: groundY,
      top: groundY + wallHeight,
    });
  };
  buildLadder('x', -1);
  buildLadder('x', 1);
  buildLadder('z', -1);
  buildLadder('z', 1);

  const gateSignMaterial = flagMaterials[team].clone();
  addMesh(new THREE.PlaneGeometry(12, 2), gateSignMaterial, new THREE.Vector3(x, groundY + 4.3, gateZ - gateSide * 1.4), {
    rotation: [0, gateSide === 1 ? 0 : Math.PI, 0],
    merge: false,
  });

  fortData.push({
    x, y: groundY, z, team, originalTeam: team, index,
    name: currentLanguage === 'tr' ? `${team === 'red' ? 'Kırmızı' : 'Mavi'} Karakol ${index}` : `${team === 'red' ? 'Red' : 'Blue'} Fort ${index}`,
    half, wallHeight, wallThickness, gateSide, captureTeam: null, captureProgress: 0, flag: flagParts.flag, flagLabel: flagParts.label,
    colorMaterials: { stone: fortStone, dark: fortDark, foundation: fortFoundation, gateSign: gateSignMaterial },
  });
}

function createTextSprite(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10,10,10,.74)';
  ctx.fillRect(20, 20, 216, 88);
  ctx.strokeStyle = `#${new THREE.Color(color).getHexString()}`;
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, 216, 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
  sprite.scale.set(18, 9, 1);
  return sprite;
}

const BOT_NAMES = {
  red: ['KızılKaptan', 'SalçaBey', 'AcıBiber', 'KorAteş', 'NarKırmızı'],
  blue: ['MaviMisket', 'Lacivert', 'SerinÇocuk', 'GökMuhafız', 'BuzKılıç'],
};
const BOT_COUNTRY_CODES = {
  red: ['TR', 'MX', 'JP', 'BR', 'PL'],
  blue: ['GB', 'FR', 'KR', 'CA', 'SE'],
};

const nameplateFlagImages = new Map();
function nameplateFlagImage(code, bot) {
  const safeCode = ISO_COUNTRY_CODES.includes(String(code).toUpperCase()) ? String(code).toLowerCase() : 'tr';
  let record = nameplateFlagImages.get(safeCode);
  if (!record) {
    const image = new Image();
    record = { image, loaded: false, bots: new Set() };
    nameplateFlagImages.set(safeCode, record);
    image.decoding = 'async';
    image.addEventListener('load', () => {
      record.loaded = true;
      for (const waitingBot of record.bots) updateBotNameplate(waitingBot);
      record.bots.clear();
    }, { once: true });
    image.src = `/flags/${safeCode}.svg`;
  }
  if (!record.loaded) record.bots.add(bot);
  return record.loaded ? record.image : null;
}

function updateBotNameplate(bot) {
  const { canvas, context, texture } = bot.label.userData;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(12,12,11,.82)';
  context.fillRect(4, 4, 248, 56);
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillStyle = '#fff';
  const flagImage = nameplateFlagImage(bot.countryCode, bot);
  if (flagImage) context.drawImage(flagImage, 12, 10, 40, 27);
  else {
    context.fillStyle = '#e8e3d6';
    context.fillRect(12, 10, 40, 27);
  }
  context.fillStyle = '#fff';
  context.font = '800 22px Arial';
  context.fillText(bot.name, 62, 27);
  context.fillStyle = 'rgba(255,255,255,.18)';
  context.fillRect(18, 38, 220, 12);
  context.fillStyle = bot.team === 'red' ? '#ff315e' : '#28b8ff';
  context.fillRect(18, 38, 220 * Math.max(0, bot.health) / 100, 12);
  texture.needsUpdate = true;
}

function createBotNameplate() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
  label.scale.set(3.15, 0.79, 1);
  label.position.y = 2.42;
  label.renderOrder = 20;
  label.userData = { canvas, context, texture };
  return label;
}

function createShieldModel(team, viewModelMode = false) {
  const shield = new THREE.Group();
  const materialOptions = viewModelMode ? { depthTest: false, depthWrite: false } : {};
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x56646a, roughness: 0.44, metalness: 0.72, ...materialOptions });
  const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xb4bec0, roughness: 0.24, metalness: 0.92, ...materialOptions });
  const teamMaterial = new THREE.MeshStandardMaterial({ color: TEAM[team].color, roughness: 0.58, metalness: 0.3, ...materialOptions });
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.61, 0.7, 0.13, 24, 1, false), faceMaterial);
  face.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.675, 0.045, 8, 28), rimMaterial);
  rim.position.z = 0.075;
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 9), rimMaterial);
  boss.scale.z = 0.42;
  boss.position.z = 0.105;
  const teamStripe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.02, 0.035), teamMaterial);
  teamStripe.position.z = 0.106;
  shield.add(face, rim, teamStripe, boss);
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 5), rimMaterial);
    stud.position.set(Math.cos(angle) * 0.51, Math.sin(angle) * 0.51, 0.118);
    shield.add(stud);
  }
  shield.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = !viewModelMode;
    child.receiveShadow = !viewModelMode;
    if (viewModelMode) child.renderOrder = 14;
  });
  shield.userData = { faceMaterial, rimMaterial, teamMaterial };
  return shield;
}

function createCharacterEquipment(team) {
  const root = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x242927, roughness: 0.55, metalness: 0.35 });
  const bladeMetal = new THREE.MeshStandardMaterial({ color: 0xe9eef0, roughness: 0.16, metalness: 0.92 });
  const fullerMetal = new THREE.MeshStandardMaterial({ color: 0x778187, roughness: 0.25, metalness: 0.88 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3824, roughness: 0.9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xa7792d, roughness: 0.3, metalness: 0.78 });
  const teamTrim = new THREE.MeshStandardMaterial({ color: TEAM[team].color, roughness: 0.72 });

  // Birinci şahıs tüfeğinin aynı oranları ve parçaları: dipçik, gövde, namlu, dürbün ve namlu ağzı.
  const rifle = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.72), wood);
  stock.position.z = -0.22;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.52), metal);
  receiver.position.z = 0.38;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.28, 8), metal);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 1.18;
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.52, 10), metal);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.13, 0.38);
  const muzzleRing = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 10), metal);
  muzzleRing.position.z = 1.84;
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 7), metal);
  bolt.rotation.z = Math.PI / 2;
  bolt.position.set(0.12, 0.02, 0.38);
  const sling = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.018, 5, 12, Math.PI), teamTrim);
  sling.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  sling.position.set(0, -0.2, 0.1);
  const rifleMuzzle = new THREE.Object3D();
  rifleMuzzle.position.set(0, 0, 1.9);
  rifle.add(stock, receiver, barrel, scope, muzzleRing, bolt, sling, rifleMuzzle);
  rifle.position.set(0.16, 1.2, 0.38);
  rifle.rotation.x = -0.08;
  rifle.scale.setScalar(0.62);

  // Birinci şahıs kılıcıyla aynı bıçak profili, oluk, balçak, kabza sargıları ve topuz.
  const sword = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.075, 0);
  bladeShape.lineTo(-0.095, 1.18);
  bladeShape.lineTo(-0.055, 1.36);
  bladeShape.lineTo(0, 1.58);
  bladeShape.lineTo(0.055, 1.36);
  bladeShape.lineTo(0.095, 1.18);
  bladeShape.lineTo(0.075, 0);
  bladeShape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.038, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  bladeGeometry.center();
  bladeGeometry.translate(0, 0.79, 0);
  const blade = new THREE.Mesh(bladeGeometry, bladeMetal);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.026, 1.03, 0.018), fullerMetal);
  fuller.position.set(0, 0.7, -0.032);
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.58, 10), brass);
  guard.rotation.z = Math.PI / 2;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.42, 10), wood);
  grip.position.y = -0.24;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brass);
  pommel.position.y = -0.49;
  const rainGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.09, 10), brass);
  rainGuard.position.y = -0.02;
  sword.add(blade, fuller, guard, grip, pommel, rainGuard);
  for (let ring = 0; ring < 5; ring += 1) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.008, 5, 10), brass);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = -0.08 - ring * 0.075;
    sword.add(wrap);
  }
  sword.position.set(0.34, 1.01, 0.31);
  sword.rotation.set(0.03, -0.04, -0.12);
  sword.scale.setScalar(0.72);
  sword.visible = false;

  const shield = createShieldModel(team);
  shield.position.set(-0.48, 0.98, 0.12);
  shield.rotation.set(0.08, 0.34, 0.12);
  shield.scale.setScalar(0.72);
  shield.visible = false;

  root.add(rifle, sword, shield);
  root.userData = { rifle, rifleMuzzle, sword, shield };
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return root;
}

function createHumanFigure(team, name, fort) {
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);
  const uniform = new THREE.MeshStandardMaterial({ color: TEAM[team].color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd7aa7c, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x201915, roughness: 1 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.95 });
  const bot = {
    team, name, fort, group, health: 100, dead: false, deathTime: 0,
    countryCode: BOT_COUNTRY_CODES[team][fort.index - 1],
    lastDamage: 99, shotTimer: randomRange(1.4, 3), patrol: randomRange(0, Math.PI * 2),
    originX: fort.x + randomRange(-7, 7), originZ: fort.z + randomRange(-7, 7),
    actionKind: 'idle', actionTime: 0, actionDuration: 0.4,
    stance: 'stand', stateTimer: randomRange(2.5, 5.5), jumpOffset: 0, jumpTime: 0, footstepTimer: randomRange(0.1, 0.5),
    weapon: 'rifle', shieldActive: false, meleeApplied: false,
    score: Math.round(randomRange(360, 690)), kills: Math.floor(randomRange(2, 18)), deaths: Math.floor(randomRange(0, 8)),
    elapsedSeconds: Math.floor(randomRange(720, 9200)),
  };

  const addPart = (geometry, material, position, zone, rotation = null) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bot = bot;
    mesh.userData.damageZone = zone;
    bodyRoot.add(mesh);
    if (zone) combatTargets.push(mesh);
    return mesh;
  };

  bot.torso = addPart(new THREE.CapsuleGeometry(0.25, 0.52, 4, 7), uniform, [0, 1.08, 0], 'torso');
  bot.head = addPart(new THREE.SphereGeometry(0.22, 10, 8), skin, [0, 1.78, 0], 'head');
  bot.leftLeg = addPart(new THREE.CapsuleGeometry(0.105, 0.48, 4, 6), uniform, [-0.15, 0.38, 0], 'limb');
  bot.rightLeg = addPart(new THREE.CapsuleGeometry(0.105, 0.48, 4, 6), uniform, [0.15, 0.38, 0], 'limb');
  bot.leftArm = addPart(new THREE.CapsuleGeometry(0.08, 0.5, 4, 6), uniform, [-0.34, 1.12, 0], 'limb', [0, 0, -0.08]);
  bot.rightArm = addPart(new THREE.CapsuleGeometry(0.08, 0.5, 4, 6), uniform, [0.34, 1.12, 0], 'limb', [0, 0, 0.08]);
  const addFacePart = (geometry, position, material = dark) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    bot.head.add(mesh);
    return mesh;
  };
  addFacePart(new THREE.SphereGeometry(0.052, 8, 6), [-0.075, 0.045, 0.198], eyeWhite);
  addFacePart(new THREE.SphereGeometry(0.052, 8, 6), [0.075, 0.045, 0.198], eyeWhite);
  addFacePart(new THREE.SphereGeometry(0.026, 7, 5), [-0.075, 0.045, 0.238]);
  addFacePart(new THREE.SphereGeometry(0.026, 7, 5), [0.075, 0.045, 0.238]);
  addFacePart(new THREE.BoxGeometry(0.145, 0.03, 0.03), [0, -0.085, 0.224]);
  const anatomy = createStylizedAnatomy(skin);
  bodyRoot.add(anatomy);
  const equipment = createCharacterEquipment(team);
  bodyRoot.add(equipment);
  bot.bodyRoot = bodyRoot;
  bot.equipment = equipment;
  bot.rig = { bodyRoot, equipment, torso: bot.torso, head: bot.head, leftLeg: bot.leftLeg, rightLeg: bot.rightLeg, leftArm: bot.leftArm, rightArm: bot.rightArm, anatomy };

  bot.label = createBotNameplate();
  group.add(bot.label);
  group.position.set(bot.originX, terrainHeightAt(bot.originX, bot.originZ), bot.originZ);
  group.rotation.y = team === 'red' ? 0 : Math.PI;
  friendlyFigures.add(group);
  bots.push(bot);
  updateBotNameplate(bot);
  return bot;
}

function createBattleFigures() {
  for (const fort of fortData) createHumanFigure(fort.originalTeam, BOT_NAMES[fort.originalTeam][fort.index - 1], fort);
}

function createGrassField() {
  const grassCount = activeTier === 'performance' ? 16000 : activeTier === 'balanced' ? 32000 : activeTier === 'high' ? 58000 : 92000;
  const tallGrassCount = activeTier === 'performance' ? 8000 : activeTier === 'balanced' ? 16000 : activeTier === 'high' ? 28000 : 40000;
  // Tam dikdörtgen düzlemler uzakta siyah çizgi, yakında kalın levha gibi görünüyordu.
  // Sivri uçlu çapraz yapraklar aynı silüeti çok daha az üçgen ve sıfır doku maliyetiyle verir.
  const createGrassBlade = (quarterTurn = false, width = 0.17, height = 0.72, bend = 0.055, offsetX = 0, offsetZ = 0) => {
    const positions = quarterTurn
      ? new Float32Array([
          offsetX, 0, offsetZ - width / 2,
          offsetX, 0, offsetZ + width / 2,
          offsetX + bend, height * 0.72, offsetZ + width * 0.24,
          offsetX + bend * 1.45, height, offsetZ,
        ])
      : new Float32Array([
          offsetX - width / 2, 0, offsetZ,
          offsetX + width / 2, 0, offsetZ,
          offsetX + width * 0.24, height * 0.72, offsetZ + bend,
          offsetX, height, offsetZ + bend * 1.45,
        ]);
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    blade.setIndex([0, 1, 2, 0, 2, 3]);
    blade.computeVertexNormals();
    return blade;
  };
  const createGrassClump = (offsets, width, height, bend) => {
    const blades = [];
    for (const [offsetX, offsetZ] of offsets) {
      blades.push(createGrassBlade(false, width, height, bend, offsetX, offsetZ));
      blades.push(createGrassBlade(true, width, height, bend, offsetX, offsetZ));
    }
    const clump = mergeGeometries(blades, false);
    blades.forEach((blade) => blade.dispose());
    return clump;
  };
  const geometry = createGrassClump([[0, 0]], 0.17, 0.72, 0.055);
  // Yedi gövde tek instance'tır; kümeler zıplama yüksekliğinde bile kesintisiz bir örtü oluşturur.
  const tallGeometry = createGrassClump([[0, 0], [-0.17, 0.13], [0.18, 0.11], [-0.09, -0.17], [0.14, -0.14], [-0.23, -0.025], [0.23, -0.035]], 0.13, 0.82, 0.085);
  const material = activeTier === 'performance'
    ? new THREE.MeshBasicMaterial({ color: 0x56823f, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color: 0x659748, side: THREE.DoubleSide });
  const tallMaterial = activeTier === 'performance'
    ? new THREE.MeshBasicMaterial({ color: 0x3f7d3d, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color: 0x4d8b45, emissive: 0x081508, side: THREE.DoubleSide });
  material.alphaHash = true;
  tallMaterial.alphaHash = true;
  const dummy = new THREE.Object3D();
  const grassChunks = new Map();
  const grasslandBiomes = biomeLayout.filter((biome) => biome.type === 'grassland');
  const ultraDenseMeadow = grasslandBiomes.find((biome) => biome.variant === 'elephantGrass') || grasslandBiomes[0];
  const grassChunkSize = 80;
  const addToChunk = (chunks, x, z, chunkSize, matrix) => {
    const chunkX = Math.floor((x + WORLD.halfWidth) / chunkSize);
    const chunkZ = Math.floor((z + WORLD.halfDepth) / chunkSize);
    const chunkKey = `${chunkX}:${chunkZ}`;
    if (!chunks.has(chunkKey)) chunks.set(chunkKey, []);
    chunks.get(chunkKey).push(matrix.clone());
  };
  const buildChunks = (chunks, chunkGeometry, chunkBaseMaterial, grassKind) => {
    for (const matrices of chunks.values()) {
      const chunkMaterial = chunkBaseMaterial.clone();
      chunkMaterial.alphaHash = true;
      const grass = new THREE.InstancedMesh(chunkGeometry, chunkMaterial, matrices.length);
      matrices.forEach((matrix, index) => grass.setMatrixAt(index, matrix));
      grass.count = matrices.length;
      grass.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      grass.instanceMatrix.needsUpdate = true;
      grass.castShadow = false;
      grass.receiveShadow = false;
      grass.computeBoundingSphere();
      grass.updateMatrix();
      grass.matrixAutoUpdate = false;
      grass.userData.grassKind = grassKind;
      scene.add(grass);
      registerWorldLod(grass, 'grass');
    }
  };
  let placed = 0;
  let attempts = 0;
  while (placed < grassCount && attempts < grassCount * 3) {
    attempts += 1;
    const densityRoll = mapRandom();
    let point;
    let densityBand;
    if (densityRoll < 0.62 && ultraDenseMeadow) {
      // Haritanın merkez çayırında bilerek çok sık bir çim biyomu: kompakt alan, yüksek örnek yoğunluğu.
      const spreadAngle = mapRandom() * Math.PI * 2;
      const spread = Math.sqrt(mapRandom()) * ultraDenseMeadow.radius * 0.18;
      point = {
        x: ultraDenseMeadow.x + Math.cos(spreadAngle) * spread,
        z: ultraDenseMeadow.z + Math.sin(spreadAngle) * spread * 0.82,
        biome: ultraDenseMeadow,
      };
      densityBand = 'carpet';
    } else if (densityRoll < 0.84) {
      // Çayır biyomlarının içindeki yoğun alt-kümeler: bazı alanlar gerçek bir çim denizi olur.
      const meadow = grasslandBiomes[Math.floor(mapRandom() * grasslandBiomes.length)];
      const patchAngle = mapRandom() * Math.PI * 2;
      const patchCenterDistance = meadow.radius * randomRange(0.08, 0.42);
      const patchX = meadow.x + Math.cos(patchAngle) * patchCenterDistance;
      const patchZ = meadow.z + Math.sin(patchAngle) * patchCenterDistance;
      const spreadAngle = mapRandom() * Math.PI * 2;
      const spread = Math.sqrt(mapRandom()) * meadow.radius * 0.28;
      point = { x: patchX + Math.cos(spreadAngle) * spread, z: patchZ + Math.sin(spreadAngle) * spread, biome: meadow };
      densityBand = 'dense';
    } else if (densityRoll < 0.94) {
      point = sampleSceneryPosition(['grassland'], 0.98);
      densityBand = 'meadow';
    } else if (densityRoll < 0.985) {
      point = sampleSceneryPosition(['forest', 'mixed'], 0.92);
      densityBand = 'mixed';
    } else {
      point = sampleSceneryPosition(null, 0);
      densityBand = 'sparse';
    }
    const { x, z } = point;
    const y = terrainHeightAt(x, z);
    if (y < -9 || fortLayout.some((fort) => Math.hypot(x - fort.x, z - fort.z) < 46)) continue;
    const scale = densityBand === 'carpet'
      ? randomRange(0.5, 1.2)
      : densityBand === 'dense'
        ? randomRange(0.66, 1.55)
      : densityBand === 'meadow'
        ? randomRange(0.55, 1.78)
        : densityBand === 'mixed'
          ? randomRange(0.62, 1.38)
          : randomRange(0.42, 1.08);
    dummy.position.set(x, y + 0.02, z);
    dummy.rotation.set(0, randomRange(0, Math.PI), randomRange(-0.12, 0.12));
    dummy.scale.set(scale, scale * randomRange(0.75, 1.35), scale);
    dummy.updateMatrix();
    addToChunk(grassChunks, x, z, grassChunkSize, dummy.matrix);
    placed += 1;
  }
  sceneryMetrics.grass = placed;
  buildChunks(grassChunks, geometry, material, 'short');

  const tallGrassChunks = new Map();
  const reedBiomes = grasslandBiomes.filter((biome) => biome.variant === 'reedField');
  const jungleEdges = biomeLayout.filter((biome) => biome.variant === 'jungleEdge' || biome.variant === 'jungleCanopy');
  // Sık otlar tekdüze bir disk değil; üst üste binen kümeler görüş koridorları ve pusu cepleri oluşturur.
  const tallGrassPatches = Array.from({ length: 21 }, (_, index) => {
    const angle = index / 21 * Math.PI * 2 + 0.37;
    const distance = ultraDenseMeadow.radius * (0.055 + (index % 5) * 0.108);
    return {
      x: ultraDenseMeadow.x + Math.cos(angle) * distance,
      z: ultraDenseMeadow.z + Math.sin(angle) * distance * 0.82,
      radius: 42 + index % 5 * 9,
    };
  });
  let tallPlaced = 0;
  attempts = 0;
  while (tallPlaced < tallGrassCount && attempts < tallGrassCount * 4) {
    attempts += 1;
    const roll = mapRandom();
    let x;
    let z;
    let heightRange;
    if (roll < 0.62) {
      const patch = tallGrassPatches[Math.floor(mapRandom() * tallGrassPatches.length)];
      const angle = mapRandom() * Math.PI * 2;
      const distance = Math.sqrt(mapRandom()) * patch.radius;
      x = patch.x + Math.cos(angle) * distance;
      z = patch.z + Math.sin(angle) * distance;
      heightRange = [7.5, 9.6];
    } else if (roll < 0.95) {
      const angle = mapRandom() * Math.PI * 2;
      const distance = Math.sqrt(mapRandom()) * ultraDenseMeadow.radius * 0.9;
      x = ultraDenseMeadow.x + Math.cos(angle) * distance;
      z = ultraDenseMeadow.z + Math.sin(angle) * distance * 0.9;
      heightRange = [7.3, 9.2];
    } else {
      const edgeBiome = roll < 0.985 && reedBiomes.length
        ? reedBiomes[Math.floor(mapRandom() * reedBiomes.length)]
        : jungleEdges[Math.floor(mapRandom() * jungleEdges.length)];
      const angle = mapRandom() * Math.PI * 2;
      const distance = Math.sqrt(mapRandom()) * edgeBiome.radius * 0.72;
      x = edgeBiome.x + Math.cos(angle) * distance;
      z = edgeBiome.z + Math.sin(angle) * distance;
      heightRange = [6.8, 8.8];
    }
    const y = terrainHeightAt(x, z);
    if (y < -9 || fortLayout.some((fort) => Math.hypot(x - fort.x, z - fort.z) < 52)) continue;
    const widthScale = randomRange(0.72, 1.2);
    dummy.position.set(x, y + 0.015, z);
    dummy.rotation.set(randomRange(-0.035, 0.035), randomRange(0, Math.PI), randomRange(-0.08, 0.08));
    dummy.scale.set(widthScale, randomRange(...heightRange), widthScale);
    dummy.updateMatrix();
    addToChunk(tallGrassChunks, x, z, 60, dummy.matrix);
    tallPlaced += 1;
  }
  sceneryMetrics.tallGrass = tallPlaced;
  buildChunks(tallGrassChunks, tallGeometry, tallMaterial, 'tall');

  // Tek tek yapraklar uzakta piksel altına düştüğünde saklanma örtüsünü koruyan düzensiz dış silüet.
  const proxySegments = 20;
  const proxyPositions = [];
  const proxyIndices = [];
  for (let segment = 0; segment <= proxySegments; segment += 1) {
    const angle = segment / proxySegments * Math.PI * 2;
    const radius = 1 + Math.sin(segment * 2.37) * 0.075 + Math.cos(segment * 1.43) * 0.045;
    const top = 0.78 + Math.sin(segment * 3.11) * 0.13 + Math.cos(segment * 1.77) * 0.075;
    proxyPositions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    proxyPositions.push(Math.cos(angle) * radius * 0.96, top, Math.sin(angle) * radius * 0.96);
    if (segment < proxySegments) {
      const base = segment * 2;
      proxyIndices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const proxyGeometry = new THREE.BufferGeometry();
  proxyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(proxyPositions, 3));
  proxyGeometry.setIndex(proxyIndices);
  proxyGeometry.computeVertexNormals();
  proxyGeometry.computeBoundingSphere();
  const proxyBaseMaterial = activeTier === 'performance'
    ? new THREE.MeshBasicMaterial({ color: 0x376f38, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color: 0x3e783d, emissive: 0x071207, side: THREE.DoubleSide });
  proxyBaseMaterial.alphaHash = true;
  proxyBaseMaterial.depthWrite = true;
  for (let index = 0; index < tallGrassPatches.length; index += 1) {
    const patch = tallGrassPatches[index];
    const proxyMaterial = proxyBaseMaterial.clone();
    proxyMaterial.alphaHash = true;
    proxyMaterial.opacity = 0;
    const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
    const height = 6.35 + index % 5 * 0.24;
    proxy.position.set(patch.x, terrainHeightAt(patch.x, patch.z) + 0.015, patch.z);
    proxy.rotation.y = index * 0.61;
    proxy.scale.set(patch.radius * 0.96, height, patch.radius * 0.96);
    proxy.castShadow = false;
    proxy.receiveShadow = false;
    proxy.visible = false;
    proxy.updateMatrixWorld(true);
    scene.add(proxy);
    registerWorldLod(proxy, 'grassProxy');
  }
  sceneryMetrics.grassProxies = tallGrassPatches.length;
}

function createCoverAndScenery() {
  const treeTarget = activeTier === 'performance' ? 260 : activeTier === 'balanced' ? 450 : activeTier === 'high' ? 680 : 900;
  let treesCreated = 0;
  let attempts = 0;
  while (treesCreated < treeTarget && attempts < treeTarget * 7) {
    attempts += 1;
    const { x, z, biome } = sampleSceneryPosition(['forest', 'mixed'], 0.95);
    const y = terrainHeightAt(x, z);
    if (y < -7 || grassOnlyBiomeAt(x, z) || fortLayout.some((fort) => Math.hypot(x - fort.x, z - fort.z) < 62)) continue;
    const jungleTree = biome?.variant === 'jungleCanopy' || biome?.variant === 'jungleEdge';
    const trunkHeight = jungleTree ? randomRange(11, 17) : randomRange(8, 14);
    const broadTree = jungleTree || mapRandom() > 0.62;
    addMesh(new THREE.CylinderGeometry(0.7, 1.15, trunkHeight, 6), materials.wood, new THREE.Vector3(x, y + trunkHeight / 2, z), {
      blocker: { x: 2.2, y: trunkHeight, z: 2.2 },
    });
    if (broadTree) {
      const crownRadius = randomRange(jungleTree ? 6 : 4.8, jungleTree ? 8.6 : 7.8);
      addMesh(
        new THREE.DodecahedronGeometry(crownRadius, 0),
        materials.foliage,
        new THREE.Vector3(x, y + trunkHeight + 3.5, z),
        { scale: [1.15, 0.9, 1.15], paintable: false },
      );
      if (activeTier !== 'performance' || jungleTree) {
        addMesh(
          new THREE.DodecahedronGeometry(crownRadius * 0.68, 0),
          materials.foliage,
          new THREE.Vector3(x + randomRange(-2.4, 2.4), y + trunkHeight + 7, z + randomRange(-2.4, 2.4)),
          { scale: [1.2, 0.82, 1.12], paintable: false },
        );
      }
      if (jungleTree && activeTier !== 'performance') {
        addMesh(
          new THREE.DodecahedronGeometry(crownRadius * 0.58, 0),
          materials.foliage,
          new THREE.Vector3(x + randomRange(-4.5, 4.5), y + trunkHeight + 4.8, z + randomRange(-4.5, 4.5)),
          { scale: [1.32, 0.78, 1.2], paintable: false },
        );
      }
    } else {
      addMesh(
        new THREE.ConeGeometry(randomRange(4.4, 6.6), randomRange(12, 18), 7),
        materials.foliage,
        new THREE.Vector3(x, y + trunkHeight + 5.5, z),
        { paintable: false },
      );
    }
    treesCreated += 1;
  }
  sceneryMetrics.trees = treesCreated;

  const rockTarget = activeTier === 'performance' ? 220 : activeTier === 'balanced' ? 380 : activeTier === 'high' ? 560 : 760;
  let rocksCreated = 0;
  let rockAttempts = 0;
  while (rocksCreated < rockTarget && rockAttempts < rockTarget * 7) {
    const i = rockAttempts;
    rockAttempts += 1;
    const { x, z, biome } = sampleSceneryPosition(['rock', 'mixed'], 0.92);
    const y = terrainHeightAt(x, z);
    const radius = randomRange(1.5, biome?.variant === 'jungleBoulders' ? 6.8 : 5.5);
    if (y < -9 || grassOnlyBiomeAt(x, z) || fortLayout.some((fort) => Math.hypot(x - fort.x, z - fort.z) < 45)) continue;
    addMesh(
      new THREE.DodecahedronGeometry(radius, 0),
      materials.rock,
      new THREE.Vector3(x, y + radius * 0.45, z),
      {
        rotation: [randomRange(0, Math.PI), randomRange(0, Math.PI), randomRange(0, Math.PI)],
        scale: [1.25, randomRange(0.45, 0.9), 1],
        blocker: { x: radius * 1.6, y: radius * 1.25, z: radius * 1.6, kind: 'rock' },
      },
    );
    if (i % 3 === 0 && activeTier !== 'performance') {
      const satelliteRadius = radius * randomRange(0.28, 0.46);
      addMesh(
        new THREE.DodecahedronGeometry(satelliteRadius, 0),
        materials.rock,
        new THREE.Vector3(x + radius * randomRange(0.75, 1.1), y + satelliteRadius * 0.4, z + radius * randomRange(-0.7, 0.7)),
        {
          rotation: [randomRange(0, Math.PI), randomRange(0, Math.PI), randomRange(0, Math.PI)],
          scale: [1.3, 0.55, 1],
          blocker: { x: satelliteRadius * 2.6, y: satelliteRadius * 1.1, z: satelliteRadius * 2, kind: 'rock' },
        },
      );
    }
    rocksCreated += 1;
  }
  sceneryMetrics.rocks = rocksCreated;

  const bushTarget = activeTier === 'performance' ? 520 : activeTier === 'balanced' ? 880 : activeTier === 'high' ? 1320 : 1780;
  let bushesCreated = 0;
  let bushAttempts = 0;
  while (bushesCreated < bushTarget && bushAttempts < bushTarget * 7) {
    bushAttempts += 1;
    const { x, z, biome } = sampleSceneryPosition(['forest', 'mixed'], 0.96);
    const y = terrainHeightAt(x, z);
    if (y < -8 || grassOnlyBiomeAt(x, z) || fortLayout.some((fort) => Math.hypot(x - fort.x, z - fort.z) < 42)) continue;
    const jungleBush = biome?.variant === 'jungleCanopy' || biome?.variant === 'jungleEdge' || biome?.variant === 'elephantGrass';
    const bushRadius = randomRange(jungleBush ? 1.55 : 1.2, jungleBush ? 3.15 : 2.7);
    addMesh(
      new THREE.DodecahedronGeometry(bushRadius, 0),
      materials.foliage,
      new THREE.Vector3(x, y + 1.1, z),
      {
        scale: [jungleBush ? 1.82 : 1.6, jungleBush ? 0.92 : 0.75, jungleBush ? 1.55 : 1.35],
        paintable: false,
        blocker: { x: bushRadius * 2.2, y: bushRadius * 1.4, z: bushRadius * 1.9, kind: 'bush' },
      },
    );
    if (activeTier !== 'performance' && bushesCreated % 4 === 0) {
      const satelliteRadius = bushRadius * randomRange(0.48, 0.72);
      addMesh(
        new THREE.DodecahedronGeometry(satelliteRadius, 0),
        materials.foliage,
        new THREE.Vector3(x + randomRange(-3.8, 3.8), y + satelliteRadius * 0.62, z + randomRange(-3.8, 3.8)),
        {
          scale: [1.5, 0.68, 1.35],
          paintable: false,
          blocker: { x: satelliteRadius * 3, y: satelliteRadius * 1.36, z: satelliteRadius * 2.7, kind: 'bush' },
        },
      );
    }
    bushesCreated += 1;
  }
  sceneryMetrics.bushes = bushesCreated;
  createGrassField();
}

function createViewModel() {
  const group = new THREE.Group();
  const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, depthTest: false });
  const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x242927, roughness: 0.55, metalness: 0.35, depthTest: false });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x5b3824, roughness: 0.9, depthTest: false });
  const nozzleMaterial = new THREE.MeshStandardMaterial({ color: 0xc7b99c, roughness: 0.8, depthTest: false });

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 5, 8), sleeveMaterial);
  leftArm.rotation.z = -0.5;
  leftArm.rotation.x = -1.2;
  leftArm.position.set(-0.44, -0.5, -1.48);
  leftArm.scale.setScalar(0.68);
  leftArm.renderOrder = 10;
  leftArm.visible = false;

  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.44, 5, 8), sleeveMaterial);
  rightArm.rotation.z = 0.5;
  rightArm.rotation.x = -1.2;
  rightArm.position.set(0.44, -0.5, -1.48);
  rightArm.scale.setScalar(0.68);
  rightArm.renderOrder = 10;
  rightArm.visible = false;

  const rifle = new THREE.Group();
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.2, 0.72), woodMaterial);
  stock.position.set(0.22, -0.27, -0.76);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.52), gunMaterial);
  receiver.position.set(0.22, -0.2, -1.32);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.28, 8), gunMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.22, -0.18, -2.05);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.52, 10), gunMaterial);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0.22, -0.05, -1.33);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.22, -0.18, -2.72);
  rifle.add(stock, receiver, barrel, scope, muzzle);
  rifle.scale.setScalar(0.38);
  rifle.position.set(0.08, -0.12, -0.82);
  rifle.traverse((child) => { if (child.isMesh) child.renderOrder = 12; });

  const nozzle = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.82, 9), nozzleMaterial);
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0.23, -0.29, -1.16);
  const nozzleTip = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.035, 6, 10), gunMaterial);
  nozzleTip.position.set(0.23, -0.29, -1.58);
  nozzle.add(tube, nozzleTip);
  nozzle.scale.setScalar(0.46);
  nozzle.position.set(0.08, -0.1, -0.52);
  nozzle.traverse((child) => { if (child.isMesh) child.renderOrder = 12; });

  const sword = new THREE.Group();
  const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xe9eef0, roughness: 0.16, metalness: 0.92, depthTest: false });
  const fullerMaterial = new THREE.MeshStandardMaterial({ color: 0x778187, roughness: 0.25, metalness: 0.88, depthTest: false });
  const brassMaterial = new THREE.MeshStandardMaterial({ color: 0xa7792d, roughness: 0.3, metalness: 0.78, depthTest: false });
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.075, 0);
  bladeShape.lineTo(-0.095, 1.18);
  bladeShape.lineTo(-0.055, 1.36);
  bladeShape.lineTo(0, 1.58);
  bladeShape.lineTo(0.055, 1.36);
  bladeShape.lineTo(0.095, 1.18);
  bladeShape.lineTo(0.075, 0);
  bladeShape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.038, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
  bladeGeometry.center();
  bladeGeometry.translate(0, 0.79, 0);
  const swordBlade = new THREE.Mesh(bladeGeometry, bladeMaterial);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.026, 1.03, 0.018), fullerMaterial);
  fuller.position.set(0, 0.7, -0.032);
  const swordGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.58, 10), brassMaterial);
  swordGuard.rotation.z = Math.PI / 2;
  const swordGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.42, 10), woodMaterial);
  swordGrip.position.y = -0.24;
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brassMaterial);
  pommel.position.y = -0.49;
  const rainGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.09, 10), brassMaterial);
  rainGuard.position.y = -0.02;
  sword.add(swordBlade, fuller, swordGuard, swordGrip, pommel, rainGuard);
  for (let ring = 0; ring < 5; ring += 1) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.008, 5, 10), brassMaterial);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = -0.08 - ring * 0.075;
    sword.add(wrap);
  }
  sword.position.set(0.47, -0.38, -1.02);
  sword.rotation.set(0.03, -0.04, -0.08);
  sword.scale.setScalar(0.72);
  sword.traverse((child) => { if (child.isMesh) child.renderOrder = 12; });

  const ammoMaterial = new THREE.MeshStandardMaterial({ color: WASTE_STYLE.red.pee, roughness: 0.82, depthTest: false });
  const ammoPreview = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 1), ammoMaterial);
  ammoPreview.position.set(0.28, -0.3, -0.82);
  ammoPreview.scale.set(1.15, 0.82, 1.15);
  ammoPreview.renderOrder = 12;

  const shield = createShieldModel('red', true);
  shield.position.set(-0.72, -0.52, -1.12);
  shield.rotation.set(-0.06, 0.48, -0.08);
  shield.scale.setScalar(0.54);

  group.add(rifle, sword, ammoPreview, shield);
  group.userData = { leftArm, rightArm, rifle, nozzle, sword, ammoPreview, ammoMaterial, muzzle, sleeveMaterial, shield };
  camera.add(group);
  scene.add(camera);
  return group;
}

const viewModel = createViewModel();

function createStylizedAnatomy(material) {
  const anatomy = new THREE.Group();
  const penis = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.16, 3, 6), material);
  penis.position.set(0, 0.74, 0.25);
  penis.rotation.x = Math.PI / 2;
  const leftButtock = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), material);
  leftButtock.position.set(-0.13, 0.76, -0.17);
  leftButtock.scale.set(0.9, 1.05, 0.72);
  const rightButtock = leftButtock.clone();
  rightButtock.position.x = 0.13;
  anatomy.add(penis, leftButtock, rightButtock);
  anatomy.traverse((child) => { if (child.isMesh) child.castShadow = true; });
  anatomy.userData = { penis, leftButtock, rightButtock };
  return anatomy;
}

function createPlayerAvatar() {
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);
  const uniform = new THREE.MeshStandardMaterial({ color: TEAM.red.color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd7aa7c, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x201915, roughness: 1 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.95 });
  const addPart = (geometry, material, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    bodyRoot.add(mesh);
    return mesh;
  };
  const torso = addPart(new THREE.CapsuleGeometry(0.25, 0.52, 4, 7), uniform, [0, 1.08, 0]);
  const head = addPart(new THREE.SphereGeometry(0.22, 10, 8), skin, [0, 1.78, 0]);
  const leftLeg = addPart(new THREE.CapsuleGeometry(0.105, 0.48, 4, 6), uniform, [-0.15, 0.38, 0]);
  const rightLeg = addPart(new THREE.CapsuleGeometry(0.105, 0.48, 4, 6), uniform, [0.15, 0.38, 0]);
  const leftArm = addPart(new THREE.CapsuleGeometry(0.08, 0.5, 4, 6), uniform, [-0.34, 1.12, 0]);
  const rightArm = addPart(new THREE.CapsuleGeometry(0.08, 0.5, 4, 6), uniform, [0.34, 1.12, 0]);
  const addFacePart = (geometry, position, material = dark) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    head.add(mesh);
    return mesh;
  };
  addFacePart(new THREE.SphereGeometry(0.052, 8, 6), [-0.075, 0.045, 0.198], eyeWhite);
  addFacePart(new THREE.SphereGeometry(0.052, 8, 6), [0.075, 0.045, 0.198], eyeWhite);
  addFacePart(new THREE.SphereGeometry(0.026, 7, 5), [-0.075, 0.045, 0.238]);
  addFacePart(new THREE.SphereGeometry(0.026, 7, 5), [0.075, 0.045, 0.238]);
  const mouth = addFacePart(new THREE.BoxGeometry(0.145, 0.03, 0.03), [0, -0.085, 0.224]);

  const anatomy = createStylizedAnatomy(skin);
  bodyRoot.add(anatomy);
  const equipment = createCharacterEquipment('red');
  bodyRoot.add(equipment);
  group.userData = { uniform, bodyRoot, equipment, torso, head, mouth, leftLeg, rightLeg, leftArm, rightArm, anatomy };
  group.visible = false;
  scene.add(group);
  return group;
}

const playerAvatar = createPlayerAvatar();

function animateHumanoid(rig, options, delta) {
  const blend = 1 - Math.exp(-delta * 15);
  const stance = options.stance || 'stand';
  const prone = stance === 'prone';
  const crouched = stance === 'crouch' || options.actionKind === 'poop';
  const moveWeight = options.moving ? THREE.MathUtils.clamp(options.moveAmount ?? 1, 0.25, 1) : 0;
  const sprintWeight = options.sprinting && !crouched && !prone ? moveWeight : 0;
  const stride = Math.sin(options.phase) * moveWeight;
  const strideOpposite = Math.cos(options.phase) * moveWeight;
  const breathing = Math.sin(clock.elapsedTime * 1.85 + rig.torso.id * 0.07) * 0.009;
  const footfall = Math.abs(Math.sin(options.phase * 2)) * moveWeight;
  const actionDuration = Math.max(0.01, options.actionDuration || 0.34);
  const action = options.actionTime > 0 ? Math.sin((1 - options.actionTime / actionDuration) * Math.PI) : 0;
  const jump = options.jumping ? 1 : 0;
  const setPosition = (part, x, y, z) => {
    part.position.x = THREE.MathUtils.lerp(part.position.x, x, blend);
    part.position.y = THREE.MathUtils.lerp(part.position.y, y, blend);
    part.position.z = THREE.MathUtils.lerp(part.position.z, z, blend);
  };
  const setRotation = (part, x, y = 0, z = 0) => {
    part.rotation.x = THREE.MathUtils.lerp(part.rotation.x, x, blend);
    part.rotation.y = THREE.MathUtils.lerp(part.rotation.y, y, blend);
    part.rotation.z = THREE.MathUtils.lerp(part.rotation.z, z, blend);
  };

  let torsoY = (crouched ? 0.78 : 1.08) + breathing + footfall * (sprintWeight ? 0.025 : 0.014);
  let headY = (crouched ? 1.38 : 1.78) + breathing * 0.55 - footfall * 0.008;
  let legY = crouched ? 0.28 : 0.38;
  let torsoZ = crouched ? 0.1 : 0;
  let headZ = crouched ? 0.12 : 0;
  let torsoPitch = (crouched ? 0.14 : 0) + sprintWeight * 0.16;
  let torsoRoll = -stride * (sprintWeight ? 0.045 : 0.025);
  let headRoll = stride * (sprintWeight ? 0.032 : 0.016);
  if (options.actionKind === 'vomit') {
    torsoPitch += action * 0.52;
    headZ += action * 0.16;
  }
  if (options.actionKind === 'shot') torsoPitch -= action * 0.045;
  if (options.actionKind === 'sword') torsoRoll -= action * 0.18;

  if (prone) {
    const crawlLift = Math.max(0, strideOpposite) * 0.035;
    setPosition(rig.torso, 0, 0.39 + breathing, 0.12 + footfall * 0.018);
    setPosition(rig.head, 0, 0.44 + breathing, 0.76);
    setPosition(rig.leftLeg, -0.15, 0.3 + crawlLift, -0.47);
    setPosition(rig.rightLeg, 0.15, 0.3 + Math.max(0, -strideOpposite) * 0.035, -0.47);
    setPosition(rig.leftArm, -0.31, 0.37, 0.48 + stride * 0.07);
    setPosition(rig.rightArm, 0.31, 0.37, 0.48 - stride * 0.07);
    setRotation(rig.torso, Math.PI / 2, 0, -stride * 0.018);
    setRotation(rig.head, -0.1 + action * 0.24, 0, headRoll);
    setRotation(rig.leftLeg, Math.PI / 2 + stride * 0.19, 0, -0.05);
    setRotation(rig.rightLeg, Math.PI / 2 - stride * 0.19, 0, 0.05);
    setRotation(rig.leftArm, Math.PI / 2 + 0.08 - stride * 0.16, 0, -0.09);
    setRotation(rig.rightArm, Math.PI / 2 + 0.08 + stride * 0.16 - action * 0.22, 0, 0.09);
  } else {
    const legSwing = jump ? -0.72 : stride * (crouched ? 0.28 : sprintWeight ? 0.72 : 0.52);
    const rifleHold = options.weapon === 'rifle' ? (options.aiming ? 1.34 : 1.05) : 0;
    const swordHold = options.weapon === 'sword' ? 0.72 + action * 1.15 : 0;
    setPosition(rig.torso, 0, torsoY, torsoZ);
    setPosition(rig.head, 0, headY, headZ);
    setPosition(rig.leftLeg, -0.15, legY + jump * 0.08, crouched ? -0.08 : 0);
    setPosition(rig.rightLeg, 0.15, legY + jump * 0.08, crouched ? 0.08 : 0);
    setPosition(rig.leftArm, -0.34, crouched ? 0.92 : 1.12, 0.05);
    setPosition(rig.rightArm, 0.34, crouched ? 0.92 : 1.12, 0.05);
    setRotation(rig.torso, torsoPitch, stride * 0.025, torsoRoll);
    setRotation(rig.head, options.actionKind === 'vomit' ? action * 0.62 : (options.aiming ? -0.08 : -sprintWeight * 0.04), -stride * 0.018, headRoll);
    setRotation(rig.leftLeg, legSwing + (crouched ? 0.68 : 0), 0, -0.02);
    setRotation(rig.rightLeg, -legSwing + (crouched ? 0.68 : 0), 0, 0.02);
    const relaxedArmSwing = (sprintWeight ? 0.58 : 0.38) * stride;
    const wastePose = options.actionKind === 'pee' ? 0.22 * action : options.actionKind === 'vomit' ? 0.48 * action : 0;
    const shieldHold = options.shieldActive ? 1.22 : 0;
    setRotation(rig.leftArm, shieldHold || rifleHold || swordHold ? Math.max(shieldHold, rifleHold + 0.1) : -relaxedArmSwing + wastePose, 0, -0.08 - action * 0.03);
    setRotation(rig.rightArm, rifleHold || swordHold ? Math.max(rifleHold, swordHold) - action * 0.22 : relaxedArmSwing + wastePose, 0, 0.08 + action * 0.03);
  }

  const wasteAction = ['pee', 'vomit', 'poop'].includes(options.actionKind) && options.actionTime > 0;
  rig.equipment.userData.rifle.visible = options.weapon === 'rifle' && !wasteAction;
  rig.equipment.userData.sword.visible = options.weapon === 'sword' && !wasteAction;
  const shield = rig.equipment.userData.shield;
  shield.visible = Boolean(options.showShield);
  const shieldRaised = options.shieldActive ? 1 : 0;
  shield.position.x = THREE.MathUtils.lerp(shield.position.x, shieldRaised ? -0.29 : -0.58, blend);
  shield.position.y = THREE.MathUtils.lerp(shield.position.y, shieldRaised ? 1.32 : 0.68, blend);
  shield.position.z = THREE.MathUtils.lerp(shield.position.z, shieldRaised ? 0.48 : -0.08, blend);
  shield.rotation.x = THREE.MathUtils.lerp(shield.rotation.x, shieldRaised ? 0.02 : -0.5, blend);
  shield.rotation.y = THREE.MathUtils.lerp(shield.rotation.y, shieldRaised ? 0.06 : 1.05, blend);
  shield.rotation.z = THREE.MathUtils.lerp(shield.rotation.z, shieldRaised ? 0.04 : -0.28, blend);
  rig.equipment.position.y = THREE.MathUtils.lerp(rig.equipment.position.y, prone ? -0.73 : crouched ? -0.24 : 0, blend);
  rig.equipment.position.z = THREE.MathUtils.lerp(rig.equipment.position.z, prone ? 0.22 : 0, blend);
  rig.equipment.rotation.x = THREE.MathUtils.lerp(rig.equipment.rotation.x, prone ? Math.PI / 2 : 0, blend);
  rig.equipment.rotation.z = THREE.MathUtils.lerp(rig.equipment.rotation.z, options.actionKind === 'shot' ? -action * 0.035 : 0, blend);
  rig.equipment.userData.rifle.position.z = 0.38 - action * (options.actionKind === 'shot' ? 0.16 : 0);
    rig.equipment.userData.sword.rotation.z = -0.12 + action * 1.3;
  rig.anatomy.position.y = THREE.MathUtils.lerp(rig.anatomy.position.y, prone ? -0.43 : crouched ? -0.26 : 0, blend);
  rig.anatomy.position.z = THREE.MathUtils.lerp(rig.anatomy.position.z, prone ? -0.12 : 0, blend);
  rig.anatomy.rotation.x = THREE.MathUtils.lerp(rig.anatomy.rotation.x, prone ? Math.PI / 2 : 0, blend);
}

function updatePlayerAvatar(delta) {
  playerAvatar.visible = state.started && state.thirdPerson;
  if (!playerAvatar.visible) return;
  playerAvatar.position.set(playerPosition.x, state.feetY, playerPosition.z);
  playerAvatar.rotation.y = state.yaw + Math.PI;
  const parts = playerAvatar.userData;
  animateHumanoid(parts, {
    stance: state.stance,
    moving: state.moveAmount > 0,
    moveAmount: state.moveAmount,
    sprinting: state.sprinting,
    phase: state.stepPhase,
    jumping: !state.canJump,
    aiming: state.aiming,
    actionKind: state.actionKind,
    actionTime: state.actionTime,
    actionDuration: state.actionDuration,
    weapon: state.mode === 0 ? (state.weapon === 0 ? 'rifle' : 'sword') : 'none',
    showShield: true,
    shieldActive: state.shieldActive,
  }, delta);
  if (state.dead) playerAvatar.rotation.z = THREE.MathUtils.lerp(playerAvatar.rotation.z, Math.PI / 2, Math.min(1, delta * 5));
  else playerAvatar.rotation.z = THREE.MathUtils.lerp(playerAvatar.rotation.z, 0, Math.min(1, delta * 8));
  playerAvatar.updateMatrixWorld(true);
}

function getEmissionStart(kind) {
  if (!state.thirdPerson) {
    const offsets = {
      pee: new THREE.Vector3(0, -0.76, -0.34),
      vomit: new THREE.Vector3(0, -0.18, -0.42),
      poop: new THREE.Vector3(0, -0.72, 0.08),
    };
    return camera.position.clone().add(offsets[kind].applyQuaternion(camera.quaternion));
  }
  const localPoints = {
    pee: new THREE.Vector3(0, 0.76, 0.3),
    vomit: new THREE.Vector3(0, 1.7, 0.25),
    poop: new THREE.Vector3(0, 0.77, -0.31),
  };
  playerAvatar.updateMatrixWorld(true);
  return playerAvatar.localToWorld(localPoints[kind]);
}

function updateViewModel(delta) {
  const stride = Math.sin(state.stepPhase);
  const bobTarget = state.moveAmount > 0 && state.locked
    ? Math.abs(Math.sin(state.stepPhase * 2)) * (state.sprinting ? 0.042 : 0.025)
    : 0;
  const stanceOffset = state.stance === 'crouch' ? -0.12 : state.stance === 'prone' ? -0.3 : 0;
  viewModel.position.y = THREE.MathUtils.lerp(viewModel.position.y, bobTarget + stanceOffset, Math.min(1, delta * 14));
  viewModel.position.x = THREE.MathUtils.lerp(
    viewModel.position.x,
    state.moveAmount > 0 ? stride * (state.sprinting ? 0.022 : 0.012) : 0,
    Math.min(1, delta * 12),
  );
  state.actionTime = Math.max(0, state.actionTime - delta);
  state.shieldHitTime = Math.max(0, state.shieldHitTime - delta);
  const actionProgress = state.actionTime > 0 ? Math.sin((1 - state.actionTime / Math.max(0.01, state.actionDuration)) * Math.PI) : 0;

  viewModel.userData.rifle.visible = state.mode === 0 && state.weapon === 0 && !state.aiming && !state.thirdPerson;
  viewModel.userData.nozzle.visible = false;
  viewModel.userData.sword.visible = state.mode === 0 && state.weapon === 1 && !state.thirdPerson;
  viewModel.userData.ammoPreview.visible = state.mode === 1 && !state.thirdPerson;
  viewModel.userData.rifle.position.z = actionProgress * 0.13;
  viewModel.userData.sword.position.set(
    0.47 - actionProgress * 0.34,
    -0.38 + actionProgress * 0.16,
    -1.02 - actionProgress * 0.3,
  );
  viewModel.userData.sword.rotation.x = 0.03 - actionProgress * 0.18;
  viewModel.userData.sword.rotation.z = -0.08 + actionProgress * 1.25;
  viewModel.userData.ammoPreview.rotation.y += delta * 2.2;
  viewModel.userData.ammoMaterial.color.setHex(WASTE_STYLE[state.team || 'red'][WASTE_TYPES[state.wasteIndex]]);
  const shield = viewModel.userData.shield;
  const shieldBlend = 1 - Math.exp(-delta * 18);
  const shieldRecoil = state.shieldHitTime > 0 ? Math.sin(state.shieldHitTime * 70) * 0.025 : 0;
  shield.position.x = THREE.MathUtils.lerp(shield.position.x, state.shieldActive ? -0.47 : -0.72, shieldBlend);
  shield.position.y = THREE.MathUtils.lerp(shield.position.y, state.shieldActive ? -0.2 : -0.52, shieldBlend);
  shield.position.z = THREE.MathUtils.lerp(shield.position.z, (state.shieldActive ? -1.02 : -1.12) + shieldRecoil, shieldBlend);
  shield.rotation.x = THREE.MathUtils.lerp(shield.rotation.x, state.shieldActive ? 0 : -0.06, shieldBlend);
  shield.rotation.y = THREE.MathUtils.lerp(shield.rotation.y, state.shieldActive ? 0.08 : 0.48, shieldBlend);
  shield.rotation.z = THREE.MathUtils.lerp(shield.rotation.z, state.shieldActive ? 0 : -0.08, shieldBlend);
  shield.scale.setScalar(THREE.MathUtils.lerp(shield.scale.x, state.shieldActive ? 0.64 : 0.54, shieldBlend));
  shield.visible = !state.thirdPerson;
  shieldStatus.classList.toggle('active', state.shieldActive);
  shieldStatus.classList.toggle('hit', state.shieldHitTime > 0);
  shieldStateLabel.textContent = state.shieldActive ? t('shield.raised') : t('shield.lowered');
  viewModel.visible = !state.dead && !state.thirdPerson;

  const targetFov = state.aiming ? THREE.MathUtils.clamp(74 / state.scopeZoom, 7.4, 31) : 74;
  if (scopeZoomLabel) scopeZoomLabel.textContent = `${state.scopeZoom.toFixed(1)}×`;
  const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, delta * 9));
  if (Math.abs(nextFov - camera.fov) > 0.01) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
}

function createWorld() {
  createGround();
  for (const fort of fortLayout) createFort(fort.x, fort.z, fort.team, fort.index);
  createCoverAndScenery();
  mergeStaticWorld();
  buildBlockerGrid();
}

function paintFortGround(fort, team) {
  const stamps = [[0, 0, 18], [-14, -14, 17], [14, -14, 17], [-14, 14, 17], [14, 14, 17]];
  for (const [offsetX, offsetZ, radius] of stamps) {
    placeWastePaint(new THREE.Vector3(fort.x + offsetX, fort.y, fort.z + offsetZ), radius, 'team', team, false);
  }
}

function seedFortPaint() {
  for (const fort of fortData) paintFortGround(fort, fort.team);
  terrainPaintTexture.needsUpdate = true;
}

function buildMapBase() {
  const width = mapBaseCanvas.width;
  const image = mapBaseContext.createImageData(width, width);
  for (let py = 0; py < width; py += 1) {
    const z = -WORLD.halfDepth + (py / (width - 1)) * WORLD.halfDepth * 2;
    for (let px = 0; px < width; px += 1) {
      const x = -WORLD.halfWidth + (px / (width - 1)) * WORLD.halfWidth * 2;
      const height = terrainHeightAt(x, z);
      const index = (py * width + px) * 4;
      const contour = (Math.sin(x * 0.043) + Math.cos(z * 0.039)) * 4;
      const shade = THREE.MathUtils.clamp(91 + height * 1.25 + contour, 48, 128);
      if (height < -19.5) {
        image.data[index] = 36;
        image.data[index + 1] = 88;
        image.data[index + 2] = 116;
      } else {
        const biomeColor = blendBiomeGroundColor(x, z, shade * 0.74, shade, shade * 0.54);
        image.data[index] = biomeColor[0];
        image.data[index + 1] = biomeColor[1];
        image.data[index + 2] = biomeColor[2];
      }
      image.data[index + 3] = 255;
    }
  }
  mapBaseContext.putImageData(image, 0, 0);
  mapSeedLabel.textContent = t('map.fixed');
  bigMapSeed.textContent = t('map.fixedLong');
}

function writeTerritoryPixel(x, y, teamId) {
  const pixel = (y * TERRITORY_SIZE + x) * 4;
  territoryImage.data[pixel] = teamId === 1 ? 255 : teamId === 2 ? 40 : 0;
  territoryImage.data[pixel + 1] = teamId === 1 ? 49 : teamId === 2 ? 184 : 0;
  territoryImage.data[pixel + 2] = teamId === 1 ? 94 : teamId === 2 ? 255 : 0;
  territoryImage.data[pixel + 3] = teamId === 1 || teamId === 2 ? 218 : 0;
  territoryDirtyMinX = Math.min(territoryDirtyMinX, x);
  territoryDirtyMinY = Math.min(territoryDirtyMinY, y);
  territoryDirtyMaxX = Math.max(territoryDirtyMaxX, x);
  territoryDirtyMaxY = Math.max(territoryDirtyMaxY, y);
  territoryDirty = true;
}

function refreshTerritoryTexture() {
  if (!territoryDirty || territoryDirtyMaxX < territoryDirtyMinX || territoryDirtyMaxY < territoryDirtyMinY) return;
  territoryContext.putImageData(
    territoryImage,
    0,
    0,
    territoryDirtyMinX,
    territoryDirtyMinY,
    territoryDirtyMaxX - territoryDirtyMinX + 1,
    territoryDirtyMaxY - territoryDirtyMinY + 1,
  );
  territoryDirty = false;
  territoryDirtyMinX = TERRITORY_SIZE;
  territoryDirtyMinY = TERRITORY_SIZE;
  territoryDirtyMaxX = -1;
  territoryDirtyMaxY = -1;
}

function mapCoordinates(x, z, width, height, bounds = null) {
  const area = bounds || { minX: -WORLD.halfWidth, minZ: -WORLD.halfDepth, spanX: WORLD.halfWidth * 2, spanZ: WORLD.halfDepth * 2 };
  return {
    x: (x - area.minX) / area.spanX * width,
    y: (z - area.minZ) / area.spanZ * height,
  };
}

const MAP_UNIT_MARKERS = Object.freeze({
  red: Object.freeze({ fill: '#ff003c', halo: '#fff4f7', outline: '#240009' }),
  blue: Object.freeze({ fill: '#00eaff', halo: '#f2feff', outline: '#001a22' }),
});
const mapUnitPointBuffer = [];

function drawMap(context, canvas, circular = false) {
  const { width, height } = canvas;
  context.save();
  context.clearRect(0, 0, width, height);
  if (circular) {
    context.beginPath();
    context.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    context.clip();
  }
  const localSpan = 270;
  const bounds = circular && state.started
    ? {
        minX: THREE.MathUtils.clamp(playerPosition.x - localSpan / 2, -WORLD.halfWidth, WORLD.halfWidth - localSpan),
        minZ: THREE.MathUtils.clamp(playerPosition.z - localSpan / 2, -WORLD.halfDepth, WORLD.halfDepth - localSpan),
        spanX: localSpan,
        spanZ: localSpan,
      }
    : { minX: -WORLD.halfWidth, minZ: -WORLD.halfDepth, spanX: WORLD.halfWidth * 2, spanZ: WORLD.halfDepth * 2 };
  const sourceX = (bounds.minX + WORLD.halfWidth) / (WORLD.halfWidth * 2) * mapBaseCanvas.width;
  const sourceY = (bounds.minZ + WORLD.halfDepth) / (WORLD.halfDepth * 2) * mapBaseCanvas.height;
  const sourceWidth = bounds.spanX / (WORLD.halfWidth * 2) * mapBaseCanvas.width;
  const sourceHeight = bounds.spanZ / (WORLD.halfDepth * 2) * mapBaseCanvas.height;
  context.imageSmoothingEnabled = true;
  context.drawImage(mapBaseCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  context.imageSmoothingEnabled = false;
  context.globalAlpha = 0.73;
  context.drawImage(
    territoryCanvas,
    sourceX / mapBaseCanvas.width * TERRITORY_SIZE,
    sourceY / mapBaseCanvas.height * TERRITORY_SIZE,
    sourceWidth / mapBaseCanvas.width * TERRITORY_SIZE,
    sourceHeight / mapBaseCanvas.height * TERRITORY_SIZE,
    0, 0, width, height,
  );
  context.globalAlpha = 1;

  for (const fort of fortData) {
    const point = mapCoordinates(fort.x, fort.z, width, height, bounds);
    if (point.x < -12 || point.x > width + 12 || point.y < -12 || point.y > height + 12) continue;
    const size = circular ? 4.5 : 10;
    context.fillStyle = fort.team === 'red' ? '#ff315e' : '#28b8ff';
    context.strokeStyle = 'rgba(10,10,10,.9)';
    context.lineWidth = circular ? 1.5 : 3;
    context.fillRect(point.x - size, point.y - size, size * 2, size * 2);
    context.strokeRect(point.x - size, point.y - size, size * 2, size * 2);
    context.beginPath();
    context.moveTo(point.x - size, point.y - size);
    context.lineTo(point.x, point.y - size * 1.7);
    context.lineTo(point.x + size, point.y - size);
    context.stroke();
  }

  const crouchedVisible = Math.floor(performance.now() / 3000) % 2 === 0;
  for (const bot of bots) {
    if (bot.dead || bot.stance === 'prone' || (bot.stance === 'crouch' && !crouchedVisible)) continue;
    const point = mapCoordinates(bot.group.position.x, bot.group.position.z, width, height, bounds);
    if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue;
    const marker = MAP_UNIT_MARKERS[bot.team];
    const markerHalf = circular ? 2.7 : 4.8;
    const haloPadding = circular ? 1.1 : 1.7;
    const outlinePadding = circular ? 1.8 : 2.7;
    context.fillStyle = marker.outline;
    context.fillRect(point.x - markerHalf - outlinePadding, point.y - markerHalf - outlinePadding, (markerHalf + outlinePadding) * 2, (markerHalf + outlinePadding) * 2);
    context.fillStyle = marker.halo;
    context.fillRect(point.x - markerHalf - haloPadding, point.y - markerHalf - haloPadding, (markerHalf + haloPadding) * 2, (markerHalf + haloPadding) * 2);
    context.fillStyle = marker.fill;
    context.fillRect(point.x - markerHalf, point.y - markerHalf, markerHalf * 2, markerHalf * 2);
  }

  // 494 hafif asker + 6 ayrıntılı asker = takım başına 250 NPC.
  for (const team of ['red', 'blue']) {
    const marker = MAP_UNIT_MARKERS[team];
    const radius = circular ? 1.35 : 2.25;
    const haloRadius = circular ? 2.15 : 3.4;
    const size = radius * 2;
    const haloSize = haloRadius * 2;
    mapUnitPointBuffer.length = 0;
    massArmy?.forEachMapAgent((x, z, agentTeam, _index, stance) => {
      if (agentTeam !== team || stance === 'prone' || (stance === 'crouch' && !crouchedVisible)) return;
      const pointX = (x - bounds.minX) / bounds.spanX * width;
      const pointY = (z - bounds.minZ) / bounds.spanZ * height;
      if (pointX < 0 || pointX > width || pointY < 0 || pointY > height) return;
      mapUnitPointBuffer.push(pointX, pointY);
    });
    context.fillStyle = marker.outline;
    for (let index = 0; index < mapUnitPointBuffer.length; index += 2) {
      context.fillRect(mapUnitPointBuffer[index] - haloRadius - 0.6, mapUnitPointBuffer[index + 1] - haloRadius - 0.6, haloSize + 1.2, haloSize + 1.2);
    }
    context.fillStyle = marker.halo;
    for (let index = 0; index < mapUnitPointBuffer.length; index += 2) {
      context.fillRect(mapUnitPointBuffer[index] - haloRadius, mapUnitPointBuffer[index + 1] - haloRadius, haloSize, haloSize);
    }
    context.fillStyle = marker.fill;
    for (let index = 0; index < mapUnitPointBuffer.length; index += 2) {
      context.fillRect(mapUnitPointBuffer[index] - radius, mapUnitPointBuffer[index + 1] - radius, size, size);
    }
  }

  if (state.spawnSelecting && state.spawnHoverPoint) {
    const point = mapCoordinates(state.spawnHoverPoint.x, state.spawnHoverPoint.z, width, height, bounds);
    const radius = SPAWN_SAFE_RADIUS / bounds.spanX * width;
    const teamColor = state.team === 'red' ? '#ff315e' : '#28b8ff';
    context.save();
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = state.spawnHoverValid ? `${teamColor}55` : 'rgba(255,82,60,.28)';
    context.strokeStyle = state.spawnHoverValid ? '#ffffff' : '#ff543c';
    context.lineWidth = 4;
    context.setLineDash(state.spawnHoverValid ? [] : [9, 6]);
    context.fill();
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.moveTo(point.x - 9, point.y);
    context.lineTo(point.x + 9, point.y);
    context.moveTo(point.x, point.y - 9);
    context.lineTo(point.x, point.y + 9);
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.stroke();
    const friendlyCount = state.spawnHoverCounts[state.team] || 0;
    const enemyCount = state.spawnHoverCounts[state.team === 'red' ? 'blue' : 'red'] || 0;
    context.font = '900 12px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillStyle = '#ffffff';
    context.shadowColor = '#000000';
    context.shadowBlur = 5;
    context.fillText(`${friendlyCount} ${currentLanguage === 'tr' ? 'DOST' : 'ALLY'} · ${enemyCount} ${currentLanguage === 'tr' ? 'DÜŞMAN' : 'ENEMY'}`, point.x, point.y - radius - 7);
    context.restore();
  }

  if (state.started && !state.spawnSelecting) {
    const player = mapCoordinates(playerPosition.x, playerPosition.z, width, height, bounds);
    const arrowSize = circular ? 7 : 16;
    const forwardX = -Math.sin(state.yaw);
    const forwardY = -Math.cos(state.yaw);
    const sideX = -forwardY;
    const sideY = forwardX;
    context.beginPath();
    context.moveTo(player.x + forwardX * arrowSize, player.y + forwardY * arrowSize);
    context.lineTo(player.x - forwardX * arrowSize * 0.65 + sideX * arrowSize * 0.52, player.y - forwardY * arrowSize * 0.65 + sideY * arrowSize * 0.52);
    context.lineTo(player.x - forwardX * arrowSize * 0.65 - sideX * arrowSize * 0.52, player.y - forwardY * arrowSize * 0.65 - sideY * arrowSize * 0.52);
    context.closePath();
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#11110f';
    context.lineWidth = circular ? 2 : 4;
    context.fill();
    context.stroke();
  }
  context.restore();
}

function setLeaderboardCollapsed(collapsed, announce = true) {
  state.leaderboardCollapsed = Boolean(collapsed);
  battleScorePanel.classList.toggle('collapsed', state.leaderboardCollapsed);
  battleScorePanel.setAttribute('aria-expanded', String(!state.leaderboardCollapsed));
  leaderboardTitle.textContent = t(state.leaderboardCollapsed ? 'hud.myStats' : 'hud.leaderboard');
  leaderboardTitle.dataset.toggleLabel = t(state.leaderboardCollapsed ? 'hud.expand' : 'hud.collapse');
  if (announce) showToast(state.leaderboardCollapsed
    ? localized('LİDER TABLOSU DARALTILDI · K İLE AÇ', 'LEADERBOARD COLLAPSED · PRESS K TO EXPAND')
    : localized('LİDER TABLOSU AÇILDI · K İLE DARALT', 'LEADERBOARD EXPANDED · PRESS K TO COLLAPSE'));
}

function updateMaps() {
  refreshTerritoryTexture();
  const total = paintableTerritoryCount;
  const redPercent = territoryCounts[1] / total * 100;
  const bluePercent = territoryCounts[2] / total * 100;
  const paintedPercent = redPercent + bluePercent;
  const redAngle = redPercent * 3.6;
  const blueAngle = bluePercent * 3.6;
  mapControlWidget.style.background = `conic-gradient(var(--red) 0 ${redAngle}deg, var(--blue) ${redAngle}deg ${redAngle + blueAngle}deg, rgba(40,42,39,.88) ${redAngle + blueAngle}deg 360deg)`;
  const formatPercent = (value) => value > 0 && value < 1 ? value.toFixed(2) : value.toFixed(1);
  mapControlValue.textContent = `${formatPercent(paintedPercent)}%`;
  redScore.textContent = `${formatPercent(redPercent)}%`;
  blueScore.textContent = `${formatPercent(bluePercent)}%`;
  redScoreFill.style.width = `${redPercent}%`;
  blueScoreFill.style.width = `${bluePercent}%`;
  paintPercentages.innerHTML = `<span class="red">${t('team.redShort')} ${formatPercent(redPercent)}%</span><span class="blue">${t('team.blueShort')} ${formatPercent(bluePercent)}%</span>`;
  const now = performance.now();
  if (now - lastBoardUpdate >= 500) {
    lastBoardUpdate = now;
    updateCareerUI();
    const serverRankedPlayers = (multiplayer?.serverLeaderboard || [])
      .filter((entry) => Array.isArray(entry) && entry[0] !== multiplayer?.clientId)
      .map((entry) => ({
        id: entry[0],
        name: String(entry[1] || 'BibishPlayer'),
        team: entry[2] === 'blue' ? 'blue' : 'red',
        countryCode: String(entry[3] || 'TR'),
        score: Math.max(0, Number(entry[4]) || 0),
        elapsedSeconds: Math.max(0, Number(entry[5]) || 0),
        kills: Math.max(0, Math.round(Number(entry[6]) || 0)),
        deaths: Math.max(0, Math.round(Number(entry[7]) || 0)),
        dead: Boolean(entry[8]),
      }));
    const remoteRankedPlayers = serverRankedPlayers.length
      ? serverRankedPlayers
      : (massArmy?.getLeaderboardEntries(18) || []);
    const allRankedPlayers = [
      {
        name: state.playerName,
        countryCode: state.countryCode,
        score: Math.round(state.score),
        elapsedSeconds: state.elapsedSeconds,
        kills: state.kills,
        deaths: state.deaths,
        team: state.team || 'red',
        self: true,
      },
      ...bots.map((bot, index) => ({
        name: bot.name,
        countryCode: bot.countryCode,
        score: Math.round(bot.score),
        elapsedSeconds: bot.elapsedSeconds,
        kills: bot.kills,
        deaths: bot.deaths,
        team: bot.team,
        dead: bot.dead,
      })),
      ...remoteRankedPlayers,
    ].sort((a, b) => b.score - a.score || b.kills - a.kills || a.deaths - b.deaths);
    allRankedPlayers.forEach((entry, index) => { entry.rank = index + 1; });
    const selfEntry = allRankedPlayers.find((entry) => entry.self);
    if (selfEntry) {
      const detailedBotsAhead = bots.filter((bot) => (
        bot.score > selfEntry.score ||
        (bot.score === selfEntry.score && bot.kills > selfEntry.kills) ||
        (bot.score === selfEntry.score && bot.kills === selfEntry.kills && bot.deaths < selfEntry.deaths)
      )).length;
      selfEntry.rank = multiplayer?.connected
        ? 1 + allRankedPlayers.filter((entry) => !entry.self && (
          entry.score > selfEntry.score ||
          (entry.score === selfEntry.score && entry.kills > selfEntry.kills) ||
          (entry.score === selfEntry.score && entry.kills === selfEntry.kills && entry.deaths < selfEntry.deaths)
        )).length
        : 1 + detailedBotsAhead + (massArmy?.countAheadOf(selfEntry.score, selfEntry.kills, selfEntry.deaths) || 0);
    }
    const rankedPlayers = allRankedPlayers.slice(0, 7);
    if (selfEntry && !rankedPlayers.includes(selfEntry)) rankedPlayers.push(selfEntry);
    leaderboard.innerHTML = rankedPlayers.map((entry) => `<span class="${entry.team}${entry.self ? ' self' : ''}${entry.dead ? ' dead' : ''}"><i>${entry.rank}</i><b>${flagMarkup(entry.countryCode)}<span class="leader-name">${escapeHtml(entry.name)}</span></b><em class="leader-score">${Math.round(entry.score)}</em><em class="leader-time">${formatElapsedTime(entry.elapsedSeconds)}</em><em class="leader-kills">${entry.kills}</em><em class="leader-deaths">${entry.deaths}</em></span>`).join('');
    fortData.forEach((fort, index) => {
      const element = fortElements[index];
      if (!element) return;
      element.classList.toggle('red', fort.team === 'red');
      element.classList.toggle('blue', fort.team === 'blue');
      element.textContent = `${t(fort.originalTeam === 'red' ? 'team.redLetter' : 'team.blueLetter')}${fort.index}`;
      element.title = fort.captureTeam
        ? `${Math.round(fort.captureProgress / 2.5 * 100)}% ${currentLanguage === 'tr' ? 'ele geçiriliyor' : 'capturing'}`
        : fort.name;
    });
    updateTeamCounts();
  }
  if (state.started) drawMap(minimapContext, minimapCanvas, true);
  if (state.mapOpen) drawMap(bigMapContext, bigMapCanvas, false);
}

function segmentHitsBlocker(origin, target, box) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  let minimumT = 0.015;
  let maximumT = 0.965;
  if (Math.abs(dx) < 0.00001) {
    if (origin.x < box.minX || origin.x > box.maxX) return false;
  } else {
    const x1 = (box.minX - origin.x) / dx;
    const x2 = (box.maxX - origin.x) / dx;
    minimumT = Math.max(minimumT, Math.min(x1, x2));
    maximumT = Math.min(maximumT, Math.max(x1, x2));
    if (minimumT > maximumT) return false;
  }
  if (Math.abs(dy) < 0.00001) {
    if (origin.y < box.minY || origin.y > box.maxY) return false;
  } else {
    const y1 = (box.minY - origin.y) / dy;
    const y2 = (box.maxY - origin.y) / dy;
    minimumT = Math.max(minimumT, Math.min(y1, y2));
    maximumT = Math.min(maximumT, Math.max(y1, y2));
    if (minimumT > maximumT) return false;
  }
  if (Math.abs(dz) < 0.00001) {
    if (origin.z < box.minZ || origin.z > box.maxZ) return false;
  } else {
    const z1 = (box.minZ - origin.z) / dz;
    const z2 = (box.maxZ - origin.z) / dz;
    minimumT = Math.max(minimumT, Math.min(z1, z2));
    maximumT = Math.min(maximumT, Math.max(z1, z2));
    if (minimumT > maximumT) return false;
  }
  return true;
}

function isNpcBodyVisible(x, baseY, z) {
  npcOcclusionCandidates.clear();
  const horizontalDistance = Math.hypot(x - camera.position.x, z - camera.position.z);
  // Yoğun fil otu biyomu görsel bir siper alanıdır; çimin içindeki uzak hedefin etiketi örtüyü ele vermez.
  if (grassOnlyBiomeAt(x, z)?.variant === 'elephantGrass' && horizontalDistance > 3.5) return false;
  const gridSteps = Math.max(1, Math.ceil(horizontalDistance / (BLOCKER_GRID_SIZE * 0.48)));
  for (let step = 0; step <= gridSteps; step += 1) {
    const ratio = step / gridSteps;
    const cellX = Math.floor(THREE.MathUtils.lerp(camera.position.x, x, ratio) / BLOCKER_GRID_SIZE);
    const cellZ = Math.floor(THREE.MathUtils.lerp(camera.position.z, z, ratio) / BLOCKER_GRID_SIZE);
    for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (const box of blockerGrid.get(`${cellX + offsetX}:${cellZ + offsetZ}`) || []) npcOcclusionCandidates.add(box);
      }
    }
  }
  for (let probe = 0; probe < 2; probe += 1) {
    npcLabelTarget.set(x, baseY + (probe === 0 ? 1.72 : 1.06), z);
    let blockedByVolume = false;
    for (const box of npcOcclusionCandidates) {
      if (segmentHitsBlocker(camera.position, npcLabelTarget, box)) {
        blockedByVolume = true;
        break;
      }
    }
    if (blockedByVolume) continue;
    npcLabelDirection.copy(npcLabelTarget).sub(camera.position);
    const distance = npcLabelDirection.length();
    if (distance <= 0.3) return true;
    labelOcclusionRaycaster.set(camera.position, npcLabelDirection.multiplyScalar(1 / distance));
    labelOcclusionRaycaster.far = Math.max(0, distance - 0.24);
    if (labelOcclusionRaycaster.intersectObjects(bulletSurfaces, false).length === 0) return true;
  }
  return false;
}

function updateNpcLabels() {
  camera.updateMatrixWorld(true);
  const range = state.aiming ? Math.min(680, 280 + state.scopeZoom * 55) : activeTier === 'performance' ? 54 : activeTier === 'balanced' ? 68 : 82;
  const element = npcLabelElements[0];
  element.style.transform = 'translate3d(-9999px,-9999px,0) translate(-50%,-100%)';
  for (const bot of bots) bot.label.visible = false;
  if (!state.started || state.mapOpen || state.dead) return;

  camera.getWorldDirection(npcLabelDirection);
  let focused = massArmy?.getLabelTargetOnRay(camera.position, npcLabelDirection, range) || null;
  let bestDistance = focused?.rayDistance ?? range;
  for (const bot of bots) {
    if (bot.dead || !bot.group.visible) continue;
    for (const [height, radius] of [[1.72, 0.27], [1.06, 0.37], [0.42, 0.32]]) {
      const dx = bot.group.position.x - camera.position.x;
      const dy = bot.group.position.y + height - camera.position.y;
      const dz = bot.group.position.z - camera.position.z;
      const distanceAlongRay = dx * npcLabelDirection.x + dy * npcLabelDirection.y + dz * npcLabelDirection.z;
      if (distanceAlongRay <= 0 || distanceAlongRay >= bestDistance) continue;
      const perpendicularSquared = dx * dx + dy * dy + dz * dz - distanceAlongRay * distanceAlongRay;
      if (perpendicularSquared > radius * radius) continue;
      bestDistance = distanceAlongRay;
      focused = { bot, rayDistance: distanceAlongRay };
    }
  }

  if (!focused) return;
  if (focused.bot) {
    const bot = focused.bot;
    if (isNpcBodyVisible(bot.group.position.x, bot.group.position.y, bot.group.position.z)) bot.label.visible = true;
    return;
  }
  if (!isNpcBodyVisible(focused.x, focused.baseY, focused.z)) return;
  npcLabelProjection.set(focused.x, focused.y, focused.z).project(camera);
  const screenX = (npcLabelProjection.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-npcLabelProjection.y * 0.5 + 0.5) * gameViewportHeight();
  element.querySelector('b').innerHTML = `${flagMarkup(focused.countryCode)} ${escapeHtml(focused.name)}`;
  element.style.setProperty('--health', `${focused.health}%`);
  element.style.setProperty('--team-color', focused.team === 'red' ? '#ff315e' : '#28b8ff');
  element.style.transform = `translate3d(${screenX}px,${screenY}px,0) translate(-50%,-100%)`;
}

function toggleBigMap() {
  if (!state.started) return;
  if (state.spawnSelecting) {
    showToast(localized('DOĞUŞ İÇİN BİR TAKIM KALESİ SEÇ', 'SELECT A TEAM FORT TO SPAWN'));
    return;
  }
  state.mapOpen = !state.mapOpen;
  state.firing = false;
  state.mouseLeft = false;
  state.mouseRight = false;
  bigMap.classList.toggle('hidden', !state.mapOpen);
  if (state.mapOpen) updateMaps();
}

function floorHeightAt(x, z, maxReach = Infinity, supportMargin = 0) {
  let height = terrainHeightAt(x, z);
  for (const surface of walkSurfaces) {
    if (
      x >= surface.minX - supportMargin && x <= surface.maxX + supportMargin &&
      z >= surface.minZ - supportMargin && z <= surface.maxZ + supportMargin &&
      surface.height <= maxReach && surface.height > height
    ) height = surface.height;
  }
  return height;
}

function buildBlockerGrid() {
  blockerGrid.clear();
  blockers.forEach((box) => {
    const minCellX = Math.floor(box.minX / BLOCKER_GRID_SIZE);
    const maxCellX = Math.floor(box.maxX / BLOCKER_GRID_SIZE);
    const minCellZ = Math.floor(box.minZ / BLOCKER_GRID_SIZE);
    const maxCellZ = Math.floor(box.maxZ / BLOCKER_GRID_SIZE);
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const key = `${cellX}:${cellZ}`;
        if (!blockerGrid.has(key)) blockerGrid.set(key, []);
        blockerGrid.get(key).push(box);
      }
    }
  });
}

function closestPointOnSegmentXZ(x, z, a, b) {
  const edgeX = b.x - a.x;
  const edgeZ = b.z - a.z;
  const lengthSquared = edgeX * edgeX + edgeZ * edgeZ;
  const amount = lengthSquared > 0.000001
    ? THREE.MathUtils.clamp(((x - a.x) * edgeX + (z - a.z) * edgeZ) / lengthSquared, 0, 1)
    : 0;
  return { x: a.x + edgeX * amount, z: a.z + edgeZ * amount };
}

function pointInsideBlockerPolygon(x, z, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if (((a.z > z) !== (b.z > z)) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

function blockerCircleContact(box, x, z, radius) {
  if (x + radius <= box.minX || x - radius >= box.maxX || z + radius <= box.minZ || z - radius >= box.maxZ) return null;
  const polygon = box.polygon;
  if (!polygon || polygon.length < 3) {
    const closestX = THREE.MathUtils.clamp(x, box.minX, box.maxX);
    const closestZ = THREE.MathUtils.clamp(z, box.minZ, box.maxZ);
    const inside = x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ;
    const distance = Math.hypot(x - closestX, z - closestZ);
    return inside || distance < radius ? { inside, closestX, closestZ, distance, outwardX: 0, outwardZ: -1 } : null;
  }
  const inside = pointInsideBlockerPolygon(x, z, polygon);
  let nearest = null;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const closest = closestPointOnSegmentXZ(x, z, a, b);
    const distance = Math.hypot(x - closest.x, z - closest.z);
    if (!nearest || distance < nearest.distance) {
      const edgeX = b.x - a.x;
      const edgeZ = b.z - a.z;
      const edgeLength = Math.max(0.0001, Math.hypot(edgeX, edgeZ));
      nearest = {
        closestX: closest.x,
        closestZ: closest.z,
        distance,
        outwardX: edgeZ / edgeLength,
        outwardZ: -edgeX / edgeLength,
      };
    }
  }
  return inside || nearest.distance < radius ? { ...nearest, inside } : null;
}

function collidesStaticAt(x, z, radius = state.currentRadius, feetY = state.feetY, bodyHeight = state.currentBodyHeight) {
  if (x < -WORLD.halfWidth + 34 || x > WORLD.halfWidth - 34 || z < -WORLD.halfDepth + 34 || z > WORLD.halfDepth - 34) return true;
  if (terrainHeightAt(x, z) < -17.5) return true;
  const minCellX = Math.floor((x - radius) / BLOCKER_GRID_SIZE);
  const maxCellX = Math.floor((x + radius) / BLOCKER_GRID_SIZE);
  const minCellZ = Math.floor((z - radius) / BLOCKER_GRID_SIZE);
  const maxCellZ = Math.floor((z + radius) / BLOCKER_GRID_SIZE);
  for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      for (const box of blockerGrid.get(`${cellX}:${cellZ}`) || []) {
        if (
          box.maxY > feetY + 0.08 && box.minY < feetY + bodyHeight &&
          blockerCircleContact(box, x, z, radius)
        ) return true;
      }
    }
  }
  return false;
}

function collidesAt(x, z, radius = state.currentRadius) {
  if (collidesStaticAt(x, z, radius)) return true;
  if (bots.some((bot) => !bot.dead && Math.hypot(x - bot.group.position.x, z - bot.group.position.z) < radius + 0.31)) return true;
  return massArmy?.collidesCircle(x, z, radius) || false;
}

function movePlayerWithSweep(dx, dz) {
  const startX = playerPosition.x;
  const startZ = playerPosition.z;
  const radius = state.currentRadius;
  const distance = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(distance / Math.max(0.065, radius * 0.28)));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  for (let step = 0; step < steps; step += 1) {
    const targetX = playerPosition.x + stepX;
    const targetZ = playerPosition.z + stepZ;
    // Try the intended diagonal position first. Testing the two axes first can
    // falsely close a diagonal gap even though the final capsule fits.
    if (!collidesAt(targetX, targetZ, radius)) {
      playerPosition.x = targetX;
      playerPosition.z = targetZ;
      continue;
    }
    const canMoveX = !collidesAt(targetX, playerPosition.z, radius);
    const canMoveZ = !collidesAt(playerPosition.x, targetZ, radius);
    if (canMoveX) playerPosition.x = targetX;
    if (canMoveZ) playerPosition.z = targetZ;
  }
  return Math.hypot(playerPosition.x - startX, playerPosition.z - startZ);
}

function resolveStaticPenetration() {
  for (let pass = 0; pass < 5; pass += 1) {
    const radius = state.currentRadius;
    const minCellX = Math.floor((playerPosition.x - radius) / BLOCKER_GRID_SIZE);
    const maxCellX = Math.floor((playerPosition.x + radius) / BLOCKER_GRID_SIZE);
    const minCellZ = Math.floor((playerPosition.z - radius) / BLOCKER_GRID_SIZE);
    const maxCellZ = Math.floor((playerPosition.z + radius) / BLOCKER_GRID_SIZE);
    let correction = null;
    const visited = new Set();
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        for (const box of blockerGrid.get(`${cellX}:${cellZ}`) || []) {
          if (visited.has(box)) continue;
          visited.add(box);
          if (box.maxY <= state.feetY + 0.08 || box.minY >= state.feetY + state.currentBodyHeight) continue;
          const contact = blockerCircleContact(box, playerPosition.x, playerPosition.z, radius);
          if (!contact) continue;
          let correctionX;
          let correctionZ;
          if (contact.inside) {
            correctionX = contact.closestX + contact.outwardX * (radius + 0.015) - playerPosition.x;
            correctionZ = contact.closestZ + contact.outwardZ * (radius + 0.015) - playerPosition.z;
          } else {
            const inverseDistance = contact.distance > 0.0001 ? 1 / contact.distance : 0;
            const normalX = inverseDistance ? (playerPosition.x - contact.closestX) * inverseDistance : contact.outwardX;
            const normalZ = inverseDistance ? (playerPosition.z - contact.closestZ) * inverseDistance : contact.outwardZ;
            const push = radius + 0.015 - contact.distance;
            correctionX = normalX * push;
            correctionZ = normalZ * push;
          }
          const correctionDistance = Math.hypot(correctionX, correctionZ);
          if (!correction || correctionDistance < correction.distance) correction = { x: correctionX, z: correctionZ, distance: correctionDistance };
        }
      }
    }
    if (!correction) return;
    playerPosition.x += correction.x;
    playerPosition.z += correction.z;
    state.collisionRecoveries += 1;
  }
}

function movePlayer(delta) {
  if (!state.locked || state.dead || state.matchEnded) {
    state.moveAmount = 0;
    state.sprinting = false;
    return;
  }

  const stanceTarget = STANCE[state.stance];
  state.jumpQueued = Math.max(0, state.jumpQueued - delta);
  state.jumpGrace = state.canJump ? 0.12 : Math.max(0, state.jumpGrace - delta);
  state.currentEyeHeight = THREE.MathUtils.lerp(state.currentEyeHeight, stanceTarget.eye, Math.min(1, delta * 11));
  state.currentBodyHeight = THREE.MathUtils.lerp(state.currentBodyHeight, stanceTarget.body, Math.min(1, delta * 11));
  state.currentRadius = THREE.MathUtils.lerp(state.currentRadius, stanceTarget.radius, Math.min(1, delta * 14));

  if (state.thirdPerson) {
    const cameraForwardAmount = Number(state.keys.has('ArrowUp')) - Number(state.keys.has('ArrowDown'));
    const cameraRightAmount = Number(state.keys.has('ArrowRight')) - Number(state.keys.has('ArrowLeft'));
    const cameraInputLength = Math.hypot(cameraForwardAmount, cameraRightAmount);
    if (cameraInputLength > 0) {
      const cameraSpeed = state.keys.has('ShiftRight') ? 26 : 14;
      const cameraForward = new THREE.Vector3(-Math.sin(state.freeYaw), 0, -Math.cos(state.freeYaw));
      const cameraRight = new THREE.Vector3(Math.cos(state.freeYaw), 0, -Math.sin(state.freeYaw));
      const proposedX = detachedCameraPosition.x + (cameraForward.x * cameraForwardAmount + cameraRight.x * cameraRightAmount) / cameraInputLength * cameraSpeed * delta;
      const proposedZ = detachedCameraPosition.z + (cameraForward.z * cameraForwardAmount + cameraRight.z * cameraRightAmount) / cameraInputLength * cameraSpeed * delta;
      if (Math.abs(proposedX) <= WORLD.halfWidth - 36 && Math.abs(proposedZ) <= WORLD.halfDepth - 36 && terrainHeightAt(proposedX, proposedZ) >= -17.5) {
        detachedCameraPosition.x = proposedX;
        detachedCameraPosition.z = proposedZ;
      }
    }
    detachedCameraPosition.y = Math.max(detachedCameraPosition.y, terrainHeightAt(detachedCameraPosition.x, detachedCameraPosition.z) + 1.15, -18.2);
  }

  const forwardAmount = Number(state.keys.has('KeyW')) - Number(state.keys.has('KeyS'));
  const rightAmount = Number(state.keys.has('KeyD')) - Number(state.keys.has('KeyA'));
  const inputLength = Math.hypot(forwardAmount, rightAmount);
  const sprinting = !state.shieldActive && state.stance === 'stand' && inputLength > 0 && state.keys.has('ShiftLeft') && state.stamina > 0.5;
  const baseSpeed = sprinting ? PLAYER.sprintSpeed : state.stance === 'crouch' ? PLAYER.crouchSpeed : state.stance === 'prone' ? PLAYER.proneSpeed : PLAYER.walkSpeed;
  const speed = baseSpeed * (state.shieldActive ? 0.84 : 1);
  let movedDistance = 0;
  state.moveAmount = Math.min(1, inputLength);
  state.sprinting = sprinting;

  if (sprinting) state.stamina = Math.max(0, state.stamina - delta * 24);
  else state.stamina = Math.min(100, state.stamina + delta * 17);

  const activeLadder = ladderZones.find((ladder) => (
    playerPosition.x >= ladder.minX && playerPosition.x <= ladder.maxX &&
    playerPosition.z >= ladder.minZ && playerPosition.z <= ladder.maxZ &&
    state.feetY >= ladder.bottom - 0.25 && state.feetY <= ladder.top + 0.35
  ));
  const climbing = Boolean(
    activeLadder && state.feetY < activeLadder.top - 0.08 &&
    (forwardAmount > 0 || state.keys.has('Space')) && !state.keys.has('ShiftLeft')
  );

  // Zıplama girdisi birkaç fizik adımı boyunca tamponlanır; coyote time sayesinde
  // sprint sırasında küçük arazi kırıklarında canJump bir kare düşse de zıplama kaçmaz.
  if (!climbing && state.stance === 'stand' && state.jumpQueued > 0 && state.jumpGrace > 0) {
    state.velocityY = PLAYER.jumpSpeed;
    state.canJump = false;
    state.jumpGrace = 0;
    state.jumpQueued = 0;
    playActionSound('jump');
  }

  if (climbing) {
    state.velocityY = 0;
    state.canJump = false;
    state.feetY = THREE.MathUtils.clamp(state.feetY + 6.1 * delta, activeLadder.bottom, activeLadder.top);
    playerPosition.x = THREE.MathUtils.lerp(playerPosition.x, activeLadder.snapX, Math.min(1, delta * 11));
    playerPosition.z = THREE.MathUtils.lerp(playerPosition.z, activeLadder.snapZ, Math.min(1, delta * 11));
    if (state.feetY >= activeLadder.top - 0.04) {
      playerPosition.x = activeLadder.exitX;
      playerPosition.z = activeLadder.exitZ;
    }
    state.stepPhase += delta * 7;
  } else if (inputLength > 0) {
    const forward = tmpV1.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    const right = tmpV2.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));
    const dx = (forward.x * forwardAmount + right.x * rightAmount) / inputLength * speed * delta;
    const dz = (forward.z * forwardAmount + right.z * rightAmount) / inputLength * speed * delta;

    movedDistance = movePlayerWithSweep(dx, dz);
    state.stepPhase += delta * (sprinting ? 12.5 : 8.5);
  }

  if (!climbing) {
    state.velocityY -= 28 * delta;
    state.feetY += state.velocityY * delta;
    const supportMargin = state.currentRadius * 0.72;
    let floor = floorHeightAt(playerPosition.x, playerPosition.z, state.feetY + 0.72, supportMargin);
    // Land before horizontal penetration recovery. Otherwise the final
    // descending frame overlaps a rampart by a few centimetres and the wall
    // collision pushes the player off the top before the floor can catch it.
    if (state.feetY <= floor) {
      state.feetY = floor;
      state.velocityY = 0;
      state.canJump = true;
    } else {
      resolveStaticPenetration();
      floor = floorHeightAt(playerPosition.x, playerPosition.z, state.feetY + 0.72, supportMargin);
      if (state.feetY <= floor) {
        state.feetY = floor;
        state.velocityY = 0;
        state.canJump = true;
      } else state.canJump = false;
    }
  }

  updateFootsteps(delta, movedDistance, sprinting);

  const groundedBob = state.canJump && inputLength > 0 ? Math.abs(Math.sin(state.stepPhase * 2)) * (sprinting ? 0.07 : state.stance === 'stand' ? 0.035 : 0.014) : 0;
  if (state.thirdPerson) {
    camera.position.copy(detachedCameraPosition);
    camera.rotation.set(state.freePitch, state.freeYaw, 0);
  } else {
    const desiredCameraY = state.feetY + state.currentEyeHeight + groundedBob;
    const minimumCameraY = terrainHeightAt(playerPosition.x, playerPosition.z) + 0.24;
    const safeCameraY = Math.max(desiredCameraY, minimumCameraY);
    if (safeCameraY > desiredCameraY + 0.01) state.cameraSafetyRecoveries += 1;
    camera.position.set(playerPosition.x, safeCameraY, playerPosition.z);
    camera.rotation.set(state.pitch, state.yaw, inputLength > 0 ? Math.sin(state.stepPhase) * 0.005 : 0);
  }
}

function paintTerritory(point, radius, team, awardScore = true) {
  const teamId = team === 'red' ? 1 : 2;
  const centerX = Math.floor((point.x + WORLD.halfWidth) / (WORLD.halfWidth * 2) * TERRITORY_SIZE);
  const centerY = Math.floor((point.z + WORLD.halfDepth) / (WORLD.halfDepth * 2) * TERRITORY_SIZE);
  const cellWorldSize = (WORLD.halfWidth * 2) / TERRITORY_SIZE;
  const exactRadius = Math.max(radius, cellWorldSize * 0.48);
  const cellRadius = Math.max(1, Math.ceil(exactRadius / cellWorldSize));

  for (let y = Math.max(0, centerY - cellRadius); y <= Math.min(TERRITORY_SIZE - 1, centerY + cellRadius); y += 1) {
    for (let x = Math.max(0, centerX - cellRadius); x <= Math.min(TERRITORY_SIZE - 1, centerX + cellRadius); x += 1) {
      const worldX = -WORLD.halfWidth + (x + 0.5) / TERRITORY_SIZE * WORLD.halfWidth * 2;
      const worldZ = -WORLD.halfDepth + (y + 0.5) / TERRITORY_SIZE * WORLD.halfDepth * 2;
      if (x !== centerX || y !== centerY) {
        if (Math.hypot(worldX - point.x, worldZ - point.z) > exactRadius) continue;
      }
      const index = y * TERRITORY_SIZE + x;
      const previous = territoryCells[index];
      if (previous === teamId || previous === 3) continue;
      territoryCounts[previous] -= 1;
      territoryCounts[teamId] += 1;
      territoryCells[index] = teamId;
      writeTerritoryPixel(x, y, teamId);
      if (awardScore && state.started && state.team === team) state.score += previous === 0 ? 2 : 3;
    }
  }
}

function groundSurfaceAt(x, z) {
  if (!groundMesh || Math.abs(x) > WORLD.halfWidth || Math.abs(z) > WORLD.halfDepth) return null;
  groundRaycaster.set(new THREE.Vector3(x, 140, z), new THREE.Vector3(0, -1, 0));
  groundRaycaster.far = 260;
  const hit = groundRaycaster.intersectObjects(paintables, false)[0];
  if (!hit || hit.point.y < -17.5) return null;
  return {
    point: hit.point,
    normal: hit.face.normal.clone().transformDirection(hit.object.matrixWorld),
  };
}

function placeWastePaint(point, radius, wasteType, team = state.team, awardScore = true) {
  if (point.y < -17.5 || Math.abs(point.x) > WORLD.halfWidth || Math.abs(point.z) > WORLD.halfDepth) return;
  const effectiveRadius = wasteType === 'team' ? radius : radius * PAINT_RADIUS_MULTIPLIER;
  const centerX = (point.x + WORLD.halfWidth) / (WORLD.halfWidth * 2) * TERRAIN_TEXTURE_SIZE;
  const centerY = (point.z + WORLD.halfDepth) / (WORLD.halfDepth * 2) * TERRAIN_TEXTURE_SIZE;
  const pixelRadius = Math.max(0.48, effectiveRadius / (WORLD.halfWidth * 2) * TERRAIN_TEXTURE_SIZE);
  const drawIrregularStamp = (size, color, alpha, points = 14) => {
    terrainPaintContext.save();
    terrainPaintContext.globalAlpha = alpha;
    terrainPaintContext.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    terrainPaintContext.beginPath();
    for (let index = 0; index < points; index += 1) {
      const angle = index / points * Math.PI * 2;
      const wobble = 0.74 + Math.random() * 0.34;
      const px = centerX + Math.cos(angle) * size * wobble;
      const py = centerY + Math.sin(angle) * size * wobble;
      if (index === 0) terrainPaintContext.moveTo(px, py);
      else terrainPaintContext.lineTo(px, py);
    }
    terrainPaintContext.closePath();
    terrainPaintContext.fill();
    terrainPaintContext.restore();
  };

  // Takım kenarı ve atık rengi aynı zemin dokusuna işlenir; ayrı, havada duran mesh yoktur.
  drawIrregularStamp(pixelRadius * 1.12, TEAM[team].color, wasteType === 'team' ? 0.88 : 0.92);
  drawIrregularStamp(pixelRadius, wasteType === 'team' ? TEAM[team].color : WASTE_STYLE[team][wasteType], wasteType === 'pee' ? 0.82 : 0.96);
  if (wasteType === 'vomit') {
    for (let index = 0; index < 4; index += 1) {
      terrainPaintContext.fillStyle = index % 2 ? '#bf4f48' : '#7892a0';
      terrainPaintContext.beginPath();
      terrainPaintContext.arc(centerX + (Math.random() - 0.5) * pixelRadius, centerY + (Math.random() - 0.5) * pixelRadius, Math.max(0.55, pixelRadius * 0.13), 0, Math.PI * 2);
      terrainPaintContext.fill();
    }
  }
  terrainTextureDirty = true;
  paintTerritory(point, effectiveRadius, team, awardScore);
  if (awardScore && state.started && team === state.team && wasteType !== 'team') {
    multiplayer?.sendEvent({
      kind: 'paint',
      x: point.x,
      y: point.y,
      z: point.z,
      radius,
      wasteType,
    });
  }
}

function cameraRay(spreadX = 0, spreadY = 0) {
  rayDirection.set(0, 0, -1).applyQuaternion(camera.quaternion);
  rayRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  rayUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  rayDirection.addScaledVector(rayRight, spreadX).addScaledVector(rayUp, spreadY).normalize();
  return rayDirection;
}

function tracePaintPath(origin, direction, maxDistance = 180, maxBounces = 2) {
  let remaining = maxDistance;
  const currentOrigin = origin.clone();
  const currentDirection = direction.clone().normalize();
  const path = [];
  for (let bounce = 0; bounce <= maxBounces && remaining > 0.1; bounce += 1) {
    raycaster.set(currentOrigin, currentDirection);
    raycaster.far = remaining;
    const hit = raycaster.intersectObjects(bulletSurfaces, false)[0];
    if (!hit) return { hit: null, normal: null, path, escaped: currentOrigin.clone().addScaledVector(currentDirection, remaining) };
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    path.push(hit.point.clone());
    remaining -= currentOrigin.distanceTo(hit.point);
    if (hit.object === groundMesh || hit.object.userData.paintable) return { hit, normal, path };
    currentOrigin.copy(hit.point).addScaledVector(normal, 0.08);
    currentDirection.reflect(normal).normalize();
  }
  return { hit: null, normal: null, path };
}

function rayFromCameraToGround(spreadX = 0, spreadY = 0, maxDistance = 180) {
  const direction = cameraRay(spreadX, spreadY).clone();
  return tracePaintPath(camera.position, direction, maxDistance, 2);
}

let audioContext;
let footstepNoiseBuffer;
let actionNoiseBuffer;
let masterGainNode;
let masterCompressorNode;
let spatialAudioWindowStart = 0;
let spatialAudioEvents = 0;
let spatialFootstepEvents = 0;
function volumePercentToGain(percent) {
  if (percent <= 0) return 0;
  // %50 güçlü bir referans, üst yarıysa belirgin biçimde daha saldırgan bir eğridir.
  // Son compressor yüksekliği korurken dijital taşmayı ve sert clipping'i sınırlar.
  if (percent <= 50) return 0.08 + (percent / 50) * 2.37;
  return 2.45 + Math.pow((percent - 50) / 50, 1.18) * 4.05;
}

function setAudioVolume(percent, persist = false) {
  audioVolumePercent = THREE.MathUtils.clamp(Math.round(Number(percent) || 0), 0, 100);
  if (volumeRange) volumeRange.value = String(audioVolumePercent);
  if (volumeValue) volumeValue.textContent = `${audioVolumePercent}%`;
  if (volumeRange) {
    volumeRange.style.setProperty('--volume-percent', `${audioVolumePercent}%`);
    volumeRange.setAttribute('aria-valuetext', `${audioVolumePercent}%`);
  }
  if (masterGainNode && audioContext) {
    masterGainNode.gain.setTargetAtTime(volumePercentToGain(audioVolumePercent), audioContext.currentTime, 0.025);
  }
  if (persist) localStorage.setItem(AUDIO_SETTINGS_KEY, String(audioVolumePercent));
}

function configureAudioOutput(context) {
  if (masterGainNode) return;
  masterGainNode = context.createGain();
  masterCompressorNode = context.createDynamicsCompressor();
  masterCompressorNode.threshold.value = -9;
  masterCompressorNode.knee.value = 12;
  masterCompressorNode.ratio.value = 4;
  masterCompressorNode.attack.value = 0.003;
  masterCompressorNode.release.value = 0.13;
  masterGainNode.gain.value = volumePercentToGain(audioVolumePercent);
  masterGainNode.connect(masterCompressorNode).connect(context.destination);
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass({ latencyHint: 'interactive' });
    configureAudioOutput(audioContext);
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function createSpatialDestination(context, position = null, category = 'action') {
  if (!masterGainNode) configureAudioOutput(context);
  if (!position) return masterGainNode;
  const distance = camera.position.distanceTo(position);
  if (distance > 300) return null;
  const nowMs = performance.now();
  if (nowMs - spatialAudioWindowStart >= 1000) {
    spatialAudioWindowStart = nowMs;
    spatialAudioEvents = 0;
    spatialFootstepEvents = 0;
  }
  if (category === 'footstep') {
    const footstepBudget = activeTier === 'performance' ? 6 : activeTier === 'balanced' ? 10 : activeTier === 'high' ? 13 : 16;
    if (spatialFootstepEvents >= footstepBudget) return null;
    spatialFootstepEvents += 1;
  } else {
    const actionBudget = activeTier === 'performance' ? 12 : activeTier === 'balanced' ? 18 : activeTier === 'high' ? 22 : 26;
    if (spatialAudioEvents >= actionBudget) return null;
    spatialAudioEvents += 1;
  }
  const panner = context.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 4.5;
  panner.maxDistance = 300;
  panner.rolloffFactor = 1.12;
  panner.coneInnerAngle = 360;
  panner.coneOuterAngle = 360;
  if (panner.positionX) {
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
  } else panner.setPosition(position.x, position.y, position.z);
  panner.connect(masterGainNode);
  return panner;
}

const audioForward = new THREE.Vector3();
const audioUp = new THREE.Vector3();
function updateAudioListener() {
  if (!audioContext) return;
  const listener = audioContext.listener;
  const now = audioContext.currentTime;
  camera.getWorldDirection(audioForward);
  audioUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  if (listener.positionX) {
    listener.positionX.setValueAtTime(camera.position.x, now);
    listener.positionY.setValueAtTime(camera.position.y, now);
    listener.positionZ.setValueAtTime(camera.position.z, now);
    listener.forwardX.setValueAtTime(audioForward.x, now);
    listener.forwardY.setValueAtTime(audioForward.y, now);
    listener.forwardZ.setValueAtTime(audioForward.z, now);
    listener.upX.setValueAtTime(audioUp.x, now);
    listener.upY.setValueAtTime(audioUp.y, now);
    listener.upZ.setValueAtTime(audioUp.z, now);
  } else {
    listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
    listener.setOrientation(audioForward.x, audioForward.y, audioForward.z, audioUp.x, audioUp.y, audioUp.z);
  }
}

function playFootstepSound(mode, position = null, trackLocal = true) {
  const profiles = {
    sprint: { volume: 0.13, interval: 0.28, lowpass: 1180, thump: 0.055, pitch: 1.08 },
    walk: { volume: 0.068, interval: 0.43, lowpass: 930, thump: 0.032, pitch: 0.94 },
    crouch: { volume: 0.027, interval: 0.62, lowpass: 680, thump: 0.014, pitch: 0.82 },
  };
  const profile = profiles[mode];
  if (!profile) return 0;
  if (trackLocal) {
    state.footstepEvents += 1;
    state.lastFootstepMode = mode;
    state.lastFootstepVolume = profile.volume;
  }
  const context = getAudioContext();
  if (!context) return profile.interval;
  const destination = createSpatialDestination(context, position, position ? 'footstep' : 'action');
  if (!destination) return profile.interval;
  const now = context.currentTime;
  const duration = mode === 'sprint' ? 0.105 : 0.085;
  if (!footstepNoiseBuffer || footstepNoiseBuffer.sampleRate !== context.sampleRate) {
    footstepNoiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.12), context.sampleRate);
    const data = footstepNoiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  noise.buffer = footstepNoiseBuffer;
  noise.playbackRate.value = profile.pitch * THREE.MathUtils.randFloat(0.94, 1.06);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(profile.lowpass * THREE.MathUtils.randFloat(0.9, 1.08), now);
  filter.Q.value = 0.75;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(profile.volume, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  noise.connect(filter).connect(gain).connect(destination);
  noise.start(now, THREE.MathUtils.randFloat(0, 0.025));
  noise.stop(now + duration);

  const thump = context.createOscillator();
  const thumpGain = context.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(mode === 'sprint' ? 96 : mode === 'walk' ? 82 : 68, now);
  thump.frequency.exponentialRampToValueAtTime(42, now + duration);
  thumpGain.gain.setValueAtTime(profile.thump, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  thump.connect(thumpGain).connect(destination);
  thump.start(now);
  thump.stop(now + duration);
  return profile.interval;
}

function updateFootsteps(delta, movedDistance, sprinting) {
  if (state.stance === 'prone' || !state.canJump || movedDistance < 0.002) {
    state.footstepTimer = Math.min(state.footstepTimer, 0.08);
    if (state.stance === 'prone') {
      state.lastFootstepMode = 'prone-silent';
      state.lastFootstepVolume = 0;
    }
    return;
  }
  state.footstepTimer -= delta;
  if (state.footstepTimer > 0) return;
  const mode = sprinting ? 'sprint' : state.stance === 'crouch' ? 'crouch' : 'walk';
  state.footstepTimer = playFootstepSound(mode);
}

function playActionSound(type, position = null) {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const destination = createSpatialDestination(context, position);
  if (!destination) return;
  if (!actionNoiseBuffer || actionNoiseBuffer.sampleRate !== context.sampleRate) {
    actionNoiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.65), context.sampleRate);
    const data = actionNoiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }

  const tone = ({ wave = 'sine', from, to, volume, duration, delay = 0, attack = 0.003 }) => {
    const start = now + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(1, from), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  };

  const noise = ({ filterType = 'bandpass', from, to = from, q = 0.8, volume, duration, delay = 0, attack = 0.003, playback = 1 }) => {
    const start = now + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = actionNoiseBuffer;
    source.playbackRate.value = playback * THREE.MathUtils.randFloat(0.93, 1.07);
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(10, from), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(10, to), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(volume, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(destination);
    const maximumOffset = Math.max(0, actionNoiseBuffer.duration - duration - 0.01);
    source.start(start, Math.random() * maximumOffset, duration);
    source.stop(start + duration + 0.01);
  };

  switch (type) {
    case 'gun':
      // Keskin barut patlaması + tok namlu basıncı + kısa mekanizma tıkı.
      noise({ filterType: 'bandpass', from: 2100, to: 720, q: 0.55, volume: 0.21, duration: 0.075, attack: 0.001, playback: 1.35 });
      tone({ wave: 'square', from: 145, to: 48, volume: 0.105, duration: 0.085, attack: 0.001 });
      tone({ wave: 'triangle', from: 2200, to: 760, volume: 0.032, duration: 0.032, delay: 0.012, attack: 0.001 });
      break;
    case 'shield':
      // İki rezonanslı metal çarpması; silah patlamasından uzun ve çınlayan bir kuyruk.
      tone({ wave: 'sine', from: 1180, to: 860, volume: 0.07, duration: 0.25, attack: 0.002 });
      tone({ wave: 'triangle', from: 1760, to: 1120, volume: 0.046, duration: 0.18, delay: 0.008, attack: 0.002 });
      noise({ filterType: 'highpass', from: 2900, to: 1700, q: 0.45, volume: 0.035, duration: 0.07, attack: 0.001 });
      break;
    case 'shieldRaise':
      // Kalkanı kaldırırken metal sürtünmesi ve deri kayış gerilmesi; darbe çınlamasından kısa.
      noise({ filterType: 'bandpass', from: 620, to: 1380, q: 1.25, volume: 0.045, duration: 0.14, attack: 0.018, playback: 0.82 });
      tone({ wave: 'triangle', from: 410, to: 570, volume: 0.023, duration: 0.1, delay: 0.028, attack: 0.008 });
      break;
    case 'shieldLower':
      // Kalkan indirme: kısa deri kayışı ve aşağı yönlü, tok metal oturuşu.
      noise({ filterType: 'bandpass', from: 980, to: 430, q: 1.05, volume: 0.032, duration: 0.11, attack: 0.01, playback: 0.72 });
      tone({ wave: 'sine', from: 360, to: 190, volume: 0.027, duration: 0.09, delay: 0.018, attack: 0.004 });
      break;
    case 'sword':
      // Geniş bant hava savrulması + çok hafif çelik parıltısı.
      noise({ filterType: 'bandpass', from: 2800, to: 520, q: 0.65, volume: 0.095, duration: 0.2, attack: 0.015, playback: 0.78 });
      tone({ wave: 'sine', from: 820, to: 590, volume: 0.018, duration: 0.13, delay: 0.025, attack: 0.008 });
      break;
    case 'pee':
      // İnce, kesintili sıvı akışı; düşük frekanslı darbe içermez.
      noise({ filterType: 'bandpass', from: 1850, to: 1320, q: 1.15, volume: 0.034, duration: 0.15, attack: 0.018, playback: 1.62 });
      tone({ wave: 'sine', from: 510, to: 360, volume: 0.009, duration: 0.065, delay: 0.045, attack: 0.006 });
      break;
    case 'vomit':
      // Islak püskürme + boğazdan gelen düzensiz, kalın gurultu.
      noise({ filterType: 'lowpass', from: 720, to: 260, q: 0.95, volume: 0.085, duration: 0.3, attack: 0.012, playback: 0.72 });
      tone({ wave: 'sawtooth', from: 92, to: 43, volume: 0.052, duration: 0.26, attack: 0.018 });
      tone({ wave: 'sine', from: 58, to: 31, volume: 0.035, duration: 0.18, delay: 0.07, attack: 0.01 });
      break;
    case 'poop':
      // Tek, tok ve kısa plop; kusmuk gibi sürekli akış içermez.
      tone({ wave: 'sine', from: 118, to: 32, volume: 0.13, duration: 0.19, attack: 0.002 });
      noise({ filterType: 'lowpass', from: 310, to: 120, q: 0.75, volume: 0.052, duration: 0.1, delay: 0.018, attack: 0.002, playback: 0.58 });
      tone({ wave: 'triangle', from: 62, to: 27, volume: 0.04, duration: 0.12, delay: 0.065, attack: 0.004 });
      break;
    case 'jump':
      // Yerden itiş: kısa bot baskısı ve yukarı açılan kıyafet hışırtısı.
      tone({ wave: 'sine', from: 104, to: 72, volume: 0.048, duration: 0.075, attack: 0.002 });
      noise({ filterType: 'bandpass', from: 760, to: 1850, q: 0.72, volume: 0.058, duration: 0.12, attack: 0.008, playback: 1.18 });
      break;
    default:
      break;
  }
}

function calculateWeaponDamage(zone, distance, melee = false) {
  const safeZone = zone === 'head' ? 'head' : zone === 'limb' ? 'limb' : 'torso';
  const multiplier = safeZone === 'head'
    ? DAMAGE_MODEL.headMultiplier
    : safeZone === 'limb'
      ? DAMAGE_MODEL.limbMultiplier
      : DAMAGE_MODEL.torsoMultiplier;
  const baseDamage = melee ? 39 : DAMAGE_MODEL.rifleBase;
  const rangeFactor = melee ? 1 : Math.pow(DAMAGE_MODEL.rangeModifier, Math.max(0, distance) / DAMAGE_MODEL.rangeReference);
  const rawDamage = Math.round(baseDamage * multiplier * rangeFactor);
  if (safeZone === 'head') return THREE.MathUtils.clamp(rawDamage, melee ? 55 : 32, melee ? 82 : 100);
  return THREE.MathUtils.clamp(rawDamage, DAMAGE_MODEL.minimumDamage, DAMAGE_MODEL.nonHeadMaximum);
}

function damageBot(bot, zone, overrideDamage = null) {
  if (!bot || bot.dead || bot.team === state.team) return { hit: false, killed: false, damage: 0 };
  const damage = overrideDamage ?? calculateWeaponDamage(zone, 0);
  const appliedDamage = Math.min(bot.health, Math.max(1, Math.round(damage)));
  bot.health = Math.max(0, bot.health - appliedDamage);
  bot.lastDamage = 0;
  updateBotNameplate(bot);
  state.score += appliedDamage;
  if (bot.health <= 0) {
    bot.dead = true;
    bot.deathTime = 0;
    bot.deaths += 1;
    bot.score = Math.max(0, bot.score - DEATH_SCORE_PENALTY);
    state.kills += 1;
    state.score += 100;
    addKillFeed(
      { name: state.playerName, team: state.team, countryCode: state.countryCode },
      { name: bot.name, team: bot.team, countryCode: bot.countryCode },
      state.weapon === 1 ? 'sword' : 'rifle',
    );
    showToast(`${zone === 'head' ? localized('KAFA ATIŞI', 'HEADSHOT') : localized('RAKİP DÜŞTÜ', 'ENEMY DOWN')} · +100`);
    return { hit: true, killed: true, damage: appliedDamage };
  }
  showToast(`${zone === 'head' ? localized('KAFA', 'HEAD') : localized('İSABET', 'HIT')} · -${appliedDamage} ${localized('CAN', 'HEALTH')}`);
  return { hit: true, killed: false, damage: appliedDamage };
}

function firstSolidHitBetween(start, end, padding = 0.02) {
  const direction = end.clone().sub(start);
  const distance = direction.length();
  if (distance <= 0.001) return null;
  direction.multiplyScalar(1 / distance);
  raycaster.set(start, direction);
  raycaster.far = distance + padding;
  const hit = raycaster.intersectObjects(bulletSurfaces, false)[0];
  if (!hit || hit.distance > distance + padding) return null;
  return {
    hit,
    point: hit.point.clone(),
    normal: hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize(),
    direction,
    distance: hit.distance,
  };
}

function performSniperShot() {
  state.actionTime = 0.22;
  state.actionDuration = 0.22;
  state.actionKind = 'shot';
  camera.updateMatrixWorld(true);
  friendlyFigures.updateMatrixWorld(true);
  cameraRay(0, 0);
  raycaster.set(camera.position, rayDirection);
  const maximumRange = state.aiming ? 760 : 320;
  raycaster.far = maximumRange;
  const hit = raycaster.intersectObjects([...combatTargets, ...bulletSurfaces], false)[0];
  viewModel.updateMatrixWorld(true);
  const visualMuzzle = state.thirdPerson
    ? playerAvatar.localToWorld(new THREE.Vector3(0.25, 1.28, 0.42))
    : viewModel.userData.muzzle.getWorldPosition(new THREE.Vector3());
  const start = state.thirdPerson
    ? visualMuzzle.clone()
    : camera.position.clone().addScaledVector(rayDirection, 0.1);
  const muzzleObstruction = state.thirdPerson
    ? firstSolidHitBetween(new THREE.Vector3(playerPosition.x, state.feetY + 1.3, playerPosition.z), start, 0.08)
    : null;
  if (muzzleObstruction) {
    const safeStart = camera.position.clone().addScaledVector(
      muzzleObstruction.direction,
      Math.max(0.015, muzzleObstruction.distance - 0.055),
    );
    beamPool.add(safeStart, muzzleObstruction.point, TEAM[state.team].soft, 0.018, 0.12);
    globPool.add(safeStart, muzzleObstruction.point, 0xfff1c7, 0.17);
    impactBullet({
      hit: muzzleObstruction.hit,
      point: muzzleObstruction.point,
      normal: muzzleObstruction.normal,
      travelDistance: muzzleObstruction.distance,
    });
    playActionSound('gun');
    return;
  }
  const end = hit ? hit.point : camera.position.clone().addScaledVector(rayDirection, maximumRange);
  const launchDirection = end.clone().sub(start).normalize();
  // Dürbün açıkken namlu çıkış hızı ve balistik katsayı artar: ilk yüzlerce metre neredeyse düz.
  const muzzleSpeed = state.aiming ? 720 : 480;
  const projectileGravity = state.aiming ? 1.35 : 9.81;
  ballisticPool.fire(start, launchDirection.clone().multiplyScalar(muzzleSpeed), TEAM[state.team].soft, 0.14, projectileGravity);
  globPool.add(visualMuzzle, visualMuzzle.clone().addScaledVector(launchDirection, 0.52), 0xfff1c7, 0.17);
  playActionSound('gun');
}

function performSwordSwing() {
  state.actionTime = 0.34;
  state.actionDuration = 0.34;
  state.actionKind = 'sword';
  cameraRay(0, 0);
  raycaster.set(camera.position, rayDirection);
  raycaster.far = 3.25;
  const hit = raycaster.intersectObjects(combatTargets, false)[0];
  const swordEnd = camera.position.clone().addScaledVector(rayDirection, 3.25);
  const playerReachOrigin = new THREE.Vector3(playerPosition.x, state.feetY + 1, playerPosition.z);
  const massHit = massArmy?.raycastSegment(camera.position, swordEnd, state.team, 1.85)
    || massArmy?.findMeleeTarget(playerReachOrigin, rayDirection, state.team, 3.55, 0.42);
  playActionSound('sword');
  const detailedDistance = hit && playerReachOrigin.distanceTo(hit.point) <= 3.55 ? camera.position.distanceTo(hit.point) : Infinity;
  const massDistance = massHit && playerReachOrigin.distanceTo(massHit.point) <= 3.55 ? camera.position.distanceTo(massHit.point) : Infinity;
  if (massHit && massDistance < detailedDistance) {
    const remoteTarget = massArmy.getAgentInfo(massHit.massIndex);
    if (remoteTarget?.id && multiplayer?.sendEvent({
      kind: 'damage',
      targetId: remoteTarget.id,
      weapon: 'sword',
      zone: massHit.damageZone,
      distance: massDistance,
    })) {
      showToast(localized('KILIÇ DARBESİ GÖNDERİLDİ', 'SWORD STRIKE SENT'));
      return;
    }
    const outcome = massArmy.damageAgent(massHit.massIndex, calculateWeaponDamage(massHit.damageZone, massDistance, true), massHit.damageZone);
    state.score += outcome.damage + (outcome.killed ? 100 : 0);
    if (outcome.killed) {
      state.kills += 1;
      addKillFeed(
        { name: state.playerName, team: state.team, countryCode: state.countryCode },
        outcome,
        'sword',
      );
    }
    showToast(outcome.killed ? `${outcome.name} ${localized('KILIÇLA DÜŞTÜ', 'FELL TO THE SWORD')} · +100` : `${localized('KILIÇ İSABETİ', 'SWORD HIT')} · -${outcome.damage} ${localized('CAN', 'HEALTH')}`);
  } else if (hit?.object.userData.bot && Number.isFinite(detailedDistance)) {
    const zone = hit.object.userData.damageZone;
    damageBot(hit.object.userData.bot, zone, calculateWeaponDamage(zone, detailedDistance, true));
  } else showToast(localized('KILIÇ ISKALADI', 'SWORD MISSED'));
}

function performPee(aimResult = state.paintTarget) {
  state.actionTime = 0.34;
  state.actionDuration = 0.34;
  state.actionKind = 'pee';
  const start = getEmissionStart('pee');
  const direction = aimResult?.hit
    ? aimResult.hit.point.clone().sub(start).normalize()
    : cameraRay(0, 0).clone();
  const result = tracePaintPath(start, direction, 150, 2);
  if (state.soundCooldown <= 0) {
    playActionSound('pee');
    state.soundCooldown = 0.16;
  }
  const path = result.path.length ? result.path : [result.escaped].filter(Boolean);
  let segmentStart = start;
  for (const pathPoint of path) {
    const distance = segmentStart.distanceTo(pathPoint);
    let previous = segmentStart;
    for (let segment = 1; segment <= 4; segment += 1) {
      const t = segment / 4;
      const next = segmentStart.clone().lerp(pathPoint, t);
      next.y -= Math.sin(t * Math.PI) * Math.min(2.4, distance * 0.022);
      beamPool.add(previous, next, WASTE_STYLE[state.team].pee, 0.024 + (1 - t) * 0.017, 0.11);
      previous = next;
    }
    segmentStart = pathPoint;
  }
  if (!result.hit) return;
  placeWastePaint(result.hit.point, THREE.MathUtils.randFloat(0.35, 0.55), 'pee');
  const splashStart = result.hit.point.clone().addScaledVector(result.normal, 0.35);
  for (let i = 0; i < Math.max(1, Math.round(3 * activeProfile.effectDensity)); i += 1) {
    const splashEnd = result.hit.point.clone().add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.7), 0.04, THREE.MathUtils.randFloatSpread(0.7)));
    globPool.add(splashStart, splashEnd, WASTE_STYLE[state.team].pee, THREE.MathUtils.randFloat(0.045, 0.085));
  }
}

function performVomit(aimResult = state.paintTarget) {
  state.actionTime = 0.34;
  state.actionDuration = 0.46;
  state.actionTime = state.actionDuration;
  state.actionKind = 'vomit';
  const start = getEmissionStart('vomit');
  playActionSound('vomit');
  const globCount = Math.max(2, Math.round(7 * activeProfile.effectDensity));
  for (let i = 0; i < globCount; i += 1) {
    const direction = aimResult?.hit
      ? aimResult.hit.point.clone().sub(start).normalize()
      : cameraRay(0, 0).clone();
    direction.add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.1), THREE.MathUtils.randFloatSpread(0.07), THREE.MathUtils.randFloatSpread(0.1))).normalize();
    const result = tracePaintPath(start, direction, 58, 2);
    if (result.hit) placeWastePaint(result.hit.point, THREE.MathUtils.randFloat(0.55, 0.95), 'vomit');
    const particleColor = new THREE.Color(WASTE_STYLE[state.team].vomit)
      .lerp(new THREE.Color(TEAM[state.team].color), THREE.MathUtils.randFloat(0.08, 0.2));
    let previous = start;
    for (const pathPoint of result.path) {
      globPool.add(previous, pathPoint, particleColor, THREE.MathUtils.randFloat(0.11, 0.24));
      previous = pathPoint;
    }
    if (result.escaped) globPool.add(previous, result.escaped, particleColor, THREE.MathUtils.randFloat(0.11, 0.2));
  }
}

function performPoop(aimResult = state.paintTarget) {
  state.actionTime = 0.34;
  state.actionDuration = 0.52;
  state.actionTime = state.actionDuration;
  state.actionKind = 'poop';
  const position = getEmissionStart('poop');
  let velocity;
  if (aimResult?.hit && !state.thirdPerson) {
    const distance = position.distanceTo(aimResult.hit.point);
    const flightTime = THREE.MathUtils.clamp(distance / 26, 0.38, 1.5);
    velocity = aimResult.hit.point.clone().sub(position).divideScalar(flightTime);
    velocity.y += 9.5 * flightTime;
  } else {
    const direction = state.thirdPerson
      ? new THREE.Vector3(0, -0.14, -1).applyQuaternion(playerAvatar.quaternion).normalize()
      : new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    velocity = direction.multiplyScalar(state.thirdPerson ? 12 : 34).add(new THREE.Vector3(0, state.thirdPerson ? 1.6 : 10, 0));
  }
  poopPool.fire(position, velocity, WASTE_STYLE[state.team].poop);
  playActionSound('poop');
}

function updatePaintAimMarker() {
  const active = state.mode === 1 && state.mouseRight && state.locked && !state.mapOpen && !state.dead;
  state.paintCharging = active;
  if (!active) {
    state.paintTarget = null;
    paintAimMarker.visible = false;
    paintAimColumn.visible = false;
    paintAimGlow.visible = false;
    return;
  }
  const result = rayFromCameraToGround(0, 0, 180);
  state.paintTarget = result && (result.hit || result.path.length) ? result : null;
  paintAimMarker.visible = Boolean(result?.hit);
  paintAimColumn.visible = Boolean(result?.hit);
  paintAimGlow.visible = Boolean(result?.hit);
  if (!result?.hit) return;
  const wasteType = WASTE_TYPES[state.wasteIndex];
  const color = WASTE_STYLE[state.team][wasteType];
  const targetRadius = wasteType === 'pee' ? 5.5 : wasteType === 'vomit' ? 9.5 : 6.8;
  paintAimMaterial.color.setHex(color);
  paintAimColumnMaterial.color.setHex(color);
  paintAimGlow.material.color.setHex(color);
  paintAimMarker.position.copy(result.hit.point).addScaledVector(result.normal, 0.035);
  paintAimMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), result.normal);
  const pulse = 1 + Math.sin(performance.now() * 0.009) * 0.12;
  paintAimMarker.scale.setScalar(targetRadius / 0.78 * pulse);
  paintAimColumn.position.set(result.hit.point.x, result.hit.point.y + 4, result.hit.point.z);
  paintAimColumn.scale.set(targetRadius * pulse, 1, targetRadius * pulse);
  paintAimGlow.position.set(result.hit.point.x, result.hit.point.y + 0.055, result.hit.point.z);
  paintAimGlow.scale.setScalar(targetRadius * 1.35 * pulse);
}

function releasePaintAction() {
  if (state.paintCadence > 0 || state.dead) return;
  const aimResult = state.paintTarget || rayFromCameraToGround(0, 0, 180);
  if (!aimResult || (!aimResult.hit && !aimResult.path?.length)) return;
  const wasteType = WASTE_TYPES[state.wasteIndex];
  state.paintCadence = wasteType === 'pee' ? 0.34 : wasteType === 'vomit' ? 0.58 : 0.78;
  if (wasteType === 'pee') performPee(aimResult);
  if (wasteType === 'vomit') performVomit(aimResult);
  if (wasteType === 'poop') performPoop(aimResult);
}

function updateCombat(delta) {
  state.shotCooldown = Math.max(0, state.shotCooldown - delta);
  state.paintCadence = Math.max(0, state.paintCadence - delta);
  state.soundCooldown = Math.max(0, state.soundCooldown - delta);
  state.aiming = Boolean(state.mode === 0 && state.weapon === 0 && state.mouseRight && state.locked && !state.mapOpen && !state.dead && !state.thirdPerson && !state.shieldActive);
  scopeOverlay.classList.toggle('hidden', !state.aiming);
  hud.classList.toggle('aiming', state.aiming);
  updatePaintAimMarker();
  if (!state.locked || state.mapOpen || state.dead || state.matchEnded || !state.team) return;

  if (state.mode === 0 && state.mouseLeft && state.shotCooldown <= 0) {
    state.shotCooldown = state.weapon === 0 ? MODES[0].cooldown : 0.68;
    if (state.weapon === 0) performSniperShot();
    else performSwordSwing();
    updateWeaponUI();
  }

  if (state.mode === 1 && state.mouseLeft && state.paintCadence <= 0) releasePaintAction();
}

function impactProjectile(point) {
  placeWastePaint(point, 0.68, 'poop');
  const splatterCount = Math.max(2, Math.round(5 * activeProfile.effectDensity));
  for (let i = 0; i < splatterCount; i += 1) {
    const offset = new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.6), 0, THREE.MathUtils.randFloatSpread(1.6));
    placeWastePaint(point.clone().add(offset), THREE.MathUtils.randFloat(0.2, 0.38), 'poop');
  }
}

function testBulletCollision(previous, current) {
  const travel = current.clone().sub(previous);
  if (travel.lengthSq() < 0.00001) return null;
  raycaster.set(previous, travel.clone().normalize());
  raycaster.far = travel.length() + 0.08;
  const hit = raycaster.intersectObjects([...combatTargets, ...bulletSurfaces], false)[0];
  const massHit = massArmy?.raycastSegment(previous, current, state.team);
  if (!hit) return massHit || null;
  if (massHit && previous.distanceToSquared(massHit.point) < previous.distanceToSquared(hit.point)) return massHit;
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
  return { hit, point: hit.point, normal };
}

function impactBullet(result) {
  const zone = result.damageZone || result.hit?.object.userData.damageZone || 'torso';
  const travelDistance = result.travelDistance || 0;
  const damage = calculateWeaponDamage(zone, travelDistance);
  if (result.massIndex != null) {
    const remoteTarget = massArmy.getAgentInfo(result.massIndex);
    if (remoteTarget?.id && multiplayer?.sendEvent({
      kind: 'damage',
      targetId: remoteTarget.id,
      weapon: 'rifle',
      zone,
      distance: travelDistance,
    })) return;
    const outcome = massArmy.damageAgent(result.massIndex, damage, zone);
    state.score += outcome.damage + (outcome.killed ? 100 : 0);
    if (outcome.killed) {
      state.kills += 1;
      addKillFeed(
        { name: state.playerName, team: state.team, countryCode: state.countryCode },
        outcome,
        'rifle',
      );
      showToast(`${outcome.name} ${localized('DÜŞTÜ', 'DOWN')} · +100`);
    } else showToast(`${zone === 'head' ? localized('KAFA', 'HEAD') : localized('İSABET', 'HIT')} · -${outcome.damage} ${localized('CAN', 'HEALTH')} · ${Math.round(travelDistance)}M`);
    return;
  }
  if (result.hit.object.userData.bot) {
    damageBot(result.hit.object.userData.bot, zone, damage);
    return;
  }
  const index = bulletHolePool.add(result.point, result.normal, 0.13, 0x171512);
  bulletHoles.push({ index, life: 7.5 });
}

function testPoopCollision(previous, current, life) {
    const travel = current.clone().sub(previous);
    raycaster.set(previous, travel.clone().normalize());
    raycaster.far = travel.length() + 0.2;
    const hit = raycaster.intersectObjects(bulletSurfaces, false)[0];
    const floor = terrainHeightAt(current.x, current.z);
    if (hit) {
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      return { point: hit.point, normal, bounce: hit.object !== groundMesh && !hit.object.userData.paintable };
    }
    if (current.y <= floor + 0.15 || life <= 0) {
      return { point: new THREE.Vector3(current.x, floor + 0.04, current.z), normal: new THREE.Vector3(0, 1, 0) };
    }
    return null;
}

function updateEffects(delta) {
  beamPool.update(delta);
  globPool.update(delta);
  ballisticPool.update(delta, testBulletCollision, impactBullet, (start, end, color) => {
    beamPool.add(start, end, color, 0.018, 0.18);
  });
  poopPool.update(delta, testPoopCollision, impactProjectile);
  for (let index = bulletHoles.length - 1; index >= 0; index -= 1) {
    const hole = bulletHoles[index];
    hole.life -= delta;
    if (hole.life <= 0) {
      bulletHolePool.hide(hole.index);
      bulletHoles.splice(index, 1);
    }
  }
  if (terrainTextureDirty) {
    terrainPaintTexture.needsUpdate = true;
    terrainTextureDirty = false;
  }
}

function updateTeamCounts() {
  if (multiplayer?.connected) {
    const red = Math.max(0, Math.round(Number(multiplayer.serverTeamCounts?.red) || 0));
    const blue = Math.max(0, Math.round(Number(multiplayer.serverTeamCounts?.blue) || 0));
    redPlayerCount.textContent = `${red} ${currentLanguage === 'tr' ? 'kişi' : 'players'}`;
    bluePlayerCount.textContent = `${blue} ${currentLanguage === 'tr' ? 'kişi' : 'players'}`;
    leaderRedCount.textContent = red;
    leaderBlueCount.textContent = blue;
    menuRedCount.textContent = red;
    menuBlueCount.textContent = blue;
    return;
  }
  let red = bots.filter((bot) => bot.team === 'red' && !bot.dead).length;
  let blue = bots.filter((bot) => bot.team === 'blue' && !bot.dead).length;
  const massCounts = massArmy?.getAliveCounts();
  if (massCounts) {
    red += massCounts.red;
    blue += massCounts.blue;
  }
  if (state.started && !state.dead) {
    if (state.team === 'red') red += 1;
    else blue += 1;
  }
  redPlayerCount.textContent = `${red} ${currentLanguage === 'tr' ? 'kişi' : 'players'}`;
  bluePlayerCount.textContent = `${blue} ${currentLanguage === 'tr' ? 'kişi' : 'players'}`;
  leaderRedCount.textContent = red;
  leaderBlueCount.textContent = blue;
  menuRedCount.textContent = red;
  menuBlueCount.textContent = blue;
}

function findTeamClusterSpawn(team, excludedBot = null) {
  const teammates = bots.filter((bot) => bot !== excludedBot && bot.team === team && !bot.dead);
  if (teammates.length) {
    let best = teammates[0];
    let bestNearby = -1;
    for (const candidate of teammates) {
      const nearby = teammates.filter((other) => candidate.group.position.distanceTo(other.group.position) < 85).length;
      if (nearby > bestNearby) {
        best = candidate;
        bestNearby = nearby;
      }
    }
    const cluster = teammates.filter((other) => best.group.position.distanceTo(other.group.position) < 85);
    const x = cluster.reduce((sum, bot) => sum + bot.group.position.x, 0) / cluster.length;
    const z = cluster.reduce((sum, bot) => sum + bot.group.position.z, 0) / cluster.length;
    return { x: x + THREE.MathUtils.randFloatSpread(7), z: z + THREE.MathUtils.randFloatSpread(7) };
  }
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const x = THREE.MathUtils.randFloatSpread((WORLD.halfWidth - 70) * 2);
    const z = THREE.MathUtils.randFloatSpread((WORLD.halfDepth - 70) * 2);
    if (terrainHeightAt(x, z) > -8) return { x, z };
  }
  return { x: 0, z: 0 };
}

function spawnPlayerAtFort(team, preferredFort = null, preferredFallback = null) {
  const owned = fortData.filter((fort) => fort.team === team);
  const fort = preferredFallback ? null : preferredFort?.team === team ? preferredFort : owned[Math.floor(Math.random() * owned.length)];
  if (fort) {
    // Kale avlularının ortası boş ve korunaklıdır; doğuş doğrudan seçilen kalenin içinde yapılır.
    playerPosition.set(fort.x, 0, fort.z);
  } else {
    const fallback = preferredFallback || findTeamClusterSpawn(team);
    playerPosition.set(fallback.x, 0, fallback.z);
  }
  const spawnBaseX = playerPosition.x;
  const spawnBaseZ = playerPosition.z;
  const spawnBlocked = (x, z) => {
    const feetY = floorHeightAt(x, z);
    return collidesStaticAt(x, z, PLAYER.radius, feetY, PLAYER.bodyHeight) || massArmy?.collidesCircle(x, z, PLAYER.radius);
  };
  if (spawnBlocked(playerPosition.x, playerPosition.z)) {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const ring = 4 + Math.floor(attempt / 12) * 4;
      const angle = attempt / 12 * Math.PI * 2;
      const candidateX = spawnBaseX + Math.cos(angle) * ring;
      const candidateZ = spawnBaseZ + Math.sin(angle) * ring;
      if (!spawnBlocked(candidateX, candidateZ)) {
        playerPosition.x = candidateX;
        playerPosition.z = candidateZ;
        break;
      }
    }
  }
  state.feetY = floorHeightAt(playerPosition.x, playerPosition.z);
  state.yaw = team === 'red' ? Math.PI : 0;
  state.pitch = 0;
}

function spawnPlayerAtRandomFort(team) {
  spawnPlayerAtFort(team);
}

function ownedSpawnForts() {
  return fortData
    .map((fort, index) => ({ fort, index }))
    .filter(({ fort }) => fort.team === state.team);
}

function spawnFortLabel(fort) {
  return currentLanguage === 'tr'
    ? `${fort.team === 'red' ? 'Kırmızı' : 'Mavi'} Kale ${fort.index}`
    : `${fort.team === 'red' ? 'Red' : 'Blue'} Fort ${fort.index}`;
}

function updateSpawnSelectionCopy() {
  if (!state.spawnSelecting) return;
  bigMapTitle.textContent = t('spawn.title');
  spawnMapInstruction.textContent = t(state.spawnSelectionReason === 'initial' ? 'spawn.initial' : 'spawn.respawn');
  spawnMapInstruction.classList.remove('hidden');
  spawnMapStatus.classList.remove('hidden');
  bigMapCanvas.classList.toggle('waiting', state.spawnSelectionReason === 'respawn' && state.respawnTimer > 0);
  if (state.spawnSelectionReason === 'respawn' && state.respawnTimer > 0) {
    const seconds = Math.max(1, Math.ceil(state.respawnTimer));
    spawnMapStatus.textContent = state.spawnSelectedPoint
      ? t('spawn.selectedWait').replace('{seconds}', seconds)
      : t('spawn.wait').replace('{seconds}', seconds);
    return;
  }
  if (!state.spawnHoverPoint) {
    spawnMapStatus.textContent = t('spawn.ready');
    return;
  }
  const friends = state.spawnHoverCounts[state.team] || 0;
  const enemies = state.spawnHoverCounts[state.team === 'red' ? 'blue' : 'red'] || 0;
  if (state.spawnHoverValid) {
    spawnMapStatus.textContent = t('spawn.valid').replace('{friends}', friends);
  } else if (state.spawnHoverReason === 'spawn.enemies') {
    spawnMapStatus.textContent = t('spawn.enemies').replace('{enemies}', enemies);
  } else {
    spawnMapStatus.textContent = t(state.spawnHoverReason || 'spawn.invalid');
  }
}

function beginSpawnSelection(reason = 'initial') {
  // ESC ile açılan kontrol yardımının görünürlük durumu takım değişiminden
  // sonra HUD üzerinde kalmamalı; doğuş haritası her zaman etkileşimli olmalı.
  setControlHelpExpanded(false);
  state.spawnSelecting = true;
  state.spawnSelectionReason = reason;
  state.selectedSpawnFortIndex = -1;
  state.hoveredSpawnFortIndex = -1;
  state.spawnFallbackSelected = false;
  state.spawnFallbackPoint = null;
  state.spawnHoverPoint = null;
  state.spawnSelectedPoint = null;
  state.spawnHoverValid = false;
  state.spawnHoverReason = 'spawn.ready';
  state.spawnHoverCounts = { red: 0, blue: 0 };
  state.mapOpen = true;
  state.keys.clear();
  state.mouseLeft = false;
  state.mouseRight = false;
  state.firing = false;
  state.aiming = false;
  state.shieldActive = false;
  bigMap.classList.remove('hidden');
  bigMap.classList.add('spawn-selection');
  pauseScreen.classList.add('hidden');
  updateSpawnSelectionCopy();
  updateMaps();
  if (document.pointerLockElement) document.exitPointerLock?.();
}

function countSpawnAreaUnits(x, z) {
  const counts = massArmy?.getAreaCounts(x, z, SPAWN_SAFE_RADIUS) || { red: 0, blue: 0 };
  const radiusSquared = SPAWN_SAFE_RADIUS * SPAWN_SAFE_RADIUS;
  for (const bot of bots) {
    if (bot.dead) continue;
    const deltaX = bot.group.position.x - x;
    const deltaZ = bot.group.position.z - z;
    if (deltaX * deltaX + deltaZ * deltaZ > radiusSquared) continue;
    counts[bot.team] += 1;
  }
  return counts;
}

function evaluateSpawnArea(x, z) {
  const counts = countSpawnAreaUnits(x, z);
  const friends = counts[state.team] || 0;
  const enemies = counts[state.team === 'red' ? 'blue' : 'red'] || 0;
  const feetY = floorHeightAt(x, z);
  const insideWorld = Math.abs(x) <= WORLD.halfWidth - 34 && Math.abs(z) <= WORLD.halfDepth - 34;
  const ownedFort = fortData.some((fort) => fort.team === state.team && Math.abs(x - fort.x) <= fort.half - 2 && Math.abs(z - fort.z) <= fort.half - 2);
  const suitableTerrain = insideWorld && terrainHeightAt(x, z) > -9 && !collidesStaticAt(x, z, PLAYER.radius, feetY, PLAYER.bodyHeight);
  const reason = !suitableTerrain ? 'spawn.blocked' : enemies > 0 ? 'spawn.enemies' : friends < 1 && !ownedFort ? 'spawn.noFriends' : 'spawn.valid';
  return { x, z, counts, valid: reason === 'spawn.valid', reason };
}

function finishSpawnSelection(point = state.spawnSelectedPoint) {
  if (!state.spawnSelecting) return false;
  if (state.spawnSelectionReason === 'respawn' && state.respawnTimer > 0) return false;
  if (!point) return false;
  const currentArea = evaluateSpawnArea(point.x, point.z);
  if (!currentArea.valid) {
    state.spawnHoverPoint = { x: point.x, z: point.z };
    state.spawnHoverValid = false;
    state.spawnHoverReason = currentArea.reason;
    state.spawnHoverCounts = currentArea.counts;
    updateSpawnSelectionCopy();
    updateMaps();
    return false;
  }
  state.dead = false;
  state.respawnTimer = 0;
  state.health = 100;
  state.lastDamageTime = 99;
  state.stamina = 100;
  state.stance = 'stand';
  state.currentEyeHeight = PLAYER.eyeHeight;
  state.currentBodyHeight = PLAYER.bodyHeight;
  state.currentRadius = STANCE.stand.radius;
  state.velocityY = 0;
  spawnPlayerAtFort(state.team, null, currentArea);
  state.spawnSelecting = false;
  state.mapOpen = false;
  state.selectedSpawnFortIndex = -1;
  state.hoveredSpawnFortIndex = -1;
  state.spawnFallbackPoint = null;
  state.spawnFallbackSelected = false;
  state.spawnHoverPoint = null;
  state.spawnSelectedPoint = null;
  state.spawnHoverValid = false;
  bigMap.classList.add('hidden');
  bigMap.classList.remove('spawn-selection');
  bigMapCanvas.classList.remove('waiting');
  spawnMapInstruction.classList.add('hidden');
  spawnMapStatus.classList.add('hidden');
  bigMapTitle.textContent = t('hud.fieldMap');
  const pointerLockRequest = renderer.domElement.requestPointerLock?.();
  pointerLockRequest?.catch?.(() => {});
  showToast(state.spawnSelectionReason === 'initial'
    ? localized('SEÇTİĞİN KALEDE SAVAŞA KATILDIN', 'DEPLOYED AT THE SELECTED FORT')
    : localized('SEÇTİĞİN KALEDE YENİDEN DOĞDUN', 'RESPAWNED AT THE SELECTED FORT'));
  return true;
}

function spawnMapPointer(event) {
  const rect = bigMapCanvas.getBoundingClientRect();
  const canvasX = (event.clientX - rect.left) / rect.width * bigMapCanvas.width;
  const canvasY = (event.clientY - rect.top) / rect.height * bigMapCanvas.height;
  const x = -WORLD.halfWidth + canvasX / bigMapCanvas.width * WORLD.halfWidth * 2;
  const z = -WORLD.halfDepth + canvasY / bigMapCanvas.height * WORLD.halfDepth * 2;
  return evaluateSpawnArea(x, z);
}

function showDamageDirection(source) {
  if (!source) return;
  const yaw = state.thirdPerson ? state.freeYaw : state.yaw;
  const dx = source.x - playerPosition.x;
  const dz = source.z - playerPosition.z;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const localRight = dx * rightX + dz * rightZ;
  const localForward = dx * forwardX + dz * forwardZ;
  damageIndicator.style.setProperty('--damage-angle', `${Math.atan2(localRight, localForward)}rad`);
  damageIndicator.classList.remove('show');
  void damageIndicator.offsetWidth;
  damageIndicator.classList.add('show');
}

function shieldBlocksSource(source) {
  if (!state.shieldActive || state.mode !== 0 || state.weapon !== 1 || !source || state.dead || state.matchEnded) return false;
  const dx = source.x - playerPosition.x;
  const dz = source.z - playerPosition.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.001) return false;
  const forwardX = -Math.sin(state.yaw);
  const forwardZ = -Math.cos(state.yaw);
  const forwardDot = dx / distance * forwardX + dz / distance * forwardZ;
  return forwardDot >= 0.46;
}

function registerShieldBlock(source) {
  const announceBlock = state.shieldHitTime <= 0;
  state.shieldHitTime = 0.22;
  if (announceBlock) {
    playActionSound('shield');
    showToast(localized('KALKAN MERMİYİ DURDURDU', 'SHIELD BLOCKED THE BULLET'));
  }
  if (source) {
    const dx = source.x - playerPosition.x;
    const dz = source.z - playerPosition.z;
    const angle = Math.atan2(dx, dz);
    viewModel.userData.shield.rotation.z += Math.sin(angle - state.yaw) * 0.035;
  }
}

function shieldImpactPoint() {
  const forwardX = -Math.sin(state.yaw);
  const forwardZ = -Math.cos(state.yaw);
  return new THREE.Vector3(
    playerPosition.x + forwardX * 0.58,
    state.feetY + Math.min(1.08, state.currentBodyHeight * 0.66),
    playerPosition.z + forwardZ * 0.58,
  );
}

function hasLineOfSightToPlayer(source) {
  const target = tmpV1.set(playerPosition.x, state.feetY + Math.min(1.05, state.currentBodyHeight * 0.62), playerPosition.z);
  const direction = tmpV2.copy(target).sub(source);
  const distance = direction.length();
  if (distance < 0.01) return true;
  raycaster.set(source, direction.normalize());
  raycaster.far = Math.max(0, distance - 0.34);
  return raycaster.intersectObjects(bulletSurfaces, false).length === 0;
}

function damagePlayer(amount, source = null, attacker = null, weapon = 'rifle', authoritativeHealth = null) {
  if (state.dead || state.matchEnded) return false;
  if (authoritativeHealth == null && shieldBlocksSource(source)) {
    registerShieldBlock(source);
    return false;
  }
  showDamageDirection(source);
  state.health = authoritativeHealth == null
    ? Math.max(0, state.health - amount)
    : THREE.MathUtils.clamp(Number(authoritativeHealth) || 0, 0, 100);
  state.lastDamageTime = 0;
  if (state.health <= 0) {
    state.dead = true;
    state.deaths += 1;
    state.score = Math.max(0, state.score - DEATH_SCORE_PENALTY);
    state.respawnTimer = 3;
    state.mouseLeft = false;
    state.mouseRight = false;
    state.shieldActive = false;
    beginSpawnSelection('respawn');
    if (attacker) {
      addKillFeed(
        attacker,
        { name: state.playerName, team: state.team, countryCode: state.countryCode },
        weapon,
      );
      showBattleEvent(localized('DÜŞTÜN', 'YOU WERE DOWNED'), localized(`${attacker.name} seni vurdu. 3 saniye içinde yeniden doğacaksın.`, `${attacker.name} eliminated you. You will respawn in 3 seconds.`), attacker.team);
    }
    savePlayerStats();
    showToast(localized(`DÜŞTÜN · -${DEATH_SCORE_PENALTY} PUAN · HARİTADAN KALE SEÇ`, `YOU DIED · -${DEATH_SCORE_PENALTY} SCORE · SELECT A FORT ON THE MAP`));
  }
  return true;
}

function handleMassPlayerHit({ source, damage, attackerIndex }) {
  if (!NPC_PLAYER_COMBAT_ENABLED) return;
  if (!state.started || state.spawnSelecting || state.dead || !hasLineOfSightToPlayer(source)) return;
  const playerWasAlive = !state.dead;
  damagePlayer(damage, source, massArmy?.getAgentInfo(attackerIndex));
  if (playerWasAlive && state.dead) massArmy?.recordPlayerKill(attackerIndex);
}

function triggerBotAction(bot, kind, duration = 0.55) {
  bot.actionKind = kind;
  bot.actionDuration = duration;
  bot.actionTime = duration;
  bot.bodyRoot.updateMatrixWorld(true);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(bot.group.quaternion).normalize();
  const localStart = kind === 'vomit'
    ? new THREE.Vector3(0, 1.7, 0.24)
    : kind === 'poop'
      ? new THREE.Vector3(0, 0.73, -0.24)
      : new THREE.Vector3(0, 0.76, 0.28);
  const start = bot.bodyRoot.localToWorld(localStart);
  if (state.started) playActionSound(kind, start);
  const distance = kind === 'pee' ? 7.5 : kind === 'vomit' ? 5.4 : 2.5;
  const end = start.clone().addScaledVector(forward, distance);
  end.y = terrainHeightAt(end.x, end.z) + 0.05;
  if (kind === 'pee') {
    let previous = start;
    for (let segment = 1; segment <= 4; segment += 1) {
      const point = start.clone().lerp(end, segment / 4);
      point.y += Math.sin(segment / 4 * Math.PI) * 0.18;
      beamPool.add(previous, point, WASTE_STYLE[bot.team].pee, 0.035, 0.13);
      previous = point;
    }
    placeWastePaint(end, 0.48, 'pee', bot.team, false);
  } else if (kind === 'vomit') {
    for (let index = 0; index < 4; index += 1) {
      const spread = end.clone().add(new THREE.Vector3(THREE.MathUtils.randFloatSpread(0.8), 0, THREE.MathUtils.randFloatSpread(0.8)));
      globPool.add(start, spread, WASTE_STYLE[bot.team].vomit, THREE.MathUtils.randFloat(0.11, 0.2));
    }
    placeWastePaint(end, 0.72, 'vomit', bot.team, false);
  } else if (kind === 'poop') {
    globPool.add(start, end, WASTE_STYLE[bot.team].poop, 0.3);
    placeWastePaint(end, 0.68, 'poop', bot.team, false);
  }
}

function updateBots(delta) {
  for (const bot of bots) {
    if (state.started) bot.elapsedSeconds += delta;
    const cameraDx = bot.group.position.x - camera.position.x;
    const cameraDy = bot.group.position.y + 1.1 - camera.position.y;
    const cameraDz = bot.group.position.z - camera.position.z;
    const cameraDistance = Math.hypot(cameraDx, cameraDy, cameraDz);
    const maximumBotDistance = (activeTier === 'performance' ? 110 : activeTier === 'balanced' ? 150 : activeTier === 'high' ? 185 : 220) * Math.max(0.5, runtimeLodScale);
    const botViewDot = cameraDistance > 0.001
      ? (cameraDx * scopeFocusDirection.x + cameraDy * scopeFocusDirection.y + cameraDz * scopeFocusDirection.z) / cameraDistance
      : 1;
    bot.group.visible = cameraDistance < 25 || (cameraDistance <= maximumBotDistance && botViewDot >= scopeFocus.viewCosine);
    bot.lastDamage += delta;
    if (bot.dead) {
      bot.deathTime += delta;
      bot.group.rotation.z = THREE.MathUtils.lerp(bot.group.rotation.z, Math.PI / 2, Math.min(1, delta * 5));
      bot.group.position.y = Math.max(bot.fort.y + 0.18, bot.group.position.y - delta * 0.42);
      if (bot.deathTime >= 3) {
        const ownedForts = fortData.filter((fort) => fort.team === bot.team);
        let respawnFort = ownedForts[Math.floor(Math.random() * ownedForts.length)];
        if (!respawnFort) {
          const fallback = findTeamClusterSpawn(bot.team, bot);
          respawnFort = { x: fallback.x, z: fallback.z, y: terrainHeightAt(fallback.x, fallback.z) };
        }
        bot.fort = respawnFort;
        bot.originX = respawnFort.x + randomRange(-7, 7);
        bot.originZ = respawnFort.z + randomRange(-7, 7);
        bot.dead = false;
        bot.health = 100;
        bot.lastDamage = 99;
        bot.stance = 'stand';
        bot.actionKind = 'idle';
        bot.actionTime = 0;
        bot.weapon = 'rifle';
        bot.shieldActive = false;
        bot.meleeApplied = false;
        bot.jumpTime = 0;
        bot.group.rotation.z = 0;
        bot.group.position.set(bot.originX, respawnFort.y, bot.originZ);
        updateBotNameplate(bot);
      }
      continue;
    }

    if (bot.lastDamage > 4 && bot.health < 100) {
      const previousHealth = Math.floor(bot.health);
      bot.health = Math.min(100, bot.health + delta * 5);
      if (Math.floor(bot.health) !== previousHealth) updateBotNameplate(bot);
    }

    bot.actionTime = Math.max(0, bot.actionTime - delta);
    if (bot.actionTime <= 0) {
      const loweredShield = bot.shieldActive;
      bot.actionKind = 'idle';
      bot.weapon = 'rifle';
      bot.shieldActive = false;
      bot.meleeApplied = false;
      if (loweredShield && state.started) {
        playActionSound('shieldLower', bot.group.position.clone().add(new THREE.Vector3(0, 1.05, 0)));
      }
    }
    bot.jumpTime = Math.max(0, bot.jumpTime - delta);
    bot.stateTimer -= delta;
    let queuedAction = null;
    if (bot.stateTimer <= 0) {
      const choice = Math.random();
      bot.stance = choice < 0.14 ? 'crouch' : choice < 0.22 ? 'prone' : 'stand';
      if (choice >= 0.22 && choice < 0.3) {
        bot.jumpTime = 0.72;
        if (state.started) playActionSound('jump', bot.group.position);
      }
      else if (choice >= 0.3 && choice < 0.48) queuedAction = WASTE_TYPES[Math.floor(Math.random() * WASTE_TYPES.length)];
      else if (choice >= 0.48 && choice < 0.58) {
        bot.actionKind = 'sword';
        bot.actionDuration = 0.48;
        bot.actionTime = 0.48;
        bot.weapon = 'sword';
        bot.shieldActive = true;
        bot.meleeApplied = false;
        if (state.started) {
          const actionPosition = bot.group.position.clone().add(new THREE.Vector3(0, 1.05, 0));
          playActionSound('sword', actionPosition);
          playActionSound('shieldRaise', actionPosition);
        }
      }
      bot.stateTimer = randomRange(2.3, 5.2);
    }

    const movementFactor = bot.stance === 'prone' ? 0.34 : bot.stance === 'crouch' ? 0.62 : 1;
    const movementPaused = ['pee', 'vomit', 'poop', 'sword'].includes(bot.actionKind) && bot.actionTime > 0;
    const previousX = bot.group.position.x;
    const previousZ = bot.group.position.z;
    bot.patrol += delta * 0.46 * movementFactor * (movementPaused ? 0.08 : 1);
    bot.group.position.x = bot.originX + Math.sin(bot.patrol) * 3.2;
    bot.group.position.z = bot.originZ + Math.cos(bot.patrol) * 3.2;
    const botFloor = floorHeightAt(bot.group.position.x, bot.group.position.z);
    if (collidesStaticAt(bot.group.position.x, bot.group.position.z, 0.3, botFloor, 1.82)) {
      bot.group.position.x = previousX;
      bot.group.position.z = previousZ;
      bot.patrol += 0.86;
    }
    const jumpProgress = bot.jumpTime > 0 ? 1 - bot.jumpTime / 0.72 : 0;
    bot.jumpOffset = bot.jumpTime > 0 ? Math.sin(jumpProgress * Math.PI) * 0.78 : 0;
    bot.group.position.y = floorHeightAt(bot.group.position.x, bot.group.position.z) + bot.jumpOffset;
    const moveX = bot.group.position.x - previousX;
    const moveZ = bot.group.position.z - previousZ;
    if (Math.hypot(moveX, moveZ) > 0.0001) bot.group.rotation.y = Math.atan2(moveX, moveZ);
    bot.footstepTimer -= delta;
    if (bot.stance !== 'prone' && Math.hypot(moveX, moveZ) > 0.0007 && cameraDistance < 58 && bot.footstepTimer <= 0) {
      const stepMode = bot.stance === 'crouch' ? 'crouch' : 'walk';
      bot.footstepTimer = playFootstepSound(stepMode, bot.group.position, false) + randomRange(-0.035, 0.045);
    }
    if (queuedAction) triggerBotAction(bot, queuedAction, queuedAction === 'pee' ? 0.5 : 0.68);

    if (NPC_PLAYER_COMBAT_ENABLED && state.started && !state.spawnSelecting && !state.dead && bot.team !== state.team) {
      const distance = Math.hypot(playerPosition.x - bot.group.position.x, playerPosition.z - bot.group.position.z);
      bot.shotTimer -= delta;
      if (distance < 72) bot.group.rotation.y = Math.atan2(playerPosition.x - bot.group.position.x, playerPosition.z - bot.group.position.z);
      if (distance < 72 && bot.shotTimer <= 0) {
        bot.equipment.updateMatrixWorld(true);
        const start = bot.equipment.userData.rifleMuzzle.getWorldPosition(new THREE.Vector3());
        if (hasLineOfSightToPlayer(start)) {
          bot.shotTimer = randomRange(1.5, 2.7);
          bot.stance = Math.random() < 0.35 ? 'crouch' : 'stand';
          bot.actionKind = 'shot';
          bot.actionDuration = 0.28;
          bot.actionTime = 0.28;
          bot.weapon = 'rifle';
          bot.shieldActive = false;
          const hitChance = THREE.MathUtils.clamp(0.86 - distance / 150, 0.35, 0.8);
          let beamEnd = camera.position.clone();
          if (Math.random() < hitChance) {
            const zoneRoll = Math.random();
            const zoneFactor = zoneRoll < 0.1 ? 1.55 : zoneRoll > 0.75 ? 0.65 : 1;
            const distanceFactor = THREE.MathUtils.clamp(1 - distance / 150, 0.42, 1);
            const playerWasAlive = !state.dead;
            const damageApplied = damagePlayer(
              Math.max(4, Math.round(17 * distanceFactor * zoneFactor)),
              start,
              { name: bot.name, team: bot.team, countryCode: bot.countryCode },
            );
            if (playerWasAlive && state.dead) {
              bot.kills += 1;
              bot.score += 100;
            }
            if (!damageApplied && shieldBlocksSource(start)) beamEnd = shieldImpactPoint();
          }
          beamPool.add(start, beamEnd, TEAM[bot.team].soft, 0.01, 0.08);
          playActionSound('gun', start);
        } else bot.shotTimer = 0.45;
      }
    }

    if (
      NPC_PLAYER_COMBAT_ENABLED && state.started && !state.spawnSelecting && !state.dead && bot.team !== state.team && bot.actionKind === 'sword' &&
      bot.actionTime > 0 && !bot.meleeApplied
    ) {
      const meleeDistance = Math.hypot(playerPosition.x - bot.group.position.x, playerPosition.z - bot.group.position.z);
      if (meleeDistance <= 3.55) {
        bot.meleeApplied = true;
        const playerWasAlive = !state.dead;
        damagePlayer(34, bot.group.position.clone().add(new THREE.Vector3(0, 1.1, 0)), {
          name: bot.name, team: bot.team, countryCode: bot.countryCode,
        });
        if (playerWasAlive && state.dead) {
          bot.kills += 1;
          bot.score += 100;
        }
      }
    }

    if (bot.group.visible) {
      animateHumanoid(bot.rig, {
        stance: bot.stance,
        moving: !movementPaused,
        moveAmount: movementPaused ? 0 : 0.82,
        sprinting: false,
        phase: bot.patrol * 8.5,
        jumping: bot.jumpTime > 0,
        aiming: bot.actionKind === 'shot',
        actionKind: bot.actionKind,
        actionTime: bot.actionTime,
        actionDuration: bot.actionDuration,
        weapon: ['pee', 'vomit', 'poop'].includes(bot.actionKind) ? 'none' : bot.weapon,
        showShield: true,
        shieldActive: bot.weapon === 'sword' && bot.shieldActive,
      }, delta);
      bot.label.position.y = THREE.MathUtils.lerp(bot.label.position.y, bot.stance === 'prone' ? 1.22 : bot.stance === 'crouch' ? 1.78 : 2.35, Math.min(1, delta * 10));
    }
  }

  state.lastDamageTime += delta;
  if (state.started && !state.dead && state.lastDamageTime > 4 && state.health < 100) {
    state.health = Math.min(100, state.health + delta * 6);
  }
  if (state.dead) {
    state.respawnTimer = Math.max(0, state.respawnTimer - delta);
    if (state.spawnSelecting) updateSpawnSelectionCopy();
  }
}

function setFortOwner(fort, team, broadcast = true, notify = true, awardScore = true) {
  const previousTeam = fort.team;
  if (previousTeam === team) return;
  const fortCode = `${t(fort.originalTeam === 'red' ? 'team.redLetter' : 'team.blueLetter')}${fort.index}`;
  fort.team = team;
  if (state.spawnSelecting && state.selectedSpawnFortIndex === fortData.indexOf(fort) && team !== state.team) {
    state.selectedSpawnFortIndex = -1;
    showToast(t('spawn.invalid'));
    updateSpawnSelectionCopy();
  }
  fort.captureProgress = 0;
  fort.captureTeam = null;
  fort.flag.material.color.setHex(TEAM[team].color);
  fort.flag.material.needsUpdate = true;
  fort.flagLabel?.material.color.setHex(TEAM[team].color);
  const teamColor = new THREE.Color(TEAM[team].color);
  fort.colorMaterials.stone.color.copy(teamColor).lerp(new THREE.Color(0x777a76), 0.28);
  fort.colorMaterials.dark.color.copy(teamColor).lerp(new THREE.Color(0x343a39), 0.38);
  fort.colorMaterials.foundation.color.copy(teamColor).lerp(new THREE.Color(0x252a29), 0.46);
  fort.colorMaterials.gateSign.color.setHex(TEAM[team].color);
  Object.values(fort.colorMaterials).forEach((material) => { material.needsUpdate = true; });
  // Ele geçirilen kalenin avlusu da yeni sahibin rengine gerçek arazi dokusu üzerinde döner.
  paintFortGround(fort, team);
  fort.name = currentLanguage === 'tr' ? `${team === 'red' ? 'Kırmızı' : 'Mavi'} Karakol ${fort.index}` : `${team === 'red' ? 'Red' : 'Blue'} Fort ${fort.index}`;
  if (awardScore && state.team === team) state.score += 250;
  if (broadcast) multiplayer?.sendEvent({ kind: 'fort', fortIndex: fortData.indexOf(fort) });
  if (!notify) return;
  showToast(`${fort.name.toUpperCase()} ${localized('ELE GEÇİRİLDİ', 'CAPTURED')} · ${team === 'red' ? t('team.redShort') : t('team.blueShort')}`);
  const playerLostFort = state.team === previousTeam && state.team !== team;
  showBattleEvent(
    playerLostFort
      ? localized(`${fortCode} KAYBEDİLDİ`, `${fortCode} LOST`)
      : localized(`${fortCode} ELE GEÇİRİLDİ`, `${fortCode} CAPTURED`),
    localized(
      `${TEAM[team].name}, karakolu ${TEAM[previousTeam].name} takımından aldı.`,
      `${TEAM[team].name} took the fort from ${TEAM[previousTeam].name}.`,
    ),
    team,
  );
}

let lastNetworkEventId = 0;

function networkEventSource(event) {
  return Array.isArray(event?.source) && event.source.length >= 3
    ? new THREE.Vector3(Number(event.source[0]) || 0, Number(event.source[1]) || 0, Number(event.source[2]) || 0)
    : null;
}

function handleNetworkGameEvent(event) {
  if (!event || typeof event !== 'object') return;
  const eventId = Math.max(0, Math.round(Number(event.eventId) || 0));
  if (eventId && eventId <= lastNetworkEventId) return;
  if (eventId) lastNetworkEventId = eventId;

  if (event.kind === 'paint') {
    if (event.sourceId === multiplayer?.clientId) return;
    const team = event.team === 'blue' ? 'blue' : 'red';
    const wasteType = ['pee', 'vomit', 'poop'].includes(event.wasteType) ? event.wasteType : null;
    if (!wasteType) return;
    const impactPoint = new THREE.Vector3(Number(event.x) || 0, Number(event.y) || terrainHeightAt(Number(event.x) || 0, Number(event.z) || 0), Number(event.z) || 0);
    const emitter = massArmy?.getAgentInfoById(event.sourceId);
    if (emitter) {
      const startHeight = wasteType === 'vomit' ? 1.68 : wasteType === 'poop' ? 0.72 : 0.78;
      const start = new THREE.Vector3(emitter.x, emitter.y + startHeight, emitter.z);
      if (wasteType === 'pee') beamPool.add(start, impactPoint, WASTE_STYLE[team].pee, 0.032, 0.16);
      else globPool.add(start, impactPoint, WASTE_STYLE[team][wasteType], wasteType === 'vomit' ? 0.2 : 0.24);
      playActionSound(wasteType, start);
    }
    placeWastePaint(
      impactPoint,
      THREE.MathUtils.clamp(Number(event.radius) || 0.1, 0.1, 2),
      wasteType,
      team,
      false,
    );
    return;
  }

  if (event.kind === 'fort') {
    if (event.sourceId === multiplayer?.clientId) return;
    const fort = fortData[Math.round(Number(event.fortIndex))];
    const team = event.team === 'blue' ? 'blue' : 'red';
    if (fort && fort.team !== team) setFortOwner(fort, team, false, true, true);
    return;
  }

  if (event.kind === 'blocked') {
    const source = networkEventSource(event);
    if (event.targetId === multiplayer?.clientId) registerShieldBlock(source);
    if (event.sourceId === multiplayer?.clientId) showToast(localized('KALKAN MERMİYİ DURDURDU', 'THE SHIELD BLOCKED THE HIT'));
    return;
  }

  if (event.kind !== 'damage') return;
  const source = networkEventSource(event);
  const attacker = event.attacker || null;
  const victim = event.victim || null;
  const weapon = event.weapon === 'sword' ? 'sword' : 'rifle';
  if (event.targetId === multiplayer?.clientId) {
    damagePlayer(Number(event.damage) || 0, source, attacker, weapon, Number(event.health));
    if (event.targetStats) {
      state.score = Math.max(0, Number(event.targetStats.score) || 0);
      state.deaths = Math.max(0, Math.round(Number(event.targetStats.deaths) || 0));
    }
    savePlayerStats();
    return;
  }

  if (event.sourceId === multiplayer?.clientId) {
    if (event.attackerStats) {
      state.score = Math.max(0, Number(event.attackerStats.score) || 0);
      state.kills = Math.max(0, Math.round(Number(event.attackerStats.kills) || 0));
    }
    if (event.killed) {
      addKillFeed(attacker, victim, weapon);
      showToast(`${victim?.name || localized('RAKİP', 'RIVAL')} ${localized('DÜŞTÜ', 'DOWN')} · +100`);
    } else {
      showToast(`${event.zone === 'head' ? localized('KAFA', 'HEAD') : localized('İSABET', 'HIT')} · -${Math.round(Number(event.damage) || 0)} ${localized('CAN', 'HEALTH')} · ${Math.round(Number(event.distance) || 0)}M`);
    }
    savePlayerStats();
    return;
  }

  if (event.killed) addKillFeed(attacker, victim, weapon);
}

function handleNetworkWorldState(message) {
  if (Array.isArray(message.paint)) {
    for (const paintEvent of message.paint) handleNetworkGameEvent(paintEvent);
  }
  if (Array.isArray(message.forts)) {
    message.forts.forEach((owner, index) => {
      const fort = fortData[index];
      const team = owner === 'blue' ? 'blue' : 'red';
      if (fort && fort.team !== team) setFortOwner(fort, team, false, false, false);
    });
  }
  lastNetworkEventId = Math.max(lastNetworkEventId, Math.round(Number(message.eventSequence) || 0));
}

function endMatch(team, reason) {
  if (state.matchEnded) return;
  state.matchEnded = true;
  state.mouseLeft = false;
  state.mouseRight = false;
  state.shieldActive = false;
  document.exitPointerLock?.();
  winnerTitle.textContent = `${TEAM[team].name} ${localized('KAZANDI', 'WON')}`;
  winnerTitle.style.color = `#${new THREE.Color(TEAM[team].color).getHexString()}`;
  winnerReason.textContent = currentLanguage === 'tr'
    ? `${reason} · Puanın ${Math.round(state.score)} · ${state.kills} düşürme`
    : `${reason} · Score ${Math.round(state.score)} · ${state.kills} kills`;
  endScreen.classList.remove('hidden');
  showBattleEvent(localized('SAVAŞ SONA ERDİ', 'BATTLE ENDED'), `${TEAM[team].name} ${localized('kazandı.', 'won.')}`, team);
}

function updateFortControl(delta) {
  state.fortControlAccumulator = (state.fortControlAccumulator || 0) + delta;
  if (state.fortControlAccumulator < 0.2) return;
  const controlDelta = Math.min(0.4, state.fortControlAccumulator);
  state.fortControlAccumulator = 0;
  for (const fort of fortData) {
    let red = 0;
    let blue = 0;
    const massCounts = massArmy?.getFortCounts(fort);
    if (massCounts) {
      red += massCounts.red;
      blue += massCounts.blue;
    }
    for (const bot of bots) {
      if (bot.dead) continue;
      if (Math.abs(bot.group.position.x - fort.x) < fort.half - 2 && Math.abs(bot.group.position.z - fort.z) < fort.half - 2) {
        if (bot.team === 'red') red += 1;
        else blue += 1;
      }
    }
    if (state.started && !state.dead && Math.abs(playerPosition.x - fort.x) < fort.half - 2 && Math.abs(playerPosition.z - fort.z) < fort.half - 2) {
      if (state.team === 'red') red += 1;
      else blue += 1;
    }
    const majority = red === blue ? null : red > blue ? 'red' : 'blue';
    if (majority && majority !== fort.team) {
      if (fort.captureTeam !== majority) {
        fort.captureTeam = majority;
        fort.captureProgress = 0;
      }
      fort.captureProgress += controlDelta * Math.max(1, Math.abs(red - blue));
      if (fort.captureProgress >= 2.5) setFortOwner(fort, majority);
    } else {
      fort.captureTeam = null;
      fort.captureProgress = 0;
    }
  }

  if (territoryCounts[0] <= 0) endMatch(territoryCounts[1] >= territoryCounts[2] ? 'red' : 'blue', localized('Adanın tamamı boyandı', 'The entire island was painted'));
}

function selectWeapon(index, announce = true) {
  state.mode = THREE.MathUtils.clamp(index, 0, 1);
  if (state.mode !== 0 || state.weapon !== 1) state.shieldActive = false;
  state.firing = false;
  state.mouseLeft = false;
  state.mouseRight = false;
  state.aiming = false;
  state.paintCharging = false;
  state.paintTarget = null;
  paintAimMarker.visible = false;
  paintAimColumn.visible = false;
  paintAimGlow.visible = false;
  weaponElements.forEach((element, elementIndex) => element.classList.toggle('active', elementIndex === state.mode));
  interactionHint.textContent = `${MODES[state.mode].name} — ${MODES[state.mode].hint}`;
  if (announce) showToast(state.mode === 0
    ? localized(`SAVAŞ MODU · ${state.weapon === 0 ? 'PAINTBALL TÜFEĞİ' : 'KILIÇ'} · SCROLL DEĞİŞTİR`, `COMBAT MODE · ${state.weapon === 0 ? 'PAINTBALL RIFLE' : 'SWORD'} · SCROLL TO CHANGE`)
    : localized(`BOYAMA MODU · ${WASTE_NAMES[WASTE_TYPES[state.wasteIndex]]} · SAĞ TIK NİŞAN · SOL TIK BOYA`, `PAINT MODE · ${WASTE_NAMES[WASTE_TYPES[state.wasteIndex]]} · RIGHT CLICK AIM · LEFT CLICK PAINT`));
  updateWeaponUI();
}

function cycleActiveSelection(direction = 1, announce = true) {
  if (state.mode === 0) {
    state.weapon = (state.weapon + direction + 2) % 2;
    if (state.weapon !== 1) state.shieldActive = false;
    state.mouseLeft = false;
    state.mouseRight = false;
    state.aiming = false;
    if (announce) showToast(`${localized('SAVAŞ SİLAHI', 'COMBAT WEAPON')} · ${state.weapon === 0 ? localized('PAINTBALL TÜFEĞİ', 'PAINTBALL RIFLE') : t('weapon.sword')}`);
  } else {
    state.wasteIndex = (state.wasteIndex + direction + WASTE_TYPES.length) % WASTE_TYPES.length;
    if (announce) showToast(`${localized('BOYA TÜRÜ', 'PAINT TYPE')} · ${WASTE_NAMES[WASTE_TYPES[state.wasteIndex]]}`);
  }
  updateWeaponUI();
}

function updateWeaponUI() {
  const combatCooldown = state.weapon === 0 ? MODES[0].cooldown : 0.68;
  weaponElements[0].classList.toggle('cooling', state.shotCooldown > 0);
  weaponElements[0].querySelector('.weapon-icon').textContent = state.weapon === 0 ? '⌖' : '⚔';
  weaponStateElements[0].textContent = state.shotCooldown > 0 ? `${state.shotCooldown.toFixed(1)} ${currentLanguage === 'tr' ? 'SN' : 'S'}` : state.weapon === 0 ? t('weapon.rifle') : t('weapon.sword');
  weaponResourceElements[0].style.width = `${Math.round((1 - state.shotCooldown / combatCooldown) * 100)}%`;
  weaponElements[1].classList.remove('cooling');
  weaponStateElements[1].textContent = WASTE_NAMES[WASTE_TYPES[state.wasteIndex]];
  weaponResourceElements[1].style.width = '100%';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  state.toastTimer = 1.25;
}

function updateToast(delta) {
  if (state.toastTimer <= 0) return;
  state.toastTimer -= delta;
  if (state.toastTimer <= 0) toast.classList.remove('show');
}

function updateLocation() {
  const directions = ['direction.n', 'direction.ne', 'direction.e', 'direction.se', 'direction.s', 'direction.sw', 'direction.w', 'direction.nw'].map(t);
  const heading = (state.yaw * 180 / Math.PI + 180 + 360) % 360;
  const direction = directions[Math.round(heading / 45) % directions.length];
  locationName.textContent = `X ${Math.round(playerPosition.x)} · Z ${Math.round(playerPosition.z)}`;
  locationDistance.textContent = `Y ${Math.round(state.feetY)} · ${direction}`;
}

function applyPlayerTeam(team) {
  state.team = team === 'blue' ? 'blue' : 'red';
  if (teamBadge) {
    teamBadge.innerHTML = `${flagMarkup(state.countryCode)} ${escapeHtml(state.playerName)} · ${TEAM[state.team].name}`;
    teamBadge.style.borderColor = `#${new THREE.Color(TEAM[state.team].color).getHexString()}`;
  }
  document.documentElement.style.setProperty('--active-color', `#${new THREE.Color(TEAM[state.team].color).getHexString()}`);
  viewModel.userData.sleeveMaterial.color.setHex(TEAM[state.team].color);
  viewModel.userData.shield.userData.teamMaterial.color.setHex(TEAM[state.team].color);
  playerAvatar.userData.uniform.color.setHex(TEAM[state.team].color);
  playerAvatar.userData.equipment.userData.shield.userData.teamMaterial.color.setHex(TEAM[state.team].color);
  paintAimMaterial.color.setHex(TEAM[state.team].color);
  paintAimColumnMaterial.color.setHex(TEAM[state.team].color);
  paintAimGlow.material.color.setHex(TEAM[state.team].color);
}

function startGame(team) {
  state.team = team;
  state.playerName = enforcePlayerNameLimit().trim() || (currentLanguage === 'tr' ? 'Bibishçi' : 'BibishPlayer');
  state.started = true;
  state.matchEnded = false;
  state.dead = false;
  state.respawnTimer = 0;
  state.health = 100;
  state.lastDamageTime = 99;
  state.stamina = 100;
  state.stance = 'stand';
  state.currentEyeHeight = PLAYER.eyeHeight;
  state.currentBodyHeight = PLAYER.bodyHeight;
  state.currentRadius = STANCE.stand.radius;
  state.velocityY = 0;
  state.shotCooldown = 0;
  state.paintCadence = 0;
  state.mouseLeft = false;
  state.mouseRight = false;
  state.shieldActive = false;
  state.shieldHitTime = 0;
  state.mapOpen = false;
  state.thirdPerson = false;
  bigMap.classList.add('hidden');
  state.countryCode = countrySelect.value || state.countryCode;
  localStorage.setItem(COUNTRY_KEY, state.countryCode);
  applyPlayerTeam(team);
  teamScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  selectWeapon(0, false);
  updateWeaponUI();
  updateCareerUI();
  beginSpawnSelection('initial');
  multiplayer?.connect({
    name: state.playerName,
    team: state.team,
    countryCode: state.countryCode,
    score: state.score,
    kills: state.kills,
    deaths: state.deaths,
    elapsedSeconds: state.elapsedSeconds,
    loadTestFullRoster: new URLSearchParams(window.location.search).get('stressFullRoster') === '1',
  });
  showToast(`${countryFlag(state.countryCode)} ${state.playerName} · ${TEAM[team].name} · ${localized('DOĞUŞ KALESİNİ SEÇ', 'SELECT A SPAWN FORT')}`);
}

function returnToTeamSelection() {
  savePlayerStats();
  setControlHelpExpanded(false);
  state.started = false;
  state.team = null;
  multiplayer?.disconnect();
  state.mouseLeft = false;
  state.mouseRight = false;
  state.firing = false;
  state.shieldActive = false;
  state.mapOpen = false;
  state.spawnSelecting = false;
  bigMap.classList.add('hidden');
  bigMap.classList.remove('spawn-selection');
  bigMapCanvas.classList.remove('waiting');
  spawnMapInstruction.classList.add('hidden');
  spawnMapStatus.classList.add('hidden');
  bigMapTitle.textContent = t('hud.fieldMap');
  document.exitPointerLock?.();
  pauseScreen.classList.add('hidden');
  hud.classList.add('hidden');
  teamScreen.classList.remove('hidden');
}

function selectTeamChoice(team) {
  state.selectedTeam = team;
  document.querySelector('#choose-red').classList.toggle('selected', team === 'red');
  document.querySelector('#choose-blue').classList.toggle('selected', team === 'blue');
}

document.querySelector('#choose-red').addEventListener('click', () => selectTeamChoice('red'));
document.querySelector('#choose-blue').addEventListener('click', () => selectTeamChoice('blue'));
joinGameButton.addEventListener('click', () => startGame(state.selectedTeam));
document.querySelector('#restart-button').addEventListener('click', () => location.reload());
document.querySelector('#resume-button').addEventListener('click', () => renderer.domElement.requestPointerLock());
document.querySelector('#change-team-button').addEventListener('click', returnToTeamSelection);
document.querySelector('#team-settings-button').addEventListener('click', () => openSettings('team'));
document.querySelector('#banner-settings-button').addEventListener('click', () => openSettings('team'));
document.querySelector('#pause-settings-button').addEventListener('click', () => openSettings('pause'));
document.querySelector('#apply-settings-button').addEventListener('click', applySettings);
document.querySelector('#close-settings-button').addEventListener('click', closeSettings);
document.querySelector('#how-to-play-button').addEventListener('click', openHowToPlay);
document.querySelector('#close-how-to-play-button').addEventListener('click', closeHowToPlay);
howToPlayScreen.addEventListener('pointerdown', (event) => {
  if (event.target === howToPlayScreen) closeHowToPlay();
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && !howToPlayScreen.classList.contains('hidden')) {
    event.preventDefault();
    closeHowToPlay();
  }
});
resetStatsButton.addEventListener('click', () => resetConfirmation.classList.remove('hidden'));
document.querySelector('#cancel-reset-stats').addEventListener('click', () => resetConfirmation.classList.add('hidden'));
document.querySelector('#confirm-reset-stats').addEventListener('click', () => {
  state.score = 0;
  state.kills = 0;
  state.deaths = 0;
  state.elapsedSeconds = 0;
  savePlayerStats();
  resetConfirmation.classList.add('hidden');
  showToast(localized('KAYITLI KARİYER SIFIRLANDI', 'SAVED CAREER RESET'));
});
damageIndicator.addEventListener('animationend', () => damageIndicator.classList.remove('show'));

bigMapCanvas.addEventListener('pointermove', (event) => {
  if (!state.spawnSelecting) return;
  const now = performance.now();
  if (now - state.spawnPointerUpdateAt < 32) return;
  state.spawnPointerUpdateAt = now;
  const target = spawnMapPointer(event);
  state.spawnHoverPoint = { x: target.x, z: target.z };
  state.spawnHoverValid = target.valid;
  state.spawnHoverReason = target.reason;
  state.spawnHoverCounts = target.counts;
  updateSpawnSelectionCopy();
  updateMaps();
});

bigMapCanvas.addEventListener('pointerleave', () => {
  if (!state.spawnSelecting) return;
  if (state.spawnSelectedPoint) {
    const selected = evaluateSpawnArea(state.spawnSelectedPoint.x, state.spawnSelectedPoint.z);
    state.spawnHoverPoint = { x: selected.x, z: selected.z };
    state.spawnHoverValid = selected.valid;
    state.spawnHoverReason = selected.reason;
    state.spawnHoverCounts = selected.counts;
  } else {
    state.spawnHoverPoint = null;
    state.spawnHoverValid = false;
    state.spawnHoverReason = 'spawn.ready';
    state.spawnHoverCounts = { red: 0, blue: 0 };
  }
  updateSpawnSelectionCopy();
  updateMaps();
});

bigMapCanvas.addEventListener('click', (event) => {
  if (!state.spawnSelecting) return;
  const target = spawnMapPointer(event);
  state.spawnHoverPoint = { x: target.x, z: target.z };
  state.spawnHoverValid = target.valid;
  state.spawnHoverReason = target.reason;
  state.spawnHoverCounts = target.counts;
  if (target.valid) {
    state.spawnSelectedPoint = { x: target.x, z: target.z };
    updateSpawnSelectionCopy();
    updateMaps();
    if (state.spawnSelectionReason === 'respawn' && state.respawnTimer > 0) return;
    finishSpawnSelection(target);
    return;
  }
  state.spawnSelectedPoint = null;
  updateSpawnSelectionCopy();
  updateMaps();
  showToast(t(target.reason || 'spawn.invalid'));
});

function setControlHelpExpanded(expanded) {
  controlsMini.classList.toggle('expanded', expanded);
  hud.classList.toggle('controls-open', expanded);
}

document.addEventListener('pointerlockchange', () => {
  state.locked = document.pointerLockElement === renderer.domElement;
  state.mouseLeft = false;
  state.mouseRight = false;
  state.firing = false;
  if (!state.locked && state.mapOpen && !state.spawnSelecting) {
    state.mapOpen = false;
    bigMap.classList.add('hidden');
  }
  setControlHelpExpanded(Boolean(state.started && !state.locked && !state.settingsOpen && !state.spawnSelecting));
  if (!state.started || state.matchEnded) return;
  if (state.spawnSelecting) {
    pauseScreen.classList.add('hidden');
    return;
  }
  if (state.settingsOpen) {
    pauseScreen.classList.add('hidden');
    return;
  }
  pauseScreen.classList.toggle('hidden', state.locked);
});

document.addEventListener('mousemove', (event) => {
  if (!state.locked) return;
  if (state.thirdPerson) {
    if (!state.mouseRight) return;
    state.freeYaw -= event.movementX * 0.00215;
    state.freePitch -= event.movementY * 0.00215;
    state.freePitch = THREE.MathUtils.clamp(state.freePitch, -Math.PI / 2 + 0.06, Math.PI / 2 - 0.06);
    return;
  }
  const scopeSensitivity = state.aiming
    ? THREE.MathUtils.clamp(0.65 / Math.sqrt(state.scopeZoom / 2.4), 0.28, 0.65)
    : 1;
  state.yaw -= event.movementX * 0.00215 * scopeSensitivity;
  state.pitch -= event.movementY * 0.00215 * scopeSensitivity;
  state.pitch = THREE.MathUtils.clamp(state.pitch, -Math.PI / 2 + 0.06, Math.PI / 2 - 0.06);
});

document.addEventListener('keydown', (event) => {
  if (event.code.startsWith('Arrow')) event.preventDefault();
  if (event.code === 'Escape' && state.started && !state.settingsOpen && !state.spawnSelecting) {
    setControlHelpExpanded(true);
  }
  if (event.code === 'KeyM' && !event.repeat) {
    toggleBigMap();
    return;
  }
  if (event.code === 'KeyK' && !event.repeat && state.started) {
    setLeaderboardCollapsed(!state.leaderboardCollapsed);
    return;
  }
  state.keys.add(event.code);
  if (event.code === 'KeyE' && !event.repeat && state.started && state.locked && !state.dead) {
    if (state.mode !== 0 || state.weapon !== 1) {
      state.shieldActive = false;
      showToast(localized('KALKAN YALNIZCA KILIÇ SEÇİLİYKEN KULLANILABİLİR', 'SHIELD IS AVAILABLE ONLY WHILE THE SWORD IS SELECTED'));
      return;
    }
    state.shieldActive = !state.shieldActive;
    state.mouseRight = false;
    state.aiming = false;
    playActionSound(state.shieldActive ? 'shieldRaise' : 'shieldLower');
    showToast(state.shieldActive
      ? localized('KALKAN AKTİF · ÖNDEN GELEN MERMİLER ENGELLENİR', 'SHIELD ACTIVE · FRONT BULLETS ARE BLOCKED')
      : localized('KALKAN İNDİRİLDİ', 'SHIELD LOWERED'));
  }
  if (event.code === 'KeyQ' && !event.repeat && state.started && state.locked && !state.dead) cycleActiveSelection(1);
  if (event.code === 'KeyC' && !event.repeat && state.started) {
    state.stance = state.stance === 'crouch' ? 'stand' : 'crouch';
    showToast(state.stance === 'crouch' ? localized('ÇÖMELDİN · C İLE KALK', 'CROUCHED · PRESS C TO STAND') : localized('AYAĞA KALKTIN', 'STOOD UP'));
  }
  if (event.code === 'KeyV' && !event.repeat && state.started) {
    state.stance = state.stance === 'prone' ? 'stand' : 'prone';
    showToast(state.stance === 'prone' ? localized('SÜRÜNME · V İLE KALK', 'PRONE · PRESS V TO STAND') : localized('AYAĞA KALKTIN', 'STOOD UP'));
  }
  const cameraKey = event.key?.toLocaleLowerCase('tr-TR') === 'ç' || event.code === 'Semicolon';
  if (cameraKey && !event.repeat && state.started) {
    state.thirdPerson = !state.thirdPerson;
    state.aiming = false;
    state.mouseRight = false;
    if (state.thirdPerson) {
      const forward = new THREE.Vector3(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      detachedCameraPosition.set(playerPosition.x, state.feetY, playerPosition.z).addScaledVector(forward, -6.4).add(new THREE.Vector3(0, 3.2, 0));
      state.freeYaw = state.yaw;
      state.freePitch = -0.2;
    }
    showToast(state.thirdPerson ? localized('BAĞIMSIZ KAMERA · YÖN TUŞLARI KAMERA · WASD KARAKTER', 'FREE CAMERA · ARROWS CAMERA · WASD CHARACTER') : localized('BİRİNCİ ŞAHIS KAMERASI', 'FIRST-PERSON CAMERA'));
  }
  if (event.code === 'Digit1' || event.code === 'Digit2') {
    const index = Number(event.code.slice(5)) - 1;
    selectWeapon(index);
  }
  if (event.code === 'Space' && state.locked && !event.repeat) {
    if (state.stance !== 'stand') {
      state.stance = 'stand';
      state.jumpQueued = 0;
      showToast(localized('AYAĞA KALKTIN', 'STOOD UP'));
    } else {
      state.jumpQueued = 0.14;
    }
  }
});

document.addEventListener('keyup', (event) => state.keys.delete(event.code));

renderer.domElement.addEventListener('mousedown', (event) => {
  if (!state.locked || state.mapOpen) return;
  if (event.button === 0) state.mouseLeft = true;
  if (event.button === 2) state.mouseRight = true;
  state.firing = state.mouseLeft || state.mouseRight;
  updateCombat(0);
});

document.addEventListener('mouseup', (event) => {
  if (event.button === 0) state.mouseLeft = false;
  if (event.button === 2) state.mouseRight = false;
  state.firing = state.mouseLeft || state.mouseRight;
});

renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

renderer.domElement.addEventListener('wheel', (event) => {
  if (!state.locked) return;
  if (state.aiming) {
    state.scopeZoom = THREE.MathUtils.clamp(state.scopeZoom + (event.deltaY < 0 ? 0.6 : -0.6), 2.4, 10);
    if (scopeZoomLabel) scopeZoomLabel.textContent = `${state.scopeZoom.toFixed(1)}×`;
    return;
  }
  cycleActiveSelection(event.deltaY > 0 ? 1 : -1);
}, { passive: true });

window.addEventListener('blur', () => {
  state.keys.clear();
  state.mouseLeft = false;
  state.mouseRight = false;
  state.firing = false;
});

window.addEventListener('pagehide', savePlayerStats);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / gameViewportHeight();
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, gameViewportHeight(), false);
});

const FIXED_STEP = 1 / 60;

function animate() {
  const delta = Math.min(clock.getDelta(), 0.075);
  if (state.started && state.locked && !state.settingsOpen && !state.matchEnded) state.elapsedSeconds += delta;
  state.fixedAccumulator = Math.min(0.1, state.fixedAccumulator + delta);
  while (state.fixedAccumulator >= FIXED_STEP) {
    movePlayer(FIXED_STEP);
    updateCombat(FIXED_STEP);
    state.fixedAccumulator -= FIXED_STEP;
  }
  updateEffects(delta);
  updateBots(delta);
  const targetScopeBlend = state.aiming && state.started && !state.dead && !state.mapOpen ? 1 : 0;
  state.scopeLodBlend = THREE.MathUtils.lerp(state.scopeLodBlend, targetScopeBlend, Math.min(1, delta * (targetScopeBlend ? 5.5 : 9)));
  scopeFocus.active = state.scopeLodBlend > 0.025;
  scopeFocus.viewActive = Boolean(state.started && !state.mapOpen);
  camera.getWorldDirection(scopeFocusDirection);
  const verticalHalfFov = camera.fov * 0.5;
  const horizontalHalfFov = THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(verticalHalfFov)) * camera.aspect));
  const viewHalfAngle = state.aiming ? Math.max(12, horizontalHalfFov + 8) : Math.min(78, horizontalHalfFov + 18);
  scopeFocus.viewCosine = Math.cos(THREE.MathUtils.degToRad(viewHalfAngle));
  scopeFocus.cosine = Math.cos(THREE.MathUtils.degToRad(Math.max(1.4, Math.max(verticalHalfFov, horizontalHalfFov) + 1.5)));
  scopeFocus.maxDistance = THREE.MathUtils.lerp(220, Math.min(activeProfile.far - 25, 320 + state.scopeZoom * 66), state.scopeLodBlend);
  const baseDetailBudget = activeTier === 'performance' ? 50 : activeTier === 'balanced' ? 110 : activeTier === 'high' ? 200 : 320;
  scopeFocus.detailBudget = Math.round(THREE.MathUtils.lerp(baseDetailBudget, baseDetailBudget + 48, state.scopeLodBlend));
  scopeFocus.lodScale = runtimeLodScale;
  massArmy?.update(delta, camera.position, {
    active: NPC_PLAYER_COMBAT_ENABLED && state.started && !state.spawnSelecting && !state.dead && !state.matchEnded,
    team: state.team,
    x: playerPosition.x,
    y: state.feetY,
    z: playerPosition.z,
  }, scopeFocus);
  multiplayer?.update(delta, state.started ? {
    x: playerPosition.x,
    y: state.feetY,
    z: playerPosition.z,
    yaw: state.yaw,
    pitch: state.pitch,
    stance: state.stance,
    weapon: state.weapon,
    mode: state.mode,
    shieldActive: state.shieldActive,
    health: state.health,
    score: state.score,
    kills: state.kills,
    deaths: state.deaths,
    elapsedSeconds: state.elapsedSeconds,
    phase: state.stepPhase,
    action: state.actionTime > 0
      ? ({ shot: 1, sword: 4, pee: 5, vomit: 6, poop: 7 }[state.actionKind] || 0)
      : 0,
    dead: state.dead,
  } : null);
  updateFortControl(delta);
  updateWorldLod(delta);
  updateLocalSunShadow();
  updateViewModel(delta);
  updatePlayerAvatar(delta);
  updateToast(delta);
  state.statsSaveTimer += delta;
  if (state.statsSaveTimer >= 1) {
    savePlayerStats();
    state.statsSaveTimer = 0;
  }

  if (state.dead) {
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 1.15, Math.min(1, delta * 2.8));
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, state.feetY + 0.42, Math.min(1, delta * 3));
  }
  updateAudioListener();

  state.uiTimer += delta;
  state.locationTimer += delta;
  if (state.uiTimer >= 0.12) {
    staminaFill.style.width = `${Math.round(state.stamina)}%`;
    staminaValue.textContent = Math.round(state.stamina);
    healthFill.style.width = `${Math.round(state.health)}%`;
    healthValue.textContent = Math.round(state.health);
    healthFill.style.background = state.health > 55 ? '#79e386' : state.health > 25 ? '#f5d45b' : '#ff315e';
    updateWeaponUI();
    updateCareerUI();
    state.uiTimer = 0;
  }
  if (state.locationTimer >= 0.28) {
    updateLocation();
    state.locationTimer = 0;
  }
  state.npcLabelTimer = (state.npcLabelTimer || 0) + delta;
  const npcLabelInterval = state.aiming ? 0.14 : 0.18;
  if (state.npcLabelTimer >= npcLabelInterval) {
    updateNpcLabels();
    state.npcLabelTimer = 0;
  }
  mapTimer += delta;
  const mapInterval = !state.started ? 0.75 : state.mapOpen ? 0.12 : 0.2;
  if (mapTimer >= mapInterval) {
    updateMaps();
    mapTimer = 0;
  }

  renderer.render(scene, camera);
  adaptivePerformance.frame(delta, renderer.info.render.calls, renderer.info.render.triangles);
}

setLoadingProgress(48, localized('Arazi geometrisi, kaleler ve çarpışmalar kuruluyor…', 'Building terrain geometry, forts and collisions…'));
await new Promise((resolve) => requestAnimationFrame(resolve));
createWorld();
setLoadingProgress(68, localized('Çevrimiçi oyuncu LOD ve ağ katmanı hazırlanıyor…', 'Preparing online-player LOD and network layers…'));
await new Promise((resolve) => requestAnimationFrame(resolve));
massArmy = new MassArmySystem(scene, {
  // Instanced buffer capacity only; disconnected slots cost no AI/simulation work.
  // This keeps room rendering ready for 1,024 red + 1,024 blue remote players.
  countPerTeam: 1024,
  terrainHeightAt,
  teamColors: { red: TEAM.red.color, blue: TEAM.blue.color },
  quality: activeTier,
  onShot: ({ start, end, team }) => {
    const targetsPlayer = end.distanceToSquared(new THREE.Vector3(playerPosition.x, state.feetY + 1.05, playerPosition.z)) < 4;
    const visualEnd = targetsPlayer && shieldBlocksSource(start) ? shieldImpactPoint() : end;
    beamPool.add(start, visualEnd, TEAM[team].soft, 0.012, 0.08);
    playActionSound('gun', start);
  },
  onAction: ({ type, mode, position }) => {
    if (!state.started || state.spawnSelecting || state.matchEnded) return;
    if (type === 'footstep') playFootstepSound(mode || 'walk', position, false);
    else playActionSound(type, position);
  },
  onPlayerHit: handleMassPlayerHit,
  onKill: ({ killer, victim, weapon }) => addKillFeed(killer, victim, weapon),
  isBlocked: (x, z, feetY) => collidesStaticAt(x, z, 0.28, feetY, 1.8),
  networkControlled: true,
  worldHalfWidth: WORLD.halfWidth,
  worldHalfDepth: WORLD.halfDepth,
});
  multiplayer = new MultiplayerClient({
    onSnapshot: (players) => massArmy.syncRemotePlayers(players, multiplayer.clientId),
    onEvent: handleNetworkGameEvent,
    onWorldState: handleNetworkWorldState,
  onRejected: () => blockDuplicateSession(),
  onWelcome: ({ team }) => {
    if (!state.started || team === state.team) return;
    applyPlayerTeam(team);
    if (state.spawnSelecting) {
      state.spawnSelectedPoint = null;
      state.spawnHoverPoint = null;
      state.spawnHoverValid = false;
      state.spawnHoverReason = 'spawn.ready';
      state.spawnHoverCounts = { red: 0, blue: 0 };
      updateSpawnSelectionCopy();
      updateMaps();
    }
    showToast(localized(
      `TAKIM DENGESİ · ${TEAM[team].name} TAKIMINA YERLEŞTİRİLDİN`,
      `TEAM BALANCE · YOU WERE ASSIGNED TO ${TEAM[team].name}`,
    ));
  },
  onStatus: (status) => {
    document.documentElement.dataset.network = status;
  },
});

function findRockPassageForStance(stanceName = 'stand') {
  const profile = STANCE[stanceName] || STANCE.stand;
  const widerName = stanceName === 'prone' ? 'crouch' : stanceName === 'crouch' ? 'stand' : null;
  const wider = widerName ? STANCE[widerName] : null;
  const rocks = blockers.filter((box) => box.kind === 'rock');
  let fallback = null;
  for (let first = 0; first < rocks.length; first += 1) {
    const a = rocks[first];
    const ax = (a.minX + a.maxX) / 2;
    const az = (a.minZ + a.maxZ) / 2;
    for (let second = first + 1; second < rocks.length; second += 1) {
      const b = rocks[second];
      const bx = (b.minX + b.maxX) / 2;
      const bz = (b.minZ + b.maxZ) / 2;
      const deltaX = bx - ax;
      const deltaZ = bz - az;
      const separation = Math.hypot(deltaX, deltaZ);
      if (separation < 2.2 || separation > 13) continue;
      const midpointX = (ax + bx) / 2;
      const midpointZ = (az + bz) / 2;
      const pathX = -deltaZ / separation;
      const pathZ = deltaX / separation;
      const samples = [];
      let clear = true;
      let widerBlocked = false;
      // Sample more finely than the player's smallest swept physics step so a
      // thin corner between two low-poly rocks cannot be missed by the probe.
      for (let sample = -48; sample <= 48; sample += 1) {
        const offset = sample * (2.8 / 48);
        const x = midpointX + pathX * offset;
        const z = midpointZ + pathZ * offset;
        const feetY = floorHeightAt(x, z);
        const blocked = collidesStaticAt(x, z, profile.radius, feetY, profile.body);
        const blockedForWider = wider ? collidesStaticAt(x, z, wider.radius, feetY, wider.body) : false;
        samples.push({ x, z, blocked, blockedForWider });
        clear = clear && !blocked;
        widerBlocked = widerBlocked || blockedForWider;
      }
      if (!clear) continue;
      const result = {
        stance: stanceName,
        radius: profile.radius,
        body: profile.body,
        widerStance: widerName,
        widerBlocked,
        separation,
        midpoint: [midpointX, midpointZ],
        path: [pathX, pathZ],
        samples,
      };
      if (widerBlocked || !wider) return result;
      fallback ||= result;
    }
  }
  return fallback;
}

globalThis.__bibishDebug = {
  joinLoadTest: (team = 'red', index = 0) => {
    const safeTeam = team === 'blue' ? 'blue' : 'red';
    playerNameInput.value = `Load-${safeTeam === 'red' ? 'R' : 'B'}-${String(index).padStart(3, '0')}`;
    countrySelect.value = safeTeam === 'red' ? 'TR' : 'US';
    selectTeamChoice(safeTeam);
    startGame(safeTeam);
    const fort = fortData.find((candidate) => candidate.team === safeTeam) || fortData[0];
    const point = evaluateSpawnArea(fort.x, fort.z);
    finishSpawnSelection(point);
    return { name: state.playerName, team: state.team, spawned: !state.spawnSelecting };
  },
  stepLoadTestMotion: (index = 0, time = performance.now()) => {
    if (!state.started || state.dead) return null;
    const homeZ = state.team === 'red' ? -WORLD.halfDepth * 0.48 : WORLD.halfDepth * 0.48;
    const lane = (Number(index) % 25 - 12) * 4.2;
    const angle = Number(time) * 0.00055 + Number(index) * 0.37;
    playerPosition.x = THREE.MathUtils.clamp(lane + Math.sin(angle) * 18, -WORLD.halfWidth + 40, WORLD.halfWidth - 40);
    playerPosition.z = THREE.MathUtils.clamp(homeZ + Math.cos(angle) * 26, -WORLD.halfDepth + 40, WORLD.halfDepth - 40);
    state.feetY = floorHeightAt(playerPosition.x, playerPosition.z);
    state.yaw = angle + (state.team === 'red' ? 0 : Math.PI);
    state.stepPhase += 0.34;
    state.moveAmount = 1;
    return { x: playerPosition.x, y: state.feetY, z: playerPosition.z, yaw: state.yaw };
  },
  stepLoadTestGameplay: (index = 0, time = performance.now()) => {
    if (!state.started || state.dead) return null;
    const numericIndex = Number(index) || 0;
    const seconds = Number(time) / 1000;
    const attackDirection = state.team === 'red' ? 1 : -1;
    const lane = (numericIndex % 41 - 20) * 5.4;
    const march = Math.sin(seconds * 0.11 + numericIndex * 0.17) * WORLD.halfDepth * 0.42;
    playerPosition.x = THREE.MathUtils.clamp(lane + Math.sin(seconds * 0.37 + numericIndex) * 24, -WORLD.halfWidth + 34, WORLD.halfWidth - 34);
    playerPosition.z = THREE.MathUtils.clamp(march * attackDirection + Math.cos(seconds * 0.23 + numericIndex * 0.31) * 18, -WORLD.halfDepth + 34, WORLD.halfDepth - 34);
    state.feetY = floorHeightAt(playerPosition.x, playerPosition.z);
    state.yaw = attackDirection > 0 ? Math.PI : 0;
    state.pitch = Math.sin(seconds * 0.19 + numericIndex) * 0.12;
    state.stepPhase += 0.28 + (numericIndex % 5) * 0.018;
    state.moveAmount = 1;
    state.sprinting = Math.floor(seconds + numericIndex) % 5 < 2;
    const stanceCycle = Math.floor(seconds / 4 + numericIndex) % 12;
    state.stance = stanceCycle === 9 ? 'prone' : stanceCycle >= 6 ? 'crouch' : 'stand';
    const equipmentCycle = Math.floor(seconds / 3 + numericIndex) % 5;
    state.mode = equipmentCycle >= 3 ? 1 : 0;
    state.weapon = state.mode === 0 && equipmentCycle === 2 ? 1 : 0;
    state.shieldActive = state.mode === 0 && state.weapon === 1 && Math.floor(seconds * 2 + numericIndex) % 4 === 0;
    state.aiming = state.mode === 0 && state.weapon === 0 && Math.floor(seconds + numericIndex) % 4 === 0;
    const actionBucket = Math.floor(seconds * 1.25 + numericIndex * 0.13);
    if (state.loadTestActionBucket !== actionBucket) {
      state.loadTestActionBucket = actionBucket;
      state.actionDuration = state.weapon === 1 ? 0.34 : state.mode === 1 ? 0.46 : 0.22;
      state.actionTime = state.actionDuration;
      state.actionKind = state.weapon === 1 ? 'sword' : state.mode === 1 ? ['pee', 'vomit', 'poop'][actionBucket % 3] : 'shot';
    }
    return {
      x: playerPosition.x,
      y: state.feetY,
      z: playerPosition.z,
      yaw: state.yaw,
      stance: state.stance,
      mode: state.mode,
      weapon: state.weapon,
      actionKind: state.actionKind,
    };
  },
  getNetworkMetrics: () => multiplayer?.getMetrics() || null,
  prepareNetworkEventTest: (x = 0, z = 0) => {
    if (!state.started) return null;
    playerPosition.x = THREE.MathUtils.clamp(Number(x) || 0, -WORLD.halfWidth + 20, WORLD.halfWidth - 20);
    playerPosition.z = THREE.MathUtils.clamp(Number(z) || 0, -WORLD.halfDepth + 20, WORLD.halfDepth - 20);
    state.feetY = floorHeightAt(playerPosition.x, playerPosition.z);
    playerPosition.y = state.feetY;
    state.health = 100;
    state.dead = false;
    state.mode = 0;
    state.weapon = 0;
    state.shieldActive = false;
    state.stance = 'stand';
    return { x: playerPosition.x, y: state.feetY, z: playerPosition.z, clientId: multiplayer?.clientId };
  },
  sendNetworkEvent: (event) => multiplayer?.sendEvent(event) || false,
  paintNetworkTest: (x = playerPosition.x, y = state.feetY, z = playerPosition.z, wasteType = 'pee', radius = 0.5) => {
    placeWastePaint(new THREE.Vector3(Number(x) || 0, Number(y) || 0, Number(z) || 0), Number(radius) || 0.5, wasteType);
    return true;
  },
  getSharedGameState: () => ({
    team: state.team,
    health: state.health,
    score: state.score,
    kills: state.kills,
    deaths: state.deaths,
    dead: state.dead,
    redPaint: territoryCounts[1],
    bluePaint: territoryCounts[2],
    forts: fortData.map((fort) => fort.team),
    lastNetworkEventId,
    leaders: multiplayer?.serverLeaderboard?.length || 0,
  }),
  getLoadMetrics: () => ({ ...massArmy.getMetrics(), detailedNPCs: 0, totalNPCs: 0, multiplayer: multiplayer?.getMetrics() }),
  getRendererMetrics: () => ({
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    pixelRatio: renderer.getPixelRatio(),
    quality: activeTier,
    antialias: Boolean(renderer.getContext().getContextAttributes()?.antialias),
    measuredFps,
    lodScale: runtimeLodScale,
    visibleWorldChunks,
    totalWorldChunks: worldLodObjects.length,
  }),
  getGrassLodMetrics: () => {
    const grassEntries = worldLodObjects.filter((entry) => entry.category === 'grass');
    const summarize = (kind) => {
      const entries = grassEntries.filter((entry) => entry.object.userData.grassKind === kind);
      return { total: entries.length, visible: entries.filter((entry) => entry.object.visible).length };
    };
    const proxies = worldLodObjects.filter((entry) => entry.category === 'grassProxy');
    return {
      short: summarize('short'),
      tall: summarize('tall'),
      proxies: { total: proxies.length, visible: proxies.filter((entry) => entry.object.visible).length },
      aiming: state.aiming,
      zoom: state.scopeZoom,
      far: camera.far,
    };
  },
  setGrassViewTest: (distance = 560, aiming = false, zoom = 10) => {
    const meadow = biomeLayout.find((biome) => biome.variant === 'elephantGrass');
    if (!meadow) return null;
    const targetZ = THREE.MathUtils.clamp(meadow.z + Number(distance), -WORLD.halfDepth + 35, WORLD.halfDepth - 35);
    playerPosition.set(meadow.x, floorHeightAt(meadow.x, targetZ), targetZ);
    state.feetY = playerPosition.y;
    state.thirdPerson = false;
    state.mode = 0;
    state.weapon = 0;
    state.locked = true;
    state.mouseRight = Boolean(aiming);
    state.aiming = Boolean(aiming);
    state.scopeZoom = THREE.MathUtils.clamp(Number(zoom) || 2.4, 2.4, 10);
    state.scopeLodBlend = state.aiming ? 1 : 0;
    camera.position.set(playerPosition.x, state.feetY + PLAYER.eyeHeight, playerPosition.z);
    camera.lookAt(meadow.x, terrainHeightAt(meadow.x, meadow.z) + 1.3, meadow.z);
    state.pitch = camera.rotation.x;
    state.yaw = camera.rotation.y;
    updateWorldLod(1, true);
    return { distance: Math.hypot(playerPosition.x - meadow.x, playerPosition.z - meadow.z), ...globalThis.__bibishDebug.getGrassLodMetrics() };
  },
  getGameplayConfig: () => ({
    npcPlayerCombatEnabled: false,
    paintRadiusMultiplier: PAINT_RADIUS_MULTIPLIER,
    scopedBulletSpeed: 720,
    hipBulletSpeed: 480,
    scopedGravity: 1.35,
    npcPerTeam: 0,
    world: { width: WORLD.halfWidth * 2, depth: WORLD.halfDepth * 2 },
    forts: fortData.length,
    ladders: ladderZones.length,
    biomes: biomeLayout.length,
    scenery: { ...sceneryMetrics },
    rifleDamage: {
      headNear: calculateWeaponDamage('head', 20),
      headFar: calculateWeaponDamage('head', 280),
      torsoNear: calculateWeaponDamage('torso', 20),
      torsoFar: calculateWeaponDamage('torso', 280),
      limbNear: calculateWeaponDamage('limb', 20),
      limbFar: calculateWeaponDamage('limb', 280),
      nonHeadMaximum: DAMAGE_MODEL.nonHeadMaximum,
    },
    shieldArcDot: 0.46,
    biomeTypes: [...new Set(biomeLayout.map((biome) => biome.type))],
  }),
  getAvatarRigState: () => ({
    stance: state.stance,
    faceChildren: playerAvatar.userData.head.children.length,
    mouthAttachedToHead: playerAvatar.userData.mouth.parent === playerAvatar.userData.head,
    headY: playerAvatar.userData.head.position.y,
    avatarRotationZ: playerAvatar.rotation.z,
    torsoRotationX: playerAvatar.userData.torso.rotation.x,
    anatomyChildren: playerAvatar.userData.anatomy.children.length,
    feetY: state.feetY,
    collisionRadius: state.currentRadius,
    velocityY: state.velocityY,
    canJump: state.canJump,
    sprinting: state.sprinting,
    jumpQueued: state.jumpQueued,
    playerX: playerPosition.x,
    playerZ: playerPosition.z,
    mapOpen: state.mapOpen,
    health: state.health,
    dead: state.dead,
    cameraX: camera.position.x,
    cameraY: camera.position.y,
    cameraZ: camera.position.z,
    cameraTerrainY: terrainHeightAt(camera.position.x, camera.position.z),
    cameraClearance: camera.position.y - terrainHeightAt(camera.position.x, camera.position.z),
    cameraSafetyRecoveries: state.cameraSafetyRecoveries,
    yaw: state.yaw,
    pitch: state.pitch,
  }),
  teleportToSteepSlope: () => {
    let best = null;
    const probe = 4;
    for (let z = -WORLD.halfDepth + 70; z <= WORLD.halfDepth - 70; z += 14) {
      for (let x = -WORLD.halfWidth + 70; x <= WORLD.halfWidth - 70; x += 14) {
        const y = terrainHeightAt(x, z);
        if (y < -8 || collidesStaticAt(x, z, PLAYER.radius, y, PLAYER.bodyHeight)) continue;
        const gradientX = (terrainHeightAt(x + probe, z) - terrainHeightAt(x - probe, z)) / (probe * 2);
        const gradientZ = (terrainHeightAt(x, z + probe) - terrainHeightAt(x, z - probe)) / (probe * 2);
        const slope = Math.hypot(gradientX, gradientZ);
        if (!best || slope > best.slope) best = { x, z, y, gradientX, gradientZ, slope };
      }
    }
    if (!best) return null;
    const gradientLength = Math.max(0.001, Math.hypot(best.gradientX, best.gradientZ));
    const uphillX = best.gradientX / gradientLength;
    const uphillZ = best.gradientZ / gradientLength;
    playerPosition.set(best.x, best.y, best.z);
    state.feetY = best.y;
    state.velocityY = 0;
    state.stance = 'stand';
    state.thirdPerson = false;
    state.yaw = Math.atan2(-uphillX, -uphillZ);
    state.pitch = 0;
    camera.position.set(best.x, best.y + PLAYER.eyeHeight, best.z);
    camera.rotation.set(0, state.yaw, 0);
    return { ...best, yaw: state.yaw, clearance: camera.position.y - terrainHeightAt(best.x, best.z) };
  },
  teleportToGrassBiome: (biomeIndex = 1) => {
    const meadows = biomeLayout.filter((biome) => biome.type === 'grassland');
    const meadow = meadows[THREE.MathUtils.clamp(Math.round(biomeIndex), 0, meadows.length - 1)];
    if (!meadow) return null;
    let targetX = meadow.x;
    let targetZ = meadow.z;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const angle = attempt * 2.399;
      const radius = Math.sqrt(attempt) * 3.2;
      const candidateX = meadow.x + Math.cos(angle) * radius;
      const candidateZ = meadow.z + Math.sin(angle) * radius;
      const candidateY = floorHeightAt(candidateX, candidateZ);
      if (!collidesStaticAt(candidateX, candidateZ, PLAYER.radius, candidateY, PLAYER.bodyHeight)) {
        targetX = candidateX;
        targetZ = candidateZ;
        break;
      }
    }
    playerPosition.set(targetX, floorHeightAt(targetX, targetZ), targetZ);
    state.feetY = playerPosition.y;
    state.velocityY = 0;
    state.stance = 'stand';
    state.thirdPerson = false;
    state.yaw = 0;
    state.pitch = -0.1;
    camera.position.set(targetX, state.feetY + PLAYER.eyeHeight, targetZ);
    camera.rotation.set(state.pitch, state.yaw, 0);
    return { type: meadow.type, x: targetX, z: targetZ, radius: meadow.radius, grass: sceneryMetrics.grass };
  },
  setGrassJumpApexView: () => {
    const meadow = biomeLayout.find((biome) => biome.variant === 'elephantGrass');
    if (!meadow) return null;
    const angle = 0.37;
    const distance = meadow.radius * 0.055;
    const x = meadow.x + Math.cos(angle) * distance;
    const z = meadow.z + Math.sin(angle) * distance * 0.82;
    const ground = floorHeightAt(x, z);
    const jumpApex = PLAYER.jumpSpeed ** 2 / (2 * 28);
    playerPosition.set(x, ground, z);
    state.feetY = ground + jumpApex;
    state.velocityY = 0;
    state.canJump = false;
    state.thirdPerson = false;
    state.pitch = 0;
    state.yaw = 0;
    camera.position.set(x, state.feetY + PLAYER.eyeHeight, z);
    camera.rotation.set(0, 0, 0);
    updateWorldLod(1, true);
    return {
      jumpApex,
      cameraAboveGround: camera.position.y - ground,
      minimumCentralGrassHeight: 0.82 * 7.3,
      grass: sceneryMetrics.grass,
      tallGrass: sceneryMetrics.tallGrass,
    };
  },
  setViewPitch: (pitch) => {
    state.pitch = THREE.MathUtils.clamp(Number(pitch) || 0, -Math.PI / 2 + 0.06, Math.PI / 2 - 0.06);
    return state.pitch;
  },
  simulateIncomingHit: (angle = 0, damage = 12) => {
    const source = new THREE.Vector3(
      playerPosition.x - Math.sin(state.yaw + angle) * 20,
      state.feetY + 1.2,
      playerPosition.z - Math.cos(state.yaw + angle) * 20,
    );
    damagePlayer(damage, source);
    return { health: state.health, shieldActive: state.shieldActive, shieldHit: state.shieldHitTime > 0, indicator: damageIndicator.classList.contains('show'), angle: damageIndicator.style.getPropertyValue('--damage-angle') };
  },
  setShieldActive: (active) => {
    state.shieldActive = Boolean(active);
    state.shieldHitTime = 0;
    return { active: state.shieldActive, health: state.health };
  },
  getNpcLabelStats: () => ({
    totalSlots: npcLabelElements.length,
    visible: npcLabelElements.filter((element) => !element.style.transform.includes('-9999px')).length,
  }),
  getFocusedLabelTarget: () => {
    camera.updateMatrixWorld(true);
    camera.getWorldDirection(npcLabelDirection);
    const focused = massArmy?.getLabelTargetOnRay(camera.position, npcLabelDirection, 680) || null;
    return {
      direction: npcLabelDirection.toArray(),
      camera: camera.position.toArray(),
      target: focused ? {
        index: focused.index,
        name: focused.name,
        x: focused.x,
        y: focused.y,
        z: focused.z,
        rayDistance: focused.rayDistance,
        visible: isNpcBodyVisible(focused.x, focused.baseY, focused.z),
      } : null,
    };
  },
  forceNpcLabelUpdate: () => {
    updateNpcLabels();
    return globalThis.__bibishDebug.getNpcLabelStats();
  },
  placeEnemyInFront: (distance = 2.35) => {
    const index = state.team === 'red' ? massArmy.countPerTeam : 0;
    const forwardX = -Math.sin(state.yaw);
    const forwardZ = -Math.cos(state.yaw);
    massArmy.dead[index] = 0;
    massArmy.health[index] = 100;
    massArmy.x[index] = playerPosition.x + forwardX * distance;
    massArmy.z[index] = playerPosition.z + forwardZ * distance;
    massArmy.y[index] = floorHeightAt(massArmy.x[index], massArmy.z[index]);
    massArmy.targetY[index] = massArmy.y[index];
    massArmy.yaw[index] = state.yaw + Math.PI;
    return { index, name: massArmy.names[index], health: massArmy.health[index], distance };
  },
  getMassAgent: (index) => ({
    ...massArmy.getAgentInfo(index),
    dead: Boolean(massArmy.dead[index]),
    x: massArmy.x[index],
    y: massArmy.y[index],
    z: massArmy.z[index],
  }),
  previewMelee: () => {
    cameraRay(0, 0);
    const origin = new THREE.Vector3(playerPosition.x, state.feetY + 1, playerPosition.z);
    const candidate = massArmy.findMeleeTarget(origin, rayDirection, state.team, 3.55, 0.42);
    return {
      origin: origin.toArray(),
      direction: rayDirection.toArray(),
      candidate: candidate ? { index: candidate.massIndex, name: candidate.targetName, point: candidate.point.toArray(), distance: origin.distanceTo(candidate.point) } : null,
      weapon: state.weapon,
      mode: state.mode,
      locked: state.locked,
      cooldown: state.shotCooldown,
    };
  },
  prepareMeleeTest: (distance = 2.25) => {
    state.thirdPerson = false;
    state.pitch = 0;
    state.mode = 0;
    state.weapon = 1;
    state.shotCooldown = 0;
    camera.position.set(playerPosition.x, state.feetY + state.currentEyeHeight, playerPosition.z);
    camera.rotation.set(0, state.yaw, 0);
    const target = globalThis.__bibishDebug.placeEnemyInFront(distance);
    updateWeaponUI();
    return { target, preview: globalThis.__bibishDebug.previewMelee() };
  },
  prepareRifleTest: (distance = 12) => {
    state.thirdPerson = false;
    state.pitch = 0;
    state.mode = 0;
    state.weapon = 0;
    state.shotCooldown = 0;
    const target = globalThis.__bibishDebug.placeEnemyInFront(distance);
    camera.position.set(playerPosition.x, state.feetY + state.currentEyeHeight, playerPosition.z);
    camera.lookAt(massArmy.x[target.index], massArmy.y[target.index] + 1.52, massArmy.z[target.index]);
    state.pitch = camera.rotation.x;
    state.yaw = camera.rotation.y;
    updateWeaponUI();
    return target;
  },
  prepareJumpTest: () => {
    state.stance = 'stand';
    state.feetY = floorHeightAt(playerPosition.x, playerPosition.z);
    state.velocityY = 0;
    state.canJump = true;
    return { feetY: state.feetY, canJump: state.canJump };
  },
  preparePaintTest: () => {
    state.thirdPerson = false;
    state.pitch = -0.58;
    state.mode = 1;
    state.mouseLeft = false;
    state.mouseRight = false;
    state.paintCadence = 0;
    camera.position.set(playerPosition.x, state.feetY + state.currentEyeHeight, playerPosition.z);
    camera.rotation.set(state.pitch, state.yaw, 0);
    updateWeaponUI();
    return globalThis.__bibishDebug.getTerritoryMetrics();
  },
  getCombatState: () => ({
    mode: state.mode,
    weapon: state.weapon,
    aiming: state.aiming,
    shieldActive: state.shieldActive,
    shieldHit: state.shieldHitTime > 0,
    health: state.health,
    kills: state.kills,
    deaths: state.deaths,
    score: state.score,
    shotCooldown: state.shotCooldown,
    locked: state.locked,
    damageIndicator: damageIndicator.classList.contains('show'),
  }),
  getSpawnSelectionState: () => ({
    active: state.spawnSelecting,
    reason: state.spawnSelectionReason,
    mapOpen: state.mapOpen,
    dead: state.dead,
    respawnTimer: state.respawnTimer,
    selectedFortIndex: state.selectedSpawnFortIndex,
    radius: SPAWN_SAFE_RADIUS,
    hoverPoint: state.spawnHoverPoint ? { ...state.spawnHoverPoint } : null,
    hoverValid: state.spawnHoverValid,
    hoverReason: state.spawnHoverReason,
    hoverCounts: { ...state.spawnHoverCounts },
    selectedPoint: state.spawnSelectedPoint ? { ...state.spawnSelectedPoint } : null,
    status: spawnMapStatus.textContent,
    ownedForts: ownedSpawnForts().map(({ fort, index }) => ({
      index,
      name: spawnFortLabel(fort),
      x: fort.x,
      z: fort.z,
      canvasX: (fort.x + WORLD.halfWidth) / (WORLD.halfWidth * 2) * bigMapCanvas.width,
      canvasY: (fort.z + WORLD.halfDepth) / (WORLD.halfDepth * 2) * bigMapCanvas.height,
    })),
  }),
  findValidSpawnSample: () => {
    if (!massArmy) return null;
    for (let index = 0; index < massArmy.count; index += 1) {
      if (massArmy.dead[index]) continue;
      const agentTeam = massArmy.team[index] === 0 ? 'red' : 'blue';
      if (agentTeam !== state.team) continue;
      const candidate = evaluateSpawnArea(massArmy.x[index], massArmy.z[index]);
      if (candidate.valid) return candidate;
    }
    return null;
  },
  getScopeState: () => ({
    zoom: state.scopeZoom,
    fov: camera.fov,
    aiming: state.aiming,
    focusedDetailed: massArmy?.getMetrics().detailedRendered || 0,
  }),
  testBattleEvent: (team = 'red') => {
    showBattleEvent(localized('TEST KARAKOLU ELE GEÇİRİLDİ', 'TEST FORT CAPTURED'), localized('Önemli olay bildirimi çalışıyor.', 'Important-event notification is active.'), team);
    return battleEvents.children.length;
  },
  setMassAgentHealth: (index, health) => {
    massArmy.health[index] = THREE.MathUtils.clamp(Number(health) || 0, 0, 100);
    massArmy.dead[index] = 0;
    return massArmy.getAgentInfo(index);
  },
  getEffectMetrics: () => ({
    activeBallistics: ballisticPool.slots.filter((slot) => slot.active).length,
    activeTrails: beamPool.slots.filter((slot) => slot.active).length,
    activeGlobs: globPool.slots.filter((slot) => slot.active).length,
    swordX: viewModel.userData.sword.position.x,
    swordRotationZ: viewModel.userData.sword.rotation.z,
  }),
  getTerritoryMetrics: () => ({ unpainted: territoryCounts[0], red: territoryCounts[1], blue: territoryCounts[2] }),
  getCollisionMetrics: () => ({
    blockers: blockers.length,
    rockBlockers: blockers.filter((box) => box.kind === 'rock').length,
    bushBlockers: blockers.filter((box) => box.kind === 'bush').length,
    bulletSurfaces: bulletSurfaces.length,
    gridCells: blockerGrid.size,
    sweptStep: Math.max(0.065, state.currentRadius * 0.28),
    stanceRadii: Object.fromEntries(Object.entries(STANCE).map(([name, profile]) => [name, profile.radius])),
    recoveries: state.collisionRecoveries,
  }),
  getPlayerBlockState: () => ({
    static: collidesStaticAt(playerPosition.x, playerPosition.z, state.currentRadius),
    detailedNpc: bots.some((bot) => !bot.dead && Math.hypot(playerPosition.x - bot.group.position.x, playerPosition.z - bot.group.position.z) < state.currentRadius + 0.31),
    massNpc: Boolean(massArmy?.collidesCircle(playerPosition.x, playerPosition.z, state.currentRadius)),
    x: playerPosition.x,
    z: playerPosition.z,
    feetY: state.feetY,
    radius: state.currentRadius,
  }),
  findStanceRockPassage: (stanceName = 'stand') => findRockPassageForStance(stanceName),
  prepareStancePassageTest: (stanceName = 'stand') => {
    const passage = findRockPassageForStance(stanceName);
    if (!passage) return null;
    const profile = STANCE[stanceName] || STANCE.stand;
    const start = passage.samples[0];
    const end = passage.samples.at(-1);
    playerPosition.set(start.x, floorHeightAt(start.x, start.z), start.z);
    state.feetY = playerPosition.y;
    state.velocityY = 0;
    state.stance = stanceName in STANCE ? stanceName : 'stand';
    state.currentEyeHeight = profile.eye;
    state.currentBodyHeight = profile.body;
    state.currentRadius = profile.radius;
    state.canJump = true;
    state.keys.clear();
    state.locked = true;
    state.mapOpen = false;
    state.dead = false;
    state.yaw = Math.atan2(-passage.path[0], -passage.path[1]);
    state.pitch = 0;
    bigMap.classList.add('hidden');
    camera.position.set(playerPosition.x, state.feetY + profile.eye, playerPosition.z);
    camera.rotation.set(0, state.yaw, 0);
    return {
      stance: state.stance,
      radius: state.currentRadius,
      widerStance: passage.widerStance,
      widerBlocked: passage.widerBlocked,
      start: [start.x, start.z],
      end: [end.x, end.z],
      distance: Math.hypot(end.x - start.x, end.z - start.z),
    };
  },
  getFootstepMetrics: () => ({
    events: state.footstepEvents,
    mode: state.lastFootstepMode,
    volume: state.lastFootstepVolume,
    timer: state.footstepTimer,
    stance: state.stance,
    radius: state.currentRadius,
  }),
  prepareFootstepTest: (stanceName = 'stand') => {
    const profile = STANCE[stanceName] || STANCE.stand;
    const fort = fortData[0];
    const backZ = fort.z - fort.gateSide * fort.half;
    playerPosition.set(fort.x - 14, fort.y + fort.wallHeight, backZ);
    state.feetY = fort.y + fort.wallHeight;
    state.velocityY = 0;
    state.stance = stanceName in STANCE ? stanceName : 'stand';
    state.currentEyeHeight = profile.eye;
    state.currentBodyHeight = profile.body;
    state.currentRadius = profile.radius;
    state.canJump = true;
    state.sprinting = false;
    state.footstepTimer = 0;
    state.footstepEvents = 0;
    state.lastFootstepMode = 'none';
    state.lastFootstepVolume = 0;
    state.keys.clear();
    state.locked = true;
    state.mapOpen = false;
    state.dead = false;
    state.yaw = -Math.PI / 2;
    state.pitch = 0;
    bigMap.classList.add('hidden');
    camera.position.set(playerPosition.x, state.feetY + profile.eye, playerPosition.z);
    camera.rotation.set(0, state.yaw, 0);
    return globalThis.__bibishDebug.getAvatarRigState();
  },
  findNavigableRockGap: () => {
    const rocks = blockers.filter((box) => box.kind === 'rock');
    for (let first = 0; first < rocks.length; first += 1) {
      const a = rocks[first];
      const ax = (a.minX + a.maxX) / 2;
      const az = (a.minZ + a.maxZ) / 2;
      for (let second = first + 1; second < rocks.length; second += 1) {
        const b = rocks[second];
        const bx = (b.minX + b.maxX) / 2;
        const bz = (b.minZ + b.maxZ) / 2;
        const deltaX = bx - ax;
        const deltaZ = bz - az;
        const separation = Math.hypot(deltaX, deltaZ);
        if (separation < 3 || separation > 15) continue;
        const midpointX = (ax + bx) / 2;
        const midpointZ = (az + bz) / 2;
        const pathX = -deltaZ / separation;
        const pathZ = deltaX / separation;
        let clear = true;
        const samples = [];
        for (let sample = -10; sample <= 10; sample += 1) {
          const x = midpointX + pathX * sample * 0.24;
          const z = midpointZ + pathZ * sample * 0.24;
          const feetY = floorHeightAt(x, z);
          const blocked = collidesStaticAt(x, z, STANCE.stand.radius, feetY, STANCE.stand.body);
          samples.push({ x, z, blocked });
          if (blocked) {
            clear = false;
            break;
          }
        }
        if (clear) return { separation, midpoint: [midpointX, midpointZ], path: [pathX, pathZ], samples };
      }
    }
    return null;
  },
  prepareFortRampartTest: (index = 0) => {
    const fort = fortData[index];
    if (!fort) return null;
    const backZ = fort.z - fort.gateSide * fort.half;
    playerPosition.set(fort.x + 4, fort.y + fort.wallHeight, backZ);
    state.feetY = fort.y + fort.wallHeight;
    state.velocityY = 0;
    state.stance = 'stand';
    state.currentEyeHeight = PLAYER.eyeHeight;
    state.currentBodyHeight = PLAYER.bodyHeight;
    state.currentRadius = STANCE.stand.radius;
    state.canJump = true;
    state.jumpQueued = 0;
    state.thirdPerson = false;
    state.mode = 0;
    state.weapon = 0;
    state.shotCooldown = 0;
    state.health = 100;
    state.dead = false;
    state.locked = true;
    state.keys.clear();
    state.mapOpen = false;
    bigMap.classList.add('hidden');
    state.yaw = fort.gateSide === 1 ? 0 : Math.PI;
    state.pitch = -0.02;
    camera.position.set(playerPosition.x, state.feetY + PLAYER.eyeHeight, playerPosition.z);
    camera.rotation.set(state.pitch, state.yaw, 0);
    camera.updateMatrixWorld(true);
    return {
      fort: index,
      player: playerPosition.toArray(),
      wallTop: fort.y + fort.wallHeight,
      support: floorHeightAt(playerPosition.x, playerPosition.z, state.feetY + 0.72, STANCE.stand.radius * 0.72),
      terrain: terrainHeightAt(playerPosition.x, playerPosition.z),
      blocked: collidesStaticAt(playerPosition.x, playerPosition.z),
    };
  },
  queueFortJumpTest: () => {
    state.jumpQueued = 0.12;
    state.jumpGrace = 0.12;
    state.canJump = true;
    return globalThis.__bibishDebug.getAvatarRigState();
  },
  prepareSolidMuzzleTest: () => {
    const box = blockers.find((candidate) => (
      candidate.kind === 'rock' && candidate.maxY - candidate.minY > 2.4 &&
      candidate.maxX - candidate.minX > 2.4 && candidate.maxZ - candidate.minZ > 2.4
    ));
    if (!box) return null;
    const x = (box.minX + box.maxX) / 2;
    const z = box.minZ - PLAYER.radius - 0.09;
    state.stance = 'stand';
    state.currentEyeHeight = PLAYER.eyeHeight;
    state.currentBodyHeight = PLAYER.bodyHeight;
    state.currentRadius = STANCE.stand.radius;
    state.thirdPerson = false;
    state.mode = 0;
    state.weapon = 0;
    state.shotCooldown = 0;
    playerPosition.set(x, floorHeightAt(x, z), z);
    state.feetY = playerPosition.y;
    state.velocityY = 0;
    camera.position.set(playerPosition.x, state.feetY + state.currentEyeHeight, playerPosition.z);
    camera.lookAt(x, THREE.MathUtils.clamp(camera.position.y, box.minY + 0.2, box.maxY - 0.2), (box.minZ + box.maxZ) / 2);
    state.pitch = camera.rotation.x;
    state.yaw = camera.rotation.y;
    camera.updateMatrixWorld(true);
    updateViewModel(0);
    return {
      box: { ...box },
      player: playerPosition.toArray(),
      camera: camera.position.toArray(),
      outsideBlocked: collidesStaticAt(playerPosition.x, playerPosition.z),
      insideBlocked: collidesStaticAt(x, box.minZ + PLAYER.radius * 0.25),
      surfaceDistance: box.minZ - playerPosition.z,
    };
  },
  fireSolidMuzzleTest: () => {
    const holesBefore = bulletHoles.length;
    const ballisticsBefore = ballisticPool.slots.filter((slot) => slot.active).length;
    const trailsBefore = beamPool.slots.filter((slot) => slot.active).length;
    performSniperShot();
    return {
      holesAdded: bulletHoles.length - holesBefore,
      ballisticsAdded: ballisticPool.slots.filter((slot) => slot.active).length - ballisticsBefore,
      trailsAdded: beamPool.slots.filter((slot) => slot.active).length - trailsBefore,
      cameraInsideSolid: collidesStaticAt(playerPosition.x, playerPosition.z, 0.02),
    };
  },
  prepareWallCollision: () => {
    const box = blockers.find((candidate) => (
      candidate.maxX - candidate.minX > 20 &&
      candidate.maxZ - candidate.minZ >= 4 && candidate.maxZ - candidate.minZ < 8 &&
      candidate.minY > 20
    ));
    if (!box) return null;
    playerPosition.x = (box.minX + box.maxX) / 2;
    playerPosition.z = box.minZ - PLAYER.radius - 0.12;
    state.feetY = floorHeightAt(playerPosition.x, playerPosition.z);
    state.yaw = Math.PI;
    state.pitch = 0;
    state.thirdPerson = false;
    return { startX: playerPosition.x, startZ: playerPosition.z, wallMinZ: box.minZ, wallMaxZ: box.maxZ };
  },
  prepareFortFallRecovery: () => {
    const box = blockers.find((candidate) => (
      candidate.maxX - candidate.minX > 20 &&
      candidate.maxZ - candidate.minZ >= 4 && candidate.maxZ - candidate.minZ < 8 &&
      candidate.minY > 20
    ));
    if (!box) return null;
    playerPosition.set((box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2);
    state.feetY = box.maxY - 0.35;
    state.velocityY = -2;
    state.stance = 'stand';
    state.currentBodyHeight = PLAYER.bodyHeight;
    state.currentRadius = STANCE.stand.radius;
    return { minX: box.minX, maxX: box.maxX, minZ: box.minZ, maxZ: box.maxZ, top: box.maxY };
  },
  prepareCameraBoundary: () => {
    let landZ = -WORLD.halfDepth + 40;
    while (landZ < -WORLD.halfDepth + 120 && terrainHeightAt(0, landZ) < -17.5) landZ += 2;
    state.thirdPerson = true;
    state.freeYaw = 0;
    state.freePitch = -0.08;
    detachedCameraPosition.set(0, terrainHeightAt(0, landZ) + 2, landZ);
    return { x: detachedCameraPosition.x, y: detachedCameraPosition.y, z: detachedCameraPosition.z, terrainY: terrainHeightAt(0, landZ) };
  },
  captureFort: (index, team) => {
    const fort = fortData[index];
    if (!fort || !TEAM[team]) return null;
    setFortOwner(fort, team);
    const territoryX = THREE.MathUtils.clamp(Math.floor((fort.x + WORLD.halfWidth) / (WORLD.halfWidth * 2) * TERRITORY_SIZE), 0, TERRITORY_SIZE - 1);
    const territoryY = THREE.MathUtils.clamp(Math.floor((fort.z + WORLD.halfDepth) / (WORLD.halfDepth * 2) * TERRITORY_SIZE), 0, TERRITORY_SIZE - 1);
    return {
      team: fort.team,
      flag: fort.flag.material.color.getHexString(),
      wall: fort.colorMaterials.stone.color.getHexString(),
      groundTeam: territoryCells[territoryY * TERRITORY_SIZE + territoryX],
    };
  },
};
seedFortPaint();
buildMapBase();
updateMaps();
camera.position.set(0, PLAYER.eyeHeight + 18, -120);
camera.lookAt(0, 8, -350);
setLoadingProgress(88, localized('Harita, yüzler ve mermi efektleri GPU için derleniyor…', 'Compiling map, faces and projectile effects for the GPU…'));
await renderer.compileAsync(scene, camera).catch(() => {});
setLoadingProgress(95, localized('Yerel önbellek ve kayıt sistemi hazırlanıyor…', 'Preparing local cache and save system…'));
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => null);
}
renderer.setAnimationLoop(animate);
setLoadingProgress(100, localized('Saha hazır. Kayıtlı kariyerin yüklendi.', 'Field ready. Your saved career has loaded.'));
await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
loadingScreen.setAttribute('aria-busy', 'false');
loadingScreen.classList.add('hidden');
}
