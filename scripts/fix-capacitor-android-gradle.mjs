import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const androidRootBuildGradle = path.join(rootDir, 'apps', 'web', 'android', 'build.gradle');
const webAppDir = path.join(rootDir, 'apps', 'web');
const googleMirror = "maven { url 'https://maven.aliyun.com/repository/google' }";

const rootBuildGradle = await readFile(androidRootBuildGradle, 'utf8');
const agpMatch = rootBuildGradle.match(/com\.android\.tools\.build:gradle:([0-9.]+)/);

if (!agpMatch) {
  console.warn('[fix-capacitor-android-gradle] No se pudo detectar la versión AGP del proyecto. Se omite el parche.');
  process.exit(0);
}

const agpVersion = agpMatch[1];

async function patchGradleFile(filePath, label) {
  const source = await readFile(filePath, 'utf8');
  const targetLinePattern = /classpath 'com\.android\.tools\.build:gradle:[0-9.]+'/;
  const currentMatch = source.match(targetLinePattern);

  if (!currentMatch) {
    console.warn(`[fix-capacitor-android-gradle] No se encontró la dependencia AGP en ${label}.`);
    return false;
  }

  const desiredLine = `classpath 'com.android.tools.build:gradle:${agpVersion}'`;
  let updated = source.replace(targetLinePattern, desiredLine);

  updated = updated.replace(
    /buildscript\s*\{[\s\S]*?repositories\s*\{\s*[\r\n]+\s*google\(\)/,
    (match) => match.replace(/google\(\)/, `${googleMirror}\n        google()`),
  );

  updated = updated.replace(
    /\nrepositories\s*\{\s*[\r\n]+\s*google\(\)/,
    (match) => match.replace(/google\(\)/, `${googleMirror}\n    google()`),
  );

  if (updated === source) {
    console.log(`[fix-capacitor-android-gradle] ${label} ya estaba alineado con AGP ${agpVersion}.`);
    return false;
  }

  await writeFile(filePath, updated, 'utf8');

  const agpMessage =
    currentMatch[0] === desiredLine
      ? `AGP ${agpVersion} ya estaba aplicado`
      : `AGP actualizado de ${currentMatch[0]} a ${desiredLine}`;

  console.log(`[fix-capacitor-android-gradle] ${label}: ${agpMessage} y mirror Maven agregado.`);
  return true;
}

const capacitorAndroidPackageJson = require.resolve('@capacitor/android/package.json', {
  paths: [webAppDir, rootDir],
});
const capacitorAndroidDir = path.dirname(capacitorAndroidPackageJson);

await patchGradleFile(path.join(capacitorAndroidDir, 'capacitor', 'build.gradle'), '@capacitor/android');

const cordovaPluginsGradle = path.join(
  rootDir,
  'apps',
  'web',
  'android',
  'capacitor-cordova-android-plugins',
  'build.gradle',
);

try {
  await patchGradleFile(cordovaPluginsGradle, 'capacitor-cordova-android-plugins');
} catch {
  console.warn('[fix-capacitor-android-gradle] No se pudo parchear capacitor-cordova-android-plugins todavía.');
}
