# Источники локальных карт

Автор всех исходных карт: **Solar System Scope / INOVE**. [Страница набора](https://www.solarsystemscope.com/textures/) — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Изображения основаны на данных NASA и снимках космических аппаратов; авторы набора корректируют насыщенность и заполняют некоторые неизученные области. Это обработанные текстурные карты, а не необработанные научные данные NASA.

## Desktop-набор

Путь: `public/textures/desktop/`. Все итоговые изображения — **4096 × 2048 JPEG**, кроме случаев, когда исходное разрешение меньше; такие файлы не увеличиваются. Для текущего набора все перечисленные ниже итоговые карты имеют 4096 × 2048.

| Локальный файл   | Исходный файл на странице Solar System Scope                               |
| ---------------- | -------------------------------------------------------------------------- |
| sun.jpg          | https://www.solarsystemscope.com/textures/download/8k_sun.jpg              |
| mercury.jpg      | https://www.solarsystemscope.com/textures/download/8k_mercury.jpg          |
| venus.jpg        | https://www.solarsystemscope.com/textures/download/4k_venus_atmosphere.jpg |
| earth.jpg        | https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg     |
| earth-night.jpg  | https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg   |
| earth-clouds.jpg | https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg     |
| mars.jpg         | https://www.solarsystemscope.com/textures/download/8k_mars.jpg             |
| jupiter.jpg      | https://www.solarsystemscope.com/textures/download/8k_jupiter.jpg          |
| saturn.jpg       | https://www.solarsystemscope.com/textures/download/8k_saturn.jpg           |

Преобразование: уменьшение до 4096 пикселей по ширине с сохранением пропорций, HighQualityBicubic, JPEG quality 94 через Windows System.Drawing. Генеративная дорисовка, повышение исходного разрешения и добавление деталей не применялись. Оригиналы сохранены в игнорируемой `.tools/texture-originals/` текущей рабочей копии; для работы сайта они не нужны.

## Остальные карты

- `public/textures/2k_*.jpg` — исходные карты Solar System Scope, сохранённые без изменения. Они используются на мобильных устройствах и для Урана/Нептуна на всех устройствах.
- `2k_saturn_ring_alpha.png` — оригинальная прозрачная карта колец, без изменений.
- `earth-normal.png` — исходная `2k_earth_normal_map.tif`, преобразованная в PNG.
- `earth-specular.png` — исходная `2k_earth_specular_map.tif`, преобразованная в PNG; белые области обозначают воду.

Карты нормалей и отражения хранятся как данные, без sRGB-декодирования. Дневные/ночные цветовые карты используют sRGB. Выбор качества происходит один раз при загрузке: смена размеров окна не заменяет тяжёлые текстуры во время пролёта.

Атмосферное свечение, фотосферное потемнение к краю, отражение океанов и взаимные тени Сатурна/колец рассчитываются шейдерами. Они не добавлены в карты как нарисованные детали и являются приближёнными моделями, а не полноценным физическим рендером.
