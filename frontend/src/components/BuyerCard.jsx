export default function BuyerCard({
  buyer,
  onConnect,
  currentCrop,
  t,
  fill,
  index = 0,
}) {
  const getBuyerCategoryIcon = (buyerType = "", name = "") => {
    const type = (buyerType || "").toLowerCase();
    const lowerName = (name || "").toLowerCase();
    if (type.includes("restaurant") || lowerName.includes("restaurant") || lowerName.includes("bhavan") || lowerName.includes("toit") || lowerName.includes("cafe")) {
      return "🍽️";
    }
    if (type.includes("cloud kitchen") || lowerName.includes("kitchen") || lowerName.includes("freshmenu") || lowerName.includes("eatfit") || lowerName.includes("box8")) {
      return "🍳";
    }
    if (type.includes("apmc") || type.includes("market") || lowerName.includes("apmc") || lowerName.includes("mandi")) {
      return "🏛️";
    }
    if (type.includes("wholesale") || lowerName.includes("wholesale") || lowerName.includes("ninjacart") || lowerName.includes("hopcoms")) {
      return "🏢";
    }
    if (type.includes("trader") || type.includes("retail") || lowerName.includes("namdhari")) {
      return "🏪";
    }
    return "🏢";
  };

  const crop = currentCrop || buyer.crop || (buyer.crops && buyer.crops[0]) || "";
  const categoryIcon = getBuyerCategoryIcon(buyer.buyer_type, buyer.name);

  // Dynamic WhatsApp message template for contacting this buyer
  const whatsAppText = fill(t.whatsappTemplate || "Hello, I have {crop} available. Please contact me if interested.", {
    crop: crop ? (t.crops?.[crop] || crop) : "produce",
    quantity: "100+",
    price: "Market rate",
    location: buyer.location,
  });

  return (
    <div
      className="buyer-trade-ticket"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Top Row: Dynamic matching status & dynamic distance pill */}
      <div className="ticket-top-row">
        {buyer.matches_crop ? (
          <div className="ticket-match-badge">
            <span className="match-pulse-dot" />
            <span>{fill(t.matchesCrop, { crop: t.crops?.[crop] || crop })}</span>
          </div>
        ) : (
          <div
            className="ticket-match-badge"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              borderColor: "var(--line-glass)",
              color: "var(--ink-secondary)",
            }}
          >
            <span>{categoryIcon} {buyer.buyer_type || "Buyer"}</span>
          </div>
        )}

        {buyer.distance_km != null ? (
          <span className="ticket-price-pill" title={buyer.location}>
            📍 {fill(t.distanceKm, { distance: buyer.distance_km })}
          </span>
        ) : (
          <span className="ticket-price-pill">
            📍 {t.locations?.[buyer.location] || buyer.location}
          </span>
        )}
      </div>

      {/* Main Grid: Crop avatar, buyer identity, rating & crops handled */}
      <div className="ticket-main-grid">
        <div className="ticket-crop-avatar" aria-hidden="true">
          <span>{categoryIcon}</span>
        </div>

        <div className="ticket-info-group">
          <div className="ticket-buyer-header" style={{ flexWrap: "wrap", gap: "6px" }}>
            <h3>{t.buyers?.[buyer.name] || buyer.name}</h3>
            {buyer.verified && (
              <span
                className="ticket-verified-tag"
                title={buyer.verification_source ? fill(t.verificationSourceLabel, { source: buyer.verification_source }) : t.verifiedBuyerBadge}
              >
                {t.verifiedBuyerBadge}
              </span>
            )}
            {buyer.status === "PENDING_VERIFICATION" && (
              <span
                className="ticket-verified-tag"
                style={{ color: "#fbbf24" }}
              >
                {t.pendingVerificationBadge}
              </span>
            )}
            {buyer.rating != null && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "800",
                  color: "#fbbf24",
                  background: "rgba(251, 191, 36, 0.12)",
                  padding: "1px 6px",
                  borderRadius: "4px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                }}
                title={buyer.rating_source ? fill(t.ratingSourceLabel, { source: buyer.rating_source }) : undefined}
              >
                ★ {buyer.rating}
              </span>
            )}
          </div>

          <div className="ticket-specs-row" style={{ flexWrap: "wrap", gap: "8px", margin: "6px 0" }}>
            <span>📍 {t.locations?.[buyer.location] || buyer.location}</span>
            <span>{categoryIcon} {buyer.buyer_type}</span>
            {buyer.crops && buyer.crops.length > 0 && (
              <span>
                🌾 {fill(t.dealsInCrops, {
                  crops: buyer.crops
                    .map((c) => t.crops?.[c] || c)
                    .slice(0, 4)
                    .join(", ") + (buyer.crops.length > 4 ? ` +${buyer.crops.length - 4}` : ""),
                })}
              </span>
            )}
          </div>

          {buyer.interest && (
            <p className="ticket-interest-desc">{t.buyerInterests?.[buyer.interest] || buyer.interest}</p>
          )}
        </div>
      </div>

      {/* Action Bar: CALL, WHATSAPP, WEBSITE, I'M INTERESTED */}
      <div className="ticket-action-bar" style={{ flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {buyer.phone && (
            <a
              href={`tel:${buyer.phone}`}
              className="btn-outline btn-sm"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
              title={buyer.phone}
            >
              <span>📞</span>
              <span>{t.call}</span>
            </a>
          )}

          {buyer.whatsapp && (
            <a
              href={`https://wa.me/${buyer.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(whatsAppText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                borderColor: "rgba(34, 197, 94, 0.4)",
                color: "#4ade80",
              }}
              title={buyer.whatsapp}
            >
              <span>💬</span>
              <span>{t.whatsapp}</span>
            </a>
          )}

          {buyer.website && (
            <a
              href={buyer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
              title={buyer.website}
            >
              <span>🌐</span>
              <span>{t.website}</span>
            </a>
          )}
        </div>

        <button
          type="button"
          className="btn-primary btn-sm ticket-connect-btn"
          onClick={() => onConnect(buyer)}
        >
          <span>🤝 {t.imInterested}</span>
        </button>
      </div>
    </div>
  );
}
