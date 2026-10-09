import { useState, useEffect, useCallback } from "react";

export default function BuyerDashboard({
  apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  setMessage,
  onOpenDealRoom,
  t = {},
  fill = (str, vars) => (str || "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""),
}) {
  const [buyers, setBuyers] = useState([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [matchingListings, setMatchingListings] = useState([]);
  const [offers, setOffers] = useState([]);
  const [deals, setDeals] = useState([]);

  // Form for creating a new request
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqForm, setReqForm] = useState({
    crop_type: "Tomato",
    quantity: 100,
    price_min: 20,
    price_max: 35,
    min_grade: "A",
    location: "Bengaluru Procurement Center"
  });

  // Form for making an offer
  const [offerFormListing, setOfferFormListing] = useState(null);
  const [offerQty, setOfferQty] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [parentOfferId, setParentOfferId] = useState(null);
  const [submittingOffer, setSubmittingOffer] = useState(false);

  // Load buyers on mount
  useEffect(() => {
    fetch(`${apiUrl}/api/buyers`)
      .then((res) => res.json())
      .then((data) => {
        setBuyers(data);
        if (data && data.length > 0) {
          setSelectedBuyerId(data[0].id);
        }
      })
      .catch(() => {});
  }, [apiUrl]);

  // Load buyer requests & offers when selected buyer changes or refreshed
  const loadBuyerData = useCallback(async () => {
    try {
      const resReq = await fetch(`${apiUrl}/api/buyers/requests?status=OPEN`);
      if (resReq.ok) {
        const reqData = await resReq.json();
        // filter for current buyer if buyer selected
        const filteredReqs = selectedBuyerId
          ? reqData.filter((r) => r.buyer_id === Number(selectedBuyerId))
          : reqData;
        setRequests(filteredReqs);

        if (filteredReqs.length > 0 && !selectedRequestId) {
          setSelectedRequestId(filteredReqs[0].id);
        }
      }

      const resOffers = await fetch(`${apiUrl}/api/offers`);
      if (resOffers.ok) {
        setOffers(await resOffers.json());
      }

      const resDeals = await fetch(`${apiUrl}/api/deals`);
      if (resDeals.ok) {
        setDeals(await resDeals.json());
      }
    } catch (e) {
      console.error(e);
    }
  }, [apiUrl, selectedBuyerId, selectedRequestId]);

  useEffect(() => {
    loadBuyerData();
  }, [loadBuyerData]);

  // Fetch matching listings when selected request changes
  useEffect(() => {
    if (!selectedRequestId) {
      setMatchingListings([]);
      return;
    }

    fetch(`${apiUrl}/api/buyers/requests/${selectedRequestId}/match`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Could not load matching listings.");
        if (Array.isArray(data)) {
          setMatchingListings(data);
          return;
        }
        if (Array.isArray(data?.allocations)) {
          setMatchingListings(data.allocations.map((allocation) => ({
            id: allocation.listing_id,
            crop_type: data.crop_type,
            quantity_remaining: allocation.allocated_quantity,
            quality_grade: allocation.quality_grade,
            price_per_kg: allocation.price_per_kg,
          })));
          return;
        }
        throw new Error("Matching listings response has an unexpected format.");
      })
      .catch((error) => {
        console.error("Could not load matching listings.", error);
        setMatchingListings([]);
        const errMsg = t.couldNotLoadMatches || "Could not load matching listings";
        setMessage(`${errMsg}: ${error.message}`);
      });
  }, [apiUrl, selectedRequestId, setMessage, t.couldNotLoadMatches]);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!selectedBuyerId) {
      setMessage("Please select a buyer profile first.");
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/api/buyers/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_id: Number(selectedBuyerId),
          ...reqForm,
          quantity: Number(reqForm.quantity),
          price_min: Number(reqForm.price_min),
          price_max: Number(reqForm.price_max)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create request");
      setMessage(fill(t.requestCreatedSuccess || "Procurement request #{id} created!", { id: data.id }));
      setShowReqForm(false);
      loadBuyerData();
    } catch (err) {
      setMessage(fill(t.failedToCreateRequest || "Failed to create request: {error}", { error: err.message }));
    }
  };

  const handleOpenOfferForm = (listing, parentId = null) => {
    setOfferFormListing(listing);
    setParentOfferId(parentId);
    setOfferQty(listing.quantity_remaining || listing.quantity || 50);
    setOfferPrice(listing.price_per_kg || 25);
  };

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (!selectedRequestId || !offerFormListing) return;
    setSubmittingOffer(true);
    try {
      const payload = {
        buyer_request_id: Number(selectedRequestId),
        listing_id: offerFormListing.id,
        quantity: Number(offerQty),
        price_per_kg: Number(offerPrice),
        parent_offer_id: parentOfferId ? Number(parentOfferId) : null
      };

      const res = await fetch(`${apiUrl}/api/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit offer");

      setMessage(fill(t.offerSuccess || "Offer #{id} submitted successfully!", { id: data.id }));
      setOfferFormListing(null);
      setParentOfferId(null);
      loadBuyerData();
    } catch (err) {
      setMessage(fill(t.failedToSubmitOffer || "Failed to submit offer: {error}", { error: err.message }));
    } finally {
      setSubmittingOffer(false);
    }
  };

  const handleUpdateOfferStatus = async (offerId, status) => {
    try {
      const res = await fetch(`${apiUrl}/api/offers/${offerId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to update offer");

      const statusKey = `status${status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}`;
      const statusLabel = t[statusKey] || status;
      setMessage(fill(t.offerStatusUpdated || "Offer #{id} status updated to {status}", { id: offerId, status: statusLabel }));
      loadBuyerData();
    } catch (err) {
      setMessage(fill(t.failedToUpdateOffer || "Failed to update offer: {error}", { error: err.message }));
    }
  };

  const selectedRequest = requests.find((r) => r.id === selectedRequestId);
  const currentBuyer = buyers.find((b) => b.id === Number(selectedBuyerId));

  // Find deal associated with an offer
  const getDealForOffer = (offerId) => deals.find((d) => d.offer_id === offerId);

  return (
    <section className="page-section">
      <div className="page-title">
        <div>
          <div className="eyebrow">{t.buyerHubEyebrow || "BUYER PORTAL · PROCUREMENT"}</div>
          <h1>{t.buyerHubTitle || "Commercial Buyer Hub"}</h1>
          <p>{t.buyerHubDesc || "Post demand requests, view matching verified produce, negotiate offers, and jump into Deal Rooms."}</p>
        </div>
      </div>

      {/* Buyer Switcher & New Request Action Bar */}
      <div className="panel" style={{ marginBottom: "20px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "260px" }}>
          <span style={{ fontSize: "18px" }}>🏢</span>
          <div>
            <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontWeight: "bold" }}>
              {t.currentBuyerProfile || "CURRENT BUYER PROFILE"}
            </div>
            <select
              value={selectedBuyerId}
              onChange={(e) => {
                setSelectedBuyerId(e.target.value);
                setSelectedRequestId(null);
              }}
              style={{
                background: "var(--canvas-surface)",
                color: "var(--ink-primary)",
                border: "1px solid var(--line-glass-highlight)",
                padding: "8px 12px",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "14px",
                width: "100%",
                marginTop: "4px"
              }}
            >
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {t.buyers?.[b.name] || b.name} ({t.locations?.[b.location] || b.location}) — {fill(t.minGradeLabel || "Min Grade {grade}", { grade: b.min_grade })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowReqForm(!showReqForm)}
          style={{ whiteSpace: "nowrap" }}
        >
          {showReqForm ? (t.closeForm || "Close Form") : (t.postNewDemand || "➕ Post New Demand Request")}
        </button>
      </div>

      {/* Form to Post New Demand Request */}
      {showReqForm && (
        <div className="panel" style={{ marginBottom: "24px", border: "1px solid var(--emerald-primary)" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "var(--emerald-light)" }}>
            {t.postProcurementTitle || "Post Procurement Request"}
          </h3>
          <form onSubmit={handleCreateRequest} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.cropLabel || "Crop Type"}</label>
              <select
                value={reqForm.crop_type}
                onChange={(e) => setReqForm({ ...reqForm, crop_type: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "var(--canvas-card)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
              >
                <option value="Tomato">{t.crops?.Tomato || "Tomato"}</option>
                <option value="Potato">{t.crops?.Potato || "Potato"}</option>
                <option value="Pepper">{t.crops?.Pepper || "Pepper"}</option>
                <option value="Bell Pepper (Capsicum)">{t.crops?.["Bell Pepper (Capsicum)"] || "Bell Pepper (Capsicum)"}</option>
                <option value="Grapes">{t.crops?.Grapes || "Grapes"}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.requiredQuantity || "Required Quantity (kg)"}</label>
              <input
                type="number"
                value={reqForm.quantity}
                onChange={(e) => setReqForm({ ...reqForm, quantity: e.target.value })}
                required
                min="1"
                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "var(--canvas-card)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.minPriceLabel || "Min Price (₹/kg)"}</label>
              <input
                type="number"
                value={reqForm.price_min}
                onChange={(e) => setReqForm({ ...reqForm, price_min: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "var(--canvas-card)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.maxPriceLabel || "Max Price (₹/kg)"}</label>
              <input
                type="number"
                value={reqForm.price_max}
                onChange={(e) => setReqForm({ ...reqForm, price_max: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "var(--canvas-card)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.minQualityGrade || "Min Quality Grade"}</label>
              <select
                value={reqForm.min_grade}
                onChange={(e) => setReqForm({ ...reqForm, min_grade: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "var(--canvas-card)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
              >
                <option value="A">{t.gradeA || "Grade A (Premium Retail)"}</option>
                <option value="B">{t.gradeB || "Grade B (Standard Market)"}</option>
                <option value="C">{t.gradeC || "Grade C (Processing)"}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.deliveryLocation || "Delivery Location"}</label>
              <input
                type="text"
                value={reqForm.location}
                onChange={(e) => setReqForm({ ...reqForm, location: e.target.value })}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "var(--canvas-card)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
              <button type="submit" className="btn-primary">{t.submitRequest || "Submit Request"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Grid: Left Requests & Matching, Right Offers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        
        {/* LEFT COLUMN: Active Requests & Matches */}
        <div>
          <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
            {t.activeProcurementRequests || "📦 Active Procurement Requests"}
          </h3>
          {requests.length === 0 ? (
            <div className="panel empty-state">
              <div>📋</div>
              <h3>{t.noActiveRequests || "No active requests"}</h3>
              <p>{t.noActiveRequestsDesc || "Post a request to start matching with farmers."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {requests.map((r) => {
                const isSelected = r.id === selectedRequestId;
                const statusKey = `status${r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase()}`;
                return (
                  <div
                    key={r.id}
                    className="panel"
                    onClick={() => setSelectedRequestId(r.id)}
                    style={{
                      cursor: "pointer",
                      border: isSelected ? "2px solid var(--emerald-primary)" : "1px solid var(--line-glass)",
                      background: isSelected ? "rgba(16, 185, 129, 0.08)" : "var(--canvas-card)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", fontSize: "16px" }}>
                        {fill(t.requestItemTitle || "{crop} Request #{id}", { crop: t.crops?.[r.crop_type] || r.crop_type, id: r.id })}
                      </span>
                      <span className={`status-pill status-${r.status.toLowerCase()}`}>
                        {t[statusKey] || r.status}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--ink-secondary)", marginTop: "6px" }}>
                      {fill(t.requestQtyGrade || "Qty: {qty} kg · Min Grade: {grade}", { qty: r.quantity, grade: r.min_grade })}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--ink-muted)", marginTop: "4px" }}>
                      {fill(t.targetPriceRange || "Target Price: ₹{min} – ₹{max} / kg", { min: r.price_min || 0, max: r.price_max || "Any" })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Matching Farmer Listings */}
          <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
            {t.matchingProduceHeader || "🤝 Matching Market Produce"} {selectedRequest ? fill(t.forRequestSuffix || "for {crop} Request #{id}", { crop: t.crops?.[selectedRequest.crop_type] || selectedRequest.crop_type, id: selectedRequest.id }) : ""}
          </h3>
          {matchingListings.length === 0 ? (
            <div className="panel empty-state" style={{ minHeight: "140px" }}>
              <div>🌾</div>
              <h4>{t.noMatchingListings || "No matching listings found"}</h4>
              <p>{t.noMatchingListingsDesc || "No verified farmer listings currently match this request criteria."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {matchingListings.map((m) => (
                <div key={m.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold" }}>
                      {fill(t.listingItemTitle || "🌾 Listing #{id} — {crop}", { id: m.id, crop: t.crops?.[m.crop_type] || m.crop_type })}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--ink-secondary)", marginTop: "4px" }}>
                      {fill(t.availableQtyGrade || "Available: {qty} kg · Grade: {grade}", { qty: m.quantity_remaining ?? m.quantity, grade: m.quality_grade || "A" })}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--emerald-light)", marginTop: "2px" }}>
                      {fill(t.priceBenchmark || "Price Benchmark: ₹{price} / kg", { price: m.price_per_kg || 25 })}
                    </div>
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handleOpenOfferForm(m)}
                  >
                    {t.makeOffer || "Make Offer"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Buyer Offers & Deal Room Shortcuts */}
        <div>
          <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
            {t.sentOffersHeader || "📝 Sent Offers & Negotiations"}
          </h3>
          {offers.filter((o) => selectedRequestId ? o.buyer_request_id === selectedRequestId : true).length === 0 ? (
            <div className="panel empty-state">
              <div>📜</div>
              <h3>{t.noOffersSent || "No offers sent yet"}</h3>
              <p>{t.noOffersSentDesc || "Select a matching listing and click 'Make Offer' to begin negotiation."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {offers
                .filter((o) => selectedRequestId ? o.buyer_request_id === selectedRequestId : true)
                .map((off) => {
                  const associatedDeal = getDealForOffer(off.id);
                  const statusKey = `status${off.status.charAt(0).toUpperCase() + off.status.slice(1).toLowerCase()}`;
                  return (
                    <div key={off.id} className="panel" style={{ border: "1px solid var(--line-glass-highlight)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <b style={{ fontSize: "15px" }}>
                            {fill(t.offerItemTitle || "Offer #{id}", { id: off.id })}
                          </b>
                          <span style={{ fontSize: "12px", color: "var(--ink-muted)", marginLeft: "8px" }}>
                            {fill(t.forListingTag || "(Listing #{id})", { id: off.listing_id })}
                          </span>
                        </div>
                        <span className={`status-pill status-${off.status.toLowerCase()}`}>
                          {t[statusKey] || off.status}
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", margin: "12px 0", fontSize: "13px" }}>
                        <div>
                          <span style={{ color: "var(--ink-muted)", fontSize: "11px", display: "block" }}>{t.quantityHeader || "QUANTITY"}</span>
                          <b>{off.quantity} kg</b>
                        </div>
                        <div>
                          <span style={{ color: "var(--ink-muted)", fontSize: "11px", display: "block" }}>{t.pricePerKgHeader || "PRICE/KG"}</span>
                          <b>₹{off.price_per_kg}</b>
                        </div>
                        <div>
                          <span style={{ color: "var(--ink-muted)", fontSize: "11px", display: "block" }}>{t.totalValueHeader || "TOTAL VALUE"}</span>
                          <b style={{ color: "var(--emerald-light)" }}>₹{(off.quantity * off.price_per_kg).toLocaleString()}</b>
                        </div>
                      </div>

                      {/* Offer Action Buttons */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                        {off.status === "COUNTERED" && (
                          <>
                            <button
                              className="btn-primary btn-sm"
                              onClick={() => handleUpdateOfferStatus(off.id, "ACCEPTED")}
                            >
                              {t.acceptCounter || "✓ Accept Counter"}
                            </button>
                            <button
                              className="btn-outline btn-sm"
                              onClick={() => handleUpdateOfferStatus(off.id, "REJECTED")}
                            >
                              {t.rejectCounter || "✕ Reject Counter"}
                            </button>
                          </>
                        )}

                        {(off.status === "ACCEPTED" || associatedDeal) && (
                          <button
                            className="btn-primary btn-sm"
                            style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                            onClick={() => onOpenDealRoom(associatedDeal ? associatedDeal.id : null)}
                          >
                            {t.openDealRoomBtn || "🤝 Open Deal Room"} {associatedDeal ? `#${associatedDeal.id}` : ""}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Offer Modal / Dialog */}
      {offerFormListing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px"
          }}
        >
          <div className="panel" style={{ width: "100%", maxWidth: "440px", border: "1px solid var(--emerald-primary)" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "var(--emerald-light)" }}>
              {parentOfferId
                ? fill(t.counterOfferTitle || "Counter Offer for #{id}", { id: parentOfferId })
                : fill(t.createOfferTitle || "Create Offer for Listing #{id}", { id: offerFormListing.id })}
            </h3>
            <p style={{ fontSize: "12px", color: "var(--ink-muted)", marginBottom: "16px" }}>
              {fill(t.produceGradeSummary || "Produce: {crop} · Grade {grade}", {
                crop: t.crops?.[offerFormListing.crop_type] || offerFormListing.crop_type,
                grade: offerFormListing.quality_grade || "A"
              })}
            </p>

            <form onSubmit={handleSubmitOffer} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.quantityKgLabel || "Quantity (kg)"}</label>
                <input
                  type="number"
                  value={offerQty}
                  onChange={(e) => setOfferQty(e.target.value)}
                  required
                  min="1"
                  max={offerFormListing.quantity_remaining || offerFormListing.quantity}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--canvas-surface)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "var(--ink-muted)" }}>{t.offeredPriceLabel || "Offered Price (₹/kg)"}</label>
                <input
                  type="number"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  required
                  step="0.5"
                  min="1"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "var(--canvas-surface)", color: "var(--ink-primary)", border: "1px solid var(--line-glass)" }}
                />
              </div>

              <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px" }}>
                <div style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
                  {t.estimatedTotalOfferValue || "ESTIMATED TOTAL OFFER VALUE"}
                </div>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--emerald-vibrant)" }}>
                  ₹{(Number(offerQty || 0) * Number(offerPrice || 0)).toLocaleString()}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => {
                    setOfferFormListing(null);
                    setParentOfferId(null);
                  }}
                  style={{ flex: 1 }}
                >
                  {t.cancel || "Cancel"}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingOffer}
                  style={{ flex: 1 }}
                >
                  {submittingOffer ? (t.submitting || "Submitting…") : (t.sendOffer || "Send Offer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
