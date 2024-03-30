/* @license GNU-GPL-2.0-or-later https://www.drupal.org/licensing/faq */
(function (_, $, Drupal, drupalSettings) {
  "use strict";
  var Bootstrap = {
    processedOnce: {},
    settings: drupalSettings.bootstrap || {},
  };
  Bootstrap.checkPlain = function (str) {
    return (str && Drupal.checkPlain(str)) || "";
  };
  Bootstrap.createPlugin = function (id, plugin, noConflict) {
    if ($.fn[id] !== void 0)
      return this.fatal(
        "Specified jQuery plugin identifier already exists: @id. Use Drupal.bootstrap.replacePlugin() instead.",
        { "@id": id }
      );
    if (typeof plugin !== "function")
      return this.fatal(
        'You must provide a constructor function to create a jQuery plugin "@id": @plugin',
        { "@id": id, "@plugin": plugin }
      );
    this.pluginNoConflict(id, plugin, noConflict);
    $.fn[id] = plugin;
  };
  Bootstrap.diffObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(
      args[0],
      _.difference.apply(
        _,
        _.map(args, function (obj) {
          return Object.keys(obj);
        })
      )
    );
  };
  Bootstrap.eventMap = {
    Event:
      /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
    MouseEvent:
      /^(?:click|dblclick|mouse(?:down|enter|leave|up|over|move|out))$/,
    KeyboardEvent: /^(?:key(?:down|press|up))$/,
    TouchEvent: /^(?:touch(?:start|end|move|cancel))$/,
  };
  Bootstrap.extendPlugin = function (id, callback) {
    if (typeof $.fn[id] !== "function")
      return this.fatal(
        "Specified jQuery plugin identifier does not exist: @id",
        { "@id": id }
      );
    if (typeof callback !== "function")
      return this.fatal(
        'You must provide a callback function to extend the jQuery plugin "@id": @callback',
        { "@id": id, "@callback": callback }
      );
    var constructor = ($.fn[id] && $.fn[id].Constructor) || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);
    if (!$.isPlainObject(plugin))
      return this.fatal(
        'Returned value from callback is not a plain object that can be used to extend the jQuery plugin "@id": @obj',
        { "@obj": plugin }
      );
    this.wrapPluginConstructor(constructor, plugin, true);
    return $.fn[id];
  };
  Bootstrap.superWrapper = function (parent, fn) {
    return function () {
      var previousSuper = this.super;
      this.super = parent;
      var ret = fn.apply(this, arguments);
      if (previousSuper) this.super = previousSuper;
      else delete this.super;
      return ret;
    };
  };
  Bootstrap.fatal = function (message, args) {
    if (this.settings.dev && console.warn) {
      for (var name in args)
        if (args.hasOwnProperty(name) && typeof args[name] === "object")
          args[name] = JSON.stringify(args[name]);
      Drupal.throwError(new Error(Drupal.formatString(message, args)));
    }
    return false;
  };
  Bootstrap.intersectObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(
      args[0],
      _.intersection.apply(
        _,
        _.map(args, function (obj) {
          return Object.keys(obj);
        })
      )
    );
  };
  Bootstrap.normalizeObject = function (obj) {
    if (!$.isPlainObject(obj)) return obj;
    for (var k in obj)
      if (typeof obj[k] === "string")
        if (obj[k] === "true") obj[k] = true;
        else if (obj[k] === "false") obj[k] = false;
        else {
          if (obj[k].match(/^[\d-.]$/)) obj[k] = parseFloat(obj[k]);
        }
      else {
        if ($.isPlainObject(obj[k])) obj[k] = Bootstrap.normalizeObject(obj[k]);
      }
    return obj;
  };
  Bootstrap.once = function (id, callback) {
    if (this.processedOnce[id]) return this;
    callback.call(this, this.settings);
    this.processedOnce[id] = true;
    return this;
  };
  Bootstrap.option = function (key, value) {
    var options = $.isPlainObject(key) ? $.extend({}, key) : {};
    if (arguments.length === 0) return $.extend({}, this.options);
    if (typeof key === "string") {
      var parts = key.split(".");
      key = parts.shift();
      var obj = options;
      if (parts.length) {
        for (var i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = obj[parts[i]] || {};
          obj = obj[parts[i]];
        }
        key = parts.pop();
      }
      if (arguments.length === 1) return obj[key] === void 0 ? null : obj[key];
      obj[key] = value;
    }
    $.extend(true, this.options, options);
  };
  Bootstrap.pluginNoConflict = function (id, plugin, noConflict) {
    if (plugin.noConflict === void 0 && (noConflict === void 0 || noConflict)) {
      var old = $.fn[id];
      plugin.noConflict = function () {
        $.fn[id] = old;
        return this;
      };
    }
  };
  Bootstrap.relayEvent = function (target, name, stopPropagation) {
    return function (e) {
      if (stopPropagation === void 0 || stopPropagation) e.stopPropagation();
      var $target = $(target);
      var parts = name.split(".").filter(Boolean);
      var type = parts.shift();
      e.target = $target[0];
      e.currentTarget = $target[0];
      e.namespace = parts.join(".");
      e.type = type;
      $target.trigger(e);
    };
  };
  Bootstrap.replacePlugin = function (id, callback, noConflict) {
    if (typeof $.fn[id] !== "function")
      return this.fatal(
        "Specified jQuery plugin identifier does not exist: @id",
        { "@id": id }
      );
    if (typeof callback !== "function")
      return this.fatal(
        "You must provide a valid callback function to replace a jQuery plugin: @callback",
        { "@callback": callback }
      );
    var constructor = ($.fn[id] && $.fn[id].Constructor) || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);
    if (typeof plugin !== "function")
      return this.fatal(
        'Returned value from callback is not a usable function to replace a jQuery plugin "@id": @plugin',
        { "@id": id, "@plugin": plugin }
      );
    this.wrapPluginConstructor(constructor, plugin);
    this.pluginNoConflict(id, plugin, noConflict);
    $.fn[id] = plugin;
  };
  Bootstrap.simulate = function (element, type, options) {
    var ret = true;
    if (element instanceof $) {
      element.each(function () {
        if (!Bootstrap.simulate(this, type, options)) ret = false;
      });
      return ret;
    }
    if (!(element instanceof HTMLElement))
      this.fatal(
        'Passed element must be an instance of HTMLElement, got "@type" instead.',
        { "@type": typeof element }
      );
    if (typeof $.simulate === "function") {
      new $.simulate(element, type, options);
      return true;
    }
    var event;
    var ctor;
    var types = [].concat(type);
    for (var i = 0, l = types.length; i < l; i++) {
      type = types[i];
      for (var name in this.eventMap)
        if (this.eventMap[name].test(type)) {
          ctor = name;
          break;
        }
      if (!ctor)
        throw new SyntaxError(
          "Only rudimentary HTMLEvents, KeyboardEvents and MouseEvents are supported: " +
            type
        );
      var opts = { bubbles: true, cancelable: true };
      if (ctor === "KeyboardEvent" || ctor === "MouseEvent")
        $.extend(opts, { ctrlKey: !1, altKey: !1, shiftKey: !1, metaKey: !1 });
      if (ctor === "MouseEvent")
        $.extend(opts, { button: 0, pointerX: 0, pointerY: 0, view: window });
      if (options) $.extend(opts, options);
      if (typeof window[ctor] === "function") {
        event = new window[ctor](type, opts);
        if (!element.dispatchEvent(event)) ret = false;
      } else if (document.createEvent) {
        event = document.createEvent(ctor);
        event.initEvent(type, opts.bubbles, opts.cancelable);
        if (!element.dispatchEvent(event)) ret = false;
      } else if (typeof element.fireEvent === "function") {
        event = $.extend(document.createEventObject(), opts);
        if (!element.fireEvent("on" + type, event)) ret = false;
      } else {
        if (typeof element[type]) element[type]();
      }
    }
    return ret;
  };
  Bootstrap.stripHtml = function (html) {
    if (html instanceof $) html = html.html();
    else {
      if (html instanceof Element) html = html.innerHTML;
    }
    var tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").replace(
      /^[\s\n\t]*|[\s\n\t]*$/,
      ""
    );
  };
  Bootstrap.unsupported = function (type, name, value) {
    Bootstrap.warn("Unsupported by Drupal Bootstrap: (@type) @name -> @value", {
      "@type": type,
      "@name": name,
      "@value": typeof value === "object" ? JSON.stringify(value) : value,
    });
  };
  Bootstrap.warn = function (message, args) {
    if (this.settings.dev && console.warn)
      console.warn(Drupal.formatString(message, args));
  };
  Bootstrap.wrapPluginConstructor = function (constructor, plugin, extend) {
    var proto = constructor.prototype;
    var option = this.option;
    if (proto.option === void 0)
      proto.option = function () {
        return option.apply(this, arguments);
      };
    if (extend) {
      if (plugin.prototype !== void 0)
        for (var key in plugin.prototype) {
          if (!plugin.prototype.hasOwnProperty(key)) continue;
          var value = plugin.prototype[key];
          if (typeof value === "function")
            proto[key] = this.superWrapper(proto[key] || function () {}, value);
          else
            proto[key] = $.isPlainObject(value)
              ? $.extend(true, {}, proto[key], value)
              : value;
        }
      delete plugin.prototype;
      for (key in plugin) {
        if (!plugin.hasOwnProperty(key)) continue;
        value = plugin[key];
        if (typeof value === "function")
          constructor[key] = this.superWrapper(
            constructor[key] || function () {},
            value
          );
        else
          constructor[key] = $.isPlainObject(value)
            ? $.extend(true, {}, constructor[key], value)
            : value;
      }
    }
  };
  Drupal.bootstrap = Drupal.bootstrap || Bootstrap;
})(window._, window.jQuery, window.Drupal, window.drupalSettings);
(function ($, _) {
  var Attributes = function (attributes) {
    this.data = {};
    this.data["class"] = [];
    this.merge(attributes);
  };
  Attributes.prototype.toString = function () {
    var output = "";
    var name, value;
    var checkPlain = function (str) {
      return (
        (str &&
          str
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")) ||
        ""
      );
    };
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(" ");
      output += " " + checkPlain(name) + '="' + checkPlain(value) + '"';
    }
    return output;
  };
  Attributes.prototype.toPlainObject = function () {
    var object = {};
    var name, value;
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(" ");
      object[name] = value;
    }
    return object;
  };
  Attributes.prototype.addClass = function (value) {
    var args = Array.prototype.slice.call(arguments);
    this.data["class"] = this.sanitizeClasses(this.data["class"].concat(args));
    return this;
  };
  Attributes.prototype.exists = function (name) {
    return this.data[name] !== void 0 && this.data[name] !== null;
  };
  Attributes.prototype.get = function (name, defaultValue) {
    if (!this.exists(name)) this.data[name] = defaultValue;
    return this.data[name];
  };
  Attributes.prototype.getData = function () {
    return _.extend({}, this.data);
  };
  Attributes.prototype.getClasses = function () {
    return this.get("class", []);
  };
  Attributes.prototype.hasClass = function (className) {
    className = this.sanitizeClasses(Array.prototype.slice.call(arguments));
    var classes = this.getClasses();
    for (var i = 0, l = className.length; i < l; i++)
      if (_.indexOf(classes, className[i]) === -1) return false;
    return true;
  };
  Attributes.prototype.merge = function (object, recursive) {
    if (!object) return this;
    if (object instanceof $) object = object[0];
    if (object instanceof Node)
      object = Array.prototype.slice
        .call(object.attributes)
        .reduce(function (attributes, attribute) {
          attributes[attribute.name] = attribute.value;
          return attributes;
        }, {});
    else if (object instanceof Attributes) object = object.getData();
    else object = _.extend({}, object);
    if (!$.isPlainObject(object)) {
      setTimeout(function () {
        throw new Error("Passed object is not supported: " + object);
      });
      return this;
    }
    if (object && object["class"] !== void 0) {
      this.addClass(object["class"]);
      delete object["class"];
    }
    if (recursive === void 0 || recursive)
      this.data = $.extend(true, {}, this.data, object);
    else this.data = $.extend({}, this.data, object);
    return this;
  };
  Attributes.prototype.remove = function (name) {
    if (this.exists(name)) delete this.data[name];
    return this;
  };
  Attributes.prototype.removeClass = function (className) {
    var remove = this.sanitizeClasses(Array.prototype.slice.apply(arguments));
    this.data["class"] = _.without(this.getClasses(), remove);
    return this;
  };
  Attributes.prototype.replaceClass = function (oldValue, newValue) {
    var classes = this.getClasses();
    var i = _.indexOf(this.sanitizeClasses(oldValue), classes);
    if (i >= 0) {
      classes[i] = newValue;
      this.set("class", classes);
    }
    return this;
  };
  Attributes.prototype.sanitizeClasses = function (classes) {
    return _.chain(Array.prototype.slice.call(arguments))
      .flatten()
      .map(function (string) {
        return string.split(" ");
      })
      .flatten()
      .filter()
      .map(function (value) {
        return Attributes.cleanClass(value);
      })
      .uniq()
      .value();
  };
  Attributes.prototype.set = function (name, value) {
    var obj = $.isPlainObject(name) ? name : {};
    if (typeof name === "string") obj[name] = value;
    return this.merge(obj);
  };
  Attributes.cleanClass = function (identifier, filter) {
    filter = filter || { " ": "-", _: "-", "/": "-", "[": "-", "]": "" };
    identifier = identifier.toLowerCase();
    if (filter["__"] === void 0)
      identifier = identifier.replace("__", "#DOUBLE_UNDERSCORE#");
    identifier = identifier.replace(
      Object.keys(filter),
      Object.keys(filter).map(function (key) {
        return filter[key];
      })
    );
    if (filter["__"] === void 0)
      identifier = identifier.replace("#DOUBLE_UNDERSCORE#", "__");
    identifier = identifier.replace(
      /[^\u002D\u0030-\u0039\u0041-\u005A\u005F\u0061-\u007A\u00A1-\uFFFF]/g,
      ""
    );
    identifier = identifier.replace(
      ["/^[0-9]/", "/^(-[0-9])|^(--)/"],
      ["_", "__"]
    );
    return identifier;
  };
  Attributes.create = function (attributes) {
    return new Attributes(attributes);
  };
  window.Attributes = Attributes;
})(window.jQuery, window._);
(function ($, Drupal, Bootstrap, Attributes) {
  if (!Drupal.icon) Drupal.icon = { bundles: {} };
  if (!Drupal.theme.icon || Drupal.theme.prototype.icon)
    $.extend(Drupal.theme, {
      icon: function (bundle, icon, attributes) {
        if (!Drupal.icon.bundles[bundle]) return "";
        attributes = Attributes.create(attributes)
          .addClass("icon")
          .set("aria-hidden", "true");
        icon = Drupal.icon.bundles[bundle](icon, attributes);
        return "<span" + attributes + "></span>";
      },
    });
  Drupal.icon.bundles.bootstrap = function (icon, attributes) {
    attributes.addClass(["glyphicon", "glyphicon-" + icon]);
  };
  $.extend(Drupal.theme, {
    ajaxThrobber: function () {
      return Drupal.theme("bootstrapIcon", "refresh", {
        class: ["ajax-throbber", "glyphicon-spin"],
      });
    },
    button: function (attributes) {
      attributes = Attributes.create(attributes).addClass("btn");
      var context = attributes.get("context", "default");
      var label = attributes.get("value", "");
      attributes.remove("context").remove("value");
      if (
        !attributes.hasClass([
          "btn-default",
          "btn-primary",
          "btn-success",
          "btn-info",
          "btn-warning",
          "btn-danger",
          "btn-link",
        ])
      )
        attributes.addClass("btn-" + Bootstrap.checkPlain(context));
      if (!attributes.exists("type"))
        attributes.set(
          "type",
          attributes.hasClass("form-submit") ? "submit" : "button"
        );
      return "<button" + attributes + ">" + label + "</button>";
    },
    btn: function (attributes) {
      return Drupal.theme("button", attributes);
    },
    "btn-block": function (attributes) {
      return Drupal.theme(
        "button",
        Attributes.create(attributes).addClass("btn-block")
      );
    },
    "btn-lg": function (attributes) {
      return Drupal.theme(
        "button",
        Attributes.create(attributes).addClass("btn-lg")
      );
    },
    "btn-sm": function (attributes) {
      return Drupal.theme(
        "button",
        Attributes.create(attributes).addClass("btn-sm")
      );
    },
    "btn-xs": function (attributes) {
      return Drupal.theme(
        "button",
        Attributes.create(attributes).addClass("btn-xs")
      );
    },
    bootstrapIcon: function (name, attributes) {
      return Drupal.theme("icon", "bootstrap", name, attributes);
    },
  });
})(window.jQuery, window.Drupal, window.Drupal.bootstrap, window.Attributes);
var Drupal = Drupal || {};
(function ($, Drupal, Bootstrap) {
  "use strict";
  var $document = $(document);
  Bootstrap.extendPlugin("popover", function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.popover_animation,
        autoClose: !!settings.popover_auto_close,
        enabled: settings.popover_enabled,
        html: !!settings.popover_html,
        placement: settings.popover_placement,
        selector: settings.popover_selector,
        trigger: settings.popover_trigger,
        title: settings.popover_title,
        content: settings.popover_content,
        delay: parseInt(settings.popover_delay, 10),
        container: settings.popover_container,
      },
    };
  });
  Drupal.behaviors.bootstrapPopovers = {
    $activePopover: null,
    attach: function (context) {
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) return;
      var _this = this;
      $document
        .on("show.bs.popover", "[data-toggle=popover]", function () {
          var $trigger = $(this);
          var popover = $trigger.data("bs.popover");
          if (popover.options.originalTrigger === "click") {
            if (
              _this.$activePopover &&
              _this.getOption("autoClose") &&
              !_this.$activePopover.is($trigger)
            )
              _this.$activePopover.popover("hide");
            _this.$activePopover = $trigger;
          }
        })
        .on("focus.bs.popover", ":visible", function (e) {
          var $target = $(e.target);
          if (
            _this.$activePopover &&
            _this.getOption("autoClose") &&
            !_this.$activePopover.is($target) &&
            !$target.closest(".popover.in")[0]
          ) {
            _this.$activePopover.popover("hide");
            _this.$activePopover = null;
          }
        })
        .on("click.bs.popover", function (e) {
          var $target = $(e.target);
          if (
            _this.$activePopover &&
            _this.getOption("autoClose") &&
            !$target.is("[data-toggle=popover]") &&
            !$target.closest(".popover.in")[0]
          ) {
            _this.$activePopover.popover("hide");
            _this.$activePopover = null;
          }
        })
        .on("keyup.bs.popover", function (e) {
          if (
            _this.$activePopover &&
            _this.getOption("autoClose") &&
            e.which === 27
          ) {
            _this.$activePopover.popover("hide");
            _this.$activePopover = null;
          }
        });
      var elements = $(context).find("[data-toggle=popover]").toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend(
          {},
          $.fn.popover.Constructor.DEFAULTS,
          $element.data()
        );
        options.originalTrigger = options.trigger;
        if (options.trigger === "click") options.trigger = "manual";
        var target =
          options.target ||
          ($element.is('a[href^="#"]') && $element.attr("href"));
        var $target = $document.find(target).clone();
        if (!options.content && $target[0]) {
          $target
            .removeClass("visually-hidden hidden")
            .removeAttr("aria-hidden");
          options.content =
            $target.wrap("<div/>").parent()[options.html ? "html" : "text"]() ||
            "";
        }
        $element.popover(options);
        if (options.originalTrigger === "click") {
          $element
            .off("click.drupal.bootstrap.popover")
            .on("click.drupal.bootstrap.popover", function (e) {
              $(this).popover("toggle");
              e.preventDefault();
              e.stopPropagation();
            });
        }
      }
    },
    detach: function (context) {
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) return;
      $(context)
        .find('[data-toggle="popover"]')
        .off("click.drupal.bootstrap.popover")
        .popover("destroy");
    },
    getOption: function (name, defaultValue, element) {
      var $element = element ? $(element) : this.$activePopover;
      var options = $.extend(
        true,
        {},
        $.fn.popover.Constructor.DEFAULTS,
        (($element && $element.data("bs.popover")) || {}).options
      );
      if (options[name] !== void 0) return options[name];
      return defaultValue !== void 0 ? defaultValue : void 0;
    },
  };
})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
var Drupal = Drupal || {};
(function ($, Drupal, Bootstrap) {
  "use strict";
  Bootstrap.extendPlugin("tooltip", function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.tooltip_animation,
        enabled: settings.tooltip_enabled,
        html: !!settings.tooltip_html,
        placement: settings.tooltip_placement,
        selector: settings.tooltip_selector,
        trigger: settings.tooltip_trigger,
        delay: parseInt(settings.tooltip_delay, 10),
        container: settings.tooltip_container,
      },
    };
  });
  Drupal.behaviors.bootstrapTooltips = {
    attach: function (context) {
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) return;
      var elements = $(context).find('[data-toggle="tooltip"]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend(
          {},
          $.fn.tooltip.Constructor.DEFAULTS,
          $element.data()
        );
        $element.tooltip(options);
      }
    },
    detach: function (context) {
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) return;
      $(context).find('[data-toggle="tooltip"]').tooltip("destroy");
    },
  };
})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
