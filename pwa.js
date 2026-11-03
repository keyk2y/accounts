/* 앱 설치 안내 / 새 패치 알림 / 카카오톡 안내
   Claude 화면 안이나 file:// 로 열었을 때는 아무것도 하지 않아요. */
(function () {
  'use strict';
  if (window.claude) return;
  if (location.protocol.indexOf('http') !== 0) return;

  var DAY = 86400000;
  var ua = navigator.userAgent || '';
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var isKakao = /KAKAOTALK/i.test(ua);
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function recently(key, days) {
    var t = parseInt(ls(key) || '0', 10);
    return t && Date.now() - t < days * DAY;
  }

  /* ---- 공통 팝업 (화면의 sheet 스타일을 그대로 써요) ---- */
  var queue = [];
  function open() {
    if (document.getElementById('pwaPop') || !queue.length) return;
    var q = queue.shift();
    var w = document.createElement('div');
    w.className = 'sheet'; w.id = 'pwaPop'; w.style.zIndex = '60';
    w.innerHTML = '<div class="sheet-bg"></div><div class="sheet-p" role="dialog" aria-modal="true" aria-labelledby="pwaT"><h2 id="pwaT"></h2><p class="muted" id="pwaP" style="line-height:1.6"></p><div class="actions" id="pwaB"></div></div>';
    w.querySelector('#pwaT').textContent = q.title;
    w.querySelector('#pwaP').textContent = q.text;
    var box = w.querySelector('#pwaB');
    function close() { if (w.parentNode) w.parentNode.removeChild(w); setTimeout(open, 200); }
    q.buttons.forEach(function (b) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn wide' + (b.primary ? ' primary' : '');
      el.textContent = b.t;
      el.addEventListener('click', function () { close(); if (b.f) b.f(); });
      box.appendChild(el);
    });
    w.querySelector('.sheet-bg').addEventListener('click', function () { close(); if (q.onDismiss) q.onDismiss(); });
    document.body.appendChild(w);
  }
  function pop(title, text, buttons, onDismiss) {
    queue.push({ title: title, text: text, buttons: buttons, onDismiss: onDismiss });
    open();
  }

  function copyLink(done) {
    var url = location.href.split('#')[0];
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () {});
  }

  /* ---- 카카오톡 안에서는 앱 설치가 막혀 있어요 ---- */
  if (isKakao && !standalone && !recently('mg.kakao', 1)) {
    pop('외부 브라우저로 열어 주세요',
      '카카오톡 안에서는 앱으로 설치할 수 없어요. 크롬이나 사파리로 열면 홈 화면에 설치할 수 있고, 새 패치 알림도 받을 수 있어요.',
      [
        { t: '외부 브라우저로 열기', primary: true, f: function () {
            ls('mg.kakao', String(Date.now()));
            location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href.split('#')[0]);
          } },
        { t: '주소 복사', f: function () { copyLink(function () {}); ls('mg.kakao', String(Date.now())); } },
        { t: '오늘은 그냥 쓸게요', f: function () { ls('mg.kakao', String(Date.now())); } }
      ],
      function () { ls('mg.kakao', String(Date.now())); });
  }

  /* ---- 앱으로 설치 ---- */
  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (standalone || isKakao || recently('mg.install', 7)) return;
    pop('앱으로 설치할까요?',
      '홈 화면에 아이콘이 생겨서 앱처럼 바로 열 수 있어요. 인터넷이 없어도 열려요.',
      [
        { t: '설치하기', primary: true, f: function () {
            ls('mg.install', String(Date.now()));
            if (deferred) { deferred.prompt(); deferred = null; }
          } },
        { t: '나중에', f: function () { ls('mg.install', String(Date.now())); } }
      ],
      function () { ls('mg.install', String(Date.now())); });
  });
  window.addEventListener('appinstalled', function () { deferred = null; ls('mg.install', String(Date.now())); });

  if (isIOS && !standalone && !isKakao && !recently('mg.install', 7)) {
    setTimeout(function () {
      pop('홈 화면에 추가해 보세요',
        '화면 아래(또는 위)의 공유 버튼(네모에 화살표)을 누르고 "홈 화면에 추가"를 고르면 앱처럼 쓸 수 있어요.',
        [{ t: '알겠어요', primary: true, f: function () { ls('mg.install', String(Date.now())); } }],
        function () { ls('mg.install', String(Date.now())); });
    }, 1200);
  }

  /* ---- 새 패치 알림 ---- */
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var asked = false;
    function askUpdate(worker) {
      if (asked) return;
      asked = true;
      pop('새로운 패치 있습니다',
        '새 버전이 나왔어요. 지금 업데이트해도 입력한 기록은 그대로 남아요.',
        [
          { t: '지금 업데이트', primary: true, f: function () { worker.postMessage('SKIP_WAITING'); } },
          { t: '나중에', f: function () { asked = false; } }
        ],
        function () { asked = false; });
    }
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function check() { reg.update().catch(function () {}); }
      if (reg.waiting && navigator.serviceWorker.controller) askUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) askUpdate(nw);
        });
      });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
      setInterval(check, 30 * 60 * 1000);
      check();
    }).catch(function () {});
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }   /* 처음 설치 때는 새로고침하지 않아요 */
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }
})();
