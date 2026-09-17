import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

// Backend API base URL — set VITE_API_URL in .env for production
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
// Free key from https://carto.com/basemaps/apikey — required since CARTO started
// watermarking unauthenticated raster tile requests ("API KEY REQUIRED").
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || '';

function authHeader() {
  const t = localStorage.getItem('rvf_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// GPS works on HTTPS and on localhost (dev); on native platform it's always available
const GPS_NEEDS_HTTPS =
  !Capacitor.isNativePlatform() &&
  window.location.protocol !== 'https:' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const C = {
  bg:     "#06090f",
  card:   "#0d1421",
  card2:  "#131e30",
  border: "rgba(255,255,255,0.07)",
  accent: "#00e5a0",
  aLow:   "rgba(0,229,160,0.10)",
  blue:   "#4dabf7",
  orange: "#ff6b35",
  purple: "#9775fa",
  yellow: "#fcc419",
  red:    "#ff6b6b",
  green:  "#51cf66",
  text:   "#e9ecef",
  sub:    "#5c7080",
  font:   "'DM Sans', sans-serif",
  head:   "'Space Grotesk', sans-serif",
};

// ─── DATA ─────────────────────────────────────────────────────────────────────
const SPORTS = [
  { id:"football",   label:"Football",   emoji:"⚽", color:"#4dabf7" },
  { id:"basketball", label:"Basketball", emoji:"🏀", color:"#ff6b35" },
  { id:"tennis",     label:"Tennis",     emoji:"🎾", color:"#51cf66" },
  { id:"rugby",      label:"Rugby",      emoji:"🏉", color:"#9775fa" },
  { id:"padel",      label:"Padel",      emoji:"🏸", color:"#f783ac" },
  { id:"badminton",  label:"Badminton",  emoji:"🏸", color:"#fcc419" },
  { id:"pingpong",   label:"Ping-pong",  emoji:"🏓", color:"#22d3ee" },
  { id:"volleyball", label:"Volleyball", emoji:"🏐", color:"#fb923c" },
];

const LEVELS     = ["Débutant","Amateur","Intermédiaire","Confirmé","Expert"];
const LEVEL_KEYS = ["beginner","amateur","intermediate","confirmed","expert"];
const DAYS       = ["mon","tue","wed","thu","fri","sat","sun"];
const HOURS  = ["08h","10h","12h","14h","16h","18h","20h","22h"];
const SURF_KEYS = {
  "Gazon naturel":"gazon_naturel", "Gazon synthétique":"gazon_synthetique",
  "Terre battue":"terre_battue", "Béton":"beton", "Parquet":"parquet",
  "Sable":"sable", "Moquette":"moquette", "Dur":"dur", "Gazon":"gazon",
};


const TEAMS_DATA = [
  { id:1, name:"Les Aigles FC",  sport:"football",   open:true,  level:"Amateur",       avatar:"🦅", captainId:"u1", city:"Paris"   },
  { id:2, name:"Slam Dunkers",   sport:"basketball", open:true,  level:"Intermédiaire", avatar:"🏀", captainId:"u2", city:"Paris"   },
  { id:3, name:"Ace Club",       sport:"tennis",     open:false, level:"Confirmé",      avatar:"🎾", captainId:"u3", city:"Berlin"  },
  { id:4, name:"Bulldogs Rugby", sport:"rugby",      open:true,  level:"Senior",        avatar:"🏉", captainId:"u4", city:"Londres" },
  { id:5, name:"FC Parisiens",   sport:"football",   open:true,  level:"Intermédiaire", avatar:"⚽", captainId:"u6", city:"Paris"   },
];

// Seeded roster per team (mutable — accepted requests are appended)
const ROSTER = {
  1: [
    { id:"u1", name:"Alex Martin", city:"Paris",  level:"Intermédiaire", captain:true },
    { id:"u2", name:"Lucas M.",    city:"Paris",  level:"Amateur" },
    { id:"u4", name:"Tom B.",      city:"Londres",level:"Intermédiaire" },
    { id:"u5", name:"Jade R.",     city:"Rio",    level:"Expert" },
  ],
  2: [
    { id:"u2", name:"Lucas M.",    city:"Paris",  level:"Amateur",       captain:true },
    { id:"u7", name:"Noé V.",      city:"Tokyo",  level:"Amateur" },
  ],
  3: [
    { id:"u3", name:"Sara K.",     city:"Berlin", level:"Confirmé",      captain:true },
    { id:"u6", name:"Carlos M.",   city:"Madrid", level:"Confirmé" },
    { id:"u1", name:"Alex Martin", city:"Paris",  level:"Intermédiaire" },
  ],
  4: [
    { id:"u4", name:"Tom B.",      city:"Londres",level:"Intermédiaire", captain:true },
    { id:"u5", name:"Jade R.",     city:"Rio",    level:"Expert" },
    { id:"u2", name:"Lucas M.",    city:"Paris",  level:"Amateur" },
  ],
  5: [
    { id:"u6", name:"Carlos M.",   city:"Madrid", level:"Confirmé",      captain:true },
    { id:"u7", name:"Noé V.",      city:"Tokyo",  level:"Amateur" },
    { id:"u4", name:"Tom B.",      city:"Londres",level:"Intermédiaire" },
  ],
};

const SEED_PLAYERS = [
  { name:"Lucas M.",  flag:"🇫🇷" },
  { name:"Sara K.",   flag:"🇩🇪" },
  { name:"Tom B.",    flag:"🇬🇧" },
  { name:"Jade R.",   flag:"🇧🇷" },
  { name:"Noé V.",    flag:"🇯🇵" },
  { name:"Carlos M.", flag:"🇪🇸" },
];

const PAST_MATCHES = [
  { id:"pm1", fromTeamId:1, fromTeamName:"Les Aigles FC", fromTeamAvatar:"🦅", toTeamId:4, toTeamName:"Bulldogs Rugby", toTeamAvatar:"🏉", sport:"football", date:"15 mai", terrainName:"Stade Charléty",    terrainCity:"Paris", scoreFrom:3, scoreTo:1 },
  { id:"pm2", fromTeamId:5, fromTeamName:"FC Parisiens",  fromTeamAvatar:"⚽", toTeamId:1, toTeamName:"Les Aigles FC",  toTeamAvatar:"🦅", sport:"football", date:"28 avr", terrainName:"Terrain Ladoumègue", terrainCity:"Paris", scoreFrom:2, scoreTo:1 },
  { id:"pm3", fromTeamId:1, fromTeamName:"Les Aigles FC", fromTeamAvatar:"🦅", toTeamId:2, toTeamName:"Slam Dunkers",  toTeamAvatar:"🏀", sport:"football", date:"10 avr", terrainName:"Stade Charléty",    terrainCity:"Paris", scoreFrom:2, scoreTo:2 },
];

const REFERRAL_LEVELS = [
  { level:1, name:"Recrue",      min:0,  badge:"",   color:"#888888" },
  { level:2, name:"Ambassadeur", min:3,  badge:"🥉", color:"#cd7f32" },
  { level:3, name:"Capitaine",   min:10, badge:"🥈", color:"#b0b0b0" },
  { level:4, name:"Légende",     min:25, badge:"🥇", color:"#ffd700" },
  { level:5, name:"Star",        min:50, badge:"💎", color:"#4fc3f7" },
];
const getReferralLevel = count => [...REFERRAL_LEVELS].reverse().find(l=>count>=l.min) || REFERRAL_LEVELS[0];
const makeReferralCode  = name  => (name.replace(/\s+/g,"").toUpperCase().slice(0,6)+Math.floor(1000+Math.random()*9000));

// ── XP / LEVEL SYSTEM ─────────────────────────────────────────────────────────
const XP_LEVELS = (() => {
  const tbl=[0,100,300,600,1000,1500,2000,2700,3500,4500,5500,6600,7800,9100,10500,12000,13600,15300,17100,19000];
  const lvs=tbl.map((xp,i)=>({level:i+1,xp}));
  for(let i=20;i<50;i++) lvs.push({level:i+1,xp:19000+(i-19)*2000});
  return lvs;
})();
const getXpLevel = xp => [...XP_LEVELS].reverse().find(l=>xp>=l.xp)||XP_LEVELS[0];
const XP_REWARDS = { terrain:50, visit:20, match:30, referral:100 };

// ── SPECIALIZED BADGES ────────────────────────────────────────────────────────
const BADGE_DEFS = [
  { id:"builder",    emoji:"🏗️", nameKey:"badges.builder",    descKey:"badges.builder_desc",    tiers:[{min:5,medal:"🥉",labelKey:"badges.bronze"},{min:15,medal:"🥈",labelKey:"badges.silver"},{min:30,medal:"🥇",labelKey:"badges.gold"}],    stat:u=>u.terrains||0 },
  { id:"explorer",   emoji:"🌍", nameKey:"badges.explorer",   descKey:"badges.explorer_desc",   tiers:[{min:5,medal:"🥉",labelKey:"badges.bronze"},{min:15,medal:"🥈",labelKey:"badges.silver"},{min:30,medal:"🥇",labelKey:"badges.gold"}],    stat:u=>u.citiesVisited||0 },
  { id:"competitor", emoji:"⚽", nameKey:"badges.competitor", descKey:"badges.competitor_desc", tiers:[{min:10,medal:"🥉",labelKey:"badges.bronze"},{min:30,medal:"🥈",labelKey:"badges.silver"},{min:75,medal:"🥇",labelKey:"badges.gold"}],   stat:u=>u.matchs||0 },
  { id:"recruiter",  emoji:"🤝", nameKey:"badges.recruiter",  descKey:"badges.recruiter_desc",  tiers:[{min:3,medal:"🥉",labelKey:"badges.bronze"},{min:10,medal:"🥈",labelKey:"badges.silver"},{min:25,medal:"🥇",labelKey:"badges.gold"}],    stat:u=>u.referralCount||0 },
];
const getBadgeTier   = (def,u) => { let t=null; for(const x of def.tiers){if(def.stat(u)>=x.min)t=x;} return t; };
const getUserBadges  = u => BADGE_DEFS.map(d=>({def:d,tier:getBadgeTier(d,u)}));
const getEarnedBadges = u => getUserBadges(u).filter(x=>x.tier);
const getUserTopBadge = u => { const bs=getEarnedBadges(u); return bs.length?bs[bs.length-1].tier.medal:""; };

// ── NAME COLORS ───────────────────────────────────────────────────────────────
const NAME_COLORS = [
  {id:"default", label:"Défaut",      value:null,       minLevel:1,  special:null},
  {id:"silver",  label:"Argent",      value:"#A8B5C8",  minLevel:1,  special:null},
  {id:"blue",    label:"Bleu",        value:"#4DABF7",  minLevel:6,  special:null},
  {id:"green",   label:"Vert",        value:"#51CF66",  minLevel:6,  special:null},
  {id:"purple",  label:"Violet",      value:"#CC5DE8",  minLevel:11, special:null},
  {id:"orange",  label:"Orange",      value:"#FF922B",  minLevel:11, special:null},
  {id:"pink",    label:"Rose",        value:"#F783AC",  minLevel:11, special:null},
  {id:"gold",    label:"Or ✨",       value:"gold",     minLevel:21, special:"gold"},
  {id:"rainbow", label:"Arc-en-ciel", value:"rainbow",  minLevel:21, special:"rainbow"},
];
const getUserNameColor = name => { const u=DB.find(x=>x.name===name); return u?.nameColor||null; };

const CITIES = {
  "paris":[48.856,2.352],"marseille":[43.296,5.369],"lyon":[45.764,4.835],
  "toulouse":[43.604,1.444],"nice":[43.710,7.262],"bordeaux":[44.837,-0.579],
  "lille":[50.629,3.057],"nantes":[47.218,-1.553],"strasbourg":[48.573,7.752],
  "london":[51.507,-0.127],"londre":[51.507,-0.127],"madrid":[40.416,-3.703],
  "barcelone":[41.385,2.173],"barcelona":[41.385,2.173],"rome":[41.902,12.496],
  "berlin":[52.520,13.405],"amsterdam":[52.367,4.904],"milan":[45.465,9.185],
  "new york":[40.712,-74.006],"tokyo":[35.676,139.650],"dubai":[25.204,55.270],
  "rio":[-22.906,-43.172],"sydney":[-33.868,151.209],
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
// Populated at runtime from the Supabase `profiles` table and the Express `/api/users` route —
// no hardcoded demo accounts, so friend search only ever shows real registered users.
const DB = [];

const getUserBadge = name => { const u=DB.find(x=>x.name===name); return u?getReferralLevel(u.referralCount||0).badge:""; };

const pause = ms => new Promise(r => setTimeout(r, ms));

// Returns true if the backend is reachable
async function backendOnline() {
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

async function login(email, pwd) {
  // Fallback: Express backend
  if (await backendOnline()) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pwd }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || i18n.t('auth.login_failed'));
    localStorage.setItem('rvf_token', d.token);
    return d.user;
  }
  // Fallback: local mock DB (dev / no backend)
  await pause(500);
  const u = DB.find(u => u.email === email && u.password === pwd);
  if (!u) throw new Error('Email ou mot de passe incorrect.');
  return { ...u };
}

async function register(form) {
  const refCode      = new URLSearchParams(window.location.search).get("ref");
  const referralCode = makeReferralCode(form.name);

  const creditReferrer = async (uid) => {
    if (!refCode) return;
    const referrer = DB.find(u=>u.referralCode===refCode);
    if (referrer) {
      referrer.referralCount = (referrer.referralCount||0)+1;
      addXP(referrer.id, XP_REWARDS.referral);
    }
  };
  // Fallback: Express backend
  if (await backendOnline()) {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ref: refCode || undefined }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || i18n.t('auth.register_failed'));
    localStorage.setItem('rvf_token', d.token);
    return d.user;
  }
  // Fallback: local mock DB
  await pause(500);
  if (DB.find(u => u.email === form.email)) throw new Error(i18n.t('auth.email_in_use'));
  const u = { id: 'u' + Date.now(), terrains: 0, matchs: 0, teams: 0, avatar: null, referralCode, referralCount: 0, referredBy: refCode||null, ...form };
  await creditReferrer(u.id);
  DB.push(u);
  return { ...u };
}

// ─── STORES ───────────────────────────────────────────────────────────────────
function createStore(init = {}) {
  const store = { ...init, _subs: [] };
  store.subscribe = fn => {
    store._subs.push(fn);
    return () => { store._subs = store._subs.filter(s => s !== fn); };
  };
  store.notify = () => store._subs.forEach(fn => fn());
  return store;
}

// ─── XP STORE ─────────────────────────────────────────────────────────────────
const XP_STORE       = createStore({});
const PROFILES_STORE = createStore({});
const addXP = (userId, amount) => {
  const u = DB.find(x=>x.id===userId);
  if (!u) return;
  u.xp = (u.xp||0)+amount;
  XP_STORE.notify();
};

// Realtime presence
const RT = createStore({ slots:{}, photos:{} });
RT.join = (tid, key, player) => {
  if (!RT.slots[tid]) RT.slots[tid] = {};
  const list = RT.slots[tid][key] || [];
  if (!list.find(p => p.name===player.name)) {
    RT.slots[tid][key] = [...list, { ...player, at: new Date().toISOString() }];
    RT.notify();
  }
};
RT.leave = (tid, key, name) => {
  if (!RT.slots[tid]) return;
  RT.slots[tid][key] = (RT.slots[tid][key]||[]).filter(p => p.name!==name);
  RT.notify();
};
RT.addPhoto = (tid, photo) => {
  if (!RT.photos[tid]) RT.photos[tid] = [];
  RT.photos[tid] = [photo, ...RT.photos[tid]];
  RT.notify();
};
RT.like = (tid, pid, name) => {
  RT.photos[tid] = (RT.photos[tid]||[]).map(p => {
    if (p.id !== pid) return p;
    const liked = p.likedBy.includes(name);
    return { ...p, likes: liked?p.likes-1:p.likes+1, likedBy: liked?p.likedBy.filter(n=>n!==name):[...p.likedBy,name] };
  });
  RT.notify();
};

// Messages — backed by the Express /api/messages route (Postgres direct_messages table)
const CHAT = createStore({ convs:{}, convList:[] });
CHAT.cid = (a,b) => [String(a),String(b)].sort().join("::");
CHAT.loadConversations = async myId => {
  try {
    const res = await fetch(`${API}/api/messages/conversations`, { headers: authHeader() });
    if (!res.ok) return;
    CHAT.convList = await res.json();
    CHAT.notify();
  } catch {}
};
CHAT.loadThread = async (myId, otherId) => {
  try {
    const res = await fetch(`${API}/api/messages/${otherId}`, { headers: authHeader() });
    if (!res.ok) return;
    const msgs = await res.json();
    CHAT.convs[CHAT.cid(myId,otherId)] = msgs;
    CHAT.notify();
  } catch {}
};
CHAT.send = async (from, to, text) => {
  try {
    const res = await fetch(`${API}/api/messages/${to}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ content: text }),
    });
    if (!res.ok) return;
    const msg = await res.json();
    const id = CHAT.cid(from,to);
    CHAT.convs[id] = [...(CHAT.convs[id]||[]), msg];
    CHAT.notify();
    await CHAT.loadConversations(from);
  } catch {}
};
CHAT.markRead = async (cid, myId) => {
  const other = cid.split("::").find(id=>id!==String(myId));
  if (!other) return;
  try {
    await fetch(`${API}/api/messages/${other}/read`, { method:'POST', headers: authHeader() });
    if (CHAT.convs[cid]) CHAT.convs[cid] = CHAT.convs[cid].map(m => String(m.to)!==String(myId) ? m : {...m,read:true});
    CHAT.convList = CHAT.convList.map(c => c.id!==cid ? c : {...c, unread:0});
    CHAT.notify();
  } catch {}
};
CHAT.list = () => CHAT.convList;
CHAT.totalUnread = () => CHAT.convList.reduce((s,c)=>s+(c.unread||0),0);

// Team chat — backed by the Express /api/teams/:id/messages route (Postgres team_messages table)
const TEAM_CHAT = createStore({ byTeam:{}, lastRead:{} });
TEAM_CHAT.loadMessages = async teamId => {
  try {
    const res = await fetch(`${API}/api/teams/${teamId}/messages`, { headers: authHeader() });
    if (!res.ok) return;
    const rows = await res.json();
    const remote = rows.map(m => ({ id:m.id, userId:m.user_id, from:m.user_name, text:m.content, ts:m.created_at }));
    // Keep optimistic tmp_ messages not yet confirmed by the server
    const existing = TEAM_CHAT.byTeam[teamId] || [];
    const pending = existing.filter(m => String(m.id).startsWith('tmp_'));
    TEAM_CHAT.byTeam[teamId] = [...remote, ...pending].sort((a,b)=>a.ts.localeCompare(b.ts));
    TEAM_CHAT.notify();
  } catch {}
};
TEAM_CHAT.sendMessage = async (teamId, userId, userName, text) => {
  const tmpId = `tmp_${Date.now()}`;
  TEAM_CHAT.byTeam[teamId] = [...(TEAM_CHAT.byTeam[teamId]||[]), { id:tmpId, userId, from:userName, text, ts:new Date().toISOString() }];
  TEAM_CHAT.notify();
  const replace = patch => {
    const ex = TEAM_CHAT.byTeam[teamId] || [];
    TEAM_CHAT.byTeam[teamId] = ex.map(m => m.id===tmpId ? patch(m) : m);
    TEAM_CHAT.notify();
  };
  try {
    const res = await fetch(`${API}/api/teams/${teamId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ content: text }),
    });
    if (!res.ok) { replace(m => ({ ...m, failed:true })); return; }
    const m = await res.json();
    replace(() => ({ id:m.id, userId:m.user_id, from:m.user_name, text:m.content, ts:m.created_at }));
  } catch {
    replace(m => ({ ...m, failed:true }));
  }
};
TEAM_CHAT.messages = teamId => TEAM_CHAT.byTeam[teamId] || [];
TEAM_CHAT.markRead = (teamId, userId) => {
  if (!TEAM_CHAT.lastRead[teamId]) TEAM_CHAT.lastRead[teamId] = {};
  TEAM_CHAT.lastRead[teamId][userId] = new Date().toISOString();
  TEAM_CHAT.notify();
};
TEAM_CHAT.unread = (teamId, userId) => {
  const msgs = TEAM_CHAT.byTeam[teamId] || [];
  const lr = TEAM_CHAT.lastRead[teamId]?.[userId] || "1970-01-01";
  return msgs.filter(m => m.userId !== userId && m.ts > lr).length;
};
TEAM_CHAT.totalUnread = (userId, teamIds) =>
  teamIds.reduce((s, tid) => s + TEAM_CHAT.unread(tid, userId), 0);

// Invitations
const INV = createStore({ list:[] });
let _invCounter = 0;
INV.send = invite => {
  INV.list = [...INV.list, { ...invite, id:`inv_${Date.now()}_${++_invCounter}`, status:"pending", ts:new Date().toISOString() }];
  INV.notify();
};
INV.respond = (id, status) => {
  INV.list = INV.list.map(i => i.id===id ? {...i,status} : i);
  INV.notify();
};
INV.forUser  = name => INV.list.filter(i => i.to===name);
INV.fromUser = name => INV.list.filter(i => i.from===name);
INV.pending  = name => INV.list.filter(i => i.to===name&&i.status==="pending").length;

// Bookings
const BOOK = createStore({ list:[] });
BOOK.add = b => { BOOK.list = [...BOOK.list, {...b,id:Date.now(),ts:new Date().toISOString()}]; BOOK.notify(); };
BOOK.cancel = id => { BOOK.list = BOOK.list.filter(b=>b.id!==id); BOOK.notify(); };
BOOK.forTerrain = tid => BOOK.list.filter(b=>b.terrainId===tid);
BOOK.forUser = name => BOOK.list.filter(b=>b.user===name);

// Match score requests (after each ended slot)
const MATCH_SCORE = createStore({ list:[] });
let _msCounter = 0;
MATCH_SCORE.add = req => {
  const key = `${req.terrainId}-${req.day}-${req.hour}`;
  if (MATCH_SCORE.list.some(r=>`${r.terrainId}-${r.day}-${r.hour}`===key)) return;
  MATCH_SCORE.list = [...MATCH_SCORE.list, { ...req, id:`ms_${Date.now()}_${++_msCounter}`, status:"pending", score:null, reportedBy:null, ts:new Date().toISOString() }];
  MATCH_SCORE.notify();
};
MATCH_SCORE.submit = (id, score, reportedBy) => {
  MATCH_SCORE.list = MATCH_SCORE.list.map(r => r.id===id ? {...r, status:"scored", score, reportedBy} : r);
  MATCH_SCORE.notify();
};
MATCH_SCORE.forUser       = name => MATCH_SCORE.list.filter(r => r.participants.includes(name));
MATCH_SCORE.pendingForUser = name => MATCH_SCORE.list.filter(r => r.participants.includes(name) && r.status==="pending").length;
MATCH_SCORE._result = (r, name) => {
  const [a, b] = r.score.split(" - ").map(Number);
  const half = Math.ceil(r.participants.length / 2);
  const inA  = r.participants.slice(0, half).includes(name);
  const me = inA ? a : b, opp = inA ? b : a;
  return me > opp ? "w" : me < opp ? "l" : "d";
};
MATCH_SCORE.recordForUser = name => {
  const done = MATCH_SCORE.list.filter(r => r.participants.includes(name) && r.status==="scored");
  return done.reduce((acc, r) => { acc[MATCH_SCORE._result(r,name)]++; return acc; }, {w:0,l:0,d:0});
};
MATCH_SCORE.recordBySport = name => {
  const done = MATCH_SCORE.list.filter(r => r.participants.includes(name) && r.status==="scored");
  const out  = {};
  done.forEach(r => {
    const s = r.terrainSport || "football";
    if (!out[s]) out[s] = {w:0,l:0,d:0};
    out[s][MATCH_SCORE._result(r,name)]++;
  });
  return out;
};

// Team join requests
const TEAM_REQ = createStore({ list:[] });
let _teamReqCounter = 0;
TEAM_REQ.send = req => {
  TEAM_REQ.list = [...TEAM_REQ.list, { ...req, id:`tr_${Date.now()}_${++_teamReqCounter}`, status:"pending", ts:new Date().toISOString() }];
  TEAM_REQ.notify();
};
TEAM_REQ.respond = (id, status) => {
  TEAM_REQ.list = TEAM_REQ.list.map(r => r.id===id ? {...r,status} : r);
  TEAM_REQ.notify();
};
TEAM_REQ.forTeam           = teamId => TEAM_REQ.list.filter(r => r.teamId===teamId);
TEAM_REQ.fromUser          = userId => TEAM_REQ.list.filter(r => r.fromUserId===userId);
TEAM_REQ.userPending       = (userId,teamId) => TEAM_REQ.list.some(r => r.fromUserId===userId && r.teamId===teamId && r.status==="pending");
TEAM_REQ.userAccepted      = (userId,teamId) => TEAM_REQ.list.some(r => r.fromUserId===userId && r.teamId===teamId && r.status==="accepted");
TEAM_REQ.pendingForCaptain = userId => TEAM_REQ.list.filter(r => r.captainId===userId && r.status==="pending").length;
TEAM_REQ.reqsForCaptain    = userId => TEAM_REQ.list.filter(r => r.captainId===userId && r.status==="pending");
TEAM_REQ.teamMemberCount   = teamId => (ROSTER[teamId]?.length||0) + TEAM_REQ.list.filter(r=>r.teamId===teamId&&r.status==="accepted").length;

// Match challenges (team vs team)
const MATCH_REQ = createStore({ list:[] });
let _matchReqCounter = 0;
MATCH_REQ.send = req => {
  MATCH_REQ.list = [...MATCH_REQ.list, { ...req, id:`mr_${Date.now()}_${++_matchReqCounter}`, status:"pending", ts:new Date().toISOString() }];
  MATCH_REQ.notify();
};
MATCH_REQ.respond = (id, status) => {
  MATCH_REQ.list = MATCH_REQ.list.map(r => r.id===id ? {...r,status} : r);
  MATCH_REQ.notify();
};
MATCH_REQ.hasPending = (fromTeamId, toTeamId) =>
  MATCH_REQ.list.some(r => r.fromTeamId===fromTeamId && r.toTeamId===toTeamId && r.status==="pending");
MATCH_REQ.hasPendingSolo = (fromUserId, toTeamId) =>
  MATCH_REQ.list.some(r => r.isSolo && r.fromUserId===fromUserId && r.toTeamId===toTeamId && r.status==="pending");
MATCH_REQ.hasPendingFriend = (fromUserId, toUserId) =>
  MATCH_REQ.list.some(r => r.isFriend && r.fromUserId===fromUserId && r.toUserId===toUserId && r.status==="pending");
MATCH_REQ.friendChallengesFor = userId =>
  MATCH_REQ.list.filter(r => r.isFriend && r.toUserId===userId && r.status==="pending");

// ─── SEED ─────────────────────────────────────────────────────────────────────
setTimeout(() => {
  INV.send({from:"Lucas M.", to:"Alex Martin", terrainId:3, terrainName:"Playground Pigalle", sport:"basketball", day:"sat", hour:"14h", note:"On fait une partie ? On est déjà 3 🏀"});
  INV.send({from:"Carlos M.",to:"Alex Martin", terrainId:1, terrainName:"Stade Charléty",    sport:"football",   day:"sun", hour:"10h", note:"Match amical dimanche matin ⚽"});
  // Historique visites Alex Martin (demo)
  BOOK.add({ user:"Alex Martin", terrainId:1, day:"mon", hour:"18h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:3, day:"sat", hour:"14h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:2, day:"wed", hour:"10h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:7, day:"thu", hour:"20h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:11, day:"sun", hour:"12h", note:"" });
  // Score requests for past slots
  MATCH_SCORE.add({ terrainId:1,  terrainName:"Stade Charléty",     terrainSport:"football",   day:"mon", hour:"18h", participants:["Alex Martin","Lucas M.","Carlos M.","Sara K.","Tom B."] });
  MATCH_SCORE.add({ terrainId:3,  terrainName:"Playground Pigalle",  terrainSport:"basketball", day:"sat", hour:"14h", participants:["Alex Martin","Lucas M.","Jade R.","Noé V."] });
  MATCH_SCORE.add({ terrainId:2,  terrainName:"Court Lenglen",       terrainSport:"tennis",     day:"wed", hour:"10h", participants:["Alex Martin","Sara K."] });
  // Simulated join request: Jade R. wants to join Les Aigles FC (captain = u1 = demo account)
  TEAM_REQ.send({ fromUserId:"u5", fromName:"Jade R.", teamId:1, teamName:"Les Aigles FC", sport:"football", captainId:"u1", message:"Salut ! Je voudrais rejoindre votre équipe, j'ai 5 ans d'expérience en football 🦅⚽" });
  // Simulated join request: Carlos M. also wants to join Les Aigles FC
  TEAM_REQ.send({ fromUserId:"u6", fromName:"Carlos M.", teamId:1, teamName:"Les Aigles FC", sport:"football", captainId:"u1", message:"Bonjour, intéressé pour rejoindre l'équipe ! Je joue milieu de terrain." });
  // Seeded match challenge: FC Parisiens defies Les Aigles FC
  MATCH_REQ.send({ fromTeamId:5, fromTeamName:"FC Parisiens", fromCaptainId:"u6", fromCaptainName:"Carlos M.", toTeamId:1, toTeamName:"Les Aigles FC", toCaptainId:"u1", sport:"football", day:"sat", hour:"16h", terrainId:1, terrainName:"Stade Charléty", terrainCity:"Paris", message:"Salut les Aigles ! On vous défie pour un match amical ⚔️⚽" });
  // Team chat seeds
  const t0 = Date.now();
  TEAM_CHAT.byTeam[1] = [
    { id:"tc1_1", userId:"u2", from:"Lucas M.",    text:"Salut les Aigles ! ⚽ On a match samedi, tout le monde dispo ?", ts:new Date(t0-7200000).toISOString() },
    { id:"tc1_2", userId:"u4", from:"Tom B.",      text:"Présent ! 💪", ts:new Date(t0-6900000).toISOString() },
    { id:"tc1_3", userId:"u5", from:"Jade R.",     text:"Moi aussi, j'arrive de Rio la semaine prochaine 🌊", ts:new Date(t0-6600000).toISOString() },
    { id:"tc1_4", userId:"u1", from:"Alex Martin", text:"Super, je réserve le terrain 🏟️", ts:new Date(t0-6300000).toISOString() },
    { id:"tc1_5", userId:"u2", from:"Lucas M.",    text:"Génial, à samedi alors 🤝", ts:new Date(t0-6000000).toISOString() },
  ];
  TEAM_CHAT.byTeam[3] = [
    { id:"tc3_1", userId:"u3", from:"Sara K.",    text:"Training demain 10h au Court Lenglen 🎾", ts:new Date(t0-3600000).toISOString() },
    { id:"tc3_2", userId:"u6", from:"Carlos M.", text:"OK je serai là, j'ai de nouvelles balles 😄", ts:new Date(t0-3300000).toISOString() },
    { id:"tc3_3", userId:"u3", from:"Sara K.",   text:"Parfait ! Alex tu viens aussi ?", ts:new Date(t0-3000000).toISOString() },
  ];
  // Alex has read team 1 fully; in team 3 he's seen only the first message
  TEAM_CHAT.lastRead[1] = { u1: new Date(t0-5900000).toISOString() };
  TEAM_CHAT.lastRead[3] = { u1: new Date(t0-3500000).toISOString() };
  TEAM_CHAT.notify();
}, 300);

// Returns all sport IDs for a terrain (handles legacy single-string and new array)
const terrainSports = t => (t.sports?.length ? t.sports : [t.sport]).filter(Boolean);

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useStore(store) {
  const [, set] = useState(0);
  useEffect(() => store.subscribe(() => set(n=>n+1)), [store]);
}

function timeAgo(iso) {
  const t = i18n.t.bind(i18n);
  const s = (Date.now()-new Date(iso))/1000;
  if (s<60)    return t('common.just_now');
  if (s<3600)  return Math.floor(s/60)+t('common.min_ago');
  if (s<86400) return Math.floor(s/3600)+t('common.h_ago');
  return Math.floor(s/86400)+t('common.days_ago');
}

function haversine(la1,lo1,la2,lo2) {
  const R=6371, dL=(la2-la1)*Math.PI/180, dO=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function useIsMobile() {
  const [m,setM] = useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const h=()=>setM(window.innerWidth<768);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);
  return m;
}

// cx/cy = centre de la zone en % du conteneur SVG (espace mapX/mapY)
// Returns country-level zoom when possible, falls back to continent
function getLocationZoom(lat, lng) {
  // ── Pays / régions ──────────────────────────────────────────────────────────
  if (lat>=41   && lat<=51.5 && lng>=-5  && lng<=10 ) return { cx:46.2, cy:28.5, scale:8   }; // France
  if (lat>=35   && lat<=44   && lng>=-10 && lng<=5  ) return { cx:45.2, cy:30.5, scale:7   }; // Ibérique
  if (lat>=50   && lat<=61   && lng>=-11 && lng<=2  ) return { cx:45.3, cy:25.5, scale:9   }; // UK / Irlande
  if (lat>=45   && lat<=56   && lng>=5   && lng<=17 ) return { cx:47.5, cy:25.5, scale:8   }; // Allemagne / BeNeLux / Suisse
  if (lat>=36   && lat<=47   && lng>=6   && lng<=19 ) return { cx:47.8, cy:30,   scale:9   }; // Italie
  if (lat>=55   && lat<=72   && lng>=4   && lng<=32 ) return { cx:48,   cy:20,   scale:6   }; // Scandinavie
  if (lat>=44   && lat<=56   && lng>=14  && lng<=30 ) return { cx:49,   cy:25,   scale:7   }; // Europe de l'Est
  if (lat>=36   && lat<=43   && lng>=26  && lng<=45 ) return { cx:53,   cy:30,   scale:7   }; // Turquie
  if (lat>=22   && lat<=30   && lng>=45  && lng<=60 ) return { cx:59,   cy:34.5, scale:10  }; // Golfe / Émirats
  if (lat>=8    && lat<=36   && lng>=65  && lng<=90 ) return { cx:66,   cy:37,   scale:5   }; // Inde
  if (lat>=-10  && lat<=22   && lng>=96  && lng<=130) return { cx:73.2, cy:40,   scale:6   }; // Asie du Sud-Est
  if (lat>=30   && lat<=46   && lng>=128 && lng<=146) return { cx:78.5, cy:29,   scale:9   }; // Japon / Corée
  if (lat>=25   && lat<=45   && lng>=100 && lng<=128) return { cx:76,   cy:31,   scale:6   }; // Chine / Shanghai
  if (lat>=25   && lat<=50   && lng>=-90 && lng<=-60) return { cx:25.5, cy:28,   scale:5   }; // USA Est
  if (lat>=15   && lat<=52   && lng>=-130&& lng<=-90) return { cx:18,   cy:27,   scale:5   }; // USA Ouest / Mexique
  if (lat>=-35  && lat<=-5   && lng>=-60 && lng<=-34) return { cx:33.5, cy:52,   scale:5   }; // Brésil
  if (lat>=-55  && lat<=-20  && lng>=-74 && lng<=-50) return { cx:30,   cy:57,   scale:5   }; // Argentine / Chili
  if (lat>=-44  && lat<=-10  && lng>=110 && lng<=155) return { cx:82.5, cy:56,   scale:5   }; // Australie
  if (lat>=18   && lat<=38   && lng>=-20 && lng<=37 ) return { cx:50,   cy:37,   scale:4   }; // Afrique du Nord
  if (lat>=-35  && lat<=12   && lng>=-20 && lng<=52 ) return { cx:52,   cy:47,   scale:4   }; // Afrique sub-saharienne
  // ── Continents (fallback) ───────────────────────────────────────────────────
  if (lat>=35   && lat<=72   && lng>=-25 && lng<=45 ) return { cx:46,   cy:24,   scale:3.8 }; // Europe
  if (lat>=10   && lat<=80   && lng>=-170&& lng<=-52) return { cx:20,   cy:27,   scale:2.6 }; // Amérique du Nord
  if (lat>=-60  && lat<=13   && lng>=-82 && lng<=-34) return { cx:31,   cy:54,   scale:3.0 }; // Amérique du Sud
  if (lat>=12   && lat<=42   && lng>=25  && lng<=65 ) return { cx:58,   cy:33,   scale:4.0 }; // Moyen-Orient
  if (lat>=-50  && lat<=10   && lng>=110 && lng<=180) return { cx:83,   cy:57,   scale:4.0 }; // Océanie
  if (lat>=-10  && lat<=77   && lng>=26  && lng<=145) return { cx:70,   cy:31,   scale:2.2 }; // Asie
  return { cx:50, cy:50, scale:1.0 }; // Monde
}

// ─── UI ATOMS ─────────────────────────────────────────────────────────────────
function Avatar({ name="?", size=36, color=C.accent, photo=null }) {
  const letters = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  if (photo) return <img src={photo} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`2px solid ${color}44`,flexShrink:0}}/>;
  return <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,background:`linear-gradient(135deg,${color}30,${color}60)`,border:`2px solid ${color}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:700,color,fontFamily:C.head}}>{letters}</div>;
}

function PadelRacket({ size=20, color="currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{display:"inline-block",verticalAlign:"middle",flexShrink:0}}>
      <rect x="2.5" y="1" width="15" height="12" rx="4" fill="none" stroke={color} strokeWidth="1.7"/>
      <circle cx="7"  cy="5.5" r="1.1" fill={color}/>
      <circle cx="10" cy="5.5" r="1.1" fill={color}/>
      <circle cx="13" cy="5.5" r="1.1" fill={color}/>
      <circle cx="7"  cy="9"   r="1.1" fill={color}/>
      <circle cx="10" cy="9"   r="1.1" fill={color}/>
      <circle cx="13" cy="9"   r="1.1" fill={color}/>
      <rect x="8.8" y="13" width="2.4" height="6" rx="1.2" fill={color}/>
    </svg>
  );
}

function SportEmoji({ sport, size=18 }) {
  if (!sport) return null;
  if (sport.id==="padel") return <PadelRacket size={size} color={sport.color}/>;
  return <span style={{fontSize:size,lineHeight:1,display:"inline-block"}}>{sport.emoji}</span>;
}

function Badge({ label, color }) {
  return <span style={{background:`${color}18`,color,border:`1px solid ${color}35`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;
}

function Chip({ children, active, onClick, color=C.accent, sm=false }) {
  return <button onClick={onClick} style={{background:active?`${color}18`:C.card2,border:`1px solid ${active?color+"50":C.border}`,borderRadius:sm?6:8,padding:sm?"3px 7px":"6px 13px",fontSize:sm?10:12,color:active?color:C.sub,cursor:"pointer",fontFamily:C.font,fontWeight:600,transition:"all .15s"}}>{children}</button>;
}

function Field({ label, type="text", value, onChange, placeholder, error, icon, hint }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label && <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>{label}</label>}
      <div style={{position:"relative"}}>
        {icon && <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,opacity:.5,pointerEvents:"none"}}>{icon}</span>}
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
          style={{width:"100%",background:C.card2,border:`1.5px solid ${error?C.red:focus?C.accent:C.border}`,borderRadius:10,padding:`11px 14px 11px ${icon?"40px":"14px"}`,color:C.text,fontSize:14,outline:"none",fontFamily:C.font,transition:"border-color .2s"}}/>
      </div>
      {error && <span style={{fontSize:11,color:C.red}}>{error}</span>}
      {hint && !error && <span style={{fontSize:11,color:C.sub}}>{hint}</span>}
    </div>
  );
}

function Btn({ children, onClick, variant="primary", loading=false, disabled=false, full=true, style:sx={} }) {
  const styles = {
    primary: { background:disabled?C.card2:C.aLow, border:`1.5px solid ${disabled?C.border:C.accent+"60"}`, color:disabled?C.sub:C.accent },
    solid:   { background:C.accent, border:"none", color:"#06090f" },
    ghost:   { background:"transparent", border:`1.5px solid ${C.border}`, color:C.sub },
    danger:  { background:"rgba(255,107,107,.1)", border:"1.5px solid rgba(255,107,107,.35)", color:C.red },
  };
  return (
    <button onClick={disabled||loading?undefined:onClick}
      style={{width:full?"100%":"auto",padding:"12px 20px",borderRadius:10,fontSize:14,fontWeight:600,cursor:disabled||loading?"not-allowed":"pointer",fontFamily:C.font,transition:"all .2s",...styles[variant],...sx}}>
      {loading ? i18n.t('common.loading') : children}
    </button>
  );
}

function ColoredName({ name, nameColor, style={} }) {
  if (!nameColor) return <span style={style}>{name}</span>;
  if (nameColor==="gold") return (
    <span style={{...style,background:"linear-gradient(90deg,#FFD700,#FFA500,#FFD700)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>{name}</span>
  );
  if (nameColor==="rainbow") return <span className="rvf-rainbow" style={style}>{name}</span>;
  return <span style={{...style,color:nameColor}}>{name}</span>;
}

// Reusable badge: colored name + level chip + top earned badges
function UserBadge({ name, user: userProp, size="md", showLevel=true, showInsignes=true, style={} }) {
  useStore(PROFILES_STORE);
  const u = userProp || DB.find(x=>x.name===name) || { name:name||"?", xp:0, nameColor:null, referralCount:0, matchs:0, terrains:0, citiesVisited:0 };
  const lvl   = getXpLevel(u.xp||0).level;
  const lvCol = lvl>=21?"#FFD700":lvl>=11?"#CC5DE8":lvl>=6?"#4DABF7":"#888";
  const earned = getEarnedBadges(u);
  const top    = earned.length ? earned[earned.length-1] : null;
  const refBadge = getReferralLevel(u.referralCount||0).badge;
  const fs = size==="sm"?11:size==="lg"?17:13;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:4,...style}}>
      <ColoredName name={name} nameColor={u.nameColor||null} style={{fontWeight:700,fontSize:fs}}/>
      {showLevel && <span style={{fontSize:fs-3,fontWeight:700,color:lvCol,background:`${lvCol}18`,border:`1px solid ${lvCol}33`,borderRadius:4,padding:"0 4px",whiteSpace:"nowrap"}}>{i18n.t('common.niv')}{lvl}</span>}
      {showInsignes && top && <span title={`${i18n.t(top.def.nameKey)} ${i18n.t(top.tier.labelKey)}`} style={{fontSize:fs-1}}>{top.tier.medal}</span>}
      {showInsignes && refBadge && <span title={i18n.t('profile.ref_level_'+getReferralLevel(u.referralCount||0).level)} style={{fontSize:fs-1}}>{refBadge}</span>}
    </span>
  );
}

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.3)",borderRadius:8,padding:"10px 14px",color:C.red,fontSize:13}}>{msg}</div>;
}

// ─── SCREENS : AUTH ───────────────────────────────────────────────────────────
function Landing({ goLogin, goRegister }) {
  const {t} = useTranslation();
  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:32,background:"radial-gradient(ellipse at 50% -5%,rgba(0,229,160,.08) 0%,transparent 60%)"}}>
      <div style={{maxWidth:420,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:10}}>🏟️</div>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:50,letterSpacing:1,marginBottom:6}}>
          <span style={{color:C.accent}}>R</span><span style={{color:C.text}}>VF</span>
        </div>
        <p style={{color:C.sub,fontSize:15,lineHeight:1.7,marginBottom:10}}>
          {t('landing.tagline').split('\n').map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}
        </p>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:32}}>
          {SPORTS.slice(0,5).map(s=><div key={s.id} style={{width:44,height:44,borderRadius:12,background:`${s.color}18`,border:`1px solid ${s.color}30`,display:"flex",alignItems:"center",justifyContent:"center"}}><SportEmoji sport={s} size={20}/></div>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <Btn onClick={goRegister} variant="solid">{t('landing.create')}</Btn>
          <Btn onClick={goLogin} variant="ghost">{t('landing.login_existing')}</Btn>
        </div>
        <p style={{marginTop:14,fontSize:11,color:C.sub}}>{t('common.demo_hint')}</p>
      </div>
    </div>
  );
}

function LoginScreen({ onSuccess, goBack }) {
  const {t} = useTranslation();
  const [email,setEmail]     = useState("");
  const [pwd,setPwd]         = useState("");
  const [remember,setRemember] = useState(true);
  const [showPwd,setShowPwd] = useState(false);
  const [err,setErr]         = useState({});
  const [apiErr,setApiErr]   = useState("");
  const [loading,setLoading] = useState(false);

  const submit = async () => {
    const e={};
    if (!email) e.email=t('auth.required');
    if (!pwd)   e.pwd=t('auth.required');
    setErr(e);
    if (Object.keys(e).length) return;
    setLoading(true); setApiErr("");
    try {
      const u = await login(email, pwd);
      onSuccess(u);
    } catch(m) { setApiErr(m?.message||m); }
    finally { setLoading(false); }
  };

  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:400,width:"100%"}}>
        <button onClick={goBack} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:13,marginBottom:20,fontFamily:C.font}}>{t('auth.back')}</button>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:28}}>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:26,color:C.text,marginBottom:4}}>{t('auth.login_title')}</div>
          <p style={{color:C.sub,fontSize:13,marginBottom:22}}>{t('auth.login_sub')}</p>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:14}}>
            <Field label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.com" error={err.email} icon="📧"/>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>{t('auth.password')}</label>
              <div style={{position:"relative"}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,opacity:.5,pointerEvents:"none"}}>🔑</span>
                <input type={showPwd?"text":"password"} value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••••••"
                  style={{width:"100%",background:C.card2,border:`1.5px solid ${err.pwd?C.red:C.border}`,borderRadius:10,padding:"11px 44px 11px 40px",color:C.text,fontSize:14,outline:"none",fontFamily:C.font}}/>
                <button onClick={()=>setShowPwd(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.sub,fontSize:15}}>{showPwd?"🙈":"👁️"}</button>
              </div>
              {err.pwd && <span style={{fontSize:11,color:C.red}}>{err.pwd}</span>}
            </div>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:14}}>
            <div onClick={()=>setRemember(p=>!p)} style={{width:18,height:18,borderRadius:5,border:`2px solid ${remember?C.accent:C.border}`,background:remember?C.aLow:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
              {remember && <span style={{color:C.accent,fontSize:12}}>✓</span>}
            </div>
            <span style={{fontSize:13,color:C.sub}}>{t('auth.remember_me')}</span>
          </label>
          <ErrBox msg={apiErr}/>
          <div style={{marginTop:12}}><Btn onClick={submit} loading={loading}>{t('auth.connect')}</Btn></div>
          <p style={{textAlign:"center",marginTop:12,fontSize:11,color:C.sub}}>{t('common.demo_hint')}</p>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ onSuccess, goBack }) {
  const {t} = useTranslation();
  const [step,setStep]     = useState(1);
  const [loading,setLoading] = useState(false);
  const [err,setErr]       = useState({});
  const [apiErr,setApiErr] = useState("");
  const [sentCode,setSentCode]   = useState(null);
  const [inputCode,setInputCode] = useState("");
  const [codeErr,setCodeErr]     = useState("");
  const [verified,setVerified]   = useState(false);
  const [sending,setSending]     = useState(false);
  const [timer,setTimer]         = useState(0);
  const timerRef = useRef();
  const [f, setF] = useState({ name:"",email:"",pwd:"",confirm:"",city:"",phone:"",level:"Amateur",sports:[] });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const toggleSport = id => set("sports", f.sports.includes(id)?f.sports.filter(x=>x!==id):[...f.sports,id]);

  const startTimer = () => {
    setTimer(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTimer(t=>{ if(t<=1){clearInterval(timerRef.current);return 0;} return t-1; }), 1000);
  };

  const nextStep1 = () => {
    const e={};
    if (!f.name.trim())                  e.name=t('auth.required');
    if (!/\S+@\S+\.\S+/.test(f.email))  e.email=t('auth.email_invalid');
    if (f.pwd.length<6)                  e.pwd=t('auth.pwd_min');
    if (f.pwd!==f.confirm)               e.confirm=t('auth.pwd_mismatch');
    setErr(e);
    if (!Object.keys(e).length) setStep(2);
  };

  const sendSMS = async () => {
    const e={};
    if (!f.city.trim())    e.city=t('auth.city_required');
    if (!f.sports.length)  e.sports=t('auth.sports_required');
    if (!f.phone)          e.phone=t('auth.phone_required');
    setErr(e);
    if (Object.keys(e).length) return;
       setLoading(true);
    try {
      onSuccess(await register({ name:f.name,email:f.email,password:f.pwd,city:f.city,level:f.level,sports:f.sports,phone:f.phone,bio:"",verified:true }));
    } catch(m) { setApiErr(m?.message||m); }
    finally { setLoading(false); }
  };
  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24,overflowY:"auto"}}>
      <div style={{maxWidth:460,width:"100%"}}>
        <button onClick={step===1?goBack:()=>{setStep(s=>s-1);setCodeErr("");setInputCode("");}} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:13,marginBottom:20,fontFamily:C.font}}>
          {step===1?t('auth.back'):t('auth.back_step')}
        </button>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:24,color:C.text}}>
            {step===1?t('auth.register_step1'):t('auth.register_step2')}
            </div>
            <span style={{fontSize:11,color:C.sub,fontWeight:600}}>{t('auth.step')} {step}/2</span>
          </div>
          {/* Progress */}
          <div style={{display:"flex",gap:6,marginBottom:22}}>
           {[t('auth.step_info'),t('auth.step_profile')].map((l,i)=>(
              <div key={l} style={{flex:1}}>
                <div style={{height:3,borderRadius:3,background:i<step?C.accent:C.card2,marginBottom:4,transition:"background .3s"}}/>
                <div style={{fontSize:9,color:i<step?C.accent:C.sub,fontWeight:700,textAlign:"center"}}>{l}</div>
              </div>
            ))}
          </div>

          {step===1 && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Field label={t('auth.name')} value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Jean Dupont" error={err.name} icon="👤"/>
              <Field label={t('auth.email')} type="email" value={f.email} onChange={e=>set("email",e.target.value)} placeholder="ton@email.com" error={err.email} icon="📧"/>
              <Field label={t('auth.password')} type="password" value={f.pwd} onChange={e=>set("pwd",e.target.value)} placeholder="••••••••" error={err.pwd} icon="🔑" hint={t('auth.pwd_hint')}/>
              <Field label={t('auth.confirm_password')} type="password" value={f.confirm} onChange={e=>set("confirm",e.target.value)} placeholder="••••••••" error={err.confirm} icon="🔒"/>
              <Btn onClick={nextStep1}>{t('auth.continue')}</Btn>
            </div>
          )}

          {step===2 && (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <CityAutocomplete value={f.city} onChange={v=>set("city",v)} error={err.city}/>
              <PhoneField value={f.phone} onChange={v=>set("phone",v)} error={err.phone} hint={t('auth.verification_hint')}/>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:8}}>{t('auth.sports')}</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {SPORTS.map(s=>(
                    <button key={s.id} onClick={()=>toggleSport(s.id)} style={{padding:"7px 11px",borderRadius:9,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,background:f.sports.includes(s.id)?`${s.color}20`:C.card2,border:`1px solid ${f.sports.includes(s.id)?s.color:C.border}`,color:f.sports.includes(s.id)?s.color:C.sub,display:"flex",alignItems:"center",gap:5}}>
                      <SportEmoji sport={s} size={13}/> {s.label}
                    </button>
                  ))}
                </div>
                {err.sports && <span style={{fontSize:11,color:C.red,marginTop:5,display:"block"}}>{err.sports}</span>}
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:8}}>{t('auth.level')}</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                  {LEVELS.map((l,i)=><Chip key={l} active={f.level===l} onClick={()=>set("level",l)} color={C.purple}>{t('levels.'+LEVEL_KEYS[i])}</Chip>)}
                </div>
              </div>
             <Btn onClick={sendSMS} loading={sending} variant="solid">📱 {t('auth.register_btn')}</Btn>  
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function WelcomeScreen({ user, onEnter }) {
  const {t} = useTranslation();
  const [show,setShow] = useState(false);
  useEffect(()=>{ setTimeout(()=>setShow(true),80); },[]);
  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:"radial-gradient(ellipse at 50% 30%,rgba(0,229,160,.08) 0%,transparent 55%)"}}>
      <div style={{maxWidth:380,width:"100%",textAlign:"center",transition:"all .5s",opacity:show?1:0,transform:show?"translateY(0)":"translateY(20px)"}}>
        <div style={{fontSize:60,marginBottom:12}}>🎉</div>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:32,color:C.text,marginBottom:6}}>
          {t('auth.welcome')} {user.name.split(" ")[0]} !
        </div>
        <p style={{color:C.sub,fontSize:14,lineHeight:1.7,marginBottom:20}}>{t('auth.account_ready')}</p>
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28,flexWrap:"wrap"}}>
          {user.sports?.map(sid=>{const s=SPORTS.find(x=>x.id===sid);return s?<Badge key={sid} label={`${s.emoji} ${s.label}`} color={s.color}/>:null;})}
          <Badge label={user.level} color={C.accent}/>
        </div>
        <Btn onClick={onEnter} variant="solid">{t('auth.explore')}</Btn>
      </div>
    </div>
  );
}
// ─── PHONE FIELD ─────────────────────────────────────────────────────────────
function PhoneField({ value, onChange, error, hint }) {
  const {t} = useTranslation();
  const [focus, setFocus] = useState(false);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>{t('auth.phone_label')} *</label>
      <div style={{background:C.card2,border:`1.5px solid ${error?C.red:focus?C.accent:C.border}`,borderRadius:10,padding:"0 14px",transition:"border-color .2s"}}>
        <PhoneInput
          international
          defaultCountry="FR"
          value={value}
          onChange={v=>onChange(v||"")}
          onFocus={()=>setFocus(true)}
          onBlur={()=>setFocus(false)}
        />
      </div>
      {error && <span style={{fontSize:11,color:C.red}}>{error}</span>}
      {hint && !error && <span style={{fontSize:10,color:C.sub}}>{hint}</span>}
    </div>
  );
}

// ─── CITY AUTOCOMPLETE ───────────────────────────────────────────────────────
const WORLD_CITIES = [
  // France
  "Paris","Lyon","Marseille","Bordeaux","Toulouse","Nice","Nantes","Strasbourg",
  "Montpellier","Lille","Rennes","Grenoble","Rouen","Toulon","Saint-Étienne",
  "Nancy","Caen","Clermont-Ferrand","Tours","Amiens","Angers","Reims","Dijon",
  "Metz","Brest","Le Mans","Mulhouse","Perpignan","Orléans","Besançon",
  "Cannes","Antibes","Pau","Bayonne","Biarritz","Nîmes","Avignon","Limoges",
  "Villeurbanne","Aix-en-Provence","Le Havre","Valenciennes","Troyes","Dunkerque",
  "Colmar","Chambéry","Poitiers","Mérignac","Pessac","Levallois-Perret",
  "Issy-les-Moulineaux","Boulogne-Billancourt","Saint-Denis","Montreuil",
  // Belgique
  "Bruxelles","Anvers","Gand","Liège","Bruges","Namur","Charleroi","Mons",
  // Suisse
  "Zurich","Genève","Berne","Bâle","Lausanne","Lucerne","Lugano",
  // Luxembourg
  "Luxembourg",
  // Pays-Bas
  "Amsterdam","Rotterdam","La Haye","Utrecht","Eindhoven","Tilburg",
  // Allemagne
  "Berlin","Munich","Hambourg","Cologne","Francfort","Stuttgart","Düsseldorf",
  "Leipzig","Dortmund","Essen","Brême","Dresde","Hanovre","Nuremberg",
  // Espagne
  "Madrid","Barcelone","Valence","Séville","Saragosse","Málaga","Murcie",
  "Palma","Las Palmas","Bilbao","Alicante","Cordoue","Valladolid","Vigo",
  "Ibiza","Tenerife","Grenade","Marbella",
  // Portugal
  "Lisbonne","Porto","Braga","Coimbra","Faro","Funchal","Setúbal",
  // Italie
  "Rome","Milan","Naples","Turin","Palerme","Gênes","Bologne","Florence",
  "Bari","Catane","Vérone","Venise","Messine","Padoue","Trieste",
  // UK
  "Londres","Manchester","Birmingham","Glasgow","Liverpool","Leeds","Sheffield",
  "Édimbourg","Bristol","Cardiff","Belfast","Newcastle","Leicester","Nottingham",
  // Irlande
  "Dublin","Cork","Galway","Limerick",
  // Scandinavie
  "Stockholm","Oslo","Copenhague","Helsinki","Göteborg","Malmö","Bergen",
  "Stavanger","Tampere","Turku","Reykjavik","Aarhus","Odense",
  // Pologne
  "Varsovie","Cracovie","Łódź","Wrocław","Poznań","Gdańsk","Szczecin",
  // Autriche
  "Vienne","Graz","Linz","Salzbourg","Innsbruck",
  // Tchéquie
  "Prague","Brno","Ostrava","Plzeň",
  // Hongrie
  "Budapest","Debrecen","Miskolc",
  // Roumanie
  "Bucarest","Cluj-Napoca","Timișoara","Iași",
  // Grèce
  "Athènes","Thessalonique","Patras","Héraklion","Larissa",
  // Turquie
  "Istanbul","Ankara","Izmir","Bursa","Antalya","Konya","Gaziantep",
  // Ukraine
  "Kiev","Kharkiv","Odessa","Dnipro","Lviv",
  // Russie
  "Moscou","Saint-Pétersbourg","Novossibirsk","Ekaterinbourg","Kazan",
  // USA
  "New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphie",
  "San Antonio","San Diego","Dallas","San Jose","Austin","Jacksonville",
  "San Francisco","Seattle","Denver","Nashville","Baltimore","Boston",
  "Memphis","Portland","Las Vegas","Louisville","Milwaukee","Albuquerque",
  "Tucson","Fresno","Atlanta","Miami","Raleigh","Omaha","Minneapolis",
  "Honolulu","Detroit","El Paso","Washington","Sacramento","Cleveland",
  "Tampa","Orlando","Pittsburgh","Cincinnati","Indianapolis","Columbus",
  // Canada
  "Toronto","Montréal","Vancouver","Calgary","Edmonton","Ottawa",
  "Québec","Winnipeg","Hamilton","Kitchener","Halifax",
  // Mexique
  "Mexico","Guadalajara","Monterrey","Puebla","Tijuana","Cancún","Mérida",
  // Brésil
  "São Paulo","Rio de Janeiro","Brasília","Salvador","Fortaleza","Belo Horizonte",
  "Manaus","Curitiba","Recife","Porto Alegre","Belém","Goiânia",
  // Argentine
  "Buenos Aires","Córdoba","Rosario","Mendoza","La Plata","Tucumán",
  // Chili
  "Santiago","Valparaíso","Concepción","Antofagasta",
  // Colombie
  "Bogotá","Medellín","Cali","Barranquilla","Cartagena",
  // Pérou
  "Lima","Arequipa","Trujillo","Cusco",
  // Venezuela
  "Caracas","Maracaibo","Valencia","Barquisimeto",
  // Équateur
  "Quito","Guayaquil","Cuenca",
  // Bolivie
  "La Paz","Santa Cruz","Cochabamba",
  // Uruguay
  "Montevideo",
  // Paraguay
  "Asunción",
  // Japon
  "Tokyo","Osaka","Nagoya","Sapporo","Fukuoka","Kobe","Kyoto","Kawasaki",
  "Sendai","Hiroshima","Yokohama","Naha",
  // Chine
  "Pékin","Shanghai","Shenzhen","Guangzhou","Chengdu","Tianjin","Wuhan",
  "Chongqing","Xi'an","Nanjing","Hangzhou","Harbin","Dalian","Qingdao",
  // Corée du Sud
  "Séoul","Busan","Incheon","Daegu","Daejeon","Gwangju","Suwon",
  // Inde
  "Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata","Ahmedabad",
  "Pune","Surat","Jaipur","Lucknow","Kanpur","Nagpur","Visakhapatnam",
  // Pakistan
  "Karachi","Lahore","Faisalabad","Rawalpindi","Islamabad","Multan",
  // Bangladesh
  "Dacca","Chittagong",
  // Sri Lanka
  "Colombo",
  // Népal
  "Katmandou",
  // Thaïlande
  "Bangkok","Chiang Mai","Pattaya","Phuket","Hat Yai",
  // Vietnam
  "Hanoï","Hô Chi Minh-Ville","Da Nang","Haiphong","Cần Thơ",
  // Malaisie
  "Kuala Lumpur","George Town","Johor Bahru","Kota Kinabalu",
  // Singapour
  "Singapour",
  // Indonésie
  "Jakarta","Surabaya","Bandung","Medan","Semarang","Bekasi","Makassar",
  "Palembang","Tangerang",
  // Philippines
  "Manille","Quezon City","Cebu","Davao","Zamboanga",
  // Taïwan
  "Taipei","Kaohsiung","Taichung","Tainan",
  // Cambodge
  "Phnom Penh","Siem Reap",
  // Myanmar
  "Yangon","Naypyidaw",
  // Laos
  "Vientiane",
  // Hong Kong
  "Hong Kong",
  // Macao
  "Macao",
  // Moyen-Orient
  "Dubaï","Abu Dhabi","Sharjah","Doha","Mascate","Koweït","Bahreïn",
  "Riyad","Djeddah","La Mecque","Médine","Beyrouth","Amman","Damas",
  "Bagdad","Erbil","Téhéran","Ispahan","Maschhad","Tabriz","Shiraz",
  "Tel Aviv","Jérusalem","Haïfa",
  // Kazakhstan
  "Almaty","Nursultan","Chimkent",
  // Ouzbékistan
  "Tachkent","Samarcande",
  // Azerbaïdjan
  "Bakou",
  // Géorgie
  "Tbilissi",
  // Arménie
  "Erevan",
  // Égypte
  "Le Caire","Alexandrie","Gizeh","Assouan","Louxor","Sharm el-Sheikh",
  // Maroc
  "Casablanca","Rabat","Fès","Marrakech","Tanger","Agadir","Meknès","Oujda",
  // Algérie
  "Alger","Oran","Constantine","Annaba","Blida","Sétif","Batna",
  // Tunisie
  "Tunis","Sfax","Sousse","Monastir","Bizerte","Gabès",
  // Libye
  "Tripoli","Benghazi",
  // Nigeria
  "Lagos","Abuja","Ibadan","Kano","Port Harcourt","Benin City",
  // Ghana
  "Accra","Kumasi","Tamale",
  // Côte d'Ivoire
  "Abidjan","Bouaké","Yamoussoukro",
  // Sénégal
  "Dakar","Thiès","Saint-Louis",
  // Mali
  "Bamako","Ségou","Mopti",
  // Cameroun
  "Douala","Yaoundé","Garoua","Bamenda",
  // Congo DRC
  "Kinshasa","Lubumbashi","Mbuji-Mayi","Goma","Kisangani",
  // Éthiopie
  "Addis-Abeba","Dire Dawa","Gondar","Mekele",
  // Kenya
  "Nairobi","Mombasa","Kisumu","Nakuru",
  // Tanzanie
  "Dar es Salaam","Dodoma","Mwanza","Arusha","Zanzibar",
  // Ouganda
  "Kampala","Gulu",
  // Rwanda
  "Kigali",
  // Afrique du Sud
  "Johannesburg","Le Cap","Durban","Pretoria","Port Elizabeth","Bloemfontein",
  "Soweto","East London",
  // Zimbabwe
  "Harare","Bulawayo",
  // Mozambique
  "Maputo","Matola","Beira",
  // Madagascar
  "Antananarivo","Toamasina",
  // Angola
  "Luanda","Huambo","Lubango",
  // Australie
  "Sydney","Melbourne","Brisbane","Perth","Adélaïde","Gold Coast",
  "Canberra","Newcastle","Hobart","Darwin",
  // Nouvelle-Zélande
  "Auckland","Wellington","Christchurch","Hamilton","Dunedin",
  // Fidji
  "Suva",
  // Papouasie
  "Port Moresby",
];

function CityAutocomplete({ value, onChange, error, terrainCities=[] }) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef();
  const debounceRef = useRef();

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=8&email=app@rvf.app`,
          { headers: { 'Accept-Language': 'fr' } }
        );
        const data = await res.json();
        const seen = new Set();
        const cities = [];
        for (const r of data) {
          const city = r.address?.city || r.address?.town || r.address?.village || r.address?.municipality || r.name;
          const country = r.address?.country;
          if (!city) continue;
          const label = country ? `${city}, ${country}` : city;
          if (!seen.has(label)) { seen.add(label); cities.push(label); }
        }
        const localMatches = terrainCities
          .filter(c => c.toLowerCase().includes(q.toLowerCase()) && !cities.some(x => x.startsWith(c)))
          .slice(0, 3);
        setSuggestions([...localMatches, ...cities].slice(0, 10));
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [value]);

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} style={{display:"flex",flexDirection:"column",gap:5,position:"relative"}}>
      <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>{t('auth.city_label')} *</label>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:15,opacity:.5,pointerEvents:"none"}}>{loading ? "⏳" : "📍"}</span>
        <input
          value={value}
          onChange={e=>{ onChange(e.target.value); setOpen(true); }}
          onFocus={()=>{ setFocus(true); setOpen(true); }}
          onBlur={()=>setFocus(false)}
          placeholder={t('common.city_placeholder')}
          autoComplete="off"
          style={{width:"100%",background:C.card2,border:`1.5px solid ${error?C.red:focus?C.accent:C.border}`,borderRadius:10,padding:"11px 14px 11px 40px",color:C.text,fontSize:14,outline:"none",fontFamily:C.font,transition:"border-color .2s",boxSizing:"border-box"}}
        />
      </div>
      {error && <span style={{fontSize:11,color:C.red}}>{error}</span>}
      {open && suggestions.length > 0 && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:9999,background:C.card,border:`1px solid ${C.accent}55`,borderRadius:10,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,.6)",marginTop:2}}>
          {suggestions.map(c => (
            <button key={c} onMouseDown={() => { onChange(c); setOpen(false); }}
              style={{display:"block",width:"100%",textAlign:"left",padding:"9px 14px",background:"none",border:"none",color:C.text,fontSize:13,cursor:"pointer",fontFamily:C.font,borderBottom:`1px solid ${C.border}`}}
              onMouseEnter={e=>e.currentTarget.style.background=C.aLow}
              onMouseLeave={e=>e.currentTarget.style.background="none"}>
              📍 {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADD TERRAIN MODAL ────────────────────────────────────────────────────────
function AddTerrainModal({ user, onAdd, onClose, initialLat, initialLng, terrainCities }) {
  const {t} = useTranslation();
  const hasGPS = initialLat != null && initialLng != null;
  const [f,setF]           = useState({name:"",sports:["football"],city:"",country:"",surface:"Gazon naturel",price:"Gratuit",lights:false,free:true,phone:""});
  const [photos,setPhotos] = useState([]);
  const [err,setErr]       = useState({});
  const [saving,setSaving] = useState(false);
  const [done,setDone]     = useState(false);
  const fileRef            = useRef();
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const toggleSport = id => set("sports", f.sports.includes(id) ? f.sports.filter(x=>x!==id) : [...f.sports, id]);
  const primarySp = SPORTS.find(s=>s.id===f.sports[0]);
  const SURFS = ["Gazon naturel","Gazon synthétique","Terre battue","Béton","Parquet","Sable","Moquette","Dur"];

  const upload = e => Array.from(e.target.files).forEach(file=>{
    const r=new FileReader(); r.onload=ev=>setPhotos(p=>[...p,ev.target.result]); r.readAsDataURL(file);
  });

  const submit = async () => {
    const e={};
    if (!f.name.trim())      e.name=t('common.required');
    if (!f.city.trim())      e.city=t('common.required');
    if (!f.country.trim())   e.country=t('common.required');
    if (!f.sports.length)    e.sports=t('auth.sports_required');
    setErr(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    await pause(700);
    onAdd({
      id:Date.now(), ...f,
      sport: f.sports[0],
      rating:0, players:1,
      addedBy:user?.name||t('common.anonymous'), photos,
      mapX:(28+Math.random()*45).toFixed(1),
      mapY:(22+Math.random()*36).toFixed(1),
      lat: hasGPS ? initialLat : null,
      lng: hasGPS ? initialLng : null,
      isNew:true,
    });
    setDone(true); setSaving(false);
    setTimeout(onClose, 2000);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>{if(e.target===e.currentTarget) onClose();}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:500,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 80px rgba(0,0,0,.8)"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>{t('map.add_terrain_title')}</div>
            <div style={{fontSize:11,color:hasGPS?C.accent:C.sub,marginTop:2}}>
              {hasGPS ? t('map.gps_pinned') : t('map.gps_visible')}
            </div>
          </div>
          <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.sub,fontSize:18}}>✕</button>
        </div>

        {done ? (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:32,textAlign:"center"}}>
            <div style={{fontSize:52}}>🎉</div>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.accent}}>{t('add_terrain.success_title')}</div>
            <div style={{fontSize:13,color:C.sub}}>"{f.name}" {t('add_terrain.success_sub')}</div>
          </div>
        ) : (
          <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexDirection:"column",gap:14}}>
            {/* Sport */}
            <div>
              <label style={{fontSize:11,fontWeight:700,color:err.sports?C.red:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>
                {t('add_terrain.sport')} {f.sports.length>0&&<span style={{color:C.accent,fontWeight:700,fontSize:11}}>({f.sports.length} {t('add_terrain.sport_selected', {count: f.sports.length})})</span>}
              </label>
              {err.sports&&<div style={{fontSize:11,color:C.red,marginBottom:6}}>{err.sports}</div>}
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {SPORTS.map(s=>{
                  const active = f.sports.includes(s.id);
                  return (
                    <button key={s.id} onClick={()=>toggleSport(s.id)}
                      style={{padding:"7px 12px",borderRadius:9,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,background:active?`${s.color}20`:C.card2,border:`2px solid ${active?s.color:C.border}`,color:active?s.color:C.sub,display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}>
                      <SportEmoji sport={s} size={13}/> {s.label}
                      {active&&<span style={{fontSize:10,background:s.color,color:"#06090f",borderRadius:"50%",width:14,height:14,display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label={t('add_terrain.name')} value={f.name} onChange={e=>set("name",e.target.value)} placeholder={t('add_terrain.name_placeholder')} error={err.name} icon="🏟️"/>
            {hasGPS && (
              <div style={{background:"rgba(0,229,160,.08)",border:"1px solid rgba(0,229,160,.3)",borderRadius:10,padding:"10px 14px",display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:18}}>📍</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.accent}}>{t('add_terrain.coords_pinned')}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:1,fontFamily:"monospace"}}>{initialLat.toFixed(5)}°, {initialLng.toFixed(5)}°</div>
                </div>
                <span style={{background:C.aLow,color:C.accent,borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:700,letterSpacing:.5}}>AUTO</span>
              </div>
            )}
            <CityAutocomplete value={f.city} onChange={v=>set("city",v)} error={err.city} terrainCities={terrainCities}/>
            <Field label={t('add_terrain.country')} value={f.country} onChange={e=>set("country",e.target.value)} placeholder="France" error={err.country} icon="🌍"/>
            {/* Surface */}
            <div>
              <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:8}}>{t('add_terrain.surface')}</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SURFS.map(s=>(
                  <button key={s} onClick={()=>set("surface",s)} style={{padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:C.font,fontSize:11,fontWeight:600,background:f.surface===s?C.aLow:C.card2,border:`1px solid ${f.surface===s?C.accent+"80":C.border}`,color:f.surface===s?C.accent:C.sub}}>
                    {t('surfaces.'+(SURF_KEYS[s]||s))}
                  </button>
                ))}
              </div>
            </div>
            <Field label={t('add_terrain.price')} value={f.price} onChange={e=>set("price",e.target.value)} placeholder={t('add_terrain.price_placeholder')} icon="💰"/>
            <Field label={t('add_terrain.phone')} value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="+33 1 23 45 67 89" icon="📞"/>
            <div style={{display:"flex",gap:10}}>
              {[["lights",t('add_terrain.lit'),C.yellow],["free",t('add_terrain.free_toggle'),C.accent]].map(([k,l,col])=>(
                <button key={k} onClick={()=>set(k,!f[k])} style={{flex:1,padding:"10px",borderRadius:10,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,background:f[k]?`${col}18`:C.card2,border:`2px solid ${f[k]?col:C.border}`,color:f[k]?col:C.sub}}>
                  {l}
                </button>
              ))}
            </div>
            {/* Photos */}
            <div>
              <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:8}}>{t('add_terrain.photos')}</label>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {photos.map((src,i)=>(
                  <div key={i} style={{borderRadius:8,overflow:"hidden",aspectRatio:"1",border:`1px solid ${C.border}`,position:"relative"}}>
                    <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <button onClick={()=>setPhotos(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:3,right:3,width:18,height:18,borderRadius:"50%",background:"rgba(0,0,0,.85)",border:"none",color:"#fff",fontSize:11,cursor:"pointer"}}>✕</button>
                  </div>
                ))}
                {photos.length<6 && (
                  <div onClick={()=>fileRef.current.click()} style={{borderRadius:8,aspectRatio:"1",border:`2px dashed ${C.accent}55`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.accent,gap:4,background:C.aLow}}>
                    <span style={{fontSize:22}}>📸</span><span style={{fontSize:10,fontWeight:700}}>{t('add_terrain.add_photo')}</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={upload}/>
            </div>
            {/* Preview */}
            <div style={{background:C.card2,borderRadius:10,padding:12,borderLeft:`3px solid ${primarySp?.color||C.accent}`}}>
              <div style={{fontSize:10,color:primarySp?.color||C.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{t('add_terrain.preview')}</div>
              <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{f.name||t('add_terrain.name_preview')}</div>
              <div style={{fontSize:11,color:C.sub,marginBottom:6}}>📍 {[f.city,f.country].filter(Boolean).join(", ")||t('add_terrain.location_preview')} · {f.price}</div>
              {f.sports.length>0&&(
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {f.sports.map(id=>{const s=SPORTS.find(x=>x.id===id);return s?<span key={id} style={{display:"inline-flex",alignItems:"center",gap:3,background:`${s.color}18`,border:`1px solid ${s.color}50`,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700,color:s.color}}><SportEmoji sport={s} size={10}/> {s.label}</span>:null;})}
                </div>
              )}
            </div>
            <Btn onClick={submit} loading={saving} variant="solid" style={{fontSize:15,padding:"14px"}}>🚀 {t('add_terrain.publish')}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INTERACTIVE MAP ──────────────────────────────────────────────────────────
function InteractiveMap({ terrains, clusters, onSelect, userPos, onMapClick, pinPos, onMapReady, onViewportChange }) {
  const {t: tr, i18n} = useTranslation();
  const wrapRef      = useRef(null);
  const mapRef       = useRef(null);
  const clusterGroupRef = useRef(null);
  const clusterDotsRef  = useRef([]);
  const iconCacheRef    = useRef(new Map());
  const userDotRef   = useRef(null);
  const pinMarkerRef = useRef(null);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);
  // Defensive: nothing language-dependent in the icon HTML today (color + emoji/SVG only),
  // but clear the cache if that ever changes so a stale label can't linger.
  useEffect(() => { iconCacheRef.current.clear(); }, [i18n.language]);

  // Init map once
  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return;
    const center = userPos ? [userPos.lat, userPos.lng] : [20, 10];
    const zoom   = userPos ? 10 : 2;
    const map = L.map(wrapRef.current, { center, zoom, zoomControl: true });
    L.tileLayer(`https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : ''}`, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;
    const clusterGroup = L.markerClusterGroup({ chunkedLoading: true });
    clusterGroup.addTo(map);
    clusterGroupRef.current = clusterGroup;
    if (onMapReady) onMapReady(map);
    map.on("click", e => {
      if (onMapClickRef.current) onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    const reportViewport = () => {
      if (!onViewportChangeRef.current) return;
      const b = map.getBounds();
      onViewportChangeRef.current({
        bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        zoom: map.getZoom(),
      });
    };
    let debounceTimer = null;
    const debouncedReport = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(reportViewport, 300);
    };
    map.on("moveend zoomend", debouncedReport);
    setTimeout(() => { map.invalidateSize(); reportViewport(); }, 80);
    return () => {
      clearTimeout(debounceTimer);
      map.remove(); mapRef.current = null; clusterGroupRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // User position dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    if (userDotRef.current) { userDotRef.current.remove(); userDotRef.current = null; }
    const icon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#00e5a0;border:3px solid #fff;box-shadow:0 0 12px rgba(0,229,160,.9)"></div>`,
      iconSize:[14,14], iconAnchor:[7,7], className:"",
    });
    userDotRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset:1000 })
      .bindPopup(`<b>${tr('map.my_position')}</b>`).addTo(map);
    map.setView([userPos.lat, userPos.lng], 10);
  }, [userPos]);

  // Draft "add" pin at map-click position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pinMarkerRef.current) { pinMarkerRef.current.remove(); pinMarkerRef.current = null; }
    if (!pinPos) return;
    const icon = L.divIcon({
      html: `<div style="width:38px;height:38px;border-radius:50%;background:#00e5a0;border:3px solid #fff;box-shadow:0 0 20px rgba(0,229,160,.9),0 0 6px rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;font-size:20px">➕</div>`,
      iconSize:[38,38], iconAnchor:[19,19], className:"",
    });
    pinMarkerRef.current = L.marker([pinPos.lat, pinPos.lng], { icon, zIndexOffset:2000 }).addTo(map);
  }, [pinPos]);

  // Aggregate cluster dots — shown while zoomed out (backend returns lat/lng-rounded counts)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    clusterDotsRef.current.forEach(m => m.remove());
    clusterDotsRef.current = [];
    (clusters||[]).forEach(c => {
      const radius = 10 + Math.min(14, Math.round(Math.log2(c.count + 1) * 3));
      const size = radius * 2;
      const dot = L.marker([c.lat, c.lng], { icon: L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${C.accent};border:2px solid #06090f;box-shadow:0 3px 8px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;color:#06090f;font-weight:800;font-size:12px;font-family:${C.font}">${c.count}</div>`,
        iconSize:[size,size], iconAnchor:[size/2,size/2], className:"",
      })});
      dot.addTo(map);
      clusterDotsRef.current.push(dot);
    });
  }, [clusters]);

  // Terrain markers — update when terrains list changes
  useEffect(() => {
    const cg = clusterGroupRef.current;
    if (!cg) return;
    cg.clearLayers();
    terrains.forEach(t => {
      if (!t.lat || !t.lng) return;
      const tSports = terrainSports(t).map(id=>SPORTS.find(s=>s.id===id)).filter(Boolean);
      const sp    = tSports[0];
      const cacheKey = `${sp?.id || 'default'}:${tSports.length}`;
      let icon = iconCacheRef.current.get(cacheKey);
      if (!icon) {
        const color = tSports.length > 1 ? C.accent : (sp?.color || C.accent);
        const innerContent = sp?.id === "padel"
          ? `<svg width="15" height="15" viewBox="0 0 20 20"><rect x="2.5" y="1" width="15" height="12" rx="4" fill="none" stroke="#06090f" stroke-width="1.7"/><circle cx="7" cy="5.5" r="1.1" fill="#06090f"/><circle cx="10" cy="5.5" r="1.1" fill="#06090f"/><circle cx="13" cy="5.5" r="1.1" fill="#06090f"/><circle cx="7" cy="9" r="1.1" fill="#06090f"/><circle cx="10" cy="9" r="1.1" fill="#06090f"/><circle cx="13" cy="9" r="1.1" fill="#06090f"/><rect x="8.8" y="13" width="2.4" height="6" rx="1.2" fill="#06090f"/></svg>`
          : `<span style="font-size:14px">${sp?.emoji || "🏟️"}</span>`;
        icon = L.divIcon({
          html: `<div style="position:relative;width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #06090f;box-shadow:0 3px 10px rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;cursor:pointer">${innerContent}${tSports.length>1?`<span style="position:absolute;top:-4px;right:-4px;background:#00e5a0;color:#06090f;border-radius:50%;width:14px;height:14px;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #06090f">${tSports.length}</span>`:""}</div>`,
          iconSize:[32,32], iconAnchor:[16,16], className:"",
        });
        iconCacheRef.current.set(cacheKey, icon);
      }
      const marker = L.marker([t.lat, t.lng], { icon });
      marker.bindPopup(() => {
        const sportsLine = tSports.map(s=>s.emoji+" "+s.label).join(" · ");
        return `
        <div style="padding:12px 14px;min-width:190px">
          <div style="font-weight:700;font-size:14px;margin-bottom:5px">${t.name}</div>
          <div style="font-size:11px;color:#5c7080;margin-bottom:6px">📍 ${t.city}, ${t.country}</div>
          <div style="font-size:12px;margin-bottom:6px">${sportsLine} &nbsp;·&nbsp; ${t.surface}</div>
          <div style="display:flex;gap:12px;margin-bottom:10px">
            <span style="font-size:13px;font-weight:700;color:#fcc419">⭐ ${t.rating}</span>
            <span style="font-size:13px;font-weight:700;color:#00e5a0">${t.price}</span>
            ${t.lights ? `<span style="font-size:12px">${tr('map.lit')}</span>` : ""}
          </div>
          <button id="rvfbtn-${t.id}" style="width:100%;padding:8px;background:#00e5a0;color:#06090f;border:none;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">
            ${tr('map.see_terrain')}
          </button>
        </div>
      `;
      }, { maxWidth:240, minWidth:200 });
      marker.on("popupopen", () => {
        const btn = document.getElementById(`rvfbtn-${t.id}`);
        if (btn) btn.onclick = () => onSelect(t);
      });
      cg.addLayer(marker);
    });
  }, [terrains, onSelect]);

  return (
    <div style={{position:"absolute",inset:0}}>
      <div ref={wrapRef} style={{width:"100%",height:"100%"}}/>
    </div>
  );
}

// ─── MAP VIEW ─────────────────────────────────────────────────────────────────
function MapView({ onSelect, terrains, clusters, onViewportChange, user, onAddTerrain, userPos, gpsError, gpsLoading, onRequestGps }) {
  const {t: tr} = useTranslation();
  const [filter,setFilter]     = useState("all");
  const [search,setSearch]     = useState("");
  const [showAdd,setShowAdd]   = useState(false);
  const [toast,setToast]       = useState(null);
  const [viewMode,setViewMode] = useState("map"); // "list" | "map"
  const [mapClickPos,setMapClickPos] = useState(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [filterByProfile, setFilterByProfile] = useState(true);
  const mapInstanceRef = useRef(null);

  const profileSports = user?.sports?.length ? user.sports : null;
  const sp = id => SPORTS.find(s=>s.id===id);
  const filtered = terrains.filter(t =>
    (!filterByProfile || !profileSports || profileSports.some(sid => terrainSports(t).includes(sid))) &&
    (filter==="all"||terrainSports(t).includes(filter)) &&
    (t.name.toLowerCase().includes(search.toLowerCase()) ||
     (t.city||"").toLowerCase().includes(search.toLowerCase()) ||
     (t.country||"").toLowerCase().includes(search.toLowerCase()))
  );
  const sortedFiltered = !userPos && user?.city
    ? [...filtered].sort((a,b)=>{
        const aM=(a.city||"").toLowerCase()===user.city.toLowerCase();
        const bM=(b.city||"").toLowerCase()===user.city.toLowerCase();
        return (bM?1:0)-(aM?1:0);
      })
    : filtered;
  // Zoomed-out map: no individual terrains loaded, only aggregate cluster counts
  const clusterTotal = (clusters||[]).reduce((s,c)=>s+c.count, 0);
  const displayCount = terrains.length===0 && clusterTotal>0 ? clusterTotal : filtered.length;

  // City suggestions when typing
  const allCities = [...new Set(terrains.map(t=>t.city).filter(Boolean))].sort();
  const citySuggestions = search.trim().length >= 2
    ? allCities.filter(c => c.toLowerCase().includes(search.toLowerCase()) && c.toLowerCase() !== search.toLowerCase())
    : [];

  // Auto-fit map to filtered results when search/filter changes
  useEffect(() => {
    if (!mapInstanceRef.current || viewMode !== "map") return;
    if (!search.trim() && filter === "all") return;
    const withCoords = filtered.filter(t => t.lat && t.lng);
    if (!withCoords.length) return;
    if (withCoords.length === 1) {
      mapInstanceRef.current.setView([withCoords[0].lat, withCoords[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(withCoords.map(t => [t.lat, t.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [search, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDist = t => {
    if (!userPos||!t.lat||!t.lng) return null;
    const d = haversine(userPos.lat,userPos.lng,t.lat,t.lng);
    return d<1 ? Math.round(d*1000)+"m" : d.toFixed(0)+"km";
  };

  const handleAdd = async t => {
    const result = await onAddTerrain(t);
    setToast(result === 'offline'
      ? `⚠️ "${t.name}" visible maintenant (non sauvegardé)`
      : t.name);
    setTimeout(()=>setToast(null), 4000);
  };

  const handleMapClick = useCallback(pos => {
    if (placementMode) return;
    setMapClickPos(pos);
    setShowAdd(true);
  }, [placementMode]);

  const closeAdd = () => { setShowAdd(false); setMapClickPos(null); };

  const enterPlacementMode = () => { setViewMode("map"); setPlacementMode(true); };
  const confirmPlacement = () => {
    const c = mapInstanceRef.current?.getCenter();
    if (c) { setMapClickPos({lat:c.lat,lng:c.lng}); setShowAdd(true); }
    setPlacementMode(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:C.bg}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {/* Barre de contrôles */}
      <div style={{flexShrink:0,background:C.card,borderBottom:`1px solid ${C.border}`,padding:"10px 16px",display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {/* Search */}
          <div style={{position:"relative",flex:"1 1 0",minWidth:0}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr('map.search_placeholder')}
              style={{width:"100%",background:C.card2,border:`1px solid ${search?C.accent+"55":C.border}`,borderRadius:9,padding:"8px 12px 8px 32px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font}}/>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:14}}>🔍</span>
            {search && <button onClick={()=>setSearch("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:13,lineHeight:1,padding:2}}>✕</button>}
          </div>
          {/* Vue toggle */}
          <div style={{display:"flex",background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:2,gap:2,flexShrink:0}}>
            {[["list","📋"],["map","🗺️"]].map(([mode,icon])=>(
              <button key={mode} onClick={()=>setViewMode(mode)}
                style={{padding:"6px 11px",border:"none",borderRadius:7,background:viewMode===mode?C.accent:"transparent",color:viewMode===mode?"#06090f":C.sub,cursor:"pointer",fontSize:15,lineHeight:1,transition:"all .15s",fontWeight:700}}>
                {icon}
              </button>
            ))}
          </div>
          <span style={{fontSize:12,color:C.sub,flexShrink:0,whiteSpace:"nowrap"}}>
            <span style={{color:C.accent,fontWeight:700}}>{displayCount}</span> {tr('map.terrains', {count: displayCount})}
          </span>
          <button onClick={()=>setShowAdd(true)} style={{background:C.accent,border:"none",borderRadius:8,padding:"7px 12px",color:"#06090f",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:C.font,flexShrink:0}}>{tr('map.add')}</button>
          <button onClick={gpsError!==4?onRequestGps:undefined} disabled={gpsLoading||gpsError===4}
            title={gpsLoading?tr('map.activate_gps'):gpsError===4?tr('map.gps_http_title'):gpsError===1?tr('map.gps_denied'):gpsError===2?tr('map.gps_unavailable'):gpsError===3?tr('map.gps_timeout_title'):userPos?tr('map.gps_active'):tr('map.activate_gps')}
            style={{background:gpsLoading?`${C.accent}15`:gpsError===4?`${C.accent}10`:gpsError?`${C.red}18`:userPos?`${C.accent}15`:C.card2,border:`1px solid ${gpsLoading?C.accent+"55":gpsError===4?C.accent+"40":gpsError?C.red+"55":userPos?C.accent+"55":C.border}`,borderRadius:8,padding:"7px 10px",color:gpsLoading?C.accent:gpsError===4?C.accent:gpsError?C.red:userPos?C.accent:C.sub,fontSize:15,cursor:gpsLoading||gpsError===4?"default":"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
            {gpsLoading ? <span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⟳</span> : gpsError===4 ? "🔐" : gpsError ? "⚠️" : userPos ? "📍" : "🔍"}
          </button>
        </div>
        {gpsError===4 && (
          <div style={{background:`${C.accent}10`,border:`1px solid ${C.accent}40`,borderRadius:8,padding:"8px 12px",display:"flex",gap:10,alignItems:"center"}}>
            <span style={{fontSize:16}}>🔐</span>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:700,color:C.accent}}>{tr('map.gps_http_title')}</div>
              <div style={{fontSize:10,color:C.sub,marginTop:1}}>{tr('map.gps_http_hint')}</div>
            </div>
          </div>
        )}
        {(gpsError===1||gpsError===2||gpsError===3) && (()=>{
          const isIOS = /iP(hone|ad|od)/i.test(navigator.userAgent);
          const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
          const isAndroid = /Android/i.test(navigator.userAgent);
          let title, hint;
          if (gpsError===2) {
            title=tr('map.gps_unavailable_title'); hint=tr('map.gps_unavailable_hint');
          } else if (gpsError===3) {
            title=tr('map.gps_timeout_title2'); hint=tr('map.gps_timeout_hint');
          } else if (isIOS && isSafari) {
            title=tr('map.gps_denied_safari_title'); hint=tr('map.gps_denied_safari_hint');
          } else if (isAndroid) {
            title=tr('map.gps_denied_android_title'); hint=tr('map.gps_denied_android_hint');
          } else {
            title=tr('map.gps_denied_title'); hint=tr('map.gps_denied_hint');
          }
          return (
            <div style={{background:`${C.red}10`,border:`1px solid ${C.red}40`,borderRadius:8,padding:"8px 12px",display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:16}}>{gpsError===1?"🔒":"⚠️"}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:700,color:C.red}}>{title}</div>
                <div style={{fontSize:10,color:C.sub,marginTop:1}}>{hint}</div>
              </div>
              <button onClick={onRequestGps}
                style={{flexShrink:0,background:C.red,border:"none",borderRadius:7,padding:"5px 10px",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                🔄 {tr('common.retry')}
              </button>
            </div>
          );
        })()}
        {/* City suggestions */}
        {citySuggestions.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:5,paddingTop:2}}>
            <span style={{fontSize:10,color:C.sub,alignSelf:"center",flexShrink:0}}>{tr('map.cities')}</span>
            {citySuggestions.slice(0,8).map(city=>(
              <button key={city} onClick={()=>setSearch(city)}
                style={{padding:"3px 10px",borderRadius:20,border:`1px solid ${C.accent}44`,background:`${C.accent}10`,color:C.accent,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:C.font,whiteSpace:"nowrap"}}>
                {city}
              </button>
            ))}
          </div>
        )}
        {/* Sport chips */}
        <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center"}}>
          {profileSports && (
            <button onClick={()=>{ setFilterByProfile(p=>!p); setFilter("all"); }}
              style={{padding:"4px 10px",borderRadius:20,cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:11,flexShrink:0,
                background:filterByProfile?C.aLow:`${C.red}12`,
                border:`1.5px solid ${filterByProfile?C.accent:C.red+"66"}`,
                color:filterByProfile?C.accent:C.sub,
                display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}>
              {filterByProfile ? <>🏅 {profileSports.map(id=>SPORTS.find(x=>x.id===id)?.emoji).join("")}</> : <>{tr('profile.see_all_sports')}</>}
            </button>
          )}
          <Chip sm active={filter==="all"} onClick={()=>setFilter("all")}>{tr('map.all')}</Chip>
          {(filterByProfile && profileSports ? SPORTS.filter(s=>profileSports.includes(s.id)) : SPORTS).map(s=><Chip sm key={s.id} active={filter===s.id} onClick={()=>setFilter(s.id)} color={s.color}><SportEmoji sport={s} size={11}/> {s.label}</Chip>)}
        </div>
      </div>

      {/* Contenu principal */}
      {viewMode==="list" ? (
        <div style={{flex:1,overflowY:"auto",padding:"16px 12px"}}>
          <div style={{maxWidth:600,margin:"0 auto",display:"flex",flexDirection:"column",gap:10}}>
            {sortedFiltered.map(t=>{
              const tSpList=terrainSports(t).map(id=>SPORTS.find(x=>x.id===id)).filter(Boolean);
              const s=tSpList[0];
              const dist=fmtDist(t);
              return (
                <div key={t.id} onClick={()=>onSelect(t)}
                  style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,borderLeft:`4px solid ${s?.color}`,cursor:"pointer",padding:"14px 16px",display:"flex",alignItems:"center",gap:14,position:"relative",transition:"background .15s",WebkitTapHighlightColor:"transparent"}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.card2}
                  onMouseLeave={e=>e.currentTarget.style.background=C.card}>
                  {t.isNew&&<span style={{position:"absolute",top:8,right:10,background:`${C.accent}20`,color:C.accent,fontSize:9,fontWeight:700,borderRadius:5,padding:"2px 7px"}}>NEW</span>}
                  <div style={{width:46,height:46,borderRadius:12,background:`${s?.color}18`,border:`2px solid ${s?.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <SportEmoji sport={s} size={22}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:2}}>
                      {tSpList.map(sp2=>(
                        <span key={sp2.id} style={{fontSize:9,color:sp2.color,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{sp2.label}</span>
                      ))}
                    </div>
                    <div style={{fontSize:15,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.name}</div>
                    <div style={{fontSize:11,color:C.sub,marginTop:3}}>📍 {t.city}{dist?<span style={{color:C.accent,marginLeft:5}}>· {dist}</span>:!userPos&&user?.city&&(t.city||"").toLowerCase()===user.city.toLowerCase()?<span style={{color:C.accent,marginLeft:5,fontWeight:700}}>· {tr('map.my_city')}</span>:null} &nbsp;·&nbsp; {t.surface}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,color:C.yellow,fontWeight:700}}>{t.rating>0?`⭐ ${t.rating}`:"🆕"}</div>
                    <div style={{fontSize:13,color:C.accent,fontWeight:700,marginTop:4}}>{t.price}</div>
                    <div style={{fontSize:10,color:C.sub,marginTop:2}}>{t.lights?tr('map.lit'):""}</div>
                  </div>
                  <div style={{color:C.sub,fontSize:16,flexShrink:0}}>›</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{flex:1,position:"relative",minHeight:0}}>
          <InteractiveMap terrains={filtered} clusters={clusters} onViewportChange={onViewportChange} onSelect={onSelect} userPos={userPos} onMapClick={handleMapClick} pinPos={placementMode?null:mapClickPos} onMapReady={m=>{mapInstanceRef.current=m;}}/>
          {placementMode ? (
            <>
              {/* Crosshair pin — tip at map center */}
              <div style={{position:"absolute",bottom:"50%",left:"50%",transform:"translateX(-50%)",zIndex:600,pointerEvents:"none"}}>
                <div style={{width:48,height:48,borderRadius:"50% 50% 50% 0",background:C.accent,border:"3px solid #fff",boxShadow:`0 0 28px ${C.accent}bb,0 4px 14px rgba(0,0,0,.6)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,transform:"rotate(-45deg)"}}>
                  <span style={{display:"inline-block",transform:"rotate(45deg)"}}>🏟️</span>
                </div>
              </div>
              {/* Shadow dot */}
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,2px)",zIndex:600,pointerEvents:"none",width:20,height:6,borderRadius:"50%",background:"rgba(0,0,0,.4)"}}/>
              {/* Instruction banner */}
              <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",zIndex:700,background:"rgba(6,9,15,.93)",backdropFilter:"blur(8px)",border:`1px solid ${C.accent}55`,borderRadius:22,padding:"9px 20px",fontSize:12,color:C.accent,fontWeight:600,whiteSpace:"nowrap",pointerEvents:"none",boxShadow:"0 4px 16px rgba(0,0,0,.5)"}}>
                {tr('map.move_map')}
              </div>
              {/* Confirm / Cancel bar */}
              <div style={{position:"absolute",bottom:16,left:16,right:16,zIndex:700,display:"flex",gap:10}}>
                <button onClick={()=>setPlacementMode(false)} style={{flex:1,padding:"14px",borderRadius:13,background:"rgba(6,9,15,.92)",border:`1px solid ${C.border}`,color:C.sub,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font,backdropFilter:"blur(6px)"}}>
                  {tr('common.cancel')}
                </button>
                <button onClick={confirmPlacement} style={{flex:2,padding:"14px",borderRadius:13,background:C.accent,border:"none",color:"#06090f",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:C.font,boxShadow:`0 4px 16px ${C.accent}55`}}>
                  ✅ {tr('map.confirm_position')}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Floating "Déposer mon stade" FAB */}
              <button onClick={enterPlacementMode} style={{position:"absolute",bottom:60,right:16,zIndex:500,background:C.accent,border:"none",borderRadius:30,padding:"12px 20px",color:"#06090f",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:C.font,boxShadow:`0 4px 24px ${C.accent}66`,display:"flex",alignItems:"center",gap:8,whiteSpace:"nowrap"}}>
                📍 {tr('map.place_stadium')}
              </button>
              {!mapClickPos && (
                <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",zIndex:500,background:"rgba(6,9,15,.88)",backdropFilter:"blur(8px)",border:`1px solid ${C.accent}44`,borderRadius:20,padding:"7px 16px",fontSize:11,color:C.sub,whiteSpace:"nowrap",pointerEvents:"none"}}>
                  {tr('map.tap_to_pin')}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showAdd && <AddTerrainModal user={user} onAdd={handleAdd} onClose={closeAdd} initialLat={mapClickPos?.lat} initialLng={mapClickPos?.lng} terrainCities={allCities}/>}
      {toast && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.aLow,border:`1px solid ${C.accent}55`,borderRadius:10,padding:"9px 20px",fontSize:12,color:C.accent,fontWeight:700,backdropFilter:"blur(8px)",zIndex:999,whiteSpace:"nowrap"}}>✅ "{toast}" {tr('map.terrain_added')}</div>}
    </div>
  );
}

// ─── TERRAIN DETAIL TABS ──────────────────────────────────────────────────────
function ItineraryTab({ terrain, sp }) {
  const {t} = useTranslation();
  const [status,setStatus]   = useState("idle");
  const [pos,setPos]         = useState(null);
  const [mode,setMode]       = useState("walking");
  const [result,setResult]   = useState(null);
  const [city,setCity]       = useState("");
  const [cityErr,setCityErr] = useState("");
  const [showManual,setShowManual] = useState(false);

  const MODES = [
    { id:"walking", icon:"🚶", label:t('terrain.mode_walking') },
    { id:"driving", icon:"🚗", label:t('terrain.mode_driving') },
    { id:"transit", icon:"🚇", label:t('terrain.mode_transit') },
  ];

  const calcRoute = (p, m) => {
    if (!terrain.lat||!terrain.lng) { setResult({dur:"N/A",dist:"?",steps:[t('terrain.gps_coords_unavailable')],mins:0}); return; }
    const d = haversine(p.lat,p.lng,terrain.lat,terrain.lng);
    const km = d.toFixed(1);
    let mins, steps;
    if (m==="walking")  { mins=Math.round(d/5*60);  steps=[`🚶 ${km} km`,`📍 ${terrain.name}`]; }
    else if (m==="driving") { mins=Math.round(d/40*60); steps=[`🚗 ${terrain.city}`,`🛣️ ${km} km`,`📍 ${terrain.name}`]; }
    else { mins=Math.round(d/20*60); steps=[`🚇 ${km} km → ${terrain.city}`,`📍 ${terrain.name}`]; }
    const h=Math.floor(mins/60), min=mins%60;
    setResult({ dur:h>0?`${h}h${min>0?min+"min":""}`:mins+" min", dist:km, steps, mins });
  };

  const locate = async () => {
    setStatus("locating"); setShowManual(false);
    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === "denied") { setStatus("error"); return; }
        const p = await Geolocation.getCurrentPosition({ timeout: 6000 });
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPos(pos); setStatus("ready"); calcRoute(pos, mode);
      } catch { setStatus("error"); }
      return;
    }
    if (!navigator.geolocation) { setStatus("error"); return; }
    navigator.geolocation.getCurrentPosition(
      p => { const pos={lat:p.coords.latitude,lng:p.coords.longitude}; setPos(pos); setStatus("ready"); calcRoute(pos,mode); },
      () => setStatus("error"),
      { timeout:6000 }
    );
  };

  const locateCity = () => {
    const key = city.trim().toLowerCase();
    const match = Object.entries(CITIES).find(([k]) => k.includes(key)||key.includes(k));
    if (!match) { setCityErr(t('terrain.city_not_found_hint')); return; }
    setCityErr("");
    const p = { lat:match[1][0], lng:match[1][1] };
    setPos(p); setStatus("ready"); calcRoute(p,mode);
  };

  const changeMode = m => { setMode(m); if(pos) calcRoute(pos,m); };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Mode selector */}
      <div style={{display:"flex",gap:8}}>
        {MODES.map(m=>(
          <button key={m.id} onClick={()=>changeMode(m.id)} style={{flex:1,padding:"10px 8px",borderRadius:10,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,background:mode===m.id?`${sp?.color}20`:C.card2,outline:`2px solid ${mode===m.id?sp?.color:C.border}`,border:"none",color:mode===m.id?sp?.color:C.sub}}>
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {status==="idle" && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={locate} style={{width:"100%",padding:"14px",borderRadius:12,background:`${sp?.color}20`,border:`2px solid ${sp?.color}50`,color:sp?.color,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
            📍 {t('terrain.use_gps')}
          </button>
          <button onClick={()=>setShowManual(p=>!p)} style={{width:"100%",padding:"11px",borderRadius:10,background:C.card2,border:`1px solid ${C.border}`,color:C.sub,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
            ✍️ {t('terrain.enter_city_manual')}
          </button>
          {showManual && (
            <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",gap:8}}>
                <input value={city} onChange={e=>{setCity(e.target.value);setCityErr("");}} onKeyDown={e=>e.key==="Enter"&&locateCity()} placeholder={t('terrain.city_route_placeholder')} autoFocus
                  style={{flex:1,background:C.card2,border:`1.5px solid ${cityErr?C.red:C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font}}/>
                <button onClick={locateCity} style={{background:C.accent,border:"none",borderRadius:9,padding:"10px 16px",color:"#06090f",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>→</button>
              </div>
              {cityErr && <span style={{fontSize:11,color:C.red}}>{cityErr}</span>}
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {["Paris","Lyon","Marseille","Londres","Madrid","Tokyo","New York","Dubai"].map(c=>(
                  <button key={c} onClick={()=>{setCity(c);setCityErr("");}} style={{padding:"4px 10px",borderRadius:6,background:city===c?C.aLow:C.card2,border:`1px solid ${city===c?C.accent:C.border}`,color:city===c?C.accent:C.sub,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>{c}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status==="locating" && (
        <div style={{textAlign:"center",padding:24,color:C.sub,fontSize:13}}>
          <div style={{fontSize:36,marginBottom:10}}>🌐</div>{t('terrain.gps_locating')}
        </div>
      )}

      {status==="error" && (
        <div style={{background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.25)",borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:12}}>
            <div style={{fontSize:28}}>🔒</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:4}}>{t('terrain.gps_blocked_title')}</div>
              <div style={{fontSize:12,color:C.sub,lineHeight:1.6}}>{t('terrain.enter_city_below')}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={city} onChange={e=>{setCity(e.target.value);setCityErr("");}} onKeyDown={e=>e.key==="Enter"&&locateCity()} placeholder={t('terrain.city_route_placeholder')} autoFocus
              style={{flex:1,background:C.card2,border:`1.5px solid ${cityErr?C.red:C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:14,outline:"none",fontFamily:C.font}}/>
            <button onClick={locateCity} style={{background:C.accent,border:"none",borderRadius:9,padding:"10px 18px",color:"#06090f",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>→</button>
          </div>
          {cityErr && <span style={{fontSize:11,color:C.red}}>{cityErr}</span>}
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {["Paris","Lyon","Marseille","Bordeaux","Lille","Londres","Madrid","Tokyo"].map(c=>(
              <button key={c} onClick={()=>{setCity(c);setCityErr("");}} style={{padding:"5px 11px",borderRadius:7,background:city===c?C.aLow:C.card2,border:`1px solid ${city===c?C.accent:C.border}`,color:city===c?C.accent:C.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>{c}</button>
            ))}
          </div>
          <button onClick={locate} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px",color:C.sub,fontSize:12,cursor:"pointer",fontFamily:C.font}}>🔄 {t('terrain.retry_gps')}</button>
        </div>
      )}

      {status==="ready" && result && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"7px 12px",fontSize:12,color:C.accent,display:"flex",alignItems:"center",gap:8}}>
            📍 {t('terrain.from_label')} : <strong>{city||t('terrain.gps_pos_label')}</strong>
            <button onClick={()=>{setStatus("idle");setResult(null);setPos(null);setCity("");}} style={{marginLeft:"auto",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:11,fontFamily:C.font}}>✕ {t('terrain.change_pos')}</button>
          </div>
          <div style={{background:`linear-gradient(135deg,${sp?.color}18,${C.card2})`,border:`2px solid ${sp?.color}44`,borderRadius:16,padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                <div style={{fontFamily:C.head,fontWeight:700,fontSize:38,color:sp?.color,lineHeight:1}}>{result.dur}</div>
                <div style={{fontSize:12,color:C.sub,marginTop:3}}>{MODES.find(m=>m.id===mode)?.label} · {result.dist} km</div>
              </div>
              <div style={{fontSize:34}}>{MODES.find(m=>m.id===mode)?.icon}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {result.steps.map((s,i)=>(
                <div key={i} style={{display:"flex",gap:10,fontSize:13,color:C.text}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:`${sp?.color}30`,border:`1px solid ${sp?.color}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:sp?.color,fontWeight:700,flexShrink:0}}>{i+1}</div>
                  {s}
                </div>
              ))}
            </div>
          </div>
          <button onClick={()=>{ if(!terrain.lat||!terrain.lng) return; window.open(pos?`https://www.google.com/maps/dir/${pos.lat},${pos.lng}/${terrain.lat},${terrain.lng}`:`https://www.google.com/maps/search/?api=1&query=${terrain.lat},${terrain.lng}`,"_blank"); }}
            style={{width:"100%",padding:"12px",borderRadius:12,background:"rgba(66,133,244,.15)",border:"2px solid rgba(66,133,244,.4)",color:"#4285f4",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:C.font,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <span style={{fontSize:18}}>🗺️</span> {t('terrain.open_gmaps')}
          </button>
          {result.mins>0 && (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:C.sub}}>⏰ {t('terrain.arrival_est')}</span>
              <span style={{fontSize:14,fontWeight:700,color:C.text}}>{(()=>{const e=new Date(Date.now()+result.mins*60000);return`${String(e.getHours()).padStart(2,"0")}h${String(e.getMinutes()).padStart(2,"0")}`;})()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReservationTab({ terrain, user, sp }) {
  const {t} = useTranslation();
  useStore(BOOK);
  const isFree = terrain.free||terrain.price==="Gratuit";
  const [step,setStep]           = useState("pick");
  const [selDay,setSelDay]       = useState(null);
  const [selHour,setSelHour]     = useState(null);
  const [phone,setPhone]         = useState("");
  const [phoneErr,setPhoneErr]   = useState("");
  const [showPhone,setShowPhone] = useState(null);
  const [weekOffset,setWeekOffset] = useState(0); // 0=cette sem, 1=suivante, …

  const MAX_WEEKS = 3; // 0..3 = 4 semaines dispo
  const now = new Date();
  const di0 = (now.getDay()+6)%7; // index jour courant (0=Lun)
  const hi0 = Math.max(0, Math.floor((now.getHours()-8)/2));

  // Lundi de la semaine affichée
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - di0 + weekOffset*7);
  weekStart.setHours(0,0,0,0);
  const weekDates = DAYS.map((_,i) => new Date(weekStart.getTime() + i*86400000));
  const MONTH_KEYS = ["month_jan","month_feb","month_mar","month_apr","month_may","month_jun","month_jul","month_aug","month_sep","month_oct","month_nov","month_dec"];
  const fd = d => d.getDate();
  const fm = d => t('common.'+MONTH_KEYS[d.getMonth()]);
  const weekLabel = `${fd(weekDates[0])} — ${fd(weekDates[6])} ${fm(weekDates[6])}`;
  const isCurWeek = weekOffset===0;

  const bookedSlots = BOOK.forTerrain(terrain.id);
  const myBookings  = bookedSlots.filter(b=>b.user===user?.name);
  // bookings are week-aware; legacy bookings (no weekOffset) default to week 0
  const booked = (d,h) => bookedSlots.some(b=>b.day===d&&b.hour===h&&(b.weekOffset??0)===weekOffset);
  const mine   = (d,h) => myBookings.some(b=>b.day===d&&b.hour===h&&(b.weekOffset??0)===weekOffset);

  const isPastSlot = (di,hi) => isCurWeek && (di<di0||(di===di0&&hi<hi0));

  const resetPick = () => { setStep("pick"); setSelDay(null); setSelHour(null); };

  const changeWeek = delta => {
    const next = weekOffset+delta;
    if (next<0||next>MAX_WEEKS) return;
    setWeekOffset(next);
    resetPick();
  };

  const select = (d,h) => {
    const di=DAYS.indexOf(d), hi=HOURS.indexOf(h);
    if (isPastSlot(di,hi)||booked(d,h)) return;
    setSelDay(d); setSelHour(h); setStep("confirm");
  };

  const confirm = () => {
    if (!isFree) {
      if (!phone.trim()) { setPhoneErr(t('terrain.phone_required_err')); return; }
      if (!/^[\d\s\+\-\(\)]{8,15}$/.test(phone.replace(/\s/g,""))) { setPhoneErr(t('terrain.phone_invalid_err')); return; }
    }
    BOOK.add({ user:user?.name||"Joueur", terrainId:terrain.id, day:selDay, hour:selHour, weekOffset, phone:isFree?null:phone });
    const slotParts = [...new Set(BOOK.list.filter(b=>b.terrainId===terrain.id&&b.day===selDay&&b.hour===selHour).map(b=>b.user))];
    MATCH_SCORE.add({ terrainId:terrain.id, terrainName:terrain.name, terrainSport:terrainSports(terrain)[0], day:selDay, hour:selHour, participants:slotParts });
    if (user?.id) addXP(user.id, XP_REWARDS.visit);
    setStep("done"); setPhone(""); setPhoneErr("");
  };

  const slotStyle = (d,h) => {
    const di=DAYS.indexOf(d), hi=HOURS.indexOf(h);
    const isPast=isPastSlot(di,hi), isBooked=booked(d,h), isMine=mine(d,h);
    const isSel=selDay===d&&selHour===h, isNow=isCurWeek&&di===di0&&hi===hi0;
    let bg,bd;
    if (isPast)       { bg=C.card2; bd=C.border; }
    else if (isMine)  { bg=`${C.accent}22`; bd=C.accent; }
    else if (isBooked){ bg="rgba(255,107,107,.12)"; bd="rgba(255,107,107,.35)"; }
    else if (isSel)   { bg=`${sp?.color}30`; bd=sp?.color; }
    else              { bg=C.card2; bd=isNow?sp?.color:C.border; }
    return { height:36,borderRadius:7,cursor:isPast||(isBooked&&!isMine)?"not-allowed":"pointer",background:bg,border:`2px solid ${bd}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,opacity:isPast?.25:1,boxShadow:isNow&&!isPast?`0 0 8px ${sp?.color}55`:"none" };
  };

  // Label date for a selected day in the current viewed week
  const selDate = selDay ? weekDates[DAYS.indexOf(selDay)] : null;
  const selDateLabel = selDate ? `${fd(selDate)} ${fm(selDate)}` : "";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Tarif */}
      <div style={{background:isFree?C.aLow:"rgba(255,107,53,.1)",border:`1px solid ${isFree?C.accent+"44":"#ff6b3544"}`,borderRadius:14,padding:14,display:"flex",gap:12,alignItems:"center"}}>
        <div style={{fontSize:32}}>{isFree?"🆓":"💳"}</div>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:isFree?C.accent:C.orange}}>{isFree?t('terrain.free_hint'):t('terrain.paying_hint')}</div>
          <div style={{fontSize:12,color:C.sub,marginTop:2}}>{terrain.price}</div>
        </div>
      </div>

      {/* Sélecteur de semaine */}
      <div style={{display:"flex",alignItems:"center",gap:8,background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 12px"}}>
        <button onClick={()=>changeWeek(-1)} disabled={weekOffset===0}
          style={{background:weekOffset>0?C.card2:"transparent",border:`1px solid ${weekOffset>0?C.border:"transparent"}`,borderRadius:8,padding:"5px 11px",color:weekOffset>0?C.text:C.sub,cursor:weekOffset>0?"pointer":"default",fontSize:13,fontWeight:700,fontFamily:C.font,opacity:weekOffset>0?1:.25,flexShrink:0}}>
          ‹
        </button>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:12,fontWeight:700,color:isCurWeek?C.accent:C.text,lineHeight:1.2}}>
            {isCurWeek?t('terrain.this_week'):t('terrain.week_plus',{n:weekOffset})}
          </div>
          <div style={{fontSize:10,color:C.sub,marginTop:2}}>{weekLabel}</div>
        </div>
        {/* Week dots */}
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          {Array.from({length:MAX_WEEKS+1},(_,i)=>(
            <div key={i} onClick={()=>changeWeek(i-weekOffset)} style={{width:i===weekOffset?14:7,height:7,borderRadius:4,background:i===weekOffset?sp?.color||C.accent:C.card2,border:`1px solid ${i===weekOffset?sp?.color||C.accent:C.border}`,cursor:"pointer",transition:"all .2s"}}/>
          ))}
        </div>
        <button onClick={()=>changeWeek(1)} disabled={weekOffset===MAX_WEEKS}
          style={{background:weekOffset<MAX_WEEKS?C.card2:"transparent",border:`1px solid ${weekOffset<MAX_WEEKS?C.border:"transparent"}`,borderRadius:8,padding:"5px 11px",color:weekOffset<MAX_WEEKS?C.text:C.sub,cursor:weekOffset<MAX_WEEKS?"pointer":"default",fontSize:13,fontWeight:700,fontFamily:C.font,opacity:weekOffset<MAX_WEEKS?1:.25,flexShrink:0}}>
          ›
        </button>
      </div>

      {step!=="done" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"30px repeat(7,1fr)",gap:2,marginBottom:4}}>
            <div/>
            {DAYS.map((d,i)=>{
              const isToday=isCurWeek&&i===di0;
              return (
                <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,padding:"3px 1px",borderRadius:5,color:isToday?sp?.color:C.sub,background:isToday?`${sp?.color}18`:"transparent"}}>
                  {t('days.'+d)}
                  <div style={{fontSize:8,opacity:.65,marginTop:1}}>{fd(weekDates[i])}</div>
                  {isToday&&<div style={{fontSize:7,color:sp?.color}}>NOW</div>}
                </div>
              );
            })}
          </div>
          {HOURS.map((h,hi)=>(
            <div key={h} style={{display:"grid",gridTemplateColumns:"30px repeat(7,1fr)",gap:2,marginBottom:2}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4,fontSize:9,fontWeight:600,color:isCurWeek&&hi===hi0?sp?.color:C.sub}}>{h}</div>
              {DAYS.map(d=>{
                const di=DAYS.indexOf(d), isPast=isPastSlot(di,hi), isBooked=booked(d,h), isMine2=mine(d,h);
                return (
                  <div key={d} onClick={()=>!isPast&&!isBooked&&!isMine2&&select(d,h)} style={{...slotStyle(d,h),height:32,borderRadius:6}}>
                    {isMine2&&<div style={{fontSize:8,color:C.accent,fontWeight:700}}>{t('terrain.me_badge')}</div>}
                    {isBooked&&!isMine2&&<div style={{fontSize:10}}>🔒</div>}
                    {!isBooked&&!isMine2&&!isPast&&<div style={{fontSize:7,color:C.sub}}>{t('terrain.legend_free')}</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {step==="confirm" && (
        <div style={{background:C.card,border:`1px solid ${sp?.color}44`,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>{t('terrain.confirm_booking_title')}</div>
          <div style={{background:C.card2,borderRadius:10,padding:12,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center"}}><SportEmoji sport={sp} size={24}/></div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.text}}>{terrain.name}</div>
              <div style={{fontSize:13,color:sp?.color,fontWeight:700}}>{selDay} {selDateLabel} · {selHour}</div>
              {!isCurWeek&&<div style={{fontSize:11,color:C.sub,marginTop:1}}>{t('terrain.week_plus',{n:weekOffset})}</div>}
            </div>
          </div>
          {!isFree && (
            <Field label={t('terrain.phone_label')+' *'} type="tel" value={phone} onChange={e=>{setPhone(e.target.value);setPhoneErr("");}} placeholder="+33 6 12 34 56 78" error={phoneErr} icon="📞"/>
          )}
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={confirm} variant="solid">{isFree?"✅ "+t('terrain.confirm_action'):"📞 "+t('terrain.confirm_action')}</Btn>
            <Btn onClick={resetPick} variant="ghost">{t('terrain.cancel')}</Btn>
          </div>
        </div>
      )}

      {step==="done" && (
        <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:14,padding:20,textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:8}}>🎉</div>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.accent,marginBottom:4}}>{t('terrain.booking_done_title')}</div>
          <div style={{fontSize:13,color:C.sub,marginBottom:14}}>{t('days.'+selDay)} {selDateLabel} · {selHour} · {terrain.name}</div>
          <Btn onClick={resetPick} variant="ghost" full={false} style={{padding:"8px 20px",fontSize:12}}>{t('terrain.another_slot')}</Btn>
        </div>
      )}

      {myBookings.length>0 && (
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{t('terrain.my_bookings')}</div>
          {myBookings.map(b=>{
            const wo = b.weekOffset??0;
            const bStart = new Date(now);
            bStart.setDate(now.getDate()-di0+wo*7);
            const bDate = new Date(bStart.getTime()+DAYS.indexOf(b.day)*86400000);
            const bLabel = `${fd(bDate)} ${fm(bDate)}`;
            return (
              <div key={b.id} style={{background:C.card,border:`1px solid ${C.accent}33`,borderRadius:10,padding:10,display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center"}}><SportEmoji sport={sp} size={20}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{t('days.'+b.day)} {bLabel} · {b.hour}</div>
                  {wo>0&&<div style={{fontSize:10,color:C.blue,marginTop:1}}>{t('terrain.week_plus',{n:wo})}</div>}
                  {b.phone&&<div style={{fontSize:11,color:C.orange,display:"flex",alignItems:"center",gap:5}}>📞 {showPhone===b.id?b.phone:"•••••••"}<button onClick={()=>setShowPhone(showPhone===b.id?null:b.id)} style={{background:"none",border:"none",color:C.orange,cursor:"pointer",fontSize:10,fontFamily:C.font,textDecoration:"underline"}}>{showPhone===b.id?t('terrain.hide_phone'):t('terrain.show_phone')}</button></div>}
                </div>
                <Badge label={t('terrain.confirmed_badge')} color={C.accent}/>
                <button onClick={()=>BOOK.cancel(b.id)} style={{background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:6,padding:"4px 8px",color:C.red,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>{t('terrain.cancel')}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DispoTab({ terrain, user, sp }) {
  const {t} = useTranslation();
  useStore(RT);
  const now=new Date(), di0=(now.getDay()+6)%7, hi0=Math.max(0,Math.floor((now.getHours()-8)/2));
  const cDay=DAYS[di0]||DAYS[0], cHour=HOURS[hi0]||HOURS[0];
  const slots = RT.slots[terrain.id] || {};
  const [mySlots,setMySlots] = useState({});
  const [saved,setSaved]     = useState(false);

  useEffect(()=>{
    const iv = setInterval(()=>{
      const p=SEED_PLAYERS[Math.floor(Math.random()*SEED_PLAYERS.length)];
      const d=DAYS[Math.max(0,di0-1+Math.floor(Math.random()*3))];
      const h=HOURS[Math.floor(Math.random()*HOURS.length)];
      if(d&&h) RT.join(terrain.id,`${d}-${h}`,p);
    }, 8000);
    return ()=>clearInterval(iv);
  },[terrain.id]);

  const toggle = (d,h) => {
    if (!user) return;
    const key=`${d}-${h}`, isMine=mySlots[key];
    if (isMine) { RT.leave(terrain.id,key,user.name); setMySlots(p=>({...p,[key]:false})); }
    else { RT.join(terrain.id,key,{name:user.name,avatar:user.avatar,flag:"🌍"}); setMySlots(p=>({...p,[key]:true})); }
  };

  const colOf = n => {
    if (!n) return { bg:C.card2, bd:C.border, tx:C.sub };
    if (n<3) return { bg:"rgba(77,171,247,.14)", bd:"#4dabf755", tx:"#4dabf7" };
    if (n<6) return { bg:"rgba(252,196,25,.14)",  bd:"#fcc41955", tx:"#fcc419" };
    return           { bg:"rgba(255,107,53,.14)",  bd:"#ff6b3555", tx:"#ff6b35" };
  };

  const nowKey=`${cDay}-${cHour}`, nowPlayers=slots[nowKey]||[];
  const allPlayers=[...new Set(Object.values(slots).flatMap(a=>(a||[]).map(p=>p.name)))];
  const totalMine=Object.values(mySlots).filter(Boolean).length;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Live bar */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`,animation:"pulse 1.5s infinite"}}/>
          <span style={{fontSize:11,color:C.sub,fontWeight:600,letterSpacing:.5}}>{t('terrain.live_world')}</span>
        </div>
        <div style={{display:"flex"}}>
          {allPlayers.slice(0,7).map((name,i)=><div key={name} style={{marginLeft:i?-8:0,border:`2px solid ${C.card}`}}><Avatar name={name} size={24} color={sp?.color}/></div>)}
          {allPlayers.length>7&&<div style={{width:24,height:24,borderRadius:"50%",background:C.card2,border:`2px solid ${C.card}`,marginLeft:-8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:C.sub,fontWeight:700}}>+{allPlayers.length-7}</div>}
        </div>
        <span style={{fontSize:11,color:C.sub}}>{allPlayers.length} joueur{allPlayers.length>1?"s":""} cette semaine</span>
      </div>

      {/* Je suis là */}
      <div style={{background:`linear-gradient(135deg,${sp?.color}15,${C.card2})`,border:`1px solid ${sp?.color}44`,borderRadius:14,padding:14,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:26}}>📍</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{t('terrain.you_here_question')}</div>
          <div style={{fontSize:11,color:C.sub,marginTop:2}}>{cDay} · <span style={{color:sp?.color,fontWeight:700}}>{now.getHours()}h{String(now.getMinutes()).padStart(2,"0")}</span>
            {nowPlayers.length>0 && <span style={{color:C.green}}> · {nowPlayers.length} présent{nowPlayers.length>1?"s":""}</span>}
          </div>
        </div>
        <button onClick={()=>toggle(cDay,cHour)} style={{padding:"9px 18px",borderRadius:10,cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:12,border:"none",background:mySlots[nowKey]?`${sp?.color}22`:C.aLow,color:mySlots[nowKey]?sp?.color:C.accent,outline:`1px solid ${mySlots[nowKey]?sp?.color+"55":C.accent+"55"}`}}>
          {mySlots[nowKey]?t('terrain.im_here_active'):t('terrain.im_here_btn')}
        </button>
      </div>

      {nowPlayers.length>0 && (
        <div style={{background:C.card,border:`1px solid ${sp?.color}44`,borderRadius:12,padding:12}}>
          <div style={{fontSize:10,fontWeight:700,color:sp?.color,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>🟢 {t('terrain.on_field_now')}</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {nowPlayers.map(p=>(
              <div key={p.name} style={{display:"flex",alignItems:"center",gap:7,background:C.card2,borderRadius:20,padding:"4px 10px 4px 5px"}}>
                <Avatar name={p.name} size={22} color={sp?.color}/>
                <UserBadge name={p.name} user={DB.find(x=>x.name===p.name)} size="sm" showLevel={false} showInsignes={false}/>
                <span style={{fontSize:10,color:C.sub}}>{timeAgo(p.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalMine>0 && (
        <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.accent,fontWeight:600}}>✅ {t('profile.slots_selected',{count:totalMine})}</span>
          <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}} style={{background:"none",border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 12px",color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
            {saved?t('terrain.saved_slots'):t('terrain.save_slots')}
          </button>
        </div>
      )}

      {/* Grid */}
      <div>
        <div style={{display:"grid",gridTemplateColumns:"30px repeat(7,1fr)",gap:2,marginBottom:4}}>
          <div/>
          {DAYS.map((d,i)=>(
            <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,padding:"3px 1px",borderRadius:5,color:i===di0?sp?.color:C.sub,background:i===di0?`${sp?.color}18`:"transparent"}}>
              {t('days.'+d)}{i===di0&&<div style={{fontSize:7}}>NOW</div>}
            </div>
          ))}
        </div>
        {HOURS.map((h,hi)=>(
          <div key={h} style={{display:"grid",gridTemplateColumns:"30px repeat(7,1fr)",gap:2,marginBottom:2}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4,fontSize:9,fontWeight:600,color:hi===hi0?sp?.color:C.sub}}>{h}</div>
            {DAYS.map((d,di)=>{
              const key=`${d}-${h}`, players=slots[key]||[], isMine=mySlots[key];
              const isNow=di===di0&&hi===hi0, isPast=di<di0||(di===di0&&hi<hi0);
              const col=colOf(players.length);
              return (
                <div key={d} onClick={()=>!isPast&&toggle(d,h)}
                  style={{height:32,borderRadius:6,cursor:isPast?"default":"pointer",background:isMine?`${sp?.color}33`:col.bg,border:`2px solid ${isNow?sp?.color:isMine?sp?.color+"77":col.bd}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,opacity:isPast?.25:1,boxShadow:isNow?`0 0 8px ${sp?.color}55`:"none"}}>
                  {players.length>0&&<div style={{fontSize:8,fontWeight:700,color:isMine?sp?.color:col.tx}}>👥{players.length}</div>}
                  {isMine&&<div style={{fontSize:7,color:sp?.color,fontWeight:700}}>{t('terrain.me_badge')}</div>}
                  {isNow&&!isMine&&players.length===0&&<div style={{fontSize:10}}>👁️</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {[[t('terrain.legend_free'),C.sub,C.card2],["1–2","#4dabf7","rgba(77,171,247,.14)"],["3–5","#fcc419","rgba(252,196,25,.14)"],[t('terrain.legend_full'),"#ff6b35","rgba(255,107,53,.14)"],[t('terrain.legend_me'),sp?.color,`${sp?.color}33`]].map(([l,col,bg])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.sub}}>
            <div style={{width:12,height:12,borderRadius:3,background:bg,border:`1px solid ${col}44`}}/>{l}
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

function PhotosTab({ terrain, user, sp }) {
  const {t} = useTranslation();
  useStore(RT);
  const photos  = RT.photos[terrain.id]||[];
  const fileRef = useRef();
  const [caption,setCaption]   = useState("");
  const [uploading,setUploading] = useState(false);
  const [flash,setFlash]       = useState(false);

  const upload = e => {
    const file=e.target.files[0]; if(!file) return;
    setUploading(true);
    const r=new FileReader();
    r.onload=ev=>{
      RT.addPhoto(terrain.id,{ id:"p"+Date.now(), author:user?.name||"Anonyme", flag:"🌍", src:ev.target.result, caption:caption.trim()||"Photo du terrain", postedAt:new Date().toISOString(), likes:0, likedBy:[] });
      setCaption(""); setUploading(false); setFlash(true); setTimeout(()=>setFlash(false),2500);
    };
    r.readAsDataURL(file);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:C.card,border:`1px solid ${sp?.color}33`,borderRadius:14,padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:sp?.color,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>{t('terrain.share_photo_title')}</div>
        <input value={caption} onChange={e=>setCaption(e.target.value)} placeholder={t('terrain.photo_caption_ph')}
          style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font,marginBottom:8}}/>
        <button onClick={()=>fileRef.current.click()} style={{width:"100%",padding:"9px",background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:8,color:C.accent,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
          {uploading?t('terrain.sending_photo'):t('terrain.choose_photo')}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={upload}/>
      </div>

      {flash && <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"9px 14px",color:C.accent,fontSize:12,fontWeight:700}}>{t('terrain.photo_shared')}</div>}

      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 8px ${C.green}`,animation:"pulse 1.5s infinite"}}/>
        <span style={{fontSize:11,color:C.sub,fontWeight:600}}>LIVE · {photos.length} photo{photos.length>1?"s":""}</span>
      </div>

      {photos.map(photo=>{
        const liked = photo.likedBy.includes(user?.name||"");
        return (
          <div key={photo.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,padding:"10px 12px"}}>
              <Avatar name={photo.author} size={30} color={sp?.color}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text,display:"flex",alignItems:"center",gap:4}}>
                  <UserBadge name={photo.author} user={DB.find(x=>x.name===photo.author)} size="sm" showLevel={false} showInsignes={false}/>
                  <span style={{fontSize:13}}>{photo.flag||"🌍"}</span>
                </div>
                <div style={{fontSize:10,color:C.sub}}>{timeAgo(photo.postedAt)}</div>
              </div>
              <span style={{fontSize:18}}>{photo.emoji||sp?.emoji}</span>
            </div>
            {photo.src
              ? <img src={photo.src} alt="" style={{width:"100%",maxHeight:240,objectFit:"cover",display:"block"}}/>
              : <div style={{height:140,background:`linear-gradient(135deg,${sp?.color}15,${C.card2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44}}>{photo.emoji||sp?.emoji}</div>
            }
            <div style={{padding:"9px 12px"}}>
              <p style={{fontSize:12,color:C.text,marginBottom:8,lineHeight:1.5}}>{photo.caption}</p>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <button onClick={()=>RT.like(terrain.id,photo.id,user?.name||"anon")} style={{background:"none",border:"none",cursor:"pointer",color:liked?C.orange:C.sub,fontSize:12,fontWeight:600,fontFamily:C.font,padding:0,display:"flex",alignItems:"center",gap:4}}>
                  {liked?"❤️":"🤍"} {photo.likes}
                </button>
                <span style={{fontSize:11,color:C.sub,cursor:"pointer"}}>💬 {t('common.comment_btn')}</span>
                <span style={{fontSize:11,color:C.sub,cursor:"pointer",marginLeft:"auto"}}>🔗 {t('common.share_btn')}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InviteTab({ terrain, user, sp }) {
  const {t} = useTranslation();
  useStore(INV);
  const [selDay,setSelDay]   = useState(DAYS[(new Date().getDay()+6)%7]);
  const [selHour,setSelHour] = useState(HOURS[Math.max(0,Math.floor((new Date().getHours()-8)/2))]);
  const [note,setNote]       = useState("");
  const [selected,setSelected] = useState([]);
  const [sent,setSent]       = useState(false);

  const myInvites = INV.fromUser(user?.name||"").filter(i=>i.terrainId===terrain.id);
  const toggle = name => setSelected(p=>p.includes(name)?p.filter(x=>x!==name):[...p,name]);

  const sendInvites = () => {
    if (!selected.length) return;
    selected.forEach(to => INV.send({ from:user?.name||"", to, terrainId:terrain.id, terrainName:terrain.name, sport:terrain.sport, day:selDay, hour:selHour, note:note.trim()||t('terrain.invite_note_ph',{name:terrain.name}) }));
    setSent(true); setSelected([]); setNote("");
    setTimeout(()=>setSent(false),3000);
  };

  const stCol = s => s==="accepted"?C.green:s==="declined"?C.red:C.yellow;
  const stLbl = s => s==="accepted"?t('terrain.status_accepted'):s==="declined"?t('terrain.status_declined'):t('terrain.status_pending');

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{background:`linear-gradient(135deg,${sp?.color}18,${C.card2})`,border:`1px solid ${sp?.color}44`,borderRadius:14,padding:14,display:"flex",gap:12,alignItems:"center"}}>
        <div style={{fontSize:32}}>🤝</div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>{t('terrain.invite_title')}</div>
          <div style={{fontSize:12,color:C.sub,marginTop:2}}>{t('terrain.invite_sub')}</div>
        </div>
      </div>

      {/* Créneau */}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📅 {t('terrain.choose_slot')}</div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.sub,marginBottom:5,fontWeight:600}}>{t('terrain.day_label')}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {DAYS.map(d=><button key={d} onClick={()=>setSelDay(d)} style={{padding:"5px 9px",borderRadius:7,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:11,background:selDay===d?`${sp?.color}20`:C.card2,border:`1.5px solid ${selDay===d?sp?.color:C.border}`,color:selDay===d?sp?.color:C.sub}}>{t('days.'+d)}</button>)}
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.sub,marginBottom:5,fontWeight:600}}>{t('terrain.hour_label')}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {HOURS.map(h=><button key={h} onClick={()=>setSelHour(h)} style={{padding:"5px 9px",borderRadius:7,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:11,background:selHour===h?`${sp?.color}20`:C.card2,border:`1.5px solid ${selHour===h?sp?.color:C.border}`,color:selHour===h?sp?.color:C.sub}}>{h}</button>)}
            </div>
          </div>
        </div>
      </div>

      {/* Joueurs */}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
          👥 {t('terrain.invite_players')} <span style={{color:C.accent}}>({selected.length})</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {SEED_PLAYERS.filter(p=>p.name!==user?.name).map(p=>{
            const isSel=selected.includes(p.name);
            return (
              <div key={p.name} onClick={()=>toggle(p.name)}
                style={{background:isSel?`${sp?.color}15`:C.card2,border:`1.5px solid ${isSel?sp?.color:C.border}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                <Avatar name={p.name} size={36} color={isSel?sp?.color:C.sub}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text,display:"flex",alignItems:"center",gap:4}}>
                    <UserBadge name={p.name} user={DB.find(x=>x.name===p.name)} size="sm" showLevel showInsignes/>
                    {p.flag}
                  </div>
                  <div style={{fontSize:11,color:C.sub}}>{t('terrain.player_rvf')}</div>
                </div>
                <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${isSel?sp?.color:C.border}`,background:isSel?`${sp?.color}22`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:sp?.color}}>
                  {isSel?"✓":""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>💬 {t('common.message_label')}</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
          placeholder={t('terrain.invite_note_ph',{name:terrain.name})}
          style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none"}}/>
      </div>

      {sent
        ? <div style={{background:"rgba(81,207,102,.1)",border:"1px solid rgba(81,207,102,.3)",borderRadius:12,padding:14,textAlign:"center",fontSize:14,fontWeight:700,color:C.green}}>🎉 {t('terrain.invitations_sent')}</div>
        : <Btn onClick={sendInvites} disabled={!selected.length} variant="solid" style={{fontSize:15,padding:"14px"}}>
            🤝 {selected.length>0?t('terrain.send_invitations',{count:selected.length}):t('terrain.invite_players')} →
          </Btn>
      }

      {myInvites.length>0 && (
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📬 {t('terrain.sent_invites')}</div>
          {myInvites.map(inv=>(
            <div key={inv.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,marginBottom:7}}>
              <Avatar name={inv.to} size={32} color={stCol(inv.status)}/>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{inv.to}</div>
                <div style={{fontSize:11,color:C.sub}}>{inv.day} · {inv.hour}</div>
              </div>
              <Badge label={stLbl(inv.status)} color={stCol(inv.status)}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TERRAIN DETAIL ───────────────────────────────────────────────────────────
function TerrainDetail({ terrain, onBack, user, onUpdatePhone, onDelete }) {
  const {t} = useTranslation();
  const [tab,setTab] = useState("itinerary");
  const [confirmDel, setConfirmDel] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [userPhoneInput, setUserPhoneInput] = useState("");
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [addPhoneVal, setAddPhoneVal] = useState("");
  const [slideDir, setSlideDir] = useState("");
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const tSportList = terrain ? terrainSports(terrain).map(id=>SPORTS.find(s=>s.id===id)).filter(Boolean) : [];
  const sp = tSportList[0];

  useEffect(() => {
    if (document.getElementById('rvf-swipe-anim')) return;
    const s = document.createElement('style');
    s.id = 'rvf-swipe-anim';
    s.textContent = [
      '@keyframes rvfSlideR{from{opacity:0;transform:translateX(44px)}to{opacity:1;transform:translateX(0)}}',
      '@keyframes rvfSlideL{from{opacity:0;transform:translateX(-44px)}to{opacity:1;transform:translateX(0)}}',
      '.rvf-slide-r{animation:rvfSlideR .23s cubic-bezier(.25,.46,.45,.94)}',
      '.rvf-slide-l{animation:rvfSlideL .23s cubic-bezier(.25,.46,.45,.94)}',
    ].join('');
    document.head.appendChild(s);
  }, []);

  if (!terrain) return null;

  const TABS_LIST = ["itinerary","invite","resa","dispo","photos","info"];
  const tabIdx = TABS_LIST.indexOf(tab);

  const goToTab = (newTab, dir) => { setSlideDir(dir); setTab(newTab); };

  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = e => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) {
      if (dx < 0 && tabIdx < TABS_LIST.length - 1) goToTab(TABS_LIST[tabIdx + 1], "right");
      if (dx > 0 && tabIdx > 0) goToTab(TABS_LIST[tabIdx - 1], "left");
    }
  };

  const tabSt = t => ({
    flex:1, padding:"7px 4px", borderRadius:7, fontSize:10, fontWeight:700,
    cursor:"pointer", border:"none",
    background:tab===t?`${sp?.color}20`:"transparent",
    color:tab===t?sp?.color:C.sub, fontFamily:C.font,
  });

  return (
    <div style={{flex:1,overflowY:"auto",padding:20}}>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:13,fontFamily:C.font}}>{t('terrain.back')}</button>
          {onDelete && user?.role==="admin" && (
            confirmDel ? (
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:12,color:C.red,fontWeight:600}}>{t('terrain.confirm_delete')}</span>
                <button onClick={()=>{ onDelete(terrain.id); onBack(); }} style={{background:`${C.red}20`,border:`1px solid ${C.red}55`,borderRadius:8,padding:"5px 12px",color:C.red,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>{t('terrain.yes_delete')}</button>
                <button onClick={()=>setConfirmDel(false)} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",color:C.sub,fontSize:12,cursor:"pointer",fontFamily:C.font}}>{t('terrain.cancel')}</button>
              </div>
            ) : (
              <button onClick={()=>setConfirmDel(true)} style={{background:`${C.red}15`,border:`1px solid ${C.red}40`,borderRadius:8,padding:"6px 12px",color:C.red,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:C.font,display:"flex",alignItems:"center",gap:5}}>
                {t('terrain.delete')}
              </button>
            )
          )}
        </div>

        {/* Hero */}
        <div style={{background:`linear-gradient(135deg,${sp?.color}20,${C.card})`,border:`1px solid ${sp?.color}44`,borderRadius:18,padding:18,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:5}}>
                {tSportList.map(s=>(
                  <span key={s.id} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:10,color:s.color,fontWeight:700,textTransform:"uppercase",letterSpacing:1,background:`${s.color}15`,borderRadius:5,padding:"2px 7px"}}>
                    <SportEmoji sport={s} size={10}/> {s.label}
                  </span>
                ))}
              </div>
              <div style={{fontFamily:C.head,fontWeight:700,fontSize:24,color:C.text}}>{terrain.name}</div>
              <div style={{fontSize:12,color:C.sub,marginTop:3}}>📍 {terrain.city}, {terrain.country}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:C.head,fontWeight:700,fontSize:24,color:C.yellow}}>{terrain.rating>0?`⭐ ${terrain.rating}`:"🆕 NOUVEAU"}</div>
              <div style={{fontSize:13,color:terrain.free?C.accent:C.orange,fontWeight:700}}>{terrain.price}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
            <Badge label={t('surfaces.'+(SURF_KEYS[terrain.surface]||'gazon_naturel'))} color={C.blue}/>
            {terrain.lights&&<Badge label={t('terrain.lit')} color={C.yellow}/>}
            {terrain.free?<Badge label={t('terrain.free')} color={C.accent}/>:<Badge label={t('terrain.paying')} color={C.orange}/>}
            <Badge label={`👥 ${terrain.players}`} color={C.purple}/>
            {terrain.addedBy&&<Badge label={"+ "+terrain.addedBy} color={C.sub}/>}
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {terrain.phone ? (
              phoneRevealed ? (
                <a href={`tel:${terrain.phone.replace(/\s/g,"")}`}
                  style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:12,background:`${C.accent}15`,border:`1px solid ${C.accent}55`,borderRadius:12,padding:"10px 18px",textDecoration:"none",cursor:"pointer",alignSelf:"flex-start"}}>
                  <span style={{fontSize:20}}>📞</span>
                  <div>
                    <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:.5}}>{t('terrain.call')}</div>
                    <div style={{fontSize:13,color:C.text,fontWeight:700,fontFamily:"monospace",marginTop:1}}>{terrain.phone}</div>
                  </div>
                </a>
              ) : (
                <button onClick={()=>setShowPhoneModal(true)}
                  style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:12,background:`${C.accent}15`,border:`1px solid ${C.accent}55`,borderRadius:12,padding:"10px 18px",cursor:"pointer",alignSelf:"flex-start",fontFamily:C.font}}>
                  <span style={{fontSize:20}}>📞</span>
                  <div style={{textAlign:"left"}}>
                    <div style={{fontSize:10,color:C.accent,fontWeight:700,letterSpacing:.5}}>{t('terrain.call')}</div>
                    <div style={{fontSize:11,color:C.sub,marginTop:1}}>{t('terrain.call_hint')}</div>
                  </div>
                </button>
              )
            ) : (
              <button onClick={()=>{setAddPhoneVal("");setShowAddPhone(true);}}
                style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:12,background:C.card2,border:`1px dashed ${C.border}`,borderRadius:12,padding:"10px 18px",cursor:"pointer",alignSelf:"flex-start",fontFamily:C.font}}>
                <span style={{fontSize:20}}>📞</span>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:10,color:C.sub,fontWeight:700,letterSpacing:.5}}>{t('terrain.phone_missing')}</div>
                  <div style={{fontSize:11,color:C.accent,marginTop:1,fontWeight:600}}>{t('terrain.phone_add')}</div>
                </div>
              </button>
            )}
            {terrain.lat && terrain.lng && (
              <a href={`http://maps.apple.com/?daddr=${terrain.lat},${terrain.lng}&q=${encodeURIComponent(terrain.name)}`}
                target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:8,marginTop:12,background:C.card2,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 18px",textDecoration:"none",cursor:"pointer",alignSelf:"flex-start"}}>
                <span style={{fontSize:20}}>🧭</span>
                <div>
                  <div style={{fontSize:10,color:C.text,fontWeight:700,letterSpacing:.5}}>{t('terrain.directions')}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:1}}>{t('terrain.directions_hint')}</div>
                </div>
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:2,marginBottom:16,background:C.card,borderRadius:10,padding:4,border:`1px solid ${C.border}`}}>
          {[["itinerary","tab_itinerary"],["invite","tab_invite"],["resa","tab_resa"],["dispo","tab_dispo"],["photos","tab_photos"],["info","tab_info"]].map(([tabId,tk],i)=>(
            <button key={tabId} style={tabSt(tabId)} onClick={()=>goToTab(tabId, i > tabIdx ? "right" : "left")}>{t('terrain.'+tk)}</button>
          ))}
        </div>

        <div
          key={tab}
          className={slideDir==="right"?"rvf-slide-r":slideDir==="left"?"rvf-slide-l":""}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {tab==="itinerary" && <ItineraryTab terrain={terrain} sp={sp}/>}
          {tab==="invite"    && <InviteTab terrain={terrain} user={user} sp={sp}/>}
          {tab==="resa"      && <ReservationTab terrain={terrain} user={user} sp={sp}/>}
          {tab==="dispo"     && <DispoTab terrain={terrain} user={user} sp={sp}/>}
          {tab==="photos"    && <PhotosTab terrain={terrain} user={user} sp={sp}/>}
          {tab==="info"      && (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14}}>
              {[["🏟️ "+t('terrain.surface'),t('surfaces.'+(SURF_KEYS[terrain.surface]||'gazon_naturel'))],["💡 "+t('terrain.lighting'),terrain.lights?t('terrain.available'):t('terrain.unavailable')],["💰 "+t('terrain.price_label'),terrain.price],["⭐ "+t('terrain.rating'),terrain.rating>0?terrain.rating+"/5":t('terrain.unrated')],["👥 "+t('terrain.players'),terrain.players],...(terrain.phone?[["📞 "+t('terrain.phone_label'),terrain.phone]]:[]),...(terrain.address?[["📮 "+t('terrain.address_label'),[terrain.address,terrain.postalCode,terrain.city].filter(Boolean).join(', ')]]:[]),...(terrain.ownerName?[["🏢 "+t('terrain.owner_label'),terrain.ownerName]]:[]),...(terrain.website?[["🔗 "+t('terrain.website_label'),<a href={terrain.website} target="_blank" rel="noopener noreferrer" style={{color:C.accent,textDecoration:"none"}}>{terrain.website.replace(/^https?:\/\//,"")}</a>]]:[])] .map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{color:C.sub,fontSize:13}}>{k}</span>
                  <span style={{color:C.text,fontSize:13,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dots indicator */}
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:6,marginTop:20,paddingBottom:4}}>
          {TABS_LIST.map((t,i)=>(
            <div key={t}
              onClick={()=>goToTab(t, i > tabIdx ? "right" : "left")}
              style={{
                width: i===tabIdx ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i===tabIdx ? sp?.color : C.border,
                transition: "all 0.25s ease",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>
      {showPhoneModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowPhoneModal(false)}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:24,width:"100%",maxWidth:360}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text,marginBottom:8}}>📞 {t('terrain.call_modal_title')}</div>
            <div style={{fontSize:13,color:C.sub,marginBottom:16,lineHeight:1.5}}>{t('terrain.call_modal_sub', {name: terrain.name})}</div>
            <input
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={userPhoneInput}
              onChange={e=>setUserPhoneInput(e.target.value)}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14,fontFamily:"monospace",boxSizing:"border-box",marginBottom:14,outline:"none"}}
            />
            <div style={{display:"flex",gap:8}}>
              <button
                onClick={()=>{if(userPhoneInput.trim()){setPhoneRevealed(true);setShowPhoneModal(false);}}}
                disabled={!userPhoneInput.trim()}
                style={{flex:1,background:userPhoneInput.trim()?C.accent:"#333",border:"none",borderRadius:10,padding:"11px 0",color:userPhoneInput.trim()?"#000":C.sub,fontWeight:700,fontSize:14,cursor:userPhoneInput.trim()?"pointer":"default",fontFamily:C.font}}>
                {t('common.confirm')}
              </button>
              <button onClick={()=>setShowPhoneModal(false)}
                style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 0",color:C.sub,fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:C.font}}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddPhone && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowAddPhone(false)}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:24,width:"100%",maxWidth:360}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text,marginBottom:4}}>📞 {t('terrain.add_phone_title')}</div>
            <div style={{fontSize:13,color:C.sub,marginBottom:16,lineHeight:1.5}}>{t('terrain.add_phone_sub', {name: terrain.name})}</div>
            <input
              type="tel"
              placeholder="+33 1 23 45 67 89"
              value={addPhoneVal}
              onChange={e=>setAddPhoneVal(e.target.value)}
              autoFocus
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:14,fontFamily:"monospace",boxSizing:"border-box",marginBottom:14,outline:"none"}}
            />
            <div style={{display:"flex",gap:8}}>
              <button
                onClick={()=>{
                  const v=addPhoneVal.trim();
                  if(!v) return;
                  if(onUpdatePhone) onUpdatePhone(terrain.id, v);
                  setShowAddPhone(false);
                }}
                disabled={!addPhoneVal.trim()}
                style={{flex:1,background:addPhoneVal.trim()?C.accent:"#333",border:"none",borderRadius:10,padding:"11px 0",color:addPhoneVal.trim()?"#000":C.sub,fontWeight:700,fontSize:14,cursor:addPhoneVal.trim()?"pointer":"default",fontFamily:C.font}}>
                {t('common.save')}
              </button>
              <button onClick={()=>setShowAddPhone(false)}
                style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 0",color:C.sub,fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:C.font}}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TEAMS VIEW ───────────────────────────────────────────────────────────────
// ─── TEAM ROSTER MODAL ───────────────────────────────────────────────────────
function TeamRosterModal({ team, onClose, currentUser, onGoToMessages }) {
  const {t} = useTranslation();
  useStore(TEAM_REQ);
  const [selProfile, setSelProfile] = useState(null);
  const sp = SPORTS.find(s=>s.id===team.sport);
  const seed    = ROSTER[team.id] || [];
  const newMembers = TEAM_REQ.list.filter(r=>r.teamId===team.id && r.status==="accepted");
  const legacyMembers = [
    ...seed,
    ...newMembers
      .filter(r => !seed.find(m=>m.id===r.fromUserId))
      .map(r=>{ const u=DB.find(u=>u.id===r.fromUserId); return { id:r.fromUserId, name:r.fromName, city:u?.city||"", level:u?.level||"Amateur" }; }),
  ];

  // Real roster, backed by team_members — teams created through the app now persist server-side.
  // isMember comes straight from the API (team_members/owner_id for THIS team), never from the
  // account's global role. Any approved member can invite, not just the captain.
  const isMember = !!team.isMember;
  const [roster, setRoster] = useState({ members: [], pendingInvites: [] });
  const [friends, setFriends] = useState([]);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteBusyId, setInviteBusyId] = useState(null);
  const [inviteMsg, setInviteMsg] = useState("");

  const fetchRoster = useCallback(() => {
    fetch(`${API}/api/teams/${team.id}/members`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRoster(d); })
      .catch(() => {});
  }, [team.id]);
  useEffect(() => { fetchRoster(); }, [fetchRoster]);

  // Friends-first invite: the search box below stays as a fallback for people not yet friends.
  useEffect(() => {
    if (!isMember) { setFriends([]); return; }
    fetch(`${API}/api/friends`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then(setFriends)
      .catch(() => {});
  }, [isMember, team.id]);

  useEffect(() => {
    if (!isMember || inviteQuery.trim().length < 2) { setInviteResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${API}/api/users?q=${encodeURIComponent(inviteQuery.trim())}`, { headers: authHeader(), signal: controller.signal })
        .then(r => r.ok ? r.json() : [])
        .then(setInviteResults)
        .catch(() => {});
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [inviteQuery, isMember]);

  const invitePlayer = async (u) => {
    setInviteBusyId(u.id); setInviteMsg("");
    try {
      const res = await fetch(`${API}/api/teams/${team.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...authHeader() },
        body: JSON.stringify({ userId: u.id }),
      });
      const d = await res.json().catch(()=>({}));
      if (res.ok) {
        setInviteQuery(""); setInviteResults([]); setInviteMsg(t('teams.invite_sent'));
        fetchRoster();
      } else {
        setInviteMsg(d.error==='already_member' ? t('teams.already_member') : d.error==='already_invited' ? t('teams.already_invited') : t('teams.invite_error'));
      }
    } catch { setInviteMsg(t('teams.invite_error')); }
    setInviteBusyId(null);
  };

  // Real members take priority; fall back to the legacy client-only roster (demo teams,
  // or teams created before this account existed server-side) so nothing regresses to empty.
  const allMembers = roster.members.length
    ? roster.members.map(m => ({ id:m.user_id, name:m.name, city:m.city||"", level:"Amateur", captain:m.role==='captain' }))
    : legacyMembers;
  const memberIds = new Set(roster.members.map(m=>m.user_id));
  const pendingIds = new Set(roster.pendingInvites.map(p=>p.user_id));
  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:440,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 30px 80px rgba(0,0,0,.8)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{width:40,height:40,borderRadius:10,background:`${sp?.color}18`,border:`1px solid ${sp?.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{team.avatar}</div>
            <div>
              <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>{team.name}</div>
              <div style={{fontSize:11,color:C.sub}}>{sp?.label} · {allMembers.length} membre{allMembers.length!==1?"s":""}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.sub,fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        {isMember && (
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,flexShrink:0,maxHeight:"40vh",overflowY:"auto"}}>
            <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{t('teams.my_friends_label')}</div>
            {friends.length===0 ? (
              <div style={{fontSize:11,color:C.sub,marginBottom:10}}>{t('teams.no_friends_hint')}</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
                {friends.map(f=>{
                  const already = memberIds.has(f.id);
                  const pending = pendingIds.has(f.id);
                  return (
                    <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,background:C.card2,borderRadius:8,padding:"6px 8px"}}>
                      <Avatar name={f.name} size={26} color={C.accent}/>
                      <div style={{flex:1,minWidth:0,fontSize:12,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                      <button onClick={already||pending?undefined:()=>invitePlayer(f)} disabled={already||pending||inviteBusyId===f.id}
                        style={{padding:"4px 9px",borderRadius:7,background:already||pending?"transparent":`${C.accent}18`,border:`1px solid ${already||pending?C.border:C.accent+"44"}`,color:already||pending?C.sub:C.accent,fontSize:11,fontWeight:700,cursor:already||pending||inviteBusyId===f.id?"default":"pointer",fontFamily:C.font,flexShrink:0}}>
                        {already ? t('teams.already_member') : pending ? t('teams.invite_pending_label') : (inviteBusyId===f.id ? '…' : t('teams.invite_btn'))}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{t('teams.search_other_label')}</div>
            <div style={{position:"relative",marginBottom:inviteResults.length||inviteMsg?8:0}}>
              <input value={inviteQuery} onChange={e=>{setInviteQuery(e.target.value);setInviteMsg("");}}
                placeholder={t('teams.invite_search_ph')}
                style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 12px 8px 30px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}/>
              <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:12}}>✉️</span>
            </div>
            {inviteResults.length>0 && (
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:140,overflowY:"auto"}}>
                {inviteResults.map(u=>(
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:8,background:C.card2,borderRadius:8,padding:"6px 8px"}}>
                    <Avatar name={u.name} size={26} color={C.accent}/>
                    <div style={{flex:1,minWidth:0,fontSize:12,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                    <button onClick={()=>invitePlayer(u)} disabled={inviteBusyId===u.id}
                      style={{padding:"4px 9px",borderRadius:7,background:`${C.accent}18`,border:`1px solid ${C.accent}44`,color:C.accent,fontSize:11,fontWeight:700,cursor:inviteBusyId===u.id?"default":"pointer",fontFamily:C.font,flexShrink:0}}>
                      {inviteBusyId===u.id ? '…' : t('teams.invite_btn')}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {inviteMsg && <div style={{fontSize:11,color:C.sub,marginTop:6}}>{inviteMsg}</div>}
            {roster.pendingInvites.length>0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
                {roster.pendingInvites.map(p=>(
                  <span key={p.id} style={{fontSize:10,color:C.sub,background:C.card2,border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 8px"}}>
                    {p.name} · {t('teams.invite_pending_label')}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1}}>{t('teams.team_members_label')}</div>
          {allMembers.length===0
            ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:36,marginBottom:8}}>👥</div>{t('terrain.no_members')}</div>
            : allMembers.map((m,i)=>{
                const dbUser = DB.find(u=>u.id===m.id);
                return (
                  <div key={m.id||i} style={{background:C.card2,borderRadius:10,padding:"10px 12px",cursor:dbUser?"pointer":"default"}} onClick={()=>dbUser&&setSelProfile(dbUser)}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Avatar name={m.name} size={38} color={m.captain?C.yellow:C.accent} photo={dbUser?.avatar}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                          <UserBadge name={m.name} user={DB.find(x=>x.id===m.id)||undefined} size="sm" showLevel showInsignes/>
                          {m.captain && <span style={{fontSize:9,background:`${C.yellow}20`,color:C.yellow,border:`1px solid ${C.yellow}40`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>👑 {t('teams.captain_abbr')}</span>}
                        </div>
                        <div style={{fontSize:11,color:C.sub,marginTop:2}}>📍 {m.city} · <span style={{color:C.accent}}>{t('levels.'+(LEVEL_KEYS[LEVELS.indexOf(m.level)]||'amateur'))}</span></div>
                      </div>
                      {dbUser?.sports?.length>0 && (
                        <div style={{display:"flex",gap:3,flexShrink:0}}>
                          {dbUser.sports.slice(0,2).map(sid=>{
                            const s=SPORTS.find(x=>x.id===sid);
                            return s ? <span key={sid} style={{display:"inline-flex",alignItems:"center"}}><SportEmoji sport={s} size={15}/></span> : null;
                          })}
                        </div>
                      )}
                    </div>
                    {dbUser && (
                      <div style={{display:"flex",gap:8,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                        {[["🏟️",dbUser.terrains||0,"terrains",C.blue],["⚽",dbUser.matchs||0,"matchs",C.orange],["👥",dbUser.teams||0,"équipes",C.purple]].map(([icon,val,label,color])=>(
                          <div key={label} style={{flex:1,textAlign:"center",background:C.card,borderRadius:8,padding:"5px 4px"}}>
                            <div style={{fontSize:11}}>{icon}</div>
                            <div style={{fontFamily:C.head,fontWeight:700,fontSize:14,color}}>{val}</div>
                            <div style={{fontSize:9,color:C.sub}}>{label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      </div>
      {selProfile && <UserProfileModal profile={selProfile} currentUser={currentUser} onClose={()=>setSelProfile(null)} onGoToMessages={onGoToMessages}/>}
    </div>
  );
}

function ChallengeModal({ user, myTeams, targetTeam, terrains, onClose }) {
  const {t} = useTranslation();
  const hasTeams = myTeams.length > 0;
  const [mode,         setMode]        = useState(hasTeams ? "team" : "solo");
  const [fromTeam,     setFromTeam]    = useState(myTeams[0]);
  const [day,          setDay]         = useState("sat");
  const [hour,         setHour]        = useState("16h");
  const [msg,          setMsg]         = useState("");
  const [sent,         setSent]        = useState(false);
  const [matchTerrain, setMatchTerrain]= useState(null);
  const [tSearch,      setTSearch]     = useState("");

  const sportTerrains = terrains.filter(t => terrainSports(t).includes(targetTeam.sport));
  const searchedTerrains = (tSearch.trim()
    ? sportTerrains.filter(t =>
        t.name.toLowerCase().includes(tSearch.toLowerCase()) ||
        (t.city||"").toLowerCase().includes(tSearch.toLowerCase()))
    : sportTerrains
  ).slice(0, 30);

  const canSend = mode === "solo" || !!fromTeam;

  const send = () => {
    if (!canSend) return;
    const terrainInfo = matchTerrain ? { terrainId:matchTerrain.id, terrainName:matchTerrain.name, terrainCity:matchTerrain.city } : {};
    if (mode === "solo") {
      MATCH_REQ.send({
        isSolo:true,
        fromUserId:user.id, fromUserName:user.name,
        fromCaptainId:user.id, fromCaptainName:user.name,
        toTeamId:targetTeam.id, toTeamName:targetTeam.name,
        toCaptainId:targetTeam.captainId,
        sport:targetTeam.sport, day, hour, message:msg.trim(), ...terrainInfo,
      });
    } else {
      MATCH_REQ.send({
        fromTeamId:fromTeam.id, fromTeamName:fromTeam.name,
        fromCaptainId:user.id, fromCaptainName:user.name,
        toTeamId:targetTeam.id, toTeamName:targetTeam.name,
        toCaptainId:targetTeam.captainId,
        sport:targetTeam.sport, day, hour, message:msg.trim(), ...terrainInfo,
      });
    }
    setSent(true);
    setTimeout(onClose, 2000);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.orange}44`,borderRadius:20,width:"100%",maxWidth:420,maxHeight:"90vh",overflowY:"auto",padding:20,boxShadow:"0 30px 80px rgba(0,0,0,.8)"}} onClick={e=>e.stopPropagation()}>
        {sent ? (
          <div style={{textAlign:"center",padding:28}}>
            <div style={{fontSize:52,marginBottom:12}}>⚔️</div>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:20,color:C.orange}}>{t('invites.challenge_pending')}</div>
            <div style={{fontSize:13,color:C.sub,marginTop:8}}>{t('teams.join_request_sub',{name:targetTeam.name})}</div>
            {matchTerrain&&<div style={{fontSize:12,color:C.accent,marginTop:6,fontWeight:600}}>📍 {matchTerrain.name}, {matchTerrain.city}</div>}
          </div>
        ) : (
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>⚔️ {t('teams.challenge_team')}</div>
                <div style={{fontSize:12,color:C.sub,marginTop:2}}>{t('teams.against')} <span style={{color:C.orange,fontWeight:700}}>{targetTeam.name}</span></div>
              </div>
              <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.sub,fontSize:18}}>✕</button>
            </div>

            {/* Mode toggle */}
            <div style={{display:"flex",gap:6,background:C.card2,borderRadius:10,padding:4,marginBottom:14}}>
              {hasTeams && (
                <button onClick={()=>setMode("team")} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:mode==="team"?C.orange:"transparent",color:mode==="team"?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                  👥 {t('teams.with_team')}
                </button>
              )}
              <button onClick={()=>setMode("solo")} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:mode==="solo"?C.orange:"transparent",color:mode==="solo"?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                🧍 {t('teams.solo_mode')}
              </button>
            </div>

            {/* VS banner */}
            <div style={{display:"flex",alignItems:"center",gap:12,background:C.card2,borderRadius:14,padding:"12px 14px",marginBottom:14,border:`1px solid ${C.orange}25`}}>
              <div style={{flex:1,textAlign:"center"}}>
                {mode==="solo" ? (
                  <>
                    <div style={{width:36,height:36,borderRadius:"50%",background:`${C.orange}25`,border:`2px solid ${C.orange}55`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px",fontSize:16,fontWeight:700,color:C.orange}}>{(user.name || user.username || '?')[0]}</div>
                    <div style={{fontSize:11,fontWeight:700,color:C.text}}>{user.name || user.username || '?'}</div>
                    <div style={{fontSize:10,color:C.orange,marginTop:1}}>{t('common.solo')}</div>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:24,marginBottom:2}}>{fromTeam?.avatar||"👥"}</div>
                    <div style={{fontSize:11,fontWeight:700,color:C.text}}>{fromTeam?.name||"—"}</div>
                  </>
                )}
              </div>
              <div style={{fontFamily:C.head,fontWeight:800,fontSize:18,color:C.orange,background:`${C.orange}18`,border:`2px solid ${C.orange}44`,borderRadius:8,padding:"4px 10px",letterSpacing:2}}>VS</div>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:24,marginBottom:2}}>{targetTeam.avatar}</div>
                <div style={{fontSize:11,fontWeight:700,color:C.text}}>{targetTeam.name}</div>
              </div>
            </div>

            {/* My team selector (team mode only) */}
            {mode==="team" && myTeams.length>1 && (
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:7}}>{t('teams.your_team')}</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {myTeams.map(tm=>(
                    <button key={tm.id} onClick={()=>setFromTeam(tm)} style={{padding:"6px 12px",borderRadius:8,cursor:"pointer",fontFamily:C.font,fontSize:12,fontWeight:600,background:fromTeam?.id===tm.id?`${C.orange}20`:C.card2,border:`2px solid ${fromTeam?.id===tm.id?C.orange:C.border}`,color:fromTeam?.id===tm.id?C.orange:C.sub}}>
                      {tm.avatar} {tm.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Day & Hour */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>{t('teams.day_label')}</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {DAYS.map(d=><button key={d} onClick={()=>setDay(d)} style={{padding:"4px 8px",borderRadius:6,cursor:"pointer",fontFamily:C.font,fontSize:11,fontWeight:600,background:day===d?`${C.orange}20`:C.card2,border:`1px solid ${day===d?C.orange+"55":C.border}`,color:day===d?C.orange:C.sub}}>{d}</button>)}
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>{t('teams.hour_label')}</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {HOURS.map(h=><button key={h} onClick={()=>setHour(h)} style={{padding:"4px 8px",borderRadius:6,cursor:"pointer",fontFamily:C.font,fontSize:11,fontWeight:600,background:hour===h?`${C.orange}20`:C.card2,border:`1px solid ${hour===h?C.orange+"55":C.border}`,color:hour===h?C.orange:C.sub}}>{h}</button>)}
                </div>
              </div>
            </div>

            {/* Terrain */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:7}}>📍 {t('teams.match_terrain')}</label>
              {matchTerrain ? (
                <div style={{display:"flex",alignItems:"center",gap:10,background:`${C.accent}12`,border:`1.5px solid ${C.accent}55`,borderRadius:10,padding:"9px 12px"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{matchTerrain.name}</div>
                    <div style={{fontSize:11,color:C.accent,marginTop:1}}>📍 {matchTerrain.city} · {matchTerrain.surface}</div>
                  </div>
                  <button onClick={()=>{setMatchTerrain(null);setTSearch("");}} style={{background:"transparent",border:"none",color:C.sub,cursor:"pointer",fontSize:16,flexShrink:0,lineHeight:1}}>✕</button>
                </div>
              ) : (
                <div>
                  <div style={{position:"relative",marginBottom:6}}>
                    <input value={tSearch} onChange={e=>setTSearch(e.target.value)}
                      placeholder={t('terrain.search_terrain_ph')}
                      style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"7px 12px 7px 30px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}/>
                    <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:12}}>🔍</span>
                    {tSearch&&<button onClick={()=>setTSearch("")} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:12,lineHeight:1}}>✕</button>}
                  </div>
                  <div style={{maxHeight:150,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,borderRadius:10,border:`1px solid ${C.border}`,background:C.card2,padding:6}}>
                    <button onClick={()=>setMatchTerrain(null)}
                      style={{textAlign:"left",background:"transparent",border:`1px dashed ${C.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",color:C.sub,fontSize:12,fontFamily:C.font}}>
                      🌐 {t('teams.open_location')}
                    </button>
                    {searchedTerrains.length===0
                      ? <div style={{fontSize:11,color:C.sub,textAlign:"center",padding:8}}>{t('common.no_terrain')}</div>
                      : searchedTerrains.map(tr=>{
                          const sObj=SPORTS.find(s=>s.id===terrainSports(tr)[0]);
                          return (
                            <button key={tr.id} onClick={()=>{setMatchTerrain(tr);setTSearch("");}}
                              style={{textAlign:"left",background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",fontFamily:C.font}}>
                              <div style={{fontSize:12,fontWeight:600,color:C.text}}>{sObj?.emoji} {tr.name}</div>
                              <div style={{fontSize:10,color:C.sub,marginTop:1}}>📍 {tr.city} · {tr.surface} · {tr.price}</div>
                            </button>
                          );
                        })
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Message */}
            <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>{t('common.message_optional')}</label>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder={t('teams.challenge_placeholder')} rows={2}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",boxSizing:"border-box",marginBottom:14}}/>

            <div style={{display:"flex",gap:8}}>
              <button onClick={send} disabled={!canSend} style={{flex:2,padding:"13px",borderRadius:11,background:canSend?C.orange:"#333",border:"none",color:canSend?"#06090f":C.sub,fontFamily:C.font,fontSize:14,fontWeight:800,cursor:canSend?"pointer":"not-allowed",boxShadow:canSend?`0 4px 16px ${C.orange}55`:"none"}}>⚔️ {t('teams.send_challenge')}</button>
              <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:11,background:"transparent",border:`1px solid ${C.border}`,color:C.sub,fontFamily:C.font,fontSize:13,fontWeight:600,cursor:"pointer"}}>{t('common.cancel')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TeamsView({ user, terrains, onGoToMessages, teams=[], refreshTeams }) {
  const {t} = useTranslation();
  useStore(TEAM_REQ);
  useStore(MATCH_REQ);
  const [showCreate,setShowCreate]     = useState(false);
  const [teamName,setTeamName]         = useState("");
  const [teamCity,setTeamCity]         = useState(user?.city||"");
  const [teamSport,setTeamSport]       = useState("football");
  const [teamLevel,setTeamLevel]       = useState("Amateur");
  const [filter,setFilter]             = useState("all");
  const [cityFilter,setCityFilter]     = useState("");
  const mySports = user?.sports?.length ? user.sports : null;
  const [mySportsOnly,setMySportsOnly] = useState(!!mySports);
  const [joinModal,setJoinModal]       = useState(null);
  const [joinNote,setJoinNote]         = useState("");
  const [rosterTeam,setRosterTeam]     = useState(null);
  const [challengeModal,setChallengeModal] = useState(null);
  const [viewTab,setViewTab]           = useState("teams"); // "teams" | "matches" | "requests"
  const sp = id => SPORTS.find(s=>s.id===id);

  const myTeams = teams.filter(t=>t.isCaptain);
  const allPendingReqs = TEAM_REQ.reqsForCaptain(user?.id||"");
  const totalPending = allPendingReqs.length;

  const acceptTeamReq = req => {
    TEAM_REQ.respond(req.id,"accepted");
    const u = DB.find(u=>u.id===req.fromUserId);
    if (!ROSTER[req.teamId]) ROSTER[req.teamId]=[];
    if (!ROSTER[req.teamId].find(m=>m.id===req.fromUserId))
      ROSTER[req.teamId].push({ id:req.fromUserId, name:req.fromName, city:u?.city||"", level:u?.level||"Amateur" });
  };
  const myTeamIds = myTeams.map(t=>t.id);
  const incomingChallenges = MATCH_REQ.list.filter(r=>myTeamIds.includes(r.toTeamId) && r.status==="pending");
  const incomingCount = incomingChallenges.length;
  const pastMatches = PAST_MATCHES.filter(m=>myTeamIds.includes(m.fromTeamId)||myTeamIds.includes(m.toTeamId));

  // Invitations received from other captains — backed by team_members (status='pending').
  const [myInvites, setMyInvites] = useState([]);
  const fetchMyInvites = useCallback(() => {
    if (!user?.id) { setMyInvites([]); return; }
    fetch(`${API}/api/teams/invitations`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then(setMyInvites)
      .catch(() => {});
  }, [user?.id]);
  useEffect(() => { fetchMyInvites(); }, [fetchMyInvites]);

  const acceptInvite = async inv => {
    try {
      const res = await fetch(`${API}/api/teams/invitations/${inv.id}/accept`, { method:'POST', headers: authHeader() });
      if (res.ok) { setMyInvites(p=>p.filter(i=>i.id!==inv.id)); refreshTeams?.(); }
    } catch {}
  };
  const declineInvite = async inv => {
    try {
      const res = await fetch(`${API}/api/teams/invitations/${inv.id}/decline`, { method:'POST', headers: authHeader() });
      if (res.ok) setMyInvites(p=>p.filter(i=>i.id!==inv.id));
    } catch {}
  };

  const create = async () => {
    if (!teamName.trim() || !user) return;
    try {
      const res = await fetch(`${API}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...authHeader() },
        body: JSON.stringify({
          name: teamName.trim(), sport: teamSport, city: teamCity.trim()||user?.city||"",
          level: teamLevel, avatar: SPORTS.find(s=>s.id===teamSport)?.emoji,
        }),
      });
      if (res.ok) refreshTeams?.();
    } catch {}
    setTeamName(""); setTeamCity(user?.city||""); setShowCreate(false);
  };

  const sendJoinRequest = () => {
    if (!joinModal || !user) return;
    TEAM_REQ.send({ teamId:joinModal.id, teamName:joinModal.name, captainId:joinModal.captainId, fromUserId:user.id, fromName:user.name, note:joinNote.trim() });
    setJoinModal(null); setJoinNote("");
  };

  const filtered = teams.filter(t=>
    (filter==="all"||t.sport===filter) &&
    (!mySportsOnly||!mySports||mySports.includes(t.sport)) &&
    (!cityFilter.trim()||(t.city||"").toLowerCase().includes(cityFilter.trim().toLowerCase()))
  ).sort((a,b)=>{
    if (cityFilter.trim()) return 0;
    const aM=(a.city||"").toLowerCase()===user?.city?.toLowerCase();
    const bM=(b.city||"").toLowerCase()===user?.city?.toLowerCase();
    return (bM?1:0)-(aM?1:0);
  });

  return (
    <div style={{flex:1,overflowY:"auto",padding:16}}>
      <div style={{maxWidth:740,margin:"0 auto"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:26,color:C.text}}>{t('teams.title')}</div>
            <p style={{fontSize:12,color:C.sub,marginTop:2}}>{t('teams.subtitle')}</p>
          </div>
          {viewTab==="teams" && <Btn onClick={()=>setShowCreate(p=>!p)} full={false} style={{padding:"9px 16px",fontSize:12}}>+ {t('common.create_btn')}</Btn>}
        </div>

        {/* Invitations reçues d'un capitaine — visibles quel que soit l'onglet actif */}
        {myInvites.length>0 && (
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:1}}>{t('teams.my_invitations')}</div>
            {myInvites.map(inv=>(
              <div key={inv.id} style={{background:C.card,border:`1.5px solid ${C.accent}44`,borderRadius:14,padding:14,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:38,height:38,borderRadius:10,background:`${C.accent}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{inv.avatar||"👥"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{inv.name}</div>
                  {inv.city && <div style={{fontSize:11,color:C.sub,marginTop:1}}>📍 {inv.city}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>acceptInvite(inv)} style={{padding:"7px 12px",borderRadius:9,background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",color:C.green,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer"}}>✅ {t('teams.accept_invite')}</button>
                  <button onClick={()=>declineInvite(inv)} style={{padding:"7px 12px",borderRadius:9,background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",color:C.red,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer"}}>❌ {t('teams.decline_invite')}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",background:C.card,borderRadius:12,padding:4,gap:4,marginBottom:16}}>
          <button onClick={()=>setViewTab("teams")} style={{flex:1,padding:"9px",border:"none",borderRadius:9,background:viewTab==="teams"?C.accent:"transparent",color:viewTab==="teams"?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
            {t('teams.tab_teams')}
          </button>
          <button onClick={()=>setViewTab("matches")} style={{flex:1,padding:"9px",border:"none",borderRadius:9,background:viewTab==="matches"?C.orange:"transparent",color:viewTab==="matches"?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s",position:"relative"}}>
            {t('teams.tab_matches')}
            {incomingCount>0 && <span style={{position:"absolute",top:5,right:10,minWidth:16,height:16,borderRadius:8,background:C.red,color:"#fff",fontSize:10,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{incomingCount}</span>}
          </button>
          {myTeams.length>0 && (
            <button onClick={()=>setViewTab("requests")} style={{flex:1,padding:"9px",border:"none",borderRadius:9,background:viewTab==="requests"?C.yellow:"transparent",color:viewTab==="requests"?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s",position:"relative"}}>
              {t('teams.tab_requests')}
              {totalPending>0 && <span style={{position:"absolute",top:5,right:10,minWidth:16,height:16,borderRadius:8,background:C.red,color:"#fff",fontSize:10,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{totalPending}</span>}
            </button>
          )}
        </div>

        {/* ── ÉQUIPES TAB ── */}
        {viewTab==="teams" && (
          <>
            {showCreate && (
              <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:16,padding:18,marginBottom:18}}>
                <div style={{fontSize:13,fontWeight:700,color:C.accent,marginBottom:12}}>🆕 {t('teams.new_team')}</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Field value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder={t('teams.name_placeholder')} icon="👥"/>
                    <Field value={teamCity} onChange={e=>setTeamCity(e.target.value)} placeholder={t('teams.city_placeholder')} icon="📍"/>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{SPORTS.map(s=><Chip key={s.id} active={teamSport===s.id} onClick={()=>setTeamSport(s.id)} color={s.color}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><SportEmoji sport={s} size={12}/>{s.label}</span></Chip>)}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{[["Amateur",t('teams.level_amateur')],["Intermédiaire",t('teams.level_inter')],["Confirmé",t('teams.level_confirm')],["Senior",t('teams.level_senior')]].map(([val,label])=><Chip key={val} active={teamLevel===val} onClick={()=>setTeamLevel(val)} color={C.purple}>{label}</Chip>)}</div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn onClick={create} variant="solid">✅ {t('common.create_btn')}</Btn>
                    <Btn onClick={()=>setShowCreate(false)} variant="ghost">{t('common.cancel')}</Btn>
                  </div>
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{position:"relative",flex:"0 0 180px"}}>
                <input value={cityFilter} onChange={e=>setCityFilter(e.target.value)} placeholder={t('teams.filter_city_ph')}
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"7px 10px 7px 30px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font}}/>
                <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:13}}>📍</span>
                {cityFilter && <button onClick={()=>setCityFilter("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:12,lineHeight:1}}>✕</button>}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                {mySports && (
                  <button onClick={()=>setMySportsOnly(p=>!p)}
                    style={{padding:"5px 11px",borderRadius:20,border:`1.5px solid ${mySportsOnly?C.accent:C.border}`,background:mySportsOnly?C.aLow:"transparent",color:mySportsOnly?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,whiteSpace:"nowrap",transition:"all .15s"}}>
                    {mySportsOnly?`⚽ ${t('teams.my_sports')}`:`🌐 ${t('teams.see_all')}`}
                  </button>
                )}
                <Chip active={filter==="all"} onClick={()=>setFilter("all")}>{t('common.all_filter')}</Chip>
                {(mySportsOnly&&mySports ? SPORTS.filter(s=>mySports.includes(s.id)) : SPORTS).map(s=>(
                  <Chip key={s.id} active={filter===s.id} onClick={()=>setFilter(s.id)} color={s.color}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><SportEmoji sport={s} size={12}/>{s.label}</span></Chip>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
              {filtered.map(team=>{
                const s           = sp(team.sport);
                const isCaptain   = !!team.isCaptain;
                const isMember    = !!team.isMember;
                const hasPending  = user && TEAM_REQ.userPending(user.id, team.id);
                const accepted    = user && TEAM_REQ.userAccepted(user.id, team.id);
                const memberCount = team.members;
                const pendingCount = isCaptain ? TEAM_REQ.reqsForCaptain(user.id).filter(r=>r.teamId===team.id).length : 0;
                const canChallenge = !isCaptain;
                const alreadyChallenged = myTeams.some(mt=>MATCH_REQ.hasPending(mt.id,team.id)) || (user && MATCH_REQ.hasPendingSolo(user.id,team.id));
                return (
                  <div key={team.id} style={{background:C.card,border:`1px solid ${isCaptain?C.accent+"40":C.border}`,borderRadius:14,padding:14}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div style={{width:46,height:46,borderRadius:12,background:`${s?.color}18`,border:`1px solid ${s?.color}30`,display:"flex",alignItems:"center",justifyContent:"center"}}>{s ? <SportEmoji sport={s} size={22}/> : <span style={{fontSize:22}}>{team.avatar}</span>}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          {team.name}
                          {isCaptain && <span style={{fontSize:10,background:`${C.yellow}20`,color:C.yellow,border:`1px solid ${C.yellow}40`,borderRadius:5,padding:"1px 6px",fontWeight:700,flexShrink:0}}>👑</span>}
                        </div>
                        <div style={{fontSize:11,color:C.sub,marginTop:1,display:"flex",alignItems:"center",gap:3}}><SportEmoji sport={s} size={11}/> {s?.label} · {t('teams.member_count',{count:memberCount})}{memberCount!==1&&memberCount>1?"s":""}</div>
                        {team.city&&<div style={{fontSize:11,color:C.blue,marginTop:2,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>📍 {team.city}{(team.city||"").toLowerCase()===user?.city?.toLowerCase()&&<span style={{background:`${C.accent}20`,color:C.accent,borderRadius:5,padding:"1px 5px",fontSize:9,fontWeight:700}}>{t('teams.my_city')}</span>}</div>}
                      </div>
                      <Badge label={team.open?t('teams.open_label'):t('teams.closed_label')} color={team.open?C.accent:C.sub}/>
                    </div>

                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:6,flexWrap:"wrap"}}>
                      <Badge label={team.level} color={s?.color}/>
                      <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                        <button onClick={()=>setRosterTeam(team)} style={{padding:"5px 10px",background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,color:C.sub,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
                          👥 {t('common.players')}
                        </button>
                        {isMember ? (
                          <button onClick={()=>setRosterTeam(team)}
                            style={{padding:"5px 10px",background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:7,color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                            {t('teams.invite_btn')}
                          </button>
                        ) : (
                          <button onClick={team.open&&!hasPending&&!accepted?()=>setJoinModal(team):undefined}
                            style={{padding:"5px 10px",background:accepted?`${C.green}18`:hasPending?`${C.yellow}15`:team.open?C.aLow:"transparent",border:`1px solid ${accepted?C.green+"44":hasPending?C.yellow+"44":team.open?C.accent+"44":C.border}`,borderRadius:7,color:accepted?C.green:hasPending?C.yellow:team.open?C.accent:C.sub,fontSize:11,fontWeight:600,cursor:team.open&&!hasPending&&!accepted?"pointer":"default",fontFamily:C.font}}>
                            {accepted?`✅ ${t('teams.member_badge')}`:hasPending?`⏳ ${t('common.pending')}`:team.open?t('teams.join'):t('teams.full_label')}
                          </button>
                        )}
                        {canChallenge && (
                          <button onClick={alreadyChallenged?undefined:()=>setChallengeModal(team)}
                            style={{padding:"5px 10px",background:alreadyChallenged?`${C.orange}08`:`${C.orange}18`,border:`1px solid ${alreadyChallenged?C.orange+"25":C.orange+"55"}`,borderRadius:7,color:alreadyChallenged?C.sub:C.orange,fontSize:11,fontWeight:700,cursor:alreadyChallenged?"default":"pointer",fontFamily:C.font}}>
                            {alreadyChallenged?`⏳ ${t('teams.challenge_sent_short')}`:`⚔️ ${t('teams.challenge_short')}`}
                          </button>
                        )}
                        {isCaptain && pendingCount>0 && (
                          <button onClick={()=>setViewTab("requests")} style={{fontSize:11,fontWeight:700,color:C.yellow,background:`${C.yellow}15`,border:`1px solid ${C.yellow}40`,borderRadius:7,padding:"4px 9px",cursor:"pointer",fontFamily:C.font,display:"flex",alignItems:"center",gap:4}}>
                            🔔 {pendingCount} demande{pendingCount>1?"s":""}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Demandes d'adhésion inline */}
            {allPendingReqs.length>0 && (
              <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:11,fontWeight:700,color:C.yellow,textTransform:"uppercase",letterSpacing:1}}>{t('teams.membership_requests')}</div>
                {allPendingReqs.map(req=>{
                  const fromUser = DB.find(u=>u.id===req.fromUserId);
                  return (
                    <div key={req.id} style={{background:C.card,border:`1.5px solid ${C.yellow}44`,borderRadius:16,padding:16}}>
                      <div style={{display:"flex",gap:12,marginBottom:12,alignItems:"center"}}>
                        <Avatar name={req.fromName} size={42} color={C.accent} photo={fromUser?.avatar}/>
                        <div style={{flex:1,minWidth:0}}>
                          <UserBadge name={req.fromName} size="md" showLevel showInsignes/>
                          <div style={{fontSize:12,color:C.accent,fontWeight:600,marginTop:1}}>→ {req.teamName}</div>
                          {fromUser?.city && <div style={{fontSize:11,color:C.sub,marginTop:2}}>📍 {fromUser.city} · {fromUser.level||"Amateur"}</div>}
                        </div>
                      </div>
                      {req.message && (
                        <div style={{background:C.card2,borderRadius:10,padding:"8px 12px",fontSize:12,color:C.text,fontStyle:"italic",marginBottom:12}}>"{req.message}"</div>
                      )}
                      <div style={{display:"flex",gap:10}}>
                        <button onClick={()=>acceptTeamReq(req)} style={{flex:1,padding:"11px",borderRadius:11,background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",color:C.green,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>✅ {t('common.accept')}</button>
                        <button onClick={()=>TEAM_REQ.respond(req.id,"rejected")} style={{flex:1,padding:"11px",borderRadius:11,background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",color:C.red,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>❌ {t('common.decline')}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── MATCHS TAB ── */}
        {viewTab==="matches" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* 1. Défis reçus — action requise */}
            {incomingChallenges.length>0 && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:C.orange,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>⚔️ {t('teams.challenges_received')}</div>
                {incomingChallenges.map(r=>{
                  const fromTeamObj = teams.find(t=>t.id===r.fromTeamId);
                  const toTeamObj   = teams.find(t=>t.id===r.toTeamId);
                  return (
                    <div key={r.id} style={{background:C.card,border:`2px solid ${C.orange}55`,borderRadius:16,padding:16,display:"flex",flexDirection:"column",gap:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:11,fontWeight:700,color:C.orange,background:`${C.orange}18`,border:`1px solid ${C.orange}44`,borderRadius:6,padding:"3px 9px"}}>{r.isSolo?`🧍 ${t('teams.challenge_short')} SOLO`:`⚔️ ${t('teams.challenge_short')}`}</span>
                        <span style={{fontSize:11,color:C.sub}}>{timeAgo(r.ts)}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{flex:1,textAlign:"center"}}>
                          {r.isSolo ? (
                            <>
                              <div style={{width:36,height:36,borderRadius:"50%",background:`${C.orange}25`,border:`2px solid ${C.orange}55`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px",fontSize:16,fontWeight:700,color:C.orange}}>{(r.fromUserName||"?")[0]}</div>
                              <UserBadge name={r.fromUserName} size="sm" showLevel showInsignes/>
                            </>
                          ) : (
                            <>
                              <div style={{fontSize:28,marginBottom:3}}>{fromTeamObj?.avatar||"👥"}</div>
                              <div style={{fontSize:12,fontWeight:700,color:C.text}}>{r.fromTeamName}</div>
                            </>
                          )}
                          <div style={{fontSize:10,color:C.sub,marginTop:1}}>{t('teams.challenger')}</div>
                        </div>
                        <div style={{fontFamily:C.head,fontWeight:800,fontSize:20,color:C.orange,background:`${C.orange}18`,border:`2px solid ${C.orange}44`,borderRadius:10,padding:"5px 12px",letterSpacing:2}}>VS</div>
                        <div style={{flex:1,textAlign:"center"}}>
                          <div style={{fontSize:28,marginBottom:3}}>{toTeamObj?.avatar||"👥"}</div>
                          <div style={{fontSize:12,fontWeight:700,color:C.text}}>{r.toTeamName}</div>
                          <div style={{fontSize:10,color:C.accent,marginTop:1}}>{t('teams.your_team')}</div>
                        </div>
                      </div>
                      <div style={{background:C.card2,borderRadius:10,padding:"8px 12px",fontSize:12,color:C.sub,display:"flex",flexDirection:"column",gap:5}}>
                        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                          <span>📅 {r.day}</span><span>⏰ {r.hour}</span>
                          <span style={{color:r.terrainName?C.accent:C.sub,fontWeight:r.terrainName?600:400}}>
                            📍 {r.terrainName?`${r.terrainName}${r.terrainCity?`, ${r.terrainCity}`:""}` : t('common.location_tbd')}
                          </span>
                        </div>
                        {r.message&&<div style={{color:C.text,fontStyle:"italic",borderTop:`1px solid ${C.border}`,paddingTop:5}}>"{r.message}"</div>}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>MATCH_REQ.respond(r.id,"accepted")} style={{flex:1,padding:"12px",borderRadius:11,background:`${C.green}18`,border:`1px solid ${C.green}55`,color:C.green,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>✅ {t('common.accept')}</button>
                        <button onClick={()=>MATCH_REQ.respond(r.id,"declined")} style={{flex:1,padding:"12px",borderRadius:11,background:`${C.red}10`,border:`1px solid ${C.red}30`,color:C.red,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ {t('common.decline')}</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* 2. Défis envoyés — en attente */}
            {MATCH_REQ.list.filter(r=>(myTeamIds.includes(r.fromTeamId)||(r.isSolo&&r.fromUserId===user?.id))&&r.status==="pending").length>0 && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:C.yellow,textTransform:"uppercase",letterSpacing:1,marginTop:4,marginBottom:2}}>⏳ {t('teams.challenges_sent')}</div>
                {MATCH_REQ.list.filter(r=>(myTeamIds.includes(r.fromTeamId)||(r.isSolo&&r.fromUserId===user?.id))&&r.status==="pending").map(r=>(
                  <div key={r.id} style={{background:C.card,border:`1px solid ${C.yellow}30`,borderRadius:14,padding:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                      <div style={{flex:1,textAlign:"center"}}>
                        {r.isSolo ? (
                          <div style={{width:30,height:30,borderRadius:"50%",background:`${C.orange}25`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 2px",fontSize:13,fontWeight:700,color:C.orange}}>{(r.fromUserName||"?")[0]}</div>
                        ) : (
                          <div style={{fontSize:22,marginBottom:2}}>{teams.find(t=>t.id===r.fromTeamId)?.avatar||"👥"}</div>
                        )}
                        <div style={{fontSize:11,fontWeight:700,color:C.text}}>{r.isSolo?r.fromUserName:r.fromTeamName}</div>
                      </div>
                      <div style={{fontFamily:C.head,fontWeight:800,fontSize:14,color:C.yellow,background:`${C.yellow}15`,border:`2px solid ${C.yellow}44`,borderRadius:7,padding:"3px 8px",letterSpacing:2}}>VS</div>
                      <div style={{flex:1,textAlign:"center"}}>
                        <div style={{fontSize:22,marginBottom:2}}>{teams.find(t=>t.id===r.toTeamId)?.avatar||"👥"}</div>
                        <div style={{fontSize:11,fontWeight:700,color:C.text}}>{r.toTeamName}</div>
                      </div>
                    </div>
                    <div style={{background:C.card2,borderRadius:10,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                      <div style={{fontSize:11,color:C.sub,textAlign:"center"}}>📅 {r.day} · ⏰ {r.hour} · {t('teams.awaiting_reply')}</div>
                      <div style={{fontSize:11,color:r.terrainName?C.accent:C.sub,textAlign:"center"}}>
                        📍 {r.terrainName?`${r.terrainName}${r.terrainCity?`, ${r.terrainCity}`:""}` : t('common.location_tbd')}
                      </div>
                      {r.message&&<div style={{fontSize:11,color:C.sub,fontStyle:"italic",textAlign:"center",borderTop:`1px solid ${C.border}`,paddingTop:4}}>"{r.message}"</div>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* 3. Matchs à venir — défis acceptés */}
            {MATCH_REQ.list.filter(r=>(myTeamIds.includes(r.toTeamId)||(r.isSolo&&r.fromUserId===user?.id)||myTeamIds.includes(r.fromTeamId))&&r.status==="accepted").length>0 && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:1,marginTop:4,marginBottom:2}}>📅 {t('teams.upcoming_matches')}</div>
                {MATCH_REQ.list.filter(r=>(myTeamIds.includes(r.toTeamId)||(r.isSolo&&r.fromUserId===user?.id)||myTeamIds.includes(r.fromTeamId))&&r.status==="accepted").map(r=>(
                  <div key={r.id} style={{background:C.card,border:`1px solid ${C.green}44`,borderLeft:`4px solid ${C.green}`,borderRadius:14,padding:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                      <div style={{flex:1,textAlign:"center"}}>
                        {r.isSolo ? (
                          <div style={{width:32,height:32,borderRadius:"50%",background:`${C.orange}25`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 2px",fontSize:14,fontWeight:700,color:C.orange}}>{(r.fromUserName||"?")[0]}</div>
                        ) : (
                          <div style={{fontSize:24,marginBottom:2}}>{teams.find(t=>t.id===r.fromTeamId)?.avatar||"👥"}</div>
                        )}
                        <div style={{fontSize:11,fontWeight:700,color:C.text}}>{r.isSolo?r.fromUserName:r.fromTeamName}</div>
                      </div>
                      <div style={{fontFamily:C.head,fontWeight:800,fontSize:16,color:C.green,background:`${C.green}15`,border:`2px solid ${C.green}44`,borderRadius:8,padding:"4px 10px",letterSpacing:2}}>VS</div>
                      <div style={{flex:1,textAlign:"center"}}>
                        <div style={{fontSize:24,marginBottom:2}}>{teams.find(t=>t.id===r.toTeamId)?.avatar||"👥"}</div>
                        <div style={{fontSize:11,fontWeight:700,color:C.text}}>{r.toTeamName}</div>
                      </div>
                    </div>
                    <div style={{background:C.card2,borderRadius:10,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                      <div style={{fontSize:12,color:C.green,fontWeight:700,textAlign:"center"}}>📅 {r.day} · ⏰ {r.hour} — {t('teams.match_confirmed')}</div>
                      <div style={{fontSize:11,color:r.terrainName?C.accent:C.sub,textAlign:"center"}}>
                        📍 {r.terrainName?`${r.terrainName}${r.terrainCity?`, ${r.terrainCity}`:""}` : t('common.location_tbd')}
                      </div>
                      {r.message&&<div style={{fontSize:11,color:C.sub,fontStyle:"italic",textAlign:"center",borderTop:`1px solid ${C.border}`,paddingTop:4}}>"{r.message}"</div>}
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* 4. Matchs passés — historique avec scores */}
            {pastMatches.length>0 && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:1,marginTop:4,marginBottom:2}}>🏆 {t('teams.past_matches')}</div>
                {pastMatches.map(m=>{
                  const myTeamIsFrom = myTeamIds.includes(m.fromTeamId);
                  const myScore  = myTeamIsFrom ? m.scoreFrom : m.scoreTo;
                  const oppScore = myTeamIsFrom ? m.scoreTo   : m.scoreFrom;
                  const myName   = myTeamIsFrom ? m.fromTeamName : m.toTeamName;
                  const myAvatar = myTeamIsFrom ? m.fromTeamAvatar : m.toTeamAvatar;
                  const oppName  = myTeamIsFrom ? m.toTeamName  : m.fromTeamName;
                  const oppAvatar= myTeamIsFrom ? m.toTeamAvatar  : m.fromTeamAvatar;
                  const won  = myScore > oppScore;
                  const draw = myScore === oppScore;
                  const rc   = won ? C.green : draw ? C.yellow : C.red;
                  const rl   = won ? t('teams.victory') : draw ? t('teams.draw') : t('teams.defeat');
                  return (
                    <div key={m.id} style={{background:C.card,border:`1px solid ${rc}33`,borderLeft:`4px solid ${rc}`,borderRadius:14,padding:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
                        <div style={{flex:1,textAlign:"center"}}>
                          <div style={{fontSize:24,marginBottom:2}}>{myAvatar}</div>
                          <div style={{fontSize:11,fontWeight:700,color:C.text}}>{myName}</div>
                        </div>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontFamily:C.head,fontWeight:800,fontSize:22,color:rc,letterSpacing:2}}>{myScore} – {oppScore}</div>
                          <div style={{fontSize:10,fontWeight:700,color:rc,background:`${rc}18`,border:`1px solid ${rc}33`,borderRadius:5,padding:"2px 8px",marginTop:3,display:"inline-block"}}>{rl}</div>
                        </div>
                        <div style={{flex:1,textAlign:"center"}}>
                          <div style={{fontSize:24,marginBottom:2}}>{oppAvatar}</div>
                          <div style={{fontSize:11,fontWeight:700,color:C.text}}>{oppName}</div>
                        </div>
                      </div>
                      <div style={{fontSize:11,color:C.sub,textAlign:"center"}}>
                        📅 {m.date} · 📍 {m.terrainName}{m.terrainCity?`, ${m.terrainCity}`:""}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Empty state */}
            {MATCH_REQ.list.filter(r=>myTeamIds.includes(r.toTeamId)||(r.isSolo&&r.fromUserId===user?.id)||myTeamIds.includes(r.fromTeamId)).length===0 && pastMatches.length===0 && (
              <div style={{textAlign:"center",padding:"50px 20px"}}>
                <div style={{fontSize:48,marginBottom:12}}>⚔️</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>{t('teams.no_matches')}</div>
                <div style={{fontSize:13,color:C.sub,lineHeight:1.6}}>{t('teams.no_matches_sub')}</div>
              </div>
            )}
          </div>
        )}

        {/* ── DEMANDES TAB ── */}
        {viewTab==="requests" && (
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:11,fontWeight:700,color:C.yellow,textTransform:"uppercase",letterSpacing:1}}>{t('teams.membership_requests')}</div>
              {totalPending>0 && <span style={{background:`${C.yellow}20`,color:C.yellow,border:`1px solid ${C.yellow}40`,borderRadius:8,padding:"2px 8px",fontSize:11,fontWeight:700}}>{totalPending} {t('common.pending')}</span>}
            </div>

            {allPendingReqs.length===0 ? (
              <div style={{textAlign:"center",padding:"60px 20px"}}>
                <div style={{fontSize:48,marginBottom:12}}>👥</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>{t('teams.no_requests')}</div>
                <div style={{fontSize:13,color:C.sub}}>{t('teams.no_requests_sub')}</div>
              </div>
            ) : allPendingReqs.map(req=>{
              const fromUser = DB.find(u=>u.id===req.fromUserId);
              return (
                <div key={req.id} style={{background:C.card,border:`1.5px solid ${C.accent}44`,borderRadius:16,padding:16}}>
                  <div style={{display:"flex",gap:12,marginBottom:14,alignItems:"center"}}>
                    <Avatar name={req.fromName} size={46} color={C.accent} photo={fromUser?.avatar}/>
                    <div style={{flex:1,minWidth:0}}>
                      <UserBadge name={req.fromName} size="md" showLevel showInsignes/>
                      <div style={{fontSize:12,color:C.accent,fontWeight:600,marginTop:2}}>→ {req.teamName}</div>
                      {fromUser?.city && <div style={{fontSize:11,color:C.sub,marginTop:2}}>📍 {fromUser.city} · {fromUser.level||"Amateur"}</div>}
                      <div style={{fontSize:10,color:C.sub,marginTop:3}}>{timeAgo(req.ts)}</div>
                    </div>
                  </div>
                  {req.message && (
                    <div style={{background:C.card2,borderRadius:10,padding:"8px 12px",fontSize:12,color:C.text,fontStyle:"italic",marginBottom:12}}>"{req.message}"</div>
                  )}
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>acceptTeamReq(req)} style={{flex:1,padding:"12px",borderRadius:11,background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",color:C.green,fontFamily:C.font,fontSize:14,fontWeight:700,cursor:"pointer"}}>✅ {t('common.accept')}</button>
                    <button onClick={()=>TEAM_REQ.respond(req.id,"rejected")} style={{flex:1,padding:"12px",borderRadius:11,background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",color:C.red,fontFamily:C.font,fontSize:14,fontWeight:700,cursor:"pointer"}}>❌ {t('common.decline')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Roster modal */}
      {rosterTeam && <TeamRosterModal team={rosterTeam} onClose={()=>setRosterTeam(null)} currentUser={user} onGoToMessages={onGoToMessages}/>}

      {/* Join request modal */}
      {joinModal && (
        <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>{setJoinModal(null);setJoinNote("");}}>
          <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:20,width:"100%",maxWidth:400,padding:20}} onClick={e=>e.stopPropagation()}>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text,marginBottom:4}}>{t('teams.join_title')}</div>
            <div style={{fontSize:13,color:C.sub,marginBottom:16}}>{t('teams.join_request_sub',{name:joinModal.name})}</div>
            <div style={{display:"flex",gap:10,alignItems:"center",background:C.card2,borderRadius:12,padding:"10px 12px",marginBottom:14}}>
              <div style={{width:38,height:38,borderRadius:10,background:`${sp(joinModal.sport)?.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{joinModal.avatar}</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{joinModal.name}</div>
                <div style={{fontSize:11,color:C.sub}}>{sp(joinModal.sport)?.label} · {t('levels.'+(LEVEL_KEYS[LEVELS.indexOf(joinModal.level)]||'amateur'))}</div>
              </div>
            </div>
            <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>{t('teams.captain_msg_label')}</label>
            <textarea value={joinNote} onChange={e=>setJoinNote(e.target.value)}
              placeholder={t('teams.captain_msg_ph')}
              rows={3}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",boxSizing:"border-box",marginBottom:14}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={sendJoinRequest} variant="solid">📨 {t('teams.send_request')}</Btn>
              <Btn onClick={()=>{setJoinModal(null);setJoinNote("");}} variant="ghost">{t('common.cancel')}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Challenge modal */}
      {challengeModal && user && (
        <ChallengeModal user={user} myTeams={myTeams} targetTeam={challengeModal} terrains={terrains||[]} onClose={()=>setChallengeModal(null)}/>
      )}
    </div>
  );
}

// ─── MESSAGING VIEW ───────────────────────────────────────────────────────────


// ─── USER PROFILE MODAL ───────────────────────────────────────────────────────
function UserProfileModal({ profile, currentUser, onClose, onGoToMessages }) {
  const {t} = useTranslation();
  const [isFriend, setIsFriend] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    fetch(`${API}/api/friends`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then(list => setIsFriend(list.some(f => f.id === profile.id)))
      .catch(() => {});
  }, [currentUser?.id, profile.id]);

  const handleFriendBtn = async () => {
    if (!currentUser || hasPending) return;
    if (isFriend) {
      try {
        const res = await fetch(`${API}/api/friends/${profile.id}`, { method: 'DELETE', headers: authHeader() });
        if (res.ok) setIsFriend(false);
      } catch {}
      return;
    }
    try {
      const res = await fetch(`${API}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ userId: profile.id }),
      });
      if (res.ok) { setHasPending(true); return; }
      const d = await res.json().catch(() => ({}));
      if (d.error === 'already_friends') setIsFriend(true);
      else if (d.error === 'already_requested') setHasPending(true);
    } catch {}
  };
  const startChat = () => {
    if (onGoToMessages) { onGoToMessages(profile.id); onClose(); }
    else onClose();
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,.8)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>{t('social.player_profile')}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.sub,fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:20}}>
          <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
            <Avatar name={profile.name} size={60} color={C.accent} photo={profile.avatar}/>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                <UserBadge name={profile.name} user={profile} size="lg" showLevel showInsignes/>
                {profile.verified&&<span style={{background:"rgba(81,207,102,.15)",color:C.green,border:"1px solid rgba(81,207,102,.4)",borderRadius:5,padding:"2px 7px",fontSize:9,fontWeight:700}}>{t('profile.verified')}</span>}
              </div>
              <div style={{fontSize:12,color:C.sub,marginTop:3}}>📍 {profile.city}</div>
              <div style={{marginTop:6}}><Badge label={profile.level} color={C.accent}/></div>
            </div>
          </div>
          {profile.bio&&<p style={{fontSize:13,color:C.sub,lineHeight:1.6,marginBottom:14,background:C.card2,borderRadius:10,padding:"10px 12px"}}>{profile.bio}</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
            {[["🏟️",t('profile.stats_terrains'),profile.terrains||0,C.blue],["VS",t('profile.stats_matchs'),profile.matchs||0,C.orange],["👥",t('profile.stats_teams'),profile.teams||0,C.purple]].map(([icon,label,val,color])=>(
              <div key={label} style={{background:C.card2,borderRadius:10,padding:10,textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:4,display:"flex",justifyContent:"center",alignItems:"center",minHeight:24}}>
                  {icon==="VS"
                    ? <span style={{fontFamily:C.head,fontWeight:800,fontSize:13,color:C.orange,background:`${C.orange}18`,border:`2px solid ${C.orange}55`,borderRadius:7,padding:"2px 7px",letterSpacing:2}}>VS</span>
                    : icon}
                </div>
                <div style={{fontFamily:C.head,fontWeight:700,fontSize:20,color}}>{val}</div>
                <div style={{fontSize:10,color:C.sub}}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
            {profile.sports?.map(sid=>{const s=SPORTS.find(x=>x.id===sid);return s?<Badge key={sid} label={<><SportEmoji sport={s} size={11}/> {s.label}</>} color={s.color}/>:null;})}
          </div>
          {/* Insignes & couleur de pseudo */}
          {(() => {
            const earned = getEarnedBadges(profile);
            const refBadge = getReferralLevel(profile.referralCount||0);
            if (!earned.length && !refBadge.badge) return null;
            return (
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,padding:"8px 10px",background:C.card2,borderRadius:10}}>
                {earned.map(({def,tier})=>(
                  <span key={def.id} title={`${t(def.nameKey)} — ${t(tier.labelKey)}`}
                    style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:C.text,background:C.card,border:`1px solid rgba(255,215,0,.3)`,borderRadius:16,padding:"3px 8px"}}>
                    {def.emoji} {tier.medal} {t(def.nameKey)}
                  </span>
                ))}
                {refBadge.badge && (
                  <span title={`${t('profile.referral_section')} — ${t('profile.ref_level_'+refBadge.level)}`}
                    style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:C.text,background:C.card,border:`1px solid rgba(205,127,50,.3)`,borderRadius:16,padding:"3px 8px"}}>
                    {refBadge.badge} {t('profile.ref_level_'+refBadge.level)}
                  </span>
                )}
              </div>
            );
          })()}
          {profile.record && Object.keys(profile.record).length>0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{t('social.win_loss_ratio')}</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {Object.entries(profile.record).map(([sportId,{w,l}])=>{
                  const s = SPORTS.find(x=>x.id===sportId);
                  if (!s) return null;
                  const total = w + l;
                  const pct = total > 0 ? Math.round((w/total)*100) : 0;
                  return (
                    <div key={sportId} style={{background:C.card2,borderRadius:10,padding:"9px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <SportEmoji sport={s} size={16}/>
                          <span style={{fontSize:12,fontWeight:700,color:C.text}}>{s.label}</span>
                        </div>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <span style={{fontSize:12,fontWeight:700,color:C.green}}>✅ {w}{t('common.win_abbr')}</span>
                          <span style={{fontSize:12,fontWeight:700,color:C.red}}>❌ {l}{t('common.loss_abbr')}</span>
                          <span style={{fontSize:11,fontWeight:700,color:pct>=50?C.green:C.red,background:`${pct>=50?C.green:C.red}15`,border:`1px solid ${pct>=50?C.green:C.red}40`,borderRadius:6,padding:"1px 7px"}}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{height:5,borderRadius:3,background:C.card,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:pct>=50?C.green:C.red,borderRadius:3,transition:"width .4s"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            {currentUser && (
              <button onClick={handleFriendBtn}
                style={{flex:1,padding:"11px",borderRadius:10,
                  border:`1px solid ${isFriend?C.red+"55":hasPending?C.yellow+"55":C.accent+"55"}`,
                  background:isFriend?`${C.red}12`:hasPending?`${C.yellow}10`:C.aLow,
                  color:isFriend?C.red:hasPending?C.yellow:C.accent,
                  fontFamily:C.font,fontSize:13,fontWeight:700,
                  cursor:hasPending&&!isFriend?"default":"pointer",opacity:hasPending&&!isFriend?.75:1,transition:"all .2s"}}>
                {isFriend?`❌ ${t('common.remove_friend')}`:hasPending?`⏳ ${t('social.friend_req_sent')}`:`➕ ${t('common.send_request')}`}
              </button>
            )}
            <button onClick={startChat} style={{flex:1,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,background:C.accent,color:"#06090f",fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              💬 {t('common.message_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FRIEND CHALLENGE MODAL ───────────────────────────────────────────────────
function FriendChallengeModal({ user, friend, terrains, onClose }) {
  const {t} = useTranslation();
  const sharedSports = (friend.sports||[]).filter(s=>(user.sports||[]).includes(s));
  const availSports  = sharedSports.length>0 ? sharedSports : (friend.sports?.length>0 ? friend.sports : ["football"]);
  const [sport,        setSport]       = useState(availSports[0]);
  const [day,          setDay]         = useState("sat");
  const [hour,         setHour]        = useState("16h");
  const [msg,          setMsg]         = useState("");
  const [sent,         setSent]        = useState(false);
  const [matchTerrain, setMatchTerrain]= useState(null);
  const [tSearch,      setTSearch]     = useState("");

  const HOURS = ["08h","10h","12h","14h","16h","18h","20h","22h"];

  const alreadySent = MATCH_REQ.hasPendingFriend(user.id, friend.id);

  const filteredTerrains = terrains.filter(t=>terrainSports(t).includes(sport)).filter(t=>
    !tSearch.trim()||t.name.toLowerCase().includes(tSearch.toLowerCase())||(t.city||"").toLowerCase().includes(tSearch.toLowerCase())
  );

  const send = () => {
    if (alreadySent||sent) return;
    const ti = matchTerrain ? { terrainId:matchTerrain.id, terrainName:matchTerrain.name, terrainCity:matchTerrain.city } : {};
    MATCH_REQ.send({ isFriend:true, fromUserId:user.id, fromUserName:user.name, toUserId:friend.id, toUserName:friend.name, sport, day, hour, message:msg.trim(), ...ti });
    setSent(true);
    setTimeout(onClose, 2000);
  };

  if (sent) return (
    <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`1px solid ${C.accent}`,borderRadius:20,padding:32,maxWidth:320,width:"100%",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>⚔️</div>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:20,color:C.accent,marginBottom:8}}>{t('invites.challenge_accepted')}</div>
        <div style={{fontSize:13,color:C.sub,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap",justifyContent:"center"}}><UserBadge name={friend.name} user={friend} size="sm" showLevel={false} showInsignes={false}/></div>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:400,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text,display:"flex",alignItems:"center",gap:6}}>⚔️ {t('invites.challenge_friend')} <UserBadge name={friend.name} user={friend} size="md" showLevel showInsignes/></div>
            <div style={{fontSize:11,color:C.sub,marginTop:2}}>{t('invites.direct_challenge_sub')}</div>
          </div>
          <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.sub,fontSize:18,lineHeight:1}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:14}}>
          {/* Sport */}
          {availSports.length>1 && (
            <div>
              <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{t('common.sport')}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {availSports.map(sid=>{const s=SPORTS.find(x=>x.id===sid);if(!s)return null;return(
                  <button key={sid} onClick={()=>setSport(sid)}
                    style={{padding:"7px 12px",borderRadius:20,border:`1.5px solid ${sport===sid?s.color:C.border}`,background:sport===sid?`${s.color}22`:"transparent",color:sport===sid?s.color:C.sub,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:C.font,display:"flex",alignItems:"center",gap:5}}>
                    <SportEmoji sport={s} size={13}/>{s.label}
                  </button>
                );})}
              </div>
            </div>
          )}

          {/* Day + Hour */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{t('teams.day_label')}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {DAYS.map(d=>(
                  <button key={d} onClick={()=>setDay(d)}
                    style={{padding:"5px 8px",borderRadius:8,border:`1.5px solid ${day===d?C.accent:C.border}`,background:day===d?C.aLow:"transparent",color:day===d?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                    {t('days.'+d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{t('teams.hour_label')}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {HOURS.map(h=>(
                  <button key={h} onClick={()=>setHour(h)}
                    style={{padding:"5px 8px",borderRadius:8,border:`1.5px solid ${hour===h?C.accent:C.border}`,background:hour===h?C.aLow:"transparent",color:hour===h?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Terrain */}
          <div>
            <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{t('invites.terrain_optional')}</div>
            {matchTerrain ? (
              <div style={{background:C.card2,border:`1px solid ${C.accent}55`,borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{matchTerrain.name}</div>
                  <div style={{fontSize:11,color:C.sub}}>📍 {matchTerrain.city}</div>
                </div>
                <button onClick={()=>setMatchTerrain(null)} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:18,padding:0,lineHeight:1}}>✕</button>
              </div>
            ) : (
              <div>
                <input value={tSearch} onChange={e=>setTSearch(e.target.value)}
                  placeholder={t('invites.search_terrain',{sport:SPORTS.find(x=>x.id===sport)?.label||sport})}
                  style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,boxSizing:"border-box",marginBottom:6}}/>
                {filteredTerrains.length>0 && (
                  <div style={{maxHeight:120,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                    {filteredTerrains.slice(0,5).map(t=>(
                      <button key={t.id} onClick={()=>{setMatchTerrain(t);setTSearch("");}}
                        style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontFamily:C.font,width:"100%",textAlign:"left"}}>
                        <span style={{fontSize:12,fontWeight:700,color:C.text}}>{t.name}</span>
                        <span style={{fontSize:11,color:C.sub}}>📍 {t.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{t('common.message_optional')}</div>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder={t('invites.challenge_msg_friend_ph')} rows={2}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",boxSizing:"border-box"}}/>
          </div>
        </div>

        <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
          <button onClick={send} disabled={alreadySent}
            style={{width:"100%",padding:"13px",borderRadius:12,background:alreadySent?C.border:C.orange,border:"none",color:alreadySent?C.sub:"#06090f",fontSize:14,fontWeight:700,cursor:alreadySent?"default":"pointer",fontFamily:C.head,transition:"background .2s"}}>
            {alreadySent?`⏳ ${t('invites.already_sent')}`:`⚔️ ${t('invites.send_challenge_btn')}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SOCIAL VIEW ──────────────────────────────────────────────────────────────
function SocialView({ user, terrains, onGoToMessages }) {
  const {t} = useTranslation();
  useStore(PROFILES_STORE);
  const [tab,setTab]             = useState("friends");
  const [query,setQuery]         = useState("");
  const [cityFilter,setCityFilter] = useState(null);
  const [selUser,setSelUser]     = useState(null);
  const [challengeFriend,setChallengeFriend] = useState(null);

  const others    = DB.filter(u=>u.id!==user.id);
  const allCities = [...new Set(DB.map(u=>u.city).filter(Boolean))];

  // Real friends, backed by the friendships table.
  const [realFriends, setRealFriends] = useState([]);
  const fetchRealFriends = useCallback(() => {
    fetch(`${API}/api/friends`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then(setRealFriends)
      .catch(() => {});
  }, []);
  useEffect(() => { fetchRealFriends(); }, [fetchRealFriends]);
  const friendList = realFriends.map(f => DB.find(u=>u.id===f.id) || f).filter(Boolean);
  const removeFriend = async u => {
    try {
      const res = await fetch(`${API}/api/friends/${u.id}`, { method: 'DELETE', headers: authHeader() });
      if (res.ok) setRealFriends(p=>p.filter(f=>f.id!==u.id));
    } catch {}
  };

  const filtered = others.filter(u => {
    const q = query.trim().toLowerCase();
    const matchQuery = !q || u.name.toLowerCase().includes(q) || (u.city||"").toLowerCase().includes(q);
    const matchCity  = !cityFilter || (u.city||"").toLowerCase()===cityFilter.toLowerCase();
    return matchQuery && matchCity;
  }).sort((a,b)=>{
    const aM=(a.city||"").toLowerCase()===user.city?.toLowerCase();
    const bM=(b.city||"").toLowerCase()===user.city?.toLowerCase();
    return (bM?1:0)-(aM?1:0);
  });

  const qrData = encodeURIComponent(`rvf://user/${user.id}/${user.name}`);
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&color=00e5a0&bgcolor=0d1421&margin=10`;

  return (
    <div style={{flex:1,overflowY:"auto",padding:16}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        {/* Tabs */}
        <div style={{display:"flex",background:C.card,borderRadius:12,padding:4,gap:4,marginBottom:16}}>
          {[["friends","social.tab_friends"],["search","social.tab_search"],["qr","social.tab_qr"]].map(([tabId,tk])=>(
            <button key={tabId} onClick={()=>setTab(tabId)}
              style={{flex:1,padding:"9px 0",border:"none",borderRadius:9,background:tab===tabId?C.accent:"transparent",color:tab===tabId?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s",position:"relative"}}>
              {t(tk)}
              {tabId==="friends"&&friendList.length>0&&<span style={{marginLeft:5,background:tab===tabId?"#06090f22":C.accent,color:tab===tabId?"#06090f":"#06090f",borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:800}}>{friendList.length}</span>}
            </button>
          ))}
        </div>

        {tab==="friends" && (
          <div>
            {friendList.length===0 ? (
              <div style={{textAlign:"center",padding:"50px 20px"}}>
                <div style={{fontSize:48,marginBottom:12}}>👥</div>
                <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>{t('social.no_friends')}</div>
                <div style={{fontSize:13,color:C.sub,lineHeight:1.6,marginBottom:20}}>{t('social.empty_hint')}</div>
                <button onClick={()=>setTab("search")} style={{background:C.accent,border:"none",borderRadius:10,padding:"11px 24px",color:"#06090f",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                  🔍 {t('social.find_btn')}
                </button>
              </div>
            ) : (
              <div>
                <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
                  {t('social.friends_count_one', {count:friendList.length})}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {friendList.map(u=>(
                    <div key={u.id}
                      style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent+"55"}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
                      onClick={()=>setSelUser(u)}>
                      <div style={{position:"relative"}}>
                        <Avatar name={u.name} size={46} color={C.accent} photo={u.avatar}/>
                        <span style={{position:"absolute",bottom:0,right:0,width:12,height:12,borderRadius:"50%",background:C.green,border:`2px solid ${C.card}`}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                          <UserBadge name={u.name} user={u} size="md" showLevel showInsignes/>
                          {u.verified&&<span style={{fontSize:9,color:C.green,fontWeight:700}}>✅</span>}
                        </div>
                        <div style={{fontSize:11,color:C.sub,marginTop:2}}>📍 {u.city} · <span style={{color:C.accent}}>{t('levels.'+(LEVEL_KEYS[LEVELS.indexOf(u.level)]||'amateur'))}</span></div>
                        <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                          {u.sports?.slice(0,4).map(sid=>{const s=SPORTS.find(x=>x.id===sid);return s?<span key={sid} title={s.label}><SportEmoji sport={s} size={13}/></span>:null;})}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
                        <button onClick={e=>{e.stopPropagation();if(onGoToMessages)onGoToMessages(u.id);}}
                          style={{background:C.accent,border:"none",borderRadius:8,padding:"6px 12px",color:"#06090f",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                          {t('social.message')}
                        </button>
                        <button onClick={e=>{e.stopPropagation();setChallengeFriend(u);}}
                          style={{background:`${C.orange}20`,border:`1px solid ${C.orange}44`,borderRadius:8,padding:"6px 12px",color:C.orange,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                          {t('social.challenge')}
                        </button>
                        <button onClick={e=>{e.stopPropagation();removeFriend(u);}}
                          style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px",color:C.sub,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
                          {t('common.remove_btn')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="search" && (
          <div>
            {/* Search input */}
            <div style={{position:"relative",marginBottom:10}}>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('social.search')}
                style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px 11px 42px",color:C.text,fontSize:14,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}/>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:16}}>🔍</span>
              {query&&<button onClick={()=>setQuery("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:16,padding:0,lineHeight:1}}>✕</button>}
            </div>

            {/* City filter chips */}
            <div style={{overflowX:"auto",display:"flex",gap:6,paddingBottom:4,marginBottom:12,scrollbarWidth:"none"}}>
              <button onClick={()=>setCityFilter(null)}
                style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`1.5px solid ${!cityFilter?C.accent:C.border}`,background:!cityFilter?C.aLow:"transparent",color:!cityFilter?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,whiteSpace:"nowrap"}}>
                {t('common.all_filter')}
              </button>
              {allCities.map(city=>{
                const active = cityFilter===city;
                const count  = others.filter(u=>u.city===city).length;
                return (
                  <button key={city} onClick={()=>setCityFilter(active?null:city)}
                    style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`1.5px solid ${active?C.accent:C.border}`,background:active?C.aLow:"transparent",color:active?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
                    📍 {city} <span style={{background:active?`${C.accent}30`:C.card2,borderRadius:10,padding:"1px 6px",fontSize:10}}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Result count */}
            <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
              {cityFilter
                ? `${filtered.length} ${t('social.players_count_other')} — ${cityFilter}`
                : query
                  ? `${filtered.length} ${t('social.players_count_other')}`
                  : `${others.length} ${t('social.players_count_other')}`}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtered.length===0 && (
                <div style={{textAlign:"center",padding:"40px 20px",color:C.sub}}>
                  <div style={{fontSize:32,marginBottom:10}}>🔍</div>
                  <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>{t('common.no_player_found_search')}</div>
                  <div style={{fontSize:12}}>{t('common.try_other_search')}</div>
                </div>
              )}
              {filtered.map(u=>(
                <div key={u.id} onClick={()=>setSelUser(u)}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent+"55"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <Avatar name={u.name} size={46} color={C.accent} photo={u.avatar}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <UserBadge name={u.name} user={u} size="md" showLevel showInsignes/>
                      {u.verified&&<span style={{fontSize:9,color:C.green,fontWeight:700}}>✅</span>}
                    </div>
                    <div style={{fontSize:11,color:C.sub,marginTop:2,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                      <button onClick={e=>{e.stopPropagation();setCityFilter(u.city);setQuery("");}}
                        style={{background:"none",border:"none",padding:0,cursor:"pointer",color:cityFilter===u.city?C.accent:C.sub,fontSize:11,fontFamily:C.font,textDecoration:cityFilter===u.city?"underline":"none"}}>
                        📍 {u.city}
                      </button>
                      {(u.city||"").toLowerCase()===user.city?.toLowerCase()&&<span style={{background:`${C.accent}20`,color:C.accent,borderRadius:5,padding:"1px 5px",fontSize:9,fontWeight:700}}>{t('social.my_city')}</span>}
                      <span>·</span><span style={{color:C.accent}}>{t('levels.'+(LEVEL_KEYS[LEVELS.indexOf(u.level)]||'amateur'))}</span>
                    </div>
                    <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                      {u.sports?.slice(0,4).map(sid=>{const s=SPORTS.find(x=>x.id===sid);return s?<span key={sid} title={s.label}><SportEmoji sport={s} size={14}/></span>:null;})}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    {[["🏟️",u.terrains||0,"ter.",C.blue],["⚽",u.matchs||0,"mat.",C.orange],["👥",u.teams||0,"éq.",C.purple]].map(([icon,val,label,color])=>(
                      <div key={label} style={{textAlign:"center",background:C.card2,borderRadius:8,padding:"5px 7px",minWidth:36}}>
                        <div style={{fontSize:10}}>{icon}</div>
                        <div style={{fontFamily:C.head,fontWeight:700,fontSize:13,color}}>{val}</div>
                        <div style={{fontSize:8,color:C.sub}}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="qr" && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:20,color:C.text,marginBottom:6}}>{t('social.qr_title')}</div>
            <div style={{fontSize:13,color:C.sub,marginBottom:22,lineHeight:1.6}}>{t('social.qr_sub')}</div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,padding:24,display:"inline-block",marginBottom:16}}>
              <img src={qrUrl} alt="QR Code" style={{width:200,height:200,borderRadius:8,display:"block"}}/>
            </div>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>{user.name}</div>
            <div style={{fontSize:11,color:C.sub,marginTop:4}}>📍 {user.city} · {user.level}</div>
          </div>
        )}

      </div>

      {selUser && <UserProfileModal profile={selUser} currentUser={user} onClose={()=>setSelUser(null)} onGoToMessages={onGoToMessages}/>}
      {challengeFriend && <FriendChallengeModal user={user} friend={challengeFriend} terrains={terrains||[]} onClose={()=>setChallengeFriend(null)}/>}
    </div>
  );
}

// ─── MESSAGING VIEW ───────────────────────────────────────────────────────────
function MessagingView({ user, openWith }) {
  const {t} = useTranslation();
  useStore(CHAT);
  useStore(TEAM_CHAT);

  // DM state
  const [sel,setSel]           = useState(null);
  const [newMsg,setNewMsg]     = useState("");
  const [showNew,setShowNew]   = useState(false);
  const [newTo,setNewTo]       = useState("");
  const [showChat,setShowChat] = useState(false);
  const [viewProfile,setViewProfile] = useState(null);
  const msgEndRef              = useRef();

  // Team chat state
  const [msgTab,setMsgTab]     = useState("dm"); // "dm" | "teams"
  const [selTeam,setSelTeam]   = useState(null);
  const [teamMsg,setTeamMsg]   = useState("");
  const teamMsgEndRef          = useRef();

  const isMobile = useIsMobile();

  // DM derived
  const convs    = CHAT.list();
  const selConv  = sel ? CHAT.convs[sel]||[] : [];
  const selOther = sel ? sel.split("::").find(id=>id!==String(user.id)) : null;

  // Team derived — real teams the user is an approved member of (captain or not), fetched
  // once per visit to this view so creating a team or accepting an invite shows up on return.
  const [userTeams, setUserTeams] = useState([]);
  useEffect(() => {
    if (!user?.id) { setUserTeams([]); return; }
    fetch(`${API}/api/teams/mine`, { headers: authHeader(), signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : [])
      .then(setUserTeams)
      .catch(() => {});
  }, [user?.id]);
  // Real friends, used to suggest who to start a new DM with.
  const [myFriends, setMyFriends] = useState([]);
  useEffect(() => {
    if (!user?.id) { setMyFriends([]); return; }
    fetch(`${API}/api/friends`, { headers: authHeader(), signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : [])
      .then(setMyFriends)
      .catch(() => {});
  }, [user?.id]);
  const sp = id => SPORTS.find(s=>s.id===id);
  const selTeamObj  = selTeam ? userTeams.find(t=>t.id===selTeam) : null;
  const teamMsgs    = selTeam ? TEAM_CHAT.messages(selTeam) : [];
  const dmUnread    = CHAT.totalUnread();
  const teamUnread  = TEAM_CHAT.totalUnread(user.id, userTeams.map(t=>t.id));

  const getProfile = id => DB.find(u=>String(u.id)===String(id)) || { name:"?", id, city:"", level:"Amateur", bio:"", avatar:null, sports:[] };
  const openProfile = id => { if(String(id)!==String(user.id)) setViewProfile(getProfile(id)); };
  const selectConv  = id => { setSel(id); if(isMobile) setShowChat(true); };

  // Load the conversation list once, then keep it in sync while this view is open
  useEffect(()=>{ CHAT.loadConversations(user.id); },[user.id]);

  // Open DM when navigating from another view
  useEffect(()=>{
    if (!openWith) return;
    const cid = CHAT.cid(user.id, openWith);
    setSel(cid); setMsgTab("dm");
    if (isMobile) setShowChat(true);
  },[openWith]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load history for the selected conversation
  useEffect(()=>{ if(sel && selOther) CHAT.loadThread(user.id, selOther); },[sel]); // eslint-disable-line react-hooks/exhaustive-deps

  // DM auto-scroll + mark-read
  useEffect(()=>{ msgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[selConv.length]);
  useEffect(()=>{ if(sel) CHAT.markRead(sel,user.id); },[sel,selConv.length]);

  // Team chat auto-scroll + mark-read
  useEffect(()=>{ teamMsgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[selTeam,teamMsgs.length]);
  useEffect(()=>{ if(selTeam) TEAM_CHAT.markRead(selTeam,user.id); },[selTeam,teamMsgs.length]);

  // Team chat: load on selection + light poll while a team thread is open (no realtime backend anymore)
  useEffect(()=>{
    if (!selTeam) return;
    TEAM_CHAT.loadMessages(selTeam);
    const interval = setInterval(()=>TEAM_CHAT.loadMessages(selTeam), 4000);
    return () => clearInterval(interval);
  },[selTeam]);

  const send = () => {
    if (!newMsg.trim()||!selOther) return;
    CHAT.send(user.id,selOther,newMsg.trim());
    setNewMsg("");
  };

  const sendTeamMsg = () => {
    if (!teamMsg.trim()||!selTeam) return;
    const text = teamMsg.trim();
    setTeamMsg("");
    TEAM_CHAT.sendMessage(selTeam, user.id, user.name, text);
  };

  const openConvWith = otherId => {
    if (!otherId) return;
    const id = CHAT.cid(user.id, otherId);
    setSel(id); setShowNew(false); setNewTo("");
    if (isMobile) setShowChat(true);
  };

  const switchTab = tab => {
    setMsgTab(tab);
    if (tab==="dm") { setSelTeam(null); }
    else { setSel(null); }
    if (isMobile) setShowChat(false);
  };

  return (
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      {/* Sidebar */}
      <div style={{width:isMobile?"100%":280,display:isMobile&&showChat?"none":"flex",background:C.card,borderRight:isMobile?"none":`1px solid ${C.border}`,flexDirection:"column",flexShrink:0}}>

        {/* Header */}
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>{t('messages.title')}</div>
          {msgTab==="dm" && <button onClick={()=>setShowNew(p=>!p)} style={{background:C.accent,border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#06090f",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>}
        </div>

        {/* Tab switcher */}
        <div style={{display:"flex",gap:3,padding:"8px 10px",background:C.card,borderBottom:`1px solid ${C.border}`}}>
          <button onClick={()=>switchTab("dm")}
            style={{flex:1,borderRadius:8,border:"none",padding:"6px 4px",background:msgTab==="dm"?C.aLow:"transparent",color:msgTab==="dm"?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            💬 {t('nav.messages')}
            {dmUnread>0 && <span style={{minWidth:15,height:15,borderRadius:8,background:C.accent,color:"#06090f",fontSize:9,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{dmUnread}</span>}
          </button>
          <button onClick={()=>switchTab("teams")}
            style={{flex:1,borderRadius:8,border:"none",padding:"6px 4px",background:msgTab==="teams"?`${C.purple}25`:"transparent",color:msgTab==="teams"?C.purple:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            👥 {t('nav.teams')}
            {teamUnread>0 && <span style={{minWidth:15,height:15,borderRadius:8,background:C.purple,color:"#fff",fontSize:9,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{teamUnread}</span>}
          </button>
        </div>

        {/* ── DM tab ── */}
        {msgTab==="dm" && (
          <>
            {showNew && (()=>{
              const friendList  = myFriends.map(f=>DB.find(u=>u.id===f.id) || f).filter(Boolean);
              const q = newTo.trim().toLowerCase();
              const filtered = q ? friendList.filter(f=>f.name.toLowerCase().includes(q)) : friendList;
              return (
                <div style={{padding:12,borderBottom:`1px solid ${C.border}`,background:C.card2}}>
                  <div style={{fontSize:11,color:C.sub,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{t('messages.new_conv')}</div>
                  <input value={newTo} onChange={e=>setNewTo(e.target.value)} placeholder={t('terrain.search_player_ph')}
                    style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font,boxSizing:"border-box",marginBottom:8}}/>
                  <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto"}}>
                    {filtered.length===0
                      ? <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"12px 0"}}>{t('messages.no_player_found')}</div>
                      : filtered.map(f=>(
                        <button key={f.id} onClick={()=>openConvWith(f.id)}
                          style={{display:"flex",alignItems:"center",gap:9,padding:"7px 10px",borderRadius:9,cursor:"pointer",fontFamily:C.font,background:C.card,border:`1px solid ${C.border}`,color:C.text,textAlign:"left",width:"100%"}}>
                          <Avatar name={f.name} size={28} color={C.accent} photo={f.avatar}/>
                          <div style={{flex:1,minWidth:0}}>
                            <UserBadge name={f.name} user={f} size="sm" showInsignes={false}/>
                            <div style={{fontSize:10,color:C.accent,marginTop:1}}>{t('messages.friends_label')}</div>
                          </div>
                          <span style={{fontSize:11,color:C.sub}}>💬</span>
                        </button>
                      ))
                    }
                  </div>
                </div>
              );
            })()}
            <div style={{flex:1,overflowY:"auto"}}>
              {convs.length===0
                ? <div style={{padding:20,textAlign:"center",color:C.sub,fontSize:13}}><div style={{fontSize:32,marginBottom:8}}>💬</div>{t('messages.no_conversations')}</div>
                : convs.map(conv=>{
                    const otherProfile = getProfile(conv.other);
                    return (
                    <div key={conv.id} onClick={()=>selectConv(conv.id)}
                      style={{padding:"11px 14px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:sel===conv.id?C.aLow:C.card,borderLeft:`3px solid ${sel===conv.id?C.accent:"transparent"}`}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <div style={{position:"relative",flexShrink:0}}>
                          <Avatar name={otherProfile.name} size={36} color={C.accent} photo={otherProfile.avatar}/>
                          {conv.unread>0 && <div style={{position:"absolute",top:-2,right:-2,width:16,height:16,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#06090f"}}>{conv.unread}</div>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <UserBadge name={otherProfile.name} user={otherProfile} size="sm" showLevel={false} showInsignes={false}/>
                            <span style={{fontSize:10,color:C.sub}}>{conv.last?timeAgo(conv.last.ts):""}</span>
                          </div>
                          <div style={{fontSize:11,color:conv.unread>0?C.accent:C.sub,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:conv.unread>0?700:400}}>
                            {String(conv.last?.from)===String(user.id)?t('common.you_prefix'):""}{conv.last?.text||t('common.new_conversation')}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })
              }
            </div>
          </>
        )}

        {/* ── Teams tab ── */}
        {msgTab==="teams" && (
          <div style={{flex:1,overflowY:"auto"}}>
            {userTeams.length===0 ? (
              <div style={{padding:24,textAlign:"center",color:C.sub,fontSize:13}}>
                <div style={{fontSize:32,marginBottom:8}}>👥</div>
                {t('common.join_team_chat')}
              </div>
            ) : userTeams.map(team=>{
              const s = sp(team.sport);
              const unr = TEAM_CHAT.unread(team.id, user.id);
              const lastMsg = TEAM_CHAT.messages(team.id).slice(-1)[0];
              const memberCount = team.members;
              return (
                <div key={team.id} onClick={()=>{setSelTeam(team.id); if(isMobile) setShowChat(true);}}
                  style={{padding:"11px 14px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:selTeam===team.id?`${C.purple}15`:C.card,borderLeft:`3px solid ${selTeam===team.id?C.purple:"transparent"}`}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{position:"relative",flexShrink:0}}>
                      <div style={{width:36,height:36,borderRadius:10,background:`${s?.color||C.purple}18`,border:`1px solid ${s?.color||C.purple}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{s ? <SportEmoji sport={s} size={18}/> : team.avatar}</div>
                      {unr>0 && <div style={{position:"absolute",top:-2,right:-2,width:16,height:16,borderRadius:"50%",background:C.purple,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff"}}>{unr}</div>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{fontSize:13,fontWeight:700,color:C.text}}>{team.name}</span>
                        <span style={{fontSize:10,color:C.sub}}>{lastMsg?timeAgo(lastMsg.ts):""}</span>
                      </div>
                      <div style={{fontSize:11,color:unr>0?C.purple:C.sub,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:unr>0?700:400}}>
                        {lastMsg ? (lastMsg.userId===user.id?"Vous : ":lastMsg.from.split(" ")[0]+": ")+lastMsg.text : `${memberCount} membre${memberCount!==1?"s":""}`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DM chat panel ── */}
      {msgTab==="dm" && sel && selOther ? (()=>{
        const selOtherProfile = getProfile(selOther);
        return (
        <div style={{flex:1,display:isMobile&&!showChat?"none":"flex",flexDirection:"column",background:C.bg}}>
          <div style={{padding:"12px 20px",background:C.card,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            {isMobile && <button onClick={()=>setShowChat(false)} style={{background:"none",border:"none",color:C.accent,fontSize:18,cursor:"pointer",padding:"0 6px 0 0",flexShrink:0}}>←</button>}
            <div onClick={()=>openProfile(selOther)} style={{cursor:"pointer",flexShrink:0}}>
              <Avatar name={selOtherProfile.name} size={38} color={C.accent} photo={selOtherProfile.avatar}/>
            </div>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>openProfile(selOther)}>
              <div style={{fontSize:15,fontWeight:700,color:C.text,display:"flex",alignItems:"center",gap:6}}>
                <UserBadge name={selOtherProfile.name} user={selOtherProfile} size="md" showLevel showInsignes/>
                <span style={{fontSize:9,color:C.sub,fontWeight:400,border:`1px solid ${C.border}`,borderRadius:5,padding:"1px 5px"}}>voir profil</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:C.green,boxShadow:`0 0 6px ${C.green}`}}/>
                <span style={{fontSize:11,color:C.sub}}>{t('messages.online')}</span>
              </div>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
            {selConv.length===0 && (
              <div style={{textAlign:"center",color:C.sub,fontSize:13,marginTop:40}}>
                <div style={{fontSize:40,marginBottom:8}}>👋</div>
                {t('messages.start_conv', {name: selOtherProfile.name})}
              </div>
            )}
            {selConv.map(msg=>{
              const isMe=String(msg.from)===String(user.id);
              const fromProfile = isMe ? null : getProfile(msg.from);
              return (
                <div key={msg.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
                  {!isMe && (
                    <div onClick={()=>openProfile(msg.from)} style={{cursor:"pointer",flexShrink:0}}>
                      <Avatar name={fromProfile.name} size={26} color={C.accent} photo={fromProfile.avatar}/>
                    </div>
                  )}
                  <div style={{maxWidth:"68%"}}>
                    <div style={{padding:"10px 14px",borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",background:isMe?C.aLow:C.card,border:`1px solid ${isMe?C.accent+"44":C.border}`,fontSize:13,color:C.text,lineHeight:1.5}}>
                      {msg.text}
                    </div>
                    <div style={{fontSize:9,color:C.sub,marginTop:3,textAlign:isMe?"right":"left"}}>
                      {timeAgo(msg.ts)} {isMe&&(msg.read?"✓✓":"✓")}
                    </div>
                  </div>
                  {isMe && <Avatar name={user.name} size={26} color={C.accent} photo={user.avatar}/>}
                </div>
              );
            })}
            <div ref={msgEndRef}/>
          </div>
          <div style={{padding:"12px 16px",background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"flex-end",flexShrink:0}}>
            <div style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
              <textarea value={newMsg} onChange={e=>setNewMsg(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
                placeholder={t('common.message_to',{name:selOtherProfile.name})} rows={1}
                style={{flex:1,background:"none",border:"none",outline:"none",color:C.text,fontSize:13,fontFamily:C.font,resize:"none",lineHeight:1.4}}/>
            </div>
            <button onClick={send} disabled={!newMsg.trim()}
              style={{width:42,height:42,borderRadius:12,border:"none",cursor:newMsg.trim()?"pointer":"not-allowed",background:newMsg.trim()?C.accent:C.card2,color:newMsg.trim()?"#06090f":C.sub,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              ➤
            </button>
          </div>
        </div>
        );
      })()

      /* ── Team chat panel ── */
      : msgTab==="teams" && selTeam && selTeamObj ? (
        <div style={{flex:1,display:isMobile&&!showChat?"none":"flex",flexDirection:"column",background:C.bg}}>
          {/* Team header */}
          <div style={{padding:"12px 20px",background:C.card,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            {isMobile && <button onClick={()=>setShowChat(false)} style={{background:"none",border:"none",color:C.purple,fontSize:18,cursor:"pointer",padding:"0 6px 0 0",flexShrink:0}}>←</button>}
            <div style={{width:40,height:40,borderRadius:11,background:`${sp(selTeamObj.sport)?.color||C.purple}18`,border:`1px solid ${sp(selTeamObj.sport)?.color||C.purple}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
              {sp(selTeamObj.sport) ? <SportEmoji sport={sp(selTeamObj.sport)} size={20}/> : selTeamObj.avatar}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>{selTeamObj.name}</div>
              <div style={{fontSize:11,color:C.sub,marginTop:1,display:"flex",alignItems:"center",gap:6}}>
                <span style={{background:`${sp(selTeamObj.sport)?.color||C.purple}18`,color:sp(selTeamObj.sport)?.color||C.purple,borderRadius:5,padding:"1px 6px",fontWeight:600,fontSize:10}}>{sp(selTeamObj.sport)?.label||selTeamObj.sport}</span>
                <span>· {selTeamObj.members} membres</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
            {teamMsgs.length===0 && (
              <div style={{textAlign:"center",color:C.sub,fontSize:13,marginTop:40}}>
                <div style={{fontSize:40,marginBottom:8}}>👥</div>
                Soyez le premier à écrire dans ce chat d'équipe !
              </div>
            )}
            {teamMsgs.map(msg=>{
              const isMe = msg.userId===user.id;
              return (
                <div key={msg.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
                  {!isMe && (
                    <div onClick={()=>openProfile(msg.from)} style={{cursor:"pointer",flexShrink:0}}>
                      <Avatar name={msg.from} size={26} color={C.purple}/>
                    </div>
                  )}
                  <div style={{maxWidth:"68%"}}>
                    {!isMe && <div style={{marginBottom:3,paddingLeft:2}}><UserBadge name={msg.from} size="sm" showLevel showInsignes/></div>}
                    <div style={{padding:"10px 14px",borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",background:isMe?`${C.purple}22`:C.card,border:`1px solid ${isMe?(msg.failed?"#ef444455":C.purple+"55"):C.border}`,fontSize:13,color:C.text,lineHeight:1.5,opacity:msg.id.startsWith('tmp_')?0.6:1}}>
                      {msg.text}
                    </div>
                    <div style={{fontSize:9,color:msg.failed?"#ef4444":C.sub,marginTop:3,textAlign:isMe?"right":"left"}}>
                      {msg.failed ? "⚠️ Non envoyé — vérifiez votre connexion" : (msg.id.startsWith('tmp_') ? "Envoi…" : timeAgo(msg.ts))}
                    </div>
                  </div>
                  {isMe && <Avatar name={user.name} size={26} color={C.purple} photo={user.avatar}/>}
                </div>
              );
            })}
            <div ref={teamMsgEndRef}/>
          </div>

          {/* Input */}
          <div style={{padding:"12px 16px",background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"flex-end",flexShrink:0}}>
            <div style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
              <textarea value={teamMsg} onChange={e=>setTeamMsg(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendTeamMsg();}}}
                placeholder={t('common.message_to',{name:selTeamObj.name})} rows={1}
                style={{flex:1,background:"none",border:"none",outline:"none",color:C.text,fontSize:13,fontFamily:C.font,resize:"none",lineHeight:1.4}}/>
            </div>
            <button onClick={sendTeamMsg} disabled={!teamMsg.trim()}
              style={{width:42,height:42,borderRadius:12,border:"none",cursor:teamMsg.trim()?"pointer":"not-allowed",background:teamMsg.trim()?C.purple:C.card2,color:teamMsg.trim()?"#fff":C.sub,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              ➤
            </button>
          </div>
        </div>

      /* ── Empty state ── */
      ) : (
        <div style={{flex:1,display:isMobile&&showChat?"flex":"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:C.sub}}>
          {isMobile && showChat && <button onClick={()=>setShowChat(false)} style={{position:"absolute",top:70,left:16,background:"none",border:"none",color:C.accent,fontSize:18,cursor:"pointer"}}>←</button>}
          <div style={{fontSize:56}}>{msgTab==="teams"?"👥":"💬"}</div>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.text}}>
            {msgTab==="teams" ? t('messages.team_chats') : t('messages.your_messages')}
          </div>
          <div style={{fontSize:13,textAlign:"center",maxWidth:280,lineHeight:1.6,color:C.sub}}>
            {msgTab==="teams"
              ? t('messages.select_team')
              : <>{t('messages.select_conv')}</>
            }
          </div>
        </div>
      )}

      {viewProfile && <UserProfileModal profile={viewProfile} currentUser={user} onClose={()=>setViewProfile(null)}
        onGoToMessages={id=>{ selectConv(CHAT.cid(user.id,id)); setMsgTab("dm"); setViewProfile(null); }}/>}
    </div>
  );
}

// ─── PROFILE VIEW ─────────────────────────────────────────────────────────────
function ProfileView({ user, onLogout, onUpdate, onGoSupport, onGoAdmin, terrains }) {
  const {t, i18n: i18nInst} = useTranslation();
  const [editing,setEditing] = useState(false);
  const [name,setName]       = useState(user.name);
  const [bio,setBio]         = useState(user.bio||"");
  const [level,setLevel]     = useState(user.level||"Amateur");
  const [city,setCity]       = useState(user.city||"");
  const [citySug,setCitySug] = useState([]);
  const fileRef              = useRef();
  useStore(BOOK);
  useStore(MATCH_SCORE);
  useStore(XP_STORE);

  // Real, server-computed progress for the badges that are actually traceable in the DB
  // today (builder: terrains.added_by_user_id, recruiter: users.referral_count). Fetched
  // fresh whenever this view mounts, so adding a terrain shows up on the next visit here
  // without needing an app restart.
  const [realBadges, setRealBadges] = useState(null);
  useEffect(() => {
    fetch(`${API}/api/users/me/badges`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : null)
      .then(setRealBadges)
      .catch(() => {});
  }, [user.id]);

  const onCityInput = v => {
    setCity(v);
    if (v.length < 2) { setCitySug([]); return; }
    const q = v.toLowerCase();
    setCitySug(WORLD_CITIES.filter(c => c.toLowerCase().startsWith(q)).slice(0, 6));
  };
  const pickCity = c => { setCity(c); setCitySug([]); };

  const save = () => { onUpdate({...user, name, bio, level, city}); setEditing(false); setCitySug([]); };
  const toggleProfileSport = id => {
    const cur = user.sports||[];
    onUpdate({...user, sports: cur.includes(id) ? cur.filter(x=>x!==id) : [...cur,id]});
  };
  const handleAvatar = e => {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=ev=>onUpdate({...user,avatar:ev.target.result}); r.readAsDataURL(f);
  };

  return (
    <div style={{flex:1,overflowY:"auto",padding:24}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        {/* Hero */}
        <div style={{background:`linear-gradient(135deg,${C.accent}12,${C.card})`,border:`1px solid ${C.accent}33`,borderRadius:20,padding:22,marginBottom:16}}>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <div style={{position:"relative",cursor:"pointer",flexShrink:0}} onClick={()=>fileRef.current.click()}>
              <Avatar name={user.name} size={70} color={C.accent} photo={user.avatar}/>
              <div style={{position:"absolute",bottom:0,right:0,width:20,height:20,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✏️</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleAvatar}/>
            <div style={{flex:1}}>
              {editing
                ? <input value={name} onChange={e=>setName(e.target.value)} style={{background:C.card2,border:`1px solid ${C.accent}44`,borderRadius:7,padding:"5px 10px",color:C.text,fontSize:18,fontWeight:700,outline:"none",width:"100%",fontFamily:C.head}}/>
                : <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <ColoredName name={user.name} nameColor={user.nameColor} style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.text}}/>
                    {getReferralLevel(user.referralCount||0).badge && (
                      <span title={getReferralLevel(user.referralCount||0).name} style={{fontSize:18,lineHeight:1}}>{getReferralLevel(user.referralCount||0).badge}</span>
                    )}
                    {user.verified&&<span style={{background:"rgba(81,207,102,.15)",color:C.green,border:"1px solid rgba(81,207,102,.4)",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{t('profile.verified')}</span>}
                  </div>
              }
              {editing
                ? <div style={{position:"relative",marginTop:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,background:C.card2,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"5px 10px"}}>
                      <span style={{fontSize:13}}>📍</span>
                      <input value={city} onChange={e=>onCityInput(e.target.value)}
                        placeholder={t('common.your_city_ph')}
                        style={{background:"none",border:"none",outline:"none",color:C.text,fontSize:13,flex:1,fontFamily:C.font,minWidth:0}}/>
                      {city && <button onClick={()=>pickCity("")} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>✕</button>}
                    </div>
                    {citySug.length > 0 && (
                      <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,zIndex:200,boxShadow:"0 8px 24px #0008",overflow:"hidden",marginTop:3}}>
                        {citySug.map(s=>(
                          <button key={s} onClick={()=>pickCity(s)}
                            style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",borderBottom:`1px solid ${C.border}`,padding:"9px 13px",color:C.text,fontSize:13,cursor:"pointer",fontFamily:C.font}}
                            onMouseEnter={e=>e.currentTarget.style.background=C.card}
                            onMouseLeave={e=>e.currentTarget.style.background="none"}>
                            📍 {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                : <div style={{fontSize:12,color:C.sub,marginTop:3}}>📍 {user.city}</div>
              }
              <div style={{display:"flex",gap:6,marginTop:7,flexWrap:"wrap"}}>
                <Badge label={user.level} color={C.accent}/>
                {user.sports?.map(sid=>{const s=SPORTS.find(x=>x.id===sid);return s?<Badge key={sid} label={`${s.emoji} ${s.label}`} color={s.color}/>:null;})}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            {editing
              ? <Btn onClick={save} full={false} style={{flex:1,padding:"9px 12px",fontSize:13}}>{t('profile.save')}</Btn>
              : <Btn onClick={()=>setEditing(true)} variant="ghost" full={false} style={{flex:1,padding:"9px 12px",fontSize:13}}>{t('profile.edit')}</Btn>
            }
            <Btn onClick={onLogout} variant="danger" full={false} style={{flex:1,padding:"9px 12px",fontSize:13}}>{t('profile.logout')}</Btn>
          </div>
          {editing
            ? <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={2} style={{marginTop:12,width:"100%",background:C.card2,border:`1px solid ${C.accent}33`,borderRadius:8,padding:10,color:C.text,fontSize:12,outline:"none",resize:"none",fontFamily:C.font}}/>
            : bio&&<p style={{marginTop:12,fontSize:13,color:C.sub,lineHeight:1.6}}>{bio}</p>
          }
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
          {[["🏟️",t('profile.stats_terrains'),user.terrains||0,C.blue],["VS",t('profile.stats_matchs'),user.matchs||0,C.orange],["👥",t('profile.stats_teams'),user.teams||0,C.purple]].map(([icon,label,val,color])=>(
            <div key={label} style={{background:C.card,border:`1px solid ${color}22`,borderRadius:14,padding:14,textAlign:"center"}}>
              <div style={{fontSize:22,marginBottom:4,display:"flex",justifyContent:"center",alignItems:"center",minHeight:28}}>
                {icon==="VS"
                  ? <span style={{fontFamily:C.head,fontWeight:800,fontSize:15,color:C.orange,background:`${C.orange}18`,border:`2px solid ${C.orange}55`,borderRadius:8,padding:"3px 9px",letterSpacing:2}}>VS</span>
                  : icon}
              </div>
              <div style={{fontFamily:C.head,fontWeight:700,fontSize:26,color}}>{val}</div>
              <div style={{fontSize:11,color:C.sub,marginTop:2}}>{label}</div>
            </div>
          ))}
        </div>

        {/* XP / Niveau */}
        {(() => {
          const liveUser = DB.find(x=>x.id===user.id)||user;
          const xp       = liveUser.xp||0;
          const curLv    = getXpLevel(xp);
          const nextLv   = XP_LEVELS.find(l=>l.xp>xp);
          const progress = nextLv ? Math.round((xp-curLv.xp)/(nextLv.xp-curLv.xp)*100) : 100;
          const lvColor  = curLv.level>=21?"#FFD700":curLv.level>=11?"#CC5DE8":curLv.level>=6?"#4DABF7":"#51CF66";
          return (
            <div style={{background:C.card,border:`1px solid ${lvColor}33`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>⚡ {t('profile.xp_section')}</div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:`${lvColor}18`,border:`2px solid ${lvColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.head,fontWeight:800,fontSize:22,color:lvColor,flexShrink:0}}>
                  {curLv.level}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>{t('profile.level_n',{n:curLv.level})}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:1}}>{t('profile.xp_total',{xp:xp.toLocaleString()})}</div>
                  {nextLv ? (
                    <div style={{marginTop:7}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.sub,marginBottom:3}}>
                        <span>{t('profile.level_next',{level:nextLv.level,xp:nextLv.xp.toLocaleString()})}</span>
                        <span style={{color:lvColor,fontWeight:700}}>{progress}%</span>
                      </div>
                      <div style={{height:6,borderRadius:3,background:C.card2,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,background:lvColor,width:`${progress}%`,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  ) : <div style={{fontSize:11,color:lvColor,fontWeight:700,marginTop:6}}>🏆 {t('profile.max_level')}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,fontSize:11,color:C.sub,flexWrap:"wrap"}}>
                {[["🏟️",t('profile.xp_terrain',{n:XP_REWARDS.terrain})],["🏃",t('profile.xp_visit',{n:XP_REWARDS.visit})],["⚽",t('profile.xp_match',{n:XP_REWARDS.match})],["🤝",t('profile.xp_referral',{n:XP_REWARDS.referral})]].map(([ico,lbl])=>(
                  <span key={lbl} style={{background:C.card2,borderRadius:20,padding:"3px 9px"}}>{ico} {lbl}</span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Insignes */}
        {(() => {
          const liveUser = DB.find(x=>x.id===user.id)||user;
          // builder/recruiter are backed by real server-side counts (terrains.added_by_user_id,
          // users.referral_count) — explorer/competitor have no visit/match log in the DB yet,
          // so they still fall back to the old (always-0) client stat until that's decided.
          const TRACEABLE = { builder: 'builder', recruiter: 'recruiter' };
          const tierFor = (def, val) => { let t=null; for (const x of def.tiers) if (val>=x.min) t=x; return t; };
          const allBadges = BADGE_DEFS.map(def => {
            const traceable = TRACEABLE[def.id] && realBadges;
            const val = traceable ? (realBadges[TRACEABLE[def.id]] ?? 0) : def.stat(liveUser);
            return { def, val, tier: tierFor(def, val), traceable: !!traceable };
          });
          return (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>🎖️ {t('profile.badges_section')}</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {allBadges.map(({def,tier,val,traceable})=>{
                  const next = def.tiers.find(t=>val<t.min);
                  const pct  = tier ? (next ? Math.round((val-tier.min)/(next.min-tier.min)*100) : 100)
                                     : (next ? Math.round(val/next.min*100) : 0);
                  return (
                    <div key={def.id} style={{background:C.card2,borderRadius:12,padding:"11px 13px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                        <div style={{width:38,height:38,borderRadius:10,background:tier?"rgba(255,215,0,.1)":C.card,border:`1px solid ${tier?"rgba(255,215,0,.4)":C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,opacity:tier?1:0.45}}>
                          {def.emoji}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:13,fontWeight:700,color:tier?C.text:C.sub}}>{t(def.nameKey)}</span>
                            {tier && <span style={{fontSize:13}}>{tier.medal}</span>}
                            {!tier && <span style={{fontSize:10,color:C.sub,background:C.card,borderRadius:4,padding:"1px 6px"}}>{t('profile.locked')}</span>}
                          </div>
                          <div style={{fontSize:10,color:C.sub,marginTop:1}}>{t(def.descKey)} · {val}/{(tier?next||def.tiers[def.tiers.length-1]:def.tiers[0]).min}</div>
                        </div>
                      </div>
                      <div style={{height:4,borderRadius:2,background:C.card,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:2,background:tier?"#FFD700":C.accent,width:`${Math.min(100,pct)}%`,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Couleur du pseudo */}
        {(() => {
          const liveUser = DB.find(x=>x.id===user.id)||user;
          const xp       = liveUser.xp||0;
          const curLevel = getXpLevel(xp).level;
          const current  = user.nameColor||null;
          return (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>🎨 {t('profile.color_section')}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {NAME_COLORS.map(nc=>{
                  const locked  = curLevel < nc.minLevel;
                  const active  = current===nc.value||(current===null&&nc.id==="default");
                  const preview = nc.special==="gold" ? "linear-gradient(90deg,#FFD700,#FFA500,#FFD700)" : null;
                  return (
                    <button key={nc.id} onClick={locked?undefined:()=>onUpdate({...user,nameColor:nc.value})}
                      title={locked?t('profile.level_req',{n:nc.minLevel}):t('colors.'+nc.id)}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,cursor:locked?"not-allowed":"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,
                        background:active?`${C.accent}18`:C.card2,
                        border:`1.5px solid ${active?C.accent:C.border}`,
                        opacity:locked?0.38:1,transition:"all .15s",position:"relative"}}>
                      <span style={{width:12,height:12,borderRadius:"50%",display:"inline-block",flexShrink:0,
                        background:nc.special==="gold"?"linear-gradient(135deg,#FFD700,#FFA500)":nc.value||C.text,
                        border:`1px solid rgba(255,255,255,.2)`}}/>
                      <ColoredName name={t('colors.'+nc.id)} nameColor={nc.value}/>
                      {locked && <span style={{position:"absolute",top:-6,right:-4,fontSize:9,background:C.card2,border:`1px solid ${C.border}`,borderRadius:6,padding:"1px 4px",color:C.sub}}>{t('profile.level_short',{n:nc.minLevel})}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Parrainage */}
        {(() => {
          const count    = user.referralCount||0;
          const curLv    = getReferralLevel(count);
          const nextLv   = REFERRAL_LEVELS.find(l=>l.min>count);
          const progress = nextLv ? Math.round((count-curLv.min)/(nextLv.min-curLv.min)*100) : 100;
          const code     = user.referralCode||makeReferralCode(user.name);
          const link     = `https://rvf.vercel.app/?ref=${code}`;
          const [copied,setCopied] = [false,()=>{}];
          const share = () => {
            if (navigator.share) { navigator.share({ title:"RVF", text:t('profile.referral_share_msg'), url:link }).catch(()=>{}); }
            else { navigator.clipboard.writeText(link).catch(()=>{}); }
          };
          return (
            <div style={{background:C.card,border:`1px solid ${curLv.color}44`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>{t('profile.referral_section')}</div>

              {/* Level badge row */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:`${curLv.color}18`,border:`2px solid ${curLv.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
                  {curLv.badge||"🏅"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>
                    {t('profile.referral_level',{level:curLv.level,name:t('profile.ref_level_'+curLv.level)})}
                  </div>
                  <div style={{fontSize:12,color:C.sub,marginTop:2}}>{t('profile.referral_count',{count})}</div>
                  {nextLv ? (
                    <div style={{marginTop:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.sub,marginBottom:4}}>
                        <span>{t('profile.referral_next',{count,min:nextLv.min,badge:nextLv.badge||'',name:t('profile.ref_level_'+nextLv.level)})}</span>
                        <span style={{color:curLv.color,fontWeight:700}}>{progress}%</span>
                      </div>
                      <div style={{height:6,borderRadius:3,background:C.card2,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,background:curLv.color,width:`${progress}%`,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  ) : (
                    <div style={{marginTop:6,fontSize:11,color:curLv.color,fontWeight:700}}>🏆 {t('profile.max_level_alt')}</div>
                  )}
                </div>
              </div>

              {/* Levels legend */}
              <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                {REFERRAL_LEVELS.map(l=>(
                  <div key={l.level} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,background:count>=l.min&&l.badge?`${l.color}18`:C.card2,border:`1px solid ${count>=l.min&&l.badge?l.color+"55":C.border}`,opacity:count>=l.min?1:0.45}}>
                    <span style={{fontSize:12}}>{l.badge||"🌱"}</span>
                    <span style={{fontSize:10,fontWeight:600,color:count>=l.min?l.color:C.sub}}>{t('profile.ref_level_'+l.level)}</span>
                  </div>
                ))}
              </div>

              {/* Share button */}
              <Btn onClick={share} variant="ghost" full style={{fontSize:13,padding:"10px 14px"}}>
                {t('profile.referral_invite_btn')} · <span style={{opacity:.7,fontSize:11,fontFamily:"monospace"}}>{code}</span>
              </Btn>
            </div>
          );
        })()}

        {/* Palmarès */}
        {(() => {
          const rec      = MATCH_SCORE.recordForUser(user.name);
          const bySport  = MATCH_SCORE.recordBySport(user.name);
          const total    = rec.w + rec.l + rec.d;
          const scored   = MATCH_SCORE.forUser(user.name).filter(r=>r.status==="scored");
          if (!scored.length) return null;
          const winPct   = total ? Math.round(rec.w/total*100) : 0;
          const losePct  = total ? Math.round(rec.l/total*100) : 0;
          const sportEntries = Object.entries(bySport);
          return (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:14}}>{t('profile.palmares')}</div>

              {/* W / D / L cards */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[[rec.w,t('profile.wins'),C.green,"🏆"],[rec.d,t('profile.draws'),C.yellow,"🤝"],[rec.l,t('profile.losses'),C.red,"❌"]].map(([val,lbl,col,ico])=>(
                  <div key={lbl} style={{background:C.card2,borderRadius:11,padding:"10px 6px",textAlign:"center",border:`1px solid ${col}22`}}>
                    <div style={{fontSize:16,marginBottom:2}}>{ico}</div>
                    <div style={{fontFamily:C.head,fontWeight:800,fontSize:22,color:col}}>{val}</div>
                    <div style={{fontSize:10,color:C.sub,marginTop:1}}>{lbl}</div>
                  </div>
                ))}
              </div>

              {/* Win-rate bar */}
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:11,color:C.sub}}>{total} {t('profile.matches_played', {count:total})}</span>
                  <span style={{fontSize:12,fontWeight:700,color:winPct>=50?C.green:C.red}}>{winPct}{t('profile.win_pct')}</span>
                </div>
                <div style={{height:8,borderRadius:4,background:C.card2,overflow:"hidden",display:"flex"}}>
                  {rec.w>0&&<div style={{height:"100%",background:C.green,width:`${winPct}%`,transition:"width .6s"}}/>}
                  {rec.d>0&&<div style={{height:"100%",background:C.yellow,width:`${Math.round(rec.d/total*100)}%`,transition:"width .6s"}}/>}
                  {rec.l>0&&<div style={{height:"100%",background:C.red,flex:1,transition:"width .6s"}}/>}
                </div>
              </div>

              {/* By sport */}
              {sportEntries.length > 0 && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {sportEntries.map(([sid,{w,l,d}])=>{
                    const sObj = SPORTS.find(x=>x.id===sid);
                    const tot  = w+l+d;
                    const wp   = tot ? Math.round(w/tot*100) : 0;
                    return (
                      <div key={sid} style={{background:C.card2,borderRadius:10,padding:"9px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <span style={{fontSize:12,color:C.text,fontWeight:600}}>{sObj?.emoji} {sObj?.label}</span>
                          <div style={{display:"flex",gap:10,alignItems:"center"}}>
                            <span style={{fontSize:11,color:C.green,fontWeight:700}}>{w}{t('common.win_abbr')}</span>
                            <span style={{fontSize:11,color:C.yellow,fontWeight:700}}>{d}{t('common.draw_abbr')}</span>
                            <span style={{fontSize:11,color:C.red,fontWeight:700}}>{l}{t('common.loss_abbr')}</span>
                            <span style={{fontSize:10,color:C.sub}}>({wp}%)</span>
                          </div>
                        </div>
                        <div style={{height:5,borderRadius:3,background:C.card,overflow:"hidden",display:"flex"}}>
                          {w>0&&<div style={{height:"100%",background:C.green,width:`${wp}%`}}/>}
                          {d>0&&<div style={{height:"100%",background:C.yellow,width:`${Math.round(d/tot*100)}%`}}/>}
                          {l>0&&<div style={{height:"100%",background:C.red,flex:1}}/>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Historique des scores */}
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{t('profile.history_section')}</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {scored.slice().reverse().map(r=>{
                    const res = MATCH_SCORE._result(r, user.name);
                    const sObj= SPORTS.find(x=>x.id===r.terrainSport);
                    const col = res==="w"?C.green:res==="l"?C.red:C.yellow;
                    const lbl = res==="w"?"V":res==="l"?"D":"N";
                    return (
                      <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,background:C.card2,borderRadius:9,padding:"8px 12px",borderLeft:`4px solid ${col}`}}>
                        <div style={{width:22,height:22,borderRadius:6,background:`${col}20`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.head,fontWeight:800,fontSize:11,color:col,flexShrink:0}}>{lbl}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sObj?.emoji} {r.terrainName}</div>
                          <div style={{fontSize:10,color:C.sub}}>📅 {r.day} · ⏰ {r.hour}</div>
                        </div>
                        <div style={{fontFamily:C.head,fontWeight:800,fontSize:15,color:col,flexShrink:0}}>{r.score}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Terrains visités */}
        {(() => {
          const visited = [...new Set(BOOK.forUser(user.name).map(b=>b.terrainId))];
          const vTerrains = terrains.filter(t=>visited.includes(t.id));
          if (!vTerrains.length) return null;
          const allSports = [...new Set(vTerrains.map(t=>t.sport))];
          const ratios = allSports.map(sid=>{
            const s=SPORTS.find(x=>x.id===sid);
            const total=terrains.filter(t=>t.sport===sid).length;
            const cnt=vTerrains.filter(t=>t.sport===sid).length;
            return { sid, label:s?.label, emoji:s?.emoji, color:s?.color, cnt, total, pct:Math.round(cnt/total*100) };
          });
          return (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5}}>{t('profile.visited_terrains')}</div>
                <span style={{fontSize:12,color:C.accent,fontWeight:700}}>{vTerrains.length} {t('profile.fields_visited', {count:vTerrains.length})}</span>
              </div>

              {/* Ratio par sport */}
              <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:16}}>
                {ratios.map(r=>(
                  <div key={r.sid}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:12,color:C.text,fontWeight:600}}>{r.emoji} {r.label}</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:11,color:r.color,fontWeight:700}}>{r.cnt}/{r.total}</span>
                        <span style={{fontSize:10,color:C.sub}}>{r.pct}%</span>
                      </div>
                    </div>
                    <div style={{height:5,borderRadius:3,background:C.card2,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:3,background:r.color,width:`${r.pct}%`,transition:"width .6s ease"}}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cards terrains */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {vTerrains.map(ter=>{
                  const s=SPORTS.find(x=>x.id===ter.sport);
                  const bookings=BOOK.forUser(user.name).filter(b=>b.terrainId===ter.id);
                  return (
                    <div key={ter.id} style={{background:C.card2,borderRadius:12,border:`1px solid ${C.border}`,borderLeft:`4px solid ${s?.color}`,padding:"11px 13px",display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:40,height:40,borderRadius:10,background:`${s?.color}18`,border:`2px solid ${s?.color}35`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>
                        {s?.id==="padel"?<PadelRacket size={18} color={s.color}/>:s?.emoji}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ter.name}</div>
                        <div style={{fontSize:11,color:C.sub,marginTop:2}}>📍 {ter.city} · {ter.surface}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:12,color:C.yellow,fontWeight:700}}>{ter.rating>0?`⭐ ${ter.rating}`:"🆕"}</div>
                        <div style={{fontSize:10,color:C.sub,marginTop:2}}>{bookings.length} {t('profile.sessions', {count:bookings.length})}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Mes sports */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>🏅 {t('profile.my_sports')}</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {SPORTS.map(s=>{
              const active=(user.sports||[]).includes(s.id);
              return (
                <button key={s.id} onClick={()=>toggleProfileSport(s.id)}
                  style={{padding:"7px 12px",borderRadius:9,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,
                    background:active?`${s.color}20`:C.card2,
                    border:`1px solid ${active?s.color:C.border}`,
                    color:active?s.color:C.sub,
                    display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}>
                  <SportEmoji sport={s} size={13}/> {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Language selector */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>🌐 {t('profile.language_title')}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
            {['fr','en','es','pt','ar','zh','hi','de','it','ru','ja','ko'].map(lng=>(
              <button key={lng} onClick={()=>i18nInst.changeLanguage(lng)}
                style={{padding:"7px 10px",borderRadius:9,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,
                  background:i18nInst.language===lng?C.aLow:C.card2,
                  border:`1.5px solid ${i18nInst.language===lng?C.accent:C.border}`,
                  color:i18nInst.language===lng?C.accent:C.sub,textAlign:"left",
                  direction:"ltr"}}>
                {t(`lang_names.${lng}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Support & Sécurité */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>🛡️ {t('profile.support_title')}</div>
          <button onClick={onGoSupport}
            style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",fontFamily:C.font}}>
            <span style={{fontSize:20}}>🛡️</span>
            <div style={{flex:1,textAlign:"left"}}>
              <div style={{fontWeight:700,color:C.text,fontSize:13}}>{t('profile.support_title')}</div>
              <div style={{fontSize:11,color:C.sub,marginTop:2}}>{t('profile.support_sub')}</div>
            </div>
            <span style={{color:C.sub,fontSize:16}}>›</span>
          </button>
          {user.role === "admin" && (
            <button onClick={onGoAdmin}
              style={{width:"100%",background:`${C.accent}10`,border:`1px solid ${C.accent}33`,borderRadius:10,padding:"11px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",fontFamily:C.font,marginTop:8}}>
              <span style={{fontSize:20}}>⚙️</span>
              <div style={{flex:1,textAlign:"left"}}>
                <div style={{fontWeight:700,color:C.accent,fontSize:13}}>{t('profile.admin_title')}</div>
                <div style={{fontSize:11,color:C.sub,marginTop:2}}>{t('profile.admin_sub')}</div>
              </div>
              <span style={{color:C.accent,fontSize:16}}>›</span>
            </button>
          )}
        </div>

        {editing && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14}}>
            <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>{t('auth.level')}</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {LEVELS.map((l,i)=><Chip key={l} active={level===l} onClick={()=>setLevel(l)} color={C.purple}>{t('levels.'+LEVEL_KEYS[i])}</Chip>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUPPORT VIEW ─────────────────────────────────────────────────────────────
function SupportView({ user, onBack }) {
  const {t} = useTranslation();
  const [phase, setPhase] = useState("menu"); // "menu" | "bug" | "hack" | "maintenance"
  const [desc,  setDesc]  = useState("");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [err,     setErr]     = useState("");
  const [maintenance, setMaintenance] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/maintenance`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMaintenance(d); })
      .catch(() => {});
  }, []);

  const submit = async () => {
    if (!desc.trim() || desc.trim().length < 10) { setErr(t('support.err_min')); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch(`${API}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ type: phase, description: desc.trim() }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) { setSent(true); setDesc(""); }
      else { const d = await res.json(); setErr(d.error || t('support.err_send')); }
    } catch { setErr(t('support.err_server')); }
    finally { setSending(false); }
  };

  const backBtn = (
    <button onClick={() => { setPhase("menu"); setSent(false); setErr(""); setDesc(""); }}
      style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.sub,fontSize:13,cursor:"pointer",fontFamily:C.font,marginBottom:20,padding:0}}>
      {t('common.back')}
    </button>
  );

  if (phase === "maintenance") {
    const active = maintenance?.active;
    return (
      <div style={{flex:1,overflowY:"auto",padding:24}}>
        <div style={{maxWidth:500,margin:"0 auto"}}>
          {backBtn}
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.text,marginBottom:20}}>🔧 {t('support.maintenance_title')}</div>
          {active
            ? <div style={{background:`${C.orange}18`,border:`1px solid ${C.orange}44`,borderRadius:14,padding:20}}>
                <div style={{fontWeight:700,color:C.orange,fontSize:15,marginBottom:8}}>{t('support.maintenance_active_label')}</div>
                <div style={{color:C.text,fontSize:14,lineHeight:1.6}}>{maintenance.message || t('support.maintenance_msg_default')}</div>
              </div>
            : <div style={{background:C.card,border:`1px solid ${C.green}33`,borderRadius:14,padding:20,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:10}}>✅</div>
                <div style={{color:C.green,fontWeight:700,fontSize:15}}>{t('support.no_maintenance')}</div>
                <div style={{color:C.sub,fontSize:12,marginTop:6}}>{t('support.services_ok')}</div>
              </div>
          }
        </div>
      </div>
    );
  }

  if (phase === "bug" || phase === "hack") {
    const isHack = phase === "hack";
    const color  = isHack ? C.red : C.blue;
    return (
      <div style={{flex:1,overflowY:"auto",padding:24}}>
        <div style={{maxWidth:500,margin:"0 auto"}}>
          {backBtn}
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:20,color:C.text,marginBottom:6}}>
            {isHack ? `🔴 ${t('support.hack_title')}` : `🐛 ${t('support.bug_title')}`}
          </div>
          <div style={{fontSize:13,color:C.sub,marginBottom:20,lineHeight:1.5}}>
            {isHack ? t('support.hack_desc') : t('support.bug_desc')}
          </div>
          {sent
            ? <div style={{background:`${C.green}15`,border:`1px solid ${C.green}44`,borderRadius:14,padding:20,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:10}}>✅</div>
                <div style={{color:C.green,fontWeight:700,fontSize:15}}>{t('support.sent_title')}</div>
                <div style={{color:C.sub,fontSize:12,marginTop:6}}>{t('support.sent_sub')}</div>
                <button onClick={()=>setSent(false)}
                  style={{marginTop:14,background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 18px",color:C.text,fontSize:12,cursor:"pointer",fontFamily:C.font}}>
                  {t('common.send_another_report')}
                </button>
              </div>
            : <>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={6}
                  placeholder={isHack ? t('support.hack_placeholder') : t('support.bug_placeholder')}
                  style={{width:"100%",background:C.card2,border:`1.5px solid ${err?C.red:C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:13,fontFamily:C.font,outline:"none",resize:"vertical",lineHeight:1.6,marginBottom:12}}/>
                {err && <ErrBox msg={err}/>}
                <Btn onClick={submit} loading={sending} style={{background:color}}>
                  {isHack ? `🔴 ${t('support.hack_btn')}` : `🐛 ${t('support.bug_btn')}`}
                </Btn>
              </>
          }
        </div>
      </div>
    );
  }

  return (
    <div style={{flex:1,overflowY:"auto",padding:24}}>
      <div style={{maxWidth:500,margin:"0 auto"}}>
        <button onClick={onBack}
          style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.sub,fontSize:13,cursor:"pointer",fontFamily:C.font,marginBottom:20,padding:0}}>
          {t('support.back_profile')}
        </button>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:24,color:C.text,marginBottom:6}}>🛡️ {t('profile.support_title')}</div>
        <div style={{fontSize:13,color:C.sub,marginBottom:24}}>{t('support.main_sub')}</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            { key:"bug",         icon:"🐛", title:t('support.bug_card_title'),  desc:t('support.bug_card_sub'),    color:C.blue   },
            { key:"hack",        icon:"🔴", title:t('support.hack_card_title'), desc:t('support.hack_card_sub'),   color:C.red    },
            { key:"maintenance", icon:"🔧", title:t('support.maintenance_card_title'), desc:maintenance?.active?t('support.maint_active_badge'):t('support.no_maintenance_short'), color:C.orange },
          ].map(card => (
            <button key={card.key} onClick={()=>setPhase(card.key)}
              style={{background:C.card,border:`1px solid ${card.color}28`,borderRadius:14,padding:"14px 16px",textAlign:"left",cursor:"pointer",display:"flex",gap:14,alignItems:"center",fontFamily:C.font,width:"100%"}}>
              <span style={{fontSize:26,flexShrink:0}}>{card.icon}</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:C.text,fontSize:14}}>{card.title}</div>
                <div style={{fontSize:12,color:C.sub,marginTop:3}}>{card.desc}</div>
              </div>
              <span style={{color:C.sub,fontSize:18,flexShrink:0}}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ────────────────────────────────────────────────────────────────
function AdminView({ onBack, onMaintenanceChange, terrains: appTerrains, onDeleteTerrain }) {
  const {t} = useTranslation();
  const [tab,         setTab]        = useState("stats");
  const [loading,     setLoading]    = useState(true);
  const [users,       setUsers]      = useState([]);
  const [terrains,    setTerrains]   = useState([]);
  const [reports,     setReports]    = useState([]);
  const [maintActive, setMaintActive]= useState(false);
  const [maintMsg,    setMaintMsg]   = useState("");
  const [maintSaved,  setMaintSaved] = useState(false);
  const [userSearch,  setUserSearch] = useState("");
  const [terrainSearch,setTerrainSearch]= useState("");
  const [actionMsg,   setActionMsg]  = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/admin/users`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
        .then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${API}/api/terrains`, { signal: AbortSignal.timeout(5000) })
        .then(r=>r.ok?r.json():null).then(d=>d?.terrains).catch(()=>null),
      fetch(`${API}/api/admin/reports`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
        .then(r=>r.ok?r.json():null).catch(()=>null),
      fetch(`${API}/api/maintenance`, { signal: AbortSignal.timeout(3000) })
        .then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([u, t, rData, mData]) => {
      setUsers(u);
      setTerrains(t?.length ? t : appTerrains||[]);
      if (rData?.reports) setReports(rData.reports);
      if (mData) { setMaintActive(mData.active); setMaintMsg(mData.message||""); }
      setLoading(false);
    });
  }, []);

  const flash = msg => { setActionMsg(msg); setTimeout(()=>setActionMsg(""), 2500); };

  const toggleBlock = async u => {
    const newBlocked = !u.blocked;
    try {
      const res = await fetch(`${API}/api/admin/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ email: u.email, blocked: newBlocked }),
      });
      if (!res.ok) throw new Error();
      setUsers(prev => prev.map(x => x.id===u.id ? {...x, blocked: newBlocked} : x));
      flash(newBlocked ? `🚫 ${u.name} bloqué` : `✅ ${u.name} débloqué`);
    } catch { flash("❌ Erreur serveur"); }
  };

  const deleteTerrain = async t => {
    try {
      const res = await fetch(`${API}/api/terrains/${t.id}`, { method: 'DELETE', headers: authHeader() });
      if (!res.ok) throw new Error();
      setTerrains(prev => prev.filter(x=>x.id!==t.id));
      if (onDeleteTerrain) onDeleteTerrain(t.id);
      flash(`🗑️ Terrain "${t.name}" supprimé`);
    } catch { flash("❌ Erreur suppression"); }
  };

  const updateStatus = (id, status) => {
    setReports(prev => prev.map(r => r.id===id ? {...r,status} : r));
    fetch(`${API}/api/admin/reports/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json",...authHeader()},
      body: JSON.stringify({status}),
    }).catch(()=>{});
  };

  const saveMaintenance = async () => {
    const res = await fetch(`${API}/api/admin/maintenance`, {
      method:"PUT", headers:{"Content-Type":"application/json",...authHeader()},
      body: JSON.stringify({active:maintActive, message:maintMsg}),
    }).catch(()=>null);
    if (res?.ok) {
      onMaintenanceChange(maintActive ? maintMsg : null);
      setMaintSaved(true); setTimeout(()=>setMaintSaved(false), 2000);
    }
  };

  const STATUS_LABELS = { new:"🔵 Nouveau", in_progress:"🟡 En cours", resolved:"✅ Résolu" };
  const STATUS_COLORS = { new:C.blue, in_progress:C.orange, resolved:C.green };

  const stats = [
    ["👤", t('profile.stats_users')||"Utilisateurs", users.length,          C.blue],
    ["🏟️", t('profile.stats_terrains'), terrains.length,        C.accent],
    ["⚽", t('profile.stats_matchs'),   PAST_MATCHES.length,    C.orange],
    ["👥", t('nav.teams'),              TEAMS_DATA.length,      C.purple],
    ["🚫", t('common.blocked_badge'),   users.filter(u=>u.blocked).length, C.red],
    ["🔴", t('invites.title'),          reports.filter(r=>r.status==="new").length, C.yellow],
  ];

  const filteredUsers    = users.filter(u=>{
    const n = (u.username||u.name||"").toLowerCase();
    const e = (u.email||"").toLowerCase();
    const q = userSearch.toLowerCase();
    return !q || n.includes(q) || e.includes(q);
  });
  const filteredTerrains = terrains.filter(t =>
    !terrainSearch || (t.name||"").toLowerCase().includes(terrainSearch.toLowerCase()) || (t.city||"").toLowerCase().includes(terrainSearch.toLowerCase())
  );

  const tabs = [
    { id:"stats",       label:"📊 Stats"     },
    { id:"users",       label:`👤 ${t('profile.stats_users')||"Utilisateurs"}`, count: users.filter(u=>u.blocked).length||0 },
    { id:"terrains",    label:`🏟️ ${t('profile.stats_terrains')}` },
    { id:"reports",     label:`📋 ${t('invites.title')}`, count: reports.filter(r=>r.status==="new").length },
    { id:"maintenance", label:`🔧 ${t('common.maintenance_mode')}` },
  ];

  return (
    <div style={{flex:1,overflowY:"auto",padding:24}}>
      <div style={{maxWidth:700,margin:"0 auto"}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.sub,fontSize:13,cursor:"pointer",fontFamily:C.font,marginBottom:16,padding:0}}>
          {t('support.back_profile')}
        </button>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.accent,marginBottom:4}}>⚙️ {t('profile.admin_panel')}</div>
        {actionMsg && <div style={{background:`${C.green}18`,border:`1px solid ${C.green}44`,borderRadius:8,padding:"8px 14px",fontSize:13,color:C.green,fontWeight:600,marginBottom:12}}>{actionMsg}</div>}

        {/* Tabs */}
        <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:2}}>
          {tabs.map(tb=>(
            <button key={tb.id} onClick={()=>setTab(tb.id)}
              style={{flexShrink:0,padding:"8px 12px",borderRadius:10,border:`1px solid ${tab===tb.id?C.accent+"55":C.border}`,background:tab===tb.id?C.aLow:C.card,color:tab===tb.id?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,whiteSpace:"nowrap",position:"relative"}}>
              {tb.label}
              {tb.count>0&&<span style={{marginLeft:4,background:C.red,color:"#fff",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:800}}>{tb.count}</span>}
            </button>
          ))}
        </div>

        {loading && <div style={{color:C.sub,textAlign:"center",padding:40,fontSize:14}}>{t('common.loading')}</div>}

        {/* ── STATS ── */}
        {!loading && tab==="stats" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
              {stats.map(([icon,label,val,color])=>(
                <div key={label} style={{background:C.card,border:`1px solid ${color}22`,borderRadius:14,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
                  <div style={{fontFamily:C.head,fontWeight:800,fontSize:28,color}}>{val}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:2}}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16}}>
              <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>{t('teams.role_dist')}</div>
              {[["admin","Admin 👑",C.yellow],["user",t('profile.admin_users'),C.accent],["blocked",t('profile.admin_blocked'),C.red]].map(([role,label,color])=>{
                const count = role==="blocked" ? users.filter(u=>u.blocked).length : users.filter(u=>u.role===role).length;
                const pct   = users.length ? Math.round(count/users.length*100) : 0;
                return (
                  <div key={role} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                      <span style={{color}}>{label}</span>
                      <span style={{color:C.sub,fontWeight:700}}>{count} ({pct}%)</span>
                    </div>
                    <div style={{height:6,borderRadius:3,background:C.card2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width .5s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── UTILISATEURS ── */}
        {!loading && tab==="users" && (
          <div>
            <div style={{position:"relative",marginBottom:12}}>
              <input value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder={t('common.search_by_email')}
                style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px 9px 38px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}/>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",opacity:.4}}>🔍</span>
            </div>
            <div style={{fontSize:11,color:C.sub,marginBottom:8,fontWeight:700}}>{filteredUsers.length} {t('profile.stats_users')}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredUsers.map(u=>{
                const name  = u.username || u.name || "?";
                const isAdm = u.role==="admin";
                const isBlk = !!u.blocked;
                return (
                  <div key={u.id} style={{background:C.card,border:`1px solid ${isBlk?C.red+"33":isAdm?C.yellow+"33":C.border}`,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <Avatar name={name} size={36} color={isAdm?C.yellow:isBlk?C.red:C.accent}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:700,color:isBlk?C.red:C.text}}>{name}</span>
                        {isAdm && <span style={{fontSize:9,background:`${C.yellow}20`,color:C.yellow,border:`1px solid ${C.yellow}44`,borderRadius:4,padding:"1px 6px",fontWeight:700}}>👑 {t('common.admin_badge')}</span>}
                        {isBlk && <span style={{fontSize:9,background:`${C.red}20`,color:C.red,border:`1px solid ${C.red}44`,borderRadius:4,padding:"1px 6px",fontWeight:700}}>🚫 {t('common.blocked')}</span>}
                      </div>
                      <div style={{fontSize:11,color:C.sub,marginTop:2}}>{u.email||"—"} · {u.city||"?"}</div>
                      <div style={{fontSize:10,color:C.sub,marginTop:1}}>XP: {u.xp||0} · Terrains: {u.terrains_count||0} · Matchs: {u.matchs_count||0}</div>
                    </div>
                    {!isAdm && (
                      <button onClick={()=>toggleBlock(u)}
                        style={{flexShrink:0,padding:"6px 12px",borderRadius:8,border:`1px solid ${isBlk?C.green+"55":C.red+"55"}`,background:isBlk?`${C.green}12`:`${C.red}12`,color:isBlk?C.green:C.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                        {isBlk?`✅ ${t('common.unblock')}`:`🚫 ${t('common.block')}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TERRAINS ── */}
        {!loading && tab==="terrains" && (
          <div>
            <div style={{position:"relative",marginBottom:12}}>
              <input value={terrainSearch} onChange={e=>setTerrainSearch(e.target.value)} placeholder={t('common.search_by_name')}
                style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 12px 9px 38px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}/>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",opacity:.4}}>🔍</span>
            </div>
            <div style={{fontSize:11,color:C.sub,marginBottom:8,fontWeight:700}}>{filteredTerrains.length} terrain{filteredTerrains.length!==1?"s":""}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filteredTerrains.map(tr=>{
                const s = SPORTS.find(x=>x.id===tr.sport);
                return (
                  <div key={tr.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:38,height:38,borderRadius:10,background:`${s?.color||C.accent}18`,border:`1px solid ${s?.color||C.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                      {s ? <SportEmoji sport={s} size={18}/> : "🏟️"}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.text}}>{tr.name}</div>
                      <div style={{fontSize:11,color:C.sub,marginTop:1}}>📍 {tr.city}, {tr.country} · {tr.surface} · {tr.price}</div>
                      {(tr.added_by||tr.addedBy) && <div style={{fontSize:10,color:C.sub,marginTop:1}}>{t('common.added_by')} : {tr.added_by||tr.addedBy}</div>}
                    </div>
                    <button onClick={()=>{ if(window.confirm(`${t('terrain.confirm_delete')} "${tr.name}"`)) deleteTerrain(tr); }}
                      style={{flexShrink:0,padding:"6px 11px",borderRadius:8,border:`1px solid ${C.red}44`,background:`${C.red}12`,color:C.red,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SIGNALEMENTS ── */}
        {!loading && tab==="reports" && (
          reports.length===0
            ? <div style={{color:C.sub,textAlign:"center",padding:40}}>{t('support.no_reports')}</div>
            : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {reports.map(r=>(
                  <div key={r.id} style={{background:C.card,border:`1px solid ${STATUS_COLORS[r.status]||C.border}22`,borderRadius:12,padding:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
                      <div>
                        <span style={{fontSize:10,fontWeight:700,color:r.type==="hack"?C.red:C.blue,background:r.type==="hack"?`${C.red}18`:`${C.blue}18`,padding:"2px 8px",borderRadius:6,marginRight:8}}>
                          {r.type==="hack"?"🔴 HACK":"🐛 BUG"}
                        </span>
                        <span style={{fontSize:11,color:C.sub}}>{r.user_name}</span>
                      </div>
                      <span style={{fontSize:10,color:C.sub,flexShrink:0}}>{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:10}}>{r.description}</div>
                    <select value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}
                      style={{background:C.card2,border:`1px solid ${STATUS_COLORS[r.status]||C.border}55`,borderRadius:8,padding:"5px 10px",color:STATUS_COLORS[r.status]||C.text,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,outline:"none"}}>
                      {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
        )}

        {/* ── MAINTENANCE ── */}
        {!loading && tab==="maintenance" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>{t('common.maintenance_mode')}</div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <button onClick={()=>setMaintActive(p=>!p)}
                style={{width:46,height:26,borderRadius:13,border:"none",cursor:"pointer",background:maintActive?C.orange:C.card2,transition:"background .2s",flexShrink:0,position:"relative"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,transition:"left .2s",left:maintActive?23:3}}/>
              </button>
              <span style={{fontSize:13,fontWeight:600,color:maintActive?C.orange:C.sub}}>
                {maintActive?`🔧 ${t('common.maintenance_active')}`:`✅ ${t('common.services_normal')}`}
              </span>
            </div>
            <textarea value={maintMsg} onChange={e=>setMaintMsg(e.target.value)} rows={3}
              placeholder={t('terrain.maint_msg_ph')}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:13,fontFamily:C.font,outline:"none",resize:"vertical",marginBottom:12}}/>
            <Btn onClick={saveMaintenance} style={{background:maintActive?C.orange:C.accent}}>
              {maintSaved?`✅ ${t('terrain.saved_slots')}`:`${t('common.save')}`}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INVITATIONS PANEL ────────────────────────────────────────────────────────
function InvitesPanel({ user, onClose }) {
  const {t} = useTranslation();
  useStore(INV);
  useStore(TEAM_REQ);
  useStore(MATCH_SCORE);
  useStore(MATCH_REQ);
  const [tab,setTab]         = useState("friend");
  const [scoreInputs,setScoreInputs] = useState({});
  const invites         = INV.forUser(user?.name||"");
  const teamReqs        = TEAM_REQ.reqsForCaptain(user?.id||"");
  const allTeamReqs     = TEAM_REQ.list.filter(r=>r.captainId===user?.id);
  const scoreReqs       = MATCH_SCORE.forUser(user?.name||"");
  const friendChallenges = MATCH_REQ.friendChallengesFor(user?.id||"");
  const sp = id => SPORTS.find(s=>s.id===id);
  const stCol = s => s==="accepted"?C.green:s==="declined"||s==="rejected"?C.red:C.yellow;
  const matchPending  = INV.pending(user.name) + friendChallenges.length;
  const teamPending   = teamReqs.length;
  const scorePending  = MATCH_SCORE.pendingForUser(user?.name||"");

  // Real friend requests received, backed by the friendships table.
  const [friendReqs, setFriendReqs] = useState([]);
  const fetchFriendReqs = useCallback(() => {
    fetch(`${API}/api/friends/requests`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then(setFriendReqs)
      .catch(() => {});
  }, []);
  useEffect(() => { fetchFriendReqs(); }, [fetchFriendReqs]);
  const friendPending = friendReqs.length;

  const setScore = (id, field, val) => setScoreInputs(p=>({...p,[id]:{...(p[id]||{a:"",b:""}), [field]:val}}));
  const submitScore = req => {
    const inp = scoreInputs[req.id]||{a:"",b:""};
    const a = parseInt(inp.a||"0",10), b = parseInt(inp.b||"0",10);
    if (isNaN(a)||isNaN(b)) return;
    MATCH_SCORE.submit(req.id, `${a} - ${b}`, user.name);
    addXP(user.id, XP_REWARDS.match);
    setScoreInputs(p=>({...p,[req.id]:undefined}));
  };

  const acceptFriendReq = async req => {
    try {
      const res = await fetch(`${API}/api/friends/requests/${req.id}/accept`, { method:'POST', headers: authHeader() });
      if (res.ok) setFriendReqs(p=>p.filter(r=>r.id!==req.id));
    } catch {}
  };
  const declineFriendReq = async req => {
    try {
      const res = await fetch(`${API}/api/friends/requests/${req.id}/decline`, { method:'POST', headers: authHeader() });
      if (res.ok) setFriendReqs(p=>p.filter(r=>r.id!==req.id));
    } catch {}
  };

  const acceptTeamReq = req => {
    TEAM_REQ.respond(req.id,"accepted");
    const u = DB.find(u=>u.id===req.fromUserId);
    if (!ROSTER[req.teamId]) ROSTER[req.teamId]=[];
    if (!ROSTER[req.teamId].find(m=>m.id===req.fromUserId))
      ROSTER[req.teamId].push({ id:req.fromUserId, name:req.fromName, city:u?.city||"", level:u?.level||"Amateur" });
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:460,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>🤝 {t('invites.notifications_title')}</div>
          <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.sub,fontSize:18}}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",background:C.card2,margin:"12px 16px 0",borderRadius:10,padding:3,gap:2,flexShrink:0}}>
          {[["friend",`👤 ${t('social.tab_friends')}`,friendPending,C.accent],["match",`🤝 ${t('teams.tab_matches')}`,matchPending,C.accent],["team",`👥 ${t('teams.tab_teams')}`,teamPending,C.accent],["score",`⚽ ${t('invites.tab_scores')}`,scorePending,C.orange]].map(([tabId,label,cnt,col])=>(
            <button key={tabId} onClick={()=>setTab(tabId)}
              style={{flex:1,padding:"7px 0",border:"none",borderRadius:8,background:tab===tabId?col:"transparent",color:tab===tabId?"#06090f":C.sub,fontFamily:C.font,fontSize:10,fontWeight:700,cursor:"pointer",transition:"all .2s",position:"relative"}}>
              {label}
              {cnt>0&&<span style={{marginLeft:3,background:tab===tabId?"#06090f22":col,color:tab===tabId?"#06090f":C.bg,borderRadius:8,padding:"1px 5px",fontSize:9,fontWeight:800}}>{cnt}</span>}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}}>
          {tab==="friend" && (
            friendReqs.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>👤</div>{t('invites.no_friend_req')}</div>
              : friendReqs.map(req=>{
                  const fromUser = DB.find(u=>u.id===req.from_user_id);
                  return (
                    <div key={req.id} style={{background:C.card2,border:`1px solid ${C.accent}44`,borderRadius:14,padding:14}}>
                      <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
                        <Avatar name={req.name} size={44} color={C.accent} photo={fromUser?.avatar}/>
                        <div style={{flex:1,minWidth:0}}>
                          <UserBadge name={req.name} size="sm" showLevel showInsignes/>
                          {req.city&&<div style={{fontSize:11,color:C.sub,marginTop:1}}>📍 {req.city}</div>}
                          <div style={{fontSize:10,color:C.sub,marginTop:4}}>{timeAgo(req.created_at)}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>acceptFriendReq(req)} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ {t('common.accept')}</button>
                        <button onClick={()=>declineFriendReq(req)} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ {t('common.decline')}</button>
                      </div>
                    </div>
                  );
                })
          )}

          {tab==="match" && (
            invites.length===0 && friendChallenges.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>🤝</div>{t('invites.no_match_inv')}</div>
              : <>
                  {friendChallenges.map(r=>{
                    const fromUser = DB.find(u=>u.id===r.fromUserId);
                    const s = SPORTS.find(x=>x.id===r.sport);
                    return (
                      <div key={r.id} style={{background:C.card2,border:`1px solid ${C.orange}44`,borderRadius:14,padding:14}}>
                        <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
                          <Avatar name={r.fromUserName} size={42} color={C.orange} photo={fromUser?.avatar}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:3}}>⚔️ {t('invites.friend_challenge')}</div>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><UserBadge name={r.fromUserName} size="sm" showLevel showInsignes/><span style={{fontSize:12,color:C.sub,fontWeight:400}}>{t('invites.challenges_from')}</span></div>
                            {s&&<div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}><SportEmoji sport={s} size={13}/><span style={{fontSize:12,color:s.color,fontWeight:700}}>{s.label}</span></div>}
                            {r.terrainName&&<div style={{fontSize:12,fontWeight:700,color:C.text,marginTop:2}}>🏟️ {r.terrainName}{r.terrainCity?<span style={{color:C.accent,fontWeight:400}}> · {r.terrainCity}</span>:""}</div>}
                            <div style={{fontSize:12,color:C.sub,marginTop:1}}>📅 {r.day} · {r.hour}</div>
                            {r.message&&<div style={{fontSize:12,color:C.text,marginTop:6,background:C.card,borderRadius:8,padding:"6px 10px",fontStyle:"italic"}}>"{r.message}"</div>}
                            <div style={{fontSize:10,color:C.sub,marginTop:4}}>{timeAgo(r.ts)}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>MATCH_REQ.respond(r.id,"accepted")} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ {t('common.accept')}</button>
                          <button onClick={()=>MATCH_REQ.respond(r.id,"declined")} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ {t('common.decline')}</button>
                        </div>
                      </div>
                    );
                  })}
                  {invites.map(inv=>{
                    const s=sp(inv.sport), isPending=inv.status==="pending";
                    const invTerrain = inv.terrainId ? terrains.find(t=>t.id===inv.terrainId) : null;
                    return (
                      <div key={inv.id} style={{background:C.card2,border:`1px solid ${isPending?s?.color+"44":C.border}`,borderRadius:14,padding:14}}>
                        <div style={{display:"flex",gap:12,marginBottom:10}}>
                          <div style={{flexShrink:0,display:"flex",alignItems:"center"}}><SportEmoji sport={s} size={26}/></div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{inv.from} <span style={{color:C.sub,fontWeight:400}}>t'invite</span></div>
                            <div style={{fontSize:14,fontWeight:700,color:s?.color,marginTop:2}}>{inv.terrainName}</div>
                            {invTerrain?.city&&<div style={{fontSize:11,color:C.accent,fontWeight:600,marginTop:1}}>📍 {invTerrain.city}</div>}
                            <div style={{fontSize:12,color:C.sub,marginTop:2}}>📅 {inv.day} · {inv.hour}</div>
                            {inv.note&&<div style={{fontSize:12,color:C.text,marginTop:6,background:C.card,borderRadius:8,padding:"6px 10px",fontStyle:"italic"}}>"{inv.note}"</div>}
                            <div style={{fontSize:10,color:C.sub,marginTop:4}}>{timeAgo(inv.ts)}</div>
                          </div>
                        </div>
                        {isPending ? (
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>INV.respond(inv.id,"accepted")} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ {t('common.accept')}</button>
                            <button onClick={()=>INV.respond(inv.id,"declined")} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ {t('common.decline')}</button>
                          </div>
                        ) : (
                          <div style={{textAlign:"center",padding:"5px",borderRadius:8,background:inv.status==="accepted"?"rgba(81,207,102,.1)":"rgba(255,107,107,.08)"}}>
                            <span style={{fontSize:12,fontWeight:700,color:stCol(inv.status)}}>{inv.status==="accepted"?`✅ ${t('invites.accepted_label')}`:`❌ ${t('invites.declined_label')}`}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
          )}

          {tab==="team" && (
            allTeamReqs.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>👥</div>{t('teams.no_requests')}</div>
              : allTeamReqs.map(req=>{
                  const fromUser = DB.find(u=>u.id===req.fromUserId);
                  const isPending = req.status==="pending";
                  return (
                    <div key={req.id} style={{background:C.card2,border:`1px solid ${isPending?C.accent+"44":C.border}`,borderRadius:14,padding:14}}>
                      <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
                        <Avatar name={req.fromName} size={40} color={C.accent} photo={fromUser?.avatar}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><UserBadge name={req.fromName} size="sm" showLevel showInsignes/><span style={{fontSize:12,color:C.sub,fontWeight:400}}>{t('invites.wants_to_join')}</span></div>
                          <div style={{fontSize:13,fontWeight:700,color:C.accent,marginTop:1}}>{req.teamName}</div>
                          {req.note&&<div style={{fontSize:12,color:C.text,marginTop:5,background:C.card,borderRadius:8,padding:"6px 10px",fontStyle:"italic"}}>"{req.note}"</div>}
                          <div style={{fontSize:10,color:C.sub,marginTop:4}}>{timeAgo(req.ts)}</div>
                        </div>
                      </div>
                      {isPending ? (
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>acceptTeamReq(req)} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ {t('common.accept')}</button>
                          <button onClick={()=>TEAM_REQ.respond(req.id,"rejected")} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ {t('common.decline')}</button>
                        </div>
                      ) : (
                        <div style={{textAlign:"center",padding:"6px",borderRadius:8,background:req.status==="accepted"?"rgba(81,207,102,.1)":"rgba(255,107,107,.08)"}}>
                          <span style={{fontSize:12,fontWeight:700,color:stCol(req.status)}}>{req.status==="accepted"?`✅ ${t('invites.accepted_label')}`:`❌ ${t('invites.declined_label')}`}</span>
                        </div>
                      )}
                    </div>
                  );
                })
          )}

          {tab==="score" && (
            scoreReqs.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>⚽</div>{t('invites.no_score')}</div>
              : scoreReqs.map(req=>{
                  const sObj = sp(req.terrainSport);
                  const inp  = scoreInputs[req.id]||{a:"",b:""};
                  const isScored = req.status==="scored";
                  const halfCount = Math.ceil(req.participants.length/2);
                  const teamA = req.participants.slice(0,halfCount);
                  const teamB = req.participants.slice(halfCount);
                  return (
                    <div key={req.id} style={{background:C.card2,border:`2px solid ${isScored?C.green+"44":C.orange+"55"}`,borderRadius:16,padding:14}}>
                      {/* Header */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <SportEmoji sport={sObj} size={20}/>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{req.terrainName}</div>
                            <div style={{fontSize:11,color:C.sub}}>📅 {req.day} · ⏰ {req.hour}</div>
                          </div>
                        </div>
                        <span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:8,background:isScored?`${C.green}18`:`${C.orange}18`,border:`1px solid ${isScored?C.green+"44":C.orange+"44"}`,color:isScored?C.green:C.orange}}>
                          {isScored?`✅ ${t('invites.scored_badge')}`:`⏳ ${t('common.pending')}`}
                        </span>
                      </div>

                      {/* Teams */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,background:C.card,borderRadius:12,padding:"10px 12px"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:9,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{t('invites.team_a')}</div>
                          {teamA.map(n=><div key={n} style={{fontSize:11,color:n===user.name?C.accent:C.text,fontWeight:n===user.name?700:400}}>
                            {n===user.name?"👤 ":""}{n}
                          </div>)}
                        </div>
                        <div style={{fontFamily:C.head,fontWeight:800,fontSize:isScored?22:16,color:isScored?C.green:C.orange,background:isScored?`${C.green}15`:`${C.orange}15`,border:`2px solid ${isScored?C.green+"44":C.orange+"33"}`,borderRadius:10,padding:"6px 12px",textAlign:"center",minWidth:60}}>
                          {isScored ? req.score : "VS"}
                        </div>
                        <div style={{flex:1,textAlign:"right"}}>
                          <div style={{fontSize:9,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{t('invites.team_b')}</div>
                          {teamB.length>0 ? teamB.map(n=><div key={n} style={{fontSize:11,color:n===user.name?C.accent:C.text,fontWeight:n===user.name?700:400}}>
                            {n===user.name?"👤 ":""}{n}
                          </div>) : <div style={{fontSize:11,color:C.sub,fontStyle:"italic"}}>{t('common.solo')}</div>}
                        </div>
                      </div>

                      {/* Score entry or result */}
                      {isScored ? (
                        <div style={{textAlign:"center",fontSize:12,color:C.green,fontWeight:600}}>
                          {t('invites.declared_by',{name:req.reportedBy})} · {timeAgo(req.ts)}
                        </div>
                      ) : (
                        <>
                          <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:8}}>🏆 {t('invites.score_header')}</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                            <div style={{flex:1,textAlign:"center"}}>
                              <div style={{fontSize:10,color:C.sub,marginBottom:4}}>{t('invites.team_a')}</div>
                              <input type="number" min="0" max="99" value={inp.a} onChange={e=>setScore(req.id,"a",e.target.value)}
                                style={{width:"100%",background:C.card,border:`2px solid ${C.orange}55`,borderRadius:10,padding:"10px 0",color:C.text,fontSize:22,fontWeight:800,fontFamily:C.head,textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
                            </div>
                            <div style={{fontFamily:C.head,fontWeight:800,fontSize:18,color:C.orange,flexShrink:0}}>–</div>
                            <div style={{flex:1,textAlign:"center"}}>
                              <div style={{fontSize:10,color:C.sub,marginBottom:4}}>{t('invites.team_b')}</div>
                              <input type="number" min="0" max="99" value={inp.b} onChange={e=>setScore(req.id,"b",e.target.value)}
                                style={{width:"100%",background:C.card,border:`2px solid ${C.orange}55`,borderRadius:10,padding:"10px 0",color:C.text,fontSize:22,fontWeight:800,fontFamily:C.head,textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
                            </div>
                          </div>
                          <button onClick={()=>submitScore(req)}
                            disabled={inp.a===""||inp.b===""}
                            style={{width:"100%",padding:"12px",borderRadius:11,background:inp.a!==""&&inp.b!==""?C.orange:"#333",border:"none",color:inp.a!==""&&inp.b!==""?"#06090f":C.sub,fontFamily:C.font,fontSize:14,fontWeight:800,cursor:inp.a!==""&&inp.b!==""?"pointer":"not-allowed",boxShadow:inp.a!==""&&inp.b!==""?`0 4px 16px ${C.orange}55`:"none"}}>
                            🏆 {t('invites.submit_score')}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── INVITE BELL (badge) ──────────────────────────────────────────────────────
function InviteBell({ user, onClick }) {
  useStore(INV);
  useStore(TEAM_REQ);
  useStore(MATCH_SCORE);
  useStore(MATCH_REQ);
  const [friendPending, setFriendPending] = useState(0);
  useEffect(() => {
    fetch(`${API}/api/friends/requests`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then(list => setFriendPending(list.length))
      .catch(() => {});
  }, [user.id]);
  const count = INV.pending(user.name) + TEAM_REQ.pendingForCaptain(user.id) + friendPending + MATCH_SCORE.pendingForUser(user.name) + MATCH_REQ.friendChallengesFor(user.id).length;
  return (
    <div style={{position:"relative",cursor:"pointer"}} onClick={onClick}>
      <div style={{width:34,height:34,borderRadius:10,background:C.card2,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤝</div>
      {count>0 && <div style={{position:"absolute",top:-4,right:-4,width:16,height:16,borderRadius:"50%",background:C.accent,color:"#06090f",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{count}</div>}
    </div>
  );
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{width:"1em",height:"1em",verticalAlign:"-0.1em",display:"inline-block"}}>
      {/* Bulle de chat */}
      <path d="M7 2 L21 2 Q26 2 26 7 L26 17 Q26 22 21 22 L15 22 L12 26.5 L12 22 L7 22 Q2 22 2 17 L2 7 Q2 2 7 2Z"
        fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      {/* Ligne texte 1 */}
      <rect x="7" y="8" width="14" height="2.3" rx="1.1" fill="currentColor" fillOpacity="0.4"/>
      {/* Ligne texte 2 */}
      <rect x="7" y="12.8" width="10" height="2.3" rx="1.1" fill="currentColor" fillOpacity="0.3"/>
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{width:"1em",height:"1em",verticalAlign:"-0.1em",display:"inline-block"}}>
      {/* Corps — même perso bleu que FriendsIcon, centré */}
      <path d="M7.5 27 C7.5 22 10.5 19 14 19 C17.5 19 20.5 22 20.5 27Z"
        fill="#29b6f6" stroke="#0277bd" strokeWidth="2" strokeLinejoin="round"/>
      {/* Tête */}
      <circle cx="14" cy="12" r="5.5" fill="#e1f5fe" stroke="#0277bd" strokeWidth="2"/>
      {/* Cheveux */}
      <path d="M8.5 9.5 C8.5 6 11 3.5 14 3.5 C17 3.5 19.5 6 19.5 9.5"
        fill="#5d4037" stroke="#3e2723" strokeWidth="1.2"/>
      {/* Yeux */}
      <circle cx="12.3" cy="11.5" r="0.95" fill="#0277bd"/>
      <circle cx="15.7" cy="11.5" r="0.95" fill="#0277bd"/>
      {/* Sourire */}
      <path d="M11.7 14 Q14 16.2 16.3 14" stroke="#01579b" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      {/* Reflet */}
      <ellipse cx="12" cy="8.5" rx="2.2" ry="1.3" transform="rotate(-20 12 8.5)" fill="rgba(255,255,255,0.42)"/>
    </svg>
  );
}

function JerseyIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{width:"1em",height:"1em",verticalAlign:"-0.1em",display:"inline-block"}}>
      {/* Corps du maillot + manches */}
      <path d="M9 6 L4 8 L2 11.5 L4 14.5 L8.5 13 L8.5 25 L19.5 25 L19.5 13 L24 14.5 L26 11.5 L24 8 L19 6 Q16.5 9.5 14 10.5 Q11.5 9.5 9 6Z"
        fill="#1565c0" stroke="#0d47a1" strokeWidth="2" strokeLinejoin="round"/>
      {/* Épaule gauche */}
      <path d="M4 8 L8.5 7.5 L8.5 13 L4 14.5Z"
        fill="#1976d2" stroke="#0d47a1" strokeWidth="1"/>
      {/* Épaule droite */}
      <path d="M24 8 L19.5 7.5 L19.5 13 L24 14.5Z"
        fill="#1976d2" stroke="#0d47a1" strokeWidth="1"/>
      {/* Col V */}
      <path d="M9.5 6.5 Q12 9.5 14 10.5 Q16 9.5 18.5 6.5"
        stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      {/* Bande horizontale blanche 1 */}
      <rect x="8.5" y="14.5" width="11" height="2.8" rx="1.2" fill="white" fillOpacity="0.28"/>
      {/* Bande horizontale blanche 2 */}
      <rect x="8.5" y="19" width="11" height="2.8" rx="1.2" fill="white" fillOpacity="0.28"/>
      {/* Numéro 10 — stylisé */}
      <text x="14" y="22.5" textAnchor="middle" fontSize="5.5" fontWeight="800"
        fill="white" fillOpacity="0.85" fontFamily="Arial,sans-serif">10</text>
      {/* Reflet brillant épaule gauche */}
      <ellipse cx="6.5" cy="10" rx="2.8" ry="1.4" transform="rotate(-20 6.5 10)" fill="rgba(255,255,255,0.38)"/>
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{width:"1em",height:"1em",verticalAlign:"-0.1em",display:"inline-block"}}>
      {/* Personne 2 — derrière, droite */}
      <path d="M13 27 C13 22 16 19 19.5 19 C23 19 26 22 26 27Z"
        fill="#ffa726" stroke="#e65100" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="19.5" cy="12" r="5.5" fill="#ffe0b2" stroke="#e65100" strokeWidth="2"/>
      <path d="M14 9.5 C14 6 16.5 3.5 19.5 3.5 C22.5 3.5 25 6 25 9.5"
        fill="#f57c00" stroke="#e65100" strokeWidth="1.2"/>
      <circle cx="17.8" cy="11.5" r="0.95" fill="#5d4037"/>
      <circle cx="21.2" cy="11.5" r="0.95" fill="#5d4037"/>
      <path d="M17.2 14 Q19.5 16.2 21.8 14" stroke="#bf360c" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      <ellipse cx="17" cy="8.5" rx="2.2" ry="1.3" transform="rotate(-20 17 8.5)" fill="rgba(255,255,255,0.42)"/>
      {/* Personne 1 — devant, gauche */}
      <path d="M2 27 C2 22 5 19 8.5 19 C12 19 15 22 15 27Z"
        fill="#29b6f6" stroke="#0277bd" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="8.5" cy="12" r="5.5" fill="#e1f5fe" stroke="#0277bd" strokeWidth="2"/>
      <path d="M3 9.5 C3 6 5.5 3.5 8.5 3.5 C11.5 3.5 14 6 14 9.5"
        fill="#5d4037" stroke="#3e2723" strokeWidth="1.2"/>
      <circle cx="6.8" cy="11.5" r="0.95" fill="#0277bd"/>
      <circle cx="10.2" cy="11.5" r="0.95" fill="#0277bd"/>
      <path d="M6.2 14 Q8.5 16.2 10.8 14" stroke="#01579b" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
      <ellipse cx="6.5" cy="8.5" rx="2.2" ry="1.3" transform="rotate(-20 6.5 8.5)" fill="rgba(255,255,255,0.42)"/>
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{width:"1em",height:"1em",verticalAlign:"-0.1em",display:"inline-block"}}>
      <defs>
        <clipPath id="rvf-globe-clip">
          <circle cx="14" cy="14" r="11.5"/>
        </clipPath>
      </defs>
      {/* Océan */}
      <circle cx="14" cy="14" r="11.5" fill="#29b6f6"/>
      <g clipPath="url(#rvf-globe-clip)">
        {/* Grille latitude/longitude */}
        <ellipse cx="14" cy="14" rx="11.5" ry="3.8" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9"/>
        <path d="M14 2.5 C11 8 11 20 14 25.5" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" fill="none"/>
        <path d="M3.5 8.5 Q14 6.5 24.5 8.5" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" fill="none"/>
        <path d="M3.5 19.5 Q14 21.5 24.5 19.5" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" fill="none"/>
        {/* Amérique du Nord */}
        <path d="M9.5 6.5 C11.5 6 13 7.5 12.5 10 C12 12 10.5 13.5 9 13 C7.5 12.5 7 10.5 7 9 C7 7 8.5 6.5 9.5 6.5Z"
          fill="#66bb6a" stroke="#2e7d32" strokeWidth="1" strokeLinejoin="round"/>
        {/* Amérique du Sud */}
        <path d="M10 15 C12 15.5 12.5 17.5 12 19.5 C11.5 21.5 10 23 8.5 22.5 C7 21.5 7 19 7.5 17 C8 15.5 9 14.5 10 15Z"
          fill="#66bb6a" stroke="#2e7d32" strokeWidth="1" strokeLinejoin="round"/>
        {/* Europe */}
        <path d="M14.5 7.5 C16 6.5 17.5 7.5 17 9 C16 10 14.5 9.5 14.5 7.5Z"
          fill="#66bb6a" stroke="#2e7d32" strokeWidth="0.9"/>
        {/* Afrique */}
        <path d="M16 9.5 C18.5 10 20 12 19.5 15 C19 18 19 20 17.5 21.5 C16 22.5 15 21 15 18.5 C14.5 17 15 15 14.5 13 C14 11 14.5 9 16 9.5Z"
          fill="#66bb6a" stroke="#2e7d32" strokeWidth="1" strokeLinejoin="round"/>
        {/* Reflet brillant */}
        <ellipse cx="10" cy="9" rx="3.5" ry="2.2" transform="rotate(-30 10 9)" fill="rgba(255,255,255,0.45)"/>
      </g>
      {/* Contour globe */}
      <circle cx="14" cy="14" r="11.5" stroke="currentColor" strokeWidth="2.2"/>
    </svg>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const {t, i18n: i18nApp} = useTranslation();
  const [screen,setScreen]     = useState("landing");
  const [user,setUser]         = useState(null);
  const [view,setView]         = useState("map");
  const [selTerrain,setTerrain] = useState(null);
  const handleSelectTerrain = useCallback(t => { setTerrain(t); setView("terrain"); }, []);
  const [terrains,setTerrains] = useState([]);
  const [clusters,setClusters] = useState([]);
  const terrainsCacheRef = useRef(new Map());
  const terrainsAbortRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [showInvites,setShowInvites]       = useState(false);
  const [openMsgWith,setOpenMsgWith]       = useState(null);
  const [maintenanceBanner,setMaintenanceBanner] = useState(null);
  const [userPos,setUserPos]   = useState(null);
  const [gpsError,setGpsError] = useState(null); // null | 1=denied | 2=unavailable | 3=timeout | 4=http
  const [gpsLoading,setGpsLoading] = useState(false);
  const isMobile = useIsMobile();

  // Auto-login via the homemade JWT
  useEffect(()=>{
    const token = localStorage.getItem('rvf_token');
    if (!token) return;
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) { setUser(d.user); setScreen('app'); } })
      .catch(() => {});
  },[]);

  // Keep the DM unread badge fresh even before the user opens the Messages view
  useEffect(()=>{ if (user?.id) CHAT.loadConversations(user.id); },[user?.id]);

  // Preload registered Express/Postgres users into DB so friend search, badges and friend
  // lists can resolve them (DB has no built-in demo accounts — only real registered users)
  useEffect(()=>{
    if (!user?.id) return;
    fetch(`${API}/api/users`, { headers: authHeader(), signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        list.forEach(p => {
          const existing = DB.find(u => String(u.id)===String(p.id));
          if (existing) {
            existing.city = p.city||"";
            existing.xp = p.xp||0;
            existing.nameColor = p.name_color||null;
            existing.referralCount = p.referral_count||0;
          } else {
            DB.push({ id:p.id, name:p.name, city:p.city||"", level:"Amateur", sports:[], bio:"", avatar:null, verified:false,
              xp:p.xp||0, nameColor:p.name_color||null, referralCount:p.referral_count||0 });
          }
        });
        PROFILES_STORE.notify();
      })
      .catch(()=>{});
  },[user?.id]);

  // Load terrains for the map's current viewport (bbox+zoom), cached by rounded bbox+zoom.
  // zoom < 12 -> lightweight cluster dots; zoom >= 12 -> individual terrains.
  const loadTerrainsForViewport = useCallback(({ bbox, zoom }) => {
    const precision = zoom < 6 ? 0 : zoom < 10 ? 1 : zoom < 14 ? 2 : zoom < 17 ? 3 : zoom < 20 ? 4 : 5;
    const f = 10 ** precision;
    const round = n => Math.round(n * f) / f;
    const rBbox = bbox.map(round);
    // Filet de sécurité : ne jamais envoyer une bbox nulle même si l'arrondi dégénère
    if (rBbox[0] >= rBbox[2]) { rBbox[0] -= 10**-precision; rBbox[2] += 10**-precision; }
    if (rBbox[1] >= rBbox[3]) { rBbox[1] -= 10**-precision; rBbox[3] += 10**-precision; }
    const cacheKey = `${zoom}:${rBbox.join(',')}`;

    const applyResult = d => {
      if (d?.mode === 'clusters') { setClusters(d.clusters || []); setTerrains([]); }
      else if (d?.mode === 'terrains') { setTerrains(d.terrains || []); setClusters([]); }
    };

    const cached = terrainsCacheRef.current.get(cacheKey);
    if (cached) { applyResult(cached); return; }

    terrainsAbortRef.current?.abort();
    const controller = new AbortController();
    terrainsAbortRef.current = controller;

    fetch(`${API}/api/terrains?bbox=${rBbox.join(',')}&zoom=${zoom}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { terrainsCacheRef.current.set(cacheKey, d); applyResult(d); } })
      .catch(e => { if (e.name !== 'AbortError') console.warn('[RVF] terrains load error:', e.message); });
  }, []);
  // Load teams from the Express backend — exposed so TeamsView can refresh after
  // creating a team or accepting an invitation, without a full reload.
  const fetchTeams = useCallback(() => {
    // authHeader() lets the backend compute isMember/isCaptain for the current user;
    // without it every team looks like "not mine" regardless of real membership.
    fetch(`${API}/api/teams`, { headers: authHeader(), signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTeams(d); })
      .catch(() => {});
  }, []);
  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  // Maintenance banner (shown globally when active)
  useEffect(()=>{
    fetch(`${API}/api/maintenance`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.active) setMaintenanceBanner(d.message || "Maintenance en cours."); })
      .catch(() => {});
  },[]);

  const requestGps = useCallback(async (highAccuracy=true) => {
    if (GPS_NEEDS_HTTPS) { setGpsError(4); return; }
    setGpsError(null);
    setGpsLoading(true);

    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === "denied") { setGpsLoading(false); setGpsError(1); return; }
        const p = await Geolocation.getCurrentPosition({
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 20000 : 10000,
        });
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setUserPos(pos);
        setGpsError(null);
        setGpsLoading(false);
        setTerrains(prev=>[...prev].sort((a,b)=>
          haversine(pos.lat,pos.lng,a.lat,a.lng)-haversine(pos.lat,pos.lng,b.lat,b.lng)
        ));
      } catch(e) {
        setGpsLoading(false);
        if (e.code===3 && highAccuracy) requestGps(false);
        else setGpsError(e.code ?? 3);
      }
      return;
    }

    if (!navigator.geolocation) { setGpsLoading(false); setGpsError(2); return; }
    navigator.geolocation.getCurrentPosition(
      p=>{
        const pos={lat:p.coords.latitude,lng:p.coords.longitude};
        setUserPos(pos);
        setGpsError(null);
        setGpsLoading(false);
        setTerrains(prev=>[...prev].sort((a,b)=>
          haversine(pos.lat,pos.lng,a.lat,a.lng)-haversine(pos.lat,pos.lng,b.lat,b.lng)
        ));
      },
      e=>{
        setGpsLoading(false);
        // On timeout, retry with low accuracy (faster fix)
        if (e.code===3 && highAccuracy) requestGps(false);
        else setGpsError(e.code);
      },
      {timeout: highAccuracy ? 20000 : 10000, enableHighAccuracy: highAccuracy, maximumAge:60000}
    );
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  // Géolocalisation → tri par proximité
  useEffect(()=>{
    if (GPS_NEEDS_HTTPS) { setGpsError(4); return; }
    if (Capacitor.isNativePlatform()) { requestGps(); return; }
    if (!navigator.geolocation) { setGpsError(2); return; }
    if (navigator.permissions) {
      navigator.permissions.query({name:"geolocation"}).then(result=>{
        if (result.state==="granted" || result.state==="prompt") requestGps();
        else setGpsError(1);
        result.onchange = () => { if (result.state==="granted") requestGps(); else if (result.state==="denied") setGpsError(1); };
      }).catch(()=>requestGps());
    } else {
      requestGps();
    }
  },[requestGps]);

  // Unread msg count for badge
  useStore(CHAT);
  useStore(TEAM_CHAT);

  const doLogin    = u => { setUser(u); setScreen("app"); };
  const doRegister = u => { setUser(u); setScreen("welcome"); };
  const doLogout = () => {
    localStorage.removeItem('rvf_token');
    setUser(null); setScreen('landing'); setView('map');
  };

  const doUpdate = u => {
    setUser(u);
    const dbU = DB.find(x=>x.id===u.id);
    if (dbU) { dbU.nameColor=u.nameColor; if(u.xp!==undefined) dbU.xp=u.xp; if(u.city!==undefined) dbU.city=u.city; }
    PROFILES_STORE.notify();
    // Save via Express backend if token present
    const token = localStorage.getItem('rvf_token');
    if (!token) return;
    fetch(`${API}/api/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(u),
    }).catch(() => {});
  };

  const addTerrain = async t => {
    if (user?.id) addXP(user.id, XP_REWARDS.terrain);
    // Path 1 — Express backend (works when user has rvf_token OR backend accepts optionalAuth)
    try {
      const res = await fetch(`${API}/api/terrains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ ...t, addedBy: t.addedBy || user?.name }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.terrain) { setTerrains(p => [...p, d.terrain]); return 'express'; }
      }
      const errBody = await res.json().catch(() => ({}));
      console.warn('[RVF] Express insert:', res.status, errBody?.error);
    } catch (e) {
      console.warn('[RVF] Express insert network error:', e.message);
    }

    // Path 2 — offline only (lost on refresh, user sees a toast warning)
    setTerrains(p => [...p, t]);
    return 'offline';
  };

  const deleteTerrain = async id => {
    setTerrains(prev => prev.filter(t => t.id !== id));
    try { await fetch(`${API}/api/terrains/${id}`, { method: 'DELETE', headers: authHeader() }); } catch {}
  };

  const updateTerrainPhone = async (terrainId, phone) => {
    setTerrains(prev => prev.map(t => t.id===terrainId ? {...t, phone} : t));
    setTerrain(prev => prev?.id===terrainId ? {...prev, phone} : prev);
    try {
      await fetch(`${API}/api/terrains/${terrainId}/phone`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ phone }),
      });
    } catch {}
  };

  const goToMessages = name => { setOpenMsgWith(name); setView("messages"); setTerrain(null); };

  const isRTL = i18nApp.language === 'ar';
  const NAV = [
    { id:"map",      icon:<GlobeIcon/>, label:t('nav.map') },
    { id:"teams",    icon:<JerseyIcon/>, label:t('nav.teams') },
    { id:"messages", icon:<MessageIcon/>, label:t('nav.messages') },
    { id:"social",   icon:<FriendsIcon/>, label:t('nav.social') },
    { id:"profile",  icon:<ProfileIcon/>, label:t('nav.profile') },
  ];

  return (
    <div dir={isRTL?"rtl":"ltr"} style={{height:"100%",display:"flex",flexDirection:"column",background:C.bg,color:C.text,fontFamily:C.font}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1a2a3d; border-radius:2px; }
        input::placeholder, textarea::placeholder { color:#3d5066; }
        button:focus { outline:none; }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 4px rgba(0,229,160,.35),0 0 20px rgba(0,229,160,.6)} 50%{box-shadow:0 0 0 10px rgba(0,229,160,.1),0 0 30px rgba(0,229,160,.9)} }
        @keyframes rvfRainbow{0%{color:#ff0000}16%{color:#ff8800}33%{color:#ffee00}50%{color:#00cc44}66%{color:#0088ff}83%{color:#9900ff}100%{color:#ff0000}}
        .rvf-rainbow{animation:rvfRainbow 3s linear infinite}
        .leaflet-popup-content-wrapper{background:#0d1421;color:#e9ecef;border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.85);padding:0}
        .leaflet-popup-content{margin:0;font-family:'DM Sans',sans-serif}
        .leaflet-popup-tip{background:#0d1421}
        .leaflet-popup-close-button{color:#5c7080 !important;font-size:18px !important;top:6px !important;right:8px !important}
        .leaflet-popup-close-button:hover{color:#e9ecef !important}
        .leaflet-container{background:#06090f}
        .leaflet-control-attribution{background:rgba(6,9,15,.8) !important;color:#5c7080 !important;border-radius:6px 0 0 0}
        .leaflet-control-attribution a{color:#00e5a0 !important}
        .leaflet-bar{border:1px solid rgba(255,255,255,.1) !important;border-radius:10px !important;overflow:hidden}
        .leaflet-bar a{background:#0d1421 !important;color:#e9ecef !important;border-bottom:1px solid rgba(255,255,255,.07) !important}
        .leaflet-bar a:hover{background:#131e30 !important}
      `}</style>

      {/* Status bar spacer (encoche / Dynamic Island) */}
      <div style={{height:"env(safe-area-inset-top)",background:C.card,flexShrink:0}}/>

      {/* TOP BAR */}
      <div style={{height:52,background:C.card,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",flexShrink:0,zIndex:100}}>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,letterSpacing:1,cursor:"pointer"}} onClick={()=>{if(screen==="app"){setView("map");setTerrain(null);}}}>
          <span style={{color:C.accent}}>R</span><span style={{color:C.text}}>VF</span>
        </div>

        {screen==="app" && (
          <>
            {!isMobile && (
              <div style={{display:"flex",gap:3}}>
                {NAV.map(n=>{
                  const userTeamIds = user ? teams.filter(t=>t.isMember).map(t=>t.id) : [];
                  const unread = n.id==="messages"&&user ? CHAT.totalUnread()+TEAM_CHAT.totalUnread(user.id,userTeamIds) : 0;
                  return (
                    <button key={n.id} onClick={()=>{setView(n.id);setTerrain(null);}}
                      style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,padding:"5px 14px",borderRadius:9,cursor:"pointer",position:"relative",background:view===n.id?C.aLow:"transparent",border:`1px solid ${view===n.id?C.accent+"44":"transparent"}`,color:view===n.id?C.accent:C.sub,fontSize:9,fontWeight:700,letterSpacing:1,fontFamily:C.font}}>
                      <span style={{fontSize:16,position:"relative"}}>
                        {n.icon}
                        {unread>0 && <span style={{position:"absolute",top:-4,right:-6,width:14,height:14,borderRadius:"50%",background:C.accent,color:"#06090f",fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}
                      </span>
                      {n.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {user && <InviteBell user={user} onClick={()=>setShowInvites(true)}/>}
              <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setView("profile")}>
                <Avatar name={user?.name||"?"} size={30} color={C.accent} photo={user?.avatar}/>
                {!isMobile && <span style={{fontSize:12,fontWeight:600,color:C.text}}>{user?.name?.split(" ")[0]}</span>}
              </div>
            </div>
          </>
        )}

        {screen==="landing" && (
          <div style={{display:"flex",gap:7}}>
            <Btn onClick={()=>setScreen("login")}    variant="ghost" full={false} style={{padding:"6px 14px",fontSize:12}}>{t('auth.login_btn')}</Btn>
            <Btn onClick={()=>setScreen("register")} variant="solid" full={false} style={{padding:"6px 14px",fontSize:12}}>{t('auth.register_btn')}</Btn>
          </div>
        )}
      </div>

      {/* Maintenance banner */}
      {maintenanceBanner && (
        <div style={{background:`${C.orange}18`,borderBottom:`1px solid ${C.orange}44`,padding:"8px 16px",textAlign:"center",fontSize:12,color:C.orange,fontWeight:600,flexShrink:0}}>
          🔧 {maintenanceBanner}
        </div>
      )}

      {/* CONTENT */}
      <div style={{flex:1,display:"flex",overflow:"hidden",paddingBottom:isMobile&&screen==="app"?"calc(56px + env(safe-area-inset-bottom))":0}}>
        {screen==="landing"  && <Landing goLogin={()=>setScreen("login")} goRegister={()=>setScreen("register")}/>}
        {screen==="login"    && <LoginScreen onSuccess={doLogin} goBack={()=>setScreen("landing")}/>}
        {screen==="register" && <RegisterScreen onSuccess={doRegister} goBack={()=>setScreen("landing")}/>}
        {screen==="welcome"  && <WelcomeScreen user={user} onEnter={()=>setScreen("app")}/>}

        {screen==="app" && view==="map"      && !selTerrain && <MapView onSelect={handleSelectTerrain} terrains={terrains} clusters={clusters} onViewportChange={loadTerrainsForViewport} user={user} onAddTerrain={addTerrain} userPos={userPos} gpsError={gpsError} gpsLoading={gpsLoading} onRequestGps={requestGps}/>}
        {screen==="app" && view==="terrain"  && selTerrain  && <div style={{flex:1,overflowY:"auto"}}><TerrainDetail terrain={selTerrain} onBack={()=>{setView("map");setTerrain(null);}} user={user} onUpdatePhone={updateTerrainPhone} onDelete={deleteTerrain}/></div>}
        {screen==="app" && view==="teams"    && <TeamsView user={user} terrains={terrains} onGoToMessages={goToMessages} teams={teams} refreshTeams={fetchTeams}/>}
        {screen==="app" && view==="messages" && <MessagingView user={user} openWith={openMsgWith}/>}
        {screen==="app" && view==="social"   && <SocialView user={user} terrains={terrains} onGoToMessages={goToMessages}/>}
        {screen==="app" && view==="profile"  && <ProfileView user={user} onLogout={doLogout} onUpdate={doUpdate} onGoSupport={()=>setView("support")} onGoAdmin={()=>setView("admin")} terrains={terrains}/>}
        {screen==="app" && view==="support"  && <SupportView user={user} onBack={()=>setView("profile")}/>}
        {screen==="app" && view==="admin" && user?.role==="admin" && <AdminView onBack={()=>setView("profile")} onMaintenanceChange={msg=>setMaintenanceBanner(msg)} terrains={terrains} onDeleteTerrain={deleteTerrain}/>}

        {showInvites && user && <InvitesPanel user={user} onClose={()=>setShowInvites(false)}/>}
      </div>

      {/* Bottom nav mobile */}
      {isMobile && screen==="app" && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:"calc(56px + env(safe-area-inset-bottom))",background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:200,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {NAV.map(n=>{
            const userTeamIds = user ? teams.filter(t=>t.isMember).map(t=>t.id) : [];
            const unread = n.id==="messages"&&user ? CHAT.totalUnread()+TEAM_CHAT.totalUnread(user.id,userTeamIds) : 0;
            const active = view===n.id;
            return (
              <button key={n.id} onClick={()=>{setView(n.id);setTerrain(null);}}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,border:"none",background:"transparent",color:active?C.accent:C.sub,fontFamily:C.font,fontSize:9,fontWeight:700,letterSpacing:1,cursor:"pointer",position:"relative"}}>
                <span style={{fontSize:20,position:"relative",lineHeight:1}}>
                  {n.icon}
                  {unread>0&&<span style={{position:"absolute",top:-3,right:-8,width:14,height:14,borderRadius:"50%",background:C.accent,color:"#06090f",fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}
                </span>
                {n.label}
                {active&&<div style={{position:"absolute",bottom:0,left:"20%",right:"20%",height:2,background:C.accent,borderRadius:2}}/>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
