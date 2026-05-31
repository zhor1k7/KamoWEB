"use strict";

const KAMO = (function () {

    /* 1. HEADER – adds .scrolled class on scroll */
    function initHeader() {
        const header = document.querySelector(".header");
        if (!header) return;

        window.addEventListener("scroll", () => {
            header.classList.toggle("scrolled", window.scrollY > 10);
        });
    }


    /* 2. SLIDER – prev/next buttons + keyboard arrows */
    class Slider {
        constructor(containerId, prevId, nextId) {
            this.slides  = Array.from(document.querySelectorAll(`#${containerId} .slide`));
            this.prevBtn = document.getElementById(prevId);
            this.nextBtn = document.getElementById(nextId);
            this.current = 0;
        }

        show(index, pushToHistory = true) {
            if (!this.slides.length) return;
            this.slides.forEach(s => s.classList.remove("active"));
            this.current = (index + this.slides.length) % this.slides.length;
            this.slides[this.current].classList.add("active");

            if (pushToHistory) {
                history.replaceState({ slide: this.current }, "", window.location.pathname);
            }
        }

        bind() {
            if (!this.prevBtn || !this.nextBtn || !this.slides.length) return;

            this.prevBtn.addEventListener("click", () => this.show(this.current - 1));
            this.nextBtn.addEventListener("click", () => this.show(this.current + 1));

            document.addEventListener("keydown", (e) => {
                if (e.key === "ArrowLeft")  this.show(this.current - 1);
                if (e.key === "ArrowRight") this.show(this.current + 1);
            });

            window.addEventListener("popstate", (e) => {
                if (e.state && typeof e.state.slide === "number") {
                    this.show(e.state.slide, false);
                }
            });
        }
    }

    function initSlider() {
        const slider = new Slider("slidesContainer", "prevBtn", "nextBtn");
        slider.bind();
    }


    /* 3. UTILITY – Haversine distance between coords (km) */
    function distKm(lat1, lon1, lat2, lon2) {
        const R    = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a    = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Supported KAMO cities
    const GEO_CITIES = [
        { name: "Praha",      lat: 50.0755, lng: 14.4378 },
        { name: "Brno",       lat: 49.1951, lng: 16.6068 },
        { name: "Bratislava", lat: 48.1486, lng: 17.1077 },
        { name: "Ostrava",    lat: 49.8209, lng: 18.2625 },
        { name: "Plzeň",      lat: 49.7384, lng: 13.3736 },
        { name: "Košice",     lat: 48.7164, lng: 21.2611 },
    ];

    // Returns nearest city and distance
    function findNearestCity(latitude, longitude) {
        let nearest = GEO_CITIES[0];
        let minDist = Infinity;
        GEO_CITIES.forEach(city => {
            const d = distKm(latitude, longitude, city.lat, city.lng);
            if (d < minDist) { minDist = d; nearest = city; }
        });
        return { city: nearest, dist: Math.round(minDist) };
    }


    /* 4. SVG MAP – hover tooltips, injects Košice dot if missing */
    function initMap() {
        const map          = document.getElementById("partner-map");
        const tooltip      = document.getElementById("map-tooltip");
        const tooltipBg    = document.getElementById("tooltip-bg");
        const tooltipCity  = document.getElementById("tooltip-city");
        const tooltipCount = document.getElementById("tooltip-count");
        const tooltipLabel = document.getElementById("tooltip-label");

        if (!map) return;

        const svgNS = "http://www.w3.org/2000/svg";

        // Inject Košice dot if missing from HTML
        if (!map.querySelector('[data-city="Košice"]')) {
            const kosiceGroup = document.createElementNS(svgNS, "g");
            kosiceGroup.setAttribute("class", "city-group");
            kosiceGroup.dataset.city     = "Košice";
            kosiceGroup.dataset.partners = "28";

            const pulse = document.createElementNS(svgNS, "circle");
            pulse.setAttribute("cx", "610"); pulse.setAttribute("cy", "210");
            pulse.setAttribute("r",  "16");  pulse.setAttribute("fill", "#FF5A1F");
            pulse.setAttribute("opacity", "0.12");

            const dot = document.createElementNS(svgNS, "circle");
            dot.setAttribute("class", "map-dot");
            dot.setAttribute("cx", "610"); dot.setAttribute("cy", "210");
            dot.setAttribute("r",  "11");  dot.setAttribute("fill", "#FF5A1F");
            dot.setAttribute("filter", "url(#dotShadow)");
            dot.dataset.city     = "Košice";
            dot.dataset.partners = "28";

            const num = document.createElementNS(svgNS, "text");
            num.setAttribute("x", "610"); num.setAttribute("y", "214");
            num.setAttribute("text-anchor", "middle"); num.setAttribute("font-size", "9");
            num.setAttribute("font-weight", "bold");   num.setAttribute("fill", "#fff");
            num.setAttribute("font-family", "Arial");  num.setAttribute("pointer-events", "none");
            num.textContent = "28";

            const bg = document.createElementNS(svgNS, "rect");
            bg.setAttribute("x", "582"); bg.setAttribute("y", "228");
            bg.setAttribute("width", "56"); bg.setAttribute("height", "22");
            bg.setAttribute("rx", "11"); bg.setAttribute("fill", "#1F3053");

            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", "610"); label.setAttribute("y", "243");
            label.setAttribute("text-anchor", "middle"); label.setAttribute("font-size", "11");
            label.setAttribute("font-weight", "bold");   label.setAttribute("fill", "#fff");
            label.setAttribute("font-family", "Arial");  label.setAttribute("pointer-events", "none");
            label.textContent = "Košice";

            kosiceGroup.appendChild(pulse);
            kosiceGroup.appendChild(dot);
            kosiceGroup.appendChild(num);
            kosiceGroup.appendChild(bg);
            kosiceGroup.appendChild(label);

            tooltip ? map.insertBefore(kosiceGroup, tooltip) : map.appendChild(kosiceGroup);
        }

        // Tooltip on dot hover
        if (tooltip && tooltipBg && tooltipCity && tooltipCount) {
            map.querySelectorAll(".map-dot").forEach(dot => {
                dot.addEventListener("mouseenter", (e) => {
                    // Map mouse coords to SVG viewBox
                    const r    = map.getBoundingClientRect();
                    const svgW = 700, svgH = 340;
                    const mx   = ((e.clientX - r.left) / r.width)  * svgW;
                    const my   = ((e.clientY - r.top)  / r.height) * svgH;

                    const city = dot.dataset.city     || "?";
                    const cnt  = dot.dataset.partners || "?";

                    tooltipCity.textContent  = city;
                    tooltipCount.textContent = cnt + " ";

                    if (tooltipLabel) {
                        const countWidth = cnt.length * 8 + 14;
                        tooltipLabel.setAttribute("x",    mx - 85 + 14 + countWidth);
                        tooltipLabel.setAttribute("y",    my - 13);
                        tooltipLabel.textContent = "partners";
                    }

                    const bw = Math.max(city.length * 10 + 28, 170);
                    tooltipBg.setAttribute("width", bw);
                    tooltipBg.setAttribute("x", mx - bw / 2);
                    tooltipBg.setAttribute("y", my - 70);
                    tooltipCity.setAttribute("x",  mx - bw / 2 + 14);
                    tooltipCity.setAttribute("y",  my - 70 + 23);
                    tooltipCount.setAttribute("x", mx - bw / 2 + 14);
                    tooltipCount.setAttribute("y", my - 70 + 43);

                    tooltip.setAttribute("opacity", "1");
                    dot.classList.add("active-dot");
                });

                dot.addEventListener("mouseleave", () => {
                    tooltip.setAttribute("opacity", "0");
                    dot.classList.remove("active-dot");
                });
            });
        }
    }


    /* 5. VIDEO – custom Play/Pause and Mute/Unmute buttons */
    function initVideo() {
        const video   = document.getElementById("kamo-video");
        const playBtn = document.getElementById("playPauseBtn");
        const muteBtn = document.getElementById("muteBtn");
        if (!video || !playBtn || !muteBtn) return;

        playBtn.addEventListener("click", () => {
            video.paused ? video.play() : video.pause();
        });

        muteBtn.addEventListener("click", () => {
            video.muted = !video.muted;
            muteBtn.textContent = video.muted ? "Unmute" : "Mute";
        });

        video.addEventListener("play",  () => (playBtn.textContent = "Pause"));
        video.addEventListener("pause", () => (playBtn.textContent = "Play"));
    }


    /* 6. CONTACT FORM – validation + localStorage persistence */
    function initContactForm() {
        const form = document.getElementById("contactForm");
        if (!form) return;

        const fields = ["userName", "userEmail", "userPhone", "userMessage"];

        // Restore saved field values
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const saved = localStorage.getItem("kamo_" + id);
            if (saved) el.value = saved;
            el.addEventListener("input", () => localStorage.setItem("kamo_" + id, el.value));
        });

        function setError(id, msg) {
            const el = document.getElementById(id);
            if (el) el.textContent = msg;
        }

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            let valid = true;

            // Name: min 2 chars
            const name = document.getElementById("userName");
            if (name && name.value.trim().length < 2) {
                setError("nameError", "Please enter at least 2 characters.");
                valid = false;
            } else { setError("nameError", ""); }

            // Email: browser built-in check
            const email = document.getElementById("userEmail");
            if (email && !email.validity.valid) {
                setError("emailError", "Please enter a valid e-mail address.");
                valid = false;
            } else { setError("emailError", ""); }

            // Phone: optional, validate format if filled
            const phone = document.getElementById("userPhone");
            if (phone && phone.value.trim()) {
                if (!/^[\+]?[0-9\s\-]{7,15}$/.test(phone.value.trim())) {
                    setError("phoneError", "Please enter a valid phone number.");
                    valid = false;
                } else { setError("phoneError", ""); }
            }

            // Category: required
            const cat = document.getElementById("userCategory");
            if (cat && !cat.value) {
                setError("categoryError", "Please select a category.");
                valid = false;
            } else { setError("categoryError", ""); }

            // Message: min 10 chars
            const msg = document.getElementById("userMessage");
            if (msg && msg.value.trim().length < 10) {
                setError("messageError", "Message must be at least 10 characters.");
                valid = false;
            } else { setError("messageError", ""); }

            // Terms checkbox: required
            const agree = document.getElementById("agreeTerms");
            if (agree && !agree.checked) {
                setError("termsError", "You must agree to the Terms & Conditions.");
                valid = false;
            } else { setError("termsError", ""); }

            // Success – show message, reset form and clear storage
            if (valid) {
                const success = document.getElementById("formSuccess");
                if (success) {
                    success.hidden = false;
                    form.reset();
                    fields.forEach(id => localStorage.removeItem("kamo_" + id));
                }
            }
        });
    }


    /* 7. OFFLINE BANNER – shows banner when connection is lost */
    function initOfflineBanner() {
        const banner = document.getElementById("offline-banner");
        if (!banner) return;

        function update() {
            if (!navigator.onLine) {
                banner.hidden = false;
                setTimeout(() => banner.classList.add("visible"), 10);
            } else {
                banner.classList.remove("visible");
                setTimeout(() => (banner.hidden = true), 400);
            }
        }

        window.addEventListener("online",  update);
        window.addEventListener("offline", update);
        update();
    }


    /* 8. GEOLOCATION – finds nearest city, highlights it on map */
    function initGeolocation() {
        const btn     = document.getElementById("geoBtn");
        const geoInfo = document.getElementById("geoInfo");
        if (!btn || !geoInfo) return;

        btn.addEventListener("click", () => {
            if (!navigator.geolocation) {
                geoInfo.textContent = "Geolocation is not supported.";
                return;
            }

            geoInfo.textContent = "Locating…";

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const { city, dist } = findNearestCity(latitude, longitude);

                    geoInfo.textContent = `Nearest KAMO city: ${city.name} (${dist} km away)`;

                    // Highlight matching dot on map
                    const map = document.getElementById("partner-map");
                    if (map) {
                        map.querySelectorAll(".map-dot").forEach(d => {
                            d.classList.remove("active-dot");
                            if (d.dataset.city === city.name) d.classList.add("active-dot");
                        });
                    }
                },
                () => { geoInfo.textContent = "Unable to retrieve location."; }
            );
        });
    }


    /* 9. WEB COMPONENT – <kamo-alert>, type "promo" or "info" */
    class KamoAlert extends HTMLElement {
        connectedCallback() {
            const type = this.getAttribute("type") || "info";

            const colors = {
                promo: { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412" },
                info:  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
            };
            const c = colors[type] || colors.info;

            const shadow = this.attachShadow({ mode: "open" });
            shadow.innerHTML = `
                <style>
                    :host { display: block; }
                    .alert {
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        padding: 16px 20px;
                        border-radius: 14px;
                        background: ${c.bg};
                        border: 1.5px solid ${c.border};
                        color: ${c.text};
                        font-family: Arial, sans-serif;
                        font-size: 15px;
                        line-height: 1.5;
                    }
                    ::slotted(img) {
                        width: 24px; height: 24px;
                        object-fit: contain; flex-shrink: 0;
                    }
                </style>
                <div class="alert" role="alert"><slot></slot></div>
            `;
        }
    }

    function initWebComponent() {
        if (!customElements.get("kamo-alert")) {
            customElements.define("kamo-alert", KamoAlert);
        }
    }


    /* 10. FAQ – accordion, tab filter, live search with highlight */
    function initFaq() {
        const $items  = $(".faq-item");
        const $tabs   = $(".faq-tab");
        const $search = $("#faqSearch");
        const $noRes  = $("#noResults");
        if (!$items.length) return;

        let currentCat = "all";
        let currentQ   = "";

        // Accordion toggle
        $(".faq-question").on("click", function () {
            const $item  = $(this).closest(".faq-item");
            const isOpen = $item.hasClass("open");
            $items.removeClass("open").find(".faq-question").attr("aria-expanded", "false");
            if (!isOpen) {
                $item.addClass("open");
                $(this).attr("aria-expanded", "true");
            }
        });

        // Wrap match in <mark> for highlighting
        function highlightText(text, query) {
            if (!query) return text;
            const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
            return text.replace(re, "<mark>$1</mark>");
        }

        // Apply category + search filter
        function applyFilter() {
            let visible = 0;
            $items.each(function () {
                const $item    = $(this);
                const catMatch = currentCat === "all" || $item.data("cat") === currentCat;
                const qText    = $item.find(".faq-question").text().toLowerCase() +
                    $item.find(".faq-answer").text().toLowerCase();
                const qMatch   = !currentQ || qText.includes(currentQ);
                const show     = catMatch && qMatch;

                $item.prop("hidden", !show);
                if (show) visible++;

                if (show && currentQ) {
                    const $ans = $item.find(".faq-answer");
                    if (!$ans.data("orig")) $ans.data("orig", $ans.html());
                    $ans.html(highlightText($ans.data("orig"), currentQ));
                } else {
                    const $ans = $item.find(".faq-answer");
                    if ($ans.data("orig")) $ans.html($ans.data("orig"));
                }
            });

            $noRes.prop("hidden", visible > 0);
        }

        // Tabs: filter by category
        $tabs.on("click", function () {
            $tabs.removeClass("active");
            $(this).addClass("active");
            currentCat = $(this).data("cat");
            applyFilter();
        });

        // Search: reset tab to "All" and filter
        $search.on("input", function () {
            currentQ = $(this).val().toLowerCase().trim();
            if (currentQ) {
                $tabs.removeClass("active");
                $tabs.filter('[data-cat="all"]').addClass("active");
                currentCat = "all";
            }
            applyFilter();
        });
    }


    /* 11. PARTNER PAGE – card hover animation + alert fade-in */
    function initPartnerPage() {
        // Lift cards on hover
        $(".benefit-card")
            .on("mouseenter", function () {
                $(this).stop(true).animate({ "margin-top": "-6px" }, 200);
            })
            .on("mouseleave", function () {
                $(this).stop(true).animate({ "margin-top": "0px" }, 200);
            });

        // Staggered fade-in for alerts
        $("kamo-alert").hide().each(function (i) {
            $(this).delay(i * 300).fadeIn(500);
        });
    }


    /* INIT */
    function init() {
        initHeader();
        initSlider();
        initMap();
        initVideo();
        initContactForm();
        initOfflineBanner();
        initGeolocation();
        initWebComponent();

        if (typeof $ !== "undefined") {
            initFaq();
            initPartnerPage();
        }
    }

    return { init, findNearestCity };

})();

document.addEventListener("DOMContentLoaded", KAMO.init);