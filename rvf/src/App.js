import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "./supabaseClient";

// Backend API base URL — set VITE_API_URL in .env for production
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function authHeader() {
  const t = localStorage.getItem('rvf_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// GPS works on HTTPS and on localhost (dev); all other HTTP origins block it on mobile
const GPS_NEEDS_HTTPS =
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

const LEVELS = ["Débutant","Amateur","Intermédiaire","Confirmé","Expert"];
const DAYS   = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const HOURS  = ["08h","10h","12h","14h","16h","18h","20h","22h"];
const SURF_KEYS = {
  "Gazon naturel":"gazon_naturel", "Gazon synthétique":"gazon_synthetique",
  "Terre battue":"terre_battue", "Béton":"beton", "Parquet":"parquet",
  "Sable":"sable", "Moquette":"moquette", "Dur":"dur", "Gazon":"gazon",
};

const TERRAINS = [
  // ── Europe – Paris ────────────────────────────────────────────────────────────
  { id:1,  name:"Stade Charléty",        sport:"football",   city:"Paris",        country:"France",     mapX:46.2, mapY:28.5, lat:48.819, lng:2.343,    surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.8, players:34,  phone:"+33 1 44 16 60 00" },
  { id:2,  name:"Court Lenglen",         sport:"tennis",     city:"Paris",        country:"France",     mapX:45.9, mapY:27.8, lat:48.845, lng:2.251,    surface:"Terre battue",      lights:false, free:false, price:"8€/h",   rating:4.6, players:19,  phone:"+33 1 40 71 75 10" },
  { id:3,  name:"Playground Pigalle",    sport:"basketball", city:"Paris",        country:"France",     mapX:46.4, mapY:27.2, lat:48.883, lng:2.338,    surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.9, players:67,  phone:null },
  { id:4,  name:"Camp Nou Training",     sport:"football",   city:"Barcelone",    country:"Espagne",    mapX:45.6, mapY:30.8, lat:41.380, lng:2.122,    surface:"Synthétique",       lights:true,  free:false, price:"20€/h",  rating:4.7, players:52,  phone:"+34 902 18 99 00" },
  { id:5,  name:"Wembley Park",          sport:"rugby",      city:"Londres",      country:"UK",         mapX:45.4, mapY:25.5, lat:51.556, lng:-0.279,   surface:"Gazon synthétique", lights:true,  free:false, price:"18€/h",  rating:4.4, players:31,  phone:"+44 20 8795 9000" },
  { id:6,  name:"Foro Italico",          sport:"tennis",     city:"Rome",         country:"Italie",     mapX:47.8, mapY:30.0, lat:41.933, lng:12.466,   surface:"Terre battue",      lights:true,  free:false, price:"9€/h",   rating:4.7, players:42,  phone:"+39 06 3272 2411" },
  { id:7,  name:"Olympiastadion",        sport:"football",   city:"Berlin",       country:"Allemagne",  mapX:47.5, mapY:25.0, lat:52.514, lng:13.239,   surface:"Gazon naturel",     lights:true,  free:false, price:"13€/h",  rating:4.5, players:40,  phone:"+49 30 3068 8100" },
  { id:8,  name:"Tokyo Futsal",          sport:"football",   city:"Tokyo",        country:"Japon",      mapX:78.5, mapY:29.5, lat:35.676, lng:139.650,  surface:"Synthétique",       lights:true,  free:false, price:"14€/h",  rating:4.6, players:37,  phone:"+81 3 5770 4321" },
  { id:9,  name:"Shibuya Basketball",    sport:"basketball", city:"Tokyo",        country:"Japon",      mapX:78.7, mapY:29.8, lat:35.658, lng:139.701,  surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.9, players:88,  phone:null },
  { id:10, name:"Copacabana Beach",      sport:"football",   city:"Rio",          country:"Brésil",     mapX:33.5, mapY:52.0, lat:-22.971,lng:-43.182,  surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.9, players:120, phone:null },
  { id:11, name:"Playground NYC",        sport:"basketball", city:"New York",     country:"USA",        mapX:25.5, mapY:28.5, lat:40.758, lng:-73.985,  surface:"Béton",             lights:false, free:true,  price:"Gratuit",rating:4.8, players:89,  phone:null },
  { id:12, name:"Sydney Football",       sport:"football",   city:"Sydney",       country:"Australie",  mapX:82.5, mapY:56.5, lat:-33.868,lng:151.209,  surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.6, players:41,  phone:"+61 2 9360 4444" },
  { id:13, name:"Dubai Padel Club",      sport:"padel",      city:"Dubaï",        country:"UAE",        mapX:59.0, mapY:34.5, lat:25.204, lng:55.270,   surface:"Gazon synthétique", lights:true,  free:false, price:"25€/h",  rating:4.5, players:18,  phone:"+971 4 388 3030" },
  { id:14, name:"KL Badminton",          sport:"badminton",  city:"Kuala Lumpur", country:"Malaisie",   mapX:73.2, mapY:40.5, lat:3.140,  lng:101.686,  surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.9, players:55,  phone:"+60 3 2161 7500" },
  { id:15, name:"Shanghai Ping-Pong",    sport:"pingpong",   city:"Shanghai",     country:"Chine",      mapX:76.4, mapY:31.3, lat:31.230, lng:121.473,  surface:"Parquet",           lights:true,  free:false, price:"2€/h",   rating:4.9, players:80,  phone:"+86 21 6321 0099" },
  { id:16, name:"Copacabana Volley",     sport:"volleyball", city:"Rio",          country:"Brésil",     mapX:33.6, mapY:52.1, lat:-22.972,lng:-43.180,  surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.9, players:95,  phone:null },
  { id:17, name:"Miami Beach Volley",    sport:"volleyball", city:"Miami",        country:"USA",        mapX:24.4, mapY:32.4, lat:25.761, lng:-80.191,  surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.8, players:67,  phone:null },
  { id:18, name:"Buenos Aires Rugby",    sport:"rugby",      city:"Buenos Aires", country:"Argentine",  mapX:30.5, mapY:57.5, lat:-34.614,lng:-58.445,  surface:"Gazon naturel",     lights:true,  free:false, price:"4€/h",   rating:4.6, players:28,  phone:"+54 11 4891 1200" },
  { id:19, name:"Bernabéu Court",        sport:"basketball", city:"Madrid",       country:"Espagne",    mapX:44.7, mapY:31.0, lat:40.453, lng:-3.688,   surface:"Parquet",           lights:true,  free:false, price:"10€/h",  rating:4.3, players:28,  phone:"+34 914 98 36 00" },
  { id:20, name:"Hyde Park Tennis",      sport:"tennis",     city:"Londres",      country:"UK",         mapX:45.3, mapY:25.8, lat:51.507, lng:-0.165,   surface:"Gazon",             lights:false, free:true,  price:"Gratuit",rating:4.7, players:14,  phone:null },
  // ── Europe – terrains divers ──────────────────────────────────────────────────
  { id:21, name:"Vondelpark Football",   sport:"football",   city:"Amsterdam",    country:"Pays-Bas",   mapX:46.7, mapY:25.1, lat:52.358, lng:4.869,    surface:"Gazon naturel",     lights:false, free:true,  price:"Gratuit",rating:4.6, players:45,  phone:null },
  { id:22, name:"Benfica Training",      sport:"football",   city:"Lisbonne",     country:"Portugal",   mapX:43.3, mapY:30.0, lat:38.712, lng:-9.181,   surface:"Synthétique",       lights:true,  free:false, price:"10€/h",  rating:4.5, players:33,  phone:"+351 21 726 6129" },
  { id:23, name:"Bosphorus Padel",       sport:"padel",      city:"Istanbul",     country:"Turquie",    mapX:52.4, mapY:29.5, lat:41.015, lng:28.979,   surface:"Gazon synthétique", lights:true,  free:false, price:"15€/h",  rating:4.6, players:22,  phone:"+90 212 244 0022" },
  { id:24, name:"Panathinaiko Tennis",   sport:"tennis",     city:"Athènes",      country:"Grèce",      mapX:51.1, mapY:30.3, lat:37.971, lng:23.726,   surface:"Terre battue",      lights:true,  free:false, price:"8€/h",   rating:4.4, players:17,  phone:"+30 210 752 2984" },
  { id:25, name:"Djurgården Football",   sport:"football",   city:"Stockholm",    country:"Suède",      mapX:49.8, mapY:22.6, lat:59.330, lng:18.068,   surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.5, players:29,  phone:"+46 8 665 4444" },
  { id:26, name:"Wisła Court",           sport:"basketball", city:"Varsovie",     country:"Pologne",    mapX:50.5, mapY:25.1, lat:52.230, lng:21.011,   surface:"Parquet",           lights:true,  free:false, price:"6€/h",   rating:4.3, players:24,  phone:"+48 22 826 1520" },
  { id:27, name:"Prater Stadion",        sport:"football",   city:"Vienne",       country:"Autriche",   mapX:49.4, mapY:26.5, lat:48.208, lng:16.374,   surface:"Gazon naturel",     lights:true,  free:false, price:"14€/h",  rating:4.6, players:38,  phone:"+43 1 728 0854" },
  { id:28, name:"Atomium Basket",        sport:"basketball", city:"Bruxelles",    country:"Belgique",   mapX:46.5, mapY:25.6, lat:50.895, lng:4.341,    surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.4, players:31,  phone:null },
  { id:29, name:"Fælledparken Foot",     sport:"football",   city:"Copenhague",   country:"Danemark",   mapX:48.5, mapY:23.9, lat:55.687, lng:12.571,   surface:"Gazon naturel",     lights:false, free:true,  price:"Gratuit",rating:4.7, players:50,  phone:null },
  { id:30, name:"Luzhniki Training",     sport:"football",   city:"Moscou",       country:"Russie",     mapX:54.4, mapY:23.9, lat:55.716, lng:37.554,   surface:"Synthétique",       lights:true,  free:false, price:"7€/h",   rating:4.3, players:44,  phone:"+7 495 637 0505" },
  // ── Asie ─────────────────────────────────────────────────────────────────────
  { id:31, name:"Han River Football",    sport:"football",   city:"Séoul",        country:"Corée du S", mapX:75.6, mapY:30.3, lat:37.525, lng:126.928,  surface:"Gazon synthétique", lights:true,  free:true,  price:"Gratuit",rating:4.7, players:63,  phone:null },
  { id:32, name:"Workers Stadium",       sport:"football",   city:"Pékin",        country:"Chine",      mapX:73.1, mapY:29.5, lat:39.929, lng:116.444,  surface:"Gazon naturel",     lights:true,  free:false, price:"5€/h",   rating:4.4, players:48,  phone:"+86 10 6551 8285" },
  { id:33, name:"Lumpini Tennis",        sport:"tennis",     city:"Bangkok",      country:"Thaïlande",  mapX:69.3, mapY:38.9, lat:13.732, lng:100.544,  surface:"Béton",             lights:true,  free:false, price:"3€/h",   rating:4.5, players:26,  phone:"+66 2 252 7006" },
  { id:34, name:"Marina Bay Padel",      sport:"padel",      city:"Singapour",    country:"Singapour",  mapX:70.1, mapY:43.3, lat:1.282,  lng:103.863,  surface:"Gazon synthétique", lights:true,  free:false, price:"18€/h",  rating:4.8, players:20,  phone:"+65 6336 8797" },
  { id:35, name:"Chowpatty Volleyball",  sport:"volleyball", city:"Mumbai",       country:"Inde",       mapX:62.8, mapY:36.9, lat:18.954, lng:72.803,   surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.6, players:74,  phone:null },
  { id:36, name:"Senayan Football",      sport:"football",   city:"Jakarta",      country:"Indonésie",  mapX:70.8, mapY:45.0, lat:-6.219, lng:106.802,  surface:"Gazon naturel",     lights:true,  free:false, price:"4€/h",   rating:4.4, players:55,  phone:"+62 21 573 1461" },
  { id:37, name:"Taipei Futsal",         sport:"football",   city:"Taipei",       country:"Taïwan",     mapX:77.8, mapY:32.2, lat:25.047, lng:121.514,  surface:"Synthétique",       lights:true,  free:false, price:"6€/h",   rating:4.7, players:42,  phone:"+886 2 2720 8889" },
  // ── Afrique ───────────────────────────────────────────────────────────────────
  { id:38, name:"Green Point Tennis",    sport:"tennis",     city:"Le Cap",       country:"Afr. du Sud",mapX:49.9, mapY:55.9, lat:-33.926,lng:18.423,   surface:"Béton",             lights:true,  free:false, price:"5€/h",   rating:4.5, players:19,  phone:"+27 21 430 1200" },
  { id:39, name:"Teslim Balogun",        sport:"football",   city:"Lagos",        country:"Nigeria",    mapX:46.3, mapY:41.5, lat:6.452,  lng:3.393,    surface:"Gazon naturel",     lights:true,  free:false, price:"2€/h",   rating:4.3, players:68,  phone:"+234 1 263 6082" },
  { id:40, name:"Cairo Stadium Foot",    sport:"football",   city:"Le Caire",     country:"Égypte",     mapX:52.9, mapY:33.1, lat:30.064, lng:31.249,   surface:"Synthétique",       lights:true,  free:false, price:"3€/h",   rating:4.4, players:57,  phone:"+20 2 2262 6580" },
  { id:41, name:"Casablanca Padel",      sport:"padel",      city:"Casablanca",   country:"Maroc",      mapX:43.7, mapY:31.8, lat:33.583, lng:-7.606,   surface:"Gazon synthétique", lights:true,  free:false, price:"8€/h",   rating:4.6, players:16,  phone:"+212 5 22 94 25 00" },
  { id:42, name:"Ellis Park Rugby",      sport:"rugby",      city:"Johannesburg", country:"Afr. du Sud",mapX:52.1, mapY:53.2, lat:-26.196,lng:28.059,   surface:"Gazon naturel",     lights:true,  free:false, price:"6€/h",   rating:4.5, players:35,  phone:"+27 11 402 8644" },
  { id:43, name:"Léopold Sédar Foot",    sport:"football",   city:"Dakar",        country:"Sénégal",    mapX:41.4, mapY:38.6, lat:14.716, lng:-17.467,  surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.7, players:82,  phone:null },
  { id:44, name:"Nyayo Court",           sport:"basketball", city:"Nairobi",      country:"Kenya",      mapX:54.2, mapY:44.3, lat:-1.301, lng:36.822,   surface:"Béton",             lights:false, free:true,  price:"Gratuit",rating:4.4, players:47,  phone:null },
  // ── Amériques ─────────────────────────────────────────────────────────────────
  { id:45, name:"Azteca Training",       sport:"football",   city:"Mexico",       country:"Mexique",    mapX:21.9, mapY:37.0, lat:19.303, lng:-99.150,  surface:"Synthétique",       lights:true,  free:false, price:"8€/h",   rating:4.6, players:61,  phone:"+52 55 5617 8080" },
  { id:46, name:"Ibirapuera Basket",     sport:"basketball", city:"São Paulo",    country:"Brésil",     mapX:34.5, mapY:52.2, lat:-23.587,lng:-46.655,  surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.7, players:76,  phone:null },
  { id:47, name:"Grant Park Futsal",     sport:"football",   city:"Chicago",      country:"USA",        mapX:24.8, mapY:28.8, lat:41.875, lng:-87.621,  surface:"Synthétique",       lights:true,  free:false, price:"10€/h",  rating:4.5, players:43,  phone:"+1 312 742 7648" },
  { id:48, name:"Venice Beach Volley",   sport:"volleyball", city:"Los Angeles",  country:"USA",        mapX:17.5, mapY:31.6, lat:33.985, lng:-118.473, surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.9, players:103, phone:null },
  { id:49, name:"Varsity Stadium",       sport:"rugby",      city:"Toronto",      country:"Canada",     mapX:26.7, mapY:28.2, lat:43.665, lng:-79.400,  surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.4, players:26,  phone:"+1 416 979 3000" },
  { id:50, name:"Bogotá Street Foot",    sport:"football",   city:"Bogotá",       country:"Colombie",   mapX:27.9, mapY:42.1, lat:4.711,  lng:-74.072,  surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.6, players:58,  phone:null },
  { id:51, name:"Parque O'Higgins Foot", sport:"football",   city:"Santiago",     country:"Chili",      mapX:28.7, mapY:55.8, lat:-33.452,lng:-70.668,  surface:"Gazon naturel",     lights:true,  free:false, price:"5€/h",   rating:4.5, players:39,  phone:"+56 2 2556 7800" },
  // ── Moyen-Orient & Océanie ────────────────────────────────────────────────────
  { id:52, name:"Aspire Academy",        sport:"football",   city:"Doha",         country:"Qatar",      mapX:57.7, mapY:34.7, lat:25.261, lng:51.453,   surface:"Gazon synthétique", lights:true,  free:false, price:"20€/h",  rating:4.8, players:34,  phone:"+974 4413 3555" },
  { id:53, name:"King Fahd Stadium",     sport:"football",   city:"Riyad",        country:"Arabie S.",  mapX:56.6, mapY:34.9, lat:24.691, lng:46.716,   surface:"Gazon naturel",     lights:true,  free:false, price:"0€/h",   rating:4.3, players:29,  phone:"+966 11 482 2222" },
  { id:54, name:"Albert Park Tennis",    sport:"tennis",     city:"Melbourne",    country:"Australie",  mapX:79.9, mapY:57.3, lat:-37.845,lng:144.977,  surface:"Dur",               lights:true,  free:false, price:"9€/h",   rating:4.8, players:22,  phone:"+61 3 9286 1234" },
  // ═══════════════════════════════════════════════════════════════════════════════
  // ── FOOTBALL MONDIAL – Europe ─────────────────────────────────────────────────
  { id:55, name:"Allianz Arena Training",sport:"football",   city:"Munich",       country:"Allemagne",  mapX:48.2, mapY:27.0, lat:48.219, lng:11.625,   surface:"Gazon naturel",     lights:true,  free:false, price:"15€/h",  rating:4.7, players:44,  phone:"+49 89 6993 1222" },
  { id:56, name:"San Siro Training",     sport:"football",   city:"Milan",        country:"Italie",     mapX:47.7, mapY:27.5, lat:45.478, lng:9.124,    surface:"Gazon naturel",     lights:true,  free:false, price:"18€/h",  rating:4.6, players:50,  phone:"+39 02 4042 2111" },
  { id:57, name:"OL Training Center",    sport:"football",   city:"Lyon",         country:"France",     mapX:46.6, mapY:27.4, lat:45.765, lng:4.844,    surface:"Gazon naturel",     lights:true,  free:false, price:"13€/h",  rating:4.5, players:36,  phone:"+33 4 81 07 55 00" },
  { id:58, name:"Vélodrome Training",    sport:"football",   city:"Marseille",    country:"France",     mapX:46.8, mapY:28.3, lat:43.269, lng:5.396,    surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.5, players:40,  phone:"+33 4 91 76 56 09" },
  { id:59, name:"Dragão Training",       sport:"football",   city:"Porto",        country:"Portugal",   mapX:43.5, mapY:29.1, lat:41.161, lng:-8.583,   surface:"Gazon synthétique", lights:true,  free:false, price:"10€/h",  rating:4.6, players:32,  phone:"+351 22 557 0500" },
  { id:60, name:"Ramón Sánchez Training",sport:"football",   city:"Séville",      country:"Espagne",    mapX:44.1, mapY:30.5, lat:37.384, lng:-5.970,   surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.5, players:38,  phone:"+34 954 53 53 53" },
  { id:61, name:"City Football Academy", sport:"football",   city:"Manchester",   country:"UK",         mapX:45.0, mapY:24.7, lat:53.483, lng:-2.200,   surface:"Gazon naturel",     lights:true,  free:false, price:"20€/h",  rating:4.8, players:45,  phone:"+44 161 444 1894" },
  { id:62, name:"Feyenoord Training",    sport:"football",   city:"Rotterdam",    country:"Pays-Bas",   mapX:46.6, mapY:25.3, lat:51.888, lng:4.469,    surface:"Gazon naturel",     lights:true,  free:false, price:"11€/h",  rating:4.5, players:33,  phone:"+31 10 292 7777" },
  { id:63, name:"Volksparkstadion Foot", sport:"football",   city:"Hambourg",     country:"Allemagne",  mapX:47.9, mapY:24.6, lat:53.587, lng:9.899,    surface:"Gazon synthétique", lights:true,  free:false, price:"12€/h",  rating:4.4, players:37,  phone:"+49 40 4155 1500" },
  { id:64, name:"Sparta Praha Training", sport:"football",   city:"Prague",       country:"Tchéquie",   mapX:48.9, mapY:25.9, lat:50.098, lng:14.419,   surface:"Gazon naturel",     lights:true,  free:false, price:"8€/h",   rating:4.4, players:28,  phone:"+420 220 570 323" },
  { id:65, name:"Puskás Akadémia",       sport:"football",   city:"Budapest",     country:"Hongrie",    mapX:50.0, mapY:27.0, lat:47.496, lng:19.040,   surface:"Gazon naturel",     lights:true,  free:false, price:"7€/h",   rating:4.5, players:31,  phone:"+36 1 239 0311" },
  { id:66, name:"Maracanã Do Sul",       sport:"football",   city:"Belgrade",     country:"Serbie",     mapX:50.3, mapY:27.8, lat:44.786, lng:20.457,   surface:"Gazon synthétique", lights:true,  free:false, price:"6€/h",   rating:4.3, players:29,  phone:"+381 11 323 3422" },
  { id:67, name:"Bolt Arena Training",   sport:"football",   city:"Helsinki",     country:"Finlande",   mapX:51.4, mapY:22.3, lat:60.187, lng:24.929,   surface:"Synthétique",       lights:true,  free:false, price:"9€/h",   rating:4.4, players:24,  phone:"+358 9 8770 1840" },
  { id:68, name:"Ullevaal Football",     sport:"football",   city:"Oslo",         country:"Norvège",    mapX:48.0, mapY:22.5, lat:59.939, lng:10.727,   surface:"Gazon naturel",     lights:true,  free:false, price:"10€/h",  rating:4.5, players:27,  phone:"+47 21 02 96 00" },
  { id:69, name:"Letziground Foot",      sport:"football",   city:"Zurich",       country:"Suisse",     mapX:47.5, mapY:27.0, lat:47.378, lng:8.504,    surface:"Gazon naturel",     lights:true,  free:false, price:"14€/h",  rating:4.6, players:35,  phone:"+41 44 245 1522" },
  { id:70, name:"Celtic Training Ground",sport:"football",   city:"Glasgow",      country:"Écosse",     mapX:44.5, mapY:23.8, lat:55.849, lng:-4.205,   surface:"Gazon naturel",     lights:true,  free:false, price:"14€/h",  rating:4.6, players:40,  phone:"+44 141 551 4308" },
  { id:71, name:"San Mamés Training",    sport:"football",   city:"Bilbao",       country:"Espagne",    mapX:44.8, mapY:28.3, lat:43.264, lng:-2.950,   surface:"Gazon synthétique", lights:true,  free:false, price:"10€/h",  rating:4.5, players:30,  phone:"+34 944 41 16 77" },
  { id:72, name:"Stade de France Foot",  sport:"football",   city:"Saint-Denis",  country:"France",     mapX:46.3, mapY:28.2, lat:48.924, lng:2.360,    surface:"Gazon naturel",     lights:true,  free:false, price:"18€/h",  rating:4.7, players:48,  phone:"+33 1 55 93 00 00" },
  { id:73, name:"Juventus Training",     sport:"football",   city:"Turin",        country:"Italie",     mapX:47.1, mapY:27.7, lat:45.109, lng:7.641,    surface:"Gazon naturel",     lights:true,  free:false, price:"16€/h",  rating:4.6, players:42,  phone:"+39 011 656 3111" },
  { id:74, name:"Estádio da Luz Foot",   sport:"football",   city:"Lisbonne",     country:"Portugal",   mapX:43.4, mapY:29.9, lat:38.752, lng:-9.185,   surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.7, players:45,  phone:"+351 21 721 9500" },
  { id:75, name:"Türk Telekom Foot",     sport:"football",   city:"Istanbul",     country:"Turquie",    mapX:52.5, mapY:29.4, lat:41.073, lng:28.988,   surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.5, players:38,  phone:"+90 212 219 5000" },
  // ── FOOTBALL MONDIAL – Afrique ────────────────────────────────────────────────
  { id:76, name:"Félix Houphouët Foot",  sport:"football",   city:"Abidjan",      country:"Côte d'Iv.", mapX:44.5, mapY:41.9, lat:5.315,  lng:-4.013,   surface:"Gazon naturel",     lights:true,  free:false, price:"2€/h",   rating:4.4, players:72,  phone:"+225 27 22 44 61 00" },
  { id:77, name:"Accra Sports Stadium",  sport:"football",   city:"Accra",        country:"Ghana",      mapX:45.5, mapY:41.8, lat:5.556,  lng:-0.196,   surface:"Gazon naturel",     lights:true,  free:false, price:"1€/h",   rating:4.3, players:65,  phone:"+233 30 266 4874" },
  { id:78, name:"Martyrs Stadium Foot",  sport:"football",   city:"Kinshasa",     country:"R.D. Congo", mapX:49.1, mapY:45.3, lat:-4.322, lng:15.322,   surface:"Gazon naturel",     lights:true,  free:false, price:"1€/h",   rating:4.2, players:80,  phone:"+243 81 700 0000" },
  { id:79, name:"Stade Rades Football",  sport:"football",   city:"Tunis",        country:"Tunisie",    mapX:47.9, mapY:30.6, lat:36.822, lng:10.181,   surface:"Synthétique",       lights:true,  free:false, price:"3€/h",   rating:4.4, players:55,  phone:"+216 71 450 255" },
  { id:80, name:"5 Juillet Training",    sport:"football",   city:"Alger",        country:"Algérie",    mapX:46.2, mapY:30.6, lat:36.737, lng:3.056,    surface:"Gazon naturel",     lights:true,  free:false, price:"2€/h",   rating:4.3, players:60,  phone:"+213 21 74 85 00" },
  { id:81, name:"Addis Ababa Stadium",   sport:"football",   city:"Addis-Abeba",  country:"Éthiopie",   mapX:54.7, mapY:40.6, lat:9.005,  lng:38.763,   surface:"Gazon naturel",     lights:true,  free:false, price:"1€/h",   rating:4.1, players:70,  phone:"+251 11 551 7700" },
  { id:82, name:"Stade Omnisport Foot",  sport:"football",   city:"Douala",       country:"Cameroun",   mapX:47.8, mapY:42.3, lat:4.053,  lng:9.719,    surface:"Gazon naturel",     lights:true,  free:false, price:"2€/h",   rating:4.3, players:75,  phone:"+237 233 42 36 00" },
  { id:83, name:"Kasarani Football",     sport:"football",   city:"Nairobi",      country:"Kenya",      mapX:54.2, mapY:44.3, lat:-1.222, lng:36.894,   surface:"Gazon naturel",     lights:true,  free:false, price:"2€/h",   rating:4.3, players:60,  phone:"+254 20 860 7000" },
  { id:84, name:"Tupac Amaru Foot",      sport:"football",   city:"Harare",       country:"Zimbabwe",   mapX:53.3, mapY:53.2, lat:-17.829,lng:31.052,   surface:"Gazon naturel",     lights:true,  free:false, price:"2€/h",   rating:4.1, players:55,  phone:"+263 4 663 880" },
  // ── FOOTBALL MONDIAL – Asie ───────────────────────────────────────────────────
  { id:85, name:"Namba Futsal",          sport:"football",   city:"Osaka",        country:"Japon",      mapX:77.6, mapY:31.4, lat:34.653, lng:135.502,  surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.7, players:36,  phone:"+81 6 6213 8877" },
  { id:86, name:"Tianhe Football Park",  sport:"football",   city:"Guangzhou",    country:"Chine",      mapX:72.3, mapY:35.5, lat:23.134, lng:113.269,  surface:"Gazon synthétique", lights:true,  free:false, price:"5€/h",   rating:4.4, players:44,  phone:"+86 20 3888 6600" },
  { id:87, name:"Bishan Football",       sport:"football",   city:"Singapour",    country:"Singapour",  mapX:70.2, mapY:43.2, lat:1.351,  lng:103.850,  surface:"Gazon synthétique", lights:true,  free:true,  price:"Gratuit",rating:4.6, players:38,  phone:null },
  { id:88, name:"Azadi Training",        sport:"football",   city:"Téhéran",      country:"Iran",       mapX:57.7, mapY:31.5, lat:35.730, lng:51.387,   surface:"Gazon naturel",     lights:true,  free:false, price:"3€/h",   rating:4.3, players:52,  phone:"+98 21 6609 4040" },
  { id:89, name:"Saigon Football",       sport:"football",   city:"Hô-Chi-Minh",  country:"Viêt Nam",   mapX:70.8, mapY:39.9, lat:10.822, lng:106.663,  surface:"Synthétique",       lights:true,  free:false, price:"3€/h",   rating:4.4, players:46,  phone:"+84 28 3824 3135" },
  { id:90, name:"Mỹ Đình Stadium",       sport:"football",   city:"Hanoï",        country:"Viêt Nam",   mapX:70.6, mapY:36.3, lat:21.031, lng:105.762,  surface:"Gazon naturel",     lights:true,  free:false, price:"3€/h",   rating:4.4, players:50,  phone:"+84 24 3835 1932" },
  { id:91, name:"Salt Lake Football",    sport:"football",   city:"Kolkata",      country:"Inde",       mapX:66.4, mapY:35.7, lat:22.575, lng:88.397,   surface:"Gazon naturel",     lights:true,  free:false, price:"2€/h",   rating:4.4, players:65,  phone:"+91 33 2359 5511" },
  { id:92, name:"Lahore Futsal Arena",   sport:"football",   city:"Lahore",       country:"Pakistan",   mapX:63.1, mapY:32.6, lat:31.549, lng:74.342,   surface:"Synthétique",       lights:true,  free:false, price:"2€/h",   rating:4.2, players:48,  phone:"+92 42 3571 3344" },
  { id:93, name:"Dhaka Football Park",   sport:"football",   city:"Dhaka",        country:"Bangladesh", mapX:66.9, mapY:35.3, lat:23.724, lng:90.411,   surface:"Gazon synthétique", lights:true,  free:false, price:"1€/h",   rating:4.1, players:55,  phone:"+880 2 933 7170" },
  // ── FOOTBALL MONDIAL – Amériques ─────────────────────────────────────────────
  { id:94, name:"Estadio Nacional Lima", sport:"football",   city:"Lima",         country:"Pérou",      mapX:27.2, mapY:48.1, lat:-12.075,lng:-77.033,  surface:"Gazon naturel",     lights:true,  free:false, price:"5€/h",   rating:4.5, players:55,  phone:"+51 1 433 9866" },
  { id:95, name:"Centenario Training",   sport:"football",   city:"Montevideo",   country:"Uruguay",    mapX:32.2, mapY:56.3, lat:-34.895,lng:-56.164,  surface:"Gazon naturel",     lights:true,  free:false, price:"4€/h",   rating:4.6, players:42,  phone:"+598 2 480 2080" },
  { id:96, name:"Houston Soccer Complex",sport:"football",   city:"Houston",      country:"USA",        mapX:22.8, mapY:33.2, lat:29.761, lng:-95.369,  surface:"Gazon synthétique", lights:true,  free:false, price:"12€/h",  rating:4.5, players:48,  phone:"+1 713 803 1874" },
  { id:97, name:"LA Galaxy Training",    sport:"football",   city:"Los Angeles",  country:"USA",        mapX:17.5, mapY:31.7, lat:33.864, lng:-118.261, surface:"Gazon naturel",     lights:true,  free:false, price:"15€/h",  rating:4.6, players:40,  phone:"+1 310 630 2200" },
  { id:98, name:"Sounders Training",     sport:"football",   city:"Seattle",      country:"USA",        mapX:16.5, mapY:27.0, lat:47.595, lng:-122.331, surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.5, players:35,  phone:"+1 206 622 3415" },
  { id:99, name:"Ibaraki Foot Park",     sport:"football",   city:"Ibaraki",      country:"Japon",      mapX:78.3, mapY:30.0, lat:36.342, lng:140.447,  surface:"Gazon synthétique", lights:true,  free:false, price:"10€/h",  rating:4.5, players:30,  phone:"+81 29 247 0800" },
  // ── FOOTBALL MONDIAL – Moyen-Orient & Océanie ─────────────────────────────────
  { id:100,name:"Bloomfield Stadium",    sport:"football",   city:"Tel Aviv",     country:"Israël",     mapX:53.7, mapY:32.3, lat:32.076, lng:34.772,   surface:"Gazon naturel",     lights:true,  free:false, price:"8€/h",   rating:4.4, players:35,  phone:"+972 3 681 1010" },
  { id:101,name:"Amman Int'l Stadium",   sport:"football",   city:"Amman",        country:"Jordanie",   mapX:54.0, mapY:32.3, lat:31.951, lng:35.934,   surface:"Gazon naturel",     lights:true,  free:false, price:"5€/h",   rating:4.3, players:38,  phone:"+962 6 551 7233" },
  { id:102,name:"Camille Chamoun Foot",  sport:"football",   city:"Beyrouth",     country:"Liban",      mapX:53.9, mapY:31.7, lat:33.882, lng:35.486,   surface:"Gazon synthétique", lights:true,  free:false, price:"6€/h",   rating:4.2, players:32,  phone:"+961 1 380 880" },
  { id:103,name:"Eden Park Training",    sport:"football",   city:"Auckland",     country:"N.-Zélande", mapX:86.9, mapY:57.0, lat:-36.875,lng:174.743,  surface:"Gazon naturel",     lights:true,  free:false, price:"11€/h",  rating:4.5, players:28,  phone:"+64 9 815 5551" },
  { id:104,name:"Suncorp Stadium Foot",  sport:"football",   city:"Brisbane",     country:"Australie",  mapX:81.7, mapY:53.6, lat:-27.463,lng:153.010,  surface:"Gazon naturel",     lights:true,  free:false, price:"10€/h",  rating:4.5, players:32,  phone:"+61 7 3331 5000" },
  { id:105,name:"Perth Football Ground", sport:"football",   city:"Perth",        country:"Australie",  mapX:72.9, mapY:55.2, lat:-31.951,lng:115.862,  surface:"Gazon synthétique", lights:true,  free:false, price:"9€/h",   rating:4.4, players:30,  phone:"+61 8 9422 1555" },
  // ── BASKETBALL ───────────────────────────────────────────────────────────────
  { id:106,name:"Bercy Basket Indoor",   sport:"basketball", city:"Paris",        country:"France",     mapX:46.5, mapY:28.1, lat:48.839, lng:2.379,    surface:"Parquet",           lights:true,  free:false, price:"8€/h",   rating:4.7, players:54,  phone:"+33 1 40 02 60 60" },
  { id:107,name:"Rucker Park Europe",    sport:"basketball", city:"Barcelone",    country:"Espagne",    mapX:45.6, mapY:30.5, lat:41.402, lng:2.174,    surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.8, players:72,  phone:null },
  { id:108,name:"Olympic Basket Athens", sport:"basketball", city:"Athènes",      country:"Grèce",      mapX:51.2, mapY:30.5, lat:37.992, lng:23.753,   surface:"Parquet",           lights:true,  free:false, price:"6€/h",   rating:4.5, players:32,  phone:"+30 210 680 9999" },
  { id:109,name:"Pallacanestro Milano",  sport:"basketball", city:"Milan",        country:"Italie",     mapX:47.7, mapY:27.8, lat:45.521, lng:9.217,    surface:"Parquet",           lights:true,  free:false, price:"7€/h",   rating:4.6, players:40,  phone:"+39 02 2700 4441" },
  { id:110,name:"Ankara Basket Arena",   sport:"basketball", city:"Ankara",       country:"Turquie",    mapX:52.8, mapY:30.5, lat:39.933, lng:32.860,   surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.4, players:28,  phone:"+90 312 425 8800" },
  { id:111,name:"Dakar Beach Basket",    sport:"basketball", city:"Dakar",        country:"Sénégal",    mapX:41.4, mapY:38.3, lat:14.731, lng:-17.451,  surface:"Béton",             lights:false, free:true,  price:"Gratuit",rating:4.6, players:60,  phone:null },
  { id:112,name:"Cairo Basket Hall",     sport:"basketball", city:"Le Caire",     country:"Égypte",     mapX:52.9, mapY:33.2, lat:30.049, lng:31.237,   surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.3, players:35,  phone:"+20 2 2267 8800" },
  { id:113,name:"Hanoi Sport Arena",     sport:"basketball", city:"Hanoï",        country:"Viêt Nam",   mapX:70.6, mapY:36.4, lat:21.025, lng:105.843,  surface:"Parquet",           lights:true,  free:false, price:"2€/h",   rating:4.4, players:42,  phone:"+84 24 3937 0200" },
  { id:114,name:"Manila Hoops Center",   sport:"basketball", city:"Manille",      country:"Philippines",mapX:73.5, mapY:41.0, lat:14.599, lng:120.984,  surface:"Parquet",           lights:true,  free:false, price:"2€/h",   rating:4.5, players:68,  phone:"+63 2 8527 5560" },
  { id:115,name:"Chicago Southside Court",sport:"basketball",city:"Chicago",      country:"USA",        mapX:24.8, mapY:28.6, lat:41.836, lng:-87.632,  surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.7, players:85,  phone:null },
  { id:116,name:"Toronto Raptors Hub",   sport:"basketball", city:"Toronto",      country:"Canada",     mapX:26.7, mapY:27.9, lat:43.643, lng:-79.379,  surface:"Parquet",           lights:true,  free:false, price:"11€/h",  rating:4.6, players:44,  phone:"+1 416 366 3865" },
  { id:117,name:"Buenos Aires Basket",   sport:"basketball", city:"Buenos Aires", country:"Argentine",  mapX:30.4, mapY:57.2, lat:-34.580,lng:-58.395,  surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.5, players:50,  phone:null },
  { id:118,name:"Sydney Indoor Basket",  sport:"basketball", city:"Sydney",       country:"Australie",  mapX:82.5, mapY:56.4, lat:-33.879,lng:151.205,  surface:"Parquet",           lights:true,  free:false, price:"9€/h",   rating:4.6, players:38,  phone:"+61 2 9319 6855" },
  // ── TENNIS ───────────────────────────────────────────────────────────────────
  { id:119,name:"Court Mouratoglou",     sport:"tennis",     city:"Nice",         country:"France",     mapX:47.1, mapY:28.5, lat:43.704, lng:7.262,    surface:"Dur",               lights:true,  free:false, price:"15€/h",  rating:4.9, players:12,  phone:"+33 4 92 29 35 00" },
  { id:120,name:"Wimbledon Pub Court",   sport:"tennis",     city:"Londres",      country:"UK",         mapX:45.2, mapY:25.7, lat:51.433, lng:-0.214,   surface:"Gazon",             lights:false, free:false, price:"10€/h",  rating:4.8, players:18,  phone:"+44 20 8946 2244" },
  { id:121,name:"Roland Garros Annexe",  sport:"tennis",     city:"Paris",        country:"France",     mapX:46.1, mapY:28.3, lat:48.846, lng:2.249,    surface:"Terre battue",      lights:true,  free:false, price:"18€/h",  rating:4.9, players:10,  phone:"+33 1 47 43 48 00" },
  { id:122,name:"Flushing Meadows Club", sport:"tennis",     city:"New York",     country:"USA",        mapX:25.6, mapY:28.4, lat:40.750, lng:-73.846,  surface:"Dur",               lights:true,  free:false, price:"20€/h",  rating:4.8, players:16,  phone:"+1 718 760 6200" },
  { id:123,name:"Melbourne Park Annex",  sport:"tennis",     city:"Melbourne",    country:"Australie",  mapX:79.9, mapY:57.5, lat:-37.822,lng:144.979,  surface:"Dur",               lights:true,  free:false, price:"14€/h",  rating:4.8, players:20,  phone:"+61 3 9286 1234" },
  { id:124,name:"Dubai Tennis Stadium",  sport:"tennis",     city:"Dubaï",        country:"UAE",        mapX:59.1, mapY:34.6, lat:25.185, lng:55.240,   surface:"Dur",               lights:true,  free:false, price:"22€/h",  rating:4.7, players:14,  phone:"+971 4 282 4122" },
  { id:125,name:"Lagos Tennis Club",     sport:"tennis",     city:"Lagos",        country:"Nigeria",    mapX:46.4, mapY:41.6, lat:6.436,  lng:3.406,    surface:"Béton",             lights:true,  free:false, price:"3€/h",   rating:4.4, players:22,  phone:"+234 1 264 3740" },
  { id:126,name:"Buenos Aires TC",       sport:"tennis",     city:"Buenos Aires", country:"Argentine",  mapX:30.5, mapY:57.4, lat:-34.579,lng:-58.432,  surface:"Terre battue",      lights:true,  free:false, price:"6€/h",   rating:4.7, players:18,  phone:"+54 11 4774 4521" },
  { id:127,name:"Santiago Tennis Club",  sport:"tennis",     city:"Santiago",     country:"Chili",      mapX:28.6, mapY:56.0, lat:-33.462,lng:-70.642,  surface:"Terre battue",      lights:true,  free:false, price:"5€/h",   rating:4.6, players:16,  phone:"+56 2 2231 3600" },
  { id:128,name:"Mumbai Beach Tennis",   sport:"tennis",     city:"Mumbai",       country:"Inde",       mapX:62.7, mapY:37.0, lat:18.944, lng:72.824,   surface:"Béton",             lights:false, free:true,  price:"Gratuit",rating:4.5, players:28,  phone:null },
  // ── PADEL ────────────────────────────────────────────────────────────────────
  { id:129,name:"Padel Horizon Paris",   sport:"padel",      city:"Paris",        country:"France",     mapX:46.2, mapY:28.4, lat:48.862, lng:2.355,    surface:"Gazon synthétique", lights:true,  free:false, price:"20€/h",  rating:4.8, players:16,  phone:"+33 1 56 02 26 26" },
  { id:130,name:"World Padel Tour BCN",  sport:"padel",      city:"Barcelone",    country:"Espagne",    mapX:45.7, mapY:30.6, lat:41.389, lng:2.164,    surface:"Gazon synthétique", lights:true,  free:false, price:"18€/h",  rating:4.9, players:24,  phone:"+34 93 221 8181" },
  { id:131,name:"Padel Life Madrid",     sport:"padel",      city:"Madrid",       country:"Espagne",    mapX:44.7, mapY:30.9, lat:40.413, lng:-3.702,   surface:"Gazon synthétique", lights:true,  free:false, price:"16€/h",  rating:4.8, players:20,  phone:"+34 91 555 6700" },
  { id:132,name:"Padel Milano Club",     sport:"padel",      city:"Milan",        country:"Italie",     mapX:47.8, mapY:27.6, lat:45.469, lng:9.181,    surface:"Gazon synthétique", lights:true,  free:false, price:"17€/h",  rating:4.7, players:18,  phone:"+39 02 8905 4444" },
  { id:133,name:"Padel Stockholm",       sport:"padel",      city:"Stockholm",    country:"Suède",      mapX:49.7, mapY:22.5, lat:59.310, lng:18.060,   surface:"Gazon synthétique", lights:true,  free:false, price:"14€/h",  rating:4.6, players:16,  phone:"+46 8 410 390 00" },
  { id:134,name:"Padel Köln Center",     sport:"padel",      city:"Cologne",      country:"Allemagne",  mapX:47.6, mapY:25.8, lat:50.938, lng:6.960,    surface:"Gazon synthétique", lights:true,  free:false, price:"15€/h",  rating:4.5, players:14,  phone:"+49 221 777 6600" },
  { id:135,name:"Padel Buenos Aires",    sport:"padel",      city:"Buenos Aires", country:"Argentine",  mapX:30.6, mapY:57.3, lat:-34.607,lng:-58.387,  surface:"Gazon synthétique", lights:true,  free:false, price:"8€/h",   rating:4.7, players:20,  phone:"+54 11 4779 6600" },
  { id:136,name:"Padel São Paulo",       sport:"padel",      city:"São Paulo",    country:"Brésil",     mapX:34.4, mapY:52.3, lat:-23.556,lng:-46.662,  surface:"Gazon synthétique", lights:true,  free:false, price:"10€/h",  rating:4.6, players:18,  phone:"+55 11 3816 9800" },
  { id:137,name:"Riyadh Padel Club",     sport:"padel",      city:"Riyad",        country:"Arabie S.",  mapX:56.5, mapY:35.0, lat:24.710, lng:46.675,   surface:"Gazon synthétique", lights:true,  free:false, price:"20€/h",  rating:4.7, players:16,  phone:"+966 11 465 4477" },
  // ── VOLLEYBALL ───────────────────────────────────────────────────────────────
  { id:138,name:"Paris Plage Volley",    sport:"volleyball", city:"Paris",        country:"France",     mapX:46.3, mapY:27.9, lat:48.860, lng:2.349,    surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.7, players:80,  phone:null },
  { id:139,name:"Piazza Volley Roma",    sport:"volleyball", city:"Rome",         country:"Italie",     mapX:47.9, mapY:30.2, lat:41.901, lng:12.498,   surface:"Béton",             lights:true,  free:true,  price:"Gratuit",rating:4.6, players:65,  phone:null },
  { id:140,name:"Bondi Beach Volley",    sport:"volleyball", city:"Sydney",       country:"Australie",  mapX:82.7, mapY:56.6, lat:-33.891,lng:151.277,  surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.9, players:110, phone:null },
  { id:141,name:"Rio Sul Volley",        sport:"volleyball", city:"Rio",          country:"Brésil",     mapX:33.7, mapY:52.2, lat:-22.985,lng:-43.201,  surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.9, players:130, phone:null },
  { id:142,name:"Waikiki Beach Volley",  sport:"volleyball", city:"Honolulu",     country:"USA",        mapX:12.5, mapY:35.6, lat:21.277, lng:-157.824, surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.9, players:95,  phone:null },
  { id:143,name:"Bangkok Volley Arena",  sport:"volleyball", city:"Bangkok",      country:"Thaïlande",  mapX:69.4, mapY:39.0, lat:13.751, lng:100.512,  surface:"Parquet",           lights:true,  free:false, price:"3€/h",   rating:4.5, players:48,  phone:"+66 2 641 7222" },
  { id:144,name:"Lagos Ocean Volley",    sport:"volleyball", city:"Lagos",        country:"Nigeria",    mapX:46.5, mapY:41.7, lat:6.449,  lng:3.397,    surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.5, players:70,  phone:null },
  // ── BADMINTON ────────────────────────────────────────────────────────────────
  { id:145,name:"Smash Club Paris",      sport:"badminton",  city:"Paris",        country:"France",     mapX:46.4, mapY:28.0, lat:48.875, lng:2.332,    surface:"Parquet",           lights:true,  free:false, price:"9€/h",   rating:4.7, players:36,  phone:"+33 1 42 52 48 48" },
  { id:146,name:"London Badminton Hub",  sport:"badminton",  city:"Londres",      country:"UK",         mapX:45.3, mapY:25.6, lat:51.498, lng:-0.147,   surface:"Parquet",           lights:true,  free:false, price:"11€/h",  rating:4.6, players:30,  phone:"+44 20 7793 0600" },
  { id:147,name:"Jakarta Badminton Hall",sport:"badminton",  city:"Jakarta",      country:"Indonésie",  mapX:70.7, mapY:45.1, lat:-6.201, lng:106.816,  surface:"Parquet",           lights:true,  free:false, price:"3€/h",   rating:4.8, players:64,  phone:"+62 21 525 4686" },
  { id:148,name:"Guangzhou Badminton",   sport:"badminton",  city:"Guangzhou",    country:"Chine",      mapX:72.4, mapY:35.6, lat:23.118, lng:113.288,  surface:"Parquet",           lights:true,  free:false, price:"2€/h",   rating:4.7, players:58,  phone:"+86 20 3811 1800" },
  { id:149,name:"Mumbai Badminton Club", sport:"badminton",  city:"Mumbai",       country:"Inde",       mapX:62.8, mapY:37.1, lat:19.020, lng:72.855,   surface:"Parquet",           lights:true,  free:false, price:"2€/h",   rating:4.6, players:50,  phone:"+91 22 2281 9555" },
  { id:150,name:"Kuala Lumpur Smash",    sport:"badminton",  city:"Kuala Lumpur", country:"Malaisie",   mapX:73.3, mapY:40.6, lat:3.160,  lng:101.712,  surface:"Parquet",           lights:true,  free:false, price:"3€/h",   rating:4.9, players:70,  phone:"+60 3 4145 3499" },
  // ── PING-PONG ────────────────────────────────────────────────────────────────
  { id:151,name:"Ping Pong Club Paris",  sport:"pingpong",   city:"Paris",        country:"France",     mapX:46.3, mapY:28.2, lat:48.867, lng:2.341,    surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.6, players:40,  phone:"+33 1 42 77 43 10" },
  { id:152,name:"Table Tennis London",   sport:"pingpong",   city:"Londres",      country:"UK",         mapX:45.1, mapY:25.7, lat:51.519, lng:-0.126,   surface:"Parquet",           lights:true,  free:false, price:"7€/h",   rating:4.5, players:32,  phone:"+44 20 7436 3004" },
  { id:153,name:"Chengdu Table Tennis",  sport:"pingpong",   city:"Chengdu",      country:"Chine",      mapX:70.8, mapY:33.4, lat:30.657, lng:104.066,  surface:"Parquet",           lights:true,  free:false, price:"1€/h",   rating:4.8, players:90,  phone:"+86 28 8665 5566" },
  { id:154,name:"Tokyo Ping-Pong Hub",   sport:"pingpong",   city:"Tokyo",        country:"Japon",      mapX:78.6, mapY:29.6, lat:35.697, lng:139.774,  surface:"Parquet",           lights:true,  free:false, price:"8€/h",   rating:4.9, players:60,  phone:"+81 3 5312 8877" },
  { id:155,name:"São Paulo TT Arena",    sport:"pingpong",   city:"São Paulo",    country:"Brésil",     mapX:34.5, mapY:52.4, lat:-23.545,lng:-46.618,  surface:"Parquet",           lights:true,  free:false, price:"3€/h",   rating:4.5, players:44,  phone:"+55 11 3063 8800" },
  // ── RUGBY ────────────────────────────────────────────────────────────────────
  { id:156,name:"Stade Chaban-Delmas",   sport:"rugby",      city:"Bordeaux",     country:"France",     mapX:45.9, mapY:28.2, lat:44.828, lng:-0.612,   surface:"Gazon naturel",     lights:true,  free:false, price:"12€/h",  rating:4.7, players:40,  phone:"+33 5 56 24 22 22" },
  { id:157,name:"Twickenham Training",   sport:"rugby",      city:"Londres",      country:"UK",         mapX:45.1, mapY:25.9, lat:51.456, lng:-0.341,   surface:"Gazon naturel",     lights:true,  free:false, price:"18€/h",  rating:4.8, players:35,  phone:"+44 20 8892 8161" },
  { id:158,name:"Stade Geoffroy Guichard",sport:"rugby",     city:"Saint-Étienne",country:"France",     mapX:46.7, mapY:28.0, lat:45.460, lng:4.390,    surface:"Gazon naturel",     lights:true,  free:false, price:"10€/h",  rating:4.5, players:32,  phone:"+33 4 77 92 25 35" },
  { id:159,name:"Newlands Rugby Ground", sport:"rugby",      city:"Le Cap",       country:"Afr. du Sud",mapX:49.8, mapY:56.0, lat:-33.968,lng:18.469,   surface:"Gazon naturel",     lights:true,  free:false, price:"7€/h",   rating:4.6, players:38,  phone:"+27 21 659 4600" },
  { id:160,name:"Sydney Rugby Park",     sport:"rugby",      city:"Sydney",       country:"Australie",  mapX:82.6, mapY:56.3, lat:-33.890,lng:151.191,  surface:"Gazon naturel",     lights:true,  free:false, price:"10€/h",  rating:4.6, players:30,  phone:"+61 2 8234 4000" },
  { id:161,name:"Wellington RFC Ground", sport:"rugby",      city:"Wellington",   country:"N.-Zélande", mapX:86.3, mapY:59.5, lat:-41.280,lng:174.775,  surface:"Gazon naturel",     lights:true,  free:false, price:"9€/h",   rating:4.7, players:28,  phone:"+64 4 384 7493" },
  // ── TERRAINS MIXTES / FRANCE ─────────────────────────────────────────────────
  { id:162,name:"Complexe Joseph Régis", sport:"football",   city:"Toulouse",     country:"France",     mapX:46.1, mapY:28.4, lat:43.604, lng:1.444,    surface:"Gazon synthétique", lights:true,  free:false, price:"9€/h",   rating:4.5, players:42,  phone:"+33 5 61 22 79 00" },
  { id:163,name:"Terrain Saint-Exupéry", sport:"football",   city:"Nantes",       country:"France",     mapX:45.5, mapY:27.9, lat:47.218, lng:-1.553,   surface:"Gazon naturel",     lights:false, free:true,  price:"Gratuit",rating:4.4, players:38,  phone:null },
  { id:164,name:"Stade Vélodrome Junior",sport:"football",   city:"Marseille",    country:"France",     mapX:46.9, mapY:28.4, lat:43.272, lng:5.381,    surface:"Gazon synthétique", lights:true,  free:false, price:"10€/h",  rating:4.6, players:44,  phone:"+33 4 91 76 56 10" },
  { id:165,name:"Padel Toulouse Sud",    sport:"padel",      city:"Toulouse",     country:"France",     mapX:46.1, mapY:28.5, lat:43.589, lng:1.465,    surface:"Gazon synthétique", lights:true,  free:false, price:"16€/h",  rating:4.6, players:20,  phone:"+33 5 34 41 19 19" },
  { id:166,name:"Court Bordeaux Lac",    sport:"tennis",     city:"Bordeaux",     country:"France",     mapX:46.0, mapY:28.1, lat:44.877, lng:-0.573,   surface:"Terre battue",      lights:true,  free:false, price:"8€/h",   rating:4.5, players:16,  phone:"+33 5 56 17 23 60" },
  { id:167,name:"Basket Rennes Centre",  sport:"basketball", city:"Rennes",       country:"France",     mapX:45.4, mapY:27.6, lat:48.117, lng:-1.677,   surface:"Parquet",           lights:true,  free:false, price:"6€/h",   rating:4.4, players:30,  phone:"+33 2 99 67 32 32" },
  { id:168,name:"Volley Montpellier Plage",sport:"volleyball",city:"Montpellier", country:"France",     mapX:46.5, mapY:28.8, lat:43.610, lng:3.877,    surface:"Sable",             lights:false, free:true,  price:"Gratuit",rating:4.6, players:58,  phone:null },
  { id:169,name:"Rugby Clermont Park",   sport:"rugby",      city:"Clermont-Fd",  country:"France",     mapX:46.7, mapY:28.3, lat:45.780, lng:3.087,    surface:"Gazon naturel",     lights:true,  free:false, price:"7€/h",   rating:4.7, players:34,  phone:"+33 4 73 93 85 85" },
  { id:170,name:"Futsal Strasbourg Est", sport:"football",   city:"Strasbourg",   country:"France",     mapX:47.3, mapY:27.0, lat:48.573, lng:7.752,    surface:"Synthétique",       lights:true,  free:false, price:"9€/h",   rating:4.4, players:28,  phone:"+33 3 88 79 80 80" },
  // ── FOOT À 5 – France ─────────────────────────────────────────────────────────
  { id:171,name:"Urban Soccer Paris 12",  sport:"football",   city:"Paris",        country:"France",     mapX:46.4, mapY:28.3, lat:48.836, lng:2.392,    surface:"Synthétique",       lights:true,  free:false, price:"14€/h",  rating:4.7, players:48,  phone:"+33 1 43 07 79 70" },
  { id:172,name:"Urban Soccer Paris 19",  sport:"football",   city:"Paris",        country:"France",     mapX:46.4, mapY:28.1, lat:48.893, lng:2.388,    surface:"Synthétique",       lights:true,  free:false, price:"14€/h",  rating:4.6, players:44,  phone:"+33 1 40 37 99 18" },
  { id:173,name:"Urban Soccer Paris 15",  sport:"football",   city:"Paris",        country:"France",     mapX:46.2, mapY:28.4, lat:48.839, lng:2.291,    surface:"Synthétique",       lights:true,  free:false, price:"14€/h",  rating:4.5, players:40,  phone:"+33 1 53 98 01 10" },
  { id:174,name:"Five Paris Montmartre",  sport:"football",   city:"Paris",        country:"France",     mapX:46.3, mapY:28.1, lat:48.884, lng:2.341,    surface:"Synthétique",       lights:true,  free:false, price:"13€/h",  rating:4.8, players:56,  phone:"+33 1 42 54 87 20" },
  { id:175,name:"Five Paris République",  sport:"football",   city:"Paris",        country:"France",     mapX:46.3, mapY:28.2, lat:48.866, lng:2.363,    surface:"Synthétique",       lights:true,  free:false, price:"13€/h",  rating:4.7, players:52,  phone:"+33 1 44 54 00 30" },
  { id:176,name:"Five Paris Nation",      sport:"football",   city:"Paris",        country:"France",     mapX:46.4, mapY:28.3, lat:48.851, lng:2.397,    surface:"Synthétique",       lights:true,  free:false, price:"13€/h",  rating:4.6, players:46,  phone:"+33 1 43 72 50 50" },
  { id:177,name:"Footinho Paris 11",      sport:"football",   city:"Paris",        country:"France",     mapX:46.3, mapY:28.3, lat:48.857, lng:2.373,    surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.6, players:42,  phone:"+33 1 43 57 40 62" },
  { id:178,name:"Urban Soccer Lyon Part-Dieu",sport:"football",city:"Lyon",        country:"France",     mapX:46.7, mapY:28.1, lat:45.762, lng:4.860,    surface:"Synthétique",       lights:true,  free:false, price:"13€/h",  rating:4.7, players:50,  phone:"+33 4 72 74 35 35" },
  { id:179,name:"Five Lyon Vaise",        sport:"football",   city:"Lyon",         country:"France",     mapX:46.6, mapY:28.0, lat:45.773, lng:4.802,    surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.6, players:44,  phone:"+33 4 78 83 61 61" },
  { id:180,name:"Urban Soccer Marseille", sport:"football",   city:"Marseille",    country:"France",     mapX:46.9, mapY:28.5, lat:43.309, lng:5.380,    surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.6, players:46,  phone:"+33 4 91 62 90 90" },
  { id:181,name:"Five Marseille Prado",   sport:"football",   city:"Marseille",    country:"France",     mapX:46.9, mapY:28.6, lat:43.264, lng:5.395,    surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.7, players:48,  phone:"+33 4 91 25 01 45" },
  { id:182,name:"Urban Soccer Bordeaux",  sport:"football",   city:"Bordeaux",     country:"France",     mapX:45.9, mapY:28.2, lat:44.855, lng:-0.546,   surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.6, players:42,  phone:"+33 5 56 39 94 94" },
  { id:183,name:"Five Bordeaux Bacalan",  sport:"football",   city:"Bordeaux",     country:"France",     mapX:45.9, mapY:28.1, lat:44.865, lng:-0.564,   surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.5, players:40,  phone:"+33 5 56 11 29 29" },
  { id:184,name:"Urban Soccer Toulouse",  sport:"football",   city:"Toulouse",     country:"France",     mapX:46.1, mapY:28.4, lat:43.618, lng:1.436,    surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.6, players:44,  phone:"+33 5 61 40 01 01" },
  { id:185,name:"Five Toulouse Capitole", sport:"football",   city:"Toulouse",     country:"France",     mapX:46.1, mapY:28.4, lat:43.600, lng:1.447,    surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.5, players:38,  phone:"+33 5 62 27 87 87" },
  { id:186,name:"Five Nice Côte d'Azur",  sport:"football",   city:"Nice",         country:"France",     mapX:47.1, mapY:28.5, lat:43.707, lng:7.244,    surface:"Synthétique",       lights:true,  free:false, price:"13€/h",  rating:4.6, players:40,  phone:"+33 4 93 62 14 14" },
  { id:187,name:"Five Lille Euralille",   sport:"football",   city:"Lille",        country:"France",     mapX:46.3, mapY:27.0, lat:50.637, lng:3.072,    surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.5, players:42,  phone:"+33 3 20 30 49 49" },
  { id:188,name:"Five Nantes Île",        sport:"football",   city:"Nantes",       country:"France",     mapX:45.5, mapY:27.9, lat:47.204, lng:-1.560,   surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.5, players:36,  phone:"+33 2 40 89 47 47" },
  { id:189,name:"Five Montpellier",       sport:"football",   city:"Montpellier",  country:"France",     mapX:46.5, mapY:28.8, lat:43.613, lng:3.882,    surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.6, players:38,  phone:"+33 4 67 02 22 22" },
  { id:190,name:"MFoot Paris 14",         sport:"football",   city:"Paris",        country:"France",     mapX:46.2, mapY:28.4, lat:48.827, lng:2.325,    surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.5, players:36,  phone:"+33 1 45 39 60 60" },
  // ── TENNIS CLUBS – France ─────────────────────────────────────────────────────
  { id:191,name:"Tennis Club de Paris",   sport:"tennis",     city:"Paris",        country:"France",     mapX:46.0, mapY:28.4, lat:48.840, lng:2.233,    surface:"Terre battue",      lights:true,  free:false, price:"25€/h",  rating:4.8, players:10,  phone:"+33 1 47 43 99 00" },
  { id:192,name:"Racing Club France Tennis",sport:"tennis",   city:"Paris",        country:"France",     mapX:46.1, mapY:28.3, lat:48.852, lng:2.265,    surface:"Gazon",             lights:true,  free:false, price:"22€/h",  rating:4.9, players:8,   phone:"+33 1 45 27 26 26" },
  { id:193,name:"Paris Université Club",  sport:"tennis",     city:"Paris",        country:"France",     mapX:46.1, mapY:28.4, lat:48.843, lng:2.298,    surface:"Terre battue",      lights:true,  free:false, price:"18€/h",  rating:4.7, players:12,  phone:"+33 1 42 73 32 32" },
  { id:194,name:"Stade Français Tennis",  sport:"tennis",     city:"Paris",        country:"France",     mapX:46.1, mapY:28.2, lat:48.856, lng:2.270,    surface:"Gazon synthétique", lights:true,  free:false, price:"20€/h",  rating:4.7, players:10,  phone:"+33 1 44 14 44 14" },
  { id:195,name:"Tennis Club Neuilly",    sport:"tennis",     city:"Neuilly",      country:"France",     mapX:46.1, mapY:28.2, lat:48.885, lng:2.266,    surface:"Terre battue",      lights:true,  free:false, price:"18€/h",  rating:4.6, players:14,  phone:"+33 1 47 22 58 58" },
  { id:196,name:"Lyon Tennis & Padel",    sport:"tennis",     city:"Lyon",         country:"France",     mapX:46.6, mapY:28.1, lat:45.749, lng:4.831,    surface:"Dur",               lights:true,  free:false, price:"14€/h",  rating:4.6, players:16,  phone:"+33 4 78 89 22 22" },
  { id:197,name:"TC Marseille La Plage",  sport:"tennis",     city:"Marseille",    country:"France",     mapX:46.9, mapY:28.6, lat:43.252, lng:5.373,    surface:"Terre battue",      lights:true,  free:false, price:"12€/h",  rating:4.5, players:18,  phone:"+33 4 91 76 11 11" },
  { id:198,name:"Tennis Club Bordeaux",   sport:"tennis",     city:"Bordeaux",     country:"France",     mapX:46.0, mapY:28.2, lat:44.836, lng:-0.578,   surface:"Terre battue",      lights:true,  free:false, price:"13€/h",  rating:4.5, players:16,  phone:"+33 5 56 44 24 24" },
  { id:199,name:"Toulouse Tennis Club",   sport:"tennis",     city:"Toulouse",     country:"France",     mapX:46.1, mapY:28.5, lat:43.587, lng:1.460,    surface:"Terre battue",      lights:true,  free:false, price:"12€/h",  rating:4.6, players:14,  phone:"+33 5 61 53 78 78" },
  { id:200,name:"Nice Tennis Academy",    sport:"tennis",     city:"Nice",         country:"France",     mapX:47.1, mapY:28.6, lat:43.695, lng:7.253,    surface:"Terre battue",      lights:true,  free:false, price:"15€/h",  rating:4.7, players:12,  phone:"+33 4 93 96 15 15" },
  { id:201,name:"Lille Tennis Club",      sport:"tennis",     city:"Lille",        country:"France",     mapX:46.2, mapY:27.0, lat:50.621, lng:3.054,    surface:"Dur",               lights:true,  free:false, price:"11€/h",  rating:4.4, players:16,  phone:"+33 3 20 54 33 33" },
  { id:202,name:"Nantes Tennis",          sport:"tennis",     city:"Nantes",       country:"France",     mapX:45.5, mapY:27.8, lat:47.231, lng:-1.543,   surface:"Terre battue",      lights:true,  free:false, price:"10€/h",  rating:4.4, players:18,  phone:"+33 2 40 35 57 57" },
  { id:203,name:"TC Montpellier Richter", sport:"tennis",     city:"Montpellier",  country:"France",     mapX:46.5, mapY:28.7, lat:43.622, lng:3.865,    surface:"Terre battue",      lights:true,  free:false, price:"11€/h",  rating:4.5, players:20,  phone:"+33 4 67 64 45 45" },
  { id:204,name:"Strasbourg Tennis Club", sport:"tennis",     city:"Strasbourg",   country:"France",     mapX:47.3, mapY:27.0, lat:48.567, lng:7.737,    surface:"Dur",               lights:true,  free:false, price:"12€/h",  rating:4.4, players:16,  phone:"+33 3 88 34 66 66" },
  { id:205,name:"Rennes Tennis Métropole",sport:"tennis",     city:"Rennes",       country:"France",     mapX:45.4, mapY:27.6, lat:48.123, lng:-1.693,   surface:"Terre battue",      lights:true,  free:false, price:"10€/h",  rating:4.5, players:18,  phone:"+33 2 99 86 44 44" },
  // ── GYMNASES BASKET – France ──────────────────────────────────────────────────
  { id:206,name:"Gymnase Marcel Cerdan",  sport:"basketball", city:"Levallois",    country:"France",     mapX:46.2, mapY:28.2, lat:48.893, lng:2.289,    surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.5, players:36,  phone:"+33 1 41 27 32 32" },
  { id:207,name:"Gymnase Japy",           sport:"basketball", city:"Paris",        country:"France",     mapX:46.3, mapY:28.3, lat:48.853, lng:2.368,    surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.4, players:32,  phone:"+33 1 55 25 75 50" },
  { id:208,name:"Gymnase Pierre Coubertin",sport:"basketball",city:"Paris",        country:"France",     mapX:46.1, mapY:28.3, lat:48.840, lng:2.261,    surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.6, players:40,  phone:"+33 1 44 26 28 00" },
  { id:209,name:"Gymnase Halle Carpentier",sport:"basketball",city:"Paris",        country:"France",     mapX:46.3, mapY:28.4, lat:48.825, lng:2.359,    surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.5, players:34,  phone:"+33 1 44 16 40 00" },
  { id:210,name:"Palais Gerland Basket",  sport:"basketball", city:"Lyon",         country:"France",     mapX:46.7, mapY:28.2, lat:45.731, lng:4.830,    surface:"Parquet",           lights:true,  free:false, price:"6€/h",   rating:4.6, players:44,  phone:"+33 4 72 76 88 88" },
  { id:211,name:"Gymnase Bergson Lyon",   sport:"basketball", city:"Lyon",         country:"France",     mapX:46.6, mapY:28.1, lat:45.764, lng:4.818,    surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.4, players:32,  phone:"+33 4 78 43 55 55" },
  { id:212,name:"Palais Sports Marseille",sport:"basketball", city:"Marseille",    country:"France",     mapX:46.9, mapY:28.5, lat:43.290, lng:5.370,    surface:"Parquet",           lights:true,  free:false, price:"6€/h",   rating:4.5, players:48,  phone:"+33 4 91 71 45 00" },
  { id:213,name:"Arena Bordeaux Basket",  sport:"basketball", city:"Bordeaux",     country:"France",     mapX:45.9, mapY:28.3, lat:44.841, lng:-0.570,   surface:"Parquet",           lights:true,  free:false, price:"6€/h",   rating:4.6, players:42,  phone:"+33 5 56 01 67 67" },
  { id:214,name:"Gymnase Jolimont Toulouse",sport:"basketball",city:"Toulouse",    country:"France",     mapX:46.2, mapY:28.5, lat:43.608, lng:1.469,    surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.4, players:36,  phone:"+33 5 61 22 20 20" },
  { id:215,name:"Gymnase Magnan Nice",    sport:"basketball", city:"Nice",         country:"France",     mapX:47.0, mapY:28.5, lat:43.700, lng:7.219,    surface:"Parquet",           lights:true,  free:false, price:"5€/h",   rating:4.4, players:30,  phone:"+33 4 93 44 51 51" },
  { id:216,name:"Gymnase Nantes Coubertin",sport:"basketball",city:"Nantes",       country:"France",     mapX:45.5, mapY:27.9, lat:47.215, lng:-1.547,   surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.4, players:34,  phone:"+33 2 40 41 89 89" },
  { id:217,name:"Stade Coubertin Lille",  sport:"basketball", city:"Lille",        country:"France",     mapX:46.2, mapY:27.0, lat:50.633, lng:3.060,    surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.4, players:32,  phone:"+33 3 28 52 75 75" },
  { id:218,name:"Gymnase Meinau Strasbourg",sport:"basketball",city:"Strasbourg",  country:"France",     mapX:47.3, mapY:27.1, lat:48.556, lng:7.761,    surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.3, players:28,  phone:"+33 3 88 77 77 77" },
  { id:219,name:"Gymnase Richter Montpellier",sport:"basketball",city:"Montpellier",country:"France",    mapX:46.5, mapY:28.8, lat:43.627, lng:3.871,    surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.5, players:36,  phone:"+33 4 67 60 30 30" },
  { id:220,name:"Gymnase Cleunay Rennes", sport:"basketball", city:"Rennes",       country:"France",     mapX:45.4, mapY:27.6, lat:48.104, lng:-1.701,   surface:"Parquet",           lights:true,  free:false, price:"4€/h",   rating:4.4, players:30,  phone:"+33 2 23 62 13 13" },
  // ── FOOT À 5 – International ──────────────────────────────────────────────────
  { id:221,name:"PowerLeague London",     sport:"football",   city:"Londres",      country:"UK",         mapX:45.3, mapY:25.6, lat:51.515, lng:-0.087,   surface:"Synthétique",       lights:true,  free:false, price:"16€/h",  rating:4.7, players:54,  phone:"+44 20 7790 3900" },
  { id:222,name:"Goals Soccer London",    sport:"football",   city:"Londres",      country:"UK",         mapX:45.3, mapY:25.7, lat:51.483, lng:-0.223,   surface:"Synthétique",       lights:true,  free:false, price:"15€/h",  rating:4.6, players:48,  phone:"+44 20 8749 4444" },
  { id:223,name:"Foot 5 Madrid",          sport:"football",   city:"Madrid",       country:"Espagne",    mapX:44.7, mapY:31.0, lat:40.448, lng:-3.699,   surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.6, players:44,  phone:"+34 91 547 22 22" },
  { id:224,name:"Futbol 5 Barcelone",     sport:"football",   city:"Barcelone",    country:"Espagne",    mapX:45.7, mapY:30.6, lat:41.398, lng:2.193,    surface:"Synthétique",       lights:true,  free:false, price:"12€/h",  rating:4.7, players:50,  phone:"+34 93 415 88 88" },
  { id:225,name:"Calcetto Milano",        sport:"football",   city:"Milan",        country:"Italie",     mapX:47.7, mapY:27.7, lat:45.487, lng:9.195,    surface:"Synthétique",       lights:true,  free:false, price:"14€/h",  rating:4.5, players:42,  phone:"+39 02 6680 4444" },
  { id:226,name:"Futsal Berlin Mitte",    sport:"football",   city:"Berlin",       country:"Allemagne",  mapX:47.6, mapY:25.1, lat:52.519, lng:13.401,   surface:"Synthétique",       lights:true,  free:false, price:"13€/h",  rating:4.5, players:40,  phone:"+49 30 2802 4444" },
  { id:227,name:"Futsal Bruxelles",       sport:"football",   city:"Bruxelles",    country:"Belgique",   mapX:46.5, mapY:25.6, lat:50.856, lng:4.352,    surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.5, players:38,  phone:"+32 2 512 44 44" },
  { id:228,name:"Zaalvoetbal Amsterdam",  sport:"football",   city:"Amsterdam",    country:"Pays-Bas",   mapX:46.6, mapY:25.1, lat:52.373, lng:4.893,    surface:"Synthétique",       lights:true,  free:false, price:"11€/h",  rating:4.6, players:42,  phone:"+31 20 622 44 44" },
];

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
  { id:"builder",    emoji:"🏗️", name:"Bâtisseur",  desc:"Créer des terrains",     tiers:[{min:5,medal:"🥉",label:"Bronze"},{min:15,medal:"🥈",label:"Argent"},{min:30,medal:"🥇",label:"Or"}],    stat:u=>u.terrains||0 },
  { id:"explorer",   emoji:"🌍", name:"Explorateur", desc:"Visiter plusieurs villes", tiers:[{min:5,medal:"🥉",label:"Bronze"},{min:15,medal:"🥈",label:"Argent"},{min:30,medal:"🥇",label:"Or"}],    stat:u=>u.citiesVisited||0 },
  { id:"competitor", emoji:"⚽", name:"Compétiteur", desc:"Jouer des matchs",         tiers:[{min:10,medal:"🥉",label:"Bronze"},{min:30,medal:"🥈",label:"Argent"},{min:75,medal:"🥇",label:"Or"}],   stat:u=>u.matchs||0 },
  { id:"recruiter",  emoji:"🤝", name:"Recruteur",   desc:"Parrainer des amis",       tiers:[{min:3,medal:"🥉",label:"Bronze"},{min:10,medal:"🥈",label:"Argent"},{min:25,medal:"🥇",label:"Or"}],    stat:u=>u.referralCount||0 },
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
const DB = [
  { id:"u1", email:"demo@rvf.app",   password:"demo123", name:"Alex Martin", city:"Paris",   level:"Intermédiaire", sports:["football","basketball"],     bio:"Passionné de foot et basket.",       avatar:null, phone:"", verified:true,  terrains:3, matchs:38, teams:2, citiesVisited:5,  xp:2100,  nameColor:"#4DABF7", record:{ football:{w:18,l:12}, basketball:{w:6,l:2} }, referralCode:"ALEX1234", referralCount:12 },
  { id:"u2", email:"lucas@rvf.app",  password:"pass",    name:"Lucas M.",    city:"Paris",   level:"Amateur",       sports:["football"],                  bio:"Footeux du dimanche ⚽",              avatar:null, phone:"", verified:true,  terrains:1, matchs:12, teams:1, citiesVisited:1,  xp:450,   nameColor:null,      record:{ football:{w:5,l:7} },                                   referralCode:"LUCAS001", referralCount:2  },
  { id:"u3", email:"sara@rvf.app",   password:"pass",    name:"Sara K.",     city:"Berlin",  level:"Confirmé",      sports:["tennis","padel"],            bio:"Passionnée de tennis et padel.",     avatar:null, phone:"", verified:true,  terrains:2, matchs:28, teams:1, citiesVisited:4,  xp:1600,  nameColor:"#51CF66", record:{ tennis:{w:19,l:5}, padel:{w:3,l:1} },                  referralCode:"SARA2024", referralCount:11 },
  { id:"u4", email:"tom@rvf.app",    password:"pass",    name:"Tom B.",      city:"Londres", level:"Intermédiaire", sports:["rugby","football"],          bio:"Rugby player from London.",          avatar:null, phone:"", verified:false, terrains:0, matchs:15, teams:2, citiesVisited:2,  xp:700,   nameColor:null,      record:{ rugby:{w:9,l:4}, football:{w:1,l:1} },                   referralCode:"TOM2024",  referralCount:0  },
  { id:"u5", email:"jade@rvf.app",   password:"pass",    name:"Jade R.",     city:"Rio",     level:"Expert",        sports:["volleyball","football"],     bio:"Carioca dans l'âme 🌊",              avatar:null, phone:"", verified:true,  terrains:5, matchs:67, teams:3, citiesVisited:8,  xp:5600,  nameColor:"#CC5DE8", record:{ volleyball:{w:42,l:10}, football:{w:12,l:3} },          referralCode:"JADE2024", referralCount:27 },
  { id:"u6", email:"carlos@rvf.app", password:"pass",    name:"Carlos M.",   city:"Madrid",  level:"Confirmé",      sports:["padel","football","tennis"], bio:"Padel lover & football fanatic.",    avatar:null, phone:"", verified:true,  terrains:3, matchs:45, teams:2, citiesVisited:6,  xp:22000, nameColor:"gold",    record:{ padel:{w:20,l:8}, football:{w:14,l:2}, tennis:{w:1,l:0} }, referralCode:"CARLOS24", referralCount:53 },
  { id:"u7", email:"noe@rvf.app",    password:"pass",    name:"Noé V.",      city:"Tokyo",   level:"Amateur",       sports:["basketball","pingpong"],     bio:"Tokyo baller 🏀🏓",                  avatar:null, phone:"", verified:false, terrains:1, matchs:9,  teams:1, citiesVisited:1,  xp:200,   nameColor:null,      record:{ basketball:{w:5,l:4}, pingpong:{w:0,l:0} },              referralCode:"NOE2024",  referralCount:0  },
];

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
  // Try Supabase auth first
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
  if (!error && data.user) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
    return profile || { id: data.user.id, email, name: data.user.user_metadata?.name || email, terrains: 0, matchs: 0, teams: 0, avatar: null };
  }
  // Fallback: Express backend
  if (await backendOnline()) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pwd }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Connexion échouée.');
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
      await supabase.from('profiles').update({ referral_count:referrer.referralCount }).eq('id',referrer.id);
    } else {
      // referrer is a Supabase-only user
      const { data:rp } = await supabase.from('profiles').select('id,referral_count').eq('referral_code',refCode).single();
      if (rp) await supabase.from('profiles').update({ referral_count:(rp.referral_count||0)+1 }).eq('id',rp.id);
    }
  };

  // Try Supabase auth first
  const { data, error } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,
    options: { data: { name: form.name } },
  });
  if (!error && data.user) {
    const profile = { id: data.user.id, name: form.name, city: form.city, sports: form.sports, level: form.level, phone: form.phone, email: form.email, verified: false, role: 'user', terrains: 0, matchs: 0, teams: 0, avatar: null, referral_code: referralCode, referral_count: 0, referred_by: refCode||null };
    await supabase.from('profiles').upsert(profile);
    await creditReferrer(data.user.id);
    return profile;
  }
  // Fallback: Express backend
  if (await backendOnline()) {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Inscription échouée.');
    localStorage.setItem('rvf_token', d.token);
    return d.user;
  }
  // Fallback: local mock DB
  await pause(500);
  if (DB.find(u => u.email === form.email)) throw new Error('Email déjà utilisé.');
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

