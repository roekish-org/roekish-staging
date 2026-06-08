/* Roekish site — progressive enhancement only. The site is fully usable with JS off. */
(function () {
  "use strict";

  // — mobile nav toggle —
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // — current year in footer —
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // — lead capture —
  // Single lead channel for the whole site (the Tarifs CTA, internal ref, routes here too).
  // Submission strategy, in order of preference:
  //   1. data-endpoint set  → async POST (JSON) to a real backend, with loading /
  //      success / error states and a recoverable retry. This is the go-live path
  //      (recommended backend: self-hosted Odoo crm.lead controller — RGPD-clean).
  //   2. no endpoint        → graceful mailto: fallback so a lead is never lost.
  // No-JS baseline: the <form action="mailto:…"> still submits without this script.
  var lead = document.getElementById("lead-form");
  if (lead) {
    var to = lead.getAttribute("data-lead-to") || "contact@roekish.fr";
    var endpoint = (lead.getAttribute("data-endpoint") || "").trim();
    var status = lead.querySelector(".form-status");
    var submitBtn = lead.querySelector('button[type="submit"]');

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var ICON = {
      ok: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5l4 4 8-9" stroke="#1c5a3f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      err: '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8" stroke="#822a28" stroke-width="1.8"/><path d="M10 5.5v5.5M10 14h.01" stroke="#822a28" stroke-width="2" stroke-linecap="round"/></svg>'
    };

    var val = function (n) {
      var f = lead.elements[n];
      if (!f) return "";
      if (f.tagName === "SELECT") return f.options[f.selectedIndex].text;
      return (f.value || "").trim();
    };
    var fieldOf = function (name) {
      var el = lead.elements[name];
      return el ? el.closest(".field") : null;
    };
    var setFieldError = function (name, msg) {
      var fld = fieldOf(name);
      if (!fld) return;
      fld.classList.toggle("invalid", !!msg);
      var err = fld.querySelector(".field-err");
      if (err && msg) err.textContent = msg;
      var input = lead.elements[name];
      if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
    };
    var showStatus = function (kind, msg) {
      if (!status) return;
      status.className = "form-status " + kind;
      status.innerHTML = (ICON[kind] || "") + "<span>" + msg + "</span>";
      status.hidden = false;
    };

    // inline validation — clears as the user fixes the field
    var validate = function () {
      var ok = true;
      if (!val("nom")) { setFieldError("nom", "Indiquez votre nom."); ok = false; }
      else setFieldError("nom", "");
      var email = val("email");
      if (!email) { setFieldError("email", "Indiquez votre email professionnel."); ok = false; }
      else if (!EMAIL_RE.test(email)) { setFieldError("email", "Cet email ne semble pas valide."); ok = false; }
      else setFieldError("email", "");
      return ok;
    };
    ["nom", "email"].forEach(function (n) {
      var el = lead.elements[n];
      if (!el) return;
      el.addEventListener("blur", validate);
      el.addEventListener("input", function () {
        var fld = fieldOf(n);
        if (fld && fld.classList.contains("invalid")) validate();
      });
    });

    var mailtoFallback = function () {
      var who = val("entreprise") || val("nom") || "nouveau contact";
      var body = [
        "Nom : " + val("nom"),
        "Email : " + val("email"),
        "Entreprise : " + (val("entreprise") || "—"),
        "Besoin : " + val("sujet"),
        "", "Projet :", val("message") || "—"
      ].join("\n");
      window.location.href = "mailto:" + to +
        "?subject=" + encodeURIComponent("Demande de cadrage — " + who) +
        "&body=" + encodeURIComponent(body);
      showStatus("ok", "Votre messagerie s'ouvre pour finaliser l'envoi à <strong>" + to +
        "</strong>. Si rien n'apparaît, écrivez-nous directement à cette adresse.");
    };

    var setBusy = function (busy) {
      if (!submitBtn) return;
      submitBtn.setAttribute("aria-busy", busy ? "true" : "false");
      submitBtn.disabled = !!busy;
    };

    lead.addEventListener("submit", function (e) {
      e.preventDefault();
      // spam honeypot: a filled hidden field means a bot — silently accept, do nothing.
      var trap = lead.elements["company_url"];
      if (trap && trap.value) { lead.classList.add("sent"); return; }
      if (!validate()) {
        showStatus("err", "Quelques champs sont à corriger ci-dessus.");
        var firstBad = lead.querySelector(".field.invalid input, .field.invalid textarea");
        if (firstBad) firstBad.focus();
        return;
      }

      // No real endpoint configured yet → safe mailto path (interim, pre go-live).
      if (!endpoint) { mailtoFallback(); return; }

      // Real async submission with loading / success / error states.
      setBusy(true);
      showStatus("ok", "Envoi en cours…");
      var payload = {
        nom: val("nom"), email: val("email"),
        entreprise: val("entreprise"), sujet: val("sujet"),
        message: val("message"), source: "site:contact"
      };
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        lead.classList.add("sent");
        var done = lead.querySelector(".form-done");
        if (done) { done.setAttribute("tabindex", "-1"); done.focus(); }
      }).catch(function () {
        setBusy(false);
        showStatus("err", "L'envoi n'a pas abouti — vérifiez votre connexion et réessayez, " +
          "ou écrivez-nous directement à <strong>" + to + "</strong>.");
      });
    });
  }

  // — scroll reveal —
  var items = document.querySelectorAll("[data-reveal]");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();
