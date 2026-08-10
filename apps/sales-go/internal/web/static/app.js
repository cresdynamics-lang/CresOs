(function () {
  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  // Side-panel CRM group
  var crmToggle = qs("[data-crm-toggle]");
  var crmSub = qs("[data-crm-sub]");
  if (crmToggle && crmSub) {
    var key = "cresos.salesgo.crmPanelOpen";
    var forced = crmSub.getAttribute("data-force-open") === "1";
    var open = forced || localStorage.getItem(key) === "1";
    function setCrm(v) {
      open = v;
      crmSub.classList.toggle("open", open);
      crmToggle.setAttribute("aria-expanded", open ? "true" : "false");
      localStorage.setItem(key, open ? "1" : "0");
    }
    setCrm(open);
    crmToggle.addEventListener("click", function () {
      setCrm(!open);
    });
  }

  // Modal open/close
  qsa("[data-open-modal]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-open-modal");
      var modal = qs("#" + id);
      if (!modal) return;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
    });
  });
  qsa("[data-close-modal]").forEach(function (el) {
    el.addEventListener("click", function () {
      var modal = el.closest(".modal");
      if (!modal) return;
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    });
  });
  qsa(".modal.open,[data-auto-open='1']").forEach(function (modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  });

  // CRM page accordion panels
  qsa("[data-panel-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-panel-toggle");
      var panel = qs("#" + id);
      if (!panel) return;
      var willOpen = !panel.classList.contains("open");
      qsa(".crm-panel").forEach(function (p) {
        p.classList.remove("open");
      });
      qsa("[data-panel-toggle]").forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        panel.classList.add("open");
        btn.classList.add("active");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
})();
