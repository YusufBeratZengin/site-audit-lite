# site-audit-lite

[English](README.md) | [Türkçe](README.tr.md)

Küçük işletme siteleri için hızlı ve neredeyse bağımlılıksız bir site sağlık denetleyicisi. Siteyi tarar; SEO temellerini, erişilebilirlik temellerini, güvenlik başlıklarını, performans ipuçlarını ve kırık bağlantıları kontrol eder, sonucu okunaklı bir HTML, Markdown veya JSON raporu olarak yazar.

Tam bir Lighthouse kurulumuyla uğraşmak ya da bir SaaS aracına ödeme yapmak istemeyen serbest çalışanlar ve site sahipleri için yazıldı. Her bulgunun bir kimliği, önem derecesi, tetikleyen kanıtı ve sade bir dille yazılmış çözüm önerisi vardır.

- Node.js 20 ve üzeri, ESM, yerleşik `fetch` üzerine kurulu.
- Çalışma zamanı bağımlılığı yok.
- `robots.txt` kurallarına uyar; sayfa, derinlik ve eşzamanlı istek sayısını sınırlar, istekler arasında kibarca bekler.
- Satır içi CSS'li, açık ve koyu temalı, tek dosyalık HTML raporu.

## Kurulum

```sh
git clone https://github.com/YusufBeratZengin/site-audit-lite.git
cd site-audit-lite
npm install        # yalnızca geliştirme için (test ve lint)
npm link           # isteğe bağlı: `site-audit` komutunu her yerden çalıştırır
```

Bağlamadan da çalıştırabilirsiniz: `node bin/site-audit.js https://example.com`.

## Kullanım

```sh
site-audit https://example.com
site-audit https://example.com --max-pages 20 --out report.html
site-audit https://example.com --out report.md --out report.json
site-audit https://example.com --fail-under 80 --quiet
```

`example.com` gibi çıplak bir alan adı `https://example.com` olarak kabul edilir.

| Seçenek | Varsayılan | Anlamı |
| --- | --- | --- |
| `--max-pages <n>` | 20 | Çekilecek en fazla sayfa sayısı |
| `--max-depth <n>` | 3 | Başlangıç sayfasından en fazla bağlantı derinliği |
| `--concurrency <n>` | 4 | Eşzamanlı istek sayısı |
| `--delay <ms>` | 200 | İstekler arası en kısa bekleme (robots.txt içindeki daha büyük bir `Crawl-delay` geçerli olur, en çok 10 sn) |
| `--timeout <ms>` | 15000 | İstek başına zaman aşımı |
| `--user-agent <metin>` | `site-audit-lite/0.1 (+depo adresi)` | User-Agent başlığı; ilk kelimesi robots.txt gruplarını eşleştirmek için de kullanılır |
| `--out <dosya>` | yok | Rapor yazar. Biçim uzantıdan belirlenir (`.html`, `.md`, `.json`). Birden fazla kez verilebilir |
| `--format <biçim>` | uzantıya göre | Tüm `--out` dosyaları için `html`, `md` veya `json` biçimini zorlar |
| `--fail-under <n>` | yok | Genel puan `n` değerinin altındaysa 1 koduyla çıkar |
| `--verbose` | kapalı | Terminalde çözümleri, kanıtları ve ilerleme iletilerini gösterir |
| `--quiet` | kapalı | Hata dışında hiçbir şey yazmaz |
| `--no-color` | otomatik | ANSI renklerini kapatır |

Çıkış kodları: `0` başarılı, `1` puan `--fail-under` değerinin altında, `2` kullanım hatası ya da site denetlenemedi.

### Kütüphane olarak kullanım

```js
import { runAudit, renderHtml } from 'site-audit-lite';

const result = await runAudit('https://example.com', { maxPages: 10 });
console.log(result.scores.overall, result.findings.length);
const html = renderHtml(result);
```

## Neleri kontrol eder

