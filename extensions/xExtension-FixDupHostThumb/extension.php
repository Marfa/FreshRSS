<?php
declare(strict_types=1);

final class FixDupHostThumbExtension extends Minz_Extension {
	#[\Override]
	public function init(): void {
		$this->registerHook('entry_before_insert', [self::class, 'fixEntry']);
		$this->registerHook('entry_before_display', [self::class, 'fixEntry']);
	}

	public static function rewriteUrl(string $url): string {
		// https://host.tld/host.tld/path -> https://host.tld/path
		$fixed = preg_replace('#^(https?://([^/]+))/\\2/#i', '$1/', $url);
		return is_string($fixed) ? $fixed : $url;
	}

	public static function fixEntry(FreshRSS_Entry $entry): FreshRSS_Entry {
		$thumbnail = $entry->thumbnail(true);
		if (is_array($thumbnail) && !empty($thumbnail['url']) && is_string($thumbnail['url'])) {
			$thumbnail['url'] = self::rewriteUrl($thumbnail['url']);
			$entry->_attribute('thumbnail', $thumbnail);
		}

		$enclosures = $entry->enclosures(true);
		if (is_array($enclosures)) {
			$changed = false;
			foreach ($enclosures as &$enc) {
				if (!empty($enc['url']) && is_string($enc['url'])) {
					$new = self::rewriteUrl($enc['url']);
					if ($new !== $enc['url']) {
						$enc['url'] = $new;
						$changed = true;
					}
				}
			}
			unset($enc);
			if ($changed) {
				$entry->_attribute('enclosures', $enclosures);
			}
		}
		return $entry;
	}
}
