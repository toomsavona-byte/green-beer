import fs from 'fs';
import path from 'path';

const root = process.cwd();
const androidRoot = path.join(root, 'android');

if (!fs.existsSync(androidRoot)) {
  console.error('Android project folder not found. Run "npx cap add android" first.');
  process.exit(1);
}

// 1. Force sensorLandscape in AndroidManifest.xml so the APK always opens horizontally
const manifestPath = path.join(androidRoot, 'app/src/main/AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (manifest.includes('android:screenOrientation=')) {
  manifest = manifest.replace(
    /android:screenOrientation="[^"]*"/g,
    'android:screenOrientation="sensorLandscape"'
  );
} else {
  manifest = manifest.replace(
    /<activity([^>]*android:name="\.MainActivity"[^>]*)>/,
    '<activity$1 android:screenOrientation="sensorLandscape">'
  );
}
if (manifest.includes('android:usesCleartextTraffic=')) {
  manifest = manifest.replace(
    /android:usesCleartextTraffic="[^"]*"/g,
    'android:usesCleartextTraffic="true"'
  );
} else {
  manifest = manifest.replace(
    /<application\b/,
    '<application android:usesCleartextTraffic="true"'
  );
}
// 1b. Add explicit network_security_config.xml so Android 9+ WebViews allow cleartext ws:// and http:// to VPS IPs
const xmlDir = path.join(androidRoot, 'app/src/main/res/xml');
fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(
  path.join(xmlDir, 'network_security_config.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`,
  'utf8'
);

if (!manifest.includes('android:networkSecurityConfig=')) {
  manifest = manifest.replace(
    /<application\b/,
    '<application android:networkSecurityConfig="@xml/network_security_config"'
  );
}

fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log('✓ AndroidManifest.xml locked to sensorLandscape + cleartext WS & networkSecurityConfig enabled');

// 2. Patch MainActivity.java for immersive sticky fullscreen & keep screen awake
const mainActPath = path.join(
  androidRoot,
  'app/src/main/java/com/greenbeer/pizedes/MainActivity.java'
);
if (fs.existsSync(mainActPath)) {
  const immersiveJava = `package com.greenbeer.pizedes;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }
}
`;
  fs.writeFileSync(mainActPath, immersiveJava, 'utf8');
  console.log('✓ MainActivity.java patched for immersive fullscreen + keep screen on');
}

// 3. Copy generated GREEN BEER PIZEDES PNG icons into Android mipmap densities
const resRoot = path.join(androidRoot, 'app/src/main/res');
const srcIcon = path.join(root, 'public/pwa-512x512.png');
const srcForeground = path.join(root, 'public/pwa-maskable-512x512.png');

if (fs.existsSync(srcIcon)) {
  const densities = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi',
  ];
  for (const dir of densities) {
    const targetDir = path.join(resRoot, dir);
    if (fs.existsSync(targetDir)) {
      fs.copyFileSync(srcIcon, path.join(targetDir, 'ic_launcher.png'));
      fs.copyFileSync(srcIcon, path.join(targetDir, 'ic_launcher_round.png'));
      if (fs.existsSync(srcForeground)) {
        fs.copyFileSync(srcForeground, path.join(targetDir, 'ic_launcher_foreground.png'));
      }
    }
  }
  const bgXml = path.join(resRoot, 'values/ic_launcher_background.xml');
  if (fs.existsSync(bgXml)) {
    fs.writeFileSync(
      bgXml,
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#090C11</color>\n</resources>\n',
      'utf8'
    );
  }
  console.log('✓ Android launcher icons updated');
}
