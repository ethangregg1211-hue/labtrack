// Wraps EmailJS for browser-based email sending.
// The EmailJS SDK is lazy-loaded from CDN only when the user tries to send.

const Email = {
  isConfigured() {
    const s = Storage.getSettings();
    return !!(s.emailjsServiceId && s.emailjsTemplateId && s.emailjsPublicKey && s.email);
  },

  buildOrderText(items) {
    const s    = Storage.getSettings();
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const lines = [];
    lines.push("Order Request");
    lines.push(s.labName || "Lab");
    lines.push(`Requested by: ${s.researcherName || ""}`);
    lines.push(`Date: ${date}`);
    lines.push("");
    items.forEach((item) => {
      lines.push(`Item: ${item.name}`);
      lines.push(`Catalog #: ${item.catalogNumber || ""}`);
      lines.push(`Supplier: ${item.supplier || ""}`);
      lines.push(`Qty: ${item.quantity}${item.unit ? " " + item.unit : ""}`);
      lines.push("");
    });
    return lines.join("\n");
  },

  async send(items) {
    // Re-read settings fresh so s is always in sync with what isConfigured() sees
    const s = Storage.getSettings();
    if (!this.isConfigured()) {
      throw new Error("EmailJS not configured. Add credentials in Settings.");
    }

    // Guard: email must be present — isConfigured() checks this, but surface a
    // specific message so the user knows exactly what's missing.
    const toEmail = (s.email || "").trim();
    if (!toEmail) {
      throw new Error("No recipient email saved. Go to Settings and save your Order Request Email.");
    }

    await this._loadSDK();
    emailjs.init(s.emailjsPublicKey);

    const serviceId  = s.emailjsServiceId;
    const templateId = s.emailjsTemplateId;

    console.log("LabTrack — EmailJS send (values passed exactly as stored in localStorage)");
    console.log("  serviceId:  ", serviceId);
    console.log("  templateId: ", templateId);
    console.log("  publicKey:  ", s.emailjsPublicKey);
    console.log("  to_email:   ", toEmail);

    const params = {
      to_email:        toEmail,
      subject:         `Lab Order Request - ${s.labName || "Lab"}`,
      lab_name:        s.labName || "Lab",
      researcher_name: s.researcherName || "",
      order_list:      this.buildOrderText(items),
      item_count:      String(items.length),
    };

    console.log("Sending with:", serviceId, templateId, s.emailjsPublicKey);
    try {
      const result = await emailjs.send(serviceId, templateId, params);
      console.log("EmailJS success:", result);
      return result;
    } catch (err) {
      // EmailJS rejects with { status, text } — not a standard Error object
      console.error("EmailJS error:", err);
      const detail = err && err.text
        ? `${err.text} (status ${err.status})`
        : (err instanceof Error ? err.message : String(err));
      throw new Error(`Send failed: ${detail}`);
    }
  },

  _loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.emailjs) { resolve(); return; }
      const script   = document.createElement("script");
      script.src     = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      script.onload  = resolve;
      script.onerror = () => reject(new Error("Failed to load EmailJS SDK. Check your internet connection."));
      document.head.appendChild(script);
    });
  },
};
