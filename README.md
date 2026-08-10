# Bibish

Redcoats esintili, takım tabanlı WebGL FPS prototipi. Sabit Bibish Adası'nda
on karakol için savaşılır; oyuncular sniper ile çatışır ve çiş, kusmuk veya
kaka kullanarak yalnızca zemini takım rengine boyar.

## Çalıştırma

```powershell
npm install
npm run dev
```

## Kontroller

- `WASD`: hareket
- `Shift`: koşu
- `Space`: çömelmiş veya sürünürken ayağa kalkma; ayaktayken zıplama
- `C`: çömelme / ayağa kalkma
- `B`: sürünme / ayağa kalkma
- `E`: sol eldeki kalkanı kaldırma / indirme; öndeki yaklaşık 125 derecelik açıdan gelen mermileri engeller
- `1`: savaş modu — sol tık saldırı, sağ tık tüfek dürbünü
- `2`: boyama modu — sağ tıkla ışıklı hedef alanını göster, sol tıkla boya
- `Scroll`: savaş modunda paintball tüfeği/kılıç, boyama modunda çiş/kusmuk/kaka
- `M`: hareketi durdurmadan büyük harita
- `V`: birinci şahıs ve bağımsız karakter kamerası arasında geçiş; yön tuşları kamerayı, `WASD` karakteri taşır

## Oynanış

- Oyuncu adını ve takımını ana ekrandan seçer.
- Oyuncu, takımının sahip olduğu rastgele bir karakolda doğar.
- Karakol avlusunda sayısal üstünlük kuran takım kısa ele geçirme süresinden
  sonra kaleyi alır; kale boşalsa da sahiplik korunur.
- Maç, boyanabilir adanın tamamı iki takım tarafından kaplandığında sonuçlanır.
- Kafa, gövde ve uzuv vuruşları farklı hasar verir. Hasar; bölge çarpanı ve üstel mesafe düşüşüyle hesaplanır, kafa dışı tek isabet 34 hasarı geçmez. Can zamanla yenilenir.
- Boya ayrı bir yüzey katmanı değildir; doğrudan arazi dokusuna işlenir ve haritada aynı gerçek dünya ölçeğiyle, on kat genişletilmiş etki alanıyla gösterilir.
- Paintball mermileri yer çekimine tabidir; dürbün açıkken daha hızlı ve daha düz gider. Boya parçaları duvar, ağaç ve kayalardan sekebilir.
- Yük testi için 1000 kırmızı ve 1000 mavi savaşçı bulunur. On yakın plan karakter ayrıntılı iskeletle; kalan 1990 asker sıkıştırılmış instanced çizim, mesafe LOD'u ve kademeli yapay zekâ güncellemeleriyle çalışır.
- NPC'ler oyuncuyu görüş ve menzil içine aldığında saldırır. Yakındaki NPC'lerin adları ve canlı can barları ekranda gösterilir.
- Hasar merminin katettiği mesafeye ve kafa/gövde/uzuv bölgesine göre hesaplanır; isabet alınca halka ve geliş yönünü gösteren ok belirir.
- Geçirilen süre, puan, kill ve ölüm sayısı takım değişse veya tarayıcı kapatılsa bile cihazda saklanır. Ölüm 75 puan düşürür; ana menüde onaylı sıfırlama bulunur.
- Menü ve oyun içi arayüz TR/EN arasında tamamen değiştirilebilir. 249 ülke/bölge bayrağı gerçek SVG önizlemeleriyle oyuncu adıyla birlikte seçilip gösterilir.
- 1440×1440 sabit ada; 10 karakol, karakol başına dört dikey merdiven ve birbirine yumuşak geçen orman, kayalık, çayırlık ve karma biyomlar içerir.
- İlk açılış ekranı arazi, 2.000 NPC, GPU shader derlemesi ve yerel önbellek aşamalarını yüzdeyle gösterir. Üretim sürümü service worker ile uygulama kabuğunu ve sürümlenmiş varlıkları cihaz önbelleğinde tutar.
- Uzak savaşçılar insan silüeti LOD’una, yakın savaşçılar göz/ağız ve tam uzuv animasyonuna geçer. Mermiler görünür paintball izi bırakır.
- Statik çevre birleştirilir; efektler havuzlanır ve grafik profili cihaz yüküne
  göre Düşük, Orta, Yüksek veya Ultra seviyesinde çalışır.

## Vercel

`npm run build` çıktısı Vercel'e statik olarak dağıtılabilir. Gerçek internet
çok oyuncululuğu için daha sonra ayrı, yetkili ve uzun ömürlü bir oyun sunucusu
bağlanmalıdır; mevcut sürüm oyun döngüsünü yerel botlarla gösterir.
