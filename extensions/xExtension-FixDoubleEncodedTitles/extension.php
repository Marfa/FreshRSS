<?php
declare(strict_types=1);

final class FixDoubleEncodedTitlesExtension extends Minz_Extension {
	#[\Override]
	public function init(): void {
		$this->registerHook('entry_before_insert', [self::class, 'fixEntry']);
		$this->registerHook('entry_before_update', [self::class, 'fixEntry']);
		$this->registerHook('entry_before_display', [self::class, 'fixEntry']);
	}

	/**
	 * Collapse &amp;ENTITY; → &ENTITY; once.
	 * Leaves a correct single &amp; (for "&") alone; safe for XSS (still leaves &lt; etc.).
	 */
	public static function undoubleEntities(string $text): string {
		$fixed = preg_replace(
			'/&amp;((?:#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z][a-zA-Z0-9]*));/',
			'&$1;',
			$text
		);
		return is_string($fixed) ? $fixed : $text;
	}

	public static function fixEntry(FreshRSS_Entry $entry): FreshRSS_Entry {
		$title = $entry->title();
		$fixed = self::undoubleEntities($title);
		if ($fixed !== $title) {
			$entry->_title($fixed);
		}
		return $entry;
	}
}

// ponytail: assert-based self-check; run: php -r 'require "extensions/xExtension-FixDoubleEncodedTitles/extension.php";'
if (PHP_SAPI === 'cli' && realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
	$cases = [
		'Don&amp;#039;t Nod' => 'Don&#039;t Nod',
		'A &amp; B' => 'A &amp; B',
		'A &amp;amp; B' => 'A &amp; B',
		'&amp;lt;script&amp;gt;' => '&lt;script&gt;',
		'Already fine' => 'Already fine',
	];
	foreach ($cases as $in => $want) {
		$got = FixDoubleEncodedTitlesExtension::undoubleEntities($in);
		if ($got !== $want) {
			fwrite(STDERR, "FAIL: {$in} => {$got}, want {$want}\n");
			exit(1);
		}
	}
	echo "ok\n";
}
