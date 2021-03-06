(function(){

var api = mapshaper; // assuming mapshaper is in global scope
var utils = api.utils;
var cli = api.cli;
var geom = api.geom;
var internal = api.internal;
var Bounds = api.internal.Bounds;
var UserError = api.internal.UserError;
var message = api.internal.message;


function Handler(type, target, callback, listener, priority) {
  this.type = type;
  this.callback = callback;
  this.listener = listener || null;
  this.priority = priority || 0;
  this.target = target;
}

Handler.prototype.trigger = function(evt) {
  if (!evt) {
    evt = new EventData(this.type);
    evt.target = this.target;
  } else if (evt.target != this.target || evt.type != this.type) {
    error("[Handler] event target/type have changed.");
  }
  this.callback.call(this.listener, evt);
}

function EventData(type, target, data) {
  this.type = type;
  this.target = target;
  if (data) {
    utils.defaults(this, data);
    this.data = data;
  }
}

EventData.prototype.stopPropagation = function() {
  this.__stop__ = true;
};

//  Base class for objects that dispatch events
function EventDispatcher() {}


// @obj (optional) data object, gets mixed into event
// @listener (optional) dispatch event only to this object
EventDispatcher.prototype.dispatchEvent = function(type, obj, listener) {
  var evt;
  // TODO: check for bugs if handlers are removed elsewhere while firing
  var handlers = this._handlers;
  if (handlers) {
    for (var i = 0, len = handlers.length; i < len; i++) {
      var handler = handlers[i];
      if (handler.type == type && (!listener || listener == handler.listener)) {
        if (!evt) {
          evt = new EventData(type, this, obj);
        }
        else if (evt.__stop__) {
            break;
        }
        handler.trigger(evt);
      }
    }
  }
};

EventDispatcher.prototype.addEventListener =
EventDispatcher.prototype.on = function(type, callback, context, priority) {
  context = context || this;
  priority = priority || 0;
  var handler = new Handler(type, this, callback, context, priority);
  // Insert the new event in the array of handlers according to its priority.
  var handlers = this._handlers || (this._handlers = []);
  var i = handlers.length;
  while (--i >= 0 && handlers[i].priority < handler.priority) {}
  handlers.splice(i+1, 0, handler);
  return this;
};

// Remove an event handler.
// @param {string} type Event type to match.
// @param {function(BoundEvent)} callback Event handler function to match.
// @param {*=} context Execution context of the event handler to match.
// @return {number} Returns number of handlers removed (expect 0 or 1).
EventDispatcher.prototype.removeEventListener = function(type, callback, context) {
  context = context || this;
  var count = this.removeEventListeners(type, callback, context);
  return count;
};

// Remove event handlers; passing arguments can limit which listeners to remove
// Returns nmber of handlers removed.
EventDispatcher.prototype.removeEventListeners = function(type, callback, context) {
  var handlers = this._handlers;
  var newArr = [];
  var count = 0;
  for (var i = 0; handlers && i < handlers.length; i++) {
    var evt = handlers[i];
    if ((!type || type == evt.type) &&
      (!callback || callback == evt.callback) &&
      (!context || context == evt.listener)) {
      count += 1;
    }
    else {
      newArr.push(evt);
    }
  }
  this._handlers = newArr;
  return count;
};

EventDispatcher.prototype.countEventListeners = function(type) {
  var handlers = this._handlers,
    len = handlers && handlers.length || 0,
    count = 0;
  if (!type) return len;
  for (var i = 0; i < len; i++) {
    if (handlers[i].type === type) count++;
  }
  return count;
};



var Env = (function() {
  var inNode = typeof module !== 'undefined' && !!module.exports;
  var inBrowser = typeof window !== 'undefined' && !inNode;
  var inPhantom = inBrowser && !!(window.phantom && window.phantom.exit);
  var ieVersion = inBrowser && /MSIE ([0-9]+)/.exec(navigator.appVersion) && parseInt(RegExp.$1) || NaN;

  return {
    iPhone : inBrowser && !!(navigator.userAgent.match(/iPhone/i)),
    iPad : inBrowser && !!(navigator.userAgent.match(/iPad/i)),
    canvas: inBrowser && !!document.createElement('canvas').getContext,
    inNode : inNode,
    inPhantom : inPhantom,
    inBrowser: inBrowser,
    ieVersion: ieVersion,
    ie: !isNaN(ieVersion)
  };
})();


var Browser = {
  getPageXY: function(el) {
    var x = 0, y = 0;
    if (el.getBoundingClientRect) {
      var box = el.getBoundingClientRect();
      x = box.left - Browser.pageXToViewportX(0);
      y = box.top - Browser.pageYToViewportY(0);
    }
    else {
      var fixed = Browser.elementIsFixed(el);

      while (el) {
        x += el.offsetLeft || 0;
        y += el.offsetTop || 0;
        el = el.offsetParent;
      }

      if (fixed) {
        var offsX = -Browser.pageXToViewportX(0);
        var offsY = -Browser.pageYToViewportY(0);
        x += offsX;
        y += offsY;
      }
    }

    var obj = {x:x, y:y};
    return obj;
  },

  elementIsFixed: function(el) {
    // get top-level offsetParent that isn't body (cf. Firefox)
    var body = document.body;
    while (el && el != body) {
      var parent = el;
      el = el.offsetParent;
    }

    // Look for position:fixed in the computed style of the top offsetParent.
    // var styleObj = parent && (parent.currentStyle || window.getComputedStyle && window.getComputedStyle(parent, '')) || {};
    var styleObj = parent && Browser.getElementStyle(parent) || {};
    return styleObj['position'] == 'fixed';
  },

  pageXToViewportX: function(x) {
    return x - window.pageXOffset;
  },

  pageYToViewportY: function(y) {
    return y - window.pageYOffset;
  },

  getElementStyle: function(el) {
    return el.currentStyle || window.getComputedStyle && window.getComputedStyle(el, '') || {};
  },

  getClassNameRxp: function(cname) {
    return new RegExp("(^|\\s)" + cname + "(\\s|$)");
  },

  hasClass: function(el, cname) {
    var rxp = this.getClassNameRxp(cname);
    return el && rxp.test(el.className);
  },

  addClass: function(el, cname) {
    var classes = el.className;
    if (!classes) {
      classes = cname;
    }
    else if (!this.hasClass(el, cname)) {
      classes = classes + ' ' + cname;
    }
    el.className = classes;
  },

  removeClass: function(el, cname) {
    var rxp = this.getClassNameRxp(cname);
    el.className = el.className.replace(rxp, "$2");
  },

  replaceClass: function(el, c1, c2) {
    var r1 = this.getClassNameRxp(c1);
    el.className = el.className.replace(r1, '$1' + c2 + '$2');
  },

  mergeCSS: function(s1, s2) {
    var div = this._cssdiv;
    if (!div) {
      div = this._cssdiv = document.createElement('div');
    }
    div.style.cssText = s1 + ";" + s2; // extra ';' for ie, which may leave off final ';'
    return div.style.cssText;
  },

  addCSS: function(el, css) {
    el.style.cssText = Browser.mergeCSS(el.style.cssText, css);
  },

  // Return: HTML node reference or null
  // Receive: node reference or id or "#" + id
  getElement: function(ref) {
    var el;
    if (typeof ref == 'string') {
      if (ref.charAt(0) == '#') {
        ref = ref.substr(1);
      }
      if (ref == 'body') {
        el = document.getElementsByTagName('body')[0];
      }
      else {
        el = document.getElementById(ref);
      }
    }
    else if (ref && ref.nodeType !== void 0) {
      el = ref;
    }
    return el || null;
  },

  undraggable: function(el) {
    el.ondragstart = function(){return false;};
    el.draggable = false;
  }

};

Browser.onload = function(handler) {
  if (document.readyState == 'complete') {
    handler();
  } else {
    window.addEventListener('load', handler);
  }
};


// See https://github.com/janl/mustache.js/blob/master/mustache.js
utils.htmlEscape = (function() {
  var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  return function(s) {
    return String(s).replace(/[&<>"'\/]/g, function(s) {
      return entityMap[s];
    });
  };
}());


var classSelectorRE = /^\.([\w-]+)$/,
    idSelectorRE = /^#([\w-]+)$/,
    tagSelectorRE = /^[\w-]+$/,
    tagOrIdSelectorRE = /^#?[\w-]+$/;

function Elements(sel) {
  if ((this instanceof Elements) == false) {
    return new Elements(sel);
  }
  this.elements = [];
  this.select(sel);
}

Elements.prototype = {
  size: function() {
    return this.elements.length;
  },

  select: function(sel) {
    this.elements = Elements.__select(sel);
    return this;
  },

  addClass: function(className) {
    this.forEach(function(el) { el.addClass(className); });
    return this;
  },

  removeClass: function(className) {
    this.forEach(function(el) { el.removeClass(className); })
    return this;
  },

  forEach: function(callback, ctx) {
    for (var i=0, len=this.elements.length; i<len; i++) {
      callback.call(ctx, El(this.elements[i]), i);
    }
    return this;
  }
};

Elements.__select = function(selector, root) {
  root = root || document;
  var els;
  if (classSelectorRE.test(selector)) {
    els = Elements.__getElementsByClassName(RegExp.$1, root);
  }
  else if (tagSelectorRE.test(selector)) {
    els = root.getElementsByTagName(selector);
  }
  else if (document.querySelectorAll) {
    try {
      els = root.querySelectorAll(selector)
    } catch (e) {
      error("Invalid selector:", selector);
    }
  } else {
    error("This browser doesn't support CSS query selectors");
  }
  return utils.toArray(els);
}

Elements.__getElementsByClassName = function(cname, node) {
  if (node.getElementsByClassName) {
    return node.getElementsByClassName(cname);
  }
  var a = [];
  var re = new RegExp('(^| )'+cname+'( |$)');
  var els = node.getElementsByTagName("*");
  for (var i=0, j=els.length; i<j; i++)
    if (re.test(els[i].className)) a.push(els[i]);
  return a;
};

// Converts dash-separated names (e.g. background-color) to camelCase (e.g. backgroundColor)
// Doesn't change names that are already camelCase
//
El.toCamelCase = function(str) {
  var cc = str.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase() });
  return cc;
};

El.fromCamelCase = function(str) {
  var dashed = str.replace(/([A-Z])/g, "-$1").toLowerCase();
  return dashed;
};

El.setStyle = function(el, name, val) {
  var jsName = El.toCamelCase(name);
  if (el.style[jsName] == void 0) {
    trace("[Element.setStyle()] css property:", jsName);
    return;
  }
  var cssVal = val;
  if (isFinite(val)) {
    cssVal = String(val); // problem if converted to scientific notation
    if (jsName != 'opacity' && jsName != 'zIndex') {
      cssVal += "px";
    }
  }
  el.style[jsName] = cssVal;
}

El.findAll = function(sel, root) {
  return Elements.__select(sel, root);
};

function El(ref) {
  if (!ref) error("Element() needs a reference");
  if (ref instanceof El) {
    return ref;
  }
  else if (this instanceof El === false) {
    return new El(ref);
  }

  var node;
  if (utils.isString(ref)) {
    if (El.isHTML(ref)) {
      var parent = El('div').html(ref).node();
      node = parent.childNodes.length  == 1 ? parent.childNodes[0] : parent;
    } else if (tagOrIdSelectorRE.test(ref)) {
      node = Browser.getElement(ref) || document.createElement(ref); // TODO: detect type of argument
    } else {
      node = Elements.__select(ref)[0];
    }
  } else if (ref.tagName) {
    node = ref;
  }
  if (!node) error("Unmatched element selector:", ref);
  this.el = node;
}

utils.inherit(El, EventDispatcher); //

El.removeAll = function(sel) {
  var arr = Elements.__select(sel);
  utils.forEach(arr, function(el) {
    El(el).remove();
  });
};

El.isHTML = function(str) {
  return str && str[0] == '<'; // TODO: improve
};

utils.extend(El.prototype, {

  clone: function() {
    var el = this.el.cloneNode(true);
    if (el.nodeName == 'SCRIPT') {
      // Assume scripts are templates and convert to divs, so children
      //    can ...
      el = El('div').addClass(el.className).html(el.innerHTML).node();
    }
    el.id = utils.getUniqueName();
    this.el = el;
    return this;
  },

  node: function() {
    return this.el;
  },

  width: function() {
   return this.el.offsetWidth;
  },

  height: function() {
    return this.el.offsetHeight;
  },

  top: function() {
    return this.el.offsetTop;
  },

  left: function() {
    return this.el.offsetLeft;
  },

  // Apply inline css styles to this Element, either as string or object.
  //
  css: function(css, val) {
    if (val != null) {
      El.setStyle(this.el, css, val);
    }
    else if (utils.isString(css)) {
      Browser.addCSS(this.el, css);
    }
    else if (utils.isObject(css)) {
      utils.forEachProperty(css, function(val, key) {
        El.setStyle(this.el, key, val);
      }, this);
    }
    return this;
  },

  attr: function(obj, value) {
    if (utils.isString(obj)) {
      if (arguments.length == 1) {
        return this.el.getAttribute(obj);
      }
      this.el[obj] = value;
    }
    else if (!value) {
      Opts.copyAllParams(this.el, obj);
    }
    return this;
  },


  remove: function(sel) {
    this.el.parentNode && this.el.parentNode.removeChild(this.el);
    return this;
  },

  addClass: function(className) {
    Browser.addClass(this.el, className);
    return this;
  },

  removeClass: function(className) {
    Browser.removeClass(this.el, className);
    return this;
  },

  classed: function(className, b) {
    this[b ? 'addClass' : 'removeClass'](className);
    return this;
  },

  hasClass: function(className) {
    return Browser.hasClass(this.el, className);
  },

  toggleClass: function(cname) {
    if (this.hasClass(cname)) {
      this.removeClass(cname);
    } else {
      this.addClass(cname);
    }
  },

  computedStyle: function() {
    return Browser.getElementStyle(this.el);
  },

  visible: function() {
    if (this._hidden !== undefined) {
      return !this._hidden;
    }
    var style = this.computedStyle();
    return style.display != 'none' && style.visibility != 'hidden';
  },

  showCSS: function(css) {
    if (!css) {
      return this._showCSS || "display:block;";
    }
    this._showCSS = css;
    return this;
  },

  hideCSS: function(css) {
    if (!css) {
      return this._hideCSS || "display:none;";
    }
    this._hideCSS = css;
    return this;
  },

  hide: function(css) {
    if (this.visible()) {
      this.css(css || this.hideCSS());
      this._hidden = true;
    }
    return this;
  },

  show: function(css) {
    if (!this.visible()) {
      this.css(css || this.showCSS());
      this._hidden = false;
    }
    return this;
  },

  html: function(html) {
    if (arguments.length == 0) {
      return this.el.innerHTML;
    } else {
      this.el.innerHTML = html;
      return this;
    }
  },

  text: function(str) {
    this.html(utils.htmlEscape(str));
    return this;
  },

  // Shorthand for attr('id', <name>)
  id: function(id) {
    if (id) {
      this.el.id = id;
      return this;
    }
    return this.el.id;
  },

  findChild: function(sel) {
    var node = Elements.__select(sel, this.el)[0];
    return node ? new El(node) : null;
  },

  appendTo: function(ref) {
    var parent = ref instanceof El ? ref.el : Browser.getElement(ref);
    if (this._sibs) {
      for (var i=0, len=this._sibs.length; i<len; i++) {
        parent.appendChild(this._sibs[i]);
      }
    }
    parent.appendChild(this.el);
    return this;
  },

  nextSibling: function() {
    return this.el.nextSibling ? new El(this.el.nextSibling) : null;
  },

  newSibling: function(tagName) {
    var el = this.el,
        sib = document.createElement(tagName),
        e = new El(sib),
        par = el.parentNode;
    if (par) {
      el.nextSibling ? par.insertBefore(sib, el.nextSibling) : par.appendChild(sib);
    } else {
      e._sibs = this._sibs || [];
      e._sibs.push(el);
    }
    return e;
  },

  firstChild: function() {
    var ch = this.el.firstChild;
    while (ch.nodeType != 1) { // skip text nodes
      ch = ch.nextSibling;
    }
    return new El(ch);
  },

  appendChild: function(ref) {
    var el = El(ref);
    this.el.appendChild(el.el);
    return this;
  },

  newChild: function(tagName) {
    var ch = document.createElement(tagName);
    this.el.appendChild(ch);
    return new El(ch);
  },

  // Traverse to parent node
  parent: function() {
    var p = this.el && this.el.parentNode;
    return p ? new El(p) : null;
  },

  findParent: function(tagName) {
    var p = this.el && this.el.parentNode;
    if (tagName) {
      tagName = tagName.toUpperCase();
      while (p && p.tagName != tagName) {
        p = p.parentNode;
      }
    }
    return p ? new El(p) : null;
  },

  // Remove all children of this element
  //
  empty: function() {
    this.el.innerHTML = '';
    return this;
  }

});

// use DOM handler for certain events
// TODO: find a better way distinguising DOM events and other events registered on El
// e.g. different methods
//
//El.prototype.__domevents = utils.arrayToIndex("click,mousedown,mousemove,mouseup".split(','));
El.prototype.__on = El.prototype.on;
El.prototype.on = function(type, func, ctx) {
  if (ctx) {
    error("[El#on()] Third argument no longer supported.");
  }
  if (this.constructor == El) {
    this.el.addEventListener(type, func);
  } else {
    this.__on.apply(this, arguments);
  }
  return this;
};

El.prototype.__removeEventListener = El.prototype.removeEventListener;
El.prototype.removeEventListener = function(type, func) {
  if (this.constructor == El) {
    this.el.removeEventListener(type, func);
  } else {
    this.__removeEventListener.apply(this, arguments);
  }
  return this;
};


function ElementPosition(ref) {
  var self = this,
      el = El(ref),
      pageX = 0,
      pageY = 0,
      width = 0,
      height = 0;

  el.on('mouseover', update);
  window.onorientationchange && window.addEventListener('orientationchange', update);
  window.addEventListener('scroll', update);
  window.addEventListener('resize', update);

  // trigger an update, e.g. when map container is resized
  this.update = function() {
    update();
  };

  this.resize = function(w, h) {
    el.css('width', w).css('height', h);
    update();
  };

  this.width = function() { return width };
  this.height = function() { return height };
  this.position = function() {
    return {
      element: el.node(),
      pageX: pageX,
      pageY: pageY,
      width: width,
      height: height
    };
  };

  function update() {
    var div = el.node(),
        xy = Browser.getPageXY(div),
        w = div.clientWidth,
        h = div.clientHeight,
        x = xy.x,
        y = xy.y,
        resized = w != width || h != height,
        moved = x != pageX || y != pageY;
    if (resized || moved) {
      pageX = x, pageY = y, width = w, height = h;
      self.dispatchEvent('change', self.position());
      if (resized) {
        self.dispatchEvent('resize', self.position());
      }
    }
  }
  update();
}

utils.inherit(ElementPosition, EventDispatcher);


function getTimerFunction() {
  return typeof requestAnimationFrame == 'function' ?
    requestAnimationFrame : function(cb) {setTimeout(cb, 25);};
}

function Timer() {
  var self = this,
      running = false,
      busy = false,
      tickTime, startTime, duration;

  this.start = function(ms) {
    var now = +new Date();
    duration = ms || Infinity;
    startTime = now;
    running = true;
    if (!busy) startTick(now);
  };

  this.stop = function() {
    running = false;
  };

  function startTick(now) {
    busy = true;
    tickTime = now;
    getTimerFunction()(onTick);
  }

  function onTick() {
    var now = +new Date(),
        elapsed = now - startTime,
        pct = Math.min((elapsed + 10) / duration, 1),
        done = pct >= 1;
    if (!running) { // interrupted
      busy = false;
      return;
    }
    if (done) running = false;
    self.dispatchEvent('tick', {
      elapsed: elapsed,
      pct: pct,
      done: done,
      time: now,
      tickTime: now - tickTime
    });
    busy = false;
    if (running) startTick(now);
  }
}

utils.inherit(Timer, EventDispatcher);

function Tween(ease) {
  var self = this,
      timer = new Timer(),
      start, end;

  timer.on('tick', onTick);

  this.start = function(a, b, duration) {
    start = a;
    end = b;
    timer.start(duration || 500);
  };

  function onTick(e) {
    var pct = ease ? ease(e.pct) : e.pct,
        val = end * pct + start * (1 - pct);
    self.dispatchEvent('change', {value: val});
  }
}

utils.inherit(Tween, EventDispatcher);

Tween.sineInOut = function(n) {
  return 0.5 - Math.cos(n * Math.PI) / 2;
};

Tween.quadraticOut = function(n) {
  return 1 - Math.pow((1 - n), 2);
};


function MouseWheelDirection() {
  var ptime = 0;
  var getAverage;

  // use avg of three values, as a buffer against single anomalous values
  return function(e, time) {
    var dir = 0;
    var avg;
    if (e.wheelDelta) dir = e.wheelDelta > 0 ? 1 : -1;
    else if (e.detail) dir = e.detail > 0 ? -1 : 1;
    if (time - ptime > 300) getAverage = LimitedAverage(3); // reset
    ptime = time;
    avg = getAverage(dir) || dir; // handle average == 0
    return avg > 0 ? 1 : -1;
  };
}

function LimitedAverage(maxSize) {
  var arr = [];
  return function(val) {
    var sum = 0,
        i = -1;
    arr.push(val);
    if (arr.length > maxSize) arr.shift();
    while (++i < arr.length) {
      sum += arr[i];
    }
    return sum / arr.length;
  };
}

