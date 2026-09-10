<?php
declare(strict_types=1);

/**
 * Kept for installs that already enabled it; core Entry::title() / html_only_entity_decode
 * now apply the same undouble. Safe no-op if core already fixed the string.
 */
final class FixDoubleEncodedTitlesExtension extends Minz_Extension {
	#[\Override]
	public function init(): void {
		$this->registerHook('entry_before_insert', [self::class, 'fixEntry']);
		$this->registerHook('entry_before_update', [self::class, 'fixEntry']);
		$this->registerHook('entry_before_display', [self::class, 'fixEntry']);
	}

	public static function fixEntry(FreshRSS_Entry $entry): FreshRSS_Entry {
		$title = $entry->title();
		$fixed = undouble_html_entities($title);
		if ($fixed !== $title) {
			$entry->_title($fixed);
		}
		return $entry;
	}
}
