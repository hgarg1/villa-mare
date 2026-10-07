/* Single source of truth for rates, fees, extras, suites, staff, journal and policy copy.
   All money is integer CENTS. Everything here is placeholder content. */
(() => {
  const VM = (window.VM = window.VM || {});
  const $ = (dollars) => dollars * 100;

  VM.data = {
    villa: { name: "Villa Maré", maxGuests: 8, bedrooms: 4, checkIn: "3 pm", checkOut: "11 am", email: "stay@villamare.example", phone: "+00 000 000 000" },

    /* ---------------- rates ---------------- */
    seasons: [
      { id: "peak", name: "Festive peak", ranges: [["12-20", "01-05"]], nightly: $(4200), minNights: 7, note: "Christmas & New Year" },
      { id: "high", name: "High season", ranges: [["01-06", "04-15"], ["12-01", "12-19"]], nightly: $(3200), minNights: 5, note: "Driest, sunniest weather" },
      { id: "shoulder", name: "Shoulder", ranges: [["04-16", "06-30"], ["10-16", "11-30"]], nightly: $(2400), minNights: 4, note: "Warm, quiet, great value" },
      { id: "low", name: "Green season", ranges: [["07-01", "10-15"]], nightly: $(1800), minNights: 3, note: "Lush, short showers" },
    ],
    fees: { cleaning: $(350), serviceRate: 0.1, taxRate: 0.12, securityHold: $(2000), depositRate: 0.3, balanceDaysBefore: 30 },

    /* unit: stay = on/off · night = per day of stay · person = per guest · trip / transfer = counted */
    extras: [
      { id: "chef", name: "Private chef", price: $(450), unit: "night", unitLabel: "per day", img: "chef-hands", blurb: "Breakfast, lunch and dinner built around the morning's catch and market." },
      { id: "yoga", name: "Sunrise yoga", price: $(180), unit: "night", unitLabel: "per session", img: "dawn-yoga", blurb: "A private teacher on the deck as the light comes up." },
      { id: "sailing", name: "Day under sail", price: $(1400), unit: "trip", max: 3, unitLabel: "per day", img: "sailing", blurb: "Restored wooden sloop, skipper and a picnic hamper." },
      { id: "spa", name: "Spa ritual", price: $(220), unit: "person", unitLabel: "per guest", img: "spa-ritual", blurb: "Two therapists, warm oils, the garden pavilion." },
      { id: "transfer", name: "Airport transfer", price: $(240), unit: "transfer", max: 2, unitLabel: "per transfer", img: "airport-transfer-car", blurb: "Private car, cold towels and a welcome drink." },
      { id: "celebration", name: "Celebration set-up", price: $(600), unit: "stay", unitLabel: "once", img: "sunset-dinner", blurb: "Flowers, lanterns and a table on the sand for a birthday or proposal." },
      { id: "kids", name: "Kids' beach club", price: $(90), unit: "person", unitLabel: "per child-day", img: "kids-beach-club", blurb: "Games, shell-hunting and storytelling with a trained nanny." },
    ],

    promos: {
      WELCOME10: { label: "10 % off your nights", desc: "Welcome offer for stays of 3+ nights" },
      EARLY15: { label: "15 % off — book early", desc: "Arrival at least 90 days away" },
      LONGSTAY: { label: "One night on us", desc: "Stays of 7+ nights" },
    },

    cancellation: [
      { minDays: 60, pct: 1, label: "60+ days before arrival", text: "Full refund of all payments" },
      { minDays: 30, pct: 0.5, label: "30–59 days", text: "50 % refund of all payments" },
      { minDays: 0, pct: 0, label: "Under 30 days", text: "Non-refundable" },
    ],

    /* Published test numbers for the demo checkout only. */
    demoCards: [
      { number: "4242 4242 4242 4242", outcome: "Succeeds" },
      { number: "4000 0000 0000 0002", outcome: "Declined" },
      { number: "4000 0027 6000 3184", outcome: "Needs 3-D Secure (code 123456)" },
    ],
    demoSecureCode: "123456",

    /* ---------------- suites ---------------- */
    suites: [
      {
        id: "master", name: "Master Ocean Suite", tag: "Ocean view", bed: "King", sleeps: 2, size: 62, floor: "Ground",
        blurb: "A low canopy bed facing the water, a freestanding stone bath and a private terrace onto the sand.",
        long: "The largest of the four suites sits closest to the sea. Glass doors slide fully away so the bed becomes part of the terrace, and the freestanding stone bath is positioned for the evening light. Linen is changed daily; the outdoor shower is yours alone.",
        features: ["King bed in organic linen", "Freestanding stone bath", "Private terrace to the beach", "Walk-in wardrobe", "Outdoor rain shower", "Espresso and tea bar"],
        images: ["master-bedroom", "master-bath", "master-terrace"],
        plan: { x: 12, y: 14, w: 78, h: 62 },
      },
      {
        id: "garden1", name: "Garden Suite I", tag: "Garden view", bed: "King", sleeps: 2, size: 48, floor: "Ground",
        blurb: "Shaded by frangipani, with a king bed, rattan details and a quiet terrace for reading.",
        long: "Tucked behind the main pool, this suite is the villa's calmest corner. Tall doors open to the garden; the sea is a glimpse between the palms and a sound rather than a view.",
        features: ["King bed", "Garden terrace", "Outdoor shower", "Writing desk", "Blackout shutters", "Daybed nook"],
        images: ["garden1-bedroom", "garden1-terrace", "suite-bath-detail"],
        plan: { x: 12, y: 108, w: 100, h: 52 },
      },
      {
        id: "garden2", name: "Garden Suite II", tag: "Garden view", bed: "Twin", sleeps: 3, size: 46, floor: "Ground",
        blurb: "Twin beds that join to make a king, a sheer canopy and space for a child's cot or third bed.",
        long: "Designed for families and friends who travel together: beds can be split or joined, a third bed or cot fits comfortably, and the terrace is a few steps from the kids' club corner.",
        features: ["Twin beds (convertible to king)", "Room for a child's bed or cot", "Garden terrace", "Outdoor shower", "Plant-filled corner bath"],
        images: ["garden2-bedroom", "garden1-terrace", "suite-bath-detail"],
        plan: { x: 128, y: 108, w: 100, h: 52 },
      },
      {
        id: "sunrise", name: "Sunrise Suite", tag: "Ocean view", bed: "King", sleeps: 2, size: 54, floor: "Upper",
        blurb: "The only upper-level suite: east-facing windows, a balcony for coffee and the best sunrise in the house.",
        long: "Up the stone stairs, a corner bedroom with glass on two sides. Wake up to the sun cresting the horizon, take coffee on the balcony and watch the fishing boats come in.",
        features: ["King bed", "Wraparound windows", "Private balcony", "Coffee and tea station", "Bath with sea view", "Sun deck access"],
        images: ["sunrise-bedroom", "sunrise-balcony", "suite-bath-detail"],
        plan: { x: 150, y: 14, w: 78, h: 62 },
      },
    ],

    /* ---------------- team ---------------- */
    staff: [
      { id: "marisol", name: "Marisol", role: "Head chef", img: "chef-hands", quote: "I cook what the sea and the market gave us this morning.", bio: "Marisol trained in coastal kitchens across three continents before returning to cook where she grew up. She builds menus around the day's catch and plans every dinner with you the evening before.", ask: ["Dinner on the sand", "Cooking class for the kids", "Dietary menus"] },
      { id: "tomas", name: "Tomás", role: "Captain", img: "captain-helm", quote: "There's a cove only reachable by boat. I'll show you.", bio: "Tomás has sailed this coast for twenty years. He skippers the villa's restored wooden sloop and knows every reef, current and quiet anchorage on the bay.", ask: ["Sunset sail", "Snorkelling stops", "Fishing at dawn"] },
      { id: "amara", name: "Amara", role: "Concierge", img: "concierge-lantern-desk", quote: "If you can describe it, we can usually arrange it.", bio: "Amara looks after everything before, during and after your stay, from airport transfers and dinner reservations to birthday surprises and last-minute helicopter rides.", ask: ["Arrival planning", "Celebrations", "Private excursions"] },
      { id: "lena", name: "Lena", role: "Wellness lead", img: "therapist-oils", quote: "Slow down first. The rest follows.", bio: "A certified yoga teacher and massage therapist, Lena designs sessions around your body and your week, from sunrise vinyasa to deep-tissue treatments in the garden pavilion.", ask: ["Sunrise yoga", "Couples treatments", "Breathwork"] },
      { id: "joao", name: "João", role: "House manager", img: "housekeeper-linen", quote: "You shouldn't see us working. You should just feel looked after.", bio: "João leads the house team of twelve and keeps the villa running quietly: linen, flowers, pools, lights and the thousand small details guests never have to think about.", ask: ["Room preferences", "Pillow menu", "Early/late check-in"] },
    ],

    /* ---------------- journal ---------------- */
    journalCategories: ["Stay", "Food", "Sea", "Design", "Guide"],
    journal: [
      {
        slug: "seven-slow-mornings", title: "Seven slow mornings at Maré", cat: "Stay", date: "2026-09-12", mins: 5, cover: "dawn-yoga", excerpt: "What a week at the villa really looks like, one unhurried morning at a time.",
        body: [
          { t: "p", text: "Nobody tells you how quickly a week at the water loosens its grip on the clock. By the third day the question isn't what time it is, but where the shade has moved to." },
          { t: "h2", text: "Day one: arrive, do nothing" },
          { t: "p", text: "Coffee on the terrace, a swim before lunch and a long afternoon on the daybed. Marisol has already asked what you'd like for dinner. The correct answer is: whatever she thinks best." },
          { t: "quote", text: "The best itinerary is the one you forget to follow." },
          { t: "h2", text: "Days two to five" },
          { t: "p", text: "Dawn yoga on the deck, a morning sail to the cove, a long table on the sand and one entirely lost afternoon with a paperback. Nothing is scheduled; everything is available." },
          { t: "img", src: "sunset-dinner", alt: "Candlelit table on the sand", cap: "Dinner at the tideline, day four." },
          { t: "h2", text: "Day seven" },
          { t: "p", text: "The last morning is the quietest. The beach is raked, the sea is flat and you will have already started planning your return." },
        ],
      },
      {
        slug: "cooking-with-the-tide", title: "Cooking with the tide: Marisol's menus", cat: "Food", date: "2026-08-28", mins: 4, cover: "market-produce", excerpt: "How the villa's kitchen starts every day at the fish market.",
        body: [
          { t: "p", text: "At 6:30 every morning, before most guests have stirred, Marisol is at the harbour market choosing what will become dinner." },
          { t: "h2", text: "Menus that change by the hour" },
          { t: "p", text: "There are no fixed menus at Maré. Marisol sketches ideas the evening before, then rewrites them at the stall when the catch tells her something different." },
          { t: "img", src: "chef-hands", alt: "Chef plating fish", cap: "Grilled catch of the day with charred lime and herbs." },
          { t: "quote", text: "If it didn't come from within ten kilometres, I have to have a very good reason." },
          { t: "p", text: "Guests are welcome in the kitchen. Many leave with a handwritten recipe and a deep respect for the grill." },
        ],
      },
      {
        slug: "a-sailors-guide-to-the-bay", title: "A sailor's guide to the bay", cat: "Sea", date: "2026-08-04", mins: 6, cover: "sailing", excerpt: "Three anchorages, one reef and the best time of day to go.",
        body: [
          { t: "p", text: "The bay looks calm from the terrace, but it has moods. Tomás reads them before anyone else is awake." },
          { t: "h2", text: "The morning cove" },
          { t: "p", text: "A twenty-minute sail east, a horseshoe of white sand reachable only by water. Go early: the water is glass and the snorkelling is at its best." },
          { t: "h2", text: "The reef" },
          { t: "p", text: "A shallow reef ten minutes offshore, full of parrotfish and slow-moving turtles. The sloop anchors on sand, and you swim the last stretch." },
          { t: "img", src: "captain-helm", alt: "Captain at the helm", cap: "Tomás at the helm, heading out at nine." },
          { t: "quote", text: "The wind is a conversation. Listen first." },
          { t: "p", text: "Late afternoon brings the best light for the return, with the villa glowing pale on the shore." },
        ],
      },
      {
        slug: "sand-stone-and-teak", title: "Sand, stone and teak: building Villa Maré", cat: "Design", date: "2026-07-15", mins: 5, cover: "architecture-stone-detail", excerpt: "The thinking behind a house meant to weather, not resist.",
        body: [
          { t: "p", text: "We wanted a house that looked better after ten years of salt air than on the day it opened." },
          { t: "h2", text: "Materials that age well" },
          { t: "p", text: "Hand-cut travertine, whitewashed masonry and sun-bleached teak: materials that soften, silver and deepen rather than fail." },
          { t: "img", src: "villa-exterior", alt: "Villa exterior from the beach", cap: "Deep verandas and louvres shade every room." },
          { t: "h2", text: "Letting the house breathe" },
          { t: "p", text: "Cross-ventilation, deep eaves and shaded courtyards mean the villa rarely needs its air conditioning outside the hottest afternoons." },
          { t: "quote", text: "The best architecture here is the kind the sea forgets to notice." },
        ],
      },
      {
        slug: "the-barefoot-packing-list", title: "The barefoot packing list", cat: "Guide", date: "2026-06-22", mins: 3, cover: "packing-flatlay", excerpt: "Everything you need for a week at the water — and a lot you don't.",
        body: [
          { t: "p", text: "Pack light. Everything at the villa is designed to make you want for nothing, and the less you bring, the more you'll feel like you've arrived." },
          { t: "h2", text: "Bring" },
          { t: "p", text: "Linen shirts, a wide-brimmed hat, a favourite book, reef-safe sunscreen, and an open schedule." },
          { t: "h2", text: "Leave behind" },
          { t: "p", text: "Formal shoes, laptop chargers, and the idea that you need to be anywhere by a particular time." },
          { t: "quote", text: "If it needs ironing, it doesn't belong in the suitcase." },
        ],
      },
      {
        slug: "when-it-rains", title: "When it rains at Maré", cat: "Stay", date: "2026-05-30", mins: 4, cover: "rainy-day-veranda", excerpt: "The green season has its own kind of luxury.",
        body: [
          { t: "p", text: "Between July and October, the afternoon brings rain, short, warm and theatrical." },
          { t: "h2", text: "The best seat in the house" },
          { t: "p", text: "A covered veranda, a pot of tea and a blanket on the daybed. The sea turns pewter and the garden smells like the first day of the world." },
          { t: "img", src: "rainy-day-veranda", alt: "Rainy veranda", cap: "The veranda, 4 pm." },
          { t: "p", text: "By six, the sky usually clears, and the evening light is the best of the year." },
        ],
      },
    ],

    reviews: [
      { q: "We arrived on a Friday and the world simply stopped. By Sunday we had forgotten what day it was — which was entirely the point.", who: "The Hartley family", meta: "Seven nights · August" },
      { q: "Marisol's dinner on the sand was the best meal of our lives, and the team never once felt like staff. It felt like staying with very good friends.", who: "Priya & Daniel", meta: "Honeymoon · March" },
      { q: "Three generations under one roof and not one argument about logistics. The kids' club and the sailing day alone were worth the trip.", who: "The Okafor family", meta: "Ten nights · December" },
      { q: "I came to finish a book and instead learned to do nothing. I've never slept so well. The sunrise suite ruined every other hotel for me.", who: "Mateo R.", meta: "Five nights · October" },
    ],
    places: [
      { id: "airport", name: "Airport", time: "45 min by road" },
      { id: "village", name: "Village restaurants", time: "12 min" },
      { id: "harbour", name: "Harbour & morning market", time: "8 min" },
      { id: "reef", name: "House reef", time: "10 min by boat" },
      { id: "cove", name: "Morning cove", time: "20 min sail" },
    ],

    faq: [
      { q: "How many people can the villa host?", a: "Up to eight guests across four suites. Children under two stay free; cots and high chairs are provided." },
      { q: "What is included in the nightly rate?", a: "Daily housekeeping, breakfast ingredients, pool and beach equipment, Wi-Fi, concierge and a welcome dinner. Chef, excursions and transfers can be added." },
      { q: "How do deposits and balances work?", a: "We take a 30 % deposit to confirm, and the balance is due 30 days before arrival. Stays booked inside 30 days are paid in full." },
      { q: "Can I change or cancel a booking?", a: "Yes. Full refund up to 60 days before arrival, 50 % from 30–59 days, non-refundable inside 30 days." },
      { q: "Is the villa suitable for children?", a: "Very. The pool has a removable safety fence, and our nanny and kids' club are available on request." },
      { q: "Do you accommodate dietary requirements?", a: "Always. Tell us in advance and Marisol will build every menu around them." },
      { q: "How do I get here?", a: "We arrange private transfers from the airport, about 45 minutes by road, or by helicopter on request." },
      { q: "Are pets allowed?", a: "Small, well-behaved dogs are welcome by arrangement with a small cleaning supplement." },
    ],

    policies: {
      terms: ["This is a demonstration website. No real bookings, payments or reservations are made.", "All brand names, prices and content are placeholders.", "Nothing entered in the booking flow leaves your browser."],
      privacy: ["The demo stores your draft booking and confirmed demo bookings in your browser's local storage only.", "No cookies are set and no data is sent to any server.", "Card details are never stored: only the brand and last four digits are kept on a confirmed demo booking."],
      houserules: ["Check-in from 3 pm, check-out by 11 am. Early and late arrangements on request.", "Quiet hours 10 pm – 7 am out of respect for neighbours and wildlife.", "No smoking indoors. Events by prior arrangement only.", "Please keep the turtle-nesting beach lights low between May and October."],
    },
  };
})();
