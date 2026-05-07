import { getStandUrl, stands } from "/stands-data.js?v=consistent-7-boards";

const params = new URLSearchParams(window.location.search);
const standId = params.get("stand") || "majestic";
const stand = stands[standId] || stands.majestic;
const origin = window.location.origin || "";
const standUrl = `${origin}${getStandUrl(stand.id)}`;
const displayUrl = `autoboard.live/${stand.id}`;

document.querySelector("#standName").textContent = stand.name;
if (!/stand/i.test(stand.name)) {
  document.querySelector("#standName").textContent = `${stand.name} Bus Stand`;
}
document.querySelector("#standUrl").textContent = displayUrl;
document.querySelector("#qrImage").src = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=12&data=${encodeURIComponent(standUrl)}`;
