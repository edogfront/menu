/* ==========================================================================
   Меню на экраны кофейни
   1. Вписывает макет 1920x1080 в любой экран без искажения пропорций
   2. Разворачивает на весь экран по клику/нажатию OK
   3. Раз в 30 минут проверяет, не поменялось ли меню, и перезагружает страницу
   4. Регистрирует service worker, чтобы меню работало без сети
   ========================================================================== */

(function () {
  'use strict';

  var BASE_W = 1920;
  var BASE_H = 1080;
  var CHECK_EVERY = 30 * 60 * 1000;   // 30 минут

  /* --- Масштаб -------------------------------------------------------- */

  function fit() {
    var scale = Math.min(
      window.innerWidth / BASE_W,
      window.innerHeight / BASE_H
    );
    document.documentElement.style.setProperty('--scale', scale);
  }

  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);

  /* --- Полный экран ---------------------------------------------------- */

  function goFullscreen() {
    var el = document.documentElement;
    var req = el.requestFullscreen
           || el.webkitRequestFullscreen
           || el.mozRequestFullScreen
           || el.msRequestFullscreen;
    if (req) {
      try { req.call(el); } catch (e) { /* телевизор может не разрешить */ }
    }
    var hint = document.querySelector('.hint');
    if (hint) { hint.style.display = 'none'; }
  }

  document.addEventListener('click', goFullscreen);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.keyCode === 13) { goFullscreen(); }
  });

  /* --- Видео: зациклить и не падать, если файла ещё нет ---------------- */

  var video = document.querySelector('.media video');
  if (video) {
    video.addEventListener('error', function () {
      // нет ролика или кодек не поддерживается — остаётся постер
      video.style.display = 'none';
    });
    var tryPlay = function () {
      var p = video.play();
      if (p && p.catch) { p.catch(function () { /* автоплей заблокирован */ }); }
    };
    tryPlay();
    document.addEventListener('click', tryPlay);
  }

  /* --- Проверка обновлений --------------------------------------------- */
  /* Логика как в вашей прежней версии: если сети нет, молча остаёмся на
     том, что уже показано. Экран никогда не гаснет из-за обрыва связи.    */

  function hash(text) {
    var h = 5381, i = text.length;
    while (i) { h = (h * 33) ^ text.charCodeAt(--i); }
    return (h >>> 0).toString(36);
  }

  function checkForUpdate() {
    fetch(location.pathname + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (text) {
        if (!text) { return; }
        var fresh = hash(text);
        var known = null;
        try { known = sessionStorage.getItem('menuHash'); } catch (e) {}

        if (known === null) {
          try { sessionStorage.setItem('menuHash', fresh); } catch (e) {}
          return;
        }
        if (known === fresh) { return; }

        // Новый хэш запоминаем ДО перезагрузки. Иначе после неё сравнение
        // снова даст расхождение — и экран уйдёт в вечный цикл перезагрузок.
        try { sessionStorage.setItem('menuHash', fresh); } catch (e) {}

        // Страховка на случай, если запомнить не удалось (хранилище
        // недоступно): чаще раза в минуту не перезагружаемся ни при чём.
        var last = 0;
        try { last = parseInt(sessionStorage.getItem('menuReloadAt'), 10) || 0; } catch (e) {}
        if (Date.now() - last < 60000) {
          console.log('Перезагрузка уже была только что, пропускаю');
          return;
        }
        try { sessionStorage.setItem('menuReloadAt', String(Date.now())); } catch (e) {}

        console.log('Меню обновилось, перезагружаю');
        location.reload();
      })
      .catch(function () {
        console.log('Сети нет, оставляю текущее меню');
      });
  }

  checkForUpdate();
  setInterval(checkForUpdate, CHECK_EVERY);

  /* --- Офлайн ----------------------------------------------------------- */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        // GitHub Pages отдаёт sw.js с десятиминутным кэшем, поэтому сам
        // браузер замечает новую версию с задержкой. Просим проверить явно —
        // сразу и потом по таймеру вместе с проверкой меню.
        reg.update();
        setInterval(function () { reg.update(); }, CHECK_EVERY);
      }).catch(function () {
        // не смертельно: страница просто не будет работать офлайн
      });
    });
  }
})();
