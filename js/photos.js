/* ============================================================
   LYCEUM CONNECT — professional headshots
   Deterministic, gender-aware professional portraits used for
   directory, employee profiles and assignee avatars. Curated
   business headshots (Unsplash), face-cropped and square.
   ============================================================ */
(function () {
  'use strict';
  var MEN = [
    'photo-1472099645785-5658abf4ff4e', 'photo-1500648767791-00dcc994a43e',
    'photo-1506794778202-cad84cf45f1d', 'photo-1560250097-0b93528c311a',
    'photo-1568602471122-7832951cc4c5', 'photo-1519085360753-af0119f7cbe7',
    'photo-1507003211169-0a1dd7228f2d', 'photo-1599566150163-29194dcaad36'
  ];
  var WOMEN = [
    'photo-1494790108377-be9c29b29330', 'photo-1573496359142-b8d87734a5a2',
    'photo-1580489944761-15a19d654956', 'photo-1438761681033-6461ffad8d80',
    'photo-1544005313-94ddf0286df2', 'photo-1534528741775-53994a69daeb',
    'photo-1517841905240-472988babdf9', 'photo-1487412720507-e7ab37603c6f'
  ];
  var ALL = MEN.concat(WOMEN);
  function url(id, size) { return 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=' + (size || 400) + '&h=' + (size || 400) + '&q=80&crop=faces'; }
  function h(s) { s = String(s == null ? '' : s); var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; }

  // gender: 'men' | 'women' | undefined (any)
  window.lcPhoto = function (seed, gender, size) {
    var x = h(seed);
    var pool = gender === 'men' ? MEN : gender === 'women' ? WOMEN : ALL;
    return url(pool[x % pool.length], size);
  };
})();