// @mouse: MouseArea object
function MouseWheel(mouse) {
  var self = this,
      active = false,
      timer = new Timer().addEventListener('tick', onTick),
      sustainInterval = 150,
      fadeDelay = 70,
      eventTime = 0,
      getAverageRate = LimitedAverage(10),
      getWheelDirection = MouseWheelDirection(),
      wheelDirection;

  if (window.onmousewheel !== undefined) { // ie, webkit
    window.addEventListener('mousewheel', handleWheel);
  } else { // firefox
    window.addEventListener('DOMMouseScroll', handleWheel);
  }

  function updateSustainInterval(eventRate) {
    var fadeInterval = 80;
    fadeDelay = eventRate + 50; // adding a little extra time helps keep trackpad scrolling smooth in Firefox
    sustainInterval = fadeDelay + fadeInterval;
  }

  function handleWheel(evt) {
    var now = +new Date();
    wheelDirection = getWheelDirection(evt, now);
    if (!mouse.isOver()) return;
    evt.preventDefault();
    if (!active) {
      active = true;
      self.dispatchEvent('mousewheelstart');
    } else {
      updateSustainInterval(getAverageRate(now - eventTime));
    }
    eventTime = now;
    timer.start(sustainInterval);
  }

  function onTick(evt) {
    var tickInterval = evt.time - eventTime,
        multiplier = evt.tickTime / 25,
        fadeFactor = 0,
        obj;
    if (tickInterval > fadeDelay) {
      fadeFactor = Math.min(1, (tickInterval - fadeDelay) / (sustainInterval - fadeDelay));
    }
    if (evt.done) {
      active = false;
    } else {
      if (fadeFactor > 0) {
        // Decelerate towards the end of the sustain interval (for smoother zooming)
        multiplier *= Tween.quadraticOut(1 - fadeFactor);
      }
      obj = utils.extend({direction: wheelDirection, multiplier: multiplier}, mouse.mouseData());
      self.dispatchEvent('mousewheel', obj);
    }
  }
}

utils.inherit(MouseWheel, EventDispatcher);


function MouseArea(element, pos) {
  var _pos = pos || new ElementPosition(element),
      _areaPos = _pos.position(),
      _self = this,
      _dragging = false,
      _isOver = false,
      _prevEvt,
      _downEvt;

  _pos.on('change', function() {_areaPos = _pos.position()});
  // TODO: think about touch events
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  element.addEventListener('mouseover', onAreaEnter);
  element.addEventListener('mousemove', onAreaEnter);
  element.addEventListener('mouseout', onAreaOut);
  element.addEventListener('mousedown', onAreaDown);
  element.addEventListener('dblclick', onAreaDblClick);

  function onAreaDown(e) {
    e.preventDefault(); // prevent text selection cursor on drag
  }

  function onAreaEnter() {
    if (!_isOver) {
      _isOver = true;
      _self.dispatchEvent('enter');
    }
  }

  function onAreaOut(e) {
    _isOver = false;
    _self.dispatchEvent('leave');
  }

  function onMouseUp(e) {
    var evt = procMouseEvent(e),
        elapsed, dx, dy;
    if (_dragging) {
      _dragging = false;
      _self.dispatchEvent('dragend', evt);
    }
    if (_downEvt) {
      elapsed = evt.time - _downEvt.time;
      dx = evt.pageX - _downEvt.pageX;
      dy = evt.pageY - _downEvt.pageY;
      if (_isOver && elapsed < 500 && Math.sqrt(dx * dx + dy * dy) < 6) {
        _self.dispatchEvent('click', evt);
      }
      _downEvt = null;
    }
  }

  function onMouseDown(e) {
   if (e.button != 2 && e.which != 3) { // ignore right-click
      _downEvt = procMouseEvent(e);
    }
  }

  function onMouseMove(e) {
    var evt = procMouseEvent(e);
    if (!_dragging && _downEvt && _downEvt.hover) {
      _dragging = true;
      _self.dispatchEvent('dragstart', evt);
    }

    if (_dragging) {
      var obj = {
        dragX: evt.pageX - _downEvt.pageX,
        dragY: evt.pageY - _downEvt.pageY
      };
      _self.dispatchEvent('drag', utils.extend(obj, evt));
    } else {
      _self.dispatchEvent('hover', evt);
    }
  }

  function onAreaDblClick(e) {
    if (_isOver) _self.dispatchEvent('dblclick', procMouseEvent(e));
  }

  function procMouseEvent(e) {
    var pageX = e.pageX,
        pageY = e.pageY,
        prev = _prevEvt;
    _prevEvt = {
      shiftKey: e.shiftKey,
      time: +new Date,
      pageX: pageX,
      pageY: pageY,
      hover: _isOver,
      x: pageX - _areaPos.pageX,
      y: pageY - _areaPos.pageY,
      dx: prev ? pageX - prev.pageX : 0,
      dy: prev ? pageY - prev.pageY : 0
    };
    return _prevEvt;
  }

  this.isOver = function() {
    return _isOver;
  }

  this.isDown = function() {
    return !!_downEvt;
  }

  this.mouseData = function() {
    return utils.extend({}, _prevEvt);
  }
}

utils.inherit(MouseArea, EventDispatcher);






function ModeSwitcher() {
  var self = this;
  var mode = null;

  self.getMode = function() {
    return mode;
  };

  // return a function to trigger this mode
  self.addMode = function(name, enter, exit) {
    self.on('mode', function(e) {
      if (e.prev == name) {
        exit();
      }
      if (e.name == name) {
        enter();
      }
    });
  };

  self.addMode(null, function() {}, function() {}); // null mode

  self.clearMode = function() {
    self.enterMode(null);
  };

  self.enterMode = function(next) {
    var prev = mode;
    if (next != prev) {
      mode = next;
      self.dispatchEvent('mode', {name: next, prev: prev});
    }
  };
}

utils.inherit(ModeSwitcher, EventDispatcher);




var gui = api.gui = new ModeSwitcher();
api.enableLogging();

gui.consoleIsOpen = function() {
  return El('body').hasClass('console-open');
};

gui.browserIsSupported = function() {
  return typeof ArrayBuffer != 'undefined' &&
      typeof Blob != 'undefined' && typeof File != 'undefined';
};

gui.getUrlVars = function() {
  var q = window.location.search.substring(1);
  return q.split('&').reduce(function(memo, chunk) {
    var pair = chunk.split('=');
    var key = decodeURIComponent(pair[0]);
    memo[key] = decodeURIComponent(pair[1]);
    return memo;
  }, {});
};