// Messages
const CHAT = createStore({ convs:{} });
CHAT.cid = (a,b) => [a,b].sort().join("::");
CHAT.send = (from, to, text) => {
  const id = CHAT.cid(from,to);
  if (!CHAT.convs[id]) CHAT.convs[id] = [];
  CHAT.convs[id].push({ id:Date.now(), from, text, ts:new Date().toISOString(), read:false });
  CHAT.notify();
};
CHAT.markRead = (cid, user) => {
  if (!CHAT.convs[cid]) return;
  CHAT.convs[cid] = CHAT.convs[cid].map(m => m.from!==user ? {...m,read:true} : m);
  CHAT.notify();
};
CHAT.list = user => Object.entries(CHAT.convs)
  .filter(([id]) => id.includes(user))
  .map(([id,msgs]) => ({
    id, msgs,
    other: id.split("::").find(n=>n!==user),
    last: msgs[msgs.length-1],
    unread: msgs.filter(m=>m.from!==user&&!m.read).length,
  }))
  .sort((a,b) => new Date(b.last?.ts||0)-new Date(a.last?.ts||0));
CHAT.totalUnread = user => Object.entries(CHAT.convs)
  .filter(([id]) => id.includes(user))
  .reduce((s,[,msgs]) => s+msgs.filter(m=>m.from!==user&&!m.read).length, 0);

