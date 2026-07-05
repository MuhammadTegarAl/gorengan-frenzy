(function () {
  const config = window.HASAN_ANALYTICS_CONFIG || {};
  const token = config.mixpanelToken || window.MIXPANEL_TOKEN || "";
  const consentKey = "hasan-frenzy-analytics-consent";
  const isDev = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
  let initialized = false;
  let loading = false;
  let contextProvider = () => ({});
  const pendingEvents = [];

  function hasConsent() {
    return localStorage.getItem(consentKey) === "granted";
  }

  function getConsentState() {
    return localStorage.getItem(consentKey) || "unknown";
  }

  function setConsent(value) {
    localStorage.setItem(consentKey, value ? "granted" : "denied");
    if (value) init();
  }

  function bootstrapMixpanel() {
    if (window.mixpanel?.__SV || window.mixpanel?.__loaded) return;

    (function (documentRef, mixpanelRef) {
      if (mixpanelRef.__SV) return;
      window.mixpanel = mixpanelRef;
      mixpanelRef._i = [];
      mixpanelRef.init = function (projectToken, options, name) {
        function addStub(target, methodName) {
          const parts = methodName.split(".");
          if (parts.length === 2) {
            target = target[parts[0]];
            methodName = parts[1];
          }
          target[methodName] = function () {
            target.push([methodName].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }

        let target = mixpanelRef;
        if (typeof name !== "undefined") {
          target = mixpanelRef[name] = [];
        } else {
          name = "mixpanel";
        }

        target.people = target.people || [];
        target.toString = function (stubbed) {
          let label = "mixpanel";
          if (name !== "mixpanel") label += `.${name}`;
          if (!stubbed) label += " (stub)";
          return label;
        };
        target.people.toString = function () {
          return `${target.toString(1)}.people (stub)`;
        };

        const methods = "disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");
        methods.forEach((method) => addStub(target, method));
        mixpanelRef._i.push([projectToken, options, name]);
      };
      mixpanelRef.__SV = 1.2;

      const script = documentRef.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
      const firstScript = documentRef.getElementsByTagName("script")[0];
      firstScript.parentNode.insertBefore(script, firstScript);
    })(document, window.mixpanel || []);
  }

  function init() {
    if (initialized || loading || !token || !hasConsent()) return;
    loading = true;

    try {
      bootstrapMixpanel();
      if (typeof window.mixpanel?.init !== "function") throw new Error("Mixpanel SDK unavailable");
      window.mixpanel.init(token, {
        debug: isDev,
        persistence: "localStorage",
        track_pageview: false
      });
      initialized = true;
      while (pendingEvents.length) {
        const [eventName, payload] = pendingEvents.shift();
        window.mixpanel.track(eventName, payload);
      }
    } catch (error) {
      if (isDev) console.warn("[analytics] Mixpanel init failed", error);
    } finally {
      loading = false;
    }
  }

  function deviceType() {
    const width = window.innerWidth || 0;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    if (width >= 900 && !coarse) return "desktop";
    if (width >= 700) return "tablet";
    return "mobile";
  }

  function sharedProperties() {
    return {
      game_name: "Hasan Frenzy",
      app_version: config.appVersion || "1.0.0",
      device_type: deviceType(),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      timestamp_iso: new Date().toISOString(),
      analytics_consent: getConsentState(),
      ...contextProvider()
    };
  }

  function trackEvent(eventName, properties = {}) {
    const payload = { ...sharedProperties(), ...properties };
    if (isDev) console.log("[analytics]", eventName, payload);
    if (!initialized || !window.mixpanel) {
      if (token && hasConsent() && pendingEvents.length < 25) pendingEvents.push([eventName, payload]);
      return;
    }

    try {
      window.mixpanel.track(eventName, payload);
    } catch (error) {
      if (isDev) console.warn("[analytics] track failed", eventName, error);
    }
  }

  function identify(userId, profile = {}) {
    if (!userId || !initialized || !window.mixpanel) return;

    try {
      window.mixpanel.identify(userId);
      window.mixpanel.people.set({
        ...profile,
        game_name: "Hasan Frenzy",
        last_seen_at: new Date().toISOString()
      });
    } catch (error) {
      if (isDev) console.warn("[analytics] identify failed", error);
    }
  }

  window.HasanAnalytics = {
    init,
    setConsent,
    hasConsent,
    getConsentState,
    setContextProvider(provider) {
      contextProvider = typeof provider === "function" ? provider : contextProvider;
    },
    trackEvent,
    identify
  };

  if (hasConsent()) init();
})();
