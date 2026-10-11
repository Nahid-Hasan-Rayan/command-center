/**
 * NHR
 * @author Nahid Hasan Rayan
 */

export const BRIDGE_SOURCE = `
(function () {
  var boot = window.__CC_BOOT__ || {};
  var token = String(boot.token || "");
  var data = boot.state && typeof boot.state === "object" ? boot.state : {};
  var timer = null;
  var dirty = false;
  var LIMIT = 500000;

  function send(type, payload) {
    var message = { cc: 1, type: type, token: token };
    for (var key in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        message[key] = payload[key];
      }
    }
    parent.postMessage(message, "*");
  }

  function flush() {
    timer = null;
    if (!dirty) {
      return;
    }
    dirty = false;
    send("state.set", { data: data });
  }

  function schedule() {
    dirty = true;
    if (!timer) {
      timer = setTimeout(flush, 600);
    }
  }

  function size() {
    var total = 0;
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        total += key.length + String(data[key]).length;
      }
    }
    return total;
  }

  function makeStorage(persistent) {
    var store = persistent ? data : {};
    var api = {
      getItem: function (key) {
        key = String(key);
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem: function (key, value) {
        key = String(key);
        value = String(value);
        var previous = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : undefined;
        store[key] = value;
        if (persistent && size() > LIMIT) {
          if (previous === undefined) {
            delete store[key];
          } else {
            store[key] = previous;
          }
          throw new DOMException("Storage quota exceeded", "QuotaExceededError");
        }
        if (persistent) {
          schedule();
        }
      },
      removeItem: function (key) {
        delete store[String(key)];
        if (persistent) {
          schedule();
        }
      },
      clear: function () {
        for (var key in store) {
          if (Object.prototype.hasOwnProperty.call(store, key)) {
            delete store[key];
          }
        }
        if (persistent) {
          schedule();
        }
      },
      key: function (index) {
        var keys = Object.keys(store);
        return index >= 0 && index < keys.length ? keys[index] : null;
      }
    };
    return new Proxy(api, {
      get: function (target, prop) {
        if (prop === "length") {
          return Object.keys(store).length;
        }
        if (prop in target) {
          return target[prop];
        }
        return Object.prototype.hasOwnProperty.call(store, prop) ? store[prop] : undefined;
      },
      set: function (target, prop, value) {
        target.setItem(prop, value);
        return true;
      },
      deleteProperty: function (target, prop) {
        target.removeItem(prop);
        return true;
      },
      ownKeys: function () {
        return Object.keys(store);
      },
      getOwnPropertyDescriptor: function (target, prop) {
        if (Object.prototype.hasOwnProperty.call(store, prop)) {
          return { value: store[prop], writable: true, enumerable: true, configurable: true };
        }
        return undefined;
      }
    });
  }

  function define(name, value) {
    try {
      Object.defineProperty(window, name, { value: value, configurable: true, writable: false });
    } catch (error) {
      void error;
    }
  }

  define("localStorage", makeStorage(true));
  define("sessionStorage", makeStorage(false));

  var pending = {};
  var sequence = 0;

  window.CommandCenter = {
    version: 1,
    permissions: Array.isArray(boot.permissions) ? boot.permissions.slice() : [],
    getContext: function (scope) {
      return new Promise(function (resolve, reject) {
        var id = ++sequence;
        pending[id] = { resolve: resolve, reject: reject };
        send("context.request", { id: id, scope: String(scope) });
        setTimeout(function () {
          if (pending[id]) {
            delete pending[id];
            reject(new Error("Context request timed out"));
          }
        }, 10000);
      });
    }
  };

  window.addEventListener("message", function (event) {
    if (event.source !== parent) {
      return;
    }
    var message = event.data;
    if (!message || message.cc !== 1 || message.token !== token) {
      return;
    }
    if (message.type === "context.response") {
      var entry = pending[message.id];
      if (!entry) {
        return;
      }
      delete pending[message.id];
      if (message.error) {
        entry.reject(new Error(String(message.error)));
      } else {
        entry.resolve(message.data);
      }
    }
  });

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });

  send("ready", {});
})();
`;