Önem derecesi `error` (hata), `warning` (uyarı) veya `info` (bilgi) olur. Kapsam `page` ise kontrol denetlenen her sayfada, `site` ise bütün sitede bir kez çalışır.

### SEO

| Kimlik | Önem | Kapsam | Ne |
| --- | --- | --- | --- |
| `seo-title-missing` | error | page | Sayfanın başlığı yok |
| `seo-title-length` | warning | page | Başlık 10 karakterden kısa ya da 60 karakterden uzun |
| `seo-title-duplicate` | warning | site | Birkaç sayfa aynı başlığı paylaşıyor |
| `seo-description-missing` | warning | page | Meta açıklaması yok |
| `seo-description-length` | info | page | Açıklama 70 karakterden kısa ya da 160 karakterden uzun |
| `seo-h1-missing` | warning | page | h1 başlığı yok |
| `seo-h1-multiple` | info | page | Birden fazla h1 var |
| `seo-canonical-missing` | info | page | Canonical bağlantısı yok |
| `seo-viewport-missing` | error | page | Viewport meta etiketi yok |
| `seo-noindex` | warning | page | Robots meta etiketinde ya da X-Robots-Tag başlığında `noindex` var |
| `seo-opengraph-missing` | info | page | og:title, og:description veya og:image eksik |
| `seo-structured-data-missing` | info | page | JSON-LD bloğu yok |
| `seo-robots-txt-missing` | info | site | `/robots.txt` bulunamadı |
| `seo-sitemap-missing` | warning | site | Site haritası bulunamadı (robots.txt içindeki `Sitemap:` satırı, yoksa `/sitemap.xml`) |
| `seo-favicon-missing` | info | site | Favicon yok (tanımlı simge, yoksa `/favicon.ico`) |

### Erişilebilirlik

Bunlar temel ve sezgisel kontrollerdir; elle inceleme yapmanın ya da axe gibi eksiksiz bir aracın yerini tutmaz.

