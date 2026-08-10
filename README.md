# Bibish

Redcoats esintili, takım tabanlı WebGL FPS prototipi. Sabit Bibish Adası'nda
on karakol için savaşılır; oyuncular sniper ile çatışır ve çiş, kusmuk veya
kaka kullanarak yalnızca zemini takım rengine boyar.

## Yerelde çalıştırma

Bağımlılıkları kur:

```powershell
npm install
```

Vite istemcisini başlat. Yerel WebSocket oyun odası aynı süreçte ve aynı portta
otomatik olarak açılır; ikinci bir terminal gerekmez:

```powershell
npm run dev
```

Terminalde gösterilen yerel oyun adresini aç. Aynı adresin farklı sekmelerinde
oyuna giren oyuncular otomatik olarak tek `global` odaya bağlanır.

## Çok oyunculu mimari

- Çalışma zamanında NPC veya yapay zekâ askeri yoktur.
- Oyuncular WebSocket üzerinden durum paketleri yollar; sunucu ilgi alanı snapshot'larını
  saniyede 4 kez yayınlar ve istemci hareketleri kareler arasında yumuşatır.
- Sunucu, manuel takım isteğine mümkün olduğu ölçüde uyar ve takım sayılarındaki
  farkı en fazla bir oyuncuda tutar.
- Uzak oyuncular takım başına 1024 kişilik sabit instanced mesh havuzuyla çizilir.
  Böylece 99 uzak oyuncu eklendiğinde karakter çizim çağrıları oyuncu sayısıyla
  doğrusal artmaz ve 2048 kişilik oda render kapasitesi korunur.
- Sunucu 160 birimlik uzamsal hücrelerle ilgi yönetimi yapar. Normal istemci yalnızca
  260 birim içindeki en fazla 32 oyuncuyu alır; toplam takım/oyuncu sayısı ayrı tutulur.
  Böylece 2000 bağlantıda ağ ve JSON maliyeti oyuncu sayısının karesiyle büyümez.
- Arka plan sekmeleri `requestAnimationFrame` paketlerini yavaşlatsa bile bağlantı
  WebSocket ping/pong ile korunur; ancak art arda yaklaşık 60 saniye cevap vermeyen
  bağlantı temizlenir.
- Yerel varsayılan yerine başka bir sunucu kullanmak için `VITE_MULTIPLAYER_URL`
  tanımlanabilir veya sayfaya `?ws=wss://...` parametresi verilebilir.

## Yük testleri

100 tam 3B Chromium istemcisi:

```powershell
npm run loadtest
```

Dağıtılmış gerçek kullanım modeli — 100 izole Chromium oturumu, bir tam 3B istemci
ve aynı protokolü kullanan 99 tarayıcı istemcisi:

```powershell
npm run loadtest:distributed
```

1000 kırmızı + 1000 mavi rastgele hareket/silah/boya/duruş üreten oyuncu:

```powershell
npm run loadtest:2000
```

1999 rastgele sanal oyuncu ve tamamını Ultra kalitede alan bir gerçek Chromium FPS testi:

```powershell
npm run loadtest:2000:fps
```

Ayrı Chromium, Firefox, WebKit ve Edge süreçleriyle cihaz başına FPS/gecikme raporu:

```powershell
npm run loadtest:real
```

BrowserStack üzerinde 2000 eşzamanlı gerçek masaüstü tarayıcısı (çalıştırmadan önce
planın 2000 paralel oturuma izin verdiği API ile doğrulanır):

```powershell
$env:BROWSERSTACK_USERNAME='...'
$env:BROWSERSTACK_ACCESS_KEY='...'
$env:BIBISH_URL='https://oyun-adresi.example'
$env:BIBISH_WS_URL='wss://oyun-sunucusu.example/ws'
npm run loadtest:cloud
```

Bulut testi her oyuncu için ayrı tarayıcı oturumu açar; bütün istemcilerin `global`
oda kimliğini ve aynı toplam oyuncu sayısını gördüğünü doğrular. Kota 2000'den azsa
test başlamadan durur ve sıraya alınmış oturumları eşzamanlıymış gibi raporlamaz.

