'use strict';

const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');
const sinon = require('sinon');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events').EventEmitter;
chai.use(require('sinon-chai'));

/*
 * Reconfigure module for our tests
 */
const Collector = rewire('../lib/index.js');
// Mute the module's console
Collector.__set__({
	console: {
		log: () => null,
		error: () => null,
	},
});
// Spy on the module's console
const errSpy = sinon.spy(Collector.__get__('console'), 'error');
const logSpy = sinon.spy(Collector.__get__('console'), 'log');

/*
 * Setup fixtures
 */
const fixturesDir = path.join(__dirname, 'fixtures');
const validResponse = fs.readFileSync(`${fixturesDir}/valid.txt`, 'utf8');
const invalidResponse = fs.readFileSync(`${fixturesDir}/invalid.txt`, 'utf8');
const noReviewsResponse = fs.readFileSync(`${fixturesDir}/noreviews.txt`, 'utf8');

/* eslint-disable no-undef, max-len, no-unused-expressions */
describe('unit testing', () => {
	describe('parsing response to HTML', () => {
		it('should parse a valid response where content-type == JSON and reviews are present as a string', () => {
			const response = {
				headers: {
					'content-type': 'application/json; charset=utf-8',
				},
				body: validResponse,
			};
			const val = Collector.__get__('responseToHtml')(response);
			expect(typeof val).to.equal('string');
		});

		it('should parse a valid response where content-type == JSON and reviews are not present as null', () => {
			const response = {
				headers: {
					'content-type': 'application/json; charset=utf-8',
				},
				body: noReviewsResponse,
			};
			const val = Collector.__get__('responseToHtml')(response);
			expect(val).to.equal(null);
			expect(logSpy).to.be.calledWith('No more reviews for this app');
		});

		it('should parse a valid response where content-type == JSON as undefined', () => {
			const response = {
				headers: {
					'content-type': 'application/json; charset=utf-8',
				},
				body: invalidResponse,
			};
			const val = Collector.__get__('responseToHtml')(response);
			expect(typeof val).to.equal('undefined');
			expect(errSpy).to.be.calledWith('Unexpected response - JSON was invalid');
		});

		it('should parse a valid response where content-type != JSON as undefined', () => {
			const response = {
				headers: {
					'content-type': 'text/html; charset=utf-8',
				},
				body: invalidResponse,
			};
			const val = Collector.__get__('responseToHtml')(response);
			expect(typeof val).to.equal('undefined');
			expect(errSpy).to.be.calledWith('Unexpected response - was not in JSON format');
		});
	});

	describe('parsing HTML into reviews', () => {
		// Get our HTML
		const response = {
			headers: {
				'content-type': 'application/json; charset=utf-8',
			},
			body: validResponse,
		};
		const validHtml = Collector.__get__('responseToHtml')(response);
		const invalidHtml = '<div>Some non-review HTML</div>';
		// Create our fake emitter
		const fakeEmitter = {
			emit: () => null,
		};

		it('should parse valid HTML into an array of reviews', () => {
			const converted = Collector.__get__('htmlToReviews')(validHtml, 'an.app.id', 0, fakeEmitter.emit);
			expect(converted).to.be.an('object');
			expect(converted).to.have.a.property('reviews');
			expect(converted).to.not.have.a.property('error');
			expect(_.isArray(converted.reviews)).to.be.true;
			expect(converted.reviews.length).to.equal(40);
		});

		it('should parse invalid HTML into an empty array of reviews', () => {
			const converted = Collector.__get__('htmlToReviews')(invalidHtml, 'an.app.id', 0, fakeEmitter.emit);
			expect(converted).to.be.an('object');
			expect(converted).to.have.a.property('reviews');
			expect(converted).to.not.have.a.property('error');
			expect(_.isArray(converted.reviews)).to.be.true;
			expect(converted.reviews.length).to.equal(0);
		});

		it('should emit a "review" event for each review', () => {
			// Set up our spy on the event emitter
			const emitterSpy = sinon.spy();
			// Call the method
			Collector.__get__('htmlToReviews')(validHtml, 'an.app.id', 0, emitterSpy);
			expect(emitterSpy.callCount).to.equal(40);
		});
	});

	describe('miscellaneous functions', () => {
		describe('formToString', () => {
			it('should convert an object to "key=value" format', () => {
				const obj = {
					color: 'green',
				};
				const str = Collector.__get__('formToString')(obj);
				expect(str).to.equal('color=green');
			});

			it('should append an ampersand between all key/value pairs', () => {
				const obj = {
					color: 'green',
					size: 'large',
					position: 'left',
					height: 'tall',
				};
				const str = Collector.__get__('formToString')(obj);
				expect(str).to.equal('color=green&size=large&position=left&height=tall');
			});

			it('should URL-encode everything', () => {
				const obj = {
					name: 'John Doe',
				};
				const str = Collector.__get__('formToString')(obj);
				expect(str).to.equal('name=John%20Doe');
			});
		});
	});
});
/* eslint-enable no-undef, max-len, no-unused-expressions */
