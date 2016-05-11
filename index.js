'use strict';

const Crawler = require('node-webcrawler');
const cheerio = require('cheerio');
const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;


class Collector {

	constructor(appId, options) {
		const defaults = {
			maxPages: 5,
			userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36',
			delay: 5000,
			maxRetries: 3,
		};

		this.appId = appId;
		this.options = _.assign(defaults, options);
		this.emitter = new EventEmitter();
		this.retries = 0;
	}

	collect() {
		const self = this;

		const c = new Crawler({
			maxConnections: 1,
			rateLimits: self.options.delay,
			followRedirect: true,
			followAllRedirects: true,
			callback: function (error, result) {
				if (error) {
					console.log(`Could not complete the request: ${error}`);
					self.retries++;
					if (self.retries <= self.options.maxRetries) {
						queue(result.options.pageNum);
					}
				}
				const decoded = decodeUnicode(decodeUTF8(result.body));
				try {
					parse(JSON.parse(decoded.substring(6, decoded.length)), result.options.pageNum);
				} catch (err) {
					console.log(`Could not parse JSON: ${err}`);
					self.retries++;
					if (self.retries <= self.options.maxRetries) {
						queue(result.options.pageNum);
					}
				}
			},
		});

		queue(0);

		function queue(pageNum) {
			const url = `https://play.google.com/store/getreviews?id=${self.appId}&reviewSortOrder=0&reviewType=1&pageNum=${pageNum}`;
			const postData = {
				xhr: '1',
			};
			c.queue({
				uri: url,
				method: 'POST',
				headers: {
					'User-Agent': self.options.userAgent,
					'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
					'Content-Length': formToString(postData).length,
				},
				form: postData,
				pageNum: pageNum,
			});
		}

		function parse(result, pageNum) {
			const $ = cheerio.load(result[0][2]);
			try {
				const reviewObjs = $('.single-review');
				let i;
				// Get the reviews
				for (i = 0; i < reviewObjs.length; i++) {
					const review = {};
					const reviewObj = $(reviewObjs[i]);
					const reviewInfo = $(reviewObj).find('.review-info');
					const reviewBody = $(reviewObj).children('.review-body');
					// App Information
					review.appId = self.appId;
					review.appName = 'tbd';
					review.os = 'Android';
					review.device = 'Android';
					review.type = 'review';
					// Review ID
					const id = reviewObj.children('.review-header').attr('data-reviewid');
					review.id = id;
					// Review Date
					const dateStr = $(reviewInfo).children('.review-date').text();
					review.date = new Date(dateStr);
					// Review Rating
					const ratingStr = $(reviewInfo).find('.current-rating').attr('style');
					const widthRegex = /width: ([0-9]{2,3})%/;
					review.rating = Number(widthRegex.exec(ratingStr)[1]) / 20;
					// Review Title
					review.title = $(reviewBody).children('.review-title').text().trim();
					// Review Text
					review.text = $(reviewBody)
						.contents()
						.filter(function () {
							return this.nodeType === 3;
						})[0]
						.nodeValue;
					// Review Version
					review.version = 'Unknown';

					// Let our listener(s) know
					self.emitter.emit('review', review);
				}
				// Reset retries
				self.retries = 0;
				// Queue the next page if we're allowed
				const nextPage = pageNum + 1;
				if (nextPage < self.options.maxPages - 1) {
					queue(nextPage);
				}
			} catch (err) {
				console.log(`Could not turn response into reviews: ${err}`);
				self.retries++;
				if (self.retries < self.options.maxRetries) {
					queue(pageNum);
				}
			}
		}
	}

	on(event, action) {
		this.emitter.on(event, action);
	}

}
module.exports = Collector;

function decodeUnicode(str) {
	if (str) {
		const patt = /\\u([\d\w]{4})/gi;
		return str.replace(patt, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
	}
}

function decodeUTF8(str) {
	try {
		const decoded = escape(str);
		return decodeURIComponent(decoded);
	} catch (err) {
		return str;
	}
}

function formToString(form) {
	const keys = Object.keys(form);
	let str = '';
	let i;
	for (i = 0; i < keys.length; i++) {
		if (i > 0) {
			str += '&';
		}
		str += `${keys[i]}=${form[keys[i]]}`;
	}
	return str;
}
