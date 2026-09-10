// @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0
'use strict';

const init_integration = function () {
	if (!window.context) {
		if (window.console) {
			console.log('FreshRSS integration waiting for JS…');
		}
		setTimeout(init_integration, 50);
		return;
	}

	let shares = document.querySelectorAll('.group-share').length;
	document.querySelector('.share.add').addEventListener('click', event => {
		const shareTypes = event.target.closest('.group-controls').querySelector('select');
		const shareType = shareTypes.options[shareTypes.selectedIndex];
		const template = document.getElementById(shareType.getAttribute('data-form') + '-share');
		const fieldset = template.content.cloneNode(true).querySelector('fieldset');
		const replacements = {
			'##label##': shareType.text,
			'##type##': shareType.value,
			'##help##': shareType.getAttribute('data-help') || '',
			'##key##': String(shares),
			'##method##': shareType.getAttribute('data-method') || '',
			'##field##': shareType.getAttribute('data-field') || '',
		};
		const apply = (value) => {
			let out = value;
			for (const [token, replacement] of Object.entries(replacements)) {
				out = out.split(token).join(replacement);
			}
			return out;
		};
		fieldset.querySelectorAll('*').forEach((el) => {
			for (const attr of [...el.attributes]) {
				if (attr.value.includes('##')) {
					el.setAttribute(attr.name, apply(attr.value));
				}
			}
		});
		const walker = document.createTreeWalker(fieldset, NodeFilter.SHOW_TEXT);
		const textNodes = [];
		while (walker.nextNode()) {
			textNodes.push(walker.currentNode);
		}
		for (const node of textNodes) {
			if (node.nodeValue && node.nodeValue.includes('##')) {
				node.nodeValue = apply(node.nodeValue);
			}
		}
		event.target.closest('fieldset').before(fieldset);
		shares++;
	});

	document.querySelector('.post').addEventListener('click', event => {
		if (!event.target || !event.target.closest) {
			return;
		}

		const deleteButton = event.target.closest('.remove');
		if (null === deleteButton || !deleteButton.closest) {
			return;
		}

		const share = deleteButton.closest('.group-share');
		const form = deleteButton.closest('form');
		if (!share.remove || !form.submit) {
			return;
		}
		share.remove();
		form.submit();
	});
};

if (document.readyState && document.readyState !== 'loading') {
	init_integration();
} else if (document.addEventListener) {
	document.addEventListener('DOMContentLoaded', event => init_integration(), false);
}
// @license-end
