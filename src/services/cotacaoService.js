const scrapeCoamo = require('../scrapers/coamoScraper');
const scrapeLarAgro = require('../scrapers/larScraper');

// Simple in-memory cache to avoid launching Puppeteer on every request.
// Cache structure: { value: any, expiresAt: timestamp }
const cache = {
	coamo: null,
	lar: null,
	all: null,
};

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

async function getCoamo(force = false) {
	const now = Date.now();
	if (!force && cache.coamo && cache.coamo.expiresAt > now) {
		return cache.coamo.value;
	}

	const data = await scrapeCoamo();
	cache.coamo = { value: data, expiresAt: now + CACHE_TTL_MS };
	return data;
}

async function getLar(force = false) {
	const now = Date.now();
	if (!force && cache.lar && cache.lar.expiresAt > now) {
		return cache.lar.value;
	}

	const data = await scrapeLarAgro();
	cache.lar = { value: data, expiresAt: now + CACHE_TTL_MS };
	return data;
}

async function getAll(force = false) {
	const now = Date.now();
	if (!force && cache.all && cache.all.expiresAt > now) {
		return cache.all.value;
	}

	const [coamoData, larData] = await Promise.all([getCoamo(force), getLar(force)]);
	const result = { coamo: coamoData, larAgro: larData };
	cache.all = { value: result, expiresAt: now + CACHE_TTL_MS };
	return result;
}

module.exports = { getCoamo, getLar, getAll };
