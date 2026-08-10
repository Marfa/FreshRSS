'use strict';

/**
 * Poll /build-id.txt (baked into the Docker image). When the running instance
 * switches to a new build (blue-green deploy), show a refresh banner.
 */
(function () {
	const POLL_MS = 300000; // 5 min — static file, no need to hammer the VPS
	// DocumentRoot is p/; pages live under /i/ — resolve via main.js URL
	const mainScript = document.querySelector('script[src*="main.js"]');
	const BUILD_URL = mainScript
		? new URL('../build-id.txt', mainScript.src).href
		: '/build-id.txt';

	let pageBuildId = null;
	let bannerShown = false;
	let started = false;
	let timer = null;

	function message() {
		if (window.context && context.i18n && context.i18n.instance_update) {
			return context.i18n.instance_update;
		}
		return 'Update available. Refresh?';
	}

	function showBanner() {
		if (bannerShown || document.getElementById('instance-update')) {
			return;
		}
		bannerShown = true;
		const bar = document.createElement('div');
		bar.id = 'instance-update';
		const link = document.createElement('a');
		link.href = '#';
		link.textContent = message();
		link.addEventListener('click', function (e) {
			e.preventDefault();
			location.reload();
		});
		bar.appendChild(link);
		document.body.appendChild(bar);
	}

	function poll() {
		if (document.hidden) {
			return;
		}
		fetch(BUILD_URL, { cache: 'no-store', credentials: 'same-origin' })
			.then(function (res) {
				if (!res.ok) {
					return null;
				}
				return res.text();
			})
			.then(function (text) {
				if (text == null) {
					return;
				}
				const id = String(text).trim();
				if (!id || id === 'unknown') {
					return;
				}
				if (pageBuildId === null) {
					pageBuildId = id;
					return;
				}
				if (id !== pageBuildId) {
					showBanner();
				}
			})
			.catch(function () { /* ignore transient deploy blips */ });
	}

	function start() {
		if (started) {
			return;
		}
		started = true;
		poll();
		timer = setInterval(poll, POLL_MS);
		document.addEventListener('visibilitychange', function () {
			if (!document.hidden) {
				poll();
			}
		});
	}

	function boot() {
		if (window.context) {
			start();
			return;
		}
		document.addEventListener('freshrss:globalContextLoaded', start);
		setTimeout(start, 3000);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', boot);
	} else {
		boot();
	}
})();
