const scrapeCoamo = require('../scrapers/coamoScraper');
const scrapeLarAgro = require('../scrapers/larScraper');
const AppError = require('../errors/AppError');

const cache = {
	coamo: null,
	lar: null,
	all: null,
};

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutos

async function getCoamo(force = false) {
	const now = Date.now();
	if (!force && cache.coamo && cache.coamo.expiresAt > now) {
		return cache.coamo.value;
	}

	const data = await scrapeCoamo();
	if (!Array.isArray(data)) {
		throw new AppError('Resposta inválida ao obter cotações da Coamo', 502);
	}

	cache.coamo = { value: data, expiresAt: now + CACHE_TTL_MS };
	return data;
}

async function getLar(force = false) {
	const now = Date.now();
	if (!force && cache.lar && cache.lar.expiresAt > now) {
		return cache.lar.value;
	}

	const data = await scrapeLarAgro();
	if (!Array.isArray(data)) {
		throw new AppError('Resposta inválida ao obter cotações da LAR', 502);
	}

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
