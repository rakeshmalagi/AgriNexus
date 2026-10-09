import { useState, useEffect, useCallback, useMemo } from "react";
import BuyerCard from "../components/BuyerCard";

export default function Market({
  t,
  fill,
  cropTitle,
  result,
  openPassport,
  setMessage,
  setPage: _setPage,
  passport,
  coords,
  location: userLocation,
  apiUrl = "http://127.0.0.1:8000",
}) {
  const currentCrop = useMemo(() => {
    return result?.crop || passport?.crop?.crop_type || cropTitle || "Tomato";
  }, [result, passport, cropTitle]);

  // Data states
  const [buyers, setBuyers] = useState([]);
  const [supportedCrops, setSupportedCrops] = useState([]);
  const [farmerPosts, setFarmerPosts] = useState([]);
  const [mandiPrices, setMandiPrices] = useState([]);
  const [mandiAvailable, setMandiAvailable] = useState(true);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCropFilter, setSelectedCropFilter] = useState("");

  // Post My Crop form state
  const [postCrop, setPostCrop] = useState(currentCrop);
  const [postQty, setPostQty] = useState("");
  const [postPrice, setPostPrice] = useState("");
  const [postPhone, setPostPhone] = useState("");
  const [postLocation, setPostLocation] = useState(userLocation || "Bengaluru");
  const [postGrade, setPostGrade] = useState("Grade A");
  const [submittingPost, setSubmittingPost] = useState(false);

  // Add Business modal/collapse state
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [bizForm, setBizForm] = useState({
    name: "",
    buyer_type: "Restaurant",
    phone: "",
    location: userLocation || "Bengaluru",
    website: "",
    whatsapp: "",
    crops: "",
  });
  const [submittingBiz, setSubmittingBiz] = useState(false);

  // Focus post from URL (?post=id)
  const [highlightedPostId, setHighlightedPostId] = useState(null);

  useEffect(() => {
    const paramPost = new URLSearchParams(window.location.search).get("post");
    if (paramPost) {
      setHighlightedPostId(Number(paramPost));
    }
  }, []);

  // Update form default crop when currentCrop changes
  useEffect(() => {
    if (currentCrop) {
      setPostCrop(currentCrop);
    }
  }, [currentCrop]);

  // 1. Fetch supported crops from DB
  useEffect(() => {
    fetch(`${apiUrl}/api/crops/supported`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSupportedCrops(data))
      .catch(() => setSupportedCrops(["Tomato", "Potato", "Pepper", "Bell Pepper (Capsicum)", "Grapes"]));
  }, [apiUrl]);

  // 2. Fetch Buyers dynamically with category, search query, crop, coordinates
  const loadBuyers = useCallback(async () => {
    setLoadingBuyers(true);
    try {
      const params = new URLSearchParams();
      if (selectedCropFilter) {
        params.append("crop", selectedCropFilter);
      } else if (currentCrop) {
        params.append("crop", currentCrop);
      }
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim());
      }
      if (coords?.latitude && coords?.longitude) {
        params.append("lat", coords.latitude);
        params.append("lng", coords.longitude);
      }

      const res = await fetch(`${apiUrl}/api/buyers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBuyers(data);
      } else {
        setBuyers([]);
      }
    } catch {
      setBuyers([]);
    } finally {
      setLoadingBuyers(false);
    }
  }, [apiUrl, selectedCropFilter, currentCrop, selectedCategory, searchQuery, coords]);

  useEffect(() => {
    loadBuyers();
  }, [loadBuyers]);

  // 3. Fetch Mandi prices for current crop
  const loadMandiPrices = useCallback(async () => {
    try {
      const cropQuery = selectedCropFilter || currentCrop || "Tomato";
      const res = await fetch(`${apiUrl}/api/market/prices?crop=${encodeURIComponent(cropQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setMandiPrices(data.prices || []);
        setMandiAvailable(Boolean(data.available && data.prices?.length > 0));
      } else {
        setMandiPrices([]);
        setMandiAvailable(false);
      }
    } catch {
      setMandiPrices([]);
      setMandiAvailable(false);
    }
  }, [apiUrl, selectedCropFilter, currentCrop]);

  useEffect(() => {
    loadMandiPrices();
  }, [loadMandiPrices]);

  // 4. Fetch Farmer Posts from DB
  const loadFarmerPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch(`${apiUrl}/api/farmer/posts`);
      if (res.ok) {
        setFarmerPosts(await res.json());
      } else {
        setFarmerPosts([]);
      }
    } catch {
      setFarmerPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    loadFarmerPosts();
  }, [loadFarmerPosts]);

  // Submit "Post My Crop"
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postPhone || postPhone.replace(/\D/g, "").length < 10) {
      setMessage(t.validPhoneError || (t.farmerPhoneLabel + ": Please enter a valid 10-digit number."));
      return;
    }
    if (!postQty || Number(postQty) <= 0) {
      setMessage(t.positiveQuantityError || (t.quantityKgLabel + " must be greater than 0."));
      return;
    }
    if (!postPrice || Number(postPrice) <= 0) {
      setMessage(t.positivePriceError || (t.expectedPriceLabel + " must be greater than 0."));
      return;
    }

    setSubmittingPost(true);
    try {
      const payload = {
        crop_type: postCrop,
        quantity_kg: Number(postQty),
        price_per_kg: Number(postPrice),
        farmer_phone: postPhone,
        location: postLocation || userLocation || "Bengaluru",
        quality_grade: postGrade,
        health_status: result?.disease ? `${result.disease} (Risk ${result.risk?.score ?? 0}%)` : (passport?.scans?.[0]?.disease || "Field Verified"),
        health_risk_score: result?.risk?.score ?? (passport?.scans?.[0]?.risk_score ?? null),
        passport_id: passport?.crop?.id || result?.crop_id || null,
      };

      const res = await fetch(`${apiUrl}/api/farmer/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to post crop.");

      setMessage(t.postSuccess);
      setPostQty("");
      setPostPrice("");
      loadFarmerPosts();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmittingPost(false);
    }
  };

  // Toggle Sold / Available Status
  const handleTogglePostStatus = async (postId, currentStatus) => {
    const nextStatus = currentStatus === "AVAILABLE" ? "SOLD" : "AVAILABLE";
    try {
      const res = await fetch(`${apiUrl}/api/farmer/posts/${postId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to update status");
      }
      loadFarmerPosts();
    } catch (err) {
      setMessage(err.message);
    }
  };

  // Register Interest ("I'm Interested")
  const handleConnect = async (buyer) => {
    // If farmer has active posts, attach interest to the latest active post
    const targetPost = farmerPosts.find((p) => p.status === "AVAILABLE") || farmerPosts[0];
    if (targetPost) {
      try {
        const payload = {
          buyer_id: buyer.id,
          buyer_name: buyer.name,
          buyer_type: buyer.buyer_type,
          buyer_phone: buyer.phone,
          buyer_whatsapp: buyer.whatsapp,
          message: `Direct interest registered by ${buyer.name} for ${targetPost.crop_type}.`,
        };
        const res = await fetch(`${apiUrl}/api/farmer/posts/${targetPost.id}/interest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setMessage(t.interestSuccess);
          loadFarmerPosts();
          return;
        }
      } catch {
        /* fallback to toast */
      }
    }
    setMessage(fill(t.msgInterest || "Direct connection initiated with {name}.", { name: buyer.name }));
  };

  // Share post link
  const handleSharePost = (post) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setMessage(t.postLinkCopied);
      });
    } else {
      prompt("Copy crop post share link:", shareUrl);
    }
  };

  // Send on WhatsApp
  const handleSendOnWhatsApp = (post) => {
    const text = fill(t.whatsappTemplate || "Hello, I have {quantity} kg of {crop} available at expected price ₹{price}/kg from {location}. Please contact me if interested.", {
      crop: t.crops?.[post.crop_type] || post.crop_type,
      quantity: post.quantity_kg,
      price: post.price_per_kg,
      location: post.location,
    });
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  // Submit "+ Add Business"
  const handleAddBusinessSubmit = async (e) => {
    e.preventDefault();
    if (!bizForm.name.trim()) {
      setMessage(t.businessNameRequired || (t.businessNameLabel + " is required."));
      return;
    }
    if (!bizForm.phone || bizForm.phone.replace(/\D/g, "").length < 7) {
      setMessage(t.validPhoneError || (t.phoneLabel + ": Please provide a valid phone number."));
      return;
    }

    setSubmittingBiz(true);
    try {
      const payload = {
        name: bizForm.name.trim(),
        buyer_type: bizForm.buyer_type,
        location: bizForm.location.trim() || userLocation || "Bengaluru",
        phone: bizForm.phone.trim(),
        whatsapp: bizForm.whatsapp.trim(),
        website: bizForm.website.trim(),
        crops: bizForm.crops ? bizForm.crops.split(",").map((s) => s.trim()).filter(Boolean) : [currentCrop],
        interest: "Direct farmer procurement",
      };

      const res = await fetch(`${apiUrl}/api/buyers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit business.");

      setMessage(t.addBusinessSuccess);
      setShowAddBusiness(false);
      setBizForm({
        name: "",
        buyer_type: "Restaurant",
        phone: "",
        location: userLocation || "Bengaluru",
        website: "",
        whatsapp: "",
        crops: "",
      });
      loadBuyers();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmittingBiz(false);
    }
  };

  const isHealthy = Boolean(
    result?.disease?.toLowerCase().includes("healthy") ||
    passport?.scans?.[0]?.disease?.toLowerCase().includes("healthy")
  );

  return (
    <section className="page-section marketplace-experience">
      {/* Header Banner */}
      <div className="page-head-banner">
        <div className="eyebrow">{t.marketEyebrow}</div>
        <h1>{t.marketAccess}</h1>
        <p>{t.marketDesc}</p>
      </div>

      {/* Categories & Search Filter Bar */}
      <div
        className="market-controls-bar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          background: "var(--surface-glass)",
          padding: "12px 18px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--line-glass)",
        }}
      >
        {/* Category Pills */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {[
            { id: "all", label: t.allCategories },
            { id: "Restaurant", label: t.restaurant },
            { id: "Cloud Kitchen", label: t.cloudKitchen },
            { id: "Wholesale Buyer", label: t.wholesaleBuyer },
            { id: "Market", label: t.marketBuyer },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`btn-sm ${selectedCategory === cat.id ? "btn-primary" : "btn-outline"}`}
              style={{ borderRadius: "var(--radius-full)" }}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flex: "1 1 300px", justifyContent: "flex-end" }}>
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              background: "rgba(18, 38, 26, 0.85)",
              color: "#fff",
              border: "1px solid var(--line-glass)",
              fontSize: "12.5px",
              flex: "1 1 200px",
              maxWidth: "280px",
            }}
          />

          <select
            value={selectedCropFilter}
            onChange={(e) => setSelectedCropFilter(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-md)",
              background: "rgba(18, 38, 26, 0.85)",
              color: "#fff",
              border: "1px solid var(--line-glass)",
              fontSize: "12.5px",
            }}
          >
            <option value="">{t.allCrops}</option>
            {supportedCrops.map((c) => (
              <option key={c} value={c}>
                {t.crops?.[c] || c}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-outline btn-sm"
            onClick={() => setShowAddBusiness(!showAddBusiness)}
            style={{ borderColor: "var(--line-emerald)", color: "#6ee7b7" }}
          >
            {t.addBusiness}
          </button>
        </div>
      </div>

      {/* Add Business Modal/Collapse */}
      {showAddBusiness && (
        <div
          className="panel"
          style={{
            marginBottom: "24px",
            background: "rgba(15, 31, 22, 0.95)",
            border: "1px solid var(--line-emerald)",
            borderRadius: "var(--radius-lg)",
            padding: "20px 24px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
            <div>
              <h3 style={{ margin: 0, color: "var(--ink-primary)", fontSize: "17px", fontWeight: "800" }}>
                {t.addBusinessTitle}
              </h3>
              <p style={{ margin: "4px 0 0", color: "var(--ink-secondary)", fontSize: "12.5px" }}>
                {t.addBusinessSubtitle}
              </p>
            </div>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setShowAddBusiness(false)}
            >
              ✕ {t.cancel}
            </button>
          </div>

          <form onSubmit={handleAddBusinessSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              {t.businessNameLabel} *
              <input
                type="text"
                required
                value={bizForm.name}
                onChange={(e) => setBizForm({ ...bizForm, name: e.target.value })}
                placeholder="e.g. GreenPlate Kitchen"
                style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              {t.businessTypeLabel} *
              <select
                value={bizForm.buyer_type}
                onChange={(e) => setBizForm({ ...bizForm, buyer_type: e.target.value })}
                style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff" }}
              >
                <option value="Restaurant">{t.restaurant}</option>
                <option value="Cloud Kitchen">{t.cloudKitchen}</option>
                <option value="Wholesale Buyer">{t.wholesaleBuyer}</option>
                <option value="Market">{t.marketBuyer}</option>
                <option value="Local Trader">{t.localTrader}</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              {t.phoneLabel} *
              <input
                type="tel"
                required
                value={bizForm.phone}
                onChange={(e) => setBizForm({ ...bizForm, phone: e.target.value })}
                placeholder="e.g. 080-26572832 / 9845012345"
                style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              {t.cityLabel} *
              <input
                type="text"
                required
                value={bizForm.location}
                onChange={(e) => setBizForm({ ...bizForm, location: e.target.value })}
                placeholder="e.g. Basavanagudi, Bengaluru"
                style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              {t.websiteLabel}
              <input
                type="url"
                value={bizForm.website}
                onChange={(e) => setBizForm({ ...bizForm, website: e.target.value })}
                placeholder="https://example.com"
                style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              {t.whatsappLabel}
              <input
                type="tel"
                value={bizForm.whatsapp}
                onChange={(e) => setBizForm({ ...bizForm, whatsapp: e.target.value })}
                placeholder="e.g. 9845012345"
                style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff" }}
              />
            </label>

            <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              {t.cropsHandledLabel}
              <input
                type="text"
                value={bizForm.crops}
                onChange={(e) => setBizForm({ ...bizForm, crops: e.target.value })}
                placeholder="e.g. Tomato, Potato, Pepper, Grapes"
                style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff" }}
              />
            </label>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
              <button type="submit" className="btn-primary" disabled={submittingBiz}>
                {submittingBiz ? t.submitting : `✓ ${t.submitBusiness}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="market-split-layout">
        {/* Left Column: Produce Lot, Post My Crop, Live Mandi Prices */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Produce Lot Card */}
          <div className="market-produce-card">
            <div className="market-manifest-header">
              <span className="tag-pill">✓ {t.verifiedReady}</span>
              <span className="lot-number-tag">{t.marketProduceLot}</span>
            </div>

            <h2>{fill(t.marketCropLot, { crop: t.crops?.[currentCrop] || currentCrop })}</h2>
            <p>{t.marketNote}</p>

            <div className="market-quality-grid">
              <div className="market-stat-box">
                <span>{t.healthStatus}</span>
                <b className={isHealthy ? "text-emerald" : "text-amber"}>
                  {result?.disease ? (t.diseases?.[result.disease] || result.disease) : (passport?.scans?.[0]?.disease || t.awaitingScan)}
                </b>
              </div>
              <div className="market-stat-box">
                <span>{t.stepRisk}</span>
                <b>
                  {result ? `${result.risk?.score ?? 0}%` : (passport?.scans?.[0]?.risk_score != null ? `${passport.scans[0].risk_score}%` : "—")}
                </b>
              </div>
            </div>

            <div className="manifest-trust-callout">
              <span>{t.marketTrustCallout}</span>
            </div>

            <button
              type="button"
              className="btn-outline btn-full manifest-passport-btn"
              onClick={openPassport}
            >
              📔 {t.viewPassport}
            </button>
          </div>

          {/* Post My Crop Form Card */}
          <div className="panel" style={{ background: "var(--surface-glass)", border: "1px solid var(--line-glass)", borderRadius: "var(--radius-xl)", padding: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div className="eyebrow" style={{ color: "#6ee7b7" }}>{t.postMyCrop}</div>
              <h3 style={{ margin: "4px 0 2px", fontSize: "19px", fontWeight: "850", color: "var(--ink-primary)" }}>
                {t.postCropTitle}
              </h3>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--ink-secondary)" }}>
                {t.postCropSubtitle}
              </p>
            </div>

            <form onSubmit={handleCreatePost} style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
                  {t.cropLabel} *
                  <select
                    value={postCrop}
                    onChange={(e) => setPostCrop(e.target.value)}
                    style={{ padding: "9px 11px", borderRadius: "8px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff", fontSize: "13px" }}
                  >
                    {supportedCrops.map((c) => (
                      <option key={c} value={c}>{t.crops?.[c] || c}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
                  {t.quantityKgLabel} *
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="e.g. 250"
                    value={postQty}
                    onChange={(e) => setPostQty(e.target.value)}
                    style={{ padding: "9px 11px", borderRadius: "8px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff", fontSize: "13px" }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
                  {t.expectedPriceLabel} *
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    placeholder="e.g. 42"
                    value={postPrice}
                    onChange={(e) => setPostPrice(e.target.value)}
                    style={{ padding: "9px 11px", borderRadius: "8px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff", fontSize: "13px" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
                  {t.qualityGradeLabel}
                  <select
                    value={postGrade}
                    onChange={(e) => setPostGrade(e.target.value)}
                    style={{ padding: "9px 11px", borderRadius: "8px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff", fontSize: "13px" }}
                  >
                    <option value="Grade A">{t.gradeA || "Grade A (Premium Retail)"}</option>
                    <option value="Grade B">{t.gradeB || "Grade B (Standard Market)"}</option>
                    <option value="Grade C">{t.gradeC || "Grade C (Processing)"}</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
                  {t.farmerPhoneLabel} *
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9845012345"
                    value={postPhone}
                    onChange={(e) => setPostPhone(e.target.value)}
                    style={{ padding: "9px 11px", borderRadius: "8px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff", fontSize: "13px" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11.5px", color: "var(--ink-muted)" }}>
                  {t.locationLabel} *
                  <input
                    type="text"
                    required
                    value={postLocation}
                    onChange={(e) => setPostLocation(e.target.value)}
                    placeholder="e.g. Kolar, Bengaluru Rural"
                    style={{ padding: "9px 11px", borderRadius: "8px", background: "rgba(18,38,26,0.9)", border: "1px solid var(--line-glass)", color: "#fff", fontSize: "13px" }}
                  />
                </label>
              </div>

              {/* Health Passport Verified Badge indicator */}
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.12)",
                  border: "1px solid var(--line-emerald)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>🪪</span>
                  <div>
                    <b style={{ color: "#6ee7b7", display: "block" }}>{t.healthPassportBadgeLabel}</b>
                    <span style={{ color: "var(--ink-secondary)", fontSize: "11px" }}>
                      {passport?.crop?.id ? fill(t.linkedPassport, { id: passport.crop.id }) : (result?.disease || "Field Diagnostics")}
                    </span>
                  </div>
                </div>
                <span className="tag-pill">✓ {result?.disease || (passport?.scans?.[0]?.disease ? (t.diseases?.[passport.scans[0].disease] || passport.scans[0].disease) : "Healthy")}</span>
              </div>

              <button
                type="submit"
                className="btn-primary btn-full"
                disabled={submittingPost}
                style={{ marginTop: "4px", padding: "12px" }}
              >
                <span>{submittingPost ? t.publishing : `🌾 ${t.submitPost}`}</span>
              </button>
            </form>
          </div>

          {/* Real Mandi Prices Card */}
          <div className="panel" style={{ background: "var(--surface-glass)", border: "1px solid var(--line-glass)", borderRadius: "var(--radius-xl)", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "850", color: "var(--ink-primary)" }}>
                  📊 {t.mandiPrices}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--ink-muted)" }}>
                  {t.mandiSubtitle}
                </p>
              </div>
              <span className="tag-pill" style={{ fontSize: "9.5px" }}>Agmarknet / KSAMB</span>
            </div>

            {mandiAvailable && mandiPrices.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {mandiPrices.slice(0, 3).map((mp) => (
                  <div
                    key={mp.id}
                    style={{
                      background: "rgba(18, 38, 26, 0.8)",
                      border: "1px solid var(--line-glass)",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <b style={{ color: "#fff", fontSize: "14px" }}>
                        {t.crops?.[mp.crop] || mp.crop} — {mp.market}
                      </b>
                      <span style={{ fontSize: "16px", fontWeight: "850", color: "#34d399" }}>
                        ₹{mp.modal_price} <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>/ {mp.unit}</span>
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ink-muted)", marginTop: "6px" }}>
                      <span>{t.mandiRange}: ₹{mp.min_price} – ₹{mp.max_price}</span>
                      <span>📅 {mp.date}</span>
                    </div>

                    <div style={{ fontSize: "10px", color: "rgba(110, 231, 183, 0.8)", marginTop: "4px" }}>
                      ✓ {mp.source}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "14px", textAlign: "center", color: "var(--ink-muted)", fontSize: "12px" }}>
                ⚠️ {fill(t.mandiPriceUnavailable, { crop: t.crops?.[currentCrop] || currentCrop })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Crop Posts & Verified Buyer Directory */}
        <div className="market-buyers-column">
          {/* Active Farmer Crop Posts Section */}
          <div style={{ marginBottom: "26px" }}>
            <div className="buyers-column-header">
              <div>
                <h3>🌾 {t.activeCropPosts}</h3>
                <p className="buyers-subtitle">{t.postCropSubtitle}</p>
              </div>
              <span className="buyers-count-chip">
                {fill(t.postsCount || "{count} Lots", { count: farmerPosts.length })}
              </span>
            </div>

            {loadingPosts ? (
              <div style={{ padding: "16px", color: "var(--ink-muted)", fontSize: "13px" }}>
                {t.loadingPosts}
              </div>
            ) : farmerPosts.length === 0 ? (
              <div className="empty-placeholder-view" style={{ padding: "20px 16px" }}>
                <div className="empty-view-icon" aria-hidden="true">🌱</div>
                <h4>{t.noPostsTitle}</h4>
                <p>{t.noPostsDesc}</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {farmerPosts.map((post) => {
                  const isSold = post.status === "SOLD";
                  const isHighlighted = highlightedPostId === post.id;

                  return (
                    <div
                      key={post.id}
                      className="panel"
                      style={{
                        background: isHighlighted ? "rgba(16, 185, 129, 0.15)" : "var(--canvas-card)",
                        border: isHighlighted ? "1.5px solid var(--line-emerald)" : "1px solid var(--line-glass)",
                        borderRadius: "var(--radius-lg)",
                        padding: "16px 18px",
                        transition: "all var(--tr-fast)",
                      }}
                    >
                      {/* Top status bar */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "20px" }}>
                            {post.crop_type === "Tomato"
                              ? "🍅"
                              : post.crop_type === "Potato"
                              ? "🥔"
                              : post.crop_type === "Pepper" || post.crop_type?.includes("Capsicum")
                              ? "🫑"
                              : post.crop_type === "Grape" || post.crop_type === "Grapes"
                              ? "🍇"
                              : "🌾"}
                          </span>
                          <div>
                            <b style={{ fontSize: "16px", color: "#fff" }}>
                              {post.quantity_kg} kg · {t.crops?.[post.crop_type] || post.crop_type}
                            </b>
                            <span style={{ display: "block", fontSize: "11px", color: "var(--ink-muted)" }}>
                              📍 {post.location} · {post.quality_grade}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            className="status-pill"
                            style={{
                              background: isSold ? "rgba(244,63,94,0.2)" : "rgba(16,185,129,0.2)",
                              color: isSold ? "#f87171" : "#6ee7b7",
                              border: `1px solid ${isSold ? "rgba(244,63,94,0.4)" : "var(--line-emerald)"}`,
                              fontWeight: "800",
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "var(--radius-full)",
                            }}
                          >
                            {isSold ? t.statusSoldBadge : t.statusAvailable}
                          </span>

                          <span style={{ fontSize: "16px", fontWeight: "850", color: "#34d399" }}>
                            ₹{post.price_per_kg} <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>/ kg</span>
                          </span>
                        </div>
                      </div>

                      {/* Health Passport status pill on post */}
                      {post.health_status && (
                        <div style={{ margin: "10px 0 6px", fontSize: "11px", color: "#6ee7b7", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>🪪</span>
                          <span>{post.health_status}</span>
                          {post.matched_buyers_count > 0 && (
                            <span style={{ color: "var(--ink-secondary)", marginLeft: "auto" }}>
                              🎯 {fill(t.matchesBuyersCount || "{count} matching buyers", { count: post.matched_buyers_count })}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action buttons: Toggle Available/Sold, Share link, Send WhatsApp */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--line-glass)" }}>
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => handleTogglePostStatus(post.id, post.status)}
                          style={{
                            borderColor: isSold ? "var(--line-emerald)" : "rgba(244,63,94,0.4)",
                            color: isSold ? "#6ee7b7" : "#f87171",
                          }}
                        >
                          {isSold ? `✓ ${t.markAvailable}` : `🏷️ ${t.statusSold}`}
                        </button>

                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => handleSharePost(post)}
                          title="Copy direct link to this post"
                        >
                          🔗 {t.sharePost}
                        </button>

                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => handleSendOnWhatsApp(post)}
                          style={{ borderColor: "rgba(34, 197, 94, 0.4)", color: "#4ade80" }}
                        >
                          💬 {t.sendWhatsApp}
                        </button>
                      </div>

                      {/* Direct Interested Buyers Accordion/List */}
                      {post.interests && post.interests.length > 0 && (
                        <div style={{ marginTop: "12px", background: "rgba(18, 38, 26, 0.7)", borderRadius: "8px", padding: "10px 12px" }}>
                          <b style={{ fontSize: "12px", color: "#6ee7b7", display: "block", marginBottom: "6px" }}>
                            🤝 {fill(t.interestedBuyersCount, { count: post.interests.length })}
                          </b>

                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {post.interests.map((it) => (
                              <div
                                key={it.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  padding: "6px 0",
                                  borderBottom: "1px dashed rgba(255,255,255,0.08)",
                                  fontSize: "12px",
                                }}
                              >
                                <div>
                                  <b style={{ color: "#fff" }}>{it.buyer_name}</b>
                                  <span style={{ display: "block", fontSize: "11px", color: "var(--ink-muted)" }}>
                                    {it.buyer_type} · {fill(t.buyerContact, { phone: it.buyer_phone })}
                                  </span>
                                </div>

                                <div style={{ display: "flex", gap: "6px" }}>
                                  {it.buyer_phone && (
                                    <a
                                      href={`tel:${it.buyer_phone}`}
                                      className="btn-outline btn-sm"
                                      style={{ textDecoration: "none", padding: "3px 8px", fontSize: "11px" }}
                                    >
                                      📞 {t.call}
                                    </a>
                                  )}

                                  {it.buyer_whatsapp && (
                                    <a
                                      href={`https://wa.me/${it.buyer_whatsapp.replace(/[^0-9]/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="btn-outline btn-sm"
                                      style={{ textDecoration: "none", padding: "3px 8px", fontSize: "11px", borderColor: "#22c55e", color: "#4ade80" }}
                                    >
                                      💬 {t.whatsapp}
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verified Commercial Buyer Directory */}
          <div>
            <div className="buyers-column-header">
              <div>
                <h3>🤝 {t.buyerDirectory}</h3>
                <p className="buyers-subtitle">{t.buyerDirSubtitle}</p>
              </div>
              <span className="buyers-count-chip">
                {buyers.length} {t.allCategories}
              </span>
            </div>

            {loadingBuyers ? (
              <div style={{ padding: "20px", color: "var(--ink-muted)", fontSize: "13px" }}>
                {t.loadingBuyers}
              </div>
            ) : (
              <div className="buyer-cards-stack">
                {buyers.length > 0 ? (
                  buyers.map((buyer, idx) => (
                    <BuyerCard
                      key={buyer.id || buyer.name}
                      buyer={buyer}
                      currentCrop={selectedCropFilter || currentCrop}
                      onConnect={handleConnect}
                      t={t}
                      fill={fill}
                      index={idx}
                    />
                  ))
                ) : (
                  <div className="empty-placeholder-view">
                    <div className="empty-view-icon" aria-hidden="true">🛒</div>
                    <h2>{t.noBuyersFoundTitle}</h2>
                    <p>{t.noBuyersFoundText}</p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setSelectedCategory("all");
                        setSelectedCropFilter("");
                        setSearchQuery("");
                      }}
                    >
                      {t.resetFilters || t.allCategories}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
