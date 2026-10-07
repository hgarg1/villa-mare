/* Versioned localStorage wrapper with an in-memory fallback (private mode, blocked storage). */
(() => {
  const VM = (window.VM = window.VM || {});
  const VERSION = 1;
  const mem = {};
  const listeners = {};

  const works = (() => {
    try {
      localStorage.setItem("vm:_t", "1");
      localStorage.removeItem("vm:_t");
      return true;
    } catch (e) {
      return false;
    }
  })();

  VM.store = {
    available: works,
    get(key, fallback = null) {
      try {
        const raw = works ? localStorage.getItem("vm:" + key) : mem[key];
        if (raw == null) return fallback;
        const obj = JSON.parse(raw);
        return obj && obj.v === VERSION ? obj.d : fallback; // old/foreign schema → discard
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      const raw = JSON.stringify({ v: VERSION, d: value });
      try {
        if (works) localStorage.setItem("vm:" + key, raw);
        else mem[key] = raw;
      } catch (e) {
        mem[key] = raw;
      }
      (listeners[key] || []).forEach((fn) => fn(value));
    },
    remove(key) {
      try {
        if (works) localStorage.removeItem("vm:" + key);
      } catch (e) {}
      delete mem[key];
      (listeners[key] || []).forEach((fn) => fn(null));
    },
    on(key, fn) {
      (listeners[key] ||= []).push(fn);
    },
  };

  /* Bookings are the one collection other modules (availability, booking page) share. */
  VM.bookings = {
    all: () => VM.store.get("bookings", []),
    add(b) {
      const list = VM.bookings.all();
      list.push(b);
      VM.store.set("bookings", list);
    },
    update(ref, patch) {
      const list = VM.bookings.all().map((b) => (b.ref === ref ? { ...b, ...patch } : b));
      VM.store.set("bookings", list);
    },
    find: (ref, email) =>
      VM.bookings.all().find((b) => b.ref.toLowerCase() === String(ref).trim().toLowerCase() && b.guest.email.toLowerCase() === String(email).trim().toLowerCase()),
    byKey: (key) => VM.bookings.all().find((b) => b.idemKey === key),
  };
})();
