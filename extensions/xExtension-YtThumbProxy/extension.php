<?php
declare(strict_types=1);

final class YtThumbProxyExtension extends Minz_Extension {
	#[\Override]
	public function init(): void {
		$this->registerHook('entry_before_display', [self::class, 'proxyThumbnails']);
	}

	public static function rewriteUrl(string $url): string {
		if (preg_match('#^https://i[0-9]?\\.ytimg\\.com/(vi/.+)$#i', $url, $m) === 1) {
			return 'https://feeds.themarfa.name/ytcdn/i/' . $m[1];
		}
		if (preg_match('#^https://img\\.youtube\\.com/(vi/.+)$#i', $url, $m) === 1) {
			return 'https://feeds.themarfa.name/ytcdn/img/' . $m[1];
		}
		return $url;
	}

	public static function rewriteHtml(string $content): string {
		if ($content === '') {
			return $content;
		}
		return preg_replace_callback(
			'#https://(?:i[0-9]?\\.ytimg\\.com|img\\.youtube\\.com)/[^\\s"\'>]+#i',
			static fn(array $m): string => self::rewriteUrl($m[0]),
			$content
		) ?? $content;
	}

	public static function proxyThumbnails(FreshRSS_Entry $entry): FreshRSS_Entry {
		$entry->_content(self::rewriteHtml($entry->content()));

		$thumbnail = $entry->thumbnail(true);
		if (is_array($thumbnail) && !empty($thumbnail['url']) && is_string($thumbnail['url'])) {
			$thumbnail['url'] = self::rewriteUrl($thumbnail['url']);
			$entry->_attribute('thumbnail', $thumbnail);
		}
		return $entry;
	}
}