İlk test tek fiziksel bilgisayarın aynı anda 100 WebGL dünyası çizme sınırını;
ikinci test sunucunun 100 bağlantısını ve bir oyuncunun diğer 99 kişiyi çizme
maliyetini ölçer. Son iki test, 2000 bağlantının ağ/sunucu yükünü ve bu yük altında
tek bir gerçek Ultra Chromium istemcisinin 1999 uzak oyuncuyu çizme maliyetini ayrı
ayrı raporlar. Bu sonuçlar gerçek coğrafi gecikmenin veya 2000 fiziksel bilgisayarın
yerine geçmez.

## Kontroller

- `WASD`: hareket
- `Shift`: koşu
- `Space`: çömelmiş veya sürünürken ayağa kalkma; ayaktayken zıplama
- `C`: çömelme / ayağa kalkma
- `V`: sürünme / ayağa kalkma
- `Ç`: birinci şahıs ve bağımsız karakter kamerası arasında geçiş
- `E`: kılıç seçiliyken sol eldeki kalkanı kaldırma / indirme
- `1`: savaş modu — sol tık saldırı, sağ tık tüfek dürbünü
- `2`: boyama modu — sağ tıkla hedef alanını göster, sol tıkla boya
- `Scroll`: savaş modunda paintball tüfeği/kılıç, boyama modunda çiş/kusmuk/kaka
- `M`: hareketi durdurmadan büyük harita
- `K`: lider tablosunu daraltma / açma
- `Esc`: duraklatma ve tüm kontroller

## Oynanış ve performans

- Oyuncu adını, ülke bayrağını ve takımını ana ekrandan seçer.
- İlk oyuncu takımına ait bir kalede doğabilir; devamında takım arkadaşlarının
  bulunduğu ve düşman bulunmayan güvenli alanlar seçilebilir.
- Karakol avlusunda sayısal üstünlük kuran takım kısa ele geçirme süresinden sonra
  kaleyi alır; kale boşalsa da sahiplik korunur.
- Maç, boyanabilir adanın tamamı iki takım tarafından kaplandığında sonuçlanır.
- Kafa, gövde ve uzuv vuruşları farklı hasar verir; hasar mesafeyle azalır.
- Boya ayrı bir havada duran katman değildir; doğrudan arazi dokusuna işlenir ve
  haritada gerçek dünya ölçeğinde gösterilir.
- Statik çevre birleştirilir, efektler havuzlanır ve grafik profili cihaz yüküne
  göre Düşük, Orta, Yüksek veya Ultra seviyesinde çalışır.
- Süre, puan, kill ve ölüm sayısı yerel cihazda saklanır.

## Vercel

`npm run build` statik istemciyi üretir. Yerel `server/game-server.js`, varsayılan
`global` odada tek yetkili ortak haritayı çalıştırır ve 2000 WebSocket bağlantısıyla
doğrulanmıştır. Web yayınında istemci `VITE_MULTIPLAYER_URL` ile uzun ömürlü oyun
sunucusuna bağlanmalıdır. Vercel Function bağlantıları farklı instance'lara
dağıtabildiği için `api/ws.js` tek başına küresel tek oda garantisi vermez; birden
fazla Function kullanılacaksa Redis/pub-sub ile paylaşımlı oda durumu veya tek
yetkili kalıcı WebSocket sunucusu zorunludur.
# Bibish

## Çevrimiçi mimari

- Vite/Three.js istemcisi Vercel üzerinde yayınlanır.
- Gerçek zamanlı tek `global` oda Cloudflare Durable Objects üzerinde çalışır.
- Üretim WebSocket adresi `wss://bibish-realtime.bibish.workers.dev/ws` şeklindedir.
- Yerel Vite geliştirme sunucusu aynı protokolü `/ws` üzerinden çalıştırır.

Cloudflare dağıtımı:

```powershell
npm run cloudflare:deploy
```

Gerçek Cloudflare oda testi:

```powershell
npm run test:cloudflare -- wss://bibish-realtime.bibish.workers.dev/ws
```