| Kimlik | Önem | Kapsam | Ne |
| --- | --- | --- | --- |
| `a11y-lang-missing` | error | page | `<html>` öğesinde `lang` yok |
| `a11y-img-alt-missing` | error | page | `alt` özniteliği olmayan görseller (boş `alt=""` kabul edilir) |
| `a11y-form-label-missing` | warning | page | `<label>`, `aria-label`, `aria-labelledby` ya da `title` olmayan form alanları (sezgisel) |
| `a11y-link-text-empty` | warning | page | Metni, aria-label'ı ya da görsel alt metni olmayan bağlantılar |
| `a11y-zoom-disabled` | warning | page | Viewport yakınlaştırmayı engelliyor (`user-scalable=no`, 2'den küçük `maximum-scale`) |

### Güvenlik

| Kimlik | Önem | Kapsam | Ne |
| --- | --- | --- | --- |
| `sec-https` | error | site | Site düz HTTP ile sunuluyor |
| `sec-https-redirect` | warning | site | `http://` adresi `https://` adresine yönlenmiyor |
| `sec-hsts` | warning | page | `Strict-Transport-Security` yok |
| `sec-csp` | warning | page | `Content-Security-Policy` yok |
| `sec-x-content-type-options` | warning | page | `X-Content-Type-Options` eksik ya da yanlış |
| `sec-referrer-policy` | info | page | `Referrer-Policy` yok |
| `sec-frame-protection` | info | page | Ne `X-Frame-Options` ne de CSP `frame-ancestors` var |
| `sec-mixed-content` | error | page | HTTPS sayfası `http://` betik, stil, çerçeve ya da görsel yüklüyor |

Yerel geliştirme sunucusunu denetleyebilmeniz için döngü adresleri (`localhost`, `127.0.0.0/8`, `::1`) HTTPS, HTTP yönlendirmesi ve HSTS kontrollerinden muaftır.

### Performans

| Kimlik | Önem | Kapsam | Ne |
| --- | --- | --- | --- |
| `perf-page-weight` | warning | page | HTML ile aynı siteden görseller, betikler ve stiller toplamı 1,5 MB'ı aşıyor |
| `perf-html-size` | info | page | Yalnızca HTML 200 KB'ı aşıyor |
| `perf-large-image` | warning | page | Aynı siteden 300 KB'ı aşan görsel |
| `perf-compression` | warning | page | 2 KB'dan büyük HTML `Content-Encoding` olmadan sunuluyor |
| `perf-slow-response` | warning | page | Sayfanın inmesi 1,5 saniyeden uzun sürdü |
| `perf-img-dimensions` | info | page | `width` ve `height` olmayan görseller |
| `perf-render-blocking-script` | info | page | `<head>` içinde `async`, `defer` ya da `type="module"` olmayan dış betik |

Boyutlar, çözülmüş HTML gövdesinden ve aynı siteden kaynakların `Content-Length` başlıklarından alınır. `Content-Length` göndermeyen kaynaklar sayılmaz; bu yüzden sayfa ağırlığı alt sınırdır.

### Bağlantılar

| Kimlik | Önem | Kapsam | Ne |
| --- | --- | --- | --- |
| `links-broken` | error | page | Site içi bağlantı 4xx/5xx döndürüyor ya da açılamıyor |
| `links-broken-resource` | error | page | Aynı siteden görsel, betik ya da stil dosyası 4xx/5xx döndürüyor ya da açılamıyor |
| `links-redirected` | info | page | Site içi bağlantı başka bir adrese yönleniyor |

Yalnızca aynı kaynaktaki (origin) bağlantılar denetlenir. Dış bağlantılara hiçbir zaman istek atılmaz.

## Puanlama

Her kategori 100 puanla başlar. Başarısız her kontrol önem derecesine göre puan düşürür: hata 20, uyarı 8, bilgi 2. Sayfa kapsamlı bir kontrolün düşüşü, etkilediği sayfa oranıyla ölçeklenir (6 sayfanın 3'ü etkileniyorsa düşüşün yarısı uygulanır); site kapsamlı kontrol her zaman tam düşer. Kategori puanı 0 ile 100 arasında tutulur.

Genel puan, kategori puanlarının ağırlıklı ortalamasıdır:

| Kategori | Ağırlık |
| --- | ---: |
| SEO | 30 |
| Güvenlik | 25 |
| Erişilebilirlik | 20 |
| Performans | 15 |
| Bağlantılar | 10 |

Notlar: 90 ve üzeri A, 80 B, 70 C, 60 D, 60'ın altı F. Puanlar düzeltmeleri sıraya koymak için kaba bir rehberdir; hiçbir arama motorunun sıralama sinyali değildir.

## Raporlar

- Terminal: puanlar, sayılar ve en ciddi bulgular.
- HTML: satır içi CSS'li, betiksiz, açık ve koyu temalı tek dosya; sayfalardan gelen tüm içerik kaçışlanır.
- Markdown: aynı içerik; bir sorun kaydına ya da e-postaya yapıştırmak kolaydır.
- JSON: tüm sonuç nesnesi (`scores`, `summary`, `pages`, `affected[].evidence` içeren `findings`).

## Sınırlar

- Sayfalar tarayıcıyla değil, küçük ve hoşgörülü bir tarayıcıyla (scanner) ayrıştırılır. JavaScript ile sonradan eklenen içerik görülmez.
- Kontroller küçük siteler için sezgiseldir. Hepsini geçmek sitenin güvenli, erişilebilir ya da hızlı olduğunu kanıtlamaz.
- `--max-pages`, 404 dönenler dahil tarama sırasındaki her sayfa isteğini sayar.

## Geliştirme

```sh
npm install
npm test       # node --test; yerel bir HTTP sunucusu kullanır, gerçek ağa çıkmaz
npm run lint
```

Bkz. [CONTRIBUTING.md](CONTRIBUTING.md). Güvenlik bildirimleri için: [SECURITY.md](SECURITY.md).

## Lisans

MIT, bkz. [LICENSE](LICENSE).
