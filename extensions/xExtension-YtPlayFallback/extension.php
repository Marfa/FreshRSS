<?php
declare(strict_types=1);

final class YtPlayFallbackExtension extends Minz_Extension {
	/** @var list<string> */
	private const INSTANCES = [
		'https://invidious.nerdvpn.de',
		'https://piped.video',
	];

	#[\Override]
	public function init(): void {
		Minz_View::appendScript($this->getFileUrl('fallback.js'));
		$this->registerHook('nav_entries', [self::class, 'injectInstanceList']);
	}

	/**
	 * Expose instance list + whether video proxying is enabled (Youlag yl_invidious_enabled).
	 * Thumbnails stay on YtThumbProxy regardless.
	 */
	public static function injectInstanceList(): string {
		$json = htmlspecialchars(
			json_encode(self::INSTANCES, JSON_UNESCAPED_SLASHES) ?: '[]',
			ENT_QUOTES,
			'UTF-8'
		);
		// Match Youlag: only proxy videos when Invidious is explicitly enabled.
		$enabled = FreshRSS_Context::userConf()->attributeBool('yl_invidious_enabled') === true;
		$enabledAttr = $enabled ? '1' : '0';
		return '<span id="yt-play-fallback-instances" data-instances="' . $json
			. '" data-enabled="' . $enabledAttr . '" style="display:none"></span>';
	}
}