// Team chat (group messages per team)
const TEAM_CHAT = createStore({ byTeam:{}, lastRead:{} });
TEAM_CHAT.send = (teamId, userId, userName, text) => {
  const msgs = TEAM_CHAT.byTeam[teamId] || [];
  TEAM_CHAT.byTeam[teamId] = [...msgs, { id:`tc_${Date.now()}`, userId, from:userName, text, ts:new Date().toISOString() }];
  TEAM_CHAT.notify();
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

// Friends
const FRIENDS = createStore({ byUser:{} });
FRIENDS.add = (myId, theirId) => {
  if (!FRIENDS.byUser[myId]) FRIENDS.byUser[myId] = [];
  if (!FRIENDS.byUser[myId].includes(theirId)) {
    FRIENDS.byUser[myId] = [...FRIENDS.byUser[myId], theirId];
    FRIENDS.notify();
  }
};
FRIENDS.remove = (myId, theirId) => {
  if (!FRIENDS.byUser[myId]) return;
  FRIENDS.byUser[myId] = FRIENDS.byUser[myId].filter(id=>id!==theirId);
  FRIENDS.notify();
};
FRIENDS.has    = (myId, theirId) => (FRIENDS.byUser[myId]||[]).includes(theirId);
FRIENDS.list   = myId => FRIENDS.byUser[myId] || [];

// Friend requests
const FRIEND_REQ = createStore({ list:[] });
let _frCounter = 0;
FRIEND_REQ.send = (fromId, fromName, toId) => {
  if (FRIEND_REQ.list.some(r=>r.fromId===fromId&&r.toId===toId&&r.status==="pending")) return;
  FRIEND_REQ.list = [...FRIEND_REQ.list, { id:`fr_${Date.now()}_${++_frCounter}`, fromId, fromName, toId, status:"pending", ts:new Date().toISOString() }];
  FRIEND_REQ.notify();
};
FRIEND_REQ.respond = (id, status) => {
  FRIEND_REQ.list = FRIEND_REQ.list.map(r => r.id===id ? {...r,status} : r);
  FRIEND_REQ.notify();
};
FRIEND_REQ.reqsFor   = toId  => FRIEND_REQ.list.filter(r=>r.toId===toId);
FRIEND_REQ.pending   = toId  => FRIEND_REQ.list.filter(r=>r.toId===toId&&r.status==="pending").length;
FRIEND_REQ.hasPending = (fromId, toId) => FRIEND_REQ.list.some(r=>r.fromId===fromId&&r.toId===toId&&r.status==="pending");

// ─── SEED ─────────────────────────────────────────────────────────────────────
const n0=new Date(), di0=(n0.getDay()+6)%7;
TERRAINS.forEach(t => {
  RT.slots[t.id] = {};
  DAYS.forEach((d,di) => HOURS.forEach((h,hi) => {
    const r=(di*8+hi*3+t.id)%9;
    if (r<3 && Math.abs(di-di0)<=2)
      RT.slots[t.id][`${d}-${h}`] = SEED_PLAYERS.slice(0,r).map(p=>({...p,at:new Date(Date.now()-Math.random()*3.6e6).toISOString()}));
  }));
  RT.photos[t.id] = Array.from({length:3},(_,i)=>({
    id:`s${t.id}-${i}`,
    author:SEED_PLAYERS[(t.id+i)%SEED_PLAYERS.length].name,
    flag:SEED_PLAYERS[(t.id+i)%SEED_PLAYERS.length].flag,
    src:null, caption:["Session top 🔥","On cherche 2 joueurs !","Vue incroyable 🌅"][(t.id+i)%3],
    postedAt:new Date(Date.now()-Math.random()*8.64e7*3).toISOString(),
    likes:Math.floor(Math.random()*12), likedBy:[],
    emoji:SPORTS[(t.id+i)%SPORTS.length].emoji,
  }));
});
setTimeout(() => {
  CHAT.send("Lucas M.","Alex Martin","Salut ! Tu joues ce soir ? 🏀");
  CHAT.send("Lucas M.","Alex Martin","On est déjà 3, il manque un joueur");
  CHAT.send("Carlos M.","Alex Martin","Match dimanche 10h au Stade Charléty ⚽");
  CHAT.send("Sara K.","Alex Martin","Le terrain Pigalle est libre demain ?");
  INV.send({from:"Lucas M.", to:"Alex Martin", terrainId:3, terrainName:"Playground Pigalle", sport:"basketball", day:"Sam", hour:"14h", note:"On fait une partie ? On est déjà 3 🏀"});
  INV.send({from:"Carlos M.",to:"Alex Martin", terrainId:1, terrainName:"Stade Charléty",    sport:"football",   day:"Dim", hour:"10h", note:"Match amical dimanche matin ⚽"});
  // Historique visites Alex Martin (demo)
  BOOK.add({ user:"Alex Martin", terrainId:1, day:"Lun", hour:"18h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:3, day:"Sam", hour:"14h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:2, day:"Mer", hour:"10h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:7, day:"Jeu", hour:"20h", note:"" });
  BOOK.add({ user:"Alex Martin", terrainId:11, day:"Dim", hour:"12h", note:"" });
  // Score requests for past slots
  MATCH_SCORE.add({ terrainId:1,  terrainName:"Stade Charléty",     terrainSport:"football",   day:"Lun", hour:"18h", participants:["Alex Martin","Lucas M.","Carlos M.","Sara K.","Tom B."] });
  MATCH_SCORE.add({ terrainId:3,  terrainName:"Playground Pigalle",  terrainSport:"basketball", day:"Sam", hour:"14h", participants:["Alex Martin","Lucas M.","Jade R.","Noé V."] });
  MATCH_SCORE.add({ terrainId:2,  terrainName:"Court Lenglen",       terrainSport:"tennis",     day:"Mer", hour:"10h", participants:["Alex Martin","Sara K."] });
  // Simulated join request: Jade R. wants to join Les Aigles FC (captain = u1 = demo account)
  TEAM_REQ.send({ fromUserId:"u5", fromName:"Jade R.", teamId:1, teamName:"Les Aigles FC", sport:"football", captainId:"u1", message:"Salut ! Je voudrais rejoindre votre équipe, j'ai 5 ans d'expérience en football 🦅⚽" });
  // Simulated join request: Carlos M. also wants to join Les Aigles FC
  TEAM_REQ.send({ fromUserId:"u6", fromName:"Carlos M.", teamId:1, teamName:"Les Aigles FC", sport:"football", captainId:"u1", message:"Bonjour, intéressé pour rejoindre l'équipe ! Je joue milieu de terrain." });
  // Seeded match challenge: FC Parisiens defies Les Aigles FC
  MATCH_REQ.send({ fromTeamId:5, fromTeamName:"FC Parisiens", fromCaptainId:"u6", fromCaptainName:"Carlos M.", toTeamId:1, toTeamName:"Les Aigles FC", toCaptainId:"u1", sport:"football", day:"Sam", hour:"16h", terrainId:1, terrainName:"Stade Charléty", terrainCity:"Paris", message:"Salut les Aigles ! On vous défie pour un match amical ⚔️⚽" });
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
  const s = (Date.now()-new Date(iso))/1000;
  if (s<60)   return "À l'instant";
  if (s<3600) return Math.floor(s/60)+"min";
  if (s<86400)return Math.floor(s/3600)+"h";
  return Math.floor(s/86400)+"j";
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
      {loading ? "⏳ Chargement…" : children}
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
      {showLevel && <span style={{fontSize:fs-3,fontWeight:700,color:lvCol,background:`${lvCol}18`,border:`1px solid ${lvCol}33`,borderRadius:4,padding:"0 4px",whiteSpace:"nowrap"}}>Niv.{lvl}</span>}
      {showInsignes && top && <span title={`${top.def.name} ${top.tier.label}`} style={{fontSize:fs-1}}>{top.tier.medal}</span>}
      {showInsignes && refBadge && <span title={getReferralLevel(u.referralCount||0).name} style={{fontSize:fs-1}}>{refBadge}</span>}
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
        <p style={{marginTop:14,fontSize:11,color:C.sub}}>
          Démo : <span style={{color:C.accent}}>demo@rvf.app</span> / <span style={{color:C.accent}}>demo123</span>
        </p>
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
    if (!email) e.email="Requis";
    if (!pwd)   e.pwd="Requis";
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
          <p style={{textAlign:"center",marginTop:12,fontSize:11,color:C.sub}}>
            Démo : <span style={{color:C.accent}}>demo@rvf.app</span> / <span style={{color:C.accent}}>demo123</span>
          </p>
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
    setSending(true);
    await pause(1000);
    const code = String(Math.floor(100000+Math.random()*900000));
    setSentCode(code);
    setStep(3);
    setSending(false);
    startTimer();
    console.log("🔐 Code RVF:", code);
  };

  const verify = async () => {
    if (inputCode.trim()===sentCode) { // eslint-disable-line
      setVerified(true);
      await pause(500);
      setLoading(true);
      try {
        onSuccess(await register({ name:f.name,email:f.email,password:f.pwd,city:f.city,level:f.level,sports:f.sports,phone:f.phone,bio:"",verified:true }));
      } catch(m) { setApiErr(m?.message||m); }
      finally { setLoading(false); }
    } else {
      setCodeErr(t('auth.code_error'));
    }
  };

  const resend = async () => {
    if (timer>0) return;
    setSending(true);
    await pause(800);
    const code = String(Math.floor(100000+Math.random()*900000));
    setSentCode(code); setInputCode(""); setCodeErr("");
    setSending(false); startTimer();
    console.log("🔐 Nouveau code:", code);
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
              {step===1?t('auth.register_step1'):step===2?t('auth.register_step2'):t('auth.register_step3')}
            </div>
            <span style={{fontSize:11,color:C.sub,fontWeight:600}}>{t('auth.step')} {step}/3</span>
          </div>
          {/* Progress */}
          <div style={{display:"flex",gap:6,marginBottom:22}}>
            {[t('auth.step_info'),t('auth.step_profile'),t('auth.step_sms')].map((l,i)=>(
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
                  {LEVELS.map(l=><Chip key={l} active={f.level===l} onClick={()=>set("level",l)} color={C.purple}>{l}</Chip>)}
                </div>
              </div>
              <Btn onClick={sendSMS} loading={sending} variant="solid">📱 {t('auth.send_code')} →</Btn>
            </div>
          )}

          {step===3 && (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{background:"rgba(77,171,247,.1)",border:"1px solid rgba(77,171,247,.3)",borderRadius:12,padding:14,textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:4}}>📱</div>
                <div style={{fontSize:13,fontWeight:700,color:C.blue}}>{t('auth.code_sent_to')} {f.phone}</div>
                <div style={{fontSize:12,color:C.sub,marginTop:2}}>{t('auth.code_hint')}</div>
              </div>
              <input value={inputCode} onChange={e=>{setInputCode(e.target.value.replace(/\D/g,"").slice(0,6));setCodeErr("");}}
                placeholder="_ _ _ _ _ _" maxLength={6}
                style={{width:"100%",background:C.card2,border:`1.5px solid ${codeErr?C.red:C.border}`,borderRadius:10,padding:"14px",color:C.text,fontSize:26,outline:"none",fontFamily:C.head,letterSpacing:10,textAlign:"center"}}/>
              {codeErr && <ErrBox msg={codeErr}/>}
              {verified && <div style={{background:"rgba(81,207,102,.1)",border:"1px solid rgba(81,207,102,.3)",borderRadius:8,padding:"9px 14px",color:C.green,fontSize:13,fontWeight:700,textAlign:"center"}}>{t('auth.verified_number')}</div>}
              <ErrBox msg={apiErr}/>
              <Btn onClick={verify} loading={loading} disabled={inputCode.length<6} variant="solid">✅ {t('auth.verify')}</Btn>
              <div style={{textAlign:"center",fontSize:12,color:C.sub}}>
                {timer>0
                  ? <span>{t('auth.resend_in')} <span style={{color:C.accent,fontWeight:700}}>{timer}s</span></span>
                  : <button onClick={resend} style={{background:"none",border:"none",color:C.accent,fontSize:12,cursor:"pointer",fontFamily:C.font,fontWeight:600}}>{sending?t('common.loading'):t('auth.resend_code')}</button>
                }
              </div>
              <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:11,color:C.sub,textAlign:"center"}}>
                {t('auth.demo_mode')}
              </div>
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
          placeholder="Paris, Tokyo, New York… (2 lettres min)"
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
function AddTerrainModal({ user, onAdd, onClose, initialLat, initialLng }) {
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
      addedBy:user?.name||"Anonyme", photos,
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
            <CityAutocomplete value={f.city} onChange={v=>set("city",v)} error={err.city} terrainCities={TERRAINS.map(t=>t.city).filter(Boolean)}/>
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
function InteractiveMap({ terrains, onSelect, userPos, onMapClick, pinPos, onMapReady }) {
  const {t: tr} = useTranslation();
  const wrapRef      = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);
  const userDotRef   = useRef(null);
  const pinMarkerRef = useRef(null);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);

  // Init map once
  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return;
    const center = userPos ? [userPos.lat, userPos.lng] : [20, 10];
    const zoom   = userPos ? 10 : 2;
    const map = L.map(wrapRef.current, { center, zoom, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd", maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;
    if (onMapReady) onMapReady(map);
    map.on("click", e => {
      if (onMapClickRef.current) onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    setTimeout(() => map.invalidateSize(), 80);
    return () => { map.remove(); mapRef.current = null; };
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
      .bindPopup("<b>Ma position</b>").addTo(map);
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

  // Terrain markers — update when terrains list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    terrains.forEach(t => {
      if (!t.lat || !t.lng) return;
      const tSports = terrainSports(t).map(id=>SPORTS.find(s=>s.id===id)).filter(Boolean);
      const sp    = tSports[0];
      const color = sp?.color || C.accent;
      const innerContent = sp?.id === "padel"
        ? `<svg width="15" height="15" viewBox="0 0 20 20"><rect x="2.5" y="1" width="15" height="12" rx="4" fill="none" stroke="#06090f" stroke-width="1.7"/><circle cx="7" cy="5.5" r="1.1" fill="#06090f"/><circle cx="10" cy="5.5" r="1.1" fill="#06090f"/><circle cx="13" cy="5.5" r="1.1" fill="#06090f"/><circle cx="7" cy="9" r="1.1" fill="#06090f"/><circle cx="10" cy="9" r="1.1" fill="#06090f"/><circle cx="13" cy="9" r="1.1" fill="#06090f"/><rect x="8.8" y="13" width="2.4" height="6" rx="1.2" fill="#06090f"/></svg>`
        : `<span style="font-size:14px">${sp?.emoji || "🏟️"}</span>`;
      const multiSportBadge = tSports.length>1
        ? `<span style="font-size:10px;background:rgba(0,229,160,.15);color:#00e5a0;border-radius:4px;padding:1px 5px;font-weight:700">+${tSports.length-1}</span>`
        : "";
      const icon  = L.divIcon({
        html: `<div style="position:relative;width:32px;height:32px;border-radius:50%;background:${color};border:3px solid #06090f;box-shadow:0 3px 10px rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;cursor:pointer">${innerContent}${tSports.length>1?`<span style="position:absolute;top:-4px;right:-4px;background:#00e5a0;color:#06090f;border-radius:50%;width:14px;height:14px;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #06090f">${tSports.length}</span>`:""}</div>`,
        iconSize:[32,32], iconAnchor:[16,16], className:"",
      });
      const sportsLine = tSports.map(s=>s.emoji+" "+s.label).join(" · ");
      const marker = L.marker([t.lat, t.lng], { icon });
      marker.bindPopup(`
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
      `, { maxWidth:240, minWidth:200 });
      marker.on("popupopen", () => {
        const btn = document.getElementById(`rvfbtn-${t.id}`);
        if (btn) btn.onclick = () => onSelect(t);
      });
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [terrains, onSelect]);

  return (
    <div style={{position:"absolute",inset:0}}>
      <div ref={wrapRef} style={{width:"100%",height:"100%"}}/>
    </div>
  );
}

// ─── MAP VIEW ─────────────────────────────────────────────────────────────────
function MapView({ onSelect, terrains, user, onAddTerrain, userPos, gpsError, gpsLoading, onRequestGps }) {
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

  const handleAdd = t => {
    onAddTerrain(t);
    setToast(t.name);
    setTimeout(()=>setToast(null), 3000);
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
            <span style={{color:C.accent,fontWeight:700}}>{filtered.length}</span> {tr('map.terrains', {count: filtered.length})}
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
          <InteractiveMap terrains={filtered} onSelect={onSelect} userPos={userPos} onMapClick={handleMapClick} pinPos={placementMode?null:mapClickPos} onMapReady={m=>{mapInstanceRef.current=m;}}/>
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

      {showAdd && <AddTerrainModal user={user} onAdd={handleAdd} onClose={closeAdd} initialLat={mapClickPos?.lat} initialLng={mapClickPos?.lng}/>}
      {toast && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.aLow,border:`1px solid ${C.accent}55`,borderRadius:10,padding:"9px 20px",fontSize:12,color:C.accent,fontWeight:700,backdropFilter:"blur(8px)",zIndex:999,whiteSpace:"nowrap"}}>✅ "{toast}" {tr('map.terrain_added')}</div>}
    </div>
  );
}

// ─── TERRAIN DETAIL TABS ──────────────────────────────────────────────────────
function ItineraryTab({ terrain, sp }) {
  const [status,setStatus]   = useState("idle");
  const [pos,setPos]         = useState(null);
  const [mode,setMode]       = useState("walking");
  const [result,setResult]   = useState(null);
  const [city,setCity]       = useState("");
  const [cityErr,setCityErr] = useState("");
  const [showManual,setShowManual] = useState(false);

  const MODES = [
    { id:"walking", icon:"🚶", label:"À pied" },
    { id:"driving", icon:"🚗", label:"Voiture" },
    { id:"transit", icon:"🚇", label:"Transports" },
  ];

  const calcRoute = (p, m) => {
    if (!terrain.lat||!terrain.lng) { setResult({dur:"N/A",dist:"?",steps:["Coordonnées GPS non disponibles"],mins:0}); return; }
    const d = haversine(p.lat,p.lng,terrain.lat,terrain.lng);
    const km = d.toFixed(1);
    let mins, steps;
    if (m==="walking")  { mins=Math.round(d/5*60);  steps=[`🚶 Marchez ${km} km`,`📍 Arrivée : ${terrain.name}`]; }
    else if (m==="driving") { mins=Math.round(d/40*60); steps=[`🚗 Direction ${terrain.city}`,`🛣️ ${km} km`,`📍 ${terrain.name}`]; }
    else { mins=Math.round(d/20*60); steps=[`🚇 Transports en commun`,`🚏 ${km} km → ${terrain.city}`,`📍 ${terrain.name}`]; }
    const h=Math.floor(mins/60), min=mins%60;
    setResult({ dur:h>0?`${h}h${min>0?min+"min":""}`:mins+" min", dist:km, steps, mins });
  };

  const locate = () => {
    setStatus("locating"); setShowManual(false);
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
    if (!match) { setCityErr("Ville non trouvée. Ex: Paris, Lyon, Londres…"); return; }
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
            📍 Utiliser ma position GPS
          </button>
          <button onClick={()=>setShowManual(p=>!p)} style={{width:"100%",padding:"11px",borderRadius:10,background:C.card2,border:`1px solid ${C.border}`,color:C.sub,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
            ✍️ Saisir ma ville manuellement
          </button>
          {showManual && (
            <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",gap:8}}>
                <input value={city} onChange={e=>{setCity(e.target.value);setCityErr("");}} onKeyDown={e=>e.key==="Enter"&&locateCity()} placeholder="Ex: Paris, Lyon, Londres…" autoFocus
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
          <div style={{fontSize:36,marginBottom:10}}>🌐</div>Localisation GPS en cours…
        </div>
      )}

      {status==="error" && (
        <div style={{background:"rgba(255,107,107,.08)",border:"1px solid rgba(255,107,107,.25)",borderRadius:14,padding:18,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",gap:12}}>
            <div style={{fontSize:28}}>🔒</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:4}}>Géolocalisation bloquée</div>
              <div style={{fontSize:12,color:C.sub,lineHeight:1.6}}>Saisissez votre ville manuellement ci-dessous.</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={city} onChange={e=>{setCity(e.target.value);setCityErr("");}} onKeyDown={e=>e.key==="Enter"&&locateCity()} placeholder="Ex: Paris, Lyon, Londres…" autoFocus
              style={{flex:1,background:C.card2,border:`1.5px solid ${cityErr?C.red:C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:14,outline:"none",fontFamily:C.font}}/>
            <button onClick={locateCity} style={{background:C.accent,border:"none",borderRadius:9,padding:"10px 18px",color:"#06090f",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>→</button>
          </div>
          {cityErr && <span style={{fontSize:11,color:C.red}}>{cityErr}</span>}
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {["Paris","Lyon","Marseille","Bordeaux","Lille","Londres","Madrid","Tokyo"].map(c=>(
              <button key={c} onClick={()=>{setCity(c);setCityErr("");}} style={{padding:"5px 11px",borderRadius:7,background:city===c?C.aLow:C.card2,border:`1px solid ${city===c?C.accent:C.border}`,color:city===c?C.accent:C.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>{c}</button>
            ))}
          </div>
          <button onClick={locate} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px",color:C.sub,fontSize:12,cursor:"pointer",fontFamily:C.font}}>🔄 Réessayer le GPS</button>
        </div>
      )}

      {status==="ready" && result && (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"7px 12px",fontSize:12,color:C.accent,display:"flex",alignItems:"center",gap:8}}>
            📍 Depuis : <strong>{city||"Position GPS"}</strong>
            <button onClick={()=>{setStatus("idle");setResult(null);setPos(null);setCity("");}} style={{marginLeft:"auto",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:11,fontFamily:C.font}}>✕ Changer</button>
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
            <span style={{fontSize:18}}>🗺️</span> Ouvrir dans Google Maps
          </button>
          {result.mins>0 && (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,color:C.sub}}>⏰ Arrivée estimée</span>
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
  const MONTHS = ["jan","fév","mar","avr","mai","juin","juil","aoû","sep","oct","nov","déc"];
  const fd = d => d.getDate();
  const fm = d => MONTHS[d.getMonth()];
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
      if (!phone.trim()) { setPhoneErr("Numéro requis"); return; }
      if (!/^[\d\s\+\-\(\)]{8,15}$/.test(phone.replace(/\s/g,""))) { setPhoneErr("Numéro invalide"); return; }
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
            {isCurWeek?"Cette semaine":`Semaine +${weekOffset}`}
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
                  {d}
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
                    {isMine2&&<div style={{fontSize:8,color:C.accent,fontWeight:700}}>MOI</div>}
                    {isBooked&&!isMine2&&<div style={{fontSize:10}}>🔒</div>}
                    {!isBooked&&!isMine2&&!isPast&&<div style={{fontSize:7,color:C.sub}}>Libre</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {step==="confirm" && (
        <div style={{background:C.card,border:`1px solid ${sp?.color}44`,borderRadius:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>Confirmer la réservation</div>
          <div style={{background:C.card2,borderRadius:10,padding:12,display:"flex",gap:12,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center"}}><SportEmoji sport={sp} size={24}/></div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.text}}>{terrain.name}</div>
              <div style={{fontSize:13,color:sp?.color,fontWeight:700}}>{selDay} {selDateLabel} · {selHour}</div>
              {!isCurWeek&&<div style={{fontSize:11,color:C.sub,marginTop:1}}>Semaine +{weekOffset}</div>}
            </div>
          </div>
          {!isFree && (
            <Field label="Votre numéro *" type="tel" value={phone} onChange={e=>{setPhone(e.target.value);setPhoneErr("");}} placeholder="+33 6 12 34 56 78" error={phoneErr} icon="📞"/>
          )}
          <div style={{display:"flex",gap:8}}>
            <Btn onClick={confirm} variant="solid">{isFree?"✅ Confirmer":"📞 Confirmer"}</Btn>
            <Btn onClick={resetPick} variant="ghost">Annuler</Btn>
          </div>
        </div>
      )}

      {step==="done" && (
        <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:14,padding:20,textAlign:"center"}}>
          <div style={{fontSize:44,marginBottom:8}}>🎉</div>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.accent,marginBottom:4}}>Réservé !</div>
          <div style={{fontSize:13,color:C.sub,marginBottom:14}}>{selDay} {selDateLabel} · {selHour} · {terrain.name}</div>
          <Btn onClick={resetPick} variant="ghost" full={false} style={{padding:"8px 20px",fontSize:12}}>Autre créneau</Btn>
        </div>
      )}

      {myBookings.length>0 && (
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Mes réservations</div>
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
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{b.day} {bLabel} · {b.hour}</div>
                  {wo>0&&<div style={{fontSize:10,color:C.blue,marginTop:1}}>Semaine +{wo}</div>}
                  {b.phone&&<div style={{fontSize:11,color:C.orange,display:"flex",alignItems:"center",gap:5}}>📞 {showPhone===b.id?b.phone:"•••••••"}<button onClick={()=>setShowPhone(showPhone===b.id?null:b.id)} style={{background:"none",border:"none",color:C.orange,cursor:"pointer",fontSize:10,fontFamily:C.font,textDecoration:"underline"}}>{showPhone===b.id?"Masquer":"Voir"}</button></div>}
                </div>
                <Badge label="✅ Confirmé" color={C.accent}/>
                <button onClick={()=>BOOK.cancel(b.id)} style={{background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:6,padding:"4px 8px",color:C.red,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>Annuler</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DispoTab({ terrain, user, sp }) {
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
          <span style={{fontSize:11,color:C.sub,fontWeight:600,letterSpacing:.5}}>LIVE MONDIAL</span>
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
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>Vous êtes ici maintenant ?</div>
          <div style={{fontSize:11,color:C.sub,marginTop:2}}>{cDay} · <span style={{color:sp?.color,fontWeight:700}}>{now.getHours()}h{String(now.getMinutes()).padStart(2,"0")}</span>
            {nowPlayers.length>0 && <span style={{color:C.green}}> · {nowPlayers.length} présent{nowPlayers.length>1?"s":""}</span>}
          </div>
        </div>
        <button onClick={()=>toggle(cDay,cHour)} style={{padding:"9px 18px",borderRadius:10,cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:12,border:"none",background:mySlots[nowKey]?`${sp?.color}22`:C.aLow,color:mySlots[nowKey]?sp?.color:C.accent,outline:`1px solid ${mySlots[nowKey]?sp?.color+"55":C.accent+"55"}`}}>
          {mySlots[nowKey]?"✅ Je suis là !":"📣 Je suis là"}
        </button>
      </div>

      {nowPlayers.length>0 && (
        <div style={{background:C.card,border:`1px solid ${sp?.color}44`,borderRadius:12,padding:12}}>
          <div style={{fontSize:10,fontWeight:700,color:sp?.color,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>🟢 Sur le terrain maintenant</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {nowPlayers.map(p=>(
              <div key={p.name} style={{display:"flex",alignItems:"center",gap:7,background:C.card2,borderRadius:20,padding:"4px 10px 4px 5px"}}>
                <Avatar name={p.name} size={22} color={sp?.color}/>
                <span style={{fontSize:11,fontWeight:600,color:C.text}}>{p.name}</span>
                <span style={{fontSize:10,color:C.sub}}>{timeAgo(p.at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalMine>0 && (
        <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:10,padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:C.accent,fontWeight:600}}>✅ {totalMine} créneau{totalMine>1?"x":""} sélectionné{totalMine>1?"s":""}</span>
          <button onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}} style={{background:"none",border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 12px",color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
            {saved?"✓ Sauvegardé !":"💾 Sauvegarder"}
          </button>
        </div>
      )}

      {/* Grid */}
      <div>
        <div style={{display:"grid",gridTemplateColumns:"30px repeat(7,1fr)",gap:2,marginBottom:4}}>
          <div/>
          {DAYS.map((d,i)=>(
            <div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,padding:"3px 1px",borderRadius:5,color:i===di0?sp?.color:C.sub,background:i===di0?`${sp?.color}18`:"transparent"}}>
              {d}{i===di0&&<div style={{fontSize:7}}>NOW</div>}
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
                  {isMine&&<div style={{fontSize:7,color:sp?.color,fontWeight:700}}>MOI</div>}
                  {isNow&&!isMine&&players.length===0&&<div style={{fontSize:10}}>👁️</div>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {[["Libre",C.sub,C.card2],["1–2","#4dabf7","rgba(77,171,247,.14)"],["3–5","#fcc419","rgba(252,196,25,.14)"],["Plein","#ff6b35","rgba(255,107,53,.14)"],["Moi",sp?.color,`${sp?.color}33`]].map(([l,col,bg])=>(
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
        <div style={{fontSize:11,fontWeight:700,color:sp?.color,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📸 Partager une photo en direct</div>
        <input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Décrivez le terrain, cherchez des joueurs…"
          style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 12px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font,marginBottom:8}}/>
        <button onClick={()=>fileRef.current.click()} style={{width:"100%",padding:"9px",background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:8,color:C.accent,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
          {uploading?"⏳ Envoi…":"📷 Choisir une photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={upload}/>
      </div>

      {flash && <div style={{background:C.aLow,border:`1px solid ${C.accent}44`,borderRadius:8,padding:"9px 14px",color:C.accent,fontSize:12,fontWeight:700}}>✅ Photo partagée avec tous les joueurs du monde !</div>}

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
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>{photo.author} <span style={{fontSize:13}}>{photo.flag||"🌍"}</span></div>
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
                <span style={{fontSize:11,color:C.sub,cursor:"pointer"}}>💬 Commenter</span>
                <span style={{fontSize:11,color:C.sub,cursor:"pointer",marginLeft:"auto"}}>🔗 Partager</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InviteTab({ terrain, user, sp }) {
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
    selected.forEach(to => INV.send({ from:user?.name||"Anonyme", to, terrainId:terrain.id, terrainName:terrain.name, sport:terrain.sport, day:selDay, hour:selHour, note:note.trim()||`Je t'invite à jouer sur ${terrain.name} !` }));
    setSent(true); setSelected([]); setNote("");
    setTimeout(()=>setSent(false),3000);
  };

  const stCol = s => s==="accepted"?C.green:s==="declined"?C.red:C.yellow;
  const stLbl = s => s==="accepted"?"✅ Accepté":s==="declined"?"❌ Refusé":"⏳ En attente";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{background:`linear-gradient(135deg,${sp?.color}18,${C.card2})`,border:`1px solid ${sp?.color}44`,borderRadius:14,padding:14,display:"flex",gap:12,alignItems:"center"}}>
        <div style={{fontSize:32}}>🤝</div>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.text}}>Inviter des amis à jouer</div>
          <div style={{fontSize:12,color:C.sub,marginTop:2}}>Choisissez un créneau et vos amis reçoivent une invitation instantanée</div>
        </div>
      </div>

      {/* Créneau */}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📅 Choisir le créneau</div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.sub,marginBottom:5,fontWeight:600}}>JOUR</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {DAYS.map(d=><button key={d} onClick={()=>setSelDay(d)} style={{padding:"5px 9px",borderRadius:7,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:11,background:selDay===d?`${sp?.color}20`:C.card2,border:`1.5px solid ${selDay===d?sp?.color:C.border}`,color:selDay===d?sp?.color:C.sub}}>{d}</button>)}
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.sub,marginBottom:5,fontWeight:600}}>HEURE</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {HOURS.map(h=><button key={h} onClick={()=>setSelHour(h)} style={{padding:"5px 9px",borderRadius:7,cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:11,background:selHour===h?`${sp?.color}20`:C.card2,border:`1.5px solid ${selHour===h?sp?.color:C.border}`,color:selHour===h?sp?.color:C.sub}}>{h}</button>)}
            </div>
          </div>
        </div>
      </div>

      {/* Joueurs */}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>
          👥 Inviter <span style={{color:C.accent}}>({selected.length} sélectionné{selected.length>1?"s":""})</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {SEED_PLAYERS.filter(p=>p.name!==user?.name).map(p=>{
            const isSel=selected.includes(p.name);
            return (
              <div key={p.name} onClick={()=>toggle(p.name)}
                style={{background:isSel?`${sp?.color}15`:C.card2,border:`1.5px solid ${isSel?sp?.color:C.border}`,borderRadius:12,padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
                <Avatar name={p.name} size={36} color={isSel?sp?.color:C.sub}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{p.name} {p.flag}</div>
                  <div style={{fontSize:11,color:C.sub}}>Joueur RVF · En ligne</div>
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
        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>💬 Message</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
          placeholder={`On se retrouve sur ${terrain.name} ?`}
          style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none"}}/>
      </div>

      {sent
        ? <div style={{background:"rgba(81,207,102,.1)",border:"1px solid rgba(81,207,102,.3)",borderRadius:12,padding:14,textAlign:"center",fontSize:14,fontWeight:700,color:C.green}}>🎉 Invitations envoyées !</div>
        : <Btn onClick={sendInvites} disabled={!selected.length} variant="solid" style={{fontSize:15,padding:"14px"}}>
            🤝 Envoyer {selected.length>0?`${selected.length} invitation${selected.length>1?"s":""}`:""} →
          </Btn>
      }

      {myInvites.length>0 && (
        <div>
          <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📬 Mes invitations envoyées</div>
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
          {onDelete && user && (
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
            <Badge label={terrain.surface} color={C.blue}/>
            {terrain.lights&&<Badge label={t('terrain.lit')} color={C.yellow}/>}
            {terrain.free?<Badge label={t('terrain.free')} color={C.accent}/>:<Badge label={t('terrain.paying')} color={C.orange}/>}
            <Badge label={`👥 ${terrain.players}`} color={C.purple}/>
            {terrain.addedBy&&<Badge label={"+ "+terrain.addedBy} color={C.sub}/>}
          </div>
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
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:2,marginBottom:16,background:C.card,borderRadius:10,padding:4,border:`1px solid ${C.border}`}}>
          {[["itinerary","🧭 Itinéraire"],["invite","🤝 Inviter"],["resa","📅 Réserver"],["dispo","🟢 Dispo"],["photos","📸 Photos"],["info","ℹ️ Infos"]].map(([t,l],i)=>(
            <button key={t} style={tabSt(t)} onClick={()=>goToTab(t, i > tabIdx ? "right" : "left")}>{l}</button>
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
              {[["🏟️ "+t('terrain.surface'),t('surfaces.'+(SURF_KEYS[terrain.surface]||'gazon_naturel'))],["💡 "+t('terrain.lighting'),terrain.lights?t('terrain.available'):t('terrain.unavailable')],["💰 "+t('terrain.price_label'),terrain.price],["⭐ "+t('terrain.rating'),terrain.rating>0?terrain.rating+"/5":t('terrain.unrated')],["👥 "+t('terrain.players'),terrain.players],...(terrain.phone?[["📞 "+t('terrain.phone_label'),terrain.phone]]:[])] .map(([k,v])=>(
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
  useStore(TEAM_REQ);
  const [selProfile, setSelProfile] = useState(null);
  const sp = SPORTS.find(s=>s.id===team.sport);
  const seed    = ROSTER[team.id] || [];
  const newMembers = TEAM_REQ.list.filter(r=>r.teamId===team.id && r.status==="accepted");
  const allMembers = [
    ...seed,
    ...newMembers
      .filter(r => !seed.find(m=>m.id===r.fromUserId))
      .map(r=>{ const u=DB.find(u=>u.id===r.fromUserId); return { id:r.fromUserId, name:r.fromName, city:u?.city||"", level:u?.level||"Amateur" }; }),
  ];
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
        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:8}}>
          {allMembers.length===0
            ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:36,marginBottom:8}}>👥</div>Aucun membre.</div>
            : allMembers.map((m,i)=>{
                const dbUser = DB.find(u=>u.id===m.id);
                return (
                  <div key={m.id||i} style={{background:C.card2,borderRadius:10,padding:"10px 12px",cursor:dbUser?"pointer":"default"}} onClick={()=>dbUser&&setSelProfile(dbUser)}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Avatar name={m.name} size={38} color={m.captain?C.yellow:C.accent} photo={dbUser?.avatar}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.text,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                          {m.name}
                          {m.captain && <span style={{fontSize:9,background:`${C.yellow}20`,color:C.yellow,border:`1px solid ${C.yellow}40`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>👑 Cap.</span>}
                        </div>
                        <div style={{fontSize:11,color:C.sub}}>📍 {m.city} · <span style={{color:C.accent}}>{m.level}</span></div>
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
  const hasTeams = myTeams.length > 0;
  const [mode,         setMode]        = useState(hasTeams ? "team" : "solo");
  const [fromTeam,     setFromTeam]    = useState(myTeams[0]);
  const [day,          setDay]         = useState("Sam");
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
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:20,color:C.orange}}>Défi envoyé !</div>
            <div style={{fontSize:13,color:C.sub,marginTop:8}}>Le capitaine de <strong style={{color:C.text}}>{targetTeam.name}</strong> va recevoir votre défi.</div>
            {matchTerrain&&<div style={{fontSize:12,color:C.accent,marginTop:6,fontWeight:600}}>📍 {matchTerrain.name}, {matchTerrain.city}</div>}
          </div>
        ) : (
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>⚔️ Lancer un défi</div>
                <div style={{fontSize:12,color:C.sub,marginTop:2}}>contre <span style={{color:C.orange,fontWeight:700}}>{targetTeam.name}</span></div>
              </div>
              <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.sub,fontSize:18}}>✕</button>
            </div>

            {/* Mode toggle */}
            <div style={{display:"flex",gap:6,background:C.card2,borderRadius:10,padding:4,marginBottom:14}}>
              {hasTeams && (
                <button onClick={()=>setMode("team")} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:mode==="team"?C.orange:"transparent",color:mode==="team"?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                  👥 Avec mon équipe
                </button>
              )}
              <button onClick={()=>setMode("solo")} style={{flex:1,padding:"8px",borderRadius:8,border:"none",background:mode==="solo"?C.orange:"transparent",color:mode==="solo"?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>
                🧍 En solo
              </button>
            </div>

            {/* VS banner */}
            <div style={{display:"flex",alignItems:"center",gap:12,background:C.card2,borderRadius:14,padding:"12px 14px",marginBottom:14,border:`1px solid ${C.orange}25`}}>
              <div style={{flex:1,textAlign:"center"}}>
                {mode==="solo" ? (
                  <>
                    <div style={{width:36,height:36,borderRadius:"50%",background:`${C.orange}25`,border:`2px solid ${C.orange}55`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px",fontSize:16,fontWeight:700,color:C.orange}}>{user.name[0]}</div>
                    <div style={{fontSize:11,fontWeight:700,color:C.text}}>{user.name}</div>
                    <div style={{fontSize:10,color:C.orange,marginTop:1}}>Solo</div>
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
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:7}}>Votre équipe</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {myTeams.map(t=>(
                    <button key={t.id} onClick={()=>setFromTeam(t)} style={{padding:"6px 12px",borderRadius:8,cursor:"pointer",fontFamily:C.font,fontSize:12,fontWeight:600,background:fromTeam?.id===t.id?`${C.orange}20`:C.card2,border:`2px solid ${fromTeam?.id===t.id?C.orange:C.border}`,color:fromTeam?.id===t.id?C.orange:C.sub}}>
                      {t.avatar} {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Day & Hour */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Jour</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {DAYS.map(d=><button key={d} onClick={()=>setDay(d)} style={{padding:"4px 8px",borderRadius:6,cursor:"pointer",fontFamily:C.font,fontSize:11,fontWeight:600,background:day===d?`${C.orange}20`:C.card2,border:`1px solid ${day===d?C.orange+"55":C.border}`,color:day===d?C.orange:C.sub}}>{d}</button>)}
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Heure</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {HOURS.map(h=><button key={h} onClick={()=>setHour(h)} style={{padding:"4px 8px",borderRadius:6,cursor:"pointer",fontFamily:C.font,fontSize:11,fontWeight:600,background:hour===h?`${C.orange}20`:C.card2,border:`1px solid ${hour===h?C.orange+"55":C.border}`,color:hour===h?C.orange:C.sub}}>{h}</button>)}
                </div>
              </div>
            </div>

            {/* Terrain */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:7}}>📍 Terrain du match</label>
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
                      placeholder="Rechercher un terrain ou une ville…"
                      style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"7px 12px 7px 30px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}/>
                    <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:12}}>🔍</span>
                    {tSearch&&<button onClick={()=>setTSearch("")} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:12,lineHeight:1}}>✕</button>}
                  </div>
                  <div style={{maxHeight:150,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,borderRadius:10,border:`1px solid ${C.border}`,background:C.card2,padding:6}}>
                    <button onClick={()=>setMatchTerrain(null)}
                      style={{textAlign:"left",background:"transparent",border:`1px dashed ${C.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",color:C.sub,fontSize:12,fontFamily:C.font}}>
                      🌐 Lieu libre (à définir)
                    </button>
                    {searchedTerrains.length===0
                      ? <div style={{fontSize:11,color:C.sub,textAlign:"center",padding:8}}>Aucun terrain trouvé</div>
                      : searchedTerrains.map(t=>{
                          const sObj=SPORTS.find(s=>s.id===terrainSports(t)[0]);
                          return (
                            <button key={t.id} onClick={()=>{setMatchTerrain(t);setTSearch("");}}
                              style={{textAlign:"left",background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",cursor:"pointer",fontFamily:C.font}}>
                              <div style={{fontSize:12,fontWeight:600,color:C.text}}>{sObj?.emoji} {t.name}</div>
                              <div style={{fontSize:10,color:C.sub,marginTop:1}}>📍 {t.city} · {t.surface} · {t.price}</div>
                            </button>
                          );
                        })
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Message */}
            <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Message (optionnel)</label>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Ex: On vous défie pour un match amical ⚔️" rows={2}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",boxSizing:"border-box",marginBottom:14}}/>

            <div style={{display:"flex",gap:8}}>
              <button onClick={send} disabled={!canSend} style={{flex:2,padding:"13px",borderRadius:11,background:canSend?C.orange:"#333",border:"none",color:canSend?"#06090f":C.sub,fontFamily:C.font,fontSize:14,fontWeight:800,cursor:canSend?"pointer":"not-allowed",boxShadow:canSend?`0 4px 16px ${C.orange}55`:"none"}}>⚔️ Envoyer le défi</button>
              <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:11,background:"transparent",border:`1px solid ${C.border}`,color:C.sub,fontFamily:C.font,fontSize:13,fontWeight:600,cursor:"pointer"}}>Annuler</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TeamsView({ user, terrains, onGoToMessages }) {
  const {t} = useTranslation();
  useStore(TEAM_REQ);
  useStore(MATCH_REQ);
  const [showCreate,setShowCreate]     = useState(false);
  const [teamName,setTeamName]         = useState("");
  const [teamCity,setTeamCity]         = useState(user?.city||"");
  const [teamSport,setTeamSport]       = useState("football");
  const [teamLevel,setTeamLevel]       = useState("Amateur");
  const [teams,setTeams]               = useState(TEAMS_DATA);
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

  const myTeams = teams.filter(t=>t.captainId===user?.id);
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

  const create = () => {
    if (!teamName.trim()) return;
    const t = { id:Date.now(), name:teamName, sport:teamSport, open:true, level:teamLevel, avatar:SPORTS.find(s=>s.id===teamSport)?.emoji, captainId:user?.id, city:teamCity.trim()||user?.city||"" };
    ROSTER[t.id] = user ? [{ id:user.id, name:user.name, city:user.city||"", level:user.level||"Amateur", captain:true }] : [];
    setTeams(p=>[...p, t]);
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
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:26,color:C.text}}>Équipes</div>
            <p style={{fontSize:12,color:C.sub,marginTop:2}}>{t('teams.subtitle')}</p>
          </div>
          {viewTab==="teams" && <Btn onClick={()=>setShowCreate(p=>!p)} full={false} style={{padding:"9px 16px",fontSize:12}}>+ Créer</Btn>}
        </div>

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
                    <Btn onClick={create} variant="solid">✅ Créer</Btn>
                    <Btn onClick={()=>setShowCreate(false)} variant="ghost">Annuler</Btn>
                  </div>
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{position:"relative",flex:"0 0 180px"}}>
                <input value={cityFilter} onChange={e=>setCityFilter(e.target.value)} placeholder="Filtrer par ville…"
                  style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"7px 10px 7px 30px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font}}/>
                <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:13}}>📍</span>
                {cityFilter && <button onClick={()=>setCityFilter("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:12,lineHeight:1}}>✕</button>}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                {mySports && (
                  <button onClick={()=>setMySportsOnly(p=>!p)}
                    style={{padding:"5px 11px",borderRadius:20,border:`1.5px solid ${mySportsOnly?C.accent:C.border}`,background:mySportsOnly?C.aLow:"transparent",color:mySportsOnly?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,whiteSpace:"nowrap",transition:"all .15s"}}>
                    {mySportsOnly?"⚽ Mes sports":"🌐 Voir tous"}
                  </button>
                )}
                <Chip active={filter==="all"} onClick={()=>setFilter("all")}>Tous</Chip>
                {(mySportsOnly&&mySports ? SPORTS.filter(s=>mySports.includes(s.id)) : SPORTS).map(s=>(
                  <Chip key={s.id} active={filter===s.id} onClick={()=>setFilter(s.id)} color={s.color}><span style={{display:"inline-flex",alignItems:"center",gap:4}}><SportEmoji sport={s} size={12}/>{s.label}</span></Chip>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
              {filtered.map(team=>{
                const s           = sp(team.sport);
                const isCaptain   = user?.id === team.captainId;
                const hasPending  = user && TEAM_REQ.userPending(user.id, team.id);
                const accepted    = user && TEAM_REQ.userAccepted(user.id, team.id);
                const memberCount = TEAM_REQ.teamMemberCount(team.id);
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
                        <div style={{fontSize:11,color:C.sub,marginTop:1,display:"flex",alignItems:"center",gap:3}}><SportEmoji sport={s} size={11}/> {s?.label} · {memberCount} membre{memberCount!==1?"s":""}</div>
                        {team.city&&<div style={{fontSize:11,color:C.blue,marginTop:2,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>📍 {team.city}{(team.city||"").toLowerCase()===user?.city?.toLowerCase()&&<span style={{background:`${C.accent}20`,color:C.accent,borderRadius:5,padding:"1px 5px",fontSize:9,fontWeight:700}}>{t('teams.my_city')}</span>}</div>}
                      </div>
                      <Badge label={team.open?"Ouvert":"Fermé"} color={team.open?C.accent:C.sub}/>
                    </div>

                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,gap:6,flexWrap:"wrap"}}>
                      <Badge label={team.level} color={s?.color}/>
                      <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                        <button onClick={()=>setRosterTeam(team)} style={{padding:"5px 10px",background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,color:C.sub,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
                          👥 Joueurs
                        </button>
                        {!isCaptain && (
                          <button onClick={team.open&&!hasPending&&!accepted?()=>setJoinModal(team):undefined}
                            style={{padding:"5px 10px",background:accepted?`${C.green}18`:hasPending?`${C.yellow}15`:team.open?C.aLow:"transparent",border:`1px solid ${accepted?C.green+"44":hasPending?C.yellow+"44":team.open?C.accent+"44":C.border}`,borderRadius:7,color:accepted?C.green:hasPending?C.yellow:team.open?C.accent:C.sub,fontSize:11,fontWeight:600,cursor:team.open&&!hasPending&&!accepted?"pointer":"default",fontFamily:C.font}}>
                            {accepted?"✅ Membre":hasPending?"⏳ En attente":team.open?"Rejoindre":"Complet"}
                          </button>
                        )}
                        {canChallenge && (
                          <button onClick={alreadyChallenged?undefined:()=>setChallengeModal(team)}
                            style={{padding:"5px 10px",background:alreadyChallenged?`${C.orange}08`:`${C.orange}18`,border:`1px solid ${alreadyChallenged?C.orange+"25":C.orange+"55"}`,borderRadius:7,color:alreadyChallenged?C.sub:C.orange,fontSize:11,fontWeight:700,cursor:alreadyChallenged?"default":"pointer",fontFamily:C.font}}>
                            {alreadyChallenged?"⏳ Défi envoyé":"⚔️ Défier"}
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
                        <button onClick={()=>acceptTeamReq(req)} style={{flex:1,padding:"11px",borderRadius:11,background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",color:C.green,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>✅ Accepter</button>
                        <button onClick={()=>TEAM_REQ.respond(req.id,"rejected")} style={{flex:1,padding:"11px",borderRadius:11,background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",color:C.red,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>❌ Refuser</button>
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
                <div style={{fontSize:11,fontWeight:700,color:C.orange,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>⚔️ Défis reçus</div>
                {incomingChallenges.map(r=>{
                  const fromTeamObj = teams.find(t=>t.id===r.fromTeamId);
                  const toTeamObj   = teams.find(t=>t.id===r.toTeamId);
                  return (
                    <div key={r.id} style={{background:C.card,border:`2px solid ${C.orange}55`,borderRadius:16,padding:16,display:"flex",flexDirection:"column",gap:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:11,fontWeight:700,color:C.orange,background:`${C.orange}18`,border:`1px solid ${C.orange}44`,borderRadius:6,padding:"3px 9px"}}>{r.isSolo?"🧍 DÉFI SOLO REÇU":"⚔️ DÉFI REÇU"}</span>
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
                          <div style={{fontSize:10,color:C.sub,marginTop:1}}>Challenger</div>
                        </div>
                        <div style={{fontFamily:C.head,fontWeight:800,fontSize:20,color:C.orange,background:`${C.orange}18`,border:`2px solid ${C.orange}44`,borderRadius:10,padding:"5px 12px",letterSpacing:2}}>VS</div>
                        <div style={{flex:1,textAlign:"center"}}>
                          <div style={{fontSize:28,marginBottom:3}}>{toTeamObj?.avatar||"👥"}</div>
                          <div style={{fontSize:12,fontWeight:700,color:C.text}}>{r.toTeamName}</div>
                          <div style={{fontSize:10,color:C.accent,marginTop:1}}>Votre équipe</div>
                        </div>
                      </div>
                      <div style={{background:C.card2,borderRadius:10,padding:"8px 12px",fontSize:12,color:C.sub,display:"flex",flexDirection:"column",gap:5}}>
                        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
                          <span>📅 {r.day}</span><span>⏰ {r.hour}</span>
                          <span style={{color:r.terrainName?C.accent:C.sub,fontWeight:r.terrainName?600:400}}>
                            📍 {r.terrainName?`${r.terrainName}${r.terrainCity?`, ${r.terrainCity}`:""}` : "Lieu à définir"}
                          </span>
                        </div>
                        {r.message&&<div style={{color:C.text,fontStyle:"italic",borderTop:`1px solid ${C.border}`,paddingTop:5}}>"{r.message}"</div>}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>MATCH_REQ.respond(r.id,"accepted")} style={{flex:1,padding:"12px",borderRadius:11,background:`${C.green}18`,border:`1px solid ${C.green}55`,color:C.green,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>✅ Accepter</button>
                        <button onClick={()=>MATCH_REQ.respond(r.id,"declined")} style={{flex:1,padding:"12px",borderRadius:11,background:`${C.red}10`,border:`1px solid ${C.red}30`,color:C.red,fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Décliner</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* 2. Défis envoyés — en attente */}
            {MATCH_REQ.list.filter(r=>(myTeamIds.includes(r.fromTeamId)||(r.isSolo&&r.fromUserId===user?.id))&&r.status==="pending").length>0 && (
              <>
                <div style={{fontSize:11,fontWeight:700,color:C.yellow,textTransform:"uppercase",letterSpacing:1,marginTop:4,marginBottom:2}}>⏳ Défis envoyés</div>
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
                      <div style={{fontSize:11,color:C.sub,textAlign:"center"}}>📅 {r.day} · ⏰ {r.hour} · En attente de réponse…</div>
                      <div style={{fontSize:11,color:r.terrainName?C.accent:C.sub,textAlign:"center"}}>
                        📍 {r.terrainName?`${r.terrainName}${r.terrainCity?`, ${r.terrainCity}`:""}` : "Lieu à définir"}
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
                <div style={{fontSize:11,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:1,marginTop:4,marginBottom:2}}>📅 Matchs à venir</div>
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
                      <div style={{fontSize:12,color:C.green,fontWeight:700,textAlign:"center"}}>📅 {r.day} · ⏰ {r.hour} — Match confirmé !</div>
                      <div style={{fontSize:11,color:r.terrainName?C.accent:C.sub,textAlign:"center"}}>
                        📍 {r.terrainName?`${r.terrainName}${r.terrainCity?`, ${r.terrainCity}`:""}` : "Lieu à définir"}
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
                <div style={{fontSize:11,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:1,marginTop:4,marginBottom:2}}>🏆 Matchs passés</div>
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
                  const rl   = won ? "Victoire" : draw ? "Nul" : "Défaite";
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
              {totalPending>0 && <span style={{background:`${C.yellow}20`,color:C.yellow,border:`1px solid ${C.yellow}40`,borderRadius:8,padding:"2px 8px",fontSize:11,fontWeight:700}}>{totalPending} en attente</span>}
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
                    <button onClick={()=>acceptTeamReq(req)} style={{flex:1,padding:"12px",borderRadius:11,background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",color:C.green,fontFamily:C.font,fontSize:14,fontWeight:700,cursor:"pointer"}}>✅ Accepter</button>
                    <button onClick={()=>TEAM_REQ.respond(req.id,"rejected")} style={{flex:1,padding:"12px",borderRadius:11,background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",color:C.red,fontFamily:C.font,fontSize:14,fontWeight:700,cursor:"pointer"}}>❌ Refuser</button>
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
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text,marginBottom:4}}>Rejoindre l'équipe</div>
            <div style={{fontSize:13,color:C.sub,marginBottom:16}}>Votre demande sera envoyée au capitaine de <span style={{color:C.accent,fontWeight:700}}>{joinModal.name}</span>.</div>
            <div style={{display:"flex",gap:10,alignItems:"center",background:C.card2,borderRadius:12,padding:"10px 12px",marginBottom:14}}>
              <div style={{width:38,height:38,borderRadius:10,background:`${sp(joinModal.sport)?.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{joinModal.avatar}</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{joinModal.name}</div>
                <div style={{fontSize:11,color:C.sub}}>{sp(joinModal.sport)?.label} · {joinModal.level}</div>
              </div>
            </div>
            <label style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:6}}>Message au capitaine (optionnel)</label>
            <textarea value={joinNote} onChange={e=>setJoinNote(e.target.value)}
              placeholder="Ex : Bonjour, je joue depuis 3 ans au niveau confirmé…"
              rows={3}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",boxSizing:"border-box",marginBottom:14}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={sendJoinRequest} variant="solid">📨 Envoyer la demande</Btn>
              <Btn onClick={()=>{setJoinModal(null);setJoinNote("");}} variant="ghost">Annuler</Btn>
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
  useStore(FRIENDS);
  useStore(FRIEND_REQ);
  const isFriend   = currentUser ? FRIENDS.has(currentUser.id, profile.id) : false;
  const hasPending = currentUser ? FRIEND_REQ.hasPending(currentUser.id, profile.id) : false;
  const handleFriendBtn = () => {
    if (isFriend) { FRIENDS.remove(currentUser.id, profile.id); return; }
    if (!hasPending) FRIEND_REQ.send(currentUser.id, currentUser.name, profile.id);
  };
  const startChat = () => {
    if (onGoToMessages) { onGoToMessages(profile.name); onClose(); }
    else onClose();
  };
  return (
    <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.85)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={onClose}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 30px 80px rgba(0,0,0,.8)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>Profil joueur</div>
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
                  <span key={def.id} title={`${def.name} — ${tier.label}`}
                    style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:C.text,background:C.card,border:`1px solid rgba(255,215,0,.3)`,borderRadius:16,padding:"3px 8px"}}>
                    {def.emoji} {tier.medal} {def.name}
                  </span>
                ))}
                {refBadge.badge && (
                  <span title={`Parrainage — ${refBadge.name}`}
                    style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:C.text,background:C.card,border:`1px solid rgba(205,127,50,.3)`,borderRadius:16,padding:"3px 8px"}}>
                    {refBadge.badge} {refBadge.name}
                  </span>
                )}
              </div>
            );
          })()}
          {profile.record && Object.keys(profile.record).length>0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Ratio V / D par sport</div>
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
                          <span style={{fontSize:12,fontWeight:700,color:C.green}}>✅ {w}V</span>
                          <span style={{fontSize:12,fontWeight:700,color:C.red}}>❌ {l}D</span>
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
                {isFriend?"❌ Retirer ami":hasPending?"⏳ Demande envoyée":"➕ Envoyer une demande"}
              </button>
            )}
            <button onClick={startChat} style={{flex:1,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,background:C.accent,color:"#06090f",fontFamily:C.font,fontSize:13,fontWeight:700,cursor:"pointer"}}>
              💬 Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FRIEND CHALLENGE MODAL ───────────────────────────────────────────────────
function FriendChallengeModal({ user, friend, terrains, onClose }) {
  const sharedSports = (friend.sports||[]).filter(s=>(user.sports||[]).includes(s));
  const availSports  = sharedSports.length>0 ? sharedSports : (friend.sports?.length>0 ? friend.sports : ["football"]);
  const [sport,        setSport]       = useState(availSports[0]);
  const [day,          setDay]         = useState("Sam");
  const [hour,         setHour]        = useState("16h");
  const [msg,          setMsg]         = useState("");
  const [sent,         setSent]        = useState(false);
  const [matchTerrain, setMatchTerrain]= useState(null);
  const [tSearch,      setTSearch]     = useState("");

  const DAYS  = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
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
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:20,color:C.accent,marginBottom:8}}>Défi envoyé !</div>
        <div style={{fontSize:13,color:C.sub}}>Ton défi a été envoyé à <strong style={{color:C.text}}>{friend.name}</strong>.</div>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:"100%",maxWidth:400,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>⚔️ Défier {friend.name}</div>
            <div style={{fontSize:11,color:C.sub,marginTop:2}}>Défi direct · ami</div>
          </div>
          <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.sub,fontSize:18,lineHeight:1}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:14}}>
          {/* Sport */}
          {availSports.length>1 && (
            <div>
              <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Sport</div>
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
              <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Jour</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {DAYS.map(d=>(
                  <button key={d} onClick={()=>setDay(d)}
                    style={{padding:"5px 8px",borderRadius:8,border:`1.5px solid ${day===d?C.accent:C.border}`,background:day===d?C.aLow:"transparent",color:day===d?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Heure</div>
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
            <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Terrain (optionnel)</div>
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
                  placeholder={`Chercher un terrain de ${SPORTS.find(x=>x.id===sport)?.label||sport}…`}
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
            <div style={{fontSize:10,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Message (optionnel)</div>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Un petit message pour ton ami…" rows={2}
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",color:C.text,fontSize:13,outline:"none",fontFamily:C.font,resize:"none",boxSizing:"border-box"}}/>
          </div>
        </div>

        <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
          <button onClick={send} disabled={alreadySent}
            style={{width:"100%",padding:"13px",borderRadius:12,background:alreadySent?C.border:C.orange,border:"none",color:alreadySent?C.sub:"#06090f",fontSize:14,fontWeight:700,cursor:alreadySent?"default":"pointer",fontFamily:C.head,transition:"background .2s"}}>
            {alreadySent?"⏳ Défi déjà envoyé":"⚔️ Envoyer le défi"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SOCIAL VIEW ──────────────────────────────────────────────────────────────
function SocialView({ user, terrains, onGoToMessages }) {
  const {t} = useTranslation();
  useStore(FRIENDS);
  useStore(PROFILES_STORE);
  const [tab,setTab]             = useState("friends");
  const [query,setQuery]         = useState("");
  const [cityFilter,setCityFilter] = useState(null);
  const [selUser,setSelUser]     = useState(null);
  const [challengeFriend,setChallengeFriend] = useState(null);

  const others    = DB.filter(u=>u.id!==user.id);
  const allCities = [...new Set(DB.map(u=>u.city).filter(Boolean))];
  const friendIds = FRIENDS.list(user.id);
  const friendList = friendIds.map(id=>DB.find(u=>u.id===id)).filter(Boolean);

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
          {[["friends","👥 Amis"],["search","🔍 Rechercher"],["qr","📱 Mon QR"]].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,padding:"9px 0",border:"none",borderRadius:9,background:tab===t?C.accent:"transparent",color:tab===t?"#06090f":C.sub,fontFamily:C.font,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s",position:"relative"}}>
              {label}
              {t==="friends"&&friendList.length>0&&<span style={{marginLeft:5,background:tab===t?"#06090f22":C.accent,color:tab===t?"#06090f":"#06090f",borderRadius:8,padding:"1px 6px",fontSize:10,fontWeight:800}}>{friendList.length}</span>}
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
                  {friendList.length} ami{friendList.length>1?"s":""}
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
                        <div style={{fontSize:11,color:C.sub,marginTop:2}}>📍 {u.city} · <span style={{color:C.accent}}>{u.level}</span></div>
                        <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                          {u.sports?.slice(0,4).map(sid=>{const s=SPORTS.find(x=>x.id===sid);return s?<span key={sid} title={s.label}><SportEmoji sport={s} size={13}/></span>:null;})}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
                        <button onClick={e=>{e.stopPropagation();CHAT.cid(user.name,u.name);if(onGoToMessages)onGoToMessages(u.name);}}
                          style={{background:C.accent,border:"none",borderRadius:8,padding:"6px 12px",color:"#06090f",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                          💬 Message
                        </button>
                        <button onClick={e=>{e.stopPropagation();setChallengeFriend(u);}}
                          style={{background:`${C.orange}20`,border:`1px solid ${C.orange}44`,borderRadius:8,padding:"6px 12px",color:C.orange,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>
                          ⚔️ Défier
                        </button>
                        <button onClick={e=>{e.stopPropagation();FRIENDS.remove(user.id,u.id);}}
                          style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px",color:C.sub,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:C.font}}>
                          Retirer
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
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un joueur, une ville…"
                style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 14px 11px 42px",color:C.text,fontSize:14,outline:"none",fontFamily:C.font,boxSizing:"border-box"}}/>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",opacity:.4,fontSize:16}}>🔍</span>
              {query&&<button onClick={()=>setQuery("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:16,padding:0,lineHeight:1}}>✕</button>}
            </div>

            {/* City filter chips */}
            <div style={{overflowX:"auto",display:"flex",gap:6,paddingBottom:4,marginBottom:12,scrollbarWidth:"none"}}>
              <button onClick={()=>setCityFilter(null)}
                style={{flexShrink:0,padding:"5px 12px",borderRadius:20,border:`1.5px solid ${!cityFilter?C.accent:C.border}`,background:!cityFilter?C.aLow:"transparent",color:!cityFilter?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,whiteSpace:"nowrap"}}>
                🌍 Tous
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
                ? `${filtered.length} joueur${filtered.length!==1?"s":""} à ${cityFilter}`
                : query
                  ? `${filtered.length} résultat${filtered.length!==1?"s":""}`
                  : `${others.length} joueurs`}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {filtered.length===0 && (
                <div style={{textAlign:"center",padding:"40px 20px",color:C.sub}}>
                  <div style={{fontSize:32,marginBottom:10}}>🔍</div>
                  <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Aucun joueur trouvé</div>
                  <div style={{fontSize:12}}>Essaie une autre ville ou un autre nom</div>
                </div>
              )}
              {filtered.map(u=>(
                <div key={u.id} onClick={()=>setSelUser(u)}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",transition:"border-color .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent+"55"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <Avatar name={u.name} size={46} color={C.accent} photo={u.avatar}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:14,fontWeight:700,color:C.text}}>{u.name}</span>
                      {u.verified&&<span style={{fontSize:9,color:C.green,fontWeight:700}}>✅</span>}
                    </div>
                    <div style={{fontSize:11,color:C.sub,marginTop:2,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                      <button onClick={e=>{e.stopPropagation();setCityFilter(u.city);setQuery("");}}
                        style={{background:"none",border:"none",padding:0,cursor:"pointer",color:cityFilter===u.city?C.accent:C.sub,fontSize:11,fontFamily:C.font,textDecoration:cityFilter===u.city?"underline":"none"}}>
                        📍 {u.city}
                      </button>
                      {(u.city||"").toLowerCase()===user.city?.toLowerCase()&&<span style={{background:`${C.accent}20`,color:C.accent,borderRadius:5,padding:"1px 5px",fontSize:9,fontWeight:700}}>{t('social.my_city')}</span>}
                      <span>·</span><span style={{color:C.accent}}>{u.level}</span>
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
  useStore(FRIENDS);

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
  const convs    = CHAT.list(user.name);
  const selConv  = sel ? CHAT.convs[sel]||[] : [];
  const selOther = sel ? sel.split("::").find(n=>n!==user.name) : null;

  // Team derived
  const userTeams = TEAMS_DATA.filter(t =>
    (ROSTER[t.id]||[]).some(m=>m.id===user.id) || t.captainId===user.id
  );
  const sp = id => SPORTS.find(s=>s.id===id);
  const selTeamObj  = selTeam ? TEAMS_DATA.find(t=>t.id===selTeam) : null;
  const teamMsgs    = selTeam ? TEAM_CHAT.messages(selTeam) : [];
  const dmUnread    = CHAT.totalUnread(user.name);
  const teamUnread  = TEAM_CHAT.totalUnread(user.id, userTeams.map(t=>t.id));

  const getProfile = name => DB.find(u=>u.name===name) || { name, id:null, city:"", level:"Amateur", bio:"", avatar:null, sports:[] };
  const openProfile = name => { if(name!==user.name) setViewProfile(getProfile(name)); };
  const selectConv  = id => { setSel(id); if(isMobile) setShowChat(true); };

  // Open DM when navigating from another view
  useEffect(()=>{
    if (!openWith) return;
    const cid = CHAT.cid(user.name, openWith);
    setSel(cid); setMsgTab("dm");
    if (isMobile) setShowChat(true);
  },[openWith]); // eslint-disable-line react-hooks/exhaustive-deps

  // DM auto-scroll + mark-read
  useEffect(()=>{ msgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[selConv.length]);
  useEffect(()=>{ if(sel) CHAT.markRead(sel,user.name); },[sel,selConv.length]);

  // Team chat auto-scroll + mark-read
  useEffect(()=>{ teamMsgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[selTeam,teamMsgs.length]);
  useEffect(()=>{ if(selTeam) TEAM_CHAT.markRead(selTeam,user.id); },[selTeam,teamMsgs.length]);

  // Supabase: load + subscribe to team messages
  useEffect(()=>{
    if (!selTeam) return;
    supabase.from('team_messages').select('*').eq('team_id',selTeam).order('created_at',{ascending:true})
      .then(({data})=>{
        if (data?.length) {
          TEAM_CHAT.byTeam[selTeam] = data.map(m=>({ id:m.id, userId:m.user_id, from:m.user_name, text:m.content, ts:m.created_at }));
          TEAM_CHAT.notify();
        }
      });
    const channel = supabase.channel(`team_chat_${selTeam}`)
      .on('postgres_changes',{ event:'INSERT', schema:'public', table:'team_messages', filter:`team_id=eq.${selTeam}` }, payload=>{
        const m = payload.new;
        const nm = { id:m.id, userId:m.user_id, from:m.user_name, text:m.content, ts:m.created_at };
        const ex = TEAM_CHAT.byTeam[selTeam] || [];
        if (!ex.find(x=>x.id===m.id)) { TEAM_CHAT.byTeam[selTeam] = [...ex, nm]; TEAM_CHAT.notify(); }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  },[selTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const REPLIES = [t('messages.quick_reply_1'),t('messages.quick_reply_2'),t('messages.quick_reply_3'),t('messages.quick_reply_4'),t('messages.quick_reply_5'),t('messages.quick_reply_6')];
  const simulateReply = useCallback(from => {
    setTimeout(()=>CHAT.send(from,user.name,REPLIES[Math.floor(Math.random()*REPLIES.length)]), 2000+Math.random()*2000);
  },[user.name]);

  const send = () => {
    if (!newMsg.trim()||!selOther) return;
    CHAT.send(user.name,selOther,newMsg.trim());
    simulateReply(selOther);
    setNewMsg("");
  };

  const sendTeamMsg = async () => {
    if (!teamMsg.trim()||!selTeam) return;
    const text = teamMsg.trim();
    setTeamMsg("");
    // Insert first to get the real UUID, then add locally with that id.
    // This ensures the Realtime dedup (find by id) works correctly.
    const { data } = await supabase
      .from('team_messages')
      .insert({ team_id:selTeam, user_id:user.id, user_name:user.name, content:text })
      .select()
      .single();
    if (data) {
      const nm = { id:data.id, userId:data.user_id, from:data.user_name, text:data.content, ts:data.created_at };
      const ex = TEAM_CHAT.byTeam[selTeam] || [];
      if (!ex.find(x=>x.id===nm.id)) { TEAM_CHAT.byTeam[selTeam] = [...ex, nm]; TEAM_CHAT.notify(); }
    }
  };

  const openConvWith = name => {
    if (!name.trim()) return;
    const id = CHAT.cid(user.name, name.trim());
    setSel(id); setShowNew(false); setNewTo(""); if(isMobile) setShowChat(true);
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
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>Messages</div>
          {msgTab==="dm" && <button onClick={()=>setShowNew(p=>!p)} style={{background:C.accent,border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#06090f",fontSize:18,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>}
        </div>

        {/* Tab switcher */}
        <div style={{display:"flex",gap:3,padding:"8px 10px",background:C.card,borderBottom:`1px solid ${C.border}`}}>
          <button onClick={()=>switchTab("dm")}
            style={{flex:1,borderRadius:8,border:"none",padding:"6px 4px",background:msgTab==="dm"?C.aLow:"transparent",color:msgTab==="dm"?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            💬 DMs
            {dmUnread>0 && <span style={{minWidth:15,height:15,borderRadius:8,background:C.accent,color:"#06090f",fontSize:9,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{dmUnread}</span>}
          </button>
          <button onClick={()=>switchTab("teams")}
            style={{flex:1,borderRadius:8,border:"none",padding:"6px 4px",background:msgTab==="teams"?`${C.purple}25`:"transparent",color:msgTab==="teams"?C.purple:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            👥 Équipes
            {teamUnread>0 && <span style={{minWidth:15,height:15,borderRadius:8,background:C.purple,color:"#fff",fontSize:9,fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{teamUnread}</span>}
          </button>
        </div>

        {/* ── DM tab ── */}
        {msgTab==="dm" && (
          <>
            {showNew && (()=>{
              const friendIds   = FRIENDS.list(user.id);
              const friendList  = friendIds.map(id=>DB.find(u=>u.id===id)).filter(Boolean);
              const otherPlayers= SEED_PLAYERS.filter(p=>p.name!==user.name&&!friendList.find(f=>f.name===p.name));
              const allPlayers  = [...friendList.map(f=>({name:f.name,isFriend:true})), ...otherPlayers.map(p=>({name:p.name,isFriend:false}))];
              const q = newTo.trim().toLowerCase();
              const filtered = q ? allPlayers.filter(p=>p.name.toLowerCase().includes(q)) : allPlayers;
              return (
                <div style={{padding:12,borderBottom:`1px solid ${C.border}`,background:C.card2}}>
                  <div style={{fontSize:11,color:C.sub,fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{t('messages.new_conv')}</div>
                  <input value={newTo} onChange={e=>setNewTo(e.target.value)} placeholder="Rechercher un joueur…"
                    style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:C.font,boxSizing:"border-box",marginBottom:8}}/>
                  <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:180,overflowY:"auto"}}>
                    {filtered.length===0
                      ? <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"12px 0"}}>{t('messages.no_player_found')}</div>
                      : filtered.map(p=>(
                        <button key={p.name} onClick={()=>openConvWith(p.name)}
                          style={{display:"flex",alignItems:"center",gap:9,padding:"7px 10px",borderRadius:9,cursor:"pointer",fontFamily:C.font,background:C.card,border:`1px solid ${C.border}`,color:C.text,textAlign:"left",width:"100%"}}>
                          <Avatar name={p.name} size={28} color={p.isFriend?C.accent:C.sub} photo={DB.find(u=>u.name===p.name)?.avatar}/>
                          <div style={{flex:1,minWidth:0}}>
                            <UserBadge name={p.name} user={DB.find(x=>x.name===p.name)} size="sm" showInsignes={false}/>
                            {p.isFriend&&<div style={{fontSize:10,color:C.accent,marginTop:1}}>👥 Ami</div>}
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
                : convs.map(conv=>(
                    <div key={conv.id} onClick={()=>selectConv(conv.id)}
                      style={{padding:"11px 14px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:sel===conv.id?C.aLow:C.card,borderLeft:`3px solid ${sel===conv.id?C.accent:"transparent"}`}}>
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        <div style={{position:"relative",flexShrink:0}}>
                          <Avatar name={conv.other} size={36} color={C.accent}/>
                          {conv.unread>0 && <div style={{position:"absolute",top:-2,right:-2,width:16,height:16,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#06090f"}}>{conv.unread}</div>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <UserBadge name={conv.other} size="sm" showLevel={false} showInsignes={false}/>
                            <span style={{fontSize:10,color:C.sub}}>{conv.last?timeAgo(conv.last.ts):""}</span>
                          </div>
                          <div style={{fontSize:11,color:conv.unread>0?C.accent:C.sub,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:conv.unread>0?700:400}}>
                            {conv.last?.from===user.name?"Vous : ":""}{conv.last?.text||"Nouvelle conversation"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
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
                Rejoins une équipe pour accéder au chat de groupe.
              </div>
            ) : userTeams.map(team=>{
              const s = sp(team.sport);
              const unr = TEAM_CHAT.unread(team.id, user.id);
              const lastMsg = TEAM_CHAT.messages(team.id).slice(-1)[0];
              const memberCount = TEAM_REQ.teamMemberCount(team.id);
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
      {msgTab==="dm" && sel && selOther ? (
        <div style={{flex:1,display:isMobile&&!showChat?"none":"flex",flexDirection:"column",background:C.bg}}>
          <div style={{padding:"12px 20px",background:C.card,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
            {isMobile && <button onClick={()=>setShowChat(false)} style={{background:"none",border:"none",color:C.accent,fontSize:18,cursor:"pointer",padding:"0 6px 0 0",flexShrink:0}}>←</button>}
            <div onClick={()=>openProfile(selOther)} style={{cursor:"pointer",flexShrink:0}}>
              <Avatar name={selOther} size={38} color={C.accent}/>
            </div>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>openProfile(selOther)}>
              <div style={{fontSize:15,fontWeight:700,color:C.text,display:"flex",alignItems:"center",gap:6}}>
                {selOther}
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
                {t('messages.start_conv', {name: selOther})}
              </div>
            )}
            {selConv.map(msg=>{
              const isMe=msg.from===user.name;
              return (
                <div key={msg.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",gap:8,alignItems:"flex-end"}}>
                  {!isMe && (
                    <div onClick={()=>openProfile(msg.from)} style={{cursor:"pointer",flexShrink:0}}>
                      <Avatar name={msg.from} size={26} color={C.accent}/>
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
                placeholder={`Message à ${selOther}…`} rows={1}
                style={{flex:1,background:"none",border:"none",outline:"none",color:C.text,fontSize:13,fontFamily:C.font,resize:"none",lineHeight:1.4}}/>
            </div>
            <button onClick={send} disabled={!newMsg.trim()}
              style={{width:42,height:42,borderRadius:12,border:"none",cursor:newMsg.trim()?"pointer":"not-allowed",background:newMsg.trim()?C.accent:C.card2,color:newMsg.trim()?"#06090f":C.sub,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              ➤
            </button>
          </div>
        </div>

      /* ── Team chat panel ── */
      ) : msgTab==="teams" && selTeam && selTeamObj ? (
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
                <span>· {TEAM_REQ.teamMemberCount(selTeam)} membres</span>
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
                    <div style={{padding:"10px 14px",borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",background:isMe?`${C.purple}22`:C.card,border:`1px solid ${isMe?C.purple+"55":C.border}`,fontSize:13,color:C.text,lineHeight:1.5}}>
                      {msg.text}
                    </div>
                    <div style={{fontSize:9,color:C.sub,marginTop:3,textAlign:isMe?"right":"left"}}>
                      {timeAgo(msg.ts)}
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
                placeholder={`Message à ${selTeamObj.name}…`} rows={1}
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
            {msgTab==="teams" ? "Chats d'équipe" : "Vos messages"}
          </div>
          <div style={{fontSize:13,textAlign:"center",maxWidth:280,lineHeight:1.6,color:C.sub}}>
            {msgTab==="teams"
              ? "Sélectionnez une équipe pour voir le chat de groupe."
              : <>Sélectionnez une conversation ou cliquez sur <span style={{color:C.accent,fontWeight:700}}>+</span> pour contacter un joueur.</>
            }
          </div>
        </div>
      )}

      {viewProfile && <UserProfileModal profile={viewProfile} currentUser={user} onClose={()=>setViewProfile(null)}
        onGoToMessages={name=>{ selectConv(CHAT.cid(user.name,name)); setMsgTab("dm"); setViewProfile(null); }}/>}
    </div>
  );
}

// ─── PROFILE VIEW ─────────────────────────────────────────────────────────────
function ProfileView({ user, onLogout, onUpdate, onGoSupport, onGoAdmin }) {
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
                        placeholder="Votre ville…"
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
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>⚡ Expérience & Niveau</div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:`${lvColor}18`,border:`2px solid ${lvColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.head,fontWeight:800,fontSize:22,color:lvColor,flexShrink:0}}>
                  {curLv.level}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>Niveau {curLv.level}</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:1}}>{xp.toLocaleString()} XP total</div>
                  {nextLv ? (
                    <div style={{marginTop:7}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.sub,marginBottom:3}}>
                        <span>Niveau {nextLv.level} à {nextLv.xp.toLocaleString()} XP</span>
                        <span style={{color:lvColor,fontWeight:700}}>{progress}%</span>
                      </div>
                      <div style={{height:6,borderRadius:3,background:C.card2,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,background:lvColor,width:`${progress}%`,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  ) : <div style={{fontSize:11,color:lvColor,fontWeight:700,marginTop:6}}>🏆 Niveau maximum !</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:8,fontSize:11,color:C.sub,flexWrap:"wrap"}}>
                {[["🏟️",`+${XP_REWARDS.terrain} XP terrain créé`],["🏃",`+${XP_REWARDS.visit} XP terrain visité`],["⚽",`+${XP_REWARDS.match} XP match joué`],["🤝",`+${XP_REWARDS.referral} XP parrainage`]].map(([ico,lbl])=>(
                  <span key={lbl} style={{background:C.card2,borderRadius:20,padding:"3px 9px"}}>{ico} {lbl}</span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Insignes */}
        {(() => {
          const liveUser = DB.find(x=>x.id===user.id)||user;
          const allBadges = getUserBadges(liveUser);
          return (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>🎖️ Insignes</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {allBadges.map(({def,tier})=>{
                  const val = def.stat(liveUser);
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
                            <span style={{fontSize:13,fontWeight:700,color:tier?C.text:C.sub}}>{def.name}</span>
                            {tier && <span style={{fontSize:13}}>{tier.medal}</span>}
                            {!tier && <span style={{fontSize:10,color:C.sub,background:C.card,borderRadius:4,padding:"1px 6px"}}>Non débloqué</span>}
                          </div>
                          <div style={{fontSize:10,color:C.sub,marginTop:1}}>{def.desc} · {val}/{(tier?next||def.tiers[def.tiers.length-1]:def.tiers[0]).min}</div>
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
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>🎨 Couleur du pseudo</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {NAME_COLORS.map(nc=>{
                  const locked  = curLevel < nc.minLevel;
                  const active  = current===nc.value||(current===null&&nc.id==="default");
                  const preview = nc.special==="gold" ? "linear-gradient(90deg,#FFD700,#FFA500,#FFD700)" : null;
                  return (
                    <button key={nc.id} onClick={locked?undefined:()=>onUpdate({...user,nameColor:nc.value})}
                      title={locked?`Niveau ${nc.minLevel} requis`:nc.label}
                      style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,cursor:locked?"not-allowed":"pointer",fontFamily:C.font,fontWeight:600,fontSize:12,
                        background:active?`${C.accent}18`:C.card2,
                        border:`1.5px solid ${active?C.accent:C.border}`,
                        opacity:locked?0.38:1,transition:"all .15s",position:"relative"}}>
                      <span style={{width:12,height:12,borderRadius:"50%",display:"inline-block",flexShrink:0,
                        background:nc.special==="gold"?"linear-gradient(135deg,#FFD700,#FFA500)":nc.value||C.text,
                        border:`1px solid rgba(255,255,255,.2)`}}/>
                      <ColoredName name={nc.label} nameColor={nc.value}/>
                      {locked && <span style={{position:"absolute",top:-6,right:-4,fontSize:9,background:C.card2,border:`1px solid ${C.border}`,borderRadius:6,padding:"1px 4px",color:C.sub}}>Niv.{nc.minLevel}</span>}
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
            if (navigator.share) { navigator.share({ title:"RVF", text:"Rejoins-moi sur RVF !", url:link }).catch(()=>{}); }
            else { navigator.clipboard.writeText(link).catch(()=>{}); }
          };
          return (
            <div style={{background:C.card,border:`1px solid ${curLv.color}44`,borderRadius:14,padding:16,marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>🎁 Parrainage</div>

              {/* Level badge row */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:`${curLv.color}18`,border:`2px solid ${curLv.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
                  {curLv.badge||"🏅"}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:C.head,fontWeight:700,fontSize:16,color:C.text}}>
                    Niveau {curLv.level} — {curLv.name}
                  </div>
                  <div style={{fontSize:12,color:C.sub,marginTop:2}}>{count} filleul{count!==1?"s":""} parrainé{count!==1?"s":""}</div>
                  {nextLv ? (
                    <div style={{marginTop:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.sub,marginBottom:4}}>
                        <span>{count}/{nextLv.min} pour {nextLv.badge} {nextLv.name}</span>
                        <span style={{color:curLv.color,fontWeight:700}}>{progress}%</span>
                      </div>
                      <div style={{height:6,borderRadius:3,background:C.card2,overflow:"hidden"}}>
                        <div style={{height:"100%",borderRadius:3,background:curLv.color,width:`${progress}%`,transition:"width .6s ease"}}/>
                      </div>
                    </div>
                  ) : (
                    <div style={{marginTop:6,fontSize:11,color:curLv.color,fontWeight:700}}>🏆 Niveau maximum atteint !</div>
                  )}
                </div>
              </div>

              {/* Levels legend */}
              <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
                {REFERRAL_LEVELS.map(l=>(
                  <div key={l.level} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,background:count>=l.min&&l.badge?`${l.color}18`:C.card2,border:`1px solid ${count>=l.min&&l.badge?l.color+"55":C.border}`,opacity:count>=l.min?1:0.45}}>
                    <span style={{fontSize:12}}>{l.badge||"🌱"}</span>
                    <span style={{fontSize:10,fontWeight:600,color:count>=l.min?l.color:C.sub}}>{l.name}</span>
                  </div>
                ))}
              </div>

              {/* Share button */}
              <Btn onClick={share} variant="ghost" full style={{fontSize:13,padding:"10px 14px"}}>
                🔗 Inviter des amis · <span style={{opacity:.7,fontSize:11,fontFamily:"monospace"}}>{code}</span>
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
                            <span style={{fontSize:11,color:C.green,fontWeight:700}}>{w}V</span>
                            <span style={{fontSize:11,color:C.yellow,fontWeight:700}}>{d}N</span>
                            <span style={{fontSize:11,color:C.red,fontWeight:700}}>{l}D</span>
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
          const vTerrains = TERRAINS.filter(t=>visited.includes(t.id));
          if (!vTerrains.length) return null;
          const allSports = [...new Set(vTerrains.map(t=>t.sport))];
          const ratios = allSports.map(sid=>{
            const s=SPORTS.find(x=>x.id===sid);
            const total=TERRAINS.filter(t=>t.sport===sid).length;
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
              {LEVELS.map(l=><Chip key={l} active={level===l} onClick={()=>setLevel(l)} color={C.purple}>{l}</Chip>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SUPPORT VIEW ─────────────────────────────────────────────────────────────
function SupportView({ user, onBack }) {
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
    if (!desc.trim() || desc.trim().length < 10) { setErr("Décris le problème (10 caractères min)."); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch(`${API}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ type: phase, description: desc.trim() }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) { setSent(true); setDesc(""); }
      else { const d = await res.json(); setErr(d.error || "Erreur lors de l'envoi."); }
    } catch { setErr("Serveur inaccessible — réessaie plus tard."); }
    finally { setSending(false); }
  };

  const backBtn = (
    <button onClick={() => { setPhase("menu"); setSent(false); setErr(""); setDesc(""); }}
      style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.sub,fontSize:13,cursor:"pointer",fontFamily:C.font,marginBottom:20,padding:0}}>
      ← Retour
    </button>
  );

  if (phase === "maintenance") {
    const active = maintenance?.active;
    return (
      <div style={{flex:1,overflowY:"auto",padding:24}}>
        <div style={{maxWidth:500,margin:"0 auto"}}>
          {backBtn}
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.text,marginBottom:20}}>🔧 Maintenances en cours</div>
          {active
            ? <div style={{background:`${C.orange}18`,border:`1px solid ${C.orange}44`,borderRadius:14,padding:20}}>
                <div style={{fontWeight:700,color:C.orange,fontSize:15,marginBottom:8}}>⚠️ Maintenance active</div>
                <div style={{color:C.text,fontSize:14,lineHeight:1.6}}>{maintenance.message || "Une maintenance est en cours."}</div>
              </div>
            : <div style={{background:C.card,border:`1px solid ${C.green}33`,borderRadius:14,padding:20,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:10}}>✅</div>
                <div style={{color:C.green,fontWeight:700,fontSize:15}}>Aucune maintenance en cours</div>
                <div style={{color:C.sub,fontSize:12,marginTop:6}}>Tous les services fonctionnent normalement.</div>
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
            {isHack ? "🔴 Signaler une activité suspecte" : "🐛 Signaler un bug"}
          </div>
          <div style={{fontSize:13,color:C.sub,marginBottom:20,lineHeight:1.5}}>
            {isHack ? "Compte piraté, comportement abusif, contenu inapproprié..." : "Décris précisément le bug rencontré."}
          </div>
          {sent
            ? <div style={{background:`${C.green}15`,border:`1px solid ${C.green}44`,borderRadius:14,padding:20,textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:10}}>✅</div>
                <div style={{color:C.green,fontWeight:700,fontSize:15}}>Signalement envoyé !</div>
                <div style={{color:C.sub,fontSize:12,marginTop:6}}>Notre équipe va examiner ça rapidement.</div>
                <button onClick={()=>setSent(false)}
                  style={{marginTop:14,background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 18px",color:C.text,fontSize:12,cursor:"pointer",fontFamily:C.font}}>
                  Envoyer un autre signalement
                </button>
              </div>
            : <>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={6}
                  placeholder={isHack ? "Ex: Un utilisateur m'envoie des messages menaçants..." : "Ex: Quand je clique sur 'Ajouter un terrain', l'app plante..."}
                  style={{width:"100%",background:C.card2,border:`1.5px solid ${err?C.red:C.border}`,borderRadius:10,padding:"12px 14px",color:C.text,fontSize:13,fontFamily:C.font,outline:"none",resize:"vertical",lineHeight:1.6,marginBottom:12}}/>
                {err && <ErrBox msg={err}/>}
                <Btn onClick={submit} loading={sending} style={{background:color}}>
                  {isHack ? "🔴 Signaler l'activité" : "🐛 Envoyer le rapport"}
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
          ← Profil
        </button>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:24,color:C.text,marginBottom:6}}>🛡️ Support & Sécurité</div>
        <div style={{fontSize:13,color:C.sub,marginBottom:24}}>Signale un problème ou consulte le statut des services.</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            { key:"bug",         icon:"🐛", title:"Signaler un bug",            desc:"L'app ne fonctionne pas comme prévu ?",    color:C.blue   },
            { key:"hack",        icon:"🔴", title:"Activité suspecte / piratage",desc:"Compte compromis, comportement abusif...", color:C.red    },
            { key:"maintenance", icon:"🔧", title:"Maintenances en cours",       desc:maintenance?.active?"⚠️ Une maintenance est active":"✅ Aucune maintenance", color:C.orange },
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
function AdminView({ onBack, onMaintenanceChange }) {
  const [tab,        setTab]        = useState("reports");
  const [reports,    setReports]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [maintActive, setMaintActive] = useState(false);
  const [maintMsg,   setMaintMsg]   = useState("");
  const [maintSaved, setMaintSaved] = useState(false);
  const [blockEmail, setBlockEmail] = useState("");
  const [blockResult,setBlockResult]= useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/admin/reports`, { headers: authHeader(), signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API}/api/maintenance`, { signal: AbortSignal.timeout(3000) })
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([rData, mData]) => {
      if (rData?.reports) setReports(rData.reports);
      if (mData) { setMaintActive(mData.active); setMaintMsg(mData.message || ""); }
      setLoading(false);
    });
  }, []);

  const updateStatus = (id, status) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    fetch(`${API}/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  };

  const saveMaintenance = async () => {
    const res = await fetch(`${API}/api/admin/maintenance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ active: maintActive, message: maintMsg }),
    }).catch(() => null);
    if (res?.ok) {
      onMaintenanceChange(maintActive ? maintMsg : null);
      setMaintSaved(true);
      setTimeout(() => setMaintSaved(false), 2000);
    }
  };

  const doBlock = async () => {
    if (!blockEmail.trim()) return;
    const res = await fetch(`${API}/api/admin/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ email: blockEmail.trim() }),
    }).catch(() => null);
    if (res?.ok) setBlockResult("✅ Utilisateur bloqué.");
    else if (res?.status === 404) setBlockResult("❌ Email introuvable.");
    else setBlockResult("❌ Erreur serveur.");
  };

  const STATUS_LABELS = { new:"🔵 Nouveau", in_progress:"🟡 En cours", resolved:"✅ Résolu" };
  const STATUS_COLORS = { new:C.blue, in_progress:C.orange, resolved:C.green };

  const tabs = [
    { id:"reports",     label:"📋 Signalements", count: reports.filter(r=>r.status==="new").length },
    { id:"maintenance", label:"🔧 Maintenance" },
    { id:"block",       label:"🚫 Blocage" },
  ];

  return (
    <div style={{flex:1,overflowY:"auto",padding:24}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <button onClick={onBack}
          style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:C.sub,fontSize:13,cursor:"pointer",fontFamily:C.font,marginBottom:16,padding:0}}>
          ← Profil
        </button>
        <div style={{fontFamily:C.head,fontWeight:700,fontSize:22,color:C.accent,marginBottom:20}}>⚙️ Panneau Admin</div>

        {/* Tabs */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{flex:1,padding:"9px 6px",borderRadius:10,border:`1px solid ${tab===t.id?C.accent+"44":C.border}`,background:tab===t.id?C.aLow:C.card,color:tab===t.id?C.accent:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:C.font,position:"relative"}}>
              {t.label}
              {t.count>0 && <span style={{marginLeft:4,background:C.red,color:"#fff",borderRadius:10,padding:"1px 5px",fontSize:9,fontWeight:800}}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Reports */}
        {tab === "reports" && (
          loading
            ? <div style={{color:C.sub,textAlign:"center",padding:40}}>Chargement...</div>
            : reports.length === 0
              ? <div style={{color:C.sub,textAlign:"center",padding:40}}>Aucun signalement.</div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {reports.map(r => (
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

        {/* Maintenance */}
        {tab === "maintenance" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:16}}>Mode maintenance</div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <button onClick={()=>setMaintActive(p=>!p)}
                style={{width:46,height:26,borderRadius:13,border:"none",cursor:"pointer",background:maintActive?C.orange:C.card2,transition:"background .2s",flexShrink:0,position:"relative"}}>
                <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:3,transition:"left .2s",left:maintActive?23:3}}/>
              </button>
              <span style={{fontSize:13,fontWeight:600,color:maintActive?C.orange:C.sub}}>
                {maintActive?"🔧 Maintenance ACTIVE":"✅ Services normaux"}
              </span>
            </div>
            <textarea value={maintMsg} onChange={e=>setMaintMsg(e.target.value)} rows={3}
              placeholder="Message affiché à tous les utilisateurs..."
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",color:C.text,fontSize:13,fontFamily:C.font,outline:"none",resize:"vertical",marginBottom:12}}/>
            <Btn onClick={saveMaintenance} style={{background:maintActive?C.orange:C.accent}}>
              {maintSaved ? "✅ Sauvegardé !" : "Sauvegarder"}
            </Btn>
          </div>
        )}

        {/* Block */}
        {tab === "block" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:6}}>Bloquer un utilisateur</div>
            <div style={{fontSize:12,color:C.sub,marginBottom:16}}>L'utilisateur ne pourra plus se connecter.</div>
            <input value={blockEmail} onChange={e=>{setBlockEmail(e.target.value);setBlockResult("");}}
              placeholder="Email de l'utilisateur..."
              style={{width:"100%",background:C.card2,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",color:C.text,fontSize:13,fontFamily:C.font,outline:"none",marginBottom:12}}/>
            {blockResult && (
              <div style={{marginBottom:12,fontSize:13,color:blockResult.startsWith("✅")?C.green:C.red,fontWeight:600}}>{blockResult}</div>
            )}
            <Btn onClick={doBlock} variant="danger">🚫 Bloquer cet utilisateur</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INVITATIONS PANEL ────────────────────────────────────────────────────────
function InvitesPanel({ user, onClose }) {
  useStore(INV);
  useStore(TEAM_REQ);
  useStore(FRIEND_REQ);
  useStore(FRIENDS);
  useStore(MATCH_SCORE);
  useStore(MATCH_REQ);
  const [tab,setTab]         = useState("friend");
  const [scoreInputs,setScoreInputs] = useState({});
  const invites         = INV.forUser(user?.name||"");
  const teamReqs        = TEAM_REQ.reqsForCaptain(user?.id||"");
  const allTeamReqs     = TEAM_REQ.list.filter(r=>r.captainId===user?.id);
  const friendReqs      = FRIEND_REQ.reqsFor(user?.id||"");
  const scoreReqs       = MATCH_SCORE.forUser(user?.name||"");
  const friendChallenges = MATCH_REQ.friendChallengesFor(user?.id||"");
  const sp = id => SPORTS.find(s=>s.id===id);
  const stCol = s => s==="accepted"?C.green:s==="declined"||s==="rejected"?C.red:C.yellow;
  const matchPending  = INV.pending(user.name) + friendChallenges.length;
  const teamPending   = teamReqs.length;
  const friendPending = FRIEND_REQ.pending(user.id);
  const scorePending  = MATCH_SCORE.pendingForUser(user?.name||"");

  const setScore = (id, field, val) => setScoreInputs(p=>({...p,[id]:{...(p[id]||{a:"",b:""}), [field]:val}}));
  const submitScore = req => {
    const inp = scoreInputs[req.id]||{a:"",b:""};
    const a = parseInt(inp.a||"0",10), b = parseInt(inp.b||"0",10);
    if (isNaN(a)||isNaN(b)) return;
    MATCH_SCORE.submit(req.id, `${a} - ${b}`, user.name);
    addXP(user.id, XP_REWARDS.match);
    setScoreInputs(p=>({...p,[req.id]:undefined}));
  };

  const acceptFriendReq = req => {
    FRIENDS.add(user.id, req.fromId);
    FRIENDS.add(req.fromId, user.id);
    FRIEND_REQ.respond(req.id, "accepted");
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
          <div style={{fontFamily:C.head,fontWeight:700,fontSize:18,color:C.text}}>🤝 Notifications</div>
          <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:C.sub,fontSize:18}}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",background:C.card2,margin:"12px 16px 0",borderRadius:10,padding:3,gap:2,flexShrink:0}}>
          {[["friend","👤 Amis",friendPending,C.accent],["match","🤝 Matchs",matchPending,C.accent],["team","👥 Équipes",teamPending,C.accent],["score","⚽ Scores",scorePending,C.orange]].map(([t,label,cnt,col])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,padding:"7px 0",border:"none",borderRadius:8,background:tab===t?col:"transparent",color:tab===t?"#06090f":C.sub,fontFamily:C.font,fontSize:10,fontWeight:700,cursor:"pointer",transition:"all .2s",position:"relative"}}>
              {label}
              {cnt>0&&<span style={{marginLeft:3,background:tab===t?"#06090f22":col,color:tab===t?"#06090f":C.bg,borderRadius:8,padding:"1px 5px",fontSize:9,fontWeight:800}}>{cnt}</span>}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}}>
          {tab==="friend" && (
            friendReqs.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>👤</div>Aucune demande d'ami.</div>
              : friendReqs.map(req=>{
                  const fromUser = DB.find(u=>u.id===req.fromId);
                  const isPending = req.status==="pending";
                  return (
                    <div key={req.id} style={{background:C.card2,border:`1px solid ${isPending?C.accent+"44":C.border}`,borderRadius:14,padding:14}}>
                      <div style={{display:"flex",gap:10,marginBottom:isPending?10:0,alignItems:"center"}}>
                        <Avatar name={req.fromName} size={44} color={C.accent} photo={fromUser?.avatar}/>
                        <div style={{flex:1,minWidth:0}}>
                          <UserBadge name={req.fromName} size="sm" showLevel showInsignes/>
                          {fromUser?.city&&<div style={{fontSize:11,color:C.sub,marginTop:1}}>📍 {fromUser.city}</div>}
                          {fromUser?.level&&<div style={{marginTop:4}}><Badge label={fromUser.level} color={C.accent}/></div>}
                          <div style={{fontSize:10,color:C.sub,marginTop:4}}>{timeAgo(req.ts)}</div>
                        </div>
                      </div>
                      {isPending ? (
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>acceptFriendReq(req)} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ Accepter</button>
                          <button onClick={()=>FRIEND_REQ.respond(req.id,"declined")} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ Refuser</button>
                        </div>
                      ) : (
                        <div style={{textAlign:"center",padding:"5px",borderRadius:8,background:req.status==="accepted"?"rgba(81,207,102,.1)":"rgba(255,107,107,.08)"}}>
                          <span style={{fontSize:12,fontWeight:700,color:stCol(req.status)}}>{req.status==="accepted"?"✅ Demande acceptée":"❌ Demande refusée"}</span>
                        </div>
                      )}
                    </div>
                  );
                })
          )}

          {tab==="match" && (
            invites.length===0 && friendChallenges.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>🤝</div>Aucune invitation de match.</div>
              : <>
                  {friendChallenges.map(r=>{
                    const fromUser = DB.find(u=>u.id===r.fromUserId);
                    const s = SPORTS.find(x=>x.id===r.sport);
                    return (
                      <div key={r.id} style={{background:C.card2,border:`1px solid ${C.orange}44`,borderRadius:14,padding:14}}>
                        <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
                          <Avatar name={r.fromUserName} size={42} color={C.orange} photo={fromUser?.avatar}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:3}}>⚔️ DÉFI D'AMI</div>
                            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><UserBadge name={r.fromUserName} size="sm" showLevel showInsignes/><span style={{fontSize:12,color:C.sub,fontWeight:400}}>{t('invites.challenges_from')}</span></div>
                            {s&&<div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}><SportEmoji sport={s} size={13}/><span style={{fontSize:12,color:s.color,fontWeight:700}}>{s.label}</span></div>}
                            {r.terrainName&&<div style={{fontSize:12,fontWeight:700,color:C.text,marginTop:2}}>🏟️ {r.terrainName}{r.terrainCity?<span style={{color:C.accent,fontWeight:400}}> · {r.terrainCity}</span>:""}</div>}
                            <div style={{fontSize:12,color:C.sub,marginTop:1}}>📅 {r.day} · {r.hour}</div>
                            {r.message&&<div style={{fontSize:12,color:C.text,marginTop:6,background:C.card,borderRadius:8,padding:"6px 10px",fontStyle:"italic"}}>"{r.message}"</div>}
                            <div style={{fontSize:10,color:C.sub,marginTop:4}}>{timeAgo(r.ts)}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>MATCH_REQ.respond(r.id,"accepted")} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ Accepter</button>
                          <button onClick={()=>MATCH_REQ.respond(r.id,"declined")} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ Refuser</button>
                        </div>
                      </div>
                    );
                  })}
                  {invites.map(inv=>{
                    const s=sp(inv.sport), isPending=inv.status==="pending";
                    const invTerrain = inv.terrainId ? TERRAINS.find(t=>t.id===inv.terrainId) : null;
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
                            <button onClick={()=>INV.respond(inv.id,"accepted")} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ Accepter</button>
                            <button onClick={()=>INV.respond(inv.id,"declined")} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ Refuser</button>
                          </div>
                        ) : (
                          <div style={{textAlign:"center",padding:"5px",borderRadius:8,background:inv.status==="accepted"?"rgba(81,207,102,.1)":"rgba(255,107,107,.08)"}}>
                            <span style={{fontSize:12,fontWeight:700,color:stCol(inv.status)}}>{inv.status==="accepted"?"✅ Accepté":"❌ Refusé"}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
          )}

          {tab==="team" && (
            allTeamReqs.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>👥</div>{t('invites.no_teams')}</div>
              : allTeamReqs.map(req=>{
                  const fromUser = DB.find(u=>u.id===req.fromUserId);
                  const isPending = req.status==="pending";
                  return (
                    <div key={req.id} style={{background:C.card2,border:`1px solid ${isPending?C.accent+"44":C.border}`,borderRadius:14,padding:14}}>
                      <div style={{display:"flex",gap:10,marginBottom:10,alignItems:"center"}}>
                        <Avatar name={req.fromName} size={40} color={C.accent} photo={fromUser?.avatar}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><UserBadge name={req.fromName} size="sm" showLevel showInsignes/><span style={{fontSize:12,color:C.sub,fontWeight:400}}>veut rejoindre</span></div>
                          <div style={{fontSize:13,fontWeight:700,color:C.accent,marginTop:1}}>{req.teamName}</div>
                          {req.note&&<div style={{fontSize:12,color:C.text,marginTop:5,background:C.card,borderRadius:8,padding:"6px 10px",fontStyle:"italic"}}>"{req.note}"</div>}
                          <div style={{fontSize:10,color:C.sub,marginTop:4}}>{timeAgo(req.ts)}</div>
                        </div>
                      </div>
                      {isPending ? (
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>acceptTeamReq(req)} style={{flex:1,padding:"9px",background:"rgba(81,207,102,.15)",border:"1px solid rgba(81,207,102,.4)",borderRadius:9,color:C.green,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>✅ Accepter</button>
                          <button onClick={()=>TEAM_REQ.respond(req.id,"rejected")} style={{flex:1,padding:"9px",background:"rgba(255,107,107,.1)",border:"1px solid rgba(255,107,107,.3)",borderRadius:9,color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:C.font}}>❌ Refuser</button>
                        </div>
                      ) : (
                        <div style={{textAlign:"center",padding:"6px",borderRadius:8,background:req.status==="accepted"?"rgba(81,207,102,.1)":"rgba(255,107,107,.08)"}}>
                          <span style={{fontSize:12,fontWeight:700,color:stCol(req.status)}}>{req.status==="accepted"?"✅ Accepté":"❌ Refusé"}</span>
                        </div>
                      )}
                    </div>
                  );
                })
          )}

          {tab==="score" && (
            scoreReqs.length===0
              ? <div style={{textAlign:"center",padding:32,color:C.sub,fontSize:13}}><div style={{fontSize:40,marginBottom:8}}>⚽</div>Aucun match terminé à noter.</div>
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
                          {isScored?"✅ Scoré":"⏳ En attente"}
                        </span>
                      </div>

                      {/* Teams */}
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,background:C.card,borderRadius:12,padding:"10px 12px"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:9,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Équipe A</div>
                          {teamA.map(n=><div key={n} style={{fontSize:11,color:n===user.name?C.accent:C.text,fontWeight:n===user.name?700:400}}>
                            {n===user.name?"👤 ":""}{n}
                          </div>)}
                        </div>
                        <div style={{fontFamily:C.head,fontWeight:800,fontSize:isScored?22:16,color:isScored?C.green:C.orange,background:isScored?`${C.green}15`:`${C.orange}15`,border:`2px solid ${isScored?C.green+"44":C.orange+"33"}`,borderRadius:10,padding:"6px 12px",textAlign:"center",minWidth:60}}>
                          {isScored ? req.score : "VS"}
                        </div>
                        <div style={{flex:1,textAlign:"right"}}>
                          <div style={{fontSize:9,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Équipe B</div>
                          {teamB.length>0 ? teamB.map(n=><div key={n} style={{fontSize:11,color:n===user.name?C.accent:C.text,fontWeight:n===user.name?700:400}}>
                            {n===user.name?"👤 ":""}{n}
                          </div>) : <div style={{fontSize:11,color:C.sub,fontStyle:"italic"}}>Solo</div>}
                        </div>
                      </div>

                      {/* Score entry or result */}
                      {isScored ? (
                        <div style={{textAlign:"center",fontSize:12,color:C.green,fontWeight:600}}>
                          Déclaré par {req.reportedBy} · {timeAgo(req.ts)}
                        </div>
                      ) : (
                        <>
                          <div style={{fontSize:11,fontWeight:700,color:C.orange,marginBottom:8}}>🏆 Entrez le score du match :</div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                            <div style={{flex:1,textAlign:"center"}}>
                              <div style={{fontSize:10,color:C.sub,marginBottom:4}}>Équipe A</div>
                              <input type="number" min="0" max="99" value={inp.a} onChange={e=>setScore(req.id,"a",e.target.value)}
                                style={{width:"100%",background:C.card,border:`2px solid ${C.orange}55`,borderRadius:10,padding:"10px 0",color:C.text,fontSize:22,fontWeight:800,fontFamily:C.head,textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
                            </div>
                            <div style={{fontFamily:C.head,fontWeight:800,fontSize:18,color:C.orange,flexShrink:0}}>–</div>
                            <div style={{flex:1,textAlign:"center"}}>
                              <div style={{fontSize:10,color:C.sub,marginBottom:4}}>Équipe B</div>
                              <input type="number" min="0" max="99" value={inp.b} onChange={e=>setScore(req.id,"b",e.target.value)}
                                style={{width:"100%",background:C.card,border:`2px solid ${C.orange}55`,borderRadius:10,padding:"10px 0",color:C.text,fontSize:22,fontWeight:800,fontFamily:C.head,textAlign:"center",outline:"none",boxSizing:"border-box"}}/>
                            </div>
                          </div>
                          <button onClick={()=>submitScore(req)}
                            disabled={inp.a===""||inp.b===""}
                            style={{width:"100%",padding:"12px",borderRadius:11,background:inp.a!==""&&inp.b!==""?C.orange:"#333",border:"none",color:inp.a!==""&&inp.b!==""?"#06090f":C.sub,fontFamily:C.font,fontSize:14,fontWeight:800,cursor:inp.a!==""&&inp.b!==""?"pointer":"not-allowed",boxShadow:inp.a!==""&&inp.b!==""?`0 4px 16px ${C.orange}55`:"none"}}>
                            🏆 Valider le score
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
  useStore(FRIEND_REQ);
  useStore(MATCH_SCORE);
  useStore(MATCH_REQ);
  const count = INV.pending(user.name) + TEAM_REQ.pendingForCaptain(user.id) + FRIEND_REQ.pending(user.id) + MATCH_SCORE.pendingForUser(user.name) + MATCH_REQ.friendChallengesFor(user.id).length;
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
  // Start with local TERRAINS constant; API load overrides in useEffect below
  const [terrains,setTerrains] = useState(TERRAINS);
  const [showInvites,setShowInvites]       = useState(false);
  const [openMsgWith,setOpenMsgWith]       = useState(null);
  const [maintenanceBanner,setMaintenanceBanner] = useState(null);
  const [userPos,setUserPos]   = useState(null);
  const [gpsError,setGpsError] = useState(null); // null | 1=denied | 2=unavailable | 3=timeout | 4=http
  const [gpsLoading,setGpsLoading] = useState(false);
  const isMobile = useIsMobile();

  // Auto-login via Supabase session (falls back to JWT token for Express backend)
  useEffect(()=>{
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile) { setUser(profile); setScreen('app'); return; }
      }
      // Fallback: JWT
      const token = localStorage.getItem('rvf_token');
      if (!token) return;
      fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.user) { setUser(d.user); setScreen('app'); } })
        .catch(() => {});
    });
  },[]);

  // Preload all Supabase profiles into DB so UserBadge can resolve nameColor for any user
  useEffect(()=>{
    supabase.from('profiles')
      .select('id,username,name,name_color,xp,referral_count,terrains,matchs')
      .then(({ data }) => {
        if (!data?.length) return;
        data.forEach(p => {
          const uname = p.name || p.username;
          if (!uname) return;
          const existing = DB.find(u => u.id === p.id);
          if (existing) {
            if (p.name_color  !== undefined) existing.nameColor     = p.name_color;
            if (p.xp          !== undefined) existing.xp            = p.xp;
            if (p.referral_count !== undefined) existing.referralCount = p.referral_count;
          } else if (!DB.find(u => u.name === uname)) {
            DB.push({
              id: p.id, name: uname,
              nameColor:     p.name_color     || null,
              xp:            p.xp             || 0,
              referralCount: p.referral_count || 0,
              terrains:      p.terrains       || 0,
              matchs:        p.matchs         || 0,
              citiesVisited: 0,
            });
          }
        });
        PROFILES_STORE.notify();
      });
  },[]);

  // Load terrains from Supabase; keep TERRAINS constant as fallback
  useEffect(()=>{
    supabase.from('terrains').select('*').then(({ data, error }) => {
      if (!error && data?.length) { setTerrains(data); return; }
      // Fallback: Express backend
      fetch(`${API}/api/terrains`, { signal: AbortSignal.timeout(5000) })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.terrains?.length) setTerrains(d.terrains); })
        .catch(() => {});
    });
  },[]);

  // Maintenance banner (shown globally when active)
  useEffect(()=>{
    fetch(`${API}/api/maintenance`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.active) setMaintenanceBanner(d.message || "Maintenance en cours."); })
      .catch(() => {});
  },[]);

  const requestGps = useCallback((highAccuracy=true) => {
    if (GPS_NEEDS_HTTPS) { setGpsError(4); return; }
    if (!navigator.geolocation) { setGpsError(2); return; }
    setGpsError(null);
    setGpsLoading(true);
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
        if (e.code===3 && highAccuracy) {
          requestGps(false);
        } else {
          setGpsError(e.code);
        }
      },
      {timeout: highAccuracy ? 20000 : 10000, enableHighAccuracy: highAccuracy, maximumAge:60000}
    );
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  // Géolocalisation → tri par proximité (vérif permission avant demande)
  useEffect(()=>{
    if (GPS_NEEDS_HTTPS) { setGpsError(4); return; }
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
    supabase.auth.signOut();
    localStorage.removeItem('rvf_token');
    setUser(null); setScreen('landing'); setView('map');
  };

  const doUpdate = u => {
    setUser(u);
    const dbU = DB.find(x=>x.id===u.id);
    if (dbU) { dbU.nameColor=u.nameColor; if(u.xp!==undefined) dbU.xp=u.xp; if(u.city!==undefined) dbU.city=u.city; }
    PROFILES_STORE.notify();
    const token = localStorage.getItem('rvf_token');
    if (!token) return; // local mock mode — no persistence needed
    fetch(`${API}/api/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(u),
    }).catch(() => {});
  };

  const addTerrain = async t => {
    if (user?.id) addXP(user.id, XP_REWARDS.terrain);
    const row = {
      id:       t.id,
      name:     t.name,
      sport:    t.sport,
      sports:   t.sports,
      city:     t.city,
      country:  t.country,
      surface:  t.surface,
      price:    t.price,
      lights:   t.lights,
      free:     t.free,
      phone:    t.phone || null,
      rating:   t.rating,
      players:  t.players,
      lat:      t.lat   || null,
      lng:      t.lng   || null,
      added_by: t.addedBy || user?.name || null,
      photos:   t.photos || [],
    };
    const { data: inserted, error } = await supabase.from('terrains').insert(row).select().single();
    if (!error && inserted) {
      setTerrains(p => [...p, { ...inserted, addedBy: inserted.added_by }]);
      return;
    }
    // Fallback: Express backend
    try {
      const res = await fetch(`${API}/api/terrains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(t),
      });
      const data = await res.json();
      if (data.terrain) { setTerrains(p => [...p, data.terrain]); return; }
    } catch {}
    // Offline fallback — add locally only
    setTerrains(p => [...p, t]);
  };

  const deleteTerrain = async id => {
    setTerrains(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from('terrains').delete().eq('id', id);
    if (error) {
      try { await fetch(`${API}/api/terrains/${id}`, { method: 'DELETE', headers: authHeader() }); } catch {}
    }
  };

  const updateTerrainPhone = async (terrainId, phone) => {
    setTerrains(prev => prev.map(t => t.id===terrainId ? {...t, phone} : t));
    setTerrain(prev => prev?.id===terrainId ? {...prev, phone} : prev);
    const { error } = await supabase.from('terrains').update({ phone }).eq('id', terrainId);
    if (error) {
      try {
        await fetch(`${API}/api/terrains/${terrainId}/phone`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ phone }),
        });
      } catch {}
    }
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
                  const userTeamIds = user ? TEAMS_DATA.filter(t=>(ROSTER[t.id]||[]).some(m=>m.id===user.id)||t.captainId===user.id).map(t=>t.id) : [];
                  const unread = n.id==="messages"&&user ? CHAT.totalUnread(user.name)+TEAM_CHAT.totalUnread(user.id,userTeamIds) : 0;
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

        {screen==="app" && view==="map"      && !selTerrain && <MapView onSelect={t=>{setTerrain(t);setView("terrain");}} terrains={terrains} user={user} onAddTerrain={addTerrain} userPos={userPos} gpsError={gpsError} gpsLoading={gpsLoading} onRequestGps={requestGps}/>}
        {screen==="app" && view==="terrain"  && selTerrain  && <div style={{flex:1,overflowY:"auto"}}><TerrainDetail terrain={selTerrain} onBack={()=>{setView("map");setTerrain(null);}} user={user} onUpdatePhone={updateTerrainPhone} onDelete={deleteTerrain}/></div>}
        {screen==="app" && view==="teams"    && <TeamsView user={user} terrains={terrains} onGoToMessages={goToMessages}/>}
        {screen==="app" && view==="messages" && <MessagingView user={user} openWith={openMsgWith}/>}
        {screen==="app" && view==="social"   && <SocialView user={user} terrains={terrains} onGoToMessages={goToMessages}/>}
        {screen==="app" && view==="profile"  && <ProfileView user={user} onLogout={doLogout} onUpdate={doUpdate} onGoSupport={()=>setView("support")} onGoAdmin={()=>setView("admin")}/>}
        {screen==="app" && view==="support"  && <SupportView user={user} onBack={()=>setView("profile")}/>}
        {screen==="app" && view==="admin" && user?.role==="admin" && <AdminView onBack={()=>setView("profile")} onMaintenanceChange={msg=>setMaintenanceBanner(msg)}/>}

        {showInvites && user && <InvitesPanel user={user} onClose={()=>setShowInvites(false)}/>}
      </div>

      {/* Bottom nav mobile */}
      {isMobile && screen==="app" && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:"calc(56px + env(safe-area-inset-bottom))",background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:200,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {NAV.map(n=>{
            const userTeamIds = user ? TEAMS_DATA.filter(t=>(ROSTER[t.id]||[]).some(m=>m.id===user.id)||t.captainId===user.id).map(t=>t.id) : [];
            const unread = n.id==="messages"&&user ? CHAT.totalUnread(user.name)+TEAM_CHAT.totalUnread(user.id,userTeamIds) : 0;
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
