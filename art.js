/* Brick style illustrations, drawn in code. Decorative only. window.ART.make(name) returns an SVG element. */
(function () {
  'use strict';

  var U = 12; // one stud in svg units
  var C = {
    y: '#E2B93B', yd: '#B8922A', b: '#4A7396', bd: '#355670', g: '#6F9272', gd: '#55745A',
    r: '#B9503F', rd: '#8E3A2C', w: '#FAF9F6', wd: '#C7C6C1', s: '#C9C8C3', sd: '#9E9D98', k: '#23272D', kd: '#111418'
  };

  /* a brick: x, y, width and height in studs, colour key; studs on top, darker lower edge */
  function blk(x, y, w, h, col) {
    var px = x * U, py = y * U, pw = w * U, ph = h * U, out = '';
    out += '<rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="2.5" fill="' + C[col] + '"/>';
    out += '<rect x="' + px + '" y="' + (py + ph - 3.5) + '" width="' + pw + '" height="3.5" rx="1.5" fill="' + C[col + 'd'] + '"/>';
    out += '<rect x="' + (px + 1.5) + '" y="' + (py + 1) + '" width="' + (pw - 3) + '" height="2" rx="1" fill="#fff" opacity="0.35"/>';
    for (var i = 0; i < w; i++) {
      out += '<rect x="' + (px + i * U + 3) + '" y="' + (py - 3.5) + '" width="' + (U - 6) + '" height="4" rx="1.6" fill="' + C[col] + '"/>';
    }
    return out;
  }
  function rect(x, y, w, h, fill, rx, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '" fill="' + fill + '" ' + (extra || '') + '/>';
  }
  function path(d, fill, stroke, sw, extra) {
    return '<path d="' + d + '" fill="' + (fill || 'none') + '" stroke="' + (stroke || 'none') + '" stroke-width="' + (sw || 0) + '" stroke-linecap="round" stroke-linejoin="round" ' + (extra || '') + '/>';
  }
  function at(x, y, inner) { return '<g transform="translate(' + (x * U) + ' ' + (y * U) + ')">' + inner + '</g>'; }
  function svg(w, h, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -8 ' + (w * U + 8) + ' ' + (h * U + 12) + '" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  var drawTruck = function () {
    var o = blk(0, 9, 14, 1, 's');
    o += blk(0, 8, 8, 1, 'b') + blk(0, 7, 8, 1, 'y') + blk(0, 6, 8, 1, 'b');
    o += blk(8, 8, 4, 1, 'r') + blk(8, 7, 3, 1, 'r');
    o += rect(9.3 * U, 7.2 * U, 1.3 * U, 0.6 * U, '#D7E8F2', 2);
    o += rect(1.4 * U, 8.7 * U, 1.6 * U, 1.6 * U, C.k, 4) + rect(9.2 * U, 8.7 * U, 1.6 * U, 1.6 * U, C.k, 4);
    o += rect(1.85 * U, 9.15 * U, 0.7 * U, 0.7 * U, C.s, 2) + rect(9.65 * U, 9.15 * U, 0.7 * U, 0.7 * U, C.s, 2);
    return o;
  };

  var art = {
    bridge: function () {
      var o = blk(0, 9, 14, 1, 's');
      [8, 7, 6, 5].forEach(function (y, i) {
        var col = i % 2 ? 'y' : 'b';
        o += blk(1, y, 2, 1, col) + blk(11, y, 2, 1, col);
      });
      o += blk(0, 4, 14, 1, 'g');
      o += blk(5, 3, 2, 1, 'r') + blk(8, 3, 2, 1, 'w');
      o += path('M24 60 L84 50 L144 60', null, C.k, 3);
      return svg(14, 10, o);
    },
    truck: function () { return svg(14, 10, drawTruck()); },
    chart: function () {
      var o = blk(0, 9, 14, 1, 's');
      [[1, 2], [4, 3], [7, 5], [10, 7]].forEach(function (b, i) {
        for (var k = 0; k < b[1]; k++) o += blk(b[0], 8 - k, 2, 1, (k + i) % 2 ? 'y' : 'b');
      });
      o += path('M12 70 L56 50 L88 62 L150 14', null, C.r, 4.5);
      o += path('M150 14 L136 16 M150 14 L148 28', null, C.r, 4.5);
      return svg(14, 10, o);
    },
    search: function () {
      var o = blk(2, 6, 5, 1, 'b') + blk(3, 5, 3, 1, 'y') + blk(4, 4, 1, 1, 'r');
      o += rect(8, 8, 76, 76, 'rgba(255,255,255,0.5)', 18, 'stroke="' + C.k + '" stroke-width="7"');
      o += path('M78 78 L112 112', null, C.k, 11);
      return svg(10, 10, o);
    },
    queue: function () {
      var o = blk(0, 7, 14, 1, 's');
      o += blk(1, 6, 2, 1, 'b') + blk(4, 6, 2, 1, 'y') + blk(7, 6, 2, 1, 'r') + blk(10, 6, 2, 1, 'g');
      o += blk(1, 5, 2, 1, 'y') + blk(7, 5, 2, 1, 'r') + blk(7, 4, 2, 1, 'r');
      o += rect(7 * U + 10, 4 * U + 4, 4, 13, '#fff', 2) + rect(7 * U + 10, 4 * U + 21, 4, 4, '#fff', 2);
      o += rect(0.8 * U, 7.9 * U, 1.3 * U, 1 * U, C.k, 3) + rect(11.6 * U, 7.9 * U, 1.3 * U, 1 * U, C.k, 3);
      return svg(14, 8, o);
    },
    shield: function () {
      var o = blk(4, 8, 2, 1, 'b') + blk(3, 7, 4, 1, 'b') + blk(2, 6, 6, 1, 'b') + blk(1, 5, 8, 1, 'b') + blk(1, 4, 8, 1, 'g');
      o += path('M40 76 L54 90 L84 54', null, '#fff', 7);
      return svg(10, 10, o);
    },
    robot: function () {
      var o = blk(3, 9, 4, 1, 'y') + blk(3, 8, 4, 1, 'y');
      o += blk(1, 7, 1, 1, 'r') + blk(8, 7, 1, 1, 'r');
      o += blk(2, 7, 6, 1, 'b') + blk(2, 6, 6, 1, 'b') + blk(2, 5, 6, 1, 'b');
      o += rect(3 * U + 2, 5.2 * U, 14, 14, '#fff', 3) + rect(6 * U + 2, 5.2 * U, 14, 14, '#fff', 3);
      o += rect(3 * U + 6, 5.5 * U, 7, 8, C.k, 2) + rect(6 * U + 6, 5.5 * U, 7, 8, C.k, 2);
      o += rect(4 * U + 4, 6.5 * U, 4 * U - 8, 3, C.k, 1.5);
      o += rect(4.75 * U, 2.6 * U, 3, 1.6 * U, C.k, 1) + rect(4.4 * U, 1.6 * U, 14, 14, C.r, 4);
      return svg(10, 10, o);
    },
    cap: function () {
      var o = blk(3, 6, 6, 1, 'g') + blk(3, 5, 6, 1, 'g');
      o += path('M72 10 L134 40 L72 70 L10 40 Z', C.k, C.kd, 3);
      o += path('M126 44 L126 86', null, C.r, 4);
      o += rect(121, 84, 11, 14, C.r, 2);
      return svg(12, 9, o);
    },
    flask: function () {
      var o = path('M54 10 L78 10 L78 46 L112 98 L20 98 L54 46 Z', '#fff', C.k, 5);
      o += path('M42 74 L90 74 L112 98 L20 98 Z', C.g, null, 0);
      o += rect(52, 6, 28, 8, C.b, 3) + rect(48, 60, 9, 9, C.y, 2) + rect(74, 52, 7, 7, C.y, 2);
      return svg(11, 9, o);
    },
    envelope: function () {
      var o = blk(1, 2, 10, 6, 'w');
      o += path('M12 34 L72 76 L132 34', null, C.k, 4.5);
      o += blk(9, 3, 1, 1, 'r');
      return svg(12, 9, o);
    },
    stack: function () {
      var o = blk(1, 9, 10, 1, 's') + blk(2, 8, 8, 1, 'b') + blk(2, 7, 8, 1, 'y') + blk(3, 6, 6, 1, 'g') + blk(3, 5, 6, 1, 'b') + blk(4, 4, 4, 1, 'r');
      o += rect(66, 44, 52, 52, 'rgba(255,255,255,0.45)', 14, 'stroke="' + C.k + '" stroke-width="6"');
      o += path('M108 90 L134 116', null, C.k, 10);
      return svg(12, 10, o);
    },
    store: function () {
      var o = blk(0, 9, 12, 1, 's');
      o += blk(1, 4, 10, 5, 'w');
      for (var i = 0; i < 10; i++) o += rect((1 + i) * U, 2.4 * U, U, 1.6 * U, i % 2 ? C.w : C.r, 0, 'stroke="' + C.rd + '" stroke-width="0.6"');
      o += rect(1 * U, 2 * U, 10 * U, 0.6 * U, C.rd, 2);
      o += rect(5 * U, 5.6 * U, 2 * U, 3.4 * U, C.b, 3);
      o += rect(2 * U, 5.4 * U, 2 * U, 1.8 * U, '#D7E8F2', 3) + rect(8 * U, 5.4 * U, 2 * U, 1.8 * U, '#D7E8F2', 3);
      return svg(12, 10, o);
    },
    phone: function () {
      var o = blk(1, 1, 6, 9, 'k');
      o += rect(1.5 * U, 1.8 * U, 5 * U, 7 * U, '#E9F1F6', 3);
      o += blk(2, 6, 4, 1, 'y') + blk(2, 7, 4, 1, 'b') + blk(2, 8, 4, 1, 'g');
      o += rect(2.2 * U, 2.6 * U, 1.3 * U, 1.3 * U, C.r, 3) + rect(4.0 * U, 2.8 * U, 2 * U, 0.5 * U, C.s, 2) + rect(4.0 * U, 3.6 * U, 1.4 * U, 0.5 * U, C.s, 2);
      return svg(8, 10, o);
    },
    bag: function () {
      var o = blk(1, 9, 9, 1, 's') + blk(2, 8, 7, 1, 'y') + blk(2, 7, 7, 1, 'y') + blk(2, 6, 7, 1, 'r') + blk(2, 5, 7, 1, 'y');
      o += path('M38 54 Q66 6 94 54', null, C.k, 5);
      o += rect(4.3 * U, 6.15 * U, 2.4 * U, 0.7 * U, '#fff', 2);
      return svg(11, 10, o);
    },
    scene: function () {
      var o = at(0, 0, drawTruck());
      o += blk(16, 5, 5, 4, 'b') + blk(16, 4, 5, 1, 'y');
      o += path('M' + (16 * U - 2) + ' ' + (4 * U - 4) + ' L' + (18.5 * U) + ' ' + (2 * U) + ' L' + (21 * U + 2) + ' ' + (4 * U - 4) + ' Z', C.r, C.rd, 3);
      o += rect(18 * U, 6.6 * U, 1 * U, 2.4 * U, C.w, 2);
      o += blk(12.6, 9, 2, 1, 'y') + blk(12.6, 8, 2, 1, 'r');
      o += path('M' + (12 * U) + ' ' + (5 * U) + ' Q ' + (14 * U) + ' ' + (2 * U) + ' ' + (15.4 * U) + ' ' + (5 * U), null, C.k, 3, 'stroke-dasharray="6 7"');
      return svg(21, 10, o);
    }
  };

  window.ART = {
    make: function (name, cls) {
      var fn = art[name];
      var span = document.createElement('span');
      span.className = 'art' + (cls ? ' ' + cls : '');
      span.setAttribute('aria-hidden', 'true');
      if (fn) span.innerHTML = fn();
      return span;
    }
  };
})();
