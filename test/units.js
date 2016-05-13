'use strict';

const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
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

/* eslint-disable no-undef, max-len */
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
});
/* eslint-enable no-undef, max-len */
