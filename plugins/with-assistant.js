const { withAndroidManifest, withMainActivity } = require('expo/config-plugins');

// Lets Android offer the app as the default digital assistant (long press on power/home).
// The ASSIST intent is turned into a rappels://dicter link so JS can open dictation.
const LINK = 'rappels://dicter';

function withAssistIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const main = app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    main['intent-filter'] = main['intent-filter'] ?? [];
    const has = main['intent-filter'].some((f) => f.action?.some((a) => a.$['android:name'] === 'android.intent.action.ASSIST'));
    if (!has) {
      main['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.ASSIST' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      });
    }
    return cfg;
  });
}

function withAssistLink(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('asVoiceLink')) return cfg;
    src = src
      .replace('import android.os.Bundle', 'import android.os.Bundle\nimport android.content.Intent\nimport android.net.Uri')
      .replace(/(override fun onCreate\(savedInstanceState: Bundle\?\) \{\n)/, '$1    asVoiceLink(intent)\n')
      .replace(
        /(override fun getMainComponentName\(\))/,
        `override fun onNewIntent(intent: Intent) {
    super.onNewIntent(asVoiceLink(intent))
  }

  private fun asVoiceLink(intent: Intent): Intent {
    if (intent.action == Intent.ACTION_ASSIST) {
      intent.action = Intent.ACTION_VIEW
      intent.data = Uri.parse("${LINK}")
    }
    return intent
  }

  $1`,
      );
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = (config) => withAssistLink(withAssistIntent(config));
