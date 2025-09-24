# Гірські котеджі — статичний сайт з безпечним календарем Booking

Сайт залишається статичним, але розклад зайнятості тепер отримується та санітується на бекенді GitHub Actions. Це дозволяє показувати користувачам лише зайняті інтервали без витоку приватних iCal-URL у браузер, логах чи репозиторії.

## Структура
```
/images                  — медіафайли сайту
/public/js/busy-loader.js — міні-бібліотека для завантаження даних про зайнятість
/scripts/fetch-ical.mjs   — скрипт, який тягне Booking iCal та генерує JSON
/tests/                   — мінімальні юніт-тести для логіки інтервалів
/data/                    — результат роботи скрипта (busy-*.json)
style.css, script.js, index.html тощо — статичний фронтенд сайту
```

## Архітектура інтеграції Booking iCal
1. **GitHub Actions** за розкладом та вручну запускає `npm run fetch:ical`.
2. Скрипт `scripts/fetch-ical.mjs` зчитує приватні URL із секретів `BOOKING_CALENDAR_1/2`, завантажує `.ics`, розширює рр-правила та перетворює події у зайняті UTC-інтервали.
3. Санітуються всі текстові поля (SUMMARY, DESCRIPTION тощо); залишаються лише `{ start, end, busy: true }`.
4. Інтервали нормалізуються, мерджаться та обрізаються до діапазону `now() - 30 днів` … `now() + 365 днів`. Готові JSONи (`data/busy-cottage1.json`, `data/busy-cottage2.json`) комітяться назад у гілку.
5. Фронтенд читає `/data/busy-<name>.json` через функцію `loadBusy(name)` із `public/js/busy-loader.js`.

Чому так безпечніше: приватні iCal-URL з Booking мають повний доступ до бронювань. Якщо їх вбудувати у фронтенд, URL потрапить у вихідний код, мережеві логи браузера та будь-хто зможе отримати всі деталі подій. Бекенд-санітарізатор на GitHub Actions гарантує, що у публічний репозиторій і браузер потрапляють тільки часові інтервали без персональних даних.

## Налаштування секретів у GitHub
1. Зайдіть у репозиторій → **Settings** → **Secrets and variables** → **Actions**.
2. Додайте секрети:
   - `BOOKING_CALENDAR_1` — приватне посилання на iCal першого котеджу.
   - `BOOKING_CALENDAR_2` — приватне посилання на iCal другого котеджу (можна залишити порожнім, якщо календар один).
3. Переконайтесь, що URL не потрапляє ні в README, ні в issues/PR.

## Запуск санітаризації вручну
- Відкрийте вкладку **Actions** у репозиторії.
- Оберіть workflow **“Booking iCal sanitize”**.
- Натисніть **Run workflow** → підтвердіть запуск. Доступно у будь-який момент без очікування CRON.

## Формат JSON у каталозі `data/`
```json
{
  "updatedAt": "2025-01-01T12:00:00.000Z",
  "events": [
    { "start": "2025-01-12T14:00:00.000Z", "end": "2025-01-15T09:00:00.000Z", "busy": true }
  ],
  "source": "booking-ical-sanitized",
  "rangeDays": 730
}
```
- `updatedAt` — час оновлення (UTC).
- `events` — масив зайнятих інтервалів у ISO-форматі.
- `source` — ідентифікатор генератора.
- `rangeDays` — довжина видимого “вікна” даних.

## Приклад інтеграції з FullCalendar
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css" />
<script type="module">
  import { Calendar } from 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js';
  import { loadBusy } from '/public/js/busy-loader.js';

  document.addEventListener('DOMContentLoaded', async () => {
    const calendarEl = document.getElementById('calendar');
    const calendar = new Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      events: []
    });
    calendar.render();

    const busyEvents = await loadBusy('cottage1');
    calendar.addEventSource(
      busyEvents.map(({ start, end }) => ({
        start,
        end,
        display: 'background',
        overlap: false,
        color: '#e74c3c'
      }))
    );
  });
</script>
<div id="calendar"></div>
```

## Зміна частоти оновлення
Файл `.github/workflows/ical-sanitize.yml` містить секцію `schedule`. Змініть cron-рядок (формат UTC) на потрібний. Наприклад, щоб запускати щогодини, використайте `0 * * * *`.

## Ротація iCal-URL у Booking
1. У Booking.com відкрийте **Керування помешканням → Календар і тарифи → Синхронізація календаря**.
2. Вимкніть стару синхронізацію та згенеруйте новий приватний iCal-URL.
3. Оновіть секрет `BOOKING_CALENDAR_*` у GitHub.
4. Запустіть workflow вручну, щоб переконатися, що нові URL працюють.

## Кастомізація контенту сайту
- Оновіть контакти у розділі «Контакти» в `index.html`.
- Замініть фото у папках `images/cottage1`, `images/cottage2`, `images/general`.
- Оновіть ціни та описи котеджів у HTML.
- За потреби налаштуйте карту Google у футері та `robots.txt`.

## Локальна перевірка
```bash
npm install
npm test
BOOKING_CALENDAR_1="https://example.com/private.ics" npm run fetch:ical
```
У локальних логах не виводяться самі URL — перевірте лише, що оновилися файли `data/busy-*.json`.

---
© 2025 Гірські котеджі
