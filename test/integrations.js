'use strict';

const expect = require('chai').expect;
const _ = require('lodash');
const Collector = require('../lib/index.js');

/* eslint-disable no-undef, max-len, no-unused-expressions */
describe('parsing the current version of the Google Play store', () => {
	// Use Google Maps because we shouldn't have to worry about it going away
	const collector = new Collector('com.google.android.apps.maps', { maxPages: 1 });
	let reviews;
	let hadError;

	before((done) => {
		collector.on('page complete', (pageReviews) => {
			reviews = pageReviews;
			done();
		});

		collector.on('done collecting', (err) => {
			if (typeof reviews === 'undefined' && err) {
				hadError = true;
				done();
			}
		});

		collector.collect();
	});

	it('should result in some reviews', () => {
		expect(reviews).to.exist;
		expect(_.isArray(reviews)).to.be.true;
	});

	it('should not result in an error', () => {
		expect(hadError).to.be.undefined;
	});

	it('should include values for (almost) all fields', () => {
		expect(_.isArray(reviews)).to.be.true;
		const fields = {
			appId: 0,
			appName: 0,
			os: 0,
			device: 0,
			type: 0,
			id: 0,
			date: 0,
			rating: 0,
			title: 0,
			text: 0,
		};
		// Add up the number of times each field was present
		_.forEach(reviews, (review) => {
			if (review.appId) { fields.appId++; }
			if (review.appName) { fields.appName++; }
			if (review.os) { fields.os++; }
			if (review.device) { fields.device++; }
			if (review.type) { fields.type++; }
			if (review.id) { fields.id++; }
			if (review.date) { fields.date++; }
			if (review.rating) { fields.rating++; }
			if (review.title) { fields.title++; }
			if (review.text) { fields.text++; }
		});
		const numReviews = reviews.length;
		// Check all of the mandatory fields
		expect(fields.appId).to.equal(numReviews);
		expect(fields.appName).to.equal(numReviews);
		expect(fields.os).to.equal(numReviews);
		expect(fields.device).to.equal(numReviews);
		expect(fields.type).to.equal(numReviews);
		expect(fields.id).to.equal(numReviews);
		expect(fields.date).to.equal(numReviews);
		expect(fields.rating).to.equal(numReviews);
		// Check our optional fields to make sure they were present at least once
		expect(fields.title).to.be.at.least(1);
		expect(fields.text).to.be.at.least(1);
	});
});
/* eslint-enable no-undef, max-len, no-unused-expressions */
