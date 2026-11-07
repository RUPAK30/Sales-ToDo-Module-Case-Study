/* Ten Today: the To-Do module's rules, running. Synthetic data; runs in the browser only. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var L = function (v) { return "₹" + (v >= 100 ? (v / 100) + "Cr" : v + "L"); };
  var KEY = "tentoday.v1", QUIET = false, CAP = 10;
  var NEXT = { "Qualify lead": "Prepare quotation", "Prepare quotation": "Follow up quote", "Follow up quote": null, "Approve discount": null, "Callback": null, "Manual": null };
  var TARGET = { "Qualify lead": 1, "Prepare quotation": 2, "Follow up quote": 3, "Approve discount": 1, "Callback": 0, "Manual": 0 };
  var REPS = ["Rahul", "Asha", "Imran", "Neha"], MGR = "Kavita (manager)";

  function T(id, type, cust, value, due, owner, extra) { var t = { id: id, type: type, cust: cust, value: value, due: due, orig: due, owner: owner || "Rahul", status: "open", resched: 0, hist: [] }; for (var k in extra || {}) t[k] = extra[k]; return t; }
  function seed() {
    var t = [
      T("B", "Follow up quote", "ABC Corp", 2, -5), T("D", "Approve discount", "XYZ Ltd", 5, -2, "Rahul", { ask: 6, floor: 4, arOverdue: 0 }), T("L", "Follow up quote", "XYZ Ltd", 5, -1), T("C", "Qualify lead", "Mahesh Electronics", 50, 0),
      T("A", "Follow up quote", "Apex Logistics", 20, 2), T("E", "Callback", "Patil Traders", 3, 0, "Rahul", { time: "16:00" }),
      T("F", "Follow up quote", "Sharma Steel", 8, -7), T("G", "Qualify lead", "Nova Pharma", 12, -1), T("H", "Prepare quotation", "Bright Textiles", 6, -3),
      T("I", "Follow up quote", "Om Packaging", 4, -4), T("J", "Qualify lead", "Kiran Foods", 9, 0), T("K", "Prepare quotation", "Vega Motors", 15, -6),
      T("M", "Follow up quote", "Delta Agro", 3, -2), T("N", "Qualify lead", "Shiv Plastics", 2, -1), T("O", "Follow up quote", "Ruby Ceramics", 7, -9),
      T("P", "Prepare quotation", "Metro Cables", 11, 1), T("Q", "Qualify lead", "Zen Logistics", 5, 3),
      T("R1", "Follow up quote", "Lotus Paints", 6, -1, "Asha"), T("R2", "Qualify lead", "Aqua Pure", 3, 0, "Asha"), T("R3", "Prepare quotation", "Iris Labs", 9, -2, "Imran"),
      T("R4", "Follow up quote", "Sun Agro", 4, 0, "Neha"), T("R5", "Qualify lead", "Pine Infra", 7, -6, "Neha"),
      /* A distributor discount: the approval becomes a shared record Every Rupee matches deductions against.
         feed = Every Rupee's BR-11 view of this distributor's open deductions (snapshot, sample data). */
      T("KM", "Approve discount", "Krishna Marketing, Surat", 3, 1, "Rahul", { ask: 5, floor: 4, arOverdue: 0, distId: "CELLOVA0005", capINR: 8000, taxIncl: false, windowEnd: "2026-11-30", feed: { financePending: 18000, blocking: 9440, young: 0 } })
    ];
    return { day: 0, tasks: t, log: [], done: [], seq: 0, approvals: [], apvSeq: 42 };
  }
  var S;
  function load() { try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; } if (!S || !S.tasks || !S.approvals) S = seed(); }
  function save() { if (QUIET) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function log(rule, text) { S.log.unshift({ day: S.day, rule: rule, text: text }); }

  /* ---------- rules ---------- */
  function late(t) { return S.day - (t.resched >= 2 ? t.orig : t.due); }
  function blocked(t) { return t.type !== "Approve discount" && S.tasks.some(function (x) { return x.type === "Approve discount" && x.cust === t.cust && x.status === "open"; }); }
  function tier(t) { var l = late(t); return l >= 5 ? "P1" : l >= 1 ? "P2" : l === 0 ? "P3" : null; }
  function active(t) { return t.status === "open" || (t.status === "hold" && S.day >= t.revisit); }
  function rank(a, b) {
    var ta = tier(a), tb = tier(b); if (ta !== tb) return ta < tb ? -1 : 1;                 /* R1 priority tier */
    var ap = a.type === "Approve discount", bp = b.type === "Approve discount"; if (ap !== bp) return ap ? -1 : 1; /* R2 blocking stage */
    if (late(a) !== late(b)) return late(b) - late(a);                                      /* R3 days overdue */
    return b.value - a.value;                                                               /* R4 value, tie-break only */
  }
  function mine(owner) { return S.tasks.filter(function (t) { return t.owner === owner; }); }
  function views(owner) {
    var ts = mine(owner), act = ts.filter(active);
    var pinned = act.filter(function (t) { return t.type === "Callback" && t.due <= S.day; });
    var due = act.filter(function (t) { return t.type !== "Callback" && t.due <= S.day && !blocked(t); }).sort(rank);
    return {
      pinned: pinned, today: due.slice(0, Math.max(0, CAP - pinned.length)), overdue: due.filter(function (t) { return late(t) > 0; }),
      inbox: ts.filter(function (t) { return t.status === "open" && t.due > S.day; }),
      approvals: act.filter(function (t) { return t.type === "Approve discount"; }),
      hold: ts.filter(function (t) { return (t.status === "hold" && S.day < t.revisit) || (t.status === "open" && blocked(t)); }), dueCount: due.length, all: due
    };
  }
  function find(id) { return S.tasks.filter(function (t) { return t.id === id; })[0]; }
  function newTask(type, cust, value, owner, why) {
    if (S.tasks.some(function (t) { return t.cust === cust && t.type === type && (t.status === "open" || t.status === "hold"); })) { log("Dedupe", type + " for " + cust + " already open: no duplicate created."); return null; }
    S.seq++; var t = T("N" + S.seq, type, cust, value, S.day + TARGET[type], owner); S.tasks.push(t);
    log("Create", type + " · " + cust + " created by " + why + ", due day " + t.due + "."); return t;
  }

  /* ---------- actions ---------- */
  /* R7: before a distributor discount is approved, Every Rupee's feed is checked. Claims waiting on Finance never block;
     rep-owned or unverified claims older than 15 days do, until the rep shows proof or collects. */
  function approve(t) {
    if (t.feed && t.feed.blocking > 0) { log("Blocked", "R7: " + t.cust + " has ₹" + t.feed.blocking.toLocaleString("en-IN") + " of rep-owned or unverified deductions older than 15 days in Every Rupee. Discount not approved until " + t.owner + " shows proof or collects it. (₹" + t.feed.financePending.toLocaleString("en-IN") + " waiting on Finance does not count.)"); return false; }
    S.apvSeq++; var a = { Approval_ID: "APV-2026-0" + S.apvSeq, Distributor_ID: t.distId, Rep_ID: t.owner, Approver_ID: MGR, Approved_Cap_INR: t.capINR, Tax_Inclusive: t.taxIncl, Invoice_Window_End: t.windowEnd };
    S.approvals.push(a); t.apv = a.Approval_ID;
    log("R7", a.Approval_ID + " issued for " + t.cust + ": cap ₹" + t.capINR.toLocaleString("en-IN") + (t.taxIncl ? " incl. GST" : " before GST") + ", invoices up to " + t.windowEnd + ". Sent to Every Rupee to match against the distributor's deduction.");
    return true;
  }
  function proof(t) { if (!t.feed) return; log("R7", t.owner + " attached the credit-note proof for " + t.cust + "'s ₹" + t.feed.blocking.toLocaleString("en-IN") + " deduction. Every Rupee re-checks it; the discount block lifts."); t.feed.blocking = 0; }
  function done(t) { if (t.type === "Approve discount" && t.distId && !approve(t)) return false; t.status = "done"; t.doneDay = S.day; S.done.push({ id: t.id, onTime: S.day <= t.orig, resched: t.resched }); log("Done", t.type + " · " + t.cust + " completed" + (S.day <= t.orig ? " within its original target." : ", " + (S.day - t.orig) + " day(s) after its original target.")); }
  function reschedule(t, days, blocker) { if (t.resched >= 1 && !blocker) { log("Blocked", "A second reschedule needs a blocker. " + t.cust + " stays in Today."); return false; } t.due = S.day + days; t.resched++; if (blocker) t.blocker = blocker; log("Reschedule", t.type + " · " + t.cust + " moved to day " + t.due + " (rescheduled " + t.resched + "×" + (blocker ? ", blocker: " + blocker : "") + "). " + (t.resched >= 2 ? "It keeps ageing from its original target, day " + t.orig + "." : "Original target stays day " + t.orig + ".")); return true; }
  function hold(t, reason, days) {
    if (!reason || !days) { log("Blocked", "On hold needs a reason and a revisit date. " + t.cust + " stays active."); return false; }
    t.status = "hold"; t.reason = reason; t.revisit = S.day + days; t.holds = (t.holds || 0) + 1; log("Hold", t.cust + " on hold: " + reason + ". Returns on day " + t.revisit + "."); return true;
  }
  function stageMoved(t) {
    t.status = "closed"; t.closed = "Stage moved"; log("Auto-close", t.type + " · " + t.cust + " closed: the stage already moved. Nobody is asked to redo it.");
    if (NEXT[t.type]) newTask(NEXT[t.type], t.cust, t.value, t.owner, "the stage change");
  }
  function dealLost(t) { S.tasks.forEach(function (x) { if (x.cust === t.cust && (x.status === "open" || x.status === "hold")) { x.status = "closed"; x.closed = "Deal lost"; } }); log("Auto-close", "All open tasks for " + t.cust + " closed with reason “Deal lost”."); }
  function reassign(t, to) {
    if (t.type === "Approve discount" && to.indexOf("manager") < 0) { log("Blocked", "Approvals can only go to an approver. " + t.cust + " stays with " + t.owner + "."); return false; }
    log("Reassign", t.type + " · " + t.cust + " moved from " + t.owner + " to " + to + " by " + MGR + "."); t.owner = to; return true;
  }
  /* Close the loop (the daily review in the 1-3-5 method): the day ends with a decision, not a silent rollover.
     Unfinished work carries over and keeps ageing; nothing is quietly postponed. */
  function closeDay(owner) {
    var v = views(owner), list = v.pinned.concat(v.today), doneToday = S.tasks.filter(function (t) { return t.owner === owner && t.status === "done" && t.doneDay === S.day; }).length;
    var left = list.filter(function (t) { return t.status === "open"; }), p1 = left.filter(function (t) { return tier(t) === "P1"; }).length;
    var summary = "Day " + S.day + " closed for " + owner + ": " + doneToday + " done · " + left.length + " carried over against their original targets" + (p1 ? " (" + p1 + " P1, first tomorrow)" : "") + ".";
    log("Close day", summary); S.lastClose = summary; nextDay(); return { done: doneToday, carried: left.length };
  }
  function nextDay() {
    S.day++;
    S.tasks.forEach(function (t) {
      if (t.status === "hold" && S.day === t.revisit) log("Revisit", t.cust + " is back from hold (revisit day reached).");
      if (t.status === "open" && late(t) === 5) log("P1", t.type + " · " + t.cust + " became P1 (5 days past target): push sent to " + t.owner + ".");
    });
  }

  /* ---------- UI ---------- */
  var who = "Rahul", tab = "today", sheet = null;
  function card(t, pinned) {
    var p = pinned ? "Pinned " + (t.time || "") : tier(t) || "Inbox", l = late(t);
    var why = t.type === "Callback" ? "Customer's time · pinned, not ranked" : l > 0 ? l + " day" + (l > 1 ? "s" : "") + " past target" : l === 0 ? "Due today" : "Due day " + t.due;
    if (t.status === "hold") why = "On hold: " + t.reason + " · back day " + t.revisit;
    if (t.status === "open" && blocked(t)) why = "Blocked: waiting on the discount approval";
    if (t.type === "Approve discount" && t.ask) why = "Ask " + t.ask + "% off · floor " + t.floor + "% · customer overdue " + (t.arOverdue ? L(t.arOverdue) : "₹0") + " · " + why;
    var R = function (n) { return "₹" + n.toLocaleString("en-IN"); };
    var feed = t.feed ? "<div class='er" + (t.feed.blocking ? " blk" : "") + "'><p class='er-h'>From Every Rupee · this distributor's open deductions</p><div class='er-r'><span>Waiting on finance</span><b>" + R(t.feed.financePending) + "</b><i class='ok'>doesn't block</i></div><div class='er-r'><span>Rep's claims, over 15 days</span><b>" + R(t.feed.blocking) + "</b><i class='" + (t.feed.blocking ? "no'>blocks approval" : "ok'>clear") + "</i></div><p class='er-f'>" + (t.feed.blocking ? "Rahul owes proof for the ₹9,440 before Kavita can approve." : "Ready to approve: cap " + R(t.capINR) + " before GST, invoices to " + t.windowEnd + ".") + "</p></div>" : "";
    return "<li class='tk' data-id='" + t.id + "'><div class='tk-h'><b>" + esc(t.type) + "</b><span class='pp pp-" + p.slice(0, 2).toLowerCase() + "'>" + esc(p) + "</span></div><p>" + esc(t.cust) + " · " + L(t.value) + " · " + esc(why) + (t.resched ? " · rescheduled " + t.resched + "×" : "") + "</p>" +
      feed + (t.status === "open" || active(t) ? "<div class='tk-a'>" + (t.feed ? (t.feed.blocking ? "<button data-a='proof'>Attach proof</button><button data-a='done' class='dim'>Approve</button>" : "<button data-a='done'>✓ Approve discount</button>") : "<button data-a='done'>✓ Done</button>") + "<button data-a='res'>Reschedule</button><button data-a='hold'>On hold</button>" + (t.feed ? "" : "<button data-a='stage' title='Simulates the CRM moving this deal to its next stage'>CRM stage moved</button>") + "</div>" : "") + "</li>";
  }
  function render() {
    var v = views(who);
    $("day").textContent = "Day " + S.day; $("who").value = who;
    var tabs = [["today", "Today", v.today.length + v.pinned.length], ["inbox", "Inbox", v.inbox.length], ["overdue", "Overdue", v.overdue.length], ["approvals", "Approvals", v.approvals.length], ["hold", "On hold", v.hold.length]];
    $("ph-tabs").innerHTML = tabs.map(function (x) { return "<button data-tab='" + x[0] + "' class='" + (tab === x[0] ? "on" : "") + "'>" + x[1] + " <i>" + x[2] + "</i></button>"; }).join("");
    var list = tab === "today" ? v.pinned.map(function (t) { return card(t, true); }).concat(v.today.map(function (t) { return card(t); })) : (v[tab] || []).map(function (t) { return card(t); });
    $("ph-list").innerHTML = list.length ? list.join("") : "<li class='empty'>Nothing here.</li>";
    $("ph-sum").textContent = tab === "today" ? (v.dueCount + v.pinned.length > CAP ? CAP + " of " + (v.dueCount + v.pinned.length) + " due (incl. " + v.pinned.length + " pinned callback) · the rest wait in Overdue" : (v.dueCount + v.pinned.length) + " due today") : "";
    var p1 = v.today.filter(function (t) { return tier(t) === "P1"; }).length;
    $("ph-hi").textContent = "Good morning, " + who + " · " + (v.today.length + v.pinned.length) + " actions, " + p1 + " P1";
    /* manager view */
    $("mgr").innerHTML = REPS.map(function (r) { var w = views(r), held = mine(r).filter(function (t) { return t.status === "hold" && t.holds > 1; }).length, flag = w.overdue.length >= 8; return "<tr" + (flag ? " class='flag'" : "") + "><td><b>" + r + "</b>" + (flag ? " <span class='pp pp-p1'>Overloaded</span>" : "") + "</td><td class='n'>" + w.dueCount + "</td><td class='n'>" + w.overdue.length + "</td><td class='n'>" + w.hold.length + (held ? " · " + held + " again" : "") + "</td><td class='n'>" + w.approvals.length + "</td></tr>"; }).join("");
    var d = S.done, ot = d.filter(function (x) { return x.onTime; }).length, rs = S.tasks.filter(function (t) { return t.resched > 2; }).length;
    $("m-ontime").textContent = d.length ? Math.round(ot / d.length * 100) + "%" : "—";
    $("m-done").textContent = d.length; $("m-guard").textContent = rs;
    $("log").innerHTML = S.log.slice(0, 40).map(function (l) { return "<li><span class='mono'>Day " + l.day + "</span> <b class='rl'>" + esc(l.rule) + "</b> " + esc(l.text) + "</li>"; }).join("") || "<li class='empty'>Tap an action on the phone.</li>";
  }
  function openSheet(t, kind) {
    sheet = { t: t, kind: kind };
    var h = kind === "res" ? "<b>Reschedule " + esc(t.cust) + "</b>" + (t.resched >= 1 ? "<label>Second reschedule: what is blocking it?<select id='sh-blk'><option value=''>Choose a blocker…</option><option>Customer unreachable</option><option>Awaiting competitor quote</option><option>Price pushback</option></select></label>" : "") + "<div class='sh-o'><button data-r='1'>Tomorrow</button><button data-r='3'>In 3 days</button><button data-r='7'>Next week</button></div><p class='sm'>The original target (day " + t.orig + ") still counts for the metric.</p>"
      : "<b>Put " + esc(t.cust) + " on hold</b><label>Reason<select id='sh-reason'><option value=''>Choose a reason…</option><option>Customer travelling</option><option>Waiting for customer budget</option><option>Internal approval pending</option></select></label><label>Revisit<select id='sh-days'><option value=''>Choose a date…</option><option value='2'>In 2 days</option><option value='5'>In 5 days</option></select></label><button class='sh-go' data-go='hold'>Put on hold</button>";
    $("sheet").innerHTML = h + "<button class='sh-x' data-x='1'>Cancel</button>"; $("sheet").classList.add("on");
  }
  function closeSheet() { sheet = null; $("sheet").classList.remove("on"); }
  function after() { save(); render(); }
  function toast(html, kind) { var el = $("toast"); if (!el) return; el.innerHTML = html; el.className = "toast on " + (kind || ""); clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = "toast " + (kind || ""); }, 6500); }

  /* ---------- UAT: the case study's edge cases, executed ---------- */
  function sc(fn) { var keep = S; QUIET = true; S = seed(); var o; try { o = fn(); } catch (e) { o = { pass: false, actual: "Error: " + e.message }; } S = keep; QUIET = false; return o; }
  var TESTS = [
    ["UAT-01", "Today is capped at 10", "15 due tasks → Today shows 10, Overdue holds the rest", function () { var v = views("Rahul"); return { pass: v.today.length + v.pinned.length === 10 && v.dueCount > 10, actual: (v.today.length + v.pinned.length) + " shown of " + (v.dueCount + v.pinned.length) + " due" }; }],
    ["UAT-02", "Ranking follows the stated order", "Worked example: B (P1) before D (P2 approval) before C (P3, ₹50L)", function () { var o = views("Rahul").all.map(function (t) { return t.id; }); var b = o.indexOf("B"), d = o.indexOf("D"), c = o.indexOf("C"); return { pass: b > -1 && b < d && d < c, actual: "B #" + (b + 1) + ", D #" + (d + 1) + ", C #" + (c + 1) }; }],
    ["UAT-03", "Value only breaks ties", "₹50L lead due today stays below P1/P2 work", function () { var o = views("Rahul").all, c = find("C"), small = o.filter(function (t) { return tier(t) !== "P3"; }).length; return { pass: o.indexOf(c) >= small, actual: "₹50L lead ranked " + (o.indexOf(c) + 1) + " of " + o.length + ", after all " + small + " P1/P2 tasks" }; }],
    ["UAT-04", "Not-yet-due waits in Inbox; callbacks pinned", "A in Inbox, E pinned at 16:00", function () { var v = views("Rahul"); return { pass: v.inbox.some(function (t) { return t.id === "A"; }) && v.pinned.some(function (t) { return t.id === "E"; }), actual: "A in Inbox: " + v.inbox.some(function (t) { return t.id === "A"; }) + " · E pinned: " + v.pinned.some(function (t) { return t.id === "E"; }) }; }],
    ["UAT-05", "Stage change auto-closes and creates the next task", "Qualify lead C → closed, Prepare quotation created", function () { stageMoved(find("C")); var n = S.tasks.filter(function (t) { return t.cust === "Mahesh Electronics" && t.type === "Prepare quotation"; }); return { pass: find("C").status === "closed" && n.length === 1, actual: "C " + find("C").status + ", next tasks: " + n.length }; }],
    ["UAT-06", "Same event twice: no duplicate", "Stage change fired twice for one record", function () { stageMoved(find("C")); newTask("Prepare quotation", "Mahesh Electronics", 50, "Rahul", "a repeat event"); var n = S.tasks.filter(function (t) { return t.cust === "Mahesh Electronics" && t.type === "Prepare quotation"; }).length; return { pass: n === 1, actual: n + " open task(s)" }; }],
    ["UAT-07", "Deal lost closes all its tasks", "Deal lost on ABC Corp", function () { newTask("Callback", "ABC Corp", 2, "Rahul", "a call request"); dealLost(find("B")); var o = S.tasks.filter(function (t) { return t.cust === "ABC Corp" && t.status !== "closed"; }).length; return { pass: o === 0, actual: o + " open, reason " + find("B").closed }; }],
    ["UAT-08", "On hold needs reason and revisit (negative)", "Hold with no reason", function () { var ok = hold(find("F"), "", 0); return { pass: !ok && find("F").status === "open", actual: (ok ? "accepted" : "blocked") + ", status " + find("F").status }; }],
    ["UAT-09", "On hold returns on its revisit date", "Hold 2 days, advance 2 days", function () { hold(find("F"), "Customer travelling", 2); var hid = !views("Rahul").today.some(function (t) { return t.id === "F"; }); nextDay(); nextDay(); var back = views("Rahul").today.some(function (t) { return t.id === "F"; }); return { pass: hid && back, actual: "hidden while held: " + hid + " · back on day 2: " + back }; }],
    ["UAT-10", "Rescheduling can't fake 'on time'", "Reschedule B, then complete it", function () { reschedule(find("B"), 1); nextDay(); done(find("B")); return { pass: S.done[0].onTime === false, actual: "counted as " + (S.done[0].onTime ? "on time" : "late against original target") }; }],
    ["UAT-11", "Reassignment only to an eligible owner (negative)", "Move approval D to another rep", function () { var ok = reassign(find("D"), "Asha"); return { pass: !ok && find("D").owner === "Rahul", actual: (ok ? "moved" : "blocked") + ", owner " + find("D").owner }; }],
    ["UAT-12", "Ageing into P1 at 5 days late", "Task 4 days late, advance 1 day", function () { var t = find("I"); var a = tier(t); nextDay(); return { pass: a === "P2" && tier(t) === "P1", actual: a + " → " + tier(t) }; }]
  ];
  TESTS.push(
    ["UAT-13", "Second reschedule needs a blocker; ageing keeps counting", "Reschedule F twice, second time with no blocker", function () { var t = find("F"); reschedule(t, 1); var ok2 = reschedule(t, 1, ""); var ok3 = reschedule(t, 1, "Price pushback"); return { pass: !ok2 && ok3 && late(t) === S.day - t.orig, actual: "no blocker: " + (ok2 ? "allowed" : "blocked") + " · with blocker: " + (ok3 ? "allowed" : "blocked") + " · ageing from day " + t.orig }; }],
    ["UAT-14", "Pending approval freezes the rep's task for that customer", "XYZ Ltd follow-up while discount approval is open", function () { var hid = !views("Rahul").all.some(function (t) { return t.id === "L"; }); done(find("D")); var back = views("Rahul").all.some(function (t) { return t.id === "L"; }); return { pass: hid && back, actual: "hidden while approval open: " + hid + " · back after approval: " + back }; }]
  );
  TESTS.push(["UAT-15", "Closing the day carries work over without resetting it", "Complete 1 task, close the day", function () { var t = views("Rahul").today[0], before = t ? late(views("Rahul").today[1]) : 0, other = views("Rahul").today[1]; done(t); var r = closeDay("Rahul"); return { pass: r.done === 1 && r.carried >= 1 && late(other) === before + 1, actual: r.done + " done, " + r.carried + " carried; next task's lateness " + before + " → " + late(other) }; }]);
  TESTS.push(["UAT-16", "Finance backlog doesn't block; rep-owned over 15 days does", "Krishna Marketing discount: ₹18,000 waiting on Finance, ₹9,440 rep-owned for 16 days", function () { var t = find("KM"); var ok1 = done(t) !== false; var blk = t.status === "open"; t.feed.blocking = 0; t.feed.financePending = 18000; var ok2 = done(t) !== false; return { pass: !ok1 && blk && ok2 && t.status === "done", actual: "with rep-owned ₹9,440: " + (ok1 ? "approved" : "blocked") + " · Finance-pending only: " + (ok2 ? "approved" : "blocked") }; }]);
  TESTS.push(["UAT-17", "Rep's proof lifts the block", "Attach proof, then approve", function () { var t = find("KM"); proof(t); done(t); return { pass: t.status === "done" && !!t.apv, actual: "status " + t.status + ", " + (t.apv || "no approval") }; }]);
  TESTS.push(["UAT-18", "Approval creates the shared record", "Approve after proof: 5 fields Every Rupee matches on", function () { var t = find("KM"); proof(t); done(t); var a = S.approvals[0] || {}; var keys = ["Approval_ID", "Distributor_ID", "Rep_ID", "Approver_ID", "Approved_Cap_INR", "Invoice_Window_End"]; var ok = keys.every(function (k) { return a[k] != null && a[k] !== ""; }); return { pass: ok && a.Approved_Cap_INR === 8000 && a.Tax_Inclusive === false, actual: a.Approval_ID + " · " + a.Distributor_ID + " · " + a.Rep_ID + " / " + a.Approver_ID + " · ₹" + a.Approved_Cap_INR + (a.Tax_Inclusive ? " incl. GST" : " before GST") + " · to " + a.Invoice_Window_End }; }]);
  function runUAT() {
    var rows = TESTS.map(function (t) { var o = sc(t[3]); return [t[0], t[1], t[2], o.actual, o.pass]; }), pass = rows.filter(function (r) { return r[4]; }).length;
    $("uat-sum").textContent = pass + " of " + rows.length + " passed · run on fresh data, your session untouched";
    $("uat-body").innerHTML = rows.map(function (r) { return "<tr><td class='mono'>" + r[0] + "</td><td><b>" + esc(r[1]) + "</b><br><span class='sm'>" + esc(r[2]) + "</span></td><td class='sm'>" + esc(r[3]) + "</td><td><span class='pp " + (r[4] ? "pp-ok'>Pass" : "pp-p1'>Fail") + "</span></td></tr>"; }).join("");
    $("uat").hidden = false; $("uat").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function dl(name, rows) { var t = "﻿" + rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"); var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: "text/csv" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  var STORIES = [
    ["US-1 Today queue", "As a salesperson, I want at most 10 ranked actions for today, so I act on what matters first.", "Given more than 10 due tasks, when I open Today, then I see the top 10 by the ranking rules and the rest in Overdue."],
    ["US-2 Explainable rank", "As a salesperson, I want each card to say why it is there, so I trust the order.", "Given a task, when it is shown, then it displays its priority and a one-line reason."],
    ["US-3 Auto-close on stage change", "As a salesperson, I don't want to redo work the workflow already shows done.", "Given an open task whose stage moved, then it closes with reason 'Stage moved' and the next task is created once."],
    ["US-4 On hold with reason", "As a manager, I want held work to carry a reason and revisit date, so nothing hides.", "Given On hold, when no reason or date is chosen, then the action is blocked; when the date arrives, the task returns."],
    ["US-5 Honest on-time metric", "As a sales head, I want on-time measured against the original target, so rescheduling can't fake it.", "Given a rescheduled task completed after its original target, then it counts as late."],
    ["US-6 Workload view", "As a manager, I want overdue, held and approval counts per rep, so I rebalance stuck work.", "Given a rep with 8+ overdue tasks, then the row is flagged as workload, not performance."],
    ["US-7 Eligible reassignment", "As a manager, I want to reassign only to eligible owners, with a logged change.", "Given an approval task, when reassigned to a rep without approval rights, then it is blocked and logged."],
    ["US-8 Discount backed by the ledger", "As an approver, I want to see whose action a distributor's open deductions wait on before I approve a discount, and the approval sent to Every Rupee as a record it can match.", "Given rep-owned or unverified deductions older than 15 days, then approval is blocked until proof; Finance-pending amounts never block; an approval creates a record with ID, distributor, rep, approver, cap (tax flag) and invoice window."]
  ];

  /* ---------- wiring ---------- */
  load();
  if (/[?&]km=1/.test(location.search)) { S = seed(); who = "Rahul"; tab = "approvals"; }
  render();
  if (/[?&]km=1/.test(location.search)) setTimeout(function () { var el = document.querySelector("[data-id='KM']"); if (el) { el.classList.add("spot"); el.scrollIntoView({ behavior: "smooth", block: "center" }); } }, 300);
  $("who").onchange = function () { who = this.value; render(); };
  $("next-day").onclick = function () { nextDay(); after(); };
  $("close-day").onclick = function () { closeDay(who); after(); $("ph-close").textContent = S.lastClose; };
  $("reset").onclick = function () { S = seed(); who = "Rahul"; tab = "today"; after(); };
  $("run-uat").onclick = runUAT; if (/[?&]uat=1/.test(location.search)) setTimeout(runUAT, 300);
  $("dl-jira").onclick = function () { dl("ten-today-stories-jira.csv", [["Summary", "Issue Type", "Description", "Acceptance Criteria", "Labels"]].concat(STORIES.map(function (s) { return [s[0], "Story", s[1], s[2], "sales-todo"]; }))); };
  $("dl-uat").onclick = function () { dl("ten-today-uat.csv", [["ID", "Rule", "Scenario"]].concat(TESTS.map(function (t) { return [t[0], t[1], t[2]]; }))); };
  $("rebalance").onclick = function () {
    var w = REPS.map(function (r) { return [r, views(r).overdue.length]; }).sort(function (a, b) { return b[1] - a[1]; }), from = w[0][0], to = w[w.length - 1][0];
    var pick = views(from).overdue.filter(function (t) { return t.type !== "Approve discount"; }).slice(-3);
    if (!pick.length) return; if (!confirmMove(from, to, pick.length)) return; pick.forEach(function (t) { reassign(t, to); }); after();
  };
  function confirmMove(f, t, n) { var b = $("rebalance"); if (b.dataset.armed) { delete b.dataset.armed; b.textContent = "Suggest a rebalance"; return true; } b.dataset.armed = "1"; b.textContent = "Confirm: move " + n + " overdue tasks " + f + " → " + t; return false; }
  document.addEventListener("click", function (e) {
    var tb = e.target.closest("[data-tab]"); if (tb) { tab = tb.dataset.tab; render(); return; }
    var a = e.target.closest("[data-a]"); if (a) { var t = find(a.closest("[data-id]").dataset.id); if (a.dataset.a === "proof") { proof(t); after(); toast("<b>Proof attached.</b> Every Rupee re-checks the ₹9,440; the block on " + esc(t.cust) + " is lifted.", "ok"); return; } else if (a.dataset.a === "done") { if (t.feed && t.feed.blocking) { done(t); after(); toast("<b>Can't approve yet.</b> Rahul's ₹9,440 claim is over 15 days old. Attach proof first. Finance's ₹18,000 backlog doesn't count against him.", "no"); return; } if (t.feed) { done(t); after(); toast("<b>" + t.apv + " issued</b> · cap ₹8,000 before GST · sent to Every Rupee. <a href='https://everyrupee-o2c.vercel.app/route.html#pre'>See what finance does with it →</a>", "ok"); return; } var li = a.closest(".tk"); li.classList.add("gone"); setTimeout(function () { done(t); after(); }, 260); } else if (a.dataset.a === "stage") { var nx = NEXT[t.type]; stageMoved(t); var nt = nx ? S.tasks.filter(function (x) { return x.cust === t.cust && x.type === nx && x.status === "open"; })[0] : null; after(); toast("<b>" + esc(t.cust) + ": stage already moved in the CRM.</b> " + esc(t.type) + " closed automatically, so Rahul isn't asked to redo it." + (nt ? " Next step created: <b>" + esc(nx) + "</b>, due day " + nt.due + (nt.due > S.day ? ", waiting in Inbox." : ", in Today.") : " That was the last step for this deal."), "ok"); } else openSheet(t, a.dataset.a); return; }
    var r = e.target.closest("[data-r]"); if (r && sheet) { var bk = $("sh-blk"); if (reschedule(sheet.t, +r.dataset.r, bk ? bk.value : "")) closeSheet(); else $("sheet").querySelector("b").textContent = "Choose a blocker first"; after(); return; }
    if (e.target.closest("[data-go]") && sheet) { if (hold(sheet.t, $("sh-reason").value, +$("sh-days").value)) closeSheet(); else $("sheet").querySelector("b").textContent = "Choose a reason and a revisit date"; after(); return; }
    if (e.target.closest("[data-x]")) closeSheet();
  });
})();
