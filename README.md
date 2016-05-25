# reviews-collector-android
[![Build Status](https://travis-ci.org/wbio/reviews-collector-android.svg?branch=master)](https://travis-ci.org/wbio/reviews-collector-android)
[![Code Climate](https://codeclimate.com/github/wbio/reviews-collector-android/badges/gpa.svg)](https://codeclimate.com/github/wbio/reviews-collector-android)
[![Test Coverage](https://codeclimate.com/github/wbio/reviews-collector-android/badges/coverage.svg)](https://codeclimate.com/github/wbio/reviews-collector-android/coverage)

---

## Getting Started

```javascript
const Collector = require('reviews-collector-ios');
// Create an instance of Collector to get reviews of Instagram and Facebook and only parse 2 pages max
const collector = new Collector(
	['com.instagram.android', 'com.facebook.katana'], 
	{ maxPages: 2 }
);

// Do something when we parse a review
collector.on('review', (result) => {
	console.log(`Found a ${result.review.rating} star review`);
});

// Do something when we finish parsing a page of reviews
collector.on('page complete', (result) => {
	console.log(`Finished page ${result.pageNum} of ${result.appId} and found ${result.reviews.length} reviews`);
});

// Do something when we are done parsing an app
collector.on('done collecting', (result) => {
	if (result.error) {
		console.error('Stopped collecting because something went wrong');
	} else {
		console.log(`Finished collecting reviews for ${result.appId}`);
	}
});

// Exit once we are done with all of the apps
collector.on('done with apps', () => {
    console.log('Finished collecting reviews for all of the apps');
    process.exit();
});

// Start collecting reviews
collector.collect();
```

## Instantiating
First, create a `Collector` prototype by requiring `reviews-collector-android`

```javascript
var Collector = require('reviews-collector-android');
```

Next, create an `Collector` instance using the `new` keyword and passing an app ID and an options object

```javascript
// The app Id argument can be a single app ID string...
var singleAppCollector = new Collector('com.instagram.android', { maxPages: 2 });
// ...or an array of app ID strings
var multiAppCollector = new Collector(['com.instagram.android', 'com.facebook.katana'], { maxPages: 2 });
```

Where the arguments are:

- `App ID` *(string|string[])*: The portion after the `id=` section of the URL in the Google Play Store (e.g. the app ID for this URL - `https://play.google.com/store/apps/details?id=com.google.android.apps.maps&hl=en` - would be `com.google.android.apps.maps`). You can pass a single app ID as a string, or multiple app IDs as an array of strings
- `Options` *(Object)*: An object with any (or none) of the following properties:
  - `maxPages` *(Default 5)*: The maximum number of pages of reviews to parse. Use 0 for unlimited
  - `checkBeforeContinue` *(Default false)*: When true, the `page complete` event will have both a `continue` and a `stop` function as properties of the object emitted on the event (details below). One of these must be called before the collector will proceed. This is useful when you want to, for example, check to see if the reviews already exist in your database or if they were created in the last X days, etc. **Note:** When this is set to true, `maxPages` will be ignored
     - `continue()` - Keep processing this app if possible
     - `stop()` - Stop processing this app and move onto the next one, if applicable
  - `userAgent` *(Default Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36)*: The user agent string to use when making requests
  - `delay` *(Default 5000)*: The delay (in milliseconds) between page requests
  - `maxRetries` *(Default 3)*: The maximum number of times to retry a page that could not be parsed before giving up


## Listening for Events
Several events are triggered as the Collector parses reviews. You can setup event listeners for these using:

```javascript
collector.on('<EVENT NAME>', function (result) {
	// Do something with the result every time the event is fired
});
```

Where the event name is one of:

- `'review'`
  - Fires when: A review is parsed from the page
  - Emits:

    ```javascript
	{
		os: 'Android',
		appId: '<APP_ID>',
		pageNum: '<PAGE_NUMBER>',
		review: { /* Review object */ }
	}
    ```
- `'page complete'`
  - Fires when: A page of reviews has been parsed
  - Emits:

    ```javascript
	{
		os: 'Android',
		appId: '<APP_ID>',
		pageNum: '<PAGE_NUMBER>',
		reviews: [ /* Review objects */ ],
		// If the 'checkBeforeContinue' option is set to true:
		continue: function() { /* Continue processing app */ },
		stop: function() { /* Stop processing app */ }
	}
    ```
- `'done collecting'`
  - Fires when: The collector has finished collecting reviews for a particular app for one of the following reasons:
     - The collector's `maxPages` limit is reached for an app
     - The collector reaches the last page of reviews for the app
     - The collector's `maxRetries` limit is reached for an app
  - Emits:

    ```javascript
	{
		os: 'Android',
		appId: '<APP_ID>',
		pageNum: '<PAGE_NUMBER>',
		appsRemaining: 0, // # of apps left in queue
		error: undefined || { /* Error object */ }
	}
    ```
- `'done with apps'`
  - Fires when: Processing has completed for all of the apps
  - Emits:

    ```javascript
	{
		os: 'Android'
	}
    ```


## Starting the Collector
Once you have created an instance of Collector and setup your event listeners, you can begin the collection process using:

```javascript
collector.collect();
```

The Collector will then collect reviews until it reaches one of the stop points described in the `done collecting` event (see above)