// Assumes that URL path ends with a filename
gui.getUrlFilename = function(url) {
  var path = /\/\/([^#?]+)/.exec(url);
  var file = path ? path[1].split('/').pop() : '';
  return file;
};

gui.formatMessageArgs = function(args) {
  // .replace(/^\[[^\]]+\] ?/, ''); // remove cli annotation (if present)
  return internal.formatLogArgs(args);
};

gui.handleDirectEvent = function(cb) {
  return function(e) {
    if (e.target == this) cb();
  };
};

gui.getInputElement = function() {
  var el = document.activeElement;
  return (el && (el.tagName == 'INPUT' || el.contentEditable == 'true')) ? el : null;
};

gui.selectElement = function(el) {
  var range = document.createRange(),
      sel = getSelection();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
};

gui.blurActiveElement = function() {
  var el = gui.getInputElement();
  if (el) el.blur();
};

// Filter out delayed click events, e.g. so users can highlight and copy text
gui.onClick = function(el, cb) {
  var time;
  el.on('mousedown', function() {
    time = +new Date();
  });
  el.on('mouseup', function(e) {
    if (+new Date() - time < 300) cb(e);
  });
};





// Replace error function in mapshaper lib
var error = internal.error = function() {
  stop.apply(null, utils.toArray(arguments));
};

// replace stop function
var stop = internal.stop = function() {
  // Show a popup error message, then throw an error
  var msg = gui.formatMessageArgs(arguments);
  gui.alert(msg);
  throw new Error(msg);
};


function AlertControl() {
  var el;
  gui.addMode('alert', function() {}, turnOff);

  function turnOff() {
    if (el) {
      el.remove();
      el = null;
    }
  }

  gui.alert = function(str) {
    var infoBox;
    if (!el) {
      el = El('div').appendTo('body').addClass('error-wrapper');
      infoBox = El('div').appendTo(el).addClass('error-box info-box selectable');
      El('p').addClass('error-message').appendTo(infoBox);
      El('div').addClass("btn dialog-btn").appendTo(infoBox).html('close').on('click', gui.clearMode);
    }
    el.findChild('.error-message').html(str);
    gui.enterMode('alert');
  };
}




// TODO: switch all ClickText to ClickText2

// @ref Reference to an element containing a text node
function ClickText2(ref) {
  var self = this;
  var selected = false;
  var el = El(ref).on('mousedown', init);

  function init() {
    el.removeEventListener('mousedown', init);
    el.attr('contentEditable', true)
    .attr('spellcheck', false)
    .attr('autocorrect', false)
    .on('focus', function(e) {
      el.addClass('editing');
      selected = false;
    }).on('blur', function(e) {
      el.removeClass('editing');
      self.dispatchEvent('change');
      getSelection().removeAllRanges();
    }).on('keydown', function(e) {
      if (e.keyCode == 13) { // enter
        e.stopPropagation();
        e.preventDefault();
        this.blur();
      }
    }).on('click', function(e) {
      if (!selected && getSelection().isCollapsed) {
        gui.selectElement(el.node());
      }
      selected = true;
      e.stopPropagation();
    });
  }

  this.value = function(str) {
    if (utils.isString(str)) {
      el.node().textContent = str;
    } else {
      return el.node().textContent;
    }
  };
}

utils.inherit(ClickText2, EventDispatcher);

// @ref reference to a text input element
function ClickText(ref) {
  var _el = El(ref);
  var _self = this;
  var _max = Infinity,
      _min = -Infinity,
      _formatter = function(v) {return String(v);},
      _validator = function(v) {return !isNaN(v);},
      _parser = function(s) {return parseFloat(s);},
      _value = 0;

  _el.on('blur', onblur);
  _el.on('keydown', onpress);

  function onpress(e) {
    if (e.keyCode == 27) { // esc
      _self.value(_value); // reset input field to current value
      _el.el.blur();
    } else if (e.keyCode == 13) { // enter
      _el.el.blur();
    }
  }

  // Validate input contents.
  // Update internal value and fire 'change' if valid
  //
  function onblur() {
    var val = _parser(_el.el.value);
    if (val === _value) {
      // return;
    }
    if (_validator(val)) {
      _self.value(val);
      _self.dispatchEvent('change', {value:_self.value()});
    } else {
      _self.value(_value);
      _self.dispatchEvent('error'); // TODO: improve
    }
  }

  this.bounds = function(min, max) {
    _min = min;
    _max = max;
    return this;
  };

  this.validator = function(f) {
    _validator = f;
    return this;
  };

  this.formatter = function(f) {
    _formatter = f;
    return this;
  };

  this.parser = function(f) {
    _parser = f;
    return this;
  };

  this.text = function() {return _el.el.value;};

  this.value = function(arg) {
    if (arg == void 0) {
      // var valStr = this.el.value;
      // return _parser ? _parser(valStr) : parseFloat(valStr);
      return _value;
    }
    var val = utils.clamp(arg, _min, _max);
    if (!_validator(val)) {
      error("ClickText#value() invalid value:", arg);
    } else {
      _value = val;
    }
    _el.el.value = _formatter(val);
    return this;
  };
}

utils.inherit(ClickText, EventDispatcher);


function Checkbox(ref) {
  var _el = El(ref);
}

utils.inherit(Checkbox, EventDispatcher);

function SimpleButton(ref) {
  var _el = El(ref),
      _self = this,
      _active = !_el.hasClass('disabled');

  _el.on('click', function(e) {
    if (_active) _self.dispatchEvent('click');
    return false;
  });

  if (_el.hasClass('default-btn')) {
    gui.on('enter_key', function(e) {
      if (isVisible()) {
        _self.dispatchEvent('click');
        e.stopPropagation();
      }
    });
  }

  this.active = function(a) {
    if (a === void 0) return _active;
    if (a !== _active) {
      _active = a;
      _el.toggleClass('disabled');
    }
    return this;
  };

  function isVisible() {
    var el = _el.node();
    return el.offsetParent !== null;
  }
}

utils.inherit(SimpleButton, EventDispatcher);




function ModeButton(el, name) {
  var btn = El(el),
      active = false;
  gui.on('mode', function(e) {
    active = e.name == name;
    if (active) {
      btn.addClass('active');
    } else {
      btn.removeClass('active');
    }
  });

  btn.on('click', function() {
    gui.enterMode(active ? null : name);
  });
}




function draggable(ref) {
  var xdown, ydown;
  var el = El(ref),
      dragging = false,
      obj = new EventDispatcher();
  Browser.undraggable(el.node());
  el.on('mousedown', function(e) {
    xdown = e.pageX;
    ydown = e.pageY;
    window.addEventListener('mousemove', onmove);
    window.addEventListener('mouseup', onrelease);
  });

  function onrelease(e) {
    window.removeEventListener('mousemove', onmove);
    window.removeEventListener('mouseup', onrelease);
    if (dragging) {
      dragging = false;
      obj.dispatchEvent('dragend');
    }
  }

  function onmove(e) {
    if (!dragging) {
      dragging = true;
      obj.dispatchEvent('dragstart');
    }
    obj.dispatchEvent('drag', {dx: e.pageX - xdown, dy: e.pageY - ydown});
  }
  return obj;
}

function Slider(ref, opts) {
  var _el = El(ref);
  var _self = this;
  var defaults = {
    space: 7
  };
  opts = utils.extend(defaults, opts);

  var _pct = 0;
  var _track,
      _handle,
      _handleLeft = opts.space;

  function size() {
    return _track ? _track.width() - opts.space * 2 : 0;
  }

  this.track = function(ref) {
    if (ref && !_track) {
      _track = El(ref);
      _handleLeft = _track.el.offsetLeft + opts.space;
      updateHandlePos();
    }
    return _track;
  };

  this.handle = function(ref) {
    var startX;
    if (ref && !_handle) {
      _handle = El(ref);
      draggable(_handle)
        .on('drag', function(e) {
          setHandlePos(startX + e.dx, true);
        })
        .on('dragstart', function(e) {
          startX = position();
          _self.dispatchEvent('start');
        })
        .on('dragend', function(e) {
          _self.dispatchEvent('end');
        });
      updateHandlePos();
    }
    return _handle;
  };

  function position() {
    return Math.round(_pct * size());
  }

  this.pct = function(pct) {
    if (pct >= 0 && pct <= 1) {
      _pct = pct;
      updateHandlePos();
    }
    return _pct;
  };

  function setHandlePos(x, fire) {
    x = utils.clamp(x, 0, size());
    var pct = x / size();
    if (pct != _pct) {
      _pct = pct;
      _handle.css('left', _handleLeft + x);
      _self.dispatchEvent('change', {pct: _pct});
    }
  }

  function updateHandlePos() {
    var x = _handleLeft + Math.round(position());
    if (_handle) _handle.css('left', x);
  }
}

utils.inherit(Slider, EventDispatcher);


// Returns a function for converting simplification ratio [0-1] to an interval value.
// If the dataset is large, the value is an approximation (for speed while using slider)
internal.getThresholdFunction = function(arcs) {
  var size = arcs.getPointCount(),
      nth = Math.ceil(size / 5e5),
      sortedThresholds = arcs.getRemovableThresholds(nth);
      // Sort simplification thresholds for all non-endpoint vertices
      // for quick conversion of simplification percentage to threshold value.
      // For large datasets, use every nth point, for faster sorting.
      utils.quicksort(sortedThresholds, false);

  return function(pct) {
    var n = sortedThresholds.length;
    if (pct >= 1) return 0;
    if (pct <= 0 || n === 0) return Infinity;
    return sortedThresholds[Math.floor(pct * n)];
  };
};




/*
How changes in the simplify control should affect other components

data calculated, 100% simplification
 -> [map] filtered arcs update

data calculated, <100% simplification
 -> [map] filtered arcs update, redraw; [repair] intersection update

change via text field
 -> [map] redraw; [repair] intersection update

slider drag start
 -> [repair] hide display

slider drag
 -> [map] redraw

slider drag end
 -> [repair] intersection update

*/

var SimplifyControl = function(model) {
  var control = {};
  var _value = 1;
  var el = El('#simplify-control-wrapper');
  var menu = El('#simplify-options');
  var slider, text, fromPct;

  new SimpleButton('#simplify-options .submit-btn').on('click', onSubmit);
  new SimpleButton('#simplify-options .cancel-btn').on('click', function() {
    if (el.visible()) {
      // cancel just hides menu if slider is visible
      menu.hide();
    } else {
      gui.clearMode();
    }
  });
  new SimpleButton('#simplify-settings-btn').on('click', function() {
    if (menu.visible()) {
      menu.hide();
    } else {
      initMenu();
    }
  });

  new ModeButton('#simplify-btn', 'simplify');
  gui.addMode('simplify', turnOn, turnOff);
  model.on('select', function() {
    if (gui.getMode() == 'simplify') gui.clearMode();
  });

  // exit simplify mode when user clicks off the visible part of the menu
  menu.on('click', gui.handleDirectEvent(gui.clearMode));

  slider = new Slider("#simplify-control .slider");
  slider.handle("#simplify-control .handle");
  slider.track("#simplify-control .track");
  slider.on('change', function(e) {
    var pct = fromSliderPct(e.pct);
    text.value(pct);
    pct = utils.parsePercent(text.text()); // use rounded value (for consistency w/ cli)
    onChange(pct);
  });
  slider.on('start', function(e) {
    gui.dispatchEvent('simplify_drag_start'); // trigger intersection control to hide
  }).on('end', function(e) {
    gui.dispatchEvent('simplify_drag_end'); // trigger intersection control to redraw
  });

  text = new ClickText("#simplify-control .clicktext");
  text.bounds(0, 1);
  text.formatter(function(val) {
    if (isNaN(val)) return '-';
    var pct = val * 100;
    var decimals = 0;
    if (pct <= 0) decimals = 1;
    else if (pct < 0.001) decimals = 4;
    else if (pct < 0.01) decimals = 3;
    else if (pct < 1) decimals = 2;
    else if (pct < 100) decimals = 1;
    return utils.formatNumber(pct, decimals) + "%";
  });

  text.parser(function(s) {
    return parseFloat(s) / 100;
  });

  text.value(0);
  text.on('change', function(e) {
    var pct = e.value;
    slider.pct(toSliderPct(pct));
    onChange(pct);
    gui.dispatchEvent('simplify_drag_end'); // (kludge) trigger intersection control to redraw
  });

  function turnOn() {
    var target = model.getActiveLayer();
    var arcs = target.dataset.arcs;
    if (!internal.layerHasPaths(target.layer)) {
      gui.alert("This layer can not be simplified");
      return;
    }
    if (arcs.getVertexData().zz) {
      // TODO: try to avoid calculating pct (slow);
      showSlider(); // need to show slider before setting; TODO: fix
      fromPct = internal.getThresholdFunction(arcs, false);
      control.value(arcs.getRetainedPct());

    } else {
      initMenu();
    }
  }

  function initMenu() {
    var dataset = model.getActiveLayer().dataset;
    var showPlanarOpt = !dataset.arcs.isPlanar();
    var opts = internal.getStandardSimplifyOpts(dataset, dataset.info && dataset.info.simplify);
    El('#planar-opt-wrapper').node().style.display = showPlanarOpt ? 'block' : 'none';
    El('#planar-opt').node().checked = !opts.spherical;
    El("#import-retain-opt").node().checked = opts.keep_shapes;
    El("#simplify-options input[value=" + opts.method + "]").node().checked = true;
    menu.show();
  }

  function turnOff() {
    menu.hide();
    control.reset();
  }

  function onSubmit() {
    var dataset = model.getActiveLayer().dataset;
    var showMsg = dataset.arcs && dataset.arcs.getPointCount() > 1e6;
    var delay = 0;
    if (showMsg) {
      delay = 35;
      gui.showProgressMessage('Calculating');
    }
    menu.hide();
    setTimeout(function() {
      var opts = getSimplifyOptions();
      mapshaper.simplify(dataset, opts);
      model.updated({
        // trigger filtered arc rebuild without redraw if pct is 1
        simplify_method: opts.percentage == 1,
        simplify: opts.percentage < 1
      });
      showSlider();
      fromPct = internal.getThresholdFunction(dataset.arcs, false);
      gui.clearProgressMessage();
    }, delay);
  }

  function showSlider() {
    el.show();
    El('body').addClass('simplify'); // for resizing, hiding layer label, etc.
  }

  function getSimplifyOptions() {
    var method = El('#simplify-options input[name=method]:checked').attr('value') || null;
    return {
      method: method,
      percentage: _value,
      no_repair: true,
      keep_shapes: !!El("#import-retain-opt").node().checked,
      planar: !!El('#planar-opt').node().checked
    };
  }

  function toSliderPct(p) {
    p = Math.sqrt(p);
    var pct = 1 - p;
    return pct;
  }

  function fromSliderPct(p) {
    var pct = 1 - p;
    return pct * pct;
  }

  function onChange(pct) {
    if (_value != pct) {
      _value = pct;
      model.getActiveLayer().dataset.arcs.setRetainedInterval(fromPct(pct));
      model.updated({'simplify_amount': true});
      updateSliderDisplay();
    }
  }

  function updateSliderDisplay() {
    // TODO: display resolution and vertex count
    // var dataset = model.getActiveLayer().dataset;
    // var interval = dataset.arcs.getRetainedInterval();
  }

  control.reset = function() {
    control.value(1);
    el.hide();
    menu.hide();
    El('body').removeClass('simplify');
  };

  control.value = function(val) {
    if (!isNaN(val)) {
      // TODO: validate
      _value = val;
      slider.pct(toSliderPct(val));
      text.value(val);
    }
    return _value;
  };

  control.value(_value);
  return control;
};


// Assume zip.js is loaded and zip is defined globally

// @file: Zip file
// @cb: function(err, <files>)
//
gui.readZipFile = function(file, cb) {
  var _files = [];
  zip.createReader(new zip.BlobReader(file), importZipContent, onError);

  function onError(err) {
    cb(err);
  }

  function onDone() {
    cb(null, _files);
  }

  function importZipContent(reader) {
    var _entries;
    reader.getEntries(readEntries);

    function readEntries(entries) {
      _entries = entries || [];
      readNext();
    }

    function readNext() {
      if (_entries.length > 0) {
        readEntry(_entries.pop());
      } else {
        reader.close();
        onDone();
      }
    }

    function readEntry(entry) {
      var filename = entry.filename,
          isValid = !entry.directory && gui.isReadableFileType(filename) &&
              !/^__MACOSX/.test(filename); // ignore "resource-force" files
      if (isValid) {
        entry.getData(new zip.BlobWriter(), function(file) {
          file.name = filename; // Give the Blob a name, like a File object
          _files.push(file);
          readNext();
        });
      } else {
        readNext();
      }
    }
  }
};




gui.showProgressMessage = function(msg) {
  if (!gui.progressMessage) {
    gui.progressMessage = El('div').id('progress-message')
      .appendTo('body');
  }
  El('<div>').text(msg).appendTo(gui.progressMessage.empty().show());
};

gui.clearProgressMessage = function() {
  if (gui.progressMessage) gui.progressMessage.hide();
};




gui.parseFreeformOptions = function(raw, cmd) {
  var str = raw.trim(),
      parsed;
  if (!str) {
    return {};
  }
  if (!/^-/.test(str)) {
    str = '-' + cmd + ' ' + str;
  }
  parsed =  internal.parseCommands(str);
  if (!parsed.length || parsed[0].name != cmd) {
    stop("Unable to parse command line options");
  }
  return parsed[0].options;
};



function CatalogControl(catalog, onSelect) {
  var self = this,
      container = El('#file-catalog'),
      cols = catalog.cols,
      enabled = true,
      items = catalog.items,
      n = items.length,
      row = 0,
      html;

  this.reset = function() {
    enabled = true;
    container.removeClass('downloading');
    this.progress(-1);
  };

  this.progress = function() {}; // set by click handler

  if (n > 0 === false) {
    console.error("Catalog is missing array of items");
    return;
  }

  El('body').addClass('catalog-mode');

  if (!cols) {
    cols = Math.ceil(Math.sqrt(n));
  }
  rows = Math.ceil(n / cols);

  html = '<table>';
  if (catalog.title) {
    html += utils.format('<tr><th colspan="%d"><h4>%s</h4></th></tr>', cols, catalog.title);
  }
  while (row < rows) {
    html += renderRow(items.slice(row * cols, row * cols + cols));
    row++;
  }
  html += '</table>';
  container.node().innerHTML = html;
  Elements('#file-catalog td').forEach(function(el, i) {
    el.on('click', function() {
      selectItem(el, i);
    });
  });

  // Generate onprogress callback to show a progress indicator
  function getProgressFunction(el) {
    var visible = false,
        i = 0;
    return function(pct) {
      i++;
      if (i == 2 && pct < 0.5) {
        // only show progress bar if file will take a while to load
        visible = true;
      }
      if (pct == -1) {
        // kludge to reset progress bar
        el.removeClass('downloading');
        pct = 0;
      }
      if (visible) {
        el.css('background-size', (Math.round(pct * 100) + '% 100%'));
      }
    };
  }

  function renderRow(items) {
    var tds = items.map(function(o, col) {
      var i = row * cols + col;
      return renderCell(o, i);
    });
    return '<tr>' + tds.join('') + '</tr>';
  }

  function selectItem(el,i) {
    var pageUrl = window.location.href.toString().replace(/[?#].*/, '').replace(/\/$/, '') + '/';
    var item = items[i];
    var urls = item.files.map(function(file) {
      var url = (item.url || '') + file;
      if (/^http/.test(url) === false) {
        // assume relative url
        url = pageUrl + '/' + url;
      }
      return url;
    });
    if (enabled) { // only respond to first click
      self.progress = getProgressFunction(el);
      el.addClass('downloading');
      container.addClass('downloading');
      enabled = false;
      onSelect(urls);
    }
  }

  function renderCell(item, i) {
    var template = '<td data-id="%d"><h4 class="title">%s</h4><div class="subtitle">%s</div></td>';
    return utils.format(template, i, item.title, item.subtitle || '');
  }

}




// tests if filename is a type that can be used
gui.isReadableFileType = function(filename) {
  var ext = utils.getFileExtension(filename).toLowerCase();
  return !!internal.guessInputFileType(filename) || internal.couldBeDsvFile(filename) ||
    internal.isZipFile(filename);
};

// @cb function(<FileList>)
function DropControl(el, cb) {
  var area = El(el);
  area.on('dragleave', ondragleave)
      .on('dragover', ondragover)
      .on('drop', ondrop);
  function ondragleave(e) {
    block(e);
    out();
  }
  function ondragover(e) {
    // blocking drag events enables drop event
    block(e);
    over();
  }
  function ondrop(e) {
    block(e);
    out();
    cb(e.dataTransfer.files);
  }
  function over() {
    area.addClass('dragover');
  }
  function out() {
    area.removeClass('dragover');
  }
  function block(e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// @el DOM element for select button
// @cb function(<FileList>)
function FileChooser(el, cb) {
  var btn = El(el).on('click', function() {
    input.el.click();
  });
  var input = El('form')
    .addClass('file-control').appendTo('body')
    .newChild('input')
    .attr('type', 'file')
    .attr('multiple', 'multiple')
    .on('change', onchange);

  function onchange(e) {
    var files = e.target.files;
    // files may be undefined (e.g. if user presses 'cancel' after a file has been selected)
    if (files) {
      // disable the button while files are being processed
      btn.addClass('selected');
      input.attr('disabled', true);
      cb(files);
      btn.removeClass('selected');
      input.attr('disabled', false);
    }
  }
}

function ImportControl(model, opts) {
  var importCount = 0;
  var queuedFiles = [];
  var manifestFiles = opts.files || [];
  var _importOpts = {};
  var cachedFiles = {};
  var catalog;

  if (opts.catalog) {
    catalog = new CatalogControl(opts.catalog, downloadFiles);
  }

  new SimpleButton('#import-buttons .submit-btn').on('click', onSubmit);
  new SimpleButton('#import-buttons .cancel-btn').on('click', gui.clearMode);
  new DropControl('body', receiveFiles); // default drop area is entire page
  new DropControl('#import-drop', receiveFiles);
  new DropControl('#import-quick-drop', receiveFilesQuickView);
  new FileChooser('#file-selection-btn', receiveFiles);
  new FileChooser('#import-buttons .add-btn', receiveFiles);
  new FileChooser('#add-file-btn', receiveFiles);

  gui.addMode('import', turnOn, turnOff);
  gui.enterMode('import');

  gui.on('mode', function(e) {
    // re-open import opts if leaving alert or console modes and nothing has been imported yet
    if (!e.name && model.isEmpty()) {
      gui.enterMode('import');
    }
  });

  function findMatchingShp(filename) {
    // use case-insensitive matching
    var base = utils.getPathBase(filename).toLowerCase();
    return model.getDatasets().filter(function(d) {
      var fname = d.info.input_files && d.info.input_files[0] || "";
      var ext = utils.getFileExtension(fname).toLowerCase();
      var base2 = utils.getPathBase(fname).toLowerCase();
      return base == base2 && ext == 'shp';
    });
  }

  function turnOn() {
    if (manifestFiles.length > 0) {
      downloadFiles(manifestFiles, true);
      manifestFiles = [];
    } else if (model.isEmpty()) {
      El('body').addClass('splash-screen');
    }
  }

  function turnOff() {
    var target;
    if (catalog) catalog.reset(); // re-enable clickable catalog
    if (importCount > 0) {
      // display last layer of last imported dataset
      target = model.getDefaultTargets()[0];
      model.selectLayer(target.layers[target.layers.length-1], target.dataset);
    }
    gui.clearProgressMessage();
    importCount = 0;
    close();
  }

  function close() {
    clearQueuedFiles();
    cachedFiles = {};
  }

  function clearQueuedFiles() {
    queuedFiles = [];
    El('body').removeClass('queued-files');
    El('#dropped-file-list').empty();
  }

  function addFilesToQueue(files) {
    var index = {};
    queuedFiles = queuedFiles.concat(files).reduce(function(memo, f) {
      // filter out unreadable types and dupes
      if (gui.isReadableFileType(f.name) && f.name in index === false) {
        index[f.name] = true;
        memo.push(f);
      }
      return memo;
    }, []);
  }

  // When a Shapefile component is at the head of the queue, move the entire
  // Shapefile to the front of the queue, sorted in reverse alphabetical order,
  // (a kludge), so .shp is read before .dbf and .prj
  // (If a .dbf file is imported before a .shp, it becomes a separate dataset)
  // TODO: import Shapefile parts without relying on this kludge
  function sortQueue(queue) {
    var nextFile = queue[0];
    var basename, parts;
    if (!isShapefilePart(nextFile.name)) {
      return queue;
    }
    basename = utils.getFileBase(nextFile.name).toLowerCase();
    parts = [];
    queue = queue.filter(function(file) {
      if (utils.getFileBase(file.name).toLowerCase() == basename) {
        parts.push(file);
        return false;
      }
      return true;
    });
    parts.sort(function(a, b) {
      // Sorting on LC filename so Shapefiles with mixed-case
      // extensions are sorted correctly
      return a.name.toLowerCase() < b.name.toLowerCase() ? 1 : -1;
    });
    return parts.concat(queue);
  }

  function showQueuedFiles() {
    var list = El('#dropped-file-list').empty();
    queuedFiles.forEach(function(f) {
      El('<p>').text(f.name).appendTo(El("#dropped-file-list"));
    });
  }

  function receiveFilesQuickView(files) {
    receiveFiles(files, true);
  }

  function receiveFiles(files, quickView) {
    var prevSize = queuedFiles.length;
    files = handleZipFiles(utils.toArray(files), quickView);
    addFilesToQueue(files);
    if (queuedFiles.length === 0) return;
    gui.enterMode('import');

    if (quickView === true) {
      onSubmit(quickView);
    } else {
      El('body').addClass('queued-files');
      El('#path-import-options').classed('hidden', !filesMayContainPaths(queuedFiles));
      showQueuedFiles();
    }
  }

  function filesMayContainPaths(files) {
    return utils.some(files, function(f) {
        var type = internal.guessInputFileType(f.name);
        return type == 'shp' || type == 'json' || internal.isZipFile(f.name);
    });
  }

  function onSubmit(quickView) {
    El('body').removeClass('queued-files');
    El('body').removeClass('splash-screen');
    _importOpts = quickView === true ? {} : readImportOpts();
    procNextQueuedFile();
  }

  function addDataset(dataset) {
    model.addDataset(dataset);
    importCount++;
    procNextQueuedFile();
  }

  function procNextQueuedFile() {
    if (queuedFiles.length === 0) {
      gui.clearMode();
    } else {
      queuedFiles = sortQueue(queuedFiles);
      readFile(queuedFiles.shift());
    }
  }

  // TODO: support .cpg
  function isShapefilePart(name) {
    return /\.(shp|shx|dbf|prj)$/i.test(name);
  }

  function readImportOpts() {
    var freeform = El('#import-options .advanced-options').node().value,
        opts = gui.parseFreeformOptions(freeform, 'i');
    opts.no_repair = !El("#repair-intersections-opt").node().checked;
    opts.snap = !!El("#snap-points-opt").node().checked;
    return opts;
  }

  // @file a File object
  function readFile(file) {
    var name = file.name,
        reader = new FileReader(),
        useBinary = internal.isBinaryFile(name) ||
          internal.guessInputFileType(name) == 'json' ||
          internal.guessInputFileType(name) == 'text';

    reader.addEventListener('loadend', function(e) {
      if (!reader.result) {
        handleImportError("Web browser was unable to load the file.", name);
      } else {
        importFileContent(name, reader.result);
      }
    });
    if (useBinary) {
      reader.readAsArrayBuffer(file);
    } else {
      // TODO: consider using "encoding" option, to support CSV files in other encodings than utf8
      reader.readAsText(file, 'UTF-8');
    }
  }

  function importFileContent(fileName, content) {
    var fileType = internal.guessInputType(fileName, content),
        importOpts = utils.extend({}, _importOpts),
        matches = findMatchingShp(fileName),
        dataset, lyr;

    // Add dbf data to a previously imported .shp file with a matching name
    // (.shp should have been queued before .dbf)
    if (fileType == 'dbf' && matches.length > 0) {
      // find an imported .shp layer that is missing attribute data
      // (if multiple matches, try to use the most recently imported one)
      dataset = matches.reduce(function(memo, d) {
        if (!d.layers[0].data) {
          memo = d;
        }
        return memo;
      }, null);
      if (dataset) {
        lyr = dataset.layers[0];
        lyr.data = new internal.ShapefileTable(content, importOpts.encoding);
        if (lyr.shapes && lyr.data.size() != lyr.shapes.length) {
          stop("Different number of records in .shp and .dbf files");
        }
        if (!lyr.geometry_type) {
          // kludge: trigger display of table cells if .shp has null geometry
          model.updated({}, lyr, dataset);
        }
        procNextQueuedFile();
        return;
      }
    }

    if (fileType == 'shx') {
      // save .shx for use when importing .shp
      // (queue should be sorted so that .shx is processed before .shp)
      cachedFiles[fileName.toLowerCase()] = {filename: fileName, content: content};
      procNextQueuedFile();
      return;
    }

    // Add .prj file to previously imported .shp file
    if (fileType == 'prj') {
      matches.forEach(function(d) {
        if (!d.info.prj) {
          d.info.prj = content;
        }
      });
      procNextQueuedFile();
      return;
    }

    importNewDataset(fileType, fileName, content, importOpts);
  }

  function importNewDataset(fileType, fileName, content, importOpts) {
    var size = content.byteLength || content.length, // ArrayBuffer or string
        delay = 0;

    // show importing message if file is large
    if (size > 4e7) {
      gui.showProgressMessage('Importing');
      delay = 35;
    }
    setTimeout(function() {
      var dataset;
      var input = {};
      try {
        input[fileType] = {filename: fileName, content: content};
        if (fileType == 'shp') {
          // shx file should already be cached, if it was added together with the shp
          input.shx = cachedFiles[fileName.replace(/shp$/i, 'shx').toLowerCase()] || null;
        }
        dataset = internal.importContent(input, importOpts);
        // save import options for use by repair control, etc.
        dataset.info.import_options = importOpts;
        addDataset(dataset);

      } catch(e) {
        handleImportError(e, fileName);
      }
    }, delay);
  }

  function handleImportError(e, fileName) {
    var msg = utils.isString(e) ? e : e.message;
    if (fileName) {
      msg = "Error importing <i>" + fileName + "</i><br>" + msg;
    }
    clearQueuedFiles();
    gui.alert(msg);
    console.error(e);
  }

  function handleZipFiles(files, quickView) {
    return files.filter(function(file) {
      var isZip = internal.isZipFile(file.name);
      if (isZip) {
        readZipFile(file, quickView);
      }
      return !isZip;
    });
  }

  function readZipFile(file, quickView) {
    // gui.showProgressMessage('Importing');
    setTimeout(function() {
      gui.readZipFile(file, function(err, files) {
        if (err) {
          handleImportError(err, file.name);
        } else {
          // don't try to import .txt files from zip files
          // (these would be parsed as dsv and throw errows)
          files = files.filter(function(f) {
            return !/\.txt$/i.test(f.name);
          });
          receiveFiles(files, quickView);
        }
      });
    }, 35);
  }

  function prepFilesForDownload(names) {
    var items = names.map(function(name) {
      var isUrl = /:\/\//.test(name);
      var item = {name: name};
      if (isUrl) {
        item.url = name;
        item.basename = gui.getUrlFilename(name);

      } else {
        item.basename = name;
        // Assume non-urls are local files loaded via mapshaper-gui
        item.url = '/data/' + name;
        item.url = item.url.replace('/../', '/~/'); // kludge to allow accessing one parent
      }
      return gui.isReadableFileType(item.basename) ? item : null;
    });
    return items.filter(Boolean);
  }

  function downloadFiles(paths, quickView) {
    var items = prepFilesForDownload(paths);
    utils.reduceAsync(items, [], downloadNextFile, function(err, files) {
      if (err) {
        gui.alert(err);
      } else if (!files.length) {
        gui.clearMode();
      } else {
        receiveFiles(files, quickView);
      }
    });
  }

  function downloadNextFile(memo, item, next) {
    var req = new XMLHttpRequest();
    var blob;
    req.responseType = 'blob';
    req.addEventListener('load', function(e) {
      if (req.status == 200) {
        blob = req.response;
      }
    });
    req.addEventListener('progress', function(e) {
      var pct = e.loaded / e.total;
      if (catalog) catalog.progress(pct);
    });
    req.addEventListener('loadend', function() {
      var err;
      if (req.status == 404) {
        err = "Not&nbsp;found:&nbsp;" + item.name;
      } else if (!blob) {
        // Errors like DNS lookup failure, no CORS headers, no network connection
        // all are status 0 - it seems impossible to show a more specific message
        // actual reason is displayed on the console
        err = "Error&nbsp;loading&nbsp;" + item.name + ". Possible causes include: wrong URL, no network connection, server not configured for cross-domain sharing (CORS).";
      } else {
        blob.name = item.basename;
        memo.push(blob);
      }
      next(err, memo);
    });
    req.open('GET', item.url);
    req.send();
  }
}




gui.exportIsSupported = function() {
  return typeof URL != 'undefined' && URL.createObjectURL &&
    typeof document.createElement("a").download != "undefined" ||
    !!window.navigator.msSaveBlob;
};

function canSaveToServer() {
  return !!(mapshaper.manifest && mapshaper.manifest.allow_saving) && typeof fetch == 'function';
}

// replaces function from mapshaper.js
internal.writeFiles = function(files, opts, done) {
  var filename;
  if (!utils.isArray(files) || files.length === 0) {
    done("Nothing to export");
  } else if (canSaveToServer() && !opts.save_to_download_folder) {
    saveFilesToServer(files, opts, function(err) {
      var msg;
      if (err) {
        msg = "<b>Direct save failed</b><br>Reason: " + err + ".";
        msg += "<br>Saving to download folder instead.";
        gui.alert(msg);
        // fall back to standard method if saving to server fails
        internal.writeFiles(files, {save_to_download_folder: true}, done);
      } else {
        done();
      }
    });
  } else if (files.length == 1) {
    saveBlobToDownloadFolder(files[0].filename, new Blob([files[0].content]), done);
  } else {
    filename = utils.getCommonFileBase(utils.pluck(files, 'filename')) || "output";
    saveZipFile(filename + ".zip", files, done);
  }
};

function saveZipFile(zipfileName, files, done) {
  var toAdd = files;
  var zipWriter;
  try {
    zip.createWriter(new zip.BlobWriter("application/zip"), function(writer) {
      zipWriter = writer;
      nextFile();
    }, zipError);
  } catch(e) {
    done("This browser doesn't support Zip file creation.");
  }

  function zipError(msg) {
    var str = "Error creating Zip file";
    if (msg) {
      str += ": " + (msg.message || msg);
    }
    done(str);
  }

  function nextFile() {
    if (toAdd.length === 0) {
      zipWriter.close(function(blob) {
        saveBlobToDownloadFolder(zipfileName, blob, done);
      });
    } else {
      var obj = toAdd.pop(),
          blob = new Blob([obj.content]);
      zipWriter.add(obj.filename, new zip.BlobReader(blob), nextFile);
    }
  }
}

function saveFilesToServer(exports, opts, done) {
  var paths = internal.getOutputPaths(utils.pluck(exports, 'filename'), opts);
  var data = utils.pluck(exports, 'content');
  var i = -1;
  next();
  function next(err) {
    i++;
    if (err) return done(err);
    if (i >= exports.length) {
      gui.alert('<b>Saved</b><br>' + paths.join('<br>'));
      return done();
    }
    saveBlobToServer(paths[i], new Blob([data[i]]), next);
  }
}

function saveBlobToServer(path, blob, done) {
  var q = '?file=' + encodeURIComponent(path);
  var url = window.location.origin + '/save' + q;
  fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: blob
  }).then(function(resp) {
    if (resp.status == 400) {
      return resp.text();
    }
  }).then(function(err) {
    done(err);
  }).catch(function(resp) {
    done('connection to server was lost');
  });
}

function saveBlobToDownloadFolder(filename, blob, done) {
  var anchor, blobUrl;
  if (window.navigator.msSaveBlob) {
    window.navigator.msSaveBlob(blob, filename);
    return done();
  }
  try {
    blobUrl = URL.createObjectURL(blob);
  } catch(e) {
    done("Mapshaper can't export files from this browser. Try switching to Chrome or Firefox.");
    return;
  }
  anchor = El('a').attr('href', '#').appendTo('body').node();
  anchor.href = blobUrl;
  anchor.download = filename;
  var clickEvent = document.createEvent("MouseEvent");
  clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false,
      false, false, false, 0, null);
  anchor.dispatchEvent(clickEvent);
  setTimeout(function() {
    // Revoke blob url to release memory; timeout needed in firefox
    URL.revokeObjectURL(blobUrl);
    anchor.parentNode.removeChild(anchor);
    done();
  }, 400);
}




// Export buttons and their behavior
var ExportControl = function(model) {
  var unsupportedMsg = "Exporting is not supported in this browser";
  var menu = El('#export-options').on('click', gui.handleDirectEvent(gui.clearMode));
  var checkboxes = []; // array of layer checkboxes
  new SimpleButton('#export-options .cancel-btn').on('click', gui.clearMode);

  if (!gui.exportIsSupported()) {
    El('#export-btn').on('click', function() {
      gui.alert(unsupportedMsg);
    });

    internal.writeFiles = function() {
      error(unsupportedMsg);
    };
  } else {
    new SimpleButton('#save-btn').on('click', onExportClick);
    gui.addMode('export', turnOn, turnOff);
    new ModeButton('#export-btn', 'export');
  }

  function onExportClick() {
    gui.showProgressMessage('Exporting');
    gui.clearMode();
    setTimeout(function() {
      exportMenuSelection(function(err) {
        if (err) {
          if (utils.isString(err)) {
            gui.alert(err);
          } else {
            // stack seems to change if Error is logged directly
            console.error(err.stack);
            gui.alert("Export failed for an unknown reason");
          }
        }
        gui.clearProgressMessage();
      });
    }, 20);
  }

  // @done function(string|Error|null)
  function exportMenuSelection(done) {
    var opts, files;
    try {
      opts = gui.parseFreeformOptions(El('#export-options .advanced-options').node().value, 'o');
      if (!opts.format) opts.format = getSelectedFormat();
      // ignoring command line "target" option
      files = internal.exportTargetLayers(getTargetLayers(), opts);
    } catch(e) {
      return done(e);
    }
    internal.writeFiles(files, opts, done);
  }

  function initLayerMenu() {
    var list = El('#export-layer-list').empty();
    var template = '<label><input type="checkbox" value="%s" checked> %s</label>';
    var objects = model.getLayers().map(function(o, i) {
      var html = utils.format(template, i + 1, o.layer.name || '[unnamed layer]');
      return {layer: o.layer, html: html};
    });
    internal.sortLayersForMenuDisplay(objects);
    checkboxes = objects.map(function(o) {
      return El('div').html(o.html).appendTo(list).findChild('input').node();
    });
    El('#export-layers').css('display', checkboxes.length < 2 ? 'none' : 'block');
  }

  function getInputFormats() {
    return model.getDatasets().reduce(function(memo, d) {
      var fmts = d.info && d.info.input_formats || [];
      return memo.concat(fmts);
    }, []);
  }

  function getDefaultExportFormat() {
    var dataset = model.getActiveLayer().dataset;
    return dataset.info && dataset.info.input_formats &&
        dataset.info.input_formats[0] || 'geojson';
  }

  function initFormatMenu() {
    var defaults = ['shapefile', 'geojson', 'topojson', 'json', 'dsv', 'svg'];
    var formats = utils.uniq(defaults.concat(getInputFormats()));
    var items = formats.map(function(fmt) {
      return utils.format('<div><label><input type="radio" name="format" value="%s"' +
        ' class="radio">%s</label></div>', fmt, internal.getFormatName(fmt));
    });
    El('#export-formats').html(items.join('\n'));
    El('#export-formats input[value="' + getDefaultExportFormat() + '"]').node().checked = true;
  }

  function turnOn() {
    initLayerMenu();
    initFormatMenu();
    menu.show();
  }

  function turnOff() {
    menu.hide();
  }

  function getSelectedFormat() {
    return El('#export-formats input:checked').node().value;
  }

  function getTargetLayers() {
    var ids = checkboxes.reduce(function(memo, box, i) {
      if (box.checked) memo.push(box.value);
      return memo;
    }, []).join(',');
    return ids ? model.findCommandTargets(ids) : [];
  }
};




function RepairControl(model, map) {
  var el = El("#intersection-display"),
      readout = el.findChild("#intersection-count"),
      repairBtn = el.findChild("#repair-btn"),
      // keeping a reference to current arcs and intersections, so intersections
      // don't need to be recalculated when 'repair' button is pressed.
      _currArcs,
      _currXX;

  gui.on('simplify_drag_start', hide);
  gui.on('simplify_drag_end', updateAsync);

  model.on('update', function(e) {
    var flags = e.flags;
    var needUpdate = flags.simplify || flags.proj || flags.arc_count ||
        flags.affine || flags.points || flags['merge-layers'] || flags.select;
    if (needUpdate) {
      if (flags.select) {
        // preserve cached intersections
      } else {
        // delete any cached intersection data
        e.dataset.info.intersections = null;
      }
      updateAsync();
    }
  });

  repairBtn.on('click', function() {
    var fixed = internal.repairIntersections(_currArcs, _currXX);
    showIntersections(fixed, _currArcs);
    repairBtn.addClass('disabled');
    model.updated({repair: true});
  });

  function hide() {
    el.hide();
    map.setIntersectionLayer(null);
  }

  function enabledForDataset(dataset) {
    var info = dataset.info || {};
    var opts = info.import_options || {};
    return !opts.no_repair && !info.no_intersections;
  }

  // Delay intersection calculation, so map can redraw after previous
  // operation (e.g. layer load, simplification change)
  function updateAsync() {
    reset();
    setTimeout(updateSync, 10);
  }

  function updateSync() {
    var e = model.getActiveLayer();
    var dataset = e.dataset;
    var arcs = dataset && dataset.arcs;
    var XX, showBtn;
    if (!arcs || !internal.layerHasPaths(e.layer) || !enabledForDataset(dataset)) return;
    if (arcs.getRetainedInterval() > 0) {
      // TODO: cache these intersections
      XX = internal.findSegmentIntersections(arcs);
      showBtn = XX.length > 0;
    } else { // no simplification
      XX = dataset.info.intersections;
      if (!XX) {
        // cache intersections at 0 simplification, to avoid recalculating
        // every time the simplification slider is set to 100% or the layer is selected at 100%
        XX = dataset.info.intersections = internal.findSegmentIntersections(arcs);
      }
      showBtn = false;
    }
    el.show();
    showIntersections(XX, arcs);
    repairBtn.classed('disabled', !showBtn);
  }

  function reset() {
    _currArcs = null;
    _currXX = null;
    hide();
  }

  function dismiss() {
    var dataset = model.getActiveLayer().dataset;
    dataset.info.intersections = null;
    dataset.info.no_intersections = true;
    reset();
  }

  function showIntersections(XX, arcs) {
    var n = XX.length, pointLyr;
    _currXX = XX;
    _currArcs = arcs;
    if (n > 0) {
      pointLyr = {geometry_type: 'point', shapes: [internal.getIntersectionPoints(XX)]};
      map.setIntersectionLayer(pointLyr, {layers:[pointLyr]});
      readout.html(utils.format('<span class="icon"></span>%s line intersection%s <img class="close-btn" src="images/close.png">', n, utils.pluralSuffix(n)));
      readout.findChild('.close-btn').on('click', dismiss);
    } else {
      map.setIntersectionLayer(null);
      readout.html('');
    }
  }
}

utils.inherit(RepairControl, EventDispatcher);


function DomCache() {
  var cache = {};
  var used = {};

  this.contains = function(html) {
    return html in cache;
  };

  this.use = function(html) {
    var el = used[html] = cache[html];
    return el;
  };

  this.cleanup = function() {
    cache = used;
    used = {};
  };

  this.add = function(html, el) {
    used[html] = el;
  };
}





internal.updateLayerStackOrder = function(layers) {
  // 1. assign ascending ids to unassigned layers above the range of other layers
  layers.forEach(function(o, i) {
    if (!o.layer.stack_id) o.layer.stack_id = 1e6 + i;
  });
  // 2. sort in ascending order
  layers.sort(function(a, b) {
    return a.layer.stack_id - b.layer.stack_id;
  });
  // 3. assign consecutve ids
  layers.forEach(function(o, i) {
    o.layer.stack_id = i + 1;
  });
  return layers;
};

internal.sortLayersForMenuDisplay = function(layers) {
  layers = internal.updateLayerStackOrder(layers);
  return layers.reverse();
};





function LayerControl(model, map) {
  var el = El("#layer-control").on('click', gui.handleDirectEvent(gui.clearMode));
  var buttonLabel = El('#layer-control-btn .layer-name');
  var isOpen = false;
  var cache = new DomCache();
  var pinAll = El('#pin-all'); // button for toggling layer visibility

  // layer repositioning
  var dragLayerId = null;
  var hoverLayerId = null;
  var layerOrderSlug;
  var dragStarted = false;

  new ModeButton('#layer-control-btn .header-btn', 'layer_menu');
  gui.addMode('layer_menu', turnOn, turnOff);
  model.on('update', function(e) {
    updateMenuBtn();
    if (isOpen) render();
  });

  el.on('mouseup', clearInsertion);
  el.on('mouseleave', clearInsertion);

  // init layer visibility button
  pinAll.on('click', function() {
    var allOn = testAllLayersPinned();
    model.forEachLayer(function(lyr, dataset) {
      if (allOn) {
        map.removeReferenceLayer(lyr);
      } else {
        map.addReferenceLayer(lyr, dataset);
      }
    });
    El.findAll('.pinnable', el.node()).forEach(function(item) {
      El(item).classed('pinned', !allOn);
    });
    map.redraw();
  });


  function updatePinAllButton() {
    pinAll.classed('pinned', testAllLayersPinned());
  }

  function testAllLayersPinned() {
    var yes = true;
    model.forEachLayer(function(lyr, dataset) {
      if (isPinnable(lyr) && !map.isReferenceLayer(lyr) && !map.isActiveLayer(lyr)) {
        yes = false;
      }
    });
    return yes;
  }

  function findLayerById(id) {
    return model.findLayer(function(lyr, dataset) {
      return lyr.menu_id == id;
    });
  }

  function getLayerOrderSlug() {
    return internal.sortLayersForMenuDisplay(model.getLayers()).map(function(o) {
      return map.isVisibleLayer(o.layer) ? o.layer.menu_id : '';
    }).join('');
  }

  function clearClass(name) {
    var targ = el.findChild('.' + name);
    if (targ) targ.removeClass(name);
  }

  function clearInsertion() {
    clearClass('drag-target');
    clearClass('insert-above');
    clearClass('insert-below');
    dragLayerId = hoverLayerId = layerOrderSlug = null;
  }

  function insertLayer(dragId, dropId, above) {
    var dragLyr = findLayerById(dragId);
    var dropLyr = findLayerById(dropId);
    var slug;
    if (dragId == dropId) return;
    dragLyr.layer.stack_id = dropLyr.layer.stack_id + (above ? 0.5 : -0.5);
    slug = getLayerOrderSlug();
    if (slug != layerOrderSlug) {
      layerOrderSlug = slug;
      map.redraw();
    }
  }

  function turnOn() {
    isOpen = true;
    El('#layer-control div.info-box-scrolled').css('max-height', El('body').height() - 80);
    render();
    el.show();
  }

  function turnOff() {
    isOpen = false;
    el.hide();
  }

  function updateMenuBtn() {
    var name = model.getActiveLayer().layer.name || "[unnamed layer]";
    buttonLabel.html(name + " &nbsp;&#9660;");
  }

  function render() {
    var list = El('#layer-control .layer-list');
    var uniqIds = {};
    var pinnableCount = 0;
    list.empty();
    model.forEachLayer(function(lyr, dataset) {
      // Assign a unique id to each layer, so html strings
      // can be used as unique identifiers for caching rendered HTML, and as
      // an id for layer menu event handlers
      if (!lyr.menu_id || uniqIds[lyr.menu_id]) {
        lyr.menu_id = utils.getUniqueName();
      }
      uniqIds[lyr.menu_id] = true;
      if (isPinnable(lyr)) pinnableCount++;
    });

    if (pinnableCount < 2) {
      pinAll.hide();
    } else {
      pinAll.show();
      updatePinAllButton();
    }

    internal.sortLayersForMenuDisplay(model.getLayers()).forEach(function(o) {
      var lyr = o.layer;
      var pinnable = pinnableCount > 1 && isPinnable(lyr);
      var html, element;
      html = renderLayer(lyr, o.dataset, pinnable);
      if (cache.contains(html)) {
        element = cache.use(html);
      } else {
        element = El('div').html(html).firstChild();
        initMouseEvents(element, lyr.menu_id, pinnable);
        cache.add(html, element);
      }
      list.appendChild(element);
    });
  }

  cache.cleanup();

  function renderLayer(lyr, dataset, pinnable) {
    var warnings = getWarnings(lyr, dataset);
    var classes = 'layer-item';
    var entry, html;

    if (pinnable) classes += ' pinnable';
    if (map.isActiveLayer(lyr)) classes += ' active';
    if (map.isReferenceLayer(lyr)) classes += ' pinned';

    html = '<!-- ' + lyr.menu_id + '--><div class="' + classes + '">';
    html += rowHTML('name', '<span class="layer-name colored-text dot-underline">' + getDisplayName(lyr.name) + '</span>', 'row1');
    html += rowHTML('source file', describeSrc(lyr, dataset) || 'n/a');
    html += rowHTML('contents', describeLyr(lyr));
    if (warnings) {
      html += rowHTML('problems', warnings, 'layer-problems');
    }
    html += '<img class="close-btn" src="images/close.png">';
    if (pinnable) {
      html += '<img class="pin-btn unpinned" src="images/eye.png">';
      html += '<img class="pin-btn pinned" src="images/eye2.png">';
    }
    html += '</div>';
    return html;
  }

  function initMouseEvents(entry, id, pinnable) {
    entry.on('mouseover', init);
    function init() {
      entry.removeEventListener('mouseover', init);
      initMouseEvents2(entry, id, pinnable);
    }
  }

  // TODO: finish implementing this
  function initLayerDragging(entry, id) {
    var rect;

    // support layer drag-drop
    entry.on('mousemove', function(e) {
      hoverLayerId = id;
      if (dragStarted) {
        // mousedown event was just fired - start dragging
        layerOrderSlug = getLayerOrderSlug();
        dragStarted = false;
        dragLayerId = id;
        entry.addClass('drag-target');
      }
      if (!dragLayerId) return;
      rect = entry.node().getBoundingClientRect();
      entry.addClass('dragging');

      if (dragLayerId == id) return;

      var y = e.pageY - rect.top;
      if (y < rect.height / 2) {
        entry.addClass('insert-above');
        entry.removeClass('insert-below');
        insertLayer(dragLayerId, id, true);
      } else {
        entry.removeClass('insert-above');
        entry.addClass('insert-below');
        insertLayer(dragLayerId, id, false);
      }
    });

    entry.on('mouseup', function() {
      if (dragLayerId) {
        render(); // in case menu changed...
        clearInsertion();
      }
    });

    entry.on('mousedown', function() {
      dragStarted = true;
    });

    entry.on('mouseleave', function(e) {
      entry.removeClass('insert-above');
      entry.removeClass('insert-below');
      entry.removeClass('dragging');
      dragStarted = false;
      hoverLayerId = null;
    });
  }

  function initMouseEvents2(entry, id, pinnable) {

    initLayerDragging(entry, id);

    // init delete button
    entry.findChild('img.close-btn').on('mouseup', function(e) {
      var target = findLayerById(id);
      e.stopPropagation();
      if (map.isReferenceLayer(target.layer)) {
        // TODO: check for double map refresh after model.deleteLayer() below
        map.removeReferenceLayer(target.layer);
      }
      model.deleteLayer(target.layer, target.dataset);
    });

    if (pinnable) {
      // init pin button
      entry.findChild('img.pinned').on('mouseup', function(e) {
        var target = findLayerById(id);
        if (entry.hasClass('dragging')) return;
        e.stopPropagation();
        if (map.isReferenceLayer(target.layer)) {
          map.removeReferenceLayer(target.layer);
          entry.removeClass('pinned');
        } else {
          map.addReferenceLayer(target.layer, target.dataset);
          entry.addClass('pinned');
        }
        updatePinAllButton();
        map.redraw();
      });
    }

    // init name editor
    new ClickText2(entry.findChild('.layer-name'))
      .on('change', function(e) {
        var target = findLayerById(id);
        var str = cleanLayerName(this.value());
        this.value(getDisplayName(str));
        target.layer.name = str;
        updateMenuBtn();
      });

    // init click-to-select
    gui.onClick(entry, function() {
      var target = findLayerById(id);
      if (!gui.getInputElement()) { // don't select if user is typing
        gui.clearMode();
        if (!map.isActiveLayer(target.layer)) {
          model.updated({select: true}, target.layer, target.dataset);
        }
      }
    });
  }

  function describeLyr(lyr) {
    var n = internal.getFeatureCount(lyr),
        str, type;
    if (lyr.data && !lyr.shapes) {
      type = 'data record';
    } else if (lyr.geometry_type) {
      type = lyr.geometry_type + ' feature';
    }
    if (type) {
      str = utils.format('%,d %s%s', n, type, utils.pluralSuffix(n));
    } else {
      str = "[empty]";
    }
    return str;
  }

  function getWarnings(lyr, dataset) {
    var file = getSourceFile(lyr, dataset);
    var missing = [];
    var msg;
    if (utils.endsWith(file, '.shp') && lyr == dataset.layers[0]) {
      if (!lyr.data) {
        missing.push('.dbf');
      }
      if (!dataset.info.prj && !dataset.info.crs) {
        missing.push('.prj');
      }
    }
    if (missing.length) {
      msg = 'missing ' + missing.join(' and ') + ' data';
    }
    return msg;
  }

  function getSourceFile(lyr, dataset) {
    var inputs = dataset.info.input_files;
    return inputs && inputs[0] || '';
  }

  function describeSrc(lyr, dataset) {
    return getSourceFile(lyr, dataset);
  }

  function getDisplayName(name) {
    return name || '[unnamed]';
  }

  function isPinnable(lyr) {
    return internal.layerHasGeometry(lyr);
  }


  function cleanLayerName(raw) {
    return raw.replace(/[\n\t/\\]/g, '')
      .replace(/^[\.\s]+/, '').replace(/[\.\s]+$/, '');
  }

  function rowHTML(c1, c2, cname) {
    return utils.format('<div class="row%s"><div class="col1">%s</div>' +
      '<div class="col2">%s</div></div>', cname ? ' ' + cname : '', c1, c2);
  }
}




// These functions could be called when validating i/o options; TODO: avoid this
cli.isFile =
cli.isDirectory = function(name) {return false;};

cli.validateOutputDir = function() {};

// Replaces functions for reading from files with functions that try to match
// already-loaded datasets.
//
function ImportFileProxy(model) {
  // Try to match an imported dataset or layer.
  // TODO: think about handling import options
  function find(src) {
    var datasets = model.getDatasets();
    var retn = datasets.reduce(function(memo, d) {
      var lyr;
      if (memo) return memo; // already found a match
      // try to match import filename of this dataset
      if (d.info.input_files[0] == src) return d;
      // try to match name of a layer in this dataset
      lyr = utils.find(d.layers, function(lyr) {return lyr.name == src;});
      return lyr ? internal.isolateLayer(lyr, d) : null;
    }, null);
    if (!retn) stop("Missing data layer [" + src + "]");
    return retn;
  }

  api.importFile = function(src, opts) {
    var dataset = find(src);
    // Aeturn a copy with layers duplicated, so changes won't affect original layers
    // This makes an (unsafe) assumption that the dataset arcs won't be changed...
    // need to rethink this.
    return utils.defaults({
      layers: dataset.layers.map(internal.copyLayer)
    }, dataset);
  };
}

// load Proj.4 CRS definition files dynamically
//
internal.initProjLibrary = function(opts, done) {
  var mproj = require('mproj');
  var libs = internal.findProjLibs([opts.from || '', opts.match || '', opts.crs || ''].join(' '));
  // skip loaded libs
  libs = libs.filter(function(name) {return !mproj.internal.mproj_search_libcache(name);});
  loadProjLibs(libs, done);
};

function loadProjLibs(libs, done) {
  var mproj = require('mproj');
  var i = 0;
  next();

  function next() {
    var libName = libs[i];
    var content, req;
    if (!libName) return done();
    req = new XMLHttpRequest();
    req.addEventListener('load', function(e) {
      if (req.status == 200) {
        content = req.response;
      }
    });
    req.addEventListener('loadend', function() {
      if (content) {
        mproj.internal.mproj_insert_libcache(libName, content);
      }
      // TODO: consider stopping with an error message if no content was loaded
      // (currently, a less specific error will occur when mapshaper tries to use the library)
      next();
    });
    req.open('GET', 'assets/' + libName);
    req.send();
    i++;
  }
}



gui.getPixelRatio = function() {
  var deviceRatio = window.devicePixelRatio || window.webkitDevicePixelRatio || 1;
  return deviceRatio > 1 ? 2 : 1;
};

// TODO: consider moving this upstream
function getArcsForRendering(obj, ext) {
  var sourceArcs = obj.source.dataset.arcs;
  if (obj.geographic && sourceArcs.filteredArcs) {
    return sourceArcs.filteredArcs.getArcCollection(ext);
  }
  return obj.arcs;
}

function drawOutlineLayerToCanvas(obj, canv, ext) {
  var arcs;
  var style = obj.style;
  var darkStyle = {strokeWidth: style.strokeWidth, strokeColor: style.strokeColors[1]},
      lightStyle = {strokeWidth: style.strokeWidth, strokeColor: style.strokeColors[0]};
  var filter;
  if (internal.layerHasPaths(obj.layer)) {
    if (!obj.arcCounts) {
      obj.arcCounts = new Uint8Array(obj.arcs.size());
      internal.countArcsInShapes(obj.layer.shapes, obj.arcCounts);
    }
    if (obj.arcCounts) {
      arcs = getArcsForRendering(obj, ext);
      if (lightStyle.strokeColor) {
        filter = getArcFilter(arcs, ext, false, obj.arcCounts);
        canv.drawArcs(arcs, lightStyle, filter);
      }
      if (darkStyle.strokeColor && obj.layer.geometry_type != 'point') {
        filter = getArcFilter(arcs, ext, true, obj.arcCounts);
        canv.drawArcs(arcs, darkStyle, filter);
      }
    }
  }
  if (obj.layer.geometry_type == 'point') {
    canv.drawSquareDots(obj.layer.shapes, style);
  }
}

function drawStyledLayerToCanvas(obj, canv, ext) {
  // TODO: add filter for out-of-view shapes
  var style = obj.style;
  var layer = obj.layer;
  var arcs, filter;
  if (layer.geometry_type == 'point') {
    if (style.type == 'styled') {
      canv.drawPoints(layer.shapes, style);
    } else {
      canv.drawSquareDots(layer.shapes, style);
    }
  } else {
    arcs = getArcsForRendering(obj, ext);
    filter = getShapeFilter(arcs, ext);
    canv.drawPathShapes(layer.shapes, arcs, style, filter);
  }
}


// Return a function for testing if an arc should be drawn in the current view
function getArcFilter(arcs, ext, usedFlag, arcCounts) {
  var minPathLen = 0.5 * ext.getPixelSize(),
      geoBounds = ext.getBounds(),
      geoBBox = geoBounds.toArray(),
      allIn = geoBounds.contains(arcs.getBounds()),
      visible;
  // don't continue dropping paths if user zooms out farther than full extent
  if (ext.scale() < 1) minPathLen *= ext.scale();
  return function(i) {
      var visible = true;
      if (usedFlag != arcCounts[i] > 0) { // show either used or unused arcs
        visible = false;
      } else if (arcs.arcIsSmaller(i, minPathLen)) {
        visible = false;
      } else if (!allIn && !arcs.arcIntersectsBBox(i, geoBBox)) {
        visible = false;
      }
      return visible;
    };
  }

// Return a function for testing if a shape should be drawn in the current view
function getShapeFilter(arcs, ext) {
  var viewBounds = ext.getBounds();
  var bounds = new Bounds();
  if (ext.scale() < 1.1) return null; // full or almost-full zoom: no filter
  return function(shape) {
    bounds.empty();
    arcs.getMultiShapeBounds(shape, bounds);
    return viewBounds.intersects(bounds);
  };
}

function DisplayCanvas() {
  var _self = El('canvas'),
      _canvas = _self.node(),
      _ctx = _canvas.getContext('2d'),
      _ext;

  _self.prep = function(extent) {
    var w = extent.width(),
        h = extent.height(),
        pixRatio = gui.getPixelRatio();
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    _canvas.width = w * pixRatio;
    _canvas.height = h * pixRatio;
    _self.classed('retina', pixRatio == 2);
    _self.show();
    _ext = extent;
  };

  /*
  // Original function, not optimized
  _self.drawPathShapes = function(shapes, arcs, style) {
    var startPath = getPathStart(_ext),
        drawPath = getShapePencil(arcs, _ext),
        styler = style.styler || null;
    for (var i=0, n=shapes.length; i<n; i++) {
      if (styler) styler(style, i);
      startPath(_ctx, style);
      drawPath(shapes[i], _ctx);
      endPath(_ctx, style);
    }
  };
  */

  // Optimized to draw paths in same-style batches (faster Canvas drawing)
  _self.drawPathShapes = function(shapes, arcs, style, filter) {
    var styleIndex = {};
    var batchSize = 1500;
    var startPath = getPathStart(_ext, getLineScale(_ext));
    var draw = getShapePencil(arcs, _ext);
    var key, item;
    var styler = style.styler || null;
    for (var i=0; i<shapes.length; i++) {
      if (filter && !filter(shapes[i])) continue;
      if (styler) styler(style, i);
      key = getStyleKey(style);
      if (key in styleIndex === false) {
        styleIndex[key] = {
          style: utils.defaults({}, style),
          shapes: []
        };
      }
      item = styleIndex[key];
      item.shapes.push(shapes[i]);
      // overlays should not be batched, so transparency of overlapping shapes
      // is drawn correctly
      if (item.shapes.length >= batchSize || style.overlay) {
        drawPaths(item.shapes, startPath, draw, item.style);
        item.shapes = [];
      }
    }
    Object.keys(styleIndex).forEach(function(key) {
      var item = styleIndex[key];
      drawPaths(item.shapes, startPath, draw, item.style);
    });
  };

  function drawPaths(shapes, begin, draw, style) {
    begin(_ctx, style);
    for (var i=0, n=shapes.length; i<n; i++) {
      draw(shapes[i], _ctx);
    }
    endPath(_ctx, style);
  }

  _self.drawSquareDots = function(shapes, style) {
    var t = getScaledTransform(_ext),
        scaleRatio = getDotScale2(shapes, _ext),
        size = (style.dotSize >= 0 ? style.dotSize : 3) * scaleRatio,
        styler = style.styler || null,
        xmax = _canvas.width + size,
        ymax = _canvas.height + size,
        shp, x, y, i, j, n, m;
    if (size === 0) return;
    _ctx.fillStyle = style.dotColor || "black";
    for (i=0, n=shapes.length; i<n; i++) {
      if (styler !== null) { // e.g. selected points
        styler(style, i);
        size = style.dotSize * scaleRatio;
        _ctx.fillStyle = style.dotColor;
      }
      shp = shapes[i];
      for (j=0, m=shp ? shp.length : 0; j<m; j++) {
        x = shp[j][0] * t.mx + t.bx;
        y = shp[j][1] * t.my + t.by;
        if (x > -size && y > -size && x < xmax && y < ymax) {
          drawSquare(x, y, size, _ctx);
        }
      }
    }
  };

  // TODO: consider using drawPathShapes(), which draws paths in batches
  // for faster Canvas rendering. Downside: changes stacking order, which
  // is bad if circles are graduated.
  _self.drawPoints = function(shapes, style) {
    var t = getScaledTransform(_ext),
        pixRatio = gui.getPixelRatio(),
        startPath = getPathStart(_ext),
        styler = style.styler || null,
        shp, p;

    for (var i=0, n=shapes.length; i<n; i++) {
      shp = shapes[i];
      if (styler) styler(style, i);
      startPath(_ctx, style);
      if (!shp || style.radius > 0 === false) continue;
      for (var j=0, m=shp ? shp.length : 0; j<m; j++) {
        p = shp[j];
        drawCircle(p[0] * t.mx + t.bx, p[1] * t.my + t.by, style.radius * pixRatio, _ctx);
      }
      endPath(_ctx, style);
    }
  };

  _self.drawArcs = function(arcs, style, filter) {
    var startPath = getPathStart(_ext, getLineScale(_ext)),
        t = getScaledTransform(_ext),
        ctx = _ctx,
        batch = 25, // render paths in batches of this size (an optimization)
        count = 0,
        n = arcs.size(),
        i, iter;

    startPath(ctx, style);
    for (i=0; i<n; i++) {
      if (filter && !filter(i)) continue;
      if (++count % batch === 0) {
        endPath(ctx, style);
        startPath(ctx, style);
      }
      iter = protectIterForDrawing(arcs.getArcIter(i), _ext);
      drawPath(iter, t, ctx, 0.6);
    }
    endPath(ctx, style);
  };

  function getStyleKey(style) {
    return (style.strokeWidth > 0 ? style.strokeColor + '~' + style.strokeWidth +
      '~' + (style.lineDash ? style.lineDash + '~' : '') : '') +
      (style.fillColor || '') + (style.opacity < 1 ? '~' + style.opacity : '');
  }

  return _self;
}

// Vary line width according to zoom ratio.
// For performance and clarity don't start widening until zoomed quite far in.
function getLineScale(ext) {
  var mapScale = ext.scale(),
      s = 1;
  if (mapScale < 0.5) {
    s *= Math.pow(mapScale + 0.5, 0.35);
  } else if (mapScale > 100) {
    if (!internal.getStateVar('DEBUG')) // thin lines for debugging
      s *= Math.pow(mapScale - 99, 0.10);
  }
  return s;
}

function getDotScale(ext) {
  return Math.pow(getLineScale(ext), 0.7);
}

function getDotScale2(shapes, ext) {
  var pixRatio = gui.getPixelRatio();
  var scale = ext.scale();
  var side = Math.min(ext.width(), ext.height());
  var bounds = ext.getBounds();
  var test, n, k, j;
  if (scale >= 2) {
    test = function(p) {
      return bounds.containsPoint(p[0], p[1]);
    };
  }
  n = internal.countPoints2(shapes, test);
  k = n > 100000 && 0.25 || n > 10000 && 0.45 || n > 2500 && 0.65 || n > 200 && 0.85 || 1;
  j = side < 200 && 0.5 || side < 400 && 0.75 || 1;
  return getDotScale(ext) * k * j * pixRatio;
}

function getScaledTransform(ext) {
  return ext.getTransform(gui.getPixelRatio());
}

function drawCircle(x, y, radius, ctx) {
  if (radius > 0) {
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
  }
}

function drawSquare(x, y, size, ctx) {
  var offs = size / 2;
  if (size > 0) {
    x = Math.round(x - offs);
    y = Math.round(y - offs);
    size = Math.ceil(size);
    ctx.fillRect(x, y, size, size);
  }
}

function drawPath(vec, t, ctx, minLen) {
  var x, y, xp, yp;
  if (!vec.hasNext()) return;
  minLen = utils.isNonNegNumber(minLen) ? minLen : 0.4;
  x = xp = vec.x * t.mx + t.bx;
  y = yp = vec.y * t.my + t.by;
  ctx.moveTo(x, y);
  while (vec.hasNext()) {
    x = vec.x * t.mx + t.bx;
    y = vec.y * t.my + t.by;
    if (Math.abs(x - xp) > minLen || Math.abs(y - yp) > minLen) {
      ctx.lineTo(x, y);
      xp = x;
      yp = y;
    }
  }
}

function getShapePencil(arcs, ext) {
  var t = getScaledTransform(ext);
  var iter = new internal.ShapeIter(arcs);
  return function(shp, ctx) {
    for (var i=0, n=shp ? shp.length : 0; i<n; i++) {
      iter.init(shp[i]);
      // 0.2 trades visible seams for performance
      drawPath(protectIterForDrawing(iter, ext), t, ctx, 0.2);
    }
  };
}

function protectIterForDrawing(iter, ext) {
  var bounds;
  if (ext.scale() > 100) {
    // clip to rectangle when zoomed far in (canvas stops drawing shapes when
    // the coordinates become too large)
    bounds = ext.getBounds().clone();
    bounds.scale(1.1); // add a margin, to hide strokes along the edges
    iter = new internal.PointIter(internal.clipIterByBounds(iter, bounds));
  }
  return iter;
}

function getPathStart(ext, lineScale) {
  var pixRatio = gui.getPixelRatio();
  if (!lineScale) lineScale = 1;
  return function(ctx, style) {
    var strokeWidth;
    ctx.beginPath();
    if (style.opacity >= 0) {
      ctx.globalAlpha = style.opacity;
    }
    if (style.strokeWidth > 0) {
      strokeWidth = style.strokeWidth;
      if (pixRatio > 1) {
        // bump up thin lines on retina, but not to more than 1px (too slow)
        strokeWidth = strokeWidth < 1 ? 1 : strokeWidth * pixRatio;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeWidth * lineScale;
      ctx.strokeStyle = style.strokeColor;
      if (style.lineDash){
        ctx.lineCap = 'butt';
        ctx.setLineDash(style.lineDash.split(' '));
      }
    }
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
    }
  };
}

function endPath(ctx, style) {
  if (style.fillColor) ctx.fill();
  if (style.strokeWidth > 0) {
    ctx.stroke();
    if (style.lineDash) {
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
    }
  }
  if (style.opacity >= 0) ctx.globalAlpha = 1;
  ctx.closePath();
}




// Create low-detail versions of large arc collections for faster rendering
// at zoomed-out scales.
function FilteredArcCollection(unfilteredArcs) {
  var size = unfilteredArcs.getPointCount(),
      filteredArcs, filteredSegLen;

  // Only generate low-detail arcs for larger datasets
  if (size > 5e5) {
    if (!!unfilteredArcs.getVertexData().zz) {
      // Use precalculated simplification data for vertex filtering, if available
      filteredArcs = initFilteredArcs(unfilteredArcs);
      filteredSegLen = internal.getAvgSegment(filteredArcs);
    } else {
      // Use fast simplification as a fallback
      filteredSegLen = internal.getAvgSegment(unfilteredArcs) * 4;
      filteredArcs = internal.simplifyArcsFast(unfilteredArcs, filteredSegLen);
    }
  }

  function initFilteredArcs(arcs) {
    var filterPct = 0.08;
    var nth = Math.ceil(arcs.getPointCount() / 5e5);
    var currInterval = arcs.getRetainedInterval();
    var filterZ = arcs.getThresholdByPct(filterPct, nth);
    var filteredArcs = arcs.setRetainedInterval(filterZ).getFilteredCopy();
    arcs.setRetainedInterval(currInterval); // reset current simplification
    return filteredArcs;
  }

  this.getArcCollection = function(ext) {
    if (filteredArcs) {
      // match simplification of unfiltered arcs
      filteredArcs.setRetainedInterval(unfilteredArcs.getRetainedInterval());
    }
    // switch to filtered version of arcs at small scales
    var unitsPerPixel = 1/ext.getTransform().mx,
        useFiltering = filteredArcs && unitsPerPixel > filteredSegLen * 1.5;
    return useFiltering ? filteredArcs : unfilteredArcs;
  };
}




gui.getDisplayLayerForTable = function(table) {
  var n = table.size(),
      cellWidth = 12,
      cellHeight = 5,
      gutter = 6,
      arcs = [],
      shapes = [],
      aspectRatio = 1.1,
      x, y, col, row, blockSize;

  if (n > 10000) {
    arcs = null;
    gutter = 0;
    cellWidth = 4;
    cellHeight = 4;
    aspectRatio = 1.45;
  } else if (n > 5000) {
    cellWidth = 5;
    gutter = 3;
    aspectRatio = 1.45;
  } else if (n > 1000) {
    gutter = 3;
    cellWidth = 8;
    aspectRatio = 1.3;
  }

  if (n < 25) {
    blockSize = n;
  } else {
    blockSize = Math.sqrt(n * (cellWidth + gutter) / cellHeight / aspectRatio) | 0;
  }

  for (var i=0; i<n; i++) {
    row = i % blockSize;
    col = Math.floor(i / blockSize);
    x = col * (cellWidth + gutter);
    y = cellHeight * (blockSize - row);
    if (arcs) {
      arcs.push(getArc(x, y, cellWidth, cellHeight));
      shapes.push([[i]]);
    } else {
      shapes.push([[x, y]]);
    }
  }

  function getArc(x, y, w, h) {
    return [[x, y], [x + w, y], [x + w, y - h], [x, y - h], [x, y]];
  }

  return {
    layer: {
      geometry_type: arcs ? 'polygon' : 'point',
      shapes: shapes,
      data: table
    },
    arcs: arcs ? new internal.ArcCollection(arcs) : null
  };
};




// Wrap a layer in an object along with information needed for rendering
function getMapLayer(layer, dataset) {
  var obj = {
    layer: null,
    arcs: null,
    style: null,
    source: {
      layer: layer,
      dataset: dataset
    },
    empty: internal.getFeatureCount(layer) === 0
  };

  // init filtered arcs, if needed
  if (internal.layerHasPaths(layer) && !dataset.filteredArcs) {
    dataset.filteredArcs = new FilteredArcCollection(dataset.arcs);
  }

  if (obj.empty) return obj;

  if (!layer.geometry_type) {
    utils.extend(obj, gui.getDisplayLayerForTable(layer.data));
    obj.tabular = true;
  } else {
    obj.geographic = true;
    obj.layer = layer;
    obj.arcs = dataset.arcs; // replaced by filtered arcs during render sequence
  }

  obj.bounds = getDisplayBounds(obj.layer, obj.arcs, obj.tabular);
  return obj;
}

function getDisplayBounds(lyr, arcs, isTable) {
  var arcBounds = arcs ? arcs.getBounds() : new Bounds(),
      marginPct = isTable ? getVariableMargin(lyr) : 0.025,
      bounds = arcBounds, // default display extent: all arcs in the dataset
      lyrBounds;

  if (lyr.geometry_type == 'point') {
    lyrBounds = internal.getLayerBounds(lyr);
    if (lyrBounds && lyrBounds.hasBounds()) {
      if (lyrBounds.area() > 0 || !arcBounds.hasBounds()) {
        bounds = lyrBounds;
      } else {
        // if a point layer has no extent (e.g. contains only a single point),
        // then merge with arc bounds, to place the point in context.
        bounds = arcBounds.mergeBounds(lyrBounds);
      }
    }
  }

  // If a layer has zero width or height (e.g. if it contains a single point),
  // inflate its display bounding box by a default amount
  if (bounds.width() === 0) {
    bounds.xmin = (bounds.centerX() || 0) - 1;
    bounds.xmax = bounds.xmin + 2;
  }
  if (bounds.height() === 0) {
    bounds.ymin = (bounds.centerY() || 0) - 1;
    bounds.ymax = bounds.ymin + 2;
  }
  bounds.scale(1 + marginPct * 2);
  return bounds;
}

// Calculate margin when displaying content at full zoom, as pct of screen size
function getVariableMargin(lyr) {
  var n = internal.getFeatureCount(lyr);
  var pct = 0.04;
  if (n < 5) {
    pct = 0.2;
  } else if (n < 100) {
    pct = 0.1;
  }
  return pct;
}



function HighlightBox(el) {
  var stroke = 2,
      box = El('div').addClass('zoom-box').appendTo(el).hide();
  this.show = function(x1, y1, x2, y2) {
    var w = Math.abs(x1 - x2),
        h = Math.abs(y1 - y2);
    box.css({
      top: Math.min(y1, y2),
      left: Math.min(x1, x2),
      width: Math.max(w - stroke * 2, 1),
      height: Math.max(h - stroke * 2, 1)
    });
    box.show();
  };
  this.hide = function() {
    box.hide();
  };
}




gui.addSidebarButton = function(iconId) {
  var btn = El('div').addClass('nav-btn')
    .on('dblclick', function(e) {e.stopPropagation();}); // block dblclick zoom
  btn.appendChild(iconId);
  btn.appendTo('#nav-buttons');
  return btn;
};

function MapNav(root, ext, mouse) {
  var wheel = new MouseWheel(mouse),
      zoomBox = new HighlightBox('body'),
      buttons = El('div').id('nav-buttons').appendTo(root),
      zoomTween = new Tween(Tween.sineInOut),
      shiftDrag = false,
      zoomScale = 2.5,
      inBtn, outBtn,
      dragStartEvt,
      _fx, _fy; // zoom foci, [0,1]

  gui.addSidebarButton("#home-icon").on('click', function() {
    gui.dispatchEvent('map_reset');
  });
  inBtn = gui.addSidebarButton("#zoom-in-icon").on('click', zoomIn);
  outBtn = gui.addSidebarButton("#zoom-out-icon").on('click', zoomOut);

  ext.on('change', function() {
    inBtn.classed('disabled', ext.scale() >= ext.maxScale());
  });

  gui.on('map_reset', function() {
    ext.reset();
  });

  zoomTween.on('change', function(e) {
    ext.rescale(e.value, _fx, _fy);
  });

  mouse.on('dblclick', function(e) {
    zoomByPct(zoomScale, e.x / ext.width(), e.y / ext.height());
  });

  mouse.on('dragstart', function(e) {
    shiftDrag = !!e.shiftKey;
    if (shiftDrag) {
      dragStartEvt = e;
    }
  });

  mouse.on('drag', function(e) {
    if (shiftDrag) {
      zoomBox.show(e.pageX, e.pageY, dragStartEvt.pageX, dragStartEvt.pageY);
    } else {
      ext.pan(e.dx, e.dy);
    }
  });

  mouse.on('dragend', function(e) {
    var bounds;
    if (shiftDrag) {
      shiftDrag = false;
      bounds = new Bounds(e.x, e.y, dragStartEvt.x, dragStartEvt.y);
      zoomBox.hide();
      if (bounds.width() > 5 && bounds.height() > 5) {
        zoomToBox(bounds);
      }
    }
  });

  wheel.on('mousewheel', function(e) {
    var k = 1 + (0.11 * e.multiplier),
        delta = e.direction > 0 ? k : 1 / k;
    ext.rescale(ext.scale() * delta, e.x / ext.width(), e.y / ext.height());
  });

  function zoomIn() {
    zoomByPct(zoomScale, 0.5, 0.5);
  }

  function zoomOut() {
    zoomByPct(1/zoomScale, 0.5, 0.5);
  }

  // @box Bounds with pixels from t,l corner of map area.
  function zoomToBox(box) {
    var pct = Math.max(box.width() / ext.width(), box.height() / ext.height()),
        fx = box.centerX() / ext.width() * (1 + pct) - pct / 2,
        fy = box.centerY() / ext.height() * (1 + pct) - pct / 2;
    zoomByPct(1 / pct, fx, fy);
  }

  // @pct Change in scale (2 = 2x zoom)
  // @fx, @fy zoom focus, [0, 1]
  function zoomByPct(pct, fx, fy) {
    _fx = fx;
    _fy = fy;
    zoomTween.start(ext.scale(), ext.scale() * pct, 400);
  }

}




function MapExtent(_position) {
  var _scale = 1,
      _cx, _cy, // center in geographic units
      _contentBounds;

  _position.on('resize', function() {
    this.dispatchEvent('change');
    // this.dispatchEvent('resize');
  }, this);

  this.reset = function(force) {
    this.recenter(_contentBounds.centerX(), _contentBounds.centerY(), 1, force);
  };

  this.recenter = function(cx, cy, scale, force) {
    scale = scale ? limitScale(scale) : _scale;
    if (force || !(cx == _cx && cy == _cy && scale == _scale)) {
      _cx = cx;
      _cy = cy;
      _scale = scale;
      this.dispatchEvent('change');
    }
  };

  this.pan = function(xpix, ypix) {
    var t = this.getTransform();
    this.recenter(_cx - xpix / t.mx, _cy - ypix / t.my);
  };

  // Zoom to @scale (a multiple of the map's full scale)
  // @xpct, @ypct: optional focus, [0-1]...
  this.rescale = function(scale, xpct, ypct) {
    scale = limitScale(scale);
    if (arguments.length < 3) {
      xpct = 0.5;
      ypct = 0.5;
    }
    var b = this.getBounds(),
        fx = b.xmin + xpct * b.width(),
        fy = b.ymax - ypct * b.height(),
        dx = b.centerX() - fx,
        dy = b.centerY() - fy,
        ds = _scale / scale,
        dx2 = dx * ds,
        dy2 = dy * ds,
        cx = fx + dx2,
        cy = fy + dy2;
    this.recenter(cx, cy, scale);
  };

  this.resize = _position.resize;
  this.width = _position.width;
  this.height = _position.height;
  this.position = _position.position;

  // get zoom factor (1 == full extent, 2 == 2x zoom, etc.)
  this.scale = function() {
    return _scale;
  };

  this.maxScale = maxScale;

  this.getPixelSize = function() {
    return 1 / this.getTransform().mx;
  };

  // Get params for converting geographic coords to pixel coords
  this.getTransform = function(pixScale) {
    // get transform (y-flipped);
    var viewBounds = new Bounds(0, 0, _position.width(), _position.height());
    if (pixScale) {
      viewBounds.xmax *= pixScale;
      viewBounds.ymax *= pixScale;
    }
    return this.getBounds().getTransform(viewBounds, true);
  };

  this.getBounds = function() {
    if (!_contentBounds) return new Bounds();
    return centerAlign(calcBounds(_cx, _cy, _scale));
  };

  // Update the extent of 'full' zoom without navigating the current view
  this.setBounds = function(b) {
    var prev = _contentBounds;
    _contentBounds = b;
    if (prev) {
      _scale = _scale * centerAlign(b).width() / centerAlign(prev).width();
    } else {
      _cx = b.centerX();
      _cy = b.centerY();
    }
  };

  this.translatePixelCoords = function(x, y) {
    return this.getTransform().invert().transform(x, y);
  };

  // stop zooming before rounding errors become too obvious
  function maxScale() {
    var minPixelScale = 1e-16;
    var xmax = maxAbs(_contentBounds.xmin, _contentBounds.xmax, _contentBounds.centerX());
    var ymax = maxAbs(_contentBounds.ymin, _contentBounds.ymax, _contentBounds.centerY());
    var xscale = _contentBounds.width() / _position.width() / xmax / minPixelScale;
    var yscale = _contentBounds.height() / _position.height() / ymax / minPixelScale;
    return Math.min(xscale, yscale);
  }

  function maxAbs() {
    return Math.max.apply(null, utils.toArray(arguments).map(Math.abs));
  }

  function limitScale(scale) {
    return Math.min(scale, maxScale());
  }

  function calcBounds(cx, cy, scale) {
    var w = _contentBounds.width() / scale,
        h = _contentBounds.height() / scale;
    return new Bounds(cx - w/2, cy - h/2, cx + w/2, cy + h/2);
  }

  // Receive: Geographic bounds of content to be centered in the map
  // Return: Geographic bounds of map window centered on @_contentBounds,
  //    with padding applied
  function centerAlign(_contentBounds) {
    var bounds = _contentBounds.clone(),
        wpix = _position.width(),
        hpix = _position.height(),
        xmarg = 4,
        ymarg = 4,
        xpad, ypad;
    wpix -= 2 * xmarg;
    hpix -= 2 * ymarg;
    if (wpix <= 0 || hpix <= 0) {
      return new Bounds(0, 0, 0, 0);
    }
    bounds.fillOut(wpix / hpix);
    xpad = bounds.width() / wpix * xmarg;
    ypad = bounds.height() / hpix * ymarg;
    bounds.padBounds(xpad, ypad, xpad, ypad);
    return bounds;
  }
}

utils.inherit(MapExtent, EventDispatcher);




// @onNext: handler for switching between multiple records
function Popup(onNext, onPrev) {
  var self = new EventDispatcher();
  var parent = El('#mshp-main-map');
  var el = El('div').addClass('popup').appendTo(parent).hide();
  var content = El('div').addClass('popup-content').appendTo(el);
  // multi-hit display and navigation
  var tab = El('div').addClass('popup-tab').appendTo(el).hide();
  var nav = El('div').addClass('popup-nav').appendTo(tab);
  var prevLink = El('span').addClass('popup-nav-arrow colored-text').appendTo(nav).text('◀');
  var navInfo = El('span').addClass('popup-nav-info').appendTo(nav);
  var nextLink = El('span').addClass('popup-nav-arrow colored-text').appendTo(nav).text('▶');

  nextLink.on('click', onNext);
  prevLink.on('click', onPrev);

  self.show = function(id, ids, table, pinned) {
    var rec = table ? table.getRecordAt(id) : {};
    var maxHeight = parent.node().clientHeight - 36;
    self.hide(); // clean up if panel is already open
    render(content, rec, table, pinned);
    if (ids && ids.length > 1) {
      showNav(id, ids, pinned);
    } else {
      tab.hide();
    }
    el.show();
    if (content.node().clientHeight > maxHeight) {
      content.css('height:' + maxHeight + 'px');
    }
  };


  self.hide = function() {
    // make sure any pending edits are made before re-rendering popup
    // TODO: only blur popup fields
    gui.blurActiveElement();
    content.empty();
    content.node().removeAttribute('style'); // remove inline height
    el.hide();
  };

  return self;

  function showNav(id, ids, pinned) {
    var num = ids.indexOf(id) + 1;
    navInfo.text(' ' + num + ' / ' + ids.length + ' ');
    nextLink.css('display', pinned ? 'inline-block' : 'none');
    prevLink.css('display', pinned && ids.length > 2 ? 'inline-block' : 'none');
    tab.show();
  }

  function render(el, rec, table, editable) {
    var tableEl = El('table').addClass('selectable'),
        rows = 0;
    utils.forEachProperty(rec, function(v, k) {
      var type;
      // missing GeoJSON fields are set to undefined on import; skip these
      if (v !== undefined) {
        type = internal.getFieldType(v, k, table);
        renderRow(tableEl, rec, k, type, editable);
        rows++;
      }
    });
    if (rows > 0) {
      tableEl.appendTo(el);
    } else {
      // Some individual features can have undefined values for some or all of
      // their data properties (properties are set to undefined when an input JSON file
      // has inconsistent fields, or after force-merging layers with inconsistent fields).
      el.html(utils.format('<div class="note">This %s is missing attribute data.</div>',
          table && table.getFields().length > 0 ? 'feature': 'layer'));
    }
  }

  function renderRow(table, rec, key, type, editable) {
    var rowHtml = '<td class="field-name">%s</td><td><span class="value">%s</span> </td>';
    var val = rec[key];
    var str = internal.formatInspectorValue(val, type);
    var cell = El('tr')
        .appendTo(table)
        .html(utils.format(rowHtml, key, utils.htmlEscape(str)))
        .findChild('.value');
    setFieldClass(cell, val, type);
    if (editable) {
      editItem(cell, rec, key, type);
    }
  }

  function setFieldClass(el, val, type) {
    var isNum = type ? type == 'number' : utils.isNumber(val);
    var isNully = val === undefined || val === null || val !== val;
    var isEmpty = val === '';
    el.classed('num-field', isNum);
    el.classed('object-field', type == 'object');
    el.classed('null-value', isNully);
    el.classed('empty', isEmpty);
  }

  function editItem(el, rec, key, type) {
    var input = new ClickText2(el),
        strval = internal.formatInspectorValue(rec[key], type),
        parser = internal.getInputParser(type);
    el.parent().addClass('editable-cell');
    el.addClass('colored-text dot-underline');
    input.on('change', function(e) {
      var val2 = parser(input.value()),
          strval2 = internal.formatInspectorValue(val2, type);
      if (strval == strval2) {
        // contents unchanged
      } else if (val2 === null && type != 'object') { // allow null objects
        // invalid value; revert to previous value
        input.value(strval);
      } else {
        // field content has changed
        strval = strval2;
        rec[key] = val2;
        input.value(strval);
        setFieldClass(el, val2, type);
        self.dispatchEvent('update', {field: key, value: val2});
      }
    });
  }
}

internal.formatInspectorValue = function(val, type) {
  var str;
  if (type == 'object') {
    str = val ? JSON.stringify(val) : "";
  } else {
    str = String(val);
  }
  return str;
};

internal.inputParsers = {
  string: function(raw) {
    return raw;
  },
  number: function(raw) {
    var val = Number(raw);
    if (raw == 'NaN') {
      val = NaN;
    } else if (isNaN(val)) {
      val = null;
    }
    return val;
  },
  object: function(raw) {
    var val = null;
    try {
      val = JSON.parse(raw);
    } catch(e) {}
    return val;
  },
  boolean: function(raw) {
    var val = null;
    if (raw == 'true') {
      val = true;
    } else if (raw == 'false') {
      val = false;
    }
    return val;
  },
  multiple: function(raw) {
    var val = Number(raw);
    return isNaN(val) ? raw : val;
  }
};

internal.getInputParser = function(type) {
  return internal.inputParsers[type || 'multiple'];
};

internal.getFieldType = function(val, key, table) {
  // if a field has a null value, look at entire column to identify type
  return internal.getValueType(val) || internal.getColumnType(key, table.getRecords());
};




function HitControl(ext, mouse) {
  var self = new EventDispatcher();
  var prevHits = [];
  var active = false;
  var tests = {
    polygon: polygonTest,
    polyline: polylineTest,
    point: pointTest
  };
  var readout = El('#coordinate-info').hide();
  var bboxPoint;
  var target, test;

  readout.on('copy', function(e) {
    // remove selection on copy (using timeout or else copy is cancelled)
    setTimeout(function() {
      getSelection().removeAllRanges();
    }, 50);
    // don't display bounding box if user copies coords
    bboxPoint = null;
  });

  ext.on('change', function() {
    clearCoords();
    // shapes may change along with map scale
    // target = lyr ? lyr.getDisplayLayer() : null;
  });

  self.setLayer = function(mapLayer) {
    var layer = mapLayer.layer;
    var style = mapLayer.style;
    target = mapLayer;
    if (layer.geometry_type == 'point' && style.type == 'styled') {
      test = getGraduatedCircleTest(getRadiusFunction(style));
    } else {
      test = tests[layer.geometry_type];
    }
    readout.hide();
  };

  self.start = function() {
    active = true;
  };

  self.stop = function() {
    if (active) {
      hover([]);
      // readout.text('').hide();
      active = false;
    }
  };

  mouse.on('click', function(e) {
    if (!target) return;
    if (active) {
      trigger('click', prevHits);
    }
    if (target.geographic) {
      gui.selectElement(readout.node());
      // don't save bbox point when inspector is active
      // clear bbox point if already present
      bboxPoint = bboxPoint || active ? null : ext.translatePixelCoords(e.x, e.y);
    }
  });

  mouse.on('leave', clearCoords);

  mouse.on('hover', function(e) {
    if (!target) return;
    var isOver = isOverMap(e);
    var p = ext.translatePixelCoords(e.x, e.y);
    if (target.geographic && isOver) {
      // update coordinate readout if displaying geographic shapes
      displayCoords(p);
    } else {
      clearCoords();
    }
    if (active && test) {
      if (!isOver) {
        // mouse is off of map viewport -- clear any current hit
        hover([]);
      } else if (e.hover) {
        // mouse is hovering directly over map area -- update hit detection
        hover(test(p[0], p[1]));
      } else {
        // mouse is over map viewport but not directly over map (e.g. hovering
        // over popup) -- don't update hit detection
      }
    }
  });

  function isOverMap(e) {
    return e.x >= 0 && e.y >= 0 && e.x < ext.width() && e.y < ext.height();
  }

  function displayCoords(p) {
    var decimals = getCoordPrecision(ext.getBounds());
    var coords = bboxPoint ? getBbox(p, bboxPoint) : p;
    var str = coords.map(function(n) {return n.toFixed(decimals);}).join(',');
    readout.text(str).show();
  }

  function getBbox(a, b) {
    return [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.max(a[0], b[0]),
      Math.max(a[1], b[1])
    ];
  }

  function clearCoords() {
    bboxPoint = null;
    readout.hide();
  }

  // Convert pixel distance to distance in coordinate units.
  function getHitBuffer(pix) {
    return pix / ext.getTransform().mx;
  }

  // reduce hit threshold when zoomed out
  function getHitBuffer2(pix, minPix) {
    var scale = ext.scale();
    if (scale < 1) {
      pix *= scale;
    }
    if (minPix > 0 && pix < minPix) pix = minPix;
    return getHitBuffer(pix);
  }

  function getCoordPrecision(bounds) {
    var range = Math.min(bounds.width(), bounds.height()) + 1e-8;
    var digits = 0;
    while (range < 2000) {
      range *= 10;
      digits++;
    }
    return digits;
  }

  function polygonTest(x, y) {
    var maxDist = getHitBuffer2(5, 1),
        cands = findHitCandidates(x, y, maxDist),
        hits = [],
        cand, hitId;
    for (var i=0; i<cands.length; i++) {
      cand = cands[i];
      if (geom.testPointInPolygon(x, y, cand.shape, target.arcs)) {
        hits.push(cand.id);
      }
    }
    if (cands.length > 0 && hits.length === 0) {
      // secondary detection: proximity, if not inside a polygon
      sortByDistance(x, y, cands, target.arcs);
      hits = pickNearestCandidates(cands, 0, maxDist);
    }
    return hits;
  }

  function pickNearestCandidates(sorted, bufDist, maxDist) {
    var hits = [],
        cand, minDist;
    for (var i=0; i<sorted.length; i++) {
      cand = sorted[i];
      if (cand.dist < maxDist !== true) {
        break;
      } else if (i === 0) {
        minDist = cand.dist;
      } else if (cand.dist - minDist > bufDist) {
        break;
      }
      hits.push(cand.id);
    }
    return hits;
  }

  function polylineTest(x, y) {
    var maxDist = getHitBuffer2(15, 2),
        bufDist = getHitBuffer2(0.05), // tiny threshold for hitting almost-identical lines
        cands = findHitCandidates(x, y, maxDist);
    sortByDistance(x, y, cands, target.arcs);
    return pickNearestCandidates(cands, bufDist, maxDist);
  }

  function sortByDistance(x, y, cands, arcs) {
    for (var i=0; i<cands.length; i++) {
      cands[i].dist = geom.getPointToShapeDistance(x, y, cands[i].shape, arcs);
    }
    utils.sortOn(cands, 'dist');
  }

  function pointTest(x, y) {
    var dist = getHitBuffer2(25, 4),
        limitSq = dist * dist,
        hits = [];
    internal.forEachPoint(target.layer.shapes, function(p, id) {
      var distSq = geom.distanceSq(x, y, p[0], p[1]);
      if (distSq < limitSq) {
        hits = [id];
        limitSq = distSq;
      } else if (distSq == limitSq) {
        hits.push(id);
      }
    });
    return hits;
  }

  function getRadiusFunction(style) {
    var o = {};
    if (style.styler) {
      return function(i) {
        style.styler(o, i);
        return o.radius || 0;
      };
    }
    return function() {return style.radius || 0;};
  }

  function getGraduatedCircleTest(radius) {
    return function(x, y) {
      var hits = [],
          margin = getHitBuffer(12),
          limit = getHitBuffer(50), // short-circuit hit test beyond this threshold
          directHit = false,
          hitRadius = 0,
          hitDist;
      internal.forEachPoint(target.layer.shapes, function(p, id) {
        var distSq = geom.distanceSq(x, y, p[0], p[1]);
        var isHit = false;
        var isOver, isNear, r, d, rpix;
        if (distSq > limit * limit) return;
        rpix = radius(id);
        r = getHitBuffer(rpix + 1); // increase effective radius to make small bubbles easier to hit in clusters
        d = Math.sqrt(distSq) - r; // pointer distance from edge of circle (negative = inside)
        isOver = d < 0;
        isNear = d < margin;
        if (!isNear || rpix > 0 === false) {
          isHit = false;
        } else if (hits.length === 0) {
          isHit = isNear;
        } else if (!directHit && isOver) {
          isHit = true;
        } else if (directHit && isOver) {
          isHit = r == hitRadius ? d <= hitDist : r < hitRadius; // smallest bubble wins if multiple direct hits
        } else if (!directHit && !isOver) {
          // closest to bubble edge wins
          isHit = hitDist == d ? r <= hitRadius : d < hitDist; // closest bubble wins if multiple indirect hits
        }
        if (isHit) {
          if (hits.length > 0 && (r != hitRadius || d != hitDist)) {
            hits = [];
          }
          hitRadius = r;
          hitDist = d;
          directHit = isOver;
          hits.push(id);
        }
      });
      return hits;
    };
  }

  function getProperties(id) {
    return target.layer.data ? target.layer.data.getRecordAt(id) : {};
  }

  function sameIds(a, b) {
    if (a.length != b.length) return false;
    for (var i=0; i<a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function trigger(event, hits) {
    self.dispatchEvent(event, {
      ids: hits,
      id: hits.length > 0 ? hits[0] : -1
    });
  }

  function hover(hits) {
    if (!sameIds(hits, prevHits)) {
      prevHits = hits;
      El('#map-layers').classed('hover', hits.length > 0);
      trigger('hover', hits);
    }
  }

  function findHitCandidates(x, y, dist) {
    var arcs = target.arcs,
        index = {},
        cands = [],
        bbox = [];
    target.layer.shapes.forEach(function(shp, shpId) {
      var cand;
      for (var i = 0, n = shp && shp.length; i < n; i++) {
        arcs.getSimpleShapeBounds2(shp[i], bbox);
        if (x + dist < bbox[0] || x - dist > bbox[2] ||
          y + dist < bbox[1] || y - dist > bbox[3]) {
          continue; // bbox non-intersection
        }
        cand = index[shpId];
        if (!cand) {
          cand = index[shpId] = {shape: [], id: shpId, dist: 0};
          cands.push(cand);
        }
        cand.shape.push(shp[i]);
      }
    });
    return cands;
  }

  return self;
}




function InspectionControl(model, ext, mouse) {
  var hit = new HitControl(ext, mouse);
  var _popup = new Popup(getSwitchHandler(1), getSwitchHandler(-1));
  var _inspecting = false;
  var _pinned = false;
  var _highId = -1;
  var _hoverIds = null;
  var _selectionIds = null;
  var btn = gui.addSidebarButton("#info-icon2").on('click', function() {
    gui.dispatchEvent('inspector_toggle');
  });
  var _self = new EventDispatcher();
  var _target;
  // keep a reference to shapes array of current layer, to check if
  // shapes have changed when layer is updated.
  var _shapes;

  gui.on('inspector_toggle', function() {
    if (_inspecting) turnOff(); else turnOn();
  });

  // inspector and label editing aren't fully synced - stop inspecting if label editor starts
  gui.on('label_editor_on', function() {
    if (_inspecting) turnOff();
  });

  _popup.on('update', function(e) {
    var d = e.data;
    d.i = _highId; // need to add record id
    _self.dispatchEvent('data_change', d);
  });

  _self.updateLayer = function(mapLayer) {
    var shapes = mapLayer.layer.shapes;
    _target = mapLayer;
    if (_inspecting) {
      if (_shapes == shapes) {
        // shapes haven't changed -- refresh in case data has changed
        inspect(_highId, _pinned);
      } else {
        // shapes have changed -- clear any selected shapes
        _selectionIds = null;
        inspect(-1, false);
      }
    }
    _shapes = shapes;
    hit.setLayer(mapLayer);
  };

  // replace cli inspect command
  api.inspect = function(lyr, arcs, opts) {
    var ids;
    if (lyr != model.getActiveLayer().layer) {
      error("Only the active layer can be targeted");
    }
    ids = internal.selectFeatures(lyr, arcs, opts);
    if (ids.length === 0) {
      message("No features were selected");
      return;
    }
    _selectionIds = ids;
    turnOn();
    inspect(ids[0], true);
  };

  document.addEventListener('keydown', function(e) {
    var kc = e.keyCode, n, id;
    if (!_inspecting) return;

    // esc key closes (unless in an editing mode)
    if (e.keyCode == 27 && _inspecting && !gui.getMode()) {
      turnOff();
      return;
    }


    if (_pinned && !gui.getInputElement()) {
      // an element is selected and user is not editing text

      if (kc == 37 || kc == 39) {
        // arrow keys advance pinned feature
        n = internal.getFeatureCount(_target.layer);
        if (n > 1) {
          if (kc == 37) {
            id = (_highId + n - 1) % n;
          } else {
            id = (_highId + 1) % n;
          }
          inspect(id, true);
          e.stopPropagation();
        }
      } else if (kc == 8) {
        // delete key
        // to help protect against inadvertent deletion, don't delete
        // when console is open or a popup menu is open
        if (!gui.getMode() && !gui.consoleIsOpen()) {
          deletePinnedFeature();
        }
      }
    }
  }, !!'capture'); // preempt the layer control's arrow key handler

  hit.on('click', function(e) {
    var id = e.id;
    var pin = false;
    if (_pinned && id == _highId) {
      // clicking on pinned shape: unpin
    } else if (!_pinned && id > -1) {
      // clicking on unpinned shape while unpinned: pin
      pin = true;
    } else if (_pinned && id > -1) {
      // clicking on unpinned shape while pinned: pin new shape
      pin = true;
    } else if (!_pinned && id == -1) {
      // clicking off the layer while pinned: unpin and deselect
    }
    inspect(id, pin, e.ids);
  });

  hit.on('hover', function(e) {
    var id = e.id;
    if (!_inspecting || _pinned) return;
    inspect(id, false, e.ids);
  });

  function getSwitchHandler(diff) {
    return function() {
      var i = (_hoverIds || []).indexOf(_highId);
      var nextId;
      if (i > -1) {
        nextId = _hoverIds[(i + diff + _hoverIds.length) % _hoverIds.length];
        inspect(nextId, true, _hoverIds);
      }
    };
  }

  function showInspector(id, ids, pinned) {
    var table = _target.layer.data || null;
    _popup.show(id, ids, table, pinned);
  }

  // @id Id of a feature in the active layer, or -1
  function inspect(id, pin, ids) {
    if (!_inspecting) return;
    if (id > -1) {
      showInspector(id, ids, pin);
    } else {
      _popup.hide();
    }
    _highId = id;
    _hoverIds = ids;
    _pinned = pin;
    _self.dispatchEvent('change', {
      selection_ids: _selectionIds || [],
      hover_ids: ids || [],
      id: id,
      pinned: pin
    });
  }

  function turnOn() {
    btn.addClass('selected');
    _inspecting = true;
    hit.start();
    gui.dispatchEvent('inspector_on');
  }

  function turnOff() {
    btn.removeClass('selected');
    hit.stop();
    _selectionIds = null;
    inspect(-1); // clear the map
    _inspecting = false;
  }

  function deletePinnedFeature() {
    var lyr = model.getActiveLayer().layer;
    if (!_pinned || _highId == -1) return;
    lyr.shapes.splice(_highId, 1);
    if (lyr.data) lyr.data.getRecords().splice(_highId, 1);
    inspect(-1);
    model.updated({flags: 'filter'});
  }

  return _self;
}




var MapStyle = (function() {
  var darkStroke = "#334",
      lightStroke = "#b7d9ea",
      violet = "#cc6acc",
      violetFill = "rgba(249, 170, 249, 0.32)",
      gold = "#efc100",
      black = "black",
      selectionFill = "rgba(237, 214, 0, 0.12)",
      hoverFill = "rgba(255, 180, 255, 0.2)",
      activeStyle = { // outline style for the active layer
        type: 'outline',
        strokeColors: [lightStroke, darkStroke],
        strokeWidth: 0.7,
        dotColor: "#223",
        dotSize: 4
      },
      activeStyleForLabels = {
        dotColor: "rgba(250, 0, 250, 0.45)", // violet dot with transparency
        dotSize: 4
      },
      referenceStyle = { // outline style for reference layers
        type: 'outline',
        strokeColors: [null, '#86c927'],
        strokeWidth: 0.85,
        dotColor: "#73ba20",
        dotSize: 4
      },
      intersectionStyle = {
        dotColor: "#F24400",
        dotSize: 4
      },
      hoverStyles = {
        polygon: {
          fillColor: hoverFill,
          strokeColor: black,
          strokeWidth: 1.2
        }, point:  {
          dotColor: black,
          dotSize: 8
        }, polyline:  {
          strokeColor: black,
          strokeWidth: 2.5
        }
      },
      selectionStyles = {
        polygon: {
          fillColor: selectionFill,
          strokeColor: gold,
          strokeWidth: 1
        }, point:  {
          dotColor: gold,
          dotSize: 6
        }, polyline:  {
          strokeColor: gold,
          strokeWidth: 1.5
        }
      },
      selectionHoverStyles = {
        polygon: {
          fillColor: selectionFill,
          strokeColor: black,
          strokeWidth: 1.2
        }, point:  {
          dotColor: black,
          dotSize: 6
        }, polyline:  {
          strokeColor: black,
          strokeWidth: 2
        }
      },
      pinnedStyles = {
        polygon: {
          fillColor: violetFill,
          strokeColor: violet,
          strokeWidth: 1.8
        }, point:  {
          dotColor: 'violet',
          dotSize: 7
        }, polyline:  {
          strokeColor: violet,
          strokeWidth: 3
        }
      };

  return {
    getIntersectionStyle: function(lyr) {
      return utils.extend({}, intersectionStyle);
    },
    getReferenceStyle: function(lyr) {
      var style;
      if (internal.layerHasCanvasDisplayStyle(lyr)) {
        style = internal.getCanvasDisplayStyle(lyr);
      } else if (internal.layerHasLabels(lyr)) {
        style = {dotSize: 0}; // no reference dots if labels are visible
      } else {
        style = utils.extend({}, referenceStyle);
      }
      return style;
    },
    getActiveStyle: function(lyr) {
      var style;
      if (internal.layerHasCanvasDisplayStyle(lyr)) {
        style = internal.getCanvasDisplayStyle(lyr);
      } else if (internal.layerHasLabels(lyr)) {
        style = utils.extend({}, activeStyleForLabels);
      } else {
        style = utils.extend({}, activeStyle);
      }
      return style;
    },
    getOverlayStyle: getOverlayStyle
  };


  // Returns a display style for the overlay layer. This style displays any
  // hover or selection affects for the active data layer.
  function getOverlayStyle(lyr, o) {
    var type = lyr.geometry_type;
    var topId = o.id;
    var ids = [];
    var styles = [];
    var styler = function(o, i) {
      utils.extend(o, styles[i]);
    };
    var overlayStyle = {
      styler: styler
    };
    // first layer: features that were selected via the -inspect command
    o.selection_ids.forEach(function(i) {
      // skip features in a higher layer
      if (i == topId || o.hover_ids.indexOf(i) > -1) return;
      ids.push(i);
      styles.push(selectionStyles[type]);
    });
    // second layer: hover feature(s)
    o.hover_ids.forEach(function(i) {
      var style;
      if (i == topId) return;
      style = o.selection_ids.indexOf(i) > -1 ? selectionHoverStyles[type] : hoverStyles[type];
      ids.push(i);
      styles.push(style);
    });
    // top layer: feature that was selected by clicking in inspection mode ([i])
    if (topId > -1) {
      var isPinned = o.pinned;
      var inSelection = o.selection_ids.indexOf(topId) > -1;
      var style;
      if (isPinned) {
        style = pinnedStyles[type];
      } else if (inSelection) {
        style = selectionHoverStyles[type]; // TODO: differentiate from other hover ids
      } else {
        style = hoverStyles[type]; // TODO: differentiate from other hover ids
      }
      ids.push(topId);
      styles.push(style);
    }

    if (internal.layerHasCanvasDisplayStyle(lyr)) {
      if (type == 'point') {
        overlayStyle = internal.wrapOverlayStyle(internal.getCanvasDisplayStyle(lyr), overlayStyle);
      }
      overlayStyle.type = 'styled';
    }
    overlayStyle.ids = ids;
    overlayStyle.overlay = true;
    return ids.length > 0 ? overlayStyle : null;
  }
}());

// Modify style to use scaled circle instead of dot symbol
internal.wrapOverlayStyle = function(style, hoverStyle) {
  var styler = function(obj, i) {
    var dotColor;
    var id = obj.ids ? obj.ids[i] : -1;
    obj.strokeWidth = 0; // kludge to support setting minimum stroke width
    style.styler(obj, id);
    if (hoverStyle.styler) {
      hoverStyle.styler(obj, i);
    }
    dotColor = obj.dotColor;
    if (obj.radius && dotColor) {
      obj.radius += 0.4;
      // delete obj.fillColor; // only show outline
      obj.fillColor = dotColor; // comment out to only highlight stroke
      obj.strokeColor = dotColor;
      obj.strokeWidth = Math.max(obj.strokeWidth + 0.8, 1.5);
      obj.opacity = 1;
    }
  };
  return {styler: styler};
};

internal.getCanvasDisplayStyle = function(lyr) {
  var styleIndex = {
        opacity: 'opacity',
        r: 'radius',
        fill: 'fillColor',
        stroke: 'strokeColor',
        'stroke-width': 'strokeWidth',
        'stroke-dasharray': 'lineDash'
      },
      // array of field names of relevant svg display properties
      fields = internal.getCanvasStyleFields(lyr).filter(function(f) {return f in styleIndex;}),
      records = lyr.data.getRecords();
  var styler = function(style, i) {
    var rec = records[i];
    var fname, val;
    for (var j=0; j<fields.length; j++) {
      fname = fields[j];
      val = rec && rec[fname];
      if (val == 'none') {
        val = 'transparent'; // canvas equivalent of CSS 'none'
      }
      // convert svg property name to mapshaper style equivalent
      style[styleIndex[fname]] = val;
    }

    if (style.strokeWidth && !style.strokeColor) {
      style.strokeColor = 'black';
    }
    if (!('strokeWidth' in style) && style.strokeColor) {
      style.strokeWidth = 1;
    }
    if (style.radius > 0 && !style.strokeWidth && !style.fillColor && lyr.geometry_type == 'point') {
      style.fillColor = 'black';
    }
  };
  return {styler: styler, type: 'styled'};
};

// check if layer should be displayed with styles
internal.layerHasCanvasDisplayStyle = function(lyr) {
  var fields = internal.getCanvasStyleFields(lyr);
  if (lyr.geometry_type == 'point') {
    return fields.indexOf('r') > -1; // require 'r' field for point symbols
  }
  return utils.difference(fields, ['opacity', 'class']).length > 0;
};

internal.layerHasLabels = function(lyr) {
  var hasLabels = lyr.geometry_type == 'point' && lyr.data && lyr.data.fieldExists('label-text');
  if (hasLabels && internal.findMaxPartCount(lyr.shapes) > 1) {
    console.error('Multi-point labels are not fully supported');
  }
  return hasLabels;
};

internal.getCanvasStyleFields = function(lyr) {
  var fields = lyr.data ? lyr.data.getFields() : [];
  return internal.svg.findPropertiesBySymbolGeom(fields, lyr.geometry_type);
};




function SvgDisplayLayer(ext, mouse) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  var el = El(svg);
  var editing = false;
  var dragging = false;
  var textNode;
  var activeLayer;
  var activeRecord;

  initDragging();

  el.clear = clear;

  el.reposition = function(target) {
    var transform = ext.getTransform();
    resize(ext);
    reposition(target, transform);
  };

  el.drawLayer = function(target) {
    var transform = ext.getTransform();
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    // kludge to identify container when symbols are repositioned
    var id = utils.getUniqueName();
    g.setAttribute('id', id);
    target.svg_id = id;
    resize(ext);
    g.innerHTML = renderLabels(target.layer, transform);
    svg.append(g);
    if (target.active) {
      activeLayer = target.layer;
    } else {
      g.style.pointerEvents = 'none';
    }
  };

  function initDragging() {
    var downEvt;
    var eventPriority = 1;

    // inspector and label editing aren't fully synced - stop editing if inspector opens
    gui.on('inspector_on', function() {
      stopEditing();
    });

    // down event on svg
    // a: off text
    //    -> stop editing
    // b: on text
    //    1: not editing -> nop
    //    2: on selected text -> start dragging
    //    3: on other text -> stop dragging, select new text
    svg.addEventListener('mousedown', function(e) {
      var textTarget = getTextTarget(e);
      downEvt = e;
      if (!textTarget) {
        stopEditing();
      } else if (!editing) {
        // nop
      } else if (textTarget == textNode) {
        startDragging();
      } else {
        startDragging();
        editTextNode(textTarget);
      }
    });

    // up event on svg
    // a: currently dragging text
    //   -> stop dragging
    // b: clicked on a text feature
    //   -> start editing it
    svg.addEventListener('mouseup', function(e) {
      var textTarget = getTextTarget(e);
      var isClick = isClickEvent(e, downEvt);
      if (isClick && textTarget && textTarget == textNode &&
          activeRecord && isMultilineLabel(textNode)) {
        toggleTextAlign(textNode, activeRecord);
      }
      if (dragging) {
        stopDragging();
       } else if (isClick && textTarget) {
        editTextNode(textTarget);
      }
    });

    // block dbl-click navigation when editing
    mouse.on('dblclick', function(e) {
      if (editing) e.stopPropagation();
    }, null, eventPriority);

    mouse.on('dragstart', function(e) {
      onDrag(e);
    }, null, eventPriority);

    mouse.on('drag', function(e) {
      onDrag(e);
      if (!dragging || !activeRecord) return;
      applyDelta(activeRecord, 'dx', e.dx);
      applyDelta(activeRecord, 'dy', e.dy);
      if (!isMultilineLabel(textNode)) {
        // update anchor position of single-line labels based on label position
        // relative to anchor point, for better placement when eventual display font is
        // different from mapshaper's font.
        updateTextAnchor(textNode, activeRecord);
      }
      setMultilineAttribute(textNode, 'dx', activeRecord.dx);
      textNode.setAttribute('dy', activeRecord.dy);
    }, null, eventPriority);

    mouse.on('dragend', function(e) {
      onDrag(e);
      stopDragging();
    }, null, eventPriority);

    function toggleTextAlign(textNode, rec) {
      var curr = rec['text-anchor'] || 'middle';
      var targ = curr == 'middle' && 'start' || curr == 'start' && 'end' || 'middle';
      updateTextAnchor(textNode, rec, targ);
      setMultilineAttribute(textNode, 'dx', rec.dx);
    }

    // @value: optional position to set; if missing, auto-set
    function updateTextAnchor(textNode, rec, value) {
      var rect = textNode.getBoundingClientRect();
      var width = rect.width;
      var anchorX = +textNode.getAttribute('x');
      var labelCenterX = rect.left - svg.getBoundingClientRect().left + width / 2;
      var xpct = (labelCenterX - anchorX) / width; // offset of label center from anchor center
      var curr = rec['text-anchor'] || 'middle';
      var xshift = 0;
      var targ = value || xpct < -0.25 && 'end' || xpct > 0.25 && 'start' || 'middle';
      if (curr == 'middle' && targ == 'end' || curr == 'start' && targ == 'middle') {
        xshift = width / 2;
      } else if (curr == 'middle' && targ == 'start' || curr == 'end' && targ == 'middle') {
        xshift = -width / 2;
      } else if (curr == 'start' && targ == 'end') {
        xshift = width;
      } else if (curr == 'end' && targ == 'start') {
        xshift = -width;
      }
      if (xshift) {
        rec['text-anchor'] = targ;
        applyDelta(rec, 'dx', xshift);
        textNode.setAttribute('text-anchor', targ);
      }
    }

    // handle either numeric strings or numbers in fields
    function applyDelta(rec, key, delta) {
      var currVal = rec[key];
      var isString = utils.isString(currVal);
      var newVal = (+currVal + delta) || 0;
      rec[key] = isString ? String(newVal) : newVal;
    }

    function startDragging() {
      dragging = true;
      svg.setAttribute('class', 'dragging');
    }

    function stopDragging() {
      dragging = false;
      svg.removeAttribute('class');
    }

    function onDrag(e) {
      if (dragging) {
        e.stopPropagation();
      }
    }
  }

  function isClickEvent(up, down) {
    var elapsed = Math.abs(down.timeStamp - up.timeStamp);
    var dx = up.screenX - down.screenX;
    var dy = up.screenY - down.screenY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= 4 && elapsed < 300;
  }

  function stopEditing() {
    if (dragging) {
      stopDragging();
    }
    if (editing) {
      // TODO: close editing panel
      editing = false;
    }
    if (textNode) deselectText(textNode);
    textNode = null;
  }

  function deselectText(el) {
    el.removeAttribute('class');
  }

  function selectText(el) {
    el.setAttribute('class', 'selected');
  }

  function editTextNode(el) {
    var table, i;
    if (textNode) deselectText(textNode);
    textNode = el;
    editing = true;
    gui.dispatchEvent('label_editor_on'); // signal inspector to close
    selectText(el);
    table = activeLayer.data;
    i = +textNode.getAttribute('data-id');
    activeRecord = table.getRecords()[i];
    // add dx and dy properties, if not available
    if (!table.fieldExists('dx')) {
      table.addField('dx', 0);
    }
    if (!table.fieldExists('dy')) {
      table.addField('dy', 0);
    }
    if (!table.fieldExists('text-anchor')) {
      table.addField('text-anchor', '');
    }
    // TODO: show editing panel
  }

  function getTextTarget(e) {
    var el = e.target;
    if (el.tagName == 'tspan') {
      el = el.parentNode;
    }
    return el.tagName == 'text' ? el : null;
  }

  function isMultilineLabel(textNode) {
    return textNode.childNodes.length > 1;
  }

  // Set an attribute on a <text> node and any child <tspan> elements
  // (mapshaper's svg labels require tspans to have the same x and dx values
  //  as the enclosing text node)
  function setMultilineAttribute(textNode, name, value) {
    var n = textNode.childNodes.length;
    var i = -1;
    var child;
    textNode.setAttribute(name, value);
    while (++i < n) {
      child = textNode.childNodes[i];
      if (child.tagName == 'tspan') {
        child.setAttribute(name, value);
      }
    }
  }

  function reposition(target, fwd) {
    var container = document.getElementById(target.svg_id);
    var texts = container.getElementsByTagName('text');
    var n = texts.length;
    var text, xy, idx, p;
    for (var i=0; i<n; i++) {
      text = texts[i];
      idx = +text.getAttribute('data-id');
      p = target.layer.shapes[idx];
      if (!p) continue;
      xy = fwd.transform(p[0][0], p[0][1]);
      setMultilineAttribute(text, 'x', xy[0]);
      text.setAttribute('y', xy[1]);
    }
  }

  function renderLabels(lyr, fwd) {
    var records = lyr.data.getRecords();
    var opts = {};
    var symbols = lyr.shapes.map(function(shp, i) {
      var d = records[i];
      var p = shp[0];
      var p2 = fwd.transform(p[0], p[1]);
      var obj = internal.svg.importLabel(p2, d);
      internal.svg.applyStyleAttributes(obj, 'Point', d);
      obj.properties['data-id'] = i;
      return obj;
    });
    var obj = internal.getEmptyLayerForSVG(lyr, opts);
    obj.children = symbols;
    return internal.svg.stringify(obj);
  }

  function clear() {
    if (editing) stopEditing();
    while (svg.childNodes.length > 0) {
      svg.removeChild(svg.childNodes[0]);
    }
    activeLayer = null;
  }

  function resize(ext) {
    svg.style.width = ext.width() + 'px';
    svg.style.height = ext.height() + 'px';
  }

  return el;
}


/* @requires mapshaper-svg-display, @mapshaper-canvas, mapshaper-map-style */

function LayerStack(container, ext, mouse) {
  var el = El(container),
      _activeCanv = new DisplayCanvas().appendTo(el),  // data layer shapes
      _overlayCanv = new DisplayCanvas().appendTo(el), // data layer shapes
      _overlay2Canv = new DisplayCanvas().appendTo(el),  // line intersection dots
      _svg = new SvgDisplayLayer(ext, mouse).appendTo(el), // labels, _ext;
      _ext = ext;

  this.drawOverlay2Layer = function(lyr) {
    drawSingleCanvasLayer(lyr, _overlay2Canv);
  };

  this.drawOverlayLayer = function(lyr) {
    drawSingleCanvasLayer(lyr, _overlayCanv);
  };

  this.drawLayers = function(layers, onlyNav) {
    _activeCanv.prep(_ext);
    if (!onlyNav) {
      _svg.clear();
    }
    layers.forEach(function(target) {
      if (target.canvas) {
        drawCanvasLayer(target, _activeCanv);
      }
      if (target.svg) {
        drawSvgLayer(target, onlyNav);
      }
    });
  };

  function drawCanvasLayer(target, canv) {
    if (target.style.type == 'outline') {
      drawOutlineLayerToCanvas(target, canv, ext);
    } else {
      drawStyledLayerToCanvas(target, canv, ext);
    }
  }

  function drawSvgLayer(target, onlyNav) {
    if (onlyNav) {
      _svg.reposition(target);
    } else {
      _svg.drawLayer(target);
    }
  }

  function drawSingleCanvasLayer(target, canv) {
    if (!target) {
      canv.hide();
    } else {
      canv.prep(_ext);
      drawCanvasLayer(target, canv);
    }
  }
}




utils.inherit(MshpMap, EventDispatcher);

function MshpMap(model) {
  var _root = El('#mshp-main-map'),
      _referenceLayers = [],
      _intersectionLyr, _activeLyr, _overlayLyr,
      _needReset = false,
      _ext, _inspector, _stack;

  model.on('select', function(e) {
    _intersectionLyr = null;
    _overlayLyr = null;
  });

  // Refresh map display in response to data changes, layer selection, etc.
  model.on('update', function(e) {
    var prevLyr = _activeLyr || null;

    if (!prevLyr) {
      initMap(); // wait until first layer is added to init map extent, resize events, etc.
    }

    if (arcsMayHaveChanged(e.flags)) {
      // regenerate filtered arcs the next time they are needed for rendering
      delete e.dataset.filteredArcs;

      // reset simplification after projection (thresholds have changed)
      // TODO: preserve simplification pct (need to record pct before change)
      if (e.flags.proj && e.dataset.arcs) {
        e.dataset.arcs.setRetainedPct(1);
      }
    }

    if (e.flags.simplify_method) { // no redraw needed
      return false;
    }

    if (e.flags.simplify_amount) { // only redraw (slider drag)
      drawLayers();
      return;
    }

    _activeLyr = getMapLayer(e.layer, e.dataset);
    _activeLyr.style = MapStyle.getActiveStyle(_activeLyr.layer);
    _inspector.updateLayer(_activeLyr);

    if (!prevLyr) {
      _needReset = true;
    } else if (prevLyr.tabular || _activeLyr.tabular) {
      _needReset = true;
    } else {
      _needReset = gui.mapNeedsReset(_activeLyr.bounds, prevLyr.bounds, _ext.getBounds());
    }

    // set 'home' extent to match bounds of active group
    _ext.setBounds(_activeLyr.bounds);

    if (_needReset) {
      // zoom to full view of the active layer and redraw
      _ext.reset(true);
    } else {
      // refresh without navigating
      drawLayers();
    }
  });

  // Currently used to show dots at line intersections
  this.setIntersectionLayer = function(lyr, dataset) {
    if (lyr) {
      _intersectionLyr = getMapLayer(lyr, dataset);
      _intersectionLyr.style = MapStyle.getIntersectionStyle(_intersectionLyr.layer);
    } else {
      _intersectionLyr = null;
    }
    _stack.drawOverlay2Layer(_intersectionLyr); // also hides
  };

  function initMap() {
    var el = El('#map-layers').node();
    var position = new ElementPosition(el);
    var mouse = new MouseArea(el, position);
    _ext = new MapExtent(position);
    new MapNav(_root, _ext, mouse);
    _stack = new LayerStack(el, _ext, mouse);
    _inspector = new InspectionControl(model, _ext, mouse);


    _ext.on('change', function() {
      drawLayers(!_needReset);
      _needReset = false;
    });
    _inspector.on('change', function(e) {
      _overlayLyr = getMapLayerOverlay(_activeLyr, e);
      _stack.drawOverlayLayer(_overlayLyr);
    });
    _inspector.on('data_change', function(e) {
      // refresh the display if a style variable has been changed interactively
      if (internal.isSupportedSvgProperty(e.field)) {
        drawLayers();
      }
    });
    gui.on('resize', function() {
      position.update(); // kludge to detect new map size after console toggle
    });
  }

  // Test if an update may have affected the visible shape of arcs
  // @flags Flags from update event
  function arcsMayHaveChanged(flags) {
    return flags.simplify_method || flags.simplify || flags.proj ||
      flags.arc_count || flags.repair || flags.clip || flags.erase ||
      flags.slice || flags.affine || flags.rectangle || false;
  }

  // Remove layers that have been deleted from the catalog
  function updateReferenceLayers() {
    _referenceLayers = _referenceLayers.filter(function(o) {
      return !!model.findLayer(o.source.layer);
    });
  }

  this.isVisibleLayer = function(lyr) {
    return this.isActiveLayer(lyr) || this.isReferenceLayer(lyr);
  };

  this.isActiveLayer = function(lyr) {
    return lyr == _activeLyr.source.layer;
  };

  this.isReferenceLayer = function(lyr) {
    return _referenceLayers.filter(function(o) {
      return o.source.layer == lyr;
    }).length > 0;
  };

  this.removeReferenceLayer = function(lyr) {
    _referenceLayers = _referenceLayers.filter(function(o) {
      return o.source.layer != lyr;
    });
  };

  this.addReferenceLayer = function(lyr, dataset) {
    if (this.isReferenceLayer(lyr)) return;
    if (lyr && internal.layerHasGeometry(lyr)) {
      _referenceLayers.push(getMapLayer(lyr, dataset));
    }
  };

  this.redraw = drawLayers;

  function getDrawableLayers() {
    // delete any layers that have been dropped from the catalog
    updateReferenceLayers();
    if (_activeLyr.tabular) {
       // don't show reference layers if active layer is displayed as a table
      return [_activeLyr];
    }
    // concat active and reference layers, excluding dupes
    return [_activeLyr].concat(_referenceLayers.filter(function(o) {
      return o.source.layer != _activeLyr.source.layer && o.geographic;
    }));
  }

  function updateLayerStyles(layers) {
    layers.forEach(function(mapLayer, i) {
      if (i === 0) {
        if (mapLayer.style.type != 'styled' && layers.length > 1 && mapLayer.style.strokeColors) {
          // kludge to hide ghosted layers when reference layers are present
          // TODO: consider never showing ghosted layers (which appear after
          // commands like dissolve and filter).
          mapLayer.style = utils.defaults({
            strokeColors: [null, mapLayer.style.strokeColors[1]]
          }, mapLayer.style);
        }
        mapLayer.active = true;
      } else {
        if (mapLayer.layer == _activeLyr.layer) {
          console.error("Error: shared map layer");
        }
        mapLayer.active = false;
        // reference style
        mapLayer.style = MapStyle.getReferenceStyle(mapLayer.layer);
      }
      // data for the renderer in layer-stack to use
      mapLayer.canvas = true;
      mapLayer.svg = internal.layerHasLabels(mapLayer.layer);
    });
  }

  function sortMapLayers(layers) {
    layers.sort(function(a, b) {
      // assume that each layer has a stack_id (assigned by updateLayerStackOrde())
      return a.source.layer.stack_id - b.source.layer.stack_id;
    });
  }

  // onlyNav (bool): only map extent has changed, symbols are unchanged
  function drawLayers(onlyNav) {
    // draw active and reference layers
    var layers = getDrawableLayers();
    if (!onlyNav) {
      updateLayerStyles(layers);
      // update stack_id property of all layers
      internal.updateLayerStackOrder(model.getLayers());
    }
    sortMapLayers(layers);
    _stack.drawLayers(layers, onlyNav);
    // draw intersection dots
    _stack.drawOverlay2Layer(_intersectionLyr);
    // draw hover & selection effects
    _stack.drawOverlayLayer(_overlayLyr);
  }
}

function getMapLayerOverlay(obj, e) {
  var style = MapStyle.getOverlayStyle(obj.layer, e);
  if (!style) return null;
  return utils.defaults({
    layer: filterLayerByIds(obj.layer, style.ids),
    style: style
  }, obj);
}

function filterLayerByIds(lyr, ids) {
  if (lyr.shapes) {
    shapes = ids.map(function(id) {
      return lyr.shapes[id];
    });
    return utils.defaults({shapes: shapes}, lyr);
  }
  return lyr;
}

// Test if map should be re-framed to show updated layer
gui.mapNeedsReset = function(newBounds, prevBounds, mapBounds) {
  var viewportPct = gui.getIntersectionPct(newBounds, mapBounds);
  var contentPct = gui.getIntersectionPct(mapBounds, newBounds);
  var boundsChanged = !prevBounds.equals(newBounds);
  var inView = newBounds.intersects(mapBounds);
  var areaChg = newBounds.area() / prevBounds.area();
  if (!boundsChanged) return false; // don't reset if layer extent hasn't changed
  if (!inView) return true; // reset if layer is out-of-view
  if (viewportPct < 0.3 && contentPct < 0.9) return true; // reset if content is mostly offscreen
  if (areaChg > 1e8 || areaChg < 1e-8) return true; // large area chg, e.g. after projection
  return false;
};

// TODO: move to utilities file
gui.getBoundsIntersection = function(a, b) {
  var c = new Bounds();
  if (a.intersects(b)) {
    c.setBounds(Math.max(a.xmin, b.xmin), Math.max(a.ymin, b.ymin),
    Math.min(a.xmax, b.xmax), Math.min(a.ymax, b.ymax));
  }
  return c;
};

// Returns proportion of bb2 occupied by bb1
gui.getIntersectionPct = function(bb1, bb2) {
  return gui.getBoundsIntersection(bb1, bb2).area() / bb2.area() || 0;
};




function Console(model) {
  var CURSOR = '$ ';
  var PROMPT = 'Enter mapshaper commands or type "tips" for examples and console help';
  var el = El('#console').hide();
  var content = El('#console-buffer');
  var log = El('div').id('console-log').appendTo(content);
  var line = El('div').id('command-line').appendTo(content);
  var cursor = El('span').appendTo(line).text(CURSOR);
  var input = El('span').appendTo(line)
    .addClass('input-field')
    .attr('spellcheck', false)
    .attr('autocorrect', false)
    .attr('contentEditable', true)
    .on('focus', receiveFocus)
    .on('paste', onPaste);
  var history = [];
  var historyId = 0;
  var _isOpen = false;
  var _error = internal.error; // save default error functions...
  var _stop = internal.stop;
  var btn = El('#console-btn').on('click', toggle);

  // capture all messages to this console, whether open or closed
  message = internal.message = consoleMessage;
  message(PROMPT);
  document.addEventListener('keydown', onKeyDown);

  window.addEventListener('beforeunload', turnOff); // save history if console is open on refresh

  gui.onClick(content, function(e) {
    if (gui.getInputElement() || e.target.id != 'command-line') {
      // prevent click-to-focus when typing or clicking on content
      e.stopPropagation();
    }
  });

  gui.onClick(el, function(e) {
    input.node().focus(); // focus if user clicks blank part of console
  });

  function toggle() {
    if (_isOpen) turnOff();
    else turnOn();
  }

  function getHistory() {
    var hist;
    try {
      hist = JSON.parse(localStorage.getItem('console_history'));
    } catch(e) {}
    return hist && hist.length > 0 ? hist : [];
  }

  function saveHistory(history) {
    try {
      history = history.filter(Boolean); // TODO: fix condition that leaves a blank line on the history
      localStorage.setItem('console_history', JSON.stringify(history.slice(-50)));
    } catch(e) {}
  }

  function toLog(str, cname) {
    var msg = El('div').text(str).appendTo(log);
    if (cname) {
      msg.addClass(cname);
    }
    scrollDown();
  }

  function turnOn() {
    if (!_isOpen && !model.isEmpty()) {
      btn.addClass('active');
      _isOpen = true;
      stop = internal.stop = consoleStop;
      error = internal.error = consoleError;
      El('body').addClass('console-open');
      gui.dispatchEvent('resize');
      el.show();
      input.node().focus();
      history = getHistory();
    }
  }

  function turnOff() {
    if (_isOpen) {
      btn.removeClass('active');
      _isOpen = false;
      stop = internal.stop = _stop; // restore original error functions
      error = internal.error = _error;
      el.hide();
      input.node().blur();
      saveHistory(history);
      El('body').removeClass('console-open');
      gui.dispatchEvent('resize');
    }
  }

  function onPaste(e) {
    // paste plain text (remove any copied HTML tags)
    e.preventDefault();
    var str = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand("insertHTML", false, str);
  }

  function receiveFocus() {
    placeCursor();
  }

  function placeCursor() {
    var el = input.node();
    var range, selection;
    if (readCommandLine().length > 0) {
      // move cursor to end of text
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); //collapse the range to the end point.
      selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function scrollDown() {
    var el = content.parent().node();
    el.scrollTop = el.scrollHeight;
  }

  function metaKey(e) {
    return e.metaKey || e.ctrlKey || e.altKey;
  }

  function onKeyDown(e) {
    var kc = e.keyCode,
        inputEl = gui.getInputElement(),
        typing = !!inputEl,
        typingInConsole = inputEl && inputEl == input.node(),
        inputText = readCommandLine(),
        capture = false;

    // esc key
    if (kc == 27) {
      if (typing) {
        inputEl.blur();
      }
      if (gui.getMode()) {
        gui.clearMode(); // esc closes any open panels
      } else {
        turnOff();
      }
      capture = true;

    // l/r arrow keys while not typing in a text field
    } else if ((kc == 37 || kc == 39) && (!typing || typingInConsole && !inputText)) {
      if (kc == 37) {
        model.selectPrevLayer();
      } else {
        model.selectNextLayer();
      }

    // delete key while not inputting text
    } else if (kc == 8 && !typing) {
      capture = true; // prevent delete from leaving page

    // any key while console is open and not typing in a non-console field
    // TODO: prevent console from blocking <enter> for menus
    } else if (_isOpen && (typingInConsole || !typing)) {
      capture = true;
      gui.clearMode(); // close any panels that  might be open

      if (kc == 13) { // enter
        onEnter();
      } else if (kc == 9) { // tab
        tabComplete();
      } else if (kc == 38) {
        back();
      } else if (kc == 40) {
        forward();
      } else if (kc == 32 && (!typing || (inputText === '' && typingInConsole))) {
        // space bar closes if nothing has been typed
        turnOff();
      } else if (!typing && e.target != input.node() && !metaKey(e)) {
        // typing returns focus, unless a meta key is down (to allow Cmd-C copy)
        // or user is typing in a different input area somewhere
        input.node().focus();
        capture = false;
      } else if (/\n\n$/.test(inputText) && e.key && e.key.length == 1) {
        // Convert double newline to single on first typing after \ continuation
        // (for compatibility with Firefox; see onEnter() function)
        // Assumes that cursor is at end of text (TODO: remove this assumption)
        toCommandLine(inputText.substr(0, inputText.length - 1) + e.key);
      } else {
        capture = false; // normal typing
      }

    // various shortcuts (while not typing in an input field or editable el)
    } else if (!typing) {
       if (kc == 32) { // space bar opens console
        capture = true;
        turnOn();
      } else if (kc == 73) { // letter i opens inspector
        gui.dispatchEvent('inspector_toggle');
      } else if (kc == 72) { // letter h resets map extent
        gui.dispatchEvent('map_reset');
      } else if (kc == 13) {
        gui.dispatchEvent('enter_key'); // signal for default buttons on any open menus
      }
    }

    if (capture) {
      e.preventDefault();
    }
  }

  // tab-completion for field names
  function tabComplete() {
    var line = readCommandLine(),
        match = /\w+$/.exec(line),
        stub = match ? match[0] : '',
        lyr = model.getActiveLayer().layer,
        names, name;
    if (stub && lyr.data) {
      names = findCompletions(stub, lyr.data.getFields());
      if (names.length > 0) {
        name = utils.getCommonFileBase(names);
        if (name.length > stub.length) {
          toCommandLine(line.substring(0, match.index) + name);
        }
      }
    }
  }

  function findCompletions(str, fields) {
    return fields.filter(function(name) {
      return name.indexOf(str) === 0;
    });
  }

  function readCommandLine() {
    // return input.node().textContent.trim();
    return input.node().textContent;
  }

  function toCommandLine(str) {
    input.node().textContent = str;
    placeCursor();
  }

  function peekHistory(i) {
    var idx = history.length - 1 - (i || 0);
    return idx >= 0 ? history[idx] : null;
  }

  function toHistory(str) {
    if (historyId > 0) { // if we're back in the history stack
      if (peekHistory() === '') {
        // remove empty string (which may have been appended when user started going back)
        history.pop();
      }
      historyId = 0; // move back to the top of the stack
    }
    if (str && str != peekHistory()) {
      history.push(str);
    }
  }

  function fromHistory() {
    toCommandLine(peekHistory(historyId));
  }

  function back() {
    if (history.length === 0) return;
    if (historyId === 0) {
      history.push(readCommandLine());
    }
    historyId = Math.min(history.length - 1, historyId + 1);
    fromHistory();
  }

  function forward() {
    if (historyId <= 0) return;
    historyId--;
    fromHistory();
    if (historyId === 0) {
      history.pop();
    }
  }

  function clear() {
    log.empty();
    scrollDown();
  }

  function getCommandFlags(commands) {
    return commands.reduce(function(memo, cmd) {
      memo[cmd.name] = true;
      return memo;
    }, {});
  }

  function onEnter() {
    var str = readCommandLine();
    var wrap = /\\\n?$/.test(str); // \n? is to workaround odd Chrome behavior (newline appears after eol backslash)
    if (wrap) {
      toCommandLine(str.trim() + '\n\n'); // two newlines needed in all tested browsers
    } else {
      submit(str);
    }
  }

  // display char codes in string (for debugging console input)
  function strCodes(str) {
    return str.split('').map(function(c) {return c.charCodeAt(0);}).join(',');
  }

  function submit(str) {
    // remove newlines
    // TODO: remove other whitespace at beginning + end of lines
    var cmd = str.replace(/\\?\n/g, '').trim();
    toLog(CURSOR + str);
    toCommandLine('');
    if (cmd) {
      if (cmd == 'clear') {
        clear();
      } else if (cmd == 'tips') {
        printExamples();
      } else if (cmd == 'layers') {
        message("Available layers:",
          internal.getFormattedLayerList(model));
      } else if (cmd == 'close' || cmd == 'exit' || cmd == 'quit') {
        turnOff();
      } else {
        line.hide(); // hide cursor while command is being run
        runMapshaperCommands(cmd, function() {
          line.show();
          input.node().focus();
        });
      }
      toHistory(str);
    }
  }


  function runMapshaperCommands(str, done) {
    var commands;
    try {
      commands = internal.parseConsoleCommands(str);
      commands = internal.runAndRemoveInfoCommands(commands);
    } catch (e) {
      onError(e);
      commands = [];
    }
    if (commands.length > 0) {
      applyParsedCommands(commands, done);
    } else {
      done();
    }
  }

  function applyParsedCommands(commands, done) {
    var active = model.getActiveLayer(),
        prevArcs = active.dataset.arcs,
        prevArcCount = prevArcs ? prevArcs.size() : 0;

    internal.runParsedCommands(commands, model, function(err) {
      var flags = getCommandFlags(commands),
          active2 = model.getActiveLayer(),
          postArcs = active2.dataset.arcs,
          postArcCount = postArcs ? postArcs.size() : 0,
          sameArcs = prevArcs == postArcs && postArcCount == prevArcCount;

      // restore default logging options, in case they were changed by the command
      internal.setStateVar('QUIET', false);
      internal.setStateVar('VERBOSE', false);

      // kludge to signal map that filtered arcs need refreshing
      // TODO: find a better solution, outside the console
      if (!sameArcs) {
        flags.arc_count = true;
      }
      model.updated(flags, active2.layer, active2.dataset);
      // signal the map to update even if an error has occured, because the
      // commands may have partially succeeded and changes may have occured to
      // the data.
      if (err) onError(err);
      done();
    });
  }

  function onError(err) {
    if (utils.isString(err)) {
      stop(err);
    } else if (err.name == 'UserError') {
      // stop() has already been called, don't need to log
    } else if (err.name) {
      // log stack trace to browser console
      console.error(err.stack);
      // log to console window
      warning(err.message);
    }
  }

  function consoleStop() {
    var msg = gui.formatMessageArgs(arguments);
    warning(msg);
    throw new UserError(msg);
  }

  function warning() {
    var msg = gui.formatMessageArgs(arguments);
    toLog(msg, 'console-error');
  }

  function consoleMessage() {
    var msg = gui.formatMessageArgs(arguments);
    if (internal.LOGGING && !internal.getStateVar('QUIET')) {
      toLog(msg, 'console-message');
    }
  }

  function consoleError() {
    var msg = gui.formatMessageArgs(arguments);
    throw new Error(msg);
  }

  function printExample(comment, command) {
    toLog(comment, 'console-message');
    toLog(command, 'console-example');
  }

  function printExamples() {
    printExample("See a list of all console commands", "$ help");
    printExample("Get help using a single command", "$ help innerlines");
    printExample("Get information about imported datasets", "$ info");
    printExample("Delete one state from a national dataset","$ filter 'STATE != \"Alaska\"'");
    printExample("Aggregate counties to states by dissolving shared edges" ,"$ dissolve 'STATE'");
    printExample("Clear the console", "$ clear");
  }
}




function Model() {
  var self = new api.internal.Catalog();
  var deleteLayer = self.deleteLayer;
  utils.extend(self, EventDispatcher.prototype);

  // override Catalog method (so -drop command will work in web console)
  self.deleteLayer = function(lyr, dataset) {
    var active, flags;
    deleteLayer.call(self, lyr, dataset);
    if (self.isEmpty()) {
      // refresh browser if deleted layer was the last layer
      window.location.href = window.location.href.toString();
    } else {
      // trigger event to update layer list and, if needed, the map view
      flags = {};
      active = self.getActiveLayer();
      if (active.layer != lyr) {
        flags.select = true;
      }
      internal.cleanupArcs(active.dataset);
      if (internal.layerHasPaths(lyr)) {
        flags.arc_count = true; // looks like a kludge, try to remove
      }
      self.updated(flags, active.layer, active.dataset);
    }
  };

  self.updated = function(flags, lyr, dataset) {
    var targ, active;
    // if (lyr && dataset && (!active || active.layer != lyr)) {
    if (lyr && dataset) {
      self.setDefaultTarget([lyr], dataset);
    }
    targ = self.getDefaultTargets()[0];
    if (lyr && targ.layers[0] != lyr) {
      flags.select = true;
    }
    active = {layer: targ.layers[0], dataset: targ.dataset};
    if (flags.select) {
      self.dispatchEvent('select', active);
    }
    self.dispatchEvent('update', utils.extend({flags: flags}, active));
  };

  self.selectLayer = function(lyr, dataset) {
    self.updated({select: true}, lyr, dataset);
  };

  self.selectNextLayer = function() {
    var next = self.findNextLayer(self.getActiveLayer().layer);
    if (next) self.selectLayer(next.layer, next.dataset);
  };

  self.selectPrevLayer = function() {
    var prev = self.findPrevLayer(self.getActiveLayer().layer);
    if (prev) self.selectLayer(prev.layer, prev.dataset);
  };

  return self;
}




Browser.onload(function() {
  if (!gui.browserIsSupported()) {
    El("#mshp-not-supported").show();
    return;
  }
  gui.startEditing();
  if (window.location.hostname == 'localhost') {
    window.addEventListener('beforeunload', function() {
      // send termination signal for mapshaper-gui
      var req = new XMLHttpRequest();
      req.open('GET', '/close');
      req.send();
    });
  }
});

gui.getImportOpts = function() {
  var vars = gui.getUrlVars();
  var manifest = mapshaper.manifest || {};
  var opts = {};
  if (Array.isArray(manifest)) {
    // old-style manifest: an array of filenames
    opts.files = manifest;
  } else if (manifest.files) {
    opts.files = manifest.files.concat();
  } else {
    opts.files = [];
  }
  if (vars.files) {
    opts.files = opts.files.concat(vars.files.split(','));
  }
  if (manifest.catalog) {
    opts.catalog = manifest.catalog;
  }
  opts.display_all = !!manifest.display_all;
  return opts;
};

gui.startEditing = function() {
  var model = new Model(),
      dataLoaded = false,
      importOpts = gui.getImportOpts(),
      map, repair, simplify;
  gui.startEditing = function() {};
  map = new MshpMap(model);
  repair = new RepairControl(model, map);
  simplify = new SimplifyControl(model);
  new AlertControl();
  new ImportFileProxy(model);
  new ImportControl(model, importOpts);
  new ExportControl(model);
  new LayerControl(model, map);
  new Console(model);

  model.on('select', function() {
    if (!dataLoaded) {
      dataLoaded = true;
      El('#mode-buttons').show();
      if (importOpts.display_all) {
        model.forEachLayer(map.addReferenceLayer.bind(map));
      }
    }
  });
};

}());
